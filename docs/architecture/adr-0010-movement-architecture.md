# ADR-0010: Movement Architecture

## Status
Proposed

## Date
2026-05-20

## Engine Compatibility

| Field | Value |
|-------|-------|
| **Engine** | Unreal Engine 5.7 |
| **Domain** | Movement (CharacterMovementComponent) |
| **Knowledge Risk** | MEDIUM — UE 5.7 is post-LLM-cutoff (May 2025). CMC subclassing API is stable since UE4 and no breaking changes are documented in VERSION.md for this domain. Animation Authoring tooling changed in 5.7 but CMC PhysCustom API is unaffected. |
| **References Consulted** | `docs/engine-reference/unreal/VERSION.md`, `docs/engine-reference/unreal/modules/animation.md`, `docs/engine-reference/unreal/modules/physics.md` |
| **Post-Cutoff APIs Used** | None identified — UCharacterMovementComponent and MOVE_Custom are stable pre-5.7 APIs; noise API corrected to `UAISense_Hearing::ReportNoiseEvent` (see Verification Required) |
| **Verification Required** | (1) `PhysCustom(float DeltaTime, int32 Iterations)` signature — confirmed stable by engine specialist (unchanged since UE4). (2) Noise API — `UAIPerceptionSystem::MakeNoise()` does NOT exist in UE 5.7; correct API: `UAISense_Hearing::ReportNoiseEvent(WorldCtx, NoiseLocation, Loudness, Instigator, MaxRange, Tag)` (engine specialist confirmed 2026-05-21). (3) `FAnimNode_FootPlacement` — confirmed correct for 5.7 (replaced `AnimNode_LegIK` in 5.1+); requires IKRetargeter-compatible skeleton setup. |

## ADR Dependencies

| Field | Value |
|-------|-------|
| **Depends On** | ADR-0001 (cross-system communication — delegate contracts); ADR-0003 (Enhanced Input — input routing via PC delegates); ADR-0004 (subsystem/module architecture — UActorComponent per-actor pattern); ADR-0007 (physics — surface queries via UPhysicsHelperSubsystem) |
| **Enables** | None — movement is consumed by all core systems |
| **Blocks** | Epic: Movement System implementation; Epic: Stealth System (reads noise/visibility); Epic: Health System i-frame integration; Epic: Combat System dodge window integration |
| **Ordering Note** | ADR-0001, 0003, 0004, 0007 must be Accepted before movement stories begin. All four are already written. |

## Context

### Problem Statement

The movement system is the core of Hostile World's moment-to-moment gameplay. It must implement 8 distinct movement states (Idle, Walk, Sprint, Crouch, Jump, Fall, Dodge, Cover) with stamina gating, surface-aware speed penalties, noise emission for AI hearing, and invincibility-frame dodge — all integrated with the project's established event-driven architecture (ADR-0001), Enhanced Input routing (ADR-0003), and physics surface queries (ADR-0007).

The key architectural question is: how to organise movement state, stamina, dodge physics, and cover proximity into classes that satisfy UE5's character physics pipeline while exposing clean delegate interfaces to the 7 downstream systems that depend on movement data.

### Constraints

- Must extend `UCharacterMovementComponent`, not replace it (TR-movement-001; GDD explicit requirement)
- Stamina must live on `AHostileCharacter`, not the CMC (TR-movement-003)
- Cover proximity detection must be event-driven at ≤4Hz — never per-frame polling (TR-movement-006; forbidden pattern: `polling_state_in_tick`)
- All downstream notifications must use `DECLARE_DYNAMIC_MULTICAST_DELEGATE` (ADR-0001 contract)
- Input actions consumed via ADR-0003 multicast delegates from AHostileWorldPlayerController — movement never binds IA_* directly
- Surface queries must go through `UPhysicsHelperSubsystem::GetSurfaceType()` — never raw line traces for surface classification (ADR-0007)
- All phase timers (stamina drain, regen delay, dodge phases, exhaustion) tracked in accumulated `Δt` — never frame counts (TR-movement-010)
- Movement VFX budget: <0.5ms total; dodge distortion: <0.2ms (TR-movement-012)
- Foot IK mandatory for all locomotion states (TR-movement-013)

### Requirements

- 8 movement states with priority: Cover > Dodge > Fall > Jump > Sprint > Crouch > Walk > Idle (TR-movement-002)
- Dodge uses `MOVE_Custom(0)` with three phases: Launch, Coast (root motion), Recovery (TR-movement-004)
- Cover uses `MOVE_Custom(1)` via `UCoverComponent` separate from CMC (TR-movement-005)
- Fire `OnDodgeStarted` / `OnDodgeEnded` delegates for Health System i-frame coupling (TR-movement-007)
- Emit noise events as spherical sound events with `R_noise = clamp((N_base × M_surface + N_exhaust) × 1.5, 0, 200)` meters (TR-movement-008)
- Broadcast `OnMovementStateChanged` on every state transition (TR-movement-009)
- Animation Blueprint reads movement state — movement system never drives animation directly (TR-movement-011)
- Cover animation uses split-body layering: lower body shuffle + additive upper body lean/aim (TR-movement-014)

## Decision

### Architecture: UHostileMovementComponent + UCoverComponent

The movement system is split across two classes attached to `AHostileCharacter`:

**1. `UHostileMovementComponent` — CMC subclass**

Extends `UCharacterMovementComponent`. Owns movement state machine, speed calculation, dodge physics, stamina gate queries, and all outgoing delegates.

Responsibilities:
- Maintains `EHostileMovementState` enum (8 values) and the priority-resolved current state
- Overrides `PhysCustom(float DeltaTime, int32 Iterations)` — dispatches to `PhysDodge()` on custom mode 0 and `PhysCover()` on custom mode 1
- Reads stamina from `AHostileCharacter` via `CanSprint()`, `CanDodge(int32 StaminaCost)`, `CanJump()` — never writes stamina
- Queries `UPhysicsHelperSubsystem::GetSurfaceType()` each frame to apply `M_surface` speed and `M_surface_noise` multipliers
- Computes `V_eff = V_base(S) × M_input × M_surface × M_stamina × M_slope` each tick
- Tracks all phase timers (regen delay, exhaustion duration, dodge phases) via accumulated `DeltaTime` — never frame counts
- Fires `OnMovementStateChanged`, `OnDodgeStarted(float Duration)`, `OnDodgeEnded()`, `OnNoiseEmitted(float Radius)` delegates

Subscribes to (in `BeginPlay()`):
- `AHostileWorldPlayerController::OnMove` → triggers Walk/Sprint evaluation
- `AHostileWorldPlayerController::OnSprint` → sprint gate check
- `AHostileWorldPlayerController::OnCrouch` → crouch toggle
- `AHostileWorldPlayerController::OnJump` → jump gate check
- `AHostileWorldPlayerController::OnDodge` → dodge activation

**2. `UCoverComponent` — UActorComponent on AHostileCharacter**

Separate from CMC per GDD requirement (TR-movement-005). Owns cover entry/exit logic and proximity detection.

Responsibilities:
- Polls for cover objects at 4Hz via `FTimerHandle` (never per-frame) using `SphereOverlapActors` with `ECC_Interactable`
- Validates cover objects: `ECoverComponent` tag, min height 100cm, max 180cm, solid collision
- On valid cover found + player presses `IA_Crouch` toward cover within 80cm: calls `SetMovementMode(MOVE_Custom, 1)` on CMC
- Handles cover slide (150 cm/s max), cover-to-cover transition (120cm gap, 0.3s), cover exit (0.2s blend)
- Subscribes to `AHostileWorldPlayerController::OnCrouch` and direction delegates for context resolution
- Cover detection triggers: on `IA_Crouch` input, on direction change, on 4Hz periodic poll — never per-frame

**3. `AHostileCharacter` — Stamina authority**

Owns stamina as a `float` UPROPERTY. Exposes:
- `CanSprint() → bool` (stamina > 10%)
- `CanDodge(int32 Cost) → bool` (stamina ≥ Cost)
- `CanJump() → bool` (stamina > 10%)
- `ConsumeStamina(float Amount)` — the only write path
- `RegenStamina(float DeltaTime)` — called by CMC after drain delay gate passes

### Architecture Diagram

```
AHostileWorldPlayerController (ADR-0003)
  │  OnMove / OnSprint / OnCrouch / OnJump / OnDodge / OnLean* delegates
  │
  └─► AHostileCharacter
        ├── UHostileMovementComponent (CMC subclass)
        │     ├── EHostileMovementState  (current state, priority-resolved)
        │     ├── PhysCustom(0) → PhysDodge()   [Launch → Coast → Recovery]
        │     ├── PhysCustom(1) → PhysCover()   [delegated from UCoverComponent]
        │     ├── Queries: UPhysicsHelperSubsystem::GetSurfaceType()
        │     ├── Queries: AHostileCharacter::CanSprint/CanDodge/CanJump
        │     └── Fires delegates ──────────────────────────────────┐
        │           OnMovementStateChanged(EHostileMovementState)    │
        │           OnDodgeStarted(float IFrameDuration)             │
        │           OnDodgeEnded()                                    │
        │           OnNoiseEmitted(float RadiusMeters)               │
        │                                                             ▼
        ├── UCoverComponent (UActorComponent)                 Consumers (AddDynamic in BeginPlay)
        │     ├── 4Hz FTimerHandle poll → SphereOverlap       Health System (i-frames)
        │     ├── Cover validation logic                       Stealth System (noise, visibility, state)
        │     ├── SetMovementMode(MOVE_Custom, 1) on enter     Combat System (dodge window, speed)
        │     └── Cover-to-cover transition logic              Camera System (state, dodge active)
        │                                                       Alien AI System (noise radius)
        └── Stamina (float) — sole authority
              CanSprint / CanDodge / CanJump (queries)
              ConsumeStamina / RegenStamina (write methods)
```

### Key Interfaces

```cpp
// Movement state enum
UENUM(BlueprintType)
enum class EHostileMovementState : uint8
{
    Idle,
    Walk,
    Sprint,
    Crouch,
    Jump,
    Fall,
    Dodge,
    Cover
};

// Delegates on UHostileMovementComponent
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnMovementStateChanged,
    EHostileMovementState, NewState);

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnDodgeStarted,
    float, IFrameDuration);   // 0.25s — Health System gates invuln window

DECLARE_DYNAMIC_MULTICAST_DELEGATE(FOnDodgeEnded);

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnNoiseEmitted,
    float, RadiusMeters);     // AI hearing radius in meters

UPROPERTY(BlueprintAssignable)
FOnMovementStateChanged OnMovementStateChanged;

UPROPERTY(BlueprintAssignable)
FOnDodgeStarted OnDodgeStarted;

UPROPERTY(BlueprintAssignable)
FOnDodgeEnded OnDodgeEnded;

UPROPERTY(BlueprintAssignable)
FOnNoiseEmitted OnNoiseEmitted;

// Stamina gate queries on AHostileCharacter (read-only from CMC)
bool CanSprint() const;          // stamina > 10%
bool CanDodge(float Cost) const; // stamina >= Cost (float — matches stamina precision)
bool CanJump() const;            // stamina > 10%

// Cover component interface
void TryEnterCover();   // called on IA_Crouch input within 80cm of valid cover
void ExitCover();
bool IsInCover() const;
```

### Dodge Phase Implementation (MOVE_Custom 0)

```
Activation:
  1. AHostileCharacter::CanDodge(25.0f) == true
  2. Current state != Fall
  3. CMC SetMovementMode(MOVE_Custom, 0)
  4. AHostileCharacter::ConsumeStamina(25)
  5. Fire OnDodgeStarted(0.25f)
  6. Lock dodge direction at activation (8-way input vector)

PhysDodge() phases (accumulated DeltaTime, never frame counts):
  Wind-up  [0.00 – 0.10s]: Input buffer, cancellable, no i-frames
  Active   [0.10 – 0.35s]: Launch() at 800 cm/s + root motion coast, full i-frames
  Recovery [0.35 – 0.65s]: Braking decel to 300 cm/s, no i-frames

On phase complete (t >= 0.65s):
  CMC SetMovementMode(MOVE_Walking)
  Fire OnDodgeEnded()
```

### Noise Emission

Noise emitted via `UAIPerceptionSystem::MakeNoise()` (static helper, UE4+) after computing:

```
R_noise = clamp((N_base(S) × M_surface_noise + N_exhaust) × 1.5, 0, 200)  [meters]

// Correct API (validated by engine specialist — ReportNoise() does not exist):
UAIPerceptionSystem::MakeNoise(
    GetOwner(),                    // Instigator
    R_noise / 200.0f,              // Loudness (0–1, normalized from radius)
    GetOwner(),                    // NoiseInstigator
    GetOwner()->GetActorLocation() // Location
);
```

Alternatively, construct `FAINoiseEvent` and call `UAIPerceptionSystem::ReportEvent()` for full parameter control. All `UAISenseConfig_Hearing` aliens within `R_noise` meters receive the hearing percept. `OnNoiseEmitted(R_noise)` delegate also fires for any non-AI consumers.

## Alternatives Considered

### Alternative 1: Gameplay Ability System (GAS)

- **Description**: Implement Sprint, Dodge, and Cover as `UGameplayAbility` instances. Stamina as a `UAttributeSet` attribute. UE5 GAS provides built-in ability cooldowns, tags for i-frame blocking, and attribute modifiers.
- **Pros**: Engine-native ability pipeline; tags block damage during dodge automatically; attribute modifiers handle stamina multipliers cleanly; scales well if abilities expand.
- **Cons**: GAS is a substantial module dependency not established elsewhere in the project. GAS has a steep learning curve and significant setup overhead (AbilitySystemComponent on Character, AttributeSet authoring, GameplayEffect assets). No other system uses GAS — introducing it for movement alone fragments the architecture. GAS replication overhead is non-trivial even for single-player.
- **Rejection Reason**: Violates ADR-0004 "single primary module" principle and introduces a heavyweight framework for a solo indie project with no multiplayer requirement. CMC subclassing provides equivalent control with no new dependencies.

### Alternative 2: Full Custom Physics (bypass CMC)

- **Description**: Remove CMC entirely. Implement movement via a custom `UActorComponent` that computes velocity and calls `AddActorWorldOffset` or `UCharacterMovementComponent::RequestDirectMove`.
- **Pros**: Maximum control over physics integration; no CMC inheritance complexity; clean slate.
- **Cons**: Loses NavMesh agent integration (aliens pathfind to player position using CMC data); loses built-in step handling, ramp traversal, walkable floor detection; loses foot IK compatibility (UAnimInstance foot IK nodes read CMC floor data); must reimplement gravity, friction, and capsule sweeps.
- **Rejection Reason**: NavMesh integration and foot IK compatibility alone disqualify this. The cost of reimplementing CMC's physics is unjustified when CMC subclassing covers all GDD requirements.

### Alternative 3: Separate Movement State Machine UActorComponent (alongside CMC)

- **Description**: Keep CMC for physics only. Add a separate `UMovementStateMachineComponent` that owns state, stamina queries, and delegates. CMC is driven by the state machine via `MaxWalkSpeed`, `SetMovementMode`, etc.
- **Pros**: Clear separation between physics (CMC) and state logic (custom component).
- **Cons**: Two components sharing movement control creates synchronisation problems — state machine sets `MaxWalkSpeed` while CMC is already applying physics that frame. Dodge requires `PhysCustom` override which lives on CMC, so dodge logic would be split across two classes. Adds complexity without a clear payoff over a clean CMC subclass.
- **Rejection Reason**: State synchronisation between two movement-controlling components is fragile. A single CMC subclass is the canonical UE5 pattern for custom movement.

## Consequences

### Positive

- CMC subclassing is the canonical UE5 pattern — full NavMesh integration, foot IK, ramp/step handling, and physics gravity work out of the box
- `MOVE_Custom` slots cleanly separate dodge and cover physics from standard locomotion without mode conflicts
- `UCoverComponent` separation keeps cover proximity logic out of CMC, matching GDD architecture and keeping CMC focused on physics
- Delegate-based interfaces satisfy ADR-0001 without downstream systems needing CMC references
- Stamina on `AHostileCharacter` as a float is simple, testable, and readable from Blueprint without a subsystem

### Negative

- CMC subclass is tightly coupled to `AHostileCharacter` — the custom queries (`CanSprint`, `ConsumeStamina`) require a cast to `AHostileCharacter*` in the CMC
- Two MOVE_Custom slots are occupied (Dodge=0, Cover=1). Any future custom movement mode (e.g., post-MVP vaulting) must use slot 2+ and must update this ADR
- `UCoverComponent`'s 4Hz poll runs even when player is nowhere near cover — minor CPU cost (~0.1ms) accepted as the price of event-driven compliance

### Risks

- **Risk**: `PhysCustom` override signature or calling convention changed in UE 5.7 (MEDIUM risk, post-cutoff engine).
  - *Mitigation*: Verify signature at project setup before implementing. Fallback: wrap in a compatibility shim if signature changed.
- **Risk**: Root motion during dodge Coast phase conflicts with CMC physics (known UE pitfall — CMC and root motion can fight over velocity).
  - *Mitigation*: Set `bAllowPhysicsRotationDuringAnimRootMotion = false` during dodge. Disable root motion during Recovery phase. During Coast phase, explicitly call `ApplyRootMotionToVelocity(DeltaTime)` inside `PhysDodge()` — CMC does NOT auto-apply root motion during MOVE_Custom. Test explicitly at first playable.
- **Risk**: Cover exit one-frame flicker when `UCoverComponent` calls `SetMovementMode(MOVE_Custom, 1)` mid-tick.
  - *Mitigation*: Handle cover exit in `UpdateCharacterStateAfterMovement()` rather than mid-tick to prevent single-frame state inconsistency.
- **Risk**: `UAIPerceptionSystem::ReportNoise()` API changed in 5.7.
  - *Mitigation*: Verify API at project setup. The GDD noise requirement can fall back to manual radius sphere overlap + `UAIPerceptionComponent::ReportNoise` per-alien if the global API is unavailable.
- **Risk**: Foot IK node name changed in UE 5.7 Animation Authoring update (noted as breaking change in VERSION.md).
  - *Mitigation*: Verify current foot IK node (`FAnimNode_FootPlacement` vs legacy `AnimNode_LegIK`) at project setup. Document the correct node name in engine-reference before starting animation work.

## GDD Requirements Addressed

| GDD System | TR-ID | Requirement | How This ADR Addresses It |
|------------|-------|-------------|--------------------------|
| movement-system.md | TR-movement-001 | Extends UE5 CMC, does not replace it | Decision: `UHostileMovementComponent : UCharacterMovementComponent` |
| movement-system.md | TR-movement-002 | 8 movement states with priority resolution | `EHostileMovementState` enum; priority evaluated in `UpdateCharacterStateBeforeMovement()` |
| movement-system.md | TR-movement-003 | Stamina on AHostileCharacter; CMC queries, never writes | CMC reads via `CanSprint/CanDodge/CanJump`; `ConsumeStamina/RegenStamina` owned by AHostileCharacter |
| movement-system.md | TR-movement-004 | Dodge = MOVE_Custom(0); Launch/Coast/Recovery phases | `PhysCustom(0)` → `PhysDodge()` with accumulated DeltaTime phase tracking |
| movement-system.md | TR-movement-005 | Cover = UCoverComponent + MOVE_Custom(1) | `UCoverComponent` owns proximity; calls `SetMovementMode(MOVE_Custom, 1)` |
| movement-system.md | TR-movement-006 | Cover detection event-driven at ≤4Hz, never per-frame | `UCoverComponent` uses `FTimerHandle` at 4Hz + event triggers on input/direction change |
| movement-system.md | TR-movement-007 | Fire OnDodgeStarted/OnDodgeEnded delegates | `DECLARE_DYNAMIC_MULTICAST_DELEGATE` on `UHostileMovementComponent`; fired at phase transitions |
| movement-system.md | TR-movement-008 | Noise as spherical sound events; radius = Noise × 1.5m | `UHostileMovementComponent` computes `R_noise` and calls `UAIPerceptionSystem::ReportNoise()` |
| movement-system.md | TR-movement-009 | OnMovementStateChanged delegate for Stealth/Camera/AI | `FOnMovementStateChanged` multicast delegate; fired on every state transition |
| movement-system.md | TR-movement-010 | All timers in real-time seconds (accumulated Δt) | All phase tracking uses `PhysDodge(float DeltaTime)` accumulator — explicit prohibition on frame counts |
| movement-system.md | TR-movement-011 | Animation Blueprint reads state — movement does not drive animation | CMC exposes state via `GetCurrentMovementState()` read-only; Anim BP pulls, CMC never pushes |
| movement-system.md | TR-movement-012 | VFX budget <0.5ms; dodge distortion <0.2ms; max 30 particles, 8 decals | Enforced in VFX implementation; ADR documents budget as a hard constraint on VFX team |
| movement-system.md | TR-movement-013 | Foot IK mandatory for all locomotion states | Foot IK node wired in Anim Blueprint; CMC provides floor data; verified at project setup |
| movement-system.md | TR-movement-014 | Cover animation: split-body layering (lower shuffle + additive upper lean/aim) | Animation constraint documented; enforced in Anim Blueprint layering setup by animation team |
| physics-system.md | TR-physics-004 | Ground detection via pelvis line trace; surface classified via Physical Material | `UHostileMovementComponent` calls `UPhysicsHelperSubsystem::GetSurfaceType()` per tick for `M_surface` multiplier |
| health-system.md | TR-health-004 | Dodge i-frames negate damage during 0.25s active window | Health System subscribes to `OnDodgeStarted(0.25f)` / `OnDodgeEnded()` via AddDynamic |
| stealth-system.md | TR-stealth-007 | Stealth reads noise and visibility from Movement each frame | Stealth subscribes to `OnNoiseEmitted` and `OnMovementStateChanged`; maps state to visibility modifier |
| ai-system.md | TR-ai-002 | Alien AI uses UAISenseConfig_Hearing for noise detection | Movement fires `UAIPerceptionSystem::ReportNoise()` with computed radius |

## Performance Implications

- **CPU**: CMC tick runs on game thread every frame. Custom `PhysCustom` adds ~0.15ms during dodge and cover. 4Hz cover poll adds ~0.1ms amortised. Total movement CPU budget target: <0.5ms/frame.
- **Memory**: `EHostileMovementState` + stamina float + phase timers: <64 bytes on AHostileCharacter. UCoverComponent adds ~2KB for overlap result cache.
- **Load Time**: No assets loaded at runtime. All movement configuration is `UPROPERTY(EditDefaultsOnly)` on the CMC subclass.
- **Network**: Single-player game — no replication concern. If multiplayer added post-MVP, CMC subclassing is the correct base for movement replication. Custom modes replicate via `PackNetworkMovingData`/`UnpackNetworkMovingData` overrides.

## Migration Plan

No existing movement code — this is greenfield. The ADR establishes the class structure before implementation begins. Sequence:
1. Implement `UHostileMovementComponent` (basic states, stamina gate queries)
2. Wire ADR-0003 input delegates in BeginPlay
3. Implement `PhysDodge()` — verify MOVE_Custom(0) at first playable
4. Implement `UCoverComponent` with 4Hz poll
5. Connect `OnDodgeStarted/Ended` to Health System; `OnMovementStateChanged` to Stealth/Camera/AI
6. Wire Animation Blueprint read path (state, speed axis, direction, surface type)
7. Integrate foot IK (verify node name in UE 5.7 first)

## Validation Criteria

1. All 8 movement states reachable and priority correctly enforced: Cover overrides Dodge overrides Fall, etc.
2. Stamina drain and regen are frame-rate independent: test at 10fps, 30fps, 60fps — same elapsed time produces same stamina change (±0.5 tolerance).
3. Dodge displacement 290–380 cm from standstill to full sprint — verified with physics debug draw.
4. Dodge i-frame window: OnDodgeStarted fires at phase 0.10s; OnDodgeEnded fires at 0.65s — Health System invulnerability window matches.
5. Cover proximity detection triggers within 0.25s of player entering 80cm range (4Hz poll max latency).
6. Noise radius formula: sprint on hard surface = 120m; crouching on ice + exhausted = 31.5m — verified via AI perception debug display.
7. No per-frame polling of other system state — Tick() contains no `GetSubsystem<>()` calls for state reads. Verified by code review.
8. All phase timers use accumulated DeltaTime — no `GFrameCounter` or frame-count variables anywhere in movement code.

## Related Decisions

- [ADR-0001](adr-0001-cross-system-communication.md) — Dynamic multicast delegate pattern used for all movement events
- [ADR-0003](adr-0003-enhanced-input-architecture.md) — Input routing: PC fires delegates, CMC subscribes; CMC never binds IA_* directly
- [ADR-0004](adr-0004-subsystem-module-architecture.md) — UCoverComponent as UActorComponent; UHostileMovementComponent in Source/HostileWorld/
- [ADR-0007](adr-0007-physics-collision-architecture.md) — Surface queries via UPhysicsHelperSubsystem::GetSurfaceType(); noise via UAIPerceptionSystem
- [design/gdd/movement-system.md](../../design/gdd/movement-system.md) — Full movement rules, formulas, state table, and acceptance criteria
