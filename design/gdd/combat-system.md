# Combat System

> **Status**: Draft
> **Author**: user + agents
> **Last Updated**: 29 April 2026
> **Last Verified**: 29 April 2026
> **Implements Pillar**: Pillar 1 (Hostile World), Pillar 3 (Tense Survival)

## Overview

The Combat System governs how the player fights alien threats in Hostile World — weapon handling, hit detection, damage output, ammo management, and the transition from stealth to open combat. Combat is not the preferred playstyle; it is a last resort. The player is outnumbered, outgunned, and every bullet counts. The system is designed to make combat feel desperate and consequential: engagements are short, lethal, and resource-draining. Players who rely on combat will run out of ammo, health, and stamina — and the hostile world does not forgive depletion.

The system operates as both a **data layer** (weapon stats, ammo counts, damage values, hit registration) and a **player-facing experience** (the weight of each shot, the panic of reloading under pressure, the relief of killing a threat before it calls for backup). It reads weapon state from the Inventory System, damage processing from the Health System, and engagement triggers from the Stealth System, then produces combat events that drive AI behavior, audio mixing, and IMC switching.

**Key design decisions:**
1. **Combat is punitive, not empowering** — low ammo, high damage, slow reloads. The player survives combat; they do not dominate it.
2. **Weapons are scarce resources** — each weapon has limited ammo found in the world. No weapon vendors, no infinite ammo. Every shot is a decision.
3. **Hit detection is server-authoritative (single-player: Character-authoritative)** — hit registration uses capsule/box traces from weapon muzzle, not hitscan-only. Projectiles have travel time for alien attacks; player weapons are hitscan for responsiveness.
4. **Stealth-to-combat transition is instant** — when detection reaches 100, combat engages immediately. No "you've been spotted" grace period. The alien attacks.
5. **No damage sponges** — aliens die in 2–5 shots depending on type. Combat is short and lethal for both sides.

> **Quick reference** — Layer: `Core` · Priority: `MVP` · Key deps: `Player Controller, Health System, Alien AI System, Inventory System, Stealth System`

## Player Fantasy

Combat in Hostile World is not about power — it is about desperation. The player character is a trained operator with firearms experience, but the aliens are faster, stronger, and more numerous. Every firefight is a calculation: do I have enough ammo? Can I kill this before it calls for backup? Is there a route to escape if this goes wrong?

The fantasy is **survival through violence**, not conquest. When combat starts, the player does not feel like a hero — they feel like someone who made a mistake and is now paying for it. The gun kicks. The reload is slow. The alien charges. Every shot matters because there may not be another one. When the player wins a fight, the relief is not "I'm powerful" — it is "I'm still alive."

This serves **Pillar 3 (Tense Survival)** — combat is the moment where survival tension peaks. Resources are consumed, health is lost, and the player must decide: push forward with what they have, or retreat and find another way. Combat is not a failure state — it is a high-cost option that the player chooses when stealth is no longer viable. And it serves **Pillar 1 (Hostile World)** — the aliens fight back intelligently. They flank, they call for backup, they use the environment. The world does not pause during combat; it accelerates.

## Detailed Design

### Core Rules

**Rule 1 — Weapon Classes**

The Combat System supports four weapon classes, each with distinct behavior, ammo type, and combat role.

| Weapon Class | Fire Mode | Damage | Fire Rate | Effective Range | Ammo Type | Magazine |
|-------------|-----------|--------|-----------|-----------------|-----------|----------|
| **Pistol** | Semi-auto | 25 | 0.4s between shots | 0–1500cm | Pistol rounds | 12 |
| **Shotgun** | Pump-action | 60 (all pellets) | 0.8s between shots | 0–500cm | Shotgun shells | 6 |
| **Rifle** | Semi/Burst (3-round) | 18 per bullet | 0.15s between burst rounds | 0–3000cm | Rifle rounds | 30 |
| **Melee (Improvised)** | Single swing | 15 | 1.0s between swings | 0–150cm | N/A | N/A |

**Weapon Acquisition**: Weapons are found in the world (abandoned military caches, dead soldiers, resistance stashes). No weapon vendors. No crafting weapons. Each weapon found comes with a partial magazine and zero reserve ammo — the player must scavenge ammo separately.

**Weapon Switching**: Player switches weapons via IA_Inventory or quick slots. Switch time: 0.5s (pistol/rifle), 0.7s (shotgun). Cannot switch during reload or fire animation.

**Rule 2 — Hit Detection**

**Player weapons (hitscan)**: All player weapons use hitscan (instant hit) for responsiveness. A line trace from camera center (with small random spread) determines hit target.

| Weapon | Spread (standing) | Spread (crouching) | Spread (moving) | Spread (sprinting) |
|--------|-------------------|--------------------|-----------------|--------------------|
| Pistol | ±1.0° | ±0.5° | ±2.0° | ±4.0° |
| Shotgun | ±3.0° (9 pellets) | ±2.0° (9 pellets) | ±5.0° (9 pellets) | ±8.0° (9 pellets) |
| Rifle | ±0.8° | ±0.4° | ±1.5° | ±3.0° |
| Melee | N/A (cone check) | N/A | N/A | N/A |

**Spread increases with sustained fire**: Each consecutive shot within 1.0s adds +0.3° to spread (cumulative, max +5.0°). Spread resets to base after 1.0s of no firing.

**Alien attacks (projectile)**: Alien attacks use physical projectiles with travel time. This gives the player a visual cue and a chance to dodge.

| Attack Type | Projectile Speed | Damage | Telegraph Time | Travel Time (at 1000cm) |
|-------------|-----------------|--------|----------------|------------------------|
| Alien melee | N/A (contact) | 20 | 0.3s wind-up | N/A |
| Alien ranged (spit) | 1200 cm/s | 15 | 0.5s wind-up | 0.83s |
| Alien charge | N/A (contact) | 25 | 0.4s wind-up | N/A |
| Alien area (biomass burst) | N/A (zone) | 10/s | 1.0s warning | N/A |

**Rule 3 — Damage Output**

Player damage is calculated per hit:

`Damage_dealt = Base_damage × M_location × M_distance × M_weapon_condition × M_alien_armor`

| Variable | Range | Description |
|----------|-------|-------------|
| Base_damage | Per weapon (Rule 1) | Weapon's base damage value |
| M_location | 1.0 (body), 1.5 (head), 0.7 (limb) | Hit location multiplier |
| M_distance | 1.0 (within effective range), 0.5 (beyond effective range) | Distance falloff |
| M_weapon_condition | 1.0 (clean), 0.8 (dirty), 0.6 (damaged) | Weapon condition from wear |
| M_alien_armor | 1.0 (unarmored), 0.6 (armored), 0.3 (heavily armored) | Per-alien armor value |

**Example:** Pistol headshot on unarmored alien at effective range, clean weapon: 25 × 1.5 × 1.0 × 1.0 × 1.0 = **37.5 → 38 damage** (ceil).
**Example:** Shotgun body hit on armored alien at 600cm (beyond effective range), dirty weapon: 60 × 1.0 × 0.5 × 0.8 × 0.6 = **14.4 → 15 damage** (ceil). Note: shotgun fires 9 pellets, so total = 15 × pellets that hit.

**Alien damage to player**: Processed through Health System's damage pipeline (Health System Rule 3). Combat System calls `TakeDamage(amount, EDamageType.Physical)` on the player character.

**Rule 4 — Ammo Management**

Ammo is a scarce resource. No infinite ammo, no regen, no crafting ammo.

| Ammo Type | Max Carry | Found In | Typical Find Amount |
|-----------|-----------|----------|---------------------|
| Pistol rounds | 60 | Military caches, dead soldiers | 6–12 |
| Shotgun shells | 24 | Resistance stashes, hunter camps | 3–6 |
| Rifle rounds | 120 | Military armories, supply caches | 10–20 |

**Reload Rules:**
- Reload time: Pistol 1.5s, Shotgun 0.6s per shell (3.6s full), Rifle 2.0s (magazine swap), Melee N/A.
- Reload can be cancelled 0.3s before completion (partial magazine inserted).
- Reload interrupted by damage: reload cancels, partial ammo is NOT wasted (ammo deducted from reserve at start of reload).
- Tactical reload (magazine not empty): 0.3s longer than standard reload (player must stow partial magazine).
- Empty reload: standard time. Animation includes slide-lock release (pistol/rifle) or bolt pull (shotgun).

**Ammo UI (immersive mode)**: No ammo counter. Player checks ammo by pressing IA_Reload when not empty — character performs a "check magazine" animation (0.5s) and a small HUD element shows current magazine + reserve for 2.0s.
**Ammo UI (tactical HUD)**: Persistent ammo counter (bottom-right). Magazine / Reserve display.

**Rule 5 — Combat Engagement Lifecycle**

Combat follows a strict lifecycle:

1. **Trigger**: Stealth System detection reaches 75 (Engaged state) OR player attacks an alien in Hidden/Suspicious state, OR alien patrol enters engagement range (1500cm) and detects player. Detection at 75 means "combat imminent" — IMC_Combat is pushed at this point. Detection at 100 means "full combat" — alien actively attacks.
2. **Engagement**: IMC_Combat pushed. Combat music fades in. All nearby aliens transition to combat behavior.
3. **Active Combat**: Player and aliens exchange damage. Combat persists as long as at least one alien is in combat state AND (within 2000cm of player OR has player in line of sight). Aliens beyond 2000cm that have lost LOS do not prevent disengagement.
4. **Disengagement**: All aliens within 2000cm are dead OR all aliens have lost LOS and player has been undetected for 10.0s.
5. **Cooldown**: IMC_Combat popped. Combat music fades out. Stealth System recalculates from zero (all aliens reset to Hidden unless memory persists).

**Disengagement Rules:**
- Dead aliens do not prevent disengagement.
- Aliens that lost LOS but are still searching (Alert state) prevent disengagement.
- Player must break LOS with ALL active combat aliens AND remain undetected for 10.0s to disengage.
- If a new alien enters engagement range during cooldown, combat re-engages immediately.

**Rule 6 — Melee Combat**

Melee is a last-resort option. Improvised weapons (pipe, knife, rock) deal low damage and have short range.

| Property | Value | Notes |
|----------|-------|-------|
| Damage | 15 | Per hit |
| Range | 150cm | Cone check (60° arc) |
| Wind-up | 0.2s | Telegraphed — alien can react |
| Recovery | 0.5s | Vulnerable window |
| Stamina cost | 10 | Per swing |
| Hit stun | 0.3s | Alien briefly staggered |
| Consecutive hits | Each adds +0.2s recovery | Spamming melee gets slower |

**Constraints**: Melee not available during Sprint (must decelerate first). Melee not available during Fall. Melee available in Cover (lean out + swing, 0.3s extra wind-up). Melee available in Crouch (lower damage: 10 instead of 15, shorter range: 100cm).

### States and Transitions

| State | Entry Condition | Exit Condition | Behavior |
|-------|----------------|----------------|----------|
| **Non-Combat** | Game start, or disengagement complete | Combat triggered | Normal gameplay. IMC_Default or IMC_Stealth active. |
| **Combat Entry** | Combat triggered | 0.5s elapsed | IMC_Combat pushed immediately (not delayed). Combat music fades in over 0.5s. Camera FOV narrows to 65°. Player can act during entry window. |
| **Active Combat** | Combat Entry complete | Disengagement conditions met | Full combat behavior. Aliens attack. Player can fight or flee. |
| **Disengaging** | All aliens dead OR all lost LOS | 10.0s undetected | IMC_Combat still active. Combat music fades. Player must stay hidden. If Stealth System de-escalates to Alert (detection <75), IMC_Combat remains until full disengagement — Combat System owns the IMC pop decision. |
| **Disengaged** | 10.0s undetected | New combat trigger | IMC_Combat popped. Stealth System resets. Combat music off. |

**State Priority:** Active Combat > Disengaging > Combat Entry > Non-Combat

### Interactions with Other Systems

| System | Direction | Data Flow | Interface |
|--------|-----------|-----------|-----------|
| **Player Controller** | Reads + Writes | IMC_Combat push/pop, input routing | `OnCombatEngaged()`, `OnCombatDisengaged()`, PC pushes IMC_Combat |
| **Health System** | Reads + Writes | Damage to player, damage from player | `TakeDamage(float, EDamageType)`, `OnPlayerDamaged()` |
| **Movement System** | Reads | Dodge i-frames, movement state, stamina | `OnDodgeStarted/Ended()`, `GetCurrentMovementState()`, `GetStamina()` |
| **Stealth System** | Reads + Writes | Detection state, stealth broken event | `OnStealthBroken()`, `GetCurrentDetectionLevel()`, `OnCombatDisengaged()` |
| **Alien AI System** | Reads + Writes | Alien combat behavior, alien health | `SetAlienCombatState(AlienID, bool)`, `GetAlienHealth(AlienID)`, `OnAlienKilled()` |
| **Inventory System** | Reads + Writes | Weapon data, ammo counts, weapon switching | `GetCurrentWeapon()`, `GetAmmoCount(AmmoType)`, `ConsumeAmmo()`, `SwitchWeapon()` |
| **Camera System** | Reads + Writes | Recoil shake, FOV changes, camera mode | `AddRecoil(Amplitude, Duration)`, `SetFOV(65°)` during combat |
| **HUD System** | Writes | Combat indicators, ammo display, threat direction | `SetCombatState(ECombatState)`, `ShowAmmoCount()`, `ShowThreatIndicators()` |
| **Audio System** | Writes | Combat music, weapon SFX, alien combat audio | `PlayWeaponFire(WeaponType)`, `StartCombatMusic()`, `StopCombatMusic()` |
| **Animation System** | Writes | Fire animations, reload animations, melee montages | `PlayFireMontage(WeaponType)`, `PlayReloadMontage()`, `PlayMeleeMontage()` |
| **Physics System** | Reads | Surface type (for bullet impact VFX), collision | `GetSurfaceTypeAtLocation()` |
| **Scene Management** | Reads | Zone state (for combat music mixing) | `GetCurrentZone()` |

## Formulas

**Formula 1 — Player Damage Per Hit**

The `damage_per_hit` formula is defined as:

`D_hit = ceil(D_base × M_loc × M_dist × M_condition × M_armor)`

**Variables:**

| Variable | Symbol | Type | Range | Source | Description |
|----------|--------|------|-------|--------|-------------|
| Base damage | D_base | float | 15–60 | Weapon data (Rule 1) | Weapon's base damage per hit |
| Location multiplier | M_loc | float | 0.7, 1.0, 1.5 | Hit detection | Head=1.5, Body=1.0, Limb=0.7 |
| Distance multiplier | M_dist | float | 0.5–1.0 | Calculated | 1.0 within effective range, 0.5 beyond |
| Weapon condition | M_condition | float | 0.6–1.0 | Inventory System | Clean=1.0, Dirty=0.8, Damaged=0.6 |
| Alien armor | M_armor | float | 0.3–1.0 | Alien AI System | Unarmored=1.0, Armored=0.6, Heavy=0.3 |

**Output Range:** 3 to 90 (before ceil). Clamped to minimum 1 (every hit deals at least 1 damage).
**Example (optimal):** Rifle headshot, clean weapon, unarmored alien, effective range: ceil(18 × 1.5 × 1.0 × 1.0 × 1.0) = **27 damage**. 4 headshots to kill a 100 HP alien.
**Example (worst):** Pistol limb hit, damaged weapon, heavily armored alien, beyond effective range: ceil(25 × 0.7 × 0.5 × 0.6 × 0.3) = ceil(1.575) = **2 damage**. 50 shots to kill — effectively useless.

---

**Formula 2 — Spread Accumulation**

The `current_spread` formula is defined as:

`S_current = S_base + min(N_consecutive × 0.3, 5.0) + S_movement + S_stance`

**Variables:**

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| Base spread | S_base | float | 0.4–3.0° | Per weapon (Rule 2 table) |
| Consecutive shots | N_consecutive | int | 0–16 | Shots fired within last 1.0s |
| Movement penalty | S_movement | float | 0–2.0° | Standing=0, Moving=+1.0, Sprinting=+2.0 |
| Stance bonus | S_stance | float | -0.5 to 0 | Crouching=-0.5°, Standing=0 |

**Output Range:** 0° to 10°. Clamped to 0 minimum.
**Example:** Rifle, 5 consecutive shots, moving, standing: 0.8 + min(5×0.3, 5.0) + 1.0 + 0 = 0.8 + 1.5 + 1.0 = **3.3°**.
**Example:** Pistol, 1 shot, crouching, stationary: 1.0 + 0 + 0 + (-0.5) = **0.5°**.

**Spread reset**: N_consecutive resets to 0 after 1.0s of no firing. Each shot fired within 1.0s of the previous shot increments N_consecutive.

**Clarification**: S_base is the weapon's base spread for the current stance/movement combination (from the spread table in Rule 2). The table values are NOT further modified by S_movement or S_stance — those columns in the table ARE the modifiers already applied. The formula adds consecutive-shot spread on top of the table value. Example: Rifle, moving, 3 consecutive shots: S_current = 1.5° (from table: rifle + moving) + min(3×0.3, 5.0) = 1.5 + 0.9 = **2.4°**.

---

**Formula 3 — Disengagement Timer**

The `disengagement_timer` formula determines how long the player must remain undetected to exit combat:

`T_disengage = T_base + N_alive × T_per_alien + M_cover × T_cover_bonus`

**Variables:**

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| Base disengage time | T_base | float | 10.0s | Minimum time to disengage |
| Alive alien count | N_alive | int | 0–10 | Number of aliens still in combat state |
| Time per alien | T_per_alien | float | 2.0s | Additional time per alive alien |
| In cover bonus | M_cover | float | 0 or 1 | 1 if player is in cover state, 0 otherwise |
| Cover time bonus | T_cover_bonus | float | -3.0s | Time reduction for being in cover |

**Output Range:** 7.0s to 30.0s.
**Example:** 3 aliens alive, player in cover: T = 10 + (3 × 2) + (1 × -3) = 10 + 6 - 3 = **13.0s**.
**Example:** 0 aliens alive (all dead): T = 10 + (0 × 2) + 0 = **10.0s**.
**Example:** 5 aliens alive, player not in cover: T = 10 + (5 × 2) + 0 = **20.0s**.

## Edge Cases

- **If player fires weapon while in dodge i-frame window**: Shot fires normally. Dodge does not block player's own attacks. Dodge i-frames only block incoming damage.

- **If player reloads and is damaged during reload animation**: Reload cancels. Ammo is NOT wasted — ammo was deducted from reserve at reload start. Partial magazine is inserted (full magazine if reload completed past 0.3s before end, partial if cancelled earlier). Prevents "damage-cancel-reload to save ammo" exploit.

- **If player switches weapons during combat entry (0.5s window)**: Weapon switch is queued and executes after combat entry animation completes. Prevents "instant weapon swap to counter specific alien" during engagement transition.

- **If all aliens are killed but one alien's body is still in LOS of another alien (not yet dead)**: Combat persists until ALL aliens are confirmed dead. Dead bodies do not count as "alive aliens" for disengagement calculation.

- **If player melee attacks an alien in Hidden state**: Combat triggers immediately. Stealth is broken. The melee attack is the trigger event — no grace period. Player chose violence.

- **If player's last bullet is fired and magazine is empty**: Auto-reload begins after 0.5s delay (player can cancel by switching weapons or melee). If no reserve ammo, weapon is unusable — player must switch or melee.

- **If shotgun fires at point-blank range (<50cm) and all 9 pellets hit**: Total damage = 60 × 9 × multipliers = up to 540 damage (before armor). One-shot kill on any alien. This is intentional — shotgun is devastating at close range but useless beyond 500cm.

- **If alien projectile hits player during dodge i-frame**: Damage fully negated. No HP loss, no VFX, no audio. Dodge i-frames are absolute — no partial damage.

- **If player is in combat and enters a new zone (Scene Management streaming)**: Combat state persists across zone boundaries. Aliens from the previous zone do not follow, but new zone aliens may engage if player is detected. Disengagement timer resets for new zone.

- **If weapon is damaged (M_condition = 0.6) and player fires**: Weapon has a 5% chance per shot to jam. Jam requires 2.0s to clear (unskippable). Jam chance increases to 15% if weapon is damaged AND dirty.

- **If player has 0 stamina and tries to melee**: Melee fails. No swing, no stamina cost. Prompt shows "Too Exhausted" for 1.0s. Melee requires stamina to swing.

- **If combat disengagement timer is at 9.9s and an alien re-detects the player**: Timer resets to 0. Disengagement fails. Combat re-engages. No partial progress saved.

- **If player aims down sights (FirstPerson scope) during combat**: FOV changes to 60° (scoped). Combat FOV (65°) is overridden by scope FOV. On scope release, FOV returns to 65° (combat), not 75° (default). Combat state is cached during scope.

- **If multiple alien projectiles hit player in the same frame**: Each projectile is processed sequentially through Health System's damage pipeline. Each triggers its own invulnerability check, damage application, and death check. No damage stacking bypasses dodge i-frames.

## Dependencies

**Hard Dependencies** (system cannot function without):
- **Player Controller** ✅ (designed) — pushes/pops IMC_Combat, routes combat input (IA_Attack, IA_Aim, IA_Reload, IA_Melee).
- **Health System** ✅ (designed) — processes damage to player (via `TakeDamage()`), provides player HP state for combat decisions.
- **Inventory System** ✅ (designed) — provides weapon data, ammo counts, weapon switching. Without it, player has no weapons or ammo.
- **Alien AI System** ✅ (designed) — provides alien health, combat behavior, armor values. Without it, combat has no enemies.

**Soft Dependencies** (enhanced by but works without):
- **Stealth System** ✅ (designed) — provides detection state, stealth broken event, disengagement coordination.
- **Movement System** ✅ (designed) — provides dodge i-frames, movement state, stamina. Combat reads dodge state for invulnerability.
- **Camera System** ✅ (designed) — provides recoil shake, FOV changes. Combat writes recoil events to camera.
- **Audio System** (Not Started) — plays combat music, weapon SFX, alien combat audio.
- **HUD System** (Not Started) — displays combat state, ammo count, threat indicators.
- **Animation System** (Not Started) — plays fire, reload, and melee montages.

**Depended On By**:

| System | Interface Used | Expected Behavior |
|--------|---------------|-------------------|
| Health System | `TakeDamage()` calls | Processes damage from alien attacks |
| Alien AI System | `SetAlienCombatState()`, `OnAlienKilled()` | Receives combat state changes, alien death events |
| Stealth System | `OnCombatDisengaged()` | Resets detection when combat ends |
| HUD System | `SetCombatState()`, `ShowAmmoCount()` | Displays combat UI elements |
| Audio System | `PlayWeaponFire()`, `StartCombatMusic()` | Plays combat audio |
| Animation System | `PlayFireMontage()`, `PlayReloadMontage()` | Plays combat animations |
| Investigation System | `GetCurrentCombatState()` | Some clues inaccessible during combat |

## Tuning Knobs

| Knob | Default | Safe Range | Affects | Too High | Too Low |
|------|---------|------------|---------|----------|---------|
| `PistolDamage` | 25 | 15–40 | Pistol lethality | Pistol kills too fast, reduces ammo tension | Pistol useless, never worth using |
| `ShotgunDamage` | 60 | 40–80 | Shotgun close-range power | One-shots everything, no risk | Shotgun not worth carrying |
| `RifleDamage` | 18 | 12–30 | Rifle sustained fire | Rifle dominates all encounters | Rifle not worth ammo cost |
| `MeleeDamage` | 15 | 10–25 | Melee viability | Melee is viable combat option | Melee never worth using |
| `PistolMagazine` | 12 | 8–20 | Pistol sustained fire | Too many shots before reload | Constant reloading in combat |
| `ShotgunMagazine` | 6 | 4–10 | Shotgun sustained fire | Too many shells, shotgun too strong | Too few, shotgun feels weak |
| `RifleMagazine` | 30 | 20–45 | Rifle sustained fire | Rifle never needs reload | Constant reloads break flow |
| `PistolReloadTime` | 1.5s | 1.0–2.5s | Pistol reload vulnerability | Reload too safe | Reload = death sentence |
| `ShotgunReloadPerShell` | 0.6s | 0.4–1.0s | Shotgun reload pacing | Reload too fast | Reload impossibly slow |
| `RifleReloadTime` | 2.0s | 1.5–3.0s | Rifle reload vulnerability | Reload too safe | Reload = death sentence |
| `SpreadPerShot` | 0.3° | 0.1–0.8° | Accuracy degradation | Spray and pray viable | Single-shot only, no sustained fire |
| `SpreadResetTime` | 1.0s | 0.5–2.0s | Time to reset accuracy | Spread never matters | Spread punishes any follow-up |
| `DisengageBaseTime` | 10.0s | 7.0–15.0s | Minimum disengage time | Too easy to escape | Impossible to disengage |
| `DisengagePerAlien` | 2.0s | 1.0–4.0s | Extra time per alive alien | Alive aliens don't matter | Too many aliens = impossible |
| `CoverDisengageBonus` | -3.0s | -5.0 to -1.0s | Cover reduces disengage time | Cover = instant escape | Cover doesn't help |
| `WeaponJamChance_Dirty` | 0.05 | 0.01–0.15 | Jam frequency on dirty weapons | Jam too common, frustrating | Jam never happens |
| `WeaponJamChance_DamagedDirty` | 0.15 | 0.05–0.30 | Jam frequency on damaged+dirty | Weapons unreliable | No consequence for weapon condition |
| `MeleeStaminaCost` | 10 | 5–20 | Melee resource cost | Melee spammable | Melee too expensive |
| `MeleeRecoveryBase` | 0.5s | 0.3–0.8s | Melee vulnerability window | Melee too safe | Melee = suicide |
| `HeadshotMultiplier` | 1.5 | 1.2–2.0 | Headshot bonus | Headshots too rewarding | Headshots not worth aiming for |
| `LimbMultiplier` | 0.7 | 0.5–0.9 | Limb hit penalty | Limb hits too punishing | Limb hits same as body |

## Visual/Audio Requirements

### Art Bible Principles Governing Combat

| Principle | Application |
|-----------|------------|
| **Survival Tension Through Visual Legibility** (Pillar 3) | Combat VFX are readable and grounded. Muzzle flashes are brief and realistic, not Hollywood explosions. Blood is minimal — alien blood is dark, viscous, not geyser-red. The player sees hits land but is not overwhelmed by particle effects. |
| **No Heroic Poses** (Art Bible) | Combat animations are utilitarian. No dramatic reloads, no victory poses, no slow-motion kills. The player fires, reloads, and moves with professional efficiency — not cinematic flair. |
| **Environmental Transformation** (Pillar 1) | Combat leaves marks on the world. Bullet holes persist. Alien blood stains surfaces. Spent casings litter the ground. The environment remembers the fight. |

### VFX Per Combat Event

| Event | VFX | Audio |
|-------|-----|-------|
| **Weapon fire (pistol)** | Muzzle flash (2 frames, orange), casing ejection, bullet impact (surface-specific) | Sharp crack (pistol-specific), casing clink, bullet impact thud |
| **Weapon fire (shotgun)** | Large muzzle flash (3 frames, orange-yellow), shell ejection, spread impact pattern | Deep boom, shell clatter, multiple impact sounds |
| **Weapon fire (rifle)** | Moderate muzzle flash (2 frames, orange), casing ejection, bullet impact | Controlled crack, rapid casing ejection, bullet impact |
| **Reload (pistol)** | Magazine drop, new magazine insert, slide release | Magazine clack, slide click, ready |
| **Reload (shotgun)** | Shell insert (per shell), bolt pull | Shell click (×N), bolt clack |
| **Reload (rifle)** | Magazine drop, new magazine insert, bolt release | Magazine clack, bolt click, ready |
| **Melee hit** | Impact spark/dust, alien stagger animation | Wet thud, alien grunt, weapon impact |
| **Melee miss** | Swing animation, no impact | Whoosh, recovery breath |
| **Alien projectile hit (player)** | Impact flash (green), screen distortion, blood vignette | Alien spit impact, player grunt, wet splatter |
| **Alien melee hit (player)** | Impact flash, screen shake, blood vignette | Alien roar, player grunt, body impact |
| **Alien killed** | Collapse animation, alien blood pool (persistent decal), no explosion | Alien death vocalization, body impact, silence |
| **Weapon jam** | Weapon malfunction animation (rack slide, clear chamber) | Metallic click, frustrated rack, clear |
| **Combat entry** | Camera FOV narrows to 65°, screen edge vignette pulses | Combat music fade-in (0.5s), tension drone |
| **Combat disengage** | Camera FOV returns to 75°, vignette fades | Combat music fade-out (1.0s), ambient returns |

### Combat Audio Mixing

| State | Music | SFX Priority | Ambient |
|-------|-------|-------------|---------|
| **Non-Combat** | None | World SFX dominant | Full ambient |
| **Combat Entry** | Fade-in (0.5s, low drone) | Weapon SFX dominant | Ambient ducked -6dB |
| **Active Combat** | Full combat layer (-12dB) | Weapon + alien SFX dominant | Ambient ducked -12dB |
| **Disengaging** | Fade-out (1.0s) | Tension SFX (footsteps, breathing) | Ambient fading in |
| **Disengaged** | None | World SFX dominant | Full ambient |

### Performance Budget

| Metric | Budget |
|--------|--------|
| Bullet impact decals | Max 20 simultaneous (oldest fade after 30s) |
| Active muzzle flash particles | Max 2 (one per frame during fire) |
| Combat VFX frame budget | <0.5ms |
| Active blood decals | Max 10 simultaneous (fade after 60s) |
| Spent casing particles | Max 30 active (despawn after 5s) |

## UI Requirements

| Context | HUD Element | Update Frequency | Condition |
|---------|-------------|-----------------|-----------|
| **Immersive mode** | No combat UI | — | Default. Player reads combat state from audio, camera, and alien behavior. |
| **Immersive mode** | Ammo check (temporary) | On IA_Reload when not empty | Shows magazine + reserve for 2.0s after check animation. |
| **Immersive mode** | Screen edge vignette | On combat state change | Pulses red during combat, fades when disengaged. |
| **Tactical HUD** | Ammo counter (bottom-right) | Every frame | Magazine / Reserve display. Color: green (>50%), orange (20–50%), red (<20%). |
| **Tactical HUD** | Combat state indicator | On state change | Text: "In Combat", "Disengaging", "Clear". |
| **Tactical HUD** | Threat direction indicators | Every 0.5s | Mini dots on screen edge showing alien positions. |
| **Tactical HUD** | Weapon condition indicator | On weapon switch | Icon: clean (green), dirty (yellow), damaged (red). |

## Cross-References

| This Document References | Target GDD | Specific Element Referenced | Nature |
|--------------------------|-----------|----------------------------|--------|
| "IA_Attack, IA_Aim, IA_Reload, IA_Melee" | `design/gdd/input-system.md` | Input action definitions, IMC_Combat | Data dependency |
| "IMC_Combat push/pop" | `design/gdd/player-controller.md` | IMC stack management, Combat Mode state | State trigger |
| "Dodge i-frame window" | `design/gdd/movement-system.md` | Dodge wind-up, active (0.25s), recovery phases | Rule dependency |
| "Stamina cost for melee" | `design/gdd/movement-system.md` | Stamina drain, exhaustion behavior | Data dependency |
| "TakeDamage(Physical)" | `design/gdd/health-system.md` | Damage pipeline, damage types, death check | Rule dependency |
| "Injury state affects combat" | `design/gdd/health-system.md` | Walk speed penalty, stamina regen penalty in Critical/Near Death | Rule dependency |
| "Detection = 100 triggers combat" | `design/gdd/stealth-system.md` | Detected state, OnStealthBroken event | State trigger |
| "Disengagement resets stealth" | `design/gdd/stealth-system.md` | Stealth System recalculates from zero | Rule dependency |
| "Alien armor values" | `design/gdd/alien-ai-system.md` (Not Started) | Per-alien armor, health, combat behavior | Data dependency |
| "Weapon data, ammo counts" | `design/gdd/inventory-system.md` (Not Started) | Weapon items, ammo types, carry limits | Data dependency |
| "Recoil shake" | `design/gdd/camera-system.md` | AddRecoil(Amplitude, Duration), shake formulas | Data dependency |
| "Combat FOV (65°)" | `design/gdd/camera-system.md` | FOV transitions, camera mode switching | Rule dependency |
| "Clue inaccessible during combat" | `design/gdd/investigation-system.md` (Not Started) | Some clues only accessible when not in combat | Rule dependency |

## Acceptance Criteria

- **GIVEN** player has pistol equipped with 12 rounds in magazine, **WHEN** player fires one shot, **THEN** magazine shows 11 rounds, ammo reserve is unchanged, and hitscan trace registers hit on target within ±1.0° spread.

- **GIVEN** player fires pistol 5 times within 1.0s, **WHEN** 6th shot is fired, **THEN** spread is S_base + 1.5° (5 × 0.3°) + movement/stance modifiers.

- **GIVEN** player fires pistol and waits 1.5s, **WHEN** next shot is fired, **THEN** spread has reset to S_base (N_consecutive = 0 after 1.0s).

- **GIVEN** player shoots alien with pistol at head (body shot would deal 25), **WHEN** damage is calculated, **THEN** damage = ceil(25 × 1.5) = **38** (assuming clean weapon, unarmored, effective range).

- **GIVEN** player shoots alien with pistol beyond effective range (2000cm), **WHEN** damage is calculated, **THEN** damage = ceil(25 × M_distance=0.5) = **13** (assuming other multipliers = 1.0).

- **GIVEN** player fires shotgun at alien 30cm away and all 9 pellets hit body, **WHEN** damage is calculated, **THEN** total damage = 9 × ceil(60 × 1.0 × 1.0 × 1.0 × 1.0) = **540 damage** (one-shot kill on any alien ≤540 HP).

- **GIVEN** player initiates reload with 5 rounds in magazine and 20 in reserve, **WHEN** reload starts, **THEN** reserve decreases by 7 (to fill magazine to 12) immediately, and reload animation plays for 1.5s.

- **GIVEN** player is reloading and takes damage at 0.8s into reload, **WHEN** reload is cancelled, **THEN** magazine is filled to 12 (reload was past 0.3s before completion), reserve was already deducted, and player can act immediately.

- **GIVEN** player has 0 reserve ammo and magazine is empty, **WHEN** player attempts to fire, **THEN** weapon does not fire, "No Ammo" prompt shows for 1.0s, and player must switch weapons or melee.

- **GIVEN** stealth detection reaches 100, **WHEN** combat triggers, **THEN** IMC_Combat is pushed within 0.1s, combat music fades in over 0.5s, and camera FOV narrows to 65°.

- **GIVEN** all aliens within 2000cm are killed, **WHEN** disengagement timer starts, **THEN** timer counts from 10.0s to 0.0s, and at 0.0s IMC_Combat is popped and combat music fades out.

- **GIVEN** player breaks LOS with all aliens and remains undetected, **WHEN** 10.0s elapse (no alive aliens), **THEN** combat disengages, IMC_Combat is popped, and Stealth System recalculates from zero.

- **GIVEN** 3 aliens alive, player in cover, **WHEN** disengagement timer starts, **THEN** timer = 10 + (3 × 2) + (-3) = 13.0s.

- **GIVEN** disengagement timer is at 9.9s and an alien re-detects the player, **WHEN** detection occurs, **THEN** timer resets to 0 and combat re-engages immediately.

- **GIVEN** player melee attacks alien in Hidden state, **WHEN** melee connects, **THEN** combat triggers immediately, stealth is broken, and IMC_Combat is pushed.

- **GIVEN** player has 5 stamina and tries to melee (costs 10), **WHEN** melee is attempted, **THEN** melee fails, stamina remains at 5, and "Too Exhausted" prompt shows for 1.0s.

- **GIVEN** player dodges during alien projectile travel time, **WHEN** projectile reaches player position during i-frame window (0.25s), **THEN** damage is fully negated, HP unchanged, no VFX/audio.

- **GIVEN** weapon is damaged AND dirty, **WHEN** player fires, **THEN** weapon has 15% chance to jam. If jam occurs, 2.0s unskippable animation plays to clear weapon.

- **GIVEN** tactical HUD is enabled, **WHEN** ammo is at 3/12 magazine with 8 reserve, **THEN** ammo counter shows "3/12 | 8" with color based on reserve percentage (8/60 = 13% → red).

- **GIVEN** player aims down sights during combat (FOV 65°), **WHEN** scope activates, **THEN** FOV changes to 60° (scoped). On scope release, FOV returns to 65° (combat), not 75° (default).

## Open Questions

| # | Question | Owner | Target Resolution |
|---|----------|-------|-------------------|
| OQ-1 | Should weapons degrade over time (condition decreases with use), or only from environmental damage (water, alien acid)? Affects M_weapon_condition tuning. | game-designer | Inventory System GDD |
| OQ-2 | Should the player be able to scavenge ammo from dead aliens? Adds resource loop but may reduce scavenging tension. | game-designer | Alien AI System GDD |
| OQ-3 | Should alien armor be breakable (sustained fire on armored sections reduces armor)? Adds tactical depth but increases complexity. | game-designer | Alien AI System GDD |
| OQ-4 | Should combat have a "panic" mechanic (aim stability decreases when health is low or aliens are close)? Reinforces survival tension. | game-designer | Before MVP implementation |
| OQ-5 | Should weapon switching be instant in inventory screen but animated in-world? Affects combat pacing during weapon swaps. | ux-designer | Inventory System GDD |
| OQ-6 | Should the player be able to pick up alien weapons (biomass-based weapons)? Adds variety but may conflict with "human scarcity" theme. | game-designer | Alien AI System GDD |
| OQ-7 | Multiplayer (future) — hit registration authority, lag compensation, damage synchronization. | architecture | Multiplayer ADR |
