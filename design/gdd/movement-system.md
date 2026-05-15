# Movement System

> **Status**: In Design
> **Author**: user + agents
> **Last Updated**: 29 April 2026
> **Implements Pillar**: Pillar 1 (Hostile World), Pillar 3 (Tense Survival)

## Overview

The Movement System governs how the player traverses the hostile world — walk, sprint, crouch, jump, dodge, and cover — translating input into physical motion while enforcing survival constraints like stamina, surface friction, and visibility. It is the core of the moment-to-moment gameplay loop: every 30-second action in Hostile World is movement through danger.

The system operates as both a **data layer** (movement states, velocity, stamina values, surface modifiers) and a **player-facing experience** (the physical feel of a 90kg mercenary pushing through snow, the tension of sprinting across an open zone, the safety of dropping into crouch behind cover). It extends Unreal Engine's CharacterMovementComponent with survival-specific behaviors: stamina-gated sprint, surface-aware speed penalties, visibility-based movement noise, and dodge with invincibility frames.

**Key design decisions:**
1. **Extend CharacterMovementComponent** — do not replace it. Physics GDD confirms CMC as the base.
2. **Stamina-gated sprint** — sprint consumes stamina; exhaustion forces walk speed. Enforces Pillar 3 (Tense Survival).
3. **Surface-aware movement** — Physics System provides surface type; Movement System applies speed, noise, and stamina penalties.
4. **Movement states drive other systems** — Stealth reads movement noise, Combat reads dodge i-frames, AI reads player velocity for detection.
5. **Animation-driven feedback** — Animation Blueprint reads movement state to blend locomotion; movement does NOT drive animation directly.

## Player Fantasy

In Hostile World, movement is not a right — it is a negotiation. The player character is a trained operator descending through a landscape that is actively hostile to human passage. Every surface has a relationship with the player's body: some yield, some resist, some punish. The movement system makes this relationship tactile and consequential.

The player does not flow through the world; they push through it. Sprinting costs stamina, and stamina is the difference between reaching cover and being caught. Crouching reduces visibility but increases noise on certain surfaces. Jumping is limited and heavy — there are no double jumps, no wall runs, no air control tricks. The dodge is a committed evasion with invincibility frames but a recovery window long enough to punish spam. Every movement decision carries weight because the world enforces consequences.

This is the fantasy of **earned mobility**: the player is not gifted with environmental mastery but must learn it through friction, failure, and repetition. The satisfaction comes not from looking graceful but from surviving ugly — from making it across the open ground with 2% stamina left, from reading the terrain correctly, from knowing when to run and when to stay low. Movement is not how the player looks cool. It is how the player stays alive.

## Detailed Design

### Core Rules

**Rule 1 — Movement States**

The system maintains exactly **8 movement states**. Each state defines speed, stamina behavior, noise output, visibility profile, and allowed transitions.

| State | Speed | Stamina | Noise Level | Visibility | Entry Condition | Exit Condition |
|-------|-------|---------|-------------|------------|-----------------|----------------|
| **Idle** | 0 cm/s | Regen ×1.0 | 0 | Normal | No input for 0.5s | Move input received |
| **Walk** | 0–600 cm/s (input magnitude) | Regen ×1.0 | Low (20/100) | Normal | Move input, no sprint | Sprint held OR crouch toggled OR no input 0.5s |
| **Sprint** | 600–900 cm/s (input magnitude) | Drain 15/s | High (80/100) | High | Sprint held + stamina >20% | Sprint released OR stamina ≤0 OR crouch toggled |
| **Crouch** | 0–250 cm/s | Regen ×0.8 | Low (15/100) | Low (−40%) | Crouch toggled | Crouch toggled off |
| **Jump** | Horizontal preserved, vertical 420 cm/s | Drain 10 (flat) | Medium (40/100) | High | Jump pressed + grounded | Ground contact |
| **Fall** | Horizontal preserved, gravity accelerates | No regen, no drain | Medium (30/100) | High | Ground lost | Ground contact |
| **Dodge** | 800 cm/s burst (directional) | Drain 25 (flat) | High (70/100) | High | Dodge pressed + stamina ≥25 | Dodge animation complete (0.65s) |
| **Cover** | 0–150 cm/s (cover slide) | Regen ×1.2 | Very Low (5/100) | Very Low (−60%) | Enter cover (proximity + input) | Exit cover (input OR break LOS) |

**State priority (highest wins):** Cover > Dodge > Fall > Jump > Sprint > Crouch > Walk > Idle

**Rule 2 — Stamina System**

Stamina is the central resource gating aggressive movement. Max **100 stamina** — fixed, no upgrades, no progression. Communicated through character breathing audio, animation fatigue, and movement degradation — not a visible UI bar by default.

| Parameter | Value | Notes |
|-----------|-------|-------|
| Max Stamina | 100 | Fixed — no upgrades |
| Base Regen Rate | 20/s | Starts after 1.0s of no drain |
| Regen Delay | 1.0s | Time after last drain before regen |
| Exhaustion Threshold | 0 | Sprint locked at 0 |

**Drain Rates:**

| Action | Drain Type | Rate / Cost |
|--------|-----------|-------------|
| Sprint | Continuous | 15/s |
| Dodge | Flat cost | 25 per dodge |
| Jump | Flat cost | 10 per jump |
| Walk / Crouch / Idle | None | — |

**Exhaustion Behavior (stamina = 0):**
1. Sprint locked until stamina >10%.
2. Walk speed reduced by 20% (600 → 480 cm/s) for 3.0s.
3. Audible breathing active — adds +15 to noise level (stealth liability).
4. Dodge still available at <25 stamina — uses whatever remains, leaves player at 0.
5. Regen halved (10/s) for 2.0s after reaching 0 (recovery lag).

**Regen Modifiers:**

| Condition | Multiplier | Effective Rate |
|-----------|-----------|----------------|
| Idle / Walk | ×1.0 | 20/s |
| Crouching | ×0.8 | 16/s |
| In Cover | ×1.2 | 24/s |
| Exhausted (post-0) | ×0.5 for 2.0s | 10/s |
| On Ice | ×0.7 | 14/s |
| On Alien Biomass | ×0.6 | 12/s |

**Implementation**: Stamina lives on `AHostileCharacter` as a float. CMC queries `CanSprint()`, `CanDodge()`, `CanJump()` — never modifies stamina directly.

**Rule 3 — Visibility and Noise (Stealth Integration)**

Every movement state produces a noise level (0–100) and visibility modifier that the Stealth System reads for detection.

**Noise Levels Per State:**

| State | Base Noise | Surface Modifiers |
|-------|-----------|-------------------|
| Idle | 0 | — |
| Walk | 20 | Snow ×1.2 (24), Ice ×0.5 (10), Biomass ×1.5 (30) |
| Sprint | 80 | Snow ×1.1 (88), Ice ×0.7 (56), Biomass ×1.3 (104→100) |
| Crouch Walk | 15 | Snow ×1.3 (19.5), Ice ×0.4 (6), Biomass ×1.8 (27) |
| Jump (takeoff) | 40 | — |
| Fall (landing) | 50 | Concrete ×1.0, Snow ×0.6, Ice ×0.8 |
| Dodge | 70 | — |
| Cover | 5 | — |

**Visibility Modifiers:**

| State | Modifier | Detection Range Multiplier |
|-------|----------|---------------------------|
| Idle / Walk | 0% | ×1.0 |
| Sprint | +40% | ×1.4 |
| Crouch Walk | −40% | ×0.6 |
| Jump / Fall | +30% | ×1.3 |
| Dodge | +20% | ×1.2 |
| Cover | −60% | ×0.4 |

**Exhaustion noise penalty**: +15 to current state's noise when stamina = 0. Stacks with surface modifiers.

**Noise propagation**: Noise emitted as spherical sound events with radius = `Noise × 1.5 meters`. AI perception within radius receives hearing event.

**Rule 4 — Dodge / Roll**

Dodge is a committed evasion with invincibility frames.

| Parameter | Value | Notes |
|-----------|-------|-------|
| Total Duration | 0.65s | Wind-up + active + recovery |
| Wind-up (startup) | 0.10s | Input buffer, no i-frames, cancellable |
| Active (i-frame window) | 0.25s | Full invincibility, 800 cm/s directional |
| Recovery | 0.30s | No i-frames, 50% walk speed, cannot dodge again |
| Stamina Cost | 25 flat | Paid on activation |
| Direction | 8-way (input vector) | No input = backward relative to camera |
| Distance | ~200 cm | 800 cm/s × 0.25s |

**Constraints**: Dodge not available during Fall. Cannot cancel once i-frame window begins. Wind-up (0.10s) can be cancelled by releasing input — no stamina cost if cancelled. Dodge direction locked at activation.

**Implementation**: Uses `MOVE_Custom(0)` in CMC. Three phases: Launch (CMC `Launch()` for initial burst), Coast (root motion from animation), Recovery (braking deceleration). I-frames handled by Health System via delegate — Movement System fires `OnDodgeStarted`/`OnDodgeEnded`.

**Rule 5 — Cover System**

Cover is entered through proximity + explicit input. Not magnetic.

**Entry**: Player within 80 cm of valid cover object (waist-to-chest height, solid collision). Press IA_Crouch toward cover OR dedicated Enter Cover context action. Cover validated: min height 100 cm, max 180 cm, solid (not glass/destroyable). Transition to Cover state over 0.2s blend.

**Cover Movement**:
- Cover Slide: Left/right along cover at max 150 cm/s.
- Cover-to-Cover: Two cover objects within 120 cm → transition by holding move input toward next cover. Takes 0.3s.
- Exit Cover: Press IA_Crouch again OR move away from cover for 0.5s. Exit takes 0.2s.

**Available in Cover**: IA_LeanLeft, IA_LeanRight, IA_Aim, IA_Attack, IA_Interact.
**NOT Available in Cover**: Sprint, Dodge, Jump.

**Cover Detection**: Objects tagged with `ECover` component. Event-driven detection (on crouch input, direction change, periodic poll at 4Hz) — NOT per-frame. Implemented as `UCoverComponent` separate from CMC. CMC set to `MOVE_Custom(1)` during cover.

**Cover Animation**: Split-body layering — lower body (cover shuffle) + additive upper body (lean, aim). Cover-Enter/Exit are full-body montages.

**Rule 6 — Vaulting / Climbing — OUT OF SCOPE**

Vaulting and climbing are explicitly excluded from MVP.

**Rationale**: (1) Pillar conflict — implies environmental mastery, opposite of "surviving ugly." (2) Animation complexity — per-obstacle matching, IK, edge cases. Massive content burden for solo dev. (3) Stealth disruption — would need to be so punishing it's never optimal. (4) MVP focus — stairs, ramps, and ladders handle verticality in the mountain prison zone.

**Future consideration**: If post-MVP design requires limited vaulting: separate animation-driven system, pre-authored vault points only, high noise cost (60+), stamina cost (20 flat), obstacles ≤120 cm height.

### States and Transitions

| From State | To State | Trigger | Conditions | Blend Duration |
|------------|----------|---------|------------|----------------|
| Idle | Walk | Move input | — | 0.15s |
| Idle | Sprint | Sprint held | Stamina >20% | 0.25s |
| Idle | Crouch | IA_Crouch | — | 0.1s |
| Idle | Jump | IA_Jump | Grounded, stamina >10% | Instant |
| Idle | Dodge | IA_Dodge | Stamina ≥25 | 0.10s wind-up |
| Idle | Cover | IA_Crouch toward cover | Cover within 80cm | 0.2s |
| Walk | Idle | No input | Hold 0.5s | 0.15s |
| Walk | Sprint | Sprint held | Stamina >20% | 0.25s |
| Walk | Crouch | IA_Crouch | — | 0.1s |
| Walk | Jump | IA_Jump | Grounded | Instant |
| Walk | Dodge | IA_Dodge | Stamina ≥25 | 0.10s wind-up |
| Walk | Cover | IA_Crouch toward cover | Cover within 80cm | 0.2s |
| Walk | Fall | Ground lost | Walk off edge | Instant |
| Sprint | Walk | Sprint released | — | 0.2s |
| Sprint | Crouch | IA_Crouch | — | 0.1s (drop animation) |
| Sprint | Dodge | IA_Dodge | Stamina ≥25 | 0.10s wind-up |
| Sprint | Fall | Ground lost | — | Instant |
| Sprint | Idle | No input + stop | Stamina >0 | 0.3s |
| Crouch | Walk | IA_Crouch | — | 0.1s |
| Crouch | Cover | Move toward cover | Cover within 80cm | 0.2s |
| Crouch | Jump | IA_Jump | Grounded | Instant |
| Crouch | Idle | No input | Hold 0.5s | 0.1s |
| Jump | Fall | Apex reached / ground lost | — | Instant |
| Jump | Walk | Ground contact | — | 0.15s (land animation) |
| Fall | Walk | Ground contact | — | 0.15s (land animation, velocity-dependent) |
| Fall | Dodge | — | **NOT ALLOWED** | — |
| Dodge | Walk | Dodge complete (0.65s) | — | 0.3s (recovery decel) |
| Dodge | Fall | Ground lost during dodge | — | Instant |
| Cover | Walk | Exit cover (input) | — | 0.2s |
| Cover | Crouch | Exit cover (IA_Crouch) | — | 0.2s |
| Cover | Cover | Cover-to-cover | Next cover within 120cm | 0.3s |

### Interactions with Other Systems

| System | Direction | Data Flow | Interface |
|--------|-----------|-----------|-----------|
| **Input System** | Reads | IA_Move, IA_Sprint, IA_Crouch, IA_Jump, IA_Dodge, IA_LeanLeft/Right | Enhanced Input actions bound to CMC and Cover component |
| **Physics System** | Reads | Surface type, friction, slope angle, gravity | `IPhysicsSystem::GetSurfaceType()`, `GetSurfaceFriction()`, CMC `CurrentFloorAngle` |
| **Stealth System** | Writes | Noise level (0–100), visibility modifier, movement state | `OnNoiseChanged(float)`, `OnVisibilityChanged(float)`, `GetCurrentMovementState()` |
| **Combat System** | Reads/Writes | Dodge i-frame window, movement speed during combat | `OnDodgeStarted(float duration)`, `OnDodgeEnded()`, `GetMovementSpeed()` |
| **Health System** | Reads/Writes | Fall damage on landing, exhaustion state | `OnLanded(float velocity)`, `ApplyFallDamage(float)`, stamina depletion triggers audio |
| **Camera System** | Writes | Movement state, velocity magnitude, dodge active | `OnMovementStateChanged()`, `OnDodgeActive(bool)` — camera adjusts arm length, FOV |
| **Alien AI System** | Writes | Player position, velocity, noise events | Noise propagation (radius = Noise × 1.5m), velocity for detection calculations |
| **Player Controller** | Owned by | Movement state machine, stamina, cover state | Central hub reads all movement state for routing to other systems |
| **Animation System** | Writes | Movement state, speed, direction, surface type | Anim Blueprint reads: speed axis, direction angle, surface type for foot IK, dodge montage triggers |

## Formulas

**Formula 1 — Effective Move Speed**

The `effective_move_speed` formula is defined as:

`V_eff = V_base(S) × M_input × M_surface × M_stamina × M_slope`

**Variables:**

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| State base speed | V_base(S) | float | 0–900 | Speed cap for current state: Idle=0, Walk=600, Sprint=900, Crouch=250, Jump=600, Dodge(active)=800, Dodge(recovery)=300, Cover=150 |
| Input magnitude | M_input | float | 0.0–1.0 | Normalized analog stick magnitude from Input System |
| Surface multiplier | M_surface | float | 0.7–1.0 | Physics System: Normal=1.0, Snow=0.9, Ice=0.7, Biomass=0.8 |
| Stamina multiplier | M_stamina | float | 0.5–1.0 | 1.0 normal; 0.8 exhausted (3s debuff); 0.5 during dodge recovery |
| Slope multiplier | M_slope | float | 0.6–1.3 | Uphill: 0–15°=1.0, 15–35°=0.8, 35–45°=0.6. Downhill: −15°=1.1, −35°=1.3 |

**Output Range:** 0 to 1170 cm/s (sprint downhill, not exhausted); clamped to 0 minimum.
**Example:** Sprinting on snow, 20° uphill: 900 × 1.0 × 0.9 × 1.0 × 0.8 = **648 cm/s** — only 8% faster than normal walk.
**Example (worst case):** Walking on ice, exhausted, 40° uphill: 600 × 1.0 × 0.7 × 0.8 × 0.6 = **201.6 cm/s** — one-third of normal walk speed.

---

**Formula 2 — Stamina Consumption**

The `stamina_consumption` formula is defined as:

For continuous actions (Sprint): `Δstamina = R_drain × Δt`
For discrete actions (Dodge, Jump): `Δstamina = C_flat`

**Variables:**

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| Drain rate | R_drain | float | 15.0 | Stamina units per second during sprint |
| Flat cost | C_flat | float | 10–25 | Jump=10, Dodge=25 |
| Frame delta time | Δt | float | 0.001–0.1 | Time since last frame in seconds |

**Output Range:** 0 to 25 per frame. Stamina clamped to [0, 100]. Frame-rate independent.
**Example:** Sprint at 60fps: 15 × 0.0167 = **0.25 stamina/frame**. Full drain: 100/15 = **6.67 seconds**.

---

**Formula 3 — Stamina Regeneration**

The `stamina_regeneration` formula is defined as:

`Δstamina_regen = R_regen × M_state × M_surface × M_exhaust × Δt` (only when t_since_drain ≥ T_delay and S_cur < 100)

**Variables:**

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| Base regen rate | R_regen | float | 20.0 | Stamina units recovered per second |
| State modifier | M_state | float | 0.8–1.2 | Idle/Walk=1.0, Crouch=0.8, Cover=1.2 |
| Surface modifier | M_surface | float | 0.6–1.0 | Normal=1.0, Ice=0.7, Biomass=0.6 |
| Exhaustion modifier | M_exhaust | float | 0.5–1.0 | 0.5 for first 2.0s after hitting 0; 1.0 otherwise |
| Regen delay | T_delay | float | 1.0 | Seconds of no-drain before regen begins |

**Output Range:** 0 to 24/s (cover, normal surface). Worst case: 4.8/s (crouch + biomass + exhausted).
**Example:** In cover, normal surface: 20 × 1.2 × 1.0 × 1.0 = **24/s**. Full recovery from 0: ~4.17 seconds.

---

**Formula 4 — Noise Emission Radius**

The `noise_emission_radius` formula is defined as:

`R_noise = clamp((N_base(S) × M_surface_noise + N_exhaust) × K_scale, 0, 200)`

**Variables:**

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| Base noise level | N_base(S) | float | 0–80 | Per-state noise from Rule 3 table |
| Surface noise modifier | M_surface_noise | float | 0.4–1.8 | Per-surface noise multiplier from Rule 3 |
| Exhaustion noise bonus | N_exhaust | float | 0–15 | +15 flat when stamina = 0; 0 otherwise |
| Scale constant | K_scale | float | 1.5 | Converts noise units to meters |

**Output Range:** 0 to 200 meters (clamped).
**Example:** Sprinting on biomass, not exhausted: (80 × 1.3 + 0) × 1.5 = **156 meters** — every alien in range hears you.
**Example:** Crouching on ice, exhausted: (15 × 0.4 + 15) × 1.5 = **31.5 meters** — exhaustion breathing gives you away even when still.

---

**Formula 5 — Dodge Displacement**

The `dodge_displacement` formula is defined as:

`D_total = (V_current × T_windup) + (V_dodge_burst × T_active) + (V_recovery × T_recovery)`

**Variables:**

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| Pre-dodge velocity | V_current | float | 0–900 | Player velocity at dodge activation (cm/s) |
| Wind-up duration | T_windup | float | 0.10 | Fixed: dodge startup (seconds) |
| Dodge burst speed | V_dodge_burst | float | 800 | Fixed: i-frame phase velocity (cm/s) |
| Active duration | T_active | float | 0.25 | Fixed: i-frame window (seconds) |
| Recovery speed | V_recovery | float | 300 | Fixed: 50% walk speed during recovery (cm/s) |
| Recovery duration | T_recovery | float | 0.30 | Fixed: recovery phase (seconds) |

**Output Range:** 290 to 380 cm. Minimum from standstill: 0 + 200 + 90 = 290 cm. Maximum from full sprint: 90 + 200 + 90 = 380 cm.
**Example:** Dodge from standstill: **290 cm**. Dodge from full sprint: **380 cm** — ~31% further, rewarding commitment.

## Edge Cases

- **If stamina < 25 and player inputs dodge**: the dodge action fails entirely, stamina is unchanged, no partial execution. Prevents undefined animation states and negative stamina exploits.

- **If player triggers a second exhaustion event while the first exhaustion's 3s walk penalty or 2s halved-regen timer is still active**: both timers refresh to full duration from the new trigger point. Timers do not stack. Prevents permanent exhaustion soft-lock from repeated sprint attempts.

- **If player holds crouch input during the final 0.15s before ground contact from Fall**: fall damage reduced by 50% but character does NOT transition to Crouch state (Fall > Crouch in priority). A `landing_modifier` flag is set during the pre-landing window to apply the reduction without violating the priority chain.

- **If player inputs dodge during Jump state (ascending, before vertical velocity goes negative)**: dodge executes normally, consuming 25 stamina. Jump-dodge costs 35 total stamina (10 + 25). Vertical velocity from jump is preserved. Dodge is NOT available during Fall state only — Jump is distinct.

- **If a dodge starts on surface A and displacement carries the character onto surface B mid-animation**: dodge displacement is calculated once at initiation using surface A's modifier. No mid-dodge recalculation. Prevents jitter and non-deterministic displacement.

- **If player is exhausted and moves within 80cm of a cover object**: cover entry is permitted. Cover has no stamina cost and is the highest-priority state, serving as a recovery position. Blocking cover during exhaustion would trap the player with no recovery path.

- **If player initiates a dodge (25 stamina consumed) and presses cover input within 80cm of cover during the dodge animation**: dodge is interrupted at current displacement, cover state activates immediately, stamina cost is NOT refunded. Prevents stamina-free dodge cancels.

- **If impact velocity V = 800.00 cm/s exactly**: FallDamage = 0. Velocities within ±1 cm/s of 800 are treated as exactly 800 to avoid floating-point edge cases causing inconsistent damage at the boundary.

- **If V = 1200 cm/s and player performs a crouch landing**: base damage = 60, reduced damage = 60 × 0.5 = 30. The 50% reduction applies to calculated damage, NOT to velocity before the formula. Applying to velocity would negate all falls below 1600 cm/s.

- **If player holds forward (W) and backward (S) simultaneously**: M_input = 0, V_eff = 0. Character decelerates to Idle. No arbitrary direction picking — prevents "sticky input" confusion.

- **If character is in a state without an explicitly defined M_state multiplier**: M_state defaults to 1.0 for Cover (recovery position), 0.0 for Jump and Fall (no aerial regen). Prevents infinite jump-dodge chains.

- **If player sprints for 0.5s, releases for 0.8s, then presses sprint again before the 1.0s regen delay elapses**: regen delay timer resets to 1.0s from the new input. No stamina regenerated during the interrupted delay. Prevents "pulse sprint" exploitation at 0.9s intervals.

- **If player dodges while V_current = 0 (stationary)**: dodge displacement = 290cm minimum. Dodge always travels in the input direction, not the movement direction. V_current modulates distance, not direction.

- **If player is exhausted (N_exhaust = +15), crouching (N_base = 2), on snow (M_surface_noise = 0.5)**: noise = (2 × 0.5 + 15) × 1.5 = 24.0. An exhausted player cannot achieve zero noise regardless of stance or surface. Exhaustion noise floor = 22.5 minimum.

- **If the game runs at 10 FPS**: all timers (regen delay, exhaustion, dodge phases) MUST be tracked in real-time seconds (accumulated Δt), not frame counts. Frame-based timers create platform-dependent gameplay where low-FPS players recover stamina slower.

## Dependencies

**Hard Dependencies** (system cannot function without):
- **Input System** ✅ (designed) — provides IA_Move, IA_Sprint, IA_Crouch, IA_Jump, IA_Dodge, IA_LeanLeft/Right. Movement System consumes all movement-related input actions.
- **Physics System** ✅ (designed) — provides surface type queries, friction values, slope detection, gravity multiplier. Movement System reads physics state per-frame for speed calculations.

**Soft Dependencies** (enhanced by but works without):
- **Game State Machine** ✅ (designed) — movement respects game state (e.g., no movement during Cutscene or Paused states).

**Depended On By** (key downstream systems):

| System | Interface Used | Expected Behavior |
|--------|---------------|-------------------|
| Player Controller | Movement state, stamina, cover state | Central hub reads all movement state for routing |
| Stealth System | Noise level (0–100), visibility modifier, movement state | Converts noise to detection radius, visibility to detection range multiplier |
| Combat System | Dodge i-frame window, movement speed | Reads dodge duration for invulnerability; speed for engagement range |
| Health System | Fall damage on landing, exhaustion audio trigger | Receives landing velocity, applies fall damage formula |
| Camera System | Movement state, velocity, dodge active | Adjusts arm length (crouch=250, sprint=350), FOV (sprint=70°), dodge motion blur |
| Alien AI System | Player position, velocity, noise events | Noise propagation for hearing detection; velocity for pursuit calculations |
| Animation System | Movement state, speed, direction, surface type | Anim Blueprint reads speed axis, direction, surface for foot IK and montage triggers |

## Tuning Knobs

| Knob | Default | Safe Range | Affects | Too High | Too Low |
|------|---------|------------|---------|----------|---------|
| `MaxWalkSpeed` | 600 cm/s | 300–1200 | Base movement pace | Player feels too fast, collision jitter | Sluggish, slow pacing |
| `SprintSpeed` | 900 cm/s | 500–1500 | Sprint pace relative to walk | Hard to control, slide too far | Sprint doesn't feel meaningfully faster |
| `CrouchSpeed` | 250 cm/s | 100–400 | Crouch traversal speed | Crouch feels too viable for combat | Crouch is unusably slow |
| `MaxStamina` | 100 | 50–200 | Sprint/dodge/jump budget | Sprint lasts forever, no tension | Can barely move, frustrating |
| `SprintDrainRate` | 15/s | 10–25 | Sprint duration | Sprint too short, punishing | Sprint lasts too long, no risk |
| `StaminaRegenRate` | 20/s | 15–30 | Recovery speed | Recovery too fast, no consequence | Recovery too slow, punishing downtime |
| `StaminaRegenDelay` | 1.0s | 0.5–2.0 | Anti-pulse-sprint gate | Pulse-sprint exploit viable | Too punishing for natural input |
| `DodgeCost` | 25 | 15–40 | Dodge frequency | Dodge spam viable | Dodge never used |
| `DodgeIFrameWindow` | 0.25s | 0.15–0.35 | Dodge timing generosity | Dodge trivializes combat | Dodge feels unresponsive |
| `DodgeRecoverySpeed` | 300 cm/s | 150–450 | Post-dodge vulnerability | Recovery too fast, no punishment | Recovery too slow, death sentence |
| `CoverEntryProximity` | 80 cm | 50–150 | Cover snap range | Cover feels magnetic, unintentional | Cover too hard to enter |
| `CoverToCoverGap` | 120 cm | 80–200 | Cover chaining distance | Cover chaining too easy | Cover chaining impossible |
| `ExhaustionWalkPenalty` | 0.8 (−20%) | 0.5–0.9 | Exhaustion severity | Exhaustion barely noticeable | Exhaustion = soft-lock |
| `ExhaustionDuration` | 3.0s | 1.0–5.0 | Recovery window length | Exhaustion forgotten too fast | Exhaustion punishment too long |
| `NoiseScaleConstant` | 1.5 | 1.0–2.0 | Noise propagation range | Stealth nearly impossible | Stealth too easy |
| `SlopeModifier_UpSteep` | 0.6 | 0.4–0.8 | Uphill penalty severity | Hills impassable | Hills feel flat |
| `SlopeModifier_DownSteep` | 1.3 | 1.1–1.5 | downhill speed assist | Downhill = uncontrollable slide | Downhill feels same as flat |

## Visual/Audio Requirements

### Art Bible Principles Governing Movement

| Principle | Application |
|-----------|------------|
| **Environmental Transformation** (Pillar 1) | Every surface responds to the player's passage. Alien Biomass depresses and pulses bioluminescent green on footstep impact — the world remembers you walked here. |
| **Earned Revelation Through Scarcity** (Pillar 2) | Movement VFX are understated and grounded. No particle explosions on landing, no glowing trails on dodge. Visual feedback is tactile — dust, debris, surface displacement. |
| **Survival Tension Through Visual Legibility** (Pillar 3) | Exhaustion communicated through animation and audio alone (no UI bar by default). Heavy breathing, staggered gait, slower recovery — the player *sees and hears* their depletion. |

### VFX Per Movement State

**Footstep VFX — Per Surface:**

| Surface | Walk VFX | Sprint VFX | Audio Character |
|---------|----------|------------|-----------------|
| **Snow** | Boot compression, subtle puff, print persists 3–5s | Snow spray, deeper print | Muffled crunch, soft compression |
| **Ice** | 2–3 crystal spark particles | 5–8 sparks, surface scratch | Sharp click, slight ring |
| **Concrete** | Dust puff (3–5 particles), faint scuff 2–3s | Visible dust cloud, larger scuff | Solid thud, dust scatter |
| **Metal** | 1–2 sparks | 3–5 sparks | Metallic clang, resonant |
| **Alien Biomass** | Organic depression + bioluminescent pulse (green), spore particles | Deeper depression, stronger pulse, more spores | Wet squelch, organic pulse undertone |
| **Wood** | Splinter fragments (2–4 particles) | Visible splinters, larger dust cloud | Hollow thud, possible creak |
| **Glass** | Crack decal (thin) or none (thick) | Visible cracking, shard particles | Sharp crack (thin), solid thud (thick) |

**Landing VFX by velocity:**

| Impact Velocity | VFX Intensity | Particle Count | Audio |
|----------------|---------------|----------------|-------|
| < 600 cm/s | Minimal | 5–8 | Low thud |
| 600–800 cm/s | Low | 10–15 | Medium impact |
| 800–1000 cm/s | Medium | 15–25 | High impact |
| 1000–1200 cm/s | High | 25–40 | Very high + screen shake |
| > 1200 cm/s | Maximum | 40–60 | Maximum + heavy screen shake |

**Dodge VFX:**
- Wind-up (0.10s): Small dust puff from planting foot, sharp exhale audio.
- Active i-frame (0.25s): **Subtle screen-space distortion ripple** (heat-haze effect, 5% intensity) — NOT a glowing shield. Directional whoosh audio.
- Recovery (0.30s): Dust trail (max 10 particles, 0.3s fade), heavy landing audio, stagger breath.

**Cover VFX:**
- Enter: Dust puff from wall contact (0.2s), body contact + gear scrape audio.
- Idle: None visual. Alert breathing audio.
- Slide: Small dust trail along cover surface, fabric scrape audio.
- On Biomass: Subtle green tint on contact point (0.3s fade), wet contact sound.

**Exhaustion Visual/Audio Progression:**

| Stamina Range | Breathing | Visual |
|--------------|-----------|--------|
| 100–50% | Normal, controlled | — |
| 50–30% | Slightly elevated | — |
| 30–10% | Noticeably heavier | — |
| 10–0% | Labored, irregular | — |
| 0% (exhausted) | Ragged, gasping | Subtle red vignette pulse (5% opacity, 1s every 2s) if immersive HUD enabled |

### Animation Constraints

- **Weight and mass**: All transitions show 90kg character. No snappy starts/stops.
- **No heroic poses**: No power stances or dramatic flourishes.
- **Foot IK mandatory**: All locomotion states use foot IK for surface alignment. No floating feet.
- **Split-body layering for cover**: Lower body (shuffle) + additive upper body (lean, aim).
- **Sprint animation**: Forward lean, arms pumping, shoulders hunched. Desperate survival running, not athletic.

### Performance Budget

| Metric | Budget |
|--------|--------|
| Particles per footstep | Max 30 (sprint) |
| Active decals from movement | Max 8 simultaneous |
| Movement VFX frame budget | < 0.5ms |
| Dodge distortion effect | < 0.2ms |

## UI Requirements

Movement System has minimal direct UI — stamina is communicated through audio/animation by default.

| Context | HUD Element | Notes |
|---------|-------------|-------|
| Exhaustion indicator | Subtle red vignette pulse | Only when stamina = 0. 5% opacity, 1s pulse every 2s. Toggleable in immersive mode. |
| Tactical HUD (toggleable) | Stamina bar (bottom-left) | Shows exact stamina value. Only visible when full tactical HUD is enabled. |
| Tactical HUD (toggleable) | Current speed readout | cm/s display for debugging/tuning. Dev-only in production builds. |
| Tactical HUD (toggleable) | Surface type indicator | Current surface name + friction value. Dev/debug tool. |

## Acceptance Criteria

- **GIVEN** character on flat ground with full stamina, **WHEN** player holds forward input at walk intensity (no sprint), **THEN** character speed stays between 0 and 600 cm/s, scaling with input magnitude.

- **GIVEN** character has at least 30 stamina on flat ground, **WHEN** player holds sprint input for 2.0 seconds, **THEN** speed is between 600–900 cm/s AND stamina decreases by approximately 30 points (±2 tolerance).

- **GIVEN** character standing on flat ground, **WHEN** player holds crouch input while moving forward, **THEN** speed never exceeds 250 cm/s.

- **GIVEN** character within 80 cm of valid cover, **WHEN** player activates cover and holds lateral input, **THEN** character slides along cover at max 150 cm/s.

- **GIVEN** stamina reaches 0 from sustained sprinting, **WHEN** player continues holding sprint input, **THEN** sprint is disabled, walk speed reduced by 20%, and movement noise increases by +15 for 3.0 seconds.

- **GIVEN** character stops all stamina-draining actions, **WHEN** 0.5 seconds have elapsed, **THEN** stamina has NOT begun regenerating. **WHEN** 1.5 seconds have elapsed, **THEN** stamina is actively regenerating at approximately 20/s.

- **GIVEN** character has exactly 15 stamina and is grounded, **WHEN** player presses jump, **THEN** jump executes AND stamina drops to approximately 5 (±1 tolerance).

- **GIVEN** character has 5 stamina and is grounded, **WHEN** player presses jump, **THEN** jump does NOT execute AND stamina remains at 5.

- **GIVEN** character has at least 30 stamina, **WHEN** player triggers dodge, **THEN** stamina decreases by 25 AND speed spikes to approximately 800 cm/s in dodge direction for first 0.25 seconds.

- **GIVEN** character initiates dodge, **WHEN** dodge animation reaches 0.15s elapsed, **THEN** character is invulnerable to damage. **WHEN** dodge reaches 0.40s, **THEN** character is no longer invulnerable. **WHEN** dodge reaches 0.65s, **THEN** dodge is complete and control returns to player.

- **GIVEN** character moving at 800 cm/s in a straight line, **WHEN** player triggers dodge in same direction, **THEN** total displacement during dodge is between 290 and 380 cm.

- **GIVEN** character sprinting on surface with 0.7 speed modifier, **WHEN** player sprints at full input, **THEN** effective speed is approximately 630 cm/s (±10 cm/s tolerance).

- **GIVEN** character is exhausted (stamina = 0), **WHEN** player holds walk input at maximum on flat ground, **THEN** effective speed is 480 cm/s (±10 cm/s tolerance).

- **GIVEN** character sprinting on hard surface (noise modifier 1.0) with no exhaustion, **WHEN** character maintains sprint for 1 second, **THEN** noise radius is (80 × 1.0 + 0) × 1.5 = 120 meters, clamped to 0–200 range.

- **GIVEN** character enters exhaustion (stamina = 0), **WHEN** character walks on hard surface, **THEN** noise radius increases by 22.5 meters compared to non-exhausted walking on same surface.

- **GIVEN** character is 85 cm from valid cover, **WHEN** player presses cover input toward object, **THEN** cover does NOT activate. **GIVEN** character moves to 75 cm, **WHEN** player presses cover input, **THEN** cover activates successfully.

- **GIVEN** character in cover and second cover object is 115 cm away, **WHEN** player inputs movement toward second cover, **THEN** character transitions. **GIVEN** second cover is 125 cm away, **WHEN** player inputs movement, **THEN** character exits cover instead.

- **GIVEN** character falls and impacts at 1000 cm/s vertical velocity, **WHEN** impact occurs, **THEN** fall damage equals 30 (±2 tolerance).

- **GIVEN** character falls and impacts at 750 cm/s vertical velocity, **WHEN** impact occurs, **THEN** fall damage equals 0.

- **GIVEN** character falls and impacts at 1200 cm/s while in crouch state, **WHEN** impact occurs, **THEN** fall damage equals 30 (60 × 0.5, ±2 tolerance).

## Open Questions

| # | Question | Owner | Target Resolution |
|---|----------|-------|-------------------|
| OQ-1 | Should IA_Flashlight be toggle (press) or latch (hold)? Affects stamina drain during flashlight use while moving. | game-designer | Input System GDD review |
| OQ-2 | Does gear load (inventory weight) affect player mass and thus momentum/push force? Physics GDD OQ-3 raises this. | design | After Inventory System GDD |
| OQ-3 | Surface type detection — foot IK traces vs. capsule trace? Physics GDD OQ-4. Determines per-foot surface accuracy. | engine/animation | Architecture ADR |
| OQ-4 | Physics sub-stepping rate for 60fps target? Affects collision accuracy during fast dodge movements. | engine/perf | Architecture ADR |
| OQ-5 | Should dodge have separate animations for sprinting (dive) vs. standing (roll)? Technical artist identified this as separate animation asset. | art-director | Asset production planning |
| OQ-6 | Limited vaulting post-MVP — should it be pre-authored vault points or dynamic obstacle detection? | game-designer | Vertical Slice planning |
