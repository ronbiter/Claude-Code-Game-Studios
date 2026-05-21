# ADR-0001: Cross-System Communication Architecture

## Status
Accepted

## Date
2026-05-15

## Engine Compatibility

| Field | Value |
|-------|-------|
| **Engine** | Unreal Engine 5.7 |
| **Domain** | Core |
| **Knowledge Risk** | LOW — delegates and Gameplay Message Router unchanged in 5.4–5.7 |
| **References Consulted** | `docs/engine-reference/unreal/VERSION.md` |
| **Post-Cutoff APIs Used** | `UGameplayMessageSubsystem` (introduced ~UE 5.1, stable in 5.7) |
| **Plugin Required** | `GameplayMessageRouter` — must be enabled in `.uproject`; add `GameplayMessageRuntime` to `Build.cs` for every system that listens or broadcasts |
| **Verification Required** | Smoke-test: broadcast and receive one Gameplay Message in PIE before status moves to Accepted |

## ADR Dependencies

| Field | Value |
|-------|-------|
| **Depends On** | None — this is the foundation ADR |
| **Enables** | All subsequent ADRs — every system-to-system communication decision depends on this pattern |
| **Blocks** | No implementation epic can start until this ADR is Accepted |
| **Ordering Note** | Must be the first ADR written and accepted. All other ADRs reference this pattern. |

## Context

### Problem Statement
22 systems in Hostile World need to communicate with each other without tight coupling. Without a defined pattern, each programmer will independently choose between direct function calls, Blueprint event dispatchers, UE delegates, and custom event buses — producing inconsistent architecture that is difficult to test, refactor, or debug.

### Constraints
- C++ is the primary language; Blueprint is used for gameplay prototyping only
- 60fps target; communication must not introduce per-frame polling overhead
- All systems must be independently testable in isolation
- UE 5.7 — Enhanced Input, Gameplay Messages subsystem, and Gameplay Tags are available

### Requirements
- Must support 1-to-many notifications (one producer → N subscribers)
- Must be type-safe (no stringly-typed message buses)
- Must support subscription + unsubscription lifecycle without memory leaks
- Must not require systems to hold direct references to each other's instances
- Must integrate with UE's reflection system (serializable, Blueprint-accessible where needed)
- Must support the GSM subscription model specified in `design/gdd/game-state-machine.md`
- Must support the Player Controller multicast routing specified in `design/gdd/player-controller.md`

## Decision

**Hybrid pattern: Dynamic Multicast Delegates (primary) + Gameplay Message Router (secondary)**

### Tier 1 — Dynamic Multicast Delegates: Owner→Subscriber Events

Use `DECLARE_DYNAMIC_MULTICAST_DELEGATE` for all events where the producing system is the known owner of the event and subscribers are systems that directly care about that owner's state.

**Examples**: `UGameStateMachine::OnStateEntered`, `UHealthComponent::OnHealthChanged`, `UCombatSystem::OnCombatEngaged`

**Rules:**
1. Each system declares its delegates as `UPROPERTY(BlueprintAssignable)` on its component or class
2. Subscribers call `AddDynamic()` in `BeginPlay()` — never in constructors
3. Subscribers call `RemoveDynamic()` in `EndPlay()` — prevents dangling delegate callbacks on destroyed objects
4. No system may call another system's methods directly except through documented public interfaces
5. **Exception**: Player Controller may query Character's public interface directly (documented in `design/gdd/player-controller.md` Rule 4 — direct query on-demand, not polling)

### Tier 2 — Gameplay Message Router: Global Broadcast Events

Use `UGameplayMessageSubsystem::BroadcastMessage<FMessageType>()` for events where consuming systems are unknown at authoring time, or many unrelated systems may care about the event.

**Examples**: `TAG_GameEvent_World_InfectionZoneChanged` (consumed by AI, Scene Management, HUD, Audio), `TAG_GameEvent_Quest_Updated`, `TAG_GameEvent_Faction_ReputationChanged`

**Rules:**
1. Define a `FGameplayTag` channel per message type (e.g., `GameEvent.World.InfectionZoneChanged`)
2. Message structs must be `USTRUCT(BlueprintType)` with `UPROPERTY()` fields only — no raw pointers; all enum fields must be `UENUM(BlueprintType)` markup
3. Listeners register via `UGameplayMessageSubsystem::RegisterListener<T>()` and store the returned `FGameplayMessageListenerHandle`
4. **Handle must be stored as a member field on the listening object — never a local variable.** A handle stored as a local variable unregisters immediately when it goes out of scope, silently dropping the listener.
5. Handles must be released in `EndPlay()` — same lifecycle rule as delegates

### Tier 3 — Forbidden Patterns

- **Direct cross-system state writes**: System A must never write to state owned by System B. Use method calls on the owner instead.
- **Polling for state changes in `Tick()`**: No Tick function may read another system's state to detect changes. Subscribe to the change event instead.
- **Blueprint Event Dispatchers for C++ core systems**: BP dispatchers are for Blueprint-only gameplay prototyping. All C++ systems use Dynamic Multicast Delegates.
- **Raw function pointer callbacks**: Use `DECLARE_DYNAMIC_MULTICAST_DELEGATE` — raw function pointers are not serializable and do not work with Blueprint.

### Architecture Diagram

```
Tier 1 — Dynamic Multicast Delegates (owner→subscriber)

Producer System                        Consumer Systems
───────────────────                    ────────────────────────────────────────
UPROPERTY(BlueprintAssignable)
FOnStateChanged OnStateChanged;

                      BeginPlay():
                      Producer->OnStateChanged.AddDynamic(this, &USystemB::Handle)
                      Producer->OnStateChanged.AddDynamic(this, &USystemC::Handle)

                      Broadcast:
                      OnStateChanged.Broadcast(NewState, OldState)
                           │──────────────────→ USystemB::Handle(NewState, OldState)
                           └──────────────────→ USystemC::Handle(NewState, OldState)


Tier 2 — Gameplay Message Router (global broadcast)

InfectionSystem::BroadcastMessage(TAG_GameEvent_World_InfectionZoneChanged, Msg{...})
        │
        ├──────→ AlienAISystem::OnInfectionZoneChanged(Channel, Msg)
        ├──────→ HUDSystem::OnInfectionZoneChanged(Channel, Msg)
        ├──────→ SceneManagement::OnInfectionZoneChanged(Channel, Msg)
        └──────→ AudioSystem::OnInfectionZoneChanged(Channel, Msg)
```

### Key Interfaces

```cpp
// ── TIER 1: Per-system delegate declaration ──────────────────────────────────

// In the producing system's header
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(
    FOnStateChanged, FGameplayTag, NewState, FGameplayTag, OldState);

UPROPERTY(BlueprintAssignable)
FOnStateChanged OnStateChanged;

// In the subscribing system's BeginPlay()
ProducerRef->OnStateChanged.AddDynamic(this, &UMySystem::HandleStateChanged);

// In the subscribing system's EndPlay()
ProducerRef->OnStateChanged.RemoveDynamic(this, &UMySystem::HandleStateChanged);

// Callback signature (must match delegate declaration exactly)
UFUNCTION()
void HandleStateChanged(FGameplayTag NewState, FGameplayTag OldState);


// ── TIER 2: Gameplay Message broadcast ──────────────────────────────────────

// Message struct (all enum fields must have UENUM(BlueprintType) markup)
USTRUCT(BlueprintType)
struct FInfectionZoneChangedMsg {
    GENERATED_BODY()
    UPROPERTY() FVector ZoneCenter;
    UPROPERTY() float ZoneRadius;
    UPROPERTY() EInfectionStage Stage;   // EInfectionStage must be UENUM(BlueprintType)
};

// Broadcast (producer)
UGameplayMessageSubsystem& MsgSubsys = UGameplayMessageSubsystem::Get(GetWorld());
MsgSubsys.BroadcastMessage(TAG_GameEvent_World_InfectionZoneChanged,
                           FInfectionZoneChangedMsg{ ZoneCenter, ZoneRadius, Stage });

// Listen (consumer) — handle stored as UPROPERTY member field, not local variable
UPROPERTY()
FGameplayMessageListenerHandle InfectionZoneHandle;

InfectionZoneHandle = MsgSubsys.RegisterListener<FInfectionZoneChangedMsg>(
    TAG_GameEvent_World_InfectionZoneChanged,
    this, &UMySystem::OnInfectionZoneChanged);

// Cleanup (EndPlay)
InfectionZoneHandle.Unregister();   // or let UPROPERTY destructor handle it
```

## Alternatives Considered

### Alternative 1: Dynamic Multicast Delegates Only
- **Description**: Use only `DECLARE_DYNAMIC_MULTICAST_DELEGATE` for all inter-system communication
- **Pros**: Single pattern, simpler mental model, zero external dependencies
- **Cons**: Requires the producer to know its consumer list; Infection Spread fans out to 7+ unrelated systems — hard-coded subscriber lists create tight coupling between unrelated systems
- **Rejection Reason**: Global events like infection zone changes have no natural single owner. Gameplay Messages solve this without custom infrastructure.

### Alternative 2: Custom Event Bus Subsystem
- **Description**: Build a custom `UEventBusSubsystem` that all systems post to and subscribe from
- **Pros**: Maximum decoupling; no system knows about any other
- **Cons**: Type safety requires significant boilerplate; loses UE reflection integration; re-implements what `UGameplayMessageSubsystem` already provides and maintains
- **Rejection Reason**: The engine ships the solution. Use it.

### Alternative 3: Direct Function Calls
- **Description**: Systems hold direct `TWeakObjectPtr` references and call each other's methods
- **Pros**: Simple to trace in debugger; minimal overhead
- **Cons**: Tight coupling; breaks when system boundaries change; untestable in isolation; creates circular dependency chains across 22 systems
- **Rejection Reason**: 22 interconnected systems built on direct calls produces a dependency graph that cannot be maintained, tested, or refactored.

## Consequences

### Positive
- All systems are testable in isolation (no hard dependencies on other system instances)
- Adding a new consumer requires zero changes to the producing system
- Gameplay Tags for message channels are centrally discoverable in the Tags editor
- `UPROPERTY(BlueprintAssignable)` delegates are accessible from Blueprint prototyping without C++ changes

### Negative
- Two patterns to learn — engineers must understand when to use Tier 1 vs Tier 2
- Delegate chain debugging is less direct than stepping through function calls
- `GameplayMessageRuntime` module must be added to every system's `Build.cs`

### Risks
- **Dangling delegate crash**: Subscriber destroyed without calling `RemoveDynamic()` → callback fires on dead object → crash. **Mitigation**: `EndPlay()` unsubscription is a required code review checklist item for every system.
- **Silent listener drop**: `FGameplayMessageListenerHandle` stored as a local variable unregisters immediately on scope exit. **Mitigation**: ADR explicitly requires member field storage (Tier 2 Rule 4); enforced in code review.
- **Message tag typo causes silent miss**: Mismatched `FGameplayTag` channels register but never receive messages. **Mitigation**: All message channel tags defined in a single `GameplayTags.h` header; Gameplay Tag validation enabled in Project Settings (`bWarnOnInvalidTags`).
- **Missing `Build.cs` dependency**: `GameplayMessageRuntime` missing from a system's `Build.cs` produces a linker error, not a compile error — may silently fail in some configurations. **Mitigation**: Add to project template; verify in engine setup.

## GDD Requirements Addressed

| GDD System | Requirement | How This ADR Addresses It |
|------------|-------------|--------------------------|
| `game-state-machine.md` | `SubscribeToStateChange(FStateChangeDelegate)` — all systems subscribe to state changes | Tier 1: `FOnStateChanged` multicast delegate on `UGameStateMachine`; `AddDynamic()` pattern |
| `game-state-machine.md` | Rule 7 — Reentrancy guard on callbacks; no system may trigger a state change within a callback | Reentrancy guard implemented in `UGameStateMachine`; ADR Tier 3 forbids state changes within delegate callbacks |
| `player-controller.md` | `FOnActionRouted` multicast delegate for loose coupling (Rule 1, Input Routing Architecture) | Tier 1 multicast delegate pattern; each system registers its input handler via `AddDynamic()` |
| `player-controller.md` | Rule 4 — Event-driven subscriptions, not polling | ADR Tier 3 explicitly forbids polling in `Tick()`; all state monitoring via delegate subscription |
| `infection-spread-system.md` | Zone changed events consumed by AI, HUD, Scene Management, Audio | Tier 2: `TAG_GameEvent_World_InfectionZoneChanged` broadcast; all consumers register independently |
| All 22 GDDs | "Subscribes to events from [system]" pattern used throughout | This ADR defines the canonical pattern for all inter-system event subscriptions |

## Performance Implications
- **CPU**: Dynamic multicast delegate broadcast is O(N subscribers), synchronous. No `Tick()` overhead when no events fire. Typical subscriber count < 20 per delegate; broadcast cost < 0.1ms.
- **Memory**: Each registered delegate handle ~32 bytes. 22 systems × avg 5 subscriptions = ~3.5KB total. Negligible.
- **Load Time**: Gameplay Tags loaded from INI at startup; no runtime overhead after loading.
- **Network**: This ADR covers client-side communication only. Server-authoritative replication is covered by a separate networking ADR.

## Migration Plan
No existing code to migrate. This ADR establishes the greenfield pattern.

## Validation Criteria
- All inter-system event subscriptions use `AddDynamic()` / `RemoveDynamic()` — verified by code review
- No `Tick()` function reads another system's state to detect changes — verified by static analysis and code review
- No system holds a direct instance reference to another system (except PC → Character exception) — verified by code review
- `GameplayMessageRuntime` dependency verified in `.uproject` and all system `Build.cs` files before first build
- `FGameplayMessageListenerHandle` stored as member field in all listener classes — verified by code review
- Zero dangling delegate crashes in 10 minutes of play-testing through all GSM state transitions
- Smoke-test: one Gameplay Message broadcast + receive confirmed working in PIE before ADR status → Accepted

## Related Decisions
- ADR-0002 (planned): Game State Machine Implementation — uses Tier 1 delegate pattern for state broadcasts
- ADR-0003 (planned): Enhanced Input Architecture — uses Tier 1 delegate pattern for input routing
- `design/gdd/game-state-machine.md` — GSM delegate interface contract
- `design/gdd/player-controller.md` — multicast delegate routing pattern
