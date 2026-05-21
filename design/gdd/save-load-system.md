# Save/Load System

> **Status**: In Design
> **Author**: user + agents
> **Last Updated**: 2026-05-15
> **Implements Pillar**: Foundation (MVP)

## Overview

The Save/Load System persists and restores all meaningful game state across sessions using a checkpoint-based auto-save model with a single save slot. Auto-saves trigger at defined world checkpoints (entering new areas, completing key investigation events) and on clean exit. There is no manual save — the player cannot choose when to save. This is intentional: a single persistent slot with no save-scumming preserves the weight of survival decisions, consistent with Pillar 3 (Tense Survival). On load, the game restores player position, health, inventory, crafting schematics, infection spread state, faction reputation, investigation progress, and world interaction flags (looted containers, opened doors, collected items). Load occurs during the GSM Loading state; save is disabled during Cutscene and GameOver states per the GSM contract.

## Player Fantasy

The game never asks "would you like to save?" It just remembers. The player closes the game mid-escape from an infected zone and returns the next day to find the world exactly as they left it — the door still ajar, the enemies still prowling, the cure device still in their pocket. There is no safety net. The decision to use that last chemical on a Molotov instead of saving it for a Cure Device is permanent. A bad checkpoint is something to survive out of, not reload away. The single slot communicates something about the world: this is the only timeline. The player and the world move forward together.

## Detailed Design

### Core Rules

**Rule 1 — Single Save Slot**
One save file exists per platform user profile. Writing a new save overwrites the previous. There is no "new game +" or slot selection at MVP scope.

**Rule 2 — Auto-Save Only**
The player has no save command. Auto-save fires on:
- Entering a new named world area (zone boundary trigger)
- Completing a key investigation event (flagged by Investigation System)
- Clean game exit (application quit from Paused state)

Save is explicitly **disabled** when GSM state is Cutscene or GameOver.

**Rule 3 — Save Payload**
Each save captures a complete snapshot of the following subsystems:

| Domain | Data Saved | Source Interface |
|--------|-----------|-----------------|
| Player Transform | Position (X,Y,Z), Rotation (Yaw) | `GetPlayerTransform()` |
| Health | Current HP, max HP, active status effects | `SaveHealthState()` |
| Inventory | All items, grid layout, weapon slots, ammo counts | `SaveInventoryState()` |
| Crafting | Set of unlocked schematic IDs | `SaveCraftingState()` |
| Infection Spread | Per-zone infection level, active spread vectors | `SaveInfectionState()` |
| Faction Reputation | Reputation value per faction ID | `SaveFactionState()` |
| Investigation | Completed clue IDs, active objective IDs | `SaveInvestigationState()` |
| World Flags | Per-actor interaction flags (looted, opened, collected, destroyed) | `SaveWorldFlags()` |
| Map System | Fog-of-war bitmask per zone, auto-pinned locations, manual markers | `SaveMapState()` |
| Tutorial System | Dismissed hint IDs (set of `FName`), tutorial completion flags per phase | `SaveTutorialState()` |
| GSM | Last valid GSM state at save time (always Playing or Paused) | `GetCurrentState()` |

**Rule 4 — Save Format**
Serialised as a UE5 `USaveGame` object, written to platform save storage via `UGameplayStatics::SaveGameToSlot()`. Slot name: `"HostileWorldSave_Slot0"`. Async write — game continues during write; write completion fires `OnSaveComplete` delegate.

**Rule 5 — Load Sequence**
Load occurs exclusively during the GSM Loading state:
1. GSM enters Loading state.
2. Save/Load System checks for existing save via `DoesSaveGameExist()`.
3. If save exists: deserialise and distribute state to each subsystem via their Restore interfaces.
4. If no save exists: initialise all subsystems to default new-game state.
5. On completion, fire `OnLoadComplete` — GSM transitions Loading → Playing.

**Rule 6 — Corruption Handling**
If `LoadGameFromSlot()` returns null or deserialisation fails:
- Log error with platform-specific save path.
- Delete corrupted save file.
- Fall back to new-game defaults.
- Display "Save data could not be loaded. Starting new game." notification on HUD.
- Do not crash.

**Rule 7 — Save Indicator**
A non-intrusive save icon (small, corner-placed) displays for 2.0s when a save write begins. It disappears on `OnSaveComplete`. Never blocks input. Never pauses the game.

### States and Transitions

The Save/Load System has no player-visible state machine. Internally it transitions between three operational modes driven by GSM events:

```
Idle ──[auto-save trigger]──► Saving ──[OnSaveComplete]──► Idle
  ▲
  └──[GSM enters Loading]──► Loading ──[OnLoadComplete]──► Idle
```

Save and Load are mutually exclusive — a load cannot begin while a save is in progress. If a load is requested during an active save write, the load is queued and fires on `OnSaveComplete`.

### Interactions with Other Systems

| System | Direction | Interface |
|--------|-----------|-----------|
| Game State Machine | Reads | Subscribes to `OnStateEntered` — triggers save on checkpoint events; disables save in Cutscene/GameOver; triggers load in Loading state |
| Inventory System | Read + Write | `SaveInventoryState()`, `RestoreInventoryState()` |
| Health System | Read + Write | `SaveHealthState()`, `RestoreHealthState()` |
| Crafting System | Read + Write | `SaveCraftingState()` (serialises unlocked schematic ID set), `RestoreCraftingState()` |
| Infection Spread System | Read + Write | `SaveInfectionState()`, `RestoreInfectionState()` |
| Faction Reputation System | Read + Write | `SaveFactionState()`, `RestoreFactionState()` |
| Investigation System | Read + Write | `SaveInvestigationState()`, `RestoreInvestigationState()` |
| World Actors | Read + Write | `SaveWorldFlags()` — iterates all flagged actors; `RestoreWorldFlags()` — re-applies interaction flags on level load |
| HUD System | Write | `ShowSaveIndicator()`, `HideSaveIndicator()` — triggers save icon display |
| Player Controller | Read | `GetPlayerTransform()` on save; `SetPlayerTransform()` on load |
| Tutorial System | Read + Write | `SaveTutorialState()`, `RestoreTutorialState()` — persists dismissed hint IDs and tutorial completion flags |
| Map System | Read + Write | `SaveMapState()`, `RestoreMapState()` — persists fog bitmask, auto-pinned locations, manual markers |

## Formulas

**F1 — Save Trigger Eligibility**

```
bCanSave = (CurrentGSMState ≠ Cutscene)
         AND (CurrentGSMState ≠ GameOver)
         AND (bSaveInProgress = false)

Variables:
  CurrentGSMState   Active state from Game State Machine
  bSaveInProgress   True while async write is in flight

Example: Player in Playing state, no active save → true → save eligible
Example: Player in Cutscene → false → save suppressed
```

**F2 — World Flag Serialisation Size Estimate**

```
EstimatedFlagBytes = FlaggedActorCount × BytesPerFlag

Variables:
  FlaggedActorCount   Number of world actors with interaction flags (designer-placed)
  BytesPerFlag        ~8 bytes (Actor GUID 4B + flag bitfield 4B)

Example: 500 flagged actors × 8B = ~4KB — negligible save file overhead
```

**F3 — Save Indicator Display Duration**

```
IndicatorDuration = BaseDuration (fixed)

Variables:
  BaseDuration    2.0s (tunable)

Note: Indicator disappears early if OnSaveComplete fires before BaseDuration elapses.
```

## Edge Cases

**EC1 — Application force-quit (crash or OS kill) mid-session**
Clean exit save does not fire. Player resumes from last successful checkpoint save. This is by design — no autosave on crash, no partial save written. Acceptable data loss window = time since last checkpoint.

**EC2 — Auto-save triggers while player is in Inventory state**
GSM state is Inventory (not Cutscene or GameOver) → save is eligible. Save fires in background. Inventory UI remains open. Save indicator appears in HUD corner. No interruption to player.

**EC3 — Two checkpoint triggers fire within the same frame**
Save writes are queued — second trigger is ignored if `bSaveInProgress` is true. First save completes, then the system returns to Idle. The second trigger event is discarded (not re-queued); the completed save already reflects the world state at that moment.

**EC4 — Load requested with no existing save file**
`DoesSaveGameExist()` returns false → initialise all subsystems to new-game defaults. No error shown to player. This is the standard first-boot path.

**EC5 — Save file exists but is from an older game version**
`USaveGame` version field mismatch detected on deserialise → treat as corrupted (Rule 6): delete, fall back to new-game defaults, show notification. No attempt to migrate old save data at MVP scope.

**EC6 — Platform storage full (disk/cloud quota exceeded)**
`SaveGameToSlot()` returns failure. Log error. Display "Could not save — storage full." HUD notification. Game continues. Next checkpoint will retry. Previous save (if any) is preserved — write failure does not delete existing slot.

**EC7 — Load fires while a save write is in progress**
Save write takes priority. Load is queued. On `OnSaveComplete`, load executes immediately. The loaded state reflects the just-completed save (correct behaviour — most recent world state is loaded).

## Dependencies

**Hard Dependencies** (system cannot function without):
- **Game State Machine** ✅ (designed) — save trigger gating (Cutscene/GameOver suppression), load sequence coordination (Loading state), clean-exit save trigger.
- **Player Controller** ✅ (designed) — `GetPlayerTransform()` on save; `SetPlayerTransform()` on load.
- **Inventory System** ✅ (designed) — `SaveInventoryState()`, `RestoreInventoryState()`.
- **Health System** ✅ (designed) — `SaveHealthState()`, `RestoreHealthState()`.

**Soft Dependencies** (enhanced by but works without):
- **Crafting System** ✅ (designed this session) — `SaveCraftingState()`, `RestoreCraftingState()`. Without it, schematics reset on load.
- **Infection Spread System** ✅ (designed) — `SaveInfectionState()`, `RestoreInfectionState()`. Without it, infection resets on load.
- **Faction Reputation System** ✅ (designed) — `SaveFactionState()`, `RestoreFactionState()`. Without it, reputation resets on load.
- **Investigation System** ✅ (designed) — `SaveInvestigationState()`, `RestoreInvestigationState()`. Without it, investigation progress resets on load.
- **HUD System** ✅ (designed) — `ShowSaveIndicator()`, `HideSaveIndicator()`. Without it, save feedback is silent.

**Depended On By**:

| System | Dependency | Notes |
|--------|-----------|-------|
| All systems listed above | State restoration on load | Every system with persistent state depends on Save/Load to survive a session restart |

## Tuning Knobs

| Knob | Default | Safe Range | Affects |
|------|---------|-----------|---------|
| `SaveIndicatorDuration` | 2.0s | 0.5s – 4.0s | How long the save icon is visible. Shorter = less intrusive, longer = more reassuring |
| `SaveSlotName` | `"HostileWorldSave_Slot0"` | String | Platform save slot identifier. Change only for platform certification requirements |
| `bCorruptionFallbackToNewGame` | true | bool | If false, show error screen on corruption instead of silently starting new game. false = stricter, better for QA |
| `CheckpointCooldownSeconds` | 30.0s | 10s – 120s | Minimum time between auto-saves. Prevents save spam if player crosses zone boundaries rapidly |

## Visual/Audio Requirements

### Visual
- **Save indicator**: Small icon, corner-placed (bottom-right, consistent with HUD layout). Non-animated — static icon is sufficient. Must not overlap health or infection HUD elements. Visible for `SaveIndicatorDuration`, fades out over 0.3s.
- **Load screen**: Handled by GSM Loading state visual (heartbeat pulse, vital monitor aesthetic per GSM GDD). Save/Load System has no additional visual requirements during load.
- **Corruption notification**: Standard HUD notification style (same as "Inventory full"). Text only: "Save data could not be loaded. Starting new game." 5s duration.
- **Storage full notification**: Same style. Text: "Could not save — storage full." 5s duration.

### Audio
- No audio cues for save/load at MVP scope. The save is silent and non-intrusive by design. Load audio is owned by the GSM Loading state.

## UI Requirements

- Save indicator is the only UI element owned by this system. All other load/error feedback uses the standard HUD notification component.
- No save/load menu exists at MVP scope — there is nothing for the player to interact with.
- On boot with an existing save, the Title screen shows a "Continue" option (not "New Game"). The Title screen UI is owned by the HUD/UI System; Save/Load System exposes `HasExistingSave()` for the Title screen to query.
- No in-game "load" option — the player cannot manually trigger a load while alive. Load only occurs via the GSM Loading state (restart after GameOver or boot).

## Acceptance Criteria

**AC1 — Checkpoint auto-save fires on zone entry**
GIVEN the player crosses a named zone boundary trigger
WHEN the GSM state is Playing or Paused
THEN a save write begins within 1 frame, the save indicator appears for `SaveIndicatorDuration`, and the save file is updated on disk.

**AC2 — Save suppressed in Cutscene**
GIVEN the GSM state is Cutscene
WHEN a checkpoint trigger fires
THEN no save write occurs and no save indicator appears.

**AC3 — Save suppressed in GameOver**
GIVEN the GSM state is GameOver
WHEN any save trigger fires
THEN no save write occurs.

**AC4 — State restoration on load**
GIVEN a save file exists with a known player position, inventory, and health value
WHEN the game is launched and the GSM enters Loading state
THEN the player spawns at the saved position, inventory matches the saved state, and health matches the saved value.

**AC5 — New game on missing save**
GIVEN no save file exists on the platform
WHEN the GSM enters Loading state
THEN all subsystems initialise to default new-game values and no error is shown.

**AC6 — Corruption fallback**
GIVEN the save file is corrupted (manually corrupted for test)
WHEN the GSM enters Loading state
THEN the corrupted file is deleted, all subsystems initialise to new-game defaults, and the "Save data could not be loaded" notification appears for 5s.

**AC7 — Storage full handling**
GIVEN platform storage is full (simulated)
WHEN a checkpoint auto-save fires
THEN the save write fails gracefully, the "Could not save — storage full" notification appears, the game continues, and no existing save file is deleted.

**AC8 — Clean exit save**
GIVEN the player quits from the Paused state
WHEN the application exits
THEN a save write completes before the process terminates (blocking write on clean exit).

**AC9 — Checkpoint cooldown**
GIVEN a save completed 10 seconds ago and `CheckpointCooldownSeconds` is 30.0
WHEN a new checkpoint trigger fires
THEN no save write occurs until the cooldown has elapsed.

**AC10 — Continue vs New Game on Title**
GIVEN a save file exists
WHEN the Title screen is displayed
THEN a "Continue" option is shown and `HasExistingSave()` returns true.

## Open Questions

1. **Zone boundary placement** — which world areas constitute named checkpoint zones? Needs Level Designer input. Placement directly determines how far apart auto-saves are and how much progress a player can lose.

2. **Key investigation events** — which Investigation System events should trigger a save? Needs Investigation System + Narrative input. Completing a major clue vs. every minor discovery are different scarcity levels.

3. **Cloud save** — does the game support platform cloud save (Steam Cloud, PlayStation Plus)? No decision made. If yes, `SaveGameToSlot()` must use platform-specific cloud APIs in addition to local storage. Needs platform decision before engine setup.

4. **`SaveCraftingState()` interface** — this interface is specified here but not yet defined in the Crafting System GDD. Must be added to Crafting System before implementation begins.

5. **New Game after existing save** — can the player intentionally start a new game (wiping the save)? Currently no path for this exists in the design. Needs UX decision: title screen "New Game" button that confirms and deletes save, or not supported at MVP?
