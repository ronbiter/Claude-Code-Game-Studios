# Dialogue System

> **Status**: Draft
> **Author**: user + agents
> **Last Updated**: 30 April 2026
> **Last Verified**: 30 April 2026
> **Implements Pillar**: Pillar 2 (Earned Discovery), Pillar 3 (Tense Survival)

## Summary

The Dialogue System governs all NPC conversations in Hostile World — survivor interactions, faction negotiations, testimony gathering, and quest-related dialogue. Conversations use a fully branching tree structure with player choices that affect NPC relationships, faction reputation, investigation clue discovery, and story progression. Dialogue choices are presented via an in-world radial wheel, keeping the player grounded in the scene. Each NPC has a relationship state that evolves across conversations — they remember what the player said, what the player did, and what the player knows. The system is lightweight and diegetic: dialogue happens in-world, with the camera framing the NPC, the player's character visible, and the world continuing around them. This is the primary social interface of the game — where the player builds alliances, gathers intelligence, and earns the conspiracy's revelations.

> **Quick reference** — Layer: `Core` · Priority: `MVP` · Key deps: `Player Controller, Investigation System, Game State Machine`

## Overview

Hostile World's dialogue is not a menu — it is a conversation. The player stands face-to-face with a survivor, the camera frames both characters, and choices appear as a radial wheel near the NPC. The world does not pause: aliens patrol in the distance, spore particles drift through the air, the wind carries ambient sound. The player is present in the scene, not extracted from it.

Each NPC has a relationship state tracked across three dimensions:

| Dimension | Range | Description |
|-----------|-------|-------------|
| **Trust** | 0–100 | How much the NPC trusts the player. Increases when the player helps them, keeps promises, shares information. Decreases when the player lies, steals from them, or abandons them. |
| **Fear** | 0–100 | How afraid the NPC is of the player. Increases when the player is aggressive, threatens them, or demonstrates lethal capability. Decreases when the player is gentle, protective, or vulnerable. |
| **Knowledge** | 0–100 | How much the NPC knows about the player's investigation. Increases when the player shares clues, reveals thread progress, or asks informed questions. Starts at 0 for all NPCs. |

These dimensions gate dialogue options. An NPC with low Trust will not share sensitive information. An NPC with high Fear may comply but withhold truth. An NPC with high Knowledge can provide deeper insights and unlock advanced dialogue branches.

The system operates on two levels:

- **Conversation** (moment-to-moment): A single dialogue exchange — greeting, topic selection, branching choices, farewell. Lasts 30s–3 minutes.
- **Relationship** (session-level): The cumulative state of the player's relationship with each NPC. Evolves across multiple conversations. Determines what information, resources, and alliances are available.

## Player Fantasy

The Dialogue System makes the player feel **like they are talking to a person, not a quest dispenser**. Every NPC has their own voice, their own fears, their own agenda. They don't just hand out clues — they weigh whether the player is worth trusting. They remember past conversations. They react to what the player has done in the world.

The signature moment: the player returns to a survivor they helped earlier. The survivor recognizes them — "You're back. I thought you'd be dead by now." The dialogue options reflect the player's past actions: if they saved the survivor's friend, a new branch opens. If they stole from the camp, the survivor is cold and guarded. If they shared a clue about the infection, the survivor offers a piece of the puzzle in return. The conversation feels alive because the NPC is alive — not scripted, but reactive.

This serves **Pillar 2 (Earned Discovery)** — testimony clues are earned through conversation, not handed freely. The player must build trust, ask the right questions, and choose their words carefully. **Pillar 3 (Tense Survival)** — dialogue happens in the world, not in a safe bubble. The player is vulnerable while talking. Aliens patrol nearby. The conversation could be interrupted. Every moment spent talking is a moment not spent surviving.

## Detailed Design

### Core Rules

**Rule 1 — Dialogue Initiation**

Dialogue begins when the player approaches an NPC and activates the context prompt:

| Step | Action |
|------|--------|
| 1 | Player approaches NPC within 200cm (proximity detection per Player Controller) |
| 2 | Context prompt appears: "Talk to [NPC Name]" |
| 3 | Player presses IA_Interact |
| 4 | Player Controller sends `OnDialogueStarted(NPCId)` to Dialogue System |
| 5 | GSM transitions to Dialogue state (0.3s UI slide, world slows to 0.85x) |
| 6. Camera transitions to conversation framing (over-the-shoulder, both characters visible) |
| 7 | IMC_Dialogue pushed to input stack (movement locked, dialogue choices enabled) |
| 8 | NPC greeting plays (audio + subtitles) |
| 9 | Radial choice wheel appears with available dialogue options |

**Rule 2 — Radial Choice Wheel**

Dialogue choices are presented as an in-world radial wheel:

| Property | Value |
|----------|-------|
| Position | Near NPC's head, offset 50cm to the right (screen-space anchored) |
| Shape | Semi-circle (180° arc), 5–8 choice slots |
| Choice display | Short phrase (3–6 words), not full sentences |
| Selection | Mouse click or stick press on choice segment |
| Hover preview | Full choice text appears below wheel (1–2 sentences) |
| Fade in | 0.2s slide-up |
| Fade out | 0.15s slide-down |
| Max visible choices | 5 at a time (scrollable if more available) |
| Scroll behavior | Stick rotation (gamepad) or mouse wheel (keyboard/mouse) scrolls wheel by 1 choice per input. Wheel does NOT wrap around — stops at first and last choice. Scroll animation: 0.1s slide. |
| Keyboard navigation | Number keys 1–5 select visible choices. Arrow keys scroll. Enter confirms selection. |
| Choice categories | Color-coded: Blue (ask/info), Green (help/ally), Yellow (trade/negotiate), Red (threaten/intimidate), Gray (leave/end) |

**Rule 3 — Dialogue Tree Structure**

Each conversation is a directed graph of dialogue nodes:

| Node Type | Description | Example |
|-----------|-------------|---------|
| **Greeting** | Entry point. Plays when dialogue starts. May vary based on relationship state. | "You again. What do you want?" (low Trust) vs. "Good to see you." (high Trust) |
| **Topic** | Branch point. Player chooses which topic to discuss. | "Ask about the outbreak", "Ask about the military", "Ask about Subject Zero" |
| **Response** | NPC delivers information. May include clue discovery, reputation change, or quest trigger. | NPC describes what they saw during the outbreak. `[CLUE:clue_testimony_outbreak_01]` fires. |
| **Choice** | Player makes a decision that affects relationship or story. | "Promise to help them" (Trust +10) vs. "Tell them to handle it themselves" (Trust -5, Fear +5) |
| **Farewell** | Exit point. Plays when dialogue ends. May vary based on how conversation went. | "Be careful out there." vs. "Don't come back." |

**Rule 3b — Dialogue Tree Data Structure**

Dialogue trees are stored in Data Tables (`DT_Dialogue_[NPCId]`). Each row represents a dialogue node:

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `NodeId` | FName | Unique node identifier | `"node_sarah_greeting_01"` |
| `NodeType` | EDialogueNodeType | Greeting, Topic, Response, Choice, Farewell | Topic |
| `ParentNode` | FName | Which node leads to this one (empty for greetings) | `"node_sarah_greeting_01"` |
| `Speaker` | FNPCId | Which NPC speaks this line | `"npc_sarah"` |
| `DialogueText` | FText | What the NPC says (or choice text for Choice nodes) | `"What do you want to know?"` |
| `Choices` | TArray<FDialogueChoice> | Available choices from this node (for Topic/Choice nodes) | See below |
| `NextNode` | FName | Which node follows this one (for Response/Farewell nodes) | `"node_sarah_outbreak_response"` |
| `ClueTag` | FClueId | Clue discovered when this node is reached (optional) | `"clue_testimony_outbreak_01"` |
| `TrustDelta` | int32 | Trust change when this node is reached | +10 |
| `FearDelta` | int32 | Fear change when this node is reached | 0 |
| `KnowledgeDelta` | int32 | Knowledge change when this node is reached | +5 |
| `Gates` | FDialogueGates | Trust/Fear/Knowledge/Investigation requirements | Trust≥40, Thread=T_origin Confirmed |
| `AudioLineId` | FName | Voice line identifier (if voiced) | `"sarah_outbreak_01"` |

**FDialogueChoice** (nested struct within Choices array):

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `ChoiceId` | FName | Unique choice identifier | `"choice_ask_outbreak"` |
| `ChoiceText` | FText | Short phrase shown on radial wheel | "Ask about the outbreak" |
| `HoverText` | FText | Full text shown on hover | "What did you see when the outbreak started?" |
| `Category` | EDialogueChoiceCategory | Ask, Help, Trade, Threaten, Leave | Ask (Blue) |
| `TargetNode` | FName | Which node this choice leads to | `"node_sarah_outbreak_response"` |
| `TrustDelta` | int32 | Trust change when this choice is selected | +5 |
| `FearDelta` | int32 | Fear change when this choice is selected | 0 |
| `KnowledgeDelta` | int32 | Knowledge change when this choice is selected | 0 |
| `Gates` | FDialogueGates | Requirements to show this choice | Trust≥30 |

**Rule 4 — Relationship State**

Each NPC maintains a relationship record:

| Field | Type | Default | Range | Description |
|-------|------|---------|-------|-------------|
| `NPCId` | FName | — | — | Unique NPC identifier |
| `Trust` | int32 | 30 | 0–100 | How much the NPC trusts the player |
| `Fear` | int32 | 10 | 0–100 | How afraid the NPC is of the player |
| `Knowledge` | int32 | 0 | 0–100 | How much the NPC knows about the player's investigation |
| `ConversationsHad` | int32 | 0 | — | Number of completed conversations |
| `LastConversationTime` | float | -1 | — | Game time of last conversation |
| `Flags` | TMap<FName, bool> | Empty | — | Custom flags set by dialogue choices (e.g., "PromisedToHelp", "KnowsAboutSubjectZero") |
| `LockedTopics` | TArray<FName> | Empty | — | Topics that are locked (unavailable) due to relationship state |
| `UnlockedTopics` | TArray<FName> | Varies | — | Topics that are unlocked (available) due to relationship state |

**Relationship State Effects on Dialogue:**

| Trust Range | Effect |
|-------------|--------|
| 0–20 (Hostile) | NPC refuses to talk. Only greeting: "Go away." Dialogue ends immediately. |
| 21–40 (Wary) | NPC talks but shares minimal information. Only surface-level topics available. |
| 41–60 (Neutral) | NPC shares basic information. Most topics available. No sensitive topics. |
| 61–80 (Trusting) | NPC shares sensitive information. All topics available. Offers resources. |
| 81–100 (Allied) | NPC shares everything. Offers unique clues, resources, and alliance actions. |

| Fear Range | Effect |
|------------|--------|
| 0–20 (Comfortable) | NPC speaks naturally, offers information freely. |
| 21–50 (Uneasy) | NPC is guarded, some topics require higher Trust to unlock. |
| 51–80 (Afraid) | NPC complies but withholds truth. Some dialogue options become unavailable (NPC won't engage). |
| 81–100 (Terrified) | NPC may flee or refuse to talk. Only brief interactions possible. |

| Knowledge Range | Effect |
|-----------------|--------|
| 0–20 (Ignorant) | NPC knows nothing about the player's investigation. Cannot discuss conspiracy threads. |
| 21–50 (Aware) | NPC knows the player is investigating. Can discuss surface-level conspiracy topics. |
| 51–80 (Informed) | NPC understands the investigation. Can share related clues and insights. |
| 81–100 (Partner) | NPC is an active investigation partner. Offers unique testimony clues and thread connections. |

**Rule 5 — Clue Discovery Through Dialogue**

Dialogue options can be tagged with `[CLUE:ClueId]`. When the player selects a tagged option:

1. NPC delivers testimony (audio + subtitles)
2. `OnClueDiscovered(ClueId)` fires to Investigation System
3. Investigation System updates thread progress
4. If the clue unlocks a new dialogue topic for this NPC, the topic is added to `UnlockedTopics`
5. Relationship `Knowledge` increases by +10 (testimony sharing builds mutual understanding)

**Rule 6 — Dialogue Gating by Investigation State**

The Investigation System can gate dialogue options based on thread state:

| Gate Type | Condition | Effect |
|-----------|-----------|--------|
| **Thread Gate** | Player has not discovered enough clues in a thread | Dialogue option is hidden or grayed out. Tooltip: "You don't know enough about this yet." |
| **Thread Unlock** | Player has reached "Confirmed" state in a thread | New dialogue topic unlocks for NPCs with Knowledge ≥ 50. |
| **Thread Revelation** | Player has reached "Revealed" state in a thread | NPC reacts to the revelation. New farewell dialogue. Knowledge +15. |

**Rule 7 — Dialogue Termination**

Dialogue ends when:

| Trigger | Behavior |
|---------|----------|
| **Player selects "Leave" option** | Farewell plays, 0.3s UI slide, GSM returns to Playing, camera returns to ThirdPerson, IMC_Dialogue popped. |
| **Player walks away (exits 200cm radius)** | Dialogue pauses. If player returns within 10s, dialogue resumes. If not, dialogue ends with default farewell. |
| **Alien reaches melee range (150cm)** | **Safety override**: Dialogue is interrupted. "We need to move!" plays. GSM transitions to Playing. IMC_Dialogue popped. Combat begins. MeleeInterruptRange = 150cm (configurable, see Tuning Knobs). |
| **NPC is killed** | Dialogue ends immediately. No farewell. Relationship state is lost. Any pending clues from this NPC are marked as "Lost." |

**Rule 8 — Conversation Memory**

NPCs remember past conversations:

| Memory Type | Trigger | Effect |
|-------------|---------|--------|
| **Greeting variation** | ConversationsHad > 0 | Greeting changes from first-meeting to returning-player variant. |
| **Promise follow-up** | Player promised to help (flag set) | NPC asks about promise on next conversation. If player fulfilled it: Trust +15. If not: Trust -20, Fear +10. |
| **Shared clue acknowledgment** | Player shared a clue (Knowledge increased) | NPC references the shared clue in future conversations. "That thing you told me about the military... I've been thinking about it." |
| **World event reaction** | Player completed a significant action (zone cleared, hive destroyed, camp saved) | NPC acknowledges the event. New dialogue options unlock. |

**Rule 9 — NPC Type Classification**

Not all entities in the world use the full relationship model. NPCs are classified into types:

| Type | Relationship Tracking | Dialogue Tree | Example |
|------|----------------------|---------------|---------|
| **Survivor** | Full (Trust/Fear/Knowledge) | Full branching tree | Sarah at resistance camp, Marcus in infected town |
| **Faction Leader** | Full + Faction reputation | Full branching + faction-specific nodes | Deferred to Vertical Slice |
| **Ambient NPC** | Minimal (Trust only, no Fear/Knowledge) | Linear with 1-2 choices | Roaming scavenger, wounded soldier |
| **Terminal/Automated** | None | Linear, no choices | Military research terminal, alien artifact |
| **Hostile NPC** | None | None (combat-only) | Alien creatures, hostile military |

Only **Survivor** and **Faction Leader** types use the full 3D relationship model. Ambient NPCs use a simplified Trust-only model. Terminals and hostile NPCs have no relationship tracking. The NPC type is defined in the NPC's Data Table entry (`ENPCType`).

**Rule 10 — Fear Recovery Path**

When an NPC reaches Fear = 100 (Terrified), they refuse all dialogue. The player can reduce Fear through **non-dialogue actions**:

| Action | Fear Reduction | Description |
|--------|---------------|-------------|
| Kill alien threatening the NPC's area | -15 | Player eliminates nearby threat |
| Bring supplies to NPC's location | -10 | Player drops resources near NPC (no dialogue needed) |
| Complete a world event that benefits the NPC | -20 | Player saves camp, clears zone, etc. |
| Wait (passive decay) | -5 per 10 minutes game time | Fear slowly decreases if no further frightening actions occur |

Fear recovery is tracked by the Dialogue System but triggered by world events (Combat System, Inventory System, Scene Management). The player does not need to talk to the NPC to reduce Fear — protective actions are observed and registered automatically. When Fear drops below 80, the NPC becomes willing to talk again.

### States and Transitions

**Dialogue System State Machine:**

| State | Entry Condition | Exit Condition | Behavior |
|-------|----------------|----------------|----------|
| **Idle** | Initial state | Player initiates dialogue with NPC | No active conversation. NPCs perform ambient behaviors. |
| **Greeting** | Dialogue starts | Greeting audio/text completes | NPC greeting plays. Radial wheel prepares. |
| **Topic Selection** | Greeting completes | Player selects a topic | Radial wheel shows available topics. |
| **Branch** | Player selects topic or choice | NPC response completes, next choice presented | Dialogue tree traverses. Choices affect relationship. |
| **Farewell** | Player selects "Leave" or dialogue tree ends | Farewell audio/text completes | NPC farewell plays. Relationship state saved. |
| **Interrupted** | Alien melee threat or NPC death | Immediate transition | Dialogue aborts. No farewell. GSM returns to Playing. |

### Interactions with Other Systems

| System | Direction | Data Flow | Interface |
|--------|-----------|-----------|-----------|
| **Player Controller** | Reads + Writes | Dialogue start/end, choice selection | `OnDialogueStarted(NPCId)`, `OnDialogueEnded()`, `SelectDialogueChoice(ChoiceId)` — Player Controller routes IA_Interact to Dialogue System when target is NPC |
| **Investigation System** | Reads + Writes | Survivor testimony clues, dialogue gating | `RegisterTestimonyClue(ClueId, DialogueNodeId)` — Dialogue System fires clue discovery when player selects tagged option. Investigation System gates dialogue options based on thread state via `GetThreadState(ThreadId)`. |
| **Game State Machine** | Reads + Writes | Dialogue state transitions | `RequestStateTransition(DialogueStart)`, `RequestStateTransition(DialogueEnd)` — GSM manages Dialogue state (priority 30). |
| **Camera System** | Reads + Writes | Conversation camera framing | `SetConversationMode(NPCRef)` — Camera transitions to over-the-shoulder framing. Both characters visible. |
| **Input System** | Reads | IMC_Dialogue activation | IMC_Dialogue pushed when dialogue starts (priority +3). Movement locked. Dialogue choices enabled. |
| **Stealth System** | Reads | Detection level for dialogue accessibility | `GetCurrentDetectionLevel()` — some NPCs refuse to talk if detection ≥ 50 (NPC won't risk conversation in danger). |
| **Combat System** | Reads | Combat state for dialogue interruption | `bIsInCombat` — dialogue cannot start during combat. Melee threat interrupts active dialogue. |
| **HUD System** | Writes | Radial wheel rendering, choice display | `ShowDialogueWheel(Choices[])`, `HideDialogueWheel()` — HUD System renders the radial choice wheel. |
| **Audio System** | Writes | NPC voice lines, dialogue SFX | `PlayDialogueLine(NPCId, LineId)`, `PlayDialogueSound(EDialogueSound)` — NPC voice delivery, radial wheel SFX. |
| **Save/Load System** | Reads + Writes | Relationship state, conversation history | `SaveDialogueState()`, `RestoreDialogueState()` — persists all NPC relationship data. |

**Interface Contract:**

```cpp
// Dialogue System public interface (C++ sketch)
class UDialogueSubsystem : public UWorldSubsystem {
    // Dialogue lifecycle
    void StartDialogue(FNPCId NPCId);
    void EndDialogue();
    bool IsDialogueActive();
    FNPCId GetCurrentNPC();
    
    // Choice handling
    void SelectChoice(FChoiceId ChoiceId);
    TArray<FDialogueChoice> GetAvailableChoices();
    
    // Relationship queries
    FRelationshipState GetRelationship(FNPCId NPCId);
    void ModifyRelationship(FNPCId NPCId, ERelationshipDimension Dimension, int32 Delta);
    bool HasFlag(FNPCId NPCId, FName FlagName);
    void SetFlag(FNPCId NPCId, FName FlagName, bool Value);
    
    // Topic gating
    TArray<FDialogueTopic> GetAvailableTopics(FNPCId NPCId);
    bool IsTopicUnlocked(FNPCId NPCId, FTopicId TopicId);
    
    // Clue registration
    void RegisterTestimonyClue(FClueId ClueId, FDialogueNodeId NodeId);
    
    // Events
    FDelegateHandle SubscribeToDialogueStarted(FDialogueStartedDelegate Callback);
    FDelegateHandle SubscribeToDialogueEnded(FDialogueEndedDelegate Callback);
    FDelegateHandle SubscribeToClueDiscovered(FDialogueClueDiscoveredDelegate Callback);
    
    // Save/Load
    FDialogueStateData SaveDialogueState();
    void RestoreDialogueState(const FDialogueStateData& State);
}
```

## Formulas

**Formula 1 — Relationship Delta**

The `relationship_delta` formula calculates how a dialogue choice affects an NPC's relationship:

```
Δ_Trust = Σ (W_choice × V_choice + W_action × V_action + W_context × V_context)
Δ_Fear = Σ (W_choice × V_choice + W_action × V_action + W_context × V_context)
Δ_Knowledge = Σ (W_choice × V_choice + W_context × V_context)
```

| Weight | Symbol | Default | Description |
|--------|--------|---------|-------------|
| Choice weight | W_choice | 1.0 | Base weight for the dialogue choice itself |
| Action weight | W_action | 0.5 | Weight for the player's recent actions (helped, harmed, ignored) |
| Context weight | W_context | 0.3 | Weight for situational context (danger level, time pressure) |

| Value | Symbol | Range | Description |
|-------|--------|-------|-------------|
| Choice value | V_choice | -20 to +20 | How positive/negative the choice is (authored per choice) |
| Action value | V_action | -15 to +15 | How positive/negative the player's recent actions were (authored per action) |
| Context value | V_context | -10 to +10 | How the situation affects the choice (e.g., helping during combat is worth more) |

**Expected output range:** -35 to +35 per choice (Trust, Fear, Knowledge each calculated independently).
**Clamping:** All relationship values clamp to [0, 100] after each delta application.
**Example:** Player chooses "Promise to help" (V_choice=+15 Trust), recently saved NPC's friend (V_action=+10 Trust), conversation happens in safe camp (V_context=0). Δ_Trust = 1.0×15 + 0.5×10 + 0.3×0 = **20**. Trust increases by 20.

---

**Formula 2 — Topic Availability Score**

The `topic_availability` formula determines whether a dialogue topic is available:

```
A_topic = T_gate × R_gate × I_gate × C_gate
```

All gates are binary (0 or 1). Topic is available if A_topic = 1.

| Gate | Condition | Value |
|------|-----------|-------|
| T_gate (Trust gate) | Trust ≥ topic's Trust requirement | 1 if met, 0 if not |
| R_gate (Relationship gate) | No conflicting flags (e.g., "BetrayedNPC") | 1 if no conflict, 0 if blocked |
| I_gate (Investigation gate) | Required thread state met OR no thread requirement | 1 if met or no requirement, 0 if blocked |
| C_gate (Context gate) | Not in combat, detection < 50, NPC alive | 1 if clear, 0 if blocked |

**Expected output:** 0 (unavailable) or 1 (available).
**Example:** Topic requires Trust ≥ 60, no conflicting flags, thread T_immunity at "Confirmed", not in combat. Player has Trust=65, no flags, thread at Confirmed, safe. A_topic = 1 × 1 × 1 × 1 = **1** (available).

---

**Formula 3 — NPC Greeting Variation**

The `greeting_variation` formula selects which greeting an NPC uses:

```
if ConversationsHad == 0:          Greeting = FirstMeeting
elif ConversationsHad == 1:        Greeting = SecondMeeting
elif LastConversation was recent:  Greeting = RecentReturn (within 5 minutes game time)
elif Trust ≥ 80:                   Greeting = Allied
elif Trust ≥ 60:                   Greeting = Trusting
elif Trust ≥ 40:                   Greeting = Neutral
elif Trust ≥ 20:                   Greeting = Wary
else:                              Greeting = Hostile
```

**Expected output:** One greeting variant per NPC per conversation start.
**Note:** Each NPC has authored greeting variants for each category. The formula selects the appropriate variant based on relationship state.

## Edge Cases

| Scenario | Expected Behavior | Rationale |
|----------|------------------|-----------|
| **Player starts dialogue while detection level = 60 (Alert)** | NPC refuses to talk: "Not here, not now. It's too dangerous." Dialogue does not start. | NPCs are self-preserving. They won't risk conversation while aliens are actively hunting. |
| **Alien reaches melee range during dialogue** | Dialogue interrupted immediately. "We need to move!" plays. GSM returns to Playing. Combat begins. No relationship change from interrupted conversation. | Safety override. Dialogue cannot persist when the player is in immediate danger. |
| **Player walks away from NPC mid-conversation** | Dialogue pauses. If player returns within 10s, conversation resumes from last node. If not, default farewell plays, relationship state saved with partial progress. | Prevents conversation loss from accidental movement. 10s window is generous but not infinite. |
| **NPC is killed while dialogue is active** | Dialogue ends immediately. No farewell. Relationship state is lost. Any pending clues from this NPC are marked as "Lost." Player receives no notification — the death is the notification. | Consequence of player's failure to protect the NPC. Harsh but consistent with survival pillar. |
| **Player has max Trust (100) with an NPC** | Trust cannot increase further. Dialogue choices that would increase Trust instead provide bonus resources or unique clues. | Caps prevent stat inflation. High Trust unlocks different rewards than more Trust. |
| **Player has max Fear (100) with an NPC** | NPC refuses to engage. Only greeting: "Please, just leave me alone." Dialogue ends immediately. | Extreme Fear is a dead end. The player must reduce Fear (through protective actions) to re-engage. |
| **Two NPCs are in proximity and player tries to talk to one** | Only the closest NPC (within 200cm) is the dialogue target. Other NPCs in range are ignored. Context prompt shows only the closest NPC's name. | Prevents ambiguity. Player must position carefully to choose which NPC to talk to. |
| **Player re-initiates dialogue with same NPC within 30 seconds** | NPC acknowledges: "You just talked to me. What else?" Greeting is shortened. Same topics available. No penalty. | Prevents accidental double-initiation. NPC reacts naturally to being approached again. |
| **Dialogue choice triggers a clue that the player already discovered** | Clue is not re-discovered. `OnClueDiscovered` does not fire. NPC delivers the testimony anyway (player can re-hear it). Relationship Knowledge does not increase for duplicate clues. | Prevents duplicate clue exploitation. Player can re-hear testimony but doesn't gain extra progress. |
| **Save/load mid-conversation** | Conversation state (current node, choices made in this session) is saved. On load, conversation resumes from the saved node. Relationship state is fully restored. | Player should not lose conversation progress due to saving/loading. |

## Dependencies

**Hard Dependencies** (system cannot function without):
- **Player Controller** ✅ (designed) — routes IA_Interact to Dialogue System for NPC targets. Proximity detection (200cm) determines dialogue initiation.
- **Game State Machine** ✅ (designed) — manages Dialogue state (priority 30), state transitions, and transition animations.
- **Camera System** ✅ (designed) — provides conversation camera framing (over-the-shoulder, both characters visible).

**Soft Dependencies** (enhanced by but works without):
- **Investigation System** (In Design) — provides testimony clues and thread-based dialogue gating. **MVP sequencing note:** Investigation System requires testimony clues from Dialogue System. Both systems must be implemented together for end-to-end testing. Without Investigation System, dialogue functions but clue discovery does not fire.
- **HUD System** ✅ (designed) — renders radial choice wheel. Without it, dialogue has no choice UI (fallback: text list at bottom of screen).
- **Stealth System** ✅ (designed) — provides detection level for dialogue accessibility. Without it, NPCs always available for dialogue regardless of detection.
- **Combat System** ✅ (designed) — provides combat state for dialogue interruption. Without it, dialogue can start during combat (reduced tension).
- **Audio System** (Not Started) — plays NPC voice lines and dialogue SFX. **Sequencing risk:** dialogue audio work (voice lines, radial wheel SFX) is blocked until Audio System is designed. Dialogue text/subtitles can be implemented independently.
- **Save/Load System** (Not Started) — persists relationship state. Without it, NPC relationships reset on every load.

**Depended On By**:

| System | Interface Used | Expected Behavior |
|--------|---------------|-------------------|
| Investigation System | Testimony clues, thread-based dialogue gating | Receives clue discovery events, gates dialogue options by thread state |
| Quest System | Dialogue-triggered quests, NPC quest states | Quests start/end through dialogue choices |
| Faction Reputation System | NPC faction membership, trust/fear affecting faction reputation | Faction reputation changes based on NPC relationship states |
| HUD System | Radial wheel rendering, choice display | Renders dialogue UI elements |
| Save/Load System | Relationship state, conversation history | Persists and restores all dialogue data |

## Tuning Knobs

| Parameter | Default | Safe Range | Effect of Increase | Effect of Decrease |
|-----------|---------|------------|-------------------|-------------------|
| `DialogueProximityRange` | 200cm | 150–300cm | Easier to initiate dialogue from distance | Must be very close to NPC |
| `DialogueWalkAwayTimeout` | 10s | 5–30s | More forgiving if player wanders off | Conversation ends quickly if player moves |
| `TrustInitial` | 30 | 10–50 | NPCs start more trusting | NPCs start more wary |
| `FearInitial` | 10 | 0–30 | NPCs start less afraid | NPCs start more intimidated |
| `KnowledgeInitial` | 0 | 0 | Fixed — NPCs start knowing nothing | N/A |
| `TrustDeltaMax` | 35 | 20–50 | Trust changes faster per choice | Trust changes slowly, more conversations needed |
| `FearDeltaMax` | 35 | 20–50 | Fear changes faster per choice | Fear changes slowly |
| `KnowledgeDeltaPerClue` | 10 | 5–20 | Knowledge builds faster per clue shared | More clues needed to build Knowledge |
| `GreetingRecentThreshold` | 5min | 2–15min | Longer "recent" window for greeting variation | Shorter window, NPCs forget conversations faster |
| `RadialWheelFadeIn` | 0.2s | 0.1–0.5s | Smoother wheel appearance | Snappier, may feel jarring |
| `RadialWheelFadeOut` | 0.15s | 0.1–0.3s | Smoother wheel disappearance | Snappier removal |
| `UI Slide Duration` | 0.3s | 0.2–0.5s | Smoother transition into/out of dialogue | Faster transition, less cinematic |
| `MeleeInterruptRange` | 150cm | 100–300cm | Aliens must be closer to interrupt dialogue | Aliens can interrupt from farther away |

> **Note:** `WorldSlowFactor` (0.85x) is defined in GSM GDD as the authoritative owner. Dialogue System references it but does not own it.

## Visual/Audio Requirements

### Radial Choice Wheel Visual

| Property | Value |
|----------|-------|
| Shape | Semi-circle (180° arc) |
| Segment count | 5–8 (matches available choices) |
| Segment size | 60px arc radius, 20px thickness |
| Segment color | Per category: Blue (#2196F3), Green (#4CAF50), Yellow (#FFC107), Red (#F44336), Gray (#9E9E9E) |
| Hover effect | Segment brightens (+20% luminance), full choice text appears below |
| Selected effect | Segment pulses once, then fades as NPC response begins |
| Background | Semi-transparent dark overlay (30% opacity) behind wheel |
| Font | Off-white (#E8E4DC), 14pt for choice phrases, 12pt for hover preview |

### Dialogue Audio

| Sound | Trigger | Description | Volume | Priority |
|-------|---------|-------------|--------|----------|
| **Dialogue Start** | Dialogue begins | Soft chime, descending tone | -16dB | Low |
| **Radial Wheel Appear** | Wheel fades in | Subtle UI click | -20dB | Low |
| **Choice Hover** | Player hovers over choice | Soft tick | -24dB | Low |
| **Choice Select** | Player selects choice | Confirm click | -18dB | Low |
| **Dialogue End** | Farewell plays | Soft chime, ascending tone | -16dB | Low |
| **Dialogue Interrupted** | Alien melee threat | Urgent tone + NPC warning line | -12dB | High |
| **NPC Voice Line** | NPC speaks | Character-specific voice (TBD) | -10dB (dialogue mix) | High |

### Camera Framing

| Property | Value |
|----------|-------|
| Mode | Over-the-shoulder (OTS) |
| Distance | 250cm from NPC |
| Angle | 30° offset from NPC-to-player vector |
| FOV | 55° (slightly tighter than default ThirdPerson) |
| Both characters visible | Yes — player character in foreground, NPC in focus |
| Transition | 0.5s smooth blend from ThirdPerson to OTS |

## UI Requirements

| Element | Mode | Position | Update Frequency | Condition |
|---------|------|----------|-----------------|-----------|
| **Radial choice wheel** | Both modes | Near NPC's head, screen-space anchored | On topic/choice change | Active during dialogue |
| **Choice hover preview** | Both modes | Below radial wheel | On hover | Shows full choice text |
| **NPC name label** | Both modes | Above NPC's head (always visible) | Static | Shows during and outside dialogue |
| **Relationship indicator** | Tactical only | Pause menu, NPC tab | On relationship change | Shows Trust/Fear/Knowledge bars |
| **Subtitle display** | Both modes | Bottom-center | Per dialogue line | NPC voice line text |
| **Dialogue interrupted warning** | Both modes | Center screen flash | On melee interrupt | "We need to move!" — 1.5s fade |

## Cross-References

| This Document References | Target GDD | Specific Element Referenced | Nature |
|--------------------------|-----------|----------------------------|--------|
| Context prompt routing for NPC targets | `design/gdd/player-controller.md` | IA_Interact routing, proximity detection (200cm), OnDialogueStarted/Ended | Data dependency |
| Dialogue state priority (30) | `design/gdd/game-state-machine.md` | GSM Dialogue state, priority stack, 0.3s UI slide, world slow to 0.85x | State dependency |
| IMC_Dialogue input mapping | `design/gdd/input-system.md` | IMC_Dialogue priority +3, movement locked, dialogue choices enabled | Input dependency |
| Conversation camera framing | `design/gdd/camera-system.md` | Conversation mode (OTS, both characters visible, 0.5s transition, 55° FOV, 250cm distance) | Camera dependency |
| Testimony clue tagging | `design/gdd/investigation-system.md` | [CLUE:ClueId] tag, OnClueDiscovered, thread-based dialogue gating | Data dependency |
| Detection level for dialogue accessibility | `design/gdd/stealth-system.md` | GetCurrentDetectionLevel(), detection ≥ 50 blocks dialogue | Rule dependency |
| Combat state for dialogue interruption | `design/gdd/combat-system.md` | bIsInCombat, melee threat detection | Rule dependency |
| Radial wheel rendering | `design/gdd/hud-system.md` | ShowDialogueWheel(), HideDialogueWheel() | UI dependency |
| Relationship state persistence | `design/gdd/save-load-system.md` (Not Started) | SaveDialogueState(), RestoreDialogueState() | Data dependency |

## Acceptance Criteria

**Core Rules:**

- **GIVEN** player approaches NPC within 200cm, **WHEN** context prompt "Talk to [NPC Name]" appears and player presses IA_Interact, **THEN** GSM transitions to Dialogue state (0.3s slide), camera transitions to OTS framing (0.5s), IMC_Dialogue pushed, NPC greeting plays, radial wheel appears with available choices.

- **GIVEN** dialogue is active, **WHEN** player hovers over a radial choice segment, **THEN** segment brightens (+20% luminance), full choice text appears below wheel.

- **GIVEN** dialogue is active, **WHEN** player selects a choice, **THEN** choice segment pulses once, NPC response plays, relationship deltas applied per Formula 1, radial wheel updates with next available choices.

- **GIVEN** player selects "Leave" option, **WHEN** farewell completes, **THEN** radial wheel fades out (0.15s), GSM returns to Playing (0.3s slide), camera returns to ThirdPerson (0.5s), IMC_Dialogue popped, relationship state saved.

- **GIVEN** NPC has Trust = 15 (Hostile), **WHEN** player initiates dialogue, **THEN** NPC says "Go away." and dialogue ends immediately. No radial wheel appears.

- **GIVEN** NPC has Trust = 70 (Trusting), **WHEN** player initiates dialogue, **THEN** NPC greeting is "Trusting" variant (per Formula 3), all topics with Trust requirement ≤ 70 are available.

- **GIVEN** player selects a dialogue option tagged with `[CLUE:clue_testimony_01]`, **WHEN** NPC delivers testimony, **THEN** `OnClueDiscovered(clue_testimony_01)` fires to Investigation System, NPC Knowledge increases by +10.

- **GIVEN** dialogue topic requires Trust ≥ 60 and thread T_immunity at "Confirmed", **WHEN** player has Trust = 65 and thread at Confirmed, **THEN** topic is available (A_topic = 1 per Formula 2).

- **GIVEN** dialogue topic requires Trust ≥ 60, **WHEN** player has Trust = 40, **THEN** topic is unavailable (A_topic = 0). Radial wheel does not show this topic.

- **GIVEN** detection level = 60 (Alert), **WHEN** player approaches NPC and presses IA_Interact, **THEN** NPC refuses to talk: "Not here, not now. It's too dangerous." Dialogue does not start.

- **GIVEN** dialogue is active and alien reaches melee range (150cm), **WHEN** melee threat detected, **THEN** dialogue is interrupted immediately, "We need to move!" plays, GSM returns to Playing, combat begins.

- **GIVEN** player walks away from NPC mid-conversation (exits 200cm radius), **WHEN** 10s passes without player returning, **THEN** default farewell plays, relationship state saved with partial progress, dialogue ends.

- **GIVEN** player re-initiates dialogue with same NPC within 30s of ending, **WHEN** dialogue starts, **THEN** NPC acknowledges: "You just talked to me. What else?" Greeting is shortened.

**Formulas:**

- **GIVEN** Formula 1 (relationship delta), **WHEN** player chooses "Promise to help" (V_choice=+15 Trust), recently saved NPC's friend (V_action=+10 Trust), safe camp context (V_context=0), **THEN** Δ_Trust = 1.0×15 + 0.5×10 + 0.3×0 = **20**.

- **GIVEN** Formula 2 (topic availability), **WHEN** topic requires Trust ≥ 60, no conflicting flags, thread at Confirmed, not in combat, player has Trust=65, no flags, thread Confirmed, safe, **THEN** A_topic = 1 × 1 × 1 × 1 = **1** (available).

- **GIVEN** Formula 3 (greeting variation), **WHEN** ConversationsHad = 0, **THEN** Greeting = FirstMeeting. **WHEN** ConversationsHad = 3, Trust = 75, LastConversation was 10 minutes ago, **THEN** Greeting = Trusting.

**Edge Cases:**

- **GIVEN** NPC is killed while dialogue is active, **WHEN** death occurs, **THEN** dialogue ends immediately, no farewell, relationship state is lost, pending clues from this NPC marked as "Lost."

- **GIVEN** player has Trust = 100 (max), **WHEN** player makes a choice that would increase Trust by +15, **THEN** Trust stays at 100, bonus resource or unique clue is provided instead.

- **GIVEN** player has Fear = 100 (max), **WHEN** player initiates dialogue, **THEN** NPC says "Please, just leave me alone." Dialogue ends immediately.

- **GIVEN** dialogue choice triggers a clue the player already discovered, **WHEN** NPC delivers testimony, **THEN** `OnClueDiscovered` does NOT fire, Knowledge does NOT increase, testimony is still delivered (player can re-hear).

- **GIVEN** player saves mid-conversation at node X, **WHEN** game loads, **THEN** conversation resumes from node X, relationship state fully restored.

- **GIVEN** two NPCs are within 200cm of player, **WHEN** player approaches and presses IA_Interact, **THEN** dialogue starts with the closest NPC only. Context prompt shows closest NPC's name. Other NPC is ignored.

- **GIVEN** NPC type is Terminal (automated), **WHEN** player interacts, **THEN** no relationship tracking occurs. Dialogue is linear with no choices. Trust/Fear/Knowledge are not modified.

- **GIVEN** NPC has Fear = 100 (Terrified), **WHEN** player kills alien threatening NPC's area, **THEN** Fear decreases by 15 to 85. When Fear drops below 80, NPC becomes willing to talk again.

## Open Questions

| # | Question | Owner | Deadline | Resolution |
|---|----------|-------|----------|-----------|
| OQ-1 | Should NPCs have voiced dialogue (full voice acting) or text-only with audio cues? This is a major production cost decision. | audio-director | Budget planning | |
| OQ-2 | Should the radial wheel support keyboard navigation (number keys 1–5) in addition to mouse/stick? | game-designer | GDD review | ✅ Resolved: Yes. Number keys 1–5 select visible choices. Arrow keys scroll. Enter confirms. See Rule 2. |
| OQ-3 | Should dialogue choices have a time limit (player must choose within X seconds) or be untimed? Timed choices add tension but may frustrate. | game-designer | Playtest | Deferred to playtest. Default: untimed. If playtest shows conversations drag, add optional timed mode for specific high-tension NPCs. |
| OQ-4 | Should the player be able to interrupt an NPC mid-speech, or must they wait for the NPC to finish? | game-designer | Playtest | |
| OQ-5 | How should the Dialogue System handle localization? Are dialogue trees stored in a format that supports easy translation? | localization-lead | Localization planning | |
| OQ-6 | Should NPCs have ambient behaviors while waiting for the player to talk to them (pacing, sitting, working)? | animation | Animation pipeline | |

## Progression & Depth

The Dialogue System does not unlock new mechanics over time — the radial wheel, relationship tracking, and branching trees work the same from the first conversation to the last. However, the player's **social skill** evolves through mastery:

### Dialogue Mastery Curve

| Phase | Player Behavior | Dialogue Experience |
|-------|----------------|-------------------------|
| **First hour** | Talks to every NPC, explores every dialogue branch, reads every choice carefully. | Dialogue feels exploratory. Player learns the radial wheel, relationship dimensions, and consequence system. |
| **3–5 hours** | Reads NPC body language and tone to predict Trust/Fear changes. Asks informed questions based on investigation progress. | Dialogue becomes strategic. Player plans conversations around relationship goals (build Trust with one NPC, gather Knowledge from another). |
| **10+ hours** | Predicts NPC responses, navigates to optimal branches efficiently, uses dialogue to unlock investigation clues and faction alliances. | Dialogue is a core tool. The player uses conversations to advance the conspiracy, build alliances, and shape the world's social landscape. |

### Deferred Dialogue Content (Vertical Slice and beyond)

| Feature | Current State | Deferred To | Rationale |
|---------|--------------|-------------|-----------|
| Faction leader NPCs | Not designed | Vertical Slice | Faction representatives with reputation-gated dialogue and group-level consequences |
| Group conversations | Not designed | Vertical Slice | Multiple NPCs in one conversation with inter-NPC dynamics |
| Romance/deep relationship arcs | Not designed | Alpha | Extended relationship progression with unique narrative payoff |
| Player character voice | Not designed | Alpha | Player character speaks during dialogue (not just silent choices) |
| Dialogue replay/rewind | Not designed | Post-MVP | Player can re-listen to past conversations from pause menu |

---

## Design Review Findings

> **Date**: 30 April 2026
> **Reviewer**: design-review skill
> **Verdict**: PASS (with corrections — all resolved below)

### Completeness
- **8/8 CLAUDE.md sections** present and substantive
- **8/8 design-system sections** present and substantive (Progression & Depth heading exists at line 555)
- Bonus sections: Dependencies, Visual/Audio Requirements, UI Requirements, Cross-References, Acceptance Criteria (Gherkin), Tuning Knobs (14 parameters)

### Issues Found & Resolved

| # | Issue | Severity | Status | Resolution |
|---|-------|----------|--------|------------|
| 1 | Dialogue tree data structure undefined | Must Fix | ✅ Resolved | Added Rule 3b — full data structure with FDialogueNode (13 fields) and FDialogueChoice (9 fields), stored in Data Tables |
| 2 | Fear=100 recovery path unclear | Must Fix | ✅ Resolved | Added Rule 10 — non-dialogue Fear reduction actions (kill alien -15, bring supplies -10, world event -20, passive decay -5/10min). NPC willing to talk again when Fear < 80 |
| 3 | MeleeInterruptRange not defined in rules | Should Fix | ✅ Resolved | Rule 7 updated to specify 150cm, references Tuning Knobs |
| 4 | Radial wheel scroll behavior underspecified | Should Fix | ✅ Resolved | Rule 2 updated: stick rotation/mouse wheel scrolls, no wrap-around, 0.1s slide animation, keyboard navigation (1-5 keys, arrows, Enter) |
| 5 | NPC type classification missing | Should Fix | ✅ Resolved | Added Rule 9 — 5 NPC types (Survivor, Faction Leader, Ambient, Terminal, Hostile) with different relationship tracking levels |
| 6 | Missing AC for two-NPC proximity | Should Fix | ✅ Resolved | Added AC: closest NPC wins, context prompt shows closest name |
| 7 | Missing AC for save/load mid-conversation | Should Fix | ✅ Resolved | AC already existed (line 542). Confirmed present. |
| 8 | Missing AC for terminal NPC type | Should Fix | ✅ Resolved | Added AC: no relationship tracking, linear dialogue, no choices |
| 9 | Missing AC for Fear recovery | Should Fix | ✅ Resolved | Added AC: killing alien reduces Fear by 15, NPC talks again when Fear < 80 |

### Minor Notes (not blockers)
- World slow factor (0.85x) is consistent between Dialogue GDD and GSM GDD (GSM visual specs section).
- IMC_Dialogue priority (+3) vs GSM Dialogue state priority (30) are different systems — not a conflict.
- Stealth detection threshold for dialogue (≥50 blocks) is intentionally more permissive than Investigation System's stealth gate (<25 required). Design choice, not a conflict.
- Camera System GDD does not have a conversation/OTS mode — this should be added during Camera System review or architecture phase.
