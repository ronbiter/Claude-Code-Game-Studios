# ADR-0012: Alien AI System Architecture

## Status
Proposed

## Date
2026-05-20

## Engine Compatibility

| Field | Value |
|-------|-------|
| **Engine** | Unreal Engine 5.7 |
| **Domain** | AI (Behavior Trees, Perception, EQS, Navigation) |
| **Knowledge Risk** | HIGH — UE 5.4–5.7 post-LLM-cutoff; no AI module reference in engine-reference library |
| **References Consulted** | `docs/engine-reference/unreal/VERSION.md`, `docs/engine-reference/unreal/modules/navigation.md`, `docs/engine-reference/unreal/breaking-changes.md`, `docs/engine-reference/unreal/deprecated-apis.md` |
| **Post-Cutoff APIs Used** | UAIPerceptionComponent, UBehaviorTreeComponent, UEnvQueryManager — stability across 5.4–5.7 unverified; engine specialist review completed 2026-05-20 |
| **Verification Required** | EQS C++ runtime API (`UEnvQueryManager::RunEQSQuery` / `FEnvQueryRequest::Execute`) — verify signature against UE 5.7 headers before implementing BT task EQS calls; `UNavModifierComponent` runtime registration with World Partition — verify pooled-actor pattern works with dynamic cell loading |

## ADR Dependencies

| Field | Value |
|-------|-------|
| **Depends On** | ADR-0001 (cross-system delegate pattern), ADR-0004 (subsystem tiers — `UWorldSubsystem` for `UAlienSquadSubsystem`), ADR-0005 (`UDataTable` for AI tuning), ADR-0007 (`EHostileCollision::AIPerception` channel), ADR-0008 (`ISceneManagementSubsystem` zone queries), ADR-0010 (`ReportNoiseEvent()` noise emission API) |
| **Enables** | Alien AI implementation epic; Stealth System integration stories |
| **Blocks** | Epic: Alien AI Implementation — cannot start until Proposed → Accepted |
| **Ordering Note** | ADR-0004's `subsystem_world_tier` stance for `UAlienSquadSubsystem` is already registered; this ADR supplements with AI-specific contracts. ADR-0010 owns noise emission API — this ADR is a consumer, not an owner. |

## Context

### Problem Statement
No ADR documents which AI framework governs alien behavior in Hostile World, how the Alien AI system integrates with Stealth/Movement/Infection/Scene systems, or what the authoritative class hierarchy and data contracts are. Without this ADR, implementation stories cannot reference a governing architectural decision, integration boundaries are undefined, and there is no source of truth for what the alien AI system owns vs consumes.

### Constraints
- Performance: ≤0.5ms per alien per frame; ≤4.0ms total with 8 simultaneous aliens at 60fps
- No GAS module dependency (ADR-0004: unjustified overhead for single-player)
- All cross-system events via ADR-0001 dynamic multicast delegates — no direct state polling in `Tick()`
- AI tuning parameters must be designer-editable via `UDataTable` (ADR-0005)
- AI perception collision via `EHostileCollision::AIPerception` alias (ADR-0007)
- Noise detection via `UAIPerceptionSystem::MakeNoise()` — locked by ADR-0010
- Zone queries via `ISceneManagementSubsystem` for zone identity; `IInfectionSpreadSubsystem::GetZoneInfectionLevel()` for infection level
- No direct Data Layer access (ADR-0008); no cross-zone alien pursuit (game design constraint)

### Requirements
- Must support 5-state detection model (Idle/Suspicious/Alert/Combat/Detected) driven by D_total from Stealth System
- Must support group coordination: squads share detection via event delegates with 1.5s propagation delay and 3000cm distance filter
- Must support 4 attack types (Melee/Spit/Charge/BiomassBurst) with A_score formula evaluated every 0.5s
- Must support infection-aware behavior scaling via `IInfectionSpreadSubsystem::GetZoneInfectionLevel()`
- Must support EQS queries for cover, flanking, retreat, and patrol positions
- Must support custom NavMesh area types (Biomass, Low, Restricted) painted at runtime via `UNavModifierComponent`
- BT Services drive detection scoring at configurable interval — never `Tick()`-based polling

## Decision

Adopt the **UE5 native AI stack**: Behavior Trees + `UAIPerceptionComponent` + Environment Query System (EQS), with the class hierarchy and integration contracts defined below. `UAlienSquadSubsystem : UWorldSubsystem` owns squad coordination (per ADR-0004 `subsystem_world_tier` registered stance). All AI tuning data lives in a designer-editable `UDataTable`.

### Class Hierarchy

```
AAlienCharacter : ACharacter
├── TObjectPtr<UAIPerceptionComponent> PerceptionComp   ← on Character, not Controller
│   ├── UAISenseConfig_Sight*   SightConfig   (Range=2000cm, LoseSight=2500cm, FOV=110°)
│   ├── UAISenseConfig_Hearing* HearingConfig  (Range=1500cm; stimuli from MakeNoise — ADR-0010)
│   └── UAISenseConfig_Damage*  DamageConfig   (Threshold=5 HP; requires explicit ReportDamageEvent())
├── TObjectPtr<UNiagaraComponent>  BiomassVFX
├── TObjectPtr<UAudioComponent>    AlienAudioComp
└── TObjectPtr<UAlienAnimInstance> AlienAnimBP

AAlienAIController : AAIController
├── TObjectPtr<UBehaviorTreeComponent> BTComp
├── TObjectPtr<UBlackboardComponent>   Blackboard
├── int32                              SquadId
└── TArray<TWeakObjectPtr<AAlienAIController>> SquadMembers   ← TWeakObjectPtr; GC-safe

UAlienSquadSubsystem : UWorldSubsystem          ← World tier (ADR-0004 registered stance)
├── RegisterAlien(AAlienAIController*)           ← called from AAlienAIController::OnPossess
├── UnregisterAlien(AAlienAIController*)         ← called on alien death / controller unpossess
├── GetSquadById(int32) → TArray<TWeakObjectPtr<AAlienAIController>>
├── GetAllActiveAliens() → TArray<TWeakObjectPtr<AAlienAIController>>
├── NotifyPlayerPosition(FVector WorldLocation)
└── BroadcastSquadAlert(AAlienAIController* Source, FVector Location, float AlertScore)
    ← subsystem owns broadcast authority; individual controllers do not

Custom BT Nodes (C++ — performance-critical attack and patrol paths):
├── UAlienBTService_UpdatePerception : UBTService_BlackboardBase
│   └── TickNode reads DetectionScore from Stealth System, writes to Blackboard key "DetectionScore"
├── UAlienBTService_DetectionDecay   : UBTService_BlackboardBase
│   └── TickNode decays DetectionScore at 5pts/sec when no stimulus for >2s
├── UAlienBTDecorator_IsDetectionThreshold : UBTDecorator
├── UAlienBTTask_MeleeAttack    : UBTTaskNode
├── UAlienBTTask_SpitAttack     : UBTTaskNode
├── UAlienBTTask_ChargeAttack   : UBTTaskNode
├── UAlienBTTask_BiomassBurst   : UBTTaskNode
├── UAlienBTTask_FindPatrolLocation : UBTTaskNode  ← scores via P_score formula
└── UAlienBTTask_MoveToCover    : UBTTaskNode
```

### Architecture Diagram

```
┌────────────────────────────────────────────────────────────────────┐
│                     UAlienSquadSubsystem                           │
│         (UWorldSubsystem — per-level, auto-clears on transition)  │
│  RegisterAlien() │ BroadcastSquadAlert() │ GetSquadById()          │
└──────────────────────────────┬─────────────────────────────────────┘
                               │ holds TWeakObjectPtr<> per alien
         ┌─────────────────────┼────────────────────────┐
         ▼                     ▼                        ▼
 AAlienAIController    AAlienAIController    AAlienAIController
 (SquadId=0, Leader)   (SquadId=0)           (SquadId=1)
         │                     │
         │ possesses / OnPossess calls SetPerceptionComponent()
         ▼                     ▼
 AAlienCharacter        AAlienCharacter
 ├─ UAIPerceptionComp   ├─ UAIPerceptionComp
 │   OnTargetPerceptionUpdated ──► AAlienCharacter handler
 │                                   └─ writes stimulus to Blackboard
 └─ AlienAnimBP         └─ AlienAnimBP

         Blackboard "DetectionScore" ◄── UAlienBTService_UpdatePerception
                                           calls IStealthDetection::GetDetectionScore()
                                           every Service interval (0.5s)

         Behavior Tree (4-branch Selector)
         ├── Combat Branch  (DetectionScore ≥ 75) — attack scoring, retreat, EQS
         ├── Alert Branch   (50–74) — EQS flank query, wide FOV scan
         ├── Suspicious Branch (25–49) — move to last known, look-around
         └── Patrol Branch  (< 25) — P_score routing, decay service

         EQS Queries ──► UNavigationSystemV1::GetCurrent(World) for path checks
         Zone Infection ──► IInfectionSpreadSubsystem::GetZoneInfectionLevel(ZoneId)
         NavMesh Areas  ──► UNavModifierComponent on pooled actors (Biomass zones)
```

### Key Interfaces

```cpp
// ── Perception wiring ────────────────────────────────────────────────────
// AAlienCharacter::BeginPlay binds the perception delegate:
PerceptionComp->OnTargetPerceptionUpdated.AddDynamic(
    this, &AAlienCharacter::HandlePerceptionUpdated);
// Signature: void HandlePerceptionUpdated(AActor* Actor, FAIStimulus Stimulus);

// AAlienAIController::OnPossess links component to controller's AI bookkeeping:
void AAlienAIController::OnPossess(APawn* InPawn) {
    Super::OnPossess(InPawn);
    if (AAlienCharacter* Alien = Cast<AAlienCharacter>(InPawn)) {
        SetPerceptionComponent(*Alien->PerceptionComp);  // ← REQUIRED; without this,
    }                                                    //   GetPerceptionComponent() returns null
    UAlienSquadSubsystem* Squad = GetWorld()->GetSubsystem<UAlienSquadSubsystem>();
    if (Squad) Squad->RegisterAlien(this);
}

// ── Stealth System integration (read-only) ───────────────────────────────
class IStealthDetection {
public:
    virtual float GetDetectionScore(AActor* TargetActor) = 0; // returns 0–100
};
// UAlienBTService_UpdatePerception::TickNode calls this every Service interval
// and writes result to Blackboard key "DetectionScore". The service does NOT
// own the perception delegate — that binding is in AAlienCharacter::BeginPlay.

// ── Combat damage sense (explicit call required) ──────────────────────────
// UAISenseConfig_Damage fires ONLY when explicitly called — NOT from ApplyDamage.
// The combat system damage pipeline MUST call this after applying damage to an alien:
UAIPerceptionSystem::ReportDamageEvent(
    GetWorld(), DamagedActor, Instigator,
    DamageLocation, HitDirection, DamageAmount);

// ── Combat death notification ─────────────────────────────────────────────
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnAlienKilled, AAlienCharacter*, AlienActor);
// Fired by AAlienCharacter when HP reaches 0. Combat System listens for scoring/loot.
// UAlienSquadSubsystem::UnregisterAlien() also binds this delegate.

// ── Squad coordination (subsystem-owned) ─────────────────────────────────
// UAlienSquadSubsystem owns alert broadcast authority.
// Individual alien controllers call BroadcastSquadAlert() on the subsystem;
// they do NOT declare per-controller multicast delegates for this purpose.
void UAlienSquadSubsystem::BroadcastSquadAlert(
    AAlienAIController* Source, FVector TargetLocation, float AlertScore);
// Subsystem applies: 1.5s delay, 3000cm distance filter, 1s debounce,
// M_state multiplier (Idle=0.8, Suspicious=1.0, Alert+=0.5).

// Squad order broadcasting (leader to members):
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(
    FOnSquadOrder, EAlienSquadOrder, Order, FVector, OrderLocation);
// Declared on UAlienSquadSubsystem, not on individual controllers.

// ── Zone infection query ──────────────────────────────────────────────────
// Zone identity: USceneManagementSubsystem::GetCurrentZone() → FName ZoneId
// Infection level: IInfectionSpreadSubsystem::GetZoneInfectionLevel(ZoneId) → 0–100
// Called by UAlienBTService_UpdatePerception every 0.5s alongside detection scoring.
// Do NOT call Data Layer APIs directly (ADR-0008 forbidden pattern).

// ── NavMesh runtime area painting (infection-driven) ─────────────────────
// Biomass zone NavMesh areas are painted by UInfectionSpreadSubsystem callbacks,
// NOT by Alien AI directly. Pattern: spawn pooled actor with UNavModifierComponent
// configured to UNavArea_Biomass. NavSystem registers it automatically when
// Runtime Generation = Dynamic is enabled in Project Settings.
// Alien AI receives path cost changes via standard CMC navigation path evaluation.
// UNavigationSystemV1* NavSys = UNavigationSystemV1::GetCurrent(GetWorld());
// ← use for path queries; area painting is via UNavModifierComponent, not method call.

// ── AI tuning data (UDataTable — ADR-0005) ───────────────────────────────
USTRUCT(BlueprintType)
struct FAlienStatRow : public FTableRowBase {
    UPROPERTY(EditDefaultsOnly) float HP              = 100.f;
    UPROPERTY(EditDefaultsOnly) float WalkSpeed       = 350.f;
    UPROPERTY(EditDefaultsOnly) float SprintSpeed     = 650.f;
    UPROPERTY(EditDefaultsOnly) float ChargeSpeed     = 900.f;
    UPROPERTY(EditDefaultsOnly) float HearingRange    = 1500.f;
    UPROPERTY(EditDefaultsOnly) float VisionRange     = 800.f;
    UPROPERTY(EditDefaultsOnly) float VisionFOV       = 110.f;
    UPROPERTY(EditDefaultsOnly) float MeleeRange      = 150.f;
    UPROPERTY(EditDefaultsOnly) float MeleeDamage     = 20.f;
    UPROPERTY(EditDefaultsOnly) float SpitRange       = 1200.f;
    UPROPERTY(EditDefaultsOnly) float SpitDamage      = 15.f;
    UPROPERTY(EditDefaultsOnly) float SpitCooldown    = 3.f;
    UPROPERTY(EditDefaultsOnly) float ChargeRange_Min = 600.f;
    UPROPERTY(EditDefaultsOnly) float ChargeRange_Max = 1000.f;
    UPROPERTY(EditDefaultsOnly) float ChargeDamage    = 25.f;
    UPROPERTY(EditDefaultsOnly) float ChargeCooldown  = 5.f;
    UPROPERTY(EditDefaultsOnly) float BiomassBurstRange  = 300.f;
    UPROPERTY(EditDefaultsOnly) float BiomassBurstDamage = 10.f;  // HP/s
    UPROPERTY(EditDefaultsOnly) float BiomassBurstCooldown = 8.f;
    // Infection scaling coefficients (K_type per GDD Formula 3):
    UPROPERTY(EditDefaultsOnly) float K_SpeedInfection       = 0.3f;
    UPROPERTY(EditDefaultsOnly) float K_PerceptionInfection  = 0.4f;
    UPROPERTY(EditDefaultsOnly) float K_AggressionInfection  = -0.3f;
    UPROPERTY(EditDefaultsOnly) float K_AlertPropInfection   = 0.5f;
    UPROPERTY(EditDefaultsOnly) float K_CooldownInfection    = -0.2f;
};
// Row name "Drone" for MVP alien. Future alien types add rows.
// Hard reference TObjectPtr<UDataTable> on UAlienSquadSubsystem (ADR-0005).
```

### Behavior Tree Branch Priority

Top-level Selector — four branches, priority high→low:

| Priority | Branch | Entry Condition | Decorator Abort |
|----------|--------|-----------------|-----------------|
| 1 | Combat | DetectionScore ≥ 75 | Lower Priority — interrupts branches 2-4 when score ≥ 75 |
| 2 | Alert | 50 ≤ DetectionScore < 75 | Lower Priority — interrupts branches 3-4 |
| 3 | Suspicious | 25 ≤ DetectionScore < 50 | Lower Priority — interrupts branch 4 |
| 4 | Patrol | DetectionScore < 25 | — (default) |

Combat branch sub-selector: Retreat (HP < 25%) → SpitAttack → MeleeAttack → ChargeAttack → BiomassBurst → Pursue. Attack selection via A_score formula evaluated in BT task, not service.

### NavMesh Custom Areas

| Class | Cost | Use | Painted By |
|-------|------|-----|-----------|
| `UNavArea_Default` | 1.0x | Standard ground | Static level geometry |
| `UNavArea_AlienLow` | 1.5x | Crouch/stealth paths | Static level placement |
| `UNavArea_Biomass` | 0.5x | Biomass zones (alien-favored) | `UNavModifierComponent` on pooled actors, triggered by `UInfectionSpreadSubsystem` |
| `UNavArea_Restricted` | ∞ (blocked) | Cliffs, water, no-go zones | Static level placement |

Cell size: 30cm. Agent radius: 50cm. Max slope: 45°. Runtime Generation: Dynamic.

## Alternatives Considered

### Alternative 1: Custom FSM per UActorComponent
- **Description**: Replace BT with a handwritten state machine component on `AAlienCharacter` or `AAlienAIController`, manually implementing patrol/suspicious/alert/combat transitions and EQS integration.
- **Pros**: No BT overhead, full control over transition timing, simpler to isolate in unit tests.
- **Cons**: Reinvents UE5's native AI infrastructure. BT abort logic, service scheduling, and EQS integration must all be custom-built. No visual editor for design iteration. Behavior reuse across future alien types requires duplicating state machine code.
- **Rejection Reason**: BT + EQS is purpose-built for this use case in UE5. Custom FSM adds significant implementation cost for no unique benefit at indie scale with 1–2 alien types in MVP.

### Alternative 2: GAS + BT Hybrid (ability-per-attack)
- **Description**: Each alien attack (Melee, Spit, Charge, BiomassBurst) implemented as a `UGameplayAbility`. BT tasks trigger ability activation instead of direct attack logic.
- **Pros**: Composable ability effects; GAS attribute-driven stat system; reusable across future alien variants.
- **Cons**: GAS module adds ~30 new classes and a dedicated specialist. ADR-0004 already rejected GAS for movement on identical grounds: unjustified overhead for single-player. Attack cooldowns are simpler as `FTimerHandle` fields on the controller.
- **Rejection Reason**: ADR-0004 precedent. A_score formula in a C++ BT task provides all needed attack selection with no GAS complexity.

## Consequences

### Positive
- BT visual editor enables design iteration on patrol/attack behavior without code changes
- `UAIPerceptionComponent` handles sense config, hysteresis, and stimulus aggregation natively
- EQS abstracts spatial queries — queries are configurable without recompile
- `UAlienSquadSubsystem` as `UWorldSubsystem` auto-cleans on level transition; no stale squad state
- `UDataTable` tuning integrates with ADR-0005's established data workflow
- BT Services are engine-managed, non-Tick: compliant with `polling_state_in_tick` forbidden pattern

### Negative
- BT debugging requires UE editor (PIE) — BT logic cannot be unit-tested in isolation
- `UAISenseConfig_Damage` does not auto-fire from `ApplyDamage` — combat pipeline must explicitly call `UAIPerceptionSystem::ReportDamageEvent()` at every alien hit site
- EQS async query management (in-flight query tracking and cancellation) adds implementation complexity in attack BT tasks
- `UAlienSquadSubsystem` resets on level transition — any mid-game alien state is lost at zone boundary (by design, confirmed in GDD edge cases)

### Risks
- **Risk**: EQS C++ runtime API (`UEnvQueryManager` / `FEnvQueryRequest`) may have changed in UE 5.4–5.7. **Mitigation**: Marked as must-verify in Verification Required. Do not finalize BT task EQS calls until confirmed against UE 5.7 headers in editor.
- **Risk**: `UNavModifierComponent` pooled-actor pattern for runtime Biomass area painting may behave differently under World Partition dynamic cell loading (actor relevancy / component registration timing). **Mitigation**: Prototype one Biomass zone in PIE before implementing infection-driven painting pipeline.
- **Risk**: Perception component on `AAlienCharacter` requires explicit `SetPerceptionComponent()` in `OnPossess` — omitting this call causes `GetPerceptionComponent()` on the controller to return null, crashing any BT service that navigates through the controller to reach perception data. **Mitigation**: Enforce via code review checklist; add assert in `UAlienBTService_UpdatePerception::OnBecomeRelevant`.
- **Risk**: BT service interval (0.5s) may produce visible detection lag for fast-moving aliens in high-infection zones (speed ×1.3). **Mitigation**: Infection modifier applied at BT tick; service interval is a tuning knob in `FAlienStatRow`.
- **Risk**: `UAlienSquadSubsystem::BroadcastSquadAlert` O(n) fan-out on every alert. With large squad sizes, may produce excessive event traffic. **Mitigation**: 1s debounce on broadcast; 3000cm distance filter reduces receivers; squad size capped by level design.

## GDD Requirements Addressed

| GDD System | Requirement | How This ADR Addresses It |
|------------|-------------|--------------------------|
| alien-ai-system.md | Rule 2 — Class architecture (`AAlienCharacter`, `AAlienAIController`, custom BT nodes) | ADR formalizes class hierarchy with `UAlienSquadSubsystem : UWorldSubsystem` (fixes GDD's `UAlienManagerSubsystem : UGameInstanceSubsystem`) |
| alien-ai-system.md | Rule 3 — BT structure (4-branch Selector, abort logic) | ADR documents branch priority table, decorator types, and Lower Priority Abort pattern |
| alien-ai-system.md | Rule 4 — Blackboard keys (17 keys including DetectionScore, TargetActor, squad keys) | ADR establishes Blackboard as BT-owned state for detection/combat/patrol |
| alien-ai-system.md | Rule 5 — AI Perception setup (sight 2000cm, hearing 1500cm, damage 5HP) | ADR selects `UAIPerceptionComponent` with Sight/Hearing/Damage configs; documents explicit `ReportDamageEvent()` requirement |
| alien-ai-system.md | Rule 6 — Attack decision scoring (A_score formula, 0.5s interval) | ADR places scoring in C++ BT task (combat branch); interval governed by BT Service tick |
| alien-ai-system.md | Rule 7 — Group coordination (squad delegates, shared blackboard) | ADR moves broadcast authority to `UAlienSquadSubsystem`; formalizes delegate contracts with 1.5s delay, 3000cm filter, 1s debounce |
| alien-ai-system.md | Rule 8 — EQS queries (4 types, 0.1s timeout, 2s cache, <50 points) | ADR selects `UEnvQueryManager` as EQS runtime; marks API as must-verify against UE 5.7 headers |
| alien-ai-system.md | Rule 9 — Nav Mesh (custom areas, runtime painting) | ADR uses `UNavigationSystemV1`; replaces GDD's incorrect `UNavSystem::ApplyRadiusModifier` with `UNavModifierComponent` on pooled actors |
| alien-ai-system.md | Rule 10 — Infection-aware behavior scaling | ADR routes infection queries via `IInfectionSpreadSubsystem::GetZoneInfectionLevel()` (OQ-8 resolved contract) |
| alien-ai-system.md | Formula 2 — Alert signal strength (S_alert propagation) | ADR formalizes squad delegation in `UAlienSquadSubsystem::BroadcastSquadAlert()` |
| alien-ai-system.md | Performance budget (≤0.5ms/alien, ≤4.0ms total, 8 aliens) | ADR constrains EQS (max 1 active query/alien, 0.1s timeout, <50 points) and mandates C++ custom nodes for attack paths |
| combat-system.md | `TakeDamage()` pathway, alien armor tier | ADR confirms `TakeDamage()` as damage reception; `OnAlienKilled` delegate as death notification to Combat System |

## Performance Implications
- **CPU**: ≤0.5ms/alien target. BT tick at default 0.25s rate. All attack BT tasks in C++. EQS max 1 active query/alien at any time, 0.1s timeout, <50 generator points.
- **Memory**: `UAlienSquadSubsystem` holds `TArray<TWeakObjectPtr<AAlienAIController>>` — negligible at 8–20 aliens. `FAlienStatRow` DataTable loaded as hard reference at world init.
- **Load Time**: Hard-referenced DataTable loads with world. No async complexity at indie PC scale.
- **Network**: N/A — single-player. No alien AI state requires replication.

## Migration Plan
Greenfield implementation — no existing alien AI code. This ADR gates all alien AI implementation stories. Stories cannot be created until ADR moves to Accepted.

## Validation Criteria
- Per-alien BT tick measured in Unreal Insights: <0.15ms average
- 8 simultaneous aliens: total AI CPU <4.0ms/frame at 60fps on target hardware
- EQS FindCover query returns valid result or times out at ≤0.1s (no hang)
- `UAlienSquadSubsystem::GetAllActiveAliens()` returns empty after level transition (auto-clear confirmed in PIE load test)
- `OnAlienKilled` fires exactly once per alien death
- Detection score update latency ≤0.5s from noise stimulus to Blackboard key update
- Squad alert: Alien B receives S_alert ≥50 within 1.5s of Alien A reaching D_total=80 at 800cm separation (per GDD acceptance criteria)
- `SetPerceptionComponent()` called in `OnPossess`: assert fires in `UAlienBTService_UpdatePerception::OnBecomeRelevant` if omitted

## Related Decisions
- ADR-0001: `docs/architecture/adr-0001-cross-system-communication.md`
- ADR-0004: `docs/architecture/adr-0004-subsystem-module-architecture.md`
- ADR-0005: `docs/architecture/adr-0005-game-data-strategy.md`
- ADR-0007: `docs/architecture/adr-0007-physics-collision-architecture.md`
- ADR-0008: `docs/architecture/adr-0008-scene-streaming-architecture.md`
- ADR-0010: `docs/architecture/adr-0010-movement-architecture.md`
- GDD: `design/gdd/alien-ai-system.md`
