# Crafting System

> **Status**: In Design
> **Author**: user + agents
> **Last Updated**: 2026-05-05
> **Implements Pillar**: Pillar 3 (Tense Survival)

## Overview

The Crafting System converts raw resources scavenged from hostile environments into deployable survival tools using a discovered recipe book. The player can craft anywhere (Field Craft mode) using a limited subset of recipes, or at discovered Workbenches to access the full recipe set. Each recipe consumes specific quantities of Scrap Metal, Fabric, or Chemicals from the player's inventory and produces one output item directly into inventory. Recipes are unlocked by finding Schematics in the world, reinforcing Pillar 2 (Earned Discovery). The system is deliberately lean: no skill trees, no upgradeable benches, no crafting queues — every craft is a single high-stakes decision made under resource scarcity, reinforcing Pillar 3 (Tense Survival). At Vertical Slice scope, three output categories are supported: Cure Devices (infection suppression), Improvised Weapons (throwables), and Medical Supplies (healing consumables).

## Player Fantasy

The player stumbles across a schematic pinned to a wall in an abandoned safehouse — a handwritten diagram showing how to jury-rig a suppressant canister from chemical waste and scavenged metal. They've been hoarding these materials for hours, not knowing why. Now they do. Crafting feels like **improvised ingenuity under pressure**: not a factory, not a lab — a survivor making do with what the world left behind. The tension is in the cost: those three Chemicals could have been saved for something better. Field Craft reinforces vulnerability — the player cobbles something together in a dangerous moment, hands shaking. Reaching a Workbench feels like a brief exhale: more options, safer decisions, but never truly safe.

## Detailed Design

### Core Rules

**Rule 1 — Craft Modes**

| Mode | Access Condition | Recipe Set | Interruption |
|------|-----------------|------------|--------------|
| Field Craft | Always available | Field-only schematics | Interrupted by damage or enemy detection |
| Workbench Craft | Player within 200cm of a discovered Workbench | All unlocked schematics | Not interruptible (safe zone implied) |

**Rule 2 — Schematics**

- Schematics are world items (lootable, non-stackable, key-item category in Inventory).
- Finding a schematic permanently unlocks its recipe; the schematic is consumed on pickup.
- Undiscovered recipes are not visible in the crafting UI — the recipe slot does not exist until unlocked.
- Each recipe belongs to exactly one mode tier: Field or Workbench.

**Rule 3 — Recipe Execution**

1. Player opens Crafting UI (Field Craft: hold `IA_Craft`; Workbench: prompt on approach).
2. UI displays only unlocked recipes. Recipes the player has resources for are selectable; others are shown greyed with the missing resource listed.
3. Player selects recipe → confirm → resources consumed via `ConsumeItem()` → output added to inventory via `AddItem()`.
4. If inventory is full at output step: craft is blocked, resources are **not** consumed, player is notified.
5. Crafting takes time: Field Craft = 3.0s channel (cancellable by player), Workbench = 1.0s (brief animation).

**Rule 4 — Vertical Slice Recipe Set**

| Recipe | Mode | Inputs | Output | Category |
|--------|------|--------|--------|----------|
| Cure Device | Workbench | 2× Chemicals, 1× Scrap Metal | 1× `item_cure_device` | Cure Device |
| Improvised Grenade | Field | 1× Chemicals, 1× Scrap Metal | 1× `item_grenade_improvised` | Improvised Weapon |
| Molotov | Field | 1× Chemicals, 1× Fabric | 1× `item_molotov` | Improvised Weapon |
| Bandage | Field | 2× Fabric | 1× `item_bandage` | Medical Supply |
| Stimshot | Workbench | 1× Chemicals, 1× Fabric | 1× `item_stimshot` | Medical Supply |

**Rule 5 — Field Craft Interruption**

- If the player takes damage during the 3.0s channel: craft is cancelled, resources are **not** consumed, UI closes.
- If an enemy enters detection range during the channel: craft is cancelled (same behaviour).
- Cancellation is communicated via UI feedback and audio sting.

### States and Transitions

```
Idle ──[open craft UI]──► Browsing ──[select recipe]──► Confirming ──[confirm]──► Crafting
  ▲                           │                              │                        │
  └───[close/cancel]──────────┘◄─────[cancel]───────────────┘        [complete/interrupt]
                                                                                      │
                                                                                   Idle ◄──┘
```

### Interactions with Other Systems

| System | Direction | Interface |
|--------|-----------|-----------|
| Inventory | Read + Write | `GetResourceCount()`, `ConsumeItem()`, `AddItem()`, `CanCarryItem()` |
| Input System | Read | `IA_Craft` hold to open Field Craft; workbench proximity prompt |
| Game State Machine | Read + Write | Crafting state (blocks movement during channel); transitions to/from Playing |
| HUD System | Write | `ShowCraftingUI()`, `HideCraftingUI()`, recipe list, resource counts |
| Audio System | Write | Craft start, craft complete, craft cancel, craft interrupted SFX |
| Save/Load System | Read + Write | `SaveCraftingState()` — serialises set of unlocked schematic IDs; `RestoreCraftingState()` — restores unlocked schematic set on load |

## Formulas

**F1 — Craft Channel Duration**

```
CraftTime = BaseCraftTime × DifficultyModifier

Variables:
  BaseCraftTime       Field = 3.0s | Workbench = 1.0s
  DifficultyModifier  1.0 (no modifier at Vertical Slice scope; reserved for tuning)

Example: Field Craft Bandage → 3.0 × 1.0 = 3.0s channel
```

**F2 — Workbench Proximity Check**

```
bCanUseWorkbench = Distance(PlayerLocation, WorkbenchLocation) ≤ WorkbenchRadius

Variables:
  WorkbenchRadius     200cm (tunable)

Example: Player at 150cm from bench → 150 ≤ 200 → true → Workbench Craft available
```

**F3 — Inventory Capacity Check (pre-craft gate)**

```
bCanCraft = CanCarryItem(OutputItemId, 1)
          = (UsedSlots + OutputSlotSize) ≤ MaxSlots
          AND (CurrentWeight + OutputWeight) ≤ MaxWeight

Variables:
  UsedSlots       current occupied inventory slots
  OutputSlotSize  slot footprint of output item (e.g. Cure Device = 1×2 = 2 slots)
  MaxSlots        20 (from Inventory GDD)
  CurrentWeight   current carried weight (kg)
  OutputWeight    weight of output item (kg)
  MaxWeight       50 kg (from Inventory GDD)

Example: Crafting Cure Device (1×2, 1.0kg), inventory at 18/20 slots, 46.0/50.0kg
  Slots: (18 + 2) ≤ 20 → true
  Weight: (46.0 + 1.0) ≤ 50.0 → true → craft allowed
```

## Edge Cases

**EC1 — Inventory fills up between recipe selection and confirmation**
Player selects a recipe; output no longer fits by confirmation step. Craft is blocked at execution. Resources not consumed. UI shows "Inventory full" notification. Player must free space before retrying.

**EC2 — Resources drop below requirement during Field Craft channel**
Not possible at Vertical Slice scope — no mechanic exists to remove items from inventory while crafting UI is open. Resources are consumed atomically at channel completion, not reserved during it. If a future system introduces mid-channel item loss, this must be revisited.

**EC3 — Player is hit exactly as channel completes (same frame)**
Damage interrupt check runs before craft completion check. Damage wins: craft cancelled, resources not consumed.

**EC4 — Player walks out of Workbench range mid-craft**
Workbench Craft is not interruptible by movement (Rule 1). Player position is not rechecked after crafting begins. Output is produced regardless.

**EC5 — Schematic found for a recipe the player already knows**
Not possible by design — each schematic is a unique world item placed once. If a designer places a duplicate by error, the second pickup is a no-op (recipe already unlocked) with an "Already known" notification. No resources consumed.

**EC6 — Output item has a stack limit and player holds a full stack**
`CanCarryItem()` returns false. Craft blocked. Player notified. Resources not consumed. (e.g. Bandage stacks to 5; player holds 5 → cannot craft another.)

**EC7 — Crafting UI opened during active enemy detection (Field Craft)**
Craft is immediately cancelled the moment detection is active — even if player just opened the UI before channelling began. UI closes. No resources consumed.

## Dependencies

**Hard Dependencies** (system cannot function without):
- **Inventory System** ✅ (designed) — `GetResourceCount()`, `ConsumeItem()`, `AddItem()`, `CanCarryItem()`. Without it, crafting has no resource source or output destination.
- **Input System** ✅ (designed) — `IA_Craft` hold action for Field Craft; workbench proximity prompt. Without it, player cannot open crafting UI.
- **Game State Machine** ✅ (designed) — manages Crafting state, blocks movement during channel, handles transitions to/from Playing state.

**Soft Dependencies** (enhanced by but works without):
- **HUD System** ✅ (designed) — renders Crafting UI, recipe list, resource counts. Without it, no crafting interface (fallback: debug text list).
- **Audio System** (Not Started) — craft start, complete, cancel, interrupted SFX. Without it, crafting is silent.
- **Save/Load System** (Not Started) — persists unlocked schematics across sessions. Without it, all discovered recipes reset on load.

**Depended On By**:

| System | Dependency | Notes |
|--------|-----------|-------|
| Infection Spread System | Cure Device output | Crafting is the only way to produce `item_cure_device` at Vertical Slice scope |
| Health System | Bandage, Stimshot output | Crafted medical supplies consumed by Health System |
| Combat System | Improvised Grenade, Molotov output | Crafted throwables consumed by Combat System |

## Tuning Knobs

| Knob | Default | Safe Range | Affects |
|------|---------|-----------|---------|
| `FieldCraftChannelTime` | 3.0s | 1.5s – 6.0s | Risk/reward of crafting in the field. Lower = less punishing, higher = more tense |
| `WorkbenchCraftTime` | 1.0s | 0.5s – 2.0s | Feel of workbench crafting. Should always feel faster than field |
| `WorkbenchProximityRadius` | 200cm | 100cm – 400cm | How close the player must stand. Tighter = more intentional interaction |
| `CureDeviceRecipe_Chemicals` | 2 | 1 – 4 | Scarcity of cure devices. Higher = harder infection management |
| `CureDeviceRecipe_ScrapMetal` | 1 | 1 – 3 | Scarcity of cure devices |
| `ImprovGrenade_Chemicals` | 1 | 1 – 2 | Cost of throwable weapons |
| `ImprovGrenade_ScrapMetal` | 1 | 1 – 2 | Cost of throwable weapons |
| `Molotov_Chemicals` | 1 | 1 – 2 | Cost of throwable weapons |
| `Molotov_Fabric` | 1 | 1 – 2 | Cost of throwable weapons |
| `Bandage_Fabric` | 2 | 1 – 3 | Frequency of healing replenishment in the field |
| `Stimshot_Chemicals` | 1 | 1 – 2 | Cost of high-tier healing |
| `Stimshot_Fabric` | 1 | 1 – 2 | Cost of high-tier healing |

## Visual/Audio Requirements

### Visual

- **Crafting UI panel**: Grid-based recipe list consistent with Inventory UI visual language. Greyed-out recipes show missing resource in red. Selected recipe shows ingredient costs and output item icon.
- **Field Craft channel bar**: Radial or linear progress indicator visible in world-space (HUD overlay, not full-screen). Disappears on cancel or completion.
- **Workbench interaction prompt**: World-space prompt (consistent with other interactable objects) when player is within `WorkbenchProximityRadius`.
- **Schematic pickup**: Distinct pickup VFX/highlight to signal it is a knowledge item, not a resource. Different from standard loot glow.
- **Craft complete flash**: Brief item icon flash in HUD when output lands in inventory.

### Audio

| Event | Description |
|-------|-------------|
| Craft channel start (Field) | Improvised mechanical sounds — scraping, tearing, liquid |
| Craft channel loop (Field) | Low ambient tension loop during 3.0s channel |
| Craft complete | Satisfying click/snap — item assembled |
| Craft cancelled (player) | Abrupt stop, no completion sound |
| Craft interrupted (damage/detection) | Startled drop sound, brief clatter |
| Workbench craft complete | Heavier mechanical clunk — more precise than field |
| Schematic discovered | Distinct paper/knowledge discovery chime |
| Inventory full (blocked craft) | Negative UI tone, short |

## UI Requirements

- Crafting UI opens as an overlay panel (does not replace Inventory UI — both can be open simultaneously at Workbench).
- Recipe list shows: output item icon, output item name, required ingredients with current/required counts (e.g. "Chemicals 1/2").
- Recipes missing one or more ingredients are shown greyed with the shortfall highlighted in red; they are not selectable.
- Recipes requiring a Workbench are hidden entirely in Field Craft mode (not shown greyed — reduces confusion).
- Confirmation step: single button press to confirm selected recipe (no separate confirmation dialog — selection + confirm = two distinct inputs to prevent accidental crafting).
- Field Craft channel progress: HUD overlay bar only, no full-screen UI during channel (player must remain aware of surroundings).
- "Recipe unlocked" toast notification on schematic pickup: item icon + recipe name, 3s duration, dismissable.
- "Inventory full" notification on blocked craft: inline in UI (not a separate modal).

## Acceptance Criteria

**AC1 — Field Craft: basic execution**
GIVEN the player has 2× Fabric and the Bandage schematic is unlocked
WHEN the player holds `IA_Craft` and selects Bandage → confirms
THEN a 3.0s channel begins, 2× Fabric is consumed, 1× Bandage is added to inventory, and craft complete audio plays.

**AC2 — Field Craft: damage interruption**
GIVEN a 3.0s Field Craft channel is in progress
WHEN the player takes any damage
THEN the channel cancels immediately, no resources are consumed, and the interrupted audio plays.

**AC3 — Field Craft: enemy detection interruption**
GIVEN a 3.0s Field Craft channel is in progress
WHEN an enemy enters detection range
THEN the channel cancels immediately, no resources are consumed.

**AC4 — Workbench: proximity gate**
GIVEN the player is 250cm from a Workbench
WHEN the player opens crafting UI
THEN only Field-tier recipes are available (Workbench recipes are hidden).

**AC5 — Workbench: full recipe access**
GIVEN the player is within 200cm of a Workbench and the Cure Device schematic is unlocked
WHEN the player opens crafting UI
THEN the Cure Device recipe is visible and selectable.

**AC6 — Workbench craft execution**
GIVEN the player is at a Workbench, has 2× Chemicals and 1× Scrap Metal, and Cure Device is unlocked
WHEN the player crafts Cure Device
THEN a 1.0s animation plays, resources are consumed, 1× `item_cure_device` is added to inventory.

**AC7 — Inventory full gate**
GIVEN the player's inventory is at max capacity
WHEN the player attempts to confirm any craft
THEN the craft is blocked, an "Inventory full" notification appears, and no resources are consumed.

**AC8 — Schematic unlock**
GIVEN a Bandage schematic exists in the world and the player has not yet picked it up
WHEN the player picks it up
THEN the Bandage recipe appears in the crafting UI, the schematic is consumed from inventory, and a "Recipe unlocked" toast displays.

**AC9 — Undiscovered recipes hidden**
GIVEN the player has not found the Cure Device schematic
WHEN the player opens crafting UI at a Workbench
THEN the Cure Device recipe is not visible (no greyed slot, no placeholder).

**AC10 — Greyed recipe display**
GIVEN the Bandage schematic is unlocked but the player has only 1× Fabric (needs 2)
WHEN the player opens crafting UI
THEN Bandage is displayed greyed with "Fabric 1/2" in red and cannot be selected.

## Open Questions

1. **Workbench world placement** — how many Workbenches exist in the Vertical Slice level, and where? Needs Level Designer input. Placement determines how often the player can access the full recipe set and should be balanced against resource spawn rates.

2. **Schematic world placement** — which schematics are placed where in the level? Needs Level Designer + Narrative input. Placement tells the story of what survivors were trying to build.

3. **Resource spawn rates** — how common are Scrap Metal, Fabric, and Chemicals in the world? Currently undefined. Must be tuned against recipe costs to hit the intended scarcity feel. Needs Economy Designer pass.

4. **Field Craft detection trigger source** — which system owns enemy detection state that the Crafting System listens to? Likely the AI System (not yet designed). Interface contract TBD.

5. **Stack limits for crafted outputs** — Bandage, Improvised Grenade, Molotov, Stimshot stack limits not yet defined in Inventory GDD. Must be added to Inventory GDD before Crafting System implementation.
