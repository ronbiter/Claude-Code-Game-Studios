# Tutorial System

> **Status**: In Review (pending approval)
> **Author**: user + agents
> **Last Updated**: 2026-05-19 (blocker revisions applied — ACTIVE state added, timer/re-sample specified)
> **Implements Pillar**: Pillar 2: Earned Discovery, Pillar 3: Tense Survival

## Overview

The Tutorial System is a progressive teaching layer that surfaces contextual, non-intrusive guidance across the full playthrough — anchored in the mountain prison opening zone and extending whenever the player first encounters a new mechanic in the open world. It operates in two stages: a **danger/threat event** primes each teaching moment precisely when the relevant threat or blocking condition becomes active (an enemy enters earshot, a locked door blocks the path, infection spreads into the zone); an **outcome predicate** per mechanic class then confirms the mechanic was successfully performed before retiring the hint. Prompts appear as brief, world-embedded callouts — a subtle outline and label attached to the relevant world actor via `UWidgetComponent`. No mode change, no "TUTORIAL" banner, no proximity-first timing. The system subscribes to the Game State Machine and mutes all hints during Cutscene, Dialogue, Inventory, Paused, and GameOver states. Players may disable the system entirely via Settings; there is no individual hint dismiss. Without the Tutorial System, first-time players enter the prison's lethal stealth-and-survival environment with no scaffolding — no opportunity to learn movement, detection, or resource management before the infection transforms the zone around them.

## Player Fantasy

> *`creative-director` not consulted — Lean mode. Review manually before production.*

The player never feels like they are being taught. They feel like they are *surviving.*

The prison is already hostile when the player enters. Movement prompts surface not because a tutorial begins, but because a locked door blocks the path. A stealth hint appears not as a lesson, but because a guard patrol comes within earshot. The world pressures the player into learning: the alternative to crouching is being seen, and the alternative to being seen is dying. Every mechanic is introduced at the moment when knowing it is the difference between survival and failure.

When the player performs the mechanic and the hint fades, the fade is the reward. The world recedes to reveal itself as learnable — not safe, but readable. By the time the infection hits and the prison collapses, the player doesn't feel coached. They feel like a mercenary who learned the terrain in the first ten minutes because they had to.

This system directly serves **Pillar 2: Earned Discovery** — the world teaches through resistance, never through handouts — and **Pillar 3: Tense Survival** — even the tutorial moments carry danger. The player earns competence by surviving the lesson.

## Detailed Design

### Core Rules

**Rule 1 — No Tutorial State in the GSM**
The Tutorial System operates exclusively within the `Playing` GSM state. No GSM state is added. The system is an overlay of behavior, not a mode.

**Rule 2 — Hint Lifecycle**
Every hint is defined by: a unique `HintID`, a Stage 1 trigger condition (danger/threat event), a Stage 2 completion predicate (per mechanic class, see Rule 11), and a persistent completion flag. A hint in state `COMPLETE` never activates again on that save file.

**Rule 3 — Danger-Coupled Two-Stage Activation**
Each hint activates in two stages:
1. **Danger/Threat (Stage 1):** A per-hint trigger event fires when a relevant threat or blocking condition becomes active — an enemy enters detection range, a locked door blocks the player's path, infection spreads into the zone, etc. Hints with no natural danger event use a designer-placed `ATutorialAnchorActor` with an authored `UTutorialTriggerVolume` as a fallback. Hint enters `PENDING`. Stage 1 fires in response to a *threat*, not to proximity alone.
2. **Outcome (Stage 2):** The hint's completion predicate is satisfied per the Completion Predicate Contract (see below). Hint enters `COMPLETE`.

A hint cannot skip to COMPLETE without first being PENDING — the threat must prime the moment before the outcome confirms it.

**Rule 4 — World-Space Callout Only**
Tutorial hints render exclusively as world-space callouts — a subtle object glow/outline plus a minimal label — attached to a world actor via `UWidgetComponent`. No screen-edge prompts, no HUD elements. The hint lives in the world, not on the UI layer. Callout is visible only while the hint is `ACTIVE`.

For **object-interaction mechanics** (doors, terminals, containers), the callout attaches to the interactable actor directly.
For **behavioral mechanics** (crouch, sprint, vault, stealth), the callout attaches to the nearest relevant cover geometry or a designer-placed `ATutorialAnchorActor` at the player's feet position at Stage 1 entry. Moving actors (guards, enemies) must never serve as callout hosts — the callout must remain stationary while PENDING.
For **multi-step mechanics** (crafting, lockpicking), the callout attaches to the station or object that initiates the sequence.

**Rule 5 — No Manual Dismiss**
The Tutorial System has no player-facing dismiss input. Hints complete exclusively via Stage 2 outcome confirmation. Players who want to suppress all hints globally use the `bTutorialEnabled` setting (see Rule 7). The `DISMISSED` state is removed — hints are either `COMPLETE` (earned) or `INACTIVE`/`PENDING`/`ACTIVE`/`MUTED` (in progress).

**Rule 6 — GSM Mute**
The Tutorial System subscribes to the GSM state change delegate. When the GSM exits `Playing` (entering Cutscene, Paused, Dialogue, Inventory, or GameOver), all `PENDING` and `ACTIVE` hints transition to `MUTED`. Active callouts hide. All trigger detection and the `MaxDangerEventStalenessSeconds` timer pause. On return to `Playing`, each `MUTED` hint restores to its pre-mute state — `ACTIVE` hints reshow their callouts, `PENDING` hints remain queued with no callout.

**Rule 7 — Global Disable (Output-Suppressed)**
A `bTutorialEnabled` player setting globally suppresses callout display and audio. The state machine continues running when disabled — hints still transition between states normally. When disabled: callouts do not spawn or display, audio does not play. Existing `PENDING` and `ACTIVE` hints retain their states internally. Re-enabling immediately makes all currently-`ACTIVE` hints visible without requiring Stage 1 to re-fire. `PENDING` hints remain queued with no callout — visible only after promotion.

**Rule 8 — Persistent Progress**
Completed hint IDs are written to the player's save profile via the Save/Load System (`FTutorialSaveData`). On load, the Tutorial System queries its save slot and initializes all matching hints as `COMPLETE`, skipping Stage 1 listener registration for them. Progress survives death and session restart.

**Rule 9 — Death/Reload Behavior**
On death or save reload, `PENDING` hints revert to `INACTIVE`. `COMPLETE` hints are preserved from the save file. After load, the Tutorial System performs a **spawn-within-volume check**: it evaluates whether the player's spawn position falls inside the bounds of any `INACTIVE` hint's trigger area. Any hint whose trigger area contains the spawn point immediately transitions to `PENDING` on the first tick — the player does not need to exit and re-enter the zone. This ensures death-based retry cycles do not silently break tutorial flow.

**Rule 10 — Progressive Unlock**
Hints have an optional `UnlockCondition` field (zone tag, quest flag, or mechanic flag). A hint with an `UnlockCondition` does not register its trigger volume until that condition is met. This enables game-wide progressive hints (e.g., the Crafting hint only activates when the Crafting mechanic first becomes accessible).

**Rule 11 — Completion Predicate Contract**
Every hint must declare its mechanic class. Stage 2 fires the class-appropriate completion event, not a raw input event:

| Mechanic Class | Stage 2 Fires When |
|---|---|
| Object-interaction (doors, terminals, containers, pickups) | Interaction succeeded: the interaction event fired **and** the object changed state (door opened, item added to inventory, terminal activated) |
| Behavioral-physical (crouch, sprint, vault, climb) | Action performed **while the Stage 1 threat condition is still active** (e.g., crouch input fires Stage 2 only while the triggering enemy is still within detection range) |
| Behavioral-combat (attack, dodge, stealth-kill, stealth-evade) | Action performed **and** outcome achieved (hit landed, kill confirmed, enemy unaware of player position) |
| Multi-step (craft, lockpick, hack) | **Final step** of the sequence completed (item crafted, lock opened, terminal hacked) — not the initiation input |

No hint may use raw input-event detection as its Stage 2 predicate. Each hint's content definition must specify its mechanic class and identify the exact UE event (delegate, gameplay event tag, or subsystem callback) that fires Stage 2.

---

### States and Transitions

| Hint State | Description |
|------------|-------------|
| `INACTIVE` | Not yet triggered. Stage 1 threat event not yet fired, or unlock condition not yet met. |
| `PENDING` | Stage 1 threat fired. Hint queued, awaiting promotion to a callout slot. No callout visible. |
| `ACTIVE` | Promoted from the `PENDING` queue (COUNT(ACTIVE) < N_max). World-space callout visible (if `bTutorialEnabled`). Awaiting Stage 2 outcome. |
| `COMPLETE` | Stage 2 outcome satisfied. Callout fades. Saved persistently. Terminal. |
| `MUTED` | GSM is not in `Playing` state. Callout hidden, `MaxDangerEventStalenessSeconds` timer paused. Remembers pre-mute state (`PENDING` or `ACTIVE`) and restores to it on return to Playing. |

**Transition Table:**

| From | Trigger | To |
|------|---------|-----|
| `INACTIVE` | Stage 1 threat/danger event fires AND hint not COMPLETE | `PENDING` |
| `INACTIVE` | Player spawns inside trigger bounds on load (spawn-within-volume check, Rule 9) | `PENDING` |
| `INACTIVE` | UnlockCondition flag set | Stage 1 listener registered (still `INACTIVE` until threat fires) |
| `PENDING` | COUNT(ACTIVE hints) < N_max — slot available at Stage 1 entry or on queue re-evaluation | `ACTIVE` |
| `ACTIVE` | Stage 2 completion predicate satisfied (Rule 11) | `COMPLETE` |
| `PENDING` or `ACTIVE` | GSM exits Playing | `MUTED` |
| `MUTED` | GSM returns to Playing | Pre-mute state (`PENDING` or `ACTIVE`) |
| `MUTED` | GSM transitions between non-Playing states | `MUTED` (no-op — only Playing entry triggers restore) |
| `PENDING` / `ACTIVE` / `MUTED` | Player dies or reloads | `INACTIVE` |
| `COMPLETE` | Any | (no transition — terminal state) |

---

### Interactions with Other Systems

| System | Direction | Data Flow |
|--------|-----------|-----------|
| Game State Machine | Reads (subscribe) | Tutorial subscribes to `OnStateEntered` / `OnStateExited`. Mutes/restores hints based on GSM state. Does not write to GSM. |
| Save/Load System | Reads + writes | `FTutorialSaveData` (set of completed HintIDs) is written on hint completion and loaded on game start. |
| Input System | Reads (observe) | Outcome predicate monitor listens for mechanic-class completion events (see Rule 11 Completion Predicate Contract). Does not consume input — Tutorial observes game events, not raw input. |
| HUD System | Conditional | World-space callouts are `UWidgetComponent` on world actors (primary path). When `bTutorialHintsScreenSpace` is enabled, Tutorial writes PENDING hint label text to a fixed HUD anchor via `ShowTutorialScreenLabel(FText)`. |

## Formulas

**Formula 1 — Callout Fade Duration**

The callout_fade_duration formula is defined as:

`T_fade = T_base + K_dist × clamp(D_complete / D_ref, 0.0, 1.0)`

**Variables:**
| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| Fade duration | T_fade | float | 0.30–0.60 s | Output: total fade duration |
| Base duration | T_base | float | 0.30 s (fixed) | Minimum fade duration |
| Distance bias | K_dist | float | 0.30 s (fixed) | Maximum additional time added by distance |
| Completion distance | D_complete | float | 0–600 cm | Player-to-object distance at the COMPLETE transition moment. Sampled when the Stage 2 predicate fires. Clamped to D_ref before evaluation — values beyond 600 cm produce T_fade = 0.60 s. |
| Reference distance | D_ref | float | 600 cm (fixed) | Same value as D_fade_max in Formula 4 — implemented as one shared constant `TutorialCalloutVisibilityRange`. |

**Output Range:** 0.30 s (close completion) to 0.60 s (far completion). Alpha curve: linear — no easing.

**Example:** Player completes hint at 300 cm from object: `0.30 + 0.30 × (300/600) = 0.45 s`

---

**Formula 2 — Trigger Proximity Radius**

The trigger_radius formula is defined as:

`R_trigger = clamp( (R_obj × K_scale) × M_density, R_min, R_max )`

**Variables:**
| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| Trigger radius | R_trigger | float | 150–500 cm | Output: sphere trigger volume radius |
| Object bounding radius | R_obj | float | 30–200 cm | Bounding sphere of the tutorialized object |
| Scale factor | K_scale | float | 3.0 (fixed) | Trigger fires ~3× object radius away |
| Density modifier | M_density | float | {1.0, 0.75, 0.55} | Open=1.0, Medium=0.75, Dense=0.55 |
| Minimum radius | R_min | float | 150 cm (fixed) | Player must get within 1.5 m |
| Maximum radius | R_max | float | 500 cm (fixed) | Never fires beyond 5 m |

**Density definitions:**
| Label | M_density | When to use |
|-------|-----------|-------------|
| Open | 1.0 | Exterior, large rooms, corridors >4 m wide |
| Medium | 0.75 | Standard interior rooms |
| Dense | 0.55 | Closets, overlapping-object clusters, trigger-rich areas |

**Output Range:** 150–500 cm. Designers may override per-object when geometry demands it.

**Example (workbench R_obj=60 cm, medium density):** `clamp((60×3.0)×0.75, 150, 500) = 150 cm`

---

**Formula 3 — Concurrent Hint Limit and Queue Priority**

Maximum simultaneously active hints: `N_max = 2` (tuning knob). All additional PENDING hints queue. Priority score at queue-entry time:

`P_hint = W_dist × (1 / D_player) + W_seq × (1 / SEQ_idx)`

**Variables:**
| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| Priority score | P_hint | float | 0.001–∞ | Output: relative priority (higher = promoted first) |
| Proximity weight | W_dist | float | 0.70 (fixed) | Weight for proximity to player |
| Distance | D_player | float | 1–1000 cm | Distance from player to object at PENDING entry |
| Sequence weight | W_seq | float | 0.30 (fixed) | Weight for designer-defined teaching order |
| Sequence index | SEQ_idx | int | 1–20 | Designer-assigned hint order (1 = first; default 10 if unset) |

**Promotion rule:** When `COUNT(ACTIVE hints) < N_max`, promote the highest-P_hint `PENDING` hint to `ACTIVE`. Re-evaluate on each `ACTIVE`→terminal transition. D_player is re-sampled from current player position at re-evaluation — proximity at the moment a slot opens determines which queued hint promotes next.

**Example:** Workbench (D=220, SEQ=1) P=0.303; Supply crate (D=95, SEQ=2) P=0.157; Campfire (D=180, SEQ=3) P=0.104. Workbench and Supply crate activate; Campfire queues until one clears.

---

**Formula 4 — Callout Visibility Falloff**

The callout_alpha formula is defined as:

`Alpha_callout = clamp( 1.0 − (D_player / D_fade_max)², 0.0, 1.0 )`

**Variables:**
| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| Callout opacity | Alpha_callout | float | 0.0–1.0 | Output: UWidgetComponent opacity |
| Player distance | D_player | float | 0–D_fade_max cm | Current distance from player to object |
| Max fade distance | D_fade_max | float | 600 cm (tuning knob) | Distance at which callout reaches alpha=0 |

**Output Range:** 1.0 at 0 cm; 0.0 at 600 cm. Quadratic curve: holds near-full opacity from 0–300 cm (Alpha ≥ 0.75 at 300 cm), then drops more steeply in the 300–600 cm range. The callout is still 51% visible at 420 cm and fully invisible only at 600 cm.

**Note:** `D_fade_max` (600 cm) must stay in sync with `D_ref` in Formula 1. Register as one shared tuning knob: `TutorialCalloutVisibilityRange`.

**Example:** Player at 420 cm: `1.0 − (420/600)² = 0.51` (51% opacity)

## Edge Cases

- **If a Stage 1 threat event fires while globally disabled (`bTutorialEnabled = false`):** The state machine processes the transition normally (INACTIVE → PENDING). No callout spawns, no audio plays. Output is suppressed; internal state advances.

- **If the player dies while a hint is `PENDING`:** Hint reverts to `INACTIVE` on reload. World-space callout is destroyed with the world on death. On load, the spawn-within-volume check (Rule 9) re-arms the hint immediately if the checkpoint is inside the trigger bounds. `COMPLETE` hints are unaffected.

- **If `D_player` reaches 0 cm (player clipping inside the object):** Formula 4 returns Alpha=1.0. No divide-by-zero — `D_player` in Formula 3 has a floor of 1 cm enforced at evaluation time.

- **If two hints have identical P_hint scores (tie in Formula 3):** Break tie by lower SEQ_idx. If SEQ_idx is also equal, break by HintID alphabetically — deterministic, no random jitter. Note: the default SEQ_idx of 10 maximizes tie probability — designers should set explicit SEQ_idx values to preserve teaching order.

- **If N_max concurrent hints are all active and a new Stage 1 event fires:** Excess hint queues as PENDING with no visible callout. Queue is unbounded. Designers must avoid building areas with more than `N_max × 4` concurrent Stage 1 triggers (QA gate — adjust if N_max is tuned from default of 2).

- **If the player encounters Stage 1 trigger for a `COMPLETE` hint:** No state change. Stage 1 listener is de-registered on COMPLETE and cannot re-fire.

- **If a `MUTED` hint's anchor actor is destroyed during the muted period (e.g., breakable object destroyed during cutscene):** On GSM return to Playing, Tutorial System checks actor existence. If destroyed: transition to `COMPLETE` (treated as if the player resolved it). Log a warning for level designers — tutorial anchor actors must not be destructible.

- **If `bTutorialEnabled` is toggled on mid-session after hints were suppressed:** All `INACTIVE` hints' Stage 1 listeners remain armed (the state machine was running while disabled). Previously suppressed `PENDING` hints become visible immediately. `COMPLETE` hints remain terminal.

- **If UnlockCondition flags fire for multiple hints in the same frame:** All unlock simultaneously. Each begins `INACTIVE` with trigger volumes registered. Formula 3 priority queue resolves concurrent activations normally.

- **If a hint's Stage 1 threat event fires while the threat is no longer active at evaluation time (race condition):** The hint enters PENDING as normal. `MaxDangerEventStalenessSeconds` controls how long a hint remains PENDING before expiring back to INACTIVE if Stage 2 is not satisfied. If the threat dissipated before the player could respond, the hint will expire and re-arm on next threat occurrence.

## Dependencies

### Hard Dependencies

| System | Interface Used | Why Required |
|--------|---------------|--------------|
| Game State Machine | `SubscribeToStateChange(FStateChangeDelegate)` | Tutorial mutes/restores hints based on GSM state. Non-Playing states suppress all hint display and trigger detection. |
| Save/Load System | `FTutorialSaveData` save slot | Completed HintIDs persisted per player profile. Without this, hints reset every session. |

### Soft Dependencies

| System | Interface Used | Degraded Behavior Without It |
|--------|---------------|-------------------------------|
| Input System (`IMC_Default`) | Outcome predicate observation (mechanic-class completion events) | If gameplay event observation is unavailable for a specific mechanic class, Stage 2 cannot fire for that hint type. Affected hints remain `PENDING` indefinitely until `MaxDangerEventStalenessSeconds` expires and the hint resets to `INACTIVE`. No fallback completion path — the mechanic must be observable for the hint to be usable. |

### Dependents (Systems That Depend on Tutorial)

None. The Tutorial System is terminal — no other system consumes its output.

### Cross-System Consistency Flags

- **GSM GDD** (`design/gdd/game-state-machine.md`): Does not currently list Tutorial System in its "Depended on by" table. Must be patched to include Tutorial.
- **Save/Load GDD** (`design/gdd/save-load-system.md`): Must register `FTutorialSaveData` (set of completed HintIDs) as a save slot owned by this system. See Save Payload table — patch required.
- **HUD System GDD** (`design/gdd/hud-system.md`): Must expose `ShowTutorialScreenLabel(FText)` / `HideTutorialScreenLabel()` interface when `bTutorialHintsScreenSpace` is enabled.

## Tuning Knobs

| Knob | Type | Default | Range | Effect if too high | Effect if too low |
|------|------|---------|-------|-------------------|-------------------|
| `TutorialCalloutVisibilityRange` (D_fade_max / D_ref) | float | 600 cm | 200–1200 cm | Callouts visible from across rooms — clutter and immersion break | Players miss callouts entirely — tutorial fails to teach |
| `TriggerScaleFactor` (K_scale in Formula 2) | float | 3.0 | 1.5–6.0 | Triggers fire from too far away — hints feel unearned | Player must be nearly on top of objects — discovery moment lost |
| `MaxConcurrentHints` (N_max in Formula 3) | int | 2 | 1–4 | Multiple callouts compete for attention — confusing, breaks tension | Single-hint limit may bottleneck learning in multi-object rooms |
| `CalloutBaseFadeDuration` (T_base in Formula 1) | float | 0.30 s | 0.1–0.8 s | Fade feels sluggish — UI lingers, immersion degrades | Fade is invisible — callout snaps away, feels like a glitch |
| `ProximityWeightW_dist` (W_dist in Formula 3) | float | 0.70 | 0.4–0.9 | Nearest object always wins — designer sequence intent overridden | SEQ_idx dominates — hints may fire far from where player is looking |
| `HintQueueMaxDepth` | int | 16 | 4–64 | Memory overhead grows; large zones may queue many hints | Queue drops events in hint-dense areas; silent tutorial failures |
| `MaxDangerEventStalenessSeconds` | float | 30.0 s | 5.0–120.0 s | Hints remain PENDING long after the threat has passed, breaking the survival moment | Hints expire before the player can act on them |

## Visual/Audio Requirements

### Visual Requirements

**World-Space Callout:**
- Object outline: thin rim highlight (2px screen-space width), color `#C8A84B` (amber/gold — distinct from hostile red used by infection/death systems)
- Glow falloff: billboard ambient glow at 0.3 intensity, 30 cm radius from object surface. Additive blend. Does not affect scene lighting.
- Label: single-line text, PT Sans 14pt, white, 70% opacity. No background panel, no border. Fades with Alpha_callout (Formula 4). Max 24 characters.
- Dismiss animation: outline fades, glow extinguishes. Duration per Formula 1.

**Anti-patterns (must not do):**
- No full-screen overlay or UI panel
- No directional arrow UI elements — world-space only
- No persistent beacon or particle emitter — callout must be subtle, not attention-grabbing
- No red or infection-palette colors — reserved for threat/health systems

### Audio Requirements

| Moment | Sound | Behavior |
|--------|-------|----------|
| Hint PENDING (callout appears) | `SFX_Tutorial_Appear` — soft low chime, ~0.3s | Plays once at PENDING entry. Volume 0.4. Not spatial — fixed screen-level playback. |
| Hint COMPLETE (action performed) | `SFX_Tutorial_Complete` — brief ascending 2-note tone, ~0.5s | Plays once at COMPLETE. Volume 0.6. Completing a hint is a small earned reward. |
| Hint `MaxDangerEventStalenessSeconds` expires (hint resets to INACTIVE) | No audio | Silent expiry — the threat passed before the player acted. The hint will re-arm on the next threat occurrence. |

> 📌 **Asset Spec** — Visual/Audio requirements are defined. After the art bible is approved, run `/asset-spec system:tutorial-system` to produce per-asset visual descriptions, dimensions, and generation prompts from this section.

## UI Requirements

The Tutorial System has no HUD or screen-space UI components. All callout rendering uses `UWidgetComponent` on world actors (world-space, not screen-space).

**Settings Integration:**
- `bTutorialEnabled` toggle in Accessibility / Gameplay settings. Label: "Tutorial hints". Description: "Show contextual hints when you encounter new mechanics for the first time." Default: On. Updates take effect immediately — no restart required.

**No dismiss input.** The Tutorial System does not bind any input. Hints complete via Stage 2 outcome only. Players who want to suppress hints use the `bTutorialEnabled` setting.

**Accessibility — Screen-Space Fallback:**
- `bTutorialHintsScreenSpace` option in the Accessibility settings section. Label: "Tutorial hints — screen position". Description: "Show tutorial hint text at the bottom of the screen in addition to the world display." Default: Off.
- When enabled: PENDING callout label text is mirrored to a fixed HUD anchor (bottom-center, 16pt PT Sans, 90% opacity, dark scrim background 30% opacity at 8px blur). The world-space callout remains active. This option does not replace world-space callouts — it supplements them.
- Minimum guaranteed label size: 16pt screen-space regardless of world distance. This satisfies the studio's accessible text standard.
- Color note: pending art director guidance on callout color (see OQ-6), the screen-space label uses white text which meets WCAG 2.1 AA contrast against the dark scrim background.

## Acceptance Criteria

### Core Rules

**GIVEN** a hint is `INACTIVE` and the player performs the associated mechanic before its Stage 1 threat event fires, **WHEN** the Stage 2 predicate fires, **THEN** the hint remains `INACTIVE` — Stage 2 cannot complete without Stage 1.

**GIVEN** a hint is `INACTIVE` and its Stage 1 threat/danger event fires, **WHEN** the trigger fires, **THEN** the hint transitions to `PENDING`. If a callout slot is available (COUNT(ACTIVE) < N_max), the hint immediately promotes to `ACTIVE` and a world-space callout appears at the hint's assigned anchor actor.

**GIVEN** a hint is `ACTIVE`, **WHEN** the Stage 2 completion predicate for its mechanic class is satisfied (Rule 11), **THEN** the hint transitions to `COMPLETE` and the callout begins fading.

**GIVEN** a hint is `COMPLETE`, **WHEN** the player re-encounters its Stage 1 trigger event, **THEN** no state change occurs and no callout spawns.

**GIVEN** the GSM transitions out of `Playing`, **WHEN** one or more hints are `PENDING` or `ACTIVE`, **THEN** all such hints become `MUTED` and active callouts disappear within one frame. Each hint's pre-mute state (`PENDING` or `ACTIVE`) is preserved for restoration.

**GIVEN** one or more hints are `MUTED`, **WHEN** the GSM returns to `Playing`, **THEN** each `MUTED` hint restores to its pre-mute state: hints that were `ACTIVE` reappear with callouts; hints that were `PENDING` restore as queued with no callout. The `SFX_Tutorial_Appear` audio event fires 0 additional times during restoration — audio event count remains unchanged from the moment of mute.

**GIVEN** hints are `MUTED` and the GSM transitions from one non-Playing state to another (e.g., Dialogue → Inventory), **WHEN** this transition occurs, **THEN** hints remain `MUTED` — only `Playing` entry triggers restore. No callout flickering occurs between non-Playing states.

**GIVEN** `bTutorialEnabled` is `false`, **WHEN** any hint's Stage 1 threat event fires, **THEN** the hint transitions to `PENDING` normally but no callout spawns and no audio plays. Internal state continues running.

**GIVEN** `bTutorialEnabled` is `false` and hint H is internally `ACTIVE`, **WHEN** the setting is re-enabled, **THEN** H's callout becomes visible without requiring Stage 1 to re-fire.

**GIVEN** a hint has an `UnlockCondition` not yet met, **WHEN** the player is in the physical space where Stage 1 would fire, **THEN** no hint fires — the Stage 1 listener is not registered until the condition is met.

**GIVEN** the player dies while hint A is `PENDING` or `ACTIVE` and hint B is `COMPLETE`, **WHEN** the game reloads the last checkpoint, **THEN** hint A is `INACTIVE`, hint B remains `COMPLETE`, and the count of live `UWidgetComponent` instances associated with tutorial callouts is 0 (verifiable via widget reflector or `UTutorialSubsystem::GetActiveCalloutCount()`).

**GIVEN** the player's checkpoint spawn position is inside hint C's trigger bounds, **WHEN** the game loads from that checkpoint, **THEN** the Tutorial System detects the overlap on the first tick post-load and hint C transitions from `INACTIVE` to `PENDING` within one frame.

### Queue Promotion

**GIVEN** two hints are `ACTIVE` (N_max=2) and a third Stage 1 event fires, **WHEN** the priority queue evaluates, **THEN** exactly two callouts are visible and the third hint is `PENDING` (queued) with no callout.

**GIVEN** two hints are `ACTIVE` (N_max=2), one reaches `COMPLETE`, **WHEN** the ACTIVE count drops below N_max, **THEN** the highest-priority `PENDING` hint (D_player re-sampled at re-evaluation) promotes to `ACTIVE` and its callout appears within one frame.

### Formulas

**GIVEN** a hint reaches `COMPLETE` at D_complete=0 cm, **WHEN** fade duration is calculated, **THEN** the result is 0.30 s.

**GIVEN** a hint reaches `COMPLETE` at D_complete=600 cm, **WHEN** fade duration is calculated, **THEN** the result is 0.60 s.

**GIVEN** R_obj=60 cm in a Medium-density zone (M_density=0.75), **WHEN** trigger radius is calculated, **THEN** the result is 150 cm (floor applied: `clamp(135, 150, 500) = 150`).

**GIVEN** R_obj=200 cm in an Open zone (M_density=1.0), **WHEN** trigger radius is calculated, **THEN** the result is 500 cm (ceiling applied).

**GIVEN** the player is at D_player=0 cm, **WHEN** the callout renders, **THEN** widget opacity is 1.0. **GIVEN** D_player=600 cm, **THEN** widget opacity is 0.0. **GIVEN** D_player=300 cm, **THEN** widget opacity is 0.75 (±0.01), matching `1.0 − (300/600)² = 0.75`.

### System Interactions

**GIVEN** an `ACTIVE` hint for the `Crouch` action (behavioral-physical class), **WHEN** the player presses Crouch while the triggering enemy is still in detection range, **THEN** the hint transitions to `COMPLETE` AND the player character crouches — input is not consumed.

**GIVEN** hint H reaches `COMPLETE`, **WHEN** the completion event fires, **THEN** H's HintID is written to `FTutorialSaveData` immediately — not deferred to the next manual save. The completion event fires exactly once per hint lifetime — re-encounter of the COMPLETE hint's area does not re-fire the event.

**GIVEN** the player saves and loads after completing hints H_001 and H_002, **WHEN** the Tutorial System initializes on load, **THEN** both hints are terminal and their Stage 1 listeners are not registered.

**GIVEN** a fresh save file, **WHEN** the Tutorial System initializes, **THEN** all hints are `INACTIVE` and all Stage 1 listeners are registered (or pending UnlockCondition, per Rule 10).

**GIVEN** the game is running and the Tutorial System is active, **WHEN** a hint enters `PENDING`, **THEN** the GSM state stack contains no `Tutorial` state entry — the Tutorial System does not write to the GSM.

**GIVEN** a hint has an UnlockCondition C not yet met and the player is outside the hint's trigger area, **WHEN** condition C becomes true at runtime, **THEN** the Stage 1 listener is registered. **WHEN** the player subsequently triggers Stage 1, **THEN** the hint transitions from `INACTIVE` to `PENDING` normally.

### UI and Configuration

**GIVEN** the player is on the Settings screen, **WHEN** the "Tutorial hints" toggle is switched off, **THEN** all active callouts disappear immediately and no new callouts spawn. The internal state machine continues running. The change takes effect within one frame — no restart required.

**GIVEN** the "Tutorial hints" toggle is cycled off then on in the same session, **WHEN** the toggle is re-enabled, **THEN** all currently-PENDING hints become visible and no COMPLETE hints are reset. `FTutorialSaveData` is unchanged.

**GIVEN** `MaxConcurrentHints` is changed from 2 to 3 in project config, **WHEN** three Stage 1 events fire, **THEN** all three callouts are visible with no hints queued.

## Open Questions

**OQ-1: MUTED→PENDING restore audio — no SFX replay.** *(Resolved — recording for implementation clarity.)* Restore is not a new PENDING entry. `SFX_Tutorial_Appear` plays only at initial INACTIVE→PENDING transition.

**OQ-2: F key conflict.** *(Resolved — manual dismiss eliminated.)* No dismiss input exists. The Tutorial System binds no keys and consumes no input events.

**OQ-3: Hint content and actor assignment.** This GDD defines the system; individual hint IDs, SEQ_idx values, label text, assigned anchor actors, and Stage 1 threat event types are content authoring work. **Owner**: Level Design | **Target**: Prison zone level design pass

**OQ-4: MUTED hints — should they expire after extended non-Playing time?** Currently MUTED hints restore unconditionally when Playing resumes. If the player is AFK in a menu for a long session, this may feel odd. `MaxDangerEventStalenessSeconds` only applies to active PENDING hints, not to MUTED ones. **Owner**: Design | **Target**: Playtest feedback

**OQ-5: New Game+ reset.** On New Game, `FTutorialSaveData` is empty. On New Game+, should completed hints reset? Currently no reset API exists. **Owner**: Design | **Target**: New Game+ scope decision (if applicable)

**OQ-6: Tutorial callout color.** Current spec uses amber/gold (#C8A84B) to be distinct from hostile red. However, gold communicates safety and collectibles in most players' game vocabulary, which conflicts with the world's hostile color language (arterial red, black compression per GSM GDD) and Pillar 3 (Tense Survival). Candidate alternatives: cold desaturated off-white, steel grey, or a muted blue-white that reads as "readable" without signaling safety. **Owner**: Art Director | **Target**: Art Bible review pass
