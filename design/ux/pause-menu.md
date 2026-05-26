# UX Specification: Pause Menu

> **Status**: Draft
> **Author**: ux-lead
> **Last Updated**: 2026-05-26
> **Screen / Flow Name**: `PauseMenuScreen`
> **Platform Target**: PC (Steam / Epic)
> **Related GDDs**: `design/gdd/game-state-machine.md § Paused State`, `design/gdd/save-load-system.md § Rule 2 Auto-Save Only / § Rule 5 Load Sequence`
> **Related ADRs**: `ADR-0002: Game State Machine Implementation`, `ADR-0003: Enhanced Input Architecture (IMC_Menu)`
> **Related UX Specs**: `design/ux/main-menu.md`, `design/ux/save-load.md`, `design/ux/settings.md` (planned), `design/ux/map.md` (planned)
> **Accessibility Tier**: Standard (WCAG 2.1 AA + screen reader support + colorblind-safe + focus management)

> **Note — Scope boundary**: This is a hybrid screen — a menu overlay that renders OVER a frozen game world. Treated as a screen spec per the template guidance. The HUD beneath this overlay is owned by `hud-design.md`. The Paused GSM state pauses world time and freezes the HUD; the pause menu draws on top.

---

## 1. Purpose & Player Need

**What player need does this screen serve?**

The Pause Menu is the player's exhale. Hostile World is, by pillar, a tense survival experience — resources scarce, threats real, decisions weighty. Mid-session, the player needs a controlled moment to step away from the controller, adjust settings, check their map, or end the session knowing the world will be exactly as they left it. The pause menu must deliver that exhale without breaking the world fantasy: the mountain holds still, but it is still there, visible behind the menu. The player should feel the world waiting, not vanished.

Critically, the pause menu must also be the safe exit path. Save & Quit and Quit to Main Menu both trigger the clean-exit save (per save-load Rule 2) — this is the ONLY way the player can voluntarily save the game, even though they do not see it as "saving." The pause menu must make this safety legible without inflicting a manual-save UI on a game whose save model is intentionally automatic.

**The player goal**: Step out of moment-to-moment gameplay tension, do one of a small set of intentional things (resume, check map, change settings, end session), and return to the game in the exact state they left it — or end the session with confidence that no progress was lost.

**The game goal**: Hold the GSM in Paused state with world time frozen, expose Settings and Map UI without leaving the Paused state, and trigger the clean-exit save before the GSM transitions away from Paused on either Quit path.

---

## 2. Player Context on Arrival

| Question | Answer |
|----------|--------|
| What was the player just doing? | Active gameplay — most likely exploration, mid-traversal, or just-after-combat. Less commonly: paused during dialogue (Rule 6b prevents this for combat, but dialogue-then-pause is possible after dialogue ends). |
| What is their emotional state? | Variable, but typically mid-tension. Could be: catching a breath after a fight, debating their next move, or needing to step away (door, phone, child) |
| What cognitive load are they carrying? | Medium to high — they are still tracking the world state behind the menu (their position, their objective, their resources). Pause does NOT clear this load. |
| What information do they already have? | Full current run context. They remember where they are and what they were doing. |
| What are they most likely trying to do? | Resume play (most common, the menu is a transient stop). Less common: change a setting, open the map, end the session. |
| What are they likely afraid of? | (1) Accidentally exiting the game and losing progress (mitigated by clean-exit save). (2) Spending too long in menus and forgetting their immediate gameplay context. |

**Emotional design target for this screen**: A held breath. The world is suspended. The menu is a small, focused surface — five options, no decoration, no distraction. The player should feel they could return to the game in one input the moment they want to.

---

## 3. Navigation Position

**Screen hierarchy**:

```
Pause Menu Overlay (root of Paused state UI)
  ├── Map UI (in-state overlay — Map opens OVER pause menu within Paused state per GSM rules)
  ├── Settings Screen (child — push transition, slides over pause menu)
  ├── Save & Quit Confirmation Dialog (modal child, only if confirmation enabled)
  └── Quit to Main Menu Confirmation Dialog (modal child)
```

**Modal behavior**: Overlay (renders over game world, game paused — per template definitions). Specifically: a menu overlay on top of a frozen game world. The world behind is visible (60% darkened with blur pass) but non-interactive — input is captured by the pause menu via IMC_Menu (per ADR-0003).

Dismiss behavior: Esc or Start re-press dismisses the pause menu and returns to Playing (GSM pops Paused, transitions Playing in 0.2s short exhale). The overlay CAN be dismissed with one input — this is the primary safety affordance.

**Reachability — all entry points**:

| Entry Point | Triggered By | Notes |
|-------------|-------------|-------|
| ESC key (KB) / Start button (Gamepad) from Playing state | Player presses pause input | Primary entry — only way to reach this screen |
| Returned from Settings child screen | Player presses Back from Settings (when Settings was opened from Pause) | Settings screen owns the return-to-pause behavior |
| Returned from Map UI dismiss | Player closes the map within Paused state | Map is an in-state overlay; closing it returns control to pause menu |
| Cancelled from Quit confirmation dialog | Player cancels Save & Quit or Quit to Main Menu | Focus restored to the cancelled option |
| Pause request rejected by higher-priority state | Player presses ESC during Dialogue/Cutscene | Per GSM Edge Case: ESC in Cutscene is ignored or queued; in Dialogue, ESC returns to Playing first. Pause menu does NOT open from those states. |

The pause menu is NOT reachable from: Title, Loading, Cutscene, GameOver, or Inventory (Inventory has its own dismiss path back to Playing). Combat engagement also FORCES pause exit (GSM Rule 6b) — if combat engages while paused, the pause menu is immediately dismissed and the world resumes.

---

## 4. Entry & Exit Points

**Entry table**:

| Trigger | Source Screen / State | Transition Type | Data Passed In | Notes |
|---------|----------------------|-----------------|----------------|-------|
| Player presses ESC / Start | Playing state | GSM Playing → Paused (0.2s short exhale); pause overlay fades in over frozen world | None — pause menu is context-free at the player-data level | Default focus: Resume |
| Return from Settings | Settings Screen (entered from Pause) | Reverse slide 250ms; pause overlay re-receives input | None | Focus restored to Settings option |
| Return from Map UI | Map UI (in-Paused overlay) | Map UI dismisses, pause menu re-receives input | None | Focus restored to Map option |
| Cancel Save & Quit dialog | Save & Quit Confirmation Dialog | Dialog scales down 100ms, dim removes | None | Focus restored to Save & Quit option |
| Cancel Quit to Main Menu dialog | Quit to Main Menu Confirmation Dialog | Dialog scales down 100ms | None | Focus restored to Quit to Main Menu option |

**Exit table**:

| Exit Action | Destination | Transition Type | Data Returned / Saved | Notes |
|-------------|------------|-----------------|----------------------|-------|
| Player selects Resume (or presses ESC/Start) | Playing state | GSM Paused → Playing (0.2s short exhale); pause overlay fades out; world resumes | None | Fastest path — single-input dismiss matches the "exhale and go" emotional design target |
| Player selects Map | Map UI (in-Paused overlay) | Map UI slides in over pause menu (transition owned by Map UI spec) | None | GSM remains in Paused state — Map is in-state per GSM Paused rules. Pause menu remains beneath, regains focus when Map dismisses. |
| Player selects Settings | Settings Screen | Slide left 250ms | `{from: "PauseMenu"}` | Settings reads `from` to know where Back returns to |
| Player selects Save & Quit → confirms | OS exit | Save fires (blocking, per save-load AC8); 600ms save-and-fade transition; application terminates | Clean-exit save triggered before application terminates | Save-load Rule 2: clean game exit from Paused state triggers save. Save-load AC8: blocking write on clean exit. |
| Player selects Save & Quit → cancels | Same screen | Dialog dismisses | None | No save, no exit |
| Player selects Quit to Main Menu → confirms | Title state (Main Menu) | Save fires (blocking); GSM Paused → Loading (transient) → Title (1.5s deep inhale) | Clean-exit save triggered | Same save semantics as Save & Quit — both are clean exits from Paused state |
| Player selects Quit to Main Menu → cancels | Same screen | Dialog dismisses | None | No save, no exit |
| Combat engagement forces exit | Playing state | GSM forces Paused pop (0.1s fast transition, no animation) per GSM Rule 6b; pause overlay closes immediately | None — no save | This is a safety-critical override. The player did NOT choose to exit pause; the game forced it because combat engaged. No save fires (this is not a clean exit). |
| Cutscene trigger | Cutscene state | GSM exits Paused to enter Cutscene (rare — script-only) | None | Edge case — narrative event during pause |
| Player dies via deferred death event | GameOver state | Per GSM Edge Case: if PlayerDied fires while Paused, it's queued; on resume to Playing, death processes. Pause menu does NOT exit directly to GameOver. | None | This is handled by GSM, not the pause menu |

---

## 5. Layout Specification

### 5.1 Wireframe

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│  {frozen game world — 60% darkened, slight blur, NO HUD elements}    │
│                                                                      │
│                                                                      │
│       ─────────────────────────────────────                          │
│                                                                      │
│       ●  RESUME                                                      │  ← MENU LIST ZONE
│                                                                      │     (left-of-center,
│          MAP                                                         │      vertical, ~25% from left)
│                                                                      │
│          SETTINGS                                                    │
│                                                                      │
│          SAVE & QUIT                                                 │
│                                                                      │
│          QUIT TO MAIN MENU                                           │
│                                                                      │
│       ─────────────────────────────────────                          │
│                                                                      │
│                                                                      │
│                                                                      │
│  [Esc/Start: Resume]                          PAUSED                 │  ← FOOTER ZONE
└──────────────────────────────────────────────────────────────────────┘

State variant — Save & Quit confirmation:
┌──────────────────────────────────────────────────────────────────────┐
│  {pause menu beneath, further dimmed to 80%}                         │
│                                                                      │
│       ┌─────────────────────────────────────────┐                    │
│       │  SAVE & QUIT                            │                    │
│       │                                         │                    │
│       │  Your progress will be saved and the    │                    │
│       │  game will close.                       │                    │
│       │                                         │                    │
│       │  [● Save and Quit]    [Cancel]          │                    │
│       └─────────────────────────────────────────┘                    │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘

State variant — Quit to Main Menu confirmation (same layout, different copy):
       │  QUIT TO MAIN MENU                      │
       │                                         │
       │  Your progress will be saved and you    │
       │  will return to the main menu.          │
       │                                         │
       │  [● Save and Return]   [Cancel]         │
```

### 5.2 Zone Definitions

| Zone Name | Description | Approximate Size | Scrollable? | Overflow Behavior |
|-----------|-------------|-----------------|-------------|-------------------|
| Backdrop Zone | Frozen game world rendered beneath, 60% darkened, blurred (Gaussian or box, low-cost) | 100% width, 100% height | N/A | World render continues from frozen frame; cropped at extreme aspect ratios same as gameplay |
| Menu List Zone | Vertical list of 5 menu items, left-of-center, framed by top and bottom horizontal divider rules | ~30% width, ~50% height | No | Fixed item count (5); no overflow possible |
| Footer Zone | Bottom strip: input hint (left), PAUSED label (right) | Full width, ~5% height | No | Both labels are short; no truncation expected |
| Confirmation Dialog Zone | Centered modal panel, overlays menu (only in confirmation states) | ~40% width, ~25% height (auto-sized to content) | No | Dialog grows vertically if localized text wraps; never horizontally |

The menu list is intentionally left-of-center (not dead-center) for two reasons: (1) it matches Witcher 3 / Dying Light pause-menu conventions, which players in the target audience recognize; (2) it leaves the right two-thirds of the frozen world visible, reinforcing the "world holds still" GSM fantasy. Dead-center menu would obscure too much world.

### 5.3 Component Inventory

| Component Name | Type | Zone | Purpose | Required? | Reuses Existing Component? |
|----------------|------|------|---------|-----------|---------------------------|
| BackdropBlur | Visual effect (full-screen blur + dim) | Backdrop | Render the frozen world behind, darkened and softly blurred | Yes | No — bespoke shader pass; reused with main-menu background dim |
| MenuItemButton | Button (vertical list item) | Menu List | One selectable menu row | Yes | Yes — same component as Main Menu (`MenuItemButton`) |
| FocusIndicator | Visual marker | Menu List | Show focused item | Yes | Yes — shared FocusIndicator component |
| MenuDivider | Horizontal rule | Menu List (top + bottom) | Visually bracket the menu items, mark them as a discrete surface | Yes | No — simple decorative element, new component |
| InputHintLabel | Text + glyph | Footer | Display "[Esc/Start: Resume]" platform-aware hint | Yes | Yes — shared InputHint component (HUD also uses it) |
| PausedLabel | Text | Footer | Display "PAUSED" affordance — confirms state to player | Yes | Yes — shared StateLabel pattern |
| ConfirmDialog | Modal dialog | (Overlays menu) | Confirm Save & Quit and Quit to Main Menu | Yes | Yes — same ConfirmDialog component pattern from main-menu New Game confirm |

**Primary focus element on open**: **Resume** (first item). Always — there is no variant.

---

## 6. States & Variants

| State Name | Trigger | What Changes Visually | What Changes Behaviorally | Notes |
|------------|---------|----------------------|--------------------------|-------|
| Opening | GSM transitioning Playing → Paused | World freezes; blur and dim ramp 0→60% over 200ms; menu items fade in (no stagger — pause needs to feel responsive); FocusIndicator settles on Resume | Input transitions from IMC_Combat/IMC_Exploration to IMC_Menu during the 0.2s GSM short exhale | Should feel snappy — pause is reactive |
| Open (default) | Opening complete | Stable display: menu list visible, Resume focused, footer hint shown | All 5 menu items active; Esc/Start dismisses immediately back to Playing | Most common state |
| Save & Quit Confirmation pending | Player activates Save & Quit | Modal dialog appears; menu beneath dims further to 80%; menu becomes non-interactive | Only Confirm and Cancel inputs active | Confirmation copy: "Your progress will be saved and the game will close." Primary button: "Save and Quit" (default focus on this — non-destructive intent). Secondary: "Cancel". |
| Quit to Main Menu Confirmation pending | Player activates Quit to Main Menu | Modal dialog appears (same pattern); menu dims to 80% | Only Confirm and Cancel active | Copy: "Your progress will be saved and you will return to the main menu." Primary: "Save and Return". Secondary: "Cancel". |
| Saving on exit | Confirmation: Confirm pressed | Dialog dismisses; brief "Saving..." indicator appears (centered, replaces dialog); menu remains dimmed | All input disabled while save is in flight (typically <500ms) | Save is blocking on clean exit (save-load AC8). Player must wait for write to complete. Indicator prevents the feeling of frozen UI. |
| Storage full on exit save | Save fails due to storage full | "Saving..." indicator replaced by "Could not save — storage full." notification; menu re-enables; player returned to pause menu | Player can retry by selecting Save & Quit again, or select Resume to continue playing | Per save-load EC6 — game continues, previous save preserved |
| Map open over pause | Player activated Map | Map UI fills screen over pause menu; pause menu still beneath but not visible | Map UI captures all input until dismissed | Map UI owns this state; pause menu just relinquishes focus |
| Combat-forced exit | GSM Rule 6b: combat engagement | Pause overlay snaps off in 100ms (no transition); world resumes; HUD reappears | Input switches to IMC_Combat | This is a SAFETY override — no animation, no save, no confirmation. The player loses the pause and re-enters combat. |
| Settings open over pause | Player activated Settings | Settings screen slides over pause menu | Settings captures input | Settings owns this state; pause menu beneath is preserved |

---

## 7. Interaction Map

### 7.1 Navigation Inputs

| Input | Platform | Action | Visual Response | Audio Cue | Notes |
|-------|----------|--------|-----------------|-----------|-------|
| Down Arrow / D-Pad Down / Left Stick Down | All | Move focus to next menu item | Focus indicator slides down; previous item dims | Soft navigation tick | Wraps at bottom |
| Up Arrow / D-Pad Up / Left Stick Up | All | Move focus to previous menu item | Focus indicator slides up | Soft navigation tick | Wraps at top |
| Mouse hover over menu item | PC | Hover preview only — brightens label 20% | Item label brightens; FocusIndicator does NOT move | None | Same convention as Main Menu — prevents cursor parking from drifting focus |
| Mouse click on menu item | PC | Move focus AND activate in one gesture | Press flash 60ms then activate | Soft click + activation tone | One-step click-to-confirm |
| Tab | KB | No effect | None | None | Only one zone — Tab is reserved as no-op |

### 7.2 Action Inputs

| Input | Platform | Context (What must be focused) | Action | Response | Animation | Audio Cue | Notes |
|-------|----------|-------------------------------|--------|----------|-----------|-----------|-------|
| Enter / A button / Left click | All | Resume focused | Dismiss pause; return to Playing | Pause overlay fades out (200ms); GSM Paused → Playing (0.2s short exhale); world resumes | Fade + exhale, 200ms | Resume tone (soft exhale) | Equivalent to pressing Esc/Start — same as the direct dismiss |
| Enter / A button / Left click | All | Map focused | Open Map UI over pause menu | Map UI slide-in transition (owned by Map UI spec) | Per Map UI spec | Map open tone | GSM stays in Paused state |
| Enter / A button / Left click | All | Settings focused | Navigate to Settings screen | Slide left 250ms ease-out cubic | Slide, 250ms | Navigate tone | Fires `NavigateToSettingsRequested {from: "PauseMenu"}` |
| Enter / A button / Left click | All | Save & Quit focused | Open Save & Quit Confirmation Dialog | Dialog scale-up 150ms; menu dims to 80% | Scale-up, 150ms | Modal open tone | Does NOT immediately save — waits for confirm |
| Enter / A button / Left click | All | Quit to Main Menu focused | Open Quit to Main Menu Confirmation Dialog | Same as Save & Quit | Same | Same | Same — waits for confirm |
| Esc / B button / Start button | All | Any (screen level) | Dismiss pause menu — return to Playing | Same as Resume activation | Same | Same | This is the primary dismiss path — single input back to gameplay. Start button is the symmetric pause-toggle. |
| Esc / B button | All | Confirmation Dialog open | Cancel the dialog | Dialog scales down 100ms; dim removes; menu re-receives input | Scale-down, 100ms | Cancel tone | Focus restored to the originating menu item |
| Enter / A button / Left click | All | Confirmation Dialog: "Save and Quit" focused | Begin save-and-exit-to-OS flow | Dialog dismisses; "Saving..." indicator appears; on save complete: 400ms fade to black, application terminates | Save indicator → fade, ~600ms total + save IO time | Confirm tone + save complete tone + quit tone | Fires `SaveAndQuitToOSRequested` |
| Enter / A button / Left click | All | Confirmation Dialog: "Save and Return" focused | Begin save-and-return-to-Title flow | Dialog dismisses; "Saving..." indicator; on save complete: GSM Paused → Loading → Title (1.5s deep inhale) | Save indicator → deep inhale, ~1.5s + save IO | Confirm tone + save complete tone + deep inhale | Fires `SaveAndReturnToTitleRequested` |
| Enter / A button / Left click | All | Confirmation Dialog: "Cancel" focused | Dismiss dialog | Same as Esc/B in dialog | Same | Cancel tone | Focus restored |
| F / Y button | All | Any | Reserved no-op | None | None | None | Documented to prevent ad-hoc remapping; reserved for future quick-action |

### 7.3 State-Specific Behaviors

| State | Input Restriction | Reason |
|-------|------------------|--------|
| Opening | All input ignored during 0.2s GSM transition | Transition is in flight; GSM requires uninterrupted exit/entry per Rule 4 |
| Confirmation Dialog open | Only Confirm and Cancel active; menu beneath frozen | Modal — destructive intent must be explicit |
| Saving on exit | All input disabled | Save write is in progress; player must wait for blocking write |
| Storage full notification | Notification dismisses on any input; menu re-enables | Allow player to retry or resume |
| Combat-forced exit (Rule 6b) | All pause menu input is irrelevant — overlay is already gone | Safety override; pause menu is no longer the active surface |

---

## 8. Data Requirements

| Data Element | Source System | Update Frequency | Who Owns It | Format | Null / Missing Handling |
|--------------|--------------|-----------------|-------------|--------|------------------------|
| Frozen world render | Render System (frame buffer at pause moment) | Captured on Paused entry | Render System | Texture / scene capture | Never null — if capture fails, fall back to solid dark backdrop (Backdrop Zone shows void color) |
| Player input device | Enhanced Input System | Continuous (active device detection) | Enhanced Input System | Enum (KeyboardMouse / Gamepad) | Defaults to last-active device; affects which glyphs appear in InputHintLabel ("Esc" vs "Start" icon) |
| Save indicator state | Save/Load System | On save start, on save complete, on save fail | Save/Load System | Enum (Idle / Saving / Complete / Failed) | UI subscribes to OnSaveStart, OnSaveComplete, OnSaveFailed delegates |
| Current GSM state | Game State Machine | On state change | Game State Machine | Enum | UI subscribes to OnStateEntered/OnStateExited — used to detect combat-forced exit (GSM exits Paused → Playing without UI action) |

> **Rule**: This screen reads frozen world render and input device only. It does NOT read player position, inventory, health, or any gameplay state — that is HUD territory. The pause menu is intentionally context-free.

---

## 9. Events Fired

| Player Action | Event Fired | Payload | Receiver System | Notes |
|---------------|-------------|---------|-----------------|-------|
| Player selects Resume (or presses Esc/Start) | `ResumeRequested` | `{}` | Game State Machine | GSM transitions Paused → Playing |
| Player selects Map | `OpenMapRequested` | `{from: "PauseMenu"}` | Map System | Map System owns the map UI; GSM stays in Paused |
| Player selects Settings | `NavigateToSettingsRequested` | `{from: "PauseMenu"}` | UI Navigation | Settings reads `from` to know return target |
| Player confirms Save & Quit | `SaveAndQuitToOSRequested` | `{}` | Save/Load System (save), then Game Instance (quit) | Save fires first; Quit fires on `OnSaveComplete` (or on `OnSaveFailed` if storage full retry was declined) |
| Player confirms Quit to Main Menu | `SaveAndReturnToTitleRequested` | `{}` | Save/Load System (save), then GSM (transition to Title) | Same sequencing — save then transition |
| Player cancels a confirmation dialog | `PauseConfirmCancelled` | `{action: "save_and_quit" \| "quit_to_main"}` | Analytics System | Analytics-only |
| Pause menu opens | `PauseMenuOpened` | `{trigger: "esc" \| "start"}` | Analytics System | Analytics-only — track which input opened pause |
| Pause menu closes (any exit) | `PauseMenuClosed` | `{exit_action: "resume" \| "map" \| "settings" \| "save_and_quit" \| "quit_to_main" \| "combat_forced", duration_ms: int}` | Analytics System | Analytics — `combat_forced` is critical for tuning Rule 6b frequency |
| Combat-forced exit detected | `PauseInterruptedByCombat` | `{paused_duration_ms: int}` | Analytics System | Telemetry only — measures how often the safety override fires; high frequency would suggest tuning |

---

## 10. Transition & Animation

| Transition | Trigger | Direction / Type | Duration (ms) | Easing | Interruptible? | Skipped by Reduced Motion? |
|------------|---------|-----------------|--------------|--------|----------------|---------------------------|
| Pause overlay enter | GSM Playing → Paused | World freezes (instant); backdrop dim and blur ramp 0→60%; menu items fade in (no stagger) | 200 (matches GSM 0.2s short exhale) | Ease-out quad | No — must complete before input enabled | Yes — instant appear, no blur ramp |
| Pause overlay exit (Resume) | Resume / Esc / Start | Reverse: menu fades out; backdrop blur and dim ramp 60→0%; world resumes | 200 | Ease-in quad | No | Yes — instant disappear |
| Menu item focus change | Player navigates | Focus indicator slides to new item | 100 | Ease-out quad | Yes — quick re-press cancels | Yes — instant indicator jump |
| Mouse hover preview | Cursor enters item | Label brightens 100→120% | 80 | Linear | Yes | Yes — instant |
| Menu item press | Player activates | Item scales 100→96% on press, 96→100% on release | 60 down / 60 up | Ease-out / ease-in | Yes — release early returns to 100% | No — tactile feedback |
| Confirmation Dialog open | Save & Quit or Quit to Main Menu selected | Background menu dims further 60→80%; dialog scales 95→100% with fade | 150 | Ease-out cubic | No | Yes — instant appear |
| Confirmation Dialog close (cancel) | Esc / Cancel | Dialog scales 100→95% with fade; menu dim returns to 60% | 100 | Ease-in cubic | No | Yes — instant disappear |
| Save indicator appears | Confirm pressed; save begins | "Saving..." text/glyph centered, replaces dialog area | 0 (instant) — save IO is the real wait | N/A | No | N/A |
| Save complete fade-to-quit | OnSaveComplete after Save & Quit | Fade to black; audio fades | 400 | Linear | No | Yes — instant black |
| Save complete return-to-title | OnSaveComplete after Quit to Main Menu | GSM Paused → Loading → Title (deep inhale) | 1500 (GSM-owned) | GSM-owned | No | Yes — GSM transition still runs (state change must complete) but visual inhale is skipped |
| Storage full notification | Save fails | Notification fades in over save indicator area | 200 | Ease-out | No | Yes — instant appear |
| Combat-forced exit | GSM Rule 6b | Overlay snaps off (no fade); world unfreezes instantly | 0–100 (GSM "fast transition" per Rule 6b) | N/A | No — safety override | N/A — already instant |

---

## 11. Input Method Completeness Checklist

**Keyboard**
- [x] All interactive elements reachable using arrow keys alone — single vertical zone
- [x] Tab order follows visual reading order — single zone, top-to-bottom
- [x] Every action achievable by mouse is also achievable by keyboard
- [x] Focus is visible at all times — FocusIndicator always anchored
- [x] Focus does not escape the screen while open — wraps top/bottom
- [x] Esc closes pause and returns to Playing — does NOT quit game

**Gamepad**
- [x] All interactive elements reachable with D-Pad and left stick
- [x] Face button mapping documented — A confirms, B cancels (cancel = dismiss pause; also cancels dialogs)
- [x] No action requires analog stick precision
- [x] Trigger and bumper shortcuts documented if used — not used on this screen
- [x] Controller disconnection while screen is open is handled gracefully — keyboard remains active; game does NOT auto-pause again on disconnect (already paused); reconnection restores gamepad input

**Mouse**
- [x] Hover states defined — hover brightens label, does not move focus
- [x] Clickable hit targets are at minimum 32×32px — menu items target 48px height × menu list width
- [x] Right-click behavior defined — no-op on this screen
- [x] Scroll wheel behavior defined in all scrollable zones — no scrollable zones

**Touch (if applicable)**
- N/A — PC only

---

## 12. Screen-Level Accessibility Requirements

**Text contrast requirements for this screen**:

| Text Element | Background Context | Required Ratio | Current Ratio | Pass? |
|--------------|-------------------|---------------|---------------|-------|
| Menu item label — focused | Blurred/darkened world (60% darkened) | 4.5:1 (WCAG AA) | TBD | [ ] |
| Menu item label — unfocused | Same | 4.5:1 | TBD | [ ] |
| "PAUSED" footer label | Same | 4.5:1 | TBD | [ ] |
| Input hint glyph + text | Same | 4.5:1 + glyph must be recognizable | TBD | [ ] |
| Confirm dialog body text | Dialog panel background | 4.5:1 | TBD | [ ] |
| Confirm dialog primary button label | Primary button background | 4.5:1 | TBD | [ ] |
| Confirm dialog cancel button label | Secondary button background | 4.5:1 | TBD | [ ] |
| "Saving..." indicator | Dialog area (dimmed) | 4.5:1 | TBD | [ ] |

The darkened/blurred world backdrop creates a contrast risk because the underlying scene is variable (bright daytime vs. dark cave). Mitigation: the 60% dim layer must be opaque enough to guarantee 4.5:1 against the brightest plausible scene. Implementation must verify against worst-case bright snowy mountain scene.

**Colorblind-unsafe elements and mitigations**:

| Element | Colorblind Risk | Mitigation |
|---------|----------------|------------|
| Focus indicator | Color-only focus is a common failure | Shape (filled dot or chevron) + position shift, not color alone |
| Dialog primary button (likely an accent color) | Multiple types | Button has explicit label text — color is supplemental. No icon-only buttons. |

**Focus order** (Tab key sequence, numbered):

In pause menu (default state):
1. Resume
2. Map
3. Settings
4. Save & Quit
5. Quit to Main Menu
→ Wraps to Resume

In confirmation dialog (open state):
1. Save and Quit / Save and Return (primary — default focus, since it is the non-destructive intent expressed by the player)
2. Cancel
→ Wraps to primary

> Design note: Default focus on the primary button (NOT Cancel) is the inverse of the Main Menu New Game confirmation. Rationale: the Main Menu New Game confirmation is destructive (deletes save). The Pause Menu Save & Quit confirmation is non-destructive (saves and quits). The player who just selected Save & Quit clearly intends to quit; defaulting to Cancel would feel like an obstacle. This matches Witcher 3 and Dying Light's pause-menu confirm-on-primary pattern.

Focus does not enter the backdrop (frozen world) or footer (informational).

**Screen reader announcements for key state changes**:

| State Change | Announcement Text | Announcement Timing |
|--------------|------------------|---------------------|
| Pause menu opens | "Paused. Pause menu. Resume selected." | On overlay focus settle (~200ms after open) |
| Focus moves to a menu item | "[Item label] selected. [Position] of [total]." (e.g., "Settings selected. 3 of 5.") | On focus arrival |
| Save & Quit confirmation opens | "Save and Quit confirmation. Your progress will be saved and the game will close. Save and Quit selected." | On dialog focus settle |
| Quit to Main Menu confirmation opens | "Quit to Main Menu confirmation. Your progress will be saved and you will return to the main menu. Save and Return selected." | On dialog focus settle |
| Confirm dialog: focus moves to Cancel | "Cancel." | On focus arrival |
| Saving starts | "Saving." | On save start |
| Saving complete (before quit) | "Saved." | On OnSaveComplete |
| Saving failed | "Save failed. Storage full. Pause menu re-opened." | On OnSaveFailed |
| Combat-forced exit | "Combat. Resuming." | On forced exit (urgent priority — interrupts any in-progress announcement) |
| Resume activated | "Resuming." | On resume input |

**Cognitive load assessment**:

The pause menu presents 5 menu items in a single vertical list plus the input hint and PAUSED label. The player is tracking exactly one stream: which item is focused. Frozen world behind is passive backdrop — the player is not actively tracking it during menu use, but its presence anchors them in the gameplay context for the moment they return.

The Confirmation dialog elevates load briefly with the consequence statement, but the consequence here is non-destructive (saves before quitting) so the cognitive demand is lower than the Main Menu's destructive confirmation.

Load is well within the 7±2 limit. The screen is deliberately spartan.

---

## 13. Localization Considerations

**General rules for this screen**:
- All text elements must tolerate a minimum of 40% expansion from English baseline
- RTL: menu list mirrors to right; FocusIndicator flips; PAUSED label moves to left footer; input hint moves to right
- CJK: shorter labels are fine; min-height per menu item prevents vertical collapse
- Input hint must use platform-aware glyphs (Esc key glyph or Start button glyph) which DO NOT change across locales — only the surrounding text translates

| Text Element | English Baseline Length | Max Characters | Expansion Budget | RTL Behavior | Overflow Behavior | Risk |
|--------------|------------------------|----------------|-----------------|--------------|-------------------|------|
| "RESUME" | 6 chars | 20 chars | 233% | Mirror | Truncate ellipsis | Low |
| "MAP" | 3 chars | 20 chars | 567% | Mirror | Truncate ellipsis | Low |
| "SETTINGS" | 8 chars | 20 chars | 150% | Mirror | Truncate ellipsis | Low |
| "SAVE & QUIT" | 11 chars | 24 chars | 118% | Mirror; "&" becomes "ו" or "و" or language-appropriate conjunction | Truncate ellipsis | Medium — "Speichern und Beenden" (German, 22) is at the edge |
| "QUIT TO MAIN MENU" | 17 chars | 32 chars | 88% | Mirror | Shrink font 90% then truncate | Medium — long labels in German/Russian |
| "PAUSED" footer label | 6 chars | 20 chars | 233% | Mirror; moves to left footer in RTL | Truncate | Low |
| Input hint "Esc/Start: Resume" | 18 chars | 32 chars | 78% | Mirror; glyph stays glyph (no translation) | Truncate "Resume" first | Low — hint is dismissible content |
| Confirm dialog body (Save & Quit) "Your progress will be saved and the game will close." | 53 chars | 140 chars | 164% | Mirror | Wrap to 2-3 lines; dialog grows vertically | Low |
| Confirm dialog body (Quit to Main Menu) "Your progress will be saved and you will return to the main menu." | 64 chars | 140 chars | 119% | Mirror | Wrap to 2-3 lines | Low |
| "Save and Quit" button | 13 chars | 32 chars | 146% | Mirror | Shrink font 90% then wrap | Medium |
| "Save and Return" button | 15 chars | 32 chars | 113% | Mirror | Shrink font 90% then wrap | Medium |
| "Cancel" button | 6 chars | 20 chars | 233% | Mirror | Truncate | Low |
| "Saving..." indicator | 9 chars | 24 chars | 167% | Mirror | Truncate | Low |
| "Could not save — storage full." notification | 30 chars | 80 chars | 167% | Mirror | Wrap to 2 lines | Low — pre-existing save-load HUD notification |

---

## 14. Acceptance Criteria

**Performance**
- [ ] Pause overlay first frame visible within 100ms of pause input (excludes GSM 0.2s short exhale which is intentional)
- [ ] Pause overlay reaches full opacity within 200ms (matches GSM short exhale)
- [ ] Resume / Esc dismiss returns to Playing within 200ms of input
- [ ] Navigation between menu items has no perceptible frame drop
- [ ] Backdrop blur shader cost does not exceed 1.5ms on minimum-spec GPU at 1080p

**Layout & Rendering**
- [ ] Pause menu displays correctly at 1280×720, 1920×1080, 2560×1440, 3840×2160
- [ ] Pause menu displays correctly at 16:9, 16:10, 21:9 aspect ratios
- [ ] No text overflow or truncation in English
- [ ] No text overflow or truncation in German
- [ ] All states render correctly: Opening, Open, Save & Quit Confirmation, Quit to Main Menu Confirmation, Saving on exit, Storage full notification, Map open, Settings open, Combat-forced exit
- [ ] Backdrop dim layer ensures 4.5:1 contrast against the brightest plausible game scene
- [ ] Pause menu does not block view of HUD elements that need to remain visible — verify HUD is hidden or fully obscured by backdrop (no half-hidden HUD bleed-through)

**Input**
- [ ] All menu items reachable by keyboard arrow keys only
- [ ] All menu items reachable by gamepad D-Pad and face buttons
- [ ] All menu items reachable by mouse
- [ ] Esc / Start dismiss returns to Playing in one input
- [ ] Mouse hover does not move focus
- [ ] Focus visible at all times on keyboard and gamepad
- [ ] Focus wraps top/bottom; does not escape screen
- [ ] Combat-forced exit (GSM Rule 6b) interrupts pause menu without crashing or leaving orphaned UI

**Events & Data**
- [ ] All events in Section 9 fire with correct payloads on all exit paths
- [ ] Screen does not write directly to any system except firing save and GSM transition events
- [ ] Save fires BEFORE GSM transitions on both Quit paths (verify ordering with logging)
- [ ] Save & Quit waits for OnSaveComplete before quitting application (blocking write per save-load AC8)
- [ ] Quit to Main Menu waits for OnSaveComplete before GSM transition to Loading
- [ ] Storage full notification appears on save failure and pause menu re-receives input
- [ ] Combat-forced exit fires `PauseInterruptedByCombat` analytics event

**Accessibility**
- [ ] All text passes 4.5:1 contrast ratio against worst-case backdrop scene
- [ ] Focus indicator works without color (shape + position)
- [ ] Screen reader announces pause open, focus changes, dialog content, save status per Section 12
- [ ] Combat-forced exit announces "Combat. Resuming." with high priority
- [ ] Reduced motion: pause overlay appears/disappears instantly; no blur ramp; no scale animations on dialog
- [ ] High contrast mode renders without breakage

**Localization**
- [ ] No text element overflows in English, German, French, Spanish, Japanese, simplified Chinese
- [ ] RTL layout renders correctly for Arabic (if shipping Arabic)
- [ ] All text from localization strings; input glyphs are not localized text

---

## 15. Open Questions

| Question | Owner | Deadline | Resolution |
|----------|-------|----------|-----------|
| Should Save & Quit confirmation default to Confirm (non-destructive intent) or Cancel (conservative) | ux-lead | Resolved this session | Confirm (Save and Quit) — the player just selected Save & Quit, defaulting to Cancel would feel obstructive. Save is non-destructive. Matches genre convention. |
| Should the pause menu hide all HUD elements behind it, or let some remain visible (e.g., infection meter) | ux-lead | Resolved this session | HIDE all HUD elements. The 60% dim layer covers them anyway; explicit HUD hide guarantees no bleed-through and reinforces the "world held still" fantasy. HUD ownership stays in `hud-design.md`; pause menu requests HUD hide on Paused entry. |
| Should the backdrop blur be animated (blur ramping in) or static (instant blur) | ux-lead | Resolved this session | Ramped — 200ms blur ramp matches the 0.2s GSM short exhale. Static blur would feel abrupt against the breath fantasy. Reduced motion setting skips the ramp. |
| Does the Map open in-state (over pause) or replace the pause menu | systems-designer | Resolved per GSM | In-state overlay. GSM Paused State explicitly states "Map System opens as a UI overlay within this state (no separate Map state)." |
| What happens if storage is full when Save & Quit is confirmed | ux-lead | Resolved this session | Save fails per save-load EC6; "Could not save — storage full." notification appears; pause menu re-receives input; player can retry Save & Quit (perhaps after clearing storage) or select Resume to keep playing. Quit does NOT proceed when save fails — exiting without a save would violate the player's expressed intent to save. |
| Should "Quit to Desktop" be the label instead of "Save & Quit" | ux-lead | Resolved this session | "Save & Quit" — the action is BOTH save and quit; the label should reflect both for clarity. "Quit to Desktop" obscures the save behavior. Comparable titles vary; we prioritize clarity over brevity. |
| Should there be a "Restart from Last Checkpoint" option (re-load) | systems-designer | Resolved per GDD | NO. Save-load GDD UI Requirements: "No in-game load option — the player cannot manually trigger a load while alive." Single-slot, no-reload is intentional design. |
