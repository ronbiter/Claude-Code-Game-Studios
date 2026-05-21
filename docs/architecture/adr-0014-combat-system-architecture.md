# ADR-0014: Combat System Architecture

## Status
Proposed

## Date
2026-05-21

## Engine Compatibility

| Field | Value |
|-------|-------|
| **Engine** | Unreal Engine 5.7 |
| **Domain** | Core Gameplay / Component Systems / AI Perception |
| **Knowledge Risk** | HIGH — UE 5.7 is post-LLM-cutoff |
| **References Consulted** | `docs/engine-reference/unreal/VERSION.md`, `docs/engine-reference/unreal/modules/input.md`, ADR-0010 (noise API), ADR-0012 (damage sense API) |
| **Post-Cutoff APIs Used** | `UAISense_Hearing::ReportNoiseEvent`, `UAISense_Damage::ReportDamageEvent` — correct APIs per engine specialist (2026-05-21); no ai-perception engine-reference doc exists; verify against UE 5.7 headers before implementing |
| **Verification Required** | `UAIPerceptionSystem::ReportDamageEvent()` fires correctly after `TakeDamage()` on alien; `UAIPerceptionSystem::MakeNoise()` radius matches GDD noise values; `SweepMultiByChannel` + dot-product melee cone produces correct 60° arc at 150cm |

## ADR Dependencies

| Field | Value |
|-------|-------|
| **Depends On** | ADR-0001 (communication patterns — delegates, GameplayMessageSubsystem); ADR-0003 (Enhanced Input — IMC_Combat AddMappingContext/RemoveMappingContext); ADR-0004 (per_actor_state: UCombatComponent already registered; subsystem tiers); ADR-0010 (dodge event contract, stamina API, noise emission API); ADR-0012 (alien death event contract, damage sense forbidden pattern, UAlienSquadSubsystem) |
| **Enables** | HUD System ADR (consumes ECombatState and OnCombatEngaged/Disengaged delegates); Audio System ADR (consumes OnCombatEngaged/Disengaged for music transitions); Health System ADR (TakeDamage interface confirmed here) |
| **Blocks** | Combat epic (weapon fire, hit detection, reload, melee stories cannot start until this ADR is Accepted) |
| **Ordering Note** | UCombatSubsystem queries UAlienSquadSubsystem — ADR-0012 must be Accepted first. IMC_Combat lifecycle depends on UEnhancedInputLocalPlayerSubsystem confirmed by ADR-0003. |

## Context

### Problem Statement

The Combat System GDD defines a fully specified combat loop (weapon classes, hit detection, damage formulas, ammo management, state machine, melee, panic, backup calls) but leaves architecture open: where does combat state live, who owns the ECombatState machine, how does weapon fire report to alien AI perception, and how does IMC_Combat get pushed/popped without coupling Combat to Player Controller internals?

### Constraints

- `UCombatComponent` is already registered in the subsystem registry as a per-actor component (ADR-0004). This placement is locked.
- IMC_Combat push/pop must delegate to `AHostileWorldPlayerController::PushCombatIMC()` / `PopCombatIMC()` — Player Controller owns the `LocalPlayer` reference (GDD States and Transitions, canonical rule).
- Weapon noise must use `UAIPerceptionSystem::MakeNoise()` (same API as ADR-0010 movement noise — consistent pattern).
- Every damage application to an alien MUST call `UAIPerceptionSystem::ReportDamageEvent()` explicitly (ADR-0012 forbidden pattern `damage_sense_implicit_fire`).
- Melee stamina deduction MUST call `AHostileCharacter::ConsumeStamina(float)` — no direct stamina write (ADR-0010 forbidden pattern `direct_stamina_write`).
- No per-frame polling of alien/stealth state in Tick() (ADR-0001 forbidden pattern `polling_state_in_tick`).
- GDD specifies combat state resets on zone transition (scene streaming edge case) — the combat coordinator must be a `UWorldSubsystem` so it resets on level transition.

### Requirements

- Must own ECombatState (NonCombat / CombatEntry / ActiveCombat / Disengaging / Disengaged) and drive all transitions
- Must execute hitscan hit detection (player weapons) and melee cone checks independently from the alien projectile pipeline (alien attacks processed via TakeDamage on player)
- Must implement Formula 1 (damage per hit) with all five multipliers
- Must implement Formula 2 (spread accumulation) with ring-buffer shot tracking
- Must implement Formula 3 (disengagement timer) requiring alive-alien count
- Must implement Formula 4 (panic spread modifier) using HP and proximity inputs
- Must integrate with dodge i-frame invulnerability window (subscribe to ADR-0010 OnDodgeStarted event)
- Must report weapon fire noise to alien AI perception system
- Must report damage events to alien AI perception system after each hit
- Must push/pop IMC_Combat via Player Controller delegation

## Decision

The Combat System is implemented as two cooperating classes:

### Layer 1 — UCombatComponent : UActorComponent (per-actor, on AHostileCharacter)

Owns all per-player combat mechanics: weapon selection, hit detection, spread state, panic calculation, reload state machine, melee execution, and ammo interface. Fires events upward to UCombatSubsystem for state-machine decisions.

**Responsibilities:**
- Weapon state: current weapon pointer, spread ring buffer, reload FSM, jam state, melee consecutive-hit counter (TMap)
- Hit detection: hitscan trace from camera center with spread-adjusted direction; melee sphere sweep + dot-product filter
- Damage calculation: Formula 1 (D_hit = ceil(D_base × M_loc × M_dist × M_condition × M_armor))
- AI perception reporting: MakeNoise() for weapon fire; ReportDamageEvent() after each alien hit
- Stamina gate for melee: calls `CanMelee()` → `AHostileCharacter::ConsumeStamina(10)`
- Reload FSM: pre-deducts reserve on start; partial-fill on cancel; shotgun per-shell counting
- Spread state: `TArray<double> ShotTimestamps` ring buffer (max 16); N_consecutive = entries within trailing 1.0s window
- Panic state: queries player HP and `UCombatSubsystem::GetNearestAlienDistance()` — no tick poll; recalculated on fire
- Delegates to UCombatSubsystem: `NotifyCombatTrigger()`, `NotifyWeaponFired(WeaponType)`, `NotifyAlienHit(AlienActor, HitResult)`

### Layer 2 — UCombatSubsystem : UWorldSubsystem (world-tier, one per level)

Owns the ECombatState machine, active alien set, disengagement timer, and IMC_Combat lifecycle. Coordinates cross-actor combat state. Resets on level transition (UWorldSubsystem lifecycle).

**Responsibilities:**
- ECombatState machine and all transitions (see States and Transitions table in GDD)
- Active combat alien set: `TSet<TWeakObjectPtr<AAlienCharacter>> ActiveCombatAliens`
- Disengagement timer: `FTimerHandle DisengageTimer`; Formula 3 on each tick evaluation
- IMC_Combat push/pop: calls `PC->PushCombatIMC()` and `PC->PopCombatIMC()` — PC is the API bridge
- `IsPlayerUnderThreat()`: returns true when detection ≥ 75 (queries UAlienSquadSubsystem); used by Investigation/Quest systems for narrative-defer gate
- Backup call receipt: `OnBackupCalled(AlienID, Location)` — updates threat indicator data for HUD
- Subscribes to `OnAlienKilled` (ADR-0012) to update ActiveCombatAliens set and re-evaluate disengagement
- Subscribes to `OnDodgeStarted` (ADR-0010) — not blocking combat but available for future combo windows

### Architecture Diagram

```
AHostileCharacter
  └── UCombatComponent
        ├── FireWeapon()                    → hitscan trace → Formula 1
        │     ├── UAIPerceptionSystem::MakeNoise()          (weapon noise → alien hearing)
        │     └── UAIPerceptionSystem::ReportDamageEvent()  (damage sense → alien AI)
        ├── MeleeAttack()                   → SweepMultiByChannel + dot filter
        │     └── AHostileCharacter::ConsumeStamina(10)
        ├── Reload()                        → reserve pre-deduct → FSM
        ├── GetCurrentSpread()              → Formula 2 (ring buffer + panic)
        └── NotifyCombatTrigger()
              ↓
UCombatSubsystem (UWorldSubsystem)
  ├── ECombatState  (NonCombat / CombatEntry / ActiveCombat / Disengaging / Disengaged)
  ├── TSet<AAlienCharacter*> ActiveCombatAliens
  ├── FTimerHandle DisengageTimer           → Formula 3
  ├── OnCombatEngaged  (DECLARE_DYNAMIC_MULTICAST_DELEGATE)
  ├── OnCombatDisengaged (DECLARE_DYNAMIC_MULTICAST_DELEGATE)
  └── PC->PushCombatIMC() / PopCombatIMC()
        ↓
AHostileWorldPlayerController
  └── UEnhancedInputLocalPlayerSubsystem::AddMappingContext(IMC_Combat)
                                           RemoveMappingContext(IMC_Combat)

Event subscriptions (AddDynamic in Initialize()):
  AAlienCharacter::OnAlienKilled       → UCombatSubsystem::OnAlienKilled_Handler()
  UHostileMovementComponent::OnDodgeStarted → UCombatComponent::OnDodgeStarted_Handler()
```

### Key Interfaces

```cpp
// ── UCombatSubsystem ──────────────────────────────────────────────────────────

DECLARE_DYNAMIC_MULTICAST_DELEGATE(FOnCombatEngaged);
DECLARE_DYNAMIC_MULTICAST_DELEGATE(FOnCombatDisengaged);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FOnBackupCalled, int32, AlienID, FVector, Location);

class UCombatSubsystem : public UWorldSubsystem
{
public:
    // State queries
    ECombatState GetCombatState() const;
    bool IsPlayerUnderThreat() const;          // detection ≥75; consumed by Investigation/Quest
    float GetNearestAlienDistance() const;     // used by UCombatComponent panic calc

    // Combat triggers (called by UCombatComponent and Stealth System events)
    void NotifyCombatTrigger(ECombatTriggerSource Source);   // Source: DetectionFull, PlayerAttack, PatrolEngage
    void NotifyAlienEntersCombat(AAlienCharacter* Alien);
    void NotifyAlienLOSLost(int32 AlienID);
    void NotifyAlienLOSRegained(int32 AlienID);
    void NotifyBackupCalled(int32 AlienID, FVector Location);

    // Delegates (consumers: HUD, Audio, Stealth, Investigation)
    UPROPERTY(BlueprintAssignable)
    FOnCombatEngaged OnCombatEngaged;

    UPROPERTY(BlueprintAssignable)
    FOnCombatDisengaged OnCombatDisengaged;

    UPROPERTY(BlueprintAssignable)
    FOnBackupCalled OnBackupCalled;
};

// ── UCombatComponent ──────────────────────────────────────────────────────────

class UCombatComponent : public UActorComponent
{
public:
    // Player input handlers (bound via UCombatSubsystem or AHostileCharacter SetupPlayerInputComponent)
    void FireWeapon();
    void StartReload();
    void CancelReload();
    void MeleeAttack();

    // State queries
    float GetCurrentSpread() const;            // Formula 2
    float GetPanicModifier() const;            // Formula 4
    ECombatComponentState GetReloadState() const;
    bool CanMelee() const;                     // stamina ≥ 10 AND not sprinting AND not falling

    // Melee hit-counter management (per GDD Rule 6)
    // TMap<int32, int32> MeleeHitCounterPerAlien — resets on target switch; resets after 3.0s
};

// ── AHostileWorldPlayerController (bridge methods, not owners) ────────────────

void AHostileWorldPlayerController::PushCombatIMC();
    // Calls UEnhancedInputLocalPlayerSubsystem::AddMappingContext(IMC_Combat, Priority=1)

void AHostileWorldPlayerController::PopCombatIMC();
    // Calls UEnhancedInputLocalPlayerSubsystem::RemoveMappingContext(IMC_Combat)

// ── Noise emission (per weapon fire, in UCombatComponent::FireWeapon()) ───────

UAIPerceptionSystem::MakeNoise(
    Instigator,
    WeaponNoiseLoudness,   // Pistol=0.4, Shotgun=0.6, Rifle=1.0 (scaled to GDD noise radii)
    PlayerController,
    MuzzleLocation
);

// ── Damage sense reporting (per hit, in UCombatComponent after TakeDamage) ───

UAIPerceptionSystem::ReportDamageEvent(
    GetWorld(), AlienActor, PlayerCharacter,
    HitResult.ImpactPoint, HitDirection, DamageAmount
);
```

## Alternatives Considered

### Alternative A: UCombatComponent Only — No Coordinator Subsystem
- **Description**: UCombatComponent owns ECombatState, disengagement timer, and alien set. Queries UAlienSquadSubsystem for alive-alien count directly.
- **Pros**: Fewer classes; everything co-located with weapon logic.
- **Cons**: UCombatComponent is destroyed with the character (e.g., death/respawn). ECombatState must persist to drive disengagement after death. Mixing per-actor weapon state with cross-actor coordination state creates a God Component. Formula 3 alive-alien tracking requires subscribing to every alien death event from a component tied to one actor.
- **Rejection Reason**: ECombatState outlives a single actor's scope (disengagement continues even if player is downed in future co-op contexts). UWorldSubsystem is the correct tier for cross-actor coordination that resets per level.

### Alternative B: Pure UWorldSubsystem for All Combat
- **Description**: Single `UCombatSubsystem` owns weapon state, spread, reload, hit detection, AND state machine.
- **Pros**: One class.
- **Cons**: Directly contradicts ADR-0004 `per_actor_state` decision (`UCombatComponent` is already registered there). A subsystem is not attached to an actor — it cannot access character bone transforms for muzzle location, animation state, or per-actor weapon component data without an awkward actor reference cache. Violates separation of per-instance vs. coordination state.
- **Rejection Reason**: Conflicts with registered ADR-0004 stance. Per-actor weapon mechanics belong on a component.

### Alternative C: GAS (Gameplay Ability System) for Combat Abilities
- **Description**: Each weapon fire, reload, and melee implemented as a `UGameplayAbility`.
- **Pros**: Built-in prediction, cooldown management, tag-gating.
- **Cons**: GAS has been rejected twice (ADR-0004, ADR-0010) for this project — unjustified overhead for single-player. Same rationale applies here.
- **Rejection Reason**: Consistent with established ADR-0004/0010 decisions. No multiplayer requirement to justify GAS.

## Consequences

### Positive
- `UCombatComponent` is laser-focused on per-player weapon mechanics; easily unit-tested in isolation by feeding fake spread/hit data.
- `UCombatSubsystem` (UWorldSubsystem) correctly resets on level transition — satisfies the GDD zone-boundary edge case.
- IMC_Combat lifecycle is owned by exactly one system (UCombatSubsystem) with PC as the API bridge — no stack corruption risk.
- Damage sense reporting via `ReportDamageEvent()` is explicit and impossible to accidentally omit (it is called in a single code path in `FireWeapon()`).
- `IsPlayerUnderThreat()` on UCombatSubsystem gives Investigation/Quest systems a single, authoritative gate at detection ≥75 without coupling them to Stealth System internals.

### Negative
- Two cooperating classes to understand instead of one — requires developers to know which layer owns what.
- UCombatComponent must call `GetWorld()->GetSubsystem<UCombatSubsystem>()` at call sites — no cached pointer (per ADR-0004 `static_subsystem_pointer` forbidden pattern).

### Risks
- **Risk**: UCombatSubsystem::Initialize() may try to get UAlienSquadSubsystem before it is initialized.
  **Mitigation**: Use `InitializeDependency<UAlienSquadSubsystem>()` in UCombatSubsystem::Initialize() per ADR-0004 `initialize_peer_caching` rule.
- **Risk**: Disengagement timer Formula 3 counts `ActiveCombatAliens` but aliens may be garbage-collected without firing `OnAlienKilled` (e.g., level unload during combat).
  **Mitigation**: `TSet<TWeakObjectPtr<AAlienCharacter>>` — check `IsValid()` before counting. UCombatSubsystem::Deinitialize() clears the set.
- **Risk**: `UAIPerceptionSystem::ReportDamageEvent()` must be called with the correct world context; null-world edge case during level transition.
  **Mitigation**: Guard with `IsValid(GetWorld())` before the call. Combat triggering during level transition is blocked by UCombatSubsystem Deinitialize().
- **Risk**: IMC_Combat left on stack if player quits or crashes during Active Combat.
  **Mitigation**: UCombatSubsystem::Deinitialize() calls `PC->PopCombatIMC()` if ECombatState != NonCombat before teardown.

## GDD Requirements Addressed

| GDD System | Requirement | How This ADR Addresses It |
|------------|-------------|--------------------------|
| combat-system.md | Rule 1 — four weapon classes with distinct behavior | UCombatComponent reads weapon data via IInventoryInterface; weapon type drives MakeNoise() loudness and spread parameters |
| combat-system.md | Rule 2 — hitscan hit detection + melee cone check | UCombatComponent::FireWeapon() performs line trace; MeleeAttack() performs SweepMultiByChannel + dot-product filter at 150cm/60° |
| combat-system.md | Formula 1 — D_hit = ceil(D_base × M_loc × M_dist × M_condition × M_armor) | UCombatComponent::CalculateDamage() applies all five multipliers; M_condition from IInventoryInterface; M_armor from AAlienCharacter |
| combat-system.md | Formula 2 — S_current spread accumulation ring buffer | UCombatComponent::ShotTimestamps (TArray<double>); N_consecutive = count within trailing 1.0s window |
| combat-system.md | Formula 3 — disengagement timer T_disengage | UCombatSubsystem FTimerHandle; N_alive from ActiveCombatAliens set filtered to ≤2000cm + LOS condition |
| combat-system.md | Formula 4 — M_panic spread modifier | UCombatComponent::GetPanicModifier() — HP% from AHostileCharacter; nearest alien distance from UCombatSubsystem |
| combat-system.md | Rule 4 — ammo pre-deduction and partial-fill on cancel | UCombatComponent reload FSM: deducts reserve at reload start; partial-fill formula on cancel; shotgun per-shell state |
| combat-system.md | Rule 5 — combat lifecycle (5 states) + IMC_Combat ownership | UCombatSubsystem state machine; PC::PushCombatIMC/PopCombatIMC delegation |
| combat-system.md | Rule 6 — melee consecutive-hit recovery penalty | UCombatComponent::MeleeHitCounterPerAlien (TMap); resets on target switch and after 3.0s inactivity |
| combat-system.md | Rule 7 — panic state spread modifier | UCombatComponent::GetPanicModifier() at fire time; point-blank exemption (≤150cm) checked before applying |
| combat-system.md | Rule 8 — call for backup via alien LOS timer | UCombatSubsystem::NotifyBackupCalled() receives OnBackupCalled from Alien AI; fires FOnBackupCalled delegate to HUD |
| combat-system.md | States: Unified combat-state model (three distinct concepts) | ECombatState (UCombatSubsystem) ≠ alien combat behavior (ADR-0012) ≠ IsPlayerUnderThreat (detection ≥75). Three independent signals, separately owned. |
| stealth-system.md | OnCombatDisengaged triggers stealth reset | UCombatSubsystem::OnCombatDisengaged delegate — Stealth System subscribes via AddDynamic() |
| alien-ai-system.md | Alien receives damage sense event after player hits it | UCombatComponent::FireWeapon() calls ReportDamageEvent() after every alien hit — satisfies ADR-0012 forbidden pattern |
| alien-ai-system.md | Alien hears weapon fire noise | UCombatComponent::FireWeapon() calls MakeNoise() per weapon type — noise radius matches GDD Rule 2 noise table |
| movement-system.md | Dodge i-frame invulnerability window | UCombatComponent subscribes to OnDodgeStarted(IFrameDuration) — used for enemy attack timing awareness |
| movement-system.md | Melee stamina cost (10 per swing) | UCombatComponent::MeleeAttack() gates on CanMelee() then calls AHostileCharacter::ConsumeStamina(10) |

## Performance Implications
- **CPU (weapon fire)**: Single line trace ~0.1ms; damage formula O(1); MakeNoise + ReportDamageEvent < 0.05ms combined. Total per-shot: < 0.2ms.
- **CPU (melee)**: SweepMultiByChannel at 150cm + dot-product filter < 0.15ms. Per swing: < 0.2ms.
- **CPU (spread ring buffer)**: O(N) scan of ≤16 float entries per shot. Negligible.
- **CPU (disengagement timer)**: FTimerHandle fires at most once per second during Disengaging state. O(N_aliens) TWeakObjectPtr validity check < 0.1ms.
- **Memory**: UCombatComponent per character: ShotTimestamps (16 × 8B = 128B), MeleeHitCounterPerAlien (TMap, ~100B per entry, max 8 entries = ~800B). Negligible.
- **VFX budget**: GDD specifies < 0.5ms per frame for combat VFX (bullet decals, muzzle flash, blood). Tracked by Visual/Audio Requirements section — enforced at VFX implementation, not ADR level.

## Migration Plan
No existing combat code to migrate. UCombatComponent and UCombatSubsystem are new classes. First implementation can directly follow the key interfaces defined above.

## Validation Criteria
- `NotifyCombatTrigger()` called when detection reaches 100 → ECombatState transitions to CombatEntry within one frame; `PC->PushCombatIMC()` called → IMC_Combat active.
- `FireWeapon()` on pistol at unarmored alien head, effective range, clean weapon → `TakeDamage(38, FPointDamageEvent)` called on alien (Formula 1: ceil(25×1.5×1.0×1.0×1.0)=38).
- `FireWeapon()` called → `UAIPerceptionSystem::ReportDamageEvent()` called on same alien in same frame.
- Five shots within 1.0s (pistol) → `GetCurrentSpread()` = 1.0° + min(5×0.2°, 5.0°) = 2.0°.
- All aliens dead, player NOT in cover → DisengageTimer = 10.0s. At 10.0s → ECombatState = Disengaged; `PC->PopCombatIMC()` called.
- All aliens dead, player in cover → DisengageTimer = 7.0s (Formula 3 minimum confirmed).
- DisengageTimer at 9.9s, alien re-detects player → timer resets to 0, ECombatState → ActiveCombat.
- MeleeAttack() with stamina < 10 → no swing; stamina unchanged; "Too Exhausted" event fired.
- MeleeAttack() → `AHostileCharacter::ConsumeStamina(10)` called; no direct stamina write.
- Level transition (zone boundary) → UCombatSubsystem::Deinitialize() → ECombatState reset; timer cleared; ActiveCombatAliens empty.

## Related Decisions
- [ADR-0001](adr-0001-cross-system-communication.md) — communication patterns (delegates, GameplayMessageSubsystem)
- [ADR-0003](adr-0003-enhanced-input-architecture.md) — Enhanced Input IMC push/pop via UEnhancedInputLocalPlayerSubsystem
- [ADR-0004](adr-0004-subsystem-module-architecture.md) — per_actor_state (UCombatComponent), UWorldSubsystem tier
- [ADR-0010](adr-0010-movement-architecture.md) — OnDodgeStarted event, ConsumeStamina, MakeNoise API
- [ADR-0012](adr-0012-alien-ai-system.md) — OnAlienKilled event, ReportDamageEvent requirement, UAlienSquadSubsystem
- [design/gdd/combat-system.md](../../design/gdd/combat-system.md) — full mechanical specification
