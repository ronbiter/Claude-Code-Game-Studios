# ADR-0009: Camera Architecture

## Status
Proposed

## Date
2026-05-20

## Engine Compatibility

| Field | Value |
|-------|-------|
| **Engine** | Unreal Engine 5.7 |
| **Domain** | Camera (APlayerCameraManager, UCameraShakeBase, USpringArmComponent, Sequencer) |
| **Knowledge Risk** | MEDIUM — Camera core API (APlayerCameraManager, UCameraShakeBase, USpringArmComponent) has been stable since UE 4.26. Post-5.3 changes to UCameraMode (Lyra pattern) exist but are not used here. |
| **References Consulted** | `docs/engine-reference/unreal/VERSION.md`, `design/gdd/camera-system.md` |
| **Post-Cutoff APIs Used** | `UCameraShakeBase` + `UCameraShakePattern` composition model (UE 5.0+ — replaces legacy `UMatineeCameraShake` and the legacy `UPerlinNoiseCameraShake` direct-subclass approach). Procedural noise is supplied via `RootShakePattern = UPerlinNoiseCameraShakePattern`. All other APIs (APlayerCameraManager, USpringArmComponent, ULevelSequencePlayer, SetViewTargetWithBlend) stable pre-5.4. |
| **Verification Required** | (1) ~~Confirm shake subclass name~~ ✅ **Resolved 2026-05-26 (MED-4 fix)**: UE5 production pattern is `UCameraShakeBase` with `RootShakePattern` set to a `UCameraShakePattern` subclass (`UPerlinNoiseCameraShakePattern` for procedural, `UWaveOscillatorCameraShakePattern` for periodic). Legacy `UPerlinNoiseCameraShake` is removed; legacy `UMatineeCameraShake` is deprecated. (2) Confirm `APlayerCameraManager::StartCameraShake()` signature unchanged in 5.7. (3) Verify `SetViewTargetWithBlend` with `VTBlend_EaseInOut` does not require a custom curve asset in 5.7. (4) Confirm ULevelSequencePlayer delegation pattern for Cinematic mode — engine does not automatically restore camera on sequence end in all configurations. (5) Confirm `USpringArmComponent` does NOT have a native `CameraRetractSpeed` property — arm retract must be implemented as TargetArmLength FInterpTo in UpdateViewTarget(). (6) Confirm `CameraLagMaxDistance` property name unchanged in 5.4–5.7. |

## ADR Dependencies

| Field | Value |
|-------|-------|
| **Depends On** | ADR-0001 (delegate pattern — OnCameraModeChanged must follow dynamic multicast delegate convention), ADR-0003 (Enhanced Input / PC — SetCameraMode() called from AHostileWorldPlayerController), ADR-0004 (subsystem tier — Camera system lives on APlayerCameraManager, not a subsystem), ADR-0007 (physics events — OnPlayerLanded and OnImpact are shake trigger sources), ADR-0008 (scene streaming — OnZoneCrossed consumed for environmental camera effects) |
| **Enables** | ADR-0010 (Movement — camera mode affects movement constraints; camera recoil uses AddRecoil API defined here) |
| **Blocks** | Camera System implementation epics; Dialogue System OTS camera epic (requires Conversation mode from this ADR); Stealth System camera FOV epic; Combat System recoil integration story |
| **Ordering Note** | ADR-0003 must be Accepted first (PC is the SetCameraMode() caller). ADR-0007 must be Accepted first (shake event sources). ADR-0008 must be Accepted first (OnZoneCrossed consumer). |

## Context

### Problem Statement

The camera system must support 5 distinct camera modes (ThirdPerson, FirstPerson, Cinematic, Mounted, Conversation) with blended transitions, procedural camera shakes from physics events (impacts, landings) and gameplay events (explosions, terraform), recoil applied as a persistent rotation offset, and Sequencer-driven Cinematic mode. The architecture must decide: who owns camera mode state, how modes transition, how shakes stack without exceeding the amplitude/rotation cap, and how Cinematic mode hands control to Sequencer without breaking the camera pipeline.

### Constraints

- APlayerCameraManager is the engine-managed camera system component on APlayerController — it is the natural owner for all camera logic in UE5
- `UCameraShakeBase` with `RootShakePattern = UPerlinNoiseCameraShakePattern` is the production shake pattern in UE5 — both legacy `UPerlinNoiseCameraShake` (direct-subclass) and `UMatineeCameraShake` are removed/deprecated
- GDD requires shake stacking with a hard cap: 25px positional amplitude, 15° rotation (TR-camera-008)
- Cinematic mode delegates camera control to ULevelSequencePlayer (TR-camera-005)
- Recoil is a separate system from shakes — it is a decaying rotation offset (TR-camera-009 implied by TR-camera-007 AddRecoil interface)
- All OnCameraModeChanged events must follow ADR-0001 dynamic multicast delegate pattern

### Requirements

- 5 camera modes with mode-switching via APlayerCameraManager (TR-camera-001)
- Mode transitions via SetViewTargetWithBlend with EaseInOut curve (TR-camera-002)
- Spring-arm ProbeChannel=ECC_Camera; retract speed 500cm/s; min arm length 50cm (TR-camera-003)
- Procedural shakes via `UCameraShakeBase` + `RootShakePattern = UPerlinNoiseCameraShakePattern`; positional for impacts, rotational for terraform (TR-camera-004)
- Cinematic mode via Sequencer / ULevelSequencePlayer (TR-camera-005)
- Lumen auto-exposure tuned per zone — snow glare vs. dark interior (TR-camera-006)
- Expose ICameraSystem: mode management, parameter queries, AddShake, AddRecoil, SubscribeToModeChanged (TR-camera-007)
- Shake stacking cap: 25px amplitude, 15° rotation (TR-camera-008)

## Decision

**AHostileWorldPlayerCameraManager (APlayerCameraManager subclass) owns all camera mode logic.** Mode state is an internal `EHostileCameraMode` enum. AHostileWorldPlayerController holds a typed reference (cast from GetPlayerCameraManager()) and is the sole caller of SetCameraMode().

**5 camera modes** are implemented as per-mode branches inside `UpdateViewTarget()` override:
- **ThirdPerson**: spring-arm follow with lag and collision. Default mode.
- **FirstPerson**: view from character eye socket. Spring arm disabled.
- **Cinematic**: UpdateViewTarget() logic suspended; ULevelSequencePlayer drives camera.
- **Mounted**: fixed camera mount offset from vehicle/turret actor.
- **Conversation**: OTS framing (250cm offset, 30° horizontal, 55° FOV) targeting NPC.

**Mode transitions** use `APlayerController::SetViewTargetWithBlend()` with `VTBlend_EaseInOut` and configurable `BlendTime` (default 0.5s, Conversation 0.5s per GDD). Transition completion is detected via AHostileWorldPlayerCameraManager internal state tracking (previous view target no longer active).

**Spring arm** (USpringArmComponent on AHostileCharacter):
- `ProbeChannel = ECC_Camera`
- `bEnableCameraLag = true`
- `CameraLagSpeed` and `CameraLagMaxDistance` as tuning knobs
- Min arm length 50cm (`bDoCollisionTest = true` clamps to this minimum)
- Retract speed 500cm/s via `CameraRetractSpeed` UPROPERTY on USpringArmComponent (if available in 5.7) or via `TargetArmLength` interpolation in UpdateViewTarget()

**Shake system**: Per-shake assets are Blueprint subclasses of `UCameraShakeBase` with `RootShakePattern` set to a `UCameraShakePattern` subclass — `UPerlinNoiseCameraShakePattern` for our procedural impact/terraform shakes (UE 5.0+ composition model; replaces the legacy `UPerlinNoiseCameraShake` direct-subclass and the deprecated `UMatineeCameraShake`). Started via `APlayerCameraManager::StartCameraShake(TSubclassOf<UCameraShakeBase>, Scale)`. Shake instances managed by APlayerCameraManager's built-in shake system. Stacking cap (25px/15°) enforced by `AHostileWorldPlayerCameraManager::AddShake()` — checks current aggregate amplitude/rotation before starting a new shake and clamps the Scale parameter to stay within budget. Amplitude/rotation are tracked per active shake instance via a `TArray<FActiveShakeRecord>` on the camera manager.

**Recoil** is a separate rotation offset from shakes. `AddRecoil(float Pitch, float Yaw)` accumulates into `FVector2D RecoilOffset`. In `UpdateViewTarget()`, RecoilOffset is applied to the output rotation and decays via FInterpTo toward zero (decay rate tuning knob). Recoil does NOT go through the shake system — it is a persistent directional offset, not noise.

**Cinematic mode**: On entering Cinematic mode, `AHostileWorldPlayerCameraManager::SetCameraMode(Cinematic)` sets a `bCinematicActive` flag that suppresses `UpdateViewTarget()` custom logic. The owning level sequence must set its view target directly. On sequence end, the sequence actor calls `SetCameraMode(ThirdPerson)` (or whatever the caller requested), restoring normal camera control.

**Lumen auto-exposure**: NOT owned by the camera system. Post-process volumes in the world author per-zone exposure values (EV100 for snow glare vs. dark interior). AHostileWorldPlayerCameraManager does not control exposure. Camera system exposes `GetCameraMode()` so PostProcessVolume blend logic can read camera state if needed.

### Architecture Diagram

```
AHostileWorldPlayerController (ADR-0003)
  │
  ├── SetCameraMode(Mode, BlendTime)
  │      → calls SetViewTargetWithBlend() on APC
  │      → sets CurrentMode enum on AHostileWorldPlayerCameraManager
  │
  └── AHostileWorldPlayerCameraManager (APlayerCameraManager subclass)
         │
         ├── UpdateViewTarget() [per-frame, mode-dispatched]
         │   ├── ThirdPerson: spring arm follow + lag
         │   ├── FirstPerson: eye socket offset
         │   ├── Cinematic: suppressed (ULevelSequencePlayer active)
         │   ├── Mounted: fixed offset from mount actor
         │   └── Conversation: OTS frame toward NPC target
         │
         ├── AddShake(Class, Scale) — cap check before StartCameraShake()
         │   └── APlayerCameraManager::StartCameraShake() [engine shake stack]
         │
         ├── AddRecoil(Pitch, Yaw) — accumulates RecoilOffset
         │   └── Applied + decayed in UpdateViewTarget()
         │
         └── OnCameraModeChanged [DYNAMIC_MULTICAST_DELEGATE]
               → HUD System (mode-based visibility)
               → Stealth System (FOV reads camera mode)
               → Combat System (65° FOV on engage)

AHostileCharacter
  └── USpringArmComponent
        ProbeChannel=ECC_Camera, MinArm=50cm, RetractSpeed=500cm/s

UPhysicsHelperSubsystem (ADR-0007)
  OnPlayerLanded → AHostileWorldPlayerCameraManager::AddShake(LandingShake)
  OnImpact → AHostileWorldPlayerCameraManager::AddShake(ImpactShake)

USceneManagementSubsystem (ADR-0008)
  OnZoneCrossed → AHostileWorldPlayerCameraManager: applies zone chromatic aberration / film grain

ULevelSequencePlayer (Cinematic mode)
  → drives camera transform while bCinematicActive=true
  → calls SetCameraMode(ThirdPerson) on sequence end
```

### Key Interfaces

```cpp
// UInterface boilerplate required for GC safety and Blueprint exposure
UINTERFACE(MinimalAPI, BlueprintType)
class UCameraSystem : public UInterface { GENERATED_BODY() };

class ICameraSystem
{
    GENERATED_BODY()
public:
    virtual void SetCameraMode(EHostileCameraMode Mode, float BlendTime = 0.5f) = 0;
    virtual EHostileCameraMode GetCameraMode() const = 0;
    virtual float GetCurrentFOV() const = 0;

    // Shake — scale clamped to respect 25px/15° aggregate cap
    virtual void AddShake(TSubclassOf<UCameraShakeBase> ShakeClass, float Scale = 1.0f) = 0;

    // Recoil — separate from shake; persistent directional offset, decays via FInterpTo
    virtual void AddRecoil(float Pitch, float Yaw) = 0;

    // Callers bind to the camera manager's OnCameraModeChanged directly:
    //   ICameraSystem* Cam = PC->GetPlayerCameraManager<AHostileWorldPlayerCameraManager>();
    //   Cam->OnCameraModeChanged.AddDynamic(this, &UMyClass::HandleModeChanged);
    // No separate Subscribe method needed — direct multicast delegate binding.
};

DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(
    FCameraModeChangedDelegate,
    EHostileCameraMode, OldMode,
    EHostileCameraMode, NewMode
);

UENUM(BlueprintType)
enum class EHostileCameraMode : uint8
{
    ThirdPerson   UMETA(DisplayName="Third Person"),
    FirstPerson   UMETA(DisplayName="First Person"),
    Cinematic     UMETA(DisplayName="Cinematic"),
    Mounted       UMETA(DisplayName="Mounted"),
    Conversation  UMETA(DisplayName="Conversation")
};

// AHostileWorldPlayerCameraManager — APlayerCameraManager subclass
UCLASS()
class AHostileWorldPlayerCameraManager : public APlayerCameraManager,
                                          public ICameraSystem
{
    GENERATED_BODY()

public:
    // ICameraSystem implementation
    virtual void SetCameraMode(EHostileCameraMode Mode, float BlendTime = 0.5f) override;
    virtual EHostileCameraMode GetCameraMode() const override { return CurrentMode; }
    virtual float GetCurrentFOV() const override;
    virtual void AddShake(TSubclassOf<UCameraShakeBase> ShakeClass, float Scale = 1.0f) override;
    virtual void AddRecoil(float Pitch, float Yaw) override;

    UPROPERTY(BlueprintAssignable)
    FCameraModeChangedDelegate OnCameraModeChanged;

protected:
    virtual void UpdateViewTarget(FTViewTarget& OutVT, float DeltaTime) override;

private:
    EHostileCameraMode CurrentMode = EHostileCameraMode::ThirdPerson;
    bool bCinematicActive = false;

    // Recoil
    FVector2D RecoilOffset = FVector2D::ZeroVector;
    UPROPERTY(EditDefaultsOnly, Category="Camera|Recoil")
    float RecoilDecayRate = 8.0f; // FInterpTo speed toward zero

    // Shake cap tracking
    float CurrentShakeAmplitudePx = 0.0f;    // aggregate; cap = 25px
    float CurrentShakeRotationDeg = 0.0f;   // aggregate; cap = 15 degrees

    // Subscribers (ADR-0007)
    void OnPlayerLanded(const FVector& LandingVelocity);
    void OnImpact(const FVector& ImpactVelocity);

    // Subscriber (ADR-0008)
    void OnZoneCrossed(FName FromZone, FName ToZone);
};
```

## Alternatives Considered

### Alternative 1: UCameraMode Stack (Lyra Pattern)
- **Description**: Use the Lyra sample's `UCameraMode` / `UCameraModeStack` system — each mode is a UObject with its own blend logic. APlayerCameraManager defers all camera logic to the active UCameraMode.
- **Pros**: More modular — each mode is independently testable. Blend weights are per-mode. Well-suited to games with many distinct camera modes.
- **Cons**: UCameraMode is from the Lyra sample project — it is not a built-in engine class in UE 5.7. Using it requires copying Lyra code into the project (licensing and maintenance burden). 5 camera modes with simple blend logic does not justify this complexity. The pattern is unverified as a production API vs. sample code.
- **Rejection Reason**: Not a built-in engine API. Sample code adds maintenance burden. 5 modes with APlayerCameraManager UpdateViewTarget() dispatch is sufficient.

### Alternative 2: Camera Component on PlayerController
- **Description**: Implement ICameraSystem as a UActorComponent on AHostileWorldPlayerController rather than extending APlayerCameraManager.
- **Pros**: Component pattern is more composable. No need to subclass APlayerCameraManager.
- **Cons**: APlayerCameraManager already owns the camera pipeline (UpdateViewTarget, FOV, shakes). Duplicating responsibility in a PC component creates two camera owners. Engine shake API (StartCameraShake) lives on APlayerCameraManager — a PC component cannot call it without going through the camera manager anyway.
- **Rejection Reason**: APlayerCameraManager is the engine's designated camera owner. Subclassing it is the idiomatic pattern.

### Alternative 3: ULocalPlayerSubsystem for Camera State
- **Description**: Use a ULocalPlayerSubsystem (matching ADR-0004's UHUDSubsystem pattern) for camera mode state.
- **Pros**: Consistent with ADR-0004's player-tier pattern.
- **Cons**: Camera mode state must be in APlayerCameraManager to affect UpdateViewTarget(). A subsystem holding mode state requires the camera manager to query it every frame — polling anti-pattern (ADR-0001). Subsystem tier adds a layer of indirection with no benefit.
- **Rejection Reason**: APlayerCameraManager is the natural single owner. Subsystem would poll it or be polled — both violate ADR-0001.

## Consequences

### Positive
- APlayerCameraManager is the engine's designated camera owner — no friction against engine camera pipeline
- `UCameraShakeBase` with `RootShakePattern = UPerlinNoiseCameraShakePattern` is the production procedural shake pattern — no deprecated APIs (legacy `UPerlinNoiseCameraShake` / `UMatineeCameraShake` not used)
- Shake cap enforcement in AddShake() is a single chokepoint — guaranteed cap compliance
- Recoil as a separate system from shakes means the two can be tuned independently
- Cinematic mode delegation to ULevelSequencePlayer requires no custom camera actors
- ICameraSystem interface decouples all callers from the concrete AHostileWorldPlayerCameraManager class

### Negative
- AddShake() aggregate amplitude/rotation tracking requires AHostileWorldPlayerCameraManager to monitor active shake instances — engine does not expose aggregate shake state natively. Requires manual tracking with shake lifecycle callbacks.
- Retract speed (500cm/s) implementation may require manual arm length interpolation if USpringArmComponent::CameraRetractSpeed does not exist in 5.7 — verify before implementing.
- Cinematic mode requires discipline from Sequencer authors: the sequence must call SetCameraMode() on end, or the camera manager remains in suppressed state permanently.

### Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| ~~UCameraShakeBase procedural subclass name unknown in 5.7~~ | MEDIUM (RESOLVED 2026-05-26) | ✅ MED-4 fix applied: UE5 production pattern is `UCameraShakeBase` + `RootShakePattern = UPerlinNoiseCameraShakePattern` (composition, not subclass). Legacy `UPerlinNoiseCameraShake` removed in UE 5.0. All shake calls go through `AddShake(TSubclassOf<UCameraShakeBase>)`. |
| UpdateViewTarget() Cinematic suppression may corrupt blend state if Super:: call skipped | MEDIUM (FIXED) | On Cinematic exit, call Super::UpdateViewTarget() to restore engine-side blend state before re-enabling custom logic. Document in implementation guide. |
| Aggregate shake amplitude tracking — engine does not expose this natively | MEDIUM | AHostileWorldPlayerCameraManager tracks amplitude per-shake via TArray of active shake records. Scale clamping at AddShake() call site is sufficient for cap enforcement. |
| Cinematic mode — ULevelSequencePlayer may not restore camera automatically on sequence end | HIGH | Sequence actors must call SetCameraMode(ThirdPerson) explicitly in their end event. Document as authoring requirement. Alternative: override APlayerCameraManager::OnCinematicModeUpdated() if available. |
| Spring arm retract speed — USpringArmComponent may not expose CameraRetractSpeed directly | MEDIUM | Implement via TargetArmLength FInterpTo in UpdateViewTarget() as fallback. Verification Required item (5). |
| SetViewTargetWithBlend EaseInOut not matching GDD "configurable curve" requirement | LOW | GDD specifies "configurable EaseInOut curve" — VTBlend_EaseInOut with BlendExp parameter satisfies this. If custom Bezier required, use VTBlend_Custom with a UCurveFloat reference. |
| OnCameraModeChanged consumers subscribing post-spawn (race condition) | LOW | AHostileWorldPlayerCameraManager::BeginPlay() fires OnCameraModeChanged(None, ThirdPerson) so late subscribers receive current state on connect. |

## GDD Requirements Addressed

| GDD System | Requirement (TR-ID) | How This ADR Addresses It |
|------------|---------------------|--------------------------|
| camera-system.md | TR-camera-001: 5 modes via APlayerCameraManager | Decided: AHostileWorldPlayerCameraManager (APlayerCameraManager subclass) with EHostileCameraMode enum; per-mode UpdateViewTarget() dispatch |
| camera-system.md | TR-camera-002: SetViewTargetWithBlend EaseInOut | Decided: SetViewTargetWithBlend(Target, BlendTime, VTBlend_EaseInOut, BlendExp); BlendTime and BlendExp are tuning knobs |
| camera-system.md | TR-camera-003: Spring arm ProbeChannel=ECC_Camera, 500cm/s retract, 50cm min | Decided: USpringArmComponent on AHostileCharacter; ProbeChannel=ECC_Camera; min arm=50cm via ClampedDistance; retract speed 500cm/s via CameraRetractSpeed or TargetArmLength interpolation |
| camera-system.md | TR-camera-004: UCameraShakeBase Perlin noise; positional/rotational variants | Decided: Blueprint subclasses of `UCameraShakeBase` with `RootShakePattern = UPerlinNoiseCameraShakePattern` (composition model, UE 5.0+) — positional pattern for impacts, rotational pattern for terraform/zone events; started via `AddShake(TSubclassOf<UCameraShakeBase>, Scale)` |
| camera-system.md | TR-camera-005: Cinematic mode via Sequencer | Decided: bCinematicActive flag suppresses UpdateViewTarget() custom logic; ULevelSequencePlayer drives camera transforms; sequence authors must call SetCameraMode() on end |
| camera-system.md | TR-camera-006: Lumen auto-exposure per zone | Decided: NOT in camera system — PostProcessVolume actors per zone handle exposure. Camera system exposes GetCameraMode() for any post-process conditional logic. |
| camera-system.md | TR-camera-007: ICameraSystem interface | Decided: ICameraSystem C++ abstract interface with 5 methods; implemented by AHostileWorldPlayerCameraManager; all callers use interface pointer |
| camera-system.md | TR-camera-008: Shake stacking cap 25px/15° | Decided: AddShake() tracks current aggregate amplitude+rotation, clamps Scale before calling StartCameraShake() |

## Performance Implications

- **CPU**: UpdateViewTarget() runs every frame — mode dispatch is an enum switch, O(1). Recoil decay via FInterpTo is cheap. Aggregate shake tracking checks TArray of active shakes on each AddShake() call only (not per-frame).
- **Memory**: TArray of active shake records on AHostileWorldPlayerCameraManager — max ~10 concurrent shakes; negligible.
- **Load Time**: No asset loading. APlayerCameraManager spawns with the PC.
- **Network**: N/A — single-player only. APlayerCameraManager is client-only by nature.

## Migration Plan

No existing code to migrate. Greenfield. Implementation sequence:
1. Subclass APlayerCameraManager → AHostileWorldPlayerCameraManager; register in GameMode DefaultPlayerCameraManagerClass
2. Implement EHostileCameraMode enum + SetCameraMode() + UpdateViewTarget() dispatch
3. Implement ICameraSystem interface
4. Wire USpringArmComponent settings on AHostileCharacter
5. Implement AddShake() with aggregate cap tracking
6. Implement AddRecoil() with FInterpTo decay in UpdateViewTarget()
7. Subscribe to OnPlayerLanded / OnImpact (ADR-0007), OnZoneCrossed (ADR-0008)
8. Implement Cinematic mode delegation to ULevelSequencePlayer

## Validation Criteria

- Mode switching: call SetCameraMode(Conversation, 0.5f); confirm blend completes in 0.5s, OTS framing at 250cm/30°/55° FOV; OnCameraModeChanged fires with correct old/new modes
- ThirdPerson spring arm: confirm ProbeChannel=ECC_Camera, min arm clamps at 50cm against walls, camera lag enabled
- Shake positional: OnPlayerLanded fires → LandingShake applied; amplitude measured <25px
- Shake stacking: fire Explosion shake + Terraform shake simultaneously; confirm aggregate ≤25px and ≤15°
- Shake cap: fire 5 simultaneous shakes; confirm camera does not exceed cap
- Recoil: fire AddRecoil(5.0f, 0.0f); confirm pitch offset decays to zero via FInterpTo over ~0.5s
- Cinematic mode: play a level sequence; confirm UpdateViewTarget() logic suspended; confirm normal camera restored on sequence end
- OnCameraModeChanged: subscribe a test listener; confirm fires on every mode transition

## Related Decisions

- ADR-0001: Cross-System Communication — OnCameraModeChanged follows dynamic multicast delegate pattern; all shake event subscriptions (OnPlayerLanded, OnImpact, OnZoneCrossed) use AddDynamic/RemoveDynamic
- ADR-0003: Enhanced Input Architecture — AHostileWorldPlayerController is the sole caller of SetCameraMode()
- ADR-0004: Subsystem & Module Architecture — Camera system lives on APlayerCameraManager (not a ULocalPlayerSubsystem), consistent with engine camera ownership model
- ADR-0007: Physics & Collision Architecture — OnPlayerLanded and OnImpact are the shake trigger events; UPhysicsHelperSubsystem fires them
- ADR-0008: Scene Streaming Architecture — OnZoneCrossed consumed by AHostileWorldPlayerCameraManager for chromatic aberration / film grain environmental effects
