# Systems Index: Hostile World

> **Status**: Draft
> **Created**: 26 April 2026
> **Last Updated**: 20 May 2026
> **Source Concept**: design/gdd/game-concept.md
> **Engine**: Unreal Engine 5.7

---

## Overview

Hostile World is a third-person survival action-adventure with conspiracy investigation. The player — a black ops mercenary immune to an alien virus — escapes a collapsing mountain prison and descends into an open world of infected towns, resistance camps, and alien hives to uncover the truth. Core mechanical tension: the world is alive and transforming (Pillar 1: Hostile World), clues are earned through interaction not handed to the player (Pillar 2: Earned Discovery), and resources are scarce (Pillar 3: Tense Survival).

25 systems identified across 5 layers. 15 are MVP-priority. Design order is dependency-sorted.

---

## Systems Enumeration

| # | System Name | Category | Priority | Status | Design Doc | Depends On |
|---|------------|----------|----------|--------|------------|------------|
| 1 | Input System | Foundation | MVP | Designed | design/gdd/input-system.md | — |
| 2 | Physics System | Foundation | MVP | Designed | design/gdd/physics-system.md | Input |
| 3 | Camera System | Foundation | MVP | Designed | design/gdd/camera-system.md | Input, Physics |
| 4 | Scene Management | Foundation | MVP | Needs Revision | design/gdd/scene-management.md | Game State Machine |
| 5 | Game State Machine | Foundation | MVP | Needs Revision | design/gdd/game-state-machine.md | — |
| 6 | Save/Load System | Persistence | MVP | Needs Revision | design/gdd/save-load-system.md | Game State Machine |
| 7 | Player Controller | Gameplay | MVP | Designed | design/gdd/player-controller.md | Input, Physics, Camera, Health, Movement, GSM |
| 8 | Movement System | Gameplay | MVP | Designed | design/gdd/movement-system.md | Input, Physics |
| 9 | Health System | Gameplay | MVP | Needs Revision | design/gdd/health-system.md | Physics, Movement, GSM, Input |
| 10 | Stealth System | Gameplay | MVP | Designed | design/gdd/stealth-system.md | Player Controller, Alien AI, Movement, Physics, Camera |
| 11 | Combat System | Gameplay | MVP | Needs Revision | design/gdd/combat-system.md | Player Controller, Health, Alien AI |
| 12 | Alien AI System | Gameplay | MVP | Needs Revision | design/gdd/alien-ai-system.md | Stealth, Combat, Infection Spread |
| 13 | Infection Spread System | Gameplay | MVP | Needs Revision | design/gdd/infection-spread-system.md | Scene Management, Alien AI |
| 14 | Investigation System | Gameplay | MVP | Needs Revision | design/gdd/investigation-system.md | Player Controller, Dialogue |
| 15 | Dialogue System | Narrative | MVP | Needs Revision | design/gdd/dialogue-system.md | Player Controller |
| 16 | HUD System | UI | MVP | In Design | design/gdd/hud-system.md | Player Controller, Health, Quest |
| 17 | Inventory System | Economy | MVP | Needs Revision | design/gdd/inventory-system.md | Player Controller, Crafting |
| 18 | Faction Reputation System | Progression | Vertical Slice | Needs Revision | design/gdd/faction-reputation-system.md | Dialogue, Quest |
| 19 | Quest System | Narrative | Vertical Slice | Needs Revision | design/gdd/quest-system.md | Dialogue, Faction Reputation |
| 20 | Crafting System | Economy | Vertical Slice | Needs Revision | design/gdd/crafting-system.md | Inventory |
| 21 | Map System | UI | Vertical Slice | Needs Revision | design/gdd/map-system.md | Scene Management |
| 22 | Tutorial System | Meta | Vertical Slice | Needs Revision | design/gdd/tutorial-system.md | Game State Machine, Save/Load, Input, HUD |
| 23 | Lore/Journal System | Narrative | Alpha | Not Started | — | Investigation, Quest |
| 24 | Accessibility System | Meta | Alpha | Not Started | — | HUD |
| 25 | Photo Mode | Meta | Full Vision | Not Started | — | Camera System |

---

## Categories

| Category | Description | Systems in this game |
|----------|-------------|-------------------|
| **Foundation** | Infrastructure everything depends on | Input, Physics, Camera, Scene Management, Game State Machine |
| **Gameplay** | Core mechanics that make the game fun | Movement, Stealth, Combat, Health, Alien AI, Infection Spread, Investigation |
| **Narrative** | Story and dialogue delivery | Dialogue, Quest, Lore/Journal |
| **Economy** | Resource creation and consumption | Inventory, Crafting |
| **Progression** | How the player grows over time | Faction Reputation |
| **Persistence** | Save state and continuity | Save/Load |
| **UI** | Player-facing information displays | HUD, Map |
| **Meta** | Systems outside the core game loop | Tutorial, Accessibility, Photo Mode |

---

## Priority Tiers

| Tier | Definition | Target Milestone | Design Urgency |
|------|-----------|----------------|----------------|--------------|
| **MVP** | Required for the core loop to function — without these you can't test "is this fun?" | First playable prototype | Design FIRST |
| **Vertical Slice** | Required for one complete, polished area — demonstrates full experience | Vertical slice / demo | Design SECOND |
| **Alpha** | All features present in rough form — complete mechanical scope | Alpha milestone | Design THIRD |
| **Full Vision** | Polish, edge cases, nice-to-haves | Beta / Release | Design as needed |

---

## Dependency Map

### Foundation Layer (no dependencies)

1. **Input System** — raw input → game actions. All other systems consume input.
2. **Game State Machine** — global state (menu, gameplay, pause, death). All other systems read state.
3. **Physics System** — collision, ragdoll, physics. Required by all movement and interaction.

### Core Layer (depends on foundation)

1. **Camera System** — third-person follow, zoom, collision. Player Controller depends on camera.
2. **Scene Management** — zone streaming, loading transitions. Infection Spread depends on this.
3. **Player Controller** — central hub. Consumes Input, Physics, Camera, Health, Movement.
4. **Movement System** — traversal, stamina, visibility. Player Controller depends on this.
5. **Health System** — damage, infection immunity, death. Player Controller depends on this.
6. **Stealth System** — detection, silent movement, patrol awareness. Combat and Alien AI depend on this.
7. **Combat System** — weapons, hit detection, damage. Health and Alien AI depend on this.
8. **Alien AI System** — adaptive AI, pathfinding, patrol behavior. Stealth and Combat depend on this.
9. **Infection Spread System** — dynamic zone transformation in real-time. Scene Management and Alien AI depend on this.
10. **Dialogue System** — NPC interaction, choices. Investigation and Quest depend on this.
11. **Investigation System** — clues, intel gathering, deduction. Dialogue depends on this.
12. **HUD System** — health, ammo, threats, immersive toggle. Player Controller and Health depend on this.
13. **Inventory System** — items, equipment, capacity. Crafting depends on this.

### Feature Layer (depends on core)

1. **Inventory System** — items, equipment, capacity. Crafting, Health, Combat depend on this.
2. **Save/Load System** — persistence, save slots. Game State Machine depends on this.
3. **Quest System** — objectives, tracking, conspiracy thread. Dialogue depends on this.
4. **Faction Reputation System** — survivor alliances, faction trust. Dialogue and Quest depend on this.
5. **Crafting System** — resource gathering → temp cure synthesis. Depends on Inventory.
6. **Map System** — world navigation, discovered locations. Scene Management depends on this.
7. **Tutorial System** — first-zone teaching, hints. Game State Machine depends on this.

### Presentation Layer (depends on core + feature)

1. **Lore/Journal System** — discoveries, story fragments, intel. Investigation and Quest depend on this.

### Meta Layer (cross-cutting)

1. **Accessibility System** — subtitles, colorblind, remapping, haptics. HUD depends on this.
2. **Photo Mode** — camera capture tool. Camera System depends on this.

---

## Recommended Design Order

| Order | System | Priority | Layer | Est. Sessions |
|-------|--------|----------|-------|---------------|
| 1 | Input System | MVP | Foundation | 1 |
| 2 | Game State Machine | MVP | Foundation | 1 |
| 3 | Physics System | MVP | Foundation | 1 |
| 4 | Camera System | MVP | Foundation | 1 |
| 5 | Scene Management | MVP | Foundation | 1 |
| 6 | Movement System | MVP | Core | 1 |
| 7 | Health System | MVP | Core | 1 |
| 8 | Player Controller | MVP | Core | 2 |
| 9 | Stealth System | MVP | Core | 2 |
| 10 | Combat System | MVP | Core | 2 |
| 11 | Alien AI System | MVP | Core | 2 |
| 12 | Infection Spread System | MVP | Core | 2 |
| 13 | HUD System | MVP | Core | 1 |
| 14 | Investigation System | MVP | Core | 1 |
| 15 | Dialogue System | MVP | Core | 2 |
| 16 | Inventory System | MVP | Feature | 1 |
| 17 | Quest System | Vertical Slice | Feature | 1 |
| 18 | Faction Reputation System | Vertical Slice | Feature | 2 |
| 19 | Crafting System | Vertical Slice | Feature | 2 |
| 20 | Save/Load System | MVP | Persistence | 1 |
| 21 | Map System | Vertical Slice | UI | 1 |
| 22 | Tutorial System | Vertical Slice | Meta | 1 |
| 23 | Lore/Journal System | Alpha | Narrative | 1 |
| 24 | Accessibility System | Alpha | Meta | 1 |
| 25 | Photo Mode | Full Vision | Meta | 1 |

**Effort estimates**: S = 1 session, M = 2 sessions, L = 3+ sessions. MVP design complete in ~15–18 sessions.

---

## Circular Dependencies

- **Two two-way couplings identified** (cross-review 2026-05-20): Investigation ↔ Dialogue
  (mutual hard/soft dependency; must be implemented together) and Dialogue ↔ Quest (Quest starts/
  ends through Dialogue while Dialogue is driven by Quest state). Neither is a hard build-order
  cycle, but both must be sequenced together.

Proposed resolutions if cycles emerge:
- Player Controller ↔ Combat: define Combat as a component of Player Controller to break the cycle
- Infection Spread ↔ Alien AI: Infection Spread exposes a read-only zone state API that Alien AI consumes without bidirectional coupling

---

## High-Risk Systems

| System | Risk Type | Risk Description | Mitigation |
|--------|----------|----------------|-------------|
| **Infection Spread System** | Technical | No proven UE5 pipeline. Real-time world transformation. Dynamic zones may require significantly more art content. | Prototype early (`/prototype infection-spread`). Start with one zone, scripted infection stages first. |
| **Alien AI System** | Technical | Needs to feel adaptive and unpredictable. Procedural patrol behavior with alien behavior. | Prototype AI behavior in isolation before world integration. |
| **Faction Reputation System** | Design | Player motivation after main conspiracy resolves — faction system must carry post-story engagement. | Design faction mechanics carefully. Build NPC investment early in GDD. |
| **Infection Spread System** | Scope | Open world infection spread may cause performance issues on mid-range hardware. | Profile early. Define performance budget before detailed design. |
| **HUD System** | Design | Immersive-first HUD with toggleable full tactical mode — two modes need careful separation. | Design both modes in one GDD. Define the toggle architecture upfront. |

---

## Progress Tracker

| Metric | Count |
|--------|-------|
| Total systems identified | 25 |
| Design docs started | 17 |
| Design docs reviewed | 2 |
| Design docs approved | 1 |
| MVP systems designed | 15 / 15 |
| Vertical Slice systems designed | 2 / 5 |

---

## Next Steps

- [x] ~~Start designing MVP foundation systems (`/design-system Input System`)~~ ✅ Done
- [x] ~~Start designing MVP foundation systems (`/design-system game-state-machine`)~~ ✅ Done
- [x] ~~Start designing MVP core system (`/design-system player-controller`)~~ ✅ Done
- [x] ~~Start designing MVP core system (`/design-system stealth-system`)~~ ✅ Done
- [x] ~~Start designing MVP core system (`/design-system combat-system`)~~ ✅ Done
- [x] ~~Start designing MVP core system (`/design-system alien-ai-system`)~~ ✅ Done
- [x] ~~Start designing MVP core system (`/design-system infection-spread-system`)~~ ✅ Done
- [x] ~~Start designing MVP core system (`/design-system hud-system`)~~ ✅ Done
- [x] ~~Start designing MVP core system (`/design-system investigation-system`)~~ ✅ Done
- [x] ~~Start designing MVP core system (`/design-system dialogue-system`)~~ ✅ Done
- [x] ~~Start designing MVP feature system (`/design-system inventory-system`)~~ ✅ Done
- [ ] Run `/design-review` on each completed GDD
- [ ] Run `/review-all-gdds` for holistic cross-GDD consistency
- [ ] Run `/create-architecture` to produce master architecture document
- [ ] Prototype Infection Spread System early (`/prototype infection-spread`) — highest technical risk
- [ ] Prototype Alien AI System early (`/prototype alien-ai`) — highest behavioral risk
- [ ] Run `/gate-check pre-production` when MVP GDDs are complete
- [ ] Run `/map-systems next` to pick up highest-priority undesigned system automatically