# Game State Machine

> **Status**: Designed (pending design-review)
> **Author**: user + agents
> **Last Updated**: 26 April 2026
> **Implements Pillar**: Foundation — enables all pillars

## Overview

The Game State Machine (GSM) is the central orchestrator of the game's operational modes. It defines what state the game is in at any moment — Title Screen, Loading, Playing, Paused, Cutscene, Dialogue, Inventory, Game Over — and manages all transitions between them. The GSM is pure infrastructure: a state machine backed by a priority stack, with no direct player interaction but profound player-facing consequences. Every other system — Input, Camera, HUD, Save/Load, Combat — reads the GSM state to know how to behave. When the player presses ESC, the GSM pushes Paused onto the stack and the world freezes. When a cutscene starts, the GSM transitions to Cutscene and Input, HUD, and Camera all respond accordingly.

ADR-0002 documents the implementation pattern: `UHostileWorldGSM` is implemented as a `UGameInstanceSubsystem` (single instance per game session) that also implements `FTickableGameObject` for queue drain. This ownership survives level transitions, which a GameMode-owned component would not.

**Key design decisions:**
1. **Priority Stack**: Multiple states can coexist (e.g., Paused during Dialogue). A stack with priority levels resolves conflicts.
2. **State-driven system responses**: Each system subscribes to GSM state changes and adjusts behavior accordingly.
3. **Single authoritative source**: The GSM is a `UGameInstanceSubsystem` (per ADR-0002); one instance per game session, accessed via `GetGameInstance()->GetSubsystem<UHostileWorldGSM>()`. All state queries go through it.
4. **Event-driven transitions**: States don't poll — they react to discrete events (input, trigger, timer, system signal).

## Player Fantasy

The Game State Machine is the world's lungs — the invisible organ that makes Hostile World feel alive. When the player runs, the world breathes with them. When they pause, the mountain holds still. When they die, the world gasps. The player fantasy is not "the game responds to my inputs" — it is "I am inside a living world that breathes around me."

Every state transition is an inhale or exhale. The Title Screen is the world drawing breath before the player enters. Loading between areas is a heartbeat pulse — a WHOOSH of wind and machinery — the world inhaling to carry the player forward. Paused is not a frozen void — it is the world holding still, the mountain suspended mid-gust, the player catching their breath before the next surge. Game Over is not a black screen — it is a sharp, audible gasp, the terraforming glow pulsing once in the environment before the "Continue?" prompt lands. The player feels the architecture of their own emotions — anticipation at title, tension during play, the caught-breath of pause, the weight of failure in game over.

This fantasy directly serves **Pillar 1: Hostile World** — the world is alive and transforming — and reinforces the **immersive-first HUD philosophy**. Transitions feel like world events, not UI events. The GSM doesn't interrupt the player; it moves *with* them.

## Detailed Design

### Core Rules

**Rule 1 — Single Authoritative Source**
The GSM is implemented as `UHostileWorldGSM : public UGameInstanceSubsystem` (per ADR-0002). One instance per `UGameInstance`, surviving all level transitions — the `Loading` state spans level loads, which a GameMode-owned component cannot do because `AGameMode` is destroyed and recreated between maps. No other system maintains parallel state. All state authority flows from this single subsystem, accessed via `GetGameInstance()->GetSubsystem<UHostileWorldGSM>()`.

**Rule 2 — Event-Driven Transitions Only**
State changes occur in response to discrete events, never via polling. Events are queued and processed in order of receipt. No system may force a state change — it may only *request* one.

**Rule 3 — Transition Request Protocol**
Any system may *request* a transition via `RequestStateTransition(FSMEvent)`. The GSM validates the request against valid transitions for the current state. If valid: `Exit Current State → Transition Animation → Enter New State`. If invalid: request is logged and discarded.

**Rule 4 — State Exit/Entry Guarantees**
Exit fires before any transition animation begins. Entry fires after transition completes. Once exit begins, the transition runs to completion — no interruption mid-transition.

**Rule 5 — Priority Stack for Overlapping States**
The GSM maintains a LIFO stack. When a new state enters, it pushes. When a state exits, it pops. The top of the stack = active state. Only the top receives input. Higher priority = more restrictive = can interrupt lower.

**Rule 6 — Blocking vs. Interruptible States**
- **Blocking** (cannot be interrupted): Title, Loading, Cutscene, GameOver
- **Interruptible** (can be paused/inventory'd): Playing, Dialogue, Inventory, Paused

**Rule 6b — Combat Interruption of Interruptible States**
The trigger is the Combat System's `OnCombatEngaged()` event — i.e. player Combat Mode entry per Combat System Rule 5 (detection=100, player attacks an alien, or a patrol forces combat). GSM does **not** compute its own "engagement range"; it reacts to Combat's authoritative event. When `OnCombatEngaged()` fires while **Inventory** or **Paused** is active:
1. The Interruptible state is immediately popped from the stack
2. GSM transitions to Playing (0.1s fast transition, no animation)
3. IMC_Combat is pushed by Combat System (sole owner — GSM does not push it; see combat-system.md "IMC_Combat ownership")
4. Any UI associated with the interrupted state is closed immediately
5. World timescale (0.85x slow) is reset to 1.0x by the GSM transition
This bypasses the normal priority stack validation because combat engagement is a safety-critical override, not a normal state push.

**Dialogue is exempt from Rule 6b.** Dialogue (priority 30) is interrupted only when an alien reaches melee range, governed by Dialogue System Rule 7 — not by combat engagement at distance. This prevents a patrol at 1500cm from silently cancelling a conversation while the player is not yet in danger, and reconciles the prior engagement-range-vs-melee-range contradiction across GSM / Player Controller / Dialogue.

**Rule 7 — Subscription/Notification Model**
All systems subscribe via `SubscribeToStateChange(FStateChangeDelegate)`. Callbacks: `OnStateEntered`, `OnStateExited`, `OnTransitionStarted`. Subscribers must NOT trigger another state change during callback (reentrancy guard enforced).

**Rule 8 — Inhale/Exhale Transition Animation**
Fast transitions (Playing → Paused) = short exhale (~0.2s). Slow transitions (Title → Loading) = deep inhale (~1.5s). Loading state pulses at 1Hz like a heartbeat.

### States and Transitions

| State | Priority | Blocking? | Description |
|-------|----------|-----------|-------------|
| Title | 0 | Yes | Main menu / attract mode |
| Loading | 1 | Yes | Async asset loading with heartbeat pulse |
| Playing | 10 | No | Player control active — base state |
| Paused | 20 | Yes (input) | Player frozen, world holds still. Map System opens as a UI overlay within this state (no separate Map state). `IA_Map` hold toggles the map UI over the tactical HUD; IMC_Menu remains active throughout. |
| Cutscene | 25 | Yes | Non-interactive cinematic sequence |
| Dialogue | 30 | Yes (movement) | Conversation active, movement locked |
| Inventory | 35 | Yes (movement) | Equipment management, movement locked |
| GameOver | 100 | Yes | Death / failure — highest priority, world gasps |

*(FadingIn/FadingOut are transient transition states, not player-visible states)*

**State Transition Table (key transitions):**

| From | Event | To | Duration |
|------|-------|----|----------|
| *(boot)* | GameStart | Title | 0s |
| Title | StartGamePressed | Loading | 1.5s (deep inhale) |
| Loading | AssetsLoaded | Playing (via FadingIn) | — |
| Playing | ESC_Pressed | Paused | 0.2s (short exhale) |
| Playing | InventoryPressed | Inventory | 0.3s |
| Playing | DialogueStarted | Dialogue | 0.3s |
| Playing | CutsceneTriggered | Cutscene | 0.5s |
| Playing | PlayerDied | GameOver | 1.0s (sharp gasp) |
| Paused | ESC_Pressed | Playing | 0.2s |
| GameOver | RestartPressed | Loading | 1.5s |

**Priority Stack Resolution:**
When state B requests entry during state A:
- If priority(B) > priority(A): Push B onto stack (A preserved beneath)
- If priority(B) ≤ priority(A): Reject B (queued for when A exits)
- **GameOver exception**: Always wins regardless of priority — clears entire stack

**Stack Example:** Paused during Dialogue (priority 20 vs 30) — Paused request rejected while in Dialogue. ESC in Dialogue returns to Playing, then ESC pauses.

### Interactions with Other Systems

| System | Direction | Data Flow |
|--------|-----------|-----------|
| Input System | Reads GSM state | GSM broadcasts current state; Input System selects appropriate Input Mapping Context |
| Camera System | Reads GSM state | Camera mode changes per state (cinematic for Cutscene, free for Playing, locked for Dialogue) |
| HUD System | Reads GSM state | HUD visibility toggles per state; immersive-first means minimal HUD in Playing, none in Cutscene |
| Scene Management | Reads + writes | Scene Management requests Loading/Playing transitions; GSM notifies it of transition start/end |
| Save/Load System | Reads GSM state | Save disabled in Cutscene, GameOver; auto-save triggers at Loading state entry |
| Combat System | Reads GSM state | Combat disabled in Dialogue, Cutscene, Paused; GameOver interrupts combat |
| Health System | Writes GSM state | Player death event triggers GameOver transition |
| Dialogue System | Reads + writes | Dialogue requests Dialogue state; Dialogue end signals transition back to Playing/Paused |

## Formulas

**Formula 1 — State Priority Comparison**

The GSM uses a simple priority integer comparison for stack resolution:

`CanPush(newState, currentState) = priority(newState) > priority(currentState)`

**Variables:**

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| newState | S_n | int | 0–100 | Priority of state attempting to enter |
| currentState | S_c | int | 0–100 | Priority of current top-of-stack state |

**Output Range:** `true` if S_n > S_c (push granted), `false` if S_n ≤ S_c (push rejected)

**Example:** CanPush(Paused=20, Dialogue=30) → false. CanPush(Dialogue=30, Paused=20) → true.

**GameOver exception:** `if S_n == 100 then CanPush = true` regardless of S_c.

---

**Formula 2 — Transition Duration by Destination State**

Transition duration is determined by the *destination* state's "breath type":

`TransitionDuration(fromState, toState) = breathDuration(toState)`

| Breath Type | Destination State(s) | Duration | Feel |
|-------------|---------------------|----------|------|
| Deep Inhale | Title → Loading, GameOver → Loading | 1.5s | Anticipation |
| Standard | Playing ↔ Paused, Playing → Cutscene | 0.2–0.5s | Natural exhale |
| Heartbeat Pulse | Loading (persistent while active) | 1.0s cycle | World alive |
| Sharp Gasp | Any → GameOver | 1.0s + audio | Failure weight |
| UI Slide | Playing → Inventory/Dialogue | 0.3s | Responsive |

---

**Formula 3 — Transition Queue Processing**

When multiple transition requests fire in the same frame:

`ProcessedOrder = SortRequestsByPriority(Queue, DESC)`

All requests in a single frame are sorted by requesting state's priority, then processed sequentially. Rejected requests (priority too low) are dropped and logged.

**Example:** One frame: Combat requests Cutscene (priority 25), Dialogue requests Dialogue (priority 30). Queue sorted: Dialogue first (30 > 25), then Cutscene (25 > 10 Playing). Both processed.

---

**Formula 4 — Loading Heartbeat Intensity**

The Loading state's heartbeat pulse intensity scales with load speed:

`HeartbeatIntensity = clamp((BytesTotal / BytesLoaded) / LoadSpeedBaseline, 0.5, 2.0)`

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| BytesTotal | B_t | int | — | Total bytes to load |
| BytesLoaded | B_l | int | 0–B_t | Bytes loaded so far |
| LoadSpeedBaseline | L_sb | float | — | Reference load speed (dev tuning knob) |

**Output Range:** 0.5 (very slow load — heartbeat slow/quiet) to 2.0 (very fast load — rapid/loud heartbeat). Normal range: 1.0.

## Edge Cases

**If player presses ESC during Cutscene**: ESC event ignored or queued. Cutscene (priority 25) > Paused (20) — cutting away breaks narrative immersion. Queue the pause request; execute after Cutscene ends.

**If PlayerDied fires while in Paused**: Ignore immediately. Push to deferred event queue. On resume to Playing, process death after transition completes. Rationale: The "exhale" of unpause completes before the "inhale" of death.

**If Dialogue ends same frame Inventory opens via hotkey**: Inventory accepted. Inventory (priority 35) > Dialogue (priority 30) — numerically higher priority wins in stack. Dialogue exits, Inventory pushes immediately.

**If stack pop called when stack has only one state**: No-op. Log warning. Stack never goes below Title.

**If Loading completes mid-transition**: Discard mid-transition. Immediately transition to Playing. Skip intermediate states rather than queuing.

**If Paused → GameOver via death while Paused**: Process immediately. GameOver (priority 100) > 20. Death is existential — cannot be paused out of.

**If state callback triggers same-frame state change (reentrancy)**: Block reentrant changes within callback execution. Queue change, execute after all callbacks for current frame complete.

**If rapid button spam triggers state A→B→A→B in consecutive frames**: Accept all valid transitions. Last valid state wins at frame end. Log spam for QA.

**If system subscribes callback to state it already listens to**: No duplicate registration. Callback ignored.

**If PlayerDied fires during FadingOut transition**: GameOver takes precedence. Abort FadingOut, transition directly to GameOver.

## Dependencies

The Game State Machine has no upstream dependencies — it is a foundation layer system. All other systems depend on the GSM; the GSM depends on nothing.

**Depended On By** (downstream systems that read GSM state):

| System | Interface Used | Expected Behavior |
|--------|---------------|-------------------|
| Input System | `OnStateEntered(FGameplayTag)` | Switch Input Mapping Context on state change |
| Camera System | `OnStateEntered(FGameplayTag)` | Set camera mode per state |
| HUD System | `OnStateEntered(FGameplayTag)` | Show/hide HUD elements per state |
| Scene Management | `OnTransitionStarted` | Prepare next area during Loading state |
| Save/Load System | `OnStateEntered(FGameplayTag)` | Auto-save on Loading entry; disable save in Cutscene/GameOver |
| Combat System | `OnStateEntered(FGameplayTag)` | Disable combat in Dialogue/Cutscene/Paused |
| Health System | `RequestStateTransition(PlayerDied)` | Call to trigger GameOver |
| Dialogue System | `RequestStateTransition(DialogueStart/End)` | Request Dialogue state; receive return to previous |
| Tutorial System | `SubscribeToStateChange(FStateChangeDelegate)` | Mutes hint display in non-Playing states; resumes on Playing entry |
| Map System | `RequestStateTransition(Paused/Playing)` | Opens Paused for map overlay; restores Playing on close |
| Tutorial System | `SubscribeToStateChange(FStateChangeDelegate)` | Mutes hint display in non-Playing states; resumes hint eligibility on Playing entry |
| Map System | `RequestStateTransition(Paused/Playing)` | Triggers Paused on map open; requests Playing on map close |

**Interface Contract:**

```cpp
// GSM public interface (C++ sketch)
class IGameStateMachine {
    // State queries
    FGameplayTag GetCurrentState();              // Current top-of-stack state
    TArray<FGameplayTag> GetActiveStates();       // Full stack (for layered UI)
    bool IsStateActive(FGameplayTag State);      // True if State is anywhere in stack

    // Transitions (request only — GSM decides if valid)
    void RequestStateTransition(FFSMEvent Event);  // Queued, validated, processed

    // Subscriptions
    FDelegateHandle Subscribe(FStateChangeDelegate Callback);
    void Unsubscribe(FDelegateHandle Handle);
}
```

## Tuning Knobs

| Knob | Type | Default | Range | Effect if too high | Effect if too low |
|------|------|---------|-------|-------------------|-------------------|
| `BaseTransitionDuration` | float | 0.3s | 0.1–2.0s | Transitions feel sluggish, pacing breaks | Transitions feel jarring, no "breath" |
| `DeepInhaleDuration` | float | 1.5s | 0.5–3.0s | Long loads feel like standing still, immersion breaks | Anticipation weight lost, feels rushed |
| `SharpGaspDuration` | float | 1.0s | 0.3–2.0s | Death becomes tedious, players avoid failing | Death feels cheap, loses emotional weight |
| `HeartbeatPulseRate` | float | 1.0Hz | 0.3–2.0Hz | Heartbeat feels frantic, anxious | Heartbeat feels sluggish, world seems dead |
| `MaxStackDepth` | int | 8 | 4–16 | More overlapping states possible but complexity grows | Risk of state collisions, forced pops |
| `TransitionQueueMaxSize` | int | 16 | 4–64 | Memory overhead grows | Spam scenarios more likely to drop events |
| `ReentrancyGuardTimeout` | float | 0.1s | 0.05–0.5s | Deferred state changes may be too delayed | Reentrancy protection too aggressive |

## Visual/Audio Requirements

### Transition Animation Specs

| Transition | Duration | Screen Behavior | Curve |
|------------|----------|-----------------|-------|
| Deep Inhale (Title→Loading) | 1.5s | Vignette contracts full→pinhole→hold | EaseInOut-Quintic |
| Short Exhale (Playing↔Paused) | 0.2s | Letterbox pulse (3%), world freeze | EaseOut-Quad |
| Sharp Gasp (Any→GameOver) | 1.0s | Hard cut to 20% vignette, 2-frame flash, desaturation to 30%, screen shake | EaseIn-Expo |
| UI Slide (Playing→Dialogue/Inventory) | 0.3s | World slows to 0.85x, UI slides in, backdrop blur 0→4px | EaseOut-Cubic |

### State Visual Treatments

**Title:** Low vignette, ambient drifting particles, full color. The world drawing breath.

**Loading:** Vital monitor visual — vignette pulses at 72 BPM (resting HR), deep arterial red glow bleeds at screen edges, dust motes drift upward. NOT a spinner. Reference: TLOU2 loading screens (muted, grainy, intimate — not celebratory).

**Playing:** Full dynamic range, world kinetic, all HUD minimal (immersive-first).

**Paused:** World holds still — slight letterbox pulse (3%), ambient occlusion fades, world time scale drops to 0.0. Near-silence audio (world held at -24dB, not empty).

**Game Over:** Violent visual arrest — hard vignette snap to 20%, 2-frame white flash, instant desaturation to 30%, 0.3s screen shake. World closes in. No "YOU DIED" banner.

### Audio Requirements

| State | Primary Audio | Behavior |
|-------|---------------|----------|
| Title | Title_Ambient_Loop (drone, wind, distant machinery) | Persistent, patient |
| Loading | Heartbeat_loop (72 BPM, 40Hz fundamental, double-hit) | Crossfades from Title; crossfades to World on Playing entry |
| Playing | World_Ambient_Loop (wind, snow creak, distant war, footsteps) | Full dynamic range |
| Paused | World held at -24dB, no music | Near-silence — not empty; world "holding breath" |
| GameOver | Complete silence + Gasp_SFX (inhale 0.4s + ragged exhale 1.2s) | Hard stop all audio at frame 0; gasp layered over silence |

**State Transition Audio Mapping:**
- Title→Loading: Title fade out (0.5s), heartbeat fade in (0.5s)
- Loading→Playing: Heartbeat out (0.8s), world fade in (0.5s)
- Playing↔Paused: World duck fast (0.1s hold, 0.15s restore)
- Any→GameOver: HARD STOP all audio, Gasp_SFX plays, post-gasp weak pulse fades in

**Audio gag distinction:** Audio gasp = player sympathy (sharp intake, ragged release). Visual gasp = world's grip (sudden arrest, slow suffusion). They are NOT the same moment.

### Art Bible Alignment

- **Section: "The world is the antagonist"** — All GSM visuals use hostile color (arterial red, black compression). Nothing celebrates. Transitions are survival responses.
- **Section: "Immersive-first HUD"** — Loading = clinical vital monitor. GameOver = world closing in, no banner text.
- **Section: "Environmental storytelling"** — Loading particles are context: rising dust = escape, rising ember = mountain's heat.
- **Section: "Tension desaturation"** — GameOver desaturates to 30% on impact.

## UI Requirements

### State HUD Visibility

| State | HUD Visible | Input Mode | Notes |
|-------|-------------|-----------|-------|
| Title | Full menu | IMC_Menu | Mouse cursor active |
| Loading | Progress indicator only | IMC_Cutscene | Cursor hidden |
| Playing | Minimal (immersive-first) | IMC_Default/Stealth/Combat | Cursor hidden |
| Paused | Full tactical HUD | IMC_Menu | ESC toggles HUD visibility |
| Cutscene | None | IMC_Cutscene | Cursor hidden |
| Dialogue | Dialogue UI only | IMC_Dialogue | Limited movement |
| Inventory | Full inventory grid | IMC_Inventory | ESC pauses from inventory |
| GameOver | None | IMC_Cutscene | Cursor appears on restart prompt |

### HUD State Binding

The HUD System subscribes to `OnStateEntered(FGameplayTag)` from the GSM and applies visibility/mode rules per the table above. No polling — event-driven response.

### Pause Menu Special Case

When paused from within Inventory or Dialogue, the pause menu overlays on top rather than closing the sub-state. The GSM priority stack preserves Inventory/Dialogue beneath Paused (Inventory=35 > Paused=20, so Inventory stays active).

## Open Questions

**OQ-1: Title Screen — Auto-save or manual start?**
When the player boots fresh, do they land on Title and manually start, or does the system check for existing saves and offer Continue? Affects Title→Loading transition and auto-save trigger. **Owner**: Design + UX | **Target**: Pre-production

**OQ-2: Loading screen content — story/lore text during loading?**
The vital monitor concept is defined, but: lore text that scrolls? Loading tips? In-universe documents (prisoner records, transmission logs)? Environmental storytelling opportunity. **Owner**: Art + Narrative | **Target**: Art bible approval

**OQ-3: Attract/Demo mode — needed for Title state?**
AttractMode (priority 2) was proposed for demo playback after idle time. Does Hostile World need this? Consider: Steam/Epic storefront demos, kiosk scenarios. **Owner**: Production | **Target**: Scope decision

**OQ-4: Network/multiplayer — does GSM handle connection states?**
If Hostile World has any online component (leaderboards, future co-op), does the GSM own connection states (Connecting, Reconnecting, Disconnected)? Current design assumes offline. **Owner**: Architecture | **Target**: Engine setup or ADR

**OQ-5: Pause menu depth — sub-menus vs. overlay stack?**
When paused from Inventory, does the pause menu close Inventory and show full pause menu, or overlay on top? Current design assumes overlay (stack preserves Inventory beneath Paused). Needs UX validation. **Owner**: UX Design | **Target**: HUD UX spec

**OQ-6: Cross-system conflict — who owns the "world held still" audio?**
Does the GSM fire events that Audio subscribes to, or does Audio read GSM state each frame? Affects reentrancy guards and event ordering. **Owner**: Architecture ADR | **Target**: Before architecture design

**OQ-7: Platform variations — do any states behave differently on console vs. PC?**
PC uses ESC for pause; consoles use Start/Select. Does the GSM need platform-specific state behavior (console achievements pause clock, PC doesn't)? **Owner**: Platform | **Target**: Technical preferences

## UI Requirements

[To be designed]

## Acceptance Criteria

**GIVEN** GSM is in Title state, **WHEN** `RequestStateTransition(StartGamePressed)` is called, **THEN** GSM transitions to Loading with deep inhale animation (1.5s).

**GIVEN** GSM is in Playing (priority 10), **WHEN** `RequestStateTransition(ESC_Pressed)` is called, **THEN** GSM pushes Paused (priority 20) with short exhale (0.2s).

**GIVEN** GSM is in Playing, **WHEN** `RequestStateTransition(PlayerDied)` is called, **THEN** GSM transitions to GameOver (priority 100) with sharp gasp (1.0s).

**GIVEN** GSM is in GameOver, **WHEN** `RequestStateTransition(RestartPressed)` is called, **THEN** GSM clears stack and transitions to Loading (1.5s deep inhale).

**GIVEN** Dialogue (priority 30) is active, **WHEN** Paused (priority 20) requests entry, **THEN** GSM rejects request because 20 ≤ 30; pause queued for after Dialogue exits.

**GIVEN** Paused (priority 20) is active, **WHEN** `RequestStateTransition(PlayerDied)` fires, **THEN** GSM immediately pushes GameOver (100), clearing Paused beneath it, because GameOver always wins.

**GIVEN** multiple systems subscribe to `OnStateEntered`, **WHEN** GSM transitions, **THEN** all callbacks fire in order; no subscriber may trigger nested state change within callback (reentrancy guard blocks).

**GIVEN** GSM is in Cutscene, **WHEN** any frame queries `HUDSystem.GetVisibility()`, **THEN** HUD returns hidden.

**GIVEN** GSM transitions between states, **WHEN** `InputSystem.GetActiveMappingContext()` is queried, **THEN** returned IMC matches current state (IMC_Cutscene, IMC_Playing, IMC_Paused, etc.).

**GIVEN** a state requests an invalid transition (e.g., Playing → Loading), **WHEN** `RequestStateTransition(Loading)` is called, **THEN** GSM logs rejection and discards without executing.

## Open Questions

[To be designed]