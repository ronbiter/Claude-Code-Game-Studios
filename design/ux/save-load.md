# UX Specification: Save / Load Flow

> **Status**: Draft
> **Author**: ux-lead
> **Last Updated**: 2026-05-26
> **Screen / Flow Name**: `SaveLoadFlow` (composite — encompasses the Save Slot Card overlay and the New Game Wipe Confirmation dialog; this flow is invoked from Main Menu and Pause Menu, not a standalone screen)
> **Platform Target**: PC (Steam / Epic)
> **Related GDDs**: `design/gdd/save-load-system.md` (full document — this flow is the UX layer for that system), `design/gdd/game-state-machine.md § Loading State / § Title State`
> **Related ADRs**: `ADR-0002: Game State Machine`, `ADR-0006: Save/Load Serialization`
> **Related UX Specs**: `design/ux/main-menu.md`, `design/ux/pause-menu.md`, `design/ux/settings.md` (planned)
> **Accessibility Tier**: Standard (WCAG 2.1 AA + screen reader support + colorblind-safe + focus management)

> **Note — Scope boundary**: Hostile World has NO save/load menu per GDD scope. There is a single auto-save slot, no manual save command, and no in-game load option. This spec covers the lightweight UX surfaces that DO exist around the save system:
>
> 1. **Save Slot Card** — a brief contextual card shown when the player initiates Continue from the Main Menu, confirming what they are about to load. It is NOT a slot picker (there is only one slot); it is a confirmation read-out.
> 2. **New Game Wipe Confirmation** — the modal dialog spawned from the Main Menu when the player selects New Game while an existing save is present. This is the only user-initiated path that destroys save data.
> 3. **Save Indicator** — the 2.0s corner icon shown during in-game auto-saves (owned operationally by Save/Load System, but the visual contract is specified here for consistency with the rest of the flow).
> 4. **System Notifications** — the corruption-fallback and storage-full HUD notifications, specified here so they are not duplicated across other specs.
>
> This document does NOT define a "Save/Load Screen" because no such screen exists in the design. If post-MVP scope adds multi-slot saves, this document expands; until then, it specifies the UX glue around the single-slot auto-save model.

---

## 1. Purpose & Player Need

**What player need does this screen serve?**

Hostile World's save system is intentionally invisible — the game saves itself, the player never asks. But invisibility has a cost: players coming back to a long-running save may feel uncertain about what state they are returning to. The Save Slot Card answers a single question — "what am I about to load?" — with one glance: where you were, how long you have played, and a thumbnail of the scene at last save. The player should feel re-anchored in their run before the Loading state begins. This is the moment between deciding to play and being in the game.

The New Game Wipe Confirmation serves a different need: protect the player from accidentally erasing a long run. The auto-save model means a single misclick on New Game would, without confirmation, silently delete tens of hours of progress. The confirmation dialog is the safety rail.

The Save Indicator and System Notifications serve a third need: communicate that the world remembered. The player should know — quickly, non-intrusively — when an auto-save has been written, and should be informed clearly (without panic) when something has gone wrong (corruption, storage full).

**The player goal**:
- On Continue: confirm what they are returning to in <2 seconds, then proceed
- On New Game over existing save: be stopped, informed, and forced to make an explicit choice
- During gameplay: see a brief, calm acknowledgment that progress was saved
- On rare error: understand what went wrong and what the game did about it

**The game goal**:
- Display the save slot metadata accurately and accessibly before the Loading state begins
- Gate the destructive WipeSave operation behind explicit confirmation
- Surface save-system events (write start, write fail, corruption recovery) through the HUD without disrupting gameplay flow

---

## 2. Player Context on Arrival

The Save/Load flow has three distinct arrival contexts. Each must be documented separately because the player's emotional state differs sharply across them.

### Context A — Save Slot Card from Main Menu Continue

| Question | Answer |
|----------|--------|
| What was the player just doing? | Selecting Continue from Main Menu |
| What is their emotional state? | Anticipatory, ready to play |
| What cognitive load are they carrying? | Low — just booted, fresh attention |
| What information do they already have? | The Continue button subline ("Last save — [Zone] · [Playtime]") — they have already seen a preview |
| What are they most likely trying to do? | Verify they are loading the right save (only one exists, so this is more about re-anchoring than choosing) and proceed |
| What are they likely afraid of? | Loading a stale save and losing recent progress — but with single-slot auto-save, that is impossible. The card actually reassures them. |

**Emotional design target**: Confident re-entry. The card is a 1.5-second cinematic pause between intent and action — long enough to register, not long enough to be a gate.

### Context B — New Game Wipe Confirmation Dialog

| Question | Answer |
|----------|--------|
| What was the player just doing? | Selected New Game from Main Menu while an existing save was present |
| What is their emotional state? | Either deliberately starting fresh (low anxiety) or accidentally about to delete their run (high anxiety once they read the dialog) |
| What cognitive load are they carrying? | Just elevated — the dialog has forced them to read |
| What information do they already have? | The dialog body text — they must read it before acting |
| What are they most likely trying to do? | Two distinct populations: those who meant New Game (probably ~30%) and those who misclicked (probably ~70%, given Continue is right above) |
| What are they likely afraid of? | Permanently losing their run — and rightly so, the action is destructive |

**Emotional design target**: Alarmed but informed. The player should feel the weight of the action without being lectured.

### Context C — Save Indicator During Gameplay

| Question | Answer |
|----------|--------|
| What was the player just doing? | Active gameplay — crossed a zone boundary or completed a key investigation event |
| What is their emotional state? | Mid-gameplay; could be anything from calm exploration to high tension |
| What cognitive load are they carrying? | Variable — could be high (mid-combat-prep, mid-stealth) |
| What information do they already have? | None directly — the save just happened in the background |
| What are they most likely trying to do? | Keep doing what they were doing — the save is incidental |
| What are they likely afraid of? | Nothing immediately related to the save — but the indicator silently reassures that progress is safe |

**Emotional design target**: Peripheral reassurance. The save indicator should be felt, not noticed. It must NEVER pull the player's attention away from the action.

### Context D — Error Notification (Corruption / Storage Full)

| Question | Answer |
|----------|--------|
| What was the player just doing? | Variable — corruption shows at boot (Loading state); storage full shows during gameplay or on Save & Quit |
| What is their emotional state? | Will become anxious immediately upon seeing the message |
| What cognitive load are they carrying? | Variable |
| What information do they already have? | None |
| What are they most likely trying to do? | Understand what happened and what to do |
| What are they likely afraid of? | That they have lost their progress (corruption) or will lose it (storage full) |

**Emotional design target**: Calm, factual, actionable. No technical jargon. No alarming visual treatment.

---

## 3. Navigation Position

**Screen hierarchy** (this flow has no standalone screen; it is composed of overlays anchored to parent screens):

```
[Main Menu] (parent)
  ├── Save Slot Card (overlay shown on Continue selection, 1.5s display before Loading)
  └── New Game Wipe Confirmation Dialog (modal overlay shown when New Game selected with save present)

[Pause Menu] (parent)
  └── (no save/load UI surfaces here — pause menu Save & Quit confirmation lives in pause-menu.md)

[Any in-game state] (parent — HUD owns this)
  ├── Save Indicator (corner icon, 2.0s, owned by Save/Load System per GDD Rule 7)
  ├── Corruption Notification (HUD notification, 5s)
  └── Storage Full Notification (HUD notification, 5s)
```

**Modal behavior**:
- Save Slot Card: non-modal but auto-dismissing — appears for ~1.5s, then transitions to Loading automatically. Player CAN press a key to skip immediately to Loading (covered in Section 7).
- New Game Wipe Confirmation Dialog: Modal — blocks Main Menu beneath until Confirm or Cancel. Standard modal pattern (matches main-menu and pause-menu confirmation dialogs).
- Save Indicator: Non-modal, non-interactive. Just a visual element.
- Notifications: Non-modal, non-interactive. Auto-dismissing.

**Reachability — all entry points**:

| Surface | Entry Point | Triggered By |
|---------|------------|--------------|
| Save Slot Card | Player selects Continue from Main Menu | Main Menu fires `ContinueRequested` → flow shows card → flow then triggers GSM Title → Loading |
| New Game Wipe Confirmation Dialog | Player selects New Game from Main Menu AND `HasExistingSave() == true` | Main Menu detects save presence and routes to confirmation instead of direct New Game |
| Save Indicator | Save/Load System fires `OnSaveStart` (per GDD Rule 7) | Triggered by checkpoint zone entry, key investigation event completion, or clean exit save |
| Corruption Notification | Save/Load System fires `OnLoadCorruption` (per GDD Rule 6) | Triggered when `LoadGameFromSlot()` returns null or deserialization fails during GSM Loading state |
| Storage Full Notification | Save/Load System fires `OnSaveFailed(reason=StorageFull)` (per GDD EC6) | Triggered when `SaveGameToSlot()` returns failure due to platform storage quota |

---

## 4. Entry & Exit Points

### Save Slot Card

**Entry table**:

| Trigger | Source Screen / State | Transition Type | Data Passed In | Notes |
|---------|----------------------|-----------------|----------------|-------|
| Player selects Continue on Main Menu | Main Menu | Card fades in over Main Menu (Main Menu fades to 40% beneath) | Save metadata: `{zone_name, playtime_seconds, save_timestamp, thumbnail_texture}` | If metadata is missing or stale, card falls back to a degraded view (see Section 6) |

**Exit table**:

| Exit Action | Destination | Transition Type | Data Returned / Saved | Notes |
|-------------|------------|-----------------|----------------------|-------|
| 1.5s auto-dismiss timer elapses | Loading State | Card fades out; GSM Title → Loading (deep inhale 1.5s) begins as card fades | None — load is already requested | Default exit |
| Player presses Enter / A / Space / Esc / B / Left click | Loading State | Skip remaining card display; immediately begin GSM Title → Loading | None | Skip exit — for players who don't need the re-anchor moment |

### New Game Wipe Confirmation Dialog

**Entry table**:

| Trigger | Source Screen / State | Transition Type | Data Passed In | Notes |
|---------|----------------------|-----------------|----------------|-------|
| Player selects New Game on Main Menu AND `HasExistingSave() == true` | Main Menu | Dialog scales 95→100% over 150ms; Main Menu dims 0→60% | Save metadata for context display in dialog body: `{zone_name, playtime_seconds}` | Dialog body INCLUDES the player's current save context to make the consequence concrete |

**Exit table**:

| Exit Action | Destination | Transition Type | Data Returned / Saved | Notes |
|-------------|------------|-----------------|----------------------|-------|
| Player confirms (Delete and Start New Game) | Loading State (new game) | Save is wiped; dialog dismisses 100ms; Main Menu fades; GSM Title → Loading | Fires `WipeSaveRequested` then `NewGameRequested` | Save deletion is synchronous and blocking — must complete before Loading begins |
| Player cancels | Main Menu (no state change) | Dialog scales 100→95% over 100ms; Main Menu dim removes | None | Focus restored to New Game item in Main Menu |
| Player presses Esc / B (gamepad) | Same as cancel | Same | None | Esc/B is the canonical cancel input |

### Save Indicator

**Entry**:
- Triggered by `OnSaveStart` delegate from Save/Load System
- Appears in bottom-right corner of HUD (per save-load GDD Visual section)
- Fades in over 200ms

**Exit**:
- Auto-dismiss when `OnSaveComplete` fires OR after `SaveIndicatorDuration` (2.0s default per GDD Knob), whichever comes FIRST
- Fade out over 300ms (per save-load GDD Visual section)

### Corruption Notification

**Entry**:
- Triggered by `OnLoadCorruption` from Save/Load System during GSM Loading state
- Appears as standard HUD notification (top-center)
- Per save-load GDD: "Save data could not be loaded. Starting new game."
- 5s duration per GDD

**Exit**:
- Auto-dismiss after 5s
- Player CAN dismiss early with any input

### Storage Full Notification

**Entry**:
- Triggered by `OnSaveFailed(reason=StorageFull)`
- Appears as standard HUD notification
- Per save-load GDD: "Could not save — storage full."
- 5s duration

**Exit**:
- Auto-dismiss after 5s
- Player CAN dismiss early with any input

---

## 5. Layout Specification

### 5.1 Wireframes

**Save Slot Card** (overlays Main Menu on Continue):

```
┌──────────────────────────────────────────────────────────────────────┐
│  {Main Menu dimmed beneath to 40%, mostly visible}                   │
│                                                                      │
│                                                                      │
│       ┌─────────────────────────────────────────────────┐            │
│       │                                                 │            │
│       │   ┌─────────────────────┐  CONTINUE             │            │
│       │   │                     │                       │            │
│       │   │  {save thumbnail}   │  Foothill Camp        │  ← Zone    │
│       │   │   ~16:9 ratio       │  4 hours 22 minutes   │  ← Playtime│
│       │   │                     │  May 26, 2026 19:42   │  ← Timestamp
│       │   │                     │                       │            │
│       │   └─────────────────────┘                       │            │
│       │                                                 │            │
│       │              [Press any key to skip · 1.5s]     │            │
│       └─────────────────────────────────────────────────┘            │
│                                                                      │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

**New Game Wipe Confirmation Dialog** (overlays Main Menu):

```
┌──────────────────────────────────────────────────────────────────────┐
│  {Main Menu dimmed beneath to 60%}                                   │
│                                                                      │
│       ┌──────────────────────────────────────────────────┐           │
│       │                                                  │           │
│       │   ⚠  START NEW GAME                              │           │
│       │                                                  │           │
│       │   Your existing save will be permanently         │           │
│       │   deleted. This cannot be undone.                │           │
│       │                                                  │           │
│       │   Current save:                                  │           │
│       │   Foothill Camp · 4 hours 22 minutes             │           │
│       │                                                  │           │
│       │   ┌──────────────────────┐  ┌──────────────────┐ │           │
│       │   │ Delete and Start New │  │ ● Cancel         │ │           │
│       │   │     Game             │  │                  │ │           │
│       │   └──────────────────────┘  └──────────────────┘ │           │
│       │                                                  │           │
│       └──────────────────────────────────────────────────┘           │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘

Note: ● indicates default focus = Cancel (the safe action)
The destructive button has a warning icon (⚠) and is styled in the project's destructive color
```

**Save Indicator** (corner of HUD during gameplay):

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│   {game world — HUD elements active}                                 │
│                                                                      │
│                                                                      │
│                                                                      │
│                                                                      │
│                                                                      │
│                                                                      │
│                                                                      │
│                                            {health}   {infection}    │  ← Bottom-right HUD zone
│                                                              [💾]    │  ← Save indicator
└──────────────────────────────────────────────────────────────────────┘

Placement: Bottom-right corner, positioned so it does NOT overlap health or infection meters
(per save-load GDD Visual: "Must not overlap health or infection HUD elements")
```

**Corruption / Storage Full Notification** (top-center HUD notification):

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│       ┌────────────────────────────────────────────────┐             │
│       │ ⚠ Save data could not be loaded. Starting new  │             │
│       │   game.                                        │             │
│       └────────────────────────────────────────────────┘             │
│                                                                      │
│   {rest of game / loading screen continues}                          │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### 5.2 Zone Definitions

**Save Slot Card surfaces**:

| Zone Name | Description | Approximate Size | Scrollable? | Overflow Behavior |
|-----------|-------------|-----------------|-------------|-------------------|
| Card Container | Centered card overlay | ~50% width, ~40% height | No | Fixed size; content within wraps as needed |
| Thumbnail Zone | Left side: save screenshot thumbnail | ~40% of card width, 16:9 aspect | No | If thumbnail missing, show placeholder icon |
| Metadata Zone | Right side: zone name, playtime, timestamp, CONTINUE label | ~55% of card width | No | Zone name truncates with ellipsis; playtime and timestamp are short |
| Skip Hint Zone | Bottom of card: skip instruction | Full card width, ~10% of card height | No | Auto-disappears after 1.5s timer (the card itself is dismissing) |

**New Game Wipe Confirmation surfaces**:

| Zone Name | Description | Approximate Size | Scrollable? | Overflow Behavior |
|-----------|-------------|-----------------|-------------|-------------------|
| Dialog Container | Centered modal | ~45% width, ~35% height (auto-grows for localization) | No | Dialog grows vertically if localized text wraps |
| Warning Icon + Title | Top of dialog: ⚠ icon + "START NEW GAME" heading | Full dialog width, ~15% dialog height | No | Title truncates only if extreme |
| Body Text Zone | Consequence statement + current save context | Full dialog width, ~50% dialog height | No | Wraps to multiple lines |
| Button Row Zone | Bottom of dialog: destructive button + cancel button | Full dialog width, ~25% dialog height | No | Buttons stack vertically below 480px width |

**Save Indicator zone** (within HUD):

| Zone Name | Description | Approximate Size | Scrollable? | Overflow Behavior |
|-----------|-------------|-----------------|-------------|-------------------|
| Indicator Slot | Bottom-right corner, above health/infection HUD elements | ~48×48px | No | Fixed size; positioned by HUD layout system to avoid overlap |

**Notification zones** (within HUD): Standard HUD notification component — owned by HUD system, no zone redefinition needed here.

### 5.3 Component Inventory

| Component Name | Type | Surface | Purpose | Required? | Reuses Existing Component? |
|----------------|------|---------|---------|-----------|---------------------------|
| SaveSlotCard | Composite (panel + thumbnail + metadata) | Save Slot Card | The card itself | Yes | No — new component (single-purpose, only used in this flow) |
| SaveThumbnail | Image (16:9) | Save Slot Card | Display screenshot of save moment | Yes | No — new component |
| ZoneNameLabel | Text (large, primary) | Save Slot Card | Show last save zone name | Yes | Yes — reuses standard label component |
| PlaytimeLabel | Text (medium, secondary) | Save Slot Card | Show total playtime as "Xh Ym" | Yes | Yes — standard label |
| TimestampLabel | Text (small, tertiary) | Save Slot Card | Show last save date/time | Yes | Yes — standard label |
| SkipHintLabel | Text (small) + glyph | Save Slot Card | Tell player they can skip the card | Yes | Yes — InputHint component |
| ConfirmDialog | Modal dialog | New Game Wipe Confirmation | Reuse of the project-wide confirmation pattern | Yes | Yes — same as main-menu New Game confirm and pause-menu Save & Quit confirm |
| DestructiveButton | Button (destructive style) | New Game Wipe Confirmation | "Delete and Start New Game" button with warning styling | Yes | Yes — shared DestructiveButton variant of standard button |
| WarningIcon | Icon (⚠) | New Game Wipe Confirmation, Notifications | Visual destructive/error indicator | Yes | Yes — shared icon |
| SaveIndicatorIcon | Icon (small floppy / cassette / project-themed glyph) | Save Indicator | The save-in-progress visual | Yes | No — bespoke save indicator component |
| HUDNotification | Composite (icon + text panel) | Corruption / Storage Full | Standard HUD notification | Yes | Yes — shared with HUD notifications (e.g., "Inventory full") |

**Primary focus element on open**:

- Save Slot Card: No focus needed (auto-dismissing; any input skips). Card receives keyboard focus only for screen-reader announcement purposes.
- New Game Wipe Confirmation: **Cancel** (the safe action — default focus). This is the inverse of pause menu confirmations because this action IS destructive.
- Save Indicator: Not focusable.
- Notifications: Not focusable.

---

## 6. States & Variants

### Save Slot Card

| State Name | Trigger | What Changes Visually | What Changes Behaviorally | Notes |
|------------|---------|----------------------|--------------------------|-------|
| Loading metadata | Card mounts; save metadata being fetched | Card frame visible; thumbnail shows shimmer; text fields show shimmer placeholders | Skip input is active (player can skip even before data loads) | Should complete within 200ms — shimmer rarely perceptible |
| Populated | Metadata loaded | Thumbnail, zone, playtime, timestamp all visible | 1.5s auto-dismiss timer begins | Default state |
| Degraded — missing thumbnail | Thumbnail texture failed to load | Thumbnail slot shows placeholder icon (camera/picture icon); other metadata visible | Timer continues normally | Save still loadable — thumbnail is informational only |
| Degraded — missing metadata | Save metadata read failed but save file exists | Thumbnail and zone show "Last save — unknown"; playtime and timestamp omitted | Timer continues normally | Save still loadable — load itself doesn't depend on metadata |
| Dismissing | 1.5s timer elapsed OR player input | Card fades out 200ms; Loading state takes over | All input disabled during fade | GSM transition begins simultaneously |

### New Game Wipe Confirmation Dialog

| State Name | Trigger | What Changes Visually | What Changes Behaviorally | Notes |
|------------|---------|----------------------|--------------------------|-------|
| Opening | Dialog mount | Dialog scales 95→100%; Main Menu dims 0→60% | No input until 150ms transition complete | Brief visual setup |
| Open (default) | Opening complete | Stable display; Cancel is focused | Both buttons active; Esc/B dismisses; Enter confirms whichever is focused | Most common state |
| Confirm-pending | Player activated Delete and Start New Game | Brief 100ms scale-down on the button | All input disabled during wipe operation | Wipe is synchronous; should be <100ms |
| Wipe failed | Save deletion IO failed | Dialog stays open; brief error message replaces body text: "Could not delete save. Try again." | Cancel re-enabled; Delete button re-enabled for retry | Very rare; treat like storage-full pattern |
| Closing (cancelled) | Esc / B / Cancel pressed | Dialog scales 100→95%; Main Menu dim removes | All input restored to Main Menu | Standard cancel |
| Closing (confirmed) | Wipe complete | Dialog dismisses 100ms; Main Menu fades; Loading begins | All input disabled during transition to Loading | Standard confirm |

### Save Indicator

| State Name | Trigger | What Changes Visually | What Changes Behaviorally | Notes |
|------------|---------|----------------------|--------------------------|-------|
| Hidden | Default | Not visible | N/A | Default state |
| Showing | `OnSaveStart` fired | Icon fades in over 200ms in bottom-right corner | Non-interactive | Per save-load GDD Rule 7 |
| Dismissing | `OnSaveComplete` fired OR 2.0s timer elapsed | Icon fades out over 300ms | Non-interactive | Whichever event fires first |

### Notifications

| State Name | Trigger | What Changes Visually | What Changes Behaviorally | Notes |
|------------|---------|----------------------|--------------------------|-------|
| Corruption — showing | `OnLoadCorruption` fired during Loading | HUD notification appears top-center: warning icon + "Save data could not be loaded. Starting new game." | Non-interactive | 5s duration per save-load GDD |
| Storage Full — showing | `OnSaveFailed(StorageFull)` fired | HUD notification appears: warning icon + "Could not save — storage full." | Non-interactive | 5s duration per save-load GDD |
| Dismissing | 5s timer elapsed OR player input | Fade out 200ms | N/A | Standard HUD notification dismiss |

---

## 7. Interaction Map

### 7.1 Navigation Inputs

**Save Slot Card** (no focusable elements within the card — card is a read-out):

| Input | Platform | Action | Visual Response | Audio Cue | Notes |
|-------|----------|--------|-----------------|-----------|-------|
| Any key / button / mouse click | All | Skip auto-dismiss timer; proceed immediately to Loading | Card fades out 200ms (same as auto-dismiss) | Card dismiss tone | Single-input skip — match the "ready to play" emotion |

**New Game Wipe Confirmation Dialog**:

| Input | Platform | Action | Visual Response | Audio Cue | Notes |
|-------|----------|--------|-----------------|-----------|-------|
| Left Arrow / D-Pad Left / Left Stick Left | All | Move focus to previous button | Focus indicator slides | Soft navigation tick | Wraps |
| Right Arrow / D-Pad Right / Left Stick Right | All | Move focus to next button | Same | Same | Wraps |
| Tab | KB | Move focus to next button (equivalent to Right) | Same | Same | Wraps |
| Shift+Tab | KB | Move focus to previous button | Same | Same | Wraps |
| Mouse hover over button | PC | Hover preview only (brightens) | Button brightens 20% | None | Hover does not move focus |
| Mouse click on button | PC | Move focus + activate | Press flash + activation | Soft click + activation tone | One-step |

### 7.2 Action Inputs

**Save Slot Card**:

| Input | Platform | Context (What must be focused) | Action | Response | Animation | Audio Cue | Notes |
|-------|----------|-------------------------------|--------|----------|-----------|-----------|-------|
| Any input | All | Card showing | Skip to Loading | Card fade-out 200ms; GSM Title → Loading begins | Fade, 200ms | Card dismiss tone | Skip is intentional — same exit as auto-dismiss |

**New Game Wipe Confirmation Dialog**:

| Input | Platform | Context (What must be focused) | Action | Response | Animation | Audio Cue | Notes |
|-------|----------|-------------------------------|--------|----------|-----------|-----------|-------|
| Enter / A button / Left click | All | "Delete and Start New Game" focused | Wipe save + begin New Game | Brief button press; save deletion IO; dialog dismisses; Main Menu fades; Loading begins | Press 60ms; IO; dismiss 100ms; fade 300ms | Destructive confirm tone | Fires `WipeSaveRequested` then `NewGameRequested` |
| Enter / A button / Left click | All | "Cancel" focused | Dismiss dialog | Scale-down 100ms; dim removes | Scale-down, 100ms | Cancel tone | Focus restored to New Game in Main Menu |
| Esc / B button | All | Dialog open | Cancel (same as Cancel button) | Same | Same | Cancel tone | Canonical cancel input |
| Mouse click outside dialog | PC | Dialog open | NO ACTION (do not auto-dismiss on outside click) | None | None | None | Destructive dialogs should NEVER auto-dismiss on click-outside — too easy to accidentally confirm via misclick that lands on a button. Player must explicitly Cancel or Confirm. |

**Save Indicator**: No input. Non-interactive.

**Notifications**: Any key dismisses early; otherwise auto-dismiss at 5s.

### 7.3 State-Specific Behaviors

| State | Input Restriction | Reason |
|-------|------------------|--------|
| Save Slot Card: Dismissing | All input ignored | Transition in flight |
| Confirmation Dialog: Opening | All input ignored during 150ms transition | Modal transition must complete |
| Confirmation Dialog: Confirm-pending | All input disabled | Wipe IO is in flight |
| Confirmation Dialog: Wipe failed | Re-enabled but only Cancel and retry Delete | Failed destructive action — allow retry or back-out |
| Save Indicator | Non-interactive | Not focusable |
| Notifications | Any input dismisses; otherwise no effect | Lightweight transient UI |

---

## 8. Data Requirements

| Data Element | Source System | Update Frequency | Who Owns It | Format | Null / Missing Handling |
|--------------|--------------|-----------------|-------------|--------|------------------------|
| `HasExistingSave()` | Save/Load System | On Main Menu open; after WipeSave | Save/Load System | bool | Never null — false treats unreadable save as no save |
| Save metadata: zone_name | Save/Load System | On Continue selection; on New Game (if save exists) | Save/Load System | string (localized display name) | If missing, show "Last save — unknown" (card) or "Unknown zone" (dialog) |
| Save metadata: playtime_seconds | Save/Load System | Same | Save/Load System | int seconds | If missing, omit playtime line |
| Save metadata: save_timestamp | Save/Load System | Same | Save/Load System | datetime ISO 8601 | If missing, omit timestamp line |
| Save metadata: thumbnail_texture | Save/Load System | Same | Save/Load System | Texture reference (16:9 screenshot, captured at save time) | If missing, show placeholder camera icon in thumbnail slot |
| `OnSaveStart` event | Save/Load System | On checkpoint save begin | Save/Load System | Delegate fire | Subscriber-only — no payload needed |
| `OnSaveComplete` event | Save/Load System | On save write complete | Save/Load System | Delegate fire | Subscriber-only |
| `OnSaveFailed` event | Save/Load System | On save failure | Save/Load System | Delegate fire with `{reason: enum}` | Reason: StorageFull, IOFailure, Unknown — UI shows appropriate notification |
| `OnLoadCorruption` event | Save/Load System | During Loading state, on corruption detection | Save/Load System | Delegate fire | Subscriber-only |

**Save metadata acquisition contract**:

The Save/Load System must expose a `GetSaveMetadata()` function that returns `{zone_name, playtime_seconds, save_timestamp, thumbnail_texture}` WITHOUT loading the full save file. This is critical: the Main Menu Continue subline and the Save Slot Card both display metadata before any load occurs. Metadata must be stored in a small "header" section of the save file (or a sidecar metadata file) that can be read in <100ms.

**Thumbnail capture contract**:

When the Save/Load System writes a save, it must capture a 16:9 screenshot of the current scene (or use the most recent rendered frame). Resolution: 384×216 (small, low-cost). Stored as a compressed texture in the save metadata header.

> **Rule**: This flow's UI surfaces NEVER write directly to the Save/Load System except through the documented events (`WipeSaveRequested`). Reading metadata is one-way; the UI does not modify it.

---

## 9. Events Fired

| Player Action | Event Fired | Payload | Receiver System | Notes |
|---------------|-------------|---------|-----------------|-------|
| Save Slot Card auto-dismisses or is skipped | (no event — flow already proceeded to Loading; this is internal flow state) | N/A | N/A | The card is a passive display; the GSM transition fires from the originating Continue selection in Main Menu |
| Save Slot Card opens | `SaveSlotCardShown` | `{has_metadata: bool, has_thumbnail: bool}` | Analytics System | Analytics-only |
| Save Slot Card dismissed by player skip (vs auto-timer) | `SaveSlotCardSkipped` | `{remaining_ms: int}` | Analytics System | Analytics — measures whether players value the 1.5s card or skip past it |
| Wipe confirmation opens | `WipeConfirmationShown` | `{}` | Analytics System | Analytics-only |
| Wipe confirmation: confirmed | `WipeSaveRequested` then `NewGameRequested` | `{}`, `{}` | Save/Load System (wipe), then Game State Machine (new game) | Sequential — wipe must complete before new game request |
| Wipe confirmation: cancelled | `WipeConfirmationCancelled` | `{}` | Analytics System | Analytics — measures misclick rate on New Game |
| Save Indicator: appears | (no event — UI reacts to OnSaveStart from Save/Load System) | N/A | N/A | One-way subscription |
| Save Indicator: disappears | (no event) | N/A | N/A | One-way |
| Corruption notification: dismissed by player | `CorruptionNotificationDismissed` | `{dismissed_early: bool}` | Analytics System | Analytics-only |
| Storage Full notification: dismissed by player | `StorageFullNotificationDismissed` | `{dismissed_early: bool}` | Analytics System | Analytics-only |

---

## 10. Transition & Animation

| Transition | Trigger | Direction / Type | Duration (ms) | Easing | Interruptible? | Skipped by Reduced Motion? |
|------------|---------|-----------------|--------------|--------|----------------|---------------------------|
| Save Slot Card enter | Continue selected | Card fades in 0→100%; Main Menu dims to 40% | 250 | Ease-out cubic | No | Yes — instant appear |
| Save Slot Card auto-dismiss | 1.5s display timer elapsed | Card fades out 100→0%; GSM Title → Loading transition begins simultaneously | 200 | Ease-in cubic | No | Yes — instant disappear (still 1.5s display duration to give reduced-motion users time to read) |
| Save Slot Card skip dismiss | Any input | Same as auto-dismiss | 200 | Ease-in cubic | No | Yes — instant |
| Save Slot Card thumbnail shimmer | Loading metadata state | Shimmer pass animates across thumbnail and text fields | Looping until data loads | Linear | Yes | Yes — replace shimmer with static "loading" text |
| Wipe Confirmation Dialog open | New Game selected with save | Background dims 0→60%; dialog scales 95→100% | 150 | Ease-out cubic | No | Yes — instant appear, no scale |
| Wipe Confirmation Dialog cancel | Cancel / Esc / B | Dialog scales 100→95%; dim removes | 100 | Ease-in cubic | No | Yes — instant |
| Wipe Confirmation Dialog confirm | Confirm pressed | Brief button scale-press 60ms; wipe IO (typically <100ms); dialog dismiss 100ms; Main Menu fade 300ms | ~560 total + IO | Ease-out | No | Yes — instant transitions |
| Save Indicator fade-in | OnSaveStart fired | Icon opacity 0→100% | 200 | Ease-out | No | Yes — instant appear |
| Save Indicator fade-out | OnSaveComplete or 2.0s timer | Icon opacity 100→0% | 300 | Ease-in | No | Yes — instant disappear |
| Notification slide-in (corruption / storage full) | Event fired | HUD notification slides down from top-center, 80% opacity → 100% | 200 | Ease-out cubic | No | Yes — instant appear |
| Notification fade-out | 5s timer or player input | Notification fades 100→0% | 200 | Ease-in | No | Yes — instant |

---

## 11. Input Method Completeness Checklist

**Keyboard**
- [x] Save Slot Card skippable by any key
- [x] Wipe Confirmation Dialog: both buttons reachable by Tab and arrow keys
- [x] Tab order follows visual reading order in dialog
- [x] Every action achievable by mouse is also achievable by keyboard
- [x] Focus is visible at all times in the dialog
- [x] Focus does not escape the dialog while open
- [x] Esc dismisses the dialog (does not quit game)

**Gamepad**
- [x] Wipe Confirmation buttons reachable by D-Pad
- [x] Face button mapping: A confirms focused button, B cancels dialog
- [x] No analog stick precision required
- [x] Trigger/bumper not used on these surfaces
- [x] Controller disconnect during dialog: dialog remains open; keyboard takes over; reconnect resumes gamepad

**Mouse**
- [x] Wipe Confirmation buttons have hover states (brighten 20%)
- [x] Click hit targets minimum 32×32px (actually ~48px tall, ~200px wide)
- [x] Right-click on dialog or card: no-op
- [x] No scrollable zones on these surfaces
- [x] Clicking outside the dialog: NO ACTION (intentional — destructive dialog should not dismiss on outside click)

**Touch (if applicable)**
- N/A — PC only

---

## 12. Screen-Level Accessibility Requirements

**Text contrast requirements for this flow**:

| Text Element | Background Context | Required Ratio | Current Ratio | Pass? |
|--------------|-------------------|---------------|---------------|-------|
| Save Slot Card: zone name (large primary text) | Card background (project panel color) | 4.5:1 (WCAG AA — 7:1 preferred for primary) | TBD | [ ] |
| Save Slot Card: playtime | Card background | 4.5:1 | TBD | [ ] |
| Save Slot Card: timestamp (small text) | Card background | 4.5:1 (small text 4.5:1 minimum) | TBD | [ ] |
| Save Slot Card: skip hint | Card background | 4.5:1 | TBD | [ ] |
| Wipe Confirmation: title "START NEW GAME" | Dialog panel | 4.5:1 | TBD | [ ] |
| Wipe Confirmation: body text | Dialog panel | 4.5:1 | TBD | [ ] |
| Wipe Confirmation: destructive button label | Destructive button background (project red) | 4.5:1 | TBD | [ ] |
| Wipe Confirmation: cancel button label | Secondary button background | 4.5:1 | TBD | [ ] |
| Save Indicator: icon visibility | Variable game scene background | Icon must include sufficient outline or backplate to be visible against any background | TBD | [ ] |
| Corruption notification: body text | Notification panel | 4.5:1 | TBD | [ ] |
| Storage Full notification: body text | Notification panel | 4.5:1 | TBD | [ ] |

**Colorblind-unsafe elements and mitigations**:

| Element | Colorblind Risk | Mitigation |
|---------|----------------|------------|
| Destructive button (project red color) | Red-green colorblindness — destructive cues based on red alone fail | Destructive button has warning icon (⚠) AND explicit "Delete and Start New Game" label. Color is supplemental, not sole differentiator. |
| Save Indicator (relies on visual recognition of "save" glyph) | Cognitive recognition more than colorblind, but icon must be recognizable | Use a widely-recognized save glyph (floppy disk or cassette); pair with screen-reader announcement |
| Notification warning icon (⚠ in red or orange) | Red-green colorblindness | Icon shape (triangle with exclamation) is recognizable without color; paired with explicit text |

**Focus order** (Tab key sequence, numbered):

Save Slot Card:
- No focus order — card is a read-out with no interactive elements except the global skip input

Wipe Confirmation Dialog:
1. Cancel (default focus — safe action)
2. Delete and Start New Game
→ Wraps to Cancel

Save Indicator: Not focusable.

Notifications: Not focusable (auto-dismiss; any key dismisses early).

**Screen reader announcements for key state changes**:

| State Change | Announcement Text | Announcement Timing |
|--------------|------------------|---------------------|
| Save Slot Card opens (populated) | "Continue. Last save: [Zone name]. [Playtime] of playtime. Saved on [Date]. Press any key to continue, or wait one and a half seconds." | On card focus settle |
| Save Slot Card opens (degraded — missing metadata) | "Continue. Last save: unknown. Press any key to continue, or wait one and a half seconds." | On card focus settle |
| Save Slot Card dismissing | "Loading." | On dismiss start |
| Wipe Confirmation opens | "Start new game confirmation. Your existing save will be permanently deleted. This cannot be undone. Current save: [Zone], [Playtime] of playtime. Cancel selected." | On dialog focus settle |
| Wipe Confirmation: focus moves to Delete button | "Delete and Start New Game. Destructive action." | On focus arrival |
| Wipe Confirmation: focus moves to Cancel | "Cancel." | On focus arrival |
| Wipe Confirmation confirmed | "Deleting save. Starting new game." | On confirm |
| Wipe Confirmation cancelled | "Cancelled." | On cancel |
| Save Indicator appears | "Saving." (low priority — does not interrupt other speech) | On OnSaveStart |
| Save Indicator disappears (after OnSaveComplete) | "Saved." (low priority) | On OnSaveComplete |
| Save Indicator disappears (after timer with no complete event) | (no announcement — save may still be in flight) | N/A |
| Corruption notification appears | "Save data could not be loaded. Starting new game." (high priority) | On notification show |
| Storage Full notification appears | "Could not save. Storage full." (high priority) | On notification show |

**Cognitive load assessment**:

- Save Slot Card: One information stream (the save context). Auto-dismissing, skippable. Very low cognitive demand.
- Wipe Confirmation Dialog: Two streams — the destructive consequence statement and the current save context. The dialog forces the player to consider both before acting. Elevated cognitive load is INTENTIONAL — this is the safety rail.
- Save Indicator: Peripheral, non-demanding. The player can ignore it if they choose.
- Notifications: One stream, one factual statement, auto-dismissing. Low demand.

All within the 7±2 limit. The Wipe Confirmation is the only surface that intentionally raises cognitive load, and that is by design.

---

## 13. Localization Considerations

**General rules for this flow**:
- All text from localization strings
- Date/time formatting must follow locale conventions (US: "May 26, 2026 19:42"; ISO/EU: "26 May 2026 19:42"; JP: "2026年5月26日 19:42")
- Playtime formatting: "Xh Ym" in English; locale-appropriate in other languages (German: "X Std. Y Min."; Japanese: "X時間Y分")
- Zone names are localizable strings (NOT raw IDs)
- RTL layouts mirror the Save Slot Card (thumbnail moves to right, metadata to left) and the Wipe Confirmation Dialog
- CJK languages may have shorter text — dialog and card must not look broken with less content

| Text Element | English Baseline Length | Max Characters | Expansion Budget | RTL Behavior | Overflow Behavior | Risk |
|--------------|------------------------|----------------|-----------------|--------------|-------------------|------|
| Save Slot Card: "CONTINUE" header | 8 chars | 20 chars | 150% | Mirror | Truncate ellipsis | Low |
| Save Slot Card: zone name | ~15 chars typical, ~25 max ("Mountainside Research Lab") | 32 chars | 100% | Right-align in RTL | Truncate with ellipsis | Medium — zone names can be long |
| Save Slot Card: playtime "X hours Y minutes" or "Xh Ym" | ~10 chars | 24 chars | 140% | Mirror | Truncate | Low |
| Save Slot Card: timestamp | ~20 chars typical | 32 chars | 60% | Mirror; format per locale | Truncate date portion if needed; preserve time | Low — format already locale-aware |
| Save Slot Card: "Press any key to skip" hint | 21 chars | 40 chars | 90% | Mirror | Truncate | Low |
| Wipe Confirmation: title "START NEW GAME" | 14 chars | 24 chars | 71% | Mirror | Truncate | Low |
| Wipe Confirmation: body "Your existing save will be permanently deleted. This cannot be undone." | 70 chars | 200 chars | 186% | Mirror | Wrap to multiple lines; dialog grows | Low |
| Wipe Confirmation: "Current save:" label | 13 chars | 24 chars | 85% | Mirror | Truncate | Low |
| Wipe Confirmation: "Delete and Start New Game" button | 26 chars | 60 chars | 130% | Mirror | Shrink font 90%, then stack buttons vertically | Medium — destructive labels are typically long |
| Wipe Confirmation: "Cancel" button | 6 chars | 20 chars | 233% | Mirror | Truncate | Low |
| Corruption notification text | 47 chars | 120 chars | 155% | Mirror | Wrap to 2 lines | Low |
| Storage full notification text | 30 chars | 80 chars | 167% | Mirror | Wrap to 2 lines | Low |

---

## 14. Acceptance Criteria

**Performance**
- [ ] Save Slot Card first frame visible within 250ms of Continue selection
- [ ] Save metadata loaded within 100ms (shimmer placeholder should rarely be perceptible)
- [ ] Save Slot Card auto-dismisses at exactly 1.5s ±50ms
- [ ] Save Slot Card skip dismiss completes within 200ms of input
- [ ] Wipe Confirmation Dialog first frame visible within 150ms of New Game selection
- [ ] Wipe save IO completes within 100ms on minimum-spec hardware
- [ ] Save Indicator fades in within 200ms of OnSaveStart
- [ ] Save Indicator fades out within 300ms of OnSaveComplete or 2.0s timer
- [ ] Notifications fade in within 200ms of event fire
- [ ] No frame drops during any of these transitions

**Layout & Rendering**
- [ ] All surfaces display correctly at 1280×720, 1920×1080, 2560×1440, 3840×2160
- [ ] All surfaces display correctly at 16:9, 16:10, 21:9 aspect ratios
- [ ] Save Slot Card thumbnail maintains 16:9 aspect with letterboxing or cropping (NOT stretching) if source is non-16:9
- [ ] Save Indicator does not overlap health or infection HUD elements (per save-load GDD Visual section)
- [ ] No text overflow or truncation in English within character bounds
- [ ] No text overflow or truncation in German
- [ ] All states render correctly: Loading-metadata, Populated, Degraded-no-thumbnail, Degraded-no-metadata, Dismissing (card); Opening, Open, Confirm-pending, Wipe-failed, Closing (dialog); Hidden, Showing, Dismissing (indicator); Showing, Dismissing (notifications)

**Input**
- [ ] Save Slot Card skips on any key, button, or mouse click
- [ ] Wipe Confirmation Dialog buttons reachable by keyboard arrow keys, Tab, gamepad D-Pad, mouse
- [ ] Esc / B cancels the Wipe Confirmation Dialog
- [ ] Default focus on Cancel in Wipe Confirmation Dialog
- [ ] Clicking outside the Wipe Confirmation Dialog does NOT dismiss it
- [ ] Save Indicator is non-interactive — does not capture input
- [ ] Notifications dismiss on any key press; otherwise auto-dismiss at 5s

**Events & Data**
- [ ] `WipeSaveRequested` fires before `NewGameRequested` on confirm (verify ordering)
- [ ] Wipe IO completes before `NewGameRequested` fires
- [ ] Save metadata is read via `GetSaveMetadata()` without loading the full save file
- [ ] Thumbnail texture loads without blocking the rest of the card display (other metadata visible during thumbnail load)
- [ ] Save Indicator subscribes to OnSaveStart and OnSaveComplete delegates correctly
- [ ] Notifications subscribe to OnLoadCorruption and OnSaveFailed delegates correctly
- [ ] Storage Full notification appears WITHOUT deleting the existing save file (per save-load EC6)
- [ ] Corruption notification appears AND the corrupted save is deleted AND new-game defaults load (per save-load AC6)

**Accessibility**
- [ ] All text passes 4.5:1 contrast minimum
- [ ] Destructive button is identifiable without color (icon + explicit label)
- [ ] Screen reader announces card content, dialog content, save status, and notification content per Section 12
- [ ] Reduced motion: all fades/scales/slides skipped to instant transitions
- [ ] Save Indicator includes outline/backplate to be visible against any game background
- [ ] Save Slot Card 1.5s display duration is NOT shortened by reduced motion (reduced motion = instant transitions, not faster timers)
- [ ] High contrast mode renders without breakage

**Localization**
- [ ] No text overflow in English, German, French, Spanish, Japanese, simplified Chinese
- [ ] Date/time formats follow locale conventions
- [ ] Playtime formatting follows locale conventions
- [ ] RTL layout renders correctly for Arabic
- [ ] Zone names are localized (not raw IDs)

---

## 15. Open Questions

| Question | Owner | Deadline | Resolution |
|----------|-------|----------|-----------|
| Should the Save Slot Card always show (even if metadata is missing) or be skipped silently when metadata is missing | ux-lead | Resolved this session | ALWAYS show — even degraded. The card serves the re-anchoring need; skipping it silently would feel like a bug ("why did it just jump to Loading?"). Degraded card shows "Last save — unknown" and proceeds. |
| Should the Save Slot Card auto-dismiss duration be tunable | save-load designer | Resolved this session | YES — expose as a Save/Load tuning knob `SaveSlotCardDuration` with default 1.5s, safe range 0.5s–3.0s. Allows playtest tuning. |
| Should the Wipe Confirmation dialog also require typing a confirmation phrase ("type DELETE to confirm") | ux-lead | Resolved this session | NO — that pattern is appropriate for irreversible cloud-data deletion (e.g., GitHub repo delete). For a single local save in a game, an explicit destructive button + warning icon + non-default focus + descriptive label is sufficient friction. Adding a typed confirmation would feel hostile. |
| Should the Save Indicator have an audio cue | save-load designer | Resolved per GDD | NO. Save-load GDD Audio: "No audio cues for save/load at MVP scope. The save is silent and non-intrusive by design." |
| Should the corruption notification offer a "Try recover save" option | save-load designer | Resolved per GDD | NO at MVP. Save-load GDD EC5: "No attempt to migrate old save data at MVP scope." Corruption fallback is silent new-game start with notification. |
| Where does the save thumbnail come from on the very first save (before player has done anything visually interesting) | art-director / systems-designer | Pre-vertical-slice | Deferred — initial save will capture whatever frame is rendered. If first save is during the prison opening, the thumbnail will show the prison interior. Acceptable. |
| Should the Save Slot Card show the in-game time-of-day or weather context | ux-lead | Resolved this session | NO at MVP. Adds complexity and another metadata field. Zone + playtime + timestamp + thumbnail is the standard genre pattern. Time-of-day is implicit in the thumbnail. |
| Does the Save Slot Card render during the GSM Title → Loading transition or before | ux-lead | Resolved this session | BEFORE the GSM transition. The card appears as an overlay on Main Menu (still in Title state) for 1.5s, then GSM transitions to Loading. This keeps the card associated with the Continue decision, not with the loading process. |
| Should "Save & Quit" and "Quit to Main Menu" in pause menu also show a Save Slot Card preview before quitting | ux-lead | Resolved this session | NO. The Save Slot Card is a re-anchoring tool for loading; on quit, the player is leaving, not arriving. The save indicator + "Saving..." text in the pause menu (per pause-menu.md) is the appropriate feedback. |
