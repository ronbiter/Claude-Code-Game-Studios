# UX Specification: Inventory Screen

> **Status**: Draft
> **Author**: ux-lead
> **Last Updated**: 2026-05-26
> **Screen / Flow Name**: `InventoryScreen`
> **Platform Target**: PC (Keyboard/Mouse primary, Gamepad supported)
> **Related GDDs**: `design/gdd/inventory-system.md`, `design/gdd/crafting-system.md`, `design/gdd/game-state-machine.md`, `design/gdd/input-system.md`, `design/gdd/hud-system.md`
> **Related ADRs**: ADR-0001 (Cross-System Communication), ADR-0002 (Game State Machine), ADR-0003 (Enhanced Input), ADR-0016 (HUD System Architecture)
> **Related UX Specs**: `design/ux/hud-design.md` (sibling — quick slot HUD overlay during gameplay)
> **Accessibility Tier**: Standard (WCAG 2.1 AA + screen reader hooks + colorblind-safe + focus management)

> **Note — Scope boundary**: This is a full-screen overlay opened during the `Inventory` GSM state. The game world remains visible behind a partial dim, slowed to 0.85x timescale per GSM GDD. Movement remains possible but dampened to 20%. This is an Overlay-live screen — gameplay is not fully paused. The HUD quick-slot bar is handled by `hud-design.md`; this spec does NOT cover gameplay HUD elements.

---

## 1. Purpose & Player Need

**What player need does this screen serve?**

The inventory screen lets the player make the hard trade-offs that define Hostile World's survival tension. Every time the player opens it, they are confronting scarcity: not enough slots, not enough weight, never enough medkits, always one ammo stack short. The screen must let the player understand exactly what they're carrying, exactly what each item costs (in slots and kilograms), and exactly what is at stake when they drop, equip, or use something — so they can make those decisions confidently under the pressure of a partially-paused, still-hostile world. The inventory is the player's planning instrument between moments of action; it is where survival is decided, not where it is performed.

**The player goal**: Locate, evaluate, and act on an item (equip, use, drop, or move) within 5 seconds of opening the screen, without leaving the screen.

**The game goal**: Capture player intent (equip, drop, use, reorganize, assign to quick slot, deploy cure, craft if at Workbench), validate it against capacity rules (slots, weight, weapon slot occupancy), and dispatch the corresponding events to the Inventory, Combat, Health, Infection Spread, and Crafting subsystems — all before the screen exits or the game enters a forced Combat-Interrupt.

---

## 2. Player Context on Arrival

| Question | Answer |
|----------|--------|
| What was the player just doing? | Exploring a hostile zone, just picked up an item, or pre-planning before entering a high-risk area. Always arrives from `Playing` GSM state via IA_Inventory. |
| What is their emotional state? | Variable: calm planning (low tension) to high-stress mid-zone triage (high tension). The world is slowed but NOT paused — patrols still exist. |
| What cognitive load are they carrying? | Medium-to-high. Tracking carry weight, slot pressure, infection state, route ahead. Often arrives wanting to compare a new pickup against current gear. |
| What information do they already have? | They know their current weapons (visible in HUD), rough HP/infection state, and recently picked-up items (recent pickup toast). They do NOT necessarily remember exact stack counts or ammo reserves. |
| What are they most likely trying to do? | (a) Equip or compare a new item; (b) Use a healing consumable; (c) Drop something to free space/weight; (d) Assign a consumable to a quick slot; (e) At a Workbench: craft. |
| What are they likely afraid of? | Being interrupted by combat mid-decision (and losing browsing progress per GDD); accidentally dropping a critical item; missing a better item already in their pack; running out of healing in the next encounter. |

**Emotional design target**: Focused and decisive. The screen must feel like a survival tool — purposeful, slightly austere, never leisurely. The persistent partial visibility of the slowed world behind the panel reinforces that the player is still vulnerable.

---

## 3. Navigation Position

```
Gameplay (GSM: Playing)
  └── Inventory (GSM: Inventory, priority 35, this screen)
        ├── Drop Confirmation Dialog (modal child)
        ├── Replace Weapon Confirmation Dialog (modal child)
        ├── Stack Split Spinner (modal child)
        └── Crafting Panel (sibling overlay — only at Workbench)
```

**Modal behavior**: Overlay-live — renders over slowed game world, gameplay continues at 0.85x timescale with 20% movement dampening per Inventory System GDD. Inventory is forcibly dismissed by GSM Rule 6b if combat engagement fires (see Section 4 Exit Table).

**Dismiss behavior**: Esc or IA_Inventory (I key default) closes the screen. Combat engagement force-closes. There is no "discard changes" — every action (move, equip, drop) commits immediately to the Inventory subsystem; closing the screen never rolls back state.

**Reachability — all entry points**:

| Entry Point | Triggered By | Notes |
|-------------|-------------|-------|
| Player presses IA_Inventory (I / Start) | From `Playing` GSM state | Primary entry. GSM transitions to `Inventory` state, 0.3s UI slide, world slows to 0.85x. |
| Item Pickup deep-link | Player picks up item while inventory is closed AND inventory was previously requested to auto-open (Post-MVP — disabled at MVP scope) | Not active at MVP. Documented for forward-compatibility. |
| Newly acquired highlight | Inventory was previously open and item was added via first-fit (per Inventory GDD Edge Case "Item picked up while inventory is open") | The new item receives a "New" badge until player navigates off it once. |

---

## 4. Entry & Exit Points

**Entry table**:

| Trigger | Source Screen / State | Transition Type | Data Passed In | Notes |
|---------|----------------------|-----------------|----------------|-------|
| Player presses IA_Inventory (I / Start) | GSM `Playing` | Overlay push — slide-in from left, 300ms | Current grid items, weapon slot contents, ammo counts, current weight, quick slot bindings, Workbench proximity flag | Standard entry. World slows to 0.85x, IMC_Inventory pushed (priority +2). |
| Inventory pickup while open | Same screen (refresh, not a new entry) | In-place state update — new item flash on grid cell | New item ID, placement coordinates from first-fit | Per Inventory GDD: grid UI updates immediately. Item gets "New" badge. |

**Exit table**:

| Exit Action | Destination | Transition Type | Data Returned / Saved | Notes |
|-------------|------------|-----------------|----------------------|-------|
| Player presses Esc / IA_Inventory / B button | GSM `Playing` | Overlay pop — slide-out to left, 200ms | All pending state changes already committed (every action is immediate) | Standard close. World timescale returns to 1.0x, IMC_Inventory popped. Fires `InventoryScreenClosed` event. |
| Combat engagement detected (enemy enters engagement range) | GSM `Playing` (forced) → IMC_Combat pushed | Hard cut — no slide-out animation (0.1s fast transition per GSM GDD) | All committed changes persist. Any open child dialog (Drop confirm, etc.) is dismissed without action. | Per Inventory GDD Edge Case + GSM Rule 6b. Audio sting plays. Player loses browsing progress (cursor position, selected item) but NOT data. |
| Player selects an item action (Equip, Use, Drop, Assign QS, Move) | Same screen (state refresh) | In-place — grid/detail panel updates | Action committed via subsystem event (see Section 9) | No navigation. Screen remains open. |
| Player opens Craft tab (Workbench only) | Same screen, Craft panel slides in over detail panel | In-place — 200ms slide from right | Workbench ID, unlocked recipe set | Inventory grid and weapon slots remain visible. See Crafting GDD UI Requirements. |
| Player closes Craft tab | Same screen, detail panel restored | In-place — 200ms slide-out | None | Returns to inventory-only view. |
| Game crash / unexpected GSM transition (e.g., dialogue forced open by quest) | Per GSM priority rules | Hard close | Committed changes persist via Save/Load atomic write | Edge case — defensive close. |

---

## 5. Layout Specification

### 5.1 Wireframe

```
╔══════════════════════════════════════════════════════════════════════════════╗
║ INVENTORY                                                          [Esc Close]║  ← HEADER (status)
║ Weight: [█████████████████░░░] 47.2 / 50.0 kg     Slots: 18/20    [Craft]   ║
║ ┌──────────────────────────────────────────────────────────────────────────┐ ║
║ │ [All]  [Weapon]  [Ammo]  [Healing]  [Cure]  [Resource]  [Key Item]      │ ║  ← CATEGORY TABS
║ └──────────────────────────────────────────────────────────────────────────┘ ║
╠═══════════════════╦══════════════════════════════════╦══════════════════════╣
║ WEAPON SLOTS      ║         ITEM GRID (5×4)          ║   DETAIL PANEL       ║
║                   ║                                  ║                      ║
║ ┌───────────────┐ ║  ┌────┬────┬────┬────┬────┐    ║ ┌──────────────────┐ ║
║ │ PRIMARY       │ ║  │ ●  │ ▓▓ │ ▓▓ │    │ ▓  │    ║ │ {item icon 96px} │ ║
║ │ {Rifle icon}  │ ║  ├────┼────┼────┼────┼────┤    ║ │                  │ ║
║ │ Rifle (Clean) │ ║  │ ▓▓ │ ▓▓ │ ▓  │ ▓  │ ▓  │    ║ │ Medkit           │ ║
║ │ Ammo: 18/20   │ ║  ├────┼────┼────┼────┼────┤    ║ │ Healing          │ ║
║ │ Weight: 3.5kg │ ║  │ ▓  │    │ ▓  │ ▓  │ ▓  │    ║ │ ───────────────  │ ║
║ └───────────────┘ ║  ├────┼────┼────┼────┼────┤    ║ │ Weight: 0.8 kg   │ ║
║                   ║  │ ▓  │ ▓  │    │ ▓  │ ▓  │    ║ │ Slots: 1×1       │ ║
║ ┌───────────────┐ ║  └────┴────┴────┴────┴────┘    ║ │ Stack: 3 / 5     │ ║
║ │ SECONDARY     │ ║                                  ║ │                  │ ║
║ │ {Pistol icon} │ ║  Legend: ● = focused / "New"     ║ │ Restores 60 HP   │ ║
║ │ Pistol (Clean)│ ║          ▓ = occupied            ║ │ over 4.0s.       │ ║
║ │ Ammo: 12/15   │ ║                                  ║ │ Stationary use.  │ ║
║ │ Weight: 1.5kg │ ║                                  ║ │ Cancelled if     │ ║
║ └───────────────┘ ║                                  ║ │ damaged.         │ ║
║                   ║                                  ║ │                  │ ║
║ AMMO RESERVE      ║                                  ║ │ Assigned: QS 2   │ ║
║  Pistol:  45      ║                                  ║ │                  │ ║
║  Rifle:   38      ║                                  ║ │ [Use]   [Drop]   │ ║  ← ACTION BAR
║  Shotgun: 0       ║                                  ║ │ [Assign QS] [▼]  │ ║    (inside detail)
║                   ║                                  ║ └──────────────────┘ ║
╠═══════════════════╩══════════════════════════════════╩══════════════════════╣
║ [A] Select  [Y] Context  [X] Pick Up/Place  [LB/RB] Tab  [B] Close          ║  ← INPUT HINT BAR
╚══════════════════════════════════════════════════════════════════════════════╝

State: Item Selected (Medkit in grid). World visible at 30% opacity behind panel.
```

### 5.2 Zone Definitions

| Zone Name | Description | Approximate Size | Scrollable? | Overflow Behavior |
|-----------|-------------|-----------------|-------------|-------------------|
| Header (Status) | Top bar: Weight bar (left), Slot counter (center-left), Craft button (right, only at Workbench), Close hint (right) | Full width, ~12% height | No | Weight number truncates to 1 decimal place; weight bar segment colored per GDD thresholds (green <60%, yellow 60-85%, red >85%) |
| Category Tabs | Horizontal tab row: All, Weapon, Ammo, Healing, Cure, Resource, Key Item | Full width below header, ~6% height | No | At low resolutions (<1280px wide), tabs may abbreviate; minimum width per tab 80px |
| Weapon Slots (Left) | Two stacked weapon slot panels (Primary above, Secondary below) + Ammo Reserve summary | ~22% width, ~75% height | No | Fixed layout, two slots only per GDD Rule 4 |
| Item Grid (Center) | 5×4 grid (20 cells base, 6×5 expanded post-MVP). Each cell 80×80px per GDD. Multi-cell items render as fused frames (e.g., rifle = 2×2 cells fused). | ~45% width, ~75% height | No (fixed grid) | Grid never overflows — capacity is fixed at 20/30 cells |
| Detail Panel (Right) | Selected item: icon, name, category, weight, slot footprint, stack count, description, quick-slot assignment, action bar | ~30% width, ~75% height | Yes — vertical scroll for long descriptions | Fade gradient at bottom of panel when description overflows |
| Action Bar (inside Detail Panel) | Context-sensitive action buttons (Use / Equip / Drop / Assign QS / More ▼) | Bottom of detail panel, ~80px tall | No | Up to 4 visible buttons; overflow collapses into ▼ More menu |
| Input Hint Bar (Footer) | Platform-aware input prompts (gamepad icons OR keyboard hints based on last-used input) | Full width, ~5% height | No | Per-platform hint set defined in localization file |
| Crafting Panel (overlay, conditional) | Replaces Detail Panel when at Workbench and Craft tab active. Lists unlocked recipes with ingredient costs. | ~30% width, ~75% height (same as Detail Panel) | Yes — vertical scroll for recipe list | Per Crafting GDD: greyed recipes when missing resources; Workbench-only recipes hidden in Field Craft mode |

### 5.3 Component Inventory

| Component Name | Type | Zone | Purpose | Required? | Reuses Existing Component? |
|----------------|------|------|---------|-----------|---------------------------|
| WeightBar | Compound (Bar + Label) | Header | Shows current/max weight with color thresholds (green/yellow/red) | Yes | New component — shared with HUD weight indicator (future) |
| SlotCounter | Text Label | Header | Shows `X / Y` slots used | Yes | New component |
| CraftTabButton | Button (conditional visibility) | Header | Opens Crafting Panel; visible only when within Workbench radius | Yes (gated) | New component — links to Crafting UI |
| CloseHint | Text + Icon | Header | Reminds player of close input | Yes | Reuse: InputHintLabel |
| CategoryTab | Toggle Button | Category Tabs | Filters grid by item category | Yes (×7) | New component |
| WeaponSlotPanel | Compound (Icon + Stats) | Weapon Slots | Displays equipped weapon, condition, magazine, weight | Yes (×2) | New component |
| AmmoReserveRow | Compound (Label + Count) | Weapon Slots | Shows total ammo reserves per type | Yes (×3) | New component |
| InventoryGridCell | Compound (Frame + Icon + Stack + Badge) | Item Grid | Single cell of the 5×4 grid; may be empty, occupied (single-cell item), or part of multi-cell item | Yes (×20) | New component |
| ItemDragGhost | Visual (50% opacity icon) | Floats with cursor/stick | Drag-and-drop visual during item movement | Yes | New component |
| DetailPanelHeader | Compound (Icon + Name + Category Tag) | Detail Panel | Top section of detail panel | Yes | New component |
| StatRow | Compound (Label + Value) | Detail Panel | Weight, slot footprint, stack count, condition, etc. | Yes (×N) | New component — reused by Crafting recipe display |
| ComparisonRow | Compound (Label + Current + Delta + New) | Detail Panel (weapon only) | When selecting a weapon while another is equipped, shows side-by-side comparison | Yes (conditional) | New component |
| DescriptionText | Text (scrollable) | Detail Panel | Item flavor + mechanical description | Yes | Reuse: BodyText (with scroll) |
| QuickSlotAssignmentLabel | Text Label | Detail Panel | Shows current quick-slot binding (e.g., "Assigned: QS 2") or "Not assigned" | Yes | New component |
| ActionButton | Button (with disabled state) | Action Bar | Single action (Use, Equip, Drop, Assign, etc.) | Yes (×4 max) | Reuse: PrimaryButton variant |
| MoreActionsMenu | Dropdown | Action Bar | Overflow for >4 actions | Yes (conditional) | Reuse: ContextMenu |
| ContextMenu | Popover (4–6 items) | Floats near focused item | Right-click / Y-button menu: Use, Equip, Drop, Assign QS, Inspect | Yes | New component |
| ConfirmationDialog | Modal | Center overlay | Drop confirmation, Replace Weapon confirmation | Yes | New component — reused for any destructive confirm |
| StackSplitSpinner | Modal (number input + slider) | Center overlay | Shift+drag (mouse) or hold X (gamepad) opens this to split stack | Yes | New component |
| NewItemBadge | Visual badge (animated) | Inventory Grid Cell overlay | Marks newly acquired items until player navigates off | Yes | New component |
| EmptyStateMessage | Text + Icon | Grid (when category filter has 0 items) | "No [Category] in inventory." | Yes | Reuse: EmptyState |
| InventoryFullToast | Inline notification | Bottom of grid zone | Appears for 2s when pickup-while-open fails | Yes | Reuse: ToastNotification |
| ErrorRetryPanel | Panel (icon + message + Retry button) | Replaces grid in error state | Inventory data failed to load | Yes | Reuse: ErrorPanel |
| LoadingShimmer | Visual placeholder | Grid cells (loading state) | Shimmering placeholders while data loads | Yes | Reuse: SkeletonLoader |
| InputHintBar | Compound (icon + label rows) | Footer | Platform-aware input legend | Yes | New component |
| CraftingRecipeRow | Compound (Output icon + Name + Ingredient list + Craft button) | Crafting Panel | One recipe entry, greyed when ingredients missing | Yes (×N) | New component — defined in Crafting UX (deferred) |
| WorldDimOverlay | Backdrop | Full-screen behind inventory | Dims slowed gameplay to ~30% visibility behind panel | Yes | Reuse: ScreenDim |

**Primary focus element on open**:
- If player has any items: first non-empty cell in the grid (top-left scan order). Detail panel auto-populates for that item.
- If grid is empty (rare — fresh start): first Category Tab ("All").
- If opened via newly-acquired-item highlight (in-place refresh): the newly acquired cell takes focus, badge visible.

---

## 6. States & Variants

| State Name | Trigger | What Changes Visually | What Changes Behaviorally | Notes |
|------------|---------|----------------------|--------------------------|-------|
| Loading | Screen pushed but inventory data fetch in-flight | All 20 grid cells show LoadingShimmer placeholders; weapon slots show shimmer; detail panel blank; action bar disabled | Only Close (Esc/B) is active | Should not exceed 200ms in normal conditions per ADR-0001 delegate dispatch. If exceeds 500ms, log a warning. |
| Populated — no selection | Data loaded, but cursor on empty cell or fresh open with empty grid | Grid shows items; detail panel shows "Select an item" placeholder; action bar empty | Navigation enabled; no item-specific actions | Only occurs transiently — focus auto-lands on first item if any exist. |
| Item Selected — single-cell item | Player navigates to or clicks an occupied cell containing a 1×1 item | Focus ring on cell; detail panel populates with item data; action bar shows valid actions (e.g., Use, Drop, Assign QS for Healing) | All item-specific actions enabled; if item is equipped weapon (in weapon slot), Equip is replaced by "Unequip" | Default and most common state. |
| Item Selected — multi-cell item | Player navigates to any cell that is part of a multi-cell item (e.g., 2×2 rifle) | Entire multi-cell footprint highlighted with single focus frame; detail panel populates; action bar shows weapon-specific actions | Equip action moves item to a weapon slot; Move action initiates drag | Multi-cell selection always treats the whole item as one selectable unit. |
| Item Selected — weapon (with another equipped) | Player selects a weapon item while a weapon of the same slot type is currently in the weapon slot | Detail panel adds Comparison rows showing current-equipped stats vs. selected weapon stats (weight, ammo, condition, slot footprint) | Equip action triggers "Replace Weapon Confirmation" if slot occupied | Auto-comparison reduces cognitive load per design decision #2. |
| Item Selected — Quick-Slot Assignable | Selected item is in Healing, Cure, or Throwable category | Action bar includes "Assign QS" button; detail panel shows current QS binding or "Not assigned" | Pressing "Assign QS" opens 1-2-3-4 picker (sub-popover) | Per Inventory GDD Rule 9. |
| Confirmation — Drop | Player initiates Drop action (right-click → Drop, or context menu Drop, or Action Bar Drop) | ConfirmationDialog overlays the inventory at 60% backdrop dim; dialog text: "Drop [Item Name]? It will spawn at your feet. This cannot be undone easily." | All background inputs blocked except Confirm (A/Enter) and Cancel (B/Esc) | Modal. Required because drops are functionally irreversible mid-zone. |
| Confirmation — Replace Weapon | Player attempts to equip a weapon when target slot is occupied AND grid has space OR target slot is occupied AND grid is full | If grid has space: "Replace [Current Weapon]? It will be moved to your inventory." If grid is full: dialog is suppressed; inline error "No grid space — drop an item first." | Confirm replaces and moves; Cancel returns to inventory | Per Inventory GDD Edge Case "both weapon slots full". |
| Stack Split Pending | Player Shift+drags (mouse) or holds X on a stackable item | StackSplitSpinner appears: "Split [Item Name]: [slider 1 to N-1]" with confirm/cancel | All other inputs blocked except spinner controls | Releasing without confirm cancels the split. |
| Empty Category | Player filters to a category with zero items | Grid area replaced (filter view only — actual grid not cleared) by EmptyStateMessage: icon + "No [Category] in inventory." | Action bar empty; navigation restricted to category tabs and Close | When player switches back to "All" or a populated category, grid restores. |
| Inventory Full Feedback | Pickup-while-open fails because new item cannot fit (no contiguous block per Rule 6 first-fit) | InventoryFullToast appears at bottom of grid zone for 2.0s: "[Item] requires [N] slots. Rearrange or drop items to make room." | No interaction blocking; toast auto-dismisses | Per Inventory GDD Rule 6 step 4. |
| Combat Interrupt | Enemy enters engagement range while inventory open | Hard cut: screen immediately disappears (no slide-out); audio sting plays | All open dialogs (Drop confirm, Stack split) dismissed without action; committed changes persist | Per Inventory GDD Edge Case + GSM Rule 6b. |
| Error — Data Load Failed | Inventory subsystem returns error on `GetGridItems()` | Grid replaced by ErrorRetryPanel: "Couldn't load inventory data." + Retry button | Only Retry and Close active | Log error internally; do not expose technical details. Should be virtually never seen in production. |
| Newly Acquired Item | Inventory opened OR refresh occurred with an item flagged as new | The newly-acquired cell shows NewItemBadge (pop-in animation per Section 10); detail panel pre-populated; cell gets focus | Same as Item Selected; badge persists until player navigates off that cell once | Per Inventory GDD Edge Case "Item picked up while inventory is open". |
| Workbench Available | Player is within 200cm of a discovered Workbench when inventory opens (or moves into range while open) | CraftTabButton appears in header with subtle pulse animation (one-time per session entry) | Tab is clickable to open Crafting Panel | Per Crafting GDD Rule 1 + F2. |
| Crafting Panel Open | Player clicked Craft tab | Detail Panel replaced (slide-in from right) by CraftingRecipeRow list; grid + weapon slots remain visible | Item grid still navigable; detail panel selection state suspended until Crafting Panel closes | Per Crafting GDD UI Requirements ("both can be open simultaneously"). |
| Quick Slot Assignment Sub-popover | Player pressed "Assign QS" on a Healing/Cure/Throwable item | Small popover (4 cells: QS1/QS2/QS3/QS4) appears anchored to Action Bar; current binding (if any) highlighted | Selecting a slot fires `QuickSlotAssigned` event; if slot was occupied by another item, that item's binding clears | Per Inventory GDD Rule 9. |

---

## 7. Interaction Map

### 7.1 Navigation Inputs

| Input | Platform | Action | Visual Response | Audio Cue | Notes |
|-------|----------|--------|-----------------|-----------|-------|
| D-Pad (any) / Arrow keys | Gamepad / KB | Move grid cursor one cell in direction; in Weapon Slots zone, moves between Primary↔Secondary; in Category Tabs, moves between tabs | Focus ring moves to adjacent element with 60ms ease-out | Grid Click sound (-20dB per Inventory GDD audio table) | Wraps within zone; does NOT cross zones with arrows alone |
| Left Stick (gamepad) | Gamepad | Same as D-Pad navigation, with optional analog repeat-rate scaling | Same as D-Pad | Same as D-Pad | Stick deadzone 0.25 |
| LB / L1 / Shift+Tab | Gamepad / KB | Move focus to previous zone (Detail Panel display-only → Weapon Slots → Grid → Category Tabs → Header) | Focus ring jumps to first interactive element of target zone | Distinct zone-change tone (higher pitch than grid click) | Detail Panel is display-only — never gets focus. |
| RB / R1 / Tab | Gamepad / KB | Move focus to next zone (Header → Category Tabs → Weapon Slots → Grid → Action Bar) | Same as LB | Same as LB | Cycles: Action Bar → Header (wraps) |
| Mouse hover | PC | Show hover state on interactive elements (cell, button, tab) | Highlight: border lightens 20%, slight scale 102% | None (hover is silent) | Hover does NOT move keyboard/gamepad focus — only click does |
| Mouse click (Left) | PC | Select and focus the clicked element | Pressed state flash (80ms scale to 95%) then settled focus | Soft select tone (-16dB) | If clicking an already-selected cell with a stackable item, no-op |
| Mouse scroll wheel | PC | In Detail Panel: scroll description text. In Crafting Panel: scroll recipe list. Anywhere else: no-op | Content scrolls; scroll indicator visible while scrolling | None | |
| Mouse hover over multi-cell item | PC | Highlight entire multi-cell footprint (not just hovered sub-cell) | All cells in footprint show hover frame as single unit | None | |
| Esc | KB | Close inventory (or close any open modal first if one is active) | Slide-out exit transition (200ms) | Inventory Close sound (per Inventory GDD audio table) | Closes nearest modal first; second press closes inventory if no modal |
| B button | Gamepad | Same as Esc | Same | Same | |
| Start button | Gamepad | Same as Esc (toggle inventory) | Same | Same | |

### 7.2 Action Inputs

| Input | Platform | Context (What must be focused) | Action | Response | Animation | Audio Cue | Notes |
|-------|----------|-------------------------------|--------|----------|-----------|-----------|-------|
| Left Click / A / Enter | All | Item grid cell (occupied) | Select item → populate Detail Panel | Cell focus ring locks; detail panel cross-fades in (120ms) | Cross-fade content | Soft select tone | If already selected: no-op |
| Left Click / A / Enter | All | Category Tab | Filter grid to that category; "All" shows everything | Tab visually activates (color shift); grid filter applies (instant, no animation) | Tab underline slides to active tab (180ms ease-out) | Tab click tone | Fires `InventoryCategoryChanged` analytics event |
| Left Click / A / Enter | All | Weapon Slot Panel (occupied) | Selects the equipped weapon → populates Detail Panel (with Unequip action available) | Slot focus ring; detail panel updates | Cross-fade content | Soft select tone | |
| Left Click / A / Enter | All | Weapon Slot Panel (empty) | No-op (cannot select empty slot) | Brief shake animation on slot (80ms) | Shake | Negative UI tone (-14dB) | |
| Left Click / A / Enter | All | Action Bar button (Use / Equip / Drop / Assign QS) | Execute that action for currently selected item | Button press animation (scale 95% for 60ms); action executes; detail panel refreshes | Button press | Action-specific (Item Use, Weapon Equip, etc.) | See Section 9 for events fired |
| Double Left Click | PC | Item grid cell — weapon | Quick-equip to default weapon slot (Primary if rifle/shotgun, Secondary if pistol) | If slot empty: instant equip animation; if slot occupied: opens Replace Weapon Confirmation | Slot icon swap (80ms) | Weapon Equip sound | Convenience shortcut |
| Double Left Click | PC | Item grid cell — consumable (Healing/Cure/Throwable) | Quick-use (consumable used immediately) | Use animation plays in detail panel area; item stack decrements | Stack count tick | Item Use sound (context-specific) | For Cure: opens deployment targeting overlay (handled by Infection Spread System) |
| Right Click / Y button | All | Item grid cell | Open Context Menu (popover) with item-specific actions | Popover appears anchored to cell (80ms fade-in) | Menu open | Menu open sound | Menu items: Use/Equip, Drop, Assign QS (if applicable), Inspect, Move |
| X button | Gamepad | Item grid cell (occupied) — picks up item; Item grid cell (held in cursor) — places item | Initiates grid drag; second press places item at current cursor position | Cell shows "lifted" visual (slight elevation + shadow); cursor moves with ItemDragGhost overlay | Lift / Place animation (80ms each) | Grid Click (lift); Grid Click (place) | Per Inventory GDD controller navigation spec |
| Shift + Left Click drag (start) | PC | Stackable item cell | Begin stack split — opens StackSplitSpinner | Modal spinner appears | Modal open (150ms) | Menu open sound | Mouse must remain pressed; release confirms split at current spinner value, drag-out cancels |
| Hold X (gamepad) on stackable item | Gamepad | Stackable item cell | Opens StackSplitSpinner | Modal spinner appears | Same | Same | Hold threshold: 300ms |
| Left Click drag | PC | Item grid cell | Begin drag of item; on release over valid target (different grid cell, weapon slot, or world drop zone) execute move | ItemDragGhost (50% opacity per GDD) follows cursor; target cells highlight green (valid) or red (invalid) on hover | Drag follow (every frame); target highlight (instant) | Pickup sound on drag start; Place sound on drop | Releasing outside grid bounds = drop item (opens Drop Confirmation) |
| Left Click drag to Weapon Slot | PC | Item grid weapon → Weapon Slot panel | Equip weapon to that slot | If empty: instant equip; if occupied: Replace Weapon Confirmation | Slot icon swap | Weapon Equip sound | |
| A button (gamepad) | Gamepad | "Assign QS" button focused → press → QS Sub-popover appears | Cycle to QS1/QS2/QS3/QS4 selector; A confirms | Sub-popover appears (80ms); selection ring on default slot | Popover (fade-in) | Menu open | |
| Esc / B button | All | Any modal dialog open (Drop confirm, Replace confirm, Stack split, Context menu) | Cancel/close that modal — no action taken | Modal closes (150ms ease-in) | Slide/fade out | Menu close tone | Does not close inventory; only the modal |
| Esc / B button | All | No modal open, inventory screen at root | Close inventory | Slide-out exit (200ms) | Slide left | Inventory Close sound | Per Section 4 exit table |
| 1 / 2 / 3 / 4 keys | KB | Anywhere on inventory screen | Hotkey: shortcut to "Assign to Quick Slot N" for currently selected item (if quick-slot-assignable) | Brief flash on QS binding label in Detail Panel | Flash | Assignment confirm sound | If selected item is not QS-assignable: brief negative tone, no action |
| F key / RT (gamepad trigger) | KB / Gamepad | Anywhere | Toggle Crafting Panel — only functional if at Workbench, otherwise no-op | Crafting Panel slides in/out (200ms) | Slide from right | Panel open tone | If not at Workbench: brief shake on CraftTabButton location + tooltip "No Workbench in range" |
| Tab (in modal) | KB | ConfirmationDialog open | Move focus between Confirm and Cancel buttons | Focus ring moves | Soft tick | | Modal traps focus per accessibility |

### 7.3 State-Specific Behaviors

| State | Input Restriction | Reason |
|-------|------------------|--------|
| Loading | All grid, weapon slot, and action inputs disabled. Only Esc/B (close) is active. | No data to act on; prevents race conditions |
| Confirmation Dialog open (Drop / Replace Weapon) | Only Confirm and Cancel inputs active; all background inputs locked | Modal — background is locked |
| Stack Split Spinner open | Only spinner controls (arrow keys / stick), Confirm, Cancel active | Modal |
| Context Menu open | Only menu navigation + Confirm/Cancel | Modal popover |
| Error state (data load failed) | Only Retry and Close active | No data to navigate |
| Combat Interrupt | All inputs immediately disabled; screen force-closes within 0.1s per GSM | Combat takes priority — no negotiation |
| Crafting Panel open | Item grid and weapon slots still navigable (read-only context for the crafter); detail panel actions suspended | Per Crafting GDD: simultaneous panels |
| Quick Slot Sub-popover open | Only 1-2-3-4 picker inputs + Confirm/Cancel | Modal popover |

---

## 8. Data Requirements

| Data Element | Source System | Update Frequency | Who Owns It | Format | Null / Missing Handling |
|--------------|--------------|-----------------|-------------|--------|------------------------|
| Grid item list | InventorySubsystem (`GetGridItems()`) | On screen open; on `OnItemAdded` / `OnItemRemoved` / `OnItemMoved` events | InventorySubsystem | `TArray<FInventoryItem>` — each item has `ItemId`, grid position (X,Y), `SlotWidth`, `SlotHeight`, `StackCount`, `IsNewlyAcquired` flag | Empty array → grid shows all empty cells; never null per ADR-0001 contract |
| Item data (per ItemId) | Data Table `DT_Items` (read-only) | On demand (cached) | Data Asset | `FItemData` — `DisplayName`, `Category`, `Weight`, `SlotWidth`, `SlotHeight`, `MaxStack`, `Description`, `IconTexture`, `UseAction`, `UseValue`, `UseDuration` | If ItemId not in DT_Items: cell shows error icon + "Unknown item" — log warning |
| Equipped weapons | InventorySubsystem (`GetEquippedWeapon(Primary)`, `GetEquippedWeapon(Secondary)`) | On screen open; on `OnWeaponEquipped` / `OnWeaponSwitched` events | InventorySubsystem | `FWeaponId` per slot; weapon also has `Condition` (Clean/Dirty/Damaged), `MagazineCount` | Empty slot → null/None → UI shows "Empty Slot" placeholder icon |
| Ammo reserves | InventorySubsystem (`GetAmmoCount(EAmmoType)`) | On screen open; on `OnAmmoChanged` event | InventorySubsystem | int32 per ammo type (Pistol, Rifle, Shotgun) | 0 is a valid value — show "0" in grey |
| Current weight | InventorySubsystem (`GetCurrentWeight()`) | On screen open; on any inventory change event | InventorySubsystem | float (kg, 1 decimal precision) | Never null; clamped to 0+ |
| Max weight | InventorySubsystem (`GetMaxWeight()`) | On screen open; on capacity expansion (rare) | InventorySubsystem | float (50.0 base, up to 70.0 expanded) | Never null |
| Used slots | InventorySubsystem (`GetUsedSlots()`) | On screen open; on any inventory change | InventorySubsystem | int32 | Never null; range 0–20 (or 0–30 expanded) |
| Max slots | InventorySubsystem (`GetMaxSlots()`) | On screen open; on capacity expansion | InventorySubsystem | int32 (20 base, 30 expanded) | Never null |
| Quick slot bindings | InventorySubsystem (`GetQuickSlotBinding(EQuickSlot)`) | On screen open; on `OnQuickSlotAssigned` event | InventorySubsystem | `FItemId` per slot (1–4), nullable | Null = "Not assigned" |
| Newly acquired flags | InventorySubsystem (`GetNewlyAcquiredItemIds()`) | On screen open; cleared when player navigates off each item | InventorySubsystem | `TArray<FItemId>` | Empty array → no badges shown |
| Workbench proximity flag | CraftingSubsystem (`IsWithinWorkbenchRange()`) | On screen open; polled on player movement (1Hz) | CraftingSubsystem | bool | False default — CraftTabButton hidden |
| Workbench-unlocked recipes | CraftingSubsystem (`GetUnlockedRecipes()`) | On opening Crafting Panel | CraftingSubsystem | `TArray<FRecipeId>` | Empty array → "No recipes unlocked." message in Crafting Panel |
| Player HP (for healing item context) | HealthSubsystem (`GetCurrentHealth()`, `GetMaxHealth()`) | On screen open; on HP change | HealthSubsystem | int32 + int32 | Used by detail panel to show e.g., "Will restore 60 HP (current: 40/100)" |
| Last-used input device | InputSubsystem (`GetLastInputDevice()`) | On every input event | InputSubsystem | enum (KeyboardMouse, Gamepad) | Default KeyboardMouse — drives Input Hint Bar icon set |

> **Rule**: This screen NEVER writes directly to any system listed above. All player actions fire events via the Gameplay Message Router (per ADR-0001) or dynamic multicast delegates. The Inventory subsystem owns mutation; the UI is a renderer + event source.

---

## 9. Events Fired

| Player Action | Event Fired | Payload | Receiver System | Notes |
|---------------|-------------|---------|-----------------|-------|
| Player equips a weapon to a weapon slot | `EquipWeaponRequested` | `{WeaponId: FItemId, TargetSlot: EWeaponSlot}` | InventorySubsystem | Subsystem validates capacity and slot occupancy; fires `OnWeaponEquipped` on success or `OnEquipRejected` with reason on failure |
| Player unequips a weapon from a weapon slot | `UnequipWeaponRequested` | `{Slot: EWeaponSlot}` | InventorySubsystem | Weapon moved back to grid via first-fit; if grid full, action rejected with inline error |
| Player uses a consumable (Healing / Cure / Throwable) | `UseItemRequested` | `{ItemId: FItemId, Quantity: int32}` | InventorySubsystem (routes to HealthSubsystem / InfectionSpreadSubsystem / CombatSubsystem) | InventorySubsystem decrements stack on confirm from receiver; for Cure devices, opens deployment overlay (handled outside this screen) |
| Player drops an item (confirmed) | `DropItemRequested` | `{ItemId: FItemId, Quantity: int32, GridSlotId: FInventorySlotId}` | InventorySubsystem | Fires only after Drop Confirmation Dialog confirmed; subsystem removes item and fires `OnItemDropped`; spawns world actor |
| Player moves an item within the grid | `MoveItemRequested` | `{FromSlot: FInventorySlotId, ToSlot: FInventorySlotId}` | InventorySubsystem | Validates target is empty or compatible (stack merge); fires `OnItemMoved` |
| Player splits a stack | `SplitStackRequested` | `{SourceSlot: FInventorySlotId, SplitQuantity: int32, TargetSlot: FInventorySlotId}` | InventorySubsystem | Validates source has sufficient stack; creates new stack at target slot |
| Player assigns item to quick slot | `QuickSlotAssignRequested` | `{ItemId: FItemId, QuickSlotIndex: int32 (1-4)}` | InventorySubsystem | Overwrites previous binding for that slot; fires `OnQuickSlotAssigned` |
| Player clears a quick slot binding | `QuickSlotClearRequested` | `{QuickSlotIndex: int32}` | InventorySubsystem | |
| Player changes category filter | `InventoryCategoryChanged` | `{Category: EItemCategory}` | Analytics System (read-only) | No game state change; analytics only |
| Player opens inventory screen | `InventoryScreenOpened` | `{TimestampMs: int64, EntryReason: enum (PlayerInput / Deeplink)}` | Analytics System | |
| Player closes inventory screen | `InventoryScreenClosed` | `{SessionDurationMs: int64, CloseReason: enum (PlayerInput / CombatInterrupt / GameSave)}` | Analytics System | Used for engagement metrics |
| Player opens Crafting Panel | `CraftingPanelOpened` | `{WorkbenchId: FName}` | CraftingSubsystem | Crafting subsystem responds with unlocked recipe set |
| Player initiates a craft from Crafting Panel | `CraftRecipeRequested` | `{RecipeId: FName}` | CraftingSubsystem | CraftingSubsystem validates ingredients + capacity, fires `OnCraftStarted` |
| Player opens item context menu | `ItemContextMenuOpened` | `{ItemId: FItemId}` | Analytics System | |
| Player opens item compare (auto-triggered for weapon-vs-weapon) | `ItemCompareShown` | `{ItemAId: FItemId (equipped), ItemBId: FItemId (selected)}` | Analytics System | No game state change |
| Pickup-while-open fails (no space) | `InventoryPickupRejected` | `{ItemId: FItemId, Reason: enum (NoSpace / TooHeavy)}` | (UI consumer — drives InventoryFullToast) | Fired by InventorySubsystem; UI displays toast |

---

## 10. Transition & Animation

| Transition | Trigger | Direction / Type | Duration (ms) | Easing | Interruptible? | Skipped by Reduced Motion? |
|------------|---------|-----------------|--------------|--------|----------------|---------------------------|
| Screen enter (slide-in) | Inventory state pushed onto GSM (IA_Inventory pressed) | Slide in from left + world dim fade to 30% backdrop | 300 (matches Inventory GDD `UISlideDuration`) | Ease-out cubic | No — must complete before input enabled | Yes — instant appear at 0ms, full opacity |
| Screen exit (slide-out, normal close) | Player presses Esc/B/Start | Slide out to left + world dim fade to 0% | 200 | Ease-in cubic | No | Yes — instant disappear |
| Screen exit (Combat Interrupt) | Enemy engagement fires | Hard cut — no animation | 0 (per GSM 0.1s fast transition) | None | N/A | N/A — always instant |
| Category tab switch | Player selects different category | Active tab underline slides to new tab | 180 | Ease-out | Yes — if player rapidly switches, animation snaps to latest target | Yes — instant underline jump |
| Grid filter application (after category change) | Tab change committed | Cells matching filter fade in; non-matching fade to 30% opacity (greyed) | 120 | Linear | Yes | Yes — instant state |
| Detail Panel update (item selection change) | Player navigates to new item | Cross-fade content (old fade out, new fade in) | 120 (60 out + 60 in) | Linear | Yes — rapid navigation cancels prior fade | Yes — instant swap |
| Item Drag — Pickup | Drag started (Left Click hold / X press) | Item cell scales to 105%, elevation shadow appears, ItemDragGhost spawned at cursor | 80 | Ease-out | No (animation completes during ongoing drag) | Yes — instant elevation, no scale |
| Item Drag — Hover Target | Drag ghost over valid/invalid target cell | Target cell border highlights green (valid) or red (invalid); 50ms pulse | 50 | Linear | Yes (changes on hover target change) | Yes — instant highlight |
| Item Drag — Drop Place | Drag released over valid target | Item snaps to target cell with slight bounce (scale 95% → 100%) | 100 | Ease-out back | No | Yes — instant snap, no bounce |
| Item Drag — Drop Cancelled | Drag released over invalid target | Item snaps back to origin cell | 120 | Ease-out | No | Yes — instant snap |
| Weapon Slot equip | Weapon dragged or double-clicked into weapon slot | Slot icon swap (old fades out, new fades in with slight scale 90%→100%) | 80 + 80 | Ease-out | No | Yes — instant swap |
| Action Bar button press | Player activates a button | Scale 95% on press, return on release | 60 down / 60 up | Ease-out / Ease-in | Yes — early release returns to normal | No — tactile feedback, not decorative |
| Confirmation Dialog open (Drop / Replace Weapon) | Player initiates destructive action | Backdrop dims to 60% opacity; dialog scales from 95% to 100%; fade-in | 150 | Ease-out | No | Yes — instant appear at 100% scale, no backdrop animation |
| Confirmation Dialog close | Player confirms or cancels | Dialog fades out + scales to 95%; backdrop fades | 120 | Ease-in | No | Yes — instant disappear |
| Stack Split Spinner open | Shift+drag start / hold X completes | Same as Confirmation Dialog | 150 | Ease-out | No | Yes — instant |
| Stack Split Spinner close | Confirm or Cancel | Same as Confirmation Dialog close | 120 | Ease-in | No | Yes — instant |
| Context Menu (popover) open | Right-click / Y button on item | Fade + slide-up 8px from anchor | 80 | Ease-out | No | Yes — instant appear |
| Context Menu close | Selection or dismiss | Fade out | 60 | Linear | No | Yes — instant |
| Quick Slot Sub-popover open | "Assign QS" pressed | Fade + scale 90%→100% | 80 | Ease-out | No | Yes — instant |
| Crafting Panel open | Craft tab selected | Detail Panel slides out to right; Crafting Panel slides in from right | 200 (overlap by 80) | Ease-out | No | Yes — instant swap |
| Crafting Panel close | Craft tab deselected or returned to inventory | Reverse | 200 | Ease-in | No | Yes — instant |
| New Item Badge appear | Screen opens or refresh with new item | Badge scales from 0% → 110% → 100% (overshoot pop) | 200 total | Ease-out-back | No | Yes — instant appear at 100% |
| New Item Badge dismiss | Player navigates off the cell once | Badge fades out | 120 | Linear | No | Yes — instant disappear |
| Weight Bar threshold color change | Weight crosses 60% or 85% threshold | Bar color cross-fades between green/yellow/red | 200 | Linear | Yes | Yes — instant color change |
| Loading shimmer → Populated | Inventory data arrives | Shimmer cells fade out (180ms); item icons fade in (180ms) | 180 + 180 (overlap by 60) | Ease-out | No | Yes — instant content reveal |
| Inventory Full Toast | Pickup-while-open fails | Toast slides up from bottom, dwells 2000ms, slides down | 200 in / 2000 dwell / 200 out | Ease-out / Ease-in | No (auto-dismisses) | Yes — instant appear/disappear |
| Combat Interrupt audio sting | Combat engagement fires while inventory open | Audio-only event; no visual animation (screen hard-cuts) | N/A | N/A | No | N/A |
| Workbench available pulse (one-time) | CraftTabButton first appears in a session | Subtle pulse: scale 100% → 105% → 100% twice | 600 (300 + 300) | Ease-in-out | Yes (stops on user interaction with button) | Yes — no pulse, button just appears |

---

## 11. Input Method Completeness Checklist

**Keyboard**
- [x] All interactive elements reachable using Tab and arrow keys alone (Category Tabs, Weapon Slots, Item Grid, Action Bar — Detail Panel is display-only and intentionally excluded from focus loop)
- [x] Tab order follows visual reading order (Header → Category Tabs → Weapon Slots → Grid → Action Bar, then cycles)
- [x] Every action achievable by mouse is also achievable by keyboard (drag → Shift+arrow move; right-click → context menu key; double-click → Enter+Enter)
- [x] Focus is visible at all times (2px focus ring on all interactive elements, color contrast 3:1 minimum against background)
- [x] Focus does not escape the screen while it is open (focus trapped within inventory; modal dialogs trap focus within modal)
- [x] Esc closes the nearest modal, then the inventory; does NOT quit the game

**Gamepad**
- [x] All interactive elements reachable with D-Pad and left stick (D-pad for grid navigation; LB/RB for zone switching)
- [x] Face button mapping documented per Section 7.2 — follows Xbox conventions (A confirm, B cancel, X pick-up/place, Y context menu)
- [x] No action requires analog stick precision that cannot be replicated with D-Pad (no free-aim cursor; grid-based selection)
- [x] Trigger and bumper shortcuts documented (LB/RB zone switch; RT toggle Craft when at Workbench)
- [x] Controller disconnection while screen open is handled gracefully (input device switches to KB/M; Input Hint Bar updates within 100ms; no input lockup)

**Mouse**
- [x] Hover states defined for all interactive elements (border lighten + scale 102%)
- [x] Clickable hit targets are minimum 32x32px — grid cells are 80×80px per GDD, action buttons minimum 44×44px
- [x] Right-click behavior defined: opens context menu on item cells; no-op elsewhere
- [x] Scroll wheel behavior defined: scrolls Detail Panel description and Crafting recipe list; no-op elsewhere

**Touch** — Not applicable. PC-only platform.

---

## 12. Screen-Level Accessibility Requirements

**Text contrast requirements for this screen**:

| Text Element | Background Context | Required Ratio | Target Ratio | Pass? |
|--------------|-------------------|---------------|---------------|-------|
| Item name in Detail Panel | Dark panel background `#2A2A2A` (90% opacity per GDD) | 4.5:1 (WCAG AA normal text) | 12:1 (white on dark) | [ ] verify in implementation |
| Item description text | Same dark panel | 4.5:1 | 9:1 (light grey on dark) | [ ] verify |
| Category tab label — inactive | Mid-grey tab background `#3A3A3A` | 4.5:1 | 7:1 (off-white on dark grey) | [ ] verify |
| Category tab label — active | Accent color background (game palette TBD by art-director) | 4.5:1 | TBD | [ ] verify with art-director |
| Action button label (enabled) | Button color (varies by state) | 4.5:1 | TBD | [ ] verify |
| Action button label (disabled) | Disabled button color | 3:1 (WCAG AA for disabled / informational) | TBD | [ ] verify |
| Weight value (numeric label) | Header background | 4.5:1 | TBD | [ ] verify |
| Slot counter | Header background | 4.5:1 | TBD | [ ] verify |
| Stack count overlay on grid cell | Grid cell background (item icon underneath) | 4.5:1 — use outlined/stroked text to ensure contrast against varying icon colors | TBD | [ ] verify |
| Stack count in Detail Panel | Dark panel | 4.5:1 | 9:1 | [ ] verify |
| Comparison delta (positive/negative) | Detail panel | 4.5:1 — do NOT rely on green/red color alone | TBD | [ ] verify with +/- prefix and ↑/↓ arrow |
| Ammo Reserve values | Weapon Slot panel background | 4.5:1 | TBD | [ ] verify |
| Input Hint Bar text | Footer background | 4.5:1 | TBD | [ ] verify |

**Colorblind-unsafe elements and mitigations**:

| Element | Colorblind Risk | Mitigation |
|---------|----------------|------------|
| Weight bar color (green/yellow/red) per GDD thresholds | Red-green colorblindness (Deuteranopia) — most common form | Add numeric label "47.2 / 50.0 kg" always visible; add icon glyph at threshold transitions (✓ green, ⚠ yellow, ✗ red); pattern fill (solid/striped/dotted) on bar segments |
| Item category color borders (Weapon red, Ammo yellow, Healing green, Cure blue, Resource grey, Key purple per GDD) | Multiple colorblindness types — six-category color system is risky | Add category icon glyph in corner of each grid cell (small monochrome icon: weapon=crosshair, ammo=bullet, healing=cross, cure=syringe, resource=bolt, key=key); category text label in Detail Panel; category visible in Category Tab labels |
| Weapon condition (Clean/Dirty/Damaged) | Color-based status indicator | Use text labels ("Clean" / "Dirty" / "Damaged") and a 3-bar condition indicator (3/2/1 bars filled) — color is supplemental |
| Drag target highlight (green = valid, red = invalid) | Red-green colorblindness | Add icon overlay on hover target: green check ✓ for valid, red X ✗ for invalid; outline thickness differs (thick for valid, dashed for invalid) |
| Stat comparison deltas (positive green, negative red) | Red-green colorblindness | Add +/- prefix and ↑/↓ arrow; color is supplemental |
| "New" badge on newly acquired items | Pure color emphasis risk | Use distinct shape (star icon) + text "NEW" + position (top-right corner offset); color is supplemental |

**Focus order** (Tab key / RB sequence, numbered):

1. Close hint (Header — informational, focus skips on default but reachable via Shift+Tab)
2. Craft Tab Button (Header — only if Workbench available)
3. Category Tab 1 — All
4. Category Tab 2 — Weapon
5. Category Tab 3 — Ammo
6. Category Tab 4 — Healing
7. Category Tab 5 — Cure
8. Category Tab 6 — Resource
9. Category Tab 7 — Key Item
10. Weapon Slot — Primary
11. Weapon Slot — Secondary
12. Item Grid — cell [0,0] (top-left)
13. Item Grid — cell [0,1] ... left-to-right, top-to-bottom across all 20 (or 30 expanded) cells
14. Last grid cell (e.g., [3,4] = bottom-right of 5×4)
15. Action Bar — first action button (Use / Equip — context-sensitive)
16. Action Bar — second action button (Drop)
17. Action Bar — third action button (Assign QS — if applicable)
18. Action Bar — More menu (▼) if >4 actions
→ Cycles back to Close hint

**Focus does not enter the Detail Panel** — it is a display panel driven by item focus. Description text within Detail Panel can be scrolled via Scroll Wheel (mouse), arrow keys when Detail Panel scroll region is implicitly focused (when item grid item is selected), or stick-down navigation with PageDown/PageUp.

**Screen reader announcements for key state changes** (using platform accessibility API — Windows UI Automation for PC):

| State Change | Announcement Text | Announcement Timing |
|--------------|------------------|---------------------|
| Screen opens | "Inventory open. Carrying [N] items, [W] of [M] kilograms, [S] of [T] slots used. Category: All. First item: [Item Name] focused." | On screen focus settle (after 300ms slide-in) |
| Category tab change | "Category: [Tab Name]. [N] items in this category." | On tab focus |
| Item slot focused | "[Item Name]. [Category]. Weight [W] kilograms. [Slot footprint, e.g. '2 by 2 slots']. Stack [X] of [Max]. [Equipped to Primary / Equipped to Secondary / In grid]. [If weapon: Condition Clean/Dirty/Damaged]. [If quick-slot-assigned: Assigned to quick slot N]." | On focus arrival (debounced 150ms to avoid spam on rapid navigation) |
| Empty cell focused | "Empty slot, row [R] column [C]." | On focus arrival |
| Weapon Slot focused — occupied | "[Slot name] weapon slot. [Weapon name]. Magazine [X] of [Y]. Condition [C]." | On focus arrival |
| Weapon Slot focused — empty | "[Slot name] weapon slot. Empty." | On focus arrival |
| Weight crosses 85% threshold | "Warning. Carry weight high: [W] of [M] kilograms." | On threshold cross, debounced 1s |
| Player equips an item | "[Item Name] equipped to [slot name]." | After `OnWeaponEquipped` event |
| Player uses a consumable | "[Item Name] used. [Effect]." | After Use begins |
| Player drops an item | "[Item Name] dropped. Quantity [Q]. Carrying [W] of [M] kilograms now." | After `OnItemDropped` |
| Player assigns quick slot | "[Item Name] assigned to quick slot [N]." | After `OnQuickSlotAssigned` |
| Confirmation dialog opens | "Confirm. [Dialog text]. Button focused: Cancel." | On dialog appear |
| Stack split spinner opens | "Stack split. [Item Name]. Choose quantity to split, 1 to [Max minus 1]." | On spinner appear |
| Empty state shown | "No items in [category name]." | When empty state renders |
| Inventory full toast | "Cannot pick up [Item]. Requires [N] slots. Rearrange or drop items." | When toast appears |
| Combat interrupt | "Inventory closed. Combat engaged." | Immediately on force-close |
| Crafting panel opens | "Crafting panel open. [N] recipes available." | On panel slide-in complete |
| Screen closes | "Inventory closed." | After slide-out completes |

**Cognitive load assessment**:

The player simultaneously tracks: (1) item grid position; (2) current item detail; (3) weight pressure (header); (4) slot pressure (header); (5) weapon loadout (left); (6) ammo reserves (left); (7) available actions (action bar); (8) optionally: comparison data when weapon-vs-weapon. That is 7–8 concurrent streams at peak — at the upper edge of the standard 7±2 working-memory limit. The screen MUST mitigate this by:
- Auto-comparison only when comparing same-slot weapons (reduces decision steps).
- Persistent visibility of weight/slot counters at all times (no need to mentally cache).
- Detail panel auto-populates on navigation (no manual "inspect" step).
- Color-coded weight pressure (with redundant numeric label) lets the player check pressure peripherally.
- Category tabs reduce visual noise on demand (filter to relevant subset).
- Default landing on first item (no orientation step on open).

---

## 13. Localization Considerations

**General rules for this screen**:
- All text elements must tolerate a minimum of 40% expansion from English baseline (German + French targets).
- RTL languages: not in MVP locale set per game-concept.md target audience (English first; localization plan TBD). RTL behavior documented for forward-compatibility.
- CJK languages (Japanese, Korean, Chinese): not in MVP locale set; documented for forward-compatibility.
- Do not use text in images — all text driven by localization strings (`LOCTEXT`).

| Text Element | English Baseline Length | Max Characters | Expansion Budget | RTL Behavior | Overflow Behavior | Risk |
|--------------|------------------------|----------------|-----------------|--------------|-------------------|------|
| Screen title "INVENTORY" | 9 chars | 16 chars | 78% | Mirror to right or center — acceptable | Truncate with ellipsis | Low |
| Weight label "Weight: 47.2 / 50.0 kg" | ~22 chars | 30 chars | 36% | Right-align in RTL; format mirrors | Truncate decimals to integer if needed | Low — numeric format |
| Slot counter "Slots: 18/20" | ~12 chars | 20 chars | 67% | Right-align in RTL | Truncate label, keep numbers | Low |
| Category tab — "Healing" | 7 chars | 16 chars | 128% | Mirror tab position | Abbreviate per locale (e.g., German "Heilung" 7 chars — OK; "Verbrauchsgüter" for Consumables would be ~16 chars) | Medium — "Resource" → German "Ressourcen" or "Materialien" |
| Category tab — "Key Item" | 8 chars | 18 chars | 125% | Mirror tab position | Abbreviate | Medium |
| Weapon slot label "PRIMARY" / "SECONDARY" | 7 / 9 chars | 16 / 20 chars | 128% / 122% | Right-align | Abbreviate to "PRI" / "SEC" with tooltip showing full | Medium — German "PRIMÄR" / "SEKUNDÄR" |
| Item name (Detail Panel) | ~15 chars avg, max ~35 ("Improvised Suppressant Canister") | 50 chars | 43% | Right-align in RTL | Truncate with tooltip showing full name on hover/focus | Medium — long crafted item names possible |
| Item description (Detail Panel) | ~80–120 chars | 250 chars | 100%+ | Right-align in RTL, wrap normally | Scroll within Detail Panel — no truncation | Low — panel is scrollable |
| Action button "Use" | 3 chars | 14 chars | 367% | Button layout mirrors | Truncate to icon-only at minimum width | Medium — German "Benutzen" 8 chars |
| Action button "Equip" | 5 chars | 14 chars | 180% | Mirror | Truncate / shrink to 90% font min | Medium — German "Ausrüsten" 9 chars |
| Action button "Drop" | 4 chars | 14 chars | 250% | Mirror | Same | Medium — German "Ablegen" 7 chars |
| Action button "Assign QS" | 9 chars | 18 chars | 100% | Mirror | Abbreviate to icon + number | Medium |
| Confirmation dialog text "Drop [Item]? It will spawn at your feet." | ~40 chars | 100 chars | 150% | Right-align, wrap | Wrap to 2–3 lines max in dialog | Medium |
| Empty state "No [Category] in inventory." | ~28 chars | 50 chars | 78% | Wrap | Wrap | Low |
| Inventory full toast "[Item] requires [N] slots. Rearrange or drop items to make room." | ~60 chars | 120 chars | 100% | Wrap | Wrap to 2 lines max | Medium |
| Input hint label "Select" / "Context" / "Pick Up/Place" | 6 / 7 / 13 chars | 16 chars | 167% / 129% / 23% | Right-align | Shrink font; ultimately drop verb and keep icon only at extreme expansion | Medium |
| Ammo reserve label "Pistol: 45" | ~10 chars | 16 chars | 60% | Mirror | Truncate | Low |
| Stat row label "Slot Footprint:" | 15 chars | 24 chars | 60% | Mirror | Truncate | Low |
| Quick slot binding label "Assigned: QS 2" | 14 chars | 24 chars | 71% | Mirror | Truncate | Low |
| "Replace Weapon" dialog text | ~45 chars | 100 chars | 122% | Wrap | Wrap | Medium |
| "Stack Split" dialog text | ~30 chars | 80 chars | 167% | Wrap | Wrap | Medium |
| "Newly Acquired" badge text "NEW" | 3 chars | 6 chars | 100% | Mirror — center on badge | Truncate to "!" if extreme overflow | Low |
| Craft tab label "Craft" | 5 chars | 14 chars | 180% | Mirror | Truncate to icon | Medium — German "Herstellen" 10 chars |

---

## 14. Acceptance Criteria

**Performance**
- [ ] Screen opens (first frame visible) within 200ms of IA_Inventory press on minimum-spec hardware (target Intel i5-8400 / 16GB RAM / GTX 1060-equivalent per UE5.7 minimum spec)
- [ ] Screen is fully interactive (all data loaded, focus settled) within 500ms of trigger on minimum-spec hardware
- [ ] Navigation between items produces no perceptible frame drop (maintain 60fps ±5fps with inventory open)
- [ ] World remains rendering at 0.85x timescale behind screen with no stuttering or visibility issues
- [ ] Drag-and-drop maintains 60fps even during the drag operation

**Layout & Rendering**
- [ ] Screen displays correctly at minimum resolution 1280×720
- [ ] Screen displays correctly at 1920×1080 (target reference resolution)
- [ ] Screen displays correctly at 2560×1440 and 3840×2160 (4K) with appropriate UI scaling
- [ ] Screen displays correctly at 16:9, 16:10, and 21:9 (ultrawide) aspect ratios; UI elements stay within safe area
- [ ] No text overflow or truncation in English within defined max-character bounds (per Section 13)
- [ ] No text overflow or truncation in German (longest-translation MVP locale candidate)
- [ ] All states render correctly: Loading, Populated, Item Selected, Empty Category, Combat Interrupt, Error, Confirmation (Drop), Confirmation (Replace Weapon), Stack Split, Crafting Panel Open, Newly Acquired
- [ ] Multi-cell items (rifle 2×2, shotgun 1×3, pistol 1×2) render with a single visual frame spanning all occupied cells
- [ ] Grid layout has no gaps when items of varying footprints are placed
- [ ] Weight bar segment colors correctly transition at 60% and 85% thresholds
- [ ] World dim overlay renders correctly with gameplay still visible at ~30% opacity behind

**Input**
- [ ] All interactive elements reachable by keyboard using Tab/Shift+Tab and arrow keys only
- [ ] All interactive elements reachable by gamepad using D-Pad, left stick, LB/RB, and face buttons only
- [ ] All interactive elements reachable by mouse without keyboard
- [ ] No action requires simultaneous input combinations not documented in Section 7
- [ ] Focus is visible at all times during keyboard/gamepad navigation (2px focus ring, contrast 3:1 minimum)
- [ ] Focus does not escape the screen while it is open; focus traps correctly in modal dialogs
- [ ] Esc/B closes nearest modal first, then closes inventory on second press
- [ ] Input device hot-switch (KB → gamepad mid-session) updates Input Hint Bar within 100ms
- [ ] Controller disconnection while screen is open does not lock input

**Events & Data**
- [ ] All events in Section 9 fire with correct payloads on all exit paths (verify with debug logging + automation tests)
- [ ] Screen does not write directly to any subsystem state (verify via static analysis: no direct mutation calls to InventorySubsystem, only event dispatch)
- [ ] Inventory changes persist correctly after screen is closed and reopened
- [ ] Screen handles `OnItemAdded` / `OnItemRemoved` / `OnItemMoved` events fired by other systems while screen is open without crashing or showing stale data
- [ ] First-fit pickup-while-open correctly updates grid UI within 1 frame of `OnItemAdded`
- [ ] Combat interrupt force-close commits all in-progress state changes (no data loss); any open modal is dismissed without action

**Accessibility**
- [ ] All text passes minimum contrast ratios specified in Section 12 (verified with accessibility checker tool)
- [ ] Weight bar color thresholds do not rely on color alone (numeric label + threshold icons present)
- [ ] Item category indicators do not rely on color alone (icon glyph in cell corner + category label in Detail Panel)
- [ ] Weapon condition does not rely on color alone (text label + bar count)
- [ ] Comparison deltas do not rely on color alone (+/- prefix + ↑/↓ arrow)
- [ ] Drag target highlight does not rely on color alone (icon overlay + outline style)
- [ ] Screen reader announces all state changes per Section 12 table (verify with NVDA / Windows Narrator)
- [ ] Reduced motion setting results in instant transitions per Section 10 column (no slides, no scales, no pulses; only color/state changes that are not motion-based)
- [ ] All actions reachable without precise timing (no quick-time-event-like interactions)
- [ ] Focus ring is visible against all backgrounds including dark world backdrop showing through

**Localization**
- [ ] No text element overflows its container in any supported language at MVP scope (English minimum; German and French at Alpha)
- [ ] All text elements are driven by localization strings (`LOCTEXT` macros) — no hardcoded display text
- [ ] Numeric formatting (weight, slots, ammo) respects locale (decimal separator: "47.2" en-US vs "47,2" de-DE)
- [ ] RTL layout (forward-compatibility — not MVP) mirrors zones correctly when enabled

**Functional**
- [ ] Player can equip a weapon from grid to Primary or Secondary slot via drag, double-click, or context menu
- [ ] Player can unequip a weapon from a weapon slot back to grid (Replace Weapon flow or explicit Unequip action)
- [ ] Player can use a Healing consumable; HP regenerates per Health System rules; weight decreases per Formula 3
- [ ] Player can drop an item (with confirmation); item spawns at player's feet in world
- [ ] Player can move items within grid via drag-and-drop or pick-up/place (gamepad)
- [ ] Player can split a stack using Shift+drag or hold-X
- [ ] Player can assign a Healing/Cure/Throwable item to one of 4 quick slots; binding persists
- [ ] Player can filter grid by category; "All" shows everything
- [ ] Pickup-while-open succeeds (first-fit) when capacity allows; toast appears when it fails
- [ ] At Workbench: Craft tab appears, Crafting Panel opens, recipes display correctly with ingredient counts; greyed when missing resources; Workbench recipes hidden when not at Workbench
- [ ] Combat interrupt force-closes screen within 0.1s; world timescale returns to 1.0x

---

## 15. Open Questions

| Question | Owner | Deadline | Resolution |
|----------|-------|----------|-----------|
| Should the Inventory screen include a "Sort" action (alphabetical, by category, by weight)? GDD defers auto-sort to Alpha. | ux-lead + game-designer | Alpha planning | Deferred per Inventory GDD Deferred Content table. Not in MVP / Vertical Slice. |
| Should there be a "quick-drop" hotkey accessible while the inventory is open (e.g., Delete key drops currently focused item without the confirmation dialog)? | ux-lead + game-designer | Playtest after MVP | Pending. Default: confirmation always required. |
| Visual style of category color borders (saturated vs. desaturated, thickness, inner glow vs. flat outline) | art-director | Art bible review | Pending art-director sign-off. Functional spec (color + glyph) defined here; aesthetic execution deferred. |
| Final accent color palette for active Category Tab and Action Buttons | art-director | Art bible review | Pending art-director. Spec uses placeholder values; contrast ratios must be re-validated against final palette. |
| Should the Detail Panel be split-scrollable (separate scroll regions for stats vs. description) or single-scrollable? | ux-lead | Implementation start | Default: single-scrollable for simplicity. Re-evaluate if description length consistently exceeds 4 lines. |
| Should "Inspect" (3D model viewer) be implemented at MVP, or deferred? | game-designer + art-director | Vertical Slice planning | Deferred to Vertical Slice. Spec includes Inspect as a context menu option but the action is no-op at MVP with a "Coming soon" toast (or item is removed from the menu — decision pending). |
| Exact placement and visual style of the "World Available Behind Inventory" backdrop (full dim vs. partial vs. blur) | art-director | Art bible review | Default: 70% dim, no blur (perf-friendly). Re-evaluate if visibility through inventory is too distracting. |
