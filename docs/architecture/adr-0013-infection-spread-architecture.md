# ADR-0013: Infection Spread System Architecture

## Status
Proposed

## Date
2026-05-20

## Engine Compatibility

| Field | Value |
|-------|-------|
| **Engine** | Unreal Engine 5.7 |
| **Domain** | Core / Gameplay Simulation |
| **Knowledge Risk** | LOW — UWorldSubsystem, FTimerHandle, TMap, and DYNAMIC_MULTICAST_DELEGATE are stable APIs unchanged from UE 5.3 → 5.7 |
| **References Consulted** | `docs/engine-reference/unreal/VERSION.md`, `docs/engine-reference/unreal/breaking-changes.md`, `docs/engine-reference/unreal/deprecated-apis.md` |
| **Post-Cutoff APIs Used** | None — all APIs existed in UE 5.3 |
| **Verification Required** | (1) Confirm `GetWorld()->GetTimerManager().SetTimer()` fires correctly from `UWorldSubsystem::OnWorldBeginPlay()`; (2) Confirm pool actors spawned with `PersistentLevel` override survive World Partition cell unloading; (3) Confirm `UNavModifierComponent` with `UNavArea_Null` does not dirty NavMesh while pooled; (4) Assert WP cell size constant `K_CellSizeWorld` matches project World Partition settings at startup |

## ADR Dependencies

| Field | Value |
|-------|-------|
| **Depends On** | ADR-0001 (DYNAMIC_MULTICAST_DELEGATE pattern — must be Accepted); ADR-0006 (IHostileSaveProvider registration pattern — must be Accepted); ADR-0008 (ISceneManagementInterface::RequestDataLayerSwap — must be Accepted); ADR-0012 (UNavModifierComponent pooled actor pattern — must be Accepted) |
| **Enables** | Combat ADR (DamageInfectionSource interface defined here); HUD ADR (GetNearbyCellInfectionLevels interface defined here) |
| **Blocks** | Infection Spread epic — stories cannot start until this ADR is Accepted |
| **Ordering Note** | ADR-0004 `adr-subsystems.yaml` registry lists `UInfectionSubsystem` under `subsystem_session_tier` (UGameInstanceSubsystem). That entry is incorrect. This ADR establishes `UInfectionSpreadSubsystem : public UWorldSubsystem`. The registry is corrected in Step 6 of this session. |

## Context

### Problem Statement
The Infection Spread System requires a continuous world-simulation subsystem that ticks at two rates (10 s near-player, 60 s far-from-player), manages per-cell infection state across potentially hundreds of World Partition cells, communicates state changes to five dependent systems, and persists its simulation state through the save/load pipeline — all while meeting strict CPU budgets (<1.0 ms near-tick, <2.0 ms far-tick) and never writing Data Layers directly.

### Constraints
- Must be `UWorldSubsystem` — infection state must not persist into the Mountain Prison level (separate world via `OpenLevel()`). GDD Rule 8 is explicit.
- Must call `USceneManagementSubsystem::RequestDataLayerSwap()` exclusively — no direct `UDataLayerSubsystem` calls (ADR-0008 forbidden pattern `direct_data_layer_write`).
- Must implement `IHostileSaveProvider` and call `RegisterProvider()` in `Initialize()` after `Collection.InitializeDependency<USaveLoadSubsystem>()` (ADR-0006; ADR-0004 `initialize_peer_caching` forbidden pattern).
- Must use `DECLARE_DYNAMIC_MULTICAST_DELEGATE` for `OnCellStateChanged` (ADR-0001).
- Must use pooled actors with `UNavModifierComponent` for NavMesh path blocking in Partial+ cells (ADR-0012 pattern).
- CPU: <1.0 ms per near-zone tick sweep (every 10 s), <2.0 ms per far-zone tick sweep (every 60 s) per GDD Rule 8.
- Memory: <2 MB for full infection state.

### Requirements
- Must implement all six GDD formulas (P_cell, infection_tick, cure_suppressant, hive_spawn_probability, node_spawn_probability, zone_infection_aggregate).
- Must support the six-state cell machine (Clean → Exposed → Partial → Infected → Fully Infected → Hive Core) with bi-directional transitions driven by cure deployment.
- Must expose `IInfectionSpreadInterface` as the external query contract — no system accesses `UInfectionSpreadSubsystem` directly by concrete type.
- Must pause ticks when `UHostileWorldGSM` enters Paused or GameOver state.
- Must apply the analytical catch-up formula when a far-zone cell transitions to near-zone (player approach).

## Decision

`UInfectionSpreadSubsystem` is a `UWorldSubsystem` that owns all infection simulation state. It exposes `IInfectionSpreadInterface` to all callers and implements `IHostileSaveProvider` for save/load.

### Tick Architecture

Three `FTimerHandle` instances drive the simulation, registered in `OnWorldBeginPlay()` and cleared in `Deinitialize()`. Note: `UWorldSubsystem` has no `GetWorldTimerManager()` shorthand — the correct call path is `GetWorld()->GetTimerManager()`.

```cpp
// Near-zone: 10-second sweep of cells within 8000 cm of player
// Delayed 5 s on first fire to allow World Partition to stream the starting area.
GetWorld()->GetTimerManager().SetTimer(
    FirstNearTickDelayHandle, this,
    &UInfectionSpreadSubsystem::StartNearZoneLoop, 5.0f, /*bLoop=*/false);

void UInfectionSpreadSubsystem::StartNearZoneLoop()
{
    GetWorld()->GetTimerManager().SetTimer(
        NearZoneTickHandle, this,
        &UInfectionSpreadSubsystem::TickNearZone, 10.0f, true);
}

// Far-zone: 60-second sweep of all other active cells
GetWorld()->GetTimerManager().SetTimer(
    FarZoneTickHandle, this,
    &UInfectionSpreadSubsystem::TickFarZone, 60.0f, true);

// Hive spawn evaluation: every 30 seconds
GetWorld()->GetTimerManager().SetTimer(
    HiveSpawnCheckHandle, this,
    &UInfectionSpreadSubsystem::EvaluateHiveSpawns, 30.0f, true);
```

Ticks are paused when GSM enters Paused/GameOver. The subsystem subscribes to `UHostileWorldGSM::OnStateChanged` via `AddUObject()` in `Initialize()`:

```cpp
void UInfectionSpreadSubsystem::OnGSMStateChanged(FGameplayTag NewState)
{
    const bool bShouldPause = NewState.MatchesTag(TAG_GameState_Paused)
                           || NewState.MatchesTag(TAG_GameState_GameOver);
    auto& TM = GetWorld()->GetTimerManager();
    if (bShouldPause) {
        TM.PauseTimer(NearZoneTickHandle);
        TM.PauseTimer(FarZoneTickHandle);
        TM.PauseTimer(HiveSpawnCheckHandle);
    } else {
        TM.UnPauseTimer(NearZoneTickHandle);
        TM.UnPauseTimer(FarZoneTickHandle);
        TM.UnPauseTimer(HiveSpawnCheckHandle);
    }
}
```

### Cell Data Model

```cpp
USTRUCT()
struct FCellInfectionData
{
    GENERATED_BODY()
    UPROPERTY() float InfectionLevel = 0.f;              // 0–100, authoritative
    UPROPERTY() ECellInfectionState State = ECellInfectionState::Clean;
    UPROPERTY() float LastFarTickGameTime = 0.f;         // GetWorld()->GetTimeSeconds() at last far-zone tick
    UPROPERTY() bool bNearZone = false;                  // true = in 8000 cm radius of player
    UPROPERTY() bool bHiveEligible = false;              // level >= 75 AND no existing hive
    UPROPERTY() bool bHiveSpawned = false;               // procedural hive present in this cell
    UPROPERTY() TArray<FGuid> ActiveSourceIds;           // source FGuids in range of this cell
};

// Key: FIntPoint maps to World Partition cell grid coordinates.
// Conversion: CellCoord = FIntPoint(FMath::FloorToInt(WorldPos.X / K_CellSizeWorld),
//                                    FMath::FloorToInt(WorldPos.Y / K_CellSizeWorld))
// K_CellSizeWorld must match World Partition cell size in project settings. Assert at OnWorldBeginPlay().
TMap<FIntPoint, FCellInfectionData> CellData;
```

Cells are lazily inserted on first contact with an infection source. Zero-state cells (level == 0, no sources in range) are omitted from `FInfectionStateData` on save to bound memory.

### Source Management

```cpp
USTRUCT()
struct FInfectionSourceData
{
    GENERATED_BODY()
    UPROPERTY() FGuid SourceId;
    UPROPERTY() EInfectionSourceType SourceType;        // Hive, Node, Vent
    UPROPERTY() FVector WorldPosition;
    UPROPERTY() float HP;                               // 500 / 150 / 50 per type
    UPROPERTY() bool bDestroyed = false;                // set by DamageInfectionSource(); skipped in ticks
    UPROPERTY() float PressureOutput;                   // H_i: 10 / 5 / 2
    UPROPERTY() float EffectiveRadius;                  // R_i: 5000 / 2500 / 1500 cm
};

TArray<FInfectionSourceData> ActiveSources;
```

`DamageInfectionSource(FGuid SourceId, float Amount)` sets `bDestroyed = true` and broadcasts `OnSourceDestroyed` immediately. The array is compacted on save (destroyed entries omitted). FGuid provides stable identity across save/load for both author-time and procedural sources.

### Cure Zone Management

```cpp
USTRUCT()
struct FCureZoneData
{
    GENERATED_BODY()
    UPROPERTY() FVector WorldPosition;
    UPROPERTY() float TimeRemaining;    // decremented by elapsed real time each near-tick
    static constexpr float Radius = 1500.f;   // R_c (cm)
};

TArray<FCureZoneData> ActiveCureZones;
```

`DeployCure(FVector Location)` checks `UInventorySubsystem::HasItem(CureItemId)`, calls `ConsumeItem()`, and appends to `ActiveCureZones`. Expired zones are removed at the start of each near-zone tick.

### Catch-Up on Player Approach

When a cell's `bNearZone` flips from `false` to `true` (player entered the 8000 cm radius), a single analytical catch-up is applied **before** the cell enters the near-zone tick pool. `P_cell` is recomputed from current active sources at reclassification time — not from a cached value that may be stale:

```cpp
float ComputePCell(const FCellInfectionData& Cell) const
{
    float PCell = 0.f;
    for (const FGuid& SrcId : Cell.ActiveSourceIds)
    {
        const FInfectionSourceData* Src = ActiveSources.FindByPredicate(
            [&](const FInfectionSourceData& S){ return S.SourceId == SrcId && !S.bDestroyed; });
        if (!Src) continue;
        const float D = FVector::Dist(Src->WorldPosition, GetCellCenter(Cell));
        if (D < Src->EffectiveRadius)
            PCell += Src->PressureOutput * (1.f - FMath::Square(D / Src->EffectiveRadius));
    }
    return PCell;
}

void UInfectionSpreadSubsystem::ApplyCatchUp(FIntPoint CellCoord)
{
    FCellInfectionData& Cell = CellData[CellCoord];
    const float ElapsedSec = FMath::Min(
        GetWorld()->GetTimeSeconds() - Cell.LastFarTickGameTime,
        K_CatchupMaxSeconds);  // 1800 s cap

    const float PCell = ComputePCell(Cell);
    Cell.InfectionLevel = FMath::Clamp(
        Cell.InfectionLevel + (PCell / K_SpreadRateFar) * ElapsedSec,
        0.f, 100.f);

    // Queue any threshold crossings — do not fire Data Layer swaps inline
    EvaluateCellStateTransitions(CellCoord, /*bQueueOnly=*/true);
}
```

Data Layer swaps triggered by catch-up are always queued to `USceneManagementSubsystem` (not fired inline) to respect the ADR-0008 swap budget.

### NavMesh Area Painting

When a cell transitions to `Partial` or higher, a pooled actor carrying `UNavModifierComponent` is drawn from `NavBlockerPool` and placed at the cell center. When the cell drops below `Partial`, the actor is returned to pool.

Pool initialization in `OnWorldBeginPlay()`:

```cpp
FActorSpawnParameters Params;
Params.OverrideLevel = GetWorld()->PersistentLevel;  // avoid WP cell assignment
Params.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;

for (int32 i = 0; i < K_NavBlockerPoolSize; ++i)
{
    AActor* Actor = GetWorld()->SpawnActor<AActor>(AActor::StaticClass(), FVector(0, 0, -100000.f),
        FRotator::ZeroRotator, Params);
    UNavModifierComponent* NavComp = NewObject<UNavModifierComponent>(Actor);
    NavComp->RegisterComponent();
    NavComp->SetAreaClass(UNavArea_Null::StaticClass());  // no nav dirtying while pooled
    Actor->SetActorEnableCollision(false);
    NavBlockerPool.Add(Actor);
}
```

On activation, the actor is moved to the cell center, `SetActorEnableCollision(true)` is called, and `NavComp->SetAreaClass(UNavArea_InfectionZone::StaticClass())` — a project-specific `UNavArea` subclass that blocks the player agent but is transparent to alien agents (via Navigation Query Filter on alien path requests). This prevents aliens from being blocked by their own infection zone.

On deactivation: actor returned to pool at Z = -100000, collision disabled, area class reset to `UNavArea_Null`.

Pool size: `K_NavBlockerPoolSize = 32` (maximum Partial+ cells expected in near-zone simultaneously — 5×5 near zone = 25 cells max Partial+ in practice).

### Hive Spawning into World Partition

`EvaluateHiveSpawns()` checks cell load state before `SpawnActor` to avoid spawning into unloaded WP cells:

```cpp
void UInfectionSpreadSubsystem::EvaluateHiveSpawns()
{
    UWorldPartitionSubsystem* WPS = GetWorld()->GetSubsystem<UWorldPartitionSubsystem>();
    for (auto& [CellCoord, Cell] : CellData)
    {
        if (!Cell.bHiveEligible || Cell.bHiveSpawned) continue;
        if (!CheckGlobalCooldownAndCap()) continue;

        const float PSpawn = ComputeHiveSpawnProbability(CellCoord, Cell);
        if (FMath::FRand() > PSpawn) continue;

        const FVector SpawnLoc = GetCellCenter(CellCoord)
            + FVector(FMath::RandRange(-200.f, 200.f), FMath::RandRange(-200.f, 200.f), 0.f);

        // Verify the WP cell at this location is loaded before spawning
        if (WPS && !WPS->IsStreamingCompleted())
        {
            // Queue for next evaluation cycle — do not spawn into unloaded cell
            continue;
        }

        GetWorld()->SpawnActor<AAlienHive>(HiveClass, SpawnLoc, FRotator::ZeroRotator);
        Cell.bHiveSpawned = true;
        RegisterGlobalHiveSpawnCooldown();

        FHiveSpawnedMessage Msg{ CellCoord, SpawnLoc, FGuid::NewGuid() };
        UGameplayMessageSubsystem::Get(this).BroadcastMessage(TAG_Event_Hive_Spawned, Msg);
    }
}
```

### Architecture Diagram

```
UInfectionSpreadSubsystem (UWorldSubsystem)
│
├── GetWorld()->GetTimerManager():
│   ├── NearZoneTickHandle  (10s)   → TickNearZone()
│   ├── FarZoneTickHandle   (60s)   → TickFarZone()
│   └── HiveSpawnCheckHandle (30s)  → EvaluateHiveSpawns()
│
├── TMap<FIntPoint, FCellInfectionData>  CellData
├── TArray<FInfectionSourceData>         ActiveSources
├── TArray<FCureZoneData>                ActiveCureZones
├── TArray<AActor*>                      NavBlockerPool (K_NavBlockerPoolSize=32, persistent level)
│
├── READS FROM:
│   ├── UPhysicsHelperSubsystem::GetSurfaceType(FVector) → M_terrain modifier
│   ├── AHostileWorldPlayerController → GetPawn()->GetActorLocation() [near-zone boundary]
│   └── UHostileWorldGSM::OnStateChanged → pause/resume tick timers
│
├── WRITES TO (via interface only — forbidden_pattern: direct_data_layer_write):
│   └── ISceneManagementInterface::RequestDataLayerSwap(ZoneId, TargetLayer)
│
├── BROADCASTS (ADR-0001 patterns):
│   ├── FCellStateChangedDelegate OnCellStateChanged  (DECLARE_DYNAMIC_MULTICAST_DELEGATE)
│   │   └── Callers: Player Controller, HUD (AddUObject() in BeginPlay/Init)
│   └── UGameplayMessageSubsystem::BroadcastMessage<FHiveSpawnedMessage>(TAG_Event_Hive_Spawned)
│       └── Callers: Audio System, Quest System (RegisterListener in their Init)
│
└── IMPLEMENTS:
    ├── IInfectionSpreadInterface  (external query API — all callers use this; no direct cast)
    └── IHostileSaveProvider       (PopulateSaveData / LoadFromSaveData → ADR-0006)
```

### Key Interfaces

```cpp
// ── External query interface ──
// All callers obtain via Cast<IInfectionSpreadInterface>(GetWorld()->GetSubsystem<UInfectionSpreadSubsystem>())
// or via dependency injection. No system may cast to UInfectionSpreadSubsystem directly.

UINTERFACE(MinimalAPI, NotBlueprintable)
class UInfectionSpreadInterface : public UInterface { GENERATED_BODY() };

class IInfectionSpreadInterface
{
    GENERATED_BODY()
public:
    // Cell queries
    virtual float GetCellInfectionLevel(FIntPoint CellCoords) const = 0;
    virtual ECellInfectionState GetCellState(FIntPoint CellCoords) const = 0;
    virtual TArray<FCellInfectionData> GetNearbyCellInfectionLevels(FVector Location, float Radius) const = 0;
    virtual float GetZoneInfectionLevel(FName ZoneId) const = 0;  // Formula 6 zone aggregate

    // Source queries
    virtual int32 GetActiveSourceCount(FName ZoneId) const = 0;
    virtual TArray<FInfectionSource> GetSourcesInRadius(FVector Location, float Radius) const = 0;

    // Player actions
    virtual bool DamageInfectionSource(FGuid SourceId, float Amount) = 0;  // true = destroyed
    virtual bool DeployCure(FVector Location) = 0;                          // false = no cures held

    // Event subscription (callers call AddUObject on the exposed delegate directly)
    // OnCellStateChanged is a public UPROPERTY — no subscription wrapper needed
    // DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FCellStateChangedDelegate,
    //     const FCellStateChangedPayload&, Payload)
};

// NOTE: Save/Load methods (SaveInfectionState / RestoreInfectionState) are NOT on
// IInfectionSpreadInterface. They are handled exclusively by IHostileSaveProvider
// (PopulateSaveData / LoadFromSaveData) called by USaveLoadSubsystem. The GDD
// interface contract section was an earlier draft; this ADR supersedes it.

// ── Save/Load ──
// UInfectionSpreadSubsystem::PopulateSaveData(UHostileWorldSaveGame& Save):
//   Compacts ActiveSources (omits bDestroyed entries).
//   Omits zero-state cells (InfectionLevel==0, State==Clean, no sources in range).
//   Writes Save.InfectionState = FInfectionStateData{...}
//
// UInfectionSpreadSubsystem::LoadFromSaveData(const UHostileWorldSaveGame& Save):
//   Restores CellData and ActiveSources. Rebuilds ActiveSourceIds per cell.
//   Restarts timers (called after OnWorldBeginPlay timer setup completes).

// ── Zone-wide hive spawn message (GameplayMessageRouter, ADR-0001 global broadcast) ──
USTRUCT(BlueprintType)
struct FHiveSpawnedMessage
{
    GENERATED_BODY()
    UPROPERTY() FIntPoint CellCoords;
    UPROPERTY() FVector SpawnLocation;
    UPROPERTY() FGuid NewHiveId;
};
// Tag: TAG_Event_Hive_Spawned
```

## Alternatives Considered

### Alternative A: FTickableWorldSubsystem (Override Tick())
- **Description**: Inherit from `UWorldSubsystem` and `FTickableWorldSubsystem`. Override `Tick(float DeltaTime)` and accumulate DeltaTime internally to fire at 10 s/60 s intervals.
- **Pros**: Single inheritance path; DeltaTime accumulation straightforward.
- **Cons**: Fires every frame (~60 fps). Meaningful work occurs once every 600 frames (near-tick) or 3,600 frames (far-tick). Per-frame overhead for zero-work frames is pure waste.
- **Rejection Reason**: `FTimerHandle` fires exactly at the target interval with zero per-frame cost. Idiomatic UE5 solution for low-frequency timed events on subsystems.

### Alternative B: UGameInstanceSubsystem (Session-persistent)
- **Description**: Use `UGameInstanceSubsystem` so infection state survives all level transitions, including `OpenLevel()` to Mountain Prison.
- **Pros**: No serialization step before Mountain Prison transition.
- **Cons**: Infection from the open world bleeds into Mountain Prison's world state. Requires explicit `Reset()` call on world change — re-implementing what `UWorldSubsystem::Deinitialize()` provides for free. Incorrect per GDD Rule 8.
- **Rejection Reason**: GDD explicitly mandates `UWorldSubsystem`. `OpenLevel()` correctly destroys the subsystem; ADR-0006 save pipeline handles disk persistence across sessions. This also corrects the ADR-0004 registry error.

### Alternative C: Dedicated UInfectionTickTask (TaskGraph)
- **Description**: Schedule the cell sweep on the TaskGraph every 10 seconds, posting results back to the game thread.
- **Pros**: Keeps simulation off the game thread for CPU-heavy scenarios.
- **Cons**: O(n) cell sweep with n = 50–200 cells and 2–5 sources each is well within the 1.0 ms budget on the game thread. TaskGraph adds significant complexity (thread-safe cell data, deferred result posting, World Partition access restrictions on background threads) for no measurable benefit at projected scale.
- **Rejection Reason**: Premature optimization. Revisit only if profiling shows >1.0 ms budget breaches.

## Consequences

### Positive
- `UWorldSubsystem` lifecycle provides clean initialization and teardown at World Partition world boundaries — no explicit reset needed on `OpenLevel()`.
- `FTimerHandle`-based ticking eliminates per-frame overhead; simulation cost is paid only when work is actually done.
- `IInfectionSpreadInterface` decouples all callers from the concrete subsystem type, enabling isolated testing.
- Pooled `UNavModifierComponent` actors (pre-allocated in persistent level) avoid per-state-change allocation cost and survive WP cell streaming.
- ADR-0004 registry error corrected.

### Negative
- `UWorldSubsystem` is destroyed on `OpenLevel()` to Mountain Prison — the game must trigger an autosave (ADR-0006) before `OpenLevel()` or infection state is lost from memory.
- `FTimerHandle` fire times may drift by up to one frame period (~16 ms) from the target interval. Acceptable for a 10-second simulation; must not be relied upon for frame-accurate timing.
- NavBlockerPool of 32 actors is always allocated regardless of infection state.
- The 5-second first-tick delay means infection does not tick during the first 5 seconds of a session.

### Risks
- **Risk**: WP cell size changes in project settings invalidating `FIntPoint` key space and save data.
  - **Mitigation**: Assert `K_CellSizeWorld` against World Partition actual cell size at `OnWorldBeginPlay()`. Log error and halt if mismatch.
- **Risk**: `UNavArea_Obstacle` blocks alien agents from pathfinding through infected areas they should occupy.
  - **Mitigation**: Use project-specific `UNavArea_InfectionZone` subclass (cost = 1.0 for alien agents via their Navigation Query Filter; impassable for player agent). Alien path requests use a filter that treats `UNavArea_InfectionZone` as passable.
- **Risk**: `EvaluateHiveSpawns()` targets an unloaded WP cell, dropping the spawn silently.
  - **Mitigation**: Check `UWorldPartitionSubsystem::IsStreamingCompleted()` before `SpawnActor`. If cell is not loaded, skip and retry next evaluation cycle (30 s).
- **Risk**: Catch-up calculation on player approach fires too many Data Layer swaps simultaneously, overflowing the ADR-0008 swap queue.
  - **Mitigation**: Catch-up results are always queued via `RequestDataLayerSwap()`, never fired inline. ADR-0008's swap throttle handles queue overflow.
- **Risk**: NavBlockerPool overflow — more than 32 cells simultaneously in Partial+ state in near-zone.
  - **Mitigation**: Cells beyond pool capacity use dynamically allocated (non-pooled) actors. Pool size `K_NavBlockerPoolSize` is a tuning knob. Log warning when dynamic fallback is triggered.
- **Risk**: `FInfectionStateData` too large after long session, causing save hitch.
  - **Mitigation**: Compact on save — omit destroyed sources and zero-state cells. Target < 2 MB. If projected > 2 MB, trigger async partial-save or compress via `FMemoryWriter`.
- **Risk**: `IHostileSaveProvider::LoadFromSaveData()` called before `OnWorldBeginPlay()` timers are registered, producing timers that fail to start.
  - **Mitigation**: `LoadFromSaveData()` stores restored state but does not restart timers. Timer restart occurs in `OnWorldBeginPlay()` after state is applied. Ordering is guaranteed by `USaveLoadSubsystem::LoadSaveOnStartup()` being called from `UGameInstance::OnStart()`, before world begins play.

## GDD Requirements Addressed

| GDD System | Requirement | How This ADR Addresses It |
|------------|-------------|--------------------------|
| infection-spread-system.md | Rule 2 — Cell infection model ticks every 10 seconds (near-zone) | `FTimerHandle NearZoneTickHandle` at 10.0 s interval via `GetWorld()->GetTimerManager()` |
| infection-spread-system.md | Rule 2 — Far-zone tick every 60 seconds | `FTimerHandle FarZoneTickHandle` at 60.0 s interval |
| infection-spread-system.md | Rule 3 — Six-state cell machine (Clean → Hive Core) | `ECellInfectionState` enum; state evaluated in `TickNearZone`/`TickFarZone` after `InfectionLevel` update |
| infection-spread-system.md | Rule 5 — Procedural hive spawning every 30 seconds | `FTimerHandle HiveSpawnCheckHandle` at 30.0 s; Formula 4 (P_spawn) in `EvaluateHiveSpawns()` |
| infection-spread-system.md | Rule 6 — Procedural Biomass Node spawning on Exposed→Partial | Evaluated in `EvaluateCellStateTransitions()` at the Partial threshold crossing |
| infection-spread-system.md | Rule 8 — `UWorldSubsystem` scoped to UWorld | Confirmed: `UInfectionSpreadSubsystem : public UWorldSubsystem` |
| infection-spread-system.md | Rule 8 — Pause ticks in GSM Paused/GameOver | `OnGSMStateChanged()` calls `PauseTimer()`/`UnPauseTimer()` on all three handles |
| infection-spread-system.md | Rule 8 — Analytical catch-up on approach (T_catchup_max = 1800 s) | `ApplyCatchUp()` recomputes `P_cell` from current sources; `ElapsedSec` clamped to 1800 s |
| infection-spread-system.md | Interface Contract — `IInfectionSpreadInterface` | Formalized with 8 methods (save/load removed — handled by `IHostileSaveProvider`) |
| infection-spread-system.md | Interactions — Scene Management: `RequestDataLayerSwap` | `direct_data_layer_write` forbidden pattern enforced; only `ISceneManagementInterface` used |
| infection-spread-system.md | Interactions — Save/Load: persist full infection state | `IHostileSaveProvider::PopulateSaveData` / `LoadFromSaveData` (ADR-0006) |
| infection-spread-system.md | Interactions — NavMesh: path blocking in Partial+ cells | Pooled `UNavModifierComponent` actors in persistent level; `UNavArea_InfectionZone` subclass |
| infection-spread-system.md | Performance — <1.0 ms near-tick, <2.0 ms far-tick | Timer-based (zero per-frame cost); O(cells × sources) sweep well within budget |

## Performance Implications
- **CPU (Near-Tick)**: O(cells_near × sources_per_cell). At 50 near-zone cells × 5 sources: ~250 float ops per 10 s tick. Target < 1.0 ms.
- **CPU (Far-Tick)**: O(cells_far × sources_per_cell). At 200 far-zone cells × 3 sources: ~600 float ops per 60 s tick. Target < 2.0 ms.
- **CPU (Hive spawn check)**: O(eligible_cells). At cap 3 per zone: < 0.1 ms per 30 s.
- **Memory**: `TMap<FIntPoint, FCellInfectionData>` ~200 cells × ~80 bytes = ~16 KB. `TArray<FInfectionSourceData>` ~20 × ~64 bytes = ~1.3 KB. `NavBlockerPool` 32 actors × ~1 KB = ~32 KB. Total: well under 2 MB.
- **Load Time**: No impact — subsystem initialized at world load.
- **Network**: N/A — single-player.

## Migration Plan
Greenfield implementation — no existing code to migrate. One registry correction required: remove `UInfectionSubsystem` from the `subsystem_session_tier` (UGameInstanceSubsystem) entry in `docs/registry/adr-subsystems.yaml` and add it to `subsystem_world_tier` (UWorldSubsystem). Applied in Step 6 of this session.

## Validation Criteria
- **Formula 2 (near-tick)**: Given Vent at cell center (H=2, R=1500, d=0), I_old=0, K_spread_rate=6.0, T_tick=10: I_new = clamp(0 + (2/6.0) × 10, 0, 100) = 3.33. Verified by unit test.
- **Formula 1 (P_cell)**: Given Hive at 2000 cm (H=10, R=5000) + Node at 1000 cm (H=5, R=2500), clear weather, open terrain: P_cell = 8.4 + 4.2 = 12.6. Verified by unit test.
- **Formula 4 (hive spawn)**: Given cell 1000 cm from player, 30 min into game, R_random=1.2: P_spawn = 0.486. Verified by unit test.
- **GSM pause**: Ticks pause within one frame of GSM entering Paused state. Near-tick does not fire while paused. Verified by test with `RequestStateTransition(PauseEvent)`.
- **Save round-trip**: Full `PopulateSaveData` → `LoadFromSaveData` cycle preserves all `CellData` entries and `ActiveSources` with exact float values.
- **Cell size assertion**: `K_CellSizeWorld` matches WP project cell size on `OnWorldBeginPlay()`. If mismatch, error is logged.
- **NavMesh pool**: Pool actors at Z=-100000 produce zero nav dirty events. Verified by checking NavMesh before/after `OnWorldBeginPlay()` — no dirty tiles.
- **Timer correctness**: `GetWorld()->GetTimerManager().SetTimer()` compiles and fires on `UWorldSubsystem` (not `GetWorldTimerManager()` which does not exist on this class).

## Related Decisions
- ADR-0001: Cross-system communication (`DYNAMIC_MULTICAST_DELEGATE` + `GameplayMessageRouter`)
- ADR-0004: Subsystem tier — registry entry corrected by this ADR (`UInfectionSpreadSubsystem` = `UWorldSubsystem`)
- ADR-0006: Save/Load serialization (`IHostileSaveProvider` implementation)
- ADR-0008: Scene streaming (`RequestDataLayerSwap` as sole Data Layer write path)
- ADR-0012: Alien AI system (`UNavModifierComponent` pool pattern reused; `GetCellInfectionLevel` interface defined here)
- `design/gdd/infection-spread-system.md` (all rules, formulas, tuning knobs, and acceptance criteria)
