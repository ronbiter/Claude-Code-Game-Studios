# UX Specification: Dialogue

> **Status**: Draft
> **Author**: ux-lead
> **Last Updated**: 2026-05-26
> **Screen / Flow Name**: `DialogueOverlay`
> **Platform Target**: PC (Keyboard/Mouse + Gamepad)
> **Related GDDs**: `design/gdd/dialogue-system.md`, `design/gdd/faction-reputation-system.md`, `design/gdd/quest-system.md`, `design/gdd/game-concept.md`
> **Related ADRs**: ADR-0001 (Cross-System Communication), ADR-0002 (Game State Machine), ADR-0003 (Enhanced Input), ADR-0016 (HUD System)
> **Related UX Specs**: `pause-menu.md` (NPC relationship tab), `hud-design.md` (subtitles, context prompts, interrupt warning)
> **Accessibility Tier**: Standard (WCAG 2.1 AA + screen reader support, colorblind-safe, focus management)

> **Note — Scope boundary**: Dialogue is a hybrid overlay — it renders over the live game world (not paused; world runs at 0.85x), reframes the camera, and uses screen-space UI anchored to the NPC. Treated as a screen spec per template guidance because it has discrete entry/exit, dedicated input context (`IMC_Dialogue`), and explicit state machine ownership in the Dialogue Subsystem.

---

## 1. Purpose & Player Need

**What player need does this screen serve?**

The dialogue overlay lets the player **talk to another human being who is alive in this world** — not click through a quest dispenser. When a player approaches a survivor, they need to feel like they are negotiating with a person who has their own fears, their own agenda, and their own memory of past meetings. The UI must convey: this NPC sees me, weighs me, and may or may not give me what I want. The player's frustration target — what we are designing against — is the "menu conversation" where you spam-click options to extract rewards. The Dialogue overlay is the primary social interface of Hostile World; if it feels like a vending machine, the entire conspiracy investigation loop collapses into chore-completion.

**The player goal** (what the player wants to accomplish):

Read the NPC's stance, choose words that move the relationship in the direction they intend, and either extract information / commitment / aid OR exit cleanly when the conversation goes wrong — all without losing situational awareness of the hostile world around them.

**The game goal** (what the game needs to communicate or capture):

Capture player choice events (`SelectChoice(ChoiceId)`) and route them to the Dialogue Subsystem so it can apply Trust/Fear/Knowledge deltas, fire clue discoveries to the Investigation System, trigger quest offers/turn-ins to the Quest System, and bridge to Faction Reputation via the immunity-reveal hook — while keeping the player visually anchored in the live world so Pillar 3 (Tense Survival) is never broken by a safe-bubble menu.

---

## 2. Player Context on Arrival

| Question | Answer |
|----------|--------|
| What was the player just doing? | Exploring or scavenging in a hostile zone, approached an NPC, saw the context prompt "Talk to [NPC Name]" appear within 200cm proximity. |
| What is their emotional state? | Moderate alert. World runs at 0.85x but does not pause — aliens may still be near. Player is choosing to slow down for social interaction at the cost of survival awareness. |
| What cognitive load are they carrying? | Medium-to-high. Tracking: (1) ambient threat in the world behind the NPC, (2) what they want from this NPC, (3) recall of past conversations / promises with this NPC, (4) which investigation thread this conversation may unlock. |
| What information do they already have? | NPC name (label above head), prior conversation memory (NPC greeting variant tells them their standing — "You again" vs "Good to see you"). They do NOT see Trust/Fear/Knowledge numbers during dialogue. |
| What are they most likely trying to do? | Three primary intents: (A) ask for information / testimony clues, (B) accept or turn in a quest, (C) build trust for future access. Secondary: trade, threaten, leave. |
| What are they likely afraid of? | (1) Picking a choice that damages the relationship irreversibly, (2) missing a clue or quest because they ended the conversation too early, (3) getting ambushed by aliens while their attention is on dialogue, (4) saying something that locks them out of a faction. |

**Emotional design target for this screen**:

Present and grounded — the player should feel like they are *talking to someone in a dangerous place*, not navigating a menu. Decisions should feel weighted but not paralyzing. The NPC owns the room; the UI is the player's translator, not the stage.

---

## 3. Navigation Position

**Screen hierarchy**:

```
Gameplay (Playing state)
  └── Dialogue Overlay (this screen — GSM Dialogue state, world 0.85x, IMC_Dialogue pushed)
        ├── Choice Hover Preview (sub-overlay, screen-space below wheel)
        ├── Quest Offer Inline Prompt (sub-overlay, appears on [QUEST:...] tagged node)
        └── Combat Interrupt Warning (terminal sub-state, exits overlay)
```

**Modal behavior**: Overlay-live — renders over the live game world; world continues at 0.85x time scale (`WorldSlowFactor`, owned by GSM). Movement input is locked (`IMC_Dialogue` priority +3 suppresses movement IMC). Camera is locked to OTS framing. Player cannot open Pause Menu while dialogue is active without first exiting the conversation (Esc opens "Leave" confirmation flow — see Section 7.2).

Dialogue is dismissable but commits all relationship and clue state at every node — there is no "discard conversation" path. The player can always select the Gray Leave choice to exit cleanly. The walk-away exit (>200cm for >10s) and combat-interrupt exits both commit partial state.

**Reachability — all entry points**:

| Entry Point | Triggered By | Notes |
|-------------|-------------|-------|
| Player approaches NPC + presses IA_Interact | Player Controller proximity (≤200cm) + IA_Interact, NPC is `Survivor`/`Faction Leader`/`Ambient`/`Terminal` type | Primary entry; gated by detection (<50), combat state (not in combat), NPC alive |
| Quest-system-driven turn-in prompt | Quest System sets `bIsTurnInReady = true` on quest-giver NPC; context prompt shows "Talk to [NPC] — Quest Ready" with gold dot | Same input path; turn-in node is auto-selected as first node after greeting |
| Forced narrative dialogue | Cinematic / scripted event calls `UDialogueSubsystem::StartDialogue(NPCId)` directly | Used for tutorial / story-critical first meetings; player cannot decline entry |

---

## 4. Entry & Exit Points

**Entry table**:

| Trigger | Source Screen / State | Transition Type | Data Passed In | Notes |
|---------|----------------------|-----------------|----------------|-------|
| Player presses IA_Interact within 200cm of NPC | Gameplay / Playing state | Overlay push — GSM transition to Dialogue (priority 30), `IMC_Dialogue` pushed, world to 0.85x, camera blend to OTS (0.5s) | `NPCId` (FName) | Standard path. Blocks if detection ≥50 (NPC refuses), if NPC is dead, or if combat active |
| Quest System turn-in trigger | Gameplay / Playing state | Same as above + `bPreloadTurnInNode = true` | `NPCId`, `QuestId` | Quest turn-in node loaded as immediate post-greeting branch |
| Scripted story dialogue | Cinematic / Story Event | Same as above + cinematic camera variant | `NPCId`, `ForcedEntryNode` | Cinematic mode may override OTS camera with bespoke framing; UI elements still anchored screen-space |
| Re-initiated dialogue within 30s of previous end | Gameplay / Playing state | Same as standard | `NPCId`, `bRecentReturn = true` | NPC plays shortened acknowledgment ("You just talked to me. What else?") per GDD Edge Case |

**Exit table**:

| Exit Action | Destination | Transition Type | Data Returned / Saved | Notes |
|-------------|------------|-----------------|----------------------|-------|
| Player selects Gray "Leave" choice | Gameplay / Playing state | Farewell line plays (full duration or skip-to-end), wheel fades out 0.15s, GSM → Playing (0.3s slide), camera blend to ThirdPerson (0.5s), `IMC_Dialogue` popped | Relationship state committed (already committed at each node), `OnDialogueEnded(NPCId, EEndReason::PlayerLeave)` fired | Cleanest exit. All deltas already persisted node-by-node |
| Player presses Esc / B (Back) | Gameplay / Playing state | Inline confirm: "Leave the conversation?" → on confirm, default farewell plays, then standard exit transition | Same as above with `EEndReason::PlayerBack` | Esc is NOT a hard quit — it triggers the same farewell path. Prevents accidental abort losing partial state |
| Player walks >200cm away for >10s | Gameplay / Playing state | Wheel fades after 10s timeout, default farewell plays at NPC position (subtitled), standard exit | `OnDialogueEnded(NPCId, EEndReason::WalkAway)` | If player returns within 10s, dialogue resumes from last node |
| Alien reaches melee range (≤150cm) | Gameplay / Playing state, then Combat | Wheel + subtitle dismissed in 0.15s, center-screen interrupt warning "We need to move!" flashes 1.5s, world resumes 1.0x, camera blend to ThirdPerson, `IMC_Dialogue` popped, `IMC_Combat` pushed | `OnDialogueEnded(NPCId, EEndReason::CombatInterrupt)`. No relationship delta from interrupted node | Safety override — GDD Rule 7 |
| NPC killed mid-dialogue | Gameplay / Playing state | Wheel + subtitle dismissed instantly (no fade), camera blend to ThirdPerson | `OnDialogueEnded(NPCId, EEndReason::NPCDied)`. Relationship state lost per GDD. Pending clues from this NPC marked "Lost" | No farewell. The death is the notification |
| Save/Load mid-dialogue | Same Dialogue overlay on resume | Save commits current node + per-conversation deltas. On Load, overlay re-enters at saved node | Conversation state restored; greeting NOT replayed | Per GDD Edge Case + AC |

---

## 5. Layout Specification

### 5.1 Wireframe

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│                       [LIVE WORLD — 0.85x speed]                        │
│                       (alien patrol visible far back)                   │
│                                                                         │
│                                                                         │
│                       ┌──────────────────────┐                          │
│                       │   Sarah Chen         │   ← NPC NAME LABEL       │
│                       │   The Tethered  •    │     (faction tag +       │
│                       └──────────────────────┘     quest dot if ready)  │
│                                                                         │
│                            { NPC sprite/model }                         │
│                            (camera OTS frame)                           │
│                                                                         │
│                                                                         │
│                                    ╱──╲                                 │
│                                  ╱  1   ╲     ← RADIAL WHEEL            │
│                                ╱ ●        ╲     (semi-circle, 180°,     │
│                              ╱   2     5    ╲    5 slots visible,       │
│                            │     3   4       │   anchored ~50cm right   │
│                              ╲              ╱    of NPC head, screen-   │
│                                ╲          ╱      space)                 │
│                                  ╲      ╱                               │
│                                    ╲──╱                                 │
│                                                                         │
│                  ┌───────────────────────────────────────┐              │
│                  │  HOVER PREVIEW                        │              │
│                  │  "What did you see when the           │   ← Below    │
│                  │   outbreak started?"                  │     wheel    │
│                  │  [Trust requirement: 30 — met ✓]      │              │
│                  └───────────────────────────────────────┘              │
│                                                                         │
│   { player shoulder/back — OTS frame }                                  │
│                                                                         │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │  Sarah: "I was at the bakery when the first one came             │   │  ← SUBTITLE
│   │  through the window. Eyes white as bone."                        │   │     (bottom-
│   │                                                       [Sarah]    │   │     center,
│   └─────────────────────────────────────────────────────────────────┘   │     both modes)
│                                                                         │
│   [Hold E / A to advance]   [Esc / B to leave]                          │  ← INPUT HINT BAR
└─────────────────────────────────────────────────────────────────────────┘

LEGEND:
  ●  = current focus / hovered choice (segment brightened +20% luminance)
  1-5 = numbered choice slots (keyboard 1-5 binds)
  Choice color by category:
    Blue  = Ask/Info       Green = Help/Ally      Yellow = Trade/Negotiate
    Red   = Threaten       Gray  = Leave/End
```

### 5.2 Zone Definitions

| Zone Name | Description | Approximate Size | Scrollable? | Overflow Behavior |
|-----------|-------------|-----------------|-------------|-------------------|
| NPC Name Label Zone | Above NPC head, world-space anchored. Shows NPC name, faction tag (small), quest-ready dot (gold) / available dot (green) / unavailable dot (gray) | ~200×40px screen projection | No | Truncate name with ellipsis at 24 chars; faction tag truncates at 18 chars |
| Radial Wheel Zone | Screen-space anchored ~50cm offset right of NPC head (projected). Semi-circle 180° arc, 5 visible slots, 5–8 max stored | ~240×240px | Yes — stick rotation / mouse wheel scrolls by 1 choice; no wrap | Choices beyond visible 5 indicated by small arc-edge scroll arrows; 0.1s slide animation per scroll step |
| Hover Preview Zone | Below radial wheel (screen-space), follows wheel position | ~360×80px, 2 lines max | No (text wraps to 2 lines max, then truncates with "…") | If localized text exceeds 2 lines: font shrinks to 90% min, then ellipsis |
| Subtitle Zone | Bottom-center, fixed screen position | Full width minus 240px margins, ~120px tall (3 lines max) | No | Long lines split across 3 subtitle frames, each displayed sequentially; auto-advances with audio |
| Input Hint Bar Zone | Below subtitle, full width, small text | Full width, ~28px tall | No | Hints prioritized: Advance > Leave > (mode-specific extras like "Hold Tab for choice details") |
| Quest Offer Inline Prompt | Center-screen card that appears on `[QUEST:...]` tagged choice selection (Accept/Decline confirmation) | ~480×200px | No | Description text scrolls vertically if exceeds card height |
| Interrupt Warning Zone | Center-screen, terminal overlay (only on combat interrupt) | ~600×120px | No | Fixed string "We need to move!" — localization slot has fixed-width budget per Section 13 |

### 5.3 Component Inventory

| Component Name | Type | Zone | Purpose | Required? | Reuses Existing Component? |
|----------------|------|------|---------|-----------|---------------------------|
| `WBP_DialogueRadialWheel` | Compound widget (semi-circle of segments) | Radial Wheel | Renders 5 visible choice segments with category color, hover state, selected pulse | Yes | No — new component, dialogue-specific |
| `WBP_DialogueChoiceSegment` | Arc button | Radial Wheel | One choice on the wheel: label, category color, focus/hover/disabled/locked states | Yes | No — new |
| `WBP_DialogueHoverPreview` | Text + meta panel | Hover Preview | Shows full choice text (1-2 sentences) + gate status in Tactical mode | Yes | No — new |
| `WBP_NPCNameLabel` | World-anchored text + dot | NPC Name Label | NPC name + faction tag + status dot (quest-ready/available/unavailable) | Yes | Yes — extends existing `WBP_WorldLabel` from HUD spec |
| `WBP_DialogueSubtitle` | Subtitle frame + speaker tag | Subtitle | Renders one line of NPC speech with speaker name tag | Yes | Yes — shares `WBP_Subtitle` component from HUD spec, with `bShowSpeakerTag = true` |
| `WBP_DialogueInputHints` | Icon + label row | Input Hint Bar | Shows context-relevant input prompts (Advance, Leave, etc.) | Yes | Yes — reuses `WBP_InputHintRow` from HUD spec |
| `WBP_DialogueScrollIndicator` | Arc-edge arrow | Radial Wheel | Indicates more choices available above/below the visible 5 | Yes | No — new |
| `WBP_QuestOfferPrompt` | Card overlay with Accept/Decline buttons | Quest Offer Inline Prompt | Confirms quest acceptance/decline when player selects a `[QUEST:...]` choice | Yes | Yes — derives from `WBP_ConfirmDialog` (HUD spec) |
| `WBP_DialogueInterruptWarning` | Flash + text overlay | Interrupt Warning | Combat interrupt visual: red flash + "We need to move!" line | Yes | Yes — reuses `WBP_FlashWarning` from HUD spec |
| `WBP_DialogueLockedChoiceTooltip` | Tooltip on disabled segment | Radial Wheel | Tactical-mode only: shows why a choice is locked (Trust gate / Thread gate / etc.) | Yes | Yes — reuses `WBP_Tooltip` from HUD spec |
| `WBP_DialogueQuestReadyDot` | Small icon | NPC Name Label | Gold dot indicating quest is ready to turn in | Yes | Yes — from Quest System UI Requirements |

**Primary focus element on open**: After the NPC greeting line completes, focus lands on **the first visible choice segment in the radial wheel** (top of the semi-circle, clockwise from 12 o'clock). If the conversation is a turn-in flow with an auto-selected first-node, focus lands on the first choice of the post-turn-in node. If only one choice exists (forced path), it is still focused — never auto-selected.

---

## 6. States & Variants

| State Name | Trigger | What Changes Visually | What Changes Behaviorally | Notes |
|------------|---------|----------------------|--------------------------|-------|
| **Entering** | GSM transition to Dialogue begins | Camera blends to OTS (0.5s), world slows to 0.85x, NPC name label fades in (0.2s), wheel hidden, subtitle hidden | All inputs except cancel locked during 0.5s blend | Cancel during blend (Esc held) aborts entry, returns to gameplay |
| **Greeting** | Entering completes; NPC plays greeting line | NPC name label visible, subtitle renders greeting text incrementally (matches voice line), wheel still hidden | Advance input (E/A/Enter) skips text to end of line | Greeting variant chosen by Formula 3 (FirstMeeting / RecentReturn / Hostile / etc.) |
| **Wheel-Idle (NPC speaking)** | Greeting complete OR player just selected a choice, NPC delivering response | Subtitle renders incrementally, wheel hidden during multi-line NPC delivery | Advance skips current subtitle line; if more lines queued, next line begins; if NPC turn complete → transitions to Choice-Active | When NPC response is single-line and short (<1.5s), system auto-advances to Choice-Active without requiring input |
| **Choice-Active** | NPC turn complete, player must choose | Wheel slides up (0.2s) into screen-space anchor near NPC head; choices populate with category colors; first choice auto-focused; hover preview shows focused choice's full text | Player can navigate (D-Pad / arrows / mouse hover), scroll (stick / mouse wheel), select (A / Enter / left-click / number keys 1-5), or leave (B / Esc) | Default state during interactive dialogue |
| **Choice-Hover** | Player navigates focus to a choice | Focus ring on segment, segment brightens +20% luminance, hover preview updates to show full choice text and (Tactical only) gate status | Player can confirm (A / Enter / click) or move to another choice | Hover preview update is instant (no fade) for snappy navigation |
| **Choice-Locked (Tactical)** | A choice on the wheel fails its gate check (Trust/Thread/Flag/Context) | Segment renders desaturated + lock icon overlay; on focus, hover preview shows reason: "Requires Trust ≥ 60" / "Not safe to discuss here" / "Investigate further first" | Selection input on locked choice plays soft "denied" tick, no advancement | Tactical mode only |
| **Choice-Hidden (Immersive)** | A choice on the wheel fails its gate check | Segment simply does not exist in the wheel | Wheel renders only the available choices; locked choices are absent | Immersive mode default per GDD topic availability rule (A_topic = 0 hides) |
| **Choice-Selected** | Player confirms a choice | Selected segment pulses (1× brightness flash, 0.15s), then wheel fades down (0.15s); selected choice text briefly appears in subtitle zone as player's spoken line (if player-voice enabled — Alpha feature; for MVP, just choice fade) | Choice deltas applied: `TrustDelta`, `FearDelta`, `KnowledgeDelta`, flags set; `OnClueDiscovered` fires if `ClueTag` present; transitions to Wheel-Idle for NPC response | Deltas commit before NPC response begins |
| **Quest-Offer-Pending** | Player selected a choice tagged `[QUEST:QuestId]` | `WBP_QuestOfferPrompt` card overlays the wheel zone with quest name, summary, reward preview, Accept/Decline buttons | Wheel inputs suspended; only Accept/Decline + Back active | Accept fires `OnQuestAccepted(QuestId)`; Decline returns to Wheel-Idle. Distinct from normal choice because quest commitment is a discrete event with its own consequences |
| **Quest-Turn-In** | Player approached NPC with `bIsTurnInReady = true` | Wheel skips greeting variant; first post-greeting node is the turn-in dialogue. NPC name label shows gold dot before entry | Same as Wheel-Idle structurally; turn-in choice auto-included in first wheel population | Rewards dispensed on selecting "Hand over [item]" / "Report the news" style choice |
| **NPC-Only Node (no choices)** | Dialogue node has no choices (forced narrative beat) | Wheel hidden, subtitle scrolls multi-line NPC delivery, input hint shows only "Advance" and "Leave" | Advance input progresses to next node; no choice required | Used for cinematic monologue beats — kept short per GDD design intent |
| **Walk-Away-Paused** | Player exits 200cm radius while dialogue is active | Wheel fades out (0.15s), NPC plays idle "I'll wait" line (subtitled), countdown indicator appears subtly in input hint bar ("Returning in 10s") | 10s timer running; if player returns within 200cm → resume to Wheel-Idle at last node; if timer expires → default farewell, exit transition | Per GDD Rule 7 / Edge Case |
| **Combat-Interrupt** | Alien enters melee range (≤150cm) during dialogue | Wheel + subtitle dismissed in 0.15s; center-screen red flash + "We need to move!" overlay for 1.5s; world resumes to 1.0x; camera blends to ThirdPerson | All dialogue inputs disabled; combat IMC pushed; control returns to player at end of camera blend | `OnDialogueEnded(EEndReason::CombatInterrupt)` fired. No node delta applied for the interrupted turn |
| **NPC-Died** | NPC killed by alien / environment while dialogue active | Wheel + subtitle dismissed instantly, no fade; camera blend to ThirdPerson | Dialogue ends, relationship state lost, clues from this NPC marked "Lost" | No notification overlay — the death animation is the notification per GDD intent |
| **Refused-Entry-Hostile (Trust 0–20)** | Player initiates dialogue with NPC at Hostile Trust tier | Brief subtitle: "Go away." NPC name label visible, no wheel ever appears | Single line plays, then standard exit transition (0.3s slide, camera return) | Per GDD Rule 4 / Edge Case |
| **Refused-Entry-Terrified (Fear ≥ 80)** | Player initiates dialogue with NPC at Terrified Fear | Brief subtitle: "Please, just leave me alone." No wheel | Single line plays, then standard exit transition | Per GDD Rule 4 / Rule 10 / Edge Case |
| **Refused-Entry-Detection (det ≥ 50)** | Player initiates dialogue while detection ≥ 50 | Brief subtitle: "Not here, not now. It's too dangerous." NPC visibly tense (animation hook), no wheel | Single line plays, then standard exit | Per GDD Edge Case |
| **Recent-Return** | Player re-initiates within 30s of previous end | Greeting shortened ("You just talked to me. What else?"), wheel appears immediately after, same topic set as before | Same as Wheel-Idle | Per GDD Edge Case |
| **Loading (rare)** | Dialogue Data Table row asynchronously loading (e.g., streamed asset) | NPC visible, name label visible, subtitle shows "…" placeholder, wheel hidden | All inputs except Esc disabled | Should resolve in <250ms under normal conditions; if exceeds 1s, log warning |
| **Error (data missing)** | Dialogue node ID not found in Data Table | Subtitle: "[They look away, lost in thought.]" — diegetic fallback line. Wheel shows only Gray "Leave" choice | Player can only leave | Engineering must log node-miss error; player never sees a debug string |

---

## 7. Interaction Map

### 7.1 Navigation Inputs

| Input | Platform | Action | Visual Response | Audio Cue | Notes |
|-------|----------|--------|-----------------|-----------|-------|
| D-Pad Left/Right | Gamepad | Move focus to adjacent visible choice on the wheel | Focus ring slides to neighbor; hover preview updates instantly | Soft navigation tick (-24dB) | Wraps within the 5 visible choices |
| Left Stick rotation | Gamepad | Scroll wheel (reveal off-screen choices when >5 exist) | Wheel slides by 1 choice per stick threshold cross (0.1s slide); scroll indicators update | Soft scroll tick (-26dB) | No wrap at first/last choice (per GDD) |
| D-Pad Up/Down | Gamepad | Same as stick rotation — scroll wheel by 1 choice | Same as stick rotation | Same | Provides D-Pad-only navigation per Studio Standards (no analog requirement) |
| Arrow keys (Left/Right) | Keyboard | Move focus to adjacent visible choice | Same as D-Pad Left/Right | Same | |
| Arrow keys (Up/Down) | Keyboard | Scroll wheel by 1 choice | Same as D-Pad Up/Down | Same | |
| Mouse wheel scroll | Keyboard/Mouse | Scroll wheel by 1 choice per notch | Same as D-Pad Up/Down | Same | |
| Mouse hover (over segment) | Keyboard/Mouse | Set focus to hovered segment | Focus ring + +20% luminance brighten; hover preview updates | Soft hover tick (-26dB), debounced 80ms | Hover both focuses and previews — no separate states |
| Tab | Keyboard | Cycle focus between wheel segments (left-to-right order through visible 5) | Focus ring jumps to next; Shift+Tab reverses | Soft navigation tick | Provided for accessibility / standard keyboard expectations |

### 7.2 Action Inputs

| Input | Platform | Context (What must be focused) | Action | Response | Animation | Audio Cue | Notes |
|-------|----------|-------------------------------|--------|----------|-----------|-----------|-------|
| A button / Enter / Left-click | All | Choice segment focused (and choice is not locked) | Select choice | Segment pulses 1× (0.15s), wheel fades (0.15s), deltas applied, NPC response begins | Pulse + fade as described | Confirm click (-18dB) | If choice is `[QUEST:...]` tagged → transitions to Quest-Offer-Pending instead of immediate response |
| A button / Enter / Left-click | All | Locked choice focused (Tactical mode) | No advancement | Segment shakes 1× horizontally (4px, 0.12s); tooltip flashes brighter | Shake animation | Soft "denied" tick (-22dB) | Player learns the gate exists; no penalty |
| 1 / 2 / 3 / 4 / 5 (number keys) | Keyboard | Wheel visible (any state in Choice-Active) | Direct-select the Nth visible choice | Same as Enter on that segment | Same as Enter | Same as Enter | If number > visible choices, no-op (soft denied tick) |
| A button / Enter / Left-click / E | All | NPC speaking (Wheel-Idle, Greeting, NPC-Only Node) | Advance subtitle: first press completes current line text instantly + cuts voice audio with 0.15s fade; if line was already complete and another line is queued, plays next line; if no more lines and this is a choice node, transitions to Choice-Active | Subtitle text completes; voice fades | Soft advance tick (-20dB) | E is the IA_Interact reuse for keyboard; A/Enter for gamepad/keyboard standards |
| B button / Esc / Backspace | All | Any active dialogue state (not Quest-Offer-Pending) | Trigger Leave confirmation | Inline confirm card overlays wheel zone: "Leave the conversation?" with [Yes — Leave] / [No — Stay]; defaults focus to "No — Stay" | Confirm card slides in (0.12s) | Back tone (-18dB) | Yes-confirmed → plays farewell, exits per Section 4. No-cancel → returns to prior state instantly |
| B button / Esc | All | Leave confirmation visible | Cancel the leave (returns to prior state) | Confirm card fades (0.1s); prior state restored | Fade | Soft tick | Esc as cancel-of-cancel is standard pattern |
| B button / Esc | All | Quest-Offer-Pending visible | Cancel the offer (treat as Decline without applying penalty — returns to choice node) | Quest offer card fades, wheel returns to Choice-Active at the same node | Fade | Soft tick | Distinct from selecting "Decline" choice which may carry authored relationship cost |
| Y button / Tab (hold) | All | Any state with wheel visible (Tactical mode only) | Toggle expanded hover preview (shows: full choice text + all gate values + projected delta hints when authored) | Hover preview panel expands 1.5× height; additional metadata appears | Expand (0.12s) | Panel open tone (-22dB) | Tactical-mode accessibility / strategy feature. Immersive: no-op |
| Right stick / Right-click | All | Wheel visible | No-op (reserved — no context menu in dialogue) | None | None | None | Documented to prevent ambiguity. Future use reserved for "ask follow-up about" deferred feature |
| Any input | All | Combat-Interrupt state | Suppressed (no input does anything except being queued for post-combat) | None | None | None | 1.5s warning is non-interactive |

### 7.3 State-Specific Behaviors

| State | Input Restriction | Reason |
|-------|------------------|--------|
| Entering (camera blend) | Only Esc accepted (aborts entry) | Prevent input mis-fires while camera is in motion |
| Greeting / NPC-Only Node / Wheel-Idle (NPC speaking) | Only Advance and Leave active; choice navigation disabled (wheel hidden) | NPC turn — player cannot pre-select a choice that doesn't exist yet |
| Choice-Locked focus | Selection produces denied feedback only; navigation still works | Locked state must be legible without consuming the input |
| Quest-Offer-Pending | Only Accept, Decline, Esc-as-cancel active | Quest acceptance is a discrete decision with its own consequences; no concurrent dialogue navigation |
| Walk-Away-Paused | All inputs suppressed (player is outside 200cm); only re-entering 200cm restores inputs | Player physically left — no UI interaction valid |
| Combat-Interrupt | All inputs suppressed for 1.5s warning duration; then full gameplay input resumes | Safety override per GDD |
| Refused-Entry states (Hostile / Terrified / Detection) | Only Advance (to skip the refusal line) and Leave active; no wheel ever appears | NPC refuses — no choices to make |
| Loading | Only Esc active (cancels dialogue, returns to gameplay) | Cannot interact with un-loaded data |
| Error (data missing) | Only Leave choice active | Graceful degradation |

---

## 8. Data Requirements

| Data Element | Source System | Update Frequency | Who Owns It | Format | Null / Missing Handling |
|--------------|--------------|-----------------|-------------|--------|------------------------|
| Current dialogue node | `UDialogueSubsystem` | On node transition | DialogueSubsystem | `FDialogueNode` (FName NodeId, FText DialogueText, EDialogueNodeType, Speaker, Choices[], NextNode, ClueTag, deltas, gates, AudioLineId) | If node not found in Data Table → render Error state with diegetic fallback line. Never crash. |
| Available choices (filtered by gates) | `UDialogueSubsystem` (filters via `UNPCRelationshipSubsystem` + `UInvestigationSubsystem`) | On node entry, on relationship change mid-dialogue (rare) | DialogueSubsystem | `TArray<FDialogueChoice>` (ChoiceId, ChoiceText, HoverText, Category, TargetNode, deltas, Gates) — both available and locked-but-visible in Tactical mode | Empty array → wheel shows only Gray "Leave" (auto-injected by Dialogue Subsystem); never an empty wheel |
| NPC relationship state | `UNPCRelationshipSubsystem` (GameInstanceSubsystem, Session-tier) | On dialogue start (snapshot), on each choice committed (write-back) | NPCRelationshipSubsystem | `FRelationshipState` (NPCId, Trust 0–100, Fear 0–100, Knowledge 0–100, ConversationsHad, LastConversationTime, Flags, LockedTopics, UnlockedTopics) | If NPC has no relationship record → use defaults (Trust=30, Fear=10, Knowledge=0) and create the record on first dialogue |
| NPC identity (name, faction, type) | `UNPCDataSubsystem` (via NPC actor reference) | Once per dialogue (on start) | NPC system | NPCId, DisplayName (FText), FactionId, ENPCType | If FactionId is None → faction tag hidden in name label (still works for `Survivor`/`Ambient`/`Terminal` types) |
| Faction reputation (for floor-cap calculation) | `UFactionReputationSubsystem` | On dialogue start (snapshot) | FactionReputationSubsystem | int32 reputation [-100, +100] per faction | If faction system not present (soft dep) → no Trust floor applied; dialogue uses raw NPC Trust |
| Investigation thread states (for gate eval) | `UInvestigationSubsystem` | On dialogue start, on each choice (for gate re-eval) | InvestigationSubsystem | `TMap<FThreadId, EThreadState>` | If thread not started → treated as Locked state for gating purposes |
| Detection level (for entry gate) | `UStealthSubsystem` | On dialogue initiation attempt only | StealthSubsystem | float [0, 100] | If stealth system absent → assume 0 (always allow dialogue) |
| Combat state (for entry gate + interrupt) | `UCombatSubsystem` | Polled on entry; subscribed for `OnPlayerEnteredCombat` during dialogue | CombatSubsystem | `bIsInCombat` (bool), `IsPlayerUnderThreat()` | If combat system absent → never blocks/interrupts |
| Nearest alien proximity (for interrupt) | `UAlienAISubsystem` (broadcast) | Subscribed event `OnAlienEnteredMeleeRange(150cm)` during dialogue | AlienAISubsystem | Event payload includes AlienId, distance | If no aliens → never triggered |
| HUD mode (Tactical / Immersive) | `UHUDSubsystem` | On dialogue start (snapshot); does not change mid-dialogue | HUDSubsystem | enum {Tactical, Immersive} | Default to Tactical if undefined |
| Quest offer payload (if `[QUEST:...]` choice) | `UQuestSubsystem` | On choice selection | QuestSubsystem | `FQuestOffer` (QuestId, QuestName, Description, RewardPreview, Gates) | If QuestId not found in Quest Data Table → choice is hidden/locked at gate-filter time, never presented as broken |
| Quest turn-in readiness | `UQuestSubsystem` | On NPC proximity (200cm) before dialogue start | QuestSubsystem | bool per NPC | Drives gold dot on NPC name label |
| Player input mode (KB/Mouse vs Gamepad) | `UEnhancedInputUserSettings` / input subsystem | On any input device change | Input subsystem | enum | Drives Input Hint Bar icons (E vs A button glyphs) |
| Localized strings (NPC voice lines, choice text, hover text, system strings) | `ULocalizationSubsystem` (FText resolution) | On screen render | Localization subsystem | FText | If key missing → render the key string as fallback + log error |

> **Rule**: This screen reads from all systems above and writes ONLY through Dialogue Subsystem methods (`SelectChoice`, `EndDialogue`). It does NOT mutate Trust/Fear/Knowledge directly, does NOT mutate quest state, does NOT mutate investigation threads. All writes are mediated by `UDialogueSubsystem` per GDD interface contract and ADR-0001 cross-system communication rules.

---

## 9. Events Fired

| Player Action | Event Fired | Payload | Receiver System | Notes |
|---------------|-------------|---------|-----------------|-------|
| Player presses IA_Interact to start dialogue | `OnDialogueStarted` | `{NPCId: FName, EntryReason: EEntryReason}` | Dialogue Subsystem (handler), GSM (state request), Camera, Input | GSM transitions to Dialogue state; camera + input respond to GSM transition |
| Player selects a non-quest choice | `OnDialogueChoiceSelected` | `{NPCId, ChoiceId, NodeId}` | Dialogue Subsystem | Subsystem applies deltas, advances tree, fires downstream events |
| Player selects a clue-tagged choice | `OnClueDiscovered` (downstream from Dialogue Subsystem) | `{ClueId: FClueId, DiscoveryContext: EDialogue, SourceNPCId}` | Investigation Subsystem | Per GDD Rule 5 |
| Relationship deltas applied | `OnRelationshipChanged` (downstream from Dialogue Subsystem) | `{NPCId, Dimension: ETrust/Fear/Knowledge, OldValue, NewValue, Delta}` | NPC Relationship Subsystem (write); HUD (deferred notification — Tactical only, debounced after dialogue ends to avoid spam) | UI does NOT show live numeric deltas during dialogue per faction-visibility decision |
| Player selects a `[QUEST:...]` choice and confirms Accept | `OnQuestAccepted` | `{QuestId: FName, NPCId}` | Quest Subsystem | Per Quest GDD |
| Player selects Accept on a turn-in dialogue | `OnQuestTurnedIn` | `{QuestId, NPCId}` | Quest Subsystem | Per Quest GDD |
| First time player reveals immunity to a faction (per authored node flag) | `OnImmunityRevealed` | `{FactionId: FName}` | Faction Reputation Subsystem | Per Faction GDD Rule 8 — one-time +10 reputation |
| Player selects Leave / triggers walk-away / Esc-confirm | `OnDialogueEnded` | `{NPCId, EndReason: EPlayerLeave/WalkAway/CombatInterrupt/NPCDied}` | Dialogue Subsystem (cleanup), GSM (state pop), Camera, Input | Triggers exit transition |
| Player hovers a choice | `OnDialogueChoiceHovered` | `{ChoiceId}` | Analytics only | Used for playtest data: which choices are read but not selected |
| Player attempts to select a locked choice | `OnDialogueLockedChoiceAttempted` | `{ChoiceId, GateReason}` | Analytics only | Reveals frustration points / signals when gate-clarity needs improvement |
| Player triggers Leave confirmation | `OnDialogueLeaveConfirmShown` | `{NPCId, NodeId}` | Analytics only | Indicates conversation friction point |
| Quest offer card shown | `OnQuestOfferShown` | `{QuestId, NPCId}` | Analytics only | Funnel metric for quest acceptance rate |

---

## 10. Transition & Animation

| Transition | Trigger | Direction / Type | Duration (ms) | Easing | Interruptible? | Skipped by Reduced Motion? |
|------------|---------|-----------------|--------------|--------|----------------|---------------------------|
| Enter dialogue — UI slide | GSM transitions to Dialogue | Wheel hidden initially; NPC name label fade-in | 200 fade-in (label only) | Linear | No | Yes — instant fade |
| Enter dialogue — camera blend | GSM Dialogue state entered | Camera blend ThirdPerson → OTS | 500 | Smooth-step (Ease in/out) | No | No — camera blends must complete to avoid disorientation. Reduced Motion uses 100ms snap blend |
| Enter dialogue — world speed | GSM Dialogue state entered | World time 1.0 → 0.85x | 300 | Linear | No | No (gameplay effect, not visual decoration) |
| Greeting subtitle reveal | NPC begins greeting line | Per-character text typing matched to voice waveform; if no voice, 30 chars/sec | Per-line variable | Linear | Yes — Advance input completes line instantly | Yes — text appears fully on Reduced Motion (no typing effect) |
| Radial wheel appear | Choice-Active state entered | Slide-up from NPC head anchor + fade-in | 200 | Ease-out cubic | No | Yes — instant appear |
| Radial wheel scroll | Player scrolls (stick / mouse wheel / arrow) | Slide by 1 choice slot | 100 | Linear | Yes — next scroll cancels previous | Yes — instant slot change |
| Choice focus change (hover/navigation) | Player moves focus | Focus ring slide + segment +20% luminance fade | 80 | Ease-out | Yes | Yes — instant focus jump |
| Choice select — pulse | Player confirms a choice | Segment brightness pulse (100% → 140% → 100%) | 150 | Ease-out-back | No | No (tactile feedback, not decorative) |
| Choice select — wheel fade | After pulse | Wheel slides down + fade out | 150 | Ease-in | No | Yes — instant disappear |
| Locked choice shake | Player attempts a locked choice | Horizontal shake ±4px | 120 (3 oscillations) | Linear | No | Yes — no shake, single red border flash instead |
| Hover preview update | Focus change | Cross-fade text content | 80 | Linear | Yes | Yes — instant swap |
| Expanded hover preview (Tab/Y) | Player holds expand input | Height grow 1.0× → 1.5× | 120 | Ease-out | Yes (release reverses) | Yes — instant size change |
| Quest offer card appear | Player selects `[QUEST:...]` choice | Slide-in from below + fade + scale 0.95 → 1.0 | 150 | Ease-out | No | Yes — instant appear |
| Quest offer card dismiss | Accept / Decline / Cancel | Fade + scale 1.0 → 0.95 | 100 | Ease-in | No | Yes — instant |
| Walk-away wheel fade | Player exits 200cm | Wheel fade-out | 150 | Linear | Yes (return to 200cm restores) | Yes — instant |
| Combat interrupt — wheel/subtitle dismiss | Alien melee range | Instant cut (no fade) | 0 | N/A | No | No (gameplay-critical) |
| Combat interrupt — warning flash | Alien melee range | Red overlay flash 0% → 25% opacity → 0% + text fade | 1500 (3 pulses) | Linear | No | Reduced Motion: single 0% → 25% hold → fade, no pulses |
| Combat interrupt — world speed | Combat interrupt | World 0.85x → 1.0x | 200 | Linear | No | No |
| Camera return | Dialogue ends | Camera blend OTS → ThirdPerson | 500 | Smooth-step | No | Reduced Motion: 100ms snap |
| NPC name label fade-out | Dialogue ends | Fade | 200 | Linear | No | Yes — instant |
| Leave confirmation appear | Esc/B pressed | Slide-in + fade (centered over wheel) | 120 | Ease-out | No | Yes — instant |
| Leave confirmation dismiss (cancel) | Esc/B-as-cancel | Fade-out | 100 | Linear | No | Yes — instant |
| Refused-entry single line | Hostile/Terrified/Detection refusal | Subtitle reveal then standard exit | Per line + 300 exit slide | Linear | Yes (Advance skips line) | Yes — instant text + instant exit |

---

## 11. Input Method Completeness Checklist

**Keyboard**
- [x] All interactive elements (choice segments, Leave-confirm Yes/No, quest offer Accept/Decline, advance, scroll) reachable using Tab + arrow keys + Enter
- [x] Tab order: visible choice 1 → 2 → 3 → 4 → 5 → (cycles); from Choice-Active, Esc opens Leave-Confirm with focus on "No — Stay"
- [x] Every action achievable by mouse is also achievable by keyboard (number keys 1-5, arrow keys, Enter, Esc, E, Tab)
- [x] Focus is visible at all times — focus ring on choice segments uses 3px outer ring at high-contrast color, never disappears
- [x] Focus does not escape the screen — wheel is a focus trap during Choice-Active; subtitle / NPC name label are not focusable
- [x] Esc opens Leave-Confirm (does not close dialogue without confirm) and does not quit the game

**Gamepad**
- [x] All interactive elements reachable with D-Pad (Left/Right navigates wheel, Up/Down scrolls choices)
- [x] Face buttons: A = Confirm/Advance, B = Back/Leave-Confirm, Y = Expanded preview (Tactical), X = reserved/no-op; consistent with platform conventions
- [x] No action requires analog stick precision — D-Pad is sufficient for all navigation
- [x] Triggers (L2/R2) and bumpers (L1/R1) reserved — no current binding in dialogue (avoids conflicts with reserved gameplay slots; documented to prevent confusion)
- [x] Controller disconnect mid-dialogue: input mode switches to KB/Mouse if available; if not, Leave-Confirm auto-shows with "No — Stay" focused (player can reconnect and continue)

**Mouse**
- [x] Hover states defined for all segments and the Leave-Confirm / Quest-Offer buttons
- [x] Hit targets — choice segments at default radius render ~64×40px (exceeds 44×44 minimum)
- [x] Right-click is no-op (documented, reserved for future "ask follow-up" feature)
- [x] Mouse wheel scrolls choice list by 1 per notch

**Touch (if applicable)**
- N/A — PC-only target per `technical-preferences.md`. No touch support.

---

## 12. Screen-Level Accessibility Requirements

**Text contrast requirements for this screen**:

| Text Element | Background Context | Required Ratio | Current Ratio | Pass? |
|--------------|-------------------|---------------|---------------|-------|
| Choice phrase text on radial segment | Segment color (Blue #2196F3 / Green #4CAF50 / Yellow #FFC107 / Red #F44336 / Gray #9E9E9E) at 80% opacity over world | 4.5:1 minimum | Off-white #E8E4DC text — Yellow #FFC107 background fails (~3.0:1); must add 60% black underlay behind text on Yellow segments | [ ] — Yellow needs underlay fix |
| Hover preview text | Semi-transparent dark panel (#0A0A0A at 85% opacity) | 4.5:1 | Off-white #E8E4DC on #0A0A0A = ~16:1 | [x] Pass |
| Subtitle text | Semi-transparent dark backplate (#0A0A0A at 75% opacity, full-width strip) | 4.5:1 (NORMAL text) — but subtitles are LARGE text (18pt+) so 3:1 acceptable | Off-white #E8E4DC on backplate = ~15:1 | [x] Pass |
| NPC name label | Soft black drop shadow (4px blur, 80% opacity) directly on world | 4.5:1 against worst-case background (bright sky) | Off-white #E8E4DC with drop shadow — verify against bright outdoor scenes during implementation | [ ] TBD |
| Faction tag (under NPC name) | Same drop-shadow treatment | 4.5:1 | 75% opacity off-white over drop shadow — likely passes, verify at implementation | [ ] TBD |
| Locked choice tooltip text | Tooltip dark panel (#0A0A0A at 90% opacity) | 4.5:1 | Off-white on near-black — passes | [x] Pass |
| Input hint bar text and glyphs | Semi-transparent dark backplate (#0A0A0A at 70% opacity) | 4.5:1 | Off-white #E8E4DC on backplate | [x] Pass |
| Combat interrupt warning text "We need to move!" | Red flash overlay | 4.5:1 against worst-case red flash mid-frame | White #FFFFFF on red — depends on opacity at peak; specify text is rendered ABOVE flash layer with its own dark drop shadow | [x] Pass with required render order |
| Quest offer card title | Card background (#181818) | 4.5:1 | Off-white on near-black | [x] Pass |

**Colorblind-unsafe elements and mitigations**:

| Element | Colorblind Risk | Mitigation |
|---------|----------------|------------|
| Choice category colors (Blue/Green/Yellow/Red/Gray) | Deuteranopia & Protanopia confuse Green/Red; Tritanopia confuses Yellow/Blue | Each category gets a unique category glyph rendered inline on the segment: Blue = circle-with-question-mark (Ask), Green = open-hand (Help), Yellow = bag-of-coins (Trade), Red = clenched-fist (Threaten), Gray = arrow-out-door (Leave). Color is a REDUNDANT cue, not the sole indicator |
| Quest dot on NPC name label (gold = turn-in ready, green = available, gray = unavailable) | Multiple types | Add shape distinction: gold = filled circle, green = open circle, gray = empty dotted outline. Also include text tag on hover ("Quest Ready" / "Quest Available" / "No Quest"). |
| Locked choice indication | Reliance on desaturation alone is unsafe for some forms | Locked segments get a lock icon overlay in addition to desaturation |
| Trust/Fear/Knowledge dimension hints (Tactical expanded preview shows projected deltas) | Red (negative) / Green (positive) text | Use +/- prefix and ↑/↓ arrow glyphs alongside color |

**Focus order** (Tab key sequence, numbered):

```
On Choice-Active state, with N visible choices on the wheel:
  1. Choice segment 1 (top-most, 12 o'clock)
  2. Choice segment 2 (clockwise next)
  3. Choice segment 3
  4. Choice segment 4
  5. Choice segment 5
  → Tab from 5 returns to 1 (wraps within wheel)

Shift+Tab reverses the order.

NPC name label, subtitle, and input hint bar are NOT focusable — they are display-only.

On Leave-Confirm appearing, focus moves to "No — Stay" (default cancel position).
  Tab order in Leave-Confirm: [No — Stay] → [Yes — Leave] → [No — Stay]

On Quest-Offer-Pending, focus moves to "Decline" (safer default).
  Tab order in Quest-Offer: [Decline] → [Accept] → [Decline]
```

**Screen reader announcements for key state changes**:

| State Change | Announcement Text | Announcement Timing |
|--------------|------------------|---------------------|
| Dialogue enters | "Dialogue started with [NPC Name], [Faction Name]. [Greeting variant — e.g., 'They greet you cautiously']." | On Greeting state entry, after camera blend completes |
| NPC speaks a line | "[Speaker Name] says: [line text]." | On each subtitle line render |
| Wheel becomes available | "Choices available. [N] options. [Choice 1 text] focused." | On Choice-Active state entry |
| Focus moves to a choice | "[Category — e.g., 'Ask'] choice: [Choice 1 text]. [Locked / Available]. [Gate reason if locked]." | On focus arrival |
| Choice selected | "[Choice text] selected." | On selection confirm |
| Quest offer appears | "Quest offered: [Quest Name]. [Brief description]. Choose Accept or Decline. Decline focused." | On Quest-Offer-Pending entry |
| Walk-away pause begins | "You stepped away. Conversation pauses. Return within 10 seconds to resume." | On Walk-Away-Paused entry |
| Combat interrupt | "Combat alert. Conversation interrupted. Move now." | On Combat-Interrupt entry, before flash visual |
| Refused-entry | "[NPC Name] refuses: '[refusal line]'. Conversation ends." | On Refused-Entry states |
| Locked choice attempted | "Choice locked. [Gate reason]." | On locked-choice select attempt |
| Dialogue ends | "Conversation ended with [NPC Name]." | On Exit complete |

**Cognitive load assessment**:

Active streams during dialogue:
1. NPC subtitle text (what they're saying)
2. Wheel choice positions and labels (what player can say)
3. Hover preview (consequences of focused choice)
4. World threat awareness (residual — aliens still present in background, world at 0.85x)
5. Relationship recall (what player's prior promises/actions mean here)
6. Quest status (is this a turn-in opportunity? Is this offering a new quest?)

That is **6 concurrent streams** — at the upper edge of the 7±2 limit. Mitigations:
- Wheel limits visible choices to 5 (prevents over-options)
- Hover preview surfaces consequence text without requiring memorization
- Quest-ready signaling is consolidated into a single name-label dot (not a separate HUD element)
- World threat at 0.85x is intentionally not silenced — Pillar 3 (Tense Survival) demands the player carry that load; the design accepts the cost
- In Immersive mode, locked choices are hidden, reducing visible options to only what's available — reduces load by 1 stream
- Tactical mode's expanded preview (Tab/Y hold) is an opt-in surface for players who want maximum information, but it's never forced

Designed for: players in flow-state survival decision-making, not casual menu navigation. Pillar 3 explicitly accepts elevated cognitive load as part of the design intent.

---

## 13. Localization Considerations

**General rules for this screen**:
- All NPC dialogue, choice text, hover text, gate-reason strings, refusal lines, farewell variants, and UI labels driven by FText / localization tables
- Voice line audio is per-language asset (if voiced — OQ-1 from Dialogue GDD pending)
- Subtitle layout must tolerate +40% expansion (English → German baseline) and -25% contraction (English → Chinese / Japanese)
- RTL languages (Arabic, Hebrew) mirror wheel layout: semi-circle anchors LEFT of NPC head instead of right; hover preview anchors RIGHT-aligned text; subtitle right-aligns
- No text in textures — all strings render via FText

| Text Element | English Baseline Length | Max Characters | Expansion Budget | RTL Behavior | Overflow Behavior | Risk |
|--------------|------------------------|----------------|-----------------|--------------|-------------------|------|
| Choice phrase on segment | 3–6 words, ~18–35 chars | 40 chars | 14–122% | Right-aligned text within segment; wheel mirrors to NPC's left side | Truncate with "…" mid-text; full text always in hover preview | High — short phrases in English may double in German |
| Hover preview text | ~50–120 chars | 180 chars | 50–260% | Right-aligned, wraps right-to-left | Wraps to 2 lines max, then ellipsis; full text accessible via expanded preview (Tab/Y) | Medium — usually has room |
| NPC name label | ~10–20 chars | 28 chars | 40–180% | Right-anchored | Truncate with "…" at 24 chars; full name in tooltip on hover/focus | Low |
| Faction tag | ~8–18 chars | 20 chars | 11–150% | Right-anchored | Truncate at 18 chars | Low — faction names are short |
| Subtitle (single line) | ~40–60 chars | 90 chars per line, 3 lines per frame | 50–125% | Right-aligned, full RTL flow | Auto-line-break; if 3 lines exceeded, splits into multiple sequential subtitle frames | Medium |
| Speaker tag (in subtitle) | ~10–20 chars | 24 chars | 20–140% | Right-aligned with subtitle text | Truncate at 22 chars | Low |
| Gate reason tooltip ("Requires Trust ≥ 60", "Not safe here") | ~15–30 chars | 60 chars | 100–300% (numeric formatting required per locale) | Right-aligned | Wraps to 2 lines max | Medium — numeric formatting per locale |
| Combat interrupt warning ("We need to move!") | 17 chars | 36 chars | 112% | Mirror layout, right-aligned | Font shrinks 90% min, then truncates — but the line should never exceed 36 chars in any locale (loc team brief) | Low — short line by design |
| Refusal lines ("Go away.", "Not here, not now.", "Please, just leave me alone.") | 8–28 chars | 60 chars | 114–650% | Same as subtitle | Same as subtitle | Medium |
| Quest offer card title (Quest Name) | ~15–35 chars | 60 chars | 71–300% | Right-aligned | Truncate at 56 chars; full name in description | Medium |
| Quest offer description | ~80–200 chars | 320 chars | 60–300% | Right-aligned, wraps | Vertical scroll within card | Low |
| Input hint label ("Advance", "Leave", "Choice details") | ~5–14 chars | 24 chars | 71–380% | Right-anchored | Truncate at 22 chars; glyph remains | Medium — hint labels are short, expansion is significant |
| Leave-Confirm button labels ("Yes — Leave", "No — Stay") | ~10–11 chars each | 20 chars | 82–100% | Right-aligned within button | Truncate at 18 chars; full label in tooltip | Low |

---

## 14. Acceptance Criteria

**Performance**
- [ ] Dialogue overlay first frame visible (NPC name label + camera blend start) within **150ms** of IA_Interact press, on minimum-spec hardware
- [ ] Greeting subtitle line begins rendering within **600ms** of IA_Interact press (includes 500ms camera blend)
- [ ] Radial wheel becomes fully interactive within **300ms** of NPC greeting line completion
- [ ] No perceptible frame drop (target 60fps ±5fps) when wheel appears, scrolls, or wheel/world transition states change
- [ ] Subtitle rendering does not cause GC spikes — text typing uses pooled/cached widget allocations

**Layout & Rendering**
- [ ] Overlay displays correctly (no overlap, no cutoff) at 1920×1080, 2560×1440, 3840×2160
- [ ] Overlay displays correctly at 21:9 ultrawide (3440×1440) — wheel and subtitle remain within central safe-area, not pushed to extreme edges
- [ ] Overlay displays correctly at 16:10, 16:9, 4:3 PC aspect ratios
- [ ] NPC name label remains readable when NPC is at distance (auto-scaling per camera distance, min 12pt screen-projected)
- [ ] All 14 documented states (Section 6) render correctly without visual breakage
- [ ] No text overflow in English within max-character bounds (Section 13)
- [ ] No text overflow in German (longest expansion target) within defined max-character bounds
- [ ] No text overflow in Japanese (shortest-text edge case — no awkward whitespace)
- [ ] RTL layout (Arabic) mirrors correctly: wheel on left of NPC, hover preview right-aligned, subtitle right-aligned

**Input**
- [ ] All interactive elements reachable by keyboard alone (number keys 1-5, arrows, Tab, Enter, Esc, E)
- [ ] All interactive elements reachable by gamepad alone (D-Pad, A, B, Y for expanded preview)
- [ ] All interactive elements reachable by mouse alone (hover + click + scroll wheel)
- [ ] Focus remains visible at all times on keyboard and gamepad
- [ ] Focus is trapped within the dialogue overlay — does not escape to underlying gameplay HUD
- [ ] Number keys 1-5 select the corresponding visible choice; if fewer choices exist, the input is no-op with soft denied tick
- [ ] Esc opens Leave-Confirm; does NOT close the dialogue without confirmation
- [ ] Mouse wheel scrolls the radial wheel by exactly 1 choice per notch
- [ ] Controller disconnect mid-dialogue is handled gracefully (mode auto-switch or Leave-Confirm shown)

**Events & Data**
- [ ] All events in Section 9 fire with correct payloads on all triggering paths
- [ ] Overlay does NOT write directly to NPCRelationshipSubsystem, InvestigationSubsystem, QuestSubsystem, or FactionReputationSubsystem — verified by audit (no direct member access from UI code)
- [ ] All writes route through `UDialogueSubsystem::SelectChoice()` / `EndDialogue()`
- [ ] Relationship deltas committed at each choice selection (not at dialogue end) — verified by save-mid-dialogue + load test
- [ ] Clue discovery via tagged choice fires `OnClueDiscovered` exactly once per first discovery (no double-fire on duplicate clues)
- [ ] Quest acceptance via dialogue fires `OnQuestAccepted` exactly once per choice confirmation
- [ ] Save mid-dialogue → load restores: current node, applied deltas, conversation flags, greeting NOT replayed

**Accessibility**
- [ ] All text passes minimum contrast ratios specified in Section 12 (including Yellow segment fix with black text underlay)
- [ ] Choice category is communicated by glyph + color (not color alone)
- [ ] Quest dot status communicated by shape + color (not color alone)
- [ ] Locked-choice status communicated by lock icon + desaturation (not desaturation alone)
- [ ] Screen reader announces NPC name + faction on dialogue start, choice on focus, NPC line on subtitle render, exit on end (verify with NVDA + JAWS + platform reader)
- [ ] Reduced Motion setting: camera blends shorten to 100ms snap, wheel appear/disappear is instant, no shake animations, no warning flash pulsing
- [ ] Subtitle font size scales with system text-scale setting (90% – 200%)
- [ ] High Contrast mode (if Comprehensive tier ever adopted) — current Standard tier does not require this; document as deferred to Comprehensive uplift

**Localization**
- [ ] No text element overflows its container in any supported language at any supported resolution
- [ ] RTL layout (Arabic/Hebrew) renders correctly without manual artist intervention
- [ ] All text driven from FText localization tables — no hardcoded display strings (verified by code audit)
- [ ] Numeric formatting (Trust gate values, etc.) uses locale-aware formatting (commas vs. periods, Arabic numerals vs. Eastern Arabic)
- [ ] Voice line audio (if voiced per OQ-1) loads correct language asset per `ULocalizationSubsystem` setting

**State Coverage**
- [ ] All 6 GDD state-machine states (Idle, Greeting, Topic Selection, Branch, Farewell, Interrupted) verified
- [ ] All Refused-Entry states (Hostile Trust, Terrified Fear, Detection ≥ 50) verified — each plays exactly one refusal line and exits cleanly
- [ ] Walk-Away-Paused 10-second timer accurate to ±0.2s; player returns within window resumes at correct node
- [ ] Combat-Interrupt: wheel/subtitle dismiss within 0.15s of melee-range detection; warning flash 1.5s; world resumes 1.0x; input handed to combat
- [ ] NPC-Died mid-dialogue: instant dismiss, no farewell, relationship lost, clues marked Lost per GDD
- [ ] Save/Load mid-conversation: resumes at saved node with all per-conversation state intact

**GDD Acceptance Criteria Cross-Reference (from `dialogue-system.md` § Acceptance Criteria)**
- [ ] GIVEN player approaches NPC within 200cm, IA_Interact press → GSM Dialogue (0.3s), camera OTS (0.5s), IMC_Dialogue pushed, greeting plays, wheel appears
- [ ] GIVEN dialogue active, hover over choice → segment +20% luminance, hover preview text appears
- [ ] GIVEN choice selected → segment pulses, NPC response plays, deltas applied per Formula 1, wheel updates next
- [ ] GIVEN "Leave" selected → farewell, wheel fade 0.15s, GSM Playing (0.3s), camera ThirdPerson (0.5s), IMC popped, state saved
- [ ] GIVEN Trust = 15 (Hostile), initiate dialogue → "Go away." → exit
- [ ] GIVEN Trust = 70 (Trusting), initiate → Trusting greeting variant per Formula 3, all topics with req ≤ 70 visible
- [ ] GIVEN [CLUE:X] tagged choice → `OnClueDiscovered(X)` fires, Knowledge +10
- [ ] GIVEN gated topic, gates met → topic visible; gates unmet (Trust=40 vs ≥60) → topic absent (Immersive) or locked (Tactical)
- [ ] GIVEN detection = 60, initiate → refusal line, no dialogue start
- [ ] GIVEN dialogue active + alien 150cm → interrupt, warning, GSM Playing, combat starts
- [ ] GIVEN walk away >200cm for 10s → default farewell, state saved partial, exit
- [ ] GIVEN re-initiate within 30s → shortened greeting "You just talked to me. What else?"
- [ ] GIVEN two NPCs in 200cm range, IA_Interact → closest only

---

## 15. Open Questions

| Question | Owner | Deadline | Resolution |
|----------|-------|----------|-----------|
| Should the choice-category glyphs (Section 12 colorblind mitigation) be authored in the radial wheel from MVP, or deferred to a polish pass? Adding them at MVP is cheap (5 icons) but locks the design earlier. | art-director + ux-lead | Sprint planning for MVP UI | Recommend: ship with glyphs in MVP. Cost is low, accessibility value is high, and removing them later costs more than keeping them in. Pending art-director confirmation of icon style cohesion with HUD bible. |
| Quest-offer card position: overlay the wheel zone (center-screen) vs. dock below the wheel (preserves NPC visibility better but cramps subtitle zone)? | ux-lead + ue-umg-specialist | Before HUD implementation sprint | Current spec: center-screen overlay. Defer final position to first playtest with real quest content. |
| Tactical-mode expanded preview (Tab/Y hold): should it also show projected Trust/Fear/Knowledge deltas, or only gate status? Showing deltas helps strategy but may incentivize min-maxing (anti-Pillar-1 reactivity). | game-designer + ux-lead | Playtest of vertical slice | Default: show gate status only (legibility), hide deltas (immersion). Re-evaluate after playtest data on whether players want delta visibility. Tied to Faction GDD OQ-1 (numeric vs. tier visibility). |
| Subtitle speaker-tag styling: bracket the speaker name (e.g., `[Sarah]:`) or use a colored tag chip? Affects readability with multiple NPCs in future group conversations (deferred to Vertical Slice). | art-director | Vertical Slice group-conversation design | Defer. Current spec uses bracketed name; revisit when group conversations are designed. |
| When `OQ-1` from Dialogue GDD (voice acting vs. text-only) is resolved, does the subtitle typing speed change? Voiced dialogue ties typing to voice waveform; text-only uses 30 chars/sec. | audio-director + ux-lead | After OQ-1 resolution | Current spec covers both. No additional UX work required unless OQ-1 produces an unexpected outcome. |
| Should `OQ-3` from Dialogue GDD (timed choices) implementation use the wheel's outer arc as a countdown ring, or a separate timer element? Spec defines the state but not the visual treatment. | game-designer + ux-lead + art-director | If/when timed-choice mode is activated for a specific NPC | Deferred. Current spec defines the State (Timed Choice exists structurally) but timed mode is off by default per GDD OQ-3 resolution. |
