# Stealth System

> **Status**: Draft
> **Author**: user + agents
> **Last Updated**: 29 April 2026
> **Last Verified**: 29 April 2026
> **Implements Pillar**: Pillar 1 (Hostile World), Pillar 3 (Tense Survival)

## Overview

The Stealth System governs how the player avoids detection by alien threats in Hostile World. It calculates detection risk based on player noise, visibility, line of sight, environmental factors, and alien perception capabilities. Stealth is not a binary state — it is a gradient of risk that the player must actively manage through movement choices, environmental awareness, and timing. When detection reaches its threshold, the system triggers combat engagement and the player must either fight or flee.

The system operates as both a **data layer** (detection values, noise propagation, visibility calculations, alert states) and a **player-facing experience** (the tension of being hunted, the relief of slipping past a patrol, the panic of a near-miss). It reads noise data from the Movement System, visibility modifiers from the Camera System, and alien perception parameters from the Alien AI System, then produces a detection score that drives AI behavior and IMC switching.

**Key design decisions:**
1. **Detection is a gradient, not binary** — a single detection score (0–100) that rises and falls. No "detected/not detected" toggle.
2. **Noise is the primary stealth variable** — Movement System emits noise; Stealth System propagates it to AI. Most detection events are auditory, not visual.
3. **Environment matters** — snow, ice, alien biomass, darkness, and weather all affect detection. The hostile world is part of the stealth equation.
4. **Recovery is possible** — once detected, the player can break line of sight and go quiet to reduce detection. Detection decays over time if the player hides.
5. **Alien perception is asymmetric** — different alien types have different sensory capabilities (some hear better, some see in darkness, some track biomass disturbance).

> **Quick reference** — Layer: `Core` · Priority: `MVP` · Key deps: `Player Controller, Movement System, Alien AI System, Camera System, Physics System`

## Player Fantasy

Stealth in Hostile World is not about being invisible — it is about being careful. The player character is a trained black ops operator who knows how to move quietly, read sightlines, and use cover. But they are not a ghost. Every footstep in snow leaves a print. Every breath in cold air creates vapor. Every sprint across open ground makes noise that carries for hundreds of meters. The player is skilled, not supernatural.

The tension comes from **managed risk**: the player constantly weighs the cost of speed against the cost of silence. Sprinting gets you to cover faster but alerts every alien in range. Crouching is quiet but slow — and the world is transforming around you, so time is not neutral. The alien terraforming does not wait for you to be ready.

This is the fantasy of **calculated survival**: the player who reads the environment, times their movements, and slips through danger not by being unseen but by being smart. When detection rises, the player feels the weight of their mistakes — not a UI warning, but the alien turning its head, the sound of shifting biomass, the sense that something knows you are here. When detection falls, the relief is earned — you made the right call, you read the terrain, you survived by thinking.

This serves **Pillar 1 (Hostile World)** — the environment itself is a stealth factor. Snow betrays your footsteps. Darkness hides you. Alien biomass amplifies your noise. The world is not a passive backdrop; it is an active participant in every stealth encounter. And **Pillar 3 (Tense Survival)** — stealth is not a safe mode. It is a high-stakes gamble where one mistake can cascade into combat you may not survive.

## Detailed Design

### Core Rules

**Rule 1 — Detection Score**

The Stealth System maintains a single **detection score** (0–100) that represents the cumulative risk of being discovered by alien threats. This score is calculated per alien per frame, then the highest individual detection score becomes the player's global detection level.

| Detection Range | State | AI Behavior | Player Feedback |
|-----------------|-------|-------------|-----------------|
| **0–24** | **Hidden** | AI in patrol/idle state. No awareness of player. | No feedback. Player is invisible. |
| **25–49** | **Suspicious** | AI investigates last known player position. Alert posture. | Subtle audio cue: alien vocalization, biomass stirring. |
| **50–74** | **Alert** | AI actively searches. Moves toward player's last known position. Scans environment. | Audio cue intensifies. Camera slight zoom. Tension music layer. |
| **75–99** | **Engaged** | AI has visual or auditory lock. Moving toward player. Combat imminent. | Audio cue loud. Screen edge vignette pulses red. IMC_Combat pushed. |
| **100** | **Detected** | Combat engaged. AI attacks. Stealth broken. | Full combat state. IMC_Combat active. Stealth meter hidden. |

**Detection score is per-alien**: each alien maintains its own detection score for the player. The player's global detection level = max(all individual alien detection scores).

**Rule 2 — Detection Calculation**

Each alien calculates detection score per frame using this formula:

`D_total = D_noise + D_visual + D_environmental + D_memory`

Each component is calculated independently, then summed and clamped to 0–100.

**D_noise — Auditory Detection:**

`D_noise = clamp(N_player × P_hearing × D_distance_decay × M_surface_noise, 0, 40)`

| Variable | Source | Description |
|----------|--------|-------------|
| N_player | Movement System | Player's current noise level (0–100) |
| P_hearing | Alien AI System | Alien's hearing sensitivity (0.5–2.0 multiplier) |
| D_distance_decay | Calculated | 1 / (1 + (distance / 500)²) — inverse square falloff |
| M_surface_noise | Physics System | Surface noise modifier from Movement System table (snow=×1.2, ice=×0.5, biomass=×1.5, concrete=×1.0). Does NOT include weather — weather is part of E_environmental. |

**Maximum contribution: 40 points.**

**D_visual — Visual Detection:**

`D_visual = clamp(V_base × LOS × P_vision × D_distance_decay_vis × M_lighting, 0, 35)`

| Variable | Source | Description |
|----------|--------|-------------|
| V_base | Calculated | Player visibility from Movement System state (0–100) |
| LOS | Line trace | 1.0 if clear line of sight, 0.0 if fully blocked, 0.5 if partial (through foliage/biomass) |
| P_vision | Alien AI System | Alien's vision acuity (0.5–2.0 multiplier) |
| D_distance_decay_vis | Calculated | 1 / (1 + (distance / 300)²) — steeper falloff than hearing |
| M_lighting | Environment | Lighting modifier: daylight=1.0, dusk=0.7, night=0.4, alien glow=1.3 |

**Maximum contribution: 35 points.**

**D_environmental — Environmental Factors:**

`D_environmental = E_weather + E_terrain + E_infection`

| Factor | Range | Description |
|--------|-------|-------------|
| E_weather | -5 to +10 | Rain masks noise (-5), snow crunch adds noise (+5), wind howls mask both (+3 noise, -2 visual) |
| E_terrain | -10 to +5 | See E_terrain lookup table below |
| E_infection | 0 to +15 | Proximity to active alien biomass: +15 if standing on biomass, +5 if within 200cm |

**E_terrain Lookup Table:**

| Terrain Condition | E_terrain Value | Engine Definition |
|-------------------|-----------------|-------------------|
| Dense cover (foliage, walls within 100cm) | -10 | Player in `ECover` component zone OR 3+ opaque objects within 200cm sphere |
| Partial cover (1–2 objects within 200cm) | -5 | 1–2 opaque objects within 200cm sphere |
| Open ground (no cover within 500cm) | +5 | No opaque objects within 500cm sphere |
| Elevated position (player above alien by >200cm) | +3 | Player Z - Alien Z > 200cm |
| Neutral (mixed cover, 200–500cm) | 0 | Default — no strong cover or exposure |

**Maximum contribution: +30 points (can be negative: -15).**

**D_memory — Suspicion Persistence:**

`D_memory = clamp(M_last_known × T_decay, 0, 25)`

| Variable | Description |
|----------|-------------|
| M_last_known | If player was detected in last 30s: last known detection score × 0.5. Otherwise 0. |
| T_decay | Time-based decay: 1.0 at t=0, linear to 0.0 at t=30s. |

**Maximum contribution: 25 points.** Memory ensures that once an alien is suspicious, it stays suspicious for a period even if the player goes quiet.

**Rule 3 — Detection State Transitions**

Detection states transition based on the global detection level (max of all individual alien scores).

| From State | To State | Trigger | Notes |
|------------|----------|---------|-------|
| Hidden | Suspicious | Any alien's D_total ≥ 25 | First warning sign |
| Suspicious | Hidden | All aliens' D_total < 25 for 5.0s | Cooldown prevents flickering |
| Suspicious | Alert | Any alien's D_total ≥ 50 | Escalation |
| Alert | Suspicious | All aliens' D_total < 50 for 3.0s | De-escalation with cooldown |
| Alert | Engaged | Any alien's D_total ≥ 75 | Combat imminent |
| Engaged | Alert | All aliens' D_total < 75 AND player breaks LOS for 5.0s | Stealth state de-escalates. IMC_Combat remains active (Combat System owns IMC pop). Player can continue re-stealthing. |
| Engaged | Detected | Any alien's D_total = 100 | Full combat |
| Detected | Engaged | All aliens' D_total < 100 AND player breaks LOS for 3.0s | Recovery from full detection |

**Cooldown rule**: State transitions downward (de-escalation) require a cooldown period to prevent rapid state flickering. State transitions upward (escalation) are instant — no cooldown.

**Rule 4 — Environmental Stealth Modifiers**

The environment actively affects stealth. These modifiers are read from the Physics System and Scene Management.

**Surface Noise Modifiers (already defined in Movement System, referenced here):**

| Surface | Walk Noise | Sprint Noise | Crouch Noise |
|---------|-----------|-------------|--------------|
| Snow | ×1.2 | ×1.1 | ×1.3 |
| Ice | ×0.5 | ×0.7 | ×0.4 |
| Concrete | ×1.0 | ×1.0 | ×1.0 |
| Alien Biomass | ×1.5 | ×1.3 | ×1.8 |
| Wood | ×1.1 | ×1.2 | ×1.0 |

**Lighting Modifiers:**

| Condition | Visual Detection Modifier | Notes |
|-----------|--------------------------|-------|
| Daylight (clear sky) | ×1.0 | Full visibility |
| Daylight (overcast) | ×0.8 | Reduced visibility |
| Dusk/Dawn | ×0.7 | Low light |
| Night (no moon) | ×0.4 | Very low visibility |
| Night (full moon) | ×0.6 | Moderate visibility |
| Alien biomass glow | ×1.3 | Biomass emits green bioluminescence — increases visibility near infected zones |
| Flashlight active | ×2.0 | Player becomes highly visible but can see further |
| Flashlight active (crouched, aimed down) | ×1.2 | Reduced beam spread when crouched |

**Weather Modifiers:**

| Weather | Noise Modifier | Visual Modifier | Notes |
|---------|---------------|-----------------|-------|
| Clear | ×1.0 | ×1.0 | Baseline |
| Light snow | ×1.1 | ×0.9 | Snow crunch + slight visual obstruction |
| Heavy snow | ×1.2 | ×0.6 | Loud footsteps but reduced visibility |
| Rain | ×0.8 | ×0.7 | Rain masks noise and reduces visibility |
| Wind (gust) | ×0.9 | ×0.8 | Wind noise masks player but also alien audio cues |
| Fog | ×1.0 | ×0.4 | Severe visual reduction, noise unaffected |

**Rule 5 — Stealth Recovery**

Once detected, the player can recover stealth by breaking line of sight and reducing noise.

**Recovery Process:**
1. Player breaks LOS with all detecting aliens (no alien has visual contact).
2. Player reduces noise to <20 (crouch or idle on quiet surface).
3. Detection score decays at rate of `R_decay = 10/s` (base) × `M_environment`.
4. When detection drops below 75, state transitions from Engaged → Alert.
5. When detection drops below 50, state transitions from Alert → Suspicious.
6. When detection drops below 25 and stays there for 5.0s, state transitions from Suspicious → Hidden.

**Recovery is harder in some environments:**
- On alien biomass: decay rate ×0.5 (biomass "remembers" your presence).
- In heavy snow: decay rate ×1.2 (footprints are covered faster).
- In rain: decay rate ×1.3 (rain washes away traces).

**Rule 6 — Silent Takedown (OUT OF SCOPE for MVP)**

Silent takedowns are explicitly excluded from MVP.

**Rationale:** (1) Pillar conflict — player is outnumbered and outgunned. Silent takedowns imply combat mastery, opposite of "surviving ugly." (2) Animation complexity — per-alien takedown animations, IK, edge cases. (3) Balance disruption — if takedowns exist, players will optimize around them, reducing stealth tension. (4) MVP focus — stealth is about avoidance, not elimination.

**Future consideration:** If post-MVP design requires limited takedowns: only from behind, only on isolated aliens, high noise cost (50), stamina cost (30), 2.0s animation window (interruptible), one-use per alien type (aliens learn and guard against it).

**Rule 7 — IMC_Stealth Push/Pop Reconciliation**

The Player Controller GDD states "IMC_Stealth pushed when player crouches." The Stealth System states "IMC_Stealth pushed when detection ≥25." These are **dual triggers** — IMC_Stealth is active when EITHER condition is true:

- **Trigger A**: Player toggles crouch (Movement System) → IMC_Stealth pushed.
- **Trigger B**: Any alien's detection score ≥25 (Suspicious state) → IMC_Stealth pushed.
- **Pop condition**: BOTH crouch is untoggled AND all aliens' detection <25 for 5.0s → IMC_Stealth popped.

This ensures that crouching always grants stealth input options (lean, silent movement) even when undetected, AND that detection escalation always grants stealth input options even when standing. The two triggers are independent; IMC_Stealth persists as long as at least one is active.

### States and Transitions

| State | Detection Range | Entry Condition | Exit Condition | IMC Active |
|-------|----------------|-----------------|----------------|------------|
| **Hidden** | 0–24 | Game start, or all aliens <25 for 5.0s | Any alien ≥25 | IMC_Default or IMC_Stealth |
| **Suspicious** | 25–49 | Any alien ≥25 | All aliens <25 for 5.0s OR any alien ≥50 | IMC_Stealth pushed (see Rule 7) |
| **Alert** | 50–74 | Any alien ≥50 | All aliens <50 for 3.0s OR any alien ≥75 | IMC_Stealth + IMC_Combat queued |
| **Engaged** | 75–99 | Any alien ≥75 | All aliens <75 + LOS broken 5.0s OR any alien =100 | IMC_Combat pushed |
| **Detected** | 100 | Any alien =100 | All aliens <100 + LOS broken 3.0s | IMC_Combat active |

### Interactions with Other Systems

| System | Direction | Data Flow | Interface |
|--------|-----------|-----------|-----------|
| **Movement System** | Reads | Noise level (0–100), visibility modifier, movement state, surface type | `GetCurrentNoiseLevel()`, `GetVisibilityModifier()`, `OnMovementStateChanged()` |
| **Player Controller** | Reads + Writes | Detection state, IMC_Stealth push/pop | `OnDetectionStateChanged()`, `GetCurrentDetectionLevel()`, PC pushes IMC_Stealth when detection ≥25 |
| **Alien AI System** | Reads + Writes | Alien perception data, detection scores per alien, patrol behavior | `GetAlienPerception(AlienID)`, `SetDetectionScore(AlienID, float)`, `OnAlienAlertStateChanged()` |
| **Camera System** | Reads | Camera mode, FOV | `GetCurrentMode()`, `GetFOV()` — affects visual detection via LOS and FOV-based awareness |
| **Physics System** | Reads | Surface type, weather state, zone infection level | `GetSurfaceType()`, `GetCurrentWeather()`, `GetZoneInfectionLevel()` |
| **Combat System** | Writes | Combat engagement trigger | `OnStealthBroken()` — fires when detection reaches 100 |
| **HUD System** | Writes | Detection level indicator (immersive), stealth meter (tactical) | `SetDetectionLevel(float)`, `SetStealthState(EStealthState)` |
| **Health System** | Reads | Player HP (affects noise — injured = louder breathing) | `GetCurrentHP()`, `GetInjuryState()` |
| **Scene Management** | Reads | Zone state, infection level, time of day | `GetCurrentZone()`, `GetTimeOfDay()`, `GetWeatherState()` |
| **Audio System** | Writes | Detection state for audio mixing | `OnDetectionStateChanged()` — tension music layer, alien vocalizations |
| **Investigation System** | Reads | Stealth state for clue accessibility | `GetCurrentDetectionLevel()` — some clues only accessible when Hidden |

## Formulas

**Formula 1 — Total Detection Score (Per Alien)**

The `detection_score` formula is defined as:

`D_total = clamp(D_noise + D_visual + D_environmental + D_memory, 0, 100)`

Where:

`D_noise = clamp(N_player × P_hearing × (1 / (1 + (d / 500)²)) × M_environment, 0, 40)`

`D_visual = clamp(V_base × LOS × P_vision × (1 / (1 + (d / 300)²)) × M_lighting, 0, 35)`

`D_environmental = E_weather + E_terrain + E_infection` (range: -15 to +30)

`D_memory = clamp(M_last_known × max(0, 1 - t / 30), 0, 25)`

**Variables:**

| Variable | Symbol | Type | Range | Source | Description |
|----------|--------|------|-------|--------|-------------|
| Player noise level | N_player | float | 0–100 | Movement System | Current noise output from player's movement state |
| Alien hearing | P_hearing | float | 0.5–2.0 | Alien AI System | Per-alien hearing sensitivity multiplier |
| Distance | d | float | 0–2000 cm | Calculated | Distance from player to alien |
| Environment noise mod | M_environment | float | 0.5–2.0 | Physics System | Surface + weather noise modifier |
| Player visibility base | V_base | float | 0–140 | Movement System | Composed as: 100 + visibility_modifier. Sprint=140 (+40%), Crouch=60 (−40%), Walk=100 (baseline), Jump=130 (+30%), Dodge=120 (+20%), Cover=40 (−60%). |
| Line of sight | LOS | float | 0.0, 0.5, 1.0 | Line trace | 1.0=clear, 0.5=partial, 0.0=blocked |
| Alien vision | P_vision | float | 0.5–2.0 | Alien AI System | Per-alien vision acuity multiplier |
| Lighting modifier | M_lighting | float | 0.4–2.0 | Environment | Time of day + weather + flashlight |
| Weather factor | E_weather | float | -5 to +10 | Physics System | Weather noise/visual modifier |
| Terrain factor | E_terrain | float | -10 to +5 | Physics System | Cover, elevation, openness |
| Infection factor | E_infection | float | 0 to +15 | Scene Management | Proximity to alien biomass |
| Memory score | M_last_known | float | 0–50 | Calculated | Half of peak detection if within 30s |
| Memory time | t | float | 0–30s | Calculated | Seconds since last detection event |

**Output Range:** 0 to 100.
**Example:** Player crouching on snow, 400cm from alien with normal hearing/vision, clear LOS, night time, no weather:
- D_noise = clamp(15 × 1.0 × (1/(1+(400/500)²)) × 1.3, 0, 40) = clamp(15 × 0.39 × 1.3, 0, 40) = clamp(7.6, 0, 40) = **7.6**
- D_visual = clamp(60 × 1.0 × 1.0 × (1/(1+(400/300)²)) × 0.4, 0, 35) = clamp(60 × 0.36 × 0.4, 0, 35) = clamp(8.6, 0, 35) = **8.6**
- D_environmental = 0 (clear weather) + 0 (neutral terrain) + 0 (no biomass) = **0**
- D_memory = 0 (no prior detection) = **0**
- D_total = 7.6 + 8.6 + 0 + 0 = **16.2** → Hidden

**Example:** Player sprinting on biomass, 200cm from alien with enhanced hearing, clear LOS, alien glow lighting, heavy snow:
- D_noise = clamp(100 × 1.5 × (1/(1+(200/500)²)) × 1.2, 0, 40) = clamp(100 × 0.72 × 1.2, 0, 40) = clamp(86.4, 0, 40) = **40** (capped)
- D_visual = clamp(140 × 1.0 × 1.5 × (1/(1+(200/300)²)) × 1.3, 0, 35) = clamp(140 × 0.69 × 1.3, 0, 35) = clamp(126.1, 0, 35) = **35** (capped)
- D_environmental = +5 (heavy snow noise) + 5 (open ground) + 15 (on biomass) = **+25**
- D_memory = 0 (no prior detection) = **0**
- D_total = 40 + 35 + 25 + 0 = **100** → Detected

---

**Formula 2 — Detection Decay Rate**

The `detection_decay_rate` formula governs how quickly detection decreases when the player is hidden:

`R_decay = R_base × M_decay_env × M_distance × M_alien_state`

**Variables:**

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| Base decay rate | R_base | float | 10.0 | Detection points per second |
| Decay environment modifier | M_decay_env | float | 0.5–1.3 | Biomass=0.5, heavy snow=1.2, rain=1.3, normal=1.0 |
| Distance modifier | M_distance | float | 0.5–1.0 | Further from alien = faster decay: 1/(1 + (d/1000)) |
| Alien state modifier | M_alien_state | float | 0.5–1.0 | Alien actively searching=0.5, idle=1.0 |

**Output Range:** 2.5 to 13.0 detection points/second.
**Example:** Player hiding in rain, 800cm from idle alien: R = 10 × 1.3 × (1/(1+0.8)) × 1.0 = 10 × 1.3 × 0.56 × 1.0 = **7.3/s**. Full decay from 75 to 0: ~10 seconds.
**Example:** Player hiding on biomass, 200cm from searching alien: R = 10 × 0.5 × (1/(1+0.2)) × 0.5 = 10 × 0.5 × 0.83 × 0.5 = **2.1/s**. Full decay from 75 to 0: ~36 seconds — much harder to escape.

---

**Formula 3 — Noise Propagation Radius**

The `noise_propagation_radius` determines how far player noise travels (defined in Movement System, referenced here for stealth context):

`R_noise = clamp((N_base(S) × M_surface_noise + N_exhaust) × K_scale, 0, 200)`

See Movement System GDD Formula 4 for full definition. The Stealth System uses this radius to determine which aliens receive hearing events. Any alien within R_noise meters of the player receives a noise event with intensity = `N_base(S) × M_surface_noise + N_exhaust`. **Unit note**: R_noise is in meters (per Movement System). Convert to cm (×100) before comparing with alien distance `d` (which is in cm).

## Edge Cases

- **If player is detected (D_total=100) by Alien A but all other aliens are at Hidden (D_total<25)**: Global detection = Detected. Combat state activates. Other aliens transition to Suspicious within 2.0s (they hear the combat). Prevents "only one alien knows" scenario — combat noise propagates.

- **If player breaks LOS with all aliens but noise level remains high (sprinting on concrete)**: Detection does NOT decay. Noise alone can maintain detection. Player must both hide AND be quiet. Prevents "sprint then duck behind wall" exploit.

- **If two aliens detect the player simultaneously from opposite directions**: Both detection scores are calculated independently. Global detection = max of both. If one alien loses LOS but the other maintains it, detection persists. Player must break ALL lines of sight to begin recovery.

- **If player is in Suspicious state and a second alien enters detection range**: The new alien's detection score is calculated from zero (no memory of prior detection). However, the first alien's detection score persists. Global detection = max of both. If the new alien's score is higher, it drives the state escalation.

- **If weather changes mid-stealth (clear → heavy snow)**: All environmental modifiers are recalculated on next frame. Detection scores adjust immediately. No transition animation — weather is a world state, not a player state.

- **If player flashlight is toggled while in Suspicious state**: Visual detection modifier jumps from current value to ×2.0. Detection score may spike into Alert or Engaged range instantly. No warning — the flashlight is a player choice with immediate consequences.

- **If alien is killed while in Alert state**: Alien's detection score is removed from global calculation. If remaining aliens are below threshold, state de-escalates with normal cooldown. Dead aliens do not "broadcast" their detection to others — but combat noise from the kill may trigger nearby aliens.

- **If player is on alien biomass and the zone infection level increases during stealth**: E_infection increases proportionally. Detection score rises even if player is stationary and quiet. The world itself becomes more dangerous. Player must move or accept escalating risk.

- **If detection score is exactly 25.0 (boundary between Hidden and Suspicious)**: State transitions to Suspicious. Boundary values favor the higher state — better to warn the player than to hide a detection event.

- **If player crouches on ice (very quiet) but flashlight is active**: Noise is low (D_noise ≈ 3) but visual is high (D_visual ≈ 25 due to ×2.0 flashlight modifier). Total may still trigger Suspicious. Flashlight negates crouch stealth advantage visually.

- **If all aliens in a zone are killed or leave**: Detection score resets to 0 immediately. State transitions to Hidden with no cooldown. No aliens = no detection.

- **If player is in Engaged state and dodges behind cover during the dodge i-frame window**: Dodge does NOT break detection. Detection is based on last known position + noise, not current frame LOS. Player must remain behind cover for the full LOS break duration (5.0s) to begin recovery.

- **If memory decay timer (30s) expires while player is still in LOS of an alien**: Memory component resets to 0, but D_noise and D_visual continue to contribute. Memory is a bonus, not a requirement for sustained detection.

- **If player is injured (Critical or Near Death state) and crouching**: Injury state increases breathing noise (+15 when exhausted per Movement System). Even crouching on a quiet surface, injured player's noise floor is higher. Stealth is harder when wounded.

- **If zone transitions (player moves from clear zone to infected zone) during stealth**: All environmental modifiers recalculate. E_infection jumps from 0 to +5/+15 depending on proximity. Detection score may spike. Player receives no explicit warning — the environment changes, and the player must adapt.

## Dependencies

**Hard Dependencies** (system cannot function without):
- **Movement System** ✅ (designed) — provides noise level (0–100), visibility modifier, movement state, surface type. Stealth System reads these every frame for detection calculation.
- **Player Controller** ✅ (designed) — receives detection state changes, pushes/pops IMC_Stealth and IMC_Combat based on detection level.
- **Alien AI System** ✅ (designed) — provides alien perception data (hearing, vision), patrol behavior, alert states. Without it, stealth has nothing to detect the player.
- **Physics System** ✅ (designed) — provides surface type, weather state. Environmental modifiers depend on physics data.

**Soft Dependencies** (enhanced by but works without):
- **Camera System** ✅ (designed) — provides lighting conditions, camera mode. Visual detection uses camera exposure data.
- **Scene Management** ✅ (designed) — provides zone infection level, time of day. Environmental factors depend on zone state.
- **Health System** ✅ (designed) — provides injury state. Injured players have higher noise floor.
- **Combat System** ✅ (designed) — receives stealth-broken event. Without it, detection=100 has no combat consequence.
- **HUD System** ✅ (designed) — displays detection level. Without it, player has no stealth feedback.
- **Audio System** (Not Started) — plays tension music, alien vocalizations. Without it, stealth lacks audio feedback.

**Depended On By**:

| System | Interface Used | Expected Behavior |
|--------|---------------|-------------------|
| Player Controller | `GetCurrentDetectionLevel()`, `OnDetectionStateChanged()` | Pushes IMC_Stealth at ≥25, IMC_Combat at ≥75 |
| Alien AI System | `GetDetectionScore(AlienID)`, `SetDetectionScore()` | Each alien reads/writes its own detection score |
| Combat System | `OnStealthBroken()` | Triggered when detection reaches 100 |
| HUD System | `SetDetectionLevel()`, `SetStealthState()` | Displays stealth indicator (immersive) or meter (tactical) |
| Audio System | `OnDetectionStateChanged()` | Tension music layer scales with detection level |
| Investigation System | `GetCurrentDetectionLevel()` | Some clues only accessible when Hidden |
| Health System | `GetInjuryState()` | Injury affects noise floor |

## Tuning Knobs

| Knob | Default | Safe Range | Affects | Too High | Too Low |
|------|---------|------------|---------|----------|---------|
| `SuspiciousThreshold` | 25 | 15–40 | When first warning triggers | Constant false alarms | Player never knows they're at risk |
| `AlertThreshold` | 50 | 35–65 | When AI actively searches | AI always searching | AI never escalates |
| `EngagedThreshold` | 75 | 60–90 | When combat is imminent | Combat triggers too easily | Combat never triggers |
| `DetectedThreshold` | 100 | N/A | Full combat engagement | N/A (fixed) | N/A (fixed) |
| `BaseDecayRate` | 10/s | 5–20 | How fast detection drops | Recovery too easy | Recovery impossible |
| `MemoryDuration` | 30s | 15–60s | How long aliens remember | Aliens forget too fast | Aliens never forget |
| `MemoryDecayMultiplier` | 0.5 | 0.25–0.75 | How much memory contributes | Memory dominates detection | Memory irrelevant |
| `NoiseDistanceFalloff` | 500cm | 300–800cm | How far noise carries | Noise heard everywhere | Noise barely carries |
| `VisualDistanceFalloff` | 300cm | 200–500cm | How far vision reaches | Aliens see through walls | Aliens blind at range |
| `LOSBreakCooldown` | 5.0s | 3.0–10.0s | Time to break detection | Too easy to re-stealth | Impossible to re-stealth |
| `FlashlightVisualMod` | 2.0 | 1.5–3.0 | Flashlight visibility penalty | Flashlight = instant death | Flashlight has no stealth cost |
| `BiomassInfectionMod` | 15 | 5–25 | Biomass proximity penalty | Biomass zones impossible | Biomass has no stealth impact |
| `HeavySnowVisualMod` | 0.6 | 0.4–0.8 | Snow visual obstruction | Snow = invisibility cloak | Snow has no visual effect |
| `RainNoiseMaskMod` | 0.8 | 0.5–1.0 | Rain noise masking | Rain = stealth mode | Rain has no audio effect |
| `DeEscalationCooldown_Hidden` | 5.0s | 3.0–8.0s | Cooldown to return to Hidden | State flickers | Player stuck in Suspicious |
| `DeEscalationCooldown_Alert` | 3.0s | 2.0–5.0s | Cooldown to drop from Alert | Rapid state changes | Alert state persists too long |

## Visual/Audio Requirements

### Art Bible Principles Governing Stealth

| Principle | Application |
|-----------|------------|
| **Environmental Transformation** (Pillar 1) | Stealth is shaped by the transforming world. Alien biomass glows, revealing your position. Snow covers your tracks over time. The environment is not static — it is a stealth variable that changes. |
| **Earned Revelation Through Scarcity** (Pillar 2) | Stealth feedback is minimal and diegetic. No detection meter by default. The player reads alien behavior, environmental cues, and audio to understand their stealth state. Information is earned through observation. |
| **Survival Tension Through Visual Legibility** (Pillar 3) | When detection rises, the player feels it through audio escalation, alien behavior changes, and subtle visual cues — not a UI bar. The tension is in the uncertainty: "Did it hear me? Is it looking?" |

### Detection State Visual/Audio Progression

| State | Visual | Audio | Alien Behavior |
|-------|--------|-------|----------------|
| **Hidden** | No visual feedback. Player is invisible. | Ambient world audio only. | Patrol routes, idle animations. No awareness of player. |
| **Suspicious** | Alien head turns toward player direction. Biomass near alien pulses slightly (green bioluminescence, 0.3s). | Alien vocalization (low click/hiss, -18dB). Biomass stirring audio (wet rustle, -20dB). | Stops patrol. Faces player's last known direction. Scans environment. |
| **Alert** | Camera arm length reduces by 20cm (subtle zoom). Screen edge vignette darkens 5%. Alien moves faster, posture changes. | Tension music layer fades in (low drone, -24dB). Alien vocalizations increase (rapid clicks, -14dB). Biomass pulse intensifies. | Actively searches. Moves toward last known position. Scans with wider FOV. |
| **Engaged** | Screen edge vignette pulses red (10% opacity, 0.5s cycle). Camera FOV narrows to 65°. Alien sprint animation. | Tension music layer at -18dB. Alien aggressive vocalizations (-10dB). Combat music crossfade begins. | Moving directly toward player. Attack wind-up begins. |
| **Detected** | Full combat state. HUD may show threat indicators (tactical mode). Alien attack animation. | Combat music active. Alien attack audio. Player grunt on hit. | Attacking player. No stealth behavior. |

### Stealth Feedback — Immersive vs Tactical

**Immersive mode (default):**
- No detection meter or number.
- Player reads alien behavior: head turns, posture changes, vocalizations.
- Audio is the primary feedback channel — tension music layer, alien sounds, biomass audio.
- Visual cues are environmental: biomass glow, snow disturbance, shadow movement.

**Tactical HUD (toggleable):**
- Detection bar (top-right, small): fills from green (0) → yellow (50) → red (100).
- Current stealth state label: "Hidden", "Suspicious", "Alert", "Engaged", "Detected".
- Per-alien detection indicators (mini dots on screen edge showing direction of detecting aliens).
- Noise radius visualization (circle around player showing current noise propagation range).

### Performance Budget

| Metric | Budget |
|--------|--------|
| Detection calculation per alien | <0.1ms |
| Max aliens calculating detection simultaneously | 20 |
| Stealth VFX frame budget | <0.3ms |
| Audio mixing for tension layer | <0.2ms |

## UI Requirements

| Context | HUD Element | Update Frequency | Condition |
|---------|-------------|-----------------|-----------|
| **Imersive mode** | No stealth UI | — | Default. Player reads alien behavior and audio. |
| **Immersive mode** | Screen edge vignette | On detection change | Subtle darkening at Suspicious, red pulse at Engaged. |
| **Tactical HUD** | Detection bar | Every frame | Small bar (top-right), color-coded. |
| **Tactical HUD** | Stealth state label | On state change | Text: "Hidden", "Suspicious", "Alert", "Engaged", "Detected". |
| **Tactical HUD** | Threat direction indicators | On detection change | Mini dots on screen edge showing detecting alien directions. |
| **Tactical HUD** | Noise radius circle | Every 0.25s | Circle around player showing noise propagation range. |

## Cross-References

| This Document References | Target GDD | Specific Element Referenced | Nature |
|--------------------------|-----------|----------------------------|--------|
| "Player noise level (0–100)" | `design/gdd/movement-system.md` | Noise levels per movement state, surface modifiers | Data dependency |
| "Visibility modifier per state" | `design/gdd/movement-system.md` | Visibility modifiers (sprint=+40%, crouch=-40%) | Data dependency |
| "Exhaustion noise penalty (+15)" | `design/gdd/movement-system.md` | N_exhaust when stamina = 0 | Data dependency |
| "Noise propagation radius" | `design/gdd/movement-system.md` | Formula 4 — noise emission radius | Formula dependency |
| "IMC_Stealth push/pop" | `design/gdd/player-controller.md` | IMC stack management, state-driven input gating | State trigger |
| "IMC_Combat push at ≥75" | `design/gdd/player-controller.md` | Combat engagement triggers IMC_Combat | State trigger |
| "Detection state for IMC routing" | `design/gdd/player-controller.md` | Stealth Mode state in PC state machine | Rule dependency |
| "Alien perception data" | `design/gdd/alien-ai-system.md` (Not Started) | Alien hearing, vision, patrol behavior | Data dependency |
| "Surface type queries" | `design/gdd/physics-system.md` | Surface type for noise/visual modifiers | Data dependency |
| "Zone infection level" | `design/gdd/infection-spread-system.md` (Not Started) | E_infection factor | Data dependency |
| "Weather state" | `design/gdd/physics-system.md` | Current weather for environmental modifiers | Data dependency |
| "Time of day" | `design/gdd/scene-management.md` | Lighting conditions for visual detection | Data dependency |
| "Injury state affects noise" | `design/gdd/health-system.md` | Injury state → breathing noise | Data dependency |
| "Combat engagement on stealth broken" | `design/gdd/combat-system.md` (Not Started) | OnStealthBroken event | State trigger |
| "Stealth state for HUD display" | `design/gdd/hud-system.md` (Not Started) | Detection level indicator | Data dependency |
| "Clue accessibility when Hidden" | `design/gdd/investigation-system.md` (Not Started) | Some clues only accessible at Hidden state | Rule dependency |

## Acceptance Criteria

- **GIVEN** player is standing still (Idle state, noise=0) in darkness (night, no moon) with no aliens within 1000cm, **WHEN** detection is calculated, **THEN** D_total < 10 and player state is Hidden.

- **GIVEN** player is crouching on ice (noise=6) with no flashlight, 500cm from an alien with normal hearing/vision, clear LOS, night time, **WHEN** detection is calculated, **THEN** D_total is between 10–20 and player state is Hidden.

- **GIVEN** player sprints on concrete (noise=80) in daylight, 300cm from an alien with normal hearing/vision, clear LOS, **WHEN** detection is calculated, **THEN** D_total ≥ 75 and player state transitions to Engaged within 1.0s.

- **GIVEN** player is sprinting on alien biomass (noise=100, capped) with flashlight active (×2.0 visual), 200cm from an alien with enhanced hearing (1.5×), clear LOS, alien glow lighting, **WHEN** detection is calculated, **THEN** D_total = 100 and player state is Detected.

- **GIVEN** player transitions from Hidden to Suspicious (D_total crosses 25), **WHEN** state changes, **THEN** IMC_Stealth is pushed by Player Controller and alien vocalization audio plays within 0.2s.

- **GIVEN** player is in Suspicious state, **WHEN** player breaks LOS with all aliens and reduces noise to <20, **WHEN** 5.0s elapse with D_total < 25, **THEN** state transitions to Hidden and IMC_Stealth is popped.

- **GIVEN** player is in Alert state, **WHEN** all aliens' D_total drops below 50, **WHEN** 3.0s elapse, **THEN** state transitions to Suspicious.

- **GIVEN** player is in Engaged state, **WHEN** player breaks LOS with all detecting aliens, **WHEN** 5.0s elapse with D_total < 75, **THEN** state transitions to Alert.

- **GIVEN** player is detected (D_total=100), **WHEN** player breaks LOS and reduces noise, **WHEN** 3.0s elapse with D_total < 100, **THEN** state transitions to Engaged (not directly to Alert — stepped de-escalation).

- **GIVEN** detection memory is active (player was detected 10s ago), **WHEN** D_memory is calculated, **THEN** D_memory = peak_detection × 0.5 × (1 - 10/30) = peak × 0.33.

- **GIVEN** detection memory timer reaches 30s, **WHEN** D_memory is calculated, **THEN** D_memory = 0.

- **GIVEN** player toggles flashlight while in Suspicious state with clear LOS to an alien at 300cm, **WHEN** flashlight activates, **THEN** D_visual increases by factor of 2.0 and D_total may cross into Alert threshold within 1 frame.

- **GIVEN** player is on alien biomass, **WHEN** detection decay is calculated, **THEN** decay rate is multiplied by 0.5 (slower recovery).

- **GIVEN** player is hiding in heavy rain, **WHEN** detection decay is calculated, **THEN** decay rate is multiplied by 1.3 (faster recovery).

- **GIVEN** weather changes from clear to heavy snow mid-stealth, **WHEN** next frame is calculated, **THEN** E_weather changes from 0 to +5 (noise) and M_lighting changes from 1.0 to 0.6 (visual), and all detection scores update immediately.

- **GIVEN** all aliens in a zone are killed, **WHEN** detection is recalculated, **THEN** global detection resets to 0 and state transitions to Hidden immediately.

- **GIVEN** player is in Critical injury state (HP 25–11), **WHEN** player crouches on ice, **THEN** noise level includes injury breathing penalty and D_noise is higher than a healthy player crouching on ice.

- **GIVEN** two aliens detect the player simultaneously from opposite directions, **WHEN** global detection is calculated, **THEN** global detection = max(alien_A_score, alien_B_score). If alien A loses LOS but alien B maintains it, detection persists.

- **GIVEN** player dodges behind cover during dodge i-frame window, **WHEN** LOS is checked, **THEN** dodge does NOT break detection. Player must remain behind cover for full 5.0s LOS break duration to begin recovery.

- **GIVEN** tactical HUD is enabled, **WHEN** detection level changes, **THEN** detection bar updates every frame with color-coded value (green <50, yellow 50–74, red ≥75).

## Open Questions

| # | Question | Owner | Target Resolution |
|---|----------|-------|-------------------|
| OQ-1 | Should aliens share detection information (e.g., Alien A detects player → Alien B becomes suspicious even without direct detection)? Affects group AI behavior. | game-designer | Alien AI System GDD |
| OQ-2 | Should the player have a "hold breath" mechanic (temporary noise reduction at stamina cost)? Classic stealth trope but may conflict with stamina design. | game-designer | Movement System GDD review |
| OQ-3 | Should alien biomass "remember" player presence even after player leaves (persistent disturbance visible to aliens)? Affects infection spread integration. | design | Infection Spread System GDD |
| OQ-4 | How does stealth interact with the Investigation System? Should some clues be inaccessible if detection > Hidden? | game-designer | Investigation System GDD | ✅ Resolved: Yes. Stealth Gate in Investigation System Rule 5 — some clues require detection < 25 (Hidden). |
| OQ-5 | Should stealth have a "confidence meter" — a hidden value that affects how quickly aliens escalate (confident aliens escalate faster, cautious aliens take longer)? | game-designer | Alien AI System GDD |
| OQ-6 | Should the player be able to distract aliens (throw rocks, create noise) as a stealth tool? Adds active stealth playstyle. | game-designer | Combat System GDD review |
| OQ-7 | Multiplayer (future) — how does stealth work with multiple players? Shared detection? Individual? | architecture | Multiplayer ADR |
