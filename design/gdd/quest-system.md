# Quest System

> **Status**: Designed
> **Author**: user + agents
> **Last Updated**: 4 May 2026
> **Implements Pillar**: Pillar 2 (Earned Discovery), Pillar 3 (Tense Survival)

## Summary

The Quest System manages all player objectives in Hostile World, from NPC-given Survivor Contracts to automatically spawned Conspiracy Thread Quests driven by investigation progress. It tracks quest states, evaluates completion conditions in real time, dispenses rewards, and triggers deferred consequences that ripple through the world long after a contract is closed. The system bridges dialogue choices, investigation milestones, and world-state changes into structured, purposeful gameplay.

> **Quick reference** — Layer: `Feature` · Priority: `Vertical Slice` · Key deps: `Dialogue System`

## Overview

Hostile World's Quest System is the backbone of player-directed narrative progression, bridging the gap between open-world exploration and structured conspiracy investigation. At its core, it is a lightweight, state-driven objective tracker that receives quest triggers from dialogue choices, investigation milestones, and world events, then evaluates completion conditions in real time as the player acts in the world. To the player, it feels organic: objectives emerge naturally from conversations with survivors ("Find my brother in the infected town"), from investigation revelations ("Track down the military lab mentioned in the documents"), and from the world's own transformation ("The hive is spreading — destroy it before it consumes the camp"). The system supports two quest tiers: **Conspiracy Threads** (main story, driven by Investigation System progress, passive and non-optional) and **Survivor Contracts** (NPC-given objectives with explicit goals, rewards, and consequences, active and optional). Without the Quest System, the player would wander a hostile world with no structured purpose; with it, every journey has stakes, every objective has a reason, and every choice ripples back into the narrative through completion rewards, relationship changes, and world-state updates.

## Player Fantasy

The Quest System makes the player feel **like the variable no one accounted for**. Every contract signed, every objective completed, every camp saved or dam blown — the world keeps processing the consequences long after the quest log marks it DONE. The player is not the hero of this apocalypse. They are the catalyst.

The signature moment: a resistance leader offers a contract — sabotage the dam, flood the hive, save the civilian camp. The player plans the route, places the charges, triggers the collapse. Objective complete. Two in-game days later, the player travels upstream and finds the flooded valley drowned a clean settlement the resistance "forgot" to mention. The quest log doesn't say FAILED. It spawns a new entry: "Aftermath." No one forced the player to take the contract. No one warned them about the cost. The narrative weight of completion sits in the player's gut because the world is still processing their choice.

For Conspiracy Threads, the fantasy shifts to **the hunter tracking truth through hostile territory**. A revelation fires — a black-site scientist who knows the origin of the immunity is hiding in an abandoned observatory. The game does not mark it. The player remembers passing it six hours ago on the ridge above the sulfur flats. They navigate back through territory now swarming with mutated patrols, stalk the perimeter, time their entry between cycles, and extract the target alive. No cutscene delivered the scientist. The player hunted the truth down.

This serves **Pillar 1 (Hostile World)** — quest completion physically transforms the world, sometimes in ways the player couldn't predict. **Pillar 2 (Earned Discovery)** — target locations and objectives are inferred from investigation clues, not handed to the player. **Pillar 3 (Tense Survival)** — every contract carries unpriced risk. Survival isn't just about making it out alive — it's about living with what you did to get out.

## Detailed Design

### Core Rules

**Rule 1 — Quest Types**

The Quest System manages two quest tiers with distinct rules:

| Tier | Source | Optional? | Trigger | Tracking |
|------|--------|-----------|---------|----------|
| **Conspiracy Thread Quest** (CTQ) | Investigation System | No — mandatory for main story | Thread reaches Confirmed or Revealed state | Passive — objectives advance as player discovers clues/completes actions |
| **Survivor Contract** (SC) | NPC dialogue | Yes — player chooses to accept | Dialogue choice tagged with `[QUEST:QuestId]` | Active — player sets active contract, follows explicit objectives |

**Rule 2 — Survivor Contract Lifecycle**

A Survivor Contract follows a 5-state lifecycle:

| Step | Action | System Involved |
|------|--------|----------------|
| 1 | Player initiates dialogue with NPC | Dialogue System |
| 2 | NPC presents contract offer (dialogue node tagged `[QUEST:QuestId]`) | Dialogue System |
| 3 | Player accepts or declines via radial choice | Dialogue System → Quest System |
| 4 | If accepted: contract enters **Active** state, objectives populate HUD | Quest System → HUD System |
| 5 | Player completes objectives in any order (unless sequenced) | Quest System evaluates conditions |
| 6 | All objectives complete: contract enters **Completed** state | Quest System |
| 7 | Player returns to quest-giver NPC (or designated turn-in) | Dialogue System |
| 8 | Turn-in dialogue plays, rewards dispensed, consequences applied | Quest System → Dialogue/Inventory/World |
| 9 | Contract enters **Closed** state (terminal) | Quest System |

**Rule 3 — Conspiracy Thread Quest Lifecycle**

Conspiracy Thread Quests are passive and non-optional:

| Step | Action | Trigger |
|------|--------|---------|
| 1 | Investigation thread reaches **Confirmed** state (50%+ clues) | Investigation System |
| 2 | Quest System spawns a **CTQ-Confirmed** objective (e.g., "Find the military lab") | Automatic |
| 3 | Player completes the objective through world action | Quest System evaluates |
| 4 | Investigation thread reaches **Revealed** state (100% clues) | Investigation System |
| 5 | Quest System spawns a **CTQ-Revealed** objective (e.g., "Confront Subject Zero") | Automatic |
| 6 | Player completes final objective | Quest System |
| 7 | Thread quest chain closes, narrative advancement fires | Quest System → GSM |

CTQs do not require player acceptance. They appear in the quest log automatically when triggered.

**Rule 4 — Objective Types**

| Objective Type | Evaluation Method | Example |
|----------------|-------------------|---------|
| **Reach Location** | Player enters trigger zone | "Reach the resistance camp" |
| **Interact with Object** | Player uses IA_Interact on target | "Access the military terminal" |
| **Collect Item** | Player acquires item into inventory | "Recover the vaccine samples" |
| **Kill/Defeat Entity** | Target entity health reaches 0 | "Destroy the hive node" |
| **Survive Condition** | Player maintains state for duration | "Survive the night in the infected zone" |
| **Dialogue Turn-In** | Player initiates dialogue with specific NPC | "Report back to Sarah" |
| **Investigation Milestone** | Thread reaches specified state | "Confirm the Immunity Cause thread" |
| **World State Change** | Global state variable meets condition | "Infection level in Zone 02 exceeds 75%" |

**Rule 5 — Objective Evaluation**

Objectives are evaluated in real time by the Quest Subsystem:

- **Continuous objectives** (Reach Location, Survive Condition, World State Change): polled every `T_eval` seconds (default 1.0s)
- **Event-driven objectives** (Interact, Collect, Kill, Dialogue Turn-In, Investigation Milestone): evaluated on event fire
- **Sequential objectives**: Objective N+1 unlocks only when Objective N is complete
- **Parallel objectives**: Multiple objectives active simultaneously; contract completes when all are done
- **Optional objectives**: Marked with `[Optional]` tag; not required for contract completion but may affect rewards

**Rule 6 — Contract Acceptance Gates**

A Survivor Contract may have gates that prevent acceptance:

| Gate Type | Condition | Source |
|-----------|-----------|--------|
| **Trust Gate** | NPC Trust ≥ required value | Dialogue System relationship state |
| **Fear Gate** | NPC Fear ≤ required value | Dialogue System relationship state |
| **Thread Gate** | Investigation thread at required state | Investigation System |
| **Zone Gate** | Player has discovered/entered required zone | Scene Management |
| **Prerequisite Quest** | Another contract is Completed or Closed | Quest System |
| **Faction Gate** | Player has required faction reputation | Faction Reputation System (Vertical Slice) |

If gates are not met, the contract offer dialogue choice is hidden or grayed out. Tooltip: "You don't meet the requirements for this contract."

**Rule 7 — Quest Rewards**

| Reward Type | Source | Delivery |
|-------------|--------|----------|
| **Items** | Data Table `DT_QuestRewards` | Added to player inventory on turn-in |
| **Relationship Delta** | Authored per contract | Applied to quest-giver NPC on turn-in (Trust ±N, Fear ±N, Knowledge ±N) |
| **Clue Unlock** | Authored per contract | Fires `OnClueDiscovered` to Investigation System on completion |
| **World State Change** | Authored per contract | Updates global world state (e.g., camp saved, zone infection reduced) |
| **Consequence Quest** | Authored per contract | Spawns a new contract or CTQ as consequence (see Rule 9) |
| **Experience/Progression** | Deferred to Progression System | Not implemented in Vertical Slice |

**Rule 8 — Quest Failure Conditions**

A contract or CTQ can fail:

| Failure Condition | Behavior | Recovery |
|-------------------|----------|----------|
| **NPC quest-giver dies** | Contract fails immediately. No rewards. Relationship state lost. | None — contract permanently failed |
| **Time limit expires** | Contract fails. NPC relationship penalty (-10 Trust). | May be re-offered after cooldown |
| **Player kills required ally/NPC** | Contract fails if target was required ally. | None |
| **World state makes objective impossible** | Contract auto-fails (e.g., target location destroyed by infection). | None — contract permanently failed |
| **Player abandons contract** | Player manually abandons via pause menu. No penalty. | Can be re-accepted if still available |

Failed contracts are marked **Failed** in the quest log. Failed CTQs are automatically re-triggered when conditions allow (they are non-optional).

**Rule 9 — Consequence System (The Catalyst)**

Quest completions and failures can trigger **consequences** — world-state changes that unfold after the quest closes:

| Consequence Type | Trigger | Delay | Example |
|------------------|---------|-------|---------|
| **Immediate** | On turn-in | 0s | NPC relationship delta applied |
| **Deferred** | On turn-in | 1–48 in-game hours | "Aftermath" contract spawns when player revisits affected area |
| **Chain Quest** | On turn-in | 0s | New contract or CTQ automatically added to log |
| **World Mutation** | On completion | 0–24 in-game hours | Infection spread rate changes, new patrols spawn, camp morale shifts |
| **NPC Fate** | On completion | Variable | NPC moves to new location, dies, or changes behavior |

Consequences are authored per quest in the Data Table. The Quest System stores pending consequences and evaluates them against game time.

**Rule 10 — Quest Data Structure**

Quests are stored in Data Tables (`DT_Quests`):

| Field | Type | Description |
|-------|------|-------------|
| `QuestId` | FName | Unique identifier |
| `QuestType` | EQuestType | ConspiracyThread, SurvivorContract |
| `QuestName` | FText | Display name |
| `QuestGiverNPCId` | FName | NPC who offers the contract (null for CTQs) |
| `Description` | FText | Brief description shown in quest log |
| `Objectives` | TArray<FQuestObjective> | Ordered list of objectives |
| `Rewards` | FQuestRewards | Items, relationship deltas, clues |
| `Consequences` | TArray<FQuestConsequence> | Post-completion effects |
| `Gates` | FQuestGates | Acceptance requirements |
| `TimeLimit` | float | Time limit in game seconds (-1 = no limit) |
| `IsRepeatable` | bool | Can be completed multiple times |
| `IsOptional` | bool | Optional objective flag |

**FQuestObjective** (nested struct):

| Field | Type | Description |
|-------|------|-------------|
| `ObjectiveId` | FName | Unique within quest |
| `ObjectiveType` | EObjectiveType | Reach, Interact, Collect, Kill, Survive, Dialogue, Investigation, WorldState |
| `TargetId` | FName | Target entity/object/zone/thread ID |
| `Description` | FText | Player-facing description |
| `IsOptional` | bool | Not required for completion |
| `IsSequential` | bool | Must be completed in order |
| `EvaluationMode` | EEvalMode | Continuous or EventDriven |

### States and Transitions

**Survivor Contract State Machine:**

| State | Entry Condition | Exit Condition | Behavior |
|-------|----------------|----------------|----------|
| **Unavailable** | Initial state (gates not met) | Gates become met | Hidden from player |
| **Available** | Gates met | Player accepts OR gates lost | Shown in NPC dialogue, quest log shows "Available" |
| **Active** | Player accepts | All objectives complete OR failure condition met | Objectives tracked in real time, HUD displays active objectives |
| **Completed** | All objectives done | Player turns in to NPC OR auto-closes (CTQ) | Awaiting turn-in or auto-close |
| **Closed** | Turn-in complete OR auto-close | N/A (terminal) | Rewards dispensed, consequences queued |
| **Failed** | Failure condition met | N/A (terminal) | No rewards, relationship penalty if applicable |
| **Abandoned** | Player manually abandons | Player re-accepts OR contract becomes unavailable | No penalty, can be re-accepted |

**Conspiracy Thread Quest State Machine:**

| State | Entry Condition | Exit Condition | Behavior |
|-------|----------------|----------------|----------|
| **Locked** | Thread not yet at required state | Thread reaches Confirmed | Hidden from player |
| **Active** | Thread reaches Confirmed or Revealed | All objectives complete | Objectives tracked, player-directed but non-optional |
| **Closed** | All objectives complete | N/A (terminal) | Narrative advancement fires |

### Interactions with Other Systems

| System | Direction | Data Flow | Interface |
|--------|-----------|-----------|-----------|
| **Dialogue System** | Reads + Writes | Quest triggers, turn-ins, acceptance gates | `OnQuestOffered(QuestId, NPCId)`, `OnQuestAccepted(QuestId)`, `OnQuestTurnedIn(QuestId)` — Dialogue System fires quest lifecycle events. Quest System gates dialogue options based on quest state. |
| **Investigation System** | Reads | Thread state for CTQ triggers and contract gates | `GetThreadState(ThreadId)`, `OnThreadConfirmed(ThreadId)`, `OnThreadRevealed(ThreadId)` — Quest System spawns CTQs when threads advance. |
| **HUD System** | Writes | Active objectives, quest log, completion notifications | `ShowQuestObjective(Objective)`, `UpdateQuestLog(Quests[])`, `ShowQuestComplete(QuestId)`, `ShowQuestFailed(QuestId)` |
| **Player Controller** | Reads | Context prompt routing for turn-in NPCs | `OnQuestTurnInAvailable(NPCId)` — Player Controller shows context prompt when near turn-in NPC |
| **Inventory System** | Reads + Writes | Item rewards, collection objectives | `AddItem(ItemId, Quantity)` — Quest System dispenses rewards. `HasItem(ItemId, Quantity)` — Quest System checks collection objectives. |
| **Scene Management** | Reads | Zone state for Reach Location objectives, zone gates | `GetCurrentZone()`, `IsZoneDiscovered(ZoneId)` — Quest System evaluates location-based objectives. |
| **Game State Machine** | Reads | Game state for quest evaluation pausing | `GetCurrentGameState()` — Quest evaluation pauses during loading, pause menu, death. |
| **Save/Load System** | Reads + Writes | Quest state persistence | `SaveQuestState()`, `RestoreQuestState()` — persists all quest data including active objectives, pending consequences, failed quests. |
| **Faction Reputation System** | Writes | Faction gates, faction reputation rewards | `GetFactionReputation(FactionId)` — Quest System checks faction gates (Vertical Slice). `ModifyFactionReputation(FactionId, Delta)` — applies faction rewards. |

## Formulas

**Formula 1 — Quest Completion Percentage**

The `quest_completion` formula calculates how far a quest has progressed:

```
P_quest = N_complete / N_required
```

**Variables:**

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| Completed objectives | N_complete | int32 | 0–N_required | Number of non-optional objectives marked complete |
| Required objectives | N_required | int32 | 1–10 | Total non-optional objectives in the quest |

**Output Range:** 0.0 to 1.0
**Example:** Quest has 4 objectives, 2 complete. P_quest = 2/4 = **0.5**.

---

**Formula 2 — Time Remaining**

The `time_remaining` formula calculates how much time a player has left on a timed contract:

```
T_remain = max(0, T_limit - (T_now - T_start))
```

**Variables:**

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| Time limit | T_limit | float | 60–86400 | Contract time limit in game seconds (-1 = no limit) |
| Current game time | T_now | float | 0+ | Current in-game time (seconds since game start) |
| Acceptance time | T_start | float | 0+ | Game time when contract was accepted |

**Output Range:** 0 to T_limit seconds
**Behavior at extremes:** When T_remain reaches 0, contract auto-fails.
**Example:** Contract accepted at T=3600s, limit=7200s, current T=9000s. T_remain = max(0, 7200 - (9000 - 3600)) = max(0, 1800) = **1800s**.

---

**Formula 3 — Consequence Trigger Evaluation**

The `consequence_ready` formula determines whether a deferred consequence should fire:

```
consequence_ready = (T_now ≥ T_complete + T_delay) AND (bConditionsMet = true)
```

**Variables:**

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| Current game time | T_now | float | 0+ | Current in-game time |
| Completion time | T_complete | float | 0+ | Game time when quest was completed |
| Delay duration | T_delay | float | 0–172800 | Deferred consequence delay in game seconds (0–48 hours) |
| Conditions met | bConditionsMet | bool | true/false | Additional conditions (e.g., player in specific zone) |

**Output:** true (fire consequence) or false (defer)
**Example:** Quest completed at T=10000s, delay=3600s (1 hour), conditions require player to be in Zone 02. At T=14000s, player enters Zone 02. consequence_ready = (14000 ≥ 13600) AND true = **true**.

---

**Formula 4 — Objective Evaluation Interval**

The `eval_interval` formula determines how often continuous objectives are polled:

```
T_eval = 1.0 / R_poll
```

**Variables:**

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| Poll rate | R_poll | float | 1–10 | Evaluations per second |

**Output Range:** 0.1 to 1.0 seconds
**Default:** R_poll = 1.0 → T_eval = **1.0s**
**Note:** Higher poll rates (lower intervals) improve responsiveness but increase CPU load. Event-driven objectives bypass polling entirely.

## Edge Cases

| Scenario | Expected Behavior | Rationale |
|----------|------------------|-----------|
| **Player accepts contract, then quest-giver NPC dies** | Contract immediately fails. No rewards. Relationship state is lost. Contract marked **Failed** in quest log. | Consequence of the hostile world. NPCs are mortal. |
| **Player completes a location objective before accepting the quest** | Objective auto-completes upon quest acceptance if the player is already in the target zone OR has already visited it (configurable per quest). Default: does NOT retroactively complete — player must re-enter the zone. | Retroactive completion feels like the system is reading the player's mind. Re-entry is a small cost that maintains intentionality. |
| **Time limit expires while game is paused** | Game time pauses with the pause menu. Timer does not decrement while paused. | Player should not be penalized for pausing. |
| **Player saves/loads mid-quest with pending consequences** | All quest state, active objectives, and pending consequences are saved. On load, consequence evaluation resumes from saved state. | Player should not lose quest progress or miss deferred consequences due to saving. |
| **Two active contracts have conflicting objectives** (e.g., Contract A: "Protect Marcus"; Contract B: "Kill Marcus") | Both contracts remain active. The player's action resolves the conflict naturally. If Marcus dies, Contract A fails, Contract B's kill objective completes. No special conflict resolution — let the world decide. | The world does not protect the player from their own choices. Conflicting contracts are a feature, not a bug. |
| **Quest consequence triggers while player is in dialogue** | Deferred consequence is deferred further. Fires when player exits dialogue AND meets all other conditions. | Dialogue takes priority. Consequences should not interrupt conversations. |
| **Quest consequence triggers while player is in combat** | Deferred consequence is deferred further. Fires when combat ends AND conditions are met. | Combat takes priority. Same rationale as revelation deferral in Investigation System. |
| **Player abandons a contract after completing some objectives** | Contract moves to **Abandoned** state. No relationship penalty. Completed objectives are reset. Player can re-accept if contract is still available. | Abandonment is a valid player choice. Resetting progress prevents partial-completion exploitation. |
| **CTQ spawns while player is in combat** | CTQ enters **Active** state internally but does not notify the player until combat ends. HUD update deferred. | Non-optional quests should not distract from survival. |
| **Quest reward item would exceed inventory capacity** | Item is dropped at the player's feet with a notification: "[ItemName] dropped — inventory full." Relationship rewards and clue unlocks still apply. | Inventory limits are real. The player must manage space or lose physical rewards. |
| **Deferred consequence delay spans a save/load** | Consequence stores T_complete and T_delay in save data. On load, evaluation checks T_now against T_complete + T_delay. If overdue, fires immediately (if conditions met). | Consequences should not be lost or delayed incorrectly due to save/load. |
| **Player turns in a contract to an NPC who has moved to a new location** | Turn-in location is updated to NPC's current location. If NPC's new location is undiscovered, quest log notes: "Sarah has moved. Find her new location." | NPCs are not static quest dispensers. The world moves. |
| **World state makes an active objective impossible** (e.g., target zone fully infected, target object destroyed) | Contract auto-fails if the objective is required. If the objective is optional, it is marked **Skipped** and the contract continues. | Prevents soft-locks from world transformation. Optional objectives provide slack. |
| **Player has 5+ active contracts simultaneously** | No hard cap on active contracts. HUD displays up to 3 active objectives per contract in the tracker. Player can scroll or open full quest log for more. | Player freedom. The UI handles overflow gracefully. |

## Dependencies

**Hard Dependencies** (system cannot function without):
- **Dialogue System** ✅ (designed) — quest triggers, turn-ins, acceptance gates, relationship state for gating. Quest System consumes `OnQuestOffered`, `OnQuestAccepted`, `OnQuestTurnedIn` events.
- **Investigation System** ✅ (designed) — thread state for CTQ triggers and contract gates. Quest System reads `GetThreadState`, `OnThreadConfirmed`, `OnThreadRevealed`.
- **Game State Machine** ✅ (designed) — quest evaluation pauses during non-Playing states (loading, pause, death).

**Soft Dependencies** (enhanced by but works without):
- **HUD System** (In Design) — renders active objectives, quest log, completion/failure notifications. Without it, quests have no UI feedback.
- **Player Controller** ✅ (designed) — routes context prompts for turn-in NPCs. Without it, player cannot initiate turn-in dialogue.
- **Inventory System** ✅ (designed) — item rewards and collection objectives. Without it, no item rewards or collect objectives.
- **Scene Management** ✅ (designed) — zone state for location objectives and zone gates. Without it, Reach Location objectives cannot be evaluated.
- **Save/Load System** (Not Started) — persists quest state, active objectives, pending consequences. Without it, quest progress resets on load.
- **Faction Reputation System** (Not Started) — faction gates and faction rewards. Without it, faction-gated contracts are unavailable.
- **Combat System** ✅ (designed) — quest evaluation pauses during combat (deferred consequences, CTQ notifications).
- **Stealth System** ✅ (designed) — detection level may gate quest objectives in dangerous zones.

**Depended On By:**

| System | Interface Used | Expected Behavior |
|--------|---------------|-------------------|
| Faction Reputation System | Quest completion affects faction reputation | Reputation changes based on which contracts player completes and how |
| Lore/Journal System | Quest history, completed contracts, revelations | Journal populates with quest completion records and consequence summaries |
| HUD System | Active objectives, quest log, notifications | Renders quest UI elements |
| Save/Load System | Quest state data | Persists and restores all quest data |

## Tuning Knobs

| Parameter | Default | Safe Range | Effect of Increase | Effect of Decrease |
|-----------|---------|------------|-------------------|-------------------|
| `ObjectivePollRate` | 1.0 | 0.5–5.0 | More responsive objective evaluation, higher CPU load | Less responsive, lower CPU load |
| `ContractTimeLimitDefault` | -1 (none) | 300–86400 | Longer time pressure on contracts | Shorter deadlines, more tension |
| `ContractTrustRewardDefault` | +10 | 5–25 | NPCs trust player more per completed contract | Slower relationship building |
| `ContractTrustPenaltyFail` | -10 | -5 to -25 | Harsher failure penalty | More forgiving failures |
| `ConsequenceDelayMin` | 3600 | 0–7200 | Longer minimum delay before deferred consequences | Consequences fire sooner |
| `ConsequenceDelayMax` | 172800 | 3600–345600 | Longer maximum delay, more surprise | Shorter delay, more predictable |
| `MaxActiveContractsHUD` | 3 | 2–5 | More objectives visible in tracker | Cleaner HUD, less clutter |
| `QuestLogHistorySize` | 50 | 20–200 | More completed/failed quests stored | Less history, smaller save files |
| `NPCMoveAfterQuestProbability` | 0.3 | 0.0–1.0 | More NPCs relocate after quest completion | NPCs stay put, more predictable |
| `RetroactiveObjectiveCompletion` | false | true/false | Allows objectives to complete retroactively | Forces re-completion |
| `AbandonmentPenaltyEnabled` | false | true/false | Abandoning costs Trust | No penalty for abandonment |

## Visual/Audio Requirements

### Quest Presentation Visuals

| Element | Description | Style | Notes |
|---------|-------------|-------|-------|
| **Quest acceptance** | NPC gesture + audio cue when contract is offered | Diegetic — NPC physically gestures, holds out item, or points | No glowing exclamation marks. The NPC's body language communicates the offer. |
| **Objective marker** (Tactical mode) | Minimal compass tick + distance | Subtle white chevron, 8px, no text | Only in Tactical mode. Immersive mode has no markers. |
| **Objective marker** (Immersive mode) | None — player navigates by memory and environmental cues | N/A | The world itself is the marker. Landmarks, smoke, sounds guide the player. |
| **Quest log entry** | Handwritten journal entry (Immersive) or clean list (Tactical) | Immersive: distressed paper texture, handwriting font. Tactical: monospace list, categorized | Matches HUD System's dual-mode design |
| **Completion notification** | Subtle screen flash + chime | White flash, 3% opacity, 0.3s fade | Notifies without breaking immersion |
| **Failure notification** | Red-tinged flash + low tone | Red flash, 5% opacity, 0.5s fade | More pronounced than completion — failure has weight |

### Consequence Discovery Visuals

| Element | Description | Trigger |
|---------|-------------|---------|
| **Environmental change** | Physical world alteration (flooded valley, destroyed bridge, new patrol routes) | Deferred consequence fires |
| **NPC reaction** | Changed NPC behavior, new dialogue, moved location | Consequence affects NPC |
| **Atmospheric shift** | Lighting change, weather shift, ambient sound change | Major world-state consequence |

### Quest Audio

| Sound | Trigger | Description | Volume | Priority |
|-------|---------|-------------|--------|----------|
| **Quest accepted** | Player accepts contract | Soft paper/rustle sound + NPC vocal acknowledgment | -18dB | Low |
| **Objective complete** | Single objective finishes | Subtle chime (single note, ascending) | -20dB | Low |
| **Quest complete** | All objectives done | Deeper chime (resolving chord) | -16dB | Medium |
| **Quest failed** | Failure condition met | Dissonant tone, descending | -14dB | Medium |
| **Consequence discovered** | Player encounters consequence outcome | Environmental audio shift (e.g., distant screaming, changed wind) | Ambient mix | Medium |
| **Turn-in available** | Player near quest-giver with completed contract | NPC calls out to player (voice line) | -12dB (dialogue mix) | High |

## UI Requirements

| Element | Mode | Position | Update Frequency | Condition |
|---------|------|----------|-----------------|-----------|
| **Active objective tracker** | Tactical only | Top-right corner, stacked vertically | On objective state change | Active contracts only |
| **Quest log** | Both modes | Pause menu, Quests tab | On quest state change | Always accessible in pause menu |
| **Contract availability indicator** | Both modes | Near NPC name label (subtle dot: green = available, gray = unavailable, gold = turn-in ready) | On quest state change | When player is within 200cm of NPC |
| **Completion notification** | Both modes | Bottom-center, 2.0s fade | On quest completion | Brief, non-blocking |
| **Failure notification** | Both modes | Bottom-center, 3.0s fade | On quest failure | Brief, non-blocking |
| **Consequence alert** | Both modes | Center screen, journal-style entry | On consequence discovery | Player-dismissible, persists until read |
| **Time remaining** (timed contracts) | Tactical only | Next to objective in tracker | Every 1.0s | Active timed contracts only |
| **Quest turn-in prompt** | Both modes | Context prompt: "Talk to [NPC] — Quest Ready" | When near turn-in NPC | Completed contracts only |

## Cross-References

| This Document References | Target GDD | Specific Element Referenced | Nature |
|--------------------------|-----------|----------------------------|--------|
| Quest triggers via dialogue nodes | `design/gdd/dialogue-system.md` | `[QUEST:QuestId]` tag, DialogueNodeId, OnQuestOffered/Accepted/TurnedIn | Data dependency |
| Relationship gates for contract acceptance | `design/gdd/dialogue-system.md` | Trust/Fear/Knowledge ranges, relationship state, FRelationshipState | Data dependency |
| NPC death aborts dialogue and fails quest | `design/gdd/dialogue-system.md` | Rule 7 — NPC killed while dialogue active | State trigger |
| Thread state triggers CTQs | `design/gdd/investigation-system.md` | Thread states (Confirmed, Revealed), OnThreadConfirmed/Revealed | State trigger |
| Investigation milestone objectives | `design/gdd/investigation-system.md` | Thread progress, clue discovery | Data dependency |
| Objective evaluation pauses during loading | `design/gdd/game-state-machine.md` | Game states, loading transitions | State trigger |
| Context prompt for turn-in NPCs | `design/gdd/player-controller.md` | IA_Interact routing, proximity detection (200cm) | Data dependency |
| Item rewards and collection objectives | `design/gdd/inventory-system.md` | AddItem, HasItem, inventory capacity | Data dependency |
| Location objectives use zone state | `design/gdd/scene-management.md` | GetCurrentZone, IsZoneDiscovered | Data dependency |
| Active objectives render in HUD | `design/gdd/hud-system.md` | ShowQuestObjective, UpdateQuestLog, completion/failure notifications | Data dependency |
| Quest evaluation pauses during combat | `design/gdd/combat-system.md` | bIsInCombat, combat state transitions | State trigger |
| Deferred consequence combat gate | `design/gdd/combat-system.md` | Combat state for consequence deferral | Rule dependency |

## Acceptance Criteria

**Core Rules:**

- **GIVEN** player is in dialogue with NPC Sarah and Sarah has a contract tagged `[QUEST:quest_rescue_brother]`, **WHEN** player selects the acceptance choice, **THEN** contract enters Active state, objectives appear in HUD, quest log updates.

- **GIVEN** contract has 3 objectives (Reach camp, Collect samples, Talk to Sarah) and player enters the camp trigger zone, **WHEN** Reach Location objective evaluates, **THEN** objective marks complete, HUD updates, completion chime plays.

- **GIVEN** all 3 objectives are complete, **WHEN** player approaches Sarah and presses IA_Interact, **THEN** turn-in dialogue plays, rewards dispensed, contract enters Closed state, consequences queued.

- **GIVEN** contract has a time limit of 3600s and player accepted it at T=1000s, **WHEN** current game time reaches T=4601s, **THEN** contract auto-fails, failure notification plays, Trust -10 applied to quest-giver.

- **GIVEN** quest-giver NPC dies while contract is Active, **WHEN** death event fires, **THEN** contract immediately fails, no rewards, contract marked Failed in quest log.

- **GIVEN** Investigation thread T_immunity reaches Confirmed (50%+ clues), **WHEN** thread state updates, **THEN** CTQ spawns with objective "Find the military lab," quest log updates.

- **GIVEN** player has Trust = 25 with NPC and contract requires Trust ≥ 40, **WHEN** player enters dialogue, **THEN** contract offer choice is hidden. Tooltip: "You don't meet the requirements for this contract."

- **GIVEN** two active contracts (A: "Protect Marcus", B: "Kill Marcus"), **WHEN** Marcus dies, **THEN** Contract A fails, Contract B's kill objective completes.

- **GIVEN** contract has a deferred consequence with T_delay = 3600s, completed at T=10000s, **WHEN** game time reaches T=14000s and player is in required zone, **THEN** consequence fires, "Aftermath" contract spawns.

- **GIVEN** player saves game with 2/3 objectives complete and 1 pending consequence, **WHEN** game loads, **THEN** quest state restores exactly, pending consequence resumes evaluation.

- **GIVEN** player is in combat and a deferred consequence is ready to fire, **WHEN** combat state is active, **THEN** consequence is deferred until combat ends.

- **GIVEN** player is in dialogue and a deferred consequence is ready to fire, **WHEN** dialogue state is active, **THEN** consequence is deferred until dialogue ends.

**Formulas:**

- **GIVEN** Formula 1 (quest completion), **WHEN** quest has 4 objectives and 2 are complete, **THEN** P_quest = 2/4 = **0.5**.

- **GIVEN** Formula 2 (time remaining), **WHEN** T_limit = 7200s, T_start = 3600s, T_now = 9000s, **THEN** T_remain = max(0, 7200 - (9000 - 3600)) = **1800s**.

- **GIVEN** Formula 3 (consequence ready), **WHEN** T_complete = 10000s, T_delay = 3600s, T_now = 14000s, bConditionsMet = true, **THEN** consequence_ready = (14000 ≥ 13600) AND true = **true**.

- **GIVEN** Formula 4 (eval interval), **WHEN** R_poll = 2.0, **THEN** T_eval = 1.0/2.0 = **0.5s**.

**Edge Cases:**

- **GIVEN** player completes a location objective before accepting the quest and RetroactiveObjectiveCompletion = false, **WHEN** quest is accepted, **THEN** objective does NOT auto-complete. Player must re-enter the zone.

- **GIVEN** contract has an optional objective that becomes impossible (target destroyed), **WHEN** objective evaluates, **THEN** objective is marked Skipped, contract continues toward completion.

- **GIVEN** quest reward item would exceed inventory MaxWeight, **WHEN** turn-in completes, **THEN** item drops at player's feet with notification "ItemName dropped — inventory full."

- **GIVEN** player has 5 active contracts, **WHEN** HUD renders objective tracker, **THEN** up to 3 objectives visible per contract. Player scrolls for more.

## Open Questions

| # | Question | Owner | Deadline | Resolution |
|---|----------|-------|----------|-----------|
| OQ-1 | Should contracts have a hard cap on active count (e.g., max 10 active)? Or unlimited? | game-designer | Vertical Slice | Unlimited for now; cap if save-file bloat or HUD overflow becomes an issue |
| OQ-2 | Should failed contracts ever be retryable? If so, under what conditions (cooldown, relationship repair, world-state reset)? | game-designer | Playtest | Currently: some may be re-offered after cooldown; permanent failures for NPC death |
| OQ-3 | How should the quest log handle contracts from NPCs the player has killed? Should they be hidden, marked "Unavailable," or shown as "Failed"? | game-designer | GDD review | |
| OQ-4 | Should CTQs have optional branching paths (e.g., confront Subject Zero vs. sneak past), or are they strictly linear? | narrative-director | Vertical Slice | |
| OQ-5 | Should consequence quests ever expire? If the player ignores an "Aftermath" contract for 10 in-game days, does it vanish or escalate? | game-designer | Playtest | |
| OQ-6 | Should the player be able to decline a CTQ (e.g., ignore the main story objective)? If so, what are the narrative/gameplay implications? | narrative-director | Architecture phase | CTQs are non-optional by design, but player agency matters |
| OQ-7 | How should quest items be visually distinct from regular loot? Should they have a subtle glow, different icon, or no distinction at all? | art-director | Art bible | |
| OQ-8 | Should the pause-menu quest log show the full text of all discovered clues related to a CTQ, or only the thread synthesis? | game-designer | UX design | |
