# ADR-0006: Save/Load Serialization Architecture

## Status
Proposed

## Date
2026-05-19

## Engine Compatibility

| Field | Value |
|-------|-------|
| **Engine** | Unreal Engine 5.7 |
| **Domain** | Core / Persistence |
| **Knowledge Risk** | HIGH — UE 5.4–5.7 post-cutoff; `AsyncSaveGameToSlot` / `AsyncLoadGameFromSlot` API and delegate signatures may have changed |
| **References Consulted** | `docs/engine-reference/unreal/VERSION.md` — no persistence module doc exists; see Verification Required |
| **Post-Cutoff APIs Used** | `UGameplayStatics::AsyncSaveGameToSlot()`, `UGameplayStatics::AsyncLoadGameFromSlot()` — available pre-5.3 but behavior may have changed in 5.4–5.7 |
| **Verification Required** | (1) Confirm `AsyncSaveGameToSlot` delegate signature in UE 5.7 `GameplayStatics.h`. (2) Confirm `USaveGame` UPROPERTY serialization handles nested USTRUCT arrays correctly in 5.7. (3) Verify slot file path on Windows (saved/SaveGames/). (4) Confirm save/load works correctly in PIE without persisting between sessions. |

## ADR Dependencies

| Field | Value |
|-------|-------|
| **Depends On** | ADR-0004 (defines `USaveLoadSubsystem : UGameInstanceSubsystem` as the owning subsystem for this strategy) |
| **Enables** | ADR-XXXX Save/Load GDD implementation; Tutorial System (FTutorialProgress persistence), Quest (quest state), Faction (standing), Inventory (item list), Infection Spread (spread percentage) |
| **Blocks** | All implementation stories for `USaveLoadSubsystem`, `FHostileWorldSaveData`, and any subsystem's `LoadFromSaveData` |
| **Ordering Note** | Must be Accepted before any subsystem author writes save/load code. The GDD for Save/Load System (#6 in systems-index) should be authored using this ADR as the architectural baseline. |

## Context

### Problem Statement
`USaveLoadSubsystem` (declared Session-tier in ADR-0004) has no defined serialization format, slot strategy, save-trigger policy, or cross-subsystem data aggregation pattern. Without this ADR, each contributing subsystem (Quest, Faction, Inventory, Tutorial, Infection Spread) will independently invent incompatible save formats and trigger mechanisms, producing a fragmented persistence layer that cannot be maintained or extended.

### Constraints
- Single-player only — no cloud sync, no cross-device concerns at this stage
- `USaveLoadSubsystem` is already locked as `UGameInstanceSubsystem` (ADR-0004); this ADR defines its *implementation* only
- No player-visible slot management — design decision: autosave-only at checkpoints, no manual save
- Save must not block the game thread (survival games have open-world checkpoint zones; a synchronous save would hitch at the worst moment)
- Subsystems are peer-initialized in undefined order (ADR-0004 lazy-access rule); the save aggregation pattern must tolerate this
- Knowledge risk is HIGH — `AsyncSaveGameToSlot` signature must be verified against UE 5.7 before implementation

### Requirements
- Must support single autosave slot with no player slot-management UI
- Must save automatically when the player reaches a checkpoint — no manual save option
- Must aggregate save data from all contributing subsystems without `USaveLoadSubsystem` holding compile-time includes to each one
- Must handle async save completion (success/failure) without crashing on failure
- Must load save data before the first gameplay level is presented to the player
- Must be safe to call from within `UGameInstanceSubsystem` lifecycle (after `Initialize()` completes)

## Decision

### Core Pattern: `USaveGame` + `IHostileSaveProvider` + Async I/O

`USaveLoadSubsystem` owns a single save slot. It uses UE's built-in `USaveGame` subclass as the serialization container, saves asynchronously via `UGameplayStatics::AsyncSaveGameToSlot`, and aggregates data from all contributing subsystems via a `IHostileSaveProvider` UInterface.

---

### Save Data Schema

```cpp
// Each provider owns one named sub-struct inside the root save object.
// Adding a new provider = add one USTRUCT + one UPROPERTY here. Nothing else changes.

USTRUCT(BlueprintType)
struct FTutorialSaveData
{
    GENERATED_BODY()
    UPROPERTY() TSet<FName> CompletedHintIDs;
    UPROPERTY() TSet<FName> DismissedHintIDs;
};

USTRUCT(BlueprintType)
struct FQuestSaveData
{
    GENERATED_BODY()
    UPROPERTY() TMap<FName, EQuestStatus> QuestStates;
    UPROPERTY() TArray<FName> ActiveObjectiveIDs;
};

USTRUCT(BlueprintType)
struct FFactionSaveData
{
    GENERATED_BODY()
    UPROPERTY() TMap<FName, int32> FactionStandings; // FactionID → reputation points
};

USTRUCT(BlueprintType)
struct FInventorySaveData
{
    GENERATED_BODY()
    UPROPERTY() TArray<FInventoryItemEntry> Items;
};

USTRUCT(BlueprintType)
struct FInfectionSaveData
{
    GENERATED_BODY()
    UPROPERTY() float GlobalSpreadPercentage;
    UPROPERTY() TMap<FName, float> ZoneSpreadOverrides; // ZoneID → local %
};

// Root save object — one per save slot.
UCLASS()
class UHostileWorldSaveGame : public USaveGame
{
    GENERATED_BODY()
public:
    UPROPERTY() FTutorialSaveData  TutorialData;
    UPROPERTY() FQuestSaveData     QuestData;
    UPROPERTY() FFactionSaveData   FactionData;
    UPROPERTY() FInventorySaveData InventoryData;
    UPROPERTY() FInfectionSaveData InfectionData;

    UPROPERTY() FString SaveVersion = TEXT("1.0");
    UPROPERTY() FDateTime SaveTimestamp;
};
```

**Schema evolution**: Add new fields with a default value. `USaveGame` deserialization skips unknown properties and zero-initializes missing ones — forward and backward compatibility is maintained as long as fields are never removed (only added or deprecated with a rename).

---

### ISaveProvider Interface

Each contributing subsystem declares it implements `IHostileSaveProvider` and self-registers with `USaveLoadSubsystem` in its `Initialize()`.

```cpp
UINTERFACE(MinimalAPI)
class UHostileSaveProvider : public UInterface { GENERATED_BODY() };

class IHostileSaveProvider
{
    GENERATED_BODY()
public:
    // Called by USaveLoadSubsystem before writing to disk. Provider fills its sub-struct.
    virtual void PopulateSaveData(UHostileWorldSaveGame& OutSave) = 0;

    // Called by USaveLoadSubsystem after loading from disk. Provider reads its sub-struct.
    virtual void LoadFromSaveData(const UHostileWorldSaveGame& InSave) = 0;
};
```

Subsystem registration pattern:

```cpp
void UQuestSubsystem::Initialize(FSubsystemCollectionBase& Collection)
{
    Super::Initialize(Collection);
    // USaveLoadSubsystem is a peer — use lazy access, not cached ptr.
    // Registration deferred to first call via a flag, OR:
    // Force initialize the save subsystem first so we can register immediately.
    Collection.InitializeDependency<USaveLoadSubsystem>();
    GetGameInstance()->GetSubsystem<USaveLoadSubsystem>()->RegisterProvider(this);
}
```

`USaveLoadSubsystem` tracks providers:

```cpp
UCLASS()
class USaveLoadSubsystem : public UGameInstanceSubsystem
{
    GENERATED_BODY()
public:
    void RegisterProvider(IHostileSaveProvider* Provider);
    void TriggerAutosave();    // Called by checkpoint listener
    void LoadSaveOnStartup();  // Called from GameInstance::Init() after all subsystems init

private:
    TArray<IHostileSaveProvider*> SaveProviders;
    static constexpr TCHAR* SaveSlotName = TEXT("hostile_world_autosave");
    static constexpr int32  SaveUserIndex = 0;

    // Must be UFUNCTION — lambda captures are not GC-safe with async delegates
    UFUNCTION() void OnSaveComplete(const FString& SlotName, int32 UserIndex, bool bSuccess);
    UFUNCTION() void OnLoadComplete(const FString& SlotName, int32 UserIndex, USaveGame* SaveGame);
};
```

---

### Save Trigger: Checkpoint → Gameplay Message Router

Checkpoint actors broadcast a global message when the player enters their volume. `USaveLoadSubsystem` listens and triggers the async save. This keeps `USaveLoadSubsystem` decoupled from checkpoint actor implementation.

```cpp
// Checkpoint actor broadcasts this when player overlaps trigger volume
USTRUCT()
struct FCheckpointReachedMessage { GENERATED_BODY() };

// USaveLoadSubsystem — registered in Initialize()
void USaveLoadSubsystem::Initialize(FSubsystemCollectionBase& Collection)
{
    Super::Initialize(Collection);
    CheckpointHandle = UGameplayMessageSubsystem::Get(this)
        .RegisterListener<FCheckpointReachedMessage>(
            TAG_Event_Checkpoint_Reached,
            this, &USaveLoadSubsystem::OnCheckpointReached);
}

void USaveLoadSubsystem::OnCheckpointReached(FGameplayTag, const FCheckpointReachedMessage&)
{
    TriggerAutosave();
}
```

---

### Async Save/Load Flow

```
SAVE:
  FCheckpointReachedMessage broadcast
    → USaveLoadSubsystem::TriggerAutosave()
      → Create UHostileWorldSaveGame (or update cached instance)
      → For each ISaveProvider: PopulateSaveData(SaveGame)
      → AsyncSaveGameToSlot(SaveGame, SlotName, UserIndex, OnSaveComplete delegate)
        → OnSaveComplete(bSuccess) — log warning on failure, no crash

LOAD (startup):
  UGameInstance::Init()
    → All UGameInstanceSubsystems initialize (order: USaveLoadSubsystem first via dependency)
    → USaveLoadSubsystem::LoadSaveOnStartup()  [called from OnStart(), not Init() — see Risk below]
      → AsyncLoadGameFromSlot(SlotName, UserIndex, FAsyncLoadGameFromSlotDelegate::CreateUObject(this, &USaveLoadSubsystem::OnLoadComplete))
        → OnLoadComplete: if SaveGame != nullptr, for each ISaveProvider: LoadFromSaveData(SaveGame)
        → if SaveGame == nullptr: no save file — providers use defaults (fresh game)
      → Notify GameInstance that load is complete (transition to main menu)
```

---

### Architecture Diagram

```
UGameInstance
└── USaveLoadSubsystem  (Session-tier, ADR-0004)
      │  owns: UHostileWorldSaveGame* CachedSave
      │  owns: TArray<IHostileSaveProvider*> SaveProviders
      │  listens: TAG_Event_Checkpoint_Reached (Gameplay Message Router)
      │
      ├── UQuestSubsystem      implements IHostileSaveProvider → FQuestSaveData
      ├── UFactionSubsystem    implements IHostileSaveProvider → FFactionSaveData
      ├── UInventorySubsystem  implements IHostileSaveProvider → FInventorySaveData
      ├── UInfectionSubsystem  implements IHostileSaveProvider → FInfectionSaveData
      └── UTutorialSubsystem   implements IHostileSaveProvider → FTutorialSaveData

ACheckpointActor (UWorld) — broadcasts FCheckpointReachedMessage
  → USaveLoadSubsystem listens → TriggerAutosave()
    → UGameplayStatics::AsyncSaveGameToSlot(UHostileWorldSaveGame, "hostile_world_autosave", 0, ...)
```

### Key Interfaces

| Interface / API | Owner | Consumers |
|----------------|-------|-----------|
| `IHostileSaveProvider` UInterface | `USaveLoadSubsystem` declares | All 5 contributing subsystems implement |
| `RegisterProvider(IHostileSaveProvider*)` | `USaveLoadSubsystem` | Called by each provider in `Initialize()` |
| `TriggerAutosave()` | `USaveLoadSubsystem` | Checkpoint listener (internal); exposed for testing |
| `LoadSaveOnStartup()` | `USaveLoadSubsystem` | `UGameInstance::Init()` after subsystem init |
| `TAG_Event_Checkpoint_Reached` | `FCheckpointReachedMessage` | `ACheckpointActor` broadcasts; `USaveLoadSubsystem` listens |
| `UHostileWorldSaveGame` | Save/Load subsystem | All providers read/write through subsystem methods — never directly |

## Alternatives Considered

### Alternative 1: Custom FArchive Binary Serialization
- **Description**: Each subsystem implements custom `operator<<` with `FArchive`; `USaveLoadSubsystem` writes raw binary to disk via `IPlatformFile`
- **Pros**: Maximum control over bit layout; smallest file size; no reflection overhead
- **Cons**: Manual versioning; no hot-reload safety; no Blueprint visibility; significantly more code per subsystem
- **Rejection Reason**: `USaveGame` + UPROPERTY reflection handles versioning, Blueprint access, and engine tooling automatically. Custom binary is only justified by size/performance constraints that do not exist at indie scale with a single save slot.

### Alternative 2: JSON Serialization (FJsonSerializer)
- **Description**: Serialize `FHostileWorldSaveData` to JSON via `TJsonWriter`; write to `Saved/` directory; load via `TJsonReader`
- **Pros**: Human-readable — easy to inspect/debug save files; moddable
- **Cons**: Slower serialization; larger file; no engine-native slot management (must reimplement `DoesSaveGameExist`, slot listing, etc.); no Blueprint reflection
- **Rejection Reason**: Debug benefit does not outweigh infrastructure cost. `USaveGame` binary is inspectable enough via UE debugger. JSON would be worth revisiting only if save modding becomes a design goal.

### Alternative 3: Hardcoded Subsystem Calls (No Interface)
- **Description**: `USaveLoadSubsystem` directly calls `GetSubsystem<UQuestSubsystem>()->GetSaveData()`, etc. for each known subsystem
- **Pros**: Simple, no UInterface boilerplate
- **Cons**: `USaveLoadSubsystem` holds compile-time includes to every contributing subsystem; adding a new provider requires editing `USaveLoadSubsystem.cpp`; violates ADR-0001 (direct cross-system coupling)
- **Rejection Reason**: Breaks state ownership contract. The interface pattern allows new systems to opt into persistence without touching the save subsystem.

### Alternative 4: Gameplay Message Router for Save Aggregation
- **Description**: `USaveLoadSubsystem` broadcasts a `FCollectSaveDataMessage`; each provider fills its portion of a shared buffer and re-broadcasts
- **Pros**: Fully decoupled; no registration needed
- **Cons**: Non-deterministic completion order; no guarantee all providers have responded before the write fires; harder to test; async accumulation over message bus is an anti-pattern
- **Rejection Reason**: Order-of-completion is undefined. `ISaveProvider` registration gives deterministic, synchronous aggregation before the async write begins.

## Consequences

### Positive
- Any new system adds persistence by implementing `IHostileSaveProvider` and registering — no changes to `USaveLoadSubsystem`
- `USaveGame` + UPROPERTY handles forward/backward schema compatibility automatically (new fields default-initialized on old saves)
- Async I/O means the save never blocks the game thread — no hitch at checkpoint
- Single slot means no slot-management UI, edge cases (delete, overwrite confirm), or slot-selection GDD needed
- `FCheckpointReachedMessage` keeps `ACheckpointActor` decoupled from persistence layer (ADR-0001 pattern)

### Negative
- Single save slot — player cannot maintain multiple play sessions or experiment freely. Design intent (autosave-only) accepts this trade-off deliberately.
- `Collection.InitializeDependency<USaveLoadSubsystem>()` creates an explicit ordering dependency from each provider to the save subsystem — boilerplate required in each provider's `Initialize()`
- No manual save means players cannot save-scum before a dangerous encounter. This is a design choice (tense survival), not a technical limitation.
- `AsyncSaveGameToSlot` failure handling is a warning log only — no retry or fallback. If the save disk is full, data is silently lost until next checkpoint.

### Risks
- **Risk**: Async delegate binding — `FAsyncSaveGameToSlotDelegate` and `FAsyncLoadGameFromSlotDelegate` must be bound via `CreateUObject(this, &UClass::Method)` to a `UFUNCTION` member. Lambda captures are not GC-safe with async save delegates and can silently fail. **Mitigation**: All async bind sites must use `CreateUObject`; no `CreateLambda` for save/load callbacks. (Engine specialist finding — verified UE 5.4 behavior.)
- **Risk**: `AsyncLoadGameFromSlot` in `UGameInstance::Init()` — some platform backends (console) internally call `GetWorld()` during load. On PC/Windows this is safe, but the call site is moved to `UGameInstance::OnStart()` to guarantee world is available. **Mitigation**: `LoadSaveOnStartup()` is called from `OnStart()`, not `Init()`. If targeting consoles in future, verify platform-specific async save backend behavior.
- **Risk**: `USaveGame` UPROPERTY serialization silently drops data if a USTRUCT lacks `GENERATED_BODY()` or is not marked `UPROPERTY()`. **Mitigation**: All save sub-structs must include both; add a compile-time static assert in `UHostileWorldSaveGame` constructor verifying struct sizes are non-zero.
- **Risk**: `IHostileSaveProvider*` raw pointer in `TArray<IHostileSaveProvider*>` may dangle if a provider is garbage-collected before save fires. **Mitigation**: Providers are `UGameInstanceSubsystem` instances — they live for the full session; GC cannot collect them while `GameInstance` is alive. No `TWeakInterfacePtr` needed at this scope. Add a defensive `IsValid()` guard before dispatch anyway.
- **Risk**: Nested USTRUCT fields holding `UObject*` or `TObjectPtr<>` — these are silently dropped during `USaveGame` serialization. **Mitigation**: All save sub-structs (`FTutorialSaveData`, `FQuestSaveData`, etc.) must contain only primitive types, FString, FName, TArray, TMap, TSet of primitives/FName/FString. Zero `UObject*` members allowed in any save struct. Code review check required on every save struct addition. (Engine specialist finding.)
- **Risk**: Load-before-play ordering — if `GameInstance::Init()` fires before all subsystems finish registering, `LoadFromSaveData` may be called on an unregistered provider. **Mitigation**: `LoadSaveOnStartup()` is deferred until all `Initialize()` calls complete (UE guarantees subsystem init before `Init()` returns). Document this invariant in `USaveLoadSubsystem.h`.
- **Risk**: Fresh-game path (no save file) — `AsyncLoadGameFromSlot` returns nullptr. **Mitigation**: Explicit null check; providers use hardcoded defaults if `InSave == nullptr` (they should work correctly with a zero-initialized save struct).

## GDD Requirements Addressed

| GDD System | Requirement | How This ADR Addresses It |
|------------|-------------|--------------------------|
| tutorial-system.md | TR-tutorial-006: Persist completed/dismissed HintIDs via Save/Load (`FTutorialProgress`); load skips trigger registration for terminal hints | `FTutorialSaveData` sub-struct in `UHostileWorldSaveGame`; `UTutorialSubsystem` implements `IHostileSaveProvider`; `LoadFromSaveData` restores completed/dismissed IDs before first level triggers register |
| systems-index.md | Save/Load System (#6) depends on Game State Machine — must survive level transitions | `USaveLoadSubsystem` is Session-tier (ADR-0004); persists across level transitions; load fires from `GameInstance::Init()` before any level loads |

*Note: Save/Load GDD (#6 in systems-index) has Status: Not Started. That GDD should be authored using this ADR as its architectural baseline. Its TR-save-XXX requirements will be backfilled into this table when authored.*

## Performance Implications
- **CPU**: `TriggerAutosave()` iterates `N` providers synchronously to collect data (N ≤ 10; sub-millisecond). Disk write is async — zero game-thread cost after collection.
- **Memory**: `UHostileWorldSaveGame` instance held in memory for session; size is bounded by save data volume (expected < 100KB for this game's scope).
- **Load Time**: `AsyncLoadGameFromSlot` fires during `GameInstance::Init()` — before the loading screen is shown. No gameplay frame is affected.
- **Network**: N/A — single-player.

## Migration Plan
No existing save code to migrate. `USaveLoadSubsystem` is a new class. When the Save/Load GDD is authored, it must reference this ADR and align its rules with the schema and trigger policy defined here.

## Validation Criteria
- `USaveLoadSubsystem::TriggerAutosave()` called from a test checkpoint → `UHostileWorldSaveGame` serialized to `Saved/SaveGames/hostile_world_autosave.sav` on disk
- `AsyncLoadGameFromSlot` with the autosave slot name → all 5 providers' `LoadFromSaveData()` called with non-null `UHostileWorldSaveGame`
- Fresh game (no save file) → `AsyncLoadGameFromSlot` returns nullptr → all providers initialize with defaults, no crash
- `UTutorialSubsystem` marks hint `H_001` complete → `TriggerAutosave()` → kill PIE → re-enter PIE → `FTutorialSaveData.CompletedHintIDs` contains `H_001`
- Game thread frame time: no hitch > 1ms at checkpoint (measured via `stat game` with save in flight)
- No subsystem calls `GetSubsystem<T>()` on a peer inside `Initialize()` without `Collection.InitializeDependency<T>()` guard (static analysis / code review check)

## Related Decisions
- ADR-0001: Cross-System Communication — `FCheckpointReachedMessage` uses Gameplay Message Router (global broadcast pattern)
- ADR-0004: Subsystem & Module Architecture — `USaveLoadSubsystem` is Session-tier `UGameInstanceSubsystem`; lazy-access and dependency-initialization rules apply
- ADR-0005: Game Data Strategy — Save data is runtime state (not game data); `USaveGame` is correct here, not `UDataTable`
