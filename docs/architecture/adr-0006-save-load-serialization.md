# ADR-0006: Save/Load Serialization Architecture

## Status
Proposed

## Date
2026-05-21 (C1 alignment — schema complete, triggers/load-sequence corrected)

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
- **Excluded from save slot: input bindings.** Per C4 resolution (2026-05-26), runtime key rebindings are owned exclusively by ADR-0003 and persisted via `UEnhancedInputUserSettings::SaveSettings()` to its own profile-scoped file. They are **not** mirrored into `USaveGame` — bindings apply across all save slots and new-game sessions, so per-slot storage would force re-binding after every new game.

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

All 11 GDD Rule 3 domains are represented. Each provider owns exactly one sub-struct in the root save object. Adding a new provider = add one USTRUCT + one UPROPERTY. Nothing else changes.

```cpp
// ── Player Transform ──────────────────────────────────────────────────────────
USTRUCT(BlueprintType)
struct FPlayerTransformSaveData
{
    GENERATED_BODY()
    UPROPERTY() FVector Location;
    UPROPERTY() float   Yaw;    // Pitch/Roll are cosmetic and not restored
};

// ── Health ────────────────────────────────────────────────────────────────────
USTRUCT(BlueprintType)
struct FHealthSaveData
{
    GENERATED_BODY()
    UPROPERTY() float         CurrentHP;
    UPROPERTY() float         MaxHP;
    UPROPERTY() TArray<FName> ActiveStatusEffectIDs; // FName refs to data-table rows
};

// ── Inventory ─────────────────────────────────────────────────────────────────
USTRUCT(BlueprintType)
struct FInventorySaveData
{
    GENERATED_BODY()
    UPROPERTY() TArray<FInventoryItemEntry> Items; // FInventoryItemEntry: FName ItemID + int32 Count
};

// ── Crafting ──────────────────────────────────────────────────────────────────
USTRUCT(BlueprintType)
struct FCraftingSaveData
{
    GENERATED_BODY()
    UPROPERTY() TSet<FName> UnlockedSchematicIDs;
};

// ── Infection Spread ──────────────────────────────────────────────────────────
USTRUCT(BlueprintType)
struct FInfectionSaveData
{
    GENERATED_BODY()
    UPROPERTY() float              GlobalSpreadPercentage;
    UPROPERTY() TMap<FName, float> ZoneSpreadOverrides;  // ZoneID → local %
    // TODO-C6: active spread vectors (direction + source zone) deferred pending
    //   C6 resolution (ADR-0004 Session-tier vs ADR-0013 World-tier infection conflict).
};

// ── Faction Reputation ────────────────────────────────────────────────────────
USTRUCT(BlueprintType)
struct FFactionSaveData
{
    GENERATED_BODY()
    UPROPERTY() TMap<FName, int32> FactionStandings; // FactionID → reputation points
};

// ── Investigation ─────────────────────────────────────────────────────────────
USTRUCT(BlueprintType)
struct FInvestigationSaveData
{
    GENERATED_BODY()
    UPROPERTY() TSet<FName>   CompletedClueIDs;
    UPROPERTY() TArray<FName> ActiveObjectiveIDs;
};

// ── World Flags ───────────────────────────────────────────────────────────────
USTRUCT(BlueprintType)
struct FActorInteractionFlag
{
    GENERATED_BODY()
    UPROPERTY() FGuid  ActorGUID;    // stable GUID assigned to each flagged world actor
    UPROPERTY() uint8  FlagBitfield; // bit 0=looted, 1=opened, 2=collected, 3=destroyed
};

USTRUCT(BlueprintType)
struct FWorldFlagsSaveData
{
    GENERATED_BODY()
    UPROPERTY() TArray<FActorInteractionFlag> ActorFlags;
};

// ── Map System ────────────────────────────────────────────────────────────────
USTRUCT(BlueprintType)
struct FHostileMapMarker
{
    GENERATED_BODY()
    UPROPERTY() FVector  Location;
    UPROPERTY() FString  Label;
};

USTRUCT(BlueprintType)
struct FMapSaveData
{
    GENERATED_BODY()
    UPROPERTY() TMap<FName, uint8>           ZoneFogBitmask;       // ZoneID → revealed bitmask
    UPROPERTY() TArray<FName>                AutoPinnedLocationIDs;
    UPROPERTY() TArray<FHostileMapMarker>    ManualMarkers;
};

// ── Tutorial ──────────────────────────────────────────────────────────────────
USTRUCT(BlueprintType)
struct FTutorialSaveData
{
    GENERATED_BODY()
    UPROPERTY() TSet<FName> CompletedHintIDs;
    // DismissedHintIDs removed — DISMISSED state deleted in Tutorial GDD Rule 5 (C5 fix)
};

// ── Game State Machine ────────────────────────────────────────────────────────
USTRUCT(BlueprintType)
struct FGSMSaveData
{
    GENERATED_BODY()
    UPROPERTY() FName LastValidState = FName("Playing"); // always Playing or Paused at save time
};

// ── Quest ─────────────────────────────────────────────────────────────────────
USTRUCT(BlueprintType)
struct FQuestSaveData
{
    GENERATED_BODY()
    UPROPERTY() TMap<FName, EQuestStatus> QuestStates;
    UPROPERTY() TArray<FName>             ActiveObjectiveIDs;
};

// ── Root save object — one per slot ──────────────────────────────────────────
UCLASS()
class UHostileWorldSaveGame : public USaveGame
{
    GENERATED_BODY()
public:
    UPROPERTY() FPlayerTransformSaveData  PlayerTransformData;
    UPROPERTY() FHealthSaveData           HealthData;
    UPROPERTY() FInventorySaveData        InventoryData;
    UPROPERTY() FCraftingSaveData         CraftingData;
    UPROPERTY() FInfectionSaveData        InfectionData;
    UPROPERTY() FFactionSaveData          FactionData;
    UPROPERTY() FInvestigationSaveData    InvestigationData;
    UPROPERTY() FWorldFlagsSaveData       WorldFlagsData;
    UPROPERTY() FMapSaveData              MapData;
    UPROPERTY() FTutorialSaveData         TutorialData;
    UPROPERTY() FGSMSaveData              GSMData;
    UPROPERTY() FQuestSaveData            QuestData;

    UPROPERTY() FString    SaveVersion = TEXT("1.0");
    UPROPERTY() FDateTime  SaveTimestamp;
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
    void TriggerAutosave();    // Async checkpoint/investigation saves; gated by CanSave()
    void TriggerExitSave();    // Blocking synchronous save on clean exit only

private:
    TArray<IHostileSaveProvider*> SaveProviders;

    static constexpr const TCHAR* SaveSlotName            = TEXT("HostileWorldSave_Slot0");
    static constexpr int32        SaveUserIndex            = 0;
    static constexpr float        CheckpointCooldownSeconds = 30.0f;

    UPROPERTY() bool  bSaveInProgress = false;
    float             TimeSinceLastSave = TNumericLimits<float>::Max(); // allow first save immediately
    EGameState        LastKnownGSMState = EGameState::Playing;

    FGameplayMessageListenerHandle CheckpointHandle;
    FGameplayMessageListenerHandle InvestigationHandle;
    FDelegateHandle                ExitHandle;

    bool CanSave() const;               // false in Cutscene/GameOver, in-progress, or within cooldown
    void PopulateAndSave(bool bBlocking);
    void NotifyHUDSaveStarted();
    void NotifyHUDSaveComplete();

    UFUNCTION() void OnSaveComplete(const FString& SlotName, int32 UserIndex, bool bSuccess);
    UFUNCTION() void OnLoadComplete(const FString& SlotName, int32 UserIndex, USaveGame* SaveGame);
    UFUNCTION() void OnGSMStateChanged(EGameState NewState, EGameState OldState);
};
```

---

### Save Triggers

Three triggers activate `TriggerAutosave()` or `TriggerExitSave()`. All async saves pass through `CanSave()`; the exit save uses its own gate (Playing/Paused only).

```cpp
// Broadcast by ACheckpointActor on zone-boundary overlap
USTRUCT() struct FCheckpointReachedMessage { GENERATED_BODY() };
// Broadcast by UInvestigationSubsystem on key milestone completion
USTRUCT() struct FInvestigationKeyEventMessage { GENERATED_BODY() };

void USaveLoadSubsystem::Initialize(FSubsystemCollectionBase& Collection)
{
    Super::Initialize(Collection);
    auto& Router = UGameplayMessageSubsystem::Get(this);

    // TRIGGER 1 — zone boundary checkpoint
    CheckpointHandle = Router.RegisterListener<FCheckpointReachedMessage>(
        TAG_Event_Checkpoint_Reached, this, &USaveLoadSubsystem::OnCheckpointReached);

    // TRIGGER 2 — investigation key event
    InvestigationHandle = Router.RegisterListener<FInvestigationKeyEventMessage>(
        TAG_Event_Investigation_KeyEvent, this, &USaveLoadSubsystem::OnInvestigationKeyEvent);

    // GSM subscription: load sequence (Loading state) + save gate (Cutscene/GameOver)
    Collection.InitializeDependency<UGameStateMachineSubsystem>();
    GetGameInstance()->GetSubsystem<UGameStateMachineSubsystem>()
        ->SubscribeToStateChange(
            FStateChangeDelegate::CreateUObject(this, &USaveLoadSubsystem::OnGSMStateChanged));

    // TRIGGER 3 — clean exit (bound to engine termination; fires TriggerExitSave blocking)
    ExitHandle = FCoreDelegates::ApplicationWillTerminateDelegate.AddUObject(
        this, &USaveLoadSubsystem::TriggerExitSave);
}

void USaveLoadSubsystem::OnCheckpointReached(FGameplayTag, const FCheckpointReachedMessage&)
{
    TriggerAutosave();
}

void USaveLoadSubsystem::OnInvestigationKeyEvent(FGameplayTag, const FInvestigationKeyEventMessage&)
{
    TriggerAutosave();
}

// Gate enforces Cutscene/GameOver suppression (GDD Rule 2) and 30s cooldown (GDD tuning knob)
bool USaveLoadSubsystem::CanSave() const
{
    return LastKnownGSMState != EGameState::Cutscene
        && LastKnownGSMState != EGameState::GameOver
        && !bSaveInProgress
        && TimeSinceLastSave >= CheckpointCooldownSeconds;
}

void USaveLoadSubsystem::TriggerAutosave()
{
    if (CanSave()) PopulateAndSave(/*bBlocking=*/false);
}

void USaveLoadSubsystem::TriggerExitSave()
{
    // Only valid from Playing/Paused; GameOver/Cutscene exits do not save
    if (LastKnownGSMState == EGameState::Playing || LastKnownGSMState == EGameState::Paused)
        PopulateAndSave(/*bBlocking=*/true);
}

void USaveLoadSubsystem::PopulateAndSave(bool bBlocking)
{
    UHostileWorldSaveGame* SaveGame = NewObject<UHostileWorldSaveGame>(this);
    SaveGame->SaveTimestamp = FDateTime::UtcNow();
    for (IHostileSaveProvider* Provider : SaveProviders)
        if (Provider) Provider->PopulateSaveData(*SaveGame);

    bSaveInProgress    = true;
    TimeSinceLastSave  = 0.0f;
    NotifyHUDSaveStarted();  // → UHUDSubsystem::ShowSaveIndicator(2.0s)

    if (bBlocking)
    {
        // Synchronous path — only on clean exit; intentional game-thread block
        UGameplayStatics::SaveGameToSlot(SaveGame, SaveSlotName, SaveUserIndex);
        bSaveInProgress = false;
        NotifyHUDSaveComplete();
    }
    else
    {
        UGameplayStatics::AsyncSaveGameToSlot(SaveGame, SaveSlotName, SaveUserIndex,
            FAsyncSaveGameToSlotDelegate::CreateUObject(this, &USaveLoadSubsystem::OnSaveComplete));
    }
}
```

---

### Async Save/Load Flow

```
SAVE (async — checkpoint and investigation triggers):
  FCheckpointReachedMessage or FInvestigationKeyEventMessage broadcast
    → CanSave()? (Cutscene/GameOver blocked; cooldown checked; no in-progress save)
      YES → PopulateAndSave(bBlocking=false)
              → NewObject<UHostileWorldSaveGame>
              → For each IHostileSaveProvider: PopulateSaveData(SaveGame)
              → NotifyHUDSaveStarted() → UHUDSubsystem::ShowSaveIndicator(2.0s)
              → AsyncSaveGameToSlot(SaveGame, "HostileWorldSave_Slot0", 0, OnSaveComplete)
                  → OnSaveComplete(bSuccess): log warning on failure; NotifyHUDSaveComplete()
      NO  → discard; no write

SAVE (blocking — clean exit only):
  FCoreDelegates::ApplicationWillTerminateDelegate fires
    → TriggerExitSave(): GSM in Playing or Paused?
        YES → PopulateAndSave(bBlocking=true)
                → SaveGameToSlot(SaveGame, "HostileWorldSave_Slot0", 0)  [synchronous]

LOAD (GSM Loading state):
  GSM transitions to Loading state
    → OnGSMStateChanged(Loading) fires on USaveLoadSubsystem
      → DoesSaveGameExist("HostileWorldSave_Slot0")?
          YES → AsyncLoadGameFromSlot(..., OnLoadComplete)
                    → OnLoadComplete(SaveGame):
                        Cast<UHostileWorldSaveGame> succeeds?
                          YES → for each IHostileSaveProvider: LoadFromSaveData(*HostileSave)
                          NO  → DeleteGameInSlot(); LoadFromSaveData(fresh defaults);
                                UHUDSubsystem::ShowNotification(
                                  "Save data could not be loaded. Starting new game.", 5.0s)
                        → GSM->OnLoadComplete()  [GSM transitions Loading → Playing]
          NO  → for each IHostileSaveProvider: LoadFromSaveData(fresh defaults)
                → GSM->OnLoadComplete()
```

---

### Architecture Diagram

```
UGameInstance
└── USaveLoadSubsystem  (Session-tier, ADR-0004)
      │  owns: UHostileWorldSaveGame (per-save, not cached between checkpoints)
      │  owns: TArray<IHostileSaveProvider*> SaveProviders  (12 registered providers)
      │  listens: TAG_Event_Checkpoint_Reached, TAG_Event_Investigation_KeyEvent
      │  subscribes: UGameStateMachineSubsystem::OnStateChanged (gate + load trigger)
      │  binds: FCoreDelegates::ApplicationWillTerminateDelegate (exit save)
      │
      ├── UPlayerControllerSubsystem  → FPlayerTransformSaveData
      ├── UHealthSubsystem            → FHealthSaveData
      ├── UInventorySubsystem         → FInventorySaveData
      ├── UCraftingSubsystem          → FCraftingSaveData
      ├── UInfectionSubsystem         → FInfectionSaveData  (spread-vectors TODO-C6)
      ├── UFactionSubsystem           → FFactionSaveData
      ├── UInvestigationSubsystem     → FInvestigationSaveData
      ├── UWorldFlagsSubsystem        → FWorldFlagsSaveData
      ├── UMapSubsystem               → FMapSaveData
      ├── UTutorialSubsystem          → FTutorialSaveData
      ├── UGameStateMachineSubsystem  → FGSMSaveData
      └── UQuestSubsystem             → FQuestSaveData

SAVE TRIGGERS:
  ACheckpointActor → FCheckpointReachedMessage → TriggerAutosave() [async]
  UInvestigationSubsystem → FInvestigationKeyEventMessage → TriggerAutosave() [async]
  FCoreDelegates::ApplicationWillTerminateDelegate → TriggerExitSave() [blocking]

LOAD TRIGGER:
  GSM state = Loading → OnGSMStateChanged() → AsyncLoadGameFromSlot(...)
    → OnLoadComplete → all 12 providers LoadFromSaveData → GSM->OnLoadComplete()
```

### Key Interfaces

| Interface / API | Owner | Consumers |
|----------------|-------|-----------|
| `IHostileSaveProvider` UInterface | `USaveLoadSubsystem` declares | All 12 contributing subsystems implement |
| `RegisterProvider(IHostileSaveProvider*)` | `USaveLoadSubsystem` | Called by each provider in `Initialize()` |
| `TriggerAutosave()` | `USaveLoadSubsystem` | Checkpoint + investigation listeners (internal); exposed for testing |
| `TriggerExitSave()` | `USaveLoadSubsystem` | `FCoreDelegates::ApplicationWillTerminateDelegate` — blocking sync write on clean exit |
| `TAG_Event_Checkpoint_Reached` | `FCheckpointReachedMessage` | `ACheckpointActor` broadcasts; `USaveLoadSubsystem` listens |
| `TAG_Event_Investigation_KeyEvent` | `FInvestigationKeyEventMessage` | `UInvestigationSubsystem` broadcasts on key milestone; `USaveLoadSubsystem` listens |
| `OnGSMStateChanged(NewState, OldState)` | `USaveLoadSubsystem` | GSM subscription — triggers async load on `Loading`; gates saves on `Cutscene`/`GameOver` |
| `GSM->OnLoadComplete()` | `UGameStateMachineSubsystem` | Called by `USaveLoadSubsystem` after all 12 providers restored → `Loading → Playing` |
| `UHUDSubsystem::ShowSaveIndicator()` | `UHUDSubsystem` | Called by `USaveLoadSubsystem` on save start/complete |
| `UHUDSubsystem::ShowNotification()` | `UHUDSubsystem` | Called by `USaveLoadSubsystem` on corruption or storage-full error |
| `UHostileWorldSaveGame` | `USaveLoadSubsystem` | All 12 providers via `PopulateSaveData` / `LoadFromSaveData` only — never accessed directly |

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
- **Risk**: Load sequence timing — `OnGSMStateChanged(Loading)` fires when GSM enters the Loading state, which is after all session-tier subsystems have initialized. However, if a provider is World-tier (e.g., a future `UWorldSubsystem` for world flags), `LoadFromSaveData` would be called before the world is available. **Mitigation**: All 12 providers must be Session-tier `UGameInstanceSubsystem` — World-tier subsystems that need save data must proxy through a Session-tier cache. Verify provider tier before each new registration.
- **Risk**: Blocking exit write platform limits — `UGameplayStatics::SaveGameToSlot()` (synchronous) may exceed the platform-allowed termination window on console or mobile. **Mitigation**: PC/Windows only at MVP; revisit for console certification. The synchronous path uses already-populated in-memory providers so no extra I/O aggregation is required — write time is bounded by disk speed only.
- **Risk**: GSM subscription before `UGameStateMachineSubsystem::Initialize()` completes — `SubscribeToStateChange` must not fire before the GSM is ready. **Mitigation**: `Collection.InitializeDependency<UGameStateMachineSubsystem>()` guarantees GSM is initialized before the subscription call in `USaveLoadSubsystem::Initialize()`.
- **Risk**: Fresh-game path (no save file) — `AsyncLoadGameFromSlot` returns nullptr. **Mitigation**: Explicit null check; providers use hardcoded defaults if `InSave == nullptr` (they should work correctly with a zero-initialized save struct).

## GDD Requirements Addressed

| GDD System | Requirement | How This ADR Addresses It |
|------------|-------------|--------------------------|
| save-load-system.md | Rule 3 — Player Transform: Position (X,Y,Z) + Rotation (Yaw) | `FPlayerTransformSaveData` in schema; `UPlayerControllerSubsystem` implements `IHostileSaveProvider` |
| save-load-system.md | Rule 3 — Health: Current HP, max HP, active status effects | `FHealthSaveData` in schema; `UHealthSubsystem` implements `IHostileSaveProvider` |
| save-load-system.md | Rule 3 — Inventory: items, grid layout, weapon slots, ammo | `FInventorySaveData` in schema; `UInventorySubsystem` implements `IHostileSaveProvider` |
| save-load-system.md | Rule 3 — Crafting: unlocked schematic ID set | `FCraftingSaveData` in schema; `UCraftingSubsystem` implements `IHostileSaveProvider` |
| save-load-system.md | Rule 3 — Infection Spread: per-zone level, active spread vectors | `FInfectionSaveData` covers per-zone levels; spread-vectors deferred (TODO-C6) |
| save-load-system.md | Rule 3 — Faction Reputation: reputation per faction ID | `FFactionSaveData` in schema; `UFactionSubsystem` implements `IHostileSaveProvider` |
| save-load-system.md | Rule 3 — Investigation: completed clue IDs, active objective IDs | `FInvestigationSaveData` in schema; `UInvestigationSubsystem` implements `IHostileSaveProvider` |
| save-load-system.md | Rule 3 — World Flags: per-actor interaction flags | `FWorldFlagsSaveData` (FGuid + bitfield array); `UWorldFlagsSubsystem` implements `IHostileSaveProvider` |
| save-load-system.md | Rule 3 — Map System: fog bitmask, pinned locations, manual markers | `FMapSaveData` in schema; `UMapSubsystem` implements `IHostileSaveProvider` |
| save-load-system.md | Rule 3 — Tutorial: dismissed hint IDs, completion flags per phase | `FTutorialSaveData` in schema; `UTutorialSubsystem` implements `IHostileSaveProvider` |
| save-load-system.md | Rule 3 — GSM: last valid state at save time (Playing or Paused) | `FGSMSaveData` in schema; `UGameStateMachineSubsystem` implements `IHostileSaveProvider` |
| save-load-system.md | Rule 2 — Save triggers: zone entry, key investigation event, clean exit | Three trigger paths: `FCheckpointReachedMessage`, `FInvestigationKeyEventMessage`, `ApplicationWillTerminateDelegate` |
| save-load-system.md | Rule 2 — Save disabled in Cutscene/GameOver | `CanSave()` gates on `LastKnownGSMState` |
| save-load-system.md | Rule 4 — Slot name `"HostileWorldSave_Slot0"` | `SaveSlotName = TEXT("HostileWorldSave_Slot0")` |
| save-load-system.md | Rule 5 — Load sequence in GSM Loading state | `OnGSMStateChanged(Loading)` triggers async load; `GSM->OnLoadComplete()` transitions to Playing |
| save-load-system.md | Rule 6 — Corruption: delete + HUD notification + new-game defaults | `OnLoadComplete` null-cast path: `DeleteGameInSlot` + `ShowNotification` + defaults |
| save-load-system.md | Rule 7 — Save indicator 2.0s on write start | `NotifyHUDSaveStarted()` → `UHUDSubsystem::ShowSaveIndicator(2.0s)` |
| save-load-system.md | AC8 — Blocking write on clean exit | `TriggerExitSave()` → `PopulateAndSave(bBlocking=true)` → synchronous `SaveGameToSlot` |
| save-load-system.md | Tuning — `CheckpointCooldownSeconds = 30.0s` | `CheckpointCooldownSeconds` constant in `USaveLoadSubsystem`; enforced in `CanSave()` |
| tutorial-system.md | TR-tutorial-006: persist completed HintIDs | `FTutorialSaveData.CompletedHintIDs` only (DISMISSED state removed per Tutorial GDD Rule 5 / C5 fix); restored before first level triggers register |
| systems-index.md | Save/Load System (#6) must survive level transitions | `USaveLoadSubsystem` is Session-tier (ADR-0004); persists across level transitions |

## Performance Implications
- **CPU**: `TriggerAutosave()` iterates `N` providers synchronously to collect data (N ≤ 10; sub-millisecond). Disk write is async — zero game-thread cost after collection.
- **Memory**: `UHostileWorldSaveGame` instance held in memory for session; size is bounded by save data volume (expected < 100KB for this game's scope).
- **Load Time**: `AsyncLoadGameFromSlot` fires during `GameInstance::Init()` — before the loading screen is shown. No gameplay frame is affected.
- **Network**: N/A — single-player.

## Migration Plan
No existing save code to migrate. `USaveLoadSubsystem` is a new class. When the Save/Load GDD is authored, it must reference this ADR and align its rules with the schema and trigger policy defined here.

## Validation Criteria
- `TriggerAutosave()` from a test checkpoint → `UHostileWorldSaveGame` serialized to `Saved/SaveGames/HostileWorldSave_Slot0.sav` (slot name verified against GDD Rule 4)
- GSM enters Loading state with existing save → all 12 providers' `LoadFromSaveData()` called with non-null `UHostileWorldSaveGame`; GSM transitions Loading → Playing
- Fresh game (no save file) → GSM enters Loading → all 12 providers initialize with defaults, no crash; GSM transitions to Playing
- `UTutorialSubsystem` marks hint `H_001` complete → `TriggerAutosave()` → kill PIE → re-enter PIE → `FTutorialSaveData.CompletedHintIDs` contains `H_001`
- GSM state = `Cutscene` → `TriggerAutosave()` → `CanSave()` returns false → no write occurs, no file written
- GSM state = `GameOver` → `TriggerAutosave()` → `CanSave()` returns false → no write occurs
- `FInvestigationKeyEventMessage` broadcast → `TriggerAutosave()` fires → save write begins (file timestamp updated)
- Two `FCheckpointReachedMessage` events 5s apart with `CheckpointCooldownSeconds=30` → only first triggers a write; second is discarded
- Corrupted save (manually zeroed) → GSM enters Loading → `OnLoadComplete` receives null cast → file deleted, providers get defaults, HUD notification visible for 5s
- `TriggerExitSave()` called while `bSaveInProgress=false` → `SaveGameToSlot()` completes synchronously before function returns
- `FHealthSaveData.CurrentHP` set to 42.0 → `TriggerAutosave()` → reload via GSM Loading → provider receives save with `CurrentHP == 42.0`
- Game thread frame time: no hitch > 1ms at async checkpoint (measured via `stat game` with save in flight)
- No subsystem calls `GetSubsystem<T>()` on a peer inside `Initialize()` without `Collection.InitializeDependency<T>()` guard (static analysis / code review check)

## Related Decisions
- ADR-0001: Cross-System Communication — `FCheckpointReachedMessage` uses Gameplay Message Router (global broadcast pattern)
- ADR-0004: Subsystem & Module Architecture — `USaveLoadSubsystem` is Session-tier `UGameInstanceSubsystem`; lazy-access and dependency-initialization rules apply
- ADR-0005: Game Data Strategy — Save data is runtime state (not game data); `USaveGame` is correct here, not `UDataTable`
