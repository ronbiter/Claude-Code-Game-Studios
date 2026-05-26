# ADR-0008: Scene Streaming Architecture

## Status
Proposed

## Date
2026-05-20

## Engine Compatibility

| Field | Value |
|-------|-------|
| **Engine** | Unreal Engine 5.7 |
| **Domain** | Scene Streaming (World Partition, Data Layers, Asset Streaming) |
| **Knowledge Risk** | HIGH — UE 5.7 post-LLM-cutoff. World Partition and Data Layer APIs evolved significantly in 5.4–5.7. |
| **References Consulted** | `docs/engine-reference/unreal/VERSION.md`, `design/gdd/scene-management.md` |
| **Post-Cutoff APIs Used** | `UDataLayerManager::SetDataLayerInstanceRuntimeState()` (accessed via `GetWorld()->GetDataLayerManager()`), `EDataLayerRuntimeState` enum, `UDataLayerAsset` (5.1+). Corrected from `UDataLayerSubsystem` — engine specialist review 2026-05-21. |
| **Verification Required** | (1) ✅ CONFIRMED: `UDataLayerSubsystem` removed in UE 5.7; correct access is `GetWorld()->GetDataLayerManager()` returning `UDataLayerManager*`. All call sites in this ADR corrected — engine specialist review 2026-05-21. (2) Confirm `SetDataLayerInstanceRuntimeState()` parameter types and `EDataLayerRuntimeState` enum values unchanged in 5.4–5.7. (3) Confirm `FStreamableManager` is still the correct non-Addressables async load path in 5.7. (4) Test `FStreamableManager` destruction with in-flight request in PIE — confirm no stale delegate fires on level transition after `CancelHandle()` in `Deinitialize()`. (5) Confirm `AZoneBoundaryVolume` collision profile fires overlap against player capsule in PIE. (6) Validate World Partition cell size of 25,200,000 cm is within supported range for UE 5.7. (7) Confirm `IStreamingManager` API for memory pressure reading has not been replaced in 5.7. |

## ADR Dependencies

| Field | Value |
|-------|-------|
| **Depends On** | ADR-0001 (delegate pattern — must be Accepted; all events use dynamic multicast delegates), ADR-0002 (GSM — must be Accepted; Loading state coordination), ADR-0004 (subsystem tier — must be Accepted; UWorldSubsystem classification), ADR-0006 (save/load — must be Accepted; IHostileSaveProvider pattern) |
| **Enables** | ADR-0009 (Camera — OnZoneCrossed event triggers camera environmental effects), ADR-0010 (Movement — streaming state affects movement constraints in Loading) |
| **Blocks** | Infection Spread System epics (requires RequestDataLayerSwap API); Map System epics (requires GetZoneBounds/GetDiscoveredLocations API); Save/Load Scene State stories (requires IHostileSaveProvider registration) |
| **Ordering Note** | ADR-0006 must be Accepted before USceneManagementSubsystem can register as an IHostileSaveProvider. ADR-0002 must be Accepted before GSM Loading state coordination can be implemented. |

## Context

### Problem Statement

Hostile World is an open-world game where the environment transforms in real time — clean zones mutate into infected zones, buildings are destroyed, and alien hives emerge. The player must never see a loading screen during within-world zone crossings. The architecture must decide: what is the single streaming authority, how are runtime world states (Data Layers) activated and deactivated, how does zone crossing coordinate with the Game State Machine, and what subsystem tier owns the scene state.

### Constraints

- World Partition is available in UE 5.7 as the production streaming system for open worlds
- Cell size (25,200,000 cm) is immutable after World Partition project setup
- Mountain Prison is a separate linear World; open world is a single World Partition world
- Memory pools are platform-dependent (PC high: 4096 MB, PC med: 2048 MB, PS5: 3072 MB, PS4: 1536 MB)
- Frame-time guarantee: no frame >33.3ms during zone crossfade at max sprint (TR-scene-012)
- Indie-scale: no content streaming team; the system must be authoring-friendly

### Requirements

- World Partition is the single streaming authority; no manual level streaming overlaps (TR-scene-001)
- Cell size 25,200,000 cm, max 500 actors per cell (TR-scene-002, TR-scene-003)
- Runtime Grid Tags for zone IDs; Data Layers for content activation (TR-scene-004)
- HLOD generated at build time for both Clean and Infected Data Layer variants (TR-scene-005)
- Async asset loading via FStreamableManager during GSM Loading state; 30s timeout (TR-scene-006)
- Streaming memory pool budget enforced per platform (TR-scene-007)
- Max 8 concurrent I/O requests, 60/40 split (World Partition / Data Layers) (TR-scene-008)
- Expose ISceneManagementSubsystem interface (zone queries, RequestDataLayerSwap, streaming state, Save/Restore) (TR-scene-009)
- Data Layer swap state machine: DL_Idle → DL_Unloading → DL_Flushing → DL_Loading → DL_Active with rollback on failure (TR-scene-010)
- Fire OnZoneCrossed and OnDataLayerChanged delegates (TR-scene-011)
- No frame >33.3ms during zone crossfade at max sprint (TR-scene-012)
- Switch all zone crossings to GSM Loading mode if SSD bandwidth <200 MB/s (TR-scene-013)

## Decision

**USceneManagementSubsystem is a UWorldSubsystem.** Per-level state (Data Layer activations, zone crossing debounce, streaming state) resets on level transition. Cross-session persistence is handled by IHostileSaveProvider registration with USaveLoadSubsystem (ADR-0006). This aligns with ADR-0004's world-tier pattern: systems holding per-level state use UWorldSubsystem.

**World Partition is the single streaming authority.** No manual LevelStreaming actors exist in the open world. World Partition automatically streams cells based on player proximity and velocity. The Mountain Prison is a separate UWorld loaded via OpenLevel() — a full GSM Loading state transition.

**Data Layers are managed via UDataLayerManager.** Accessed at call sites via `GetWorld()->GetDataLayerManager()`. Layer activation and deactivation use `SetDataLayerInstanceRuntimeState()`. Data Layer assets (UDataLayerAsset) are hard-referenced UPROPERTY on USceneManagementSubsystem — guaranteed available from world init. Note: `UDataLayerSubsystem` does not exist in UE 5.7 — `UDataLayerManager` is the correct class (engine specialist confirmed 2026-05-21).

**Non-world asset loading** (UI, audio, data tables) during GSM Loading state uses `FStreamableManager::RequestAsyncLoad()`. FStreamableManager instance is owned by USceneManagementSubsystem. All active `TSharedPtr<FStreamableHandle>` are stored as member variables and explicitly cancelled via `Handle->CancelHandle()` in `Deinitialize()` — this prevents stale delegate fires if a level transition occurs while an async load is in flight. This is distinct from World Partition cell streaming (handled automatically by the engine).

**Zone crossing detection** uses AZoneBoundaryVolume actors (AVolume subclass) with OnActorBeginOverlap bindings. A 3.0s FTimerHandle debounce prevents rapid oscillation thrash. Zone IDs are FName Runtime Grid Tags assigned in World Partition.

**Data Layer swap state machine** runs inside USceneManagementSubsystem. Each phase (Unloading → Flushing → Loading → Active) is driven by callbacks from UDataLayerManager. Rollback re-activates the previous stable state. Max queue depth of 4 concurrent swap requests, serialized by player proximity.

**Memory pressure monitoring** reads streaming pool utilization via IStreamingManager on a recurring FTimerHandle (interval: 2.0s). This is NOT a Tick() read — using a timer avoids the `polling_state_in_tick` forbidden pattern (ADR-0001). Four pressure levels: Normal (<70%), Elevated (70–85%), High (85–95%), Critical (>95%) drive streaming priority deactivation.

**SSD bandwidth detection** (TR-scene-013): at startup, USceneManagementSubsystem performs a calibration read. If measured bandwidth <200 MB/s, all zone crossings are promoted to Coordinated Loading (GSM Loading state). Rechecked every 60s with exponential backoff.

### Architecture Diagram

```
┌──────────────────────────────────────────────────────────────┐
│  USceneManagementSubsystem  (UWorldSubsystem)                │
│                                                              │
│  ┌─────────────────┐   ┌──────────────────────────────────┐  │
│  │  Zone Registry  │   │  Data Layer Swap State Machine   │  │
│  │  (FName→FZone)  │   │  DL_Idle→Unloading→Flushing→     │  │
│  └────────┬────────┘   │  Loading→DL_Active (rollback)   │  │
│           │            └──────────────┬───────────────────┘  │
│  ┌────────▼────────┐                  │                       │
│  │ AZoneBoundary   │   ┌─────────────▼──────────────────┐   │
│  │ Volume overlap  │   │  UDataLayerManager              │   │
│  │ → debounce 3.0s │   │  SetDataLayerInstanceRuntime   │   │
│  └────────┬────────┘   │  State(Asset, EState)          │   │
│           │            └────────────────────────────────┘   │
│  ┌────────▼────────┐   ┌────────────────────────────────┐   │
│  │ OnZoneCrossed   │   │  FStreamableManager            │   │
│  │ MULTICAST       │   │  RequestAsyncLoad() — non-world │   │
│  │ (FName, FName)  │   │  assets in GSM Loading state   │   │
│  └─────────────────┘   └────────────────────────────────┘   │
│                                                              │
│  Memory Pressure Monitor (Tick-throttled)                    │
│  IStreamingManager → P_mem → priority deactivation          │
└──────────────────────────────────────────────────────────────┘

World Partition (engine-managed, automatic cell streaming)
  ├── RuntimeGrid Tags → Zone IDs
  ├── HLOD (Clean + Infected variants, build-time generated)
  └── No manual LevelStreaming actors

UHostileWorldGSM (UGameInstanceSubsystem — ADR-0002)
  ← RequestStateTransition(Loading) from USceneManagementSubsystem
  → OnTransitionStarted delegate → USceneManagementSubsystem starts FStreamableManager load

USaveLoadSubsystem (UGameInstanceSubsystem — ADR-0006)
  ← IHostileSaveProvider::PopulateSaveData / LoadFromSaveData
  → Saves: active Data Layers, zone infection levels, destruction flags, discovery flags
```

### Key Interfaces

```cpp
// Implemented by USceneManagementSubsystem
class ISceneManagementSubsystem
{
public:
    // Zone queries
    virtual FName GetCurrentZone() const = 0;
    virtual FZoneState GetZoneState(FName ZoneId) const = 0;
    virtual TArray<FName> GetAdjacentZones(FName ZoneId) const = 0;

    // Data Layer management
    virtual void RequestDataLayerSwap(FName ZoneId, FName TargetLayer) = 0;
    virtual bool IsDataLayerActive(FName DataLayerName) const = 0;

    // Streaming
    virtual FStreamingState GetStreamingState() const = 0;
    virtual float GetStreamingProgress() const = 0;

    // Save/Load (ADR-0006 IHostileSaveProvider)
    virtual void PopulateSaveData(UHostileWorldSaveGame& SaveGame) = 0;
    virtual void LoadFromSaveData(const UHostileWorldSaveGame& SaveGame) = 0;
};

// USceneManagementSubsystem — UWorldSubsystem implementation
UCLASS()
class USceneManagementSubsystem : public UWorldSubsystem,
                                   public ISceneManagementSubsystem,
                                   public IHostileSaveProvider
{
    GENERATED_BODY()

public:
    // Events — ADR-0001 dynamic multicast delegate pattern
    UPROPERTY(BlueprintAssignable)
    FZoneCrossedDelegate OnZoneCrossed;       // (FName FromZone, FName ToZone)
    UPROPERTY(BlueprintAssignable)
    FDataLayerChangedDelegate OnDataLayerChanged; // (FName LayerName, bool bActive)

    // Zone crossing debounce — called by AZoneBoundaryVolume::NotifyPlayerEntered()
    void NotifyZoneCrossing(FName FromZone, FName ToZone);

    // Called by UInfectionSpreadSubsystem (UGameInstanceSubsystem → UWorldSubsystem OK)
    virtual void RequestDataLayerSwap(FName ZoneId, FName TargetLayer) override;

private:
    // Hard-referenced Data Layer assets — guaranteed available from world init
    UPROPERTY(EditDefaultsOnly, Category="Data Layers")
    TObjectPtr<UDataLayerAsset> DL_Clean;
    UPROPERTY(EditDefaultsOnly, Category="Data Layers")
    TObjectPtr<UDataLayerAsset> DL_Infected;
    UPROPERTY(EditDefaultsOnly, Category="Data Layers")
    TObjectPtr<UDataLayerAsset> DL_Destroyed;
    UPROPERTY(EditDefaultsOnly, Category="Data Layers")
    TObjectPtr<UDataLayerAsset> DL_Intact;
    // ... remaining 7 Data Layer assets

    // Deinitialize() MUST: (1) CancelHandle() all ActiveStreamableHandles;
    // (2) UnregisterProvider(this) on USaveLoadSubsystem
    virtual void Deinitialize() override;

    FStreamableManager StreamableManager;
    TArray<TSharedPtr<FStreamableHandle>> ActiveStreamableHandles; // cancelled in Deinitialize()
    FTimerHandle ZoneCrossingDebounceTimer;
    FTimerHandle MemoryPressureCheckTimer; // fires every 2.0s, NOT per-frame Tick
    TQueue<FDataLayerSwapRequest> SwapQueue;
    EDataLayerSwapState CurrentSwapState;
};

// Zone boundary actor — placed in world, overlaps player
UCLASS()
class AZoneBoundaryVolume : public AVolume
{
    GENERATED_BODY()
    UPROPERTY(EditInstanceOnly)
    FName FromZoneId;
    UPROPERTY(EditInstanceOnly)
    FName ToZoneId;
    // OnActorBeginOverlap → USceneManagementSubsystem::NotifyZoneCrossing()
};
```

**Delegate declarations:**
```cpp
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FZoneCrossedDelegate, FName, FromZone, FName, ToZone);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FDataLayerChangedDelegate, FName, LayerName, bool, bIsActive);
```

## Alternatives Considered

### Alternative 1: UGameInstanceSubsystem for Scene Management
- **Description**: Own scene state at the session tier so it survives the prison→open world level transition without needing save restore.
- **Pros**: Debounce timers and swap queues survive the level load. Simpler mid-transition state.
- **Cons**: Violates ADR-0004's principle that session-tier subsystems hold only state that must cross level boundaries. Scene streaming is inherently per-level. Bloats session memory with per-world Data Layer references. UDataLayerManager is accessed via `GetWorld()->GetDataLayerManager()` — a GameInstance subsystem would need a UWorld reference that becomes invalid on transition.
- **Rejection Reason**: ADR-0004 world-tier pattern is the correct fit. Prison→open world transition is a full level load anyway (GSM Loading with deep inhale); any in-flight swap state is invalid after the transition and should be discarded, not preserved.

### Alternative 2: Manual Level Streaming Alongside World Partition
- **Description**: Use LevelStreaming actors for structured areas (hive, camp) while World Partition handles the open terrain.
- **Pros**: Finer authoring control over level composition; familiar to level designers from pre-WP pipeline.
- **Cons**: Two competing streaming authorities produce undefined behavior in UE5's World Partition system. TR-scene-001 explicitly bans this. Epic's documentation warns against mixing LevelStreaming and World Partition in the same world.
- **Rejection Reason**: Hard requirement violation (TR-scene-001). World Partition is the sole authority.

### Alternative 3: UAssetManager for Non-World Asset Streaming
- **Description**: Use UAssetManager::GetStreamableManager() (the global singleton) instead of owning a local FStreamableManager on USceneManagementSubsystem.
- **Pros**: Consistent with UE's asset management philosophy. UAssetManager tracks all in-flight loads globally.
- **Cons**: UAssetManager adds overhead for simple data table / audio streaming during a loading screen. At indie scale, a local FStreamableManager owned by the subsystem is simpler and sufficient. UAssetManager is the right choice if Addressables / remote content delivery is needed — not in scope.
- **Rejection Reason**: Complexity not justified at current scale. Revisit if remote content delivery is added post-launch.

## Consequences

### Positive
- World Partition provides automatic distance-based streaming with no per-frame subsystem logic required for cell management
- UWorldSubsystem tier keeps scene state scoped correctly — no risk of stale world references across level transitions
- `UDataLayerManager` (via `GetWorld()->GetDataLayerManager()`) is the engine's canonical Data Layer management API — no custom streaming infrastructure needed
- IHostileSaveProvider pattern (ADR-0006) handles all cross-session scene state persistence cleanly
- FStreamableManager gives direct async control over non-world assets without Addressables overhead

### Negative
- Zone boundary detection requires AZoneBoundaryVolume actors placed in the world — level designers must place and configure zone boundaries manually
- `UDataLayerManager` access path confirmed by engine specialist (2026-05-21); `SetDataLayerInstanceRuntimeState()` parameter types still require verification against UE 5.7 install before first story (Verification Required item 2)
- Hard-referenced UDataLayerAsset properties on USceneManagementSubsystem mean all 11 Data Layer assets load into memory at world init — acceptable at indie scale
- USceneManagementSubsystem must explicitly manage FStreamableHandle and IHostileSaveProvider lifetime in Deinitialize() — forgetting either causes dangling pointers

### Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| ~~UDataLayerSubsystem API changed in 5.4–5.7~~ | HIGH (MITIGATED) | ✅ Confirmed by engine specialist 2026-05-21: `UDataLayerSubsystem` removed; use `GetWorld()->GetDataLayerManager()` returning `UDataLayerManager*`. All call sites corrected in this ADR. `SetDataLayerInstanceRuntimeState()` param types still require verification (item 2). |
| FStreamableManager in-flight delegate fires into destroyed UWorldSubsystem on level transition | HIGH (MITIGATED) | All TSharedPtr<FStreamableHandle> stored as members. Deinitialize() calls CancelHandle() on all active handles before subsystem teardown. No delegate fires after Deinitialize(). |
| IHostileSaveProvider dangling pointer in USaveLoadSubsystem after level transition | HIGH (MITIGATED) | Deinitialize() calls USaveLoadSubsystem::UnregisterProvider(this) before teardown. Initialize()/Deinitialize() symmetry enforced. |
| World Partition cell size 25,200,000 cm may cause long HLOD build times | MEDIUM | Prototype cell size early (GDD OQ-7). Set up HLOD pipeline before content authoring begins. |
| Data Layer rollback restores activation state only — partial cell eviction may leave world incompletely populated | MEDIUM | Block new swap requests during DL_Flushing. Document rollback guarantee scope. If incomplete, trigger GSM Loading screen as recovery. |
| AZoneBoundaryVolume requires correct collision profile to fire overlap against player capsule | MEDIUM | Verify in PIE (Verification Required item 5). Enforce via Blueprint default collision profile configuration. |
| AZoneBoundaryVolume overlap detection under physics async tick | LOW | bTickPhysicsAsync disabled (ADR-0007). Overlap callbacks fire synchronously on game thread. No risk. |
| Data Layer swap rollback during Critical memory pressure may re-activate a large layer | MEDIUM | If rollback itself triggers Critical pressure, abort rollback, enter MemoryPressure state, log critical error. |

## GDD Requirements Addressed

| GDD System | Requirement (TR-ID) | How This ADR Addresses It |
|------------|---------------------|--------------------------|
| scene-management.md | TR-scene-001: World Partition single streaming authority | Decided: World Partition is sole authority; no manual LevelStreaming actors; mountain prison is a separate World via OpenLevel() |
| scene-management.md | TR-scene-002: Cell size 25,200,000 cm, immutable | Acknowledged as a project-setup decision; cell size is a World Partition project setting. ADR confirms immutability constraint. |
| scene-management.md | TR-scene-003: Max 500 actors per cell | Enforced via build validation rule (World Partition cell budget check). ADR-0008 owns the enforcement requirement. |
| scene-management.md | TR-scene-004: Runtime Grid Tags for zones; Data Layers for activation | Decided: Zone IDs = FName Runtime Grid Tags; activation/deactivation via `UDataLayerManager::SetDataLayerInstanceRuntimeState()` (accessed via `GetWorld()->GetDataLayerManager()`) |
| scene-management.md | TR-scene-005: HLOD for Clean + Infected at build time | Acknowledged: HLOD generation is a build pipeline step. Both variants (DL_Clean, DL_Infected) require HLOD generated before ship. |
| scene-management.md | TR-scene-006: FStreamableManager during GSM Loading; 30s timeout | Decided: FStreamableManager owned by USceneManagementSubsystem; 30s timeout implemented as FTimerHandle that cancels all in-flight loads and proceeds with partial content. |
| scene-management.md | TR-scene-007: Streaming memory pool budgets per platform | Acknowledged: Platform budgets are Project Settings values. USceneManagementSubsystem reads pool capacity at init; pressure thresholds are configurable tuning knobs. |
| scene-management.md | TR-scene-008: Max 8 concurrent I/O, 60/40 split | Decided: MaxConcurrentIO=8 configurable; IO_Split enforced by USceneManagementSubsystem routing swap requests before queuing. |
| scene-management.md | TR-scene-009: Expose ISceneManagementSubsystem interface | Decided: C++ abstract interface with 8 methods; implemented by USceneManagementSubsystem. All callers (Infection, Map, Save, Camera, AI, HUD) use interface, not concrete class. |
| scene-management.md | TR-scene-010: Data Layer swap state machine with rollback | Decided: DL_Idle→Unloading→Flushing→Loading→DL_Active; TQueue<FDataLayerSwapRequest> with max depth 4, serialized by player proximity. |
| scene-management.md | TR-scene-011: Fire OnZoneCrossed and OnDataLayerChanged | Decided: Both declared as DECLARE_DYNAMIC_MULTICAST_DELEGATE per ADR-0001 pattern. |
| scene-management.md | TR-scene-012: No frame >33.3ms during zone crossfade | Addressed by: World Partition handles cell streaming off game thread; Data Layer swap VFX budget <0.5ms GPU (GDD constraint). Monitoring: Tick-throttled memory pressure check; all swap phases driven by async callbacks. |
| scene-management.md | TR-scene-013: GSM Loading mode if SSD <200MB/s | Decided: Calibration read at world init; rechecked every 60s. On detection, all zone crossings promoted to Coordinated Loading path. |

## Performance Implications

- **CPU**: Memory pressure check runs on FTimerHandle every 2.0s (NOT Tick-based — avoids polling_state_in_tick forbidden pattern). Zone crossing detection is event-driven (OnActorBeginOverlap). Data Layer swap state machine is callback-driven. No per-frame subsystem work during steady-state streaming.
- **Memory**: 11 Data Layer assets hard-referenced: ~trivial (Data Layer assets are metadata, not geometry). FStreamableManager: temporary spike during GSM Loading state only. Streaming pool budget enforced at runtime per TR-scene-007 values.
- **Load Time**: GSM Loading path (Coordinated Loading): target 5–15s; 30s timeout. Level Transition (prison→open world): 1.5s deep inhale animation + world load time. Seamless zone crossing: no load time visible (World Partition automatic).
- **Network**: N/A — single-player only.

## Migration Plan

No existing code to migrate. This is a greenfield system. Implementation sequence:
1. Configure World Partition cell size at project creation (irreversible — do first)
2. Implement USceneManagementSubsystem skeleton + ISceneManagementSubsystem interface
3. Wire AZoneBoundaryVolume overlap detection
4. Implement Data Layer swap state machine (DL_Idle → DL_Active)
5. Implement FStreamableManager async load path (GSM Loading coordination)
6. Implement memory pressure monitoring (Tick-throttled)
7. Implement IHostileSaveProvider registration
8. Implement SSD bandwidth detection

## Validation Criteria

- World Partition cell count: 5 cells loaded when player stands still; HLOD visible at 2520m default distance
- No LevelStreaming actors exist in the open world map (build validation)
- Zone crossing: OnZoneCrossed fires exactly once per 3.0s window; zone ID changes correctly
- Data Layer swap: DL_Clean→DL_Infected completes within 0.5–2.0s for a representative town cell (200 actors, 500 MB)
- Data Layer rollback: simulate mid-swap failure; confirm previous stable state restored within 5s
- Memory pressure: at 85% utilization, confirm priorities 10–11 deactivated; at 95%, confirm 6–11
- FStreamableManager: 30s timeout fires if no assets loaded; system enters Playing state with partial content
- Save/restore: save Data Layer state, reload, confirm all active layers match pre-save state
- Frame time: no frame >33.3ms measured during zone crossfade at max sprint velocity (630 cm/s)
- SSD calibration: simulate <200 MB/s read; confirm all zone crossings route through GSM Loading

## Related Decisions

- ADR-0001: Cross-System Communication — all OnZoneCrossed / OnDataLayerChanged events follow dynamic multicast delegate pattern
- ADR-0002: Game State Machine — Loading state coordination for Coordinated Loading and Level Transition protocols
- ADR-0004: Subsystem & Module Architecture — UWorldSubsystem tier classification; IHostileSaveProvider pattern established
- ADR-0006: Save/Load Serialization — IHostileSaveProvider registration; FSceneStateData is a sub-struct of UHostileWorldSaveGame
- ADR-0007: Physics & Collision Architecture — OnObjectDestroyed callback feeds destruction state tracking; async physics disabled (bTickPhysicsAsync=false) ensures overlap callbacks are synchronous
