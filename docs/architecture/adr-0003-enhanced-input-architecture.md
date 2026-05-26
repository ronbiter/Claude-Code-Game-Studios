# ADR-0003: Enhanced Input Architecture

## Status
Proposed

## Date
2026-05-19

## Engine Compatibility

| Field | Value |
|-------|-------|
| **Engine** | Unreal Engine 5.7 |
| **Domain** | Input |
| **Knowledge Risk** | MEDIUM — `UEnhancedInputUserSettings` (runtime rebinding) introduced in UE 5.3, post-LLM-cutoff; validated by engine specialist against project engine-reference docs |
| **References Consulted** | `docs/engine-reference/unreal/VERSION.md`, `docs/engine-reference/unreal/modules/input.md` |
| **Post-Cutoff APIs Used** | `UEnhancedInputUserSettings` (UE 5.3+, stable in 5.7) for runtime rebinding persistence |
| **Legacy API Forbidden** | `AddPlayerMappedKey` / `PlayerMappableInputConfig` — pre-5.3 rebinding path, superseded by `UEnhancedInputUserSettings` |
| **Verification Required** | Confirm `UEnhancedInputUserSettings` is accessible via `UEnhancedInputLocalPlayerSubsystem::GetUserSettings()` in a UE 5.7 PIE session |

## ADR Dependencies

| Field | Value |
|-------|-------|
| **Depends On** | ADR-0001 (Cross-System Communication) — IA_* callbacks route to subsystems via Tier 1 multicast delegates; ADR-0002 (Game State Machine) — IMC switches are driven by `UHostileWorldGSM::OnStateEntered` |
| **Enables** | All gameplay systems that consume input: Player Controller implementation, Movement, Combat, Stealth, Dialogue, Inventory |
| **Blocks** | No gameplay input system can be implemented until this ADR is Accepted |
| **Ordering Note** | Must be Accepted before any system that binds or consumes an IA_* action starts implementation |

## Context

### Problem Statement
21 Input Actions and 8 Input Mapping Contexts need defined ownership, asset referencing, runtime switching, and rebinding rules. Without this, programmers will scatter IA_* references across multiple classes, implement IMC switching inconsistently, or use the deprecated legacy input system.

### Constraints
- Enhanced Input only — legacy `BindAction`/`BindAxis` is explicitly forbidden by the Input System GDD
- Player Controller is the defined owner of all IMC management (GDD Rule 1)
- IMC switching must be event-driven from GSM state changes, not polled (ADR-0002 constraint)
- All actions rebindable at runtime except `IA_Pause` (hardlocked per GDD)
- C++ primary; Blueprint used only for asset assignment (data-driven)
- No pawn swap at runtime in Hostile World (single-player, no vehicle or body-swap mechanic)

### Requirements
- All IA_* assets Blueprint-assigned on Player Controller; no hard-coded content paths
- `UEnhancedInputLocalPlayerSubsystem` manages active contexts; Player Controller drives it
- IMC_Default always active as the base layer; overlay contexts pushed/popped on top
- Overlay IMC switches respond to GSM state changes via `OnStateEntered` subscription
- Runtime rebinding via `UEnhancedInputUserSettings` (UE 5.3+)
- `IA_Pause` locked from rebinding at the asset level (`bIsPlayerMappable = false`)
- Rebinding persisted via `UEnhancedInputUserSettings::SaveSettings()` (Save/Load ADR may supersede)

## Decision

**Player Controller-owned Enhanced Input with `UEnhancedInputLocalPlayerSubsystem` + `UEnhancedInputUserSettings`**

### Ownership Model

```
AHostileWorldPlayerController
  ├── owns: all IA_* asset references (Blueprint-assigned UPROPERTY)
  ├── owns: all IMC asset references (Blueprint-assigned UPROPERTY)
  ├── drives: UEnhancedInputLocalPlayerSubsystem (AddMappingContext / RemoveMappingContext)
  ├── binds: ALL IA_* actions in SetupInputComponent() — PC only, not split with Character
  └── routes: IA_* callbacks → ADR-0001 Tier 1 multicast delegates → subsystems
```

**Why all bindings on Player Controller (not split with Character):**
Option A (all on PC) was chosen over Option B (split PC/Character) because:
- PC `SetupInputComponent()` fires once and survives any future pawn swap
- Keeps all routing logic in one class — consistent with "thin router" design
- Character never handles its own input; all dispatch goes through PC delegates

### Architecture Diagram

```
UEnhancedInputLocalPlayerSubsystem
  │  (manages active contexts by priority)
  │
  ├── IMC_Default           (priority 0, always active)
  ├── IMC_Stealth           (priority +1, pushed on crouch)
  ├── IMC_Combat            (priority +1, pushed on engagement)
  ├── IMC_Inventory         (priority +2, pushed on Inventory GSM state)
  ├── IMC_Menu              (priority +2, pushed on Paused GSM state)
  ├── IMC_Dialogue          (priority +3, pushed on Dialogue GSM state)
  └── IMC_Cutscene          (priority +3, pushed on Cutscene/GameOver GSM state)

PC::SetupInputComponent()
  └── UEnhancedInputComponent::BindAction(IA_Move, ..., Route_Move)
      BindAction(IA_Attack, ..., Route_Attack)
      ... (21 total bindings)

GSM::OnStateEntered → PC::OnGSMStateEntered → PushIMC / PopIMC

IA_* callback → PC::Route_Move → OnMoveInput.Broadcast(Value)
                                   └── Movement System handles
```

### Key Interfaces

```cpp
// ── Asset references (Blueprint-assigned) ─────────────────────────────────
UCLASS()
class AHostileWorldPlayerController : public APlayerController
{
    GENERATED_BODY()

public:
    // ── Input Actions (21 total) ─────────────────────────────────────────
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Input|Actions")
    TObjectPtr<UInputAction> IA_Move;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Input|Actions")
    TObjectPtr<UInputAction> IA_Look;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Input|Actions")
    TObjectPtr<UInputAction> IA_Sprint;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Input|Actions")
    TObjectPtr<UInputAction> IA_Crouch;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Input|Actions")
    TObjectPtr<UInputAction> IA_Jump;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Input|Actions")
    TObjectPtr<UInputAction> IA_Interact;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Input|Actions")
    TObjectPtr<UInputAction> IA_Attack;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Input|Actions")
    TObjectPtr<UInputAction> IA_Aim;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Input|Actions")
    TObjectPtr<UInputAction> IA_Reload;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Input|Actions")
    TObjectPtr<UInputAction> IA_Dodge;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Input|Actions")
    TObjectPtr<UInputAction> IA_Melee;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Input|Actions")
    TObjectPtr<UInputAction> IA_Flashlight;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Input|Actions")
    TObjectPtr<UInputAction> IA_QuickSlot1;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Input|Actions")
    TObjectPtr<UInputAction> IA_QuickSlot2;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Input|Actions")
    TObjectPtr<UInputAction> IA_QuickSlot3;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Input|Actions")
    TObjectPtr<UInputAction> IA_QuickSlot4;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Input|Actions")
    TObjectPtr<UInputAction> IA_Inventory;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Input|Actions")
    TObjectPtr<UInputAction> IA_Map;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Input|Actions")
    TObjectPtr<UInputAction> IA_Pause;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Input|Actions")
    TObjectPtr<UInputAction> IA_LeanLeft;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Input|Actions")
    TObjectPtr<UInputAction> IA_LeanRight;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Input|Actions")
    TObjectPtr<UInputAction> IA_Zoom;

    // ── Input Mapping Contexts (8 total, Blueprint-assigned) ─────────────
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Input|Contexts")
    TObjectPtr<UInputMappingContext> IMC_Default;    // priority 0 — always active

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Input|Contexts")
    TObjectPtr<UInputMappingContext> IMC_Stealth;    // priority +1

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Input|Contexts")
    TObjectPtr<UInputMappingContext> IMC_Combat;     // priority +1

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Input|Contexts")
    TObjectPtr<UInputMappingContext> IMC_Mounted;    // priority +1

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Input|Contexts")
    TObjectPtr<UInputMappingContext> IMC_Inventory;  // priority +2

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Input|Contexts")
    TObjectPtr<UInputMappingContext> IMC_Menu;       // priority +2

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Input|Contexts")
    TObjectPtr<UInputMappingContext> IMC_Dialogue;   // priority +3

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Input|Contexts")
    TObjectPtr<UInputMappingContext> IMC_Cutscene;   // priority +3

    // ── IMC push/pop helpers (called from GSM subscription) ──────────────
    void PushIMC(UInputMappingContext* Context, int32 Priority);
    void PopIMC(UInputMappingContext* Context);

        // ── Runtime rebinding (called by Settings menu widget — see Rebinding UI Ownership) ──
    // All rebindable except IA_Pause (bIsPlayerMappable=false on asset)
    UFUNCTION(BlueprintCallable, Category="Input|Rebinding")
    void ApplyKeyRebind(FName ActionMappingName, FKey NewKey);   // wraps UEnhancedInputUserSettings

    UFUNCTION(BlueprintCallable, Category="Input|Rebinding")
    void SaveRebindings();

    UFUNCTION(BlueprintCallable, Category="Input|Rebinding")
    void LoadRebindings();

protected:
    virtual void BeginPlay() override;
    virtual void SetupInputComponent() override;    // all 22 BindAction calls here

private:
    // GSM subscription callback
    UFUNCTION()
    void OnGSMStateEntered(FGameplayTag NewState, FGameplayTag PreviousState);

    UEnhancedInputLocalPlayerSubsystem* GetEIS() const;   // cached accessor with null guard
};


// ── BeginPlay: add IMC_Default + subscribe to GSM ───────────────────────────
void AHostileWorldPlayerController::BeginPlay()
{
    Super::BeginPlay();

    // Add base context — always active
    PushIMC(IMC_Default, 0);

    // Subscribe to GSM state changes (ADR-0002 Tier 1 delegate)
    if (UHostileWorldGSM* GSM = GetGameInstance()->GetSubsystem<UHostileWorldGSM>())
    {
        GSM->OnStateEntered.AddDynamic(this, &AHostileWorldPlayerController::OnGSMStateEntered);
    }

    // Load persisted rebindings
    LoadRebindings();
}


// ── SetupInputComponent: all 22 BindAction calls ────────────────────────────
void AHostileWorldPlayerController::SetupInputComponent()
{
    Super::SetupInputComponent();
    UEnhancedInputComponent* EIC = Cast<UEnhancedInputComponent>(InputComponent);
    check(EIC); // fails loudly if project DefaultPlayerInputClass is wrong

    EIC->BindAction(IA_Move,      ETriggerEvent::Triggered, this, &ThisClass::Route_Move);
    EIC->BindAction(IA_Look,      ETriggerEvent::Triggered, this, &ThisClass::Route_Look);
    EIC->BindAction(IA_Sprint,    ETriggerEvent::Started,   this, &ThisClass::Route_SprintStart);
    EIC->BindAction(IA_Sprint,    ETriggerEvent::Completed, this, &ThisClass::Route_SprintEnd);
    EIC->BindAction(IA_Crouch,    ETriggerEvent::Started,   this, &ThisClass::Route_CrouchToggle);
    EIC->BindAction(IA_Jump,      ETriggerEvent::Started,   this, &ThisClass::Route_Jump);
    EIC->BindAction(IA_Interact,  ETriggerEvent::Started,   this, &ThisClass::Route_Interact);
    EIC->BindAction(IA_Attack,    ETriggerEvent::Started,   this, &ThisClass::Route_Attack);
    EIC->BindAction(IA_Aim,       ETriggerEvent::Started,   this, &ThisClass::Route_AimStart);
    EIC->BindAction(IA_Aim,       ETriggerEvent::Completed, this, &ThisClass::Route_AimEnd);
    EIC->BindAction(IA_Reload,    ETriggerEvent::Started,   this, &ThisClass::Route_Reload);
    EIC->BindAction(IA_Dodge,     ETriggerEvent::Started,   this, &ThisClass::Route_Dodge);
    EIC->BindAction(IA_Melee,     ETriggerEvent::Started,   this, &ThisClass::Route_Melee);
    EIC->BindAction(IA_Flashlight,ETriggerEvent::Started,   this, &ThisClass::Route_Flashlight);
    EIC->BindAction(IA_QuickSlot1,ETriggerEvent::Started,   this, &ThisClass::Route_QuickSlot1);
    EIC->BindAction(IA_QuickSlot2,ETriggerEvent::Started,   this, &ThisClass::Route_QuickSlot2);
    EIC->BindAction(IA_QuickSlot3,ETriggerEvent::Started,   this, &ThisClass::Route_QuickSlot3);
    EIC->BindAction(IA_QuickSlot4,ETriggerEvent::Started,   this, &ThisClass::Route_QuickSlot4);
    EIC->BindAction(IA_Inventory, ETriggerEvent::Started,   this, &ThisClass::Route_Inventory);
    EIC->BindAction(IA_Map,       ETriggerEvent::Started,   this, &ThisClass::Route_Map);
    EIC->BindAction(IA_Pause,     ETriggerEvent::Started,   this, &ThisClass::Route_Pause);
    EIC->BindAction(IA_LeanLeft,  ETriggerEvent::Started,   this, &ThisClass::Route_LeanLeft);
    EIC->BindAction(IA_LeanRight, ETriggerEvent::Started,   this, &ThisClass::Route_LeanRight);
    EIC->BindAction(IA_Zoom,      ETriggerEvent::Started,   this, &ThisClass::Route_Zoom);
}


// ── GSM state → IMC switches ─────────────────────────────────────────────────
void AHostileWorldPlayerController::OnGSMStateEntered(FGameplayTag NewState, FGameplayTag PreviousState)
{
    // Remove previous state's overlay context
    if (PreviousState == TAG_GSM_State_Paused)      PopIMC(IMC_Menu);
    else if (PreviousState == TAG_GSM_State_Dialogue)   PopIMC(IMC_Dialogue);
    else if (PreviousState == TAG_GSM_State_Inventory)  PopIMC(IMC_Inventory);
    else if (PreviousState == TAG_GSM_State_Cutscene
          || PreviousState == TAG_GSM_State_GameOver)   PopIMC(IMC_Cutscene);

    // Add new state's overlay context
    if (NewState == TAG_GSM_State_Paused)       PushIMC(IMC_Menu,      2);
    else if (NewState == TAG_GSM_State_Dialogue)    PushIMC(IMC_Dialogue,  3);
    else if (NewState == TAG_GSM_State_Inventory)   PushIMC(IMC_Inventory, 2);
    else if (NewState == TAG_GSM_State_Cutscene
          || NewState == TAG_GSM_State_GameOver)    PushIMC(IMC_Cutscene,  3);
    // Playing state = IMC_Default only (no overlay); IMC_Stealth and IMC_Combat
    // are pushed/popped by Movement and Combat systems directly, not GSM state
}


// ── Runtime rebinding ─────────────────────────────────────────────────────────
void AHostileWorldPlayerController::ApplyKeyRebind(FName ActionMappingName, FKey NewKey)
{
    // IA_Pause has bIsPlayerMappable=false on asset — UEnhancedInputUserSettings
    // will reject it automatically; no code guard needed here
    UEnhancedInputUserSettings* Settings = GetEIS()->GetUserSettings();
    FMapPlayerKeyArgs Args;
    Args.MappingName = ActionMappingName;
    Args.Slot        = EPlayerMappableKeySlot::First;
    Args.NewKey      = NewKey;

    FGameplayTagContainer FailureReason;
    Settings->MapPlayerKey(Args, FailureReason);
}

void AHostileWorldPlayerController::SaveRebindings() { GetEIS()->GetUserSettings()->SaveSettings(); }
void AHostileWorldPlayerController::LoadRebindings() { GetEIS()->GetUserSettings()->LoadSettings(); }
```

### Rebinding UI Ownership (C4 Resolution — 2026-05-26)

The settings-menu key-capture widget is owned by the **HUD subsystem** (ADR-0016
`UHUDSubsystem`, `ULocalPlayerSubsystem` tier). The widget is a **thin consumer**:
it captures a new `FKey` from the user, then calls
`AHostileWorldPlayerController::ApplyKeyRebind(ActionMappingName, NewKey)` followed
by `SaveRebindings()`. The widget never touches `UEnhancedInputUserSettings`
directly.

```
Settings Menu Widget (owned by UHUDSubsystem, ADR-0016)
    │
    │  user presses new key → captured FKey
    ▼
AHostileWorldPlayerController::ApplyKeyRebind(MappingName, NewKey)   ← sole rebinding op owner
    │
    ▼
UEnhancedInputUserSettings::MapPlayerKey(...)
    │
    ▼
AHostileWorldPlayerController::SaveRebindings()
    │
    ▼
UEnhancedInputUserSettings::SaveSettings()   ← persists to EIUS own save file
```

**Ownership boundary**:
- `AHostileWorldPlayerController` owns the **operation** (`ApplyKeyRebind`,
  `SaveRebindings`, `LoadRebindings`) and is the only class permitted to call
  `UEnhancedInputUserSettings`.
- `UHUDSubsystem` (ADR-0016) owns the **UI widget** (`UWidget_KeyBindingsMenu`)
  that presents bindings to the player and captures input. The widget holds a
  `TWeakObjectPtr<AHostileWorldPlayerController>` and calls the BlueprintCallable
  `ApplyKeyRebind` API.
- No other class — not Movement, not Combat, not Save/Load — may call
  `UEnhancedInputUserSettings` directly.

### Rebinding Persistence Location (OQ-1 Resolution — 2026-05-26)

**Decision**: Input bindings are persisted in `UEnhancedInputUserSettings`'s **own
save file** (separate from the game save slot owned by ADR-0006). They are **not**
serialized into `USaveGame`.

**Rationale**:
- Bindings are **profile-scoped** — they apply across all save slots and across
  new-game sessions. Storing them in a per-slot save would force re-binding after
  every new game start.
- `UEnhancedInputUserSettings` is Epic's intended persistence path for this data;
  using it avoids hand-rolled serialization of `FKey` arrays.
- ADR-0006 explicitly excludes input bindings from `USaveGame` (see ADR-0006
  Constraints).
- Zero contention with the autosave-only / no-slot-management constraint in
  ADR-0006 — bindings load on `BeginPlay()` before any save slot is touched.

OQ-1 is hereby **closed**. The risk previously listed under "Rebinding conflict
with Save/Load" no longer applies — both ADRs now formally agree on the
separation.

## Alternatives Considered

### Alternative 1: Split Bindings — PC owns PC-level, Character owns gameplay
- **Description**: `SetupInputComponent()` on PC binds Pause/Map/Inventory; `SetupPlayerInputComponent()` on Character binds Move/Attack/etc.
- **Pros**: Each class owns its domain; more idiomatic when Character logic is self-contained
- **Cons**: Contradicts "thin router" GDD design; Character becomes an input owner competing with PC; pawn swap drops gameplay bindings; routing logic scattered across two classes
- **Rejection Reason**: Violates the GDD's explicit "thin router" pattern. All routing must be centralized in the PC.

### Alternative 2: Dedicated Input Manager Subsystem
- **Description**: A `ULocalPlayerSubsystem` owns all IMC logic; PC just delegates to it
- **Pros**: PC stays even thinner; subsystem can be tested independently
- **Cons**: Introduces a third class for a responsibility the GDD assigns to PC; adds indirection without architectural benefit at this project scale
- **Rejection Reason**: Over-engineered for a single-player game with a clearly defined router.

### Alternative 3: Legacy Input System
- **Description**: `BindAction`/`BindAxis` on `UInputComponent`
- **Pros**: Simpler API; no asset dependencies
- **Cons**: Deprecated in UE5; no runtime rebinding; no context switching; explicitly forbidden by Input System GDD
- **Rejection Reason**: Forbidden by both the GDD and the engine's own deprecation path.

## Consequences

### Positive
- Single class owns all input routing — no cross-class input dependencies
- `SetupInputComponent()` fires once; bindings persist through future scene transitions
- IMC_Default always active as a stable base; overlays cleanly compose on top
- `UEnhancedInputUserSettings` handles persistence with zero custom serialization code
- `bIsPlayerMappable=false` on `IA_Pause` asset locks it from rebinding at the engine level — no code guard needed

### Negative
- 22 `BindAction` calls in a single function is verbose — maintainable but not elegant
- All 22 IA_* and 8 IMC assets must be assigned in the PC Blueprint before first play — a blank PC Blueprint will crash on the first input event (null IA_* reference)
- Rebinding persisted by `UEnhancedInputUserSettings` uses its own save file, not the game's save slot — if the Save/Load system later requires rebindings inside the save game object, this must be revisited

### Risks
- **Null IA_* asset crash**: Any unassigned UPROPERTY crashes when the action fires. **Mitigation**: `check()` or `ensureMsgf()` in `SetupInputComponent()` that every IA_* UPROPERTY is non-null; add CI validation that crashes loudly before ship.
- **Wrong DefaultPlayerInputClass**: If project settings don't set `DefaultPlayerInputClass = EnhancedPlayerInput`, the `Cast<UEnhancedInputComponent>` in `SetupInputComponent()` returns null and `check(EIC)` crashes on startup. **Mitigation**: `check(EIC)` provides immediate failure message; add to engine setup checklist.
- **IMC_Stealth / IMC_Combat not in GSM switch**: These are pushed/popped by Movement and Combat systems directly (not GSM state). If those systems call `PushIMC()` without going through PC, they need a direct reference to the PC. **Mitigation**: Expose `PushIMC` / `PopIMC` as `UFUNCTION(BlueprintCallable)` and document the calling convention; Movement and Combat ADRs must reference this.
- **`UEnhancedInputUserSettings` availability**: Requires `EnhancedInput` module in `Build.cs`. Already required for `UEnhancedInputLocalPlayerSubsystem`. **Mitigation**: Single `Build.cs` entry covers both.
- **Rebinding conflict with Save/Load**: ✅ Resolved 2026-05-26 (C4). `UEnhancedInputUserSettings` own save file is authoritative. ADR-0006 explicitly excludes input bindings from `USaveGame`. See "Rebinding Persistence Location (OQ-1 Resolution)" above.

## GDD Requirements Addressed

| GDD System | Requirement | How This ADR Addresses It |
|------------|-------------|--------------------------|
| `input-system.md` | Enhanced Input only; legacy input forbidden | ADR bans legacy APIs in Forbidden Patterns; Tier 1 Alternative 3 rejected |
| `input-system.md` | 21 Input Actions defined and routable | All 22 IA_* assets declared as UPROPERTY; all 22 bound in `SetupInputComponent()` |
| `input-system.md` | 8 IMCs with priority order | 8 IMC UPROPERTY declarations; priority constants match GDD table |
| `input-system.md` | Runtime rebinding for all except IA_Pause | `UEnhancedInputUserSettings::MapPlayerKey()`; `IA_Pause` locked via asset flag |
| `input-system.md` | Rebinding stored in save profile | `UEnhancedInputUserSettings::SaveSettings()` / `LoadSettings()` (may be superseded by Save/Load ADR) |
| `input-system.md` | IMC_Inventory dampens movement to 20% | Defined in Inventory IMC asset; PC pushes the context; Movement System applies the dampen factor (owned by Inventory System GDD Rule 8) |
| `player-controller.md` | Rule 1 — PC owns IMC stack | All 8 IMC assets and all `AddMappingContext` / `RemoveMappingContext` calls on PC |
| `player-controller.md` | Rule 1 — loose coupling via multicast delegates | Each `Route_*` callback fires an ADR-0001 Tier 1 delegate; subsystems subscribe via `AddDynamic()` |
| `player-controller.md` | Rule 3 — State-driven input gating | `OnGSMStateEntered()` subscription drives IMC overlay switches |
| `game-state-machine.md` | Input System subscribes to `OnStateEntered` | Confirmed: PC subscribes in `BeginPlay()`; switches IMC overlays per state |

## Performance Implications
- **CPU**: `UEnhancedInputLocalPlayerSubsystem` processes input per-frame for active contexts only. 8 possible contexts, typically 1–2 active simultaneously. Cost < 0.1ms per frame at 60fps.
- **Memory**: 22 `TObjectPtr<UInputAction>` + 8 `TObjectPtr<UInputMappingContext>` = ~240 bytes of pointers on the PC. Assets loaded once at startup.
- **Load Time**: All IA_* and IMC assets are soft references loaded at project startup. No runtime async loading.
- **Input Latency**: `SetupInputComponent()` binding path: Enhanced Input fires callback on same frame as input event. PC `Route_*` → delegate broadcast → subsystem handler all execute synchronously. Total routing overhead < 0.1ms, well within the 50ms combat latency budget from `player-controller.md`.

## Migration Plan
No existing code to migrate. Greenfield implementation.

## Validation Criteria
- `Cast<UEnhancedInputComponent>(InputComponent)` succeeds in `SetupInputComponent()` — no null
- All 22 IA_* UPROPERTY fields non-null at `BeginPlay()` — verified by `ensureMsgf()` checks
- `IA_Move` triggers `Route_Move` callback within 1 frame of key press in PIE
- IMC_Menu is active during Paused GSM state; IMC_Default active during Playing state — verified via console command `showdebug input`
- Player rebinds `IA_Attack` to new key → quits PIE → relaunches → rebinding persists
- Attempting to rebind `IA_Pause` in settings UI produces no result (asset flag blocks it)
- `UEnhancedInputUserSettings` accessible via `GetEIS()->GetUserSettings()` in PIE

## Open Questions

| # | Question | Owner | Target |
|---|----------|-------|--------|
| OQ-1 | ✅ RESOLVED 2026-05-26 (C4) — bindings live in `UEnhancedInputUserSettings` own save file; explicitly excluded from `USaveGame` (ADR-0006). | Save/Load ADR | — |
| OQ-2 | `IA_Flashlight`: toggle (hold) or latch (press to toggle)? Affects trigger type on the asset. | game-designer | Input GDD Q1 |
| OQ-3 | Mirror lean when facing opposite direction? Affects IMC_Stealth lean bindings. | game-designer | Input GDD Q2 |

## Related Decisions
- ADR-0001 — Cross-System Communication: `Route_*` callbacks broadcast via Tier 1 multicast delegates
- ADR-0002 — Game State Machine: `OnStateEntered` subscription drives IMC overlay switching
- ADR-0004 (planned) — Component Composition: Movement and Combat systems call `PushIMC` / `PopIMC` for IMC_Stealth and IMC_Combat
- `design/gdd/input-system.md` — canonical IA_* list, IMC priority table, rebinding rules
- `design/gdd/player-controller.md` — IMC stack ownership, routing delegates, input gating rules
