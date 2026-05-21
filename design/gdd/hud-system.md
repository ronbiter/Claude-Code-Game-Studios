# HUD System

> **Status**: Draft
> **Author**: user + agents
> **Last Updated**: 30 April 2026
> **Last Verified**: 30 April 2026
> **Implements Pillar**: Pillar 2 (Earned Discovery), Pillar 3 (Tense Survival)

## Summary

The HUD System is the player-facing information layer for Hostile World, operating in two distinct modes: Immersive (default, minimal UI — information conveyed through environmental cues, posture, audio, and subtle screen effects) and Tactical (full information display — health bars, ammo counters, detection meters, minimap, threat indicators). The HUD mode is selected in the options menu and cannot be changed during gameplay — each mode is a complete, self-contained experience. The system aggregates data from 10+ subsystems and decides what to display, when, and how, ensuring the player always has the information they need without breaking the game's core pillars of earned discovery and tense survival.

> **Quick reference** — Layer: `Core` · Priority: `MVP` · Key deps: `Player Controller, Health, Combat, Stealth, Camera`

## Overview

Hostile World's HUD is not a single UI — it is two different games. The Immersive mode is the intended experience: no health bar, no ammo counter, no minimap, no detection meter. The player reads their health from their character's posture and breathing, checks ammo by performing a "check magazine" animation, navigates by landmarks, and detects alien proximity through audio and environmental cues. The Tactical mode provides full information: health bar with numeric HP, persistent ammo counter, minimap with threat dots, detection meter, stamina bar, and zone name. Both modes are complete and playable — neither is a "lite" version of the other.

The HUD System's architecture reflects this duality. It has two independent rendering pipelines (ImmersiveRenderer, TacticalRenderer) that share a common data layer. Each subsystem broadcasts events (OnHealthChanged, OnAmmoChanged, OnDetectionChanged, etc.) and the HUD System routes them to the appropriate renderer based on the player's selected mode. This means adding a new HUD element requires implementing it in both modes — but the data source is shared, ensuring consistency.

The HUD System also manages context prompts (the only persistent UI element in Immersive mode), the loading screen overlay (coordinated with GSM), the death screen, and the pause menu HUD state. It is the convergence point for all player-facing information in the game.

## Player Fantasy

The HUD System makes the player feel **present in the world**, not watching it through a UI layer. In Immersive mode, the player is the mercenary — they feel their wounds, hear their breathing, check their magazine by looking at it, and sense danger through instinct and observation. The HUD disappears. The game becomes a place, not an interface.

In Tactical mode, the player feels **in control** — they have full situational awareness, can plan routes on the minimap, track their resources precisely, and see threats before they appear. This is the mode for players who want to optimize, plan, and execute with precision. It is not "easier" — the survival tension is the same — but it is a different way of engaging with the same systems.

The signature moment in Immersive mode: the player is low on health. They don't see a red health bar. They hear their character's ragged breathing. Their character stumbles slightly when running. Blood is visible on their gear. The screen edges pulse with a faint red vignette when damage is recent. The player knows they're dying because their body tells them — not because a UI element does.

In Tactical mode, the same moment: the health bar shows 12/100 in red. The stamina bar is at 20%. The ammo counter shows 2/12 | 3 (red). The player has precise information and can make a calculated decision: fight, flee, or use a medkit.

This serves **Pillar 2 (Earned Discovery)** — information in Immersive mode is earned through observation and attention. The player learns to read the world. **Pillar 3 (Tense Survival)** — both modes maintain tension. Immersive through uncertainty and bodily awareness, Tactical through precise resource management under pressure.

## Progression & Depth

The HUD System does not unlock new elements over time — both modes are fully available from the start. However, the player's **relationship** with the HUD evolves through mastery:

### Immersive Mode Mastery Curve

| Phase | Player Behavior | HUD Experience |
|-------|----------------|----------------|
| **First hour** | Relies on context prompts, reads obvious cues (blood, breathing) | HUD feels minimal but sufficient. Player learns the language of bodily feedback. |
| **3–5 hours** | Recognizes alien audio cues (clicking = suspicious, vocalizations = combat), reads infection VFX at distance | HUD becomes invisible. Player navigates by landmarks, detects threats by sound, assesses health by feel. |
| **10+ hours** | Reads subtle cues: spore density changes before entering infected cell, alien patrol patterns predict threat locations, breathing rhythm indicates exact stamina level | HUD is unnecessary. The player is fully present in the world. Information is environmental, not interface-driven. |

### Tactical Mode Mastery Curve

| Phase | Player Behavior | HUD Experience |
|-------|----------------|----------------|
| **First hour** | Monitors all HUD elements constantly, checks minimap frequently | HUD is informative but overwhelming. Player learns what to prioritize. |
| **3–5 hours** | Uses minimap for route planning, checks ammo counter before engagements, reads threat dots for spatial awareness | HUD becomes a tool, not a crutch. Player glances at specific elements when needed, ignores the rest. |
| **10+ hours** | Minimap used for strategic planning (infection spread, hive locations), threat dots used for tactical positioning, health bar checked only when damaged | HUD is a command interface. Player processes information efficiently and makes calculated decisions. |

### No Unlockable HUD Elements

The HUD does not gain new features as the player progresses. This is intentional:

- **Immersive mode** is designed to be complete from the start. The player's skill improves, not the HUD. Adding new Immersive cues over time would undermine the pillar of earned discovery — the player should learn to read the world, not wait for the game to teach them.
- **Tactical mode** is designed to be complete from the start. Adding new HUD elements over time would create UI bloat and break the player's established reading habits.

### Deferred HUD Content (Vertical Slice and beyond)

| Feature | Current State | Deferred To | Rationale |
|---------|--------------|-------------|-----------|
| Full-screen map | Not designed | Vertical Slice (Map System) | Extends minimap data to full-screen view with quest markers, discovered locations, fast-travel points |
| Quest tracker | Not designed | Vertical Slice (Quest System) | Active quest objectives displayed in Tactical mode |
| Faction reputation display | Not designed | Vertical Slice (Faction System) | Faction trust levels shown in Tactical mode |
| Lore/journal access | Not designed | Alpha (Lore System) | Journal UI accessible from pause menu |
| Photo mode UI | Not designed | Full Vision (Photo Mode) | Camera capture interface, frame settings, save options |

## Detailed Design

### Core Rules

**Rule 1 — HUD Mode Selection**

HUD mode is selected in the options menu. Changes made during gameplay are queued and applied on the next GSM Playing state when the player is not in combat (bIsInCombat = false). If the player is in combat, the change waits until combat ends. This ensures that each mode is a complete, intentional experience — not a crutch the player toggles when things get hard — while still allowing the player to adjust their preference without returning to the main menu.

| Mode | Description | Design Philosophy |
|------|-------------|-------------------|
| **Immersive** (default) | No health bar, no ammo counter, no minimap, no detection meter. Context prompts only. Information through environmental cues, character behavior, audio, and subtle screen effects. | The player IS the mercenary. Read the world, not the UI. |
| **Tactical** | Full HUD: health bar, ammo counter, minimap, detection meter, stamina bar, zone name, threat indicators, context prompts. | The player commands the mercenary. Full situational awareness. |

**Rule 2 — Common Data Layer**

All HUD data flows through a shared data layer. Subsystems broadcast events; the HUD System consumes them and routes to the active renderer.

```
Subsystem Event → HUD Data Layer → Active Renderer (Immersive or Tactical)
```

Events consumed by the HUD System:

| Event | Source | Data | Immersive Response | Tactical Response |
|-------|--------|------|-------------------|-------------------|
| `OnHealthChanged` | Health System | PreviousHP, NewHP, DamageType, InjuryState | Post-process vignette, character posture/audio update | Health bar update, numeric HP, injury state icon |
| `OnAmmoChanged` | Combat System | Magazine, Reserve, WeaponState | None (player checks manually) | Ammo counter update |
| `OnDetectionChanged` | Stealth System | DetectionScore (0–100), StealthState | None (player reads alien behavior) | Detection bar, state label, threat dots |
| `OnStaminaChanged` | Movement System | CurrentStamina, MaxStamina, Exhausted | Character breathing audio, movement feel | Stamina bar update |
| `OnZoneCrossed` | Scene Management | FromZone, ToZone | Environmental transition (handled by Scene Mgmt) | Zone name display (3s fade) |
| `OnContextPrompt` | Player Controller | FContextPrompt (label, target, priority) | Context prompt display | Context prompt display (same) |
| `OnCombatStateChanged` | Combat System | ECombatState | None (player reads combat audio/behavior) | Combat state indicator |
| `OnThreatUpdate` | Alien AI | Threat positions, alert levels | None (player hears alien audio) | Threat direction dots on minimap |
| `OnInfectionUpdate` | Infection Spread | Cell infection levels, nearby sources | None (player sees environmental VFX) | Minimap heatmap, source count |
| `OnCureDeployed` | Infection Spread | Cure position, radius, duration | None | Blue circle on minimap |

**Rule 3 — Immersive Mode: Information Channels**

Immersive mode has minimal persistent HUD elements: context prompts and quick slots. All other information is conveyed through:

| Information | Channel | Trigger | Description |
|-------------|---------|---------|-------------|
| **Health status** | Character posture | HP < 50 | Character hunches slightly, arm favors wounded side |
| **Health status** | Character breathing | HP < 50 | Breathing audio escalates: normal → heavy → ragged → gasping |
| **Health status** | Blood on gear | HP < 75 | Visible blood stains on character model, intensity scales with damage |
| **Health status** | Screen vignette | On damage received | Red vignette pulse at screen edges, intensity based on damage amount, fades over 3s |
| **Health status** | Movement degradation | HP < 25 | Sprint speed reduced, stumble animation on sharp turns |
| **Ammo status** | Check magazine animation | Player presses IA_Reload when magazine not empty | 0.5s animation, small HUD element shows current magazine + reserve for 2.0s |
| **Ammo status** | Weapon dry fire | Magazine empty, player fires | Distinctive click sound, character checks weapon |
| **Detection status** | Alien behavior | Alien enters Suspicious/Alert/Combat | Player reads alien body language, audio cues (clicking, vocalizations) |
| **Detection status** | Audio spatialization | Alien proximity | Alien audio gets louder and more directional as they approach |
| **Stamina status** | Character breathing | Stamina < 30% | Heavy breathing, escalates to gasping at exhaustion |
| **Stamina status** | Movement degradation | Stamina < 10% | Sprint unavailable, walk speed reduced |
| **Zone awareness** | Environmental transition | Zone crossing | Lighting shift, audio crossfade, spore particles, post-process changes |
| **Infection status** | Environmental VFX | Cell infection level | Spore density, biomass coverage, bioluminescence, lighting color |
| **Threat awareness** | Audio cues | Alien proximity, hive emergence | Bio-drone volume, alien vocalizations, hive emergence rumble |
| **Context prompts** | Screen-space UI | Interactable object in range | Label + target name, fades in/out based on proximity and line of sight |
| **Quick slots** | Screen-space UI (bottom-center) | Every frame | 4 slot icons showing assigned consumables. Item icon + stack count. Empty slot shows grayed background. Minimal, non-intrusive design consistent with immersive-first pillar. |

**Rule 4 — Tactical Mode: HUD Elements**

Tactical mode displays the following persistent and conditional elements:

| Element | Position | Update Frequency | Data Source | Description |
|---------|----------|-----------------|-------------|-------------|
| **Health bar** | Top-left | Every frame | Health System | Bar + numeric HP (e.g., "73/100"). Color: green (51+), orange (26–50), red (1–25). Injury state icon overlay. |
| **Stamina bar** | Bottom-left | Every frame | Movement System | Bar only (no numeric). Color: green (>30%), orange (10–30%), red (<10%). Hidden when stamina is full and not depleting. |
| **Ammo counter** | Bottom-right | Every frame | Combat System | Magazine / Reserve display (e.g., "3/12 | 8"). Color: green (>50%), orange (20–50%), red (<20%). |
| **Detection meter** | Top-right | Every 0.25s | Stealth System | Vertical bar (0–100). Color: green (0–24), yellow (25–49), orange (50–74), red (75–100). State label below: "Hidden", "Suspicious", "Alert", "Engaged", "Detected". |
| **Minimap** | Bottom-center | Every 10s (infection), every 0.5s (threats) | Scene Mgmt, Alien AI, Infection Spread | Circular minimap (radius 5000cm). Shows: player position (center), zone boundaries, discovered locations, threat dots (color-coded by alien state), infection heatmap (green overlay intensity), cure zones (blue circles), nearby infection sources (red dots). |
| **Zone name** | Top-center | On zone change | Scene Management | Zone name display (e.g., "Z02 — Infected Town"). Fades in over 0.5s, holds 3s, fades out over 0.3s. |
| **Threat direction indicators** | Screen edges | Every 0.5s | Alien AI | Mini dots on screen edge showing alien positions within 5000cm. Color-coded: gray (patrol), yellow (suspicious), orange (alert), red (combat). |
| **Combat state indicator** | Top-right (below detection) | On state change | Combat System | Text: "In Combat", "Disengaging", "Clear". Red when in combat, green when clear. |
| **Weapon condition** | Bottom-right (below ammo) | On weapon switch | Combat System | Icon: clean (green), dirty (yellow), damaged (red). |
| **Context prompts** | Center-bottom | On proximity | Player Controller | Same as Immersive mode. Label + target name. |
| **Nearby source count** | Bottom-right (below weapon) | Every 10s | Infection Spread | Count of active infection sources within 5000cm. |
| **Camp threat indicator** | Top-left (below health) | Every 30s | Infection Spread | Icon + text if camp cell infection level > 25. |
| **Quick slots** | Bottom-center (above minimap in Tactical, standalone in Immersive) | Every frame | Inventory System | 4 slot icons showing assigned consumables. Shows item icon + stack count. Empty slot shows grayed background. Activated via 1/2/3/4 keys (D-pad L/R/D/U on gamepad). |

**Rule 5 — Context Prompts (Both Modes)**

Context prompts are the only persistent UI element in Immersive mode and are shared across both modes.

| Property | Value |
|----------|-------|
| Position | Center-bottom of screen, 15% from bottom edge |
| Max simultaneous prompts | 2 (1 primary + 1 secondary) |
| Primary prompt | Highest-priority interactable within range and line of sight |
| Secondary prompt | Second-highest priority, shown 40px below primary, 70% opacity |
| Fade in | 0.2s |
| Fade out | 0.15s |
| Priority order | Quest-critical > Combat (medkit pickup) > Survival (shelter) > Exploration (loot) > Ambient (readable) |
| Timed interactions | Progress bar shown below prompt label for interactions > 1.0s duration |
| Blocked interactions | Low thud audio, prompt shows "Blocked" label in red for 1.0s |

**Rule 6 — Minimap Design (Tactical Mode Only)**

| Property | Value |
|----------|-------|
| Shape | Circular |
| Radius | 5000cm (matches Alien AI threat detection range) |
| Player position | Center, white dot |
| Rotation | Player-facing (north rotates with player direction) |
| Zone boundaries | Dashed white lines |
| Discovered locations | Small icons (camp, hive, point of interest) |
| Threat dots | Color-coded per Alien AI state (gray/yellow/orange/red) |
| Infection heatmap | Green overlay (#3D6B2E at 10–40% opacity based on cell infection level) |
| Cure zones | Blue circles (#4A90D9 at 20% opacity) |
| Infection sources | Red dots (static for author-time, pulsing for procedural) |
| Update rate | Threat dots: every 0.5s. Infection data: every 10s (matches infection tick). |
| Fog of war | Undiscovered areas are black. Revealed areas stay visible (no re-fogging). |

**Rule 7 — HUD Visibility by Camera State**

| Camera State | Immersive Mode | Tactical Mode |
|--------------|---------------|---------------|
| **ThirdPerson (default)** | Context prompts only | Full HUD |
| **FirstPerson unscoped** | Context prompts only | Full HUD (minimap shrinks to 60%) |
| **FirstPerson scoped** | No HUD (full tunnel vision) | No HUD except crosshair and ammo counter (minimal) |
| **Cinematic** | No HUD | No HUD |
| **Death** | Death screen overlay | Death screen overlay (same) |
| **Pause** | Pause menu (HUD frozen behind) | Pause menu (HUD frozen behind) |

**Rule 8 — Damage Direction Indicator (Immersive Mode)**

When the player takes physical damage in Immersive mode:

| Property | Value |
|----------|-------|
| Visual | Screen edge flash in damage direction (bone white tint, #F5F0E8 at 15% opacity) |
| Duration | 0.1s flash, then fades over 0.3s |
| Vignette | Red vignette pulse, intensity = damage_amount / 100, fades over 3.0s |
| Stacking | Multiple hits within 3s increase vignette intensity (max 60% opacity) |
| Environmental damage | Same visual but with green tint (#3D6B2E) for infection exposure |
| Fall damage | White flash + brief screen shake (0.2s, 2px amplitude) |

### States and Transitions

The HUD System itself is stateless — it renders based on subsystem events. However, the HUD has display states based on game state:

| HUD State | Entry Condition | Exit Condition | Visible Elements |
|-----------|----------------|----------------|-----------------|
| **Gameplay** | GSM Playing | GSM Paused, Loading, or Death | Per-mode rules (Rule 3 or Rule 4) |
| **Paused** | GSM Paused | GSM Playing | Pause menu only (HUD frozen behind, not updating) |
| **Loading** | GSM Loading | GSM Playing | Loading screen overlay (heartbeat pulse, zone name, progress) |
| **Death** | Player HP = 0 | GSM transitions to Loading (respawn) | Death screen: "You Died" + checkpoint info + fade to loading |
| **Cinematic** | Camera System enters Cinematic | Camera System exits Cinematic | No HUD elements |

### Interactions with Other Systems

| System | Direction | Data Flow | Interface |
|--------|-----------|-----------|-----------|
| **Player Controller** | Reads | Context prompts, state indicators | `SubscribeToContextPrompt()`, `SubscribeToStateChanged()` |
| **Health System** | Reads | HP, injury state, damage type | `SubscribeToHealthChanged()` — receives `OnHealthChanged(PreviousHP, NewHP, DamageType, InjuryState)` |
| **Combat System** | Reads | Ammo count, weapon state, combat state | `SubscribeToAmmoChanged()`, `SubscribeToCombatStateChanged()` |
| **Stealth System** | Reads | Detection score, stealth state | `SubscribeToDetectionChanged()` — receives `OnDetectionChanged(DetectionScore, StealthState)` |
| **Movement System** | Reads | Stamina level, exhaustion state | `SubscribeToStaminaChanged()` — receives `OnStaminaChanged(Current, Max, Exhausted)` |
| **Scene Management** | Reads | Zone name, zone transitions | `SubscribeToZoneCrossed()` — receives `OnZoneCrossed(FromZone, ToZone)` |
| **Alien AI System** | Reads | Threat positions, alert levels | `SubscribeToThreatUpdate()` — receives threat position array with state |
| **Infection Spread System** | Reads | Cell infection levels, source positions, cure zones | `GetNearbyCellInfectionLevels()`, `SubscribeToCellStateChanged()` |
| **Camera System** | Reads | Camera state, FOV | `GetCameraState()`, `SubscribeToCameraStateChanged()` — HUD visibility changes per Rule 7 |
| **Game State Machine** | Reads | Global game state | `GetCurrentState()` — determines HUD display state |
| **Audio System** | Writes | HUD sound effects (prompt appear, blocked action, low ammo warning) | `PlayHUDSound(EHUDSound)` |
| **Accessibility System** | Reads | Colorblind mode, UI scale, subtitle settings | `GetAccessibilitySettings()` — modifies HUD rendering per player needs |
| **Tutorial System** | Reads + Writes | Tutorial hint display | `ShowTutorialScreenLabel(FText HintText)`, `HideTutorialScreenLabel()` — Tutorial System calls these to show/dismiss contextual hint labels in both modes |
| **Save/Load System** | Writes | Save indicator | `ShowSaveIndicator()`, `HideSaveIndicator()` |

**Interface Contract:**

```cpp
// HUD System public interface (C++ sketch)
class UHUDSubsystem : public ULocalPlayerSubsystem {
    // Mode query
    EHUDMode GetHUDMode(); // Immersive or Tactical (from settings)
    
    // Event subscriptions (shared data layer)
    void SubscribeToHealthChanged(FHealthChangedDelegate Callback);
    void SubscribeToAmmoChanged(FAmmoChangedDelegate Callback);
    void SubscribeToDetectionChanged(FDetectionChangedDelegate Callback);
    void SubscribeToStaminaChanged(FStaminaChangedDelegate Callback);
    void SubscribeToZoneCrossed(FZoneCrossedDelegate Callback);
    void SubscribeToContextPrompt(FContextPromptDelegate Callback);
    void SubscribeToCombatStateChanged(FCombatStateChangedDelegate Callback);
    void SubscribeToThreatUpdate(FThreatUpdateDelegate Callback);
    
    // Context prompt management
    void RegisterContextPrompt(FContextPrompt Prompt);
    void ClearContextPrompt(FContextPromptId Id);
    
    // HUD sound
    void PlayHUDSound(EHUDSound Sound);
}
```

## Formulas

**Formula 1 — Vignette Intensity (Immersive Damage Feedback)**

The `vignette_intensity` formula calculates the red vignette opacity after taking damage:

```
V_initial = clamp(damage_amount / 100, 0, 0.6)
V(t) = V_initial × e^(-t / T_fade)
```

**Variables:**

| Variable | Symbol | Type | Range | Source | Description |
|----------|--------|------|-------|--------|-------------|
| Damage amount | damage_amount | float | 0–100 | Health System | HP lost from this hit |
| Initial intensity | V_initial | float | 0.0–0.6 | Calculated | Peak vignette opacity |
| Time since hit | t | float | 0–3.0s | Calculated | Seconds since damage event |
| Fade time constant | T_fade | float | 1.0s | This GDD | Exponential decay rate |
| Current intensity | V(t) | float | 0.0–0.6 | Calculated | Vignette opacity at time t |

**Expected output range:** 0.0 (no vignette) to 0.6 (heavy damage).
**Stacking:** If a second hit occurs before V(t) reaches 0, new V_initial = clamp(current V(t) + new_damage/100, 0, 0.6). Max 0.6.
**Example:** Player takes 30 damage → V_initial = 0.3. After 1s: V(1) = 0.3 × e^(-1/1) = 0.3 × 0.368 = 0.11.

---

**Formula 2 — Context Prompt Priority Score**

The `prompt_priority` formula determines which context prompt to display when multiple interactables are in range:

```
P_score = W_quest × S_quest + W_combat × S_combat + W_survival × S_survival + W_distance × S_distance + W_los × S_los
```

Weights: W_quest=10.0, W_combat=5.0, W_survival=3.0, W_distance=2.0, W_los=1.0.

| Factor | Score | Description |
|--------|-------|-------------|
| S_quest | 1.0 if quest-critical, else 0 | Main story or critical path interactable |
| S_combat | 1.0 if combat-relevant (medkit, ammo), else 0 | Survival item during combat |
| S_survival | 1.0 if survival-critical (shelter, cure), else 0 | Shelter from infection, cure deployment point |
| S_distance | 1.0 - (distance / max_range) | Closer = higher score |
| S_los | 1.0 if line of sight clear, 0.5 if partial, 0 if blocked | Visibility weighting |

**Expected output range:** 0.0 to 21.0. Highest score wins primary prompt slot. Second-highest wins secondary (if score > 0.5).
**Example:** Quest-critical door at 200cm (max_range=500cm), LOS clear: P = 10×1 + 5×0 + 3×0 + 2×(1-200/500) + 1×1 = 10 + 0 + 0 + 1.2 + 1 = **12.2**.

---

**Formula 3 — Minimap Threat Dot Opacity**

The `threat_dot_opacity` formula controls threat dot visibility on the tactical minimap:

```
A_dot = clamp(1.0 - (d / R_max) × K_fade, 0.1, 1.0)
```

**Variables:**

| Variable | Symbol | Type | Range | Source | Description |
|----------|--------|------|-------|--------|-------------|
| Distance to threat | d | float | 0–5000 cm | Calculated | Alien-to-player distance |
| Max minimap range | R_max | float | 5000 cm | This GDD | Minimap radius |
| Fade coefficient | K_fade | float | 0.8 | This GDD | Controls edge fade rate |
| Dot opacity | A_dot | float | 0.1–1.0 | Calculated | Threat dot alpha |

**Expected output range:** 0.1 (barely visible at edge) to 1.0 (fully opaque at center).
**Example:** Threat at 2500cm: A_dot = clamp(1.0 - (2500/5000) × 0.8, 0.1, 1.0) = clamp(0.6, 0.1, 1.0) = **0.6**.

---

**Formula 4 — Health Bar Color (Tactical Mode)**

The `health_bar_color` formula determines the health bar color based on current HP:

```
if HP > 50:     Color = green (#4CAF50)
if 26 ≤ HP ≤ 50: Color = orange (#FF9800)
if HP ≤ 25:     Color = red (#F44336)
```

Interpolation at boundaries: 5-pixel transition zone with linear color interpolation.

**Variables:**

| Variable | Symbol | Type | Range | Source | Description |
|----------|--------|------|-------|--------|-------------|
| Current HP | HP | float | 0–100 | Health System | Player's current health |
| Color | Color | FLinearColor | — | This GDD | Health bar fill color |

**Expected output:** One of three colors with smooth transitions at boundaries.

## Edge Cases

| Scenario | Expected Behavior | Rationale |
|----------|------------------|-----------|
| **Player takes damage while vignette is already at max (0.6)** | Vignette stays at 0.6. Directional flash still fires for the new hit. After 3s from the last hit, vignette begins fading. | Player should not be blinded by stacking vignette. Directional flash provides per-hit feedback even when vignette is maxed. |
| **Multiple context prompts with identical priority score** | Tiebreaker: closest to player. If same distance, oldest registered prompt wins. | Deterministic tiebreaking prevents prompt flickering. |
| **Player opens inventory/map while in combat** | HUD elements freeze in place (no updates) while inventory/map is open. Threat dots on minimap pause. On close, HUD resumes with current data. | Prevents information overload during menu navigation. Player can't "pause and plan" in real-time. |
| **Alien threat is behind the player in Immersive mode** | No visual indicator. Player must rely on audio spatialization (alien audio gets louder and directional). | Immersive mode trusts the player's ears. Audio is the primary threat detection channel. |
| **Minimap threat dots exceed screen edge** | Dots clamp to minimap circle edge. Opacity set to minimum (0.1). Direction indicator arrow appears on screen edge pointing toward off-screen threat. | Player knows threats exist beyond minimap range without cluttering the display. |
| **Player dies with HUD mode set to Immersive** | Death screen is identical for both modes: "You Died" text, checkpoint info, fade to loading. No mode-specific death screen. | Death is a universal game state — the HUD mode doesn't change how death works. |
| **Context prompt for an interactable that is destroyed while prompt is visible** | Prompt fades out over 0.15s. If a secondary prompt exists, it promotes to primary. | Prompt should never reference a non-existent interactable. |
| **Player changes HUD mode in settings during gameplay** | Change is queued and applied on next GSM Playing state. If player is in combat, change is delayed until combat ends (bIsInCombat = false). | Prevents jarring mid-combat UI switch. Player gets what they asked for, just not at the worst moment. |
| **Accessibility colorblind mode is enabled** | Health bar colors shift: green→blue, orange→yellow, red→dark red. Threat dots: gray→white, yellow→orange, orange→magenta, red→dark red. Vignette intensity increases by 20% to compensate for reduced color reliance. | Colorblind players need alternative visual channels. Increased vignette intensity provides luminance-based feedback. |
| **Infection heatmap on minimap overlaps with threat dots** | Threat dots render on top of heatmap. Heatmap opacity reduced to 60% in areas with threat dots. | Threat information is higher priority than infection information on the minimap. |
| **Player is in FirstPerson scoped mode with Tactical HUD** | All HUD elements hidden except crosshair and ammo counter (minimal display). Minimap, health bar, detection meter all hidden. | Scoped view is tunnel vision — HUD elements would break the immersion of aiming down sights. |

## Dependencies

**Hard Dependencies** (system cannot function without):
- **Player Controller** ✅ (designed) — provides context prompt data, state indicators. HUD renders context prompts as the only persistent Immersive-mode element.
- **Health System** ✅ (designed) — provides HP, injury state, damage type. HUD renders health feedback in both modes.
- **Camera System** ✅ (designed) — provides camera state for HUD visibility rules. HUD elements hide/show based on camera mode per Rule 7.
- **Game State Machine** ✅ (designed) — provides global game state. HUD display state depends on GSM state.

**Soft Dependencies** (enhanced by but works without):
- **Combat System** ✅ (designed) — provides ammo count, weapon state, combat state. Without it, Tactical mode has no ammo counter or combat indicator.
- **Stealth System** ✅ (designed) — provides detection score, stealth state. Without it, Tactical mode has no detection meter.
- **Movement System** ✅ (designed) — provides stamina level. Without it, Tactical mode has no stamina bar.
- **Scene Management** ✅ (designed) — provides zone name, zone transitions. Without it, Tactical mode has no zone name display.
- **Alien AI** ✅ (designed) — provides threat positions. Without it, Tactical mode has no threat dots on minimap.
- **Infection Spread System** ✅ (designed) — provides cell infection levels, source positions, cure zones. Without it, Tactical mode has no infection heatmap or source count.
- **Audio System** (Not Started) — plays HUD sound effects. **Sequencing risk:** HUD sound work (8 sound effects defined in Visual/Audio Requirements) is blocked until Audio System is designed. HUD visual elements can be implemented independently.
- **Accessibility System** (Alpha) — provides colorblind mode, UI scale, subtitle settings. Without it, HUD uses default colors and scale.

**Depended On By**:

| System | Interface Used | Expected Behavior |
|--------|---------------|-------------------|
| Accessibility System | HUD rendering settings | Reads colorblind mode, UI scale, and applies to all HUD elements |
| Map System | Minimap data | Extends minimap to full-screen map with additional detail |

## Tuning Knobs

| Parameter | Default | Safe Range | Effect of Increase | Effect of Decrease |
|-----------|---------|------------|-------------------|-------------------|
| `VignetteMaxOpacity` | 0.6 | 0.3–0.8 | More dramatic damage feedback | Subtle, may be missed |
| `VignetteFadeTime` | 3.0s | 1.0–5.0s | Damage feedback lingers longer | Quick recovery, less tension |
| `DamageFlashDuration` | 0.1s | 0.05–0.3s | More visible directional flash | Barely perceptible |
| `ContextPromptFadeIn` | 0.2s | 0.1–0.5s | Smoother prompt appearance | Snappy, may feel jarring |
| `ContextPromptFadeOut` | 0.15s | 0.1–0.3s | Smoother prompt disappearance | Snappy removal |
| `ContextPromptMaxRange` | 500cm | 300–800cm | Prompts show from farther | Must be very close to interactable |
| `MinimapRadius` | 5000cm | 3000–8000cm | More area visible on minimap | Less situational awareness |
| `MinimapThreatUpdateRate` | 0.5s | 0.25–2.0s | More responsive threat dots | Laggy threat information |
| `MinimapInfectionUpdateRate` | 10s | 5–30s | More responsive infection heatmap | Stale infection data |
| `ZoneNameDisplayDuration` | 3.0s | 1.0–5.0s | Zone name visible longer | May miss zone name |
| `ThreatDotMinOpacity` | 0.1 | 0.05–0.3 | Edge threats more visible | Edge threats barely visible |
| `ThreatDotFadeCoefficient` | 0.8 | 0.5–1.0 | Threats fade faster at edge | Threats visible at edge longer |
| `HealthBarGreenThreshold` | 51 | 40–70 | Green zone larger, feels safer | Green zone smaller, more tension |
| `HealthBarOrangeThreshold` | 26 | 15–40 | Orange zone larger | Red zone larger, more urgency |
| `W_quest_priority` | 10.0 | 5.0–20.0 | Quest prompts dominate | Quest prompts compete with other types |
| `W_combat_priority` | 5.0 | 2.0–10.0 | Combat items show more often | Combat items may be hidden |
| `ColorblindVignetteBoost` | 0.2 | 0.0–0.3 | More luminance feedback for colorblind | Less compensation |

## Visual/Audio Requirements

### HUD Sound Effects

| Sound | Trigger | Description | Volume | Priority |
|-------|---------|-------------|--------|----------|
| **Prompt Appear** | Context prompt fades in | Soft click, mechanical | -18dB | Low |
| **Prompt Disappear** | Context prompt fades out | Soft click (lower pitch) | -20dB | Low |
| **Blocked Action** | Player attempts blocked interaction | Low thud | -12dB | Medium |
| **Low Ammo Warning** | Magazine ≤ 2 (Tactical mode) | Subtle metallic click | -16dB | Low |
| **Critical Health Warning** | HP ≤ 25 (Tactical mode) | Heartbeat pulse (single) | -14dB | Medium |
| **Detection State Change** | Stealth state changes (Tactical mode) | Soft whoosh | -18dB | Low |
| **Zone Name Display** | Zone name fades in | Subtle chime | -20dB | Low |
| **Death Screen** | Player HP = 0 | Low drone, fades in over 2s | -10dB | High |

### HUD Animation Timing

| Element | Appear Animation | Disappear Animation | Notes |
|---------|-----------------|---------------------|-------|
| **Context prompt** | Fade in 0.2s, slide up 10px | Fade out 0.15s, slide down 5px | Shared across both modes |
| **Zone name** | Fade in 0.5s, slide down from top | Fade out 0.3s | Tactical mode only |
| **Combat state indicator** | Fade in 0.3s, pulse once | Fade out 0.5s | Tactical mode only |
| **Health bar damage flash** | Instant red flash (0.1s) | Fade to normal color over 0.5s | Tactical mode only |
| **Threat dot appear** | Fade in 0.2s, scale from 0.5x to 1.0x | Fade out 0.3s, scale to 0.5x | Tactical mode only |
| **Death screen** | Fade in 2.0s (text + overlay) | Fade out 1.0s (to loading screen) | Both modes |

### Art Bible Alignment

| Principle | Application |
|-----------|------------|
| **Hostile World** (Pillar 1) | HUD elements feel diegetic — they belong to the mercenary's gear, not a game overlay. Tactical HUD looks like a tactical display on the character's wrist/visor. |
| **Earned Discovery** (Pillar 2) | Immersive mode has no HUD except context prompts. All other information is earned through observation. The player learns to read the world. |
| **Tense Survival** (Pillar 3) | Health bar colors create urgency (orange at 50%, red at 25%). Low ammo warnings create resource tension. Threat dots create spatial awareness pressure. |

**Color Palette (HUD elements):**

| Element | Color | Hex | Notes |
|---------|-------|-----|-------|
| Health bar (green) | Safe green | #4CAF50 | HP > 50 |
| Health bar (orange) | Warning orange | #FF9800 | HP 26–50 |
| Health bar (red) | Danger red | #F44336 | HP ≤ 25 |
| Stamina bar | Neutral blue | #2196F3 | Always blue, intensity varies |
| Ammo counter (green) | Sufficient | #4CAF50 | > 50% |
| Ammo counter (orange) | Low | #FF9800 | 20–50% |
| Ammo counter (red) | Critical | #F44336 | < 20% |
| Detection meter (green) | Hidden | #4CAF50 | 0–24 |
| Detection meter (yellow) | Suspicious | #FFEB3B | 25–49 |
| Detection meter (orange) | Alert | #FF9800 | 50–74 |
| Detection meter (red) | Engaged/Detected | #F44336 | 75–100 |
| Threat dots (patrol) | Neutral gray | #9E9E9E | Idle aliens |
| Threat dots (suspicious) | Warning yellow | #FFEB3B | Investigating |
| Threat dots (alert) | Caution orange | #FF9800 | Flanking/searching |
| Threat dots (combat) | Danger red | #F44336 | Actively hunting |
| Infection heatmap | Alien Verdant | #3D6B2E | Opacity 10–40% |
| Cure zones | Suppressant blue | #4A90D9 | Opacity 20% |
| Context prompt text | Off-white | #E8E4DC | High contrast on all backgrounds |
| Zone name text | Amber | #C9A227 | Subtle, not distracting |

## UI Requirements

| Screen/Element | Type | Resolution Support | Safe Area | Notes |
|----------------|------|-------------------|-----------|-------|
| **HUD overlay** | UMG Widget | 1080p, 1440p, 4K, ultrawide (21:9) | 5% margin on all edges | Anchored to screen edges, scales with resolution |
| **Context prompts** | UMG Widget | All | Center-bottom, 15% from edge | Safe area respected |
| **Minimap** | UMG Widget (canvas) | All | Bottom-center | Circular, radius scales with screen height |
| **Death screen** | UMG Widget | All | Full screen | Fade overlay + centered text |
| **Loading screen** | UMG Widget | All | Full screen | Heartbeat pulse, zone name, progress |
| **Pause menu** | UMG Widget | All | Centered, 60% screen width | HUD frozen behind |

**Accessibility requirements** (from Accessibility System, when available):
- UI scale: 80%–150% (default 100%)
- Colorblind mode: Deuteranopia, Protanopia, Tritanopia presets
- Subtitle size: Small, Medium, Large
- High contrast mode: Increases all HUD element contrast by 30%

## Cross-References

| This Document References | Target GDD | Specific Element Referenced | Nature |
|--------------------------|-----------|----------------------------|--------|
| Context prompt system | `design/gdd/player-controller.md` | FContextPrompt structure, priority rules | Data dependency |
| Health states and damage types | `design/gdd/health-system.md` | InjuryState enum, EDamageType enum, OnHealthChanged event | Data dependency |
| Ammo count and weapon state | `design/gdd/combat-system.md` | Magazine/Reserve values, ECombatState, check magazine animation | Data dependency |
| Detection score and stealth states | `design/gdd/stealth-system.md` | DetectionScore (0–100), EStealthState, OnDetectionChanged event | Data dependency |
| Stamina values | `design/gdd/movement-system.md` | CurrentStamina, MaxStamina, Exhausted flag | Data dependency |
| Zone names and IDs | `design/gdd/scene-management.md` | Zone IDs (Z01–Z05), OnZoneCrossed event | Data dependency |
| Threat positions and states | `design/gdd/alien-ai-system.md` | Alien positions, detection states (Idle/Suspicious/Alert/Combat) | Data dependency |
| Cell infection levels | `design/gdd/infection-spread-system.md` | GetNearbyCellInfectionLevels(), OnCellStateChanged event | Data dependency |
| Camera states | `design/gdd/camera-system.md` | ECameraState (ThirdPerson, FirstPerson, Scoped, Cinematic) | Rule dependency |
| HUD visibility rules | `design/gdd/camera-system.md` | HUD visibility per camera mode (both GDDs must agree) | Rule dependency |
| Loading screen design | `design/gdd/scene-management.md` | Heartbeat pulse animation, zone name display, progress indicator | Rule dependency |
| Colorblind mode colors | `design/gdd/accessibility-requirements.md` (Alpha) | Colorblind presets, UI scale settings | Data dependency |

## Acceptance Criteria

**Core Rules:**

- **GIVEN** HUD mode is set to Immersive, **WHEN** player takes 30 damage, **THEN** directional screen flash fires in damage direction (0.1s, bone white at 15% opacity), red vignette pulses to 0.3 opacity and fades over 3s, no health bar or numeric HP is displayed.

- **GIVEN** HUD mode is set to Tactical, **WHEN** player HP = 73/100, **THEN** health bar shows 73% fill in green (#4CAF50), numeric text reads "73/100".

- **GIVEN** HUD mode is set to Tactical, **WHEN** player HP drops from 51 to 50, **THEN** health bar color transitions from green to orange with 5-pixel linear interpolation zone.

- **GIVEN** HUD mode is set to Tactical, **WHEN** detection score = 60, **THEN** detection meter shows 60% fill in orange (#FF9800), state label reads "Alert".

- **GIVEN** HUD mode is set to Immersive, **WHEN** player presses IA_Reload with 3/12 magazine, **THEN** character performs check magazine animation (0.5s), small HUD element shows "3/12" for 2.0s then fades out.

- **GIVEN** HUD mode is set to Tactical, **WHEN** ammo is 3/12 magazine with 8 reserve, **THEN** ammo counter shows "3/12 | 8" with color based on reserve percentage (8/60 = 13% → red #F44336).

- **GIVEN** context prompt registered for quest-critical interactable at 200cm with clear LOS, **WHEN** prompt priority is calculated, **THEN** P_score = 12.2 (per Formula 2 example), prompt appears as primary.

- **GIVEN** two context prompts with identical priority scores, **WHEN** both are in range, **THEN** closest to player wins primary slot. If same distance, oldest registered prompt wins.

- **GIVEN** HUD mode is set to Tactical, **WHEN** player crosses from Z02 to Z04, **THEN** zone name "Z04 — Alien Hive" fades in over 0.5s, holds 3s, fades out over 0.3s.

- **GIVEN** HUD mode is set to Immersive, **WHEN** alien enters Combat state within 2000cm, **THEN** no visual HUD indicator fires. Player relies on audio spatialization (alien vocalizations get louder and directional).

- **GIVEN** HUD mode is set to Tactical, **WHEN** alien in Combat state is at 2500cm from player, **THEN** threat dot appears on minimap at correct bearing, opacity = 0.6 (per Formula 3), color = red (#F44336).

- **GIVEN** camera enters FirstPerson scoped mode, **WHEN** HUD mode is Tactical, **THEN** all HUD elements hidden except crosshair and ammo counter (minimal display).

- **GIVEN** camera enters FirstPerson scoped mode, **WHEN** HUD mode is Immersive, **THEN** no HUD elements visible (full tunnel vision).

**Formulas:**

- **GIVEN** Formula 1 (vignette), **WHEN** player takes 30 damage, **THEN** V_initial = 0.3. After 1s: V(1) = 0.3 × e^(-1) = 0.11. After 3s: V(3) = 0.3 × e^(-3) = 0.015.

- **GIVEN** Formula 1 stacking, **WHEN** vignette is at 0.4 and player takes 30 damage, **THEN** new V_initial = clamp(0.4 + 0.3, 0, 0.6) = 0.6 (capped).

- **GIVEN** Formula 3 (threat dot), **WHEN** threat at 2500cm, R_max=5000cm, K_fade=0.8, **THEN** A_dot = clamp(1.0 - 0.5 × 0.8, 0.1, 1.0) = 0.6.

- **GIVEN** Formula 4 (health bar color), **WHEN** HP = 50, **THEN** color is in 5-pixel transition zone between green (#4CAF50) and orange (#FF9800).

**Performance:**

- **GIVEN** Tactical HUD with all elements active, **WHEN** frame time measured, **THEN** HUD rendering adds < 0.5ms per frame at 60fps.

- **GIVEN** 10 threat dots on minimap, **WHEN** minimap update runs every 0.5s, **THEN** minimap rendering adds < 0.2ms per update.

**Edge Cases:**

- **GIVEN** vignette at max opacity (0.6), **WHEN** player takes additional damage, **THEN** vignette stays at 0.6, directional flash still fires, vignette begins fading 3s after the last hit.

- **GIVEN** context prompt for interactable that is destroyed while prompt is visible, **WHEN** destruction occurs, **THEN** prompt fades out over 0.15s. If secondary prompt exists, it promotes to primary.

- **GIVEN** HUD mode change requested in settings during combat (bIsInCombat = true), **WHEN** change is queued, **THEN** change is applied after combat ends (bIsInCombat = false).

- **GIVEN** accessibility colorblind mode (Deuteranopia) enabled, **WHEN** health bar renders at HP = 73, **THEN** color is blue-shifted green (not standard #4CAF50), vignette intensity increased by 20%.

- **GIVEN** player opens inventory while in combat, **WHEN** HUD elements queried, **THEN** all HUD elements frozen (no updates). On inventory close, HUD resumes with current data.

## Open Questions

| # | Question | Owner | Deadline | Resolution |
|---|----------|-------|----------|-----------|
| OQ-1 | Should the death screen show cause of death (e.g., "Killed by: Fall", "Killed by: Alien Melee")? Health System OQ-5 raises this. | game-designer | GDD review | ✅ Resolved: Yes. Death screen shows "Killed by: [cause]" below "You Died" text. Cause mapped from EDamageType. Both modes. |
| OQ-2 | Should context prompts show a progress bar for timed interactions > 1.0s? Player Controller OQ-1 raises this. | game-designer | GDD review | ✅ Resolved: Yes. Progress bar shown below prompt label for interactions > 1.0s duration. See Rule 5. |
| OQ-3 | What is the maximum number of simultaneous context prompts before UI becomes cluttered? Player Controller OQ-7 raises this. Currently designed for 1 primary + 1 secondary. | game-designer | GDD review | ✅ Resolved: 1 primary + 1 secondary maximum. See Rule 5. |
| OQ-4 | Should the Tactical HUD minimap show unexplored areas as fog of war, or show the full zone layout from the start? | level-designer | Level design phase | Deferred to Map System GDD (Vertical Slice). Minimap fog of war is a Map System decision, not a HUD System decision. |
| OQ-5 | Should the Immersive mode include a subtle compass at the top of the screen (no minimap, just cardinal directions), or is that too much UI for Immersive? | game-designer | Playtest | Deferred to playtest. Default: no compass. If players report navigation frustration, add compass as optional toggle. |
| OQ-6 | Should the HUD System support moddability? (e.g., players can reposition HUD elements, change colors, create custom layouts) | engine-programmer | Post-MVP | Deferred to Post-MVP. Not in scope for MVP. |
| OQ-7 | Should the check magazine animation in Immersive mode reveal exact ammo count or just a rough indicator (full/half/low/empty)? | game-designer | Playtest | ✅ Resolved: Exact ammo count shown for 2.0s. Player earns the information by spending time to check — the animation is the cost. |

---

## Design Review Findings

> **Date**: 30 April 2026
> **Reviewer**: design-review skill
> **Verdict**: PASS (with corrections — all resolved below)

### Completeness
- **8/8 required sections** present and substantive (Progression & Depth added during review)
- Bonus sections: Dependencies, Visual/Audio Requirements, UI Requirements, Cross-References, Acceptance Criteria (Gherkin), Tuning Knobs (17 parameters)

### Issues Found & Resolved

| # | Issue | Severity | Status | Resolution |
|---|-------|----------|--------|------------|
| 1 | Progression & Depth section missing | Must Fix | ✅ Resolved | Added section: HUD does not unlock elements over time. Player mastery evolves, not the HUD. Deferred HUD content table added for Vertical Slice+. |
| 2 | Rule 1 vs Edge Case contradiction (mode change "cannot be changed" vs "queued") | Must Fix | ✅ Resolved | Rule 1 rewritten: mode changes are queued and applied when not in combat. Edge case text aligns. |
| 3 | Open Questions unresolved | Should Fix | ✅ Resolved | 5 of 7 OQs resolved. 2 deferred to other systems (OQ-4 to Map System, OQ-5 to playtest). |
| 4 | Audio System sequencing not flagged | Should Clarify | ✅ Resolved | Dependencies table updated with sequencing risk note. |

### Minor Notes (not blockers)
- Formula 4 notation (`HP > 50`) vs Tactical HUD table notation (`51+`) — equivalent, no action needed.
- UMG widget hierarchy not specified — acceptable at GDD level; detailed widget tree belongs in UX spec or technical design document.
- Performance targets stated without profiling methodology — acceptable at GDD level; methodology belongs in architecture or test plan.
