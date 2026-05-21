# ADR-0007: Physics & Collision Architecture

## Status
Proposed

## Date
2026-05-20

## Engine Compatibility

| Field | Value |
|-------|-------|
| **Engine** | Unreal Engine 5.7 |
| **Domain** | Physics |
| **Knowledge Risk** | HIGH — UE 5.7 (Nov 2025) is post-LLM-cutoff (May 2025); Chaos Physics improvements in 5.4–5.7 not in training data |
| **References Consulted** | `docs/engine-reference/unreal/modules/physics.md`, `docs/engine-reference/unreal/VERSION.md` |
| **Post-Cutoff APIs Used** | Chaos Physics (confirmed active in 5.7); `UGeometryCollectionComponent` + `FChaosBreakEvent` (confirmed stable since 5.0); `UEnhancedInputUserSettings` pattern not used here |
| **Verification Required** | (1) ✅ Chaos Destruction plugin default in 5.7 — confirmed. (2) ✅ `FChaosBreakEvent` signature stable — confirmed. (3) ✅ Max 18 custom channels — confirmed (8 used). (4) ✅ Physics substep config path — confirmed. |

## ADR Dependencies

| Field | Value |
|-------|-------|
| **Depends On** | ADR-0001 (Accepted — delegate pattern for `OnPlayerLanded`/`OnImpact`); ADR-0004 (Accepted — World-tier subsystem assignment) |
| **Enables** | ADR-0008 Scene Streaming Architecture, ADR-0010 Movement Architecture |
| **Blocks** | Implementation of Movement, Health (fall damage), Camera (impact shake), Combat (hitscan), Alien AI (perception traces) is gated until this ADR is Accepted |
| **Ordering Note** | ADR-0001 and ADR-0004 must be Accepted before this can be implemented. Both are Accepted. |

## Context

### Problem Statement
Ten TR-physics-* requirements have zero ADR coverage. Eight downstream systems (Movement, Combat, Health, Camera, Alien AI, Infection Spread, HUD, Scene Management) consume physics queries, physics events, and physical material data. Without an architecture decision, each system will independently implement inconsistent physics access patterns, creating hidden coupling and non-uniform collision behaviour.

### Constraints
- Chaos Physics is the only physics runtime in UE 5.7 (legacy PhysX removed)
- 8 custom collision channels required (TR-physics-002); UE 5.7 supports up to 18 custom channels
- `UPhysicsHelperSubsystem` must be World-tier per ADR-0004 (physics state resets per level)
- All inter-system events must follow ADR-0001 DECLARE_DYNAMIC_MULTICAST_DELEGATE pattern
- Physics CPU must fit within the 16.6ms frame budget (60fps target)
- `UGameplayMessageSubsystem` (for glass break broadcast) requires GameplayMessageRouter plugin — already mandated by ADR-0001

### Requirements
- Use Chaos Physics engine — TR-physics-001
- Define 8 custom collision channels — TR-physics-002
- Define 7 physical materials with friction/restitution per surface — TR-physics-003
- Ground detection via pelvis line trace, 150cm, per-frame surface classification — TR-physics-004
- Weapon hitscan via single line trace; AI via multi-trace + overlap; landing via sphere sweep — TR-physics-005
- Glass shattering via Chaos Destruction Geometry Collection — TR-physics-006
- Ragdoll blend 0.3s from animation on death — TR-physics-007
- Expose IPhysicsHelper interface (surface queries, raycasts, fall damage calc, OnImpact/OnLanded delegates) — TR-physics-008
- Configure physics substeps for 60fps accuracy — TR-physics-009
- Fire OnImpact and OnLanded delegates; consumers subscribe — TR-physics-010

## Decision

### Physics Runtime
Use **Chaos Physics** exclusively. No legacy PhysX usage. Chaos is the only runtime available in UE 5.7.

---

### UPhysicsHelperSubsystem — World Tier

Implement `UPhysicsHelperSubsystem : public UWorldSubsystem` as the single access point for physics services consumed by multiple systems. Assigned to **World tier** per ADR-0004 (physics state is per-level; the subsystem resets on level transition).

`AHostileCharacter::Landed()` override fires `NotifyPlayerLanded()` on the subsystem (not the 4Hz poll — the poll is for surface type classification only). `AHostileCharacter`'s `OnComponentHit` binding fires `NotifyImpact()`.

`CalculateFallDamage()` and `GetSurfaceType()` are on the subsystem (not a `UFunctionLibrary`) because they depend on per-world tuning knob `UPROPERTY` data. Accessing the subsystem at call sites is acceptable; the tuning knobs justify the UObject overhead.

---

### Custom Collision Channels

Defined in `DefaultEngine.ini` under `[/Script/Engine.CollisionProfile]`. Channel numbers are assigned by order of definition — document ownership in `DefaultEngine.ini` comments to prevent third-party plugin collision. Accessed in C++ via the generated `ECollisionChannel` enum values.

| Channel Name | ECC Alias | Object Type | Default Response |
|---|---|---|---|
| HostilePlayer | ECC_GameTraceChannel1 | Pawn | — |
| HostileAlien | ECC_GameTraceChannel2 | Pawn | Block |
| HostileInfection | ECC_GameTraceChannel3 | WorldDynamic | Overlap |
| HostileWorldObject | ECC_GameTraceChannel4 | WorldStatic | Block |
| HostileVehicle | ECC_GameTraceChannel5 | Vehicle | Block |
| HostileProjectile | ECC_GameTraceChannel6 | WorldDynamic | Overlap |
| HostileInteractable | ECC_GameTraceChannel7 | WorldDynamic | Overlap |
| HostileAIPerception | ECC_GameTraceChannel8 | WorldDynamic | Overlap |

Convenience aliases (eliminates magic `ECC_GameTraceChannelN` numbers across the codebase):

```cpp
// Source/HostileWorld/HostileCollisionChannels.h
namespace EHostileCollision
{
    static constexpr ECollisionChannel Player        = ECC_GameTraceChannel1;
    static constexpr ECollisionChannel Alien         = ECC_GameTraceChannel2;
    static constexpr ECollisionChannel Infection     = ECC_GameTraceChannel3;
    static constexpr ECollisionChannel WorldObject   = ECC_GameTraceChannel4;
    static constexpr ECollisionChannel Vehicle       = ECC_GameTraceChannel5;
    static constexpr ECollisionChannel Projectile    = ECC_GameTraceChannel6;
    static constexpr ECollisionChannel Interactable  = ECC_GameTraceChannel7;
    static constexpr ECollisionChannel AIPerception  = ECC_GameTraceChannel8;
}
```

---

### Physical Materials

Seven `UPhysicalMaterial` assets authored in Content Browser at `Content/Physics/Surfaces/`:

| Asset Name | Friction | Restitution |
|---|---|---|
| PM_Snow | 0.6 | 0.0 |
| PM_Ice | 0.15 | 0.05 |
| PM_Metal | 0.5 | 0.3 |
| PM_Concrete | 0.7 | 0.0 |
| PM_AlienBiomass | 0.4 | 0.5 |
| PM_Wood | 0.55 | 0.1 |
| PM_Glass | 0.3 | 0.4 |

Surface type enum (registered in `Project Settings > Physics > Physical Surface`):

```cpp
UENUM(BlueprintType)
enum class EHostileSurfaceType : uint8
{
    Default     UMETA(DisplayName="Default"),
    Snow        UMETA(DisplayName="Snow"),
    Ice         UMETA(DisplayName="Ice"),
    Metal       UMETA(DisplayName="Metal"),
    Concrete    UMETA(DisplayName="Concrete"),
    AlienBiomass UMETA(DisplayName="AlienBiomass"),
    Wood        UMETA(DisplayName="Wood"),
    Glass       UMETA(DisplayName="Glass")
};
```

`GetSurfaceType()` reads `FHitResult::PhysMaterial->SurfaceType` — **must null-check `PhysMaterial`** before dereference; surfaces without an assigned physical material return `EHostileSurfaceType::Default`.

---

### Raycasting Strategy

All gameplay traces use direct `UWorld` calls at the call site, except where `UPhysicsHelperSubsystem` wraps them for delegate notification or shared 3+ system access.

| Use Case | Method | Channel | Called From |
|---|---|---|---|
| Weapon hitscan | `LineTraceSingleByChannel` | `ECC_Visibility` | `UCombatComponent` |
| AI sight | `LineTraceMultiByChannel` | `EHostileCollision::AIPerception` | `UAlienBTService_UpdatePerception` |
| Interaction check | `LineTraceSingleByChannel` | `ECC_Visibility` | `AHostileWorldPlayerController` (context resolver, 4Hz) |
| Ground detection | `LineTraceSingleByChannel` (pelvis −Z, 150cm) | `ECC_WorldStatic` | `AHostileCharacter` (4Hz, surface type only) |
| Landing detection | `ACharacter::Landed()` override | — | `AHostileCharacter` → `UPhysicsHelperSubsystem::NotifyPlayerLanded()` |
| AI hearing | `OverlapMultiByChannel` | `EHostileCollision::AIPerception` | `UAISenseConfig_Hearing` (engine-managed) |

**4Hz surface poll is for `GetSurfaceType()` updates only.** The `OnPlayerLanded` delegate is fired from the `ACharacter::Landed()` engine callback — not from the poll.

---

### Fall Damage

Encapsulated in `UPhysicsHelperSubsystem::CalculateFallDamage()`:

```cpp
float UPhysicsHelperSubsystem::CalculateFallDamage(float ImpactVelocity) const
{
    return FMath::Max(0.f, (ImpactVelocity - SafeFallVelocity) * FallDamageCoefficient);
}
// UPROPERTY(EditDefaultsOnly) float SafeFallVelocity = 800.f;
// UPROPERTY(EditDefaultsOnly) float FallDamageCoefficient = 0.15f;
```

`UHealthComponent` subscribes to `UPhysicsHelperSubsystem::OnPlayerLanded` and calls `CalculateFallDamage()` on the received `ImpactVelocity`.

---

### Chaos Destruction (Glass Shattering)

Glass mesh actors use `UGeometryCollectionComponent`. Break threshold = 5000 impulse (`UPROPERTY(EditDefaultsOnly)` on `AGlassActor`).

```cpp
void AGlassActor::OnBreak(const FChaosBreakEvent& BreakEvent)
{
    // Notify scene management for state update (ADR-0001 global broadcast)
    UGameplayMessageSubsystem* MsgSub =
        UGameInstance::GetSubsystem<UGameplayMessageSubsystem>(GetGameInstance());
    if (MsgSub)
    {
        FGlassBrokenMessage Msg;
        Msg.Location = BreakEvent.Location;
        MsgSub->BroadcastMessage(TAG_Event_World_GlassBroken, Msg);
    }
}
```

Glass collision preset: `EHostileCollision::WorldObject` (Block) + `EHostileCollision::Projectile` (Overlap for impact detection); `bNotifyRigidBodyCollision = true`.

---

### Ragdoll

Death flow: `UHealthComponent::OnDeath` → `AHostileCharacter::StartRagdoll()`:

```cpp
void AHostileCharacter::StartRagdoll()
{
    // Bone name must match skeleton asset exactly — use a named constant, not a string literal
    static const FName PelvisBone = TEXT("pelvis"); // verify against Physics Asset
    GetMesh()->SetAllBodiesBelowSimulatePhysics(PelvisBone, true, true);
    GetMesh()->SetSimulatePhysics(true);
    // BlendWeight driven by UTimelineComponent: 0.0→1.0 over 0.3s
    // AnimBP reads RagdollBlendWeight UPROPERTY, interpolated by Timeline tick
    RagdollTimeline->PlayFromStart();
}
```

`UPhysicsHelperSubsystem` is not involved — ragdoll is local actor state.

---

### Physics Substep Configuration

`Project Settings > Engine > Physics > Framerate`:
- **Max Substep Delta Time**: 3.33ms (= 16.6ms ÷ 5 substeps at steady 60fps)
- **Max Substeps**: 6 (caps substep cost during frame spikes; prevents spiral)
- Async Physics (`bTickPhysicsAsync`) left **disabled** (default in UE 5.7). Enabling async physics would invalidate the synchronous `GetSurfaceType()` model — do not enable without revising this ADR.

Resolves GDD OQ-1.

---

### Architecture Diagram

```
AHostileCharacter
  ├── Landed() override ──────────────────────────────────┐
  ├── OnComponentHit binding ────────────────────────────┐ │
  └── 4Hz ground trace → GetSurfaceType() ◄──────────┐  │ │
                                                       │  ▼ ▼
                           UPhysicsHelperSubsystem (UWorldSubsystem)
                           ├── OnPlayerLanded (DYNAMIC_MULTICAST_DELEGATE)
                           │    ├── UHealthComponent (fall damage)
                           │    └── UCameraShakeManager (landing shake)
                           ├── OnImpact (DYNAMIC_MULTICAST_DELEGATE)
                           │    └── UCameraShakeManager (impact shake)
                           ├── GetSurfaceType(Location) ◄─┘
                           └── CalculateFallDamage(V)

Collision Channels  →  DefaultEngine.ini + HostileCollisionChannels.h (aliases)
Physical Materials  →  Content/Physics/Surfaces/ (7 UPhysicalMaterial assets)
Chaos Destruction   →  AGlassActor::UGeometryCollectionComponent
Ragdoll             →  AHostileCharacter::StartRagdoll() (local actor state)
```

---

### Key Interfaces

```cpp
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(
    FOnPlayerLandedDelegate,
    float, ImpactVelocity,
    EHostileSurfaceType, SurfaceType);

DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(
    FOnImpactDelegate,
    FVector, ImpactLocation,
    float, ImpactForce);

UCLASS()
class HOSTILEWORLD_API UPhysicsHelperSubsystem : public UWorldSubsystem
{
    GENERATED_BODY()

public:
    // Delegates — consumers AddDynamic() in BeginPlay(), RemoveDynamic() in EndPlay()
    UPROPERTY(BlueprintAssignable)
    FOnPlayerLandedDelegate OnPlayerLanded;

    UPROPERTY(BlueprintAssignable)
    FOnImpactDelegate OnImpact;

    // Called by AHostileCharacter::Landed() — fires OnPlayerLanded delegate
    void NotifyPlayerLanded(float ImpactVelocity, EHostileSurfaceType Surface);

    // Called by AHostileCharacter::OnComponentHit binding — fires OnImpact delegate
    void NotifyImpact(FVector Location, float Force);

    // Surface query — reads UPhysicalMaterial::SurfaceType from a line trace result
    // Returns EHostileSurfaceType::Default if no physical material is assigned
    UFUNCTION(BlueprintCallable)
    EHostileSurfaceType GetSurfaceType(FVector Location) const;

    // Fall damage formula: max(0, (ImpactVelocity - SafeFallVelocity) * FallDamageCoefficient)
    UFUNCTION(BlueprintCallable, BlueprintPure)
    float CalculateFallDamage(float ImpactVelocity) const;

private:
    UPROPERTY(EditDefaultsOnly, Category="Physics|FallDamage")
    float SafeFallVelocity = 800.f;

    UPROPERTY(EditDefaultsOnly, Category="Physics|FallDamage")
    float FallDamageCoefficient = 0.15f;
};
```

## Alternatives Considered

### Alternative 1: Delegates on AHostileCharacter directly
- **Description**: Declare `OnPlayerLanded` and `OnImpact` as `UPROPERTY` delegates on `AHostileCharacter`. No new subsystem.
- **Pros**: Zero new class; delegates fire from the natural source.
- **Cons**: All consumers (UHealthComponent, Camera, HUD) must obtain a typed reference to `AHostileCharacter`, creating direct coupling to the player class. Violates ADR-0001 decoupling intent. Future NPCs or AI characters with fall damage would require separate subscriptions per character instance.
- **Rejection Reason**: Direct coupling from 5+ systems to `AHostileCharacter`. Contradicts ADR-0001.

### Alternative 2: Static utility functions (FPhysicsHelpers namespace)
- **Description**: Static function library for all physics queries; no UObject.
- **Pros**: Zero UObject overhead; no initialization ordering issues.
- **Cons**: Cannot hold `DECLARE_DYNAMIC_MULTICAST_DELEGATE` (requires UObject). All event-driven consumers would need to bind directly to `ACharacter::Landed()`, re-creating the Alternative 1 coupling problem.
- **Rejection Reason**: Cannot implement the delegate pattern required by ADR-0001.

### Alternative 3: Per-consumer direct UWorld traces (no subsystem)
- **Description**: Each consuming system performs its own `LineTraceSingleByChannel` calls directly.
- **Pros**: No abstraction layer; call sites are explicit.
- **Cons**: Raycasting conventions (channels, trace params, ignore lists) diverge per system. Fall damage formula duplicated. No delegate notification path for multi-consumer events.
- **Rejection Reason**: Inconsistent physics access patterns across 8 systems; no shared fall damage formula.

## Consequences

### Positive
- All 10 TR-physics-* requirements addressed in one ADR
- 8 downstream systems share a stable, typed physics interface
- Fall damage formula centralised and unit-testable in isolation
- `EHostileCollision` namespace eliminates magic `ECC_GameTraceChannelN` numbers
- Physical materials are data assets — tunable by designers without code changes
- `UWorldSubsystem` scoping means clean teardown on level transition

### Negative
- `UPhysicsHelperSubsystem` is a World-tier class; consumers must re-subscribe in `BeginPlay()` every level load
- Thin wrapper over direct `UWorld` calls adds one indirection for `GetSurfaceType()` / `CalculateFallDamage()`

### Risks
- **Bone name casing for ragdoll** [MEDIUM]: `"pelvis"` bone name must exactly match the skeleton asset (case-sensitive at runtime on some platforms). Use a named `FName` constant. Verify against the Physics Asset before shipping.
- **`GetPhysicsMaterial()` null safety** [MEDIUM]: `GetPhysicsMaterial()` returns `nullptr` if no physical material is assigned to a surface. `GetSurfaceType()` must null-check before dereference — unassigned surfaces return `EHostileSurfaceType::Default`.
- **Async physics incompatibility** [MEDIUM]: `bTickPhysicsAsync` must remain disabled (default). Enabling async physics decouples physics state from the game thread; `GetSurfaceType()` would read stale frame-N−1 data. Revise this ADR before enabling.
- **Third-party plugin channel collision** [LOW]: `ECC_GameTraceChannel1–8` are assigned by `DefaultEngine.ini` definition order. A third-party plugin claiming the same channel slot silently collides. Document channel ownership in `DefaultEngine.ini` comments; audit if new plugins are added.
- **Chaos Destruction memory** [LOW]: Each Geometry Collection caches fracture data (~50–200KB per asset). Keep destructible actor count low at MVP; profile before shipping destructible-heavy levels.
- **Consumer re-subscription overhead** [LOW]: Each level load, all consumers call `AddDynamic()` in `BeginPlay()`. At MVP scale (< 20 consumers) this is negligible.

## GDD Requirements Addressed

| GDD System | Requirement | How This ADR Addresses It |
|---|---|---|
| physics-system.md | TR-physics-001: Chaos Physics | Confirmed as UE 5.7 exclusive runtime; PhysX patterns forbidden |
| physics-system.md | TR-physics-002: 8 custom channels | Defined in `DefaultEngine.ini`; aliased in `HostileCollisionChannels.h` |
| physics-system.md | TR-physics-003: 7 physical materials | `UPhysicalMaterial` assets at `Content/Physics/Surfaces/` |
| physics-system.md | TR-physics-004: Ground detection line trace | 4Hz pelvis −Z trace in `AHostileCharacter`; `GetSurfaceType()` reads result |
| physics-system.md | TR-physics-005: Raycasting strategy | Weapon=`LineTraceSingle`, AI=`Multi`, Landing=`ACharacter::Landed()` override; table in Decision |
| physics-system.md | TR-physics-006: Chaos Destruction glass | `UGeometryCollectionComponent` + `OnBreak`→`FChaosBreakEvent` on `AGlassActor` |
| physics-system.md | TR-physics-007: Ragdoll 0.3s blend | `StartRagdoll()` + `SetSimulatePhysics(true)` + `UTimelineComponent` 0→1 over 0.3s |
| physics-system.md | TR-physics-008: IPhysicsSystem interface | `UPhysicsHelperSubsystem` provides all required surface/ray/damage/delegate API |
| physics-system.md | TR-physics-009: Physics substep 60fps | `MaxSubstepDeltaTime=3.33ms`, `MaxSubsteps=6` in Project Settings > Physics |
| physics-system.md | TR-physics-010: OnImpact/OnLanded delegates | `FOnPlayerLandedDelegate` + `FOnImpactDelegate` on `UPhysicsHelperSubsystem` |
| movement-system.md | TR-movement-008: Noise sphere events | `EHostileCollision::AIPerception` channel defined; AI hearing uses it |
| health-system.md | TR-health-004: Fall damage | `CalculateFallDamage()` on subsystem; `UHealthComponent` subscribes to `OnPlayerLanded` |
| alien-ai-system.md | TR-ai-002: AI perception traces | `EHostileCollision::AIPerception` channel defined; `UAISenseConfig_Sight` configures against it |

## Performance Implications
- **CPU**: Physics substep budget ~3.33ms × 3 substeps = ~10ms at steady 60fps (engine physics, not gameplay code). `UPhysicsHelperSubsystem` adds < 0.05ms/frame (delegate forwarding + two 4Hz traces only).
- **Memory**: 7 `UPhysicalMaterial` assets ≈ negligible. Geometry Collection per glass actor ~50–200KB depending on fracture complexity.
- **Load Time**: Physical material assets hard-referenced via `UPROPERTY` on the subsystem; loaded at level load with no streaming cost.
- **Network**: Physics is local-only at MVP (single-player). No replication decisions in this ADR.

## Migration Plan
Greenfield — no existing code to migrate. Implementation order:

1. Add 8 custom channel entries to `DefaultEngine.ini` with ownership comments
2. Create `Source/HostileWorld/HostileCollisionChannels.h` with `EHostileCollision` namespace
3. Register 7 `EPhysicalSurface` entries in `Project Settings > Physics > Physical Surface`
4. Create 7 `UPhysicalMaterial` assets at `Content/Physics/Surfaces/`
5. Implement `UPhysicsHelperSubsystem` (World tier, full interface above)
6. Implement `AHostileCharacter::Landed()` + `OnComponentHit` → `Notify*()` calls
7. Verify Chaos Destruction plugin is enabled in `.uproject`
8. Author `AGlassActor` with `UGeometryCollectionComponent` + `OnBreak` binding
9. Configure `Project Settings > Engine > Physics > Framerate` substep values

## Validation Criteria
- **[VER-PHY-001]** `LineTraceSingleByChannel` with `ECC_Visibility` hits a `WorldStatic` mesh and returns correct `FHitResult.Location`
- **[VER-PHY-002]** `CalculateFallDamage(1200.f)` returns `60.0f`; `CalculateFallDamage(800.f)` returns `0.0f`
- **[VER-PHY-003]** Player lands → `OnPlayerLanded` fires with correct `ImpactVelocity` and `SurfaceType` values; `UHealthComponent` receives and applies the event
- **[VER-PHY-004]** `GetSurfaceType()` at a `PM_Snow` surface returns `EHostileSurfaceType::Snow`; at an unassigned surface returns `EHostileSurfaceType::Default`
- **[VER-PHY-005]** Glass actor receiving > 5000 impulse shatters via Chaos Destruction; `TAG_Event_World_GlassBroken` is broadcast; player enters free fall
- **[VER-PHY-006]** Player death → ragdoll blend weight reaches 1.0 in `0.3s ± 0.05s`; full ragdoll physics active
- **[VER-PHY-007]** `EHostileCollision::Projectile` trace passes through `EHostileCollision::Infection` mesh with no hit registered
- **[VER-PHY-008]** `EHostileCollision::Player` vs `EHostileCollision::Alien` collision returns `ECR_Block` response
- **[VER-PHY-009]** `UPhysicsHelperSubsystem` is valid on `GetWorld()->GetSubsystem<UPhysicsHelperSubsystem>()` during Play; null after level teardown

## Related Decisions
- ADR-0001: Cross-System Communication — `DECLARE_DYNAMIC_MULTICAST_DELEGATE` pattern used by `OnPlayerLanded`/`OnImpact`
- ADR-0004: Subsystem & Module Architecture — `UPhysicsHelperSubsystem` assigned to World tier
- ADR-0005: Game Data Strategy — `UPhysicalMaterial` assets follow the Data Asset pattern
- `design/gdd/physics-system.md` — source of all TR-physics-* requirements
- `design/gdd/movement-system.md` — primary consumer of surface/ground state
- `design/gdd/health-system.md` — `OnPlayerLanded` subscriber; fall damage applicator
- `design/gdd/combat-system.md` — weapon hitscan consumer
- `design/gdd/alien-ai-system.md` — AI perception trace consumer
