# Combat System

> **Status**: In Review (Revised ×2 — re-review required)
> **Author**: user + agents
> **Last Updated**: 2026-05-20
> **Last Verified**: 2026-05-20
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
| **Shotgun** | Pump-action | 60 per pellet (9 pellets) | 0.8s between shots | 0–500cm | Shotgun shells | 6 |
| **Rifle** | Burst (3-round, always) | 18 per bullet | 0.15s between burst rounds; new trigger press required per burst | 0–3000cm | Rifle rounds | 30 |
| **Melee (Improvised)** | Single swing | 15 | 1.0s between swings | 0–150cm | N/A | N/A |

**Weapon Acquisition**: Weapons are found in the world (abandoned military caches, dead soldiers, resistance stashes). No weapon vendors. No crafting weapons. Each weapon found comes with a partial magazine and zero reserve ammo — the player must scavenge ammo separately.

**Weapon Role Differentiation** — each weapon is a distinct gamble, not a linear upgrade:
- **Pistol**: quiet (noise radius 1000cm), accurate sustained fire (spread +0.2°/shot), common ammo. Best for stealth kills and precision engagements. No advantage in open firefights.
- **Shotgun**: devastating up close (up to 540 damage point-blank), useless at range. A bet on the close-range kill before retreat.
- **Rifle**: maximum effective range and per-burst damage — but **loud** (noise radius 2500cm, draws backup), **heavy spread climb** (+0.6°/shot, triple pistol rate), and **scarce ammo** (rare finds). Using the rifle ends area stealth and accelerates backup arrival.
- **Melee**: silent, zero ammo cost. A last resort when ammo is dry or stealth kill is essential.

**Weapon Switching**: Player switches weapons via IA_Inventory or quick slots. Switch time: 0.5s (pistol/rifle), 0.7s (shotgun). Cannot switch during reload or fire animation.

**Rule 2 — Hit Detection**

**Player weapons (hitscan)**: All player weapons use hitscan (instant hit) for responsiveness. A line trace from camera center (with small random spread) determines hit target.

| Weapon | Spread (standing) | Spread (crouching) | Spread (moving) | Spread (sprinting) |
|--------|-------------------|--------------------|-----------------|--------------------|
| Pistol | ±1.0° | ±0.5° | ±2.0° | ±4.0° |
| Shotgun | ±3.0° (9 pellets) | ±2.0° (9 pellets) | ±5.0° (9 pellets) | ±8.0° (9 pellets) |
| Rifle | ±0.8° | ±0.4° | ±1.5° | ±3.0° |
| Melee | N/A (cone check) | N/A | N/A | N/A |

**Spread increases with sustained fire**: Each consecutive shot within 1.0s adds weapon-specific spread (`S_per_shot`): Pistol +0.2°, Rifle +0.6°. Shotgun has no accumulation between pump-action shots (9 pellets per shot, spread governed by the spread table). Cumulative cap: +5.0° maximum. Spread resets to base after 1.0s of no firing.

**Noise propagation (stealth interaction)**: All weapon fire emits acoustic events.

| Weapon | Noise Radius | Effect on Hidden/Suspicious/Alert aliens within radius |
|--------|-------------|------------------------------------------------------|
| Pistol | 1000cm | Transition to Alert state |
| Shotgun | 1500cm | Transition to Alert state |
| Rifle | 2500cm | Transition to Alert state; see Rule 8 (Call for Backup) |
| Melee | 300cm | Transition to Suspicious state |

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
| M_weapon_condition | float | 0.48–1.0 | Inventory System | Two independent variables: `IsDirty: bool` + `ConditionTier: Intact/Damaged`. M_condition = 1.0 (clean), 0.8 (dirty only), 0.6 (damaged only), 0.48 (dirty + damaged). See Weapon Jam edge case. |
| M_alien_armor | 1.0 (unarmored), 0.6 (armored), 0.3 (heavily armored) | Per-alien armor value |

**Example:** Pistol headshot on unarmored alien at effective range, clean weapon: 25 × 1.5 × 1.0 × 1.0 × 1.0 = **37.5 → 38 damage** (ceil).
**Example:** Shotgun body hit on armored alien at 600cm (beyond effective range), dirty weapon: 60 × 1.0 × 0.5 × 0.8 × 0.6 = **14.4 → 15 damage** (ceil). Note: shotgun fires 9 pellets, so total = 15 × pellets that hit.

**Alien damage to player**: Processed through Health System's damage pipeline (Health System Rule 3). Combat System calls `TakeDamage(float DamageAmount, FDamageEvent const& DamageEvent, AController* EventInstigator, AActor* DamageCauser)` on the player character, passing `FPointDamageEvent` as the `DamageEvent` argument (implicit upcast). `FPointDamageEvent` carries `FHitResult` (hit bone/location) required for M_location calculation.

**Rule 4 — Ammo Management**

Ammo is a scarce resource. No infinite ammo, no regen, no crafting ammo.

| Ammo Type | Max Carry | Found In | Typical Find Amount |
|-----------|-----------|----------|---------------------|
| Pistol rounds | 60 | Military caches, dead soldiers | 6–12 |
| Shotgun shells | 24 | Resistance stashes, hunter camps | 3–6 |
| Rifle rounds | 120 | Military armories, supply caches | 5–8 |

**Reload Rules:**
- Reload time: Pistol 1.5s, Shotgun 0.6s per shell (3.6s full), Rifle 2.0s (magazine swap), Melee N/A.
- Reload is cancelled by: taking damage, player input (sprint, dodge, weapon switch queue).
- **Ammo deducted from reserve at reload START**: `actual_deduction = min(capacity - initial_mag_rounds, reserve); reserve -= actual_deduction`. If reserve is insufficient to fill the magazine, the reload proceeds with whatever ammo is available: `rounds_loaded = initial_mag_rounds + actual_deduction`. This prevents the reload-cancel-refarm exploit and guards against negative reserve.
- **Partial fill on cancel**: `rounds_in_magazine = max(initial_mag_rounds, ceil((T_elapsed / T_reload_total) × capacity))`. Reserve refund on cancel: `reserve += (capacity - rounds_in_magazine)`. Example: cancel at 0.8s of 1.5s pistol reload, started with 5 rounds: `max(5, ceil(0.8/1.5 × 12)) = max(5, 7) = 7 rounds`. Reserve refund: `12 - 7 = 5 rounds returned`.
- **Shotgun exception**: shells insert individually (one per 0.6s). Cancel mid-reload = only fully inserted shells count. No partial-shell credit.
- Tactical reload (magazine not empty): +0.3s longer (player stows partial magazine). Stowed rounds are returned to reserve during the stow animation.
- Empty reload: standard time. Animation includes slide-lock release (pistol/rifle) or bolt pull (shotgun).

**Ammo UI (immersive mode)**: No ammo counter. Player checks ammo by pressing IA_Reload when not empty — character performs a "check magazine" animation (0.5s) and a small HUD element shows current magazine + reserve for 2.0s.
**Ammo UI (tactical HUD)**: Persistent ammo counter (bottom-right). Magazine / Reserve display.

**Rule 5 — Combat Engagement Lifecycle**

Combat follows a strict lifecycle:

1. **Trigger**: Detection reaches **100** (Detected state in Stealth System) OR player attacks an alien in any state, OR alien patrol enters engagement range (1500cm) and detects player. Note: Detection=75 (Engaged state) causes the alien to aggressively search and close distance — but does NOT push IMC_Combat and does NOT start combat music. Music and combat engage only at 100. This preserves ambiguity: the player does not receive a warning signal before the alien attacks.
2. **Engagement**: IMC_Combat pushed by Combat System. Combat music fades in. All nearby aliens transition to combat behavior.
3. **Active Combat**: Player and aliens exchange damage. Combat persists as long as at least one alien is in combat state AND (within 2000cm of player OR has player in line of sight). Aliens beyond 2000cm that have lost LOS do not prevent disengagement.
4. **Disengagement**: All aliens within 2000cm are dead OR all aliens have lost LOS and the disengagement timer (Formula 3) has elapsed. Timer minimum is 7.0s (all dead, player in cover) and maximum is 30.0s. Rule 5 text references 10.0s as the base time (T_base) only — Formula 3 applies cover and alive-alien modifiers on top of it.
5. **Cooldown**: IMC_Combat popped. Combat music fades out. Stealth System recalculates from zero (all aliens reset to Hidden unless memory persists).

**Disengagement Rules:**
- Dead aliens do not prevent disengagement.
- Aliens that lost LOS but are still searching (Alert state) prevent disengagement.
- Player must break LOS with ALL active combat aliens AND remain undetected for Formula 3's timer (min 7.0s with cover + all dead; max 30.0s) to disengage.
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
| Hit stun | 0.15s | Alien briefly staggered. Shorter than player recovery (0.5s) — alien's 0.3s re-attack wind-up begins at 0.15s and completes at 0.45s, before player can re-swing at 0.5s. Prevents perpetual stun-lock. |
| Consecutive hits | Each adds +0.2s recovery | Spamming melee gets slower |

**Consecutive hit reset**: The +0.2s recovery penalty resets per-target (switching to a new alien clears the counter) AND after 3.0s of no melee input. Prevents the penalty from carrying across separate engagements. Does not reset on miss. **Counter is tracked as a `TMap<AlienID, HitCount>` on the Combat System.** Returning to a previously hit alien resets its counter to 0 — prior hits do not resume. (A→B→A: Alien A counter = 0 on return.)

**Melee cone check implementation**: Implemented as sphere sweep (`SweepMultiByChannel`) at 150cm range + angle filter (`FVector::DotProduct > cos(30°)`) to test 60° arc. Not a UE5 primitive — requires this two-step trace.

**Constraints**: Melee not available during Sprint (must decelerate first). Melee not available during Fall. Melee available in Cover (lean out + swing, 0.3s extra wind-up). Melee available in Crouch (lower damage: 10 instead of 15, shorter range: 100cm).

### Rule 7 — Panic State

When the player is under extreme stress, aim degrades. Panic is a spread modifier applied on top of Formula 2.

| Condition | Panic Modifier (M_panic) | Trigger | Clear |
|-----------|--------------------------|---------|-------|
| HP ≤ 30% (Injured/Near-Death state) | +1.5° to S_current | HP drops to ≤ 30% | HP rises above 30% |
| Any alien within 300cm | +1.0° to S_current | Any alien enters 300cm radius | All aliens exit 300cm radius |

Both conditions are independent and stack. Maximum M_panic = +2.5° (both active simultaneously).

**Design intent**: Panic enforces the survival fantasy mechanically. A wounded player cornered by an alien faces maximum aim degradation — the correct response is retreat, cover use, or a point-blank attack, not sustained mid-range fire.

**Point-blank exemption**: M_panic spread modifiers (both M_panic_hp and M_panic_proximity) do NOT apply when the attack fires at ≤150cm (melee range) OR when a shotgun is within ≤150cm of its target. This preserves at least one reliable offensive option when the player is both injured and cornered — let the alien close, then point-blank shotgun or melee. The panic mechanic teaches retreat or commitment, not helplessness.

### Rule 8 — Call for Backup

Aliens in combat state call for reinforcements if not killed quickly. This delivers on the Player Fantasy promise: "Can I kill this before it calls for backup?"

| Condition | Behavior | Player-Visible Signal | How to Prevent |
|-----------|----------|----------------------|----------------|
| Alien has unbroken LOS to player for ≥2.0s in combat | Emits backup call (2500cm radius) | Alien vocalization + brief body posture change | Kill alien within 2.0s of LOS |
| Rifle shot fired within 2500cm of non-combat alien | Noise alert — alien transitions to Alert | None (environmental) | Use pistol or melee instead |

**Backup response**: Aliens within 2500cm that receive a backup call or rifle noise alert transition from Hidden/Suspicious → Alert and move toward player's last known position. Alien AI System owns response behavior (squad mechanics, arrival timing). Combat System receives `OnBackupCalled(AlienID, Location)` event for threat indicator updates.

**Audio — responding aliens**: Each alien within 2500cm that transitions to Alert on backup call emits a brief vocalization (staggered 0.1–0.3s apart to avoid a synchronised chorus). Audio System owns the cascading response event.

**Disengaging suppression**: Backup calls are suppressed during the Disengaging state. An alien that regains LOS and holds it for ≥2.0s during Disengaging re-triggers Active Combat (Rule 5 re-trigger logic) but does NOT emit an additional backup call. The escape window is earned; it is not escalated further.

**Design note**: The rifle's 2500cm noise radius creates the same propagation as an alien backup call. Firing the rifle ends area stealth permanently for the current engagement.

### States and Transitions

| State | Entry Condition | Exit Condition | Behavior |
|-------|----------------|----------------|----------|
| **Non-Combat** | Game start, or Disengaged complete | Detection=100, player attacks alien, or patrol enters 1500cm range | Normal gameplay. IMC_Default or IMC_Stealth active. |
| **Combat Entry** | Combat triggered | 0.5s elapsed | Combat System calls `PC->PushCombatIMC()` which invokes `AddMappingContext(IMC_Combat)`. Combat System is the decision-maker; PC owns the subsystem access. Combat music fades in over 0.5s. Camera FOV narrows to 65°. Player can act during entry window. |
| **Active Combat** | Combat Entry complete | Disengagement conditions met | Full combat behavior. Aliens attack. Player can fight or flee. |
| **Disengaging** | All aliens dead OR all lost LOS | `T_disengage` (Formula 3: 7.0s–30.0s) elapsed AND no alien detects player. **Re-trigger: if any alien detects player during Disengaging → immediately back to Active Combat (timer resets to zero, no partial progress).** | IMC_Combat still active. Combat music fades. Player must stay hidden. Combat System owns the IMC pop decision — Stealth System de-escalation does NOT pop IMC_Combat. |
| **Disengaged** | Formula 3 timer elapses (7.0s–30.0s depending on cover and alive aliens) | Same triggers as Non-Combat: detection=100, player attacks alien, patrol enters 1500cm range | Combat System calls `PC->PopCombatIMC()` which invokes `RemoveMappingContext(IMC_Combat)`. Stealth System resets. Combat music off. |

**State Priority:** Active Combat > Disengaging > Combat Entry > Non-Combat

**IMC_Combat ownership**: Combat System is the sole owner of IMC_Combat push and pop. It delegates the actual subsystem call to Player Controller via `PC->PushCombatIMC()` and `PC->PopCombatIMC()`, which invoke `UEnhancedInputLocalPlayerSubsystem::AddMappingContext` / `RemoveMappingContext`. Player Controller owns the `LocalPlayer` reference needed for subsystem access. A single push + single pop from one owning system (Combat System) prevents stack corruption; PC is the API bridge, not the decision-maker.

**Unified combat-state model (canonical — three distinct concepts):** The word "combat" spans three independently-owned signals that must not be conflated:

| Concept | Threshold | Owner | What it drives |
|---------|-----------|-------|----------------|
| **Alien combat behavior** | detection **≥75** (Engaged) | Alien AI (Combat Branch) | Aliens attack, converge, call backup. NOT a player-facing combat signal. |
| **Player Combat Mode** (`ECombatState`, IMC_Combat, combat music, 65° FOV) | detection **=100** (Detected), or player attacks an alien, or patrol forces combat per Rule 5 | **Combat System** | The player's combat input context + audiovisual state. Pushed at 100 only — never at 75. This preserves the "no warning before the alien attacks" ambiguity (Pillar 3, Tense Survival). |
| **`IsPlayerUnderThreat()`** (narrative-defer gate) | detection **≥75** | Stealth/Alien AI expose; Investigation/Quest/Faction consume | Suppresses revelations, quest-consequence delivery, and faction toasts while the player is being actively hunted (Pillar 2, Earned Discovery). Distinct from `ECombatState` — a revelation must not fire at detection 80 even though Combat Mode (=100) is not yet active. |

Stealth System and Alien AI do **not** push or pop IMC_Combat at any threshold. Combat Mode entry/exit is governed solely by this system's state machine above; combat exit is governed solely by `T_disengage` (Formula 3), which Alien AI and Stealth reference rather than re-defining.

### Interactions with Other Systems

| System | Direction | Data Flow | Interface |
|--------|-----------|-----------|-----------|
| **Player Controller** | Reads + Writes | Input routing; receives combat state events | `OnCombatEngaged()` (event received), `OnCombatDisengaged()` (event received). PC does NOT push/pop IMC_Combat — Combat System owns the IMC stack. |
| **Health System** | Reads + Writes | Damage to player, damage from player | `TakeDamage(float DamageAmount, FDamageEvent const& DamageEvent, AController* EventInstigator, AActor* DamageCauser)` — pass `FPointDamageEvent` as `DamageEvent`. `OnPlayerDamaged()` |
| **Movement System** | Reads | Dodge i-frames, movement state, stamina | `OnDodgeStarted/Ended()`, `GetCurrentMovementState()`, `GetStamina()` |
| **Stealth System** | Reads + Writes | Detection state, stealth broken event | `OnStealthBroken()`, `GetCurrentDetectionLevel()`, `OnCombatDisengaged()` |
| **Alien AI System** | Reads + Writes | Alien combat behavior, health, LOS state, backup | `SetAlienCombatState(AlienID, bool)`, `GetAlienHealth(AlienID)`, `OnAlienKilled()`, `OnAlienLOSLost(AlienID)`, `OnAlienLOSRegained(AlienID)`, `OnBackupCalled(AlienID, Location)` |
| **Inventory System** | Reads + Writes | Weapon data, ammo counts, weapon switching | `GetCurrentWeapon()`, `GetAmmoCount(AmmoType)`, `ConsumeAmmo()`, `SwitchWeapon()` |
| **Camera System** | Reads + Writes | Recoil shake, FOV changes, camera mode | `AddRecoil(Amplitude, Duration)`, `SetFOV(float)` (Camera System owns smooth FOV interpolation) |
| **HUD System** | Writes | Combat indicators, ammo display, threat direction | `SetCombatState(ECombatState)`, `ShowAmmoCount()`, `ShowThreatIndicators()` |
| **Audio System** | Writes | Combat music, weapon SFX, alien combat audio | `PlayWeaponFire(WeaponType)`, `StartCombatMusic()`, `StopCombatMusic()` |
| **Animation System** | Writes | Fire animations, reload animations, melee montages | `PlayFireMontage(WeaponType)` (dedicated slot per weapon class), `PlayReloadMontage()`, `PlayMeleeMontage()`, `PlayJamClearMontage()` (dedicated jam slot — unskippable, higher blend weight) |
| **Scene Management** | Reads | Zone state (for combat music mixing) | `GetCurrentZone()` |

**Physics/Surface note**: Surface type for bullet impact VFX is read from the `FHitResult::PhysMaterial` returned by the hitscan trace already performed in Rule 2. No separate Physics System call is required.

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
| Weapon condition | M_condition | float | 0.48–1.0 | Inventory System | Two vars: `IsDirty: bool` + `ConditionTier: Intact/Damaged`. Values: Clean=1.0, Dirty=0.8, Damaged=0.6, Dirty+Damaged=0.48 |
| Alien armor | M_armor | float | 0.3–1.0 | Alien AI System | Unarmored=1.0, Armored=0.6, Heavy=0.3 |

**Output Range:** 1–90 per hit (per pellet, for shotgun). Clamped to minimum 1 (every hit deals at least 1 damage). True minimum before clamp: ceil(15 × 0.7 × 0.5 × 0.48 × 0.3) = ceil(0.756) = 1. **Shotgun aggregate max:** All 9 pellets at headshot, clean, unarmored, in range = 9 × 90 = **810 damage** (body-shot max = 540).
**Example (optimal):** Rifle headshot, clean weapon, unarmored alien, effective range: ceil(18 × 1.5 × 1.0 × 1.0 × 1.0) = **27 damage**. 4 headshots to kill a 100 HP alien.
**Example (worst):** Pistol limb hit, damaged weapon, heavily armored alien, beyond effective range: ceil(25 × 0.7 × 0.5 × 0.6 × 0.3) = ceil(1.575) = **2 damage**. Against a heavily armored alien, pistol limb shots are effectively useless — switch weapon or aim for the head/body.

---

**Formula 2 — Spread Accumulation**

The `current_spread` formula is defined as:

`S_current = max(0, S_base + min(N_consecutive × S_per_shot, 5.0) + M_panic)`

**Variables:**

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| Base spread | S_base | float | 0.4–3.0° | Weapon spread for current stance/movement from Rule 2 table. The table already incorporates stance and movement — do NOT add separate stance/movement terms. |
| Consecutive shots | N_consecutive | int | 0–16 | Shots fired within last 1.0s |
| Spread per shot | S_per_shot | float | 0.2–0.6° | Weapon-specific: Pistol=0.2°, Rifle=0.6°. Shotgun: N/A (no accumulation between pump shots). |
| Panic modifier | M_panic | float | 0–2.5° | HP≤30%: +1.5°; any alien ≤300cm: +1.0°. Conditions stack. See Rule 7. |

**Output Range:** 0° to 10.5°. Hard-clamped to 0 minimum (spread cannot go negative).
**Example (rifle, 5 shots, moving, not panicked):** S_base=1.5° (rifle+moving from table) + min(5×0.6°, 5.0°)=3.0° + 0 = **4.5°**.
**Example (pistol, 1 shot, crouching, not panicked):** S_base=0.5° (pistol+crouching from table) + 1×0.2° + 0 = **0.7°**.
**Example (pistol, panicked: HP=25% + alien at 200cm, crouching, 0 shots):** 0.5° + 0 + 2.5° = **3.0°**.

**Spread reset**: N_consecutive resets to 0 after 1.0s of no firing. Each shot fired within 1.0s of the previous shot increments N_consecutive. At exactly 1.0s boundary, reset applies (counter becomes 0, next shot starts at N=1). **Implementation**: tracked as a ring buffer of shot timestamps; on each shot, count entries within the trailing 1.0s window. For rifle burst fire (3 rounds at 0.15s each): all 3 rounds contribute to N_consecutive and are within the window, so a single burst trigger pull adds 3 to the count.

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

**Output Range:** 7.0s to 30.0s. N_alive is clamped to [0, 10] — if more than 10 aliens are in combat state, the timer uses 10. M_cover is a boolean (0 or 1). N_alive counts only aliens actively in combat state within 2000cm — aliens explicitly excluded from disengagement conditions (>2000cm, lost LOS) are not counted.
**Example:** 3 aliens alive, player in cover: T = 10 + (3 × 2) + (1 × -3) = 10 + 6 - 3 = **13.0s**.
**Example:** 0 aliens alive (all dead): T = 10 + (0 × 2) + 0 = **10.0s**.
**Example:** 5 aliens alive, player not in cover: T = 10 + (5 × 2) + 0 = **20.0s**.

---

**Formula 4 — Panic Spread Modifier**

`M_panic = M_panic_hp + M_panic_proximity`

| Variable | Symbol | Type | Condition | Value |
|----------|--------|------|-----------|-------|
| HP panic modifier | M_panic_hp | float | HP ≤ PanicHPThreshold (30%) | +1.5° |
| HP panic modifier | M_panic_hp | float | HP > PanicHPThreshold | 0° |
| Proximity panic modifier | M_panic_proximity | float | Any alien ≤ PanicProximityRange (300cm) | +1.0° |
| Proximity panic modifier | M_panic_proximity | float | No alien ≤ 300cm | 0° |

**Output Range:** 0° to 2.5°. No clamp needed — values are discrete.
**Example (both active):** HP=20, alien at 150cm: M_panic = 1.5 + 1.0 = **2.5°** added to S_current.
**Example (one active):** HP=80, alien at 200cm: M_panic = 0 + 1.0 = **1.0°** added to S_current.

## Edge Cases

- **If player fires weapon while in dodge i-frame window**: Shot fires normally. Dodge does not block player's own attacks. Dodge i-frames only block incoming damage.

- **If player reloads and is damaged during reload animation**: Reload cancels. Magazine rounds = `max(initial_mag, ceil(T_elapsed / T_reload × capacity))`. Reserve refund = `capacity - rounds_in_magazine`. Example: pistol reload, started with 5 rounds, cancelled at 0.8s into 1.5s: `max(5, ceil(0.8/1.5 × 12)) = max(5, 7) = 7 rounds`. Reserve refund = 12-7 = 5 rounds returned. Prevents reload-cancel-refarm exploit since reserve was pre-deducted and only partially returned.

- **If player switches weapons during combat entry (0.5s window)**: Weapon switch is queued and executes after combat entry animation completes. Prevents "instant weapon swap to counter specific alien" during engagement transition.

- **If all aliens are killed but one alien's body is still in LOS of another alien (not yet dead)**: Combat persists until ALL aliens are confirmed dead. Dead bodies do not count as "alive aliens" for disengagement calculation.

- **If player melee attacks an alien in Hidden state**: Combat triggers immediately. Stealth is broken. The melee attack is the trigger event — no grace period. Player chose violence.

- **If player's last bullet is fired and magazine is empty**: Auto-reload begins after 0.5s delay (player can cancel by switching weapons or melee). If no reserve ammo, weapon is unusable — player must switch or melee.

- **If shotgun fires at point-blank range (<50cm) and all 9 pellets hit body**: Total damage = 60 × 9 × 1.0 = 540 damage (body shot, clean, unarmored). Headshot max = 9 × 90 = 810 damage. One-shot kill on any alien. This is intentional — shotgun is devastating at close range but diminished beyond 500cm (M_dist = 0.5 per pellet beyond effective range).

- **If alien projectile hits player during dodge i-frame**: Damage fully negated. No HP loss, no VFX, no audio. Dodge i-frames are absolute — no partial damage.

- **If player is in combat and enters a new zone (Scene Management streaming)**: Combat state persists across zone boundaries. Aliens from the previous zone do not follow, but new zone aliens may engage if player is detected. Disengagement timer resets for new zone.

- **If weapon's ConditionTier is Damaged and player fires**: 5% chance per shot to jam. If weapon is also `IsDirty = true` (M_condition = 0.48, Dirty+Damaged): 15% chance per shot to jam. Jam requires 2.0s to clear (unskippable). Both flags read from Inventory System via `GetWeaponCondition(WeaponID)` which returns `{IsDirty: bool, ConditionTier: Intact/Damaged}`.

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
| `SpreadPerShot` | — | — | Superseded by `PistolSpreadPerShot` and `RifleSpreadPerShot` (weapon-specific) | — | — |
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
| `PistolSpreadPerShot` | 0.2° | 0.1–0.5° | Pistol sustained accuracy degradation | Pistol spray viable | Pistol single-shot only |
| `RifleSpreadPerShot` | 0.6° | 0.3–1.2° | Rifle burst accuracy penalty | Rifle too inaccurate | Rifle spread irrelevant |
| `RifleNoiseRadius` | 2500cm | 1500–4000cm | Rifle gunshot attracts aliens | Rifle fire draws huge swarms | Rifle doesn't punish stealth break |
| `PistolNoiseRadius` | 1000cm | 600–1500cm | Pistol noise propagation | Pistol not stealthy | Pistol viable for silent play |
| `ShotgunNoiseRadius` | 1500cm | 1000–2500cm | Shotgun noise propagation | Shotgun draws nearby patrols | Shotgun safe to use indoors |
| `PanicHPThreshold` | 0.30 | 0.15–0.45 | HP% that triggers panic spread | Panic kicks in too early (mid-fight) | Panic never triggers in real combat |
| `PanicHPSpread` | 1.5° | 0.5–3.0° | Aim penalty when HP below threshold | Wounded player cannot aim at all | Wound has no mechanical consequence |
| `PanicProximityRange` | 300cm | 150–600cm | Alien distance that triggers panic spread | Proximity panic from too far (long-range trigger) | Must be point-blank to feel panicked |
| `PanicProximitySpread` | 1.0° | 0.3–2.0° | Aim penalty when alien is close | Close-range combat impossible | Proximity has no spread consequence |
| `BackupCallDelay` | 2.0s | 1.0–4.0s | Time alien must hold LOS before calling backup | Aliens call backup almost instantly | Player can ignore backup threat entirely |
| `BackupCallRadius` | 2500cm | 1500–4000cm | Range of alien backup call propagation | Large swarm responses everywhere | Backup never arrives |

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
| **Alien killed** | Collapse animation, alien blood pool (persistent decal), no explosion | Alien death vocalization, body impact. Ambient audio remains at combat duck level (-6dB) while any alien remains in combat — the world does not pause for a kill, and the mix reflects it. Ambient only recovers during Disengaging (see mixing table). |
| **Player hit (any damage)** | Impact direction flash, screen shake (scaled to damage), blood vignette pulse | Directional impact sound, player pain grunt, brief breath interrupt |
| **Player hit (panic threshold crossed)** | Red vignette intensifies at HP≤30% | Audible breathing escalation, heartbeat rises in mix. **De-escalation**: when HP rises above 30%, breathing fades back to baseline over 3.0s (not a hard snap). |
| **Alien attack telegraph** | Alien wind-up animation (visible 0.2–1.0s pre-attack per type) | Alien vocalization or body-impact warning sound before attack lands |
| **Reload complete** | Magazine seat-click VFX | Mechanical completion sound (slide click / bolt clack / shell seat) — confirms to player reload is done without checking hands |
| **Low ammo (red threshold)** | Ammo counter turns red (Tactical HUD only) | Single chamber-click audio cue fires **once** when magazine crosses below the ≤20% threshold. Does not repeat on subsequent shots. Re-triggers if player reloads above threshold and drops below again. In Immersive Mode: dry-fire click on first fire attempt when magazine is fully empty (no ammo counter visible). |
| **Weapon jam** | Weapon malfunction animation (rack slide, clear chamber) | Metallic click, frustrated rack, clear |
| **No Ammo (fire attempt, empty mag + no reserve)** | No fire animation | Dry-fire click (mechanical empty chamber). Critical for Immersive Mode — no ammo counter, so audio is the primary signal. |
| **Too Exhausted (melee attempt, insufficient stamina)** | No swing animation | Short exertion grunt + suppressed swing breath. Immersive Mode primary signal for stamina depletion. |
| **Combat entry** | Camera FOV narrows to 65°, screen edge vignette pulses | Combat music fade-in (0.5s), tension drone |
| **Combat disengage** | Camera FOV returns to 75°, vignette fades | Combat music fade-out (1.0s), ambient returns |

### Combat Audio Mixing

| State | Music | SFX Priority | Ambient |
|-------|-------|-------------|---------|
| **Non-Combat** | None | World SFX dominant | Full ambient |
| **Combat Entry** | Fade-in (0.5s, low drone) | Weapon SFX dominant | Ambient ducked -6dB |
| **Active Combat** | Full combat layer (music at -12dB relative reference) | Weapon + alien SFX dominant | Ambient ducked -6dB (world remains present — Pillar 1) |
| **Disengaging** | Fade-out (1.0s) | Tension SFX (footsteps, breathing) | Ambient fading in from -6dB to 0dB over 3.0s |
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
| **Immersive mode** | Ammo check (temporary) | On IA_Reload when not empty | Check animation (0.5s) is **interruptible** by any action (fire, dodge, sprint). Display persists for 2.0s regardless of interruption. |
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
| "Alien armor values" | `design/gdd/alien-ai-system.md` | Per-alien armor, health, combat behavior | Data dependency |
| "Weapon data, ammo counts" | `design/gdd/inventory-system.md` | Weapon items, ammo types, carry limits | Data dependency |
| "Recoil shake" | `design/gdd/camera-system.md` | AddRecoil(Amplitude, Duration), shake formulas | Data dependency |
| "Combat FOV (65°)" | `design/gdd/camera-system.md` | FOV transitions (smooth interpolation owned by Camera System), camera mode switching | Rule dependency |
| "Clue inaccessible during combat" | `design/gdd/investigation-system.md` | Some clues only accessible when not in combat | Rule dependency |
| "HP threshold for panic spread" | `design/gdd/health-system.md` | Player HP value, Injured/Near-Death state thresholds | Rule dependency |
| "Call for backup (Rule 8)" | `design/gdd/alien-ai-system.md` | Alien squad mechanics, backup response AI, arrival timing | Rule dependency |
| "Panic proximity condition (Rule 7)" | `design/gdd/alien-ai-system.md` | Per-alien distance query for 300cm proximity check | Data dependency |

## Acceptance Criteria

- **GIVEN** player has pistol equipped with 12 rounds in magazine, **WHEN** player fires one shot, **THEN** magazine shows 11 rounds, ammo reserve is unchanged, and hitscan trace registers hit on target within ±1.0° spread.

- **GIVEN** player fires pistol 5 times within 1.0s while standing stationary, **WHEN** 6th shot is fired, **THEN** spread = S_base(1.0°, pistol standing) + min(5 × 0.2°, 5.0°) + 0 = **2.0°** (no panic, standing, stationary).

- **GIVEN** player fires pistol and waits 1.5s, **WHEN** next shot is fired, **THEN** spread has reset to S_base (N_consecutive = 0 after 1.0s).

- **GIVEN** player shoots alien with pistol at head (body shot would deal 25), **WHEN** damage is calculated, **THEN** damage = ceil(25 × 1.5) = **38** (assuming clean weapon, unarmored, effective range).

- **GIVEN** player shoots alien with pistol beyond effective range (2000cm), **WHEN** damage is calculated, **THEN** damage = ceil(25 × M_distance=0.5) = **13** (assuming other multipliers = 1.0).

- **GIVEN** player fires shotgun at alien 30cm away and all 9 pellets hit body, **WHEN** damage is calculated, **THEN** total damage = 9 × ceil(60 × 1.0 × 1.0 × 1.0 × 1.0) = **540 damage** (one-shot kill on any alien ≤540 HP).

- **GIVEN** player initiates reload with 5 rounds in magazine and 20 in reserve, **WHEN** reload starts, **THEN** reserve decreases by 7 (to fill magazine to 12) immediately, and reload animation plays for 1.5s.

- **GIVEN** player initiates pistol reload with 0 rounds in magazine and only 3 rounds in reserve (less than fill needed = 12), **WHEN** reload starts, **THEN** actual_deduction = min(12-0, 3) = **3**; reserve becomes 0; magazine becomes 0+3 = **3 rounds**. No negative reserve. Reload animation plays to completion.

- **GIVEN** player initiates pistol reload with 5 rounds in magazine, **WHEN** damage cancels reload at 0.8s into 1.5s total, **THEN** magazine = max(5, ceil(0.8/1.5 × 12)) = max(5, 7) = **7 rounds**; reserve refund = 12-7 = **5 rounds returned** to reserve; player can act immediately.

- **GIVEN** player has 0 reserve ammo and magazine is empty, **WHEN** player attempts to fire, **THEN** weapon does not fire, "No Ammo" prompt shows for 1.0s, and player must switch weapons or melee.

- **GIVEN** stealth detection reaches 100 (Detected state), **WHEN** combat triggers, **THEN** Combat System pushes IMC_Combat within 0.1s, combat music fades in over 0.5s, and camera FOV narrows to 65°. At detection=75 (Engaged state): no IMC push, no music change.

- **GIVEN** all aliens within 2000cm are killed AND player is NOT in cover state, **WHEN** disengagement timer starts, **THEN** timer = T_base(10.0) + 0×T_per_alien + M_cover(0)×T_cover_bonus = **10.0s**. At 10.0s, IMC_Combat is popped and combat music fades out.

- **GIVEN** all aliens within 2000cm are killed AND player IS in cover state, **WHEN** disengagement timer starts, **THEN** timer = 10.0 + 0×2 + 1×(-3) = **7.0s** (Formula 3 minimum). IMC_Combat popped at 7.0s.

- **GIVEN** player breaks LOS with 2 alive aliens (both lost LOS) AND player is NOT in cover state, **WHEN** disengagement timer elapses (Formula 3: 10.0 + 2×2 + 0 = **14.0s**), **THEN** combat disengages, IMC_Combat is popped, and Stealth System recalculates from zero.

- **GIVEN** 3 aliens alive, player in cover, **WHEN** disengagement timer starts, **THEN** timer = 10 + (3 × 2) + (-3) = 13.0s.

- **GIVEN** disengagement timer is at 9.9s and an alien re-detects the player, **WHEN** detection occurs, **THEN** timer resets to 0 and combat re-engages immediately.

- **GIVEN** player melee attacks alien in Hidden state, **WHEN** player initiates the melee swing (attack input received, before hit connects), **THEN** combat triggers immediately, stealth is broken, and IMC_Combat is pushed — regardless of whether the swing hits or misses.

- **GIVEN** player swings melee at alien in Hidden state AND swing misses (no hit connection), **WHEN** swing animation plays, **THEN** combat is still triggered, IMC_Combat is pushed, stealth broken (trigger = swing initiation, not connection).

- **GIVEN** player has 5 stamina and tries to melee (costs 10), **WHEN** melee is attempted, **THEN** melee fails, stamina remains at 5, and "Too Exhausted" prompt shows for 1.0s.

- **GIVEN** player dodges during alien projectile travel time, **WHEN** projectile reaches player position during i-frame window (0.25s), **THEN** damage is fully negated, HP unchanged, no VFX/audio.

- **GIVEN** weapon is damaged AND dirty, **WHEN** player fires, **THEN** weapon has 15% chance to jam. If jam occurs, 2.0s unskippable animation plays to clear weapon.

- **GIVEN** tactical HUD is enabled, **WHEN** ammo is at 3/12 magazine with 8 reserve, **THEN** ammo counter shows "3/12 | 8" with color based on reserve percentage (8/60 = 13% → red).

- **GIVEN** player aims down sights during combat (FOV 65°), **WHEN** scope activates, **THEN** FOV changes to 60° (scoped). On scope release, FOV returns to 65° (combat), not 75° (default).

- **GIVEN** player HP is 25 (≤30% of 100), **WHEN** player fires pistol standing with 0 consecutive shots, **THEN** spread = S_base(1.0°) + 0 + M_panic_hp(1.5°) = **2.5°**.

- **GIVEN** player HP is 25 and alien is 200cm away, **WHEN** player fires pistol, **THEN** spread = 1.0° + 0 + (1.5° + 1.0°) = **3.5°** (both panic conditions active).

- **GIVEN** player fires rifle shot while in a zone with an unalerted alien 2000cm away, **WHEN** shot fires, **THEN** alien transitions to Alert state (within 2500cm rifle noise radius).

- **GIVEN** player fires pistol while in a zone with an unalerted alien 2000cm away, **WHEN** shot fires, **THEN** alien does NOT transition (pistol noise radius = 1000cm; 2000cm is outside range).

- **GIVEN** weapon jam animation starts (2.0s), **WHEN** player fires or dodges during animation, **THEN** input is queued but jam animation plays to completion; weapon is ready to fire after animation ends.

- **GIVEN** player triggers reload cancel by sprinting at 1.0s into 1.5s pistol reload (started with 5 rounds), **WHEN** cancel occurs, **THEN** magazine = max(5, ceil(1.0/1.5 × 12)) = max(5, 8) = **8 rounds**; reserve refund = 12-8 = **4 rounds returned**.

- **GIVEN** alien has maintained LOS to player for exactly 2.0s in combat, **WHEN** backup call triggers, **THEN** `OnBackupCalled(AlienID, Location)` event fires on Combat System and threat indicators update on HUD.

- **GIVEN** player lands 5 melee hits on alien A within a 3.0s window (each hit within 1.0s of previous), AND immediately switches to alien B, **WHEN** 1st melee hit connects on alien B, **THEN** recovery time = base **0.5s** (not 0.5 + 1×0.2 = 0.7s) — per-target counter resets to 0 on target switch, confirmed.

- **GIVEN** stealth detection is at 75 (Engaged state), **WHEN** player stays hidden and alien does not reach 100 detection, **THEN** IMC_Combat is NOT pushed, combat music does NOT start, and state remains Non-Combat.

## Open Questions

| # | Question | Owner | Target Resolution |
|---|----------|-------|-------------------|
| OQ-1 | Should weapons degrade over time (condition decreases with use), or only from environmental damage (water, alien acid)? Affects M_weapon_condition tuning. | game-designer | Inventory System GDD |
| OQ-2 | Should the player be able to scavenge ammo from dead aliens? Adds resource loop but may reduce scavenging tension. | game-designer | Alien AI System GDD |
| OQ-3 | Should alien armor be breakable (sustained fire on armored sections reduces armor)? Adds tactical depth but increases complexity. | game-designer | Alien AI System GDD |
| OQ-4 | ~~Should combat have a "panic" mechanic?~~ **RESOLVED** — Incorporated as Rule 7 (Panic State) and Formula 4. HP≤30% adds +1.5° spread; alien ≤300cm adds +1.0°. Both conditions stack to +2.5° max. Tuning knobs added. | — | Resolved 2026-05-20 |
| OQ-5 | Should weapon switching be instant in inventory screen but animated in-world? Affects combat pacing during weapon swaps. | ux-designer | Inventory System GDD |
| OQ-6 | Should the player be able to pick up alien weapons (biomass-based weapons)? Adds variety but may conflict with "human scarcity" theme. | game-designer | Alien AI System GDD |
| OQ-7 | Multiplayer (future) — hit registration authority, lag compensation, damage synchronization. | architecture | Multiplayer ADR |
