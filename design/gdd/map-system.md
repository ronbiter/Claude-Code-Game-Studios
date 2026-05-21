# Map System

> **Status**: In Design
> **Author**: user + agents
> **Last Updated**: 2026-05-19
> **Implements Pillar**: Pillar 2 (Earned Discovery)

## Overview

The Map System provides world navigation through two views: a full-screen World Map (opened via `IA_Map`) and an optional Minimap HUD element that is off by default and toggled per session. The world starts fully obscured — the player reveals areas by physically entering them, reinforcing Pillar 2 (Earned Discovery). Discovered locations (safehouses, workbenches, investigation sites, infection zones) are automatically pinned as the player uncovers them; the player can also place manual markers. There is no fast travel at MVP scope — the player must traverse the world on foot, preserving Pillar 3 (Tense Survival). Fast travel between discovered safehouses is planned post-MVP. The Minimap, when enabled, renders as a compass-style ring showing only immediate surroundings — not a top-down overview — keeping the world feeling dangerous and unknown. At Vertical Slice scope, the system tracks one zone with full fog-of-war reveal, automatic location pinning, and manual markers.

## Player Fantasy

The player opens the map and sees mostly black. A single smear of revealed terrain — the path they've walked — surrounded by nothing. Every blank space is a question. They've heard there's a safehouse to the north; the map can't confirm it yet. Finding it means going dark, navigating by instinct and environmental cues, and coming back with new ink on the map. When a new area reveals, it feels earned — not handed over. The compass ring, when turned on, whispers direction without replacing the need to pay attention. The world doesn't hold the player's hand; the map reflects that.

## Detailed Design

### Core Rules

**Rule 1 — Fog of War**
- The world map initialises fully obscured (black).
- Fog lifts in a radius around the player continuously while in the Playing state.
- Fog reveal is permanent — once revealed, an area stays visible across sessions (persisted by Save/Load System).
- Fog reveal radius: `FogRevealRadius` (default 1500cm, tunable).
- Revealed tiles are stored as a bitmask per zone, serialised on save.

**Rule 2 — Automatic Location Pinning**
When the player enters a defined trigger volume for a named location, that location is automatically added to the map with its type icon and name:

| Location Type | Icon | Auto-pin Trigger |
|--------------|------|-----------------|
| Safehouse | Shelter icon | Enter safehouse interior trigger |
| Workbench | Wrench icon | Come within 300cm of a Workbench actor |
| Investigation Site | Magnifier icon | Investigation System fires `OnClueDiscovered` |
| Infection Zone | Biohazard icon | Infection Spread System fires `OnZoneInfected` |
| Player Start / Spawn | Flag icon | Always pinned at new game initialisation |

**Rule 3 — Manual Markers**
- The player can place up to `MaxManualMarkers` (default 10) custom markers on the World Map.
- Markers are placed by holding the confirm input on a revealed map tile.
- Each marker is a generic pin with no label at MVP scope.
- Markers are removed by selecting an existing marker and pressing the remove input.
- Manual markers are persisted by Save/Load System.

**Rule 4 — World Map View**
- Opened via `IA_Map` **hold** (authoritative; input-system.md must match — hold is consistent with other overlay inputs and prevents accidental open during combat).
- Pauses world time (GSM transitions to Paused state — map is a UI overlay within Paused; no additional GSM state is created). The map UI renders over the Paused tactical HUD rather than replacing it. IMC remains IMC_Menu (Paused-owned).
- Displays: revealed terrain, fog of war overlay, all pinned locations, manual markers, player position and facing direction.
- Player cannot interact with the world while map is open.
- Closed via `IA_Map` hold again or `IA_Cancel`.

**Rule 5 — Minimap (Compass Ring)**
- Off by default each session. Toggled on/off via `IA_ToggleMinimap`.
- Renders as a circular compass ring in the HUD corner (top-right).
- Shows: cardinal directions, player facing arrow, pinned locations within `MinimapRange` (default 3000cm) as small dots.
- Does **not** show fog of war — only reveals what is already discovered on the World Map.
- Does **not** show terrain detail — dots and direction only.
- Minimap on/off preference is **not** persisted across sessions (resets to off on load).

**Rule 6 — No Fast Travel (MVP)**
No fast travel mechanism exists. The `IA_Map` input opens the map for reference only — the player cannot select a destination to teleport to. Fast travel between discovered safehouses is deferred post-MVP and must not be stubbed or partially implemented at Vertical Slice.

### States and Transitions

```
Playing ──[hold IA_Map]──► MapOpen (Paused sub-state)
  ▲                              │
  └────[hold IA_Map / IA_Cancel]─┘

Playing ──[hold IA_ToggleMinimap]──► Playing (Minimap HUD visible)
  ▲                                        │
  └────[hold IA_ToggleMinimap]─────────────┘
```

The World Map is a sub-state of Paused — it inherits GSM Paused behaviour (world frozen, input locked to map UI). The Minimap has no state of its own; it is a persistent HUD element toggled on/off.

### Interactions with Other Systems

| System | Direction | Interface |
|--------|-----------|-----------|
| Game State Machine | Read + Write | `RequestStateTransition(Paused)` on map open; `RequestStateTransition(Playing)` on map close |
| Input System | Read | `IA_Map` (hold), `IA_ToggleMinimap` (hold), `IA_Cancel` |
| HUD System | Write | `ShowWorldMap()`, `HideWorldMap()`, `ShowMinimap()`, `HideMinimap()`, `PinLocation(FMapPin)`, `UpdateFogReveal(FogBitmask)` |
| Investigation System | Read | Subscribes to `OnClueDiscovered` — auto-pins Investigation Site |
| Infection Spread System | Read | Subscribes to `OnZoneInfected` — auto-pins Infection Zone |
| Save/Load System | Read + Write | `SaveMapState()` — fog bitmask + pinned locations + manual markers; `RestoreMapState()` |
| Scene Management | Read | Zone boundary events — triggers fog reveal initialisation per zone on load |

## Formulas

**F1 — Fog Reveal Check (per frame, Playing state)**

```
bShouldReveal(tile) = Distance(PlayerLocation, TileCenter) ≤ FogRevealRadius

Variables:
  PlayerLocation    Current player world position (X, Y)
  TileCenter        World position of fog tile centre
  FogRevealRadius   1500cm (tunable)

Reveal is applied to all tiles satisfying this condition each frame.
Already-revealed tiles are skipped (bitmask check before distance test).
```

**F2 — Minimap Dot Visibility**

```
bShowPin(pin) = Distance(PlayerLocation, PinWorldLocation) ≤ MinimapRange
              AND pin.bDiscovered = true

Variables:
  MinimapRange      3000cm (tunable)
  bDiscovered       True if the location has been auto-pinned

Only discovered locations within range render as minimap dots.
```

**F3 — Fog Bitmask Storage Size**

```
BitmaskBytes = ceil((ZoneWidthTiles × ZoneHeightTiles) / 8)

Variables:
  ZoneWidthTiles    Zone width divided by TileSize (default TileSize = 500cm)
  ZoneHeightTiles   Zone height divided by TileSize

Example: 50,000cm × 50,000cm zone, 500cm tiles → 100×100 = 10,000 tiles → 1,250 bytes (~1.2KB per zone)
```

## Edge Cases

**EC1 — Player opens map during combat**
GSM transitions to Paused (Rule 4). Combat is suspended — enemy AI freezes per GSM Paused behaviour. Map opens normally. This is consistent with all other overlay systems (Inventory, Dialogue). If this feels too safe, combat-during-map is a design risk to revisit post-MVP.

**EC2 — Location pin fires before fog is revealed at that tile**
Auto-pin is added to the pin list regardless of fog state. On the World Map, the pin is visible even if fog has not been manually walked to yet — the pin punches through fog as a small marker, indicating "something is here" without revealing surrounding terrain. This serves Pillar 2: the player knows a point of interest exists but must travel to it.

**EC3 — Player reaches max manual markers (10)**
Placing a new marker is blocked. HUD shows "Marker limit reached — remove one to add another." No markers are removed automatically.

**EC4 — Fog reveal at zone boundary (player straddles two zones)**
Fog reveal applies to whichever zone the player's origin point is currently in. Tiles in the adjacent zone are not revealed until the player fully crosses the zone boundary trigger. This avoids cross-zone bitmask writes mid-frame.

**EC5 — Save during map-open state**
A checkpoint auto-save can fire while the map is open (GSM state is Paused — save is eligible). Fog bitmask is captured at that moment. Save indicator appears in HUD corner beneath the map overlay. No interruption to map interaction.

**EC6 — Infection zone pin fires for a zone the player has not visited**
Infection Spread System fires `OnZoneInfected` for any zone regardless of player proximity. The pin is added to the map data but is only visible on the World Map if the player has revealed that map tile. If the tile is still fogged, the pin is hidden until fog is lifted. This preserves the fog-of-war integrity — the player doesn't learn about remote events through map icons they shouldn't have seen yet.

## Dependencies

**Hard Dependencies** (system cannot function without):
- **Game State Machine** ✅ (designed) — World Map open/close transitions through Paused state.
- **Input System** ✅ (designed) — `IA_Map`, `IA_ToggleMinimap`, `IA_Cancel` actions.
- **HUD System** ✅ (designed) — renders World Map overlay and Minimap compass ring.
- **Scene Management** ✅ (In Design) — zone boundary events required for fog reveal initialisation per zone and cross-zone transition handling.

**Soft Dependencies** (enhanced by but works without):
- **Investigation System** ✅ (designed) — `OnClueDiscovered` event for auto-pinning investigation sites. Without it, investigation sites must be manually marked.
- **Infection Spread System** ✅ (designed) — `OnZoneInfected` event for auto-pinning infection zones. Without it, infection zones are not shown on map.
- **Save/Load System** ✅ (designed) — `SaveMapState()`, `RestoreMapState()`. Without it, fog reveal and pins reset every session. The Save/Load Rule 3 payload entry (`SaveMapState()` covering fog bitmask, auto-pinned locations, and manual markers) is the formal interface contract — OQ-6 resolved.

**Depended On By**:

| System | Dependency | Notes |
|--------|-----------|-------|
| Scene Management | Discovered location data | Scene Management uses pinned safehouse locations for post-MVP fast travel destination list |

## Tuning Knobs

| Knob | Default | Safe Range | Affects |
|------|---------|-----------|---------|
| `FogRevealRadius` | 1500cm | 500cm – 4000cm | How much map the player reveals per step. Smaller = more exploration required, larger = map fills faster |
| `MinimapRange` | 3000cm | 1000cm – 6000cm | How far the minimap compass shows nearby pins. Smaller = more disorienting, larger = more helpful |
| `MaxManualMarkers` | 10 | 1 – 50 | How many custom pins the player can place |
| `WorkbenchAutoPinRadius` | 300cm | 100cm – 600cm | How close the player must be to a Workbench to auto-pin it |
| `FogTileSize` | 500cm | 100cm – 2000cm | Resolution of fog reveal grid. Smaller = more precise but larger bitmask; larger = chunkier reveal |

## Visual/Audio Requirements

### Visual

- **World Map overlay**: Full-screen, darkened background. Revealed terrain rendered as a stylised top-down map (not photorealistic — hand-drawn or ink aesthetic consistent with Art Bible survival tone). Fogged areas solid black with a soft feathered edge at reveal boundary.
- **Fog reveal edge**: Soft gradient (not hard-cut) at the boundary between revealed and unrevealed. Approximately 100–200cm blend zone in world space.
- **Location pins**: Distinct icon per type (see Rule 2 table). Icon + location name label on hover/select. Undiscovered pins hidden by fog — no bleed-through except as per EC2.
- **Manual markers**: Generic pin icon, visually distinct from auto-pins (different colour — red vs. white).
- **Player position indicator**: Arrow showing current position and facing on World Map. Pulses subtly at 1Hz to distinguish from static pins.
- **Minimap compass ring**: Circular HUD element, semi-transparent. Cardinal direction labels (N/S/E/W). Player arrow at centre. Nearby pins as small coloured dots. Outer ring fades at edges. No terrain rendering.

### Audio

| Event | Description |
|-------|-------------|
| Map open | Soft paper/map unfold sound |
| Map close | Reverse — fold/close |
| Fog reveal (area) | Subtle ink-spreading ambient tone, plays when new area reveals |
| Location auto-pinned | Soft discovery chime (quieter than schematic discovery — less significant) |
| Manual marker placed | Light pin-drop click |
| Manual marker removed | Soft pull/pop |
| Minimap toggle on | Brief compass-click |
| Minimap toggle off | Reverse click |

## UI Requirements

- World Map is a full-screen overlay, not a panel — consistent with the scale of the information.
- Map navigation: scroll/pan via left stick or mouse drag; zoom via right stick or scroll wheel. Two zoom levels at MVP: overview and detail.
- Player position is always centred on map open (no free-pan to start). Pan is available after open.
- Pin selection: hover a pin to show name label; no additional detail panel at MVP scope.
- Manual marker placement: hold confirm on any revealed tile (not on an existing pin). Cursor must be on a revealed tile — placing on fog is not allowed.
- Minimap compass ring: top-right corner, does not overlap health or infection HUD elements. Size fixed at MVP — no resize option.
- "Marker limit reached" notification: inline HUD toast, 3s, same style as other notifications.
- No map legend or tutorial overlay at MVP — icons are self-evident or learned through play.

## Acceptance Criteria

**AC1 — Fog of war initialises obscured**
GIVEN a new game with no save data
WHEN the player opens the World Map
THEN the entire map is black except for the immediate area around the player spawn point (within `FogRevealRadius`).

**AC2 — Fog reveals as player moves**
GIVEN the player walks through a previously unvisited area
WHEN the player opens the World Map
THEN the path walked is revealed and persists on the map.

**AC3 — Fog persists across sessions**
GIVEN the player has revealed an area and the game has been saved and reloaded
WHEN the player opens the World Map
THEN previously revealed areas remain revealed.

**AC4 — Safehouse auto-pins on entry**
GIVEN the player enters a safehouse interior trigger for the first time
WHEN the player opens the World Map
THEN the safehouse is pinned with the shelter icon and its name at the correct world position.

**AC5 — Workbench auto-pins on proximity**
GIVEN the player comes within `WorkbenchAutoPinRadius` of a Workbench
WHEN the player opens the World Map
THEN the workbench is pinned with the wrench icon at the correct world position.

**AC6 — Manual marker placement**
GIVEN the player has the World Map open and cursor is on a revealed tile
WHEN the player holds confirm
THEN a red marker pin is placed at that location and persists on the map.

**AC7 — Manual marker limit**
GIVEN the player has placed `MaxManualMarkers` markers
WHEN the player attempts to place another
THEN placement is blocked and the "Marker limit reached" toast appears.

**AC8 — Minimap off by default**
GIVEN a fresh game session (including after load)
WHEN the player enters the Playing state
THEN no minimap compass ring is visible in the HUD.

**AC9 — Minimap toggle**
GIVEN the minimap is off
WHEN the player holds `IA_ToggleMinimap`
THEN the compass ring appears in the top-right HUD. Holding again hides it.

**AC10 — Minimap shows nearby pins**
GIVEN the minimap is on and a discovered safehouse is within `MinimapRange`
WHEN the player is in the Playing state
THEN the safehouse pin appears as a dot on the compass ring at the correct relative direction.

**AC11 — No fast travel**
GIVEN the World Map is open and multiple safehouses are pinned
WHEN the player selects any pin
THEN no teleport, travel prompt, or fast travel UI appears.

## Open Questions

1. **Map art style** — hand-drawn ink aesthetic is suggested but not confirmed against the Art Bible. Needs Art Director sign-off before HUD System implementation begins.

2. **Zone size and tile count** — actual Vertical Slice zone dimensions are unknown. Fog bitmask size (F3) depends on this. Needs Level Designer input.

3. **Scene Management interface** — this system depends on Scene Management for zone boundary events, but Scene Management is not yet designed. `SaveMapState()` zone initialisation contract is TBD.

4. **Investigation site pin visibility** — EC2 specifies that auto-pins punch through fog as small markers. This is a design choice that slightly weakens fog-of-war purity. Confirm this is intentional or revise to hide all pins behind fog.

5. **Post-MVP fast travel** — safehouse-to-safehouse fast travel is planned. When scoped, the Map System will need: travel confirmation UI, travel cost (none? time skip? resource?), and loading transition integration. Defer all implementation until post-MVP scope decision.

6. ~~**`SaveMapState()` interface**~~ ✅ **Resolved** — The Save/Load System Rule 3 payload table entry (`SaveMapState()` covering fog bitmask, auto-pinned locations, and manual markers) is the formal contract. Dep classification: **soft** (map works without persistence — fog and pins reset on load, which is acceptable degradation). No further action required.
