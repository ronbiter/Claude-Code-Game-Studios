# ADR-0002: Game State Machine Implementation

## Status
Accepted

## Date
2026-05-15

## Engine Compatibility

| Field | Value |
|-------|-------|
| **Engine** | Unreal Engine 5.7 |
| **Domain** | Core |
| **Knowledge Risk** | LOW — UGameInstanceSubsystem, FTickableGameObject, TArray, TMap, FGameplayTag are stable; no changes in 5.4–5.7 |
| **References Consulted** | `docs/engine-reference/unreal/VERSION.md` |
| **Post-Cutoff APIs Used** | None — UGameInstanceSubsystem introduced in UE 4.26, all APIs used here are pre-5.3 |
| **Verification Required** | Confirm `ShouldCreateSubsystem()` excludes editor-utility worlds in PIE with multiple worlds |

## ADR Dependencies

| Field | Value |
|-------|-------|
| **Depends On** | ADR-0001 (Cross-System Communication) — must be Accepted; this ADR uses Tier 1 multicast delegates for all state change notifications |
| **Enables** | ADR-0003 (Enhanced Input Architecture) — Input uses GSM state to switch IMCs; ADR-0004 (Component Composition) — all gameplay components subscribe to GSM |
| **Blocks** | Player Controller, HUD, Camera, Input, Combat — all subscribe to GSM state changes; implementation cannot start until this ADR is Accepted |
| **Ordering Note** | Must be Accepted before any system that reads or writes GSM state begins implementation |

## Context

### Problem Statement
The Game State Machine is the central orchestrator subscribed to by 15+ systems. Without a defined implementation pattern, programmers will independently invent ownership models (GameMode singleton, static accessor, manual instantiation), producing multiple conflicting GSM instances or null-reference crashes during level transitions.

### Constraints
- Single authoritative GSM instance for the full game session (per GDD Rule 1)
- Must survive level transitions — the Loading state spans them
- All state change notifications are event-driven, not polled (per GDD Rule 2)
- Same-frame transition requests must be processed in priority order (per GDD Formula 3)
- Reentrancy guard: callbacks during state change must not trigger nested transitions (per GDD Rule 7)
- C++ primary; Blueprint read access required for UI/prototyping

### GDD Conflict Resolved
The GDD specifies the GSM is "owned by the GameMode" but also defines a `Loading` state that spans level transitions. In UE5.7, `AGameMode` is destroyed and recreated between level loads — a GameMode-owned GSM would be torn down mid-Loading. This ADR overrides the GDD's ownership wording and adopts `UGameInstanceSubsystem`, which matches the GDD's _intent_ (single authoritative source, always available) while surviving level transitions. The GDD's interface contracts (`RequestStateTransition`, `OnStateEntered`, etc.) are preserved unchanged.

### Requirements
- One GSM instance per game session (survives level transitions)
- Priority-sorted transition queue (not FIFO)
- `FTickableGameObject` for queue drain on game thread tick
- Reentrancy guard set before firing delegates
- GameOver stack-clear fires `OnStateExited` for each popped state
- All callers must be on the game thread (async loading must marshal via `AsyncTask(ENamedThreads::GameThread, ...)`)

## Decision

**`UHostileWorldGSM : public UGameInstanceSubsystem, public FTickableGameObject`**

The GSM is a `UGameInstanceSubsystem` (one instance per `UGameInstance`, survives level loads) that also implements `FTickableGameObject` to drain the transition queue each frame.

### Architecture Diagram

```
UGameInstance
    └── UHostileWorldGSM (subsystem, 1 per session)
            ├── TArray<FGameplayTag> StateStack     (LIFO, Last() = active)
            ├── TArray<FFSMEvent> TransitionQueue   (sorted by priority desc, drained each tick)
            ├── bool bIsProcessingTransition        (reentrancy guard)
            ├── TMap<FGameplayTag, TSet<FGameplayTag>> ValidTransitions
            │
            ├── UPROPERTY(BlueprintAssignable) FOnGSMStateEntered   OnStateEntered
            ├── UPROPERTY(BlueprintAssignable) FOnGSMStateExited    OnStateExited
            └── UPROPERTY(BlueprintAssignable) FOnGSMTransitionStarted OnTransitionStarted

Access:
    GetGameInstance()->GetSubsystem<UHostileWorldGSM>()

Tick (FTickableGameObject):
    Tick(DeltaTime) → ProcessTransitionQueue()
        → Sort TransitionQueue by priority (desc)
        → For each event: CanPush()? → ExecuteTransition() : Log and discard
```

### Key Interfaces

```cpp
// ── Event struct ──────────────────────────────────────────────────────────────
USTRUCT(BlueprintType)
struct FFSMEvent {
    GENERATED_BODY()
    UPROPERTY() FGameplayTag TargetState;
    UPROPERTY() FGameplayTag RequestingSystem;  // for debug logging only
    UPROPERTY() int32 Priority = 0;             // derived from TargetState's priority value
};

// ── Delegate declarations (ADR-0001 Tier 1) ──────────────────────────────────
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(
    FOnGSMStateEntered, FGameplayTag, NewState, FGameplayTag, PreviousState);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(
    FOnGSMStateExited, FGameplayTag, ExitingState);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(
    FOnGSMTransitionStarted, FGameplayTag, FromState, FGameplayTag, ToState);

// ── Subsystem class ───────────────────────────────────────────────────────────
UCLASS()
class HOSTILEWORLD_API UHostileWorldGSM
    : public UGameInstanceSubsystem
    , public FTickableGameObject
{
    GENERATED_BODY()

public:
    // USubsystem interface
    virtual bool ShouldCreateSubsystem(UObject* Outer) const override;
    virtual void Initialize(FSubsystemCollectionBase& Collection) override;
    virtual void Deinitialize() override;

    // FTickableGameObject interface
    virtual void Tick(float DeltaTime) override;    // Drains TransitionQueue
    virtual TStatId GetStatId() const override;
    virtual bool IsTickable() const override { return !IsTemplate(); }

    // ── State queries (Blueprint-safe) ───────────────────────────────────────
    UFUNCTION(BlueprintCallable, Category="GSM")
    FGameplayTag GetCurrentState() const;           // StateStack.Last()

    UFUNCTION(BlueprintCallable, Category="GSM")
    TArray<FGameplayTag> GetStateStack() const;     // Copy — safe for BP; C++ prefer IsStateActive()

    UFUNCTION(BlueprintCallable, Category="GSM")
    bool IsStateActive(FGameplayTag State) const;   // True if State is anywhere in stack

    // ── Transition request ────────────────────────────────────────────────────
    // MUST be called from the game thread.
    // Async callers (loading completion, audio callbacks) must marshal:
    //   AsyncTask(ENamedThreads::GameThread, [this, Event]{ RequestStateTransition(Event); });
    UFUNCTION(BlueprintCallable, Category="GSM")
    void RequestStateTransition(FFSMEvent Event);   // check(IsInGameThread()); enqueue

    // ── Delegates (ADR-0001 Tier 1) ─────────────────────────────────────────
    UPROPERTY(BlueprintAssignable, Category="GSM")
    FOnGSMStateEntered OnStateEntered;

    UPROPERTY(BlueprintAssignable, Category="GSM")
    FOnGSMStateExited OnStateExited;

    UPROPERTY(BlueprintAssignable, Category="GSM")
    FOnGSMTransitionStarted OnTransitionStarted;

private:
    TArray<FGameplayTag> StateStack;                // LIFO; index 0 = bottom, Last() = active
    TArray<FFSMEvent> TransitionQueue;              // Same-frame requests; sorted by priority before drain
    bool bIsProcessingTransition = false;           // Reentrancy guard — set BEFORE firing delegates

    // Valid transition table: CurrentState -> valid destination states
    // Populated in Initialize(); all transitions from the GDD state table
    TMap<FGameplayTag, TSet<FGameplayTag>> ValidTransitions;

    void InitValidTransitions();
    void ProcessTransitionQueue();                  // Called from Tick()
    bool CanPush(FGameplayTag NewState) const;      // Priority check; GameOver always returns true
    void ExecuteTransition(FGameplayTag NewState);  // Sets guard, fires delegates, manipulates stack
    void ExecuteGameOverTransition();               // Clears stack, fires OnStateExited for each popped state
};
```

### Transition Processing Rules (from GDD)

```
ProcessTransitionQueue():
  1. Sort TransitionQueue by Event.Priority descending (GDD Formula 3)
  2. Set bIsProcessingTransition = true   ← BEFORE delegate firing (M4 fix)
  3. For each event in sorted queue:
       if TargetState == TAG_GSM_GameOver:
           ExecuteGameOverTransition()     ← clears stack, fires OnStateExited for each (M5 fix)
           break (GameOver clears queue)
       else if CanPush(TargetState):
           ExecuteTransition(TargetState)
       else:
           Log rejection (priority too low or invalid transition)
  4. Clear TransitionQueue
  5. Set bIsProcessingTransition = false

CanPush(NewState):
  Returns priority(NewState) > priority(StateStack.Last())
  GameOver (priority 100) always returns true

ExecuteTransition(NewState):
  OnTransitionStarted.Broadcast(CurrentState, NewState)
  OnStateExited.Broadcast(CurrentState)         ← fired before stack change
  StateStack.Push(NewState)                      ← or Pop then Push for non-stacking transitions
  OnStateEntered.Broadcast(NewState, PreviousState)

ExecuteGameOverTransition():
  While StateStack.Num() > 0:
      OnStateExited.Broadcast(StateStack.Last())
      StateStack.Pop()
  StateStack.Push(TAG_GSM_GameOver)
  OnStateEntered.Broadcast(TAG_GSM_GameOver, PreviousTop)
```

### State Priority Table (from GDD)

| State Tag | Priority | Blocking? |
|-----------|----------|-----------|
| `GSM.State.Title` | 0 | Yes |
| `GSM.State.Loading` | 1 | Yes |
| `GSM.State.Playing` | 10 | No |
| `GSM.State.Paused` | 20 | Yes (input) |
| `GSM.State.Cutscene` | 25 | Yes |
| `GSM.State.Dialogue` | 30 | Yes (movement) |
| `GSM.State.Inventory` | 35 | Yes (movement) |
| `GSM.State.GameOver` | 100 | Yes — clears entire stack |

All state tags defined in `GameplayTags.h` under the `GSM.State.*` namespace.

## Alternatives Considered

### Alternative 1: GameMode-Owned Component (original GDD wording)
- **Description**: `UHostileWorldGSM` as `UActorComponent` owned by `AGameMode`
- **Pros**: Matches GDD wording; natural UE ownership model
- **Cons**: `AGameMode` is destroyed and recreated between level loads in UE. The GSM would be in `Loading` state when the world tears down — subscribers would receive callbacks on stale actors. Requires state serialization and restoration on every level load.
- **Rejection Reason**: `UGameInstanceSubsystem` matches the GDD intent (single authoritative source) without the level-transition complexity.

### Alternative 2: UWorldSubsystem
- **Description**: `UHostileWorldGSM : public UWorldSubsystem`
- **Pros**: Automatic per-world lifecycle; clean UE pattern
- **Cons**: Torn down and recreated on level transition — same problem as GameMode. State would be lost during the Loading→Playing transition.
- **Rejection Reason**: Same lifetime issue as Alternative 1. World subsystems are appropriate for per-level state, not game-session state.

### Alternative 3: Static Singleton / Autoload
- **Description**: A static `UHostileWorldGSM*` pointer set in `UGameInstance::Init()`
- **Pros**: Universally accessible without subsystem lookup
- **Cons**: Not GC-safe; cannot use UPROPERTY(); invisible to engine tooling; breaks in PIE with multiple worlds
- **Rejection Reason**: Violates ADR-0001's forbidden pattern `autoload_singleton_coupling`. `UGameInstanceSubsystem` provides the same accessibility with proper GC integration.

## Consequences

### Positive
- Single instance per game session — no race conditions or duplicate GSMs
- Survives level transitions — Loading state works correctly
- FTickableGameObject provides deterministic per-frame queue drain without requiring Actor ownership
- Blueprint-accessible via `UGameplayStatics::GetGameInstance()->GetSubsystem<>()`

### Negative
- Two inheritance bases (`UGameInstanceSubsystem` + `FTickableGameObject`) — slightly unusual but established UE pattern for tickable subsystems
- All callers must explicitly marshal to game thread for async contexts — additional boilerplate for loading completion callbacks

### Risks
- **Editor multi-world PIE**: Without `ShouldCreateSubsystem()`, the GSM instantiates for all UGameInstance contexts in PIE, causing multiple GSMs to fight over state. **Mitigation**: Override returns `false` unless context is a game world.
- **Async caller marshaling omission**: A system calling `RequestStateTransition()` from a non-game-thread (loading callback) will hit `check(IsInGameThread())` and crash. **Mitigation**: Document in each system's BeginPlay setup; add a `RequestStateTransitionSafe()` wrapper that marshals if not on game thread (convenience helper, not canonical path).
- **ValidTransitions table maintenance**: Adding a new state requires updating `InitValidTransitions()` in C++ + recompile. **Mitigation**: Flag for data-driven migration (UDataTable) once state count exceeds 12.

## GDD Requirements Addressed

| GDD System | Requirement | How This ADR Addresses It |
|------------|-------------|--------------------------|
| `game-state-machine.md` | Rule 1 — Single authoritative source | `UGameInstanceSubsystem`: one instance per game session, enforced by engine |
| `game-state-machine.md` | Rule 2 — Event-driven transitions only | `RequestStateTransition()` enqueues; no system may set stack directly |
| `game-state-machine.md` | Rule 3 — Transition request protocol | `RequestStateTransition()` validates via `CanPush()` and `ValidTransitions`; invalid requests logged and discarded |
| `game-state-machine.md` | Rule 4 — Exit/Entry guarantees | `ExecuteTransition()` fires `OnStateExited` before stack change, `OnStateEntered` after |
| `game-state-machine.md` | Rule 5 — Priority stack (LIFO) | `TArray<FGameplayTag> StateStack` with LIFO semantics; `CanPush()` compares priorities |
| `game-state-machine.md` | Rule 7 — Reentrancy guard | `bIsProcessingTransition` set before delegate fire; nested `RequestStateTransition()` calls enqueue and execute next tick |
| `game-state-machine.md` | Formula 3 — Priority-sorted queue | `TransitionQueue` sorted by `Event.Priority` descending before each drain |
| `game-state-machine.md` | GameOver exception (clears stack) | `ExecuteGameOverTransition()` fires `OnStateExited` for each state before clearing |
| All 22 GDDs | "Subscribes to GSM state changes" | All systems call `GetSubsystem<UHostileWorldGSM>()->OnStateEntered.AddDynamic(...)` |

## Performance Implications
- **CPU**: `FTickableGameObject::Tick()` fires every frame. `ProcessTransitionQueue()` is O(N log N) for queue sort where N = same-frame requests (typically 0–2). Cost < 0.05ms in normal play.
- **Memory**: `StateStack` max depth 8 (per GDD tuning knob) × 8 bytes per FGameplayTag = ~64 bytes. `ValidTransitions` map ~1KB. Negligible.
- **Load Time**: `InitValidTransitions()` called once in `Initialize()` — not on hot path.
- **Network**: Client-only. Server state is out of scope for this ADR.

## Migration Plan
No existing code to migrate. Greenfield implementation.

## Validation Criteria
- `GetGameInstance()->GetSubsystem<UHostileWorldGSM>()` returns a valid pointer in PIE before any `BeginPlay()` fires
- `RequestStateTransition()` from a non-game-thread triggers `check(IsInGameThread())` crash in Debug builds
- Same-frame requests are processed in priority order (higher priority first) — verified by unit test
- `OnStateExited` fires before `OnStateEntered` in every transition — verified by unit test
- GameOver transition fires `OnStateExited` for every state on the stack before pushing GameOver — verified by unit test
- Zero GSM instances visible in multiple-world PIE (ShouldCreateSubsystem guard) — verified manually
- Reentrancy: callback that calls `RequestStateTransition()` has its request deferred to next tick, not executed immediately — verified by unit test

## Related Decisions
- ADR-0001 — Cross-System Communication: all GSM delegates follow the Tier 1 multicast delegate pattern
- ADR-0003 (planned) — Enhanced Input Architecture: Input System subscribes to GSM `OnStateEntered` to switch IMCs
- `design/gdd/game-state-machine.md` — canonical state list, transition table, priority values, and all behavioral rules
