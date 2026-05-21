# ADR-0011: Animation Architecture for Hostile World

## Status
Proposed

## Date
2026-05-20

## Engine Compatibility

| Field | Value |
|-------|-------|
| **Engine** | Unreal Engine 5.7 |
| **Domain** | Animation |
| **Knowledge Risk** | HIGH — Post-LLM-cutoff. VERSION.md explicitly flags "Animation Authoring" as a breaking change 5.3→5.7. animation.md notes "Control Rig 2.0" as a knowledge gap. |
| **References Consulted** | `docs/engine-reference/unreal/modules/animation.md`, `docs/engine-reference/unreal/VERSION.md`, `docs/engine-reference/unreal/breaking-changes.md` |
| **Post-Cutoff APIs Used** | `UAnimInstance::LinkAnimClassLayers(UClass*)` (Linked Anim Layers, UE5), IK Rig runtime node in ABP (UE5), `USkeletalMeshComponent::ConsumeRootMotion()` in PhysCustom |
| **Verification Required** | (1) Confirm `LinkAnimClassLayers()` signature unchanged in 5.7 release notes. (2) Confirm IK Rig runtime node is available in ABP graph in 5.7. (3) Confirm `USkeletalMeshComponent::ConsumeRootMotion()` return type is `FRootMotionMovementParams` in 5.7. |

## ADR Dependencies

| Field | Value |
|-------|-------|
| **Depends On** | ADR-0010 Movement Architecture (must be Accepted — ABP subscribes to CMC delegates; PhysCustom override for root motion lives in UHostileMovementComponent) |
| **Enables** | Combat montage implementation stories; Cover split-body layer stories |
| **Blocks** | Epic: Combat System implementation (fire/reload/melee montages require defined ABP slot architecture and AHostileCharacter proxy methods) |
| **Ordering Note** | ADR-0010 must transition Proposed → Accepted before combat animation stories are estimated |

## Context

### Problem Statement

AHostileCharacter requires an animation system that: (1) blends 8 locomotion states from CMC data without violating ADR-0001's `polling_state_in_tick` prohibition; (2) supports split-body cover animation (lower-body shuffle + additive upper-body lean/aim) per movement-system.md Rule 5; (3) applies mandatory foot IK on all surface types; (4) plays dodge montages with root motion authority during CMC `MOVE_Custom(0)` Coast phase; and (5) provides a clean montage interface for combat requests (fire/reload/melee) without coupling Combat System to ABP internals.

### Constraints

- ADR-0001 bans `polling_state_in_tick` — `EHostileMovementState` must be pushed to ABP via delegate, not read each tick to detect transitions
- ADR-0010 state ownership — ABP must not write movement state
- movement-system.md: "Foot IK mandatory — all locomotion states use foot IK for surface alignment. No floating feet."
- movement-system.md: "Split-body layering for cover: lower body (cover shuffle) + additive upper body (lean, aim)."
- ADR-0010: Dodge Coast phase uses "root motion from animation" — montage drives displacement
- Engine risk HIGH: Animation Authoring changed post-5.3; Linked Anim Layers and IK Rig runtime node require in-engine verification before implementation

### Requirements

- Support 8 movement state → locomotion blend mappings
- Support split-body cover layering (lower shuffle + additive upper)
- Apply foot IK on all locomotion surface types (disabled during Dodge, Jump, Fall)
- Dodge montage root motion drives Coast phase displacement ≈ 200cm from standstill
- Upper-body weapon overlay for fire/reload/melee montages while lower body runs locomotion
- `EHostileMovementState` pushed to ABP via delegate — not polled in `NativeUpdateAnimation`
- Encapsulated montage API: external systems call AHostileCharacter proxy methods, not ABP directly

## Decision

### Architecture: Main ABP + Linked Anim Layers + IK Rig Foot IK

`UHostileWorldAnimInstance : UAnimInstance` — the main animation instance for AHostileCharacter.

**Three-layer architecture:**
1. **Main ABP** — locomotion state machine, owns all blend tree inputs
2. **Linked Anim Layers** — per-context body-region layers (combat upper body, cover full-body)
3. **Post-Process IK Rig Node** — foot IK applied after locomotion pose resolve

### Architecture Diagram

```
AHostileCharacter
  └── USkeletalMeshComponent
        └── UHostileWorldAnimInstance (Main ABP)
              │
              ├── [Locomotion State Machine]
              │     Idle
              │     Walk/Run ─── BlendSpace1D (speed 0→600)
              │     Sprint
              │     Crouch ───── BlendSpace1D (speed 0→250)
              │     Jump ──────── launch → peak → fall
              │     Fall
              │     Dodge ─────── DefaultSlot montage (root motion, 3-phase)
              │     Cover ──────── links UHostileCoverLayer
              │
              ├── [Linked Anim Layer: IHostileAnimLayerInterface]
              │     UHostileLocomotionLayer   (default — empty hands)
              │     UHostileCombatLayer       (linked on combat entry via AHostileCharacter)
              │     UHostileCoverLayer        (linked on cover enter via OnMovementStateChanged)
              │
              └── [Post-Process: IK Rig Runtime Node]
                    IK Goal: IK_Foot_L
                    IK Goal: IK_Foot_R
                    Pelvis adjustment (clamped ±15cm)
                    Alpha: 0.0 during Dodge/Jump/Fall, 1.0 otherwise
```

### State Push Model (ADR-0001 Compliance)

`NativeUpdateAnimation()` reads **continuous blending values only** (velocity, direction, bIsCrouching, bIsInAir, StaminaRatio, SurfaceType). These are not change-detection — they are interpolation inputs.

`CachedMovementState` is updated **exclusively** via `OnMovementStateChanged(EHostileMovementState)` delegate callback. It is never read from CMC inside `NativeUpdateAnimation`. This satisfies the `polling_state_in_tick` forbidden pattern because montage-trigger decisions (dodge, cover layer switch) are event-driven, not tick-polled.

### Key Interfaces

```cpp
// ─── Main Animation Instance ────────────────────────────────────────────────
UCLASS()
class UHostileWorldAnimInstance : public UAnimInstance
{
    GENERATED_BODY()

public:
    virtual void NativeInitializeAnimation() override;
    virtual void NativeUpdateAnimation(float DeltaSeconds) override;
    virtual void NativeBeginPlay() override;
    virtual void NativeUninitializeAnimation() override;

    // External montage API — called by AHostileCharacter proxy methods only
    void PlayFireMontage(EHostileWeaponType WeaponType);
    void PlayReloadMontage(EHostileWeaponType WeaponType);
    void PlayMeleeMontage();

protected:
    // Cached refs (set in NativeInitializeAnimation, valid for ABP lifetime)
    UPROPERTY() TObjectPtr<AHostileCharacter> HostileCharacter;
    UPROPERTY() TObjectPtr<UHostileMovementComponent> HostileMovement;

    // ── Blend tree inputs — updated each tick in NativeUpdateAnimation (game thread) ──
    UPROPERTY(BlueprintReadOnly, Category="Anim")
    float GroundSpeed;          // velocity XY magnitude (cm/s)

    UPROPERTY(BlueprintReadOnly, Category="Anim")
    float Direction;            // velocity angle relative to actor forward (-180..180°)

    UPROPERTY(BlueprintReadOnly, Category="Anim")
    bool bIsAccelerating;       // input magnitude > 0 (for idle→walk transition)

    UPROPERTY(BlueprintReadOnly, Category="Anim")
    bool bIsInAir;

    UPROPERTY(BlueprintReadOnly, Category="Anim")
    float StaminaRatio;         // 0..1, drives exhaustion blend (heavy breathing curve)

    // Cached floor normal for IK Rig node alpha — set from CurrentFloor in NativeUpdateAnimation
    UPROPERTY(BlueprintReadOnly, Category="Anim")
    FVector FloorNormal;        // cached on game thread; consumed by IK Rig in post-process

    UPROPERTY(BlueprintReadOnly, Category="Anim")
    float FootIKAlpha;          // 1.0 = IK active, 0.0 = IK disabled (Dodge/Jump/Fall)

    // ── State cache — pushed by delegate, NOT read in NativeUpdateAnimation ──
    UPROPERTY(BlueprintReadOnly, Category="Anim")
    EHostileMovementState CachedMovementState;

    // Montage assets (assigned on BP subclass via UPROPERTY EditDefaultsOnly)
    UPROPERTY(EditDefaultsOnly, Category="Montages")
    TObjectPtr<UAnimMontage> DodgeMontage;              // root motion enabled

    UPROPERTY(EditDefaultsOnly, Category="Montages")
    TMap<EHostileWeaponType, TObjectPtr<UAnimMontage>> FireMontages;

    UPROPERTY(EditDefaultsOnly, Category="Montages")
    TObjectPtr<UAnimMontage> ReloadPistolMontage;

    UPROPERTY(EditDefaultsOnly, Category="Montages")
    TObjectPtr<UAnimMontage> ReloadRifleMontage;

    UPROPERTY(EditDefaultsOnly, Category="Montages")
    TObjectPtr<UAnimMontage> ReloadShotgunMontage;

    UPROPERTY(EditDefaultsOnly, Category="Montages")
    TObjectPtr<UAnimMontage> MeleeMontage;

    UPROPERTY(EditDefaultsOnly, Category="Montages")
    TObjectPtr<UAnimMontage> CoverEnterMontage;

    UPROPERTY(EditDefaultsOnly, Category="Montages")
    TObjectPtr<UAnimMontage> CoverExitMontage;

private:
    // Delegate callbacks — subscribed in NativeBeginPlay, unsubscribed in NativeUninitializeAnimation
    UFUNCTION() void OnMovementStateChanged(EHostileMovementState NewState);
    UFUNCTION() void OnDodgeStarted(float IFrameDuration);
    UFUNCTION() void OnDodgeEnded();

    EHostileMovementState PrevCachedMovementState = EHostileMovementState::Idle;
};
```

```cpp
// ─── AHostileCharacter — Montage Proxy Methods ──────────────────────────────
// External systems (Combat System) call these. They must never call
// GetMesh()->GetAnimInstance()->Montage_Play() directly.

void AHostileCharacter::PlayFireMontage(EHostileWeaponType WeaponType);
void AHostileCharacter::PlayReloadMontage(EHostileWeaponType WeaponType);
void AHostileCharacter::PlayMeleeMontage();
```

```cpp
// ─── Linked Anim Layer Interface ────────────────────────────────────────────
UINTERFACE(BlueprintType, meta=(CannotImplementInterfaceInBlueprint))
class UHostileAnimLayerInterface : public UInterface { GENERATED_BODY() };

class IHostileAnimLayerInterface
{
    GENERATED_BODY()
public:
    UFUNCTION(BlueprintImplementableEvent) void SetLayerDefaults();
};

// Layer classes (Blueprint subclasses of UAnimInstance implementing IHostileAnimLayerInterface)
// UHostileLocomotionLayer  — default; empty-hands upper body
// UHostileCombatLayer      — weapon aim offset + fire/reload montage blend
// UHostileCoverLayer       — cover shuffle (lower) + lean additive (upper)
```

```cpp
// ─── Linked Layer Switching (inside OnMovementStateChanged callback) ─────────
void UHostileWorldAnimInstance::OnMovementStateChanged(EHostileMovementState NewState)
{
    CachedMovementState = NewState;

    // Cover layer switch
    if (NewState == EHostileMovementState::Cover)
    {
        Montage_Play(CoverEnterMontage);
        GetSkelMeshComponent()->LinkAnimClassLayers(UHostileCoverLayer::StaticClass());
    }
    else if (PrevCachedMovementState == EHostileMovementState::Cover)
    {
        GetSkelMeshComponent()->UnlinkAnimClassLayers(UHostileCoverLayer::StaticClass());
        Montage_Play(CoverExitMontage);
    }

    // FootIK alpha: off during Dodge, Jump, Fall
    const bool bIKActive = (NewState != EHostileMovementState::Dodge
                         && NewState != EHostileMovementState::Jump
                         && NewState != EHostileMovementState::Fall);
    FootIKAlpha = bIKActive ? 1.0f : 0.0f;

    PrevCachedMovementState = NewState;
}
```

### Foot IK (IK Rig Runtime Node)

IK Rig asset: `IKRig_HostileCharacter` with two IK goals (`IK_Foot_L`, `IK_Foot_R`).

Added as an **IK Rig runtime node** in the ABP post-process animation graph — lighter than Control Rig VM; purpose-built for limb IK.

Implementation:
- Per-frame: two line traces (30cm downward) from `foot_l` / `foot_r` bone world positions
- Foot normal tilt: `FloorNormal` cached from `HostileMovement->CurrentFloor.HitResult.Normal` in `NativeUpdateAnimation` (game thread — not thread-safe-update path)
- Pelvis height offset: half the larger foot displacement, clamped to ±15cm — prevents hip pop on steep slopes
- `FootIKAlpha` pin on IK Rig node: 1.0 normally, 0.0 during Dodge/Jump/Fall (alpha-blended, not graph-branched)
- IK disabled entirely when slope > 45° (Fall state — FootIKAlpha already 0.0)

> **Thread safety note:** `FloorNormal` and all CMC-sourced values are read exclusively in `NativeUpdateAnimation`, which runs on the game thread. The ABP does NOT use `NativeThreadSafeUpdateAnimation` for any CMC-sourced data. If a future feature requires thread-safe update, all CMC reads must be moved to a game-thread pre-pass and cached.

### Dodge Montage Root Motion (Corrected from Engine Specialist Review)

`DodgeMontage` has **Root Motion enabled** (Asset Details > Root Motion > Enable Root Motion).

The CMC does **not** automatically extract root motion during `PhysCustom`. Manual extraction is required:

```cpp
// UHostileMovementComponent::PhysCustom — Coast phase (DodgePhase == EDodgePhase::Coast)
void UHostileMovementComponent::PhysDodge_Coast(float DeltaTime)
{
    // Manual root motion extraction — CMC skips this in PhysCustom
    FRootMotionMovementParams RootMotion = CharacterOwner->GetMesh()->ConsumeRootMotion();

    if (RootMotion.bHasRootMotion)
    {
        // Transform from local to world space using actor transform
        const FTransform WorldRootMotion =
            RootMotion.GetRootMotionTransform().GetRelativeTransform(CharacterOwner->GetActorTransform());
        Velocity = WorldRootMotion.GetTranslation() / DeltaTime;
    }
    // else: fall back to launch velocity from PhysDodge_Launch
}
```

Three notify states in DodgeMontage drive phase transitions:
- `NS_DodgeWindup` (0.00–0.10s) — startup, no i-frames
- `NS_DodgeActive` (0.10–0.35s) — root motion active, i-frames (Health System uses IFrameDuration from `OnDodgeStarted`)
- `NS_DodgeRecovery` (0.35–0.65s) — braking deceleration, no i-frames

### Montage Slots

| Slot Name | Group | Purpose |
|-----------|-------|---------|
| `DefaultSlot` | `DefaultGroup` | Full-body montages: Dodge (3-phase, root motion), CoverEnter, CoverExit |
| `UpperBodySlot` | `DefaultGroup` | Upper-body montages: FireMontage, ReloadMontage, MeleeMontage (blends over lower body locomotion) |

> **Setup prerequisite:** `UpperBodySlot` must be manually created in the Skeleton asset (Skeleton Editor > Anim Slot Manager > Add Slot). It must be assigned to `DefaultGroup`. If this slot is missing, upper-body montages play with no output silently — no compile error.

### Combat Layer Switching

Combat layer is switched by `AHostileCharacter` (not by the ABP) when combat state changes:

```cpp
// AHostileCharacter — called by CombatComponent on combat engage/disengage
void AHostileCharacter::OnCombatEngaged()
{
    GetMesh()->GetAnimInstance()->LinkAnimClassLayers(UHostileCombatLayer::StaticClass());
}

void AHostileCharacter::OnCombatDisengaged()
{
    GetMesh()->GetAnimInstance()->UnlinkAnimClassLayers(UHostileCombatLayer::StaticClass());
}
```

## Alternatives Considered

### Alternative A: Single Monolithic ABP State Machine
- **Description**: One UAnimInstance subclass with all states inline — locomotion, cover, and combat weapon layers all in one state machine graph.
- **Pros**: Simpler initial authoring; single file to debug.
- **Cons**: Cover split-body + combat upper-body require inline blend node duplication for every state combination (8 movement states × 4 weapon types × cover on/off = 64 combinations). State machine graph becomes unmaintainable.
- **Rejection Reason**: Linked Anim Layers exist specifically to eliminate this combinatorial explosion. The monolithic approach does not scale beyond a few movement states.

### Alternative B: Full Control Rig Procedural Animation
- **Description**: No ABP state machine. Entirely Control Rig-driven with IK solvers determining all pose.
- **Pros**: Maximum procedural flexibility; obstacles and surfaces auto-adapted.
- **Cons**: Requires bespoke rig for all 8 movement states. No standard locomotion asset pipeline. Prohibitive production cost for indie scale. Control Rig 2.0 is a HIGH knowledge-gap risk in UE 5.7.
- **Rejection Reason**: Indie scale requires standard locomotion assets. Control Rig is scoped here to foot IK only (but replaced by the lighter IK Rig runtime node per engine specialist recommendation).

### Alternative C: Per-Mesh-Section Animation Instances
- **Description**: Separate ABP on a second skeletal mesh component for the upper body, master-posed to the lower body.
- **Pros**: Complete independence between upper and lower body.
- **Cons**: Two skeletal mesh components, doubled skinning cost, complex sync between components. Linked Anim Layers achieve the same split-body effect within one component.
- **Rejection Reason**: Linked Anim Layers are the UE5-native solution. Dual components add cost with no benefit.

## Consequences

### Positive
- Linked Anim Layers eliminates combinatorial state-machine explosion (8 states × weapons × cover)
- Delegate-driven `CachedMovementState` satisfies ADR-0001 `polling_state_in_tick` prohibition
- IK Rig runtime node is purpose-built for foot IK — lighter than Control Rig VM
- Manual root motion extraction in `PhysCustom` is explicit and debuggable (no hidden CMC magic)
- `AHostileCharacter` montage proxy fully decouples Combat System from ABP internals

### Negative
- `LinkAnimClassLayers()` API requires in-engine verification (HIGH risk — post-cutoff)
- Three Linked Layer Blueprint classes add asset management overhead
- Manual root motion extraction in `PhysCustom` is non-obvious; must be documented in the UHostileMovementComponent source
- `UpperBodySlot` must be manually created in Skeleton asset before any combat montages function

### Risks
- **[HIGH] `LinkAnimClassLayers()` API changed in 5.7**: Verification required before implementation. Fallback: if API signature changed, switch to `SetAnimInstanceClass()` on a secondary mesh component (Alternative C), accepted as implementation pivot.
- **[MEDIUM] IK Rig runtime node availability in 5.7 ABP**: Must be confirmed in editor. Fallback: use legacy Two Bone IK nodes per foot if IK Rig node is unavailable (lower quality surface adaptation but functional).
- **[MEDIUM] Root motion coordinate space in PhysCustom**: `ConsumeRootMotion()` returns local-space transform. The world-space conversion must use the actor's transform at extraction time, not the previous frame. Off-by-one frame error produces a visible position pop at Coast start.
- **[LOW] Pelvis over-correction on steep slopes**: Clamp pelvis offset to ±15cm. If clamping causes floating feet on slopes > 30°, adjust clamp or disable IK above a configurable slope threshold.

## GDD Requirements Addressed

| GDD System | Requirement | How This ADR Addresses It |
|------------|-------------|--------------------------|
| movement-system.md | "Foot IK mandatory: all locomotion states use foot IK for surface alignment. No floating feet." | IK Rig runtime node in ABP post-process; two foot goals with per-frame line traces; pelvis adjustment |
| movement-system.md | "Split-body layering for cover: lower body (cover shuffle) + additive upper body (lean, aim)." | UHostileCoverLayer linked via LinkAnimClassLayers on cover enter; unlinked on cover exit |
| movement-system.md | "Cover-Enter/Exit are full-body montages." | CoverEnterMontage / CoverExitMontage on DefaultSlot; played in OnMovementStateChanged callback |
| movement-system.md | "Animation Blueprint reads movement state to blend locomotion; movement does NOT drive animation directly." | ABP reads velocity/speed/direction for blending; CachedMovementState pushed via delegate — not pulled |
| movement-system.md (via ADR-0010) | "Dodge Coast phase uses root motion from animation." | DodgeMontage root motion enabled; manual ConsumeRootMotion() in PhysCustom(0) Coast phase |
| movement-system.md OQ-5 | "Dodge separate animations for sprinting (dive) vs. standing (roll)." | DodgeMontage can be keyed to CachedMovementState at dodge activation — Sprint→DiveMontage, else→RollMontage — resolved at implementation |
| combat-system.md | "PlayFireMontage(WeaponType), PlayReloadMontage(), PlayMeleeMontage()" | AHostileCharacter proxy methods proxy to UHostileWorldAnimInstance; UpperBodySlot isolates from locomotion |

## Performance Implications

- **CPU**: IK Rig foot IK: 2 line traces + pelvis calc per frame ≈ 0.1ms. Linked Layer switching: O(1), occurs only on state transitions. Total animation eval dominated by skeletal mesh update (unavoidable), not this architecture.
- **Memory**: Three Linked Layer Blueprint classes + ~12 montage assets. All loaded via hard `TObjectPtr<>` UPROPERTY on ABP asset. Acceptable at indie PC scale.
- **Load Time**: All montage assets referenced via hard UPROPERTY — loaded with character BP at game start. No async loading latency at runtime.
- **Network**: N/A — single-player.

## Migration Plan
No existing animation code. This ADR establishes the initial animation architecture from scratch. Implementation order: (1) UHostileWorldAnimInstance skeleton + delegate subscriptions, (2) Locomotion state machine with BlendSpaces, (3) Linked Layer assets, (4) IK Rig asset + post-process node, (5) Dodge montage with root motion, (6) Combat montage slots.

## Validation Criteria

- [ ] `LinkAnimClassLayers(UHostileCoverLayer)` switches lower body to cover shuffle without interrupting upper body aim offset
- [ ] Foot IK visibly adjusts foot height on 20° slope (snow surface) — no floating feet
- [ ] `FootIKAlpha` is 0.0 during Dodge, Jump, Fall; 1.0 in all other states
- [ ] Dodge montage root motion drives Coast phase displacement to 190–210cm from standstill
- [ ] `NativeUpdateAnimation()` does NOT call `GetCurrentMovementState()` — validated by code review pre-merge
- [ ] Fire montage plays on `UpperBodySlot` while walk locomotion continues on lower body (no interruption)
- [ ] `OnMovementStateChanged` delegate fires and `CachedMovementState` updates within the same frame as CMC state change (no one-frame lag)
- [ ] `UpperBodySlot` exists in Skeleton asset Anim Slot Manager before any montage assets are created

## Related Decisions
- ADR-0010: Movement Architecture — CMC delegates subscribed by ABP; `PhysCustom` root motion extraction; floor data for foot IK
- ADR-0001: Cross-System Communication — delegate push pattern for state; montage proxy on AHostileCharacter
- ADR-0007: Physics/Collision Architecture — surface type (EHostileSurfaceType) for foot IK ground traces
- ADR-0009: Camera Architecture — combat FOV (65°) changes coincide with UHostileCombatLayer link
