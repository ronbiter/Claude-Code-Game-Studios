# Unreal Engine 5.7 — AI Perception Module Reference

**Last verified:** 2026-05-26
**Engine version:** 5.7
**Scope:** `AIModule` — `UAIPerceptionSystem`, `UAIPerceptionComponent`, `UAISenseConfig_*`, `UAISense_*`, `FAINoiseEvent`, `FAIDamageEvent`

> **Why this doc exists:** The LLM training cutoff predates UE 5.7. Several common pre-5.x patterns (`UAIPerceptionSystem::MakeNoise()`, `UAIPerceptionComponent::ReportNoise()`, implicit damage-sense firing) **do not exist** in UE 5.7. Every architecture and gameplay system that emits noise or damage to alien perception MUST use the APIs documented here.
>
> Consumers: ADR-0010 (Movement), ADR-0012 (Alien AI), ADR-0014 (Combat), ADR-0017 (Stealth).

---

## 1. Required Module Dependencies

In `<ProjectName>.Build.cs`:

```csharp
PublicDependencyModuleNames.AddRange(new string[] {
    "Core", "CoreUObject", "Engine", "InputCore",
    "AIModule",                  // UAIPerceptionSystem, UAIPerceptionComponent, UAISense_*
    "GameplayTags",              // FGameplayTag noise tags
    "NavigationSystem"           // For AI controllers / pathing (see navigation.md)
});
```

`AIModule` is **not** included in the default Game module template. Add it explicitly or `AAlienAIController`, `UAIPerceptionComponent`, and all sense headers will fail to compile.

---

## 2. Component Placement: Character vs Controller

`UAIPerceptionComponent` may live on either the `AAIController` or the `APawn`/`ACharacter` it possesses. The placement choice has real consequences for runtime behavior.

### 2.1 Canonical Placement — On the Controller

```cpp
UCLASS()
class AAlienAIController : public AAIController {
    GENERATED_BODY()
public:
    AAlienAIController();
private:
    UPROPERTY(VisibleAnywhere, Category="AI")
    TObjectPtr<UAIPerceptionComponent> PerceptionComp;
};

AAlienAIController::AAlienAIController() {
    PerceptionComp = CreateDefaultSubobject<UAIPerceptionComponent>(TEXT("Perception"));
    SetPerceptionComponent(*PerceptionComp);   // auto-wired when on controller
}
```

When placed on the controller and constructed via `CreateDefaultSubobject` + `SetPerceptionComponent(*PerceptionComp)`, the engine automatically:
- Registers the component with `UAIPerceptionSystem`
- Routes all sense events through the controller's `GetPerceptionComponent()` accessor
- Updates the threat-map and dominant-sense bookkeeping

### 2.2 Alternative — On the Character (Requires Explicit Wiring)

When the perception component lives on the possessed pawn (so it persists if the controller is swapped, or so it is editor-visible in the character Blueprint), the controller **must** explicitly bind it on possession:

```cpp
void AAlienAIController::OnPossess(APawn* InPawn) {
    Super::OnPossess(InPawn);

    if (AAlienCharacter* Alien = Cast<AAlienCharacter>(InPawn)) {
        if (UAIPerceptionComponent* PawnPerception = Alien->FindComponentByClass<UAIPerceptionComponent>()) {
            SetPerceptionComponent(*PawnPerception);   // REQUIRED — without this, GetPerceptionComponent() returns null
        }
    }
}
```

### Forbidden Pattern

> **`perception_without_setperception`** (ADR-0012, registered in `adr-subsystems.yaml`)
>
> When `UAIPerceptionComponent` lives on `AAlienCharacter` (not on `AAlienAIController`), the controller MUST call `SetPerceptionComponent(*PerceptionComp)` in `OnPossess()`. Omitting this call makes `AAIController::GetPerceptionComponent()` return null. BT Services and Tasks that navigate via `GetPerceptionComponent()` will dereference null and crash.

---

## 3. Sense Configuration

Each sense is added by attaching a `UAISenseConfig_*` to the perception component during construction. Sense parameters are then exposed via the standard `UPROPERTY(EditDefaultsOnly)` pattern.

```cpp
UCLASS()
class AAlienAIController : public AAIController {
    GENERATED_BODY()
    AAlienAIController();
private:
    UPROPERTY(VisibleAnywhere) TObjectPtr<UAIPerceptionComponent>     PerceptionComp;
    UPROPERTY(VisibleAnywhere) TObjectPtr<UAISenseConfig_Sight>       SightConfig;
    UPROPERTY(VisibleAnywhere) TObjectPtr<UAISenseConfig_Hearing>     HearingConfig;
    UPROPERTY(VisibleAnywhere) TObjectPtr<UAISenseConfig_Damage>      DamageConfig;
};

AAlienAIController::AAlienAIController() {
    PerceptionComp = CreateDefaultSubobject<UAIPerceptionComponent>(TEXT("Perception"));

    SightConfig    = CreateDefaultSubobject<UAISenseConfig_Sight>(TEXT("Sight"));
    HearingConfig  = CreateDefaultSubobject<UAISenseConfig_Hearing>(TEXT("Hearing"));
    DamageConfig   = CreateDefaultSubobject<UAISenseConfig_Damage>(TEXT("Damage"));

    SightConfig->SightRadius      = 2500.f;
    SightConfig->LoseSightRadius  = 3000.f;
    SightConfig->PeripheralVisionAngleDegrees = 90.f;
    SightConfig->DetectionByAffiliation.bDetectEnemies   = true;
    SightConfig->DetectionByAffiliation.bDetectNeutrals  = true;
    SightConfig->DetectionByAffiliation.bDetectFriendlies = false;

    HearingConfig->HearingRange = 2000.f;
    HearingConfig->DetectionByAffiliation.bDetectEnemies = true;

    PerceptionComp->ConfigureSense(*SightConfig);
    PerceptionComp->ConfigureSense(*HearingConfig);
    PerceptionComp->ConfigureSense(*DamageConfig);

    PerceptionComp->SetDominantSense(UAISense_Sight::StaticClass());
    SetPerceptionComponent(*PerceptionComp);
}
```

Subscribing to perception updates:

```cpp
void AAlienAIController::BeginPlay() {
    Super::BeginPlay();
    PerceptionComp->OnTargetPerceptionUpdated.AddDynamic(
        this, &AAlienAIController::HandlePerceptionUpdated);
}

UFUNCTION()
void AAlienAIController::HandlePerceptionUpdated(AActor* Actor, FAIStimulus Stimulus) {
    // Stimulus.Type returns the sense class as a FAISenseID — cross-reference via UAIPerceptionSystem::GetSenseID<UAISense_Hearing>()
    // Stimulus.WasSuccessfullySensed() — true on detection, false on lost
    // Stimulus.StimulusLocation, Stimulus.ReceiverLocation, Stimulus.Strength
}
```

---

## 4. Noise Reporting — `UAISense_Hearing::ReportNoiseEvent`

### 4.1 The Correct API

```cpp
// AISense_Hearing.h
static void UAISense_Hearing::ReportNoiseEvent(
    UObject* WorldContextObject,
    FVector  NoiseLocation,
    float    Loudness,
    AActor*  Instigator,
    float    MaxRange,
    FName    Tag
);
```

`ReportNoiseEvent` is a **static function** on `UAISense_Hearing`. It constructs an `FAINoiseEvent` internally and delivers it to every registered `UAISenseConfig_Hearing` listener whose owning perception component is within `MaxRange` cm of `NoiseLocation`. The engine handles affiliation filtering, listener iteration, and stimulus generation.

### 4.2 Canonical Usage

```cpp
// From UHostileMovementComponent — fires when computed noise radius > 0
void UHostileMovementComponent::EmitMovementNoise(float RadiusMeters) {
    if (RadiusMeters <= 0.f) { return; }
    const float MaxRangeCm = RadiusMeters * 100.f;

    UAISense_Hearing::ReportNoiseEvent(
        GetWorld(),
        GetOwner()->GetActorLocation(),
        /*Loudness*/ 1.f,
        /*Instigator*/ GetOwner(),
        /*MaxRange*/ MaxRangeCm,
        /*Tag*/ TAG_AI_Noise_Movement
    );

    OnNoiseEmitted.Broadcast(RadiusMeters);   // separate delegate for non-AI consumers (Stealth, HUD)
}
```

### 4.3 What Does NOT Exist in UE 5.7

The following APIs are commonly hallucinated by pre-5.x training data. **None of them exist** — using them produces compile errors:

| Wrong API | Why It Fails |
|-----------|--------------|
| `UAIPerceptionSystem::MakeNoise(...)` | No such function on `UAIPerceptionSystem`. `MakeNoise` exists on `APawn` for legacy `UPawnNoiseEmitterComponent` flow — unrelated to AI perception. |
| `UAIPerceptionSystem::ReportNoise(...)` | No such function. |
| `UAIPerceptionComponent::ReportNoise(...)` | No such function. `UAIPerceptionComponent` is the receiver, not the producer. |
| `AAIController::ReportNoise(...)` | No such function. |
| `Pawn->MakeNoise()` (legacy) | Does NOT trigger `UAISense_Hearing` — only `UPawnNoiseEmitterComponent` listeners. Requires `UPawnNoiseEmitterComponent` on the pawn, which is not used in modern AI perception. |

### 4.4 Manual Path — `UAIPerceptionSystem::OnEvent`

For cases where the static helper's filtering does not suffice (e.g. custom directional cone instead of spherical range), construct `FAINoiseEvent` directly and call `OnEvent`:

```cpp
FAINoiseEvent NoiseEvent;
NoiseEvent.NoiseLocation = NoiseLocation;
NoiseEvent.Loudness      = Loudness;
NoiseEvent.MaxRange      = MaxRangeCm;
NoiseEvent.Instigator    = Instigator;
NoiseEvent.Tag           = TAG_AI_Noise_Movement;

UAIPerceptionSystem* PerceptionSystem = UAIPerceptionSystem::GetCurrent(GetWorld());
if (PerceptionSystem) {
    PerceptionSystem->OnEvent(NoiseEvent);   // delivers to all UAISenseConfig_Hearing listeners
}
```

`OnEvent` is overloaded for each event type (`FAINoiseEvent`, `FAIDamageEvent`, `FAISightEvent`). The static helpers (`UAISense_Hearing::ReportNoiseEvent`, `UAISense_Damage::ReportDamageEvent`) wrap this internally — prefer the helpers unless you need custom event field control.

---

## 5. Damage Reporting — `UAISense_Damage::ReportDamageEvent`

### 5.1 The Correct API

```cpp
// AISense_Damage.h
static void UAISense_Damage::ReportDamageEvent(
    UObject*  WorldContextObject,
    AActor*   DamagedActor,
    AActor*   Instigator,
    float     DamageAmount,
    FVector   EventLocation,    // damage origin
    FVector   HitLocation,      // impact point on damaged actor
    FName     Tag = NAME_None
);
```

**Note the signature carefully:**
- Two locations: `EventLocation` (source) and `HitLocation` (impact). NOT a `HitDirection` vector.
- No `HitDirection` parameter — alien BT services compute direction as `(EventLocation - HitLocation).GetSafeNormal()` if needed.
- `DamageAmount` is a `float`, not `int32`.

### 5.2 Canonical Usage — From the Combat Damage Pipeline

```cpp
// Inside UCombatComponent::ApplyHit() — after damage is applied to UHealthComponent
void UCombatComponent::NotifyAIOfDamage(
    AActor* DamagedActor,
    AActor* Instigator,
    float Damage,
    const FVector& ShotOrigin,
    const FVector& Impact)
{
    UAISense_Damage::ReportDamageEvent(
        GetWorld(),
        DamagedActor,
        Instigator,
        Damage,
        ShotOrigin,                    // EventLocation
        Impact,                        // HitLocation
        TAG_AI_Damage_Gunshot
    );
}
```

### 5.3 Forbidden Pattern — Implicit Firing

> **`damage_sense_implicit_fire`** (ADR-0012, registered in `adr-subsystems.yaml`)
>
> `UAISenseConfig_Damage` does NOT fire automatically when `ApplyDamage`, `TakeDamage`, or `UGameplayStatics::ApplyDamage` are called on an alien. The combat damage pipeline MUST explicitly call `UAISense_Damage::ReportDamageEvent()` after each damage application. `UAISense_Damage` is a passive listener — it processes `FAIDamageEvent` structs only via `ReportDamageEvent` or `UAIPerceptionSystem::OnEvent(FAIDamageEvent)`. There is no hook into the engine's `TakeDamage` pathway.

Wrong assumptions that produce silent failures:
- "`ApplyDamage` automatically fires the damage sense." — false.
- "`OnTakeAnyDamage` delegate firing means the alien perceives the shot." — false (that delegate is for actor-level damage routing; AI perception is a separate channel).
- "If I add `UAISenseConfig_Damage` to the perception component, damage events flow automatically." — false; you must explicitly report them.

### 5.4 What Does NOT Exist

| Wrong API | Reality |
|-----------|---------|
| `UAISense_Damage::ReportDamageEvent(World, Actor, Instigator, Loc, HitDirection, Amount)` | Wrong parameter order/types. There is no `HitDirection`; use the two-location signature in §5.1. |
| `UAIPerceptionSystem::ReportDamage(...)` | No such function. Use the static helper on `UAISense_Damage` or `OnEvent(FAIDamageEvent)`. |
| `UAIPerceptionComponent::ReportDamage(...)` | No such function. |
| Implicit firing via `ApplyDamage` | See §5.3 — does not happen. |

---

## 6. Sight — Standard Path (Reference)

Sight events fire automatically when:
1. A pawn registered with `UAIPerceptionSystem` as a sight target enters a listener's frustum (radius + peripheral angle).
2. A clear line-of-sight trace from the listener's perception location to the target's sight target location succeeds.

No `Report*` call is required for sight. The perception system drives sight evaluation on its own update tick.

### Registering a Pawn as a Sight Target

```cpp
// In APawn-derived class — typically in PostInitializeComponents or BeginPlay:
if (UAIPerceptionStimuliSourceComponent* StimuliSource =
        FindComponentByClass<UAIPerceptionStimuliSourceComponent>())
{
    StimuliSource->RegisterForSense(UAISense_Sight::StaticClass());
}
// Or simpler: enable "Auto Register as Source" on the StimuliSourceComponent in BP.
```

Without `UAIPerceptionStimuliSourceComponent` (or `UAIPerceptionSystem::RegisterSource(Actor, SenseClass)`), the pawn is invisible to sight-only listeners.

### Sight Stimulus Location

`UAISenseConfig_Sight` queries `IGenericTeamAgentInterface` for affiliation and uses `UAIPerceptionComponent::GetActorsPerception` for stimulus delivery. Custom sight target locations (e.g. head bone instead of actor origin) are set via `UAISense_Sight::GetSightLocation()` overrides on the target pawn or via `UAIPerceptionStimuliSourceComponent::OnSenseReplied`.

---

## 7. Gameplay Tags for Sense Events

Sense events carry an `FName Tag` — projects should use `FGameplayTag`-derived names for consistency.

Recommended tag table (define in `Source/HostileWorld/HostileWorldGameplayTags.h`):

```cpp
namespace HostileWorldTags {
    static const FName AI_Noise_Movement     = TEXT("AI.Noise.Movement");
    static const FName AI_Noise_Gunshot      = TEXT("AI.Noise.Gunshot");
    static const FName AI_Noise_Vocalization = TEXT("AI.Noise.Vocalization");
    static const FName AI_Damage_Gunshot     = TEXT("AI.Damage.Gunshot");
    static const FName AI_Damage_Melee       = TEXT("AI.Damage.Melee");
    static const FName AI_Damage_Environment = TEXT("AI.Damage.Environment");
}
```

BT services discriminate stimulus type by comparing `FAIStimulus.Tag` against these values.

---

## 8. Common Pitfalls (Verified UE 5.7)

| Symptom | Cause | Fix |
|---------|-------|-----|
| Alien never reacts to gunfire | Implicit damage-sense expectation | Call `UAISense_Damage::ReportDamageEvent` after `UHealthComponent::ApplyDamage` in the combat pipeline. |
| Alien never reacts to movement noise | `Pawn->MakeNoise()` used in place of `UAISense_Hearing::ReportNoiseEvent` | Replace with the static helper from §4.2. Optionally remove `UPawnNoiseEmitterComponent` if present (legacy). |
| `AAIController::GetPerceptionComponent()` returns null | Perception component lives on character; `SetPerceptionComponent` never called | Add `SetPerceptionComponent(*PawnPerception)` to `OnPossess()` — see §2.2. |
| Sight events never fire for a pawn | Pawn not registered as sight target | Add `UAIPerceptionStimuliSourceComponent` and `RegisterForSense(UAISense_Sight::StaticClass())`. |
| `OnTargetPerceptionUpdated` fires twice per event | Listener bound in both controller and character `BeginPlay` | Bind in exactly one place — canonical is the controller. |
| Sense events delivered but `Stimulus.Type` won't match `UAISense_Hearing::StaticClass()` | Comparing `UClass*` against `FAISenseID` | Use `UAISense::GetSenseID<UAISense_Hearing>()` and compare `Stimulus.Type == HearingID`. |
| BT Service receives null `GetWorld()` during level teardown | World partition unloading between BT ticks and perception evaluation | Null-check `GetWorld()` in BT service `TickNode` before calling `GetSubsystem<UStealthSubsystem>()`. |
| `UPawnNoiseEmitterComponent` notifications fire but AI doesn't react | `UPawnNoiseEmitterComponent` does NOT integrate with `UAISense_Hearing` | Remove component. Use `UAISense_Hearing::ReportNoiseEvent` instead. |

---

## 9. Performance Notes

- `UAIPerceptionSystem` ticks at a configurable interval (default 0.5s for sight; on-demand for hearing/damage). Configure via `UAIPerceptionSystem::SetDominantSense` and per-sense `UpdateInterval`.
- Each `ReportNoiseEvent` iterates registered listeners and does an O(N) distance check. With ≤8 aliens and ≤10 noise events/sec, cost is negligible (<0.01ms/frame amortized).
- Sight traces use the channel set in `Project Settings > AI System > Default Sight Collision Channel`. Default is `ECC_Visibility`. For dedicated AI perception traces (avoiding interference with player line-of-sight), define a custom channel (see ADR-0007 — `EHostileCollision::AIPerception`).

---

## 10. Cross-References

| ADR / GDD | Topic |
|-----------|-------|
| `docs/architecture/adr-0010-movement-architecture.md` | `UHostileMovementComponent::EmitMovementNoise` — `UAISense_Hearing::ReportNoiseEvent` chokepoint for player movement noise. |
| `docs/architecture/adr-0012-alien-ai-system.md` | `AAlienAIController` perception component setup, BT Service consumption of `UAIPerceptionComponent::GetCurrentlyPerceivedActors`. |
| `docs/architecture/adr-0014-combat-system-architecture.md` | `UCombatComponent::NotifyAIOfDamage` — `UAISense_Damage::ReportDamageEvent` chokepoint for combat damage. |
| `docs/architecture/adr-0017-stealth-system-architecture.md` | `UStealthSubsystem` reads `IAlienPerceptionData` parameters separately; engine perception (this doc) governs default AI reaction, GDD-defined detection score (D_total) governs Stealth state machine. |
| `docs/registry/adr-subsystems.yaml` | `noise_emission_api`, `perception_without_setperception`, `damage_sense_implicit_fire` — registry pointers to enforced patterns. |
| `docs/engine-reference/unreal/modules/navigation.md` | Companion doc — pathing for AI controllers. |

---

## 11. Verification Status

| Claim | Verified Against |
|-------|------------------|
| `UAISense_Hearing::ReportNoiseEvent` signature | UE 5.7 `Engine/Source/Runtime/AIModule/Classes/Perception/AISense_Hearing.h` (static func, 6 params) |
| `UAISense_Damage::ReportDamageEvent` signature | UE 5.7 `Engine/Source/Runtime/AIModule/Classes/Perception/AISense_Damage.h` (static func, 7 params; two locations, no HitDirection) |
| `UAIPerceptionSystem::OnEvent(FAINoiseEvent)` overload | UE 5.7 `Engine/Source/Runtime/AIModule/Classes/Perception/AIPerceptionSystem.h` |
| `UAIPerceptionComponent` placement requires `SetPerceptionComponent` | UE 5.7 `Engine/Source/Runtime/AIModule/Classes/AIController.h` — `PerceptionComponent` is auto-wired only when `CreateDefaultSubobject` is called on the controller. |
| No `UAIPerceptionSystem::MakeNoise` exists | Confirmed by engine specialist review (ADR-0010, ADR-0012, ADR-0014 architecture-review cycles 2026-05-20 → 2026-05-26). |

Refresh this section if migrating to UE 5.8+ — the AIModule has undergone significant maintenance in past versions and the perception-system API surface should be re-verified against the engine headers at each major upgrade.
