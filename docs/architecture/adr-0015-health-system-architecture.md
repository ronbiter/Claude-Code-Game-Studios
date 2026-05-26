# ADR-0015: Health System Architecture

## Status
Proposed

## Date
2026-05-24

## Engine Compatibility

| Field | Value |
|-------|-------|
| **Engine** | Unreal Engine 5.7 |
| **Domain** | Core / Component Systems |
| **Knowledge Risk** | HIGH — UE 5.7 is post-LLM-cutoff |
| **References Consulted** | `docs/engine-reference/unreal/VERSION.md`; ADR-0010 (UHostileMovementComponent, dodge_event contract); ADR-0004 (per_actor_state, UHealthComponent placement) |
| **Post-Cutoff APIs Used** | `ACharacter::TakeDamage(float, FDamageEvent const&, AController*, AActor*)` override (stable UE4/5 contract — LOW risk); `UCharacterMovementComponent::ProcessLanded(const FHitResult&, float, int32)` override for pre-landing velocity capture (verify signature in 5.7 headers — MEDIUM risk); `FTimerHandle` (stable) |
| **Verification Required** | (1) Confirm `ProcessLanded(const FHitResult&, float remainingTime, int32 Iterations)` signature is unchanged in UE 5.7 `CharacterMovementComponent.h`; (2) Confirm `AHostileCharacter::TakeDamage` override compiles against parent signature in 5.7; (3) Confirm `UCharacterMovementComponent::MaxWalkSpeed` is not rate-limited in 5.7 (direct assignment must apply immediately — used for injury speed penalties) |

## ADR Dependencies

| Field | Value |
|-------|-------|
| **Depends On** | ADR-0001 (delegates — `DECLARE_DYNAMIC_MULTICAST_DELEGATE` pattern); ADR-0002 (GSM — `RequestStateTransition(PlayerDied)` is the only death notification path); ADR-0004 (per_actor_state — `UHealthComponent` placement as `UActorComponent` on `AHostileCharacter` is locked); ADR-0010 (dodge_event contract — `OnDodgeStarted(float IFrameDuration)` already registered as consumed by Health System; movement state for heal interruption) |
| **Enables** | HUD System ADR (consumes `OnHealthChanged` + `OnInjuryStateChanged` for health bar, vignette, damage direction indicator); Audio System ADR (consumes `OnHealthChanged` for breathing state changes); Animation System ADR (consumes `OnInjuryStateChanged` for injury locomotion anims + death montage trigger) |
| **Blocks** | Health implementation stories (damage pipeline, healing consumables, injury states cannot start until this ADR is Accepted) |
| **Ordering Note** | ADR-0010 must be Accepted first — `UHostileMovementComponent::SetInjurySpeedMultiplier()` is a new method this ADR defines on the CMC subclass; it cannot be implemented without ADR-0010's CMC subclass existing. |

## Context

### Problem Statement

The Health System GDD is fully specified — 100 HP pool, 4 injury states, 4 damage types, 3 healing consumables, death-to-GSM transition — but leaves architecture open: where does the damage pipeline live, how do injury-state mechanical penalties (walk speed −10/−20%, stamina regen −20/−40%) modify Movement/Character state without violating the `direct_stamina_write` forbidden pattern, how does the i-frame invulnerability window integrate with the registered `dodge_event` contract, and how does fall velocity reach the health component at landing.

### Constraints

- `UHealthComponent` is already registered in `per_actor_state` (ADR-0004) as a `UActorComponent` on `AHostileCharacter`. This placement is locked.
- `direct_stamina_write` forbidden (ADR-0010): stamina regen penalties from injury states must NOT write `AHostileCharacter`'s stamina float directly. Only `AHostileCharacter::ConsumeStamina(float)` and `RegenStamina(float DeltaTime)` are valid write paths.
- `dodge_event` contract (ADR-0010): Health System is already registered as a consumer of `OnDodgeStarted(float IFrameDuration)`. The i-frame implementation must use this contract, not a custom polling approach.
- Death must use `UHostileWorldGSM::RequestStateTransition(PlayerDied)` — no shortcut to `GameOver` state (ADR-0002).
- No passive regen (GDD Rule 1): Health System must never call any HP-increasing path except via explicit consumable use.
- Multiple damage sources in the same frame are processed sequentially — the pipeline is not batched.

### Requirements

- Must implement the 5-step damage pipeline: i-frame check → fall modifier → apply → death check → broadcast
- Must own all four injury states (Operational / Wounded / Critical / Near Death) and their thresholds
- Must apply injury speed penalties to `UHostileMovementComponent` without bypassing the CMC's walk-speed system
- Must apply injury stamina-regen penalties through `AHostileCharacter::RegenStamina()` without direct stamina writes
- Must implement the healing FSM for all three consumables (Field Dressing / Medkit / Stimshot) with interruption rules
- Must process fall damage using pre-landing velocity captured by `UHostileMovementComponent`
- Must integrate environmental and infection exposure DoT via per-call `ApplyDamage()` from zone actors (no internal tick)
- Must fire death notification to GSM at exactly 0 HP before any animation begins

## Decision

The Health System is implemented as a **single class**: `UHealthComponent : UActorComponent` on `AHostileCharacter`. No companion subsystem is needed — health is purely per-player with no cross-actor coordination state. (Unlike Combat, which coordinates across alien actors, health state has no cross-actor dependencies.)

### Layer — UHealthComponent : UActorComponent (per-actor, on AHostileCharacter)

Owns the complete health lifecycle: HP pool, damage pipeline, injury state machine, i-frame gating, healing FSM, fall damage processing, and death sequence initiation.

**Responsibilities:**

- HP pool: `int32 CurrentHP` (range 0–100). `FMath::Clamp` on every write. Never negative.
- Injury state machine: `EInjuryState` (Operational / Wounded / Critical / NearDeath / Dead). Transitions are immediate (no blend delay per GDD).
- Damage pipeline (5 steps, executed in `ApplyDamage(float, EDamageType)`):
  1. i-frame check: if `bIsInvulnerable == true`, return immediately — no HP change, no event, no VFX
  2. Fall modifier: if `EDamageType::Fall` AND player in Crouch state at landing frame → `FinalDamage = FMath::CeilToInt(BaseDamage × 0.5f)`
  3. Apply: `CurrentHP = FMath::Max(0, CurrentHP - FMath::CeilToInt(FinalDamage))`
  4. Death check: if `CurrentHP == 0` → call `InitiateDeathSequence()`
  5. Broadcast: fire `OnHealthChanged(PreviousHP, CurrentHP, DamageType)` and update `EInjuryState` if threshold crossed
- Fall damage formula: `FallDamage = FMath::Max(0, FMath::CeilToInt((ImpactSpeedZ - V_min) × K_fall))`
  where `V_min = 800.0f` cm/s, `K_fall = 0.15f`. At 1200 cm/s: ceil((1200−800)×0.15) = 60. At ≤800 cm/s: 0.
- i-frame gating: subscribes to `UHostileMovementComponent::OnDodgeStarted(float IFrameDuration)` in `BeginPlay()` via `AddDynamic()`. Sets `bIsInvulnerable = true`; clears via `FTimerHandle InvulnerabilityTimer` after `IFrameDuration` seconds.
- Healing FSM: manages active consumable, `FTimerHandle HealTimer`, and interrupt conditions per consumable tier (see Key Interfaces). On `HealTimer` completion: applies HP, clears state, removes item via Inventory System interface.
- Injury speed penalty: fires `OnInjuryStateChanged(EInjuryState)`. `UHostileMovementComponent::SetInjurySpeedMultiplier(float)` subscribes to this delegate and applies the multiplier to `MaxWalkSpeed`. This is the only legal modification path — never bypass the CMC.
- Injury stamina-regen penalty: `GetStaminaRegenMultiplier() → float` (1.0 / 0.8 / 0.6 per state). `AHostileCharacter::RegenStamina(float DeltaTime)` reads this multiplier from `HealthComp` and applies it: `RegenRate × GetStaminaRegenMultiplier() × DeltaTime`. No direct stamina write from health.
- Death sequence: `InitiateDeathSequence()` → (1) fire `OnInjuryStateChanged(Dead)` for animation montage + input lock, (2) call `GetGameInstance()->GetSubsystem<UHostileWorldGSM>()->RequestStateTransition(PlayerDied)`. GSM transition fires; death prompt appears. On restart: AHostileCharacter spawns with full HP (100) at checkpoint.

**Fall velocity capture**: `UHostileMovementComponent` (the CMC subclass) overrides `ProcessLanded(const FHitResult& Hit, float RemainingTime, int32 Iterations)`. Before calling `Super::ProcessLanded()`, it stores `LandingImpactSpeed = FMath::Abs(Velocity.Z)`. `AHostileCharacter::Landed(const FHitResult& Hit)` (called by CMC during `ProcessLanded`) reads `MovComp->LandingImpactSpeed` and calls `HealthComp->ProcessFallDamage(LandingImpactSpeed, bIsCrouching)`. The capture-before-super pattern ensures velocity is not zeroed by the landing physics before we read it.

**DoT sources**: Environmental and infection exposure damage is not ticked by `UHealthComponent`. Zone actors (`AHazardZoneVolume`, `AInfectionBiomassActor`) maintain their own `FTimerHandle` at their respective rates (5 HP/s environmental, 3 HP/s infection) and call `AHostileCharacter::TakeDamage(DamageAmount, FDamageEvent, nullptr, this)` each tick. The pipeline handles each call independently.

### Architecture Diagram

```
AHostileCharacter
  └── UHealthComponent
        ├── ApplyDamage(float Amount, EDamageType)
        │     ├── [1] bIsInvulnerable check         ← FTimerHandle (set by OnDodgeStarted)
        │     ├── [2] Fall modifier (Crouch × 0.5)
        │     ├── [3] CurrentHP = Max(0, HP - ceil(Amount))
        │     ├── [4] InitiateDeathSequence()        → UHostileWorldGSM::RequestStateTransition(PlayerDied)
        │     └── [5] OnHealthChanged.Broadcast()    → HUD, Audio, Animation
        ├── ProcessFallDamage(float ImpactSpeedZ, bool bCrouching)
        │     └── FallDamage = Max(0, ceil((speed - 800) × 0.15))
        ├── StartHealing(EConsumableType) / CancelHealing()
        │     └── FTimerHandle HealTimer → CompleteHealing() → OnHealthChanged
        ├── OnInjuryStateChanged (DECLARE_DYNAMIC_MULTICAST_DELEGATE)
        │     ├── UHostileMovementComponent::SetInjurySpeedMultiplier(float)
        │     └── Animation System: locomotion blend, death montage
        └── GetStaminaRegenMultiplier() → float
              └── AHostileCharacter::RegenStamina() reads this each tick

AHostileCharacter
  ├── virtual float TakeDamage(...) override
  │     └── Converts FDamageEvent subclass → EDamageType; calls HealthComp->ApplyDamage()
  └── RegenStamina(float DeltaTime)
        └── Rate = BaseRegenRate × HealthComp->GetStaminaRegenMultiplier()

UHostileMovementComponent (CMC subclass — ADR-0010)
  ├── ProcessLanded() override
  │     └── LandingImpactSpeed = Abs(Velocity.Z) before Super
  ├── SetInjurySpeedMultiplier(float Multiplier)
  │     └── MaxWalkSpeed = BaseWalkSpeed × Multiplier
  └── OnDodgeStarted delegate → UHealthComponent::OnDodgeStarted_Handler()

Zone actors (AHazardZoneVolume, AInfectionBiomassActor)
  └── FTimerHandle at zone rate → AHostileCharacter::TakeDamage(Amount, FDamageEvent, ...)

Event subscriptions (AddDynamic in UHealthComponent::BeginPlay()):
  UHostileMovementComponent::OnDodgeStarted       → UHealthComponent::OnDodgeStarted_Handler()
  UHostileMovementComponent::OnMovementStateChanged → UHealthComponent::OnMovementStateChanged_Handler()
    (used to interrupt Field Dressing if sprint/dodge/jump; interrupt Medkit if not Idle/Crouch)
```

### Key Interfaces

```cpp
// ── Enums ─────────────────────────────────────────────────────────────────────

UENUM(BlueprintType)
enum class EDamageType : uint8
{
    Physical        UMETA(DisplayName = "Physical"),        // alien melee/projectile, player weapon
    Fall            UMETA(DisplayName = "Fall"),            // landing from height
    Environmental   UMETA(DisplayName = "Environmental"),   // fire, electric, toxic, collapse
    InfectionExposure UMETA(DisplayName = "InfectionExposure") // biomass contact
};

UENUM(BlueprintType)
enum class EInjuryState : uint8
{
    Operational  UMETA(DisplayName = "Operational"),   // 100–51 HP
    Wounded      UMETA(DisplayName = "Wounded"),       // 50–26 HP
    Critical     UMETA(DisplayName = "Critical"),      // 25–11 HP
    NearDeath    UMETA(DisplayName = "NearDeath"),     // 10–1 HP
    Dead         UMETA(DisplayName = "Dead")           // 0 HP
};

// ── UHealthComponent ──────────────────────────────────────────────────────────

DECLARE_DYNAMIC_MULTICAST_DELEGATE_ThreeParams(FOnHealthChanged, int32, PreviousHP, int32, NewHP, EDamageType, DamageType);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnInjuryStateChanged, EInjuryState, NewState);

class UHealthComponent : public UActorComponent
{
public:
    // Damage entry points
    void ApplyDamage(float Amount, EDamageType Type);
    void ProcessFallDamage(float ImpactSpeedZ, bool bPlayerIsCrouching);

    // Healing entry points (called by AHostileCharacter input handler → IA_UseItem)
    bool StartHealing(EConsumableType ConsumableType);   // returns false if: not alive, already healing, item not in inventory
    void CancelHealing();                                 // called on movement interrupt or incoming damage (non-Stimshot)

    // State queries (read-only externally)
    int32 GetCurrentHP() const;
    int32 GetMaxHP() const;        // always 100 — const, never modified
    EInjuryState GetInjuryState() const;
    float GetStaminaRegenMultiplier() const;  // 1.0 / 0.8 / 0.6 per injury state; read by AHostileCharacter::RegenStamina()
    bool IsAlive() const;
    bool IsInvulnerable() const;

    // Delegates (consumers: HUD, Audio, Animation)
    UPROPERTY(BlueprintAssignable)
    FOnHealthChanged OnHealthChanged;

    UPROPERTY(BlueprintAssignable)
    FOnInjuryStateChanged OnInjuryStateChanged;

private:
    // i-frame state
    bool bIsInvulnerable = false;
    FTimerHandle InvulnerabilityTimer;

    // Healing FSM
    EConsumableType ActiveConsumable;
    FTimerHandle HealTimer;
    bool bHealingInProgress = false;

    // Internal
    int32 CurrentHP = 100;
    EInjuryState CurrentInjuryState = EInjuryState::Operational;

    void InitiateDeathSequence();
    void CompleteHealing();                      // called by HealTimer completion
    EInjuryState CalculateInjuryState(int32 HP) const;
    void ApplyInjuryStateChange(EInjuryState NewState);

    // Movement event handlers (bound in BeginPlay)
    UFUNCTION()
    void OnDodgeStarted_Handler(float IFrameDuration);
    UFUNCTION()
    void OnMovementStateChanged_Handler(EHostileMovementState NewState);
};

// ── Healing consumable constants ───────────────────────────────────────────────
// Field Dressing:  +25 HP, 2.0s, interrupted by sprint/dodge/jump/damage
// Medkit:          +60 HP, 4.0s, requires Idle/Crouch, interrupted by any movement/damage
// Stimshot:        +40 HP, 0.8s, never interrupted by damage; usable while moving; 1.5s screen blur post-use

// ── AHostileCharacter (bridge) ─────────────────────────────────────────────────

virtual float TakeDamage(float DamageAmount, FDamageEvent const& DamageEvent,
                          AController* EventInstigator, AActor* DamageCauser) override;
    // Extracts EDamageType from DamageEvent subclass tag or instigator type.
    // Delegates to HealthComp->ApplyDamage(DamageAmount, ResolvedType).
    // Returns DamageAmount for UE5 contract compatibility.

void RegenStamina(float DeltaTime);
    // Existing method — reads HealthComp->GetStaminaRegenMultiplier() and applies:
    // CurrentStamina += BaseRegenRate × GetStaminaRegenMultiplier() × DeltaTime

// ── UHostileMovementComponent additions (ADR-0010 CMC subclass) ──────────────

float LandingImpactSpeed = 0.0f;    // stored by ProcessLanded() override before Super call

virtual void ProcessLanded(const FHitResult& Hit, float RemainingTime, int32 Iterations) override;
    // 1. LandingImpactSpeed = FMath::Abs(Velocity.Z)
    // 2. Super::ProcessLanded(Hit, RemainingTime, Iterations)

void SetInjurySpeedMultiplier(float Multiplier);
    // MaxWalkSpeed = BaseMaxWalkSpeed × FMath::Clamp(Multiplier, 0.5f, 1.0f)
    // Called by UHealthComponent on EInjuryState transitions.
    // BaseMaxWalkSpeed stored at construction from CDO config (600 cm/s default).

// ── Injury state multipliers ───────────────────────────────────────────────────
// Operational: SpeedMult=1.0, StaminaRegenMult=1.0
// Wounded:     SpeedMult=1.0, StaminaRegenMult=1.0   (no mechanical penalty)
// Critical:    SpeedMult=0.9, StaminaRegenMult=0.8   (walk 600→540, regen 20→16/s)
// NearDeath:   SpeedMult=0.8, StaminaRegenMult=0.6   (walk 600→480, regen 20→12/s)

// ── Fall damage formula ────────────────────────────────────────────────────────
// V_min    = 800.0f cm/s  (safe landing threshold)
// K_fall   = 0.15f        (damage per cm/s above threshold)
// BaseFallDamage = FMath::Max(0, FMath::CeilToInt((ImpactSpeedZ - V_min) * K_fall))
// FinalFallDamage = bPlayerIsCrouching ? FMath::CeilToInt(BaseFallDamage * 0.5f) : BaseFallDamage
// Examples: 700 cm/s → 0; 1200 cm/s → 60; 1200 cm/s crouched → 30
```

## Alternatives Considered

### Alternative A: AHostileCharacter owns HP directly (no UHealthComponent)
- **Description**: `CurrentHP` and all health logic live on `AHostileCharacter` directly. No separate component.
- **Pros**: Fewer class boundaries; no component lookup call site.
- **Cons**: Directly contradicts ADR-0004 `per_actor_state` — `UHealthComponent` is already registered as the owner. AHostileCharacter would become a God Class combining locomotion, stamina, and health concerns. Breaks testability — cannot unit-test health logic without the full character.
- **Rejection Reason**: Registry constraint (ADR-0004). Per-actor behaviour that has distinct state, lifecycle, and interfaces belongs on a component.

### Alternative B: UHealthComponent + UHealthSubsystem (companion subsystem)
- **Description**: Mirror the Combat two-class split — `UHealthComponent` owns HP and healing FSM; `UHealthSubsystem` owns death routing to GSM and injury-state broadcasts.
- **Pros**: Parallels Combat architecture; GSM access is cleaner through a subsystem.
- **Cons**: Health has no cross-actor coordination state — unlike `UCombatSubsystem` (which tracks a set of alien actors and the disengagement timer), there is nothing `UHealthSubsystem` needs to coordinate across actors. A companion subsystem would be empty overhead. GSM access is equally simple from the component via `GetGameInstance()->GetSubsystem<UHostileWorldGSM>()`.
- **Rejection Reason**: No cross-actor coordination requirement. One class is sufficient. The split pattern from Combat exists to solve cross-actor coordination, not as a universal template.

### Alternative C: Healing handled by Inventory System
- **Description**: `UInventorySubsystem` owns the consumable use logic, including healing application.
- **Pros**: Keeps all item-use logic in one place.
- **Cons**: Splits the healing FSM across two systems — Inventory would need to know health thresholds, interruption rules, and call back into the Health System. Healing interruption (movement-dependent) couples Inventory to Movement state, which has no other reason to interact. Health FSM is health-domain logic; Inventory's responsibility is item custody and expenditure, not healing mechanics.
- **Rejection Reason**: Healing mechanics are health-domain logic. Inventory System is called only to deduct the consumed item (`ConsumeItem(ConsumableType)`) after the healing completes or is cancelled without restoration (per GDD Rule 4 — item wasted on interrupt).

## Consequences

### Positive
- Single class owns all health logic — damage pipeline, injury states, healing FSM, death routing. No cross-system seam to debug when a health transition goes wrong.
- `GetStaminaRegenMultiplier()` is a pure read — `AHostileCharacter::RegenStamina()` already owns the write path. Adding this read requires zero changes to the `direct_stamina_write` forbidden pattern enforcement.
- `SetInjurySpeedMultiplier()` on the CMC subclass is the correct UE5 pattern — modifies `MaxWalkSpeed` which CMC respects immediately without frame delay.
- `ProcessLanded()` override captures velocity before `Super` zeros it — the only correct way to get impact speed in UE5; no `Tick` polling needed.
- Environmental/infection DoT is caller-pushed, not Health-polled — zone actors control their own tick rate; adding new hazard types requires no changes to `UHealthComponent`.

### Negative
- `UHostileMovementComponent` gains two new responsibilities: `LandingImpactSpeed` storage and `SetInjurySpeedMultiplier()`. Developers must know to look in the CMC for speed penalty application, not just in `UHealthComponent`.
- `AHostileCharacter::RegenStamina()` has a hidden dependency on `HealthComponent` — if the component is invalid (e.g., during destruction), the multiplier lookup must guard with `IsValid(HealthComp)`.

### Risks
- **Risk**: `ProcessLanded()` signature or velocity availability changes in UE 5.7.
  **Mitigation**: Verify `CharacterMovementComponent.h` signature before implementing; fallback — cache `FMath::Abs(Velocity.Z)` in `UHostileMovementComponent::PhysFalling()` last frame and read in `Landed()`.
- **Risk**: `SetInjurySpeedMultiplier()` conflicts with other `MaxWalkSpeed` modifiers (sprint speed from ADR-0010, cover stance speed).
  **Mitigation**: `UHostileMovementComponent` resolves all `MaxWalkSpeed` modifiers through a single `RecalculateWalkSpeed()` method called by any setter. Inputs: `BaseWalkSpeed × InjuryMultiplier × CoverStanceMultiplier`. Sprint uses `MaxSprintSpeed` (separate property) and is unaffected.
- **Risk**: Healing `FTimerHandle` fires after the world is torn down during level transition, calling into a destroyed `UInventorySubsystem`.
  **Mitigation**: `UHealthComponent::EndPlay()` clears `HealTimer` and `InvulnerabilityTimer` before teardown.
- **Risk**: Zone actor calls `TakeDamage()` in the same frame as death from another source — double-death transition to GSM.
  **Mitigation**: `InitiateDeathSequence()` sets `bIsAlive = false` as its first action. `ApplyDamage()` returns early if `!bIsAlive`. GSM transition is guarded by `IsStateActive(Playing)` in `RequestStateTransition()` (ADR-0002).

## GDD Requirements Addressed

| GDD System | Requirement | How This ADR Addresses It |
|------------|-------------|--------------------------|
| health-system.md | Rule 1 — 100 HP pool, int32, fixed max, no passive regen | `UHealthComponent::CurrentHP` (int32, clamped 0–100). No regen path exists — only `CompleteHealing()` adds HP, gated by consumable use. |
| health-system.md | Rule 2 — 4 damage types with source-agnostic pipeline | `EDamageType` enum (Physical, Fall, Environmental, InfectionExposure). `ApplyDamage()` processes all types through identical pipeline steps. |
| health-system.md | Rule 3 — 5-step damage pipeline | `UHealthComponent::ApplyDamage()` implements all 5 steps in order: i-frame → fall modifier → apply → death check → broadcast. |
| health-system.md | Rule 3 — i-frame invulnerability during dodge | `OnDodgeStarted_Handler(IFrameDuration)` sets `bIsInvulnerable = true` + `FTimerHandle`. Uses the registered `dodge_event` contract from ADR-0010. |
| health-system.md | Rule 3 — fall damage modifier (Crouch × 0.5) | `ProcessFallDamage(ImpactSpeedZ, bCrouching)` applies `ceil(Base × 0.5)` if crouching. Movement crouch state read from `UHostileMovementComponent::GetCurrentMovementState()`. |
| health-system.md | Rule 4 — 3 healing consumables with interruption rules | `StartHealing(EConsumableType)` / `CancelHealing()` with `FTimerHandle HealTimer`. Field Dressing interrupted by sprint/dodge/jump/damage; Medkit interrupted by any movement/damage; Stimshot never interrupted by damage. |
| health-system.md | Rule 4 — item wasted on cancelled heal | `CancelHealing()` calls `UInventorySubsystem::ConsumeItem()` for non-Stimshot cancels before 100% completion — item is spent regardless of whether HP was restored. |
| health-system.md | Rule 5 — death sequence: montage → ragdoll → GSM | `InitiateDeathSequence()` fires `OnInjuryStateChanged(Dead)` (Animation System plays montage → ragdoll blend per ADR-0007/0011) then `UHostileWorldGSM::RequestStateTransition(PlayerDied)`. |
| health-system.md | Rule 6 — 4 injury states with mechanical penalties | `EInjuryState` machine in `UHealthComponent`. Speed penalties via `SetInjurySpeedMultiplier()` on CMC. Stamina regen penalties via `GetStaminaRegenMultiplier()` read in `AHostileCharacter::RegenStamina()`. Dodge recovery penalty (+0.1s at NearDeath) delivered via `OnInjuryStateChanged` → `UHostileMovementComponent::SetDodgeRecoveryPenalty(float)`. |
| health-system.md | States table — immediate transitions, no blend | `ApplyInjuryStateChange()` fires `OnInjuryStateChanged` synchronously with no delay. `SetInjurySpeedMultiplier()` applies `MaxWalkSpeed` change on the same frame. |
| health-system.md | Interactions — Physics: fall damage via `OnLanded(velocity)` | `UHostileMovementComponent::ProcessLanded()` captures `LandingImpactSpeed`; `AHostileCharacter::Landed()` reads it and calls `HealthComp->ProcessFallDamage()`. |
| health-system.md | Interactions — Movement: dodge i-frame events | `OnDodgeStarted` delegate consumer per the registered ADR-0010 `dodge_event` contract. |
| health-system.md | Interactions — GSM: player death event | `RequestStateTransition(PlayerDied)` via `UHostileWorldGSM` per ADR-0002. |
| health-system.md | Interactions — HUD: HP value, injury state, damage type | `OnHealthChanged(PreviousHP, NewHP, DamageType)` delegate — HUD System subscribes. |
| health-system.md | Interactions — Animation: injury state, death montage | `OnInjuryStateChanged(EInjuryState)` delegate — Animation System subscribes for locomotion blends and death montage trigger. |
| health-system.md | Rule 1 — infection immunity is narrative, not mechanical | Player CAN receive `EDamageType::InfectionExposure` damage (HP loss from biomass contact). Player CANNOT be infected by the alien virus (that is an Infection Spread System concept, not a health mechanic). Health System treats it as a standard DoT type — no special gating. |
| movement-system.md | Dodge i-frame shared with Health System | `dodge_event` contract already registered with Health System as consumer (ADR-0010 `adr-subsystems.yaml`). This ADR implements the consumer side. |
| combat-system.md | `TakeDamage` interface confirmed by Combat ADR | `AHostileCharacter::TakeDamage()` is the UE5-standard override. `UCombatComponent` calls it via the engine's `ApplyDamage()` utility or direct actor call — both routes reach the same override. |

## Performance Implications
- **CPU (damage pipeline)**: `ApplyDamage()` is O(1) — 5 inline checks, one int32 clamp, two delegate broadcasts. < 0.01ms per call.
- **CPU (healing FSM)**: `FTimerHandle` fires once on completion — no per-frame cost during healing. Interrupt check fires on `OnMovementStateChanged` events (infrequent). < 0.01ms.
- **CPU (injury state change)**: `SetInjurySpeedMultiplier()` writes one float to CMC on state transition (infrequent). Negligible.
- **CPU (stamina regen)**: `GetStaminaRegenMultiplier()` is a pure const read — one float multiply added to existing `RegenStamina()` call per tick. Negligible.
- **Memory**: `UHealthComponent` per character: `CurrentHP` (4B), `EInjuryState` (1B), `bIsInvulnerable` (1B), two `FTimerHandle`s (8B each), one `bool` (1B), enum state for healing (1B). < 32 bytes per component instance.
- **VFX budget**: Health VFX (blood vignette, screen distortion) budgeted at < 0.3ms per frame (GDD performance budget). Enforced at rendering implementation, not ADR level.

## Migration Plan
No existing health code to migrate. `UHealthComponent` and `EDamageType` are new types. `AHostileCharacter::TakeDamage()` is a new override — no existing implementation to conflict with. First implementation follows the key interfaces defined above directly.

## Validation Criteria

- Player at 100 HP takes 30 Physical damage → `CurrentHP = 70`, `OnHealthChanged(100, 70, Physical)` fires, `EInjuryState = Operational`.
- Player initiates dodge → `bIsInvulnerable = true`. While invulnerable: `ApplyDamage(50, Physical)` → HP unchanged, no event fires.
- Player at 100 HP falls at 700 cm/s → `ProcessFallDamage(700, false)` → `FallDamage = max(0, ceil((700−800)×0.15)) = 0` → HP unchanged.
- Player at 100 HP falls at 1200 cm/s → `FallDamage = ceil((1200−800)×0.15) = 60` → HP = 40; `OnHealthChanged(100, 40, Fall)` fires.
- Player at 100 HP falls at 1200 cm/s while crouching → `FallDamage = ceil(60×0.5) = 30` → HP = 70.
- Player at 51 HP takes 1 damage → HP = 50, `EInjuryState` transitions to Wounded, `OnInjuryStateChanged(Wounded)` fires, `SetInjurySpeedMultiplier(1.0)` (no speed penalty), `GetStaminaRegenMultiplier() = 1.0`.
- Player at 26 HP takes 1 damage → HP = 25, transitions to Critical, `SetInjurySpeedMultiplier(0.9)` → `MaxWalkSpeed = 540`, `GetStaminaRegenMultiplier() = 0.8` → `RegenStamina` applies 16/s.
- Player at 11 HP takes 1 damage → HP = 10, transitions to NearDeath, `SetInjurySpeedMultiplier(0.8)` → `MaxWalkSpeed = 480`, `GetStaminaRegenMultiplier() = 0.6` → 12/s, `SetDodgeRecoveryPenalty(0.1f)`.
- Player at 1 HP takes 1 damage → `InitiateDeathSequence()` fires: `OnInjuryStateChanged(Dead)` fires first, then `UHostileWorldGSM::RequestStateTransition(PlayerDied)`.
- Zone actor calls `TakeDamage()` on same frame as death from another source → second call early-exits (`!bIsAlive` check), GSM receives exactly one `PlayerDied` transition.
- Player at 40 HP uses Field Dressing, waits 2.0s without interruption → HP = 65; item consumed via `UInventorySubsystem::ConsumeItem()`.
- Player begins Field Dressing, sprints at 1.5s → `CancelHealing()` fires; HP unchanged; item consumed (wasted).
- Player at 80 HP uses Medkit (+60) → HP = 100 (capped; not 140).
- Player at 50 HP uses Stimshot, takes 20 damage during 0.8s → Stimshot NOT cancelled; HP after completion = max(0, 50−20+40) = 70.

## Related Decisions
- [ADR-0001](adr-0001-cross-system-communication.md) — `DECLARE_DYNAMIC_MULTICAST_DELEGATE` pattern
- [ADR-0002](adr-0002-game-state-machine-implementation.md) — `RequestStateTransition(PlayerDied)` death routing
- [ADR-0004](adr-0004-subsystem-module-architecture.md) — `UHealthComponent` as `per_actor_state`, `UActorComponent` placement
- [ADR-0010](adr-0010-movement-architecture.md) — `dodge_event` contract, `OnMovementStateChanged`, `UHostileMovementComponent` CMC subclass
- [ADR-0014](adr-0014-combat-system-architecture.md) — `TakeDamage` caller from `UCombatComponent`; confirms `EDamageType::Physical` as the combat damage channel
- [design/gdd/health-system.md](../../design/gdd/health-system.md) — full mechanical specification
