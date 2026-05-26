# ADR-0018: Player Controller Architecture

## Status
Proposed

## Date
2026-05-26

## Engine Compatibility

| Field | Value |
|-------|-------|
| **Engine** | Unreal Engine 5.7 |
| **Domain** | Core / Input |
| **Knowledge Risk** | MEDIUM — UE 5.7 post-LLM cutoff; Enhanced Input APIs confirmed stable via ADR-0003 precedent |
| **References Consulted** | `docs/engine-reference/unreal/VERSION.md`, `docs/engine-reference/unreal/modules/input.md`, `docs/engine-reference/unreal/breaking-changes.md` |
| **Post-Cutoff APIs Used** | `UEnhancedInputLocalPlayerSubsystem::AddMappingContext/RemoveMappingContext` (confirmed stable, ADR-0003); `UWorld::AsyncLineTraceByChannel` + `UWorld::QueryTraceData` (stable async trace poll model) |
| **Verification Required** | Confirm `UWorld::QueryTraceData(Handle, OutData)` returns true reliably on the cycle following `AsyncLineTraceByChannel` dispatch at 4Hz timer cadence; verify FTraceHandle invalidation behaviour in `EndPlay()` does not leave stale handle data. |

## ADR Dependencies

| Field | Value |
|-------|-------|
| **Depends On** | ADR-0003 (Enhanced Input binding, PushIMC/PopIMC pattern — must be Accepted); ADR-0004 (subsystem tier, PC as APlayerController not a subsystem); ADR-0009 (camera — trace origin and direction); ADR-0010 (movement state events and stamina queries); ADR-0012 (alien AI state reads for context priority); ADR-0013 (infection zone reads for context validation); ADR-0014 (combat engagement events, IMC_Combat management); ADR-0015 (health events and death routing); ADR-0017 (stealth detection events, IMC_Stealth management) |
| **Enables** | All gameplay epics requiring input routing: Movement, Combat, Stealth, Dialogue, Investigation, Inventory |
| **Blocks** | Epic: Player Controller Implementation (cannot start until this ADR is Accepted) |
| **Ordering Note** | ADR-0003 covers Enhanced Input binding and the PushIMC/PopIMC interface. ADR-0018 extends it with the full PC architecture: context resolver, input state machine, and event subscription model. Implement ADR-0003 patterns first. |

## Context

### Problem Statement

`AHostileWorldPlayerController` is the central input router for Hostile World but lacks a formal architecture decision. ADR-0003 established Enhanced Input binding and the IMC push/pop interface — but the full PC architecture (context action resolver, 6-state input FSM, subsystem event subscription model, `FContextPrompt` lifecycle, and input latency contracts) is undocumented and at risk of inconsistent implementation across teams.

### Constraints

- PC must remain a **thin router**: no gameplay state (no HP cache, no stamina float, no movement enum) — all live in Character and subsystems
- ADR-0003 IMC ownership must be preserved: `AHostileWorldPlayerController::PushIMC()/PopIMC()` are the sole call sites for `UEnhancedInputLocalPlayerSubsystem::AddMappingContext/RemoveMappingContext`; no other class calls the subsystem directly
- ADR-0001 event-subscription mandate: PC must not poll subsystem state in `Tick()`
- ADR-0004: PC is `APlayerController`, NOT a `USubsystem` — access via `World->GetFirstPlayerController()` or pawn `Controller` pointer
- Context resolver must not block the game thread — use async trace poll model (`AsyncLineTraceByChannel` + `QueryTraceData`)
- `UStealthComponent` DECIDES when IMC_Stealth changes occur (subscribes to `OnDetectionStateChanged`) but routes through `PC::PushIMC()/PopIMC()` — never calls `UEnhancedInputLocalPlayerSubsystem` directly
- `UCombatSubsystem` DECIDES when IMC_Combat changes occur (on `OnCombatEngaged/Disengaged`) but routes through `PC::PushIMC()/PopIMC()` — never calls the subsystem directly

### Requirements

- Context resolver runs at adaptive 2–6.7 Hz (never per-frame tick)
- Input latency: combat actions <50ms total, movement <100ms, context interaction <150ms
- Subscribe to events from all 8 upstream sources listed in GDD (`player-controller.md`)
- Route all 22 `IA_*` actions via multicast delegates defined in ADR-0003
- Maintain 6-state input FSM (Free Play / Stealth / Combat / Dialogue / Inventory / Paused+Cutscene)
- Context resolver must guard against stale trace handles and destroyed actor targets

## Decision

`AHostileWorldPlayerController : APlayerController` implements three independent subsystems in a single class:

1. **IMC Stack Manager** (from ADR-0003) — sole `PushIMC()/PopIMC()` gateway to `UEnhancedInputLocalPlayerSubsystem`
2. **Context Action Resolver** — hybrid proximity sphere + async trace poll at adaptive 2–6.7 Hz
3. **Input State Router** — 6-state FSM gating available `IA_*` actions per GSM and combat/stealth state

**No gameplay state lives in PC.** All reads of gameplay values (health, stamina, movement state) happen once per input event via the Character's public interface — not in `Tick()`. All subsystem interactions use event subscription (`BeginPlay AddDynamic` → `EndPlay RemoveDynamic`).

### Architecture Diagram

```
AHostileWorldPlayerController
│
├── IMC Stack Manager (ADR-0003)
│   ├── PushIMC(UInputMappingContext*, int32 Priority)  ← sole entry point for all callers
│   ├── PopIMC(UInputMappingContext*)
│   └── → UEnhancedInputLocalPlayerSubsystem (AddMappingContext / RemoveMappingContext)
│
├── Context Action Resolver
│   ├── FTimerHandle ContextResolverTimer (adaptive 2–6.7 Hz)
│   ├── RunContextResolver()   ← fired by timer
│   │   ├── Step 1: QueryTraceData(PendingHandle) → process if ready
│   │   ├── Step 2: SphereOverlapActors() → proximity pass (NPCs, Dialogue targets)
│   │   └── Step 3: AsyncLineTraceByChannel() → store FTraceHandle (results next cycle)
│   ├── PriorityMerge(ProximityResults, LastTraceHit) → FContextPrompt
│   └── → UHUDSubsystem::SetContextPrompt(FContextPrompt) / ClearContextPrompt()
│
└── Input State Router
    ├── BeginPlay: SubscribeToEvents()
    │   ├── UHostileWorldGSM::OnStateEntered / OnStateExited
    │   ├── UCombatSubsystem::OnCombatEngaged / OnCombatDisengaged
    │   ├── UStealthSubsystem::OnDetectionStateChanged
    │   ├── UHealthComponent::OnHealthChanged / OnPlayerDied
    │   ├── UHostileMovementComponent::OnMovementStateChanged / OnStaminaChanged
    │   ├── UHostileMovementComponent::OnCoverEntered / OnCoverExited
    │   └── UCameraComponent::OnCameraModeChanged
    ├── EInputContextState CurrentInputState (6-state FSM)
    ├── Route_* multicast delegates → subsystem handlers (ADR-0003 pattern)
    └── HandleInteractInput() → FContextPrompt routing + 0.3s cooldown timer
```

**IMC_Stealth and IMC_Combat ownership chain:**

```
UStealthComponent
  OnDetectionStateChanged (subscribed) → PC->PushIMC(IMC_Stealth) / PopIMC(IMC_Stealth)

UCombatSubsystem
  OnCombatEngaged (internal state transition) → PC->PushIMC(IMC_Combat) / PopIMC(IMC_Combat)
```

Both components hold `TWeakObjectPtr<AHostileWorldPlayerController>` acquired in `BeginPlay()`. Neither ever calls `UEnhancedInputLocalPlayerSubsystem` directly.

### Key Interfaces

```cpp
// ── IMC Stack Manager (ADR-0003) ─────────────────────────────────────────────
UFUNCTION(BlueprintCallable, Category = "Input")
void PushIMC(UInputMappingContext* IMC, int32 Priority);

UFUNCTION(BlueprintCallable, Category = "Input")
void PopIMC(UInputMappingContext* IMC);

// ── Rebinding (C4 resolution, ADR-0003) ──────────────────────────────────────
UFUNCTION(BlueprintCallable, Category = "Input")
void ApplyKeyRebind(FName MappingName, FKey NewKey);

UFUNCTION(BlueprintCallable, Category = "Input")
void SaveRebindings();

UFUNCTION(BlueprintCallable, Category = "Input")
void LoadRebindings();

// ── Context Action Resolver ───────────────────────────────────────────────────
// Fires on FTimerHandle at adaptive 4Hz base. NOT called in Tick().
void RunContextResolver();

// Internal helpers
void DispatchContextTrace(FVector Start, FVector End);   // stores PendingTraceHandle
bool TryConsumeTraceResult(FContextPrompt& OutResult);   // polls QueryTraceData; returns true if ready
FContextPrompt PriorityMerge(const TArray<AActor*>& ProximityResults, AActor* LastTraceHit);

// Published to HUD on every resolver cycle
UPROPERTY(BlueprintReadOnly, Category = "Context")
FContextPrompt CurrentContextPrompt;

// ── Input State Router ────────────────────────────────────────────────────────
UPROPERTY(BlueprintReadOnly, Category = "Input")
EInputContextState CurrentInputState;

// Called when IA_Interact fires; routes to FContextPrompt.Target's handler
void HandleInteractInput(const FInputActionValue& Value);
```

**FContextPrompt** (owned by PC, published to HUD):
```cpp
USTRUCT(BlueprintType)
struct FContextPrompt {
    GENERATED_BODY()

    UPROPERTY() TObjectPtr<AActor> Target;          // interactable actor
    UPROPERTY() FText ActionLabel;                   // "Talk", "Pick Up", "Open", "Search"
    UPROPERTY() FText TargetName;                    // "Dr. Elena Vasquez", "Locked Door"
    UPROPERTY() EInteractableType Type;              // NPC, Item, Switch, Door, Loot
    UPROPERTY() float Priority;                      // merged P score (formula below)
    UPROPERTY() bool bRequiresTool;
    UPROPERTY() FName RequiredTool;                  // item tag needed if bRequiresTool
};
```

**EInputContextState** (PC input FSM — drives context resolver validation, not IMC authority):
```cpp
UENUM(BlueprintType)
enum class EInputContextState : uint8 {
    FreePlay,    // IMC_Default active
    Stealth,     // IMC_Default + IMC_Stealth (managed by UStealthComponent via PC->PushIMC)
    Combat,      // IMC_Default + IMC_Combat (managed by UCombatSubsystem via PC->PushIMC)
    Dialogue,    // IMC_Dialogue (movement locked)
    Inventory,   // IMC_Inventory (movement dampened 20%)
    Paused,      // IMC_Menu
    Cutscene     // IMC_Cutscene (all input blocked)
};
// Priority: Cutscene > Paused > Dialogue > Inventory > Combat > Stealth > FreePlay
// "Context Active" is an overlay on any state — does not change EInputContextState.
// NOTE: This FSM describes PC's input gating intent. Authoritative active IMC list
// is always queried from UEnhancedInputLocalPlayerSubsystem, not from this enum.
```

**Async trace poll model** (correct UE 5.7 API — no delegate callback):
```cpp
// Called inside RunContextResolver()
void AHostileWorldPlayerController::DispatchContextTrace(FVector Start, FVector End)
{
    FCollisionQueryParams Params;
    Params.AddIgnoredActor(GetPawn());
    PendingTraceHandle = GetWorld()->AsyncLineTraceByChannel(
        EAsyncTraceType::Single, Start, End, ECC_Interact, Params);
    bTracePending = true;
}

// Also called inside RunContextResolver() BEFORE dispatching next trace
bool AHostileWorldPlayerController::TryConsumeTraceResult(FContextPrompt& OutResult)
{
    if (!bTracePending) return false;
    FTraceDatum Data;
    if (!GetWorld()->QueryTraceData(PendingTraceHandle, Data)) return false;
    bTracePending = false;
    if (Data.OutHits.Num() > 0 && IsValid(Data.OutHits[0].GetActor()))
    {
        // build OutResult from hit
    }
    return true;
}
```

## Alternatives Considered

### Alternative 1: Fat Player Controller
- **Description**: PC caches gameplay state (health, stamina, movement flags) as member variables and makes input gating decisions from its own cache.
- **Pros**: Simpler context resolver logic; fewer event subscriptions.
- **Cons**: Cache drifts from actual subsystem state. Adds hidden state layer. Contradicts ADR-0001 (event subscription mandate) and ADR-0003 (thin router).
- **Rejection Reason**: PC is an input router, not a game state manager. All state lives in its owning system.

### Alternative 2: UInputRouterSubsystem
- **Description**: Extract input routing into a `ULocalPlayerSubsystem`. PC delegates to it.
- **Pros**: Cleaner separation; unit-testable subsystem.
- **Cons**: Unnecessary extra layer. `APlayerController` is UE's natural input owner — it survives pawn swaps and provides the correct object lifecycle. Context resolver needs pawn location and camera rotation; subsystem indirection makes these awkward.
- **Rejection Reason**: UE actor hierarchy already provides the right owner. No architectural gain.

### Alternative 3: Async Trace Delegate Callback Model
- **Description**: Register a delegate callback on `FTraceHandle` that fires automatically when results are ready.
- **Pros**: True event-driven — no polling.
- **Cons**: This API does not exist in UE 5.7. `AsyncLineTraceByChannel` returns `FTraceHandle` only; results are polled via `QueryTraceData()`. (Confirmed by engine specialist, 2026-05-26.)
- **Rejection Reason**: API does not exist. Poll model adopted instead.

### Alternative 4: Synchronous Line Trace at 4Hz
- **Description**: Use `LineTraceSingleByChannel` (synchronous) inside the 4Hz timer instead of async.
- **Pros**: Simpler code; no handle management.
- **Cons**: Synchronous trace can spike frame time if the trace is complex. Async poll amortises cost across two frames, preventing spike.
- **Rejection Reason**: Async poll is preferred to avoid trace spikes. Synchronous fallback is acceptable if async API proves unreliable (see Risks).

## Consequences

### Positive
- Single authoritative location for all input routing — input bugs have one root cause location
- Thin-router keeps PC effectively stateless; no cache drift
- Adaptive polling (2–6.7 Hz) keeps context resolver CPU cost <0.1ms/frame amortized
- Async trace poll prevents frame spikes in complex scenes
- Clear IMC change authority: only `PC::PushIMC()/PopIMC()` touches `UEnhancedInputLocalPlayerSubsystem`; `UStealthComponent` and `UCombatSubsystem` route through PC

### Negative
- PC subscribes to 8 upstream event sources — `BeginPlay`/`EndPlay` discipline required; missed `RemoveDynamic` causes dangling delegates
- `TryConsumeTraceResult()` adds one-cycle latency to context prompt updates (trace dispatched cycle N, results available cycle N+1)
- `UStealthComponent` and `UCombatSubsystem` must hold `TWeakObjectPtr<AHostileWorldPlayerController>` — PC must be valid before pawn components initialize

### Risks

- **Risk 1**: Pending async trace results arrive after PC or target actor is destroyed.
  Mitigation: `EndPlay()` sets `bTracePending = false` (invalidates poll). `TryConsumeTraceResult()` calls `IsValid(Hit.GetActor())` before publishing `FContextPrompt`.

- **Risk 2**: `EInputContextState` FSM diverges from actual active IMCs (since `UStealthComponent` and `UCombatSubsystem` control IMC_Stealth/IMC_Combat via PC).
  Mitigation: FSM is for context resolver gating only — it describes PC's view of game state, not the authoritative IMC list. If authoritative query needed, always read from `UEnhancedInputLocalPlayerSubsystem`, not from `CurrentInputState`.

- **Risk 3**: `UStealthComponent` or `UCombatSubsystem` calls `PC->PushIMC()` before PC is valid (during initialization ordering).
  Mitigation: Both components acquire `TWeakObjectPtr<AHostileWorldPlayerController>` in their own `BeginPlay()` (which fires after PC is fully initialized). Must check `IsValid(PC)` before calling.

- **Risk 4**: Context resolver timer not stopped during Cutscene/Paused states, producing stale prompts.
  Mitigation: `OnGSMStateEntered(Paused/Cutscene/GameOver)` must explicitly call `ContextResolverTimer.Invalidate()` and `UHUDSubsystem::ClearContextPrompt()`.

- **Risk 5**: `QueryTraceData()` returns false for multiple cycles (trace never completes — e.g., pathological geometry).
  Mitigation: Store dispatch frame number. If `QueryTraceData()` returns false after 3 cycles (~0.75s at 4Hz), discard the handle and dispatch a fresh trace.

## GDD Requirements Addressed

| GDD System | Requirement | How This ADR Addresses It |
|------------|-------------|--------------------------|
| player-controller.md | Thin-router pattern: PC routes input, manages IMC stack, resolves context actions | Formalized in Decision section as the three-subsystem architecture |
| player-controller.md | Hybrid context resolution (proximity NPC, trace world items) | Context Action Resolver: SphereOverlapActors (4Hz) + AsyncLineTraceByChannel poll model |
| player-controller.md | FContextPrompt data structure with 7 fields | Defined in Key Interfaces: Target, ActionLabel, TargetName, Type, Priority, bRequiresTool, RequiredTool |
| player-controller.md | State-driven input gating (6 states + Context Active overlay) | EInputContextState FSM with priority chain; Context Active is an overlay |
| player-controller.md | Event-driven, not polled — subscribes to subsystem state changes | SubscribeToEvents() pattern in BeginPlay; 8 event sources listed |
| player-controller.md | Context priority formula P = P_base + D_proximity×W_proximity + D_camera×W_camera + P_state | PriorityMerge() implements this formula from GDD |
| player-controller.md | Adaptive polling T_poll = clamp(T_base × (1 + N × W), T_min, T_max) | FTimerHandle ContextResolverTimer reset interval after each RunContextResolver() cycle |
| player-controller.md | Input latency budgets: combat <50ms, movement <100ms, context <150ms | Performance Implications section |
| player-controller.md | Context prompt lifecycle: detect→validate→present→activate→resolve→cooldown | TryConsumeTraceResult→PriorityMerge→SetContextPrompt→HandleInteractInput→cooldown timer |
| player-controller.md | 0.3s cooldown between interactions | FTimerHandle InteractCooldownTimer set in HandleInteractInput |
| player-controller.md | Context resolver paused during Cutscene/Paused/GameOver | Risk 4 mitigation: timer invalidated on GSM state entry |
| input-system.md | IMC push/pop rules (stack, not replace) | PushIMC/PopIMC delegating to UEnhancedInputLocalPlayerSubsystem (ADR-0003) |
| game-state-machine.md | GSM state drives IMC changes | OnStateEntered/OnStateExited subscriptions |

## Performance Implications

- **CPU**: Context resolver at adaptive 4Hz base (0.25s) to 2Hz max (0.50s). SphereOverlapActors: ~0.05ms/call. AsyncLineTraceByChannel + QueryTraceData: ~0.02ms combined. PriorityMerge: negligible (arithmetic). Total resolver: <0.1ms/frame amortized.
- **Memory**: `FContextPrompt` ~120 bytes. `EInputContextState` 1 byte. `FTraceHandle` 8 bytes. 8 delegate bindings ~64 bytes. Negligible.
- **Load Time**: None — all initialization in `BeginPlay()`.
- **Network**: N/A (single-player).

## Migration Plan

No existing code to migrate — this ADR establishes the initial `AHostileWorldPlayerController` pattern before implementation.

**Implementation order:**
1. `PushIMC()/PopIMC()` wrappers + `SetupInputComponent()` Route_* bindings (ADR-0003 base)
2. `ApplyKeyRebind()/SaveRebindings()/LoadRebindings()` BlueprintCallable wrappers (C4 resolution)
3. Event subscriptions in `BeginPlay()`: GSM → Health → Movement → Combat → Stealth → Camera
4. `EInputContextState` FSM transitions wired to event handlers
5. Context Action Resolver (SphereOverlap + async trace poll model)
6. `FContextPrompt` publishing to `UHUDSubsystem`
7. `HandleInteractInput()` + cooldown timer

## Validation Criteria

- `AHostileWorldPlayerController` has no UPROPERTY or member variables storing gameplay state (no HP, no stamina float, no EHostileMovementState cache)
- `Tick()` must not call any subsystem accessor (`GetCurrentHP()`, `GetDetectionScore()`, `GetMovementState()`, etc.)
- Context resolver timer is stopped in all non-Playing GSM states (Paused, Cutscene, GameOver, Dialogue)
- `TryConsumeTraceResult()` validates hit actor with `IsValid()` before publishing `FContextPrompt`
- `EndPlay()` invalidates `ContextResolverTimer`, sets `bTracePending = false`, clears `PendingTraceHandle`
- Combat input latency: `T_input + T_routing + T_subsystem + T_animation < 50ms` at 60fps
- Movement input latency: same chain, target < 100ms
- Context interaction latency: IA_Interact to subsystem handler invocation < 150ms
- `UStealthComponent` never calls `UEnhancedInputLocalPlayerSubsystem::AddMappingContext()` directly — all IMC_Stealth changes via `PC->PushIMC()/PopIMC()`
- `UCombatSubsystem` never calls `UEnhancedInputLocalPlayerSubsystem::AddMappingContext()` directly — all IMC_Combat changes via `PC->PushIMC()/PopIMC()`
- Stale trace handle test: target actor destroyed while `bTracePending == true` → `TryConsumeTraceResult()` returns false or skips the destroyed actor; no crash
- Stuck handle test: `QueryTraceData()` returning false for 3+ cycles → handle discarded, fresh trace dispatched

## Related Decisions
- ADR-0003: Enhanced Input Architecture — input binding, IMC push/pop API, rebinding
- ADR-0004: Subsystem Module Architecture — PC as APlayerController, not a subsystem
- ADR-0009: Camera Architecture — trace origin, GetCameraRotation
- ADR-0010: Movement Architecture — OnMovementStateChanged, OnStaminaChanged, OnCoverEntered/Exited
- ADR-0014: Combat System Architecture — OnCombatEngaged/Disengaged, IMC_Combat management via UCombatSubsystem
- ADR-0015: Health System Architecture — OnHealthChanged, OnPlayerDied events
- ADR-0017: Stealth System Architecture — OnDetectionStateChanged, IMC_Stealth management via UStealthComponent
