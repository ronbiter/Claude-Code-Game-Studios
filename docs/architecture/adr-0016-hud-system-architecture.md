# ADR-0016: HUD System Architecture

## Status
Proposed

## Date
2026-05-25

## Engine Compatibility

| Field | Value |
|-------|-------|
| **Engine** | Unreal Engine 5.7 |
| **Domain** | UI |
| **Knowledge Risk** | MEDIUM — UMG is stable since UE 4.x but post-cutoff CommonUI/UMG improvements (5.4–5.7) are not fully known |
| **References Consulted** | `docs/engine-reference/unreal/modules/ui.md`, `docs/engine-reference/unreal/VERSION.md` |
| **Post-Cutoff APIs Used** | None — decision uses established UMG (UUserWidget) and ULocalPlayerSubsystem patterns, both stable since UE 5.0 |
| **Verification Required** | (1) Confirm `UHUDSubsystem::Initialize()` fires before first widget `NativeConstruct()` in PIE — use null-guard fallback if order is not guaranteed. (2) Verify `RemoveFromParent()` + delegate unbind zeroes both render cost and CPU event cost (`stat slate` in PIE). (3) Verify mode-switch viewport swap produces no one-frame flicker at 60fps VSync-off in PIE. (4) Verify `BindWorldSystems()` / `UnbindWorldSystems()` round-trip correctly across a level transition in PIE (no stale delegates, no missing events after load). (5) Spawn `ue-umg-specialist` before implementation to confirm UMG binding patterns against UE 5.7 actual API. |

## ADR Dependencies

| Field | Value |
|-------|-------|
| **Depends On** | ADR-0001 (all cross-system events via delegates — no direct polling), ADR-0004 Accepted (ULocalPlayerSubsystem tier locked for HUD), ADR-0009 (camera_mode_changed_event — HUD visibility per camera state), ADR-0014 (combat events — ammo, combat state), ADR-0015 (health events — HP, injury state) |
| **Enables** | All HUD implementation stories (health bar, ammo counter, detection meter, minimap, context prompts, damage vignette) |
| **Blocks** | Epic: HUD Implementation — cannot start until this ADR is Accepted |
| **Ordering Note** | ADR-0004 must be Accepted (it is) before this ADR can be implemented. This ADR must be Accepted before any HUD widget or UHUDSubsystem class is authored. |

## Context

### Problem Statement
The HUD system requires an owner class, widget architecture, and event-routing model that serves two structurally distinct rendering modes (Immersive and Tactical) while consuming events from 10+ subsystems without coupling widget code directly to those subsystems.

### Constraints
- ADR-0004 (Accepted) locks the tier: `UHUDSubsystem : ULocalPlayerSubsystem`
- ADR-0001 forbids polling subsystem state from tick — all updates must be event-driven
- HUD mode cannot change mid-combat (GDD Rule 1) — change must be queued
- Both modes must share the same data source (GDD Rule 2)
- HUD visibility changes per camera mode per GDD Rule 7
- `ULocalPlayerSubsystem` survives level transitions but world-scoped upstream objects do not — subscriptions must be managed across world changes
- Performance: < 0.5ms/frame at 60fps for full Tactical HUD (GDD acceptance criterion)

### Requirements
- Must support two independent rendering pipelines sharing a common data cache
- Must route events from 10 source subsystems to the active renderer without direct widget-to-subsystem coupling
- Must queue mode switches and apply them after combat ends
- Must respond to camera mode changes for HUD element visibility
- Must manage context prompt priority and display lifecycle
- Upstream subscriptions to world-scoped objects must survive level transitions cleanly (re-bind on new world ready)

## Decision

`UHUDSubsystem` (a `ULocalPlayerSubsystem`) owns all HUD state, subscribes to all upstream subsystem delegates, and forwards events to the active widget via its own multicast delegates. Two separate `UUserWidget` subclasses — `UHUDWidget_Immersive` and `UHUDWidget_Tactical` — are created at `Initialize()`, held alive via `UPROPERTY() TObjectPtr<>`, and kept off-viewport until activated. Only the active mode's widget is on-viewport and delegate-bound; the inactive widget is off-viewport and fully unbound — zero render cost and zero CPU event cost.

### Widget Activate / Deactivate Lifecycle

Widgets do NOT bind or unbind delegates in `NativeConstruct()` / `NativeDestruct()`. Instead, `UHUDSubsystem` drives explicit `Activate()` / `Deactivate()` calls:

```
Activate(Widget):
  1. Widget->AddToViewport(ZOrder: 0)
  2. UHUDSubsystem calls Widget->BindDelegates(this) — widget calls AddDynamic for all 10 forwarded delegates
  3. Widget reads FHUDDataCache for initial state population

Deactivate(Widget):
  1. UHUDSubsystem calls Widget->UnbindDelegates(this) — widget calls RemoveDynamic for all 10 forwarded delegates
  2. Widget->RemoveFromParent()
```

`NativeConstruct()` is used only to null-guard the subsystem reference:
```cpp
void UHUDWidget_Tactical::NativeConstruct() {
    Super::NativeConstruct();
    // Do NOT bind delegates here — Activate() does this
    // Null-guard subsystem reference for use in BindDelegates
    CachedHUDSubsystem = GetOwningLocalPlayer()
        ? GetOwningLocalPlayer()->GetSubsystem<UHUDSubsystem>()
        : nullptr;
}
```
`BindDelegates()` / `UnbindDelegates()` only execute if `CachedHUDSubsystem` is valid.

### World-Transition Subscription Management

`UHUDSubsystem` splits upstream subscriptions into two groups:

**Session-stable** (per-actor components on the player character — survive transitions if character is possessed through them):
- `UHealthComponent::OnHealthChanged`
- `UCombatComponent::OnAmmoChanged`
- `UCombatSubsystem::OnCombatStateChanged`
- `UStealthComponent::OnDetectionChanged`
- `UHostileMovementComponent::OnStaminaChanged`
- `AHostileWorldPlayerController::OnContextPrompt`

Rebound in `UHUDSubsystem::OnPlayerPossessed()` — registered via `AHostileWorldPlayerController::OnPossessedPawnChanged`.

**World-scoped** (world subsystems and world actors — destroyed on level transition):
- `USceneManagementSubsystem::OnZoneCrossed`
- `UAlienSquadSubsystem::OnThreatUpdate`
- `UInfectionSpreadSubsystem::OnCellStateChanged`
- `AHostileWorldPlayerCameraManager::OnCameraModeChanged`

Bound in `UHUDSubsystem::BindWorldSystems()` — called by `UHostileWorldGSM` `OnLevelReady` notification (GSM manages level transition events per ADR-0002). Unbound in `UnbindWorldSystems()` — called by GSM `OnWorldTearDown` notification. `UHUDSubsystem` registers with `UHostileWorldGSM` for these notifications in `Initialize()`.

### Mode Switching

`UHUDSubsystem::RequestModeChange(EHUDMode)` checks `FHUDDataCache.bIsInCombat`. If `true`, stores the request in `PendingModeChange`. When `OnCombatStateChanged(bInCombat=false)` arrives, flushes the pending mode by calling `Deactivate(CurrentWidget)` then `Activate(NewWidget)`. The swap is O(1): one `RemoveFromParent()` + one delegate unbind pass + one `AddToViewport()` + one delegate bind pass.

### Camera Visibility

`UHUDSubsystem` receives `OnCameraModeChanged` via the world-scoped group above. It broadcasts `OnHUDCameraModeChanged` to the active widget. The active widget collapses itself on `ECameraMode::Scoped` or `Cinematic` via `SetVisibility(ESlateVisibility::Collapsed)` — it remains constructed, on-viewport, and delegate-bound (so state stays current) but produces zero draw calls.

### Architecture Diagram

```
ULocalPlayer
    └── UHUDSubsystem
            ├── FHUDDataCache  (latest state of all 10 event types)
            ├── EHUDMode  (Immersive | Tactical, current)
            ├── EHUDMode PendingModeChange  (null if no change queued)
            │
            ├── Session-stable upstream subscriptions
            │   (rebound via OnPlayerPossessed)
            │     OnHealthChanged      ← UHealthComponent
            │     OnAmmoChanged        ← UCombatComponent
            │     OnCombatStateChanged ← UCombatSubsystem
            │     OnDetectionChanged   ← UStealthComponent
            │     OnStaminaChanged     ← UHostileMovementComponent
            │     OnContextPrompt      ← AHostileWorldPlayerController
            │
            ├── World-scoped upstream subscriptions
            │   (BindWorldSystems / UnbindWorldSystems via GSM)
            │     OnZoneCrossed        ← USceneManagementSubsystem
            │     OnThreatUpdate       ← UAlienSquadSubsystem
            │     OnCellStateChanged   ← UInfectionSpreadSubsystem
            │     OnCameraModeChanged  ← AHostileWorldPlayerCameraManager
            │
            ├── Forwarded delegates (widgets bind via Activate/Deactivate)
            │     OnHUDHealthChanged
            │     OnHUDAmmoChanged
            │     OnHUDCombatStateChanged
            │     OnHUDDetectionChanged
            │     OnHUDStaminaChanged
            │     OnHUDZoneCrossed
            │     OnHUDContextPrompt
            │     OnHUDThreatUpdate
            │     OnHUDCellStateChanged
            │     OnHUDCameraModeChanged
            │
            ├── UPROPERTY() TObjectPtr<UHUDWidget_Immersive>
            │     (kept alive in memory; on-viewport + delegate-bound when active)
            │
            └── UPROPERTY() TObjectPtr<UHUDWidget_Tactical>
                  (kept alive in memory; off-viewport + unbound when inactive)
```

### Key Interfaces

```cpp
// HUD mode
UENUM(BlueprintType)
enum class EHUDMode : uint8 { Immersive, Tactical };

// HUD data cache — plain USTRUCT, no logic
USTRUCT()
struct FHUDDataCache {
    GENERATED_BODY()
    float CurrentHP = 100.f, MaxHP = 100.f;
    EInjuryState InjuryState = EInjuryState::None;
    int32 MagazineCount = 0, ReserveCount = 0;
    ECombatState CombatState = ECombatState::Clear;
    bool bIsInCombat = false;
    float DetectionScore = 0.f;
    EStealthState StealthState = EStealthState::Hidden;
    float CurrentStamina = 100.f, MaxStamina = 100.f;
    bool bExhausted = false;
    FName CurrentZone = NAME_None;
    TArray<FThreatDotData> ThreatPositions;
    TArray<FCellInfectionData> NearbyInfectedCells;
    ECameraMode ActiveCameraMode = ECameraMode::ThirdPerson;
};

UCLASS()
class UHUDSubsystem : public ULocalPlayerSubsystem {
    GENERATED_BODY()
public:
    // Lifecycle
    virtual void Initialize(FSubsystemCollectionBase& Collection) override;
    virtual void Deinitialize() override;
    void BindWorldSystems();   // called by GSM OnLevelReady
    void UnbindWorldSystems(); // called by GSM OnWorldTearDown

    // Mode
    EHUDMode GetHUDMode() const;
    void RequestModeChange(EHUDMode NewMode); // queued if bIsInCombat

    // Data access for initial widget population on Activate
    const FHUDDataCache& GetDataCache() const;

    // Context prompt management
    FContextPromptId RegisterContextPrompt(const FContextPrompt& Prompt);
    void ClearContextPrompt(FContextPromptId Id);

    // HUD sound (routed to Audio System)
    void PlayHUDSound(EHUDSound Sound);

    // Forwarded delegates (bound/unbound by widget Activate/Deactivate)
    UPROPERTY() FHUDHealthChangedSignature     OnHUDHealthChanged;
    UPROPERTY() FHUDAmmoChangedSignature       OnHUDAmmoChanged;
    UPROPERTY() FHUDCombatStateChangedSignature OnHUDCombatStateChanged;
    UPROPERTY() FHUDDetectionChangedSignature  OnHUDDetectionChanged;
    UPROPERTY() FHUDStaminaChangedSignature    OnHUDStaminaChanged;
    UPROPERTY() FHUDZoneCrossedSignature       OnHUDZoneCrossed;
    UPROPERTY() FHUDContextPromptSignature     OnHUDContextPrompt;
    UPROPERTY() FHUDThreatUpdateSignature      OnHUDThreatUpdate;
    UPROPERTY() FHUDCellStateChangedSignature  OnHUDCellStateChanged;
    UPROPERTY() FHUDCameraModeChangedSignature OnHUDCameraModeChanged;

private:
    UPROPERTY() TObjectPtr<UHUDWidget_Immersive> ImmersiveWidget;
    UPROPERTY() TObjectPtr<UHUDWidget_Tactical>  TacticalWidget;
    EHUDMode CurrentMode = EHUDMode::Immersive;
    TOptional<EHUDMode> PendingModeChange;
    FHUDDataCache DataCache;

    void ActivateWidget(UHUDWidgetBase* Widget);
    void DeactivateWidget(UHUDWidgetBase* Widget);
};

// Widget base — Activate/Deactivate interface
UCLASS(Abstract)
class UHUDWidgetBase : public UUserWidget {
    GENERATED_BODY()
public:
    virtual void BindDelegates(UHUDSubsystem* HUD);
    virtual void UnbindDelegates(UHUDSubsystem* HUD);
protected:
    UPROPERTY() TObjectPtr<UHUDSubsystem> CachedHUDSubsystem; // set in NativeConstruct, null-guarded
};
```

**Minimap canvas note**: The minimap widget uses `UUserWidget::OnPaint()` override with `FPaintContext` / `UWidgetBlueprintLibrary::DrawBox()` for the circular render pass — not `UCanvasPanel`. `UCanvasPanel` is for absolute-position layout, not custom drawing.

**Vignette tick note**: `UHUDWidget_Immersive` uses `NativeTick()` for exponential decay with `bCanEverTick = true`. When vignette intensity drops below 0.001f: `SetCanEverTick(false)`. On `OnHUDHealthChanged` with new damage: `SetCanEverTick(true)` to resume decay.

## Alternatives Considered

### Alternative B: AHUD Subclass Managing UMG Widgets

- **Description**: `AHostileWorldHUD : AHUD` creates and manages the two UMG widgets via `CreateWidget()` in `BeginPlay()`. UMG widgets still do the rendering; AHUD is a thin manager.
- **Pros**: Familiar UE pattern; AHUD has direct access to `APlayerController`.
- **Cons**: AHUD is an actor in the world — lifecycle tied to `UWorld`, not `ULocalPlayer`. It is destroyed and recreated on level transition, forcing widget reconstruction and full re-subscription to all 10 upstream delegates each load. ADR-0004 already assigned HUD to Player tier — using AHUD implicitly puts it in World tier, violating the ADR.
- **Rejection Reason**: ADR-0004 (Accepted) locks the tier. `ULocalPlayerSubsystem` survives level transitions and is the designated pattern.

### Alternative C: Single UUserWidget Tree with Conditional Visibility

- **Description**: One `UHUDWidget_Main` contains all elements for both modes. Mode-specific elements are toggled visible/collapsed per mode.
- **Pros**: Simpler class hierarchy; one `AddToViewport()` call.
- **Cons**: Immersive and Tactical have structurally different widget hierarchies. One tree forces deep conditional visibility chains that break on independent iteration. Cannot be developed by two parallel streams. Any mode-specific layout change risks regressions in the other mode.
- **Rejection Reason**: The GDD explicitly defines these as "two independent rendering pipelines." Separate classes enforce this separation and allow parallel development.

## Consequences

### Positive
- Dual widget architecture enforces the GDD's "two independent pipelines" philosophy at the code level
- `FHUDDataCache` + forwarding delegates isolate widget code from all upstream subsystems — widgets have zero direct subsystem dependencies
- Inactive widget is off-viewport AND delegate-unbound — zero render cost and zero CPU event cost
- Level transitions don't destroy or reconstruct widgets — `ULocalPlayerSubsystem` survives; `BindWorldSystems()` re-establishes world-scoped subscriptions
- Mode switching is O(1): one Deactivate + one Activate
- `UPROPERTY() TObjectPtr<>` on both widget references prevents GC collection while off-viewport

### Negative
- Every new HUD element must be implemented in both widget classes — no shared template reduces cost for mode-specific features
- `UHUDSubsystem` accumulates 10+ upstream delegate bindings in two groups — new subsystems require new bindings in the correct group
- `FHUDDataCache` must be kept in sync with source GDDs — if Health System adds a field, cache struct and forwarding delegate must both update
- `BindWorldSystems()` / `UnbindWorldSystems()` must be called at the correct GSM transition points — incorrect timing leaves either stale or missing subscriptions

### Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Widget `NativeConstruct()` fires before `UHUDSubsystem::Initialize()` in PIE | HIGH | Null-guard on all subsystem access in `NativeConstruct()`; `BindDelegates()` / `UnbindDelegates()` only execute if `CachedHUDSubsystem != nullptr`. Validate ordering in PIE test. |
| `BindWorldSystems()` called before world subsystems are ready | HIGH | Triggered by GSM `OnLevelReady` notification, which fires after world subsystems are initialized per ADR-0002 sequencing |
| Stale world-scoped subscriptions after level transition | HIGH | `UnbindWorldSystems()` called on GSM `OnWorldTearDown` before world objects are destroyed; `BindWorldSystems()` called on GSM `OnLevelReady` after new world subsystems initialize |
| Mode-switch viewport swap causes one-frame flicker | MEDIUM | Deactivate + Activate order is `UnbindDelegates → RemoveFromParent → AddToViewport → BindDelegates → PopulateFromCache`; execute within same frame. Profile in PIE VSync-off. |
| Inactive widget GC-collected while off-viewport | MEDIUM | Both widgets held via `UPROPERTY() TObjectPtr<>` on `UHUDSubsystem` — GC-safe as long as subsystem is alive |
| UMG/CommonUI improvements in UE 5.7 not captured | MEDIUM | Spawn `ue-umg-specialist` before implementation begins to verify widget hierarchy and binding patterns against UE 5.7 actual API |
| Vignette `NativeTick` CPU waste at zero intensity | LOW | `SetCanEverTick(false)` when V(t) < 0.001f; re-enable on `OnHUDHealthChanged` with new damage |

## GDD Requirements Addressed

| GDD System | Requirement | How This ADR Addresses It |
|------------|-------------|--------------------------|
| hud-system.md | Rule 1 — mode queued, applied after combat | `RequestModeChange()` checks `FHUDDataCache.bIsInCombat`; pending mode stored in `PendingModeChange`; flushed in `OnCombatStateChanged(bInCombat=false)` handler |
| hud-system.md | Rule 2 — common data layer, events routed to active renderer | `FHUDDataCache` holds latest state; `UHUDSubsystem` forwards all upstream events to active widget via its own multicast delegates |
| hud-system.md | Rule 3/4 — independent Immersive and Tactical rendering pipelines | `UHUDWidget_Immersive` and `UHUDWidget_Tactical` are separate classes; only one is on-viewport and delegate-bound at a time |
| hud-system.md | Rule 7 — HUD visibility per camera state | `UHUDSubsystem` receives `OnCameraModeChanged` from world-scoped group; forwards as `OnHUDCameraModeChanged`; active widget collapses on Scoped/Cinematic |
| hud-system.md | Rule 5/6 — context prompt priority + minimap | Context prompt priority logic lives in `UHUDSubsystem::RegisterContextPrompt()` (Formula 2); minimap rendered via `OnPaint()` at widget-defined update rates (0.5s threats, 10s infection) |
| hud-system.md | Performance — < 0.5ms/frame full Tactical HUD | Inactive widget is off-viewport AND unbound; active widget uses UMG InvalidationBox; minimap updates at 0.5s/10s rates |
| hud-system.md | Damage vignette Formula 1 | `UHUDWidget_Immersive::NativeTick()` implements exponential decay; `SetCanEverTick(false)` at threshold |
| hud-system.md | Check-mag transient element (Immersive, Rule 3) | `OnHUDAmmoChanged` triggers 2.0s transient element in `UHUDWidget_Immersive`; auto-hides via `FTimerHandle` |
| health-system.md | ADR-0015 `OnHealthChanged` event | `UHUDSubsystem` subscribes via session-stable group; forwards as `OnHUDHealthChanged` with cache updated |
| combat-system.md | ADR-0014 ammo/combat state events | `UHUDSubsystem` subscribes `UCombatComponent::OnAmmoChanged` and `UCombatSubsystem::OnCombatStateChanged` via session-stable group |
| scene-management.md | `OnZoneCrossed` event (ADR-0008) | `UHUDSubsystem` subscribes via world-scoped group; HUD already registered as consumer in `adr-rendering.yaml` |
| camera-system.md | `OnCameraModeChanged` event (ADR-0009) | `UHUDSubsystem` subscribes via world-scoped group; HUD already registered as consumer in `adr-rendering.yaml` |
| input-system.md | Rebinding UI widget owner (C4 resolution 2026-05-26) | `UHUDSubsystem` owns `UWidget_KeyBindingsMenu` (Settings menu). Widget is a thin consumer: captures `FKey` from player, calls `AHostileWorldPlayerController::ApplyKeyRebind()` + `SaveRebindings()` (ADR-0003 BlueprintCallable API). Widget never touches `UEnhancedInputUserSettings` directly. |

## Performance Implications
- **CPU**: `UHUDSubsystem` event handler + delegate fan-out: ~0.01ms per event (synchronous, same stack frame). Inactive widget adds zero CPU — fully unbound. Context prompt priority recalculation triggered by `OnContextPrompt` only, not per-tick.
- **Memory**: Two `UUserWidget` instances always in memory. `FHUDDataCache`: ~200 bytes. Widget memory cost is fixed; no construction/destruction on mode switch or level transition.
- **Render**: Active widget target: < 0.5ms/frame (GDD). Minimap: < 0.2ms per 0.5s update. Inactive widget: 0ms (off-viewport + unbound).
- **Load Time**: Both widgets constructed once at `UHUDSubsystem::Initialize()` — one-time cost at session start, not level load.

## Migration Plan
No existing HUD code. Greenfield implementation order:
1. `UHUDSubsystem` skeleton: `FHUDDataCache`, all delegate declarations, `Initialize()`/`Deinitialize()`, `BindWorldSystems()`/`UnbindWorldSystems()`, session-stable subscription handlers
2. `UHUDWidgetBase` with `BindDelegates()`/`UnbindDelegates()` contract
3. `UHUDWidget_Immersive` — context prompts and quick slots (MVP-critical), then damage vignette
4. `UHUDWidget_Tactical` — health bar + ammo counter first, then detection/stamina, then minimap last (highest complexity)
5. GSM integration: register `UHUDSubsystem` for `OnLevelReady`/`OnWorldTearDown` notifications

## Validation Criteria
- `UHUDSubsystem::Initialize()` fires before any `UHUDWidget_*::NativeConstruct()` — verified in PIE log
- `BindWorldSystems()` round-trip: subscribe → level transition → unsubscribe → new level → resubscribe — verified via PIE travel with logging; all 4 world-scoped events received after reload
- Mode switch at 60fps: zero flicker verified in PIE VSync-off
- `stat slate` in PIE with full Tactical HUD active: total Slate tick budget < 0.5ms
- Inactive widget CPU: `stat slate` shows inactive widget contributes 0 Slate tick cost after `RemoveFromParent()` + delegate unbind
- All `AddDynamic` calls have matching `RemoveDynamic` in `UnbindDelegates()` / `UnbindWorldSystems()` / `Deinitialize()` — verified by code review before merge
- `FHUDDataCache` fields verified against ADR-0015 (health), ADR-0014 (combat), and hud-system.md event table before implementation sprint begins

## Related Decisions
- ADR-0001 — Cross-System Communication (delegate pattern for all HUD event routing)
- ADR-0004 — Subsystem & Module Architecture (ULocalPlayerSubsystem tier assignment; system-to-tier table)
- ADR-0009 — Camera Architecture (camera_mode_changed_event consumer; HUD visibility per camera mode)
- ADR-0008 — Scene Streaming Architecture (zone_crossed_event consumer)
- ADR-0014 — Combat System Architecture (ammo/combat state events)
- ADR-0015 — Health System Architecture (health/injury events)
