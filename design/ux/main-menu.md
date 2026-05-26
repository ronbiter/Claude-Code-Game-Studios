# UX Specification: Main Menu

> **Status**: Draft
> **Author**: ux-lead
> **Last Updated**: 2026-05-26
> **Screen / Flow Name**: `MainMenuScreen`
> **Platform Target**: PC (Steam / Epic)
> **Related GDDs**: `design/gdd/game-state-machine.md § Title State`, `design/gdd/save-load-system.md § UI Requirements`, `design/gdd/game-concept.md § Game Pillars`
> **Related ADRs**: `ADR-0002: Game State Machine Implementation`, `ADR-0003: Enhanced Input Architecture`
> **Related UX Specs**: `design/ux/pause-menu.md`, `design/ux/save-load.md`, `design/ux/settings.md` (planned)
> **Accessibility Tier**: Standard (WCAG 2.1 AA + screen reader support + colorblind-safe + focus management)

> **Note — Scope boundary**: This is a discrete full-screen menu, not a HUD overlay. The game world is not yet loaded when this screen is active (GSM is in Title state). No `hud-design.md` overlap applies.

---

## 1. Purpose & Player Need

**What player need does this screen serve?**

The Main Menu is the player's first decision point and the threshold into the world of Hostile World. It must do two things at once: give a returning player frictionless re-entry into their ongoing escape (one button press to Continue, with the world reading "ready for you, exactly where you left it"), and give a new player a confident first step into an unfamiliar, hostile world. The screen must communicate the game's tone — tense, atmospheric, deliberate — without inflicting decision fatigue. Returning players should feel the world has been waiting for them. New players should feel they are about to enter something serious.

**The player goal**: Resume their existing run with one input, or begin a new run with two, without navigating away to find what they want.

**The game goal**: Transition the GSM from Title state into Loading state with a valid intent (Continue vs. New Game), wiping the save slot if the player explicitly chose New Game over an existing save, and presenting Settings/Credits/Quit as secondary affordances that do not compete for primary focus.

---

## 2. Player Context on Arrival

| Question | Answer |
|----------|--------|
| What was the player just doing? | Either launching the game for the first time, returning after a session break (most common), or returning from Quit to Main Menu via the pause menu |
| What is their emotional state? | Anticipatory — game just booted, atmospheric audio playing, ready to make a single decision |
| What cognitive load are they carrying? | Low — no active gameplay state, no time pressure, no enemies |
| What information do they already have? | Returning players: knowledge of their last save state (where they were, what they were doing). New players: nothing beyond marketing/store page |
| What are they most likely trying to do? | Returning: press Continue and go. New: press New Game and go. Settings is a deliberate detour, not the primary path |
| What are they likely afraid of? | Returning: that their progress was lost. New: choosing the wrong option and wiping something important (this is why the New Game confirmation matters when a save exists) |

**Emotional design target for this screen**: Calm, weighty anticipation. The menu should feel like a held breath before the deep inhale of the Loading state. Not energetic, not playful — somber, atmospheric, ready.

---

## 3. Navigation Position

**Screen hierarchy**:

```
Main Menu (root — Title state)
  ├── New Game Confirmation Dialog (modal child, only when save exists)
  ├── Settings Screen (child — replaces)
  ├── Credits Screen (child — push)
  └── Save/Load Slot Card (child — only on Continue selection, shown briefly before Loading)
```

**Modal behavior**: Non-modal at the screen level (it is the root screen — there is nothing behind it to block). The New Game Confirmation Dialog spawned from this screen IS modal — it blocks the menu beneath until resolved (Confirm or Cancel).

The Main Menu cannot be "dismissed" — it is the root of the navigation stack while GSM is in Title state. The only exits are: Continue, New Game, Quit. There is no Back from the Main Menu.

**Reachability — all entry points**:

| Entry Point | Triggered By | Notes |
|-------------|-------------|-------|
| Application boot | OS launches game executable; GSM enters Title state | Primary entry — every fresh launch |
| Quit to Main Menu from Pause | Player selects "Quit to Main Menu" in pause menu; GSM transitions Playing → Loading → Title | Save fires during the transition (clean exit save per save-load Rule 2) |
| Game Over → Restart → Title path | Not applicable — Game Over restarts directly to Loading, not Title (per GSM transition table) | This is intentionally NOT an entry point |
| Credits screen exit | Player presses Back from Credits | Returns to Main Menu with focus restored to Credits option |
| Settings screen exit | Player presses Back from Settings (when Settings was entered from Main Menu) | Returns to Main Menu with focus restored to Settings option |

---

## 4. Entry & Exit Points

**Entry table**:

| Trigger | Source Screen / State | Transition Type | Data Passed In | Notes |
|---------|----------------------|-----------------|----------------|-------|
| Application boot | OS (no source screen) | GSM enters Title state; deep inhale audio (1.5s); menu items stagger-fade in at 80ms intervals | `HasExistingSave()` query result (bool) | Default focus depends on this query — see Section 5.3 primary focus |
| Quit to Main Menu | Pause Menu | Loading → Title state transition (1.5s deep inhale); menu fades in after Title state entry | `HasExistingSave()` query result — should always be true on this path because clean exit just saved | Default focus lands on Continue |
| Return from Credits | Credits Screen | Cross-fade 200ms | None | Focus restored to Credits option in menu |
| Return from Settings | Settings Screen | Cross-fade 200ms | None | Focus restored to Settings option in menu |
| Cancel New Game confirmation | New Game Confirmation Dialog | Dialog dismisses, 150ms scale-down + dim removal | None | Focus restored to New Game option |

**Exit table**:

| Exit Action | Destination | Transition Type | Data Returned / Saved | Notes |
|-------------|------------|-----------------|----------------------|-------|
| Player selects Continue | Loading State (then Playing) | GSM Title → Loading; 1.5s deep inhale; menu fades out | `LoadIntent=ContinueExistingSave` | Only available when `HasExistingSave() == true`. Save-load AC10. |
| Player selects New Game (no existing save) | Loading State (then Playing) | GSM Title → Loading; 1.5s deep inhale; menu fades out | `LoadIntent=NewGame` | Save-load EC4 path — no confirmation needed |
| Player selects New Game (save exists) → confirms | Loading State (then Playing) | Confirmation dialog dismisses (150ms); GSM Title → Loading; 1.5s deep inhale | `LoadIntent=NewGameWipeSave`; save file is deleted before Loading begins | Save deletion is the dialog's authority — fires `WipeSaveRequested` event on confirm |
| Player selects New Game (save exists) → cancels | Same screen, no transition | Dialog dismisses, focus restored to New Game | None | No save change, no GSM transition |
| Player selects Settings | Settings Screen | Slide left 250ms ease-out cubic | None | Settings is a child screen — Main Menu state is preserved beneath |
| Player selects Credits | Credits Screen | Slide left 250ms ease-out cubic | None | Push transition; preserved |
| Player selects Quit | OS exit | Fade to black 400ms; application terminates | None | No save needed — no game state was loaded |

---

## 5. Layout Specification

### 5.1 Wireframe

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│                                                                      │
│                       HOSTILE  WORLD                                 │  ← LOGO ZONE
│                                                                      │     (top 25% of screen, centered)
│                                                                      │
│                                                                      │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│         ●  CONTINUE                                                  │  ← MENU LIST ZONE
│            "Last save — Foothill Camp · 4h 22m"                      │     (left-of-center, vertical)
│                                                                      │     (left edge ~25% from screen left)
│            NEW GAME                                                  │
│                                                                      │
│            SETTINGS                                                  │
│                                                                      │
│            CREDITS                                                   │
│                                                                      │
│            QUIT                                                      │
│                                                                      │
│                                                                      │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│                                                                      │  ← BACKGROUND ZONE
│         {atmospheric world frame — alien-infected landscape}         │     (full screen, behind logo and menu)
│                                                                      │     (60% darkened, slight blur)
│                                                                      │
│  v0.1.0-alpha                                  © 2026 Studio Name    │  ← FOOTER ZONE
└──────────────────────────────────────────────────────────────────────┘

Variant — no existing save:
┌──────────────────────────────────────────────────────────────────────┐
│                       HOSTILE  WORLD                                 │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│         ●  NEW GAME                                                  │  ← Continue is HIDDEN (not disabled)
│                                                                      │     because no save exists
│            SETTINGS                                                  │
│                                                                      │
│            CREDITS                                                   │
│                                                                      │
│            QUIT                                                      │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### 5.2 Zone Definitions

| Zone Name | Description | Approximate Size | Scrollable? | Overflow Behavior |
|-----------|-------------|-----------------|-------------|-------------------|
| Logo Zone | Top: game title logotype, centered | Full width, ~25% height | No | Logo scales down at sub-720p; never wraps |
| Menu List Zone | Left-of-center: vertical menu items with focus indicator | ~30% width, ~55% height | No | List has fixed item count (max 5); no overflow possible |
| Background Zone | Full-screen atmospheric still or slow ambient loop, 60% darkened, blurred | 100% width, 100% height | N/A | Cropped at extreme aspect ratios; safe-area pivot keeps focal point visible |
| Footer Zone | Bottom strip: version string (left), copyright (right) | Full width, ~5% height | No | Truncate version string with ellipsis only if absurdly long; copyright is fixed text |
| Continue Subline | Underneath Continue label only: "Last save — [Zone] · [Playtime]" | Below Continue label, ~60% of menu list width | No | Truncate zone name to 24 chars with ellipsis; playtime is always short |

### 5.3 Component Inventory

| Component Name | Type | Zone | Purpose | Required? | Reuses Existing Component? |
|----------------|------|------|---------|-----------|---------------------------|
| GameLogo | Image | Logo Zone | Display the Hostile World logotype | Yes | No — bespoke asset |
| MenuItemButton | Button (vertical list item) | Menu List Zone | One selectable menu row (Continue, New Game, etc.) | Yes | No — new component; reused across pause menu |
| ContinueSubline | Text (caption) | Menu List Zone (under Continue) | Display last save zone + playtime under Continue | Yes (only when save exists) | No — bespoke for this screen |
| FocusIndicator | Visual marker (filled dot or chevron) | Menu List Zone | Indicate which menu item has keyboard/gamepad focus | Yes | Yes — shared FocusIndicator component used project-wide |
| BackgroundFrame | Image / scene render | Background Zone | Atmospheric scene behind menu | Yes | No — bespoke; may be replaced by a low-cost cinematic loop later |
| VersionLabel | Text (small) | Footer Zone | Display version string for support/bug reports | Yes | Yes — shared VersionLabel component |
| CopyrightLabel | Text (small) | Footer Zone | Display copyright string | Yes | Yes — shared CopyrightLabel component |
| NewGameConfirmDialog | Modal Dialog | (Overlays whole screen) | Confirm save wipe before starting new game over existing save | Yes (only when save exists and player selects New Game) | No — new component; reused as generic ConfirmDialog pattern |
| QuitConfirmDialog | Modal Dialog | (Overlays whole screen) | Optional: confirm quit to OS | No — Quit from Main Menu has nothing to lose (no active game state); confirm dialog adds friction with no safety benefit | N/A |

**Primary focus element on open**:
- If `HasExistingSave() == true`: **Continue** (first item)
- If `HasExistingSave() == false`: **New Game** (first visible item — Continue is hidden in this variant)

---

## 6. States & Variants

| State Name | Trigger | What Changes Visually | What Changes Behaviorally | Notes |
|------------|---------|----------------------|--------------------------|-------|
| Loading (data fetch) | Screen mounts; `HasExistingSave()` and save metadata being queried | Menu items appear immediately; Continue subline shows shimmer placeholder for ~150ms | All menu items enabled except Continue (disabled until metadata resolves) | Save metadata query is fast (<100ms typical) — shimmer should rarely be perceptible |
| Populated — save exists | `HasExistingSave() == true` AND metadata loaded | Continue is the top item, focused by default; Continue subline shows "Last save — [Zone] · [Playtime]" | All actions enabled | Default state on most returning launches |
| Populated — no save | `HasExistingSave() == false` | Continue item is hidden entirely (NOT shown disabled); New Game is the top item, focused by default | Continue path is unreachable | First-boot state. Save-load Rule 6 implies new game on missing save is silent — no error UI |
| New Game Confirmation pending | Player selects New Game while save exists | Modal dialog appears over menu; background dims 60%; menu beneath is non-interactive | Only Confirm and Cancel inputs active in this state | Confirmation copy: "Starting a new game will permanently delete your existing save. This cannot be undone." Primary button: "Delete and Start New Game" (destructive style). Secondary: "Cancel" (default focus). |
| Quit transition | Player selects Quit | Menu fades to black over 400ms; audio fades; logo dissolves last | All input disabled during transition | Application terminates after transition |
| Exit to Loading | Player confirmed Continue or New Game | Menu items fade out staggered (60ms/item); deep inhale audio begins; Loading state takes over | All input disabled | Transition owned by GSM (1.5s deep inhale) |
| Save metadata failure | Save metadata query returned error but save file exists | Continue subline shows "Last save — unknown" (no zone, no playtime) | Continue is still enabled — degraded gracefully | Save-load corruption is a separate path (handled by Loading state, not Main Menu). Metadata-only failure should not block Continue. |
| Background load failure | Atmospheric background image fails to load | Background renders solid dark color (project-defined "void black") | No functional change | Logged to telemetry; never blocks menu interactivity |

---

## 7. Interaction Map

### 7.1 Navigation Inputs

| Input | Platform | Action | Visual Response | Audio Cue | Notes |
|-------|----------|--------|-----------------|-----------|-------|
| Down Arrow / D-Pad Down / Left Stick Down | All | Move focus to next menu item | Focus indicator slides to next item; previous item dims | Soft navigation tick | Wraps at bottom — Down from Quit returns focus to top item |
| Up Arrow / D-Pad Up / Left Stick Up | All | Move focus to previous menu item | Focus indicator slides to previous item | Soft navigation tick | Wraps at top |
| Mouse hover over menu item | PC | Visually preview hover state on that item (highlight only) | Item label brightens 20%; focus indicator does NOT move | None | Hover preview only — focus only moves on mouse click. Prevents accidental focus drift from cursor parking. |
| Mouse click on menu item | PC | Move focus AND activate the item in one gesture | Press flash 60ms, then activate | Soft click + activation tone | Click is select-and-confirm. No two-step required. |
| Tab | KB | No effect | None | None | Menu has only one zone (the list); Tab would have nowhere to go. Reserved as no-op rather than wrap-to-top to avoid surprising users. |

### 7.2 Action Inputs

| Input | Platform | Context (What must be focused) | Action | Response | Animation | Audio Cue | Notes |
|-------|----------|-------------------------------|--------|----------|-----------|-----------|-------|
| Enter / A button / Left click | All | Continue focused | Begin Continue flow — exit menu, GSM transitions Title → Loading | Menu items fade out staggered 60ms/item; deep inhale begins | Stagger fade, 300ms total | Confirm tone + deep inhale | Fires `ContinueRequested` event |
| Enter / A button / Left click | All | New Game focused (no save exists) | Begin New Game flow directly | Menu items fade out; deep inhale | Stagger fade 300ms | Confirm tone + deep inhale | Fires `NewGameRequested` event |
| Enter / A button / Left click | All | New Game focused (save exists) | Open New Game Confirmation Dialog | Dialog scales up from 95% over 150ms; background dims 60% | Scale-up, 150ms ease-out | Modal open tone | Does NOT immediately fire — waits for dialog resolution |
| Enter / A button / Left click | All | Settings focused | Navigate to Settings screen | Slide left transition 250ms | Slide, 250ms ease-out cubic | Navigate tone | Settings screen owns return-to-menu behavior |
| Enter / A button / Left click | All | Credits focused | Navigate to Credits screen | Slide left transition 250ms | Slide, 250ms | Navigate tone | Credits screen owns return-to-menu behavior |
| Enter / A button / Left click | All | Quit focused | Begin quit-to-OS flow | Menu fades to black 400ms; audio fades in parallel | Fade, 400ms | Quit tone | Fires `QuitToOSRequested` event; application terminates after fade |
| Esc / B button / Backspace | All | Any (screen level) | No effect at Main Menu root | None | None | None | Main Menu has no parent — Back is a no-op here. This is deliberate to prevent accidental quit. Quit requires explicit Quit selection. |
| Enter / A button / Left click | All | Confirm Dialog: "Delete and Start New Game" focused | Wipe save and begin New Game flow | Dialog dismisses; menu fades; Loading begins | Dialog scale-down 100ms; menu fade 300ms | Destructive confirm tone + deep inhale | Fires `WipeSaveRequested` then `NewGameRequested` |
| Esc / B button / Left click on Cancel | All | Confirm Dialog open | Dismiss dialog without action | Dialog scales down to 95% over 100ms; dim removes | Scale-down, 100ms | Cancel tone | Focus restored to New Game item |
| F1 / Select button | All | Any | No effect — reserved for future help overlay | None | None | None | Documented to prevent ad-hoc remapping |

### 7.3 State-Specific Behaviors

| State | Input Restriction | Reason |
|-------|------------------|--------|
| Loading (metadata fetch) | Continue input ignored; all other items active | Continue cannot fire until metadata resolves — prevents loading with stale state |
| New Game Confirmation pending | Only Confirm and Cancel active; menu beneath frozen | Modal — destructive action must be explicit |
| Exit to Loading | All input disabled | Transition is in flight; GSM is mid-state-change |
| Quit transition | All input disabled | Application is terminating |

---

## 8. Data Requirements

| Data Element | Source System | Update Frequency | Who Owns It | Format | Null / Missing Handling |
|--------------|--------------|-----------------|-------------|--------|------------------------|
| `HasExistingSave()` result | Save/Load System | On screen open; on dialog confirm (after wipe) | Save/Load System | bool | Never null — system always returns true or false. If save file IO fails, system returns false (treats unreadable save as "no save"). |
| Last save zone name | Save/Load System (via save metadata) | On screen open only | Save/Load System | string (localized zone display name, max 24 chars after truncation) | If metadata read fails: display "Last save — unknown". Continue remains enabled. |
| Last save playtime | Save/Load System (via save metadata) | On screen open only | Save/Load System | int seconds → formatted "Xh Ym" | If metadata read fails: omit playtime from subline ("Last save — [Zone]"). |
| Last save timestamp | Save/Load System (via save metadata) | On screen open only | Save/Load System | datetime ISO 8601 | Not displayed on Main Menu — only on Save Slot Card (see save-load.md). Reserved for future "Last played: 2 days ago" line. |
| Background image asset | Asset System | Once on screen mount | Asset System | Texture reference | If asset fails to load, fall back to solid dark color. Logged to telemetry. |
| Version string | Build System | Read once at boot | Build System | string | Never missing — build-time injected. If empty, hide footer left side entirely (do not show "v") |

> **Rule**: This screen reads `HasExistingSave()` and save metadata only. It does NOT directly read or write any other game subsystem. The wipe action fires `WipeSaveRequested` — the Save/Load System owns the deletion.

---

## 9. Events Fired

| Player Action | Event Fired | Payload | Receiver System | Notes |
|---------------|-------------|---------|-----------------|-------|
| Player selects Continue | `ContinueRequested` | `{}` | Game State Machine | GSM transitions Title → Loading with intent=load existing save |
| Player selects New Game (no save) | `NewGameRequested` | `{}` | Game State Machine | GSM transitions Title → Loading with intent=new game |
| Player confirms New Game over existing save | `WipeSaveRequested` then `NewGameRequested` | `{}`, `{}` | Save/Load System (wipe), then Game State Machine (new game) | Events are fired sequentially; `NewGameRequested` must wait for `WipeSaveComplete` callback |
| Player cancels New Game confirmation | `NewGameConfirmCancelled` | `{}` | Analytics System | Analytics-only — no game state change |
| Player selects Settings | `NavigateToSettingsRequested` | `{from: "MainMenu"}` | UI Navigation | Settings screen reads `from` to know where Back returns to |
| Player selects Credits | `NavigateToCreditsRequested` | `{from: "MainMenu"}` | UI Navigation | Same pattern |
| Player selects Quit | `QuitToOSRequested` | `{}` | Game Instance | Game Instance owns application teardown |
| Screen opens | `MainMenuOpened` | `{has_existing_save: bool}` | Analytics System | Analytics-only |
| Screen closes (any exit) | `MainMenuClosed` | `{exit_action: "continue"\|"newgame"\|"settings"\|"credits"\|"quit", session_duration_ms: int}` | Analytics System | Analytics-only |

---

## 10. Transition & Animation

| Transition | Trigger | Direction / Type | Duration (ms) | Easing | Interruptible? | Skipped by Reduced Motion? |
|------------|---------|-----------------|--------------|--------|----------------|---------------------------|
| Initial screen reveal | GSM enters Title state | Logo fades in 0→100% then menu items stagger-fade (80ms between items) | 600 total (200 logo + 400 stagger) | Ease-out cubic | No | Yes — instant reveal at 100% |
| Menu item focus change | Player navigates with arrow/d-pad/stick | Focus indicator slides to new item | 100 | Ease-out quad | Yes — quick re-press cancels previous | Yes — instant indicator jump |
| Mouse hover preview | Mouse cursor enters item bounds | Label brightness 100% → 120% | 80 | Linear | Yes | Yes — instant brightness change |
| Menu item press | Player activates an item | Item scales 100% → 96% on press, 96% → 100% on release | 60 down / 60 up | Ease-out / ease-in | Yes — release early returns to 100% | No — tactile feedback, not decorative |
| Exit to Loading | Continue or New Game selected | Menu items stagger fade-out (60ms/item from bottom up); deep inhale audio begins simultaneously | 300 total | Ease-in cubic | No | Yes — instant disappear; deep inhale shortened to 200ms |
| Exit to OS (Quit) | Quit selected | Full screen fades to black; audio fades in parallel | 400 | Linear | No | Yes — instant black, then terminate |
| Navigate to Settings | Settings selected | Whole screen slides left, Settings slides in from right | 250 | Ease-out cubic | No | Yes — instant cross-cut |
| Navigate to Credits | Credits selected | Same as Settings | 250 | Ease-out cubic | No | Yes — instant cross-cut |
| Return from child screen | Back from Settings/Credits | Reverse slide (this screen comes in from left) | 250 | Ease-out cubic | No | Yes — instant |
| New Game Confirm Dialog open | New Game selected while save exists | Background dims 0→60% opacity; dialog scales 95% → 100% | 150 | Ease-out cubic | No | Yes — instant appear, no scale |
| New Game Confirm Dialog close | Cancel or Confirm | Dialog scales 100% → 95% with fade; dim removes | 100 | Ease-in cubic | No | Yes — instant disappear |

---

## 11. Input Method Completeness Checklist

**Keyboard**
- [x] All interactive elements reachable using Tab and arrow keys alone — arrow keys traverse menu; only one zone exists, so Tab is unused
- [x] Tab order follows visual reading order — single vertical zone; top-to-bottom matches focus order
- [x] Every action achievable by mouse is also achievable by keyboard
- [x] Focus is visible at all times — FocusIndicator always anchored to one item
- [x] Focus does not escape the screen while it is open — wrap at top/bottom
- [x] Esc key behavior defined — no-op at root menu (documented in 7.2)

**Gamepad**
- [x] All interactive elements reachable with D-Pad and left stick
- [x] Face button mapping documented and consistent with platform conventions — A confirms, B cancels (cancel only meaningful inside dialog)
- [x] No action requires analog stick precision — D-Pad sufficient
- [x] Trigger and bumper shortcuts documented if used — not used on this screen
- [x] Controller disconnection while screen is open is handled gracefully — keyboard remains active; reconnection restores gamepad input automatically (UE5 Enhanced Input handles)

**Mouse**
- [x] Hover states defined for all interactive elements — hover preview brightens, does not move focus
- [x] Clickable hit targets are at minimum 32x32px — menu items target 48px height × full menu width
- [x] Right-click behavior defined — no-op on this screen (documented)
- [x] Scroll wheel behavior defined in all scrollable zones — no scrollable zones on this screen

**Touch (if applicable)**
- N/A — PC only (no touch target)

---

## 12. Screen-Level Accessibility Requirements

**Text contrast requirements for this screen**:

| Text Element | Background Context | Required Ratio | Current Ratio | Pass? |
|--------------|-------------------|---------------|---------------|-------|
| Menu item label — focused | Dark blurred world background, 60% darkened | 7:1 (WCAG AAA preferred for primary action; project commits to AA 4.5:1 minimum) | TBD — verify in implementation against finalized background | [ ] |
| Menu item label — unfocused | Same | 4.5:1 (WCAG AA normal text) | TBD | [ ] |
| Continue subline (small caption text) | Same | 4.5:1 (small text under 18pt requires 4.5:1) | TBD | [ ] |
| Version / copyright in footer | Same | 4.5:1 | TBD | [ ] |
| Confirm dialog body text | Dimmed dialog background | 4.5:1 | TBD | [ ] |
| Confirm dialog destructive button label | Destructive button background (project red) | 4.5:1 minimum | TBD | [ ] |

**Colorblind-unsafe elements and mitigations**:

| Element | Colorblind Risk | Mitigation |
|---------|----------------|------------|
| Focus indicator (relies on accent color to distinguish focused item) | Multiple types — color-only focus is a common failure | Focus indicator is a SHAPE (filled dot or chevron) AND a position shift, not just color. Focus is unambiguous without color perception. |
| Destructive button in confirm dialog (project red color) | Red-green colorblindness | Destructive button has an explicit destructive ICON (warning triangle) and explicit label "Delete and Start New Game". Color is supplemental. |

**Focus order** (Tab key sequence, numbered):

When save exists:
1. Continue
2. New Game
3. Settings
4. Credits
5. Quit
→ Wraps to Continue

When no save exists:
1. New Game
2. Settings
3. Credits
4. Quit
→ Wraps to New Game

Focus does not enter the background, logo, or footer — these are decorative/informational, not interactive.

In Confirm Dialog (when open):
1. Cancel (default focus — least destructive)
2. Delete and Start New Game
→ Wraps to Cancel

**Screen reader announcements for key state changes**:

| State Change | Announcement Text | Announcement Timing |
|--------------|------------------|---------------------|
| Screen opens (save exists) | "Main menu. Continue selected. Last save in [Zone], [Playtime] of playtime." | On screen focus settle (~600ms after open) |
| Screen opens (no save) | "Main menu. New Game selected." | On screen focus settle |
| Focus moves to a menu item | "[Item label] selected. [Position] of [total]." (e.g., "Settings selected. 3 of 5.") | On focus arrival |
| Continue subline updates after metadata load | "Last save in [Zone], [Playtime] of playtime." | When metadata resolves (skipped if announced at screen open) |
| Confirm dialog opens | "New Game confirmation. Starting a new game will permanently delete your existing save. This cannot be undone. Cancel selected." | On dialog focus settle |
| Confirm dialog: focus moves to Delete button | "Delete and Start New Game. Destructive action." | On focus arrival |
| Quit selected | "Quitting." | On Quit activation |

**Cognitive load assessment**:

The Main Menu presents at most 5 menu items in a single vertical list. The player is tracking exactly one stream: which item is focused. This is well below the 7±2 limit. The Continue subline introduces one additional information element (last save context) but it is passive — the player can ignore it. Cognitive load is intentionally minimal here because the player has either just booted the game (low context) or just quit a session (recovering context). The screen does not demand cognitive work.

The New Game Confirmation Dialog elevates load briefly — the player must process the destructive consequence before acting. Default focus on Cancel (the safe action) and explicit destructive language ("permanently delete", "cannot be undone") are the mitigations.

---

## 13. Localization Considerations

**General rules for this screen**:
- All text elements must tolerate a minimum of 40% expansion from English baseline
- RTL layout (Arabic, Hebrew): menu list mirrors to right-of-center; focus indicator and chevron flip horizontally; logo does not mirror (proper noun)
- CJK languages: menu item labels may be 20–30% shorter — vertical spacing must not look broken with shorter labels (use min-height per item to prevent collapse)
- All text from localization strings; no text baked into background image

| Text Element | English Baseline Length | Max Characters | Expansion Budget | RTL Behavior | Overflow Behavior | Risk |
|--------------|------------------------|----------------|-----------------|--------------|-------------------|------|
| Menu label "CONTINUE" | 8 chars | 20 chars | 150% | Mirror text to right-align within item | Truncate with ellipsis only if exceeding 20 chars (extreme outlier) | Low |
| Menu label "NEW GAME" | 8 chars | 20 chars | 150% | Mirror | Truncate ellipsis | Low |
| Menu label "SETTINGS" | 8 chars | 20 chars | 150% | Mirror | Truncate ellipsis | Low — "Einstellungen" (German, 13) fits |
| Menu label "CREDITS" | 7 chars | 20 chars | 186% | Mirror | Truncate ellipsis | Low |
| Menu label "QUIT" | 4 chars | 20 chars | 400% | Mirror | Truncate ellipsis | Low |
| Continue subline "Last save — [Zone] · [Playtime]" | ~30 chars typical | 60 chars | 100% | Mirror; em-dash becomes locale-appropriate separator | Truncate zone name first (zone is the variable element); preserve playtime which is short numeric format | Medium — zone names in some languages may be long |
| Confirm dialog body | ~100 chars | 240 chars | 140% | Mirror; full paragraph right-aligned | Wrap normally; dialog grows vertically if needed (no truncation) | Low |
| Confirm dialog destructive button "Delete and Start New Game" | 26 chars | 60 chars | 130% | Mirror | Shrink font 90% then wrap to 2 lines if needed | Medium — long destructive labels in German |
| Confirm dialog cancel button "Cancel" | 6 chars | 20 chars | 233% | Mirror | Should never overflow | Low |
| Version label | ~12 chars | 24 chars | 100% | Does NOT mirror — version is a fixed-format string | Truncate with ellipsis only if extreme | Low |
| Copyright label | ~30 chars | 80 chars | 167% | Mirror | Truncate with ellipsis | Low |

---

## 14. Acceptance Criteria

**Performance**
- [ ] Screen first frame visible within 200ms of GSM entering Title state (excluding 1.5s deep inhale transition, which is intentional)
- [ ] `HasExistingSave()` and save metadata query complete within 100ms on minimum-spec hardware
- [ ] Continue subline populates within 150ms of screen mount (or shows fallback "Last save — unknown" if metadata IO fails)
- [ ] Navigation between menu items has no perceptible frame drop (maintain 60fps ±5fps)
- [ ] Menu stagger fade-in completes within 600ms

**Layout & Rendering**
- [ ] Screen displays correctly at minimum supported resolution (1280×720)
- [ ] Screen displays correctly at maximum supported resolution (3840×2160 / 4K)
- [ ] Screen displays correctly at 16:9, 16:10, 21:9 aspect ratios; safe-area pivot keeps menu and logo on-screen at 21:9
- [ ] No text overflow or truncation in English within defined max-character bounds
- [ ] No text overflow or truncation in German (longest-translation language) within character bounds
- [ ] All states (Loading, Populated-save-exists, Populated-no-save, Confirm Dialog open, Exit to Loading, Quit) render correctly
- [ ] Background image fallback (solid dark) renders correctly when image asset fails to load

**Input**
- [ ] All menu items reachable by keyboard using arrow keys only
- [ ] All menu items reachable by gamepad using D-Pad and face buttons only
- [ ] All menu items reachable by mouse without keyboard
- [ ] No action requires simultaneous input
- [ ] Focus is visible at all times on keyboard and gamepad navigation
- [ ] Focus does not escape the screen while it is open (wraps at top/bottom)
- [ ] Mouse hover does NOT move focus; only click does
- [ ] Esc key at Main Menu root is a no-op (does not quit, does not navigate)

**Events & Data**
- [ ] All events in Section 9 fire with correct payloads on all exit paths (verify with debug logging)
- [ ] Screen does not write to any game system except firing `WipeSaveRequested` to Save/Load System
- [ ] `WipeSaveRequested` deletes save file before `NewGameRequested` fires (verify ordering)
- [ ] Returning from Settings or Credits restores correct focus item
- [ ] Quit terminates application cleanly (no orphaned processes)

**Accessibility**
- [ ] All text passes minimum 4.5:1 contrast ratio against finalized background
- [ ] Focus indicator is distinguishable without color (shape + position shift)
- [ ] Screen reader announces menu items, focus changes, and dialog content per Section 12
- [ ] Reduced motion setting results in instant transitions (no stagger fade, no slides)
- [ ] High contrast mode renders without visual breakage (deferred to Comprehensive tier — minimum requirement is to not crash)

**Localization**
- [ ] No text element overflows its container in English, German, French, Spanish, Japanese, simplified Chinese
- [ ] RTL layout renders correctly for Arabic (if shipping Arabic — verify menu mirrors, focus indicator flips)
- [ ] All text driven by localization strings — no hardcoded display text in code or images

---

## 15. Open Questions

| Question | Owner | Deadline | Resolution |
|----------|-------|----------|-----------|
| Background asset: static still vs. low-cost ambient video loop | art-director | Pre-vertical-slice | Deferred — UX accepts either; functional spec is asset-agnostic |
| Final brand typography for HOSTILE WORLD logotype | art-director | Pre-vertical-slice | Deferred — placeholder until visual identity is approved |
| Confirm dialog destructive button color | art-director | Pre-vertical-slice | Deferred — must pass 4.5:1 contrast regardless of hue |
| Should Quit have its own confirmation dialog | ux-lead | Resolved this session | NO — Main Menu Quit has no active game state to protect. Confirmation would add friction with no safety benefit. |
| Where does focus go if Continue is selected, metadata IO fails, AND save file is also unreadable | save-load designer | Resolved this session | Save-load corruption is handled by the Loading state (GDD Rule 6: corruption fallback to new-game defaults with notification). Main Menu's job is only to fire `ContinueRequested`; corruption recovery is downstream. |
| First-boot tutorial: should the Main Menu have a "Press any key to start" splash before showing the menu | ux-lead | Resolved this session | NO — adds a redundant gate. The menu IS the entry point. Standard PC pattern. |
