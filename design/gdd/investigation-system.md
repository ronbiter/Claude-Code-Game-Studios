# Investigation System

> **Status**: Draft
> **Author**: user + agents
> **Last Updated**: 30 April 2026
> **Last Verified**: 30 April 2026
> **Implements Pillar**: Pillar 2 (Earned Discovery)

## Summary

The Investigation System governs how the player discovers, collects, and pieces together conspiracy clues throughout Hostile World. Clues come in three types: physical objects (documents, recordings, terminals, alien artifacts), environmental observations (biomass patterns, alien structures, destroyed buildings, mass graves), and survivor testimony (dialogue choices that reveal intel). Each clue is a fragment of the larger conspiracy. The system tracks discovered clues, active conspiracy threads, and automatically unlocks revelations when enough fragments are gathered — no manual deduction board, no UI puzzle. The player earns story through exploration, observation, and conversation. This is the mechanical core of Pillar 2 (Earned Discovery).

> **Quick reference** — Layer: `Core` · Priority: `MVP` · Key deps: `Player Controller, Dialogue System, Stealth System, Combat System`

## Overview

Hostile World's conspiracy is not a linear story — it is a web of interconnected threads. The Investigation System manages this web. Each clue belongs to one or more conspiracy threads (e.g., "Origin of the Virus," "Military Cover-Up," "Alien Intelligence," "Immunity Cause"). When the player discovers enough clues in a thread, a revelation unlocks — a story beat that advances the narrative. Revelations are not cutscenes; they are earned discoveries that the player pieces together from the clues they've found.

The system operates on three levels:

- **Clue Discovery** (moment-to-moment): Player finds a clue through interaction, observation, or conversation. Context prompt appears for physical clues. Trigger zones fire for environmental observations. Dialogue choices unlock testimony clues.
- **Thread Progression** (short-term, 5–15 minutes): Player accumulates clues in a conspiracy thread. The thread advances through stages: Unknown → Suspected → Confirmed → Revealed. Each stage unlocks new context — the player understands more of the conspiracy.
- **Revelation Unlock** (session-level, 60–120 minutes): When a thread reaches "Revealed," a revelation fires. This is a story beat — not a cutscene, but a structured presentation of the clues the player has found, synthesized into a coherent narrative fragment. The player sees the conspiracy come together.

The Investigation System has no player-facing UI in Immersive mode (clues are discovered, not tracked). In Tactical mode, a minimal thread tracker shows which conspiracy threads are active and how many clues remain — but the content of clues is never displayed in the HUD. The player must remember and piece together what they've found.

## Player Fantasy

The Investigation System makes the player feel **like a detective in a hostile world**. Every document read, every terminal hacked, every survivor questioned, every anomaly observed is a piece of a puzzle that the player is solving through their own curiosity and attention. The game never says "you should investigate this" — the player chooses to look deeper because the world rewards looking.

The signature moment: the player finds a military research terminal in an abandoned bunker. It contains a fragment about "Subject Zero" and "immune response." Hours later, in a resistance camp, a survivor mentions "the one person who didn't turn." The player connects these two clues themselves — no UI prompt, no deduction board, no hand-holding. The Investigation System tracks that both clues are discovered, recognizes that they belong to the "Immunity Cause" thread, and unlocks a revelation: the player now knows why they survived. But the player earned that knowledge through their own attention and memory.

This serves **Pillar 2 (Earned Discovery)** — every revelation is found through exploration and interaction, never handed through automatic cutscenes. **Pillar 1 (Hostile World)** — investigation happens in dangerous zones. The player must balance curiosity with survival. Some clues are only accessible when the area is safe (Hidden stealth state, not in combat). **Pillar 3 (Tense Survival)** — investigation takes time and attention. The player is vulnerable while reading a document or questioning a survivor.

## Detailed Design

### Core Rules

**Rule 1 — Clue Types**

Three clue types, each with different discovery mechanics:

| Type | Symbol | Discovery Method | Context Prompt | Example |
|------|--------|-----------------|----------------|---------|
| **Physical Object** | C_phys | Player interacts with object via context prompt | Yes — "Read Document", "Access Terminal", "Examine Artifact" | Military orders, alien research notes, survivor journal, recording device |
| **Environmental Observation** | C_env | Player enters trigger zone + looks at anomaly for 2s | No — auto-discovered when player faces anomaly for 2s within trigger zone | Biomass growth pattern, destroyed military vehicle, mass grave, alien structure |
| **Survivor Testimony** | C_test | Player selects specific dialogue option during conversation | No — triggered through Dialogue System | Survivor describes outbreak, mentions Subject Zero, reveals military movement |

**Rule 2 — Clue Discovery Flow**

Each clue type follows a different discovery flow:

**Physical Object Discovery:**
1. Player approaches clue object (within ContextTraceLength = 500cm per Player Controller)
2. Context prompt appears: "Read Document", "Access Terminal", etc.
3. Player presses IA_Interact
4. Clue content is presented (document text, recording audio, terminal UI)
5. Player dismisses clue content (presses IA_Interact or backs away)
6. Clue marked as discovered, `OnClueDiscovered(ClueId)` fires
7. Conspiracy threads updated, revelation check runs

**Environmental Observation Discovery:**
1. Player enters clue trigger zone (radius 200–500cm, author-defined)
2. Player faces anomaly (camera forward vector within 30° of anomaly direction) for 2s
3. **Stealth gate check**: If detection level rises ≥ 25 during the 2s window, observation cancels immediately. No audio cue, no clue discovery. Player must return to Hidden state and restart the 2s observation.
4. Subtle audio cue plays (investigation chime, -18dB)
5. Clue marked as discovered, `OnClueDiscovered(ClueId)` fires
6. Conspiracy threads updated, revelation check runs
7. No UI — the player simply notices something and the game registers it

**Survivor Testimony Discovery:**
1. Player initiates dialogue with NPC (via Player Controller context prompt)
2. Dialogue System presents conversation tree
3. Player selects dialogue option tagged with `[CLUE:ClueId]`
4. NPC delivers testimony (audio + subtitles)
5. Clue marked as discovered, `OnClueDiscovered(ClueId)` fires
6. Conspiracy threads updated, revelation check runs

**Rule 3 — Conspiracy Threads**

A conspiracy thread is a collection of related clues that, when discovered, reveal a piece of the larger narrative.

| Property | Value |
|----------|-------|
| Thread states | Unknown → Suspected (1+ clues) → Confirmed (50%+ clues) → Revelation (100% clues, pending delivery) → Revealed (delivered) |
| Clues per thread (MVP) | 3–6 clues |
| Total threads (MVP) | 4 threads |
| Revelation trigger | Thread reaches "Revealed" state |
| Revelation delivery | Structured presentation of discovered clues, synthesized into narrative fragment |
| Thread visibility (Immersive) | None — player tracks threads through memory |
| Thread visibility (Tactical) | Minimal tracker: thread name + clue count (e.g., "Immunity Cause: 3/5") |

**MVP Conspiracy Threads:**

| Thread ID | Name | Clue Count | Description | Key Revelation |
|-----------|------|------------|-------------|----------------|
| T_origin | Origin of the Virus | 5 clues (1 optional) | How the alien infection began, where it came from, what the aliens' goal is | The infection is not an invasion — it's terraforming. The aliens are reshaping Earth for their biology. |
| T_coverup | Military Cover-Up | 4 clues (1 optional) | What the military knew, why they imprisoned immune people, what they tried to hide | The military knew about the infection before it hit. They imprisoned immune subjects to study them, not protect them. |
| T_immunity | Immunity Cause | 4 clues (1 optional) | Why the protagonist is immune, what makes them special, whether others exist | The protagonist's immunity is not genetic — it's acquired. They were exposed to a counter-agent before the outbreak. |
| T_hive | Alien Intelligence | 5 clues (1 optional) | How the hive mind works, what the aliens want, whether they can be communicated with | The hive mind is not hostile — it's defensive. The infection is a response to human military aggression against alien scouts. |

**Rule 4 — Revelation Delivery**

When a conspiracy thread reaches "Revealed" state (all clues discovered), a revelation fires:

| Property | Value |
|----------|-------|
| Trigger | Thread reaches 100% clue discovery |
| Timing | Deferred to next safe moment (not during combat, not during stealth engagement) |
| Delivery | Pause menu notification + structured clue synthesis |
| Format | "You've pieced together the truth about [thread name]" followed by a synthesized narrative fragment that connects all discovered clues |
| Duration | 15–30s read time |
| Player control | Player can dismiss at any time, re-read later from pause menu |
| Audio | Subtle revelation chime (-14dB), ambient music shift during delivery |
| Immersive mode | Revelation appears as a journal entry the player "writes" — diegetic presentation |
| Tactical mode | Revelation appears as a structured report — information-dense presentation |

**Rule 5 — Clue Accessibility Gates**

Some clues are gated by game state. This creates investigation tension — the player must be in the right state to discover certain clues.

| Gate Type | Condition | Clue Types Affected | Rationale |
|-----------|-----------|---------------------|-----------|
| **Combat Gate** | `bIsInCombat = false` (Combat System) | Physical objects, environmental observations | Player cannot read documents or examine anomalies while in combat. Forces player to clear threats first. |
| **Stealth Gate** | Detection level = Hidden (Stealth System) | Physical objects (sensitive documents), environmental observations (subtle anomalies) | Some clues require the player to be undetected. Reading a classified document while aliens are hunting you is unrealistic. |
| **Time Gate** | Specific time of day (Scene Management) | Environmental observations (bioluminescent patterns visible only at night) | Some clues are only visible under specific lighting conditions. |
| **Progression Gate** | Another thread at "Confirmed" or "Revealed" state | Survivor testimony (NPC only talks about topic after player has baseline knowledge) | Survivors only share certain information if the player has already discovered related clues. |

**Rule 6 — Clue Persistence and State**

| Property | Value |
|----------|-------|
| Discovered clues | Persist in save data permanently |
| Undiscovered clues | Remain in world until discovered (no respawning, no disappearing) |
| Physical clue objects | Remain in world after discovery (player can re-read) |
| Environmental trigger zones | Remain active after discovery (no re-trigger, but player can re-observe) |
| Survivor testimony | Can be re-heard by re-initiating dialogue and selecting same option |
| Thread state | Persists in save data |
| Revelation state | Persists in save data (can be re-read from pause menu) |

**Rule 7 — Clue Data Structure**

Each clue is defined by the following data record (stored in a Data Table):

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `ClueId` | FName | Unique identifier | `"clue_origin_terminal_01"` |
| `ClueType` | EClueType | Physical, Environmental, Testimony | Physical |
| `ThreadId` | FName | Primary conspiracy thread | `"t_origin"` |
| `SecondaryThreads` | TArray<FName> | Additional threads this clue contributes to (optional) | `["t_coverup"]` |
| `Content` | FText | The clue's narrative content (document text, recording transcript, testimony dialogue) | `"Subject Zero showed complete immunity to strain Alpha-7..."` |
| `WorldLocation` | FVector | Placement in world (physical clues) or trigger center (environmental) | (12000, -5000, 200) |
| `TriggerRadius` | float | Detection radius for environmental clues (cm) | 300 |
| `AnomalyDirection` | FRotator | Direction player must face for environmental clues | (0, 45, 0) |
| `Gates` | FClueGates | Accessibility gates (combat, stealth, time, progression) | CombatGate=true, StealthGate=false |
| `IsOptional` | bool | Whether this clue is required for thread completion | false |
| `DialogueNodeId` | FName | Dialogue node that triggers testimony (testimony clues only) | `"dialogue_sarah_testimony_03"` |

**Rule 8 — Revelation Authoring Format**

Revelation synthesis content is authored per thread in a Data Table (`DT_Revelations`). Each entry contains:

| Field | Type | Description |
|-------|------|-------------|
| `ThreadId` | FName | Which thread this revelation belongs to |
| `Title` | FText | "You've pieced together the truth about [thread name]" |
| `SynthesisText` | FText | The synthesized narrative fragment (150–300 words) |
| `ClueReferences` | TArray<FName> | Clue IDs referenced in the synthesis (for embedding clue images/quotes) |
| `AudioCue` | USoundBase | Revelation chime sound |

Narrative designers author synthesis text directly in the Data Table. The system does not procedurally generate synthesis — each thread has a hand-written revelation that references the clues the player has found. The synthesis text is the same regardless of discovery order, but clue references are presented in the order the player discovered them.

**Rule 9 — Single-Player Scope**

The Investigation System is designed for single-player only. All clue discovery, thread progression, and revelation delivery are local to the player's game session. Co-op investigation (OQ-6) is deferred to Post-MVP.

### States and Transitions

**Clue State Machine:**

| State | Entry Condition | Exit Condition | Behavior |
|-------|----------------|----------------|----------|
| **Undiscovered** | Initial state | Player discovers clue via any method | Clue exists in world, context prompt/trigger active |
| **Discovered** | Player interacts with clue | N/A (terminal state) | Clue content presented, thread updated, revelation check runs |

**Thread State Machine:**

| State | Entry Condition | Exit Condition | Behavior |
|-------|----------------|----------------|----------|
| **Unknown** | Initial state (0 clues) | First clue discovered | Thread not visible to player (Immersive) or shown as "???" (Tactical) |
| **Suspected** | 1+ clues discovered | 50%+ clues discovered | Thread name visible (Tactical), clue count shown |
| **Confirmed** | 50%+ clues discovered | 100% clues discovered | Thread name + partial synthesis available (player can review what they know so far) |
| **Revelation** | 100% clues discovered | Revelation delivered | Revelation fires, thread marked as "Revealed" |
| **Revealed** | Revelation delivered | N/A (terminal state) | Thread complete, full synthesis available for re-reading |

### Interactions with Other Systems

| System | Direction | Data Flow | Interface |
|--------|-----------|-----------|-----------|
| **Player Controller** | Reads | Clue interaction events, context prompt routing | `OnClueInteracted(ClueId)`, `DiscoverClue(ClueId)` — Player Controller routes IA_Interact to Investigation System when target is a clue object |
| **Dialogue System** | Reads + Writes | Survivor testimony clues, dialogue gating | `RegisterTestimonyClue(ClueId, DialogueNodeId)` — Dialogue System fires clue discovery when player selects tagged dialogue option. Investigation System gates dialogue options based on thread state. |
| **Stealth System** | Reads | Detection level for clue accessibility | `GetCurrentDetectionLevel()` — returns 0–100. Investigation System uses this for Stealth Gate (Rule 5). |
| **Combat System** | Reads | Combat state for clue accessibility | `GetCurrentCombatState()` — returns ECombatState. Investigation System uses bIsInCombat for Combat Gate (Rule 5). |
| **Scene Management** | Reads | Time of day, zone state for clue accessibility | `GetTimeOfDay()`, `GetCurrentZone()` — Investigation System uses these for Time Gate and zone-specific clues. |
| **HUD System** | Writes | Thread tracker (Tactical mode), revelation notifications | `OnThreadUpdated(ThreadId, ClueCount, TotalClues)`, `OnRevelationUnlocked(ThreadId)` — HUD System renders thread tracker and revelation delivery. |
| **Save/Load System** | Reads + Writes | Clue discovery state, thread state, revelation state | `SaveInvestigationState()`, `RestoreInvestigationState()` — persists all clue and thread data. |
| **Audio System** | Writes | Investigation audio cues (discovery chime, revelation chime) | `PlayInvestigationSound(EInvestigationSound)` — discovery chime, revelation chime, ambient investigation music shift. |

**Interface Contract:**

```cpp
// Investigation System public interface (C++ sketch)
class UInvestigationSubsystem : public UGameInstanceSubsystem {
    // Clue discovery
    void DiscoverClue(FClueId ClueId);
    bool IsClueDiscovered(FClueId ClueId);
    TArray<FClueId> GetDiscoveredClues();
    TArray<FClueId> GetUndiscoveredCluesInThread(FThreadId ThreadId);
    
    // Thread queries
    FThreadState GetThreadState(FThreadId ThreadId);
    int32 GetClueCount(FThreadId ThreadId);
    int32 GetTotalClues(FThreadId ThreadId);
    float GetThreadProgress(FThreadId ThreadId); // 0.0–1.0
    
    // Revelation
    bool HasRevelationPending();
    FRevelationData GetPendingRevelation();
    void MarkRevelationDelivered(FThreadId ThreadId);
    
    // Accessibility gates
    bool IsClueAccessible(FClueId ClueId); // checks combat, stealth, time, progression gates
    
    // Events
    FDelegateHandle SubscribeToClueDiscovered(FClueDiscoveredDelegate Callback);
    FDelegateHandle SubscribeToThreadUpdated(FThreadUpdatedDelegate Callback);
    FDelegateHandle SubscribeToRevelationUnlocked(FRevelationUnlockedDelegate Callback);
    
    // Save/Load
    FInvestigationStateData SaveInvestigationState();
    void RestoreInvestigationState(const FInvestigationStateData& State);
}
```

## Formulas

**Formula 1 — Thread Progress**

The `thread_progress` formula calculates a conspiracy thread's completion percentage:

```
P_thread = N_discovered / N_total
```

**Variables:**

| Variable | Symbol | Type | Range | Source | Description |
|----------|--------|------|-------|--------|-------------|
| Discovered clues | N_discovered | int32 | 0–N_total | This GDD | Number of clues discovered in this thread |
| Total clues | N_total | int32 | 3–6 | This GDD | Total number of clues in this thread |
| Thread progress | P_thread | float | 0.0–1.0 | Calculated | Thread completion percentage |

**Expected output range:** 0.0 (no clues) to 1.0 (all clues).
**State thresholds:** Unknown (0.0), Suspected (0.01–0.49), Confirmed (0.50–0.99), Revealed (1.0).

---

**Formula 2 — Clue Accessibility Score**

The `clue_accessibility` formula determines whether a clue is currently accessible to the player:

```
A_clue = G_combat × G_stealth × G_time × G_progression
```

All gates are binary (0 or 1). Clue is accessible if A_clue = 1.

| Gate | Condition | Value |
|------|-----------|-------|
| G_combat | bIsInCombat = false | 1 if not in combat, 0 if in combat |
| G_stealth | Detection level < 25 (Hidden) OR clue has no stealth gate | 1 if Hidden or no gate, 0 if detected and gated |
| G_time | Time of day matches clue requirement OR clue has no time gate | 1 if time matches or no gate, 0 if wrong time |
| G_progression | Required thread state met OR clue has no progression gate | 1 if progression met or no gate, 0 if blocked |

**Expected output:** 0 (blocked) or 1 (accessible).
**Example:** Physical clue with combat gate + stealth gate. Player is not in combat (G_combat=1) but detection level = 60 (G_stealth=0). A_clue = 1 × 0 × 1 × 1 = **0** (blocked).

---

**Formula 3 — Revelation Deferral Behavior**

The revelation deferral system polls for a safe delivery moment:

```
Every T_defer (5.0s):
  If bIsInCombat = true → defer
  If DetectionLevel ≥ 25 → defer
  If bIsInDialogue = true → defer
  If bIsLoading = true → defer
  Otherwise → deliver revelation
```

**Variables:**

| Variable | Symbol | Type | Range | Source | Description |
|----------|--------|------|-------|--------|-------------|
| Deferral interval | T_defer | float | 5.0s | This GDD | Time between deferral checks |
| Combat state | bIsInCombat | bool | true/false | Combat System | Player in combat? |
| Detection level | DetectionLevel | float | 0–100 | Stealth System | Current global detection |
| Dialogue state | bIsInDialogue | bool | true/false | Dialogue System | Player in conversation? |
| Loading state | bIsLoading | bool | true/false | GSM | Loading transition active? |

**Expected behavior:** Revelation check runs every 5 seconds when pending. First clear moment triggers delivery. If player never reaches a safe moment, revelation remains pending indefinitely (intentional design — respects player agency).

## Edge Cases

| Scenario | Expected Behavior | Rationale |
|----------|------------------|-----------|
| **Player discovers final clue of a thread while in combat** | Thread reaches "Revealed" state internally, but revelation is deferred until combat ends (per Formula 3). Player receives no immediate notification. | Revelation delivery during combat would break tension and distract from survival. |
| **Player discovers final clue while stealth level = Alert** | Thread reaches "Revealed" state internally, revelation deferred until detection level drops to Hidden. | Revelation is a reflective moment — it requires the player to be in a safe state to process it. |
| **Player re-discovers a clue (re-reads document, re-triggers environmental observation)** | Clue already marked as discovered. No re-trigger. Context prompt still appears for physical clues (player can re-read). Environmental trigger zone does not re-fire. | Clues are persistent. Player can revisit and re-examine, but the discovery event fires only once. |
| **Player saves game with pending revelation** | Revelation state persists. On load, deferral check resumes. If conditions are clear on load, revelation delivers within 5 seconds. | Revelation should not be lost due to saving/loading. |
| **Clue object is destroyed by environmental damage (e.g., building collapse)** | Clue is auto-discovered before destruction. If the clue was undiscovered and the object is destroyed, the clue is marked as "Lost" — permanently unavailable. Thread can still be completed through alternative clues (threads have 1–2 optional clues). | Prevents soft-locks from environmental destruction. Optional clues ensure threads are completable even if some clues are lost. |
| **Survivor NPC is killed before player hears their testimony** | Testimony clue is marked as "Lost." Thread has optional clues to compensate. If the testimony was the only clue for a specific revelation fragment, that fragment is skipped in the synthesis. | Player choices have consequences. Killing an NPC can permanently lock investigation paths, but threads remain completable. |
| **Player has all clues for a thread but never triggers the revelation (avoids safe moments)** | Revelation remains pending indefinitely. No forced delivery. Player may never see the synthesized narrative if they never reach a safe moment. | Respects player agency. The revelation is earned but not forced. |
| **Two threads reach "Revealed" state simultaneously** | Both revelations queue. Delivered sequentially with 10-second gap between them. Player can dismiss the first to get to the second faster. | Prevents revelation overload. Player processes one revelation at a time. |
| **Player discovers clues out of intended order** | Thread progress updates regardless of order. Revelation synthesis adapts to the order in which clues were discovered (first-discovered clues are presented first in the synthesis). | Investigation is non-linear. The system accommodates player-driven discovery order. |
| **Clue trigger zone overlaps with combat encounter zone** | Environmental observation is gated by combat state. Player must clear combat before the clue can be discovered. Context prompt for physical clues in the area is suppressed during combat. | Maintains investigation tension — the player must survive before they can investigate. |

## Dependencies

**Hard Dependencies** (system cannot function without):
- **Player Controller** ✅ (designed) — routes IA_Interact to Investigation System for physical clue objects. Context prompt system is the primary discovery mechanism for physical clues.
- **Dialogue System** ✅ (designed) — provides survivor testimony clues. **MVP sequencing note:** Investigation System requires testimony clues from Dialogue System. Both systems must be implemented together for end-to-end testing.

**Soft Dependencies** (enhanced by but works without):
- **Stealth System** ✅ (designed) — provides detection level for clue accessibility gates. Without it, Stealth Gate is disabled (all clues accessible regardless of detection level).
- **Combat System** ✅ (designed) — provides combat state for clue accessibility gates. Without it, Combat Gate is disabled (all clues accessible during combat).
- **Scene Management** ✅ (designed) — provides time of day for time-gated clues. Without it, Time Gate is disabled.
- **HUD System** ✅ (designed) — renders thread tracker (Tactical mode) and revelation notifications. Without it, player has no UI feedback for thread progress (Immersive-only experience).
- **Save/Load System** (Not Started) — persists clue and thread state. Without it, investigation progress resets on every load.
- **Audio System** (Not Started) — plays investigation audio cues. **Sequencing risk:** investigation sound work (discovery chime, revelation chime) is blocked until Audio System is designed. Investigation visual elements can be implemented independently.

**Depended On By**:

| System | Interface Used | Expected Behavior |
|--------|---------------|-------------------|
| Dialogue System | Thread state for dialogue gating | Dialogue options unlock based on investigation progress |
| Quest System | Clue discovery state, thread state | Quest objectives reference investigation milestones |
| Lore/Journal System | Discovered clues, revelations | Journal populates with discovered clue content and revelation syntheses |
| HUD System | Thread updates, revelation events | Renders thread tracker and revelation delivery UI |
| Save/Load System | Investigation state data | Persists and restores all investigation data |

## Tuning Knobs

| Parameter | Default | Safe Range | Effect of Increase | Effect of Decrease |
|-----------|---------|------------|-------------------|-------------------|
| `EnvObservationFaceAngle` | 30° | 15°–60° | Easier to trigger environmental observations | Must aim more precisely at anomaly |
| `EnvObservationHoldTime` | 2.0s | 1.0–5.0s | Shorter observation required, faster discovery | Longer observation, more deliberate |
| `EnvObservationRadius` | 200–500cm | 100–800cm | Larger trigger zone, easier to stumble into clues | Smaller zone, must be very close |
| `RevelationDeferralCheck` | 5.0s | 2.0–15.0s | More frequent checks, faster revelation delivery | Less frequent, longer wait |
| `RevelationGap` | 10.0s | 5.0–30.0s | More time between sequential revelations | Revelations fire closer together |
| `RevelationReadTime` | 15–30s | 10–60s | Longer revelation text, more detail | Shorter, more concise revelations |
| `OptionalClueRatio` | 0.2–0.3 | 0.1–0.5 | More optional clues, more forgiveness for lost clues | Fewer optional clues, harder to miss |
| `CluesPerThreadMin` | 3 | 2–5 | Shorter threads, faster revelations | Longer threads, more investigation |
| `CluesPerThreadMax` | 6 | 4–10 | Longer threads, deeper investigation | Shorter threads, quicker payoff |
| `DiscoveryChimeVolume` | -18dB | -24 to -12dB | More noticeable discovery feedback | Subtle, may be missed |
| `RevelationChimeVolume` | -14dB | -20 to -10dB | More dramatic revelation moment | Subtle revelation delivery |

## Visual/Audio Requirements

### Clue Discovery Visual Feedback

| Clue Type | Visual | Duration | Notes |
|-----------|--------|----------|-------|
| **Physical Object (discover)** | Subtle screen flash (white, 5% opacity) | 0.2s | Only in Immersive mode. Tactical mode has no visual feedback (HUD handles it). |
| **Environmental Observation (discover)** | Subtle highlight on anomaly (material parameter, 10% brightness boost) | 1.0s then fades | Draws player attention to what they just noticed. |
| **Survivor Testimony (discover)** | No visual feedback | — | Dialogue delivery is the feedback. |

### Investigation Audio Cues

| Sound | Trigger | Description | Volume | Priority |
|-------|---------|-------------|--------|----------|
| **Discovery Chime** | Any clue discovered | Soft chime, ascending tone (C-E-G) | -18dB | Low |
| **Revelation Chime** | Revelation unlocked | Deeper chime, resolving chord (C-E-G-C) | -14dB | Medium |
| **Revelation Ambient Shift** | Revelation delivery starts | Ambient music crossfades to reflective tone | -20dB (music duck) | Medium |
| **Environmental Observation Cue** | Player faces anomaly for 1s (before discovery) | Subtle hum, rising pitch | -22dB | Low |

### Revelation Delivery Visual

| Mode | Presentation | Notes |
|------|-------------|-------|
| **Immersive** | Journal entry format — looks like the player's own handwriting on a page. Clue images embedded as "sketches." | Diegetic — the player is writing in their journal. |
| **Tactical** | Structured report format — clean UI with clue list, thread name, synthesis text. | Information-dense — player can scan quickly. |

## UI Requirements

| Element | Mode | Position | Update Frequency | Condition |
|---------|------|----------|-----------------|-----------|
| **Thread tracker** | Tactical only | Pause menu, Investigation tab | On clue discovery | Shows thread name, clue count (e.g., "Immunity Cause: 3/5"), progress bar |
| **Revelation notification** | Both modes | Center screen overlay | On revelation delivery | "You've pieced together the truth about [thread name]" + synthesis text |
| **Clue content display** | Both modes | Center screen overlay (physical clues) | On clue interaction | Document text, terminal UI, recording player |
| **Discovery chime indicator** | Tactical only | Brief icon flash (top-center) | On clue discovery | Small magnifying glass icon, 1.0s fade |

## Cross-References

| This Document References | Target GDD | Specific Element Referenced | Nature |
|--------------------------|-----------|----------------------------|--------|
| Context prompt routing for physical clues | `design/gdd/player-controller.md` | IA_Interact routing, ContextTraceLength (500cm), OnClueInteracted | Data dependency |
| Combat state for clue accessibility | `design/gdd/combat-system.md` | bIsInCombat flag, ECombatState, GetCurrentCombatState() | Rule dependency |
| Detection level for clue accessibility | `design/gdd/stealth-system.md` | GetCurrentDetectionLevel(), Hidden state (0–24) | Rule dependency |
| Survivor testimony via dialogue | `design/gdd/dialogue-system.md` (Not Started) | DialogueNodeId, [CLUE:ClueId] tag, testimony delivery | Data dependency |
| Thread tracker in Tactical HUD | `design/gdd/hud-system.md` | OnThreadUpdated(), OnRevelationUnlocked(), pause menu Investigation tab | Data dependency |
| Time of day for clue gating | `design/gdd/scene-management.md` | GetTimeOfDay(), zone state | Rule dependency |
| Revelation persistence | `design/gdd/save-load-system.md` (Not Started) | SaveInvestigationState(), RestoreInvestigationState() | Data dependency |

## Acceptance Criteria

**Core Rules:**

- **GIVEN** player approaches physical clue object within 500cm, **WHEN** context prompt appears and player presses IA_Interact, **THEN** clue content is presented, clue marked as discovered, `OnClueDiscovered` fires, thread progress updates.

- **GIVEN** player enters environmental observation trigger zone and faces anomaly within 30° for 2s, **WHEN** hold time completes, **THEN** clue marked as discovered, `OnClueDiscovered` fires, subtle highlight plays on anomaly for 1.0s then fades.

- **GIVEN** player selects dialogue option tagged with `[CLUE:ClueId]`, **WHEN** NPC delivers testimony, **THEN** clue marked as discovered, `OnClueDiscovered` fires.

- **GIVEN** thread has 5 total clues and player discovers clue #1, **WHEN** thread state is queried, **THEN** state = Suspected, progress = 0.2 (1/5).

- **GIVEN** thread has 5 total clues and player discovers clue #3, **WHEN** thread state is queried, **THEN** state = Confirmed, progress = 0.6 (3/5).

- **GIVEN** thread has 5 total clues and player discovers clue #5 (final), **WHEN** thread state is queried, **THEN** state = Revelation, progress = 1.0 (5/5), `OnRevelationUnlocked` fires.

- **GIVEN** revelation is pending and player is in combat (bIsInCombat = true), **WHEN** deferral check runs, **THEN** revelation is NOT delivered. Check re-runs every 5s until combat ends.

- **GIVEN** revelation is pending and player is in Hidden stealth state (detection < 25), **WHEN** deferral check runs, **THEN** revelation delivers within 5s.

- **GIVEN** player has combat-gated clue and is in combat, **WHEN** player approaches clue object, **THEN** context prompt does NOT appear. Clue is inaccessible.

- **GIVEN** player has stealth-gated clue and detection level = 60 (Alert), **WHEN** player enters trigger zone, **THEN** environmental observation does NOT trigger. Clue is inaccessible.

- **GIVEN** two threads reach "Revealed" state simultaneously, **WHEN** revelations queue, **THEN** first revelation delivers, 10s gap, second revelation delivers. Player can dismiss first to accelerate.

- **GIVEN** player discovers clues in non-intended order (clue #3 before #1), **WHEN** revelation delivers, **THEN** synthesis presents clues in discovery order (#3 first, then #1 when discovered).

**Formulas:**

- **GIVEN** Formula 1 (thread progress), **WHEN** thread has 5 clues and 3 are discovered, **THEN** P_thread = 3/5 = 0.6.

- **GIVEN** Formula 2 (clue accessibility), **WHEN** clue has combat gate + stealth gate, player not in combat (G_combat=1) but detection = 60 (G_stealth=0), **THEN** A_clue = 1 × 0 × 1 × 1 = 0 (blocked).

- **GIVEN** Formula 3 (revelation deferral), **WHEN** revelation pending at T_now=100.0s, combat ends at T=103.0s, **THEN** next deferral check at T=105.0s finds combat clear, revelation delivers at T=105.0s.

**Edge Cases:**

- **GIVEN** clue object is destroyed by environmental damage while undiscovered, **THEN** clue marked as "Lost," thread marks it as unavailable, optional clues compensate. Thread remains completable.

- **GIVEN** survivor NPC is killed before player hears testimony, **THEN** testimony clue marked as "Lost." If testimony was optional (IsOptional=true), thread remains completable through remaining clues. If testimony was required (IsOptional=false), thread cannot reach 100% — revelation never fires. Each MVP thread has exactly 1 optional clue to prevent soft-locks.

- **GIVEN** player re-discovers a previously discovered clue (re-reads document, re-triggers environmental observation), **WHEN** interaction occurs, **THEN** clue content is presented again (player can re-read), but `OnClueDiscovered` does NOT fire, thread progress does NOT update.

- **GIVEN** two threads reach "Revealed" state simultaneously, **WHEN** deferral checks run, **THEN** first revelation delivers, 10s gap, second revelation delivers. Player can dismiss first to accelerate second.

- **GIVEN** player saves with pending revelation, **WHEN** game loads and conditions are clear, **THEN** revelation delivers within 5s of load completion.

- **GIVEN** investigation state is saved with 3/5 clues discovered in T_origin, **WHEN** game is loaded, **THEN** thread state = Confirmed, progress = 0.6, all 3 discovered clues remain marked as discovered.

- **GIVEN** player has all clues for a thread but avoids all safe moments for 30 minutes, **THEN** revelation remains pending indefinitely. No forced delivery.

## Open Questions

| # | Question | Owner | Deadline | Resolution |
|---|----------|-------|----------|-----------|
| OQ-1 | Should the player be able to "pin" or "favorite" specific clues for quick reference in the pause menu? | game-designer | GDD review | |
| OQ-2 | Should environmental observations have a subtle visual indicator (e.g., faint glow) to guide new players, or should they be completely invisible until the player notices them? | game-designer | Playtest | |
| OQ-3 | Should the revelation synthesis include audio narration (voice-over reading the synthesis) or text-only? | audio-director | Audio system design | |
| OQ-4 | How many conspiracy threads should exist beyond MVP? Full vision estimate needed for architecture planning. | game-designer | Architecture phase | |
| OQ-5 | Should clue objects have a "new" indicator (e.g., subtle glow) to help players identify undiscovered clues in an area they've already explored? | game-designer | Playtest | |
| OQ-6 | Should the Investigation System support multiplayer co-op investigation (shared clue discovery, collaborative deduction)? | game-designer | Post-MVP | Deferred to Post-MVP. Single-player only for MVP. |

---

## Design Review Findings

> **Date**: 30 April 2026
> **Reviewer**: design-review skill
> **Verdict**: PASS (with corrections — all resolved below)

### Completeness
- **8/8 CLAUDE.md sections** present and substantive
- **8/8 design-system sections** present and substantive
- Bonus sections: Dependencies, Visual/Audio Requirements, UI Requirements, Cross-References, Acceptance Criteria (Gherkin), Tuning Knobs (11 parameters)

### Issues Found & Resolved

| # | Issue | Severity | Status | Resolution |
|---|-------|----------|--------|------------|
| 1 | Typo "CludeId" in 5+ places | Must Fix | ✅ Resolved | Bulk replaced with "ClueId" throughout |
| 2 | Thread state mismatch (Rule 3: 4 states vs State Machine: 5 states) | Must Fix | ✅ Resolved | Rule 3 updated to include Revelation state (pending delivery) |
| 3 | Clue data structure not defined | Must Fix | ✅ Resolved | Added Rule 7 — full clue data structure with 12 fields |
| 4 | Revelation authoring format unspecified | Must Fix | ✅ Resolved | Added Rule 8 — revelation Data Table format with 4 fields |
| 5 | Optional clues not marked in MVP thread table | Should Fix | ✅ Resolved | Each thread now marks 1 optional clue (20-25% ratio) |
| 6 | Dialogue System not flagged as MVP sequencing blocker | Should Fix | ✅ Resolved | Dependencies table updated with explicit blocker note |
| 7 | Formula 3 is behavioral, not mathematical | Should Clarify | ✅ Resolved | Reframed as polling behavior with pseudo-code |
| 8 | Missing AC for save/load, re-discovery, simultaneous revelations | Should Fix | ✅ Resolved | Added 4 new acceptance criteria |

### Minor Notes (not blockers)
- All clues contribute equally to thread progress (no weighting). This is an intentional design decision — stated in Rule 3's thread progress formula.
- Revelation delivery is never forced — player could complete game without seeing syntheses. This is intentional (respects player agency) — stated in Formula 3 and Edge Cases.
- Single-player scope explicitly stated in Rule 9.

## Progression & Depth

The Investigation System does not unlock new mechanics over time — clue discovery works the same from the first clue to the last. However, the player's **investigation skill** evolves through mastery:

### Investigation Mastery Curve

| Phase | Player Behavior | Investigation Experience |
|-------|----------------|-------------------------|
| **First hour** | Reads every document, examines every anomaly, talks to every survivor. Follows context prompts. | Investigation feels guided — context prompts lead to clues. Player learns the three clue types. |
| **3–5 hours** | Actively searches for clues, reads environmental cues, asks survivors specific questions. Notices patterns. | Investigation becomes self-directed. Player learns to spot environmental anomalies without prompts. |
| **10+ hours** | Predicts clue locations, cross-references clues between threads, deduces conspiracy connections before revelations fire. | Investigation is a core skill. The player is solving the conspiracy actively, not passively receiving revelations. |

### Deferred Investigation Content (Vertical Slice and beyond)

| Feature | Current State | Deferred To | Rationale |
|---------|--------------|-------------|-----------|
| Clue photographs | Not designed | Vertical Slice | Player can "photograph" clues for later reference in journal |
| Multi-thread deductions | Not designed | Vertical Slice | Revelations that require clues from 2+ threads to unlock |
| Investigation difficulty modes | Not designed | Alpha | Easy mode highlights clues, Hard mode removes all indicators |
| Co-op investigation | Not designed | Post-MVP | Shared clue discovery, collaborative deduction |
| Clue trading between players | Not designed | Post-MVP | Asynchronous multiplayer — share clues with other players' games |
