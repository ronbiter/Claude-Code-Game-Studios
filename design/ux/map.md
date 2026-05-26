# UX Specification: World Map

> **Status**: Draft
> **Author**: ux-lead
> **Last Updated**: 2026-05-26
> **Screen / Flow Name**: `WorldMapScreen`
> **Platform Target**: PC (Keyboard/Mouse primary, Gamepad secondary)
> **Related GDDs**: `design/gdd/map-system.md`, `design/gdd/quest-system.md`, `design/gdd/faction-reputation-system.md`, `design/gdd/infection-spread-system.md`
> **Related ADRs**: `ADR-0003: Enhanced Input Architecture`, `ADR-0002: Game State Machine`, `ADR-0008: Scene Streaming Architecture`, `ADR-0016: HUD System Architecture`
> **Related UX Specs**: `design/ux/quest-journal.md` (sibling tab — deep-link source)
> **Accessibility Tier**: Standard (WCAG 2.1 AA)

> **Scope boundary**: This spec covers the full-screen World Map (opened via `IA_Map` hold or from the Pause Menu Map tab). The Minimap compass ring is a persistent HUD element and is covered in `hud-design.md` (out of scope here). Fast travel is explicitly excluded — Map System GDD Rule 6: "must not be stubbed or partially implemented at Vertical Slice."

---

## 1. Purpose & Player Need

**What player need does this screen serve?**

The World Map answers two questions the player asks constantly in Hostile World: *"Where am I, and where is the thing I am trying to reach?"* The game has no fast travel, no in-world quest waypoints in Immersive HUD mode, and an actively transforming infection that closes routes the player relied on yesterday. The map is the player's planning surface — the moment between deciding to act and acting. It also serves a quieter need: *to be confronted with what they have not yet discovered.* Most of the map is black. That blackness is the game telling the player there is more world out there, earned only by walking into it (Pillar 2 — Earned Discovery).

**The player goal** (what the player wants to accomplish):

Locate a quest objective, safehouse, or workbench they have either discovered or been pointed to, understand the route between their current position and that point, and assess the danger along the way (infection spread, faction territory) — within 15 seconds of opening the map.

**The game goal** (what the game needs to communicate or capture):

Reveal only what the player has earned (fog-of-war integrity per Map GDD Rule 1), surface the dynamic infection state in real time (Pillar 1 — Hostile World transforms in real time), expose faction territory standing so players can avoid hostile zones, and receive deep-link requests from the Quest Journal to center on a specific objective.

---

## 2. Player Context on Arrival

| Question | Answer |
|----------|--------|
| What was the player just doing? | Most common: traversing a zone and unsure of direction. Less common: closed the Quest Journal via Show on Map to confirm a route. Less common: just exited a safehouse and planning the next leg. Less common: returning from a long expedition and curious whether infection has spread to known zones. |
| What is their emotional state? | Variable. Mid-zone openings have moderate tension. Pause Menu openings are calm. Show-on-Map deep-links are focused — the player just expressed a specific intent. |
| What cognitive load are they carrying? | Variable. Map is the highest-density UI screen in the game — terrain, fog edges, multiple marker types, infection overlay, faction territories. The player needs to filter to the slice they care about right now. |
| What information do they already have? | They know roughly where they are in the world. They may know the name of the location they are looking for (from a quest description or NPC dialogue). They do not know exact positions of undiscovered locations. |
| What are they most likely trying to do? | Primary (50%): locate a known point of interest and plan a route. Secondary (20%): check infection spread in a zone they will return to. Tertiary (15%): drop a manual marker on a landmark they spotted in the world. Tertiary (10%): browse what they have discovered (curiosity). Rare (5%): clear stale manual markers. |
| What are they likely afraid of? | Getting lost. Walking into a faction's hostile territory by accident. Returning to a safehouse that has been overrun by infection while they were away. Missing that an objective is on the other side of a now-infected zone. |

**Emotional design target for this screen**:

Considered awareness. The map is hand-drawn, sketchy, weighty — it feels like a physical artifact the protagonist is unfolding on a table. Information density is high but presentation is restrained — no twinkling animations, no flashy quest markers pulsing for attention (except the focus ring on deep-link arrival). The player should feel they are reading a map, not playing a UI.

---

## 3. Navigation Position

**Screen hierarchy**:

```
Gameplay (Playing state)
  ├── IA_Map (hold) ──► World Map overlay (Paused sub-state)
  │                       └── Filter panel (overlay-within-overlay)
  │                       └── Manual marker placement mode (in-place state)
  │                       └── Pin context menu (popover)
  └── IA_Pause ──► Pause Menu (Paused state)
                    └── Map tab ──► World Map (same screen, parent shell different)
                          └── Filter panel
                          └── Manual marker placement mode
                          └── Pin context menu
```

The World Map is the **same content** rendered in two contexts: as a standalone overlay (from gameplay) or as a tab within the Pause Menu (sibling of Quest Journal). The internal layout, marker system, and inputs are identical. The shell — title bar and exit behavior — differs.

**Modal behavior**: Overlay (Map GDD Rule 4: "Pauses world time. GSM transitions to Paused state. Map is a UI overlay within Paused.").

Dismiss behavior:
- From gameplay overlay context: `IA_Map` hold again or `IA_Cancel` returns directly to Playing state.
- From Pause Menu context: `IA_Cancel` returns to Pause Menu tab bar (one back-step). `IA_Map` hold from this context closes the entire Pause Menu and returns to Playing state.

**Reachability — all entry points**:

| Entry Point | Triggered By | Notes |
|-------------|-------------|-------|
| `IA_Map` hold from Playing | Player holds the Map input in gameplay | Primary entry — direct overlay push. GSM transitions to Paused. |
| Pause Menu → Map tab | Player presses `IA_Pause`, then activates Map tab | Secondary entry — same content, different shell |
| Quest Journal → Show on Map | Player activates "Show on Map" on a quest with mappable objective | Deep-link entry — passes payload, centers on target, shows focus ring |
| Lore Note → Show on Map | Player activates "Show on Map" on a consequence Lore Note that has a world position | Deep-link entry — same as Quest Journal |
| First-time map tutorial trigger | Tutorial system on first map open after spawn | One-time entry — overlays a brief legend explainer over the standard map. Per Map GDD UI Requirements: "No map legend or tutorial overlay at MVP." Therefore: NOT included at Vertical Slice. Listed here for traceability only. |

---

## 4. Entry & Exit Points

**Entry table**:

| Trigger | Source Screen / State | Transition Type | Data Passed In | Notes |
|---------|----------------------|-----------------|----------------|-------|
| `IA_Map` hold | Playing state | Overlay push (game pauses) | None — map reads world state | Default zoom: Overview. Default center: player position. |
| Pause Menu Map tab activation | Pause Menu tab bar | Tab swap (Paused already) | None | Same defaults as above |
| `QuestJournalShowOnMapRequested` event | Quest Journal | Tab swap (sibling) or overlay swap | `{quest_id, objective_id, world_position}` | Default zoom: Detail. Default center: `world_position`. Focus ring renders around target marker for 3s. |
| Consequence Lore Note → Show on Map | Quest Journal Lore Notes tab | Tab swap | `{note_id, world_position}` | Same as Show-on-Map deep-link from active quest |
| Manual marker placement mode | Player initiates from within map (Q / X button) | In-place state change | None | Map remains open; cursor becomes a placement reticle |
| Pin context menu | Player selects an existing pin (Enter / A) | Popover | `pin_id` | Popover anchors to selected pin position |
| Filter panel | Player activates filter input (F / Y) | Side-panel slide-in | None | Map remains visible and interactive behind the panel |

**Exit table**:

| Exit Action | Destination | Transition Type | Data Returned / Saved | Notes |
|-------------|------------|-----------------|----------------------|-------|
| `IA_Map` hold (from gameplay overlay context) | Playing state | Overlay pop (game resumes) | None — map state is persisted via Save/Load on manual marker changes only | Standard close per Map GDD Rule 4 |
| `IA_Cancel` (from gameplay overlay context) | Playing state | Overlay pop | None | Same as IA_Map close |
| `IA_Cancel` (from Pause Menu context) | Pause Menu tab bar | Tab deselect | None | One back-step — does not close Pause Menu |
| Quest Journal tab activation | Quest Journal screen | Tab swap | None — Quest Journal restores its own selection state | Sibling tab navigation within Pause Menu |
| Manual marker placed | Same screen, refreshed | In-place state change | `world_position` to Map Subsystem via event | Map refreshes to show new marker; mode exits |
| Manual marker placement canceled | Same screen | In-place mode exit | None | Mode exits without writing a marker |
| Pin context menu activates "Remove Marker" | Same screen | In-place state change | `marker_id` to Map Subsystem via event | Marker removed; popover closes |
| Pin context menu canceled | Same screen | Popover dismiss | None | |
| Filter panel close | Same screen | Side-panel slide-out | Filter state to Map Subsystem | Filters persist for the session (Map GDD does not require persistence across sessions; aligns with Minimap toggle policy) |

---

## 5. Layout Specification

### 5.1 Wireframe

**Overview zoom (default on open):**

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  HOSTILE WORLD                                            [X Close]  [? Help]│  ← PAUSE MENU SHELL (only in Pause Menu context)
│  [Resume]  [Journal]  [● Map]  [Character]  [Settings]  [Quit]               │  ← PAUSE MENU TAB BAR (only in Pause Menu context)
├──────────────────────────────────────────────────────────────────────────────┤
│  WORLD MAP                          [Filter]  [Overview / Detail]            │  ← MAP HEADER (always)
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│                   ▓▓▓▓▓▓▓▓▓                                                 │
│              ▓▓▓▓▓░░░░░░░░▓▓▓▓▓                                             │
│           ▓▓▓░░░░░{Safehouse}░░░▓▓▓                       ▓▓▓▓▓             │
│         ▓▓░░░░░░░░░░░░░░░░░░░░▓▓                      ▓▓▓░░░░░▓▓           │
│        ▓░░░░{Workbench}░░░░░░░░▓                    ▓▓░░░{Quest}░▓         │
│       ▓░░░░░░░░░░░░░░░░░░░░░░░░▓                   ▓░░░░░░░░░░░░▓          │
│        ▓░░░░░{● PLAYER}░░░░░░░▓                     ▓░░░{Infect}░▓         │
│         ▓░░░░░░░░░░░░░░░░░░░░▓                       ▓░░░░░░░░░▓           │
│          ▓░░░{Investig.}░░░▓▓                          ▓▓▓▓▓▓              │
│            ▓▓▓░░░░░░░▓▓▓▓                                                   │
│              ▓▓▓▓▓▓▓▓                                                       │
│                                              ┌── REMNANT TERRITORY ──┐     │
│                                              │       (KNOWN)         │     │
│                                              │   ▓▓░░░░░░░░░░░░▓▓    │     │
│                                              │  ▓░░░░░░░░░░░░░░░░▓   │     │
│                                              │  ▓░░░{Hive}░░░░░░░▓   │     │
│                                              │   ▓▓░░░░░░░░░░░░▓▓    │     │
│                                              └───────────────────────┘     │
│                                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│ [Place Marker] [Remove Marker] [Zoom: Overview]            N E S W           │  ← ACTION BAR + COMPASS
└──────────────────────────────────────────────────────────────────────────────┘

Legend:
  ▓░  = soft fog reveal edge (gradient)
  blank = fully revealed, drawn terrain
  ▓▓▓ = unrevealed (fully fogged, solid black)
  ● = player position with facing arrow
  {Name} = pin with name label on hover/focus
```

**Detail zoom (after Show on Map deep-link or scroll-zoom in):**

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  WORLD MAP — Detail View          [Filter]  [Overview / ● Detail]            │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│       ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░                                  │
│      ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░                                 │
│     ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░                                │
│    ░░░░░░░{Workbench}░░░░░░░░░░░░░░░░░░░░░░░░                              │
│    ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░                               │
│    ░░░░░░░░░░░░{● PLAYER}░░░░░░░░░░░░░░░░░░░░░                             │
│    ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░                              │
│    ░░░░░░░░░░░░░░░░░░░░╭───────────────╮░░░░░                              │
│    ░░░░░░░░░░░░░░░░░░░░│ ⊚ FOCUS RING  │░░░░░░░                            │
│    ░░░░░░░░░░░░░░░░░░░░│ {Lab Entrance}│░░░░░░░░                           │
│    ░░░░░░░░░░░░░░░░░░░░╰───────────────╯░░░░░░░░                           │
│    ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░                           │
│       ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░                             │
│                                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│  SELECTED: Locate the lab entrance — Find the Military Lab (Conspiracy Thread)│
│ [Set as Waypoint] [Back to Journal]      [Zoom: Detail]    N E S W           │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Filter panel (slides in from right edge):**

```
                                      ┌────────────────────────────┐
                                      │  FILTERS                   │
                                      │  ─────────────────────     │
                                      │  ☑ Quest objectives        │
                                      │  ☑ Quest givers            │
                                      │  ☑ Conspiracy threads      │
                                      │  ☑ Safehouses              │
                                      │  ☑ Workbenches             │
                                      │  ☑ Investigation sites     │
                                      │  ☑ Infection zones (pins)  │
                                      │  ☑ Manual markers          │
                                      │  ─────────────────────     │
                                      │  OVERLAYS                  │
                                      │  ☑ Infection heatmap       │
                                      │  ☑ Faction territories     │
                                      │  ─────────────────────     │
                                      │  [Reset]    [Close]        │
                                      └────────────────────────────┘
```

### 5.2 Zone Definitions

| Zone Name | Description | Approximate Size | Scrollable? | Overflow Behavior |
|-----------|-------------|-----------------|-------------|-------------------|
| Pause Menu Shell (Header + Tab Bar) | Visible only in Pause Menu context | Full width, ~11% height | No | Inherited from Pause Menu shell |
| Map Header | "WORLD MAP" title, Filter button, Zoom toggle | Full width, ~5% height | No | Truncate title in narrow aspect ratios |
| Map Canvas | The actual map — terrain, fog, pins, overlays | Full width, ~80-86% height (depending on shell context) | Yes — pan via stick / mouse drag; zoom via wheel / R-stick | Pan is bounded by zone extents — no infinite scroll |
| Action Bar | Context actions for current map state | Full width, ~9% height | No | Actions hide when not applicable (Set as Waypoint shows only when a pin is focused) |
| Compass Strip | Cardinal directions, right-aligned in Action Bar | ~20% of Action Bar width | No | Always visible |
| Filter Panel | Overlay on right edge, slides in on demand | ~25% width, ~80% height | Yes (vertical, if filter list exceeds panel) | Wraps to scrollable list. Hides entire map canvas focus while open (panel is modal-within-map). |
| Pin Context Popover | Anchored to selected pin | ~180px × ~120px | No | Repositions to stay on-screen if pin is near canvas edge |
| Selected Pin Info Strip | Above Action Bar when a pin is focused on a Show-on-Map deep-link or Detail zoom selection | Full width, ~5% height | No | Truncate with ellipsis |

### 5.3 Component Inventory

| Component Name | Type | Zone | Purpose | Required? | Reuses Existing Component? |
|----------------|------|------|---------|-----------|---------------------------|
| PauseMenuShell | Container | Shell (when in Pause Menu context only) | Shared shell across pause tabs | Yes (in PM context) | Yes — `WBP_PauseMenuShell` |
| MapHeader | Container | Map Header | Title + filter button + zoom toggle | Yes | No — new |
| FilterButton | Button | Map Header | Opens Filter Panel | Yes | Yes — `IconButton` component |
| ZoomToggle | Segmented Control | Map Header | Switches Overview / Detail zoom | Yes | No — new |
| MapCanvas | Custom Render Surface | Map Canvas | Renders terrain layer, fog layer, overlay layer, pin layer | Yes | No — new (largest custom component on this screen) |
| TerrainLayer | Layer | MapCanvas | Hand-drawn map texture, generated per zone | Yes | No — new |
| FogLayer | Layer | MapCanvas | Renders fog-of-war bitmask with soft edge | Yes | No — new |
| InfectionOverlay | Layer | MapCanvas | Color-tinted heatmap of cell infection levels | Yes | No — new |
| FactionTerritoryOverlay | Layer | MapCanvas | Dashed-border polygons per faction zone, color by standing | Yes | No — new |
| PinMarker | Compound | MapCanvas | One marker — icon + optional name label + selection ring | Yes | No — new (used for all 9 marker types) |
| PlayerPositionMarker | Compound | MapCanvas | Player arrow with facing direction, subtle 1Hz pulse | Yes | No — new |
| ManualMarkerPin | Compound (PinMarker variant) | MapCanvas | Red pin, removable | Yes | Yes — variant of PinMarker |
| FocusRing | Decorative | MapCanvas | Animated ring around a target pin after Show-on-Map deep-link | Yes | No — new |
| ActionBar | Container | Action Bar | Context buttons | Yes | Yes — `WBP_ActionBar` (shared with Quest Journal) |
| SetAsWaypointButton | Primary Button | Action Bar | Places a manual marker at selected pin location | Yes | Yes — `PrimaryAction` |
| PlaceMarkerButton | Button | Action Bar | Enters manual marker placement mode | Yes | Yes — `SecondaryAction` |
| RemoveMarkerButton | Destructive Button | Action Bar | Removes the focused manual marker (only when one is selected) | Yes | Yes — `DestructiveAction` |
| BackToJournalButton | Button | Action Bar | Returns to Quest Journal (only visible after a Show-on-Map deep-link) | Yes | Yes — `SecondaryAction` |
| ZoomLabel | Text | Action Bar | "Zoom: Overview" / "Zoom: Detail" | Yes | Yes — `BodyText` |
| Compass | Compound | Action Bar | N E S W cardinal labels | Yes | No — new |
| FilterPanel | Side Panel | Filter Panel zone | Toggle marker categories and overlays | Yes | No — new |
| FilterCheckbox | Compound (checkbox + label) | FilterPanel | One filter row | Yes | Yes — `Checkbox` component |
| PinContextPopover | Popover | Anchored to pin | Pin name + actions (Set Waypoint / Remove / Close) | Yes | Yes — `Popover` component |
| SelectedPinInfoStrip | Container | Above Action Bar | Selected objective / pin name + parent quest reference | Yes | No — new |
| MarkerLimitToast | Toast | Overlay (bottom-center) | "Marker limit reached — remove one to add another." | Yes | Yes — `Toast` component (per Map GDD UI Requirements) |
| EmptyState — Undiscovered Zone | Compound | MapCanvas | When player is in a zone with zero revealed tiles, shows a hint text "Walk into the world to reveal the map." | Yes | Yes — `EmptyState` component |
| ErrorState — Map Data | Compound | Replaces MapCanvas | If Map Subsystem returns null | Yes | Yes — `ErrorState` |
| LoadingShimmer | Skeleton | Replaces MapCanvas briefly on open | Skeleton while fog bitmask + pins resolve | Yes | Yes — `Skeleton` |

**Primary focus element on open**:
- Direct open from gameplay or Pause Menu: `MapCanvas` itself, with the pan cursor centered on the player. No specific pin is focused by default. Action Bar buttons are reachable via Tab.
- Show-on-Map deep-link: the target pin is focused (the FocusRing renders around it). Action Bar updates to show "Set as Waypoint" and "Back to Journal" as the primary and secondary actions.

---

## 6. States & Variants

| State Name | Trigger | What Changes Visually | What Changes Behaviorally | Notes |
|------------|---------|----------------------|--------------------------|-------|
| Loading | Map opens, Map Subsystem fetching fog bitmask + pins + infection state | Skeleton shimmer over MapCanvas; ActionBar buttons disabled | Only IA_Cancel and tab swap active | Should resolve in <200ms — data is in subsystem memory, not disk. If >500ms, log a perf warning. |
| Empty — Fresh Spawn (No Reveal Yet) | New game, player has not moved from spawn | MapCanvas mostly black; small revealed area at spawn point with player position marker; EmptyState hint text overlays the black: "Walk into the world to reveal the map." | All standard inputs active; no pins to focus | Per Map GDD AC1 |
| Populated — Standard (Overview Zoom) | Default state any time after early game | Revealed terrain visible, fog edges feathered, all enabled-filter pins rendered, infection overlay tinted on infected cells, faction territories dashed, player position pulsing at 1Hz | All inputs active; pin focus enables Set as Waypoint | Most common state |
| Populated — Detail Zoom | Player scroll-zooms in OR arrives via Show-on-Map deep-link | Same content, scaled up ~3x; pin labels are larger and always visible (not hover-only) | Pan range adjusts; double-tap on a pin re-centers on it | |
| Show-on-Map Deep-Link Arrival | Quest Journal fired event with payload | Map opens at Detail zoom centered on `world_position`. FocusRing renders around the target pin and pulses for 3s. SelectedPinInfoStrip shows the parent quest name. Action Bar shows Set as Waypoint + Back to Journal. | Target pin is focused on arrival | If the target pin is in a fogged area (Map GDD EC2: "punches through fog as a small marker"), the marker is visible but surrounding terrain is still fogged |
| Pin Focused | Player navigates to a pin via D-Pad / arrow keys OR clicks a pin | Pin shows selection ring; name label expands; SelectedPinInfoStrip shows pin name and metadata | Action Bar shows pin-specific actions (Set as Waypoint, Remove if manual) | |
| Pin Context Popover Open | Player presses Enter / A on a focused pin OR right-clicks on PC | Popover anchored to pin with [Set as Waypoint] / [Remove] / [Close] | All other inputs deferred to popover scope | |
| Manual Marker Placement Mode | Player activates Place Marker action | Cursor changes to placement reticle. Map canvas dims overlays slightly. Action bar replaced with "[Click to Place] [Esc Cancel]" | Click / Enter places marker. Esc / B cancels mode. Cannot place on fogged tile (cursor shows ✗ over fog). | Per Map GDD Rule 3 and AC6 |
| Manual Marker Limit Reached | Player attempts to place an 11th manual marker | MarkerLimitToast appears at bottom-center for 3s: "Marker limit reached — remove one to add another." Placement mode remains active. | Placement blocked until a marker is removed | Per Map GDD Rule 3, AC7 |
| Filter Panel Open | Player activates Filter button or F / Y shortcut | Filter Panel slides in from right; map canvas remains visible behind | Focus moves into panel; clicking outside the panel closes it | |
| Filter Applied (Some Off) | Player toggles a filter off | Affected pin category fades out (200ms); overlay layer fades out | Map remains interactive; filter state persists for session | Filters do NOT persist across game sessions — consistent with Map GDD Minimap toggle policy |
| Infection Overlay Refresh | Every 10 seconds while map is open (matches infection tick rate) | Cells with changed infection level re-tint (cross-fade 200ms) | No input change | Refresh only re-renders the overlay layer, not the entire canvas |
| Game-State Update — Quest State Changed | Quest Subsystem fires `OnQuestStateChanged` while map is open (rare — game is paused) | Affected quest pins update their state (e.g., a completed objective pin removes; a new CTQ pin appears) | No input change | Map subscribes to relevant event channels |
| Error — Map Data Load Failed | Map Subsystem returns null | ErrorState replaces MapCanvas: "Could not load map. [Retry]" | Only Retry and Esc/Close active | Should not happen — fog and pins are subsystem state, not disk reads |
| Reduced Motion | OS-level Reduced Motion detected | Player pulse disabled (static arrow); FocusRing no pulse (static glow); fog reveal animation skipped (instant edge) | Standard inputs unaffected | Per Section 12 |

---

## 7. Interaction Map

### 7.1 Navigation Inputs

| Input | Platform | Action | Visual Response | Audio Cue | Notes |
|-------|----------|--------|-----------------|-----------|-------|
| Left stick / WASD / Mouse drag | All | Pan map | Map content shifts; player position scrolls off-center | Subtle paper rustle (very low volume, only on drag) | Pan bounded by zone extents |
| Right stick / Mouse wheel | All | Zoom in / out | Smooth zoom between Overview and Detail levels | Soft zoom tone | Only two discrete levels per Map GDD; wheel snaps to Detail past midpoint and Overview below |
| Scroll wheel click / R3 | KB / Gamepad | Re-center on player | Map snaps back to player position at current zoom | Soft center tone | |
| D-Pad / Arrow keys | All | When no pin focused: pan map (slower than stick). When pin focused: move focus to nearest pin in that direction. | Pin focus ring jumps; map auto-pans if focused pin would leave view | Soft navigation tick | "Nearest pin" uses angular bias toward input direction |
| Tab / RB | KB / Gamepad | Move focus to next zone: Map Canvas (pin cycling) → Action Bar → Map Header → cycles | Focus indicator jumps | Distinct zone-change tone | Within MapCanvas, Tab cycles through visible pins in screen-left-to-right order |
| Shift+Tab / LB | KB / Gamepad | Reverse zone cycling | Same | Same | |
| Q / E / LB / RB | KB / Gamepad | (In Pause Menu context only) Cycle Pause Menu tabs (Journal ↔ Map ↔ Character) | Tab indicator slides | Tab swap tone | Not bound in standalone overlay context |
| Mouse hover over pin | PC | Show pin name label as tooltip | Label expands smoothly | None | Hover does not move keyboard focus |
| Mouse click on pin | PC | Focus the pin; SelectedPinInfoStrip populates | Pin selection ring appears | Soft select tone | Double-click: re-center map on pin |
| Mouse click on empty terrain | PC | Deselect any focused pin | Selection ring clears | None | |
| Right-click on pin (PC) | PC | Open PinContextPopover anchored to pin | Popover appears | Menu open tone | |
| Right-click on empty terrain | PC | No-op (no context menu on empty terrain — placement uses dedicated action) | None | None | |

### 7.2 Action Inputs

| Input | Platform | Context | Action | Response | Animation | Audio Cue | Notes |
|-------|----------|---------|--------|----------|-----------|-----------|-------|
| Enter / A / Left click | All | Pin focused | Open PinContextPopover | Popover scales 95%→100% | 80ms ease out | Menu open tone | |
| Q / X (gamepad) / dedicated input | All | Any (standard map state) | Enter Manual Marker Placement Mode | Cursor becomes placement reticle; canvas overlays dim slightly | 120ms cross-fade | Mode-enter tone | Per Map GDD Rule 3 |
| Enter / A / Left click | All | Manual Marker Placement Mode, cursor over revealed tile | Place a manual marker at cursor world position | Marker pop-in animation; mode exits; canvas restores | 200ms scale-pop | Light pin-drop click (per Map GDD audio) | Per Map GDD AC6 |
| Enter / A / Left click | All | Manual Marker Placement Mode, cursor over fogged tile | Block placement | Cursor briefly flashes ✗ glyph | 100ms | Soft error tone | Per Map GDD UI Requirements |
| Esc / B | All | Manual Marker Placement Mode | Cancel placement, exit mode | Reticle dismisses, canvas restores | 120ms | Cancel tone | |
| Backspace / X (gamepad) | KB / Gamepad | Manual marker focused | Remove marker (after confirm) | Marker fades out | 150ms | Soft pull/pop (per Map GDD audio) | No confirmation dialog for manual markers — single back-step removal is standard map convention |
| Backspace / X (gamepad) | KB / Gamepad | Manual Marker Placement Mode + Selected previous marker | (Not applicable — placement mode only places, does not remove) | N/A | N/A | N/A | |
| F / Y (gamepad) | KB / Gamepad | Any standard state | Open Filter Panel | Panel slides in from right | 250ms ease out | Panel open tone | |
| F / Y / Esc | KB / Gamepad | Filter Panel open | Close Filter Panel | Panel slides out | 250ms ease in | Panel close tone | Esc closes panel (does NOT close map) when panel is the topmost overlay |
| Z / View button (gamepad) | KB / Gamepad | Any state | Toggle Overview / Detail zoom | Smooth zoom transition | 250ms ease in-out | Soft zoom tone | Equivalent to scroll wheel zoom but discrete |
| C / Right stick click | KB / Gamepad | Any state | Re-center on player | Map snaps to player position | 200ms ease out | Soft center tone | |
| Enter / A | All | "Set as Waypoint" button focused | Place a manual marker at the focused pin's location | Same as standard manual marker placement | Same as placement | Pin-drop click | Convenience — auto-places at pin without entering placement mode. Still counts against MaxManualMarkers. |
| Enter / A | All | "Back to Journal" button focused (deep-link context only) | Return to Quest Journal | Tab swap (Pause Menu) or replace overlay (gameplay context — closes map and opens Journal as overlay) | 200ms tab swap or 200ms cross-fade | Back tone | Restores Journal's quest selection state |
| `IA_Map` hold | All | Standard map state, gameplay overlay context | Close map | Overlay pops; GSM Playing | 200ms slide-out | Paper fold sound (per Map GDD audio) | Per Map GDD Rule 4 |
| Esc / B | All | Standard map state, gameplay overlay context | Close map | Overlay pops; GSM Playing | 200ms | Back tone | Equivalent to IA_Map close |
| Esc / B | All | Standard map state, Pause Menu context | Return to Pause Menu tab bar | Tab deselect | 180ms cross-fade | Back tone | One back-step |

### 7.3 State-Specific Behaviors

| State | Input Restriction | Reason |
|-------|------------------|--------|
| Loading | Only IA_Cancel and tab swap active | No data to act on |
| Manual Marker Placement Mode | Pan and zoom remain active; pin focus disabled; only Enter (place) and Esc (cancel) for actions | Mode is a dedicated input context |
| Filter Panel open | Map canvas pan/zoom disabled; focus trapped in panel; Esc closes panel only | Panel is modal-within-map |
| Pin Context Popover open | Map canvas pan/zoom disabled; focus trapped in popover | Popover is modal-within-map |
| Marker Limit Toast visible | All inputs remain active; toast is non-blocking | Informational only |
| Error state | Only Retry and Esc Back active | No map data available |
| Show-on-Map Deep-Link Arrival (during FocusRing 3s window) | All inputs active; FocusRing is decorative only | FocusRing does not gate input |

---

## 8. Data Requirements

| Data Element | Source System | Update Frequency | Who Owns It | Format | Null / Missing Handling |
|--------------|--------------|-----------------|-------------|--------|------------------------|
| Fog-of-war bitmask | Map Subsystem | On screen open; on `FogRevealUpdated` event (during gameplay, while map is closed, the bitmask accumulates) | Map Subsystem | `TArray<uint8>` per zone — bitmask per Map GDD F3 | Empty/missing → assume fully fogged (per Map GDD AC1) |
| Pin list | Map Subsystem | On screen open; on `OnLocationPinned`, `OnZoneInfected`, `OnClueDiscovered` while open | Map Subsystem | Array of `FMapPin`: `{pin_id, pin_type, world_position, display_name, faction_id (optional), severity (optional, infection only)}` | Empty → no pins rendered (valid state for fresh game) |
| Quest objective pins | Quest Subsystem | On screen open; on `OnQuestStateChanged` while open | Quest Subsystem | Array of `FQuestPin`: `{quest_id, objective_id, quest_type, world_position, is_optional}` | Empty → no quest pins (valid state) |
| Conspiracy Thread pins | Quest Subsystem (CTQ-specific) | Same as above | Quest Subsystem | Same as FQuestPin with `quest_type = Thread` | Empty → no thread pins (valid state) |
| Infection cell levels | Infection Spread Subsystem | On screen open; refresh every 10 seconds while open (matches infection tick) | Infection Spread Subsystem | `TMap<FIntPoint, float>` — cell coords → infection level (0-100) | Empty map → infection overlay renders all-clean (green) |
| Faction territory polygons | Faction Reputation Subsystem (with help from Scene Management for zone geometry) | On screen open; on `OnFactionStandingChanged` while open | Faction Reputation Subsystem | Array of `FFactionTerritory`: `{faction_id, polygon: TArray<FVector2D>, current_standing_tier}` | Empty → no faction overlays (early game state) |
| Manual marker list | Map Subsystem | On screen open; on marker placement/removal | Map Subsystem | Array of `FManualMarker`: `{marker_id, world_position}` | Empty → no manual markers (valid state) |
| Player world position | Player Controller | Read once on map open; refreshed when map re-renders (game is paused, so position is static) | Player Controller | `FVector` | Never null in active gameplay |
| Player facing direction | Player Controller | Read once on map open | Player Controller | `FRotator` (yaw only used) | Never null |
| Current zone ID | Scene Management | Read on map open | Scene Management | `FName` | If null → default to root zone (should never happen in active play) |
| Filter state | Map UI Local State | Read on map open; written on filter toggle | This screen (transient UI state) | `TMap<EFilterType, bool>` | Default all on |
| Deep-link payload | Event payload from Quest Journal | One-shot on entry | Quest Subsystem (event source) | `{quest_id, objective_id, world_position}` | Optional — if absent, map opens in standard mode |

> **Rule**: Map screen reads from all subsystems above. It writes only to Map Subsystem (manual markers) and only via events (Section 9).

---

## 9. Events Fired

| Player Action | Event Fired | Payload | Receiver System | Notes |
|---------------|-------------|---------|-----------------|-------|
| Player places a manual marker | `MapMarkerPlaceRequested` | `{world_position: FVector}` | Map Subsystem | Map Subsystem validates (not fogged, not over existing pin per Map GDD UI Requirements, within MaxManualMarkers limit), generates marker_id, fires `OnLocationPinned` for re-render |
| Player removes a manual marker | `MapMarkerRemoveRequested` | `{marker_id: string}` | Map Subsystem | Map Subsystem removes and fires `OnMarkerRemoved` |
| Player "Set as Waypoint" on an existing pin | `MapMarkerPlaceRequested` | `{world_position: FVector}` (the pin's position) | Map Subsystem | Same as standard placement. Adds a manual marker overlapping the pin position. |
| Player activates "Back to Journal" | `MapBackToJournalRequested` | `{quest_id: string}` (the deep-link's source quest) | UI Navigation Controller + Quest Journal screen | Journal restores selection on the source quest |
| Player toggles a filter | `MapFilterChanged` | `{filter_type: enum, is_enabled: bool}` | Map UI Local State + Analytics System | Filter state is local to this screen for the session |
| Player changes zoom level | `MapZoomChanged` | `{zoom_level: "overview" \| "detail"}` | Analytics System | Session metric |
| Player pans the map | `MapPanned` | (throttled, only sent every 5s with cumulative pan distance) | Analytics System | Session metric — throttled to avoid event spam |
| Map screen opens | `MapScreenOpened` | `{entry_method: "ia_map" \| "pause_menu_tab" \| "deep_link", zoom: enum}` | Analytics System | |
| Map screen closes | `MapScreenClosed` | `{session_duration_ms: int, exit_method: enum}` | Analytics System | |
| Player views a pin (focus duration ≥1s) | `MapPinViewed` | `{pin_id: string, pin_type: enum, view_duration_ms: int}` | Analytics System | Session metric to understand which pin types players care about |

> Notably absent: there is NO `FastTravelRequested` event. Map System GDD Rule 6: "must not be stubbed or partially implemented at Vertical Slice."

---

## 10. Transition & Animation

| Transition | Trigger | Direction / Type | Duration (ms) | Easing | Interruptible? | Skipped by Reduced Motion? |
|------------|---------|-----------------|--------------|--------|----------------|---------------------------|
| Map overlay enter (from gameplay) | IA_Map hold | Fade in + paper unfold scale (98%→100%) | 250 | Ease out | No | Yes — instant appear, no scale |
| Map overlay exit (to gameplay) | IA_Map hold / Esc | Reverse | 200 | Ease in | No | Yes — instant disappear |
| Tab swap (Pause Menu context) | Activate another tab | Cross-fade | 180 | Linear | No | Yes — instant swap |
| Zoom Overview ↔ Detail | Scroll wheel / Z / button | Camera scale interpolation | 250 | Ease in-out | Yes — fast input cancels | Yes — instant zoom snap |
| Pan | Drag / stick | Direct follow (no easing) | 0 (real-time) | N/A | N/A | No — pan is functional |
| Fog reveal edge | New tile revealed (rare — game paused on this screen) | Soft alpha fade at edge | 400 | Ease out | No | Yes — instant edge |
| Pin focus ring | Pin selected | Ring fades in + grows 0%→100% | 120 | Ease out | Yes — fast navigation cancels | Yes — instant appear |
| Pin name label expand | Pin hover/focus | Label scales 0%→100% + opacity 0→1 | 100 | Ease out | Yes | Yes — instant |
| FocusRing (Show-on-Map deep-link) | Deep-link arrival | Ring pulses 100%→120%→100% scale, 3 cycles (1s each), then fades to static | 3000 (3 pulses + fade) | Ease in-out | No (decorative only — does not block input) | Yes — static ring, no pulse |
| Manual marker placement | Player places marker | Marker scales 0%→110%→100% + drop-in vertical motion | 200 | Ease out back | No | Yes — instant appear at 100% |
| Manual marker removal | Player removes marker | Fade out + scale 100%→0% | 150 | Ease in | No | Yes — instant |
| Filter panel open | Filter activated | Slide from right + fade in | 250 | Ease out | No | Yes — instant slide |
| Filter panel close | Esc / F again | Reverse | 250 | Ease in | No | Yes — instant |
| Pin context popover open | Enter / A on focused pin | Scale 95%→100% + fade in | 80 | Ease out | No | Yes — instant |
| Pin context popover close | Popover action / Esc | Reverse | 80 | Ease in | No | Yes — instant |
| Infection overlay refresh | Every 10s | Cross-fade old tint → new tint per cell | 200 | Linear | Yes — interrupted by next refresh if it arrives | Yes — instant swap |
| Player position arrow pulse | Continuous while map open | Opacity 100%→70%→100% at 1Hz | 1000 (continuous loop) | Sine | N/A — loops | Yes — static arrow at 100% |
| Marker limit toast | Marker limit reached | Slide up + fade in, hold 3s, fade out | 200 in / 200 out, 3000 hold | Ease out / ease in | No | Yes — instant appear/disappear, hold preserved |

---

## 11. Input Method Completeness Checklist

**Keyboard**
- [x] All elements reachable via Tab + arrows + dedicated shortcuts (F, Z, C, Q)
- [x] Tab order: Map Header → Map Canvas (pin cycle) → Action Bar → (Pause Menu Tab Bar if in PM context)
- [x] Every mouse action has a keyboard equivalent (click → Enter, drag → arrow keys for pan, wheel → Z for zoom)
- [x] Focus is visible at all times — pins show selection ring; buttons show focus ring
- [x] Focus does not escape — wraps within Map Canvas pins, then Tab moves to next zone
- [x] Esc closes the topmost overlay (filter panel → popover → placement mode → map)

**Gamepad**
- [x] All elements reachable with D-Pad + face buttons + stick (for pan) + stick click (re-center)
- [x] Face button mapping: A = Confirm, B = Back/Cancel, X = Place Marker / Remove Marker (contextual), Y = Filter
- [x] Right stick: zoom in/out (push up/down)
- [x] Left stick: pan map (when no pin focused) / pin focus traversal (when navigating pins)
- [x] D-Pad: pin focus traversal (4-directional nearest-neighbor)
- [x] LB / RB: Pause Menu tab cycling (when in PM context)
- [x] View button: zoom toggle
- [x] R3 (stick click): re-center on player
- [x] Controller disconnect: input poll halts, map stays open; focus restores on reconnect

**Mouse**
- [x] Hover states on all pins, buttons, filter checkboxes
- [x] All interactive targets ≥32x32px (pins are ~40x40px at Overview zoom, larger at Detail; buttons ~44px tall; filter rows ~36px tall)
- [x] Right-click on pin opens PinContextPopover; right-click on empty terrain is a no-op (documented)
- [x] Scroll wheel: zoom (over map canvas); scrolls Filter Panel content if cursor is over panel

**Touch** — Not applicable (PC-only)

---

## 12. Screen-Level Accessibility Requirements

**Accessibility Tier**: Standard (WCAG 2.1 AA).

**Text contrast requirements**:

| Text Element | Background Context | Required Ratio | Current Ratio | Pass? |
|--------------|-------------------|---------------|---------------|-------|
| Map header title "WORLD MAP" | Dark panel | 4.5:1 | Verify | [ ] |
| Pin name labels (over terrain) | Map texture (varies — hand-drawn) | 4.5:1 — labels rendered with text shadow / outline to maintain contrast over any terrain tone | Verify | [ ] |
| SelectedPinInfoStrip text | Dark strip background | 4.5:1 | Verify | [ ] |
| Action bar button labels | Button color | 4.5:1 each variant | Verify | [ ] |
| Filter Panel checkbox labels | Panel background | 4.5:1 | Verify | [ ] |
| Compass cardinal letters (N E S W) | Strip background | 4.5:1 | Verify | [ ] |
| Marker limit toast text | Toast background | 4.5:1 | Verify | [ ] |
| Pin context popover text | Popover background | 4.5:1 | Verify | [ ] |
| Faction territory standing label | Overlay (dimmed terrain) | 4.5:1 — label rendered with background plate to maintain contrast over the dashed overlay | Verify | [ ] |

**Colorblind-unsafe elements and mitigations**:

| Element | Colorblind Risk | Mitigation |
|---------|----------------|------------|
| Infection overlay color tinting (green clean → amber partial → red infected → deep-red hive core) | Red-green colorblindness most common — the most consequential color signal on this screen | Each infection severity also has a distinct overlay pattern (clean = no overlay, partial = diagonal stripes, infected = cross-hatch, hive core = solid + pulsing biohazard icon at cell center). When a cell is focused via filter or pin hover, infection level is also announced as text in SelectedPinInfoStrip. |
| Faction territory color (red hostile → amber wary → gray unknown → blue known → green trusted → gold allied, per Faction GDD Visual/Audio section) | Red-green spectrum overlap; gray/blue/green colorblind concerns | Faction territory ALWAYS shows a faction icon + standing tier text label inside the polygon. Color is supplemental. Dashed border pattern is also faction-specific (Remnant = long-dash, Tethered = short-dash). |
| Quest objective gold vs. quest giver green | Gold/green ambiguity in some color vision types | Gold quest objective pins use a distinct icon (target reticle); green quest giver pins use a speech bubble icon. Icons are unique, not just colored. |
| Manual marker red vs. infection red | Red overload | Manual markers use a distinct pin shape (drop-pin with vertical line); infection biohazard pins use the biohazard glyph. |
| Player position cyan arrow vs. all other markers | Generally safe — cyan is rare in palette | Player position also pulses at 1Hz (when motion is not reduced) and has a distinct arrow shape with facing tail |

**Focus order** (Tab key sequence):

When map is opened in standalone overlay context (from gameplay):
1. Map Header — Filter button
2. Map Header — Zoom toggle
3. Map Canvas (pin focus mode — Tab cycles through visible pins left-to-right, top-to-bottom)
4. ... visible pins in screen order ...
5. Action Bar — Place Marker
6. Action Bar — Remove Marker (only if a manual marker is focused)
7. Action Bar — Set as Waypoint (only if a non-manual pin is focused)
8. Action Bar — Back to Journal (only after deep-link arrival)
9. → wraps to Map Header

When map is opened in Pause Menu context, the Pause Menu Tab Bar is prepended to the focus order.

**Screen reader announcements**:

| State Change | Announcement Text | Announcement Timing |
|--------------|------------------|---------------------|
| Map screen opens | "World map. [N] discovered locations. [M] manual markers. Current zone: [Zone Name]." | On focus settle |
| Pin focused | "[Pin type]. [Pin name]. [Distance from player, rounded to nearest 50m]. [Faction territory, if inside one]." | On focus arrival |
| Quest pin focused | "[Quest type] objective. [Objective description]. [Quest name]. [Distance from player]." | On focus arrival |
| Infection cell hovered (if filter allows) | "[Cell coordinates]. Infection level: [Clean / Exposed / Partial / Infected / Fully Infected / Hive Core]." | On focus over cell — only when "show infection" filter is on |
| Faction territory hovered | "[Faction name] territory. Standing: [Tier name]." | On entry into territory polygon during pan |
| Zoom changes | "Zoom: [Overview / Detail]." | After zoom change completes |
| Manual marker placed | "Marker placed at [coordinates]. [N] of [Max] markers used." | After placement confirmed |
| Manual marker removed | "Marker removed. [N] of [Max] markers used." | After removal confirmed |
| Marker limit reached | "Marker limit reached. Remove a marker to place a new one." | When toast appears |
| Show-on-Map deep-link arrival | "Showing [Quest name] objective [Objective description] on map." | On screen settle |
| Filter panel opens | "Filter panel. [N] filters active." | On panel slide-in complete |
| Filter toggled | "[Filter name] [on / off]." | On checkbox toggle |
| Reduced motion mode | (Behavioral only — no announcement; ReducedMotion is system-wide) | N/A |
| Empty state on undiscovered zone | "Map mostly unrevealed. Walk into the world to reveal areas." | On screen settle |

**Cognitive load assessment**:

Information streams the player tracks: (1) own position, (2) terrain landmarks (rivers, ridges, roads on the drawn map), (3) pins of various types, (4) infection overlay severity, (5) faction territory boundaries, (6) fog edges (what is unknown), (7) action bar options. That is 7 concurrent streams — at the upper bound of 7±2.

Mitigations:
- Filter Panel lets players reduce streams to only what they care about (e.g., "I only want to see quest objectives — hide everything else").
- Default focus on map open is the Map Canvas, not the Action Bar — players are pointed at content, not controls.
- Show-on-Map deep-link reduces streams to 1 — the FocusRing visually overrides all other priorities.
- Infection overlay refresh is throttled to every 10s (not per-frame) — visual changes are paced, not constant.
- Pin labels only appear when pins are focused/hovered at Overview zoom; only labels for visible pins render at Detail zoom — visual noise is bounded.

---

## 13. Localization Considerations

**General rules for this screen**:
- Text elements tolerate ≥40% expansion from English baseline.
- RTL layout: Filter Panel slides from left instead of right; cardinal compass letters localize per script (N → ش for Arabic North); pin labels right-align in RTL.
- CJK languages: shorter text — verify labels do not look broken with sparse text.
- Place names (zones, safehouses) are localized via the same string table as Quest Journal — must match across screens.
- Cardinal directions use locale-appropriate letters (N/S/E/W in English; N/S/O/E in French; N/S/W/O in German; etc.).

| Text Element | English Baseline | Max Characters | Expansion Budget | RTL Behavior | Overflow Behavior | Risk |
|--------------|-----------------|----------------|-----------------|--------------|-------------------|------|
| Screen title "WORLD MAP" | 9 chars | 20 chars | 122% | Mirror | Truncate with ellipsis | Low |
| Pin name label | ~10-30 chars (e.g., "North Safehouse", "Sulfur Flats Lab") | 50 chars | 67% | Right-align | Truncate with tooltip showing full name | Medium |
| Action bar button labels | 5-15 chars | 24 chars | 60-380% | Right-align | Wrap to 2 lines or shrink to 90% font | High — German "Markierung setzen" (Place Marker) is 18 chars; "Wegpunkt setzen" is 15 chars |
| Filter checkbox labels | 12-25 chars | 40 chars | 60-233% | Right-align | Wrap to 2 lines within filter row | Medium |
| Faction territory standing label "(KNOWN)" / "(ALLIED)" | 5-8 chars | 16 chars | 100% | Mirror | Truncate (rare) | Low |
| SelectedPinInfoStrip text "Selected: [Objective] — [Quest Name] ([Quest Type])" | ~40-80 chars | 200 chars | 150% | Right-align | Truncate end with ellipsis | Medium |
| Compass cardinal letters | 1 char | 2 chars | 100% | Localize per script | Single character — no overflow | Low |
| Marker limit toast "Marker limit reached — remove one to add another." | 50 chars | 120 chars | 140% | Right-align | Wrap to 2 lines | Low |
| Zoom label "Zoom: Overview" / "Zoom: Detail" | 14 chars | 24 chars | 71% | Mirror | Truncate | Low |
| Pin context popover actions | 5-15 chars (per action) | 24 chars | 60% | Right-align | Wrap to 2 lines | Low |

---

## 14. Acceptance Criteria

**Performance**
- [ ] Map opens (first frame visible) within 250ms of trigger on minimum-spec hardware
- [ ] Map fully interactive (fog, pins, overlays loaded) within 500ms of trigger
- [ ] Pan operation maintains target 60fps ±5fps
- [ ] Zoom transition completes within 300ms without frame drops
- [ ] Infection overlay refresh (every 10s) does not cause frame drops
- [ ] Map handles a fully-revealed zone (1000+ tiles, 30+ pins) without performance degradation

**Layout & Rendering**
- [ ] Renders correctly at 1920x1080, 2560x1440, 3840x2160
- [ ] Renders correctly at 1280x720 minimum supported resolution
- [ ] Renders correctly at 16:9, 16:10, 21:9 aspect ratios — wider aspect ratios pan extents adjust, never crop pins
- [ ] No text overflow or truncation in English within defined max-character bounds
- [ ] No text overflow or truncation in German
- [ ] All states render correctly: Loading, Empty (fresh spawn), Populated Overview, Populated Detail, Show-on-Map Deep-Link, Pin Focused, Pin Context Popover, Marker Placement Mode, Marker Limit Toast, Filter Panel Open, Error
- [ ] Fog-of-war edges feather smoothly (per Map GDD Visual Requirements — 100-200cm blend in world space)
- [ ] Pin icons remain readable at both Overview and Detail zoom levels (no pixel-art breakdown at scale)
- [ ] Faction territory polygons render without z-fighting against terrain or other overlays

**Input**
- [ ] All elements reachable via keyboard (Tab + arrows + F + Z + C + Q + Esc)
- [ ] All elements reachable via gamepad (D-Pad + face buttons + sticks + stick clicks + LB/RB + View)
- [ ] All elements reachable via mouse (click + drag + wheel + right-click)
- [ ] No action requires simultaneous input combinations
- [ ] Focus is visible at all times
- [ ] Focus does not escape the screen
- [ ] Esc behaves contextually: closes filter panel if open, else closes popover if open, else cancels placement mode if active, else closes map (in overlay context) or returns to PM tab bar (in PM context)
- [ ] `IA_Map` hold from gameplay opens the map; holding again closes it (per Map GDD Rule 4)

**Events & Data**
- [ ] All events in Section 9 fire with correct payloads (verify via debug log)
- [ ] Screen never writes directly to subsystem state (verify: no direct mutation calls)
- [ ] Manual marker placement persists across save/load (verified via Map GDD AC6 + Save/Load integration)
- [ ] Quest pin changes (from Quest Subsystem events) reflect in the map within 1 frame while map is open
- [ ] Infection overlay refreshes every 10 seconds while map is open
- [ ] No `FastTravelRequested` event is fired under any input combination (Map GDD Rule 6 enforcement)

**Accessibility**
- [ ] All text passes 4.5:1 contrast ratio per Section 12 table
- [ ] No information conveyed by color alone — infection severity uses pattern + icon + announced text; faction territory uses icon + label + dash pattern
- [ ] Screen reader announces pin name, type, distance, and containing territory on pin focus (verify with NVDA)
- [ ] Reduced motion setting disables player position pulse, focus ring pulse, and zoom animation easing (instant snap instead)
- [ ] Pin name labels remain readable over varying terrain backgrounds (text outline or background plate ensures contrast)
- [ ] All interactive targets ≥32x32px

**Localization**
- [ ] No text element overflows in English, German, French, Spanish, Brazilian Portuguese, Japanese, Korean, Simplified Chinese
- [ ] RTL layout mirrors correctly: filter panel slides from opposite edge, focus traversal direction inverts, compass letters localize
- [ ] All text driven by localization strings — no hardcoded display strings
- [ ] Place names (zones, safehouses, factions) match the localized names used in Quest Journal

**Map-System-Specific**
- [ ] Fog-of-war initializes obscured on a fresh game (per Map GDD AC1)
- [ ] Fog reveals as player moves and persists across sessions (per Map GDD AC2-AC3)
- [ ] Safehouse auto-pins on entry (per Map GDD AC4)
- [ ] Workbench auto-pins on proximity (per Map GDD AC5)
- [ ] Manual marker placement at MaxManualMarkers limit blocks new placement and shows toast (per Map GDD AC7)
- [ ] No fast travel UI is reachable from any input or pin selection (per Map GDD AC11 + GDD Rule 6)
- [ ] Infection pins respect fog rules — pins in fogged areas show as small markers (Map GDD EC2) but surrounding terrain remains fogged
- [ ] Quest pins for objectives in unreached locations appear once the Quest Subsystem registers them as known (consistent with EC2 behavior)
- [ ] Show-on-Map deep-link from Quest Journal correctly centers Detail zoom on `world_position` and shows FocusRing for 3s
- [ ] Filter state resets to defaults on each new map open session (consistent with Map GDD Minimap toggle policy)
- [ ] Faction territory colors reflect current standing tier (verify with Remnant at multiple standings across save/load)

---

## 15. Open Questions

| Question | Owner | Deadline | Resolution |
|----------|-------|----------|-----------|
| Should the infection overlay show neighboring zones' infection states when the player has never visited them? Map GDD EC6 specifies infection pins hide behind fog. This spec extends that: the overlay shows infection only on revealed cells. Unrevealed cells show fog, not infection tint. Confirm this preserves Pillar 2. | game-designer + narrative-director | Pre-VS playtest | Decided: infection overlay shows ONLY on revealed cells. Pillar 2 integrity preserved. Open if playtest reveals players misinterpret unrevealed zones as "safe." |
| Should faction territory polygons render in fogged areas? Logical answer: only show territory the player has discovered. This is what this spec assumes. Confirm with narrative team — there may be a case for showing rumored territories (heard from NPCs) with a "?" overlay. | narrative-director | Pre-VS | Deferred — current spec hides territory in fog. "Rumored territory" is a future feature, not Vertical Slice. |
| Should the map expose a "list view" alternative for accessibility — a screen-reader-friendly text listing of all known pins, sorted by distance? | accessibility-lead (when assigned) | Post-VS accessibility pass | Deferred — Standard tier (current) does not require this. Consider for Comprehensive tier upgrade. |
| Should the Show-on-Map FocusRing remain until the player dismisses it manually, or always auto-fade after 3s? | game-designer | Playtest | Default: 3s auto-fade. The selected pin remains highlighted indefinitely (selection ring stays), only the larger pulsing FocusRing fades. Open for playtest tuning. |
| Should the map persist a "last viewed location" so reopening returns the player to the same zoom + pan, rather than always re-centering on the player? | ux-lead | Post-VS | Deferred. Current spec: always re-center on player on open (or on deep-link target). Avoids stale-view confusion. May add per session-only memory if playtest shows users re-panning every time. |
| At Vertical Slice scope, are faction territories represented as authored polygons (Scene Management data) or derived from zone-faction-ownership? | faction-system-owner + scene-management-owner | Pre-VS | Deferred. UX assumes data is available via Faction Reputation Subsystem regardless of source. Implementation detail. |
