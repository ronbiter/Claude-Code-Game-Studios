# Faction Reputation System

> **Status**: In Design
> **Author**: user + agents
> **Last Updated**: 2026-05-04
> **Implements Pillar**: Pillar 1 (Hostile World), Pillar 2 (Earned Discovery), Pillar 3 (Tense Survival)

## Overview

The Faction Reputation System tracks the player's standing with survivor groups across the infected world — resistance camps, scavenger gangs, military remnants, and potentially others. Each faction maintains an independent reputation score that shifts based on the player's actions: completing contracts, saving or abandoning camps, killing allies, sharing intelligence, and choosing sides in faction conflicts. Reputation operates on a spectrum from **Hostile** (faction members attack on sight) to **Allied** (faction shares resources, information, and sanctuary).

Unlike the Dialogue System's per-NPC Trust/Fear/Knowledge model, this system operates at the **group level** — individual NPC relationships aggregate into faction-wide reputation. Helping one member of a camp raises standing with the entire group. Killing a faction member can sour relations across all their allies.

For the player, faction reputation gates access to safe zones, trade opportunities, quest contracts, and investigation leads. It also creates the signature tension of this game: improving your standing with one faction may actively damage another, and the hostile world means every alliance has a cost. Without this system, the player would be an isolated wanderer. With it, every choice ripples across the social fabric of the apocalypse.

## Player Fantasy

The Faction Reputation System makes the player feel **like a valuable asset in a world that wants to use them**. Every faction measures the player by utility, not goodwill. The immune mercenary is not welcomed — they are priced. The signature moment: the player arrives at a resistance camp, half-dead from an infected zone crossing. Guards level their weapons. The camp leader recognizes the player's immune status — maybe from a shared survivor, maybe from blood-stained gear showing no infection signs. The weapons lower. Not because they trust the player. Because the player is worth more alive than dead. A bed, food, a map — and a contract. Nothing is free. Trust is always priced.

For the player, reputation is not a number on a screen — it is **the difference between a safe haven and a kill zone**. High standing with a faction means shelter, trade, shared intelligence, and allies who watch your back. Low standing means every camp is hostile, every encounter a potential ambush. The tension comes from the fact that improving standing with one faction may actively damage another — and the hostile world means every alliance has a cost in time, resources, and moral compromise.

This serves **Pillar 1 (Hostile World)** — factions are surviving the same transformation as everything else. Their offers reflect their desperation. A camp that was an ally today may be desperate tomorrow as the infection spreads. Faction standing is not permanent — it breathes with the world.

**Pillar 2 (Earned Discovery)** — faction motives, weaknesses, and true agendas are uncovered through investigation and observation, not exposition. The player learns what a faction really wants by digging into their history, reading their documents, and watching how they treat their own people.

**Pillar 3 (Tense Survival)** — reputation is a survival resource. High standing means shelter, ammo, information. Low standing means every zone is hostile. Every act of alignment costs something: time spent at one camp is time not preparing for another, resources shared are resources lost, moral compromises compound.

## Detailed Design

### Core Rules

**Rule 1 — Faction Roster**

Each faction occupies a distinct zone and serves a different role in the social landscape:

| Faction | Zone | Description | Priority |
|---------|------|-------------|----------|
| **The Remnant** | Mountain Outpost / Bunker | Ex-military survivors from the prison complex. Organized, armed, pragmatic. They see the player's immunity as a tactical asset. | Vertical Slice |
| **The Tethered** | Infected Town (Zone 02) | Civilian survivors who stayed and adapted. Scavengers, medics, desperate families. They distrust the military but need the player's immunity for cure research. | Vertical Slice |
| **The Hollowed** | Underground Tunnels / Hive Fringe | Infected-but-sentient humans. Not fully alien, not fully human. Player's immunity makes them unique — they may recognize the player as "one who walks between." | Post Vertical Slice |
| **The Watch** | Ridge Overlook / Radio Tower | Isolationist observers. Former researchers who document rather than intervene. They have the most information about the infection's origin but refuse to share it freely. | Post Vertical Slice |

**Rule 2 — Reputation Scale and Standing Tiers**

Reputation is a signed integer from **-100 to +100** per faction. Zero is the neutral baseline — the faction is aware of the player but has no strong opinion. Negative means actively hostile.

| Standing Tier | Range | Behavioral Effect |
|---------------|-------|-------------------|
| **Hunted** | -100 to -76 | Faction members attack on sight. No dialogue. No trade. Active tracking patrols in shared zones. |
| **Hostile** | -75 to -51 | Faction refuses dialogue. Guards raise weapons if player enters zone. Trade unavailable. |
| **Wary** | -50 to -26 | Player allowed in zone under guard escort. Limited dialogue (surface topics only). No trade. Player can overhear faction intel. |
| **Unknown** | -25 to +25 | Faction is aware of player but neutral. Basic dialogue available. No special trade prices. No quest contracts beyond initial offers. |
| **Known** | +26 to +50 | Faction recognizes player as useful. All dialogue topics available (gated by individual NPC Trust). Trade unlocked at standard prices. Survivor Contracts available. |
| **Trusted** | +51 to +75 | Faction treats player as ally. Passive combat support in shared zones (cover fire, healing, intel callouts). Trade prices improved 15%. Advanced contracts available. |
| **Allied** | +76 to +100 | Faction treats player as one of their own. Player can access faction shelter (safe zone with bed, crafting station, stash). Trade prices improved 30%. Unique faction quest chain unlocked. Faction members may follow player into combat (1-2 max). |

**Rule 3 — Reputation Modification Sources**

| Source | Delta Range | Trigger |
|--------|-------------|---------|
| Quest completion (turn-in) | +10 to +40 | Quest System calls `ModifyFactionReputation(FactionId, Delta)` on successful turn-in |
| Quest failure | -5 to -20 | Quest System applies penalty when player fails a faction's contract |
| Quest betrayal | -30 to -50 | Player actively sabotages the faction's interests during a contract |
| Killing faction member | -15 to -40 | Player kills an NPC belonging to the faction. Scaled by importance: ambient = -15, named = -25, leader = -40 |
| Saving faction member | +10 to +25 | Player rescues a faction NPC from combat or infection. Scaled by threat level |
| Resource sharing | +5 to +15 | Player voluntarily donates resources to faction's shared stash |
| Investigation sharing | +5 to +20 | Player shares discovered clues with faction members. Scaled by clue significance |
| Faction conflict choice | +20 / -20 | Player chooses one faction's side in a direct conflict |
| Abandoning faction zone | -5 | Player leaves faction zone while infection is rising and they promised to help |
| Passive decay | -2 per in-game day | If player has not interacted with faction for 7+ in-game days and zone infection is increasing |
| Immunity reveal | +10 (one-time) | First time the faction learns the player is immune |

**Rule 4 — Clamping and Boundaries**

- All reputation values clamp to [-100, +100] after each delta application.
- Reputation changes are cumulative within a single action (e.g., killing a faction member AND stealing from their stash = two separate deltas applied sequentially).
- The system fires `OnFactionReputationChanged(FactionId, NewValue, Delta, Reason)` after each change.

**Rule 5 — Faction-NPC Relationship Bridge**

Faction Reputation and per-NPC Trust/Fear/Knowledge are **separate systems** with defined bridge rules:

| Bridge Rule | Effect |
|-------------|--------|
| Faction reputation floors NPC Trust | An NPC's Trust cannot exceed the faction's reputation tier cap. If faction is Wary (-26 to -50), NPC Trust caps at 40 regardless of individual interactions. |
| NPC Fear is independent | Faction reputation does not cap Fear. A trusted faction member can still be terrified of the player. |
| NPC Knowledge is independent | Faction reputation does not affect what individual NPCs know. |
| Individual actions can override | If the player saves an NPC's life, that NPC's Trust increases even if faction reputation is Hostile. The NPC may then offer secret dialogue (hidden from their faction). |
| Faction leader initial Trust | A Faction Leader's initial Trust is mapped from faction reputation: `InitialTrust = clamp(Reputation + 100, 0, 100) / 2`. |

**Rule 6 — Faction-Faction Relationship Matrix**

Each faction pair has a relationship state that shifts based on player actions:

| Relationship | Effect |
|--------------|--------|
| Allied (+2) | Helping one gives +5 to the other (minor goodwill). |
| Neutral (0) | Player actions toward one have no effect on the other. |
| Rival (-1) | Helping one gives -5 to the other (minor resentment). |
| Hostile (-2) | Helping one gives -10 to the other. Factions may attack each other on sight. |

**Vertical Slice initial relationships:**

| Faction A | Faction B | Relationship |
|-----------|-----------|--------------|
| The Remnant | The Tethered | Rival (-1) |

**Rule 7 — Ripple Effects**

When player changes faction reputation, connected factions may be affected:

| Trigger Delta | Ripple to Rival Faction | Ripple to Hostile Faction |
|---------------|------------------------|--------------------------|
| > 25 points | Half delta (inverted, rounded) | Half delta (inverted, rounded) |
| 10–25 points | -5 | -10 |
| < 10 points | None | None |

If two factions are Allied, negative ripples between them are reduced by 50%.

**Rule 8 — The Immunity Premium**

When the player first reveals their immunity to a faction (through dialogue, investigation, or observed behavior), the faction's reputation instantly shifts by +10 from the Unknown baseline. This is a one-time event per faction, recorded in save data.

### States and Transitions

**Faction Reputation State Machine** (tracked per faction):

| State | Entry Condition | Exit Condition | Behavior |
|-------|----------------|----------------|----------|
| **Unknown** | Initial state (no interaction) | Player performs first reputation-modifying action | Faction is aware of player but neutral. Basic dialogue available. No trade, no contracts. |
| **Engaged** | First reputation change from baseline | Reputation crosses a tier boundary | Player is actively interacting with this faction. Reputation changes trigger notifications. |
| **Aligned** | Reputation ≥ +26 (Known or higher) | Reputation drops below +26 | Faction offers trade, contracts, shelter access (at Allied). Player has standing. |
| **Hostile State** | Reputation ≤ -26 (Wary or lower) | Reputation rises above -26 | Faction restricts or blocks access. Guards react to player presence. |
| **Conflict** | Player triggers faction conflict event | Player makes a choice or both factions escalate | Both factions demand player alignment. Timer starts (48 in-game hours). |

**Faction Relationship State Machine** (tracked per faction pair):

| State | Entry Condition | Exit Condition | Behavior |
|-------|----------------|----------------|----------|
| **Allied** | Authored initial state OR player-mediated reconciliation | Player action or world event shifts relationship | Minor positive ripples between factions. |
| **Neutral** | Authored initial state OR relationship decays from Allied | Player action or world event | No ripples. Factions ignore each other. |
| **Rival** | Authored initial state OR relationship degrades | Player action or world event | Minor negative ripples. Resource competition. |
| **Hostile** | Relationship degrades from Rival due to player action or infection threshold | Player-mediated reconciliation OR faction destroyed | Major negative ripples. Factions may fight on sight in shared zones. |

### Interactions with Other Systems

| System | Direction | Data Flow | Interface |
|--------|-----------|-----------|-----------|
| **Dialogue System** | Reads + Writes | Faction membership for NPCs, Trust floor calculation, immunity reveal trigger | `GetNPCFaction(NPCId)` — Faction System tells Dialogue System which faction an NPC belongs to. Dialogue System calls `OnImmunityRevealed(FactionId)` when player first reveals immunity to a faction. Dialogue System reads faction reputation to floor NPC Trust per Bridge Rule 5. |
| **Quest System** | Reads + Writes | Faction gates for contract acceptance, faction reputation rewards on turn-in | `GetFactionReputation(FactionId)` — Quest System checks faction gates (Rule 6 of Quest GDD). `ModifyFactionReputation(FactionId, Delta, QuestComplete/Failed/Betrayal)` — Quest System applies reputation changes on contract turn-in. |
| **HUD System** | Reads | Faction reputation display, standing tier indicator | `GetFactionReputation(FactionId)`, `GetFactionStanding(FactionId)` — HUD renders faction reputation bars and tier labels. |
| **Scene Management** | Reads | Zone ownership for faction access gating | `GetZoneFaction(ZoneId)` — Faction System knows which faction controls each zone. Zone access is gated by faction standing (escort for Wary, blocked for Hostile/Hunted). |
| **Alien AI System** | Reads | Faction hostility for combat behavior | Faction members at Hunted standing may be treated as additional threats by alien AI (shared aggro pools, coordinated patrols). |
| **Inventory System** | Reads | Resource sharing actions, trade price calculation | `OnResourceShared(FactionId, ItemId, Quantity)` — Faction System registers donation events. Trade prices calculated from standing tier (standard at Known, -15% at Trusted, -30% at Allied). |
| **Infection Spread System** | Reads | Zone infection level for passive decay and world-state shifts | `GetZoneInfectionLevel(ZoneId)` — Faction System checks if zone infection exceeds 75% to trigger faction relationship degradation and passive reputation decay. |
| **Combat System** | Reads + Writes | Faction member kills/saves, combat support from allied factions | `OnNPCDied(NPCId)` — Faction System checks if killed NPC is a faction member and applies reputation delta. `OnNPCRescued(NPCId)` — Same for saves. Allied factions may send NPCs to assist player in combat. |
| **Save/Load System** | Reads + Writes | Faction reputation state, relationship matrix, immunity reveal flags | `SaveFactionState()`, `RestoreFactionState()` — persists all faction data including per-faction reputation, faction-faction relationships, and one-time events. |

## Formulas

**Formula 1 — Faction Reputation Delta**

The `faction_reputation_delta` formula calculates the actual reputation change from any action:

```
delta_raw = base_delta × (1.0 + K_infection × infection_level + K_desperation × desperation_level)
delta_rounded = round(delta_raw)
result = clamp(current_rep + delta_rounded, -100, +100)
```

**Variables:**

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| Authored base delta | base_delta | int32 | [-50, +40] | The authored delta from the action table (Rule 3) |
| Current reputation | current_rep | int32 | [-100, +100] | Faction's reputation before this delta |
| Zone infection level | infection_level | float | [0.0, 1.0] | Normalized zone infection (0.0 = clean, 1.0 = fully infected) |
| Faction desperation | desperation_level | float | [0.0, 1.0] | Faction-specific desperation state (0.0 = stable, 1.0 = critical) |
| Infection weight | K_infection | float | 0.5 | Weight for zone infection's amplification effect |
| Desperation weight | K_desperation | float | 0.5 | Weight for faction desperation's amplification effect |

**Output Range:** [-100, +100] (clamped)
**Max amplified delta:** ±75 (when both context multipliers are 1.0)

**Example:** Player completes a quest for The Remnant (base_delta = +25). Zone infection = 60%, faction desperation = 40%. Current rep = +30.

```
delta_raw = 25 × (1.0 + 0.5 × 0.60 + 0.5 × 0.40)
          = 25 × (1.0 + 0.30 + 0.20)
          = 25 × 1.50 = 37.5

delta_rounded = 38
result = clamp(30 + 38, -100, +100) = clamp(68) = 68
```

Reputation moves from +30 to +68 (Unknown → Trusted). The context amplified +25 into +38.

---

**Formula 2 — Standing Tier Lookup**

The `standing_tier_from_reputation` formula maps a reputation value to its named tier:

```
tier = piecewise:
  if rep ≤ -76:           "Hunted"
  if -75 ≤ rep ≤ -51:     "Hostile"
  if -50 ≤ rep ≤ -26:     "Wary"
  if -25 ≤ rep ≤ +25:     "Unknown"
  if +26 ≤ rep ≤ +50:     "Known"
  if +51 ≤ rep ≤ +75:     "Trusted"
  if rep ≥ +76:           "Allied"
```

**Variables:**

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| Reputation value | rep | int32 | [-100, +100] | Current faction reputation |
| Standing tier | tier | enum | 7 values | Named tier corresponding to rep |

**Output Range:** One of {Hunted, Hostile, Wary, Unknown, Known, Trusted, Allied}

**Example:** rep = +52 → falls in [+51, +75] → "Trusted". rep = -76 → ≤ -76 → "Hunted".

---

**Formula 3 — Ripple Effect**

The `ripple_effect` formula calculates how a reputation change in one faction propagates to another:

```
abs_delta = |source_delta|

if abs_delta < 10:
    ripple = 0
elif abs_delta ≥ 25:
    ripple = round(source_delta / 2.0) × -1   // invert halved delta
else:  // 10 ≤ abs_delta < 25
    if source_delta > 0:   // helping one faction
        ripple = -5  (Rival) or -10 (Hostile) or 0 (Neutral)
    else:                  // harming one faction
        ripple = +5  (Rival) or +10 (Hostile) or 0 (Neutral)

if relationship == "Allied" and ripple < 0:
    ripple = ceil(ripple / 2.0)   // negative ripples reduced by 50%

result = clamp(target_rep + ripple, -100, +100)
```

**Variables:**

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| Source faction delta | source_delta | int32 | [-75, +60] | The rounded delta applied to the source faction |
| Target faction reputation | target_rep | int32 | [-100, +100] | Target faction's reputation before ripple |
| Relationship state | relationship | enum | Allied/Neutral/Rival/Hostile | Relationship between source and target factions |
| Computed ripple | ripple | int32 | [-38, +38] | Delta applied to the target faction |

**Output Range:** [-100, +100] (clamped). Ripple value itself ranges from -38 to +38.

**Example (Rival, large positive delta):** Player gives Remnant +39. Remnant and Tethered are Rivals.

```
abs_delta = 39, abs_delta ≥ 25:
  ripple = round(39 / 2.0) × -1 = 20 × -1 = -20
result = clamp(10 + (-20), -100, +100) = -10
```

Tethered drops from +10 to -10 due to helping their rival.

---

**Formula 4 — Trade Price Modifier**

The `trade_price_modifier` formula calculates the price multiplier for trading with a faction:

```
tier = standing_tier_from_reputation(rep)

modifier = piecewise:
  if tier in {Hunted, Hostile, Wary}:  no trade (unavailable)
  if tier == "Unknown":                 1.00
  if tier == "Known":                   1.00
  if tier == "Trusted":                 0.85
  if tier == "Allied":                  0.70
```

**Variables:**

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| Reputation value | rep | int32 | [-100, +100] | Current faction reputation |
| Price modifier | modifier | float | {N/A, 1.00, 0.85, 0.70} | Price multiplier (N/A = trade unavailable) |

**Output Range:** Discrete set {unavailable, 1.00, 0.85, 0.70}

**Example:** rep = +60 → "Trusted" → modifier = 0.85. Item costing 100 sells for 85.

## Edge Cases

**EC-1 — Single delta crosses multiple tier boundaries**: If a reputation change pushes the value across two or more tier thresholds (e.g., from -30 Wary to +30 Known in one action), fire `OnFactionStandingChanged` once with the final tier. No intermediate tier notifications. All behavioral effects of the final tier apply immediately.

**EC-2 — Player kills faction member while Allied**: Killing an Allied faction member applies the full reputation penalty (-25 named / -40 leader). No immunity for high standing. If the resulting reputation drops below the tier threshold, standing updates immediately and NPC behavior changes (guards may detain or attack the player if they drop to Hostile or below).

**EC-3 — Two factions both at Hunted**: Intentional failure state. Player has no safe zones from either faction. Only neutral or uncontrolled zones are accessible. Not a bug — this is the designed consequence of maximum hostility with all factions.

**EC-4 — Faction zone reaches 100% infection with no migration path**: If a faction's zone is fully infected and no migration route exists (authored content), the faction's desperation locks at 1.0 permanently. Reputation decay from passive decay doubles to -4 per in-game day. Faction may disband (all members become ambient infected NPCs) — this is an authored event, not automatic.

**EC-5 — Player abandons contract mid-objective**: Reputation penalty applies immediately at abandonment (-5 base). Passive decay of -2 per in-game day continues for 3 days or until the player returns to the zone, whichever comes first. Maximum accumulated penalty from a single abandoned contract: -11 total (-5 immediate + 3 × -2 decay).

**EC-6 — Faction member killed by alien AI or environmental hazard**: No reputation change. The faction does not blame the player for deaths they did not cause. However, if the faction was in a Conflict state (both factions demanding alignment), the death of a faction's leader by non-player causes triggers an automatic timeout — the Conflict resolves after 72 in-game hours with no player penalty.

**EC-7 — Player is in combat when standing changes**: UI notifications for standing changes are deferred until combat ends. Behavioral changes (guards becoming hostile, trade becoming available) still apply immediately but are not visually telegraphed until combat exits. Combat state is defined as: any NPC with the player in their aggro pool, or the player has taken damage in the last 5 seconds.

**EC-8 — Ripple pushes a faction across a tier boundary unintentionally**: No override. Ripples are a designed consequence of the faction relationship matrix. If helping Faction A causes Faction B to drop from Known to Wary via ripple, that is the intended outcome. The player is informed of the consequence via notification: "The Tethered notice your alliance with The Remnant."

**EC-9 — All faction members in a zone die**: The zone becomes "uncontrolled." Reputation with that faction freezes (no passive decay, no new actions possible) until the faction is re-established (authored content). Trade, contracts, and dialogue with that faction become unavailable regardless of standing tier.

**EC-10 — Save data corruption (partial faction state lost)**: If faction reputation data is missing or corrupted in a save file, default all factions to Unknown (rep = 0, tier = Unknown). Preserve immunity reveal flags independently — if `bImmunityRevealed` is intact, the +10 one-time bonus is not re-applied. Faction-faction relationship matrix defaults to authored initial state. Notify player on load: "Some alliance data was lost."

## Dependencies

**Hard Dependencies (system cannot function without these):**

| System | Direction | Interface | Purpose |
|--------|-----------|-----------|---------|
| **Quest System** | Read/Write | `GetFactionReputation(FactionId)`, `ModifyFactionReputation(FactionId, Delta, Reason)` | Quest gates check faction standing; quest turn-in applies reputation changes |
| **Dialogue System** | Read/Write | `GetNPCFaction(NPCId)`, `OnImmunityRevealed(FactionId)` | Dialogue System reads faction membership for NPCs; Faction System reads Trust floor caps from Bridge Rule 5 |
| **Combat System** | Read/Write | `OnNPCDied(NPCId)`, `OnNPCRescued(NPCId)` | Faction System applies reputation deltas from kills/saves; reads standing for combat support behavior |

**Soft Dependencies (enhanced by these but works without):**

| System | Direction | Interface | Purpose |
|--------|-----------|-----------|---------|
| **HUD System** | Read | `GetFactionStanding(FactionId)` | HUD renders faction reputation bars and tier labels. Without this, reputation is invisible to the player but still functions. |
| **Inventory System** | Read | `OnResourceShared(FactionId, ItemId, Quantity)` | Resource sharing triggers reputation gains. Faction System calculates trade price modifiers. Without this, resource sharing and trade still function but lack price feedback. |
| **Scene Management** | Read | `GetZoneFaction(ZoneId)`, `GetZoneInfectionLevel(ZoneId)` | Zone access gated by faction standing. Infection level amplifies reputation deltas. Without this, zones are always accessible. |
| **Infection Spread System** | Read | `GetZoneInfectionLevel(ZoneId)` | Zone infection drives passive decay and desperation amplification. Without this, decay is constant at base rate. |
| **Alien AI System** | Read | N/A (read-only) | Alien AI treats Hunted-standing faction members as shared-threat targets. Without this, faction combat behavior is independent of alien AI. |
| **Save/Load System** | Read/Write | `SaveFactionState()`, `RestoreFactionState()` | Persists faction reputation, relationship matrix, and immunity reveal flags. Without this, faction state resets on load. |
| **Lore/Journal System** | Read | `GetFactionReputation(FactionId)`, `GetFactionStanding(FactionId)` | Lore entries may unlock at certain standing tiers. Undesigned — interface is provisional. |

## Tuning Knobs

| Knob | Default | Safe Range | Affects | Extreme Behavior |
|------|---------|------------|---------|------------------|
| `K_infection` (infection amplification weight) | 0.5 | [0.0, 1.0] | How much zone infection amplifies reputation deltas | At 0.0: context has no effect. At 1.0: max infection doubles delta. |
| `K_desperation` (desperation amplification weight) | 0.5 | [0.0, 1.0] | How much faction desperation amplifies reputation deltas | At 0.0: desperation has no effect. At 1.0: max desperation doubles delta. |
| `PassiveDecayRate` (rep lost per in-game day) | 2 | [0, 10] | How fast reputation erodes from disengagement | At 0: reputation never decays (alliance is permanent). At 10: -70 rep in 7 days — player must constantly maintain relationships. |
| `PassiveDecayThreshold` (days before decay starts) | 7 | [3, 21] | How long a player can ignore a faction before decay begins | At 3: factions forget quickly — player must visit every faction regularly. At 21: player can abandon factions for weeks with no penalty. |
| `RippleThreshold_Small` (min abs delta for small ripple) | 10 | [5, 20] | Minimum delta that triggers any ripple effect | Lower = small actions ripple further. Higher = only major actions affect rival factions. |
| `RippleThreshold_Large` (min abs delta for halved ripple) | 25 | [15, 50] | Minimum delta that triggers half-inverted ripple | Lower = more ripples are halved (reduces impact on rivals). Higher = more ripples use fixed values. |
| `TradePrice_Trusted` (multiplier at Trusted tier) | 0.85 | [0.70, 1.00] | Trade price discount for Trusted standing | At 0.70: same as Allied — Trusted becomes too valuable. At 1.00: no discount — Trusted feels unrewarding. |
| `TradePrice_Allied` (multiplier at Allied tier) | 0.70 | [0.50, 0.85] | Trade price discount for Allied standing | At 0.50: half price — economy inflation risk. At 0.85: same as Trusted — Allied discount feels unrewarding. |
| `ImmunityRevealBonus` (one-time reputation boost) | +10 | [5, 25] | Reputation gained when faction first learns player is immune | At +5: barely noticeable — reveal feels underwhelming. At +25: jumps from Unknown (+25) to +35 (Known) — too easy to reach Known. |
| `ConflictTimerHours` (in-game hours for faction conflict) | 48 | [24, 120] | How long player has before faction conflict auto-resolves | At 24: pressure is high, player must choose quickly. At 120: conflict is too diffuse, loses urgency. |
| `AbandonmentDecayDays` (days of decay after contract abandonment) | 3 | [1, 7] | How long passive decay continues after abandoning a contract | At 1: decay is brief. At 7: maximum -19 from single abandoned contract (-5 immediate + 7 × -2). |
| `CombatStateDamageWindowSeconds` (seconds since last damage to exit combat) | 5 | [2, 15] | How long after taking damage the player is still "in combat" | At 2: notifications fire almost immediately. At 15: player can be in prolonged combat state, notifications pile up. |

**Interactions between knobs:**
- `K_infection` and `K_desperation` share the same amplification formula. Setting both to 1.0 yields a 2.0x multiplier (delta doubles). If this is too strong, reduce individual knobs rather than the formula.
- `TradePrice_Trusted` and `TradePrice_Allied` must maintain the invariant: `TradePrice_Allied < TradePrice_Trusted`. If set equal, the Allied trade benefit disappears.
- `PassiveDecayRate` and `PassiveDecayThreshold` interact: high decay rate + low threshold = reputation constantly eroding, which can feel punitive. Recommended ratio: decay rate ≤ 3 when threshold ≤ 7.

## Visual/Audio Requirements

### Visual Feedback

| Event | Visual Requirement | Priority |
|-------|-------------------|----------|
| Reputation increase | Subtle HUD indicator — faction icon glows briefly with upward arrow. Duration: 1.5 seconds. Non-blocking (does not obscure gameplay). | Vertical Slice |
| Reputation decrease | Faction icon flashes red briefly with downward arrow. Duration: 1.5 seconds. Same priority as increase. | Vertical Slice |
| Tier change | Larger notification — faction icon + tier name displayed. "Allied with The Remnant" or "Now Hunted by The Tethered." Duration: 3 seconds. | Vertical Slice |
| Ripple effect | Secondary notification chained to primary: "The Tethered notice your actions." Duration: 2 seconds. Chained 0.5s after primary notification. | Vertical Slice |
| Standing tier indicator | Persistent faction standing bar visible when player is near faction zone or in dialogue. Shows current tier label and approximate position within tier range. | Vertical Slice |
| Combat standing change | Notification deferred until combat ends (EC-7). Queued and displayed when combat state exits. | Vertical Slice |

### Audio Feedback

| Event | Audio Requirement | Priority |
|-------|-------------------|----------|
| Reputation increase | Short, ascending tone (2-3 notes). Mix: UI channel, -6dB relative to SFX. | Vertical Slice |
| Reputation decrease | Short, descending tone (2-3 notes). Same mix as increase. Distinct timbre from increase (lower register). | Vertical Slice |
| Tier change (positive) | Longer fanfare (4-5 notes). Distinct from increase — more weight, slightly longer reverb. | Vertical Slice |
| Tier change (negative) | Dissonant chord or descending drone. Distinct from decrease — signals permanence of the shift. | Vertical Slice |
| Ripple effect | No dedicated sound — the audio belongs to the source event. Ripple is a visual-only notification. | Post Vertical Slice |

### Art Direction Notes

- Faction icons should be visually distinct and readable at small sizes (HUD bar uses ~32x32px icons).
- Tier colors should follow a warm-to-cool progression: Hunted/Hostile = deep red → Wary = orange → Unknown = gray → Known = blue → Trusted = green → Allied = gold.
- The visual style should feel diegetic where possible — the standing indicator reads like a military/intelligence dossier, not a gamey progress bar.

## UI Requirements

### Faction Reputation Panel (Pause Menu)

| Element | Description | Notes |
|---------|-------------|-------|
| Faction list | One row per known faction. Shows faction icon, name, standing tier label, and a horizontal bar from -100 to +100 with current position marked. | Vertical Slice: 2 factions |
| Standing bar | Horizontal bar with center notch at 0. Left side = hostile range (red tinted), right side = friendly range (green tinted). Current rep shown as a vertical marker. | Tiers marked with thin vertical dividers at -76, -51, -26, +26, +51, +76 |
| Tier label | Text label next to bar: "Known", "Trusted", etc. | Color matches tier color from Visual/Audio section |
| Ripple preview | When a pending reputation change is queued (e.g., about to turn in a quest), show the projected new position on the bar and any ripple effects to other factions as a tooltip. | Post Vertical Slice |
| Faction detail | Clicking a faction row expands to show: relationship status with other factions, trade price modifier, available contract types, and any active conflicts. | Post Vertical Slice |

### In-World HUD

| Element | Description | Notes |
|---------|-------------|-------|
| Reputation change toast | Brief notification appears at top-center of screen when reputation changes. Shows faction icon, delta (+15 / -20), and reason ("Quest Complete"). Defers during combat (EC-7). | Vertical Slice |
| Tier change toast | Larger notification replacing the toast. Shows faction icon, old tier → new tier, and a brief flavor line ("The Remnant counts you among their own."). | Vertical Slice |
| Zone approach indicator | When player enters a faction-controlled zone, the zone loading screen or approach marker shows the faction's current standing toward the player. | Vertical Slice |

### Input / Navigation

- Panel navigable with gamepad d-pad (per platform requirements).
- Faction rows selectable with Up/Down.
- Detail expand/collapse with A (gamepad) or Enter (keyboard).
- Panel closes with B (gamepad) or Escape (keyboard).

## Acceptance Criteria

**AC-1 — Reputation modification applies correctly**: GIVEN a faction at reputation +30, WHEN the player completes a quest with base_delta = +25 and context amplifiers at 50% (infection + desperation), THEN the reputation increases to +68 (clamped and rounded per Formula 1).

**AC-2 — Reputation clamps to bounds**: GIVEN a faction at reputation +95, WHEN an action applies +10 delta, THEN the reputation is +100 (not +105). GIVEN a faction at -95, WHEN an action applies -10 delta, THEN the reputation is -100 (not -105).

**AC-3 — Standing tier lookup returns correct tier**: GIVEN any reputation value from -100 to +100, WHEN the tier is queried, THEN the correct tier name is returned per Formula 2. Verify boundary values: -76 → Hunted, -75 → Hostile, -51 → Hostile, -50 → Wary, -26 → Wary, -25 → Unknown, +25 → Unknown, +26 → Known, +50 → Known, +51 → Trusted, +75 → Trusted, +76 → Allied.

**AC-4 — Ripple propagates to rival faction correctly**: GIVEN Remnant at +39 delta and Tethered at +10 reputation (Rival relationship), WHEN the ripple is applied, THEN Tethered's reputation becomes -10 (per Formula 3: ripple = -20).

**AC-5 — Trade price modifier matches standing tier**: GIVEN Allied standing, WHEN trade prices are calculated, THEN the modifier is 0.70. GIVEN Trusted, THEN 0.85. GIVEN Known or Unknown, THEN 1.00. GIVEN Wary or below, THEN trade is unavailable.

**AC-6 — Faction-NPC bridge caps Trust correctly**: GIVEN a faction at Wary standing (-30), WHEN an NPC's individual Trust is queried, THEN it cannot exceed 40 regardless of positive individual interactions.

**AC-7 — Immunity reveal applies one-time bonus**: GIVEN a faction the player has never revealed immunity to, WHEN the OnImmunityRevealed event fires for the first time, THEN reputation increases by +10. WHEN the same event fires a second time for the same faction, THEN no change occurs.

**AC-8 — Passive decay applies after threshold**: GIVEN a faction the player has not interacted with for 8 in-game days, WHEN a game tick occurs, THEN the faction reputation decreases by the configured PassiveDecayRate (-2 per day by default).

**AC-9 — Killing faction member while Allied applies full penalty**: GIVEN Allied standing (+80), WHEN the player kills a named faction member (delta = -25), THEN reputation becomes +55 (Known tier). The standing change triggers immediate behavioral updates.

**AC-10 — Faction relationship matrix affects ripple direction**: GIVEN two factions in Rival relationship, WHEN the player helps Faction A, THEN Faction B receives a negative ripple. GIVEN two factions in Allied relationship, WHEN the player helps Faction A, THEN Faction B's negative ripple is reduced by 50%.

**AC-11 — Save/Load preserves faction state**: GIVEN a saved game with multiple factions at various standing tiers, WHEN the game is loaded, THEN all faction reputations, relationship states, and immunity reveal flags are restored to their saved values.

**AC-12 — Combat-deferred notification fires after combat exits**: GIVEN the player is in combat and receives a reputation change, WHEN combat ends, THEN the notification is displayed. The notification does not appear during combat.

## Open Questions

| # | Question | Impact | Suggested Owner | Target |
|---|----------|--------|-----------------|--------|
| OQ-1 | Should faction reputation be visible as a numeric value to the player, or only as a tier label? The numeric value gives precision but may encourage min-maxing behavior. Tier-only is more immersive but less informative. | Player-facing information design | Game Designer | Before Vertical Slice |
| OQ-2 | What happens if the player is at Allied standing with both factions simultaneously? Is this achievable given the Rival relationship between Remnant and Tethered? If yes, does it create a dominant strategy? | Balance / faction dynamics | Systems Designer | Before Vertical Slice |
| OQ-3 | Should the Hollowed (infected-but-sentient) faction have a different reputation model? Their recognition of the player as "one who walks between" may not fit the -100 to +100 scale. | Lore / mechanical consistency | Narrative Director + Game Designer | Post Vertical Slice |
| OQ-4 | What is the authored trigger for the "Immunity Reveal" event? Should it be automatic on first dialogue with a faction leader, or require a specific story beat? | Story pacing | Narrative Director | Before Vertical Slice |
| OQ-5 | Should faction conflicts escalate automatically based on world state (e.g., infection level crossing thresholds), or only through player-triggered events? | World reactivity scope | Game Designer | Post Vertical Slice |
| OQ-6 | How does the Save/Load System serialize faction state? Struct-based UObject or data table? This affects moddability and save file size. | Technical architecture | Unreal Specialist | Pre-implementation |
