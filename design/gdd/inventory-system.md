# Inventory System

> **Status**: Draft
> **Author**: user + agents
> **Last Updated**: 30 April 2026
> **Last Verified**: 30 April 2026
> **Implements Pillar**: Pillar 3 (Tense Survival)

## Summary

The Inventory System manages all items the player carries — weapons, ammo, healing supplies, cure devices, and misc resources. It uses a hybrid capacity model: a 5×4 slot grid (20 base slots, expandable to 30) for organization, plus a weight-based carry limit (50kg base, expandable to 70kg) for survival tension. Two dedicated weapon slots (primary + secondary) exist outside the grid but weapon weight counts toward the carry limit. The player accesses inventory through a grid-based UI (GSM Inventory state, priority 35) with movement dampened to 20% and the world slowed to 0.85x. Items have weight, stack rules, and category-based organization. Every slot and every kilogram matters — the inventory is the resource backbone of Pillar 3 (Tense Survival).

**Weapon quick-reference** (cross-system canonical values — registered in entities.yaml):

| Weapon | Weight | Footprint | Slots | Ammo Type | Magazine |
|--------|--------|-----------|-------|-----------|----------|
| Pistol | 1.5 kg | 1×2 | 2 | Pistol ammo | 15 rounds |
| Shotgun | 2.5 kg | 1×3 | 3 | Shotgun shells | 6 shells |
| Rifle | 3.5 kg | 2×2 | 4 | Rifle ammo | 20 rounds |
| Melee (knife) | 1.0 kg | 1×1 | 1 | — | — |

> **Quick reference** — Layer: `Feature` · Priority: `MVP` · Key deps: `Player Controller, Health System, Combat System`

## Overview

Hostile World's inventory is not a bottomless backpack — it is a survival tool with real constraints. The player carries what they can bear, and every choice has an opportunity cost. A medkit weighs 0.8kg and takes 1 slot. A rifle weighs 3.5kg and takes 4 slots. A cure device weighs 1.0kg and takes 2 slots. The player starts with 50kg capacity and 20 slots — enough for a basic loadout, but not enough for everything.

The system operates on two axes:

- **Slots** (organization): A 5×4 grid where items are placed. Each item has a slot footprint (1×1, 1×2, 2×2, etc.). The player organizes items within the grid. Expanding slots allows more items but not more weight.
- **Weight** (capacity): A total carry limit in kilograms. Every item has a weight value. The player cannot exceed the weight limit, even if slots are available. Expanding weight allows heavier loadouts but not more items.

Both limits must be satisfied to carry an item. If slots are full but weight is under limit, the player cannot pick up more items. If weight is at limit but slots are open, the player cannot pick up more items. This creates meaningful trade-offs: light items can fill slots, heavy items can fill weight, and the player must balance both.

The system also manages:

- **Weapon equipping**: 2 dedicated weapon slots (primary + secondary) outside the grid. Weapons in these slots are "equipped" and usable. Weapons in the grid are "stored" and must be moved to a weapon slot to use.
- **Ammo tracking**: Ammo is tracked per type, not per weapon. Weapons draw from the player's ammo pool.
- **Consumable use**: Healing items and cure devices are consumed on use. Inventory updates immediately.
- **Item pickup/drop**: Player picks up items from the world (context prompt) and can drop items from inventory (drag out of grid).

## Player Fantasy

The Inventory System makes the player feel **like a scavenger making hard choices with inadequate resources**. Every item is precious because there's never enough. The player opens their inventory before entering a hostile zone and weighs desperate trade-offs: "Do I bring an extra medkit or more ammo? Do I carry a cure device in case I find an infected camp, or do I save the weight for another weapon magazine?" There is no right answer — only the least wrong one.

The signature moment: the player finds a rare cure device on a dead soldier's body. It weighs 1.0kg and takes 2 slots. The player's inventory is at 48/50kg and 19/20 slots. Taking it means dropping something else. The player opens their inventory, weighs the options, and decides: drop the spare pistol ammo (0.3kg, 1 slot) to make room. The cure device goes in. The player closes the inventory and moves on — knowing they just made a choice that could save a life or cost them a firefight. The world is deadlier than their pack can hold.

This serves **Pillar 3 (Tense Survival)** — resources are scarce, every choice has weight, and the inventory is never full enough. The player is always one slot short, one kilogram over. This serves **Anti-Pillar** — the player is capable but not overpowered; the inventory reflects vulnerability, not preparation.

## Detailed Design

### Core Rules

**Rule 1 — Inventory Capacity**

| Property | Base | Max (Expanded) |
|----------|------|----------------|
| Grid size | 5×4 = 20 slots | 6×5 = 30 slots |
| Carry weight | 50 kg | 70 kg |
| Weapon slots | 2 (primary + secondary) | 2 (fixed) |

Both limits must be satisfied to carry an item:
- **Slots available**: Item's slot footprint fits in the grid
- **Weight available**: Current weight + item weight ≤ carry limit

**Rule 2 — Item Categories**

| Category | Symbol | Stack Rule | Weight Range | Slot Footprint | Examples |
|----------|--------|------------|--------------|----------------|----------|
| **Weapon** | W | No stacking (each weapon is unique) | 1.0–3.5 kg | 1×1 to 2×2 | Pistol (1×2), Rifle (2×2), Shotgun (1×3), Melee (1×1) |
| **Ammo** | A | Stacks up to 99 per stack | 0.05–0.15 per unit | 1×1 per stack | Pistol ammo, Rifle ammo, Shotgun shells |
| **Healing** | H | Stacks up to 5 per stack | 0.3–0.8 per unit | 1×1 per stack | Field Dressing, Medkit, Stimshot |
| **Cure** | C | No stacking (each device is single-use) | 1.0 kg | 1×2 | Cure Device |
| **Resource** | R | Stacks up to 10 per stack | 0.1–0.5 per unit | 1×1 per stack | Scrap metal, Fabric, Chemicals |
| **Key Item** | K | No stacking | 0.0–0.2 kg | 1×1 | Keycard, Intel document, Quest item |

**Rule 3 — Item Data Structure**

Each item is defined by the following data record (stored in a Data Table `DT_Items`):

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `ItemId` | FName | Unique identifier | `"item_medkit"` |
| `DisplayName` | FText | Display name | `"Medkit"` |
| `Category` | EItemCategory | Item category | Healing |
| `Weight` | float | Weight in kg | 0.8 |
| `SlotWidth` | int32 | Grid width (slots) | 1 |
| `SlotHeight` | int32 | Grid height (slots) | 1 |
| `MaxStack` | int32 | Max stack size (1 = no stacking) | 5 |
| `Description` | FText | Item description (tooltip) | `"Restores 60 HP over 4s. Stationary use only."` |
| `IconTexture` | UTexture2D | Inventory icon | medkit_icon.png |
| `UseAction` | EItemUseAction | What happens when used | Heal, DeployCure, EquipWeapon, None |
| `UseValue` | int32 | Effect magnitude | 60 (HP for Medkit) |
| `UseDuration` | float | Use animation time (seconds) | 4.0 |

**Rule 4 — Weapon Slots**

| Property | Value |
|----------|-------|
| Primary slot | Holds 1 weapon (rifle, shotgun). Weight counts toward carry limit. |
| Secondary slot | Holds 1 weapon (pistol, sidearm). Weight counts toward carry limit. |
| Equipped weapons | Usable in combat. Shown in HUD ammo counter. |
| Stored weapons | In inventory grid. Not usable until moved to a weapon slot. |
| Switch time | 0.5s (pistol↔rifle), 0.7s (shotgun). Cannot switch during reload or fire animation. |
| Weapon condition | Tracked per weapon: Clean (1.0), Dirty (0.8), Damaged (0.6). Affects weapon performance per Combat System Formula 2. |

**Rule 5 — Ammo Tracking**

Ammo is tracked per type, not per weapon:

| Ammo Type | Weight per Unit | Max Stack | Base Carry |
|-----------|----------------|-----------|------------|
| Pistol ammo | 0.05 kg | 99 | 60 rounds |
| Rifle ammo | 0.10 kg | 99 | 40 rounds |
| Shotgun shells | 0.15 kg | 99 | 20 shells |

Weapons draw from the player's ammo pool. When a weapon is fired, the corresponding ammo type is decremented. When a weapon is reloaded, ammo is drawn from the pool. If the pool is empty, the weapon cannot reload.

**Ammo weight note**: Ammo weight is calculated at pickup time (when the stack is added to inventory). Individual round weight is NOT tracked per-fire — the weight of an ammo stack is fixed when picked up and does not change as rounds are fired. This avoids imperceptibly small weight fluctuations (0.10kg per round) and reduces computational overhead. The weight difference from firing a full magazine is negligible and not tracked.

**Rule 6 — Item Pickup**

| Step | Action |
|------|--------|
| 1 | Player approaches item in world (within ContextTraceLength = 500cm) |
| 2 | Context prompt appears: "Pick Up [Item Name]" (or "Inventory Full" if capacity exceeded) |
| 3 | Player presses IA_Interact |
| 4 | System checks: slots available AND weight available |
| 5a | If both pass: item added to inventory, `OnItemPickedUp(ItemId)` fires, item removed from world |
| 5b | If slots full: prompt shows "No Space" (red tint). IA_Interact does nothing. |
| 5c | If weight full: prompt shows "Too Heavy" (red tint). IA_Interact does nothing. |
| 6 | If item is stackable and a matching stack exists, item is added to existing stack (if stack < MaxStack) |

**Grid Placement Algorithm (Item Pickup):**
When an item is picked up and added to the inventory grid, the system uses a **first-fit, top-left priority** algorithm:
1. Scan the grid row by row, left to right, top to bottom
2. Find the first contiguous block of empty slots that fits the item's footprint
3. Place the item in that position
4. If no contiguous block is found but total empty slots ≥ item footprint, the item is NOT auto-placed — the player must manually rearrange items in the inventory to make room
5. If the player is in the Inventory state (browsing) when picking up an item, the item is placed in the grid immediately and the grid UI updates. The player can then drag it to a different position.

**Rule 7 — Item Drop**

| Step | Action |
|------|--------|
| 1 | Player opens inventory (GSM transitions to Inventory state) |
| 2 | Player drags item out of grid or selects "Drop" from context menu |
| 3 | Item is removed from inventory, spawned in world at player's feet |
| 4 | `OnItemDropped(ItemId)` fires |
| 5 | Dropped items persist in world (can be picked up again) |

**Rule 8 — Item Use**

| Item Type | Use Mechanism | Effect |
|-----------|--------------|--------|
| **Healing** | Select item in inventory → "Use" OR press quick slot key | Restores HP per UseValue over UseDuration. Cancelled if player moves or takes damage (except Stimshot). |
| **Cure Device** | Select item in inventory → "Deploy" → target location OR press quick slot key → target location | Creates suppressant zone (3000cm radius, 300s duration). Consumed on deploy. |
| **Throwable** | Press quick slot key → aim → release | Throws item (grenade, molotov). Consumed on throw. |
| **Weapon** | Drag to weapon slot or quick-select | Equips weapon. Switch time applies. |
| **Resource** | Not directly usable | Used by Crafting System (Vertical Slice). |
| **Key Item** | Not directly usable | Used by Investigation/Quest systems. |

**Rule 9 — Quick Slots**

Quick slots provide fast access to frequently used consumables without opening the full inventory:

| Property | Value |
|----------|-------|
| Slot count | 4 (default bindings: 1, 2, 3, 4 keys / D-pad directions) |
| Slot contents | Any consumable item (Healing, Cure, Throwable categories) |
| Assignment | Drag item from inventory grid onto quick slot, or right-click item → "Assign to Quick Slot N" |
| Activation | Press quick slot key during gameplay (Playing state). Item is used immediately. |
| Consumption | Item is consumed on use. Quick slot becomes empty if stack reaches 0. |
| Stack behavior | Quick slot references a stack in the inventory grid. If the stack is moved or dropped, the quick slot becomes empty. |
| HUD display | Quick slot icons shown in HUD during gameplay (both Immersive and Tactical modes). Shows item icon + stack count. Empty slot shows grayed-out background. |
| Reassignment | Can be changed at any time in inventory screen. Cannot be changed during combat. |
| Conflict handling | If quick slot is pressed but the referenced item is no longer in inventory (dropped, consumed elsewhere), slot shows "Empty" and no action occurs. |

### States and Transitions

**Inventory System State Machine:**

| State | Entry Condition | Exit Condition | Behavior |
|-------|----------------|----------------|----------|
| **Closed** | Initial state | Player opens inventory (IA_Inventory) | No inventory UI. Items managed internally. |
| **Open** | GSM transitions to Inventory state (0.3s UI slide, world slows to 0.85x) | Player closes inventory (ESC or IA_Inventory) | Grid UI visible. Item drag/drop enabled. Movement dampened to 20%. |
| **Interrupted** | Combat engagement while inventory is open | Immediate transition | Inventory closed. GSM returns to Playing. IMC_Combat pushed. |

### Interactions with Other Systems

| System | Direction | Data Flow | Interface |
|--------|-----------|-----------|-----------|
| **Player Controller** | Reads + Writes | Inventory open/close, item interactions | `OnInventoryOpened()`, `OnInventoryClosed()`, `OnItemInteracted(ItemId)` — Player Controller routes IA_Inventory to Inventory System |
| **Health System** | Reads + Writes | Consumable items | `HasItem(ConsumableType)`, `ConsumeItem(ConsumableType)` — Health System checks for healing items before use. Inventory System decrements count on use. |
| **Combat System** | Reads + Writes | Weapon data, ammo counts, weapon switching | `GetCurrentWeapon()`, `GetAmmoCount(AmmoType)`, `ConsumeAmmo(AmmoType, Count)`, `SwitchWeapon(WeaponId)` — Combat System reads weapon/ammo state, Inventory System updates on fire/reload/switch. |
| **Infection Spread System** | Reads | Cure devices | `HasItem("item_cure_device")`, `ConsumeItem("item_cure_device")` — Infection Spread checks for cure devices before deployment. |
| **Game State Machine** | Reads + Writes | Inventory state transitions | `RequestStateTransition(InventoryStart)`, `RequestStateTransition(InventoryEnd)` — GSM manages Inventory state (priority 35). |
| **Input System** | Reads | IMC_Inventory activation | IMC_Inventory pushed when inventory opens (priority +2). Movement dampened to 20%. |
| **HUD System** | Writes | Inventory UI rendering | `ShowInventoryUI()`, `HideInventoryUI()` — HUD System renders the inventory grid, item icons, weight bar, slot count. |
| **Crafting System** | Reads | Resource items | `GetResourceCount(ResourceType)` — Crafting System checks for resources. Inventory System decrements on craft. |
| **Investigation System** | Reads | Key items | `HasItem(KeyItemId)` — Investigation System checks for quest/investigation items. |
| **Audio System** | Writes | Inventory SFX | `PlayInventorySound(EInventorySound)` — item pickup, drop, use, grid click sounds. |
| **Save/Load System** | Reads + Writes | Inventory state | `SaveInventoryState()`, `RestoreInventoryState()` — persists all item data, grid layout, weapon slots, ammo counts. |

**Interface Contract:**

```cpp
// Inventory System public interface (C++ sketch)
class UInventorySubsystem : public UGameInstanceSubsystem {
    // Capacity queries
    int32 GetMaxSlots();
    int32 GetUsedSlots();
    float GetMaxWeight();
    float GetCurrentWeight();
    bool CanCarryItem(FItemId ItemId, int32 Quantity = 1);
    
    // Item management
    bool AddItem(FItemId ItemId, int32 Quantity = 1);
    bool RemoveItem(FItemId ItemId, int32 Quantity = 1);
    int32 GetItemCount(FItemId ItemId);
    bool HasItem(FItemId ItemId, int32 Quantity = 1);
    bool ConsumeItem(FItemId ItemId, int32 Quantity = 1);
    
    // Weapon management
    FWeaponId GetEquippedWeapon(EWeaponSlot Slot);
    bool EquipWeapon(FWeaponId WeaponId, EWeaponSlot Slot);
    bool SwitchWeapon(EWeaponSlot Slot);
    
    // Ammo management
    int32 GetAmmoCount(EAmmoType AmmoType);
    bool ConsumeAmmo(EAmmoType AmmoType, int32 Count);
    bool AddAmmo(EAmmoType AmmoType, int32 Count);
    
    // Grid operations
    TArray<FInventoryItem> GetGridItems();
    bool MoveItem(FInventorySlotId From, FInventorySlotId To);
    bool DropItem(FInventorySlotId Slot);
    
    // Events
    FDelegateHandle SubscribeToItemAdded(FItemAddedDelegate Callback);
    FDelegateHandle SubscribeToItemRemoved(FItemRemovedDelegate Callback);
    FDelegateHandle SubscribeToInventoryOpened(FInventoryOpenedDelegate Callback);
    FDelegateHandle SubscribeToInventoryClosed(FInventoryClosedDelegate Callback);
    
    // Save/Load
    FInventoryStateData SaveInventoryState();
    void RestoreInventoryState(const FInventoryStateData& State);
}
```

## Formulas

**Formula 1 — Inventory Capacity Check**

The `can_carry` formula determines whether the player can pick up an item:

```
CanCarry = (SlotsUsed + ItemSlots ≤ MaxSlots) AND (WeightCurrent + ItemWeight ≤ MaxWeight)
```

**Variables:**

| Variable | Symbol | Type | Range | Source | Description |
|----------|--------|------|-------|--------|-------------|
| Used slots | SlotsUsed | int32 | 0–MaxSlots | This GDD | Current grid slots occupied |
| Item slots | ItemSlots | int32 | 1–6 | This GDD | Slot footprint of item being picked up |
| Max slots | MaxSlots | int32 | 20–30 | This GDD | Maximum grid capacity |
| Current weight | WeightCurrent | float | 0–MaxWeight | This GDD | Current total weight |
| Item weight | ItemWeight | float | 0.05–5.0 | This GDD | Weight of item being picked up |
| Max weight | MaxWeight | float | 50–70 | This GDD | Maximum carry weight |

**Expected output:** true (can carry) or false (cannot carry).
**Example:** Player has 19/20 slots used, 48/50kg. Item takes 1 slot, weighs 1.0kg. CanCarry = (19+1 ≤ 20) AND (48+1.0 ≤ 50) = true AND true = **true** (can carry).

---

**Formula 2 — Stack Merge**

The `stack_merge` formula determines how many units can be added to an existing stack:

```
UnitsAdded = min(QuantityToAdd, MaxStack − CurrentStackCount)
```

**Variables:**

| Variable | Symbol | Type | Range | Source | Description |
|----------|--------|------|-------|--------|-------------|
| Quantity to add | QuantityToAdd | int32 | 1–99 | This GDD | Units being picked up |
| Max stack size | MaxStack | int32 | 1–99 | This GDD | Item's max stack size |
| Current stack count | CurrentStackCount | int32 | 0–MaxStack | This GDD | Units already in stack |
| Units added | UnitsAdded | int32 | 0–QuantityToAdd | Calculated | Units merged into stack |

**Expected output:** Number of units merged. If UnitsAdded < QuantityToAdd, remaining units start a new stack (if slots available) or are left in world.
**Example:** Stack has 3/5 Field Dressings. Player picks up 4. UnitsAdded = min(4, 5-3) = **2**. 2 merge into stack, 2 remain (new stack or world).

---

**Formula 3 — Weight After Item Use**

The `weight_after_use` formula calculates weight change when an item is consumed:

```
WeightNew = WeightCurrent − (ItemWeight × QuantityConsumed)
```

**Variables:**

| Variable | Symbol | Type | Range | Source | Description |
|----------|--------|------|-------|--------|-------------|
| Current weight | WeightCurrent | float | 0–MaxWeight | This GDD | Weight before consumption |
| Item weight | ItemWeight | float | 0.05–5.0 | This GDD | Weight per unit |
| Quantity consumed | QuantityConsumed | int32 | 1–MaxStack | This GDD | Units consumed |
| New weight | WeightNew | float | 0–MaxWeight | Calculated | Weight after consumption |

**Expected output:** New total weight. Always ≤ previous weight (consumption reduces weight).
**Example:** Player weighs 48kg. Uses 1 Medkit (0.8kg). WeightNew = 48 − 0.8 = **47.2kg**.

## Edge Cases

| Scenario | Expected Behavior | Rationale |
|----------|------------------|-----------|
| **Player picks up item that exactly fills last slot but exceeds weight** | Pickup fails. Prompt shows "Too Heavy" (red tint). Item remains in world. | Both limits must be satisfied. Weight is the hard cap. |
| **Player picks up item that is under weight limit but no slots fit** | Pickup fails. Prompt shows "No Space" (red tint). Item remains in world. | Both limits must be satisfied. Slots are the hard cap. |
| **Player opens inventory while in combat** | Inventory is immediately interrupted and closed per GSM Rule 6b. GSM transitions to Playing (0.1s fast transition), IMC_Combat pushed, world timescale reset to 1.0x. Player loses inventory browsing progress. | Prevents "inventory stalling" during combat. Consistent with Player Controller rule. |
| **Player drops last of an ammo type while weapon is equipped with that ammo** | Weapon remains equipped but cannot reload. Ammo count shows 0. Player must find more ammo or switch weapons. | Dropping ammo is a player choice with consequences. Weapon doesn't auto-unequip. |
| **Player's weight is at limit and they consume a healing item** | Weight decreases by item weight. Player can now pick up heavier items. | Consumption frees weight. This is the intended resource loop. |
| **Inventory save/load mid-item-use (healing animation in progress)** | Use animation is cancelled on load. Item is NOT consumed (use was not completed). Player must re-initiate use. | Prevents item loss from save/load during use animation. |
| **Player tries to equip a weapon but both weapon slots are full** | Player must first unequip a weapon (move to inventory grid) before equipping a new one. If grid is full, player must drop an item first. | Two-weapon limit is hard. Player must manage weapon rotation. |
| **Stack split: player drags half a stack to a new grid position** | Stack splits into two. Original stack reduces, new stack created at drop position. Both stacks are independent. | Standard inventory behavior. Enables flexible resource management. |
| **Item picked up during dialogue** | Item pickup is queued. If inventory has space, item is added after dialogue ends. If no space, item remains in world with a marker. | Dialogue takes priority (GSM priority 30 > Inventory). Item is not lost. |
| **Two players (future co-op) try to pick up same item** | First player to interact gets the item. Second player sees "Item Taken" message. | Standard co-op item resolution. Deferred to Post-MVP. |
| **Player dies and reloads from checkpoint** | Inventory state is restored to checkpoint save. Any items picked up during the failed run are lost. Any items consumed during the failed run are restored. | Consistent with game-concept.md: "Death is meaningful — load from checkpoint, but lose progress on that run's choices." |
| **Player picks up item while inventory is already open** | Item is added to grid immediately using first-fit algorithm. Grid UI updates to show the new item. Player can drag it to a different position before closing inventory. | No need to close inventory to pick up items. Seamless browsing + pickup. |

## Dependencies

**Hard Dependencies** (system cannot function without):
- **Player Controller** ✅ (designed) — routes IA_Inventory to Inventory System. Context prompt validation (inventory full checks).
- **Game State Machine** ✅ (designed) — manages Inventory state (priority 35), state transitions, and transition animations (0.3s UI slide, world slow to 0.85x).
- **Input System** ✅ (designed) — IMC_Inventory (priority +2), movement dampening to 20%, dual input mode.

**Soft Dependencies** (enhanced by but works without):
- **Health System** ✅ (designed) — consumes healing items. Without it, healing items exist but have no use mechanism.
- **Combat System** ✅ (designed) — consumes ammo, equips weapons. Without it, weapons and ammo exist but have no combat function.
- **Infection Spread System** ✅ (designed) — consumes cure devices. Without it, cure devices exist but cannot be deployed.
- **HUD System** ✅ (designed) — renders inventory UI. Without it, inventory has no visual interface (fallback: debug text list).
- **Crafting System** (Not Started) — consumes resource items. Without it, resources exist but have no crafting use.
- **Investigation System** ✅ (designed) — checks for key items. Without it, key items exist but have no investigation function.
- **Audio System** (Not Started) — plays inventory SFX. **Sequencing risk:** inventory sound work (pickup, drop, use, grid click) is blocked until Audio System is designed. Inventory visual elements can be implemented independently.
- **Save/Load System** (Not Started) — persists inventory state. Without it, inventory resets on every load.

**Depended On By**:

| System | Interface Used | Expected Behavior |
|--------|---------------|-------------------|
| Health System | `HasItem()`, `ConsumeItem()` | Checks and consumes healing items |
| Combat System | `GetCurrentWeapon()`, `GetAmmoCount()`, `ConsumeAmmo()` | Reads weapon/ammo state, consumes ammo on fire |
| Infection Spread System | `HasItem()`, `ConsumeItem()` | Checks and consumes cure devices |
| Crafting System | `GetResourceCount()`, `ConsumeItem()` | Checks and consumes resources |
| Investigation System | `HasItem()` | Checks for key/investigation items |
| HUD System | `ShowInventoryUI()`, `HideInventoryUI()` | Renders inventory grid and item data |
| Save/Load System | `SaveInventoryState()`, `RestoreInventoryState()` | Persists and restores all inventory data |

## Tuning Knobs

| Parameter | Default | Safe Range | Effect of Increase | Effect of Decrease |
|-----------|---------|------------|-------------------|-------------------|
| `MaxSlotsBase` | 20 | 15–30 | More items carried, less scarcity | Fewer items, more tension |
| `MaxSlotsExpanded` | 30 | 25–40 | More end-game inventory freedom | Less expansion reward |
| `MaxWeightBase` | 50 kg | 30–70 | Heavier loadouts, less weight tension | Lighter loadouts, more scarcity |
| `MaxWeightExpanded` | 70 kg | 60–90 | More end-game weight freedom | Less expansion reward |
| `WeaponSlotCount` | 2 | 1–3 | More weapons equipped simultaneously | Fewer weapons, more switching |
| `WeaponSwitchTime_Pistol` | 0.5s | 0.3–1.0s | Faster weapon swaps | Slower swaps, more commitment |
| `WeaponSwitchTime_Rifle` | 0.5s | 0.3–1.0s | Faster weapon swaps | Slower swaps |
| `WeaponSwitchTime_Shotgun` | 0.7s | 0.5–1.5s | Faster weapon swaps | Slower swaps |
| `AmmoWeight_Pistol` | 0.05 kg | 0.02–0.10 kg | Lighter ammo, more can be carried | Heavier ammo, less carried |
| `AmmoWeight_Rifle` | 0.10 kg | 0.05–0.20 kg | Lighter ammo, more can be carried | Heavier ammo, less carried |
| `AmmoWeight_Shotgun` | 0.15 kg | 0.10–0.30 kg | Lighter shells, more can be carried | Heavier shells, less carried |
| `HealWeight_FieldDressing` | 0.3 kg | 0.1–0.5 kg | Lighter healing, more carried | Heavier healing, less carried |
| `HealWeight_Medkit` | 0.8 kg | 0.5–1.5 kg | Lighter medkits, more carried | Heavier medkits, less carried |
| `HealWeight_Stimshot` | 0.2 kg | 0.1–0.4 kg | Lighter stimshots, more carried | Heavier stimshots, less carried |
| `CureDeviceWeight` | 1.0 kg | 0.5–2.0 kg | Lighter cures, more carried | Heavier cures, harder choice |
| `MovementDampenFactor` | 0.2 | 0.0–0.5 | More movement while browsing | Less movement, more vulnerable |
| `UISlideDuration` | 0.3s | 0.2–0.5s | Smoother inventory transition | Snappier transition |

> **Note:** `WorldSlowFactor` (0.85x) is defined in GSM GDD as the authoritative owner. Inventory System references it but does not own it.
| `HealUseDuration_FieldDressing` | 2.0s | 1.0–4.0s | Faster healing, less vulnerable | Slower healing, more risk |
| `HealUseDuration_Medkit` | 4.0s | 2.0–6.0s | Faster healing, less vulnerable | Slower healing, more risk |
| `HealUseDuration_Stimshot` | 0.8s | 0.5–1.5s | Faster stim, less vulnerable | Slower stim, more risk |

**Controller/Gamepad Navigation:** Inventory grid navigation with gamepad uses D-pad or left stick to move cursor between slots. A button confirms selection (use/equip), B button cancels/backs out. Drag-and-drop is replaced by: select item → press X to "pick up" → move cursor to target slot → press X to "place down." Radial quick-action menu available for common actions (use, drop, equip). Full UX spec deferred to `/ux-design`.

## Visual/Audio Requirements

### Inventory UI Visual

| Element | Description |
|---------|-------------|
| **Grid** | 5×4 slot grid (20 slots). Each slot is 80×80px. Grid background: dark semi-transparent (#1A1A1A at 80% opacity). |
| **Item icon** | 64×64px centered in slot. Category color border: Weapon (red #F44336), Ammo (yellow #FFC107), Healing (green #4CAF50), Cure (blue #2196F3), Resource (gray #9E9E9E), Key Item (purple #9C27B0). |
| **Stack count** | Bottom-right corner of slot. White text, 12pt. Hidden if stack = 1. |
| **Weight bar** | Top of inventory screen. Shows CurrentWeight / MaxWeight. Color: green (<60%), yellow (60–85%), red (>85%). |
| **Slot counter** | Top of inventory screen. Shows UsedSlots / MaxSlots. |
| **Weapon slots** | Left panel, 2 slots (primary + secondary). Larger than grid slots (120×80px). Shows equipped weapon icon + ammo count. |
| **Item tooltip** | Appears on hover. Shows: name, weight, description, use action. Background: dark (#2A2A2A at 90% opacity). |
| **Drag ghost** | Semi-transparent item icon follows cursor while dragging. 50% opacity. |

### Inventory Audio

| Sound | Trigger | Description | Volume | Priority |
|-------|---------|-------------|--------|----------|
| **Inventory Open** | Inventory UI appears | Soft slide + click | -16dB | Low |
| **Inventory Close** | Inventory UI disappears | Soft slide + click | -16dB | Low |
| **Item Pickup** | Item added to inventory | Satisfying click + chime | -14dB | Low |
| **Item Drop** | Item removed from inventory | Soft thud | -18dB | Low |
| **Item Use** | Consumable activated | Context-specific (bandage tear, injection hiss) | -12dB | Medium |
| **Grid Click** | Item moved in grid | Soft click | -20dB | Low |
| **Inventory Full** | Pickup fails (no space/too heavy) | Low buzz | -14dB | Medium |
| **Weapon Equip** | Weapon moved to weapon slot | Metallic click + slide | -14dB | Low |

## UI Requirements

| Element | Mode | Position | Update Frequency | Condition |
|---------|------|----------|-----------------|-----------|
| **Inventory grid** | Full-screen overlay | Center | On item add/remove/move | Active during Inventory state |
| **Weight bar** | Top of inventory | Static | On item add/remove/use | Always visible in inventory |
| **Slot counter** | Top of inventory | Static | On item add/remove | Always visible in inventory |
| **Weapon slots** | Left panel | Static | On weapon equip/unequip | Always visible in inventory |
| **Item tooltip** | Hover overlay | Follows cursor | On hover | Visible when hovering over item |
| **HUD ammo counter** | Tactical HUD only | Bottom-right | Every frame | Visible during gameplay (not in inventory) |
| **Inventory Full prompt** | Context prompt | Center-bottom | On pickup attempt | Shows when capacity exceeded |

## Cross-References

| This Document References | Target GDD | Specific Element Referenced | Nature |
|--------------------------|-----------|----------------------------|--------|
| Inventory state priority (35) | `design/gdd/game-state-machine.md` | GSM Inventory state, priority stack, 0.3s UI slide, world slow to 0.85x | State dependency |
| IMC_Inventory input mapping | `design/gdd/input-system.md` | IMC_Inventory priority +2, movement dampened to 20%, IA_Inventory action | Input dependency |
| Combat interruption of inventory | `design/gdd/player-controller.md` | Inventory interrupted when enemy enters engagement range, IMC_Combat pushed | Rule dependency |
| Healing item consumption | `design/gdd/health-system.md` | Field Dressing (+25HP), Medkit (+60HP), Stimshot (+40HP), use duration, cancel on damage | Data dependency |
| Weapon data and ammo tracking | `design/gdd/combat-system.md` | Weapon condition (Clean/Dirty/Damaged), ammo types, switch times | Data dependency |
| Cure device consumption | `design/gdd/infection-spread-system.md` | Cure device weight (1.0kg), slot footprint (1×2), deploy mechanics | Data dependency |
| Inventory UI rendering | `design/gdd/hud-system.md` | ShowInventoryUI(), HideInventoryUI(), inventory grid rendering | UI dependency |
| Quick slot HUD display | `design/gdd/hud-system.md` | Quick slot icons in both Immersive and Tactical modes, bottom-center position | UI dependency |
| Key items for investigation | `design/gdd/investigation-system.md` | Key item category, investigation item checks | Data dependency |

## Acceptance Criteria

**Core Rules:**

- **GIVEN** player has 19/20 slots used and 48/50kg weight, **WHEN** player picks up an item that takes 1 slot and weighs 1.0kg, **THEN** item is added to inventory, slots = 20/20, weight = 49/50kg, `OnItemPickedUp` fires.

- **GIVEN** player has 20/20 slots used and 40/50kg weight, **WHEN** player picks up an item that takes 1 slot, **THEN** pickup fails, prompt shows "No Space" (red tint), item remains in world.

- **GIVEN** player has 15/20 slots used and 50/50kg weight, **WHEN** player picks up an item that weighs 0.5kg, **THEN** pickup fails, prompt shows "Too Heavy" (red tint), item remains in world.

- **GIVEN** player has 3/5 Field Dressings in a stack, **WHEN** player picks up 4 more Field Dressings, **THEN** 2 merge into existing stack (stack = 5/5), 2 form a new stack (if slots available), or 2 remain in world (if no slots).

- **GIVEN** player opens inventory (IA_Inventory pressed), **WHEN** GSM transitions to Inventory state, **THEN** inventory UI appears (0.3s slide), world slows to 0.85x, movement dampened to 20%, IMC_Inventory pushed.

- **GIVEN** inventory is open and enemy enters engagement range, **WHEN** combat engagement fires, **THEN** inventory is immediately closed, GSM returns to Playing, IMC_Combat pushed, player loses inventory browsing progress.

- **GIVEN** player equips a rifle in primary weapon slot, **WHEN** combat system queries `GetCurrentWeapon(Primary)`, **THEN** rifle is returned with its ammo count and condition.

- **GIVEN** player has 10 rifle ammo rounds (stack weight = 1.0kg), **WHEN** player fires rifle 3 times, **THEN** ammo count = 7, stack weight remains 1.0kg (ammo weight is fixed at pickup, not tracked per-round).

- **GIVEN** player uses a Medkit (0.8kg, +60HP, 4.0s duration), **WHEN** use completes, **THEN** HP = min(HP + 60, 100), Medkit count decremented by 1, weight reduced by 0.8kg.

- **GIVEN** player uses a Medkit and takes damage during the 4.0s use animation, **WHEN** damage is dealt, **THEN** use is cancelled, Medkit is consumed (wasted), no HP restored.

- **GIVEN** player uses a Stimshot and takes damage during the 0.8s use animation, **WHEN** damage is dealt, **THEN** use continues (Stimshot is not cancelled), HP restored after 0.8s.

- **GIVEN** player deploys a cure device, **WHEN** deployment completes, **THEN** cure device count decremented by 1, weight reduced by 1.0kg, suppressant zone created (3000cm radius, 300s duration).

**Formulas:**

- **GIVEN** Formula 1 (can carry), **WHEN** player has 19/20 slots, 48/50kg, item takes 1 slot and weighs 1.0kg, **THEN** CanCarry = (19+1 ≤ 20) AND (48+1.0 ≤ 50) = **true**.

- **GIVEN** Formula 2 (stack merge), **WHEN** stack has 3/5, player picks up 4, **THEN** UnitsAdded = min(4, 5-3) = **2**. 2 merge, 2 remain.

- **GIVEN** Formula 3 (weight after use), **WHEN** player weighs 48kg, uses 1 Medkit (0.8kg), **THEN** WeightNew = 48 − 0.8 = **47.2kg**.

**Edge Cases:**

- **GIVEN** player drops last of an ammo type while weapon is equipped with that ammo, **WHEN** drop completes, **THEN** weapon remains equipped, ammo count = 0, weapon cannot reload until more ammo is found.

- **GIVEN** player's weight is at 50/50kg and they consume a Field Dressing (0.3kg), **WHEN** consumption completes, **THEN** weight = 49.7kg, player can now pick up items up to 49.7kg.

- **GIVEN** player saves with inventory open mid-item-drag, **WHEN** game loads, **THEN** inventory is in closed state, item is in its original grid position (drag was not completed).

- **GIVEN** player tries to equip a weapon but both weapon slots are full and inventory grid is full, **WHEN** player attempts to equip, **THEN** equip fails. Player must first drop an item from inventory or unequip a weapon.

- **GIVEN** item pickup is attempted during dialogue, **WHEN** dialogue is active, **THEN** pickup is queued. After dialogue ends, if inventory has space, item is added. If no space, item remains in world.

- **GIVEN** player dies with items picked up during the failed run, **WHEN** game reloads from checkpoint, **THEN** inventory state is restored to checkpoint save. Items picked up during failed run are lost. Items consumed during failed run are restored.

- **GIVEN** player picks up item while inventory is open, **WHEN** item is added to grid, **THEN** item is placed using first-fit algorithm, grid UI updates immediately, player can drag item to different position before closing inventory.

## Open Questions

| # | Question | Owner | Deadline | Resolution |
|---|----------|-------|----------|-----------|
| OQ-1 | Should the inventory grid support auto-sort (by category, weight, or name)? | ux-designer | UX spec review | |
| OQ-2 | Should weapon degradation (condition decrease) happen from use, from environmental damage, or both? Combat System OQ-1 raises this. | game-designer | GDD review | |
| OQ-3 | Should the player be able to quick-drop items (hotkey to drop held item) without opening the full inventory? | game-designer | Playtest | |
| OQ-4 | Should inventory expansion (slot/weight increases) be tied to progression (backpack upgrades) or exploration (finding larger bags)? | game-designer | Progression design | |
| OQ-5 | Should key items (quest/investigation items) have zero weight and not consume slots? | game-designer | GDD review | |
| OQ-6 | Should the inventory support a "favorite" or "quick slot" system for frequently used items? | ux-designer | UX spec review | ✅ Resolved: Yes. 4 quick slots (1-4 keys, D-pad directions) for consumables. See Rule 9. |

## Progression & Depth

The Inventory System does not unlock new mechanics over time — the grid, weight limit, and item management work the same from the first pickup to the last. However, the player's **resource management skill** evolves through mastery:

### Inventory Mastery Curve

| Phase | Player Behavior | Inventory Experience |
|-------|----------------|-------------------------|
| **First hour** | Picks up everything, runs out of space quickly, drops items randomly to make room. | Inventory feels punishing. Player learns weight vs. slot trade-offs. |
| **3–5 hours** | Plans loadouts before entering zones. Prioritizes essential items. Uses stack management efficiently. | Inventory becomes strategic. Player optimizes for specific zone types (combat-heavy vs. exploration-heavy). |
| **10+ hours** | Min-maxes inventory for specific runs. Knows exact weight of every item. Uses every slot efficiently. | Inventory is a core skill. The player can carry exactly what they need for any situation. |

### Deferred Inventory Content (Vertical Slice and beyond)

| Feature | Current State | Deferred To | Rationale |
|---------|--------------|-------------|-----------|
| Gear slots (clothing, flashlight, equipment) | Not designed | Vertical Slice | Equipment layer with stat modifiers (armor, stealth, visibility). Adds RPG depth beyond MVP scope. |
| Backpack upgrades | Not designed | Vertical Slice | Expand slots/weight through progression |
| Quick-drop hotkey | Not designed | Vertical Slice | Drop held item without opening inventory |
| Auto-sort | Not designed | Alpha | Sort grid by category, weight, or name |
| Co-op item trading | Not designed | Post-MVP | Trade items between players |

---

## Design Review Findings

> **Date**: 30 April 2026
> **Reviewer**: design-review skill
> **Verdict**: PASS (with corrections — all resolved below)

### Completeness
- **8/8 required sections** present and substantive
- Bonus sections: Dependencies, Visual/Audio Requirements, UI Requirements, Cross-References, Acceptance Criteria (Gherkin), Tuning Knobs (20 parameters), State Machine, Interface Contract (C++ sketch)

### Issues Found & Resolved

| # | Issue | Severity | Status | Resolution |
|---|-------|----------|--------|------------|
| 1 | Medkit weight discrepancy (Summary said 0.5kg, Rule 2/Formula 3/AC said 0.8kg) | Must Fix | ✅ Resolved | Summary updated to 0.8kg |
| 2 | Stimshot UseDuration undefined | Must Fix | ✅ Resolved | Added to Tuning Knobs: 0.8s (range 0.5–1.5s). Also added Field Dressing (2.0s) and Medkit (4.0s) use durations. |
| 3 | Grid placement algorithm not specified | Must Fix | ✅ Resolved | Added to Rule 6: first-fit, top-left priority. If no contiguous block found, player must manually rearrange. |
| 4 | Ammo weight tracked per-round (imperceptible) | Should Fix | ✅ Resolved | Clarified: ammo weight is fixed at pickup time, not tracked per-fire. AC updated accordingly. |
| 5 | Controller/gamepad inventory navigation not addressed | Should Fix | ✅ Resolved | Added controller navigation spec to Tuning Knobs section. Full UX spec deferred to `/ux-design`. |
| 6 | Inventory state on death/checkpoint unspecified | Should Fix | ✅ Resolved | Added to Edge Cases and Acceptance Criteria: inventory restored to checkpoint, items picked up during failed run lost. |
| 7 | Pickup behavior while inventory is open not specified | Should Fix | ✅ Resolved | Added to Edge Cases and Acceptance Criteria: item added immediately via first-fit, grid UI updates, player can drag to reposition. |

### Minor Notes (not blockers)
- OQ-4 (inventory expansion vs. "mastery not stats" pillar) is acknowledged and deferred to progression design. The expanded values (30 slots, 70kg) are defined as maximums but the expansion mechanism is TBD.
- Multi-stack pickup merge edge case is covered by Formula 2 (stack merge) — remaining units form new stack or stay in world.
