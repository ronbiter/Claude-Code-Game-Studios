# Health System

> **Status**: In Design
> **Author**: user + agents
> **Last Updated**: 29 April 2026
> **Implements Pillar**: Pillar 3 (Tense Survival)

## Overview

The Health System governs player survivability — tracking health, processing damage from all sources (combat, falls, environment, infection exposure), managing the death state, and gating recovery through scarce healing resources. It is the mechanical anchor of Pillar 3 (Tense Survival): every point of health lost is permanent until a scarce resource restores it, and death means reloading from checkpoint with progress lost.

The system operates as both a **data layer** (health pool, damage types, damage resistance, death state) and a **player-facing experience** (the tension of low health, the relief of finding a medkit, the finality of death). It processes damage from Combat System (weapons, alien attacks), Physics System (fall damage), and environmental hazards, then routes death events to the Game State Machine for GameOver transition.

**Key design decisions:**
1. **Single health pool** — no separate shields, armor, or body-part health. One number, simple and legible.
2. **No passive regen** — health does not recover on its own. Recovery requires consumable items. Enforces Pillar 3.
3. **Lethal damage model** — player has low health relative to damage output. 2-3 hits from an alien can kill. The player is skilled, not tanky.
4. **Infection immunity is narrative, not mechanical** — the player cannot be infected by the alien virus, but can still be killed by alien physical attacks and environmental hazards.
5. **Death → checkpoint reload** — no permadeath, but lost progress on that run's choices (per game concept).

## Player Fantasy

Health in Hostile World is not a number to manage — it is a measure of how much mistake you have left. The player character is a trained black ops operator who has survived combat before. They do not panic when wounded. They inventory their supplies, reassess the threat, and make a cold professional decision: push forward or withdraw.

The tension comes from the gap between composure and danger. The character stays calm; the situation is lethal. Every wound is permanent until treated with a scarce consumable. There is no hiding behind a wall to recover. There is no passive regen. There is only what you have, where you are, and whether it is enough.

Health is **operational capacity** — not a life bar, but a measure of how much more combat the player can sustain before they must disengage. Healing is not "recovery" — it is **field treatment**, a tactical resource expenditure that costs something: the item, the time, the vulnerability of stopping to use it while the hostile world keeps moving. Death is not failure — it is a mission abort. You reload, you reapproach, you apply what you learned.

## Detailed Design

### Core Rules

**Rule 1 — Health Pool**

The player has a single health pool of **100 HP**. Fixed — no upgrades, no progression. Represents operational capacity, not a "life bar."

| Property | Value | Notes |
|----------|-------|-------|
| Max HP | 100 | Fixed |
| Starting HP | 100 | Full health at every checkpoint |
| Minimum HP | 0 | Death state at 0 |
| HP Type | Integer (int32) | Fractional damage rounds down |

**Communication**: Three channels — (1) Immersive (default): posture, blood on gear, breathing, screen-edge vignette. (2) Tactical HUD (toggleable): numeric HP + health bar. (3) Audio: breathing escalates at 50 HP, ragged at 25 HP, gasping at 10 HP.

**Rule 2 — Damage Types**

| Damage Type | Source | Counterplay | Communication |
|-------------|--------|-------------|---------------|
| **Physical** | Alien melee, alien projectiles | Dodge (i-frames), cover, stealth | Impact VFX, directional screen flash, grunt |
| **Fall** | Landing from height | Crouch/roll (50% reduction), avoid drops | Landing VFX, camera shake, bone-crack audio |
| **Environmental** | Fire, electrified water, toxic gas, collapsing structures | Avoid zones, move through quickly | Zone warning VFX, tick damage audio |
| **Infection Exposure** | Prolonged alien biomass contact | Move out of zone quickly | Green screen tint, coughing, vignette pulse |

Each damage source carries `EDamageType` enum for HUD warnings and death cause logging.

**Extensibility**: The damage pipeline is source-agnostic — it processes damage by type, not by source. Adding new antagonists (human mercenaries, infected survivors, alien variants) requires no pipeline changes: they deal `Physical` damage through the same `TakeDamage(float, EDamageType)` interface. New damage types (e.g., `Radiation`, `Psychological`) are added by extending the `EDamageType` enum — the pipeline handles them automatically. Damage-type-specific behavior (e.g., Radiation DoT) is added as a case in step 2 of the pipeline without changing the pipeline structure. Status effects that persist beyond the damage event (DoT, debuffs) are a separate system — not part of Health System's core.

**Rule 3 — Damage Processing Pipeline**

Strict order of operations:
1. **Invulnerability Check**: If dodge i-frame active, damage fully negated. No HP loss, no VFX, no audio.
2. **Fall Damage Modifier**: If `Fall` type and player in Crouch at impact frame: `FinalDamage = ceil(BaseDamage × 0.5)`.
3. **Apply Damage**: `CurrentHP = max(0, CurrentHP − FinalDamage)`. HP never negative.
4. **Death Check**: If `CurrentHP == 0`, trigger death sequence (Rule 5).
5. **Broadcast Event**: Fire `OnHealthChanged(PreviousHP, NewHP, DamageType)` for HUD, audio, animation.

Multiple damage sources in same frame: processed sequentially, each triggers its own pipeline pass.

**Rule 4 — Healing and Recovery**

No passive regen. Three consumable tiers:

| Consumable | HP Restored | Use Time | Rarity | Constraints |
|------------|-------------|----------|--------|-------------|
| **Field Dressing** | +25 HP | 2.0s | Common | Usable while walking (slower: 3.0s). Interrupted by sprint, dodge, jump, or damage. |
| **Medkit** | +60 HP | 4.0s | Uncommon | Requires stationary (Idle or Crouch). Interrupted by any movement or damage. |
| **Stimshot** | +40 HP | 0.8s | Rare | Usable while moving. NOT interrupted by damage. 1.5s screen blur post-use. |

**Constraints**: No overheal (capped at 100). Damage during use cancels and wastes the item (except Stimshot). Consumable inventory managed by Inventory System.

**Rule 5 — Death State**

At 0 HP:
1. Input locked. Death animation plays (0.5s collapse montage).
2. Ragdoll blends in over 0.3s (per Physics GDD).
3. Health System fires `RequestStateTransition(PlayerDied)` to Game State Machine. GSM transitions to GameOver with 1.0s sharp gasp.
4. "Restart from Checkpoint?" prompt appears.
5. On restart: full HP (100), full stamina (100), inventory as of checkpoint. All progress since checkpoint lost.

**Rule 6 — Injury States**

| HP Range | State | Effects |
|----------|-------|---------|
| 100–51 | **Operational** | No penalties. |
| 50–26 | **Wounded** | Breathing escalates. Blood vignette 5% opacity. No mechanical penalties. |
| 25–11 | **Critical** | Walk speed −10% (600→540 cm/s). Stamina regen −20% (20→16/s). Blood vignette 15%. Posture hunched. Sprint drains 15% faster (15→17.25/s). |
| 10–1 | **Near Death** | Walk speed −20% (600→480 cm/s). Stamina regen −40% (20→12/s). Blood vignette 30%. Screen pulses red every 2s. Character grunts per movement input. Dodge recovery +0.1s (0.30→0.40s). |
| 0 | **Dead** | Death sequence (Rule 5). |

Transitions are immediate — no blend delay.

### States and Transitions

| From State | To State | Trigger | Conditions |
|------------|----------|---------|------------|
| Operational | Wounded | HP drops to ≤50 | Any damage source |
| Wounded | Operational | HP restored to ≥51 | Healing consumable |
| Wounded | Critical | HP drops to ≤25 | Any damage source |
| Critical | Wounded | HP restored to ≥26 | Healing consumable |
| Critical | Near Death | HP drops to ≤10 | Any damage source |
| Near Death | Critical | HP restored to ≥11 | Healing consumable |
| Near Death | Dead | HP drops to 0 | Any damage source |
| Any | Dead | HP reaches 0 | Damage pipeline |
| Dead | GameOver | Collapse montage + ragdoll complete | GSM transition |

### Interactions with Other Systems

| System | Direction | Data Flow | Interface |
|--------|-----------|-----------|-----------|
| **Physics System** | Reads | Fall damage velocity | `OnLanded(float velocity)` → applies FallDamage formula |
| **Movement System** | Reads | Dodge i-frame events via delegate, exhaustion state | `OnDodgeStarted/OnDodgeEnded` delegates; reads exhaustion for audio |
| **Combat System** | Reads | Damage from alien attacks, weapons | `TakeDamage(float amount, EDamageType)` |
| **Alien AI System** | Reads | Damage from alien attacks | `TakeDamage(float amount, EDamageType.Physical)` |
| **Game State Machine** | Writes | Player death event | `RequestStateTransition(PlayerDied)` |
| **HUD System** | Writes | HP value, injury state, damage type | `OnHealthChanged(PreviousHP, NewHP, DamageType)` |
| **Inventory System** | Reads/Writes | Consumable items | `HasItem(ConsumableType)`, `ConsumeItem(ConsumableType)` |
| **Animation System** | Writes | Injury state, death animation | `OnInjuryStateChanged(InjuryState)`, death montage trigger |
| **Audio System** | Writes | Breathing state, impact audio, death gasp | `OnHealthChanged` → audio state machine |

## Dependencies

**Hard Dependencies** (system cannot function without):
- **Physics System** ✅ (designed) — provides fall damage velocity via `OnLanded(float velocity)`.
- **Movement System** ✅ (designed) — provides dodge i-frame events (`OnDodgeStarted`/`OnDodgeEnded`) and landing velocity.
- **Game State Machine** ✅ (designed) — receives `RequestStateTransition(PlayerDied)` for GameOver.
- **Input System** ✅ (designed) — provides IA_UseItem for consumable activation.

**Soft Dependencies** (enhanced by but works without):
- **Inventory System** ✅ (designed) — manages consumable items. Without it, healing items have no inventory backing.
- **Combat System** ✅ (designed) — primary source of Physical damage. Without it, only environmental/fall damage exists.

**Depended On By**:

| System | Interface Used | Expected Behavior |
|--------|---------------|-------------------|
| Player Controller | HP state, injury state, death events | Reads health state for input gating (no input when dead) |
| HUD System | HP value, injury state, damage type | Displays health bar (tactical mode), vignette (immersive mode) |
| Combat System | Damage processing | Calls `TakeDamage()` for weapon hits |
| Alien AI System | Damage processing | Calls `TakeDamage()` for alien attacks |
| Animation System | Injury state, death animation | Plays injury-specific animations, death montage |
| Audio System | HP thresholds, damage type | Breathing state, impact sounds, death gasp |

## Tuning Knobs

| Knob | Default | Safe Range | Affects | Too High | Too Low |
|------|---------|------------|---------|----------|---------|
| `MaxHP` | 100 | 50–150 | Overall survivability | Combat feels trivial, no tension | One-shot death, frustrating |
| `FieldDressing_Heal` | 25 | 15–40 | Quick healing potency | Healing too easy, no scarcity | Field dressing useless |
| `Medkit_Heal` | 60 | 40–80 | Full healing potency | Medkit overheals constantly | Medkit feels inadequate |
| `Stimshot_Heal` | 40 | 25–50 | Emergency healing | Stimshot replaces medkit | Stimshot not worth rare slot |
| `FieldDressing_UseTime` | 2.0s | 1.0–4.0 | Healing vulnerability window | Too safe to heal | Never viable to heal |
| `Medkit_UseTime` | 4.0s | 2.0–6.0 | Full treatment vulnerability | Medkit too safe | Medkit impossible to use |
| `Stimshot_UseTime` | 0.8s | 0.5–1.5 | Emergency response speed | Stimshot too spammable | Stimshot too slow for emergency |
| `EnvDamage_BaseRate` | 5 HP/s | 2–10 | Hazard zone lethality | Hazards are instant death | Hazards ignored |
| `InfectionExposure_Rate` | 3 HP/s | 1–8 | Biomass zone danger | Biomass = instant death | Biomass walkable with no risk |
| `Wounded_Threshold` | 50 HP | 40–60 | When audio warnings start | Warnings too early, constant | Warnings too late, no prep time |
| `Critical_Threshold` | 25 HP | 15–35 | When mechanical penalties start | Penalties too early, death spiral | Penalties too late, no warning |
| `NearDeath_Threshold` | 10 HP | 5–15 | When severe penalties start | Near-death too broad | Near-death = already dead |
| `Critical_WalkSpeedPenalty` | 0.9 (−10%) | 0.8–0.95 | Critical state slowdown | Can't escape danger | Penalty not felt |
| `NearDeath_WalkSpeedPenalty` | 0.8 (−20%) | 0.6–0.9 | Near-death slowdown | Movement too crippled | No urgency to heal |

## Visual/Audio Requirements

### Art Bible Principles Governing Health

| Principle | Application |
|-----------|------------|
| **Survival Tension Through Visual Legibility** (Pillar 3) | Health degradation is readable through character state, not UI. Posture changes, breathing escalates, blood accumulates on gear — the player *sees* their condition. |
| **Earned Revelation Through Scarcity** (Pillar 2) | Healing items are visually distinct but rare. Finding a medkit should feel like a discovery, not a vending machine restock. |
| **No Heroic Poses** (Art Bible) | Death is ungraceful — a 90kg soldier collapsing, not a dramatic fall. Injury animations show pain and adaptation, not stoic endurance. |

### VFX Per Health Event

| Event | VFX | Audio |
|-------|-----|-------|
| **Physical damage (hit)** | Directional screen flash (bone white tint, 0.1s), impact particles at hit location | Impact thud + character grunt (pitch varies by damage amount) |
| **Fall damage (landing)** | Camera shake (scales with velocity), landing dust/debris per surface | Bone-crack audio + heavy exhale, surface-specific landing sound |
| **Environmental damage (tick)** | Zone-specific screen distortion (fire = heat shimmer, toxic = green tint, electric = static) | Tick damage audio (repeating, zone-specific) |
| **Infection exposure** | Green vignette pulse (0.3s every 1s), spore particles at feet | Coughing audio, organic squelch from biomass contact |
| **Healing (Field Dressing)** | Bandage application animation, blood stain fades slightly | Fabric tear, bandage wrap, breathing eases |
| **Healing (Medkit)** | Full treatment animation, blood stains reduce significantly | Medkit open, injection/application, deep relief breath |
| **Healing (Stimshot)** | Injection animation, 1.5s screen blur post-use | Syringe snap, sharp inhale, adrenaline rush audio |
| **Death** | 0.5s collapse montage → ragdoll blend, no VFX | Sharp gasp (1.0s per GSM), body impact, ragdoll audio |

### Injury State Visual/Audio Progression

| State | Visual | Audio | Animation |
|-------|--------|-------|-----------|
| **Operational** (100–51) | Clean gear, normal posture | Normal breathing (1.0s cycle) | Standard locomotion |
| **Wounded** (50–26) | Blood stains on gear, 5% red vignette edges | Breathing rate increases, occasional sharp exhale | Standard locomotion |
| **Critical** (25–11) | More blood, 15% vignette, hunched posture | Labored breathing, grunts on movement input | Slight limp, weapon held lower |
| **Near Death** (10–1) | Heavy blood, 30% vignette, red pulse every 2s | Gasping, frequent grunts, gear sounds heavier | Noticeable limp, slower transitions, stagger on direction changes |

### Performance Budget

| Metric | Budget |
|--------|--------|
| Health VFX frame budget | < 0.3ms |
| Active blood decals | Max 5 simultaneous |
| Screen distortion effects | Single pass post-process |

## UI Requirements

| Context | HUD Element | Notes |
|---------|-------------|-------|
| Immersive mode (default) | Blood vignette on screen edges | Opacity scales with injury state (5%/15%/30%). No numeric HP. |
| Immersive mode (default) | No health bar | Health communicated through character state and audio. |
| Tactical HUD (toggleable) | Health bar (top-left) | Numeric HP readout (e.g., "73/100"). Color shifts: green (51+), orange (26–50), red (1–25). |
| Tactical HUD (toggleable) | Damage direction indicator | Brief arrow flash showing damage source direction (physical damage only). |
| Healing in progress | Contextual progress bar | Small circular indicator near crosshair during consumable use. Shows remaining time. |
| Death screen | "Restart from Checkpoint?" prompt | Minimal UI. No score, no stats. GSM controls transition. |

## Acceptance Criteria

- **GIVEN** player character is alive, **WHEN** player inspects health pool, **THEN** maximum HP is exactly 100 and cannot be increased by any in-game action.

- **GIVEN** player has taken damage and is below 100 HP, **WHEN** player waits 60 seconds without using any healing item, **THEN** HP remains unchanged (no passive regen).

- **GIVEN** player at 100 HP, **WHEN** player takes 30 physical damage, **THEN** HP = 70 AND `OnHealthChanged(100, 70, Physical)` fires.

- **GIVEN** player initiates dodge, **WHEN** damage is dealt during the 0.25s i-frame window, **THEN** damage is fully negated AND HP unchanged AND no VFX/audio plays.

- **GIVEN** player falls and impacts at 700 cm/s, **WHEN** impact occurs, **THEN** fall damage = 0 AND HP unchanged.

- **GIVEN** player falls and impacts at 1200 cm/s, **WHEN** impact occurs, **THEN** fall damage = 60 AND HP = 40.

- **GIVEN** player falls at 1200 cm/s while in crouch state, **WHEN** impact occurs, **THEN** fall damage = 30 (60 × 0.5, ceil) AND HP = 70.

- **GIVEN** player in hazard zone with M_zone=1.0, **WHEN** player remains for 4 seconds, **THEN** environmental damage = 20 HP (5 × 1.0 × 4).

- **GIVEN** player in contact with alien biomass, **WHEN** player remains for 5 seconds, **THEN** infection exposure damage = 13.5 HP (3 × (5 − 0.5)).

- **GIVEN** player at 40 HP, **WHEN** player uses Field Dressing without interruption, **THEN** HP = 65 (40 + 25) after 2.0s.

- **GIVEN** player begins using Field Dressing, **WHEN** player moves or takes damage before 2.0s completes, **THEN** healing is cancelled AND no HP restored AND item is consumed.

- **GIVEN** player at 30 HP begins using Medkit, **WHEN** player moves during 4.0s application, **THEN** healing is cancelled AND no HP restored AND item is consumed.

- **GIVEN** player at 30 HP remains stationary for full Medkit application, **WHEN** 4.0s completes, **THEN** HP = 90 (30 + 60).

- **GIVEN** player at 50 HP uses Stimshot, **WHEN** 0.8s completes (regardless of movement or incoming damage), **THEN** HP = 90 (50 + 40).

- **GIVEN** player at 80 HP uses Medkit (+60), **WHEN** application completes, **THEN** HP = 100 (capped, not 140).

- **GIVEN** player at 51 HP (Operational), **WHEN** player takes 1 damage, **THEN** player enters Wounded state AND breathing audio escalates AND 5% blood vignette appears.

- **GIVEN** player at 26 HP (Wounded), **WHEN** player takes 1 damage, **THEN** player enters Critical state AND walk speed = 540 cm/s (600 × 0.9) AND stamina regen = 16/s (20 × 0.8).

- **GIVEN** player at 11 HP (Critical), **WHEN** player takes 1 damage, **THEN** player enters Near Death state AND walk speed = 480 cm/s (600 × 0.8) AND stamina regen = 12/s (20 × 0.6) AND dodge recovery = 0.40s.

- **GIVEN** player at 1 HP, **WHEN** player takes 1+ damage, **THEN** collapse montage plays over 0.5s, ragdoll blends over 0.3s, `RequestStateTransition(PlayerDied)` fires, and on restart player has 100 HP at last checkpoint.

- **GIVEN** player at 100 HP uses Field Dressing, **WHEN** application completes, **THEN** HP = 100 (no change) AND item is consumed.

## Open Questions

| # | Question | Owner | Target Resolution |
|---|----------|-------|-------------------|
| OQ-1 | Should infection exposure apply a stacking debuff (e.g., blurred vision) beyond HP damage, or is HP loss sufficient? | game-designer | Infection Spread System GDD |
| OQ-2 | Should healing consumables have inventory weight/cap limits? | design | Inventory System GDD |
| OQ-3 | Should dodge i-frames have a cooldown between uses (separate from stamina cost)? | game-designer | Combat System GDD |
| OQ-4 | Should environmental damage types have resistance upgrades (e.g., fire-resistant gear)? | design | After progression system design |
| OQ-5 | Should death screen show cause of death (e.g., "Killed by: Fall", "Killed by: Alien Melee")? | game-designer | HUD System GDD |
| OQ-6 | Should there be a brief invulnerability window after checkpoint reload (grace period)? | game-designer | Before MVP implementation |
