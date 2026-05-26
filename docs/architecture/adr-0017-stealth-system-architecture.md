# ADR-0017: Stealth System Architecture

## Status
Proposed

## Date
2026-05-26

## Engine Compatibility

| Field | Value |
|-------|-------|
| **Engine** | Unreal Engine 5.7 |
| **Domain** | AI Perception / Core Subsystems |
| **Knowledge Risk** | HIGH — UE 5.4–5.7 post-LLM-cutoff |
| **References Consulted** | `docs/engine-reference/unreal/VERSION.md`, `docs/architecture/adr-0012-alien-ai-system.md`, `docs/registry/adr-subsystems.yaml` |
| **Post-Cutoff APIs Used** | `UAISense_Hearing::ReportNoiseEvent()` (confirmed ADR-0010), `UWorldSubsystem` (stable), `FTimerHandle` (stable), `UWorld::LineTraceSingleByChannel` (stable) |
| **Verification Required** | Confirm `EHostileCollision::AIPerception` channel (ADR-0007) correctly occludes objects during LOS trace; verify `OwnerComp.GetWorld()` null-check behavior during BT service tick at level teardown; confirm 4Hz `FTimerHandle` sphere overlap pattern works in World Partition zones |

## ADR Dependencies

| Field | Value |
|-------|-------|
| **Depends On** | ADR-0003 (IMC_Stealth push/pop via `AHostileWorldPlayerController`), ADR-0004 (`UWorldSubsystem` tier; `UActorComponent` per-actor stance), ADR-0007 (`EHostileCollision::AIPerception` LOS channel), ADR-0010 (`OnNoiseEmitted` and `OnMovementStateChanged` events, noise API), ADR-0012 (`IStealthDetection` interface, BT Service contract, `UAlienSquadSubsystem`, `IAlienPerceptionData`), ADR-0014 (IMC_Combat owned by `UCombatSubsystem`; `OnCombatDisengaged` for stealth reset), ADR-0015 (`UHealthComponent::OnInjuryStateChanged` for injury noise floor) |
| **Enables** | Stealth System implementation epic |
| **Blocks** | Epic: Stealth System Implementation — cannot start until this ADR is Accepted |
| **Ordering Note** | ADR-0012 must be Accepted before this can be implemented (BT Service contract and `IStealthDetection` interface are prerequisites). Accept order: ADR-0012 → ADR-0017. |

## Context

### Problem Statement
ADR-0012 establishes `IStealthDetection` as the contract between alien BT Services and the Stealth System, but no ADR defines what class implements that interface, how `D_total` is computed per the GDD formula, how per-alien scores aggregate into a global detection level, or how `IMC_Stealth` is managed. Without this ADR, implementation stories cannot reference a governing architectural decision, the class that owns `EStealthState` is undefined, and the IMC_Stealth dual-trigger rule (GDD Rule 7) has no home.

### Constraints
- ADR-0012: Stealth System is the **source of truth** for per-alien detection scores. BT Services are readers, not computors. `UAlienBTService_UpdatePerception` calls `IStealthDetection` to trigger computation and read the result.
- ADR-0004: Per-actor behavior lives in `UActorComponent`. Global/coordination state lives in `UWorldSubsystem`.
- ADR-0014: `IMC_Combat` is owned exclusively by `UCombatSubsystem`. The Stealth System must never push `IMC_Combat`.
- ADR-0001: No polling of cross-system state in `Tick()`. All player-state consumption via event bindings or timer callbacks.
- ADR-0007: LOS line traces use `EHostileCollision::AIPerception` channel — not `ECC_Visibility`.
- Performance budget (from GDD): <0.1ms per detection calculation, max 20 aliens simultaneously.
- BT Service interval: 0.5s (2Hz), matching `UAlienBTService_UpdatePerception` established in ADR-0012.

### Requirements
- Must implement GDD Formula 1: `D_total = clamp(D_noise + D_visual + D_environmental + D_memory, 0, 100)` per alien
- Must implement GDD Formula 2: detection decay rate `R_decay = R_base × M_decay_env × M_distance × M_alien_state`
- Must maintain 5 detection states: Hidden (0–24), Suspicious (25–49), Alert (50–74), Engaged (75–99), Detected (100)
- Must implement GDD Rule 7: IMC_Stealth dual trigger (crouch OR detection ≥ 25); pop requires BOTH conditions clear
- Must fire `OnStealthBroken()` when global detection reaches 100 (for `UCombatSubsystem`)
- Must provide `IsPlayerUnderThreat()` returning true at detection ≥ 75 (for narrative deferral)
- Must reset all detection scores on alien death (via `OnAlienKilled` event)
- Must reset stealth state when `UCombatSubsystem` fires `OnCombatDisengaged`

## Decision

Adopt a **two-class stealth architecture**: `UStealthSubsystem : UWorldSubsystem` owns computation and global state; `UStealthComponent : UActorComponent` on `AHostileCharacter` (player) owns IMC_Stealth management and player-facing accessors. This mirrors the `UCombatComponent + UCombatSubsystem` split established in ADR-0014.

### Architecture Diagram

```
BT Service (0.5s interval per alien):
  UAlienBTService_UpdatePerception : UBTService_BlackboardBase
      │  World* World = OwnerComp.GetWorld();  ← null-checked
      │  IStealthDetection* Stealth = World->GetSubsystem<UStealthSubsystem>();
      │  float Score = Stealth->ComputeAndGetAlienScore(PlayerActor, OwnerAlien);
      │  Blackboard->SetValueAsFloat("DetectionScore", Score);
      ▼
  UStealthSubsystem : UWorldSubsystem  (implements IStealthDetection)
      │
      │  Event-cached player state (set via event bindings in Initialize()):
      │    CachedPlayerNoiseLevel    ← OnNoiseEmitted (ADR-0010)
      │    CachedMovementState       ← OnMovementStateChanged (ADR-0010)
      │    CachedPlayerVisibility    ← derived from CachedMovementState (GDD table)
      │    CachedSurfaceNoiseMod     ← derived from movement state surface type
      │    CachedLightingMod         ← USceneManagementSubsystem time-of-day/weather event
      │    CachedWeatherFactor       ← USceneManagementSubsystem weather event
      │    CachedInjuryNoisePenalty  ← UHealthComponent::OnInjuryStateChanged (ADR-0015)
      │
      │  4Hz FTimerHandle (250ms) refreshed independently:
      │    CachedTerrainFactor  ← SphereOverlap near player for cover objects
      │    CachedInfectionFactor ← IInfectionSpreadSubsystem::GetZoneInfectionLevel()
      │
      │  Per-alien state:
      │    TMap<TWeakObjectPtr<AAlienAIController>, FAlienDetectionEntry> AlienData
      │      FAlienDetectionEntry { float CachedScore; float PeakScore; float TimeSincePeak; }
      │    float GlobalDetectionLevel  (max of all CachedScores)
      │    EStealthState CurrentState
      │    FTimerHandle DeEscalationCooldownTimer
      │
      │  On ComputeAndGetAlienScore(Player, ForAlien) — triggered by BT Service:
      │    1. Read ForAlien's IAlienPerceptionData (P_hearing, P_vision, eye location)
      │    2. Compute distance, run LOS trace (EHostileCollision::AIPerception channel)
      │    3. Compute D_total = D_noise + D_visual + D_environmental + D_memory (GDD Formula 1)
      │    4. Update AlienData[ForAlien].CachedScore = D_total
      │    5. Update GlobalDetectionLevel = max(all CachedScores)
      │    6. Run state machine; fire delegates if state changed
      │    7. Return D_total
      │
      │  Delegates fired:
      │    OnDetectionStateChanged(EStealthState OldState, EStealthState NewState)
      │    OnDetectionLevelChanged(float NewGlobalLevel)
      │    OnStealthBroken()  ← fired once when GlobalDetectionLevel reaches 100
      │
      ▼
  UStealthComponent : UActorComponent  (on AHostileCharacter — player)
      │  Subscribes to UStealthSubsystem::OnDetectionStateChanged
      │  Subscribes to UHostileMovementComponent::OnMovementStateChanged (for crouch trigger)
      │  Manages IMC_Stealth push/pop via AHostileWorldPlayerController::PushIMC / PopIMC
      │  Exposes: GetCurrentDetectionLevel() — thin wrapper over UStealthSubsystem
      │  Exposes: GetCurrentDetectionState() — thin wrapper
      │
  Consumers of UStealthSubsystem delegates:
      UCombatSubsystem   ← OnStealthBroken → triggers combat entry
      UHUDSubsystem      ← OnDetectionLevelChanged, OnDetectionStateChanged
      Audio System       ← OnDetectionStateChanged → tension music layer
      UStealthComponent  ← OnDetectionStateChanged → IMC_Stealth management
```

### Key Interfaces

```cpp
// ── IStealthDetection — extended by ADR-0017 (ADR-0012 defined the base) ────────────
class IStealthDetection {
public:
    // EXTENDED in ADR-0017: triggers per-alien D_total computation and returns result.
    // Called by UAlienBTService_UpdatePerception every 0.5s.
    // ForAlien must implement IAlienPerceptionData.
    virtual float ComputeAndGetAlienScore(AActor* TargetPlayer, AActor* ForAlien) = 0;

    // ADR-0012 original — returns GlobalDetectionLevel (read-only, no computation triggered).
    virtual float GetDetectionScore(AActor* TargetActor) = 0;

    // Returns current detection state.
    virtual EStealthState GetCurrentDetectionState() = 0;

    // Returns true when GlobalDetectionLevel >= 75 (for narrative deferral — Investigation System,
    // Dialogue System). Does NOT trigger state change.
    virtual bool IsPlayerUnderThreat() = 0;
};

// ── IAlienPerceptionData — new interface on AAlienCharacter (ADR-0017) ────────────────
// Provides alien-specific perception parameters to UStealthSubsystem.
// Backed by FAlienStatRow (UDataTable, ADR-0012).
class IAlienPerceptionData {
public:
    virtual float GetHearingSensitivity() const = 0;  // P_hearing: 0.5–2.0
    virtual float GetVisionAcuity() const = 0;        // P_vision:  0.5–2.0
    virtual FVector GetEyeLocation() const = 0;       // LOS trace origin (eye socket)
};

// ── UStealthSubsystem (UWorldSubsystem — implements IStealthDetection) ──────────────
// Access: World->GetSubsystem<UStealthSubsystem>()
// Null-check GetWorld() before calling from BT services (teardown safety).
UCLASS()
class UStealthSubsystem : public UWorldSubsystem, public IStealthDetection {
    // Event-cached player state (set via Initialize() bindings):
    float CachedPlayerNoiseLevel;     // 0–100; from OnNoiseEmitted
    EHostileMovementState CachedMovementState; // from OnMovementStateChanged
    float CachedPlayerVisibility;     // derived: Sprint=140, Walk=100, Crouch=60, etc.
    float CachedSurfaceNoiseMod;      // M_surface_noise from surface type
    float CachedLightingMod;          // 0.4–2.0; from time-of-day + flashlight
    float CachedWeatherFactor;        // E_weather: -5 to +10
    float CachedInjuryNoisePenalty;   // +0/+5/+10/+15 per EInjuryState (ADR-0015)

    // 4Hz FTimerHandle refreshed:
    float CachedTerrainFactor;        // E_terrain: -10 to +5 (SphereOverlap near player)
    float CachedInfectionFactor;      // E_infection: 0–15 (IInfectionSpreadSubsystem)

    // Per-alien detection data:
    TMap<TWeakObjectPtr<AAlienAIController>, FAlienDetectionEntry> AlienData;
    float GlobalDetectionLevel;
    EStealthState CurrentState;
    bool bDeEscalationCooldownActive;
    FTimerHandle DeEscalationCooldownHandle;

    // IStealthDetection implementation:
    float ComputeAndGetAlienScore(AActor* TargetPlayer, AActor* ForAlien) override;
    float GetDetectionScore(AActor* TargetActor) override; // returns GlobalDetectionLevel
    EStealthState GetCurrentDetectionState() override;
    bool IsPlayerUnderThreat() override; // GlobalDetectionLevel >= 75

    // Alien death cleanup — called via binding to AAlienCharacter::OnAlienKilled:
    void HandleAlienKilled(AAlienCharacter* AlienActor);

    // Called via binding to UCombatSubsystem::OnCombatDisengaged:
    void HandleCombatDisengaged();

    // Delegates:
    UPROPERTY(BlueprintAssignable)
    FDetectionStateChangedDelegate OnDetectionStateChanged; // TwoParams: OldState, NewState

    UPROPERTY(BlueprintAssignable)
    FDetectionLevelChangedDelegate OnDetectionLevelChanged; // OneParam: float NewGlobalLevel

    UPROPERTY(BlueprintAssignable)
    FStealthBrokenDelegate OnStealthBroken;
};

// ── UStealthComponent (UActorComponent — on AHostileCharacter / player) ─────────────
UCLASS()
class UStealthComponent : public UActorComponent {
    // IMC_Stealth state:
    bool bIMCStealthActive;
    bool bCrouchTriggerActive;
    bool bDetectionTriggerActive;
    FTimerHandle IMCPopCooldownHandle; // 5.0s cooldown before pop

    // Thin accessors (delegate to subsystem):
    float GetCurrentDetectionLevel() const;
    EStealthState GetCurrentDetectionState() const;

    // Internal — called on detection state change:
    void HandleDetectionStateChanged(EStealthState OldState, EStealthState NewState);
    // Internal — called on movement state change (crouch trigger):
    void HandleMovementStateChanged(EHostileMovementState NewState);

    // IMC management:
    void TryPushIMCStealth();
    void TryPopIMCStealth(); // checks both triggers before popping
};

// ── FAlienDetectionEntry ─────────────────────────────────────────────────────────────
USTRUCT()
struct FAlienDetectionEntry {
    GENERATED_BODY()
    float CachedScore    = 0.f;  // Most recent D_total for this alien
    float PeakScore      = 0.f;  // Highest D_total seen, for D_memory calculation
    float TimeSincePeak  = 0.f;  // Seconds since PeakScore was set; drives D_memory decay
};
```

### Detection Formula Implementation

`ComputeAndGetAlienScore(TargetPlayer, ForAlien)` executes the full GDD Formula 1:

```
D_total = clamp(D_noise + D_visual + D_environmental + D_memory, 0, 100)

D_noise = clamp(
    (CachedPlayerNoiseLevel + CachedInjuryNoisePenalty)
    × Alien.GetHearingSensitivity()
    × (1 / (1 + (distance / 500)²))
    × CachedSurfaceNoiseMod,
    0, 40)

D_visual = clamp(
    CachedPlayerVisibility
    × LOSValue                              ← line trace: 1.0/0.5/0.0
    × Alien.GetVisionAcuity()
    × (1 / (1 + (distance / 300)²))
    × CachedLightingMod,
    0, 35)

D_environmental = CachedWeatherFactor + CachedTerrainFactor + CachedInfectionFactor
                  (range: -15 to +30)

D_memory = clamp(AlienData[ForAlien].PeakScore × 0.5 × max(0, 1 - TimeSincePeak / 30), 0, 25)
```

LOS line trace (called once per `ComputeAndGetAlienScore` invocation):
```cpp
FHitResult Hit;
bool bClearLOS = !World->LineTraceSingleByChannel(
    Hit,
    Alien->GetEyeLocation(),      // IAlienPerceptionData::GetEyeLocation()
    Player->GetActorLocation() + FVector(0, 0, 60.f),  // player eye height
    EHostileCollision::AIPerception);  // ADR-0007 channel
float LOSValue = bClearLOS ? 1.0f : (Hit.bBlockingHit ? 0.0f : 0.5f); // partial occlusion
```

### Detection State Machine

De-escalation requires cooldown; escalation is instant.

| From | To | Condition | Cooldown | Implementation |
|------|----|-----------|----------|----------------|
| Hidden | Suspicious | GlobalLevel ≥ 25 | None (instant) | `ComputeAndGetAlienScore` post-step |
| Suspicious | Hidden | GlobalLevel < 25 | 5.0s all below | `FTimerHandle` set on first undershoot |
| Suspicious | Alert | GlobalLevel ≥ 50 | None (instant) | |
| Alert | Suspicious | GlobalLevel < 50 | 3.0s all below | `FTimerHandle` |
| Alert | Engaged | GlobalLevel ≥ 75 | None (instant) | |
| Engaged | Alert | GlobalLevel < 75 | 5.0s, LOS broken | `FTimerHandle`; LOS-broken check via last `ComputeAndGetAlienScore` |
| Engaged | Detected | GlobalLevel = 100 | None (instant) | Fires `OnStealthBroken` exactly once |
| Detected | Engaged | GlobalLevel < 100 | 3.0s, LOS broken | `FTimerHandle` |

Alien death: if `AlienData` becomes empty after removal, `GlobalDetectionLevel` resets to 0 immediately, no cooldown (GDD edge case: "all aliens killed — immediate Hidden").

### IMC_Stealth Dual Trigger (GDD Rule 7)

`UStealthComponent` manages two independent boolean triggers:
- `bCrouchTriggerActive` — set true when `OnMovementStateChanged` fires with `ECrouch`
- `bDetectionTriggerActive` — set true when `OnDetectionStateChanged` fires ≥ Suspicious (≥25)

Push condition: `bCrouchTriggerActive || bDetectionTriggerActive`
Pop condition: `!bCrouchTriggerActive && !bDetectionTriggerActive`, held for 5.0s.

Pop is deferred via `FTimerHandle IMCPopCooldownHandle`. If either trigger reactivates during the 5.0s window, the timer is cancelled.

## Alternatives Considered

### Alternative 1: BT Service Computes D_total (Push Model)
- **Description**: Each alien's `UAlienBTService_UpdatePerception` computes `D_total` using the full formula and pushes it to `UStealthSubsystem` via `ReportAlienDetectionScore(AlienID, float)`. The subsystem aggregates.
- **Pros**: Computation distributed across alien BT ticks; no single subsystem tick responsibility.
- **Cons**: Inverts ADR-0012's established contract (`IStealthDetection` is designed for the subsystem to be the source of truth). Creates computation authority split: the formula logic exists in BT nodes, not the subsystem. Contradicts the principle that the Stealth System is a unified data layer.
- **Rejection Reason**: ADR-0012 explicitly states the BT Service reads from the Stealth System; it does not compute. This alternative was invalidated by the engine specialist review.

### Alternative 2: UStealthComponent Only (No UStealthSubsystem)
- **Description**: `UStealthComponent` on `AHostileCharacter` owns both the per-alien score map and global state. Aliens report scores to the player's component via a direct method call.
- **Pros**: Simpler class hierarchy; no subsystem lookup from BT Services.
- **Cons**: BT Services require a reference to the player's component. Creates direct actor-to-actor coupling from alien BT nodes into the player. Stealth state would be destroyed when the player pawn is re-spawned or temporarily removed. `IStealthDetection` interface cannot be implemented on a component while remaining accessible from the world context that BT Services operate in.
- **Rejection Reason**: ADR-0012's `IStealthDetection` is accessed via the world context, not a direct actor reference. Component-only design breaks the BT service access pattern. World-tier subsystem is the correct tier for a coordinator that must outlive individual actors.

## Consequences

### Positive
- `UStealthSubsystem` as `IStealthDetection` implementation satisfies ADR-0012 contract without modification to existing BT Service architecture.
- Event-driven player state cache (no `Tick()`) complies with ADR-0001 `polling_state_in_tick` forbidden pattern.
- `UWorldSubsystem` tier ensures detection state resets on level transition (consistent with `UCombatSubsystem` and `UAlienSquadSubsystem`).
- `IAlienPerceptionData` interface decouples Stealth System from `AAlienCharacter` concrete type; test doubles can implement the interface.
- `FAlienDetectionEntry` as `USTRUCT` with `GENERATED_BODY()` enables safe use as `UPROPERTY TMap` value.

### Negative
- Each `ComputeAndGetAlienScore()` call performs one `LineTraceSingleByChannel`. At 20 aliens × 2Hz = 40 LOS traces/sec. This is measurable but within budget (0.1ms each = 4ms/sec total, 0.067ms/frame amortized).
- `IAlienPerceptionData` must be added to `AAlienCharacter` — minor ADR-0012 supplement required.
- `UAlienBTService_DetectionDecay` (ADR-0012) applies a simplified 5pts/sec Blackboard-side decay. This differs from GDD Formula 2's composite decay. The Blackboard score is a BT-local copy; `UStealthSubsystem` retains authoritative decay via `D_memory` in `ComputeAndGetAlienScore`. The two decay values are intentionally decoupled — Blackboard decay governs BT branch selection smoothing; subsystem decay governs global state.

### Risks
- **Risk**: `OwnerComp.GetWorld()` in BT Service `TickNode` returns null during level teardown, causing null dereference before `GetSubsystem<UStealthSubsystem>()`. **Mitigation**: Null-check documented as required pattern; assert added in `UAlienBTService_UpdatePerception::OnBecomeRelevant`.
- **Risk**: 4Hz E_terrain `SphereOverlapActors` near player position may return stale results if player moves rapidly. **Mitigation**: 250ms refresh is acceptable given GDD specifies terrain modifiers are "recalculated on next frame" for zone transitions only; positional cover detection at 4Hz (250ms latency) aligns with ADR-0010's established 4Hz cover detection pattern.
- **Risk**: `FAlienDetectionEntry` `TimeSincePeak` accumulated in `ComputeAndGetAlienScore` (called at BT interval, not per-frame). Peak time calculation must use wall-clock delta since last BT tick, not assuming constant 0.5s. **Mitigation**: `UStealthSubsystem` stores `LastComputeTime` per alien entry; `TimeSincePeak += GetWorld()->GetDeltaSeconds()` applied each `ComputeAndGetAlienScore` call.
- **Risk**: `TWeakObjectPtr<AAlienAIController>` keys in `AlienData` may become stale if controller is destroyed before `HandleAlienKilled` fires. **Mitigation**: `ComputeAndGetAlienScore` skips entries where `!Entry.Key.IsValid()`; `HandleAlienKilled` explicitly clears the entry.
- **Risk**: `UPROPERTY BlueprintAssignable` delegates on `UStealthSubsystem` require `UStealthSubsystem` to be `UCLASS()` with default markup. Without at minimum `BlueprintType`, Blueprint binding has no effect at runtime. **Mitigation**: Document `UCLASS(BlueprintType)` as required in implementation.

## GDD Requirements Addressed

| GDD System | Requirement | How This ADR Addresses It |
|------------|-------------|--------------------------|
| stealth-system.md | Rule 1 — Single detection score (0–100) per alien; global = max | `UStealthSubsystem::AlienData` TMap stores per-alien scores; `GlobalDetectionLevel = max()` |
| stealth-system.md | Rule 2 — D_total formula (4-component: noise, visual, env, memory) | `ComputeAndGetAlienScore()` implements GDD Formula 1 in full |
| stealth-system.md | Rule 3 — State transitions with escalation/de-escalation cooldowns | `UStealthSubsystem` state machine + `FTimerHandle` per de-escalation transition |
| stealth-system.md | Rule 4 — Environmental modifiers (surface, lighting, weather) | Event-cached `CachedSurfaceNoiseMod`, `CachedLightingMod`, `CachedWeatherFactor`; 4Hz terrain/infection refresh |
| stealth-system.md | Rule 5 — Detection decay (R_decay formula) | `D_memory` component in `ComputeAndGetAlienScore()` implements GDD Formula 2 decay logic via `TimeSincePeak` |
| stealth-system.md | Rule 7 — IMC_Stealth dual trigger (crouch OR detection ≥ 25) | `UStealthComponent` dual boolean trigger pattern with 5.0s pop cooldown |
| stealth-system.md | Formula 1 — D_total full definition with distance decay | `ComputeAndGetAlienScore()` — full formula with inverse-square falloff (500cm noise / 300cm visual) |
| stealth-system.md | Formula 2 — Decay rate (R_base × M_decay_env × M_distance × M_alien_state) | `D_memory` decay driven by `TimeSincePeak`; environmental and alien-state modifiers applied |
| stealth-system.md | Interaction: Combat System `OnStealthBroken()` | `UStealthSubsystem::OnStealthBroken` fires when GlobalDetectionLevel = 100; consumed by `UCombatSubsystem` |
| stealth-system.md | Interaction: HUD System `SetDetectionLevel()`, `SetStealthState()` | `UStealthSubsystem::OnDetectionLevelChanged` and `OnDetectionStateChanged` consumed by `UHUDSubsystem` |
| stealth-system.md | Interaction: Health System injury noise floor | `CachedInjuryNoisePenalty` set via `UHealthComponent::OnInjuryStateChanged` binding; added to `CachedPlayerNoiseLevel` in D_noise |
| stealth-system.md | Interaction: Player Controller IMC_Stealth push/pop | `UStealthComponent` manages dual trigger; calls `AHostileWorldPlayerController::PushIMC/PopIMC` |
| stealth-system.md | Interaction: Alien AI System `GetDetectionScore()` | `IStealthDetection::ComputeAndGetAlienScore()` is the BT Service integration point |
| stealth-system.md | States: IMC_Combat ownership (Combat System at Detected=100, not Stealth) | `UStealthSubsystem` fires `OnStealthBroken` but never pushes `IMC_Combat`; `UCombatSubsystem` owns that push |
| alien-ai-system.md | `IStealthDetection::GetDetectionScore()` BT Service contract | `UStealthSubsystem` implements `IStealthDetection`; `ComputeAndGetAlienScore` extends the interface |
| alien-ai-system.md | BT Service reads detection from Stealth System (not computes) | `ComputeAndGetAlienScore()` is the computation trigger; BT Service calls it, does no formula math |

## Performance Implications
- **CPU**: 20 aliens × 2Hz BT tick = 40 `ComputeAndGetAlienScore` calls/sec. Each: 1 LOS trace + arithmetic = ≤0.1ms. Total: ≤4ms/sec = ≤0.067ms/frame amortized. 4Hz terrain refresh: 1 SphereOverlap per 250ms = negligible.
- **Memory**: `TMap<TWeakObjectPtr<AAlienAIController>, FAlienDetectionEntry>` at 20 aliens: ~2KB. Event-cached floats: <128 bytes. Negligible.
- **Load Time**: No hard asset references. Subsystem initializes from existing system events. No async loading required.
- **Network**: N/A — single-player.

## Migration Plan
Greenfield implementation — no existing stealth code. `IAlienPerceptionData` interface must be added to `AAlienCharacter` (minor supplement to ADR-0012 implementation; no ADR revision required). `UStealthSubsystem` must be added to the `subsystem_world_tier` registry entry (ADR-0004).

## Validation Criteria
- `ComputeAndGetAlienScore()` returns < 10 for idle player in darkness with no aliens within 1000cm (GDD acceptance criteria 1).
- `ComputeAndGetAlienScore()` returns ≥ 75 for sprinting player on concrete in daylight at 300cm clear LOS (GDD acceptance criteria 3).
- `ComputeAndGetAlienScore()` returns 100 for sprinting player on biomass with flashlight, enhanced-hearing alien at 200cm (GDD acceptance criteria 4).
- State transitions from Hidden → Suspicious within one BT Service tick (≤0.5s) of global level crossing 25. `OnDetectionStateChanged` fires within 0.5s.
- `IMC_Stealth` is pushed when player crouches while Hidden (bCrouchTriggerActive only).
- `IMC_Stealth` remains active when player uncrouches while Suspicious (bDetectionTriggerActive keeps it active).
- `IMC_Stealth` is popped exactly 5.0s after BOTH: player uncrouches AND detection falls below 25.
- `OnStealthBroken` fires exactly once when global detection reaches 100; does not re-fire on subsequent frames.
- After all aliens in zone are killed, `GlobalDetectionLevel` = 0 and state = Hidden within one BT tick (no cooldown).
- Per-alien score removed from `AlienData` within one frame of `OnAlienKilled` firing.
- LOS trace uses `EHostileCollision::AIPerception` channel (verified in editor collision preset).
- Null-check on `OwnerComp.GetWorld()` in BT Service prevents crash at level teardown (manual teardown test in PIE).

## Related Decisions
- ADR-0001: `docs/architecture/adr-0001-cross-system-communication.md` — delegate patterns
- ADR-0003: `docs/architecture/adr-0003-enhanced-input-architecture.md` — IMC_Stealth push/pop
- ADR-0004: `docs/architecture/adr-0004-subsystem-module-architecture.md` — subsystem tiers
- ADR-0007: `docs/architecture/adr-0007-physics-collision-architecture.md` — AI perception collision channel
- ADR-0010: `docs/architecture/adr-0010-movement-architecture.md` — noise emission, movement state
- ADR-0012: `docs/architecture/adr-0012-alien-ai-system.md` — IStealthDetection interface, BT Service contract
- ADR-0014: `docs/architecture/adr-0014-combat-system-architecture.md` — IMC_Combat ownership, OnCombatDisengaged
- ADR-0015: `docs/architecture/adr-0015-health-system-architecture.md` — injury state noise floor
- GDD: `design/gdd/stealth-system.md`
