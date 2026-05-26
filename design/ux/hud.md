# HUD Design: Hostile World

> **Status**: Draft
> **Author**: ux-lead
> **Last Updated**: 2026-05-26
> **Game**: Hostile World
> **Platform Targets**: PC (Steam / Epic) — Windows. Keyboard/Mouse primary, Gamepad supported.
> **Related GDDs**: `design/gdd/hud-system.md`, `design/gdd/health-system.md`, `design/gdd/combat-system.md`, `design/gdd/stealth-system.md`, `design/gdd/infection-spread-system.md`, `design/gdd/movement-system.md`, `design/gdd/player-controller.md`, `design/gdd/camera-system.md`, `design/gdd/scene-management.md`, `design/gdd/alien-ai-system.md`, `design/gdd/game-concept.md`
> **Accessibility Tier**: Standard (WCAG AA — committed default; no project `accessibility-requirements.md` exists)
> **Style Reference**: `design/gdd/hud-system.md § Visual/Audio Requirements` (color palette defined there)

> **Note — Scope boundary**: This document specifies all elements that overlay the
> game world during active gameplay — health feedback, ammo display, minimap,
> detection meter, context prompts, threat indicators, subtitles, and notification
> toasts. The pause menu, options menu, inventory, full-screen map, and dialogue
> screens are excluded from this document. Those are screens the player explicitly
> navigates into; this HUD is the persistent overlay during direct character control.

---

## 1. HUD Philosophy

**Hostile World's relationship with on-screen information is bifurcated by design.** The HUD operates in two complete, mutually exclusive modes: **Immersive** and **Tactical**. Immersive is the authored default — the screen is the world, and the player reads health, ammo, detection, and threat through bodily feedback, audio, alien behavior, and environmental cues. Tactical is a parallel command-layer experience that surfaces full numeric and graphical state for players who prefer to play by precise resource management. Neither mode is a "lite" of the other. The HUD does not gradually reveal more information as the player progresses — both modes are complete from minute one. What changes over time is the player's mastery of reading the chosen layer.

This stance is not pragmatic compromise — it is the literal expression of Pillar 2 (Earned Discovery) and Pillar 3 (Tense Survival). Immersive forces discovery: the player learns alien clicks mean Suspicious, learns gasping breath means HP < 25, learns biomass glow means infection rising. Tactical enforces survival pressure differently: the ammo counter ticks down visibly, the detection meter climbs in red, the disengagement state names itself. Both produce tension; both reward attention.

**Visibility principle — when in doubt, hide in Immersive and contextualize in Tactical.** Immersive defaults to HIDE: persistent UI is restricted to context prompts and quick slots. Tactical defaults to CONTEXTUAL: most elements appear when their underlying state is decision-relevant (stamina bar hides when stamina is full; zone name fades after 3s; combat state only shows when not "Clear"). Always-visible elements in Tactical are limited to the four anchors of survival decision-making: health, ammo, detection, minimap.

**The Rule of Necessity for Hostile World**: A HUD element earns its place when removing it would force the player to stop interacting with the world to retrieve information required for a time-critical decision — and no diegetic, audio, or environmental channel can carry that information at equivalent fidelity within the player's reaction window. "It would be nice to know" is not an analysis. "The player would die before they could find out otherwise" is.

---

## 2. Information Architecture

> Every category of information the game generates is classified below. "Always Show" columns are mode-tagged: an element may be Always Show in Tactical but Hidden in Immersive. Multi-mode rows list both stances.

| Information Type | Always Show | Contextual (show when relevant) | On Demand (menu / button) | Hidden (environmental / diegetic) | Reasoning |
|---|---|---|---|---|---|
| Player health (HP value) | Tactical | — | Pause menu shows in detail | Immersive (vignette, breathing, posture, blood on gear) | Tactical players make calculated retreat decisions on numeric HP; Immersive players read bodily feedback (GDD Rule 3). |
| Player stamina | — | Tactical (hidden when full and not depleting) | — | Immersive (breathing rate, sprint cutout, walk slowdown) | Stamina is decision-relevant only when consumed; full stamina is not informative. |
| Ammo (magazine + reserve) | Tactical | Immersive (2s on IA_Reload check) | Pause menu inventory | Immersive default | GDD Rule 3: Immersive earns ammo info by spending the check-magazine animation. |
| Weapon condition (clean/dirty/damaged) | — | Tactical (on weapon switch + persistent icon) | Pause menu inventory | Immersive (jam frequency, visible weapon wear) | Tactical exposes via icon; Immersive learns via jam rate behavior. |
| Detection level (0–100) | Tactical | — | — | Immersive (alien posture, vocalizations, music layer) | Stealth GDD: detection meter is Tactical-only. Immersive reads alien behavior. |
| Stealth state label (Hidden/Suspicious/Alert/Engaged/Detected) | Tactical | — | — | Immersive (audio escalation, screen vignette pulse) | Same as above. |
| Combat state (In Combat / Disengaging / Clear) | — | Tactical (when not "Clear") | — | Immersive (combat music, FOV, alien behavior) | Visible state is only the non-default; "Clear" is implied by absence. |
| Threat positions (alien direction/distance) | — | Tactical (minimap dots + screen-edge mini-dots) | — | Immersive (audio spatialization) | GDD Rule 4: Tactical-only. Immersive uses ears. |
| Minimap (zone, infection, cures, threats) | Tactical | — | Full-screen map (deferred to Map System) | Immersive | Tactical anchor element; Immersive has no minimap or compass (OQ-5 deferred). |
| Zone name (on crossing) | — | Tactical (3s fade on zone change) | — | Immersive (environmental transition handles it) | Per GDD: Immersive uses lighting/audio crossfade; Tactical surfaces the label. |
| Context prompts (interaction) | — | Both modes (on proximity + LOS + priority) | — | — | Only persistent UI element in Immersive. Shared design across modes (GDD Rule 5). |
| Quick slots (4 consumables) | Both modes | — | Pause menu inventory (assignment) | — | GDD Rule 3 + Rule 4 explicit: quick slots always visible in both modes. |
| Tutorial hint label | — | Both modes (on tutorial trigger; one at a time) | — | — | GDD Tutorial System integration — `ShowTutorialScreenLabel`. |
| Damage direction | — | Both modes (0.1s edge flash, then vignette) | — | Diegetic in both (screen flash is post-process feedback, not a HUD widget) | Per GDD Rule 8. Same treatment in both modes; only vignette stacking visible. |
| Damage vignette (red on hit, green on infection) | — | — | — | Both modes (post-process, not a HUD widget) | Diegetic. Even Tactical players get this — it is screen feedback, not an info element. |
| Subtitles (dialogue + critical SFX captions) | Both modes (when subtitle setting ON) | — | Accessibility menu controls them | — | Accessibility requirement. ON by default. |
| Save indicator | — | Both modes (1.5s on save event) | — | — | Brief confirmation toast. Bottom-right. |
| HUD mode change confirmation | — | Both modes (2s toast on options change while in combat) | — | — | Per GDD Rule 1: changes queue until combat ends; player needs feedback the change was registered. |
| Loading screen overlay | — | — | — | State-driven (GSM Loading) | Handled by Scene Management; full-screen takeover. |
| Death screen ("You Died" + cause) | — | — | — | State-driven (HP = 0) | Identical for both modes per GDD edge case. |
| Quest objective tracker | — | — | — | Deferred to Vertical Slice | Not in MVP per GDD Deferred Content table. |
| XP / level / progression | — | — | — | Not applicable | No XP/level system per game concept ("player skill grows through practice, not stat inflation"). |
| Faction reputation display | — | — | — | Deferred to Vertical Slice | Per GDD Deferred Content table. |
| Damage numbers (floating combat numbers) | — | — | — | Hidden (not a feature) | Not an RPG with damage variance to optimize. Combat reads hit confirmation through alien stagger and audio. |
| Enemy health bars | — | — | — | Hidden (not a feature) | Aliens die in 2–5 shots (Combat GDD). Health bars would dilute Pillar 3 tension. |
| Nearby infection source count | — | Tactical (every 10s, bottom-right) | — | Immersive (environmental VFX density) | Tactical exposes count; Immersive reads spore density. |
| Camp threat indicator (camp cell infection > 25) | — | Tactical (every 30s, top-left below health) | — | Immersive (audio/environmental cues at camp) | Tactical surfaces explicit warning; Immersive trusts the player's audio awareness. |
| Active cure zones | — | Tactical (blue circle on minimap) | — | Immersive (cure deployment VFX persists in world) | Tactical shows on minimap; Immersive sees the shimmer in world. |
| Reload progress (during reload animation) | — | — | — | Both modes (animation IS the indicator — no separate UI) | Reload time is read from the animation; no progress bar. |
| Healing item use progress | — | Both modes (small circular indicator near crosshair / center-bottom) | — | — | Health System UI Requirements explicitly defines this. Both modes. |
| Crosshair / reticle | — | Tactical FirstPerson scoped only | — | Hidden in third-person and Immersive scoped | Not a shooter — no persistent crosshair. Only appears when aiming down sights in Tactical (GDD Rule 7). |

---

## 3. Layout Zones

### 3.1 Zone Diagram

```
 0%                                                          100%
 ┌─────────────────────────────────────────────────────────────┐  0%
 │  [SAFE MARGIN — 5% from all edges at PC fullscreen]         │
 │  ┌───────────────────────────────────────────────────────┐  │  5%
 │  │ TOP-LEFT          TOP-CENTER              TOP-RIGHT   │  │  ~5–15%
 │  │ • Health bar      • Zone name (3s)        • Detection │  │
 │  │   + numeric HP      [Tactical only]         meter +   │  │
 │  │ • Stamina bar                               state lbl │  │
 │  │ • Camp threat                             • Combat    │  │
 │  │   indicator                                 state     │  │
 │  │   [Tactical only]                                     │  │
 │  │                                                       │  │
 │  │ [SCREEN-EDGE BAND — all 4 edges, 1–2% from edge]      │  │
 │  │  • Threat direction mini-dots [Tactical]              │  │
 │  │  • Damage direction flash [both modes, diegetic]      │  │
 │  │  • Vignettes [both modes, diegetic, post-process]     │  │
 │  │                                                       │  │
 │  │                  [CENTER ±15%]                        │  │  ~50%
 │  │  • Crosshair (Tactical + scoped only)                 │  │
 │  │  • Heal-in-progress circular indicator                │  │
 │  │  • Nothing persistent here in third-person play       │  │
 │  │                                                       │  │
 │  │              [CENTER-BOTTOM — 15% from bottom]        │  │  ~75%
 │  │  • Context prompts (primary + optional secondary)     │  │
 │  │  • Tutorial hint labels (one at a time)               │  │
 │  │  • Subtitles (above context prompts when both active) │  │
 │  │                                                       │  │
 │  │ BOTTOM-LEFT       BOTTOM-CENTER          BOTTOM-RIGHT │  │  ~85–95%
 │  │ (reserved —      • Quick slots (4)       • Ammo       │  │
 │  │  intentionally   • Minimap above           counter    │  │
 │  │  empty for       quick slots               [Tactical] │  │
 │  │  HUD layout      [Tactical only]         • Weapon     │  │
 │  │  editor / repos. │                         condition  │  │
 │  │  per Section 9]                            icon       │  │
 │  │                                          • Nearby     │  │
 │  │                                            source     │  │
 │  │                                            count      │  │
 │  │                                          • Save       │  │
 │  │                                            indicator  │  │
 │  └───────────────────────────────────────────────────────┘  │
 │                                                             │
 └─────────────────────────────────────────────────────────────┘  100%
```

The center 30% of the screen (horizontally and vertically) is kept clear in third-person play. No persistent HUD element renders in this region during normal gameplay. The crosshair is the only center-screen element, and it only appears when the player is in Tactical mode AND FirstPerson AND scoped.

### 3.2 Zone Specification Table

| Zone Name | Screen Position | Safe Zone Compliant | Primary Elements | Max Simultaneous Elements | Notes |
|---|---|---|---|---|---|
| Top-Left | 5% from top, 5% from left | Yes | Health bar, stamina bar, camp threat indicator | 3 | Tactical-only zone. Empty in Immersive. Health is anchor element — top-most. Stamina renders directly below health. Camp threat (if active) renders below stamina. |
| Top-Center | 5% from top, centered | Yes | Zone name display | 1 | Single-message zone. Only Tactical uses this. Zone name fades in/out per GDD Rule 4. |
| Top-Right | 5% from top, 5% from right | Yes | Detection meter + state label, combat state indicator | 2 (stacked vertically) | Tactical-only. Detection meter is the upper element; combat state renders below it. |
| Screen-Edge Band | 1–2% inset from all four edges | Yes | Threat direction mini-dots (Tactical), damage direction flash (both), vignettes (both) | Up to 6 threat dots simultaneously; vignettes and flashes are post-process overlays | The band is a logical region, not a panel. Threat dots use opacity attenuation (Formula 3 of HUD GDD). |
| Center | Screen center ±15% | N/A (not a margin zone) | Crosshair (Tactical + FirstPerson scoped only), heal-in-progress indicator | 1 persistent (crosshair), 1 transient (heal indicator) | Kept clear in third-person. Hit markers and damage feedback are diegetic, not UI. |
| Center-Bottom | 15% from bottom, centered | Yes | Context prompts (primary + secondary), tutorial hints, subtitles | 4 simultaneously max: 1 subtitle + 1 tutorial + 2 context prompts. In practice rare — subtitle and prompts vertical-stack. | Highest-importance shared zone — present in both modes. Subtitles render above context prompts when both active. |
| Bottom-Left | 5% from bottom, 5% from left | Yes | Reserved (empty by default) | 0 | Intentionally empty. Reserved as a relocation target for HUD layout editor (Section 9). Avoids early commitment to a left-anchored persistent element. |
| Bottom-Center | 5% from bottom, centered | Yes | Quick slots (both modes), minimap (Tactical, above quick slots) | 2 stacked: minimap on top, quick slots below | Quick slots are always visible in both modes per GDD. Minimap stacks above in Tactical only. |
| Bottom-Right | 5% from bottom, 5% from right | Yes | Ammo counter, weapon condition icon, nearby source count, save indicator | 4 vertically stacked, with save indicator preempting bottom-most slot for 1.5s | Tactical-dominant zone (Immersive uses it only for save indicator and HUD mode change toasts). Ammo is anchor element — top-most. |

**Safe zone margins by platform:**

| Platform | Top | Bottom | Left | Right | Notes |
|---|---|---|---|---|---|
| PC — windowed | 0% | 0% | 0% | 0% | Respect minimum supported resolution 1280×720; elements must not crowd at minimum. |
| PC — fullscreen | 5% | 5% | 5% | 5% | Slight margin for TV-connected PCs and overscan. |
| PC — ultrawide (21:9, 32:9) | 5% top/bottom; 8% left/right | 5% | 8% | 8% | Horizontal extra inset prevents centered elements from drifting to peripheral edge of vision. Minimap and zone name stay centered. Top-left and bottom-right anchor closer to playable region, not absolute screen edge. |

Console, mobile, and Steam Deck are not target platforms per `.claude/docs/technical-preferences.md`. Steam Deck row removed; future addition would require redesigning the 5% safe zone at 1280×800.

---

## 4. HUD Element Specifications

### 4.1 Element Overview Table

| Element Name | Zone | Always Visible | Visibility Trigger | Data Source | Update Frequency | Max Size (% screen W) | Min Readable Size | Overlap Priority | Accessibility Alt |
|---|---|---|---|---|---|---|---|---|---|
| Health Bar (Tactical) | Top-Left | Yes (Tactical) | Always in Tactical Gameplay | Health System `OnHealthChanged` | On value change | 18% | 180px wide × 24px tall at 1080p | 1 | Numeric "73/100" always visible; bar color carries WCAG-distinct shape change at thresholds |
| Stamina Bar (Tactical) | Top-Left (below health) | No | Show when consuming; hide 3s after returning to full | Movement System `OnStaminaChanged` | Realtime during use | 14% | 140px wide × 14px tall | 2 | Bar tag "Stamina" text label always rendered when bar visible |
| Camp Threat Indicator | Top-Left (below stamina) | No | Camp cell infection > 25 | Infection Spread System (every 30s) | Every 30s | 8% | 24px icon + 16px text | 3 | Text label "Camp threatened" required; never icon-only |
| Detection Meter + State Label (Tactical) | Top-Right | Yes (Tactical) | Always in Tactical Gameplay | Stealth System `OnDetectionChanged` | Every 0.25s | 8% | 60px wide × 140px tall (vertical bar) + state label below | 1 | State label is text-first: "Hidden / Suspicious / Alert / Engaged / Detected" |
| Combat State Indicator (Tactical) | Top-Right (below detection) | No | Visible when state ≠ "Clear" | Combat System `OnCombatStateChanged` | On state change | 10% | 16px text | 2 | Text-only element. "In Combat / Disengaging" always reads as words. |
| Zone Name (Tactical) | Top-Center | No | On zone crossing; 0.5s fade in, 3s hold, 0.3s fade out | Scene Management `OnZoneCrossed` | On event | 30% | 18px text minimum at 1080p | 4 | Text element by definition; scales with text scale setting |
| Threat Direction Dot — minimap (Tactical) | Bottom-Center (within minimap) | No | When alien in 5000cm range | Alien AI `OnThreatUpdate` | Every 0.5s | Renders within minimap | 8px dot | 5 | Per-state color is supplemental; dot shape distinguishes patrol/suspicious/alert/combat — see Section 10.1 |
| Threat Direction Dot — screen edge (Tactical) | Screen-Edge Band | No | When alien outside minimap range but within ~7000cm OR off-screen but in 5000cm | Alien AI | Every 0.5s | 12px dot + arrow | 12px arrow | 5 | Same shape mapping as minimap dots |
| Damage Direction Flash (both modes) | Screen-Edge Band | No | 0.1s on damage received | Health System `OnHealthChanged` | On event | Full edge | Edge band 1–2% inset | 6 (transient) | Diegetic post-process; reduced motion replaces with static darkened corner per Section 10.3 |
| Red Damage Vignette (both modes) | Full screen (post-process) | No | After damage; intensity per Formula 1 of HUD GDD | Health System | On event + decay over 3s | Full screen | Full screen | 6 (post-process layer) | Vignette intensity is increased by 20% in colorblind modes (HUD GDD edge case) |
| Green Infection Vignette (both modes) | Full screen (post-process) | No | On infection exposure | Health System | On event | Full screen | Full screen | 6 | Symbol prefix or alt-channel not applicable (this is environmental, not informational; severity reads from vignette pulse rate which is unaffected by color blindness) |
| Ammo Counter (Tactical) | Bottom-Right | Yes (Tactical) when weapon equipped | Always in Tactical Gameplay with non-melee weapon | Combat System `OnAmmoChanged` | On fire / on reload | 10% | "12/30" text readable at 18px minimum at 1080p | 1 (in zone) | Text-only element; color is supplemental at ammo thresholds |
| Ammo Check Display (Immersive) | Bottom-Right | No | On IA_Reload pressed when magazine not empty | Combat System | 2.0s persist; non-interruptible per GDD UI Requirements line 481 | 10% | 18px text "3/12 | 8" | 2 | Text-only |
| Weapon Condition Icon (Tactical) | Bottom-Right (below ammo) | No (Tactical) | Show on weapon switch; persistent thereafter | Combat System | On weapon switch | 4% | 32px icon | 3 | Icon shape changes per condition: clean = solid circle, dirty = circle with cross, damaged = circle with X. Text tooltip on focus. |
| Nearby Source Count (Tactical) | Bottom-Right (below weapon condition) | No | When sources within 5000cm | Infection Spread | Every 10s | 6% | 32px icon + "x3" text | 4 | Text label "Sources: 3" required |
| Minimap (Tactical) | Bottom-Center (above quick slots) | Yes (Tactical) | Always in Tactical Gameplay except cinematic/scope | Scene Mgmt + Alien AI + Infection Spread | Threat: 0.5s. Infection heatmap: 10s. | Circular, diameter ≈ 14% screen width (≈ 270px at 1080p) | 150px diameter minimum | 1 (in zone) | Icon-shape per category required: see Section 10.1. Cardinal direction letters (N/E/S/W) on minimap ring. |
| Quick Slots (both modes) | Bottom-Center | Yes (both modes) | Always in Gameplay state | Inventory System | Per frame | 16% | Each slot 56×56px at 1080p, 4 slots horizontal | 2 (Tactical, below minimap) / 1 (Immersive) | Slot number "1 / 2 / 3 / 4" labels visible; stack count text on item |
| Context Prompt — Primary (both modes) | Center-Bottom | No | On interactable in range with highest priority score (Formula 2 HUD GDD) | Player Controller `OnContextPrompt` | On event (fade 0.2s in / 0.15s out) | 40% | Label readable at 18px minimum | 1 (in zone) | Text-first design; input glyph + text. Glyph also has letter label per input device. |
| Context Prompt — Secondary (both modes) | Center-Bottom (40px below primary) | No | When 2nd-priority interactable exists | Player Controller | On event | 35% | 16px text minimum | 2 (in zone) | 70% opacity; same accessibility treatment as primary |
| Tutorial Hint Label (both modes) | Center-Bottom (above context prompts) | No | Tutorial System `ShowTutorialScreenLabel` | Tutorial System | On event | 50% | 16px text | 3 (in zone) | One at a time; dismissible by player input |
| Subtitles (both modes when ON) | Center-Bottom (above tutorial / context) | No (controlled by setting) | Any voiced line or critical caption playing | Dialogue / Audio System | Per line | 60% | 24px minimum at 1080p | 1 within subtitle stack | Per Section 10.4 |
| Heal-in-Progress Indicator (both modes) | Center (near crosshair) | No | During healing consumable use | Health System | Per frame during use | 4% | 48px circular indicator | 4 (transient) | Item icon embedded; numeric time remaining text below |
| Crosshair (Tactical + FirstPerson scoped only) | Center | No | Aiming down sights in Tactical | Camera + Combat systems | Realtime | 2% | 12px diameter minimum | 1 (in zone, when active) | Reduced motion: static crosshair only. Optional enlarged crosshair in accessibility settings (24px). |
| Save Indicator (both modes) | Bottom-Right (preempts bottom-most slot, 1.5s) | No | Save event fires | Save/Load System | On event | 6% | 24px icon + "Saving..." text | 5 | Text label always; never icon-only |
| HUD Mode Change Toast (both modes) | Bottom-Right (1.5s slide-in) | No | Player changes HUD mode in options during combat (per GDD Rule 1, change is queued) | HUD Subsystem | On event | 22% | 16px text | 5 | Text-only; reads "HUD mode change will apply after combat" |
| Loading Screen Overlay | Full screen | No | GSM Loading state | Game State Machine | On state | Full | Full | Highest (replaces all HUD) | Heartbeat pulse animation can be disabled via reduced-motion (see Section 10.3) |
| Death Screen | Full screen | No | Player HP = 0 | Health System / GSM | On event | Full | Full | Highest (replaces all HUD) | "You Died" + "Killed by: [cause]" text; cause derived from EDamageType per HUD GDD OQ-1 |

### 4.2 Element Detail Blocks

---

**Health Bar (Tactical mode)**

- Visual description: Horizontal fill bar, left-anchored within Top-Left zone. 180px wide × 24px tall at 1080p reference. Background: dark semi-transparent panel at 50% opacity (#000000 at 50%). Fill direction: left-to-right (decreases right-to-left). Fill color is contextual per Formula 4 of HUD GDD: green (#4CAF50) above 50 HP, orange (#FF9800) at 26–50 HP, red (#F44336) at 25 HP and below. 5-pixel linear interpolation zone at each color boundary. Numeric text label rendered below bar at 18px: "73/100".
- Data displayed: Current HP / Max HP. Color encodes urgency tier.
- Update behavior: Bar fill lerps over 200ms on value change. Large damage (>25 HP single hit) triggers a brief 1-frame white flash before fill resolves to new value. On healing, bar grows with same 200ms lerp.
- Urgency states:
  - Operational (51+ HP): green fill, no pulse, no animation other than value lerp.
  - Wounded (26–50 HP): orange fill, no pulse; numeric text label color matches fill.
  - Critical (11–25 HP): red fill, 1 Hz slow pulse on the fill (10% opacity oscillation, not the panel background); numeric text in red.
  - Near Death (1–10 HP): red fill, 1.5 Hz pulse increased to 15% amplitude; vignette already present via post-process layer; numeric text bold + red.
  - Dead (0 HP): bar empties and turns grey (#9E9E9E); death screen state takes over before this is visible for more than a frame.
- Interaction: Display only.
- Player customization: Opacity adjustable per Section 10.5. Repositionable to any of the four corners via HUD layout editor (Section 9).

---

**Stamina Bar (Tactical mode)**

- Visual description: Horizontal fill bar, 140px × 14px at 1080p reference, rendered directly below the health bar with 8px gap. Background: same dark semi-transparent panel as health. Fill color: neutral blue (#2196F3) at all times — intensity varies (90% saturation > 30% stamina, 70% saturation 10–30%, 50% saturation < 10%). Per GDD Visual/Audio Requirements: "Always blue, intensity varies." No text label by default.
- Data displayed: Current stamina (0–100) as fill percentage. No numeric readout — stamina is felt by the player, and the bar's purpose is moment-to-moment glance.
- Update behavior: Realtime; bar drains/regenerates in lockstep with stamina value. No lerp — direct binding.
- Urgency states:
  - Stamina > 30%: fully saturated blue, no special animation.
  - Stamina 10–30%: reduced saturation; bar subtly pulses at 0.5 Hz to draw attention.
  - Stamina < 10%: low saturation; bar pulses at 1 Hz; "Stamina" text label appears below the bar in this state to make the depletion explicit.
- Visibility rules: Hidden when stamina is at maximum (100) and has not depleted in the last 3.0 seconds. Appears immediately on first depletion event with a 200ms fade-in. Remains visible until stamina has been at maximum for 3.0 seconds, then fades out over 500ms.
- Interaction: Display only.
- Player customization: Can be permanently shown (no auto-hide) via accessibility option "Always show stamina bar."

---

**Camp Threat Indicator (Tactical mode)**

- Visual description: 32px icon (camp/tent symbol with red warning chevron) + 16px text "Camp threatened: [zone name]" rendered as a horizontal pill in Top-Left zone, directly below stamina bar with 12px gap. Background: 40% opacity dark panel. Text color: orange (#FF9800).
- Data displayed: Indicates that the player's most recently visited camp (closest visited camp cell) has infection level > 25.
- Update behavior: Every 30 seconds, system queries Infection Spread for camp cell infection level. If > 25 and indicator not visible, fade in over 400ms. If ≤ 25 and indicator visible, fade out over 400ms.
- Urgency states: At infection > 50, icon color escalates to red and indicator pulses at 0.5 Hz.
- Visibility rules: Hidden by default. Only appears when condition is met.
- Interaction: Display only. Camp location is shown on minimap.
- Player customization: Can be disabled in accessibility / notification verbosity (Important Only / Off).

---

**Detection Meter + State Label (Tactical mode)**

- Visual description: Vertical bar, 60px wide × 140px tall at 1080p, anchored 5% from top-right. Fill orientation: bottom-up (low detection at bottom, full at top). Background dark panel at 50% opacity. Fill color per detection range: green (#4CAF50) 0–24, yellow (#FFEB3B) 25–49, orange (#FF9800) 50–74, red (#F44336) 75–100. State label text rendered below bar: "Hidden / Suspicious / Alert / Engaged / Detected." Label font 18px, color matches fill color tier.
- Data displayed: Global detection level (max across all aliens) as fill height. State label name.
- Update behavior: Update rate 0.25s per HUD GDD Rule 4. Smooth lerp over 200ms on value change. On state-tier change (crossing a threshold), label slides up 4px and fades from previous label over 250ms.
- Urgency states:
  - 0–24 Hidden: green fill, no pulse, label "Hidden."
  - 25–49 Suspicious: yellow fill, slow 0.5 Hz pulse, label "Suspicious."
  - 50–74 Alert: orange fill, 1 Hz pulse, label "Alert."
  - 75–99 Engaged: red fill, 1.5 Hz pulse, label "Engaged."
  - 100 Detected: red fill, sharp 2 Hz pulse + small screen-edge red vignette (already from damage system if damage taken; otherwise minor edge pulse only here), label "Detected."
- Interaction: Display only.
- Player customization: Can be hidden (HUD mode revert to Immersive in options). Opacity adjustable.

---

**Combat State Indicator (Tactical mode)**

- Visual description: 16px text rendered below detection meter, 12px gap. "In Combat" (red) / "Disengaging" (orange) / "Clear" (hidden when in this state).
- Data displayed: Current `ECombatState` from Combat System.
- Update behavior: On state change, fade in over 300ms with single pulse. Fade out over 500ms when state becomes "Clear."
- Urgency states: Text color encodes state. Red for "In Combat," orange for "Disengaging." Both modes accompanied by audio per Combat GDD; this is the visual surfacing.
- Interaction: Display only.
- Player customization: None beyond global HUD opacity.

---

**Zone Name Display (Tactical mode)**

- Visual description: Text element rendered at top-center, 18px (scales with text scale setting). Color: amber (#C9A227) per HUD GDD palette. No background panel — text overlay only. Format: "Z02 — Infected Town" (zone code + name).
- Data displayed: Zone name on crossing.
- Update behavior: On `OnZoneCrossed`, fade in over 500ms with subtle slide-down from top (8px), hold 3.0s, fade out over 300ms.
- Urgency states: None.
- Visibility rules: Only visible during the 3.8-second window per zone crossing event.
- Interaction: Display only.
- Player customization: Display duration adjustable per HUD GDD `ZoneNameDisplayDuration` tuning knob (1.0–5.0s).

---

**Threat Direction Mini-Dots (minimap, Tactical mode)**

- Visual description: Per-alien dot rendered on circular minimap at correct bearing and scaled distance. Dot diameter: 10px at 1080p (scales with minimap size). Color per alien state: gray (#9E9E9E) patrol, yellow (#FFEB3B) suspicious, orange (#FF9800) alert, red (#F44336) combat. Shape varies per state per Section 10.1 colorblind-distinct mapping.
- Data displayed: Alien position relative to player; alien detection/AI state via dot color and shape.
- Update behavior: Update every 0.5s per GDD Rule 6. Fade in 200ms / fade out 300ms on entering / leaving minimap range (5000cm). Opacity per Formula 3 of HUD GDD: `A_dot = clamp(1.0 - (d / R_max) × 0.8, 0.1, 1.0)`.
- Urgency states: Color and shape encode urgency.
- Interaction: Display only.
- Player customization: Minimap can be disabled (no fallback compass — see D10 of plan). Threat dot visibility scales with minimap visibility.

---

**Threat Direction Screen-Edge Indicators (Tactical mode)**

- Visual description: 12px arrow + dot rendered on screen-edge band pointing toward an off-screen alien in 5000cm range. Color matches alien state per same palette as minimap dots.
- Data displayed: Direction to off-screen alien threat.
- Update behavior: Updates every 0.5s. Indicator appears when alien is off-screen but within range; disappears when alien is on-screen or out of range.
- Urgency states: Color encodes urgency.
- Interaction: Display only.
- Player customization: Can be disabled in HUD layout settings (separate from minimap toggle for players who want minimap but not edge indicators).

---

**Damage Direction Flash (both modes)**

- Visual description: Screen-edge band on the side opposite the damage source flashes briefly. Color: bone white (#F5F0E8) at 15% opacity per HUD GDD Rule 8. Green tint (#3D6B2E) for infection exposure damage. Duration: 0.1s flash, then fades over 0.3s.
- Data displayed: Direction of incoming damage.
- Update behavior: On `OnHealthChanged` with damage event, flash fires immediately. No queuing — multiple hits fire multiple flashes.
- Urgency states: None at the element level (vignette intensity carries severity).
- Visibility rules: Always fires on damage event in both modes. This is post-process feedback, not a HUD widget per se, but is documented here because it is the only "always on" damage indicator in Immersive.
- Interaction: Display only.
- Player customization: Reduced motion replaces with static darkened corner at 30% opacity per Section 10.3.

---

**Red Damage Vignette (both modes)**

- Visual description: Full-screen red vignette emanating from screen edges inward. Intensity per Formula 1 of HUD GDD: `V_initial = clamp(damage_amount / 100, 0, 0.6)`, decays exponentially `V(t) = V_initial × e^(-t / 1.0)` over 3.0 seconds. Stacks per HUD GDD (additive up to 0.6 max).
- Data displayed: Recent damage severity and recency.
- Update behavior: Post-process layer; binds to Health System damage events.
- Urgency states: Intensity itself is the urgency indicator.
- Interaction: Display only.
- Player customization: Per accessibility — vignette intensity boosted by 20% in colorblind modes. Reduced motion does not disable the vignette (it is severity-critical and static after the fade-in); reduces only the per-hit pulse animation.

---

**Green Infection Vignette (both modes)**

- Visual description: Full-screen green vignette (Alien Verdant #3D6B2E) at 0.3s pulse every 1s during infection exposure (Health GDD).
- Data displayed: Active environmental infection damage.
- Update behavior: Active while player is on biomass or in infection zone; fades within 0.5s of leaving.
- Urgency states: Pulse rate increases when player is in heavily infected cell (intensity not exceeding 25% opacity).
- Interaction: Display only.
- Player customization: Opacity adjustable via global HUD opacity but not below 30% — this is gameplay-critical feedback.

---

**Ammo Counter (Tactical mode)**

- Visual description: Text rendered in Bottom-Right zone, anchor 5% from bottom, 5% from right. Format: "3/12 | 8" — magazine / capacity | reserve. Magazine number 24px (largest, most important), separator 18px, reserve 18px. Color encodes ammo state per HUD GDD palette: green (#4CAF50) > 50% magazine, orange (#FF9800) 20–50%, red (#F44336) < 20%.
- Data displayed: Current magazine rounds, magazine capacity, reserve ammo for current weapon type.
- Update behavior: Updates immediately on `OnAmmoChanged` event. On reload, animation matches GDD reload time (lerp does not preempt — value updates at reload completion per Combat GDD).
- Urgency states:
  - > 50%: green, no animation.
  - 20–50%: orange, no animation.
  - < 20%: red, no animation; subtle 0.5 Hz pulse on the magazine number only (not the reserve).
  - 2 or fewer rounds in magazine: triggers "Low Ammo Warning" sound (single chamber-click) per Combat GDD; visual unchanged from above.
- Interaction: Display only.
- Player customization: Opacity adjustable. Repositionable via HUD layout editor.

---

**Ammo Check Display (Immersive mode)**

- Visual description: Small text element in Bottom-Right at the same anchor position the Tactical ammo counter would occupy. Format: "3/12 | 8" matching Tactical format. 18px text on 40% opacity dark panel.
- Data displayed: Current magazine / capacity | reserve.
- Update behavior: Triggered by IA_Reload when magazine is not empty (per HUD GDD Rule 3 and Combat GDD Rule 4). Persists for 2.0 seconds, then fades over 300ms. Per Combat GDD UI Requirements line 481: check animation is interruptible but display persists for 2.0s regardless.
- Urgency states: Color matches Tactical color tiers but does not pulse.
- Visibility rules: Only visible during the 2.0s display window after a check-magazine action.
- Interaction: Display only.
- Player customization: None.

---

**Weapon Condition Icon (Tactical mode)**

- Visual description: 32px circular icon rendered in Bottom-Right, directly above ammo counter with 12px gap. Three states (per Combat GDD): clean = solid filled circle (green), dirty = circle with diagonal line through it (yellow), damaged = circle with X (red).
- Data displayed: Current weapon condition tier.
- Update behavior: Appears with 300ms fade-in on weapon switch. Persistent thereafter. Icon swap on condition tier change is instantaneous with a single 200ms pulse for affordance.
- Urgency states: Encoded in icon shape and color.
- Interaction: Display only.
- Player customization: Can be disabled in HUD layout (cosmetic icon — combat system still functions without visual surface).

---

**Nearby Source Count (Tactical mode)**

- Visual description: 32px icon (spore/biomass symbol) + 18px text "x3" rendered in Bottom-Right, below weapon condition with 12px gap.
- Data displayed: Count of active infection sources within 5000cm of player.
- Update behavior: Updates every 10 seconds per HUD GDD Rule 4 (matches infection tick). Fade in/out over 300ms on appearance/disappearance.
- Urgency states: Text color encodes severity: green (1–2), orange (3–4), red (5+).
- Visibility rules: Only visible when at least one source is within 5000cm. Hidden otherwise.
- Interaction: Display only.
- Player customization: Can be disabled in HUD layout.

---

**Minimap (Tactical mode)**

- Visual description: Circular widget rendered in Bottom-Center zone, 270px diameter at 1080p (scales with minimap size preset S/M/L: 200/270/340px). Border: 2px stroke at 80% opacity dark color. Player icon at center: white dot, 10px diameter. Cardinal direction letters (N/E/S/W) rendered on the outer ring at 14px, 30% opacity (subtle navigation aid). Background: gradient dark fade at 60% opacity at center to 40% at edge. Map data layers (in render order, back-to-front): infection heatmap (green overlay #3D6B2E at 10–40% opacity per cell infection level) → cure zones (blue circles #4A90D9 at 20% opacity) → zone boundaries (dashed white lines, 1px) → discovered location icons (camp/hive/POI symbols, 16px) → infection source dots (red, 8px, pulsing for procedural sources) → threat dots (color per alien state, on top of all other layers).
- Data displayed: Player position (center), zone topology, infection heatmap, cure zones, discovered locations, infection sources, threats.
- Update behavior: Player position and rotation: realtime. Threat dots: 0.5s. Infection heatmap: 10s. Cure zones: on deploy/expire. Discovered locations: on discovery. Player rotation drives north — minimap rotates so player faces "up" on the map.
- Urgency states: Threat dot pulse rate increases for combat-state aliens (red dots pulse at 2 Hz; suspicious yellow dots pulse at 0.5 Hz).
- Visibility rules: Always visible in Tactical Gameplay state. Hidden in Cinematic, Death, Pause, FirstPerson scoped. Scales to 60% of normal size in FirstPerson unscoped (per HUD GDD Rule 7).
- Interaction: Display only. Full-screen map is a separate screen (deferred to Vertical Slice — Map System).
- Player customization: Size S/M/L preset. Opacity adjustable. Can be disabled entirely (player accepts no map, no compass fallback — consistent with Immersive philosophy). Repositionable via HUD layout editor.

---

**Quick Slots (both modes)**

- Visual description: Horizontal row of 4 slots rendered in Bottom-Center. Each slot is 56×56px at 1080p with 8px gap between slots. Total width: ~256px. Each slot shows: item icon (40×40px centered), stack count text bottom-right of slot (12px), slot number "1/2/3/4" (or D-pad direction for gamepad: L/R/D/U) top-left of slot (10px, 60% opacity). Empty slots show grayed background with slot number only. Active/cooldown state: subtle highlight on slot when item is in use (e.g., during heal animation).
- Data displayed: Assigned consumable per slot, current stack count, slot input binding.
- Update behavior: Per frame (cheap update; just inventory binding). Item icon swap on inventory change is instantaneous with 200ms fade.
- Urgency states: Slot dims to 60% opacity when stack count is 0. Slot pulses (300ms single pulse) when an item is added to a previously empty slot.
- Visibility rules: Always visible in both modes during Gameplay state.
- Interaction: Input-driven. Player presses 1/2/3/4 (keyboard) or D-pad L/R/D/U (gamepad) to use assigned consumable. Slot assignment is set in inventory menu (separate screen).
- Player customization: Position can be adjusted slightly via HUD layout editor but anchor remains Bottom-Center per pillar — quick slots are too critical to hide or scatter.

---

**Context Prompt — Primary (both modes)**

- Visual description: Pill-shaped element rendered Center-Bottom at 15% from bottom edge. Background: 60% opacity dark panel. Contains: input glyph (32px icon showing key or button per current input device) + label text (18px, off-white #E8E4DC per HUD GDD palette) + target name in smaller text (14px, 80% opacity). Optional progress bar for timed interactions > 1.0s duration: 200px wide × 4px tall, rendered directly below label, fills left-to-right.
- Data displayed: Input prompt, action label (e.g., "Pick up"), target name (e.g., "Medkit"), interaction progress if applicable.
- Update behavior: Fade in 200ms on enter range. Fade out 150ms on leave range or interaction completion. Per HUD GDD Rule 5.
- Urgency states: Priority-determined per Formula 2 of HUD GDD (quest > combat > survival > exploration > ambient). Blocked interactions render "Blocked" label in red at 70% opacity for 1.0s.
- Visibility rules: Visible when an interactable is within range with clear or partial LOS, and priority score exceeds 0.5.
- Interaction: Player presses bound interaction input (IA_Interact) while prompt is visible to execute the interaction.
- Player customization: Opacity adjustable. Text scales with text-scale setting.

---

**Context Prompt — Secondary (both modes)**

- Visual description: Identical to primary but rendered 40px below the primary prompt, at 70% opacity per HUD GDD Rule 5.
- Data displayed: Second-highest-priority interactable, when one exists.
- Update behavior: Same fade timings as primary. If primary is dismissed and secondary exists, secondary promotes to primary slot with a 200ms cross-fade.
- Urgency states: Same as primary.
- Visibility rules: Only when a second-priority interactable scores above 0.5.
- Interaction: Some context-sensitive interactions may have an alternate input bound to the secondary prompt (deferred — out of MVP scope per HUD GDD). For MVP, secondary is informational only.
- Player customization: Can be disabled if player finds dual prompts confusing (Accessibility option "Show secondary prompts: On/Off").

---

**Tutorial Hint Label (both modes)**

- Visual description: Text element rendered Center-Bottom, directly above context prompts with 12px gap when both active. 18px text on 40% opacity dark panel, with subtle border at 80% opacity. Optional "Press [input] to dismiss" affordance text below at 14px.
- Data displayed: Tutorial system hint text passed via `ShowTutorialScreenLabel(FText)`.
- Update behavior: Fade in 300ms on display. Persistent until player completes the relevant action OR presses dismiss input. Fade out 200ms on dismiss.
- Urgency states: None.
- Visibility rules: At most one tutorial hint at a time. Subsequent hints queue.
- Interaction: Player can dismiss with bound dismiss input (e.g., Esc / B button) or by completing the action being taught.
- Player customization: Can be disabled in accessibility / tutorial verbosity (All / Important Only / Off). When Important Only is selected, only mechanic-critical tutorials display; UI-feedback tutorials are suppressed.

---

**Subtitles (both modes when ON)**

- Visual description: Full subtitle specification in Section 10.4. Renders Center-Bottom, above tutorial / context prompts when both are active. Semi-transparent black background (70%), off-white text (#E8E4DC), 24px minimum at 1080p.
- Data displayed: Dialogue lines, critical sound effect captions, speaker names.
- Update behavior: Per Section 10.4 — persists for spoken line duration + 300ms after audio ends. Line breaks at natural pause points. Max 2 lines simultaneously.
- Urgency states: Critical SFX captions (e.g., "[hive emerging in the distance]") are bold to distinguish from dialogue.
- Visibility rules: Controlled by subtitle setting (Section 10.4). When ON, displays for all voiced lines and critical environmental audio.
- Interaction: Display only.
- Player customization: Full subtitle settings per Section 10.4 and Section 10.5.

---

**Heal-in-Progress Indicator (both modes)**

- Visual description: Circular progress indicator rendered at screen center, ~48px diameter at 1080p. Ring fills clockwise as heal progresses. Inner area shows item icon (Field Dressing / Medkit / Stimshot). Text below ring shows remaining time (e.g., "1.4s"). Color: blue-white (#A0C8E0).
- Data displayed: Healing consumable type, time remaining on heal application.
- Update behavior: Appears immediately on heal start with 200ms scale-up from 80%. Ring fills realtime. On completion, brief 200ms green flash and fade out 300ms. On cancellation (movement, damage), ring flashes red and fades out 200ms.
- Urgency states: Ring color shifts to amber if player is taking damage during heal (visual reinforcement that heal will cancel on next damage event for Field Dressing / Medkit).
- Visibility rules: Only visible during active heal application.
- Interaction: Display only. Heal is initiated via IA_UseItem on quick slot.
- Player customization: Position adjustable (some players want this further from screen center to avoid blocking aiming).

---

**Crosshair (Tactical mode + FirstPerson scoped only)**

- Visual description: 12px diameter dot or small ring at screen center. Default shape: thin ring (1px stroke) with 2px center dot. Color: off-white (#E8E4DC) with thin dark outline for contrast against any background. Spread visualization: ring radius expands with current weapon spread (per Combat GDD Formula 2 spread value, scaled to screen px).
- Data displayed: Aim point, current weapon spread.
- Update behavior: Realtime spread visualization. Expands within 100ms on spread increase, contracts within 200ms on decrease.
- Urgency states: None for the crosshair itself; spread is the primary visual variable.
- Visibility rules: Only visible when player is in Tactical mode AND in FirstPerson view AND scoped. Hidden in third-person (the game is action-adventure, not a shooter; third-person uses over-the-shoulder aim without a fixed crosshair).
- Interaction: Display only.
- Player customization: Static crosshair toggle (reduced motion, Section 10.3). Enlarged crosshair toggle (24px) for low-vision players. Color toggle (white / yellow / cyan).

---

**Save Indicator (both modes)**

- Visual description: 24px circular save icon + "Saving..." text at 16px, rendered in Bottom-Right at the slot normally occupied by ammo counter or nearby source count. Background: 60% opacity dark panel.
- Data displayed: Save in progress.
- Update behavior: Appears on `ShowSaveIndicator()` with 200ms fade-in. Persists for save duration (typically < 1s for autosave) but minimum 1.5s for player perception. Fade out 300ms on save complete (`HideSaveIndicator()`).
- Urgency states: None for normal saves. If save fails (error case), indicator turns red with "Save failed — see options" message persisting until dismissed.
- Visibility rules: Only during save events. Preempts other Bottom-Right elements in the bottom-most slot during its 1.5s window.
- Interaction: Display only.
- Player customization: Cannot be disabled — save feedback is essential.

---

**HUD Mode Change Toast (both modes)**

- Visual description: Pill-shaped notification rendered in Bottom-Right, 22% screen width. 16px text on 60% opacity dark panel. Message: "HUD mode change will apply after combat ends."
- Data displayed: Confirmation that a queued HUD mode change has been registered.
- Update behavior: Fires when player attempts to change HUD mode in options during combat per HUD GDD Rule 1. Slide-in from right over 300ms, hold 2.0s, fade out 400ms. On next combat exit, a follow-up toast appears: "HUD mode changed to [Tactical/Immersive]" for 1.5s.
- Urgency states: None.
- Visibility rules: Only on the specific events described.
- Interaction: Display only.
- Player customization: Cannot be disabled — needed for player confidence that the system registered their preference.

---

**Loading Screen Overlay**

- Visual description: Full-screen takeover. Centered: zone name being loaded (Amber #C9A227, 32px). Below: heartbeat pulse animation (a circular pulse at 1 Hz simulating the character's breathing — diegetic per HUD GDD Cross-References to Scene Management). At bottom: progress indicator (thin bar 60% screen width, 4px tall) and rotating tip text (random tip from a curated pool, 16px).
- Data displayed: Target zone name, loading progress, contextual tip.
- Update behavior: Fade in over 800ms when GSM Loading state is entered. Heartbeat pulse runs continuously. Progress bar fills as load completes. Fade out over 1.0s on load complete.
- Urgency states: None.
- Visibility rules: Entire HUD is replaced; nothing renders behind the loading screen.
- Interaction: Display only.
- Player customization: Heartbeat pulse can be disabled via reduced motion setting (Section 10.3) — replaced with a static breathing icon.

---

**Death Screen**

- Visual description: Full-screen takeover. Centered: "You Died" text in red (#F44336) at 48px. Below: "Killed by: [cause]" at 24px (cause derived from EDamageType per HUD GDD OQ-1 resolution: "Fall," "Alien Melee," "Alien Ranged," "Environmental: Fire," "Environmental: Toxic," "Infection Exposure"). Below: "Restart from Checkpoint?" prompt with primary action ("Restart" — Enter) and secondary action ("Quit to Menu"). Background: full screen fade to dark gray over 2.0s with subtle red vignette.
- Data displayed: Death event, cause of death, checkpoint info.
- Update behavior: On player HP = 0, screen fades in over 2.0s with low drone audio per HUD GDD audio table. Hold until player input. On Restart, fades out to loading screen. On Quit, transitions to main menu.
- Urgency states: None.
- Visibility rules: Entire HUD is replaced.
- Interaction: Player input dismisses to load checkpoint or quit.
- Player customization: None.

---

## 5. HUD States by Gameplay Context

| Context | Elements Shown | Elements Hidden | Elements Modified | Transition Into This State |
|---|---|---|---|---|
| **Gameplay — Immersive, Non-Combat** | Context prompts (when in range), quick slots, subtitles (if active), tutorial hints (if active), save indicator (transient) | Health bar, stamina bar, detection meter, minimap, ammo counter, weapon condition, threat indicators, zone name, all Tactical elements | Damage vignettes and direction flashes remain available as post-process (not "shown" as UI but always-on layers) | This is the default state for Immersive players. No transition. |
| **Gameplay — Immersive, Combat** | Same as Immersive Non-Combat + (during ammo check) ammo display | Same Tactical elements hidden | Vignette pulses red when in Engaged/Detected stealth state | Combat is signaled by audio and FOV change (camera narrows to 65°); no HUD addition. |
| **Gameplay — Tactical, Non-Combat** | Health bar, stamina bar (if depleting), detection meter (Hidden state, green), minimap, quick slots, context prompts (when in range), subtitles, tutorial hints, zone name (on cross), save indicator (transient) | Combat state indicator (because state is "Clear"), ammo counter pulse, threat indicators (when none present) | Detection meter renders at green/low; minimap shows zone topology and discovered locations | Default Tactical state. No transition. |
| **Gameplay — Tactical, Combat** | All elements from Tactical Non-Combat + ammo counter active + combat state indicator ("In Combat" red) + threat direction indicators (minimap + screen edge) | Notification toasts paused (queue held) | Detection meter shifts to red, pulse 2 Hz; ammo counter pulse if low; minimap threat dots refresh at 0.5s | Combat enters when detection = 100 OR player attacks alien OR patrol detects player. IMC_Combat push fires within 0.1s; combat state indicator fades in over 300ms. |
| **Dialogue Active (non-cutscene)** | Subtitles, all gameplay HUD as normal | None (Hostile World dialogue is non-cinematic and happens with full HUD per Witcher 3 convention; dialogue is part of survival, not a separate scene) | Context prompts may show "Continue" prompt below dialogue subtitle | Dialogue System fires `OnDialogueStarted`. HUD elements unchanged. |
| **Cinematic / Cutscene (scripted camera)** | Subtitles only | All gameplay HUD elements (health, ammo, minimap, detection, threat indicators, vignettes, quick slots, context prompts, etc.) | Letterbox bars slide in (if used by game's cinematic system) | Camera System enters Cinematic state. All HUD fades out over 400ms. |
| **Inventory / Pause Menu Open** | None (pause menu and inventory are separate screens) | All HUD elements | Game world visible but frozen behind menu | GSM Paused state. HUD frozen-in-place (last state retained), faded to 0 opacity over 150ms. On menu close, HUD fades back in over 150ms with current data. |
| **FirstPerson Unscoped (Tactical)** | All Tactical HUD elements | None | Minimap scales to 60% size per HUD GDD Rule 7 | Camera System enters FirstPerson. Minimap rescales over 200ms. |
| **FirstPerson Unscoped (Immersive)** | Context prompts only | All else | None | Same as Immersive default; camera change does not add HUD. |
| **FirstPerson Scoped (Tactical)** | Crosshair, ammo counter (minimal — just magazine count) | Minimap, health bar, stamina bar, detection meter, all other Tactical elements | Ammo counter shrinks to magazine-only format ("3/12") | Camera System enters Scoped state. Per HUD GDD Rule 7: tunnel-vision treatment. Transition over 200ms. |
| **FirstPerson Scoped (Immersive)** | None | All HUD | None | Per HUD GDD Rule 7: full tunnel vision in scoped Immersive. |
| **Death** | Death screen (separate full-screen overlay) | All gameplay HUD | Vignette and gameplay layers fade over 600ms; death screen fades in over 2.0s | Player HP = 0. Health System fires death event. |
| **Loading / Zone Transition** | Loading screen overlay (heartbeat pulse, zone name, progress bar, tip text) | All HUD | None | GSM Loading state. Loading overlay fades in over 800ms. |
| **Tutorial — New Mechanic Trigger** | Standard context HUD + Tutorial hint label | Notification toasts may be temporarily suppressed during tutorial display (queue) | Tutorial hint label has a subtle dim of surrounding HUD (10% opacity reduction on non-essential elements like nearby source count) | Tutorial System fires `ShowTutorialScreenLabel(FText)`. Hint fades in over 300ms. |
| **HUD Mode Change (during combat)** | Current mode's HUD + HUD Mode Change Toast (transient, 2.0s) | None additional | None | Player adjusts HUD mode in options while in combat. Per GDD Rule 1, change queues. Toast confirms. |

---

## 6. Information Hierarchy

| Element | Priority Tier | Reasoning | What Replaces It If Hidden |
|---|---|---|---|
| Subtitles | MUST KEEP — during any audio with caption-relevant content, when subtitle setting is ON | Accessibility requirement (Standard WCAG AA tier commits to subtitles for spoken dialogue). Story clarity. | Nothing replaces subtitles — they are an accessibility primitive, not a discretionary element. |
| Damage Vignette | MUST KEEP — both modes, always | Sole damage feedback channel in Immersive; survival-critical in Tactical to communicate severity beyond the health bar. | Audio (heavy breathing) supplements but cannot replace visual damage severity. |
| Context Prompts | MUST KEEP — when an interactable is in range | Without prompts, interactable objects become invisible to the player. Only persistent UI in Immersive. | Environmental visual cues (objects highlighted via art bible "valuable item glow") can supplement, but explicit affordance is required. |
| Quick Slots | MUST KEEP — both modes | Inventory consumable access is time-critical. Without slots, player must open inventory menu to heal — fatal in combat. | No replacement. Quick slots are the only out-of-menu consumable interface. |
| Health Bar (Tactical only) | MUST KEEP — Tactical | Without numeric HP, Tactical players cannot make calculated retreat/heal decisions. | Immersive's diegetic feedback (breathing, posture, vignette) is the alternate channel; choosing Tactical implies the player wants numeric. |
| Ammo Counter (Tactical only) | MUST KEEP — Tactical | Low-ammo decisions (reload, switch, retreat) are constant in combat; Immersive players accept the cost of checking. | Immersive ammo check animation; chamber-click on empty in both modes. |
| Detection Meter (Tactical only) | MUST KEEP — Tactical | Tactical's primary stealth signal. Without it, Tactical loses the survival-management value-proposition. | Audio cues (tension layer, alien vocalizations) in Immersive. |
| Minimap (Tactical only) | SHOULD KEEP — Tactical | Navigation and spatial threat awareness. Tactical without minimap reduces strategic value. | Player can disable minimap entirely in HUD settings (no compass fallback — consistent with Immersive philosophy choice). |
| Heal-in-Progress Indicator | MUST KEEP — both modes | Player must know when heal will complete and whether it has been interrupted. Heal animation alone is insufficient. | Animation provides some affordance but interruption is not always visually clear. |
| Stamina Bar (Tactical only) | SHOULD KEEP — Tactical | Stamina depletion is fast and consequential; Tactical players want precise readout. | Immersive's breathing audio escalation. |
| Threat Indicators (Tactical only) | SHOULD KEEP — Tactical | Spatial awareness critical for survival. | Audio spatialization (Immersive). |
| Combat State Indicator (Tactical only) | SHOULD KEEP — Tactical | Disengagement timing is non-obvious; this indicator clarifies. | Combat music fade-out (audio cue). |
| Weapon Condition (Tactical only) | SHOULD KEEP — Tactical | Affects damage output; player needs to know when to clean/replace weapon. | Jam frequency (diegetic — but a poor signal that arrives too late). |
| Camp Threat Indicator (Tactical only) | SHOULD KEEP — Tactical | Strategic info; player may want to return to defend camp. | Minimap heatmap shows infection; player can infer. |
| Zone Name (Tactical only) | CAN HIDE — Tactical | Player typically knows where they are going; zone name is contextual. | Environmental transition is the Immersive replacement. |
| Tutorial Hints | CAN HIDE — both modes | One-time information; experienced players prefer none. | Player must learn from in-game cues. |
| Notification Toasts | CAN HIDE in high-intensity moments — both modes | Save indicator must show; HUD mode toast must show; nothing else queues during combat. | Held in queue until combat exit. |
| Nearby Source Count (Tactical only) | CAN HIDE — Tactical | Player can read source presence from environmental VFX and minimap red dots. | Minimap source dots. |
| Secondary Context Prompt | CAN HIDE — both modes | Second-priority interactable is rarely actionable. | Primary prompt still functions. |
| Crosshair | ALWAYS HIDE when not in Tactical scoped FirstPerson | Hostile World is not a shooter — third-person aiming uses over-the-shoulder camera. | Camera positioning is the aim affordance. |

---

## 7. Visual Budget

| Budget Constraint | Limit | Measurement Method | Current Estimate (designed) | Status |
|---|---|---|---|---|
| Maximum simultaneous active HUD elements — Immersive | 4 | Count all visible, non-faded elements at any one frame in Immersive mode | Typical: 2 (quick slots + 1 context prompt). Maximum: 4 (quick slots + 2 context prompts + subtitle). | Within budget. |
| Maximum simultaneous active HUD elements — Tactical | 12 | Same method | Typical: 7 (health, stamina, detection, minimap, ammo, quick slots, weapon condition). Maximum during combat: 12 (above + combat state + threat indicators + nearby source count + context prompt + subtitle). | Within budget; verify at implementation. |
| Maximum % of screen occupied by HUD — Immersive | 6% | Pixel area of all HUD elements / total screen pixels (excluding diegetic post-process vignettes which are not measured) | Typical: 3% (quick slots only). Maximum: 6% (with subtitle, context prompts, tutorial hint). | Within budget. |
| Maximum % of screen occupied by HUD — Tactical | 22% | Same method (template default of 22% for combat retained for Hostile World) | Typical: 14%. Maximum during combat with all contextual elements: 20%. | Within budget; verify at implementation. |
| Maximum % of center screen zone (30% of screen W/H) occupied | 5% | Only crosshair (when active) and heal-in-progress indicator allowed here. Context prompts sit at 15% from bottom, outside this region. | Typical: 0%. With heal indicator: 1.5%. With crosshair (scoped Tactical): 0.5%. | Within budget. |
| Minimum contrast ratio — HUD text on any background | 4.5:1 (WCAG AA) | Measured against darkest and lightest game world areas each text element overlays | All text elements have semi-transparent dark backgrounds at minimum 40% opacity to guarantee contrast — verify at implementation across infected/clean zones | To verify in implementation. |
| Maximum opacity for HUD background panels | 65% | Opacity of any panel behind HUD text — must preserve world visibility through panel | Design specifies 40–60% for all panels. | Within budget. |
| Minimum HUD element size at 1080p reference | 40px for icons, 18px for text (Tactical), 24px for subtitles | Measure at 1080p | All elements designed at or above minimum. | Within budget. |
| Maximum sustained-render cost (Tactical full HUD) | < 0.5ms per frame at 60fps (per HUD GDD Acceptance Criteria) | Profile in UMG | Pending implementation profiling. | To verify. |

How to apply these budgets: For every new HUD element proposed during production, the proposer must state (1) which budget line is affected, (2) the new total, and (3) what existing element will be reduced or made contextual to stay within budget. Tactical's 22% screen coverage is the hard ceiling. If a new Tactical element would push above 20% typical use, an existing Tactical element must be downgraded to contextual.

---

## 8. Feedback & Notification Systems

| Notification Type | Trigger System | Screen Position | Duration (ms) | Animation In / Out | Max Simultaneous | Priority | Queue Behavior | Dismissible? |
|---|---|---|---|---|---|---|---|---|
| Save Indicator | Save/Load System | Bottom-Right (preempts bottom-most slot) | 1500 (minimum perception window) | Fade in 200ms / fade out 300ms | 1 | High | Never queued; always shown immediately. Other elements yield bottom-most slot for the 1.5s window. | No — auto-dismiss |
| HUD Mode Change Toast (queued) | HUD Subsystem | Bottom-Right | 2000 | Slide in from right 300ms / fade out 400ms | 1 | High (player-feedback critical) | Not queued. | No |
| HUD Mode Change Applied (after combat) | HUD Subsystem | Bottom-Right | 1500 | Same as queued toast | 1 | Medium | Fires once when combat exits and the queued change applies. | No |
| Zone Name (Tactical) | Scene Management | Top-Center | 3000 (display) + 0.5s fade in + 0.3s fade out | Slide down from top 500ms / fade out 300ms | 1 (zone name slot is single-element) | Medium | If a second zone crossing occurs while one is visible, current zone name fades out immediately and new one fades in. | No |
| Tutorial Hint | Tutorial System | Center-Bottom (above context prompts) | Persistent until action completes or player dismisses | Fade in 300ms / fade out 200ms | 1 (queue subsequent hints) | Medium | One at a time; queue others. | Yes — bound dismiss input |
| Context Prompt (primary + secondary) | Player Controller | Center-Bottom | Persistent while interactable is in range | Fade in 200ms, slide up 10px / fade out 150ms, slide down 5px | 2 (1 primary + 1 secondary) | High (when in range) | Priority-scored per HUD GDD Formula 2; only top 2 prompts displayed | No (interaction-driven dismiss) |
| Blocked Action Prompt | Player Controller | Center-Bottom (replaces context prompt content briefly) | 1000 | Instant in, fade out 200ms | 1 | High | Replaces context prompt content for 1.0s, shows "Blocked" label in red | No |
| Heal-in-Progress Indicator | Health System | Center (near crosshair area) | Persistent during heal application | Scale up from 80% over 200ms / fade out 300ms (success) or red flash + fade 200ms (cancel) | 1 (only one heal at a time) | High | Never queued (heal is serialized by Health System) | No |
| Camp Threat Indicator | Infection Spread | Top-Left | Persistent while condition active | Fade in 400ms / fade out 400ms | 1 | Medium | Persistent state, not a queue | No |
| Critical Health Warning (audio + visual) | Health System | Vignette intensification + heartbeat audio | Persistent while HP ≤ 25 | Vignette grows over 500ms when entering Critical state | 1 (per condition) | Critical — never suppressed | Renders immediately; bypasses all queues | No (clears when HP > 25) |
| Critical Detection Warning (Tactical) | Stealth System | Detection meter pulse + audio "Detection State Change" | Per-frame during state ≥ Engaged | Pulse rate increases with state | 1 | Critical | Never queued | No |
| Subtitles | Audio System / Dialogue System | Center-Bottom (above tutorial + context) | Per line duration + 300ms | Fade in 150ms / fade out 200ms | 2 lines (single dialogue session) | Critical (accessibility) | Per-line queue; never overlap dialogue lines | No |

**Notification queue rules:**

1. **Combat-aware queue**: Non-critical notifications (HUD mode toasts, save indicator if a save fires mid-combat is the exception and always shows) are suppressed during combat. The queue is flushed in a batch when combat exits, with maximum 3 items displayed in sequence at 1.5s each.
2. **Merge rule**: Identical notification types firing within 500ms merge into one (in practice, only the heal-in-progress and save indicator are candidates; save indicators do not merge — each save is a distinct event).
3. **Critical bypass**: Save indicators, critical health warnings, critical detection warnings, and damage vignettes always render immediately regardless of queue state, combat state, or existing notifications.
4. **HUD mode change**: The "queued" toast fires immediately on options change in combat; the "applied" toast fires when combat exits. Both bypass the combat queue because they are direct player-feedback responses to a player action.

---

## 9. Platform Adaptation

| Platform | Safe Zone | Resolution Range | Input Method | HUD-Specific Notes |
|---|---|---|---|---|
| PC — Windows, 1920×1080 reference | 5% margin | 1280×720 minimum to 3840×2160 maximum | Keyboard/Mouse primary; Gamepad supported | HUD scales with screen height (not width). All input glyphs swap automatically per input device detection: keyboard glyphs (E, R, 1/2/3/4, F) vs. gamepad glyphs (A, X, D-pad directions, RB). Test at 1280×720 (minimum) — all elements must remain legible and within zone margins. |
| PC — Ultrawide 21:9 (3440×1440) and 32:9 (5120×1440) | 5% top/bottom; 8% left/right | 21:9 and 32:9 standard ultrawide | Same as standard PC | Top-Left, Top-Right, Bottom-Left, Bottom-Right zones inset further from horizontal screen edges (8%) to keep elements within the player's natural focus area. Centered elements (zone name, context prompts, quick slots, minimap, subtitles) anchor to screen center, unaffected by aspect ratio. Minimap scales by screen height only. Damage vignettes and edge flashes follow the actual screen edges (full ultrawide) — this is intentional for peripheral feedback. |
| PC — Fullscreen on TV-connected display | 5% margin (already applied for fullscreen) | Same as PC | Same | TV overscan considerations — 5% safe zone already accounts for this. |

**HUD repositionability requirement**: Players must be able to reposition the following elements using an in-game HUD layout editor (accessed from accessibility settings):

- Health bar (Tactical)
- Minimap (Tactical)
- Ammo counter (Tactical)
- Quick slots (limited to Bottom-Center anchor; allowed Y-axis adjustment ±60px and horizontal width scale 80–120%)

Repositioning saves to the player profile (not per save slot) and persists across play sessions.

---

## 10. Accessibility — HUD Specific

### 10.1 Colorblind Modes

Per HUD GDD edge case: when Deuteranopia, Protanopia, or Tritanopia colorblind modes are enabled, health bar and threat dot palettes shift, and vignette intensity is boosted by 20% to compensate for reduced color reliance. Beyond palette shifts, the following shape-encoding requirements ensure no information is conveyed by color alone.

| Element | Color-Only Information Risk | Colorblind Mode Fix |
|---|---|---|
| Health bar fill | Green/orange/red distinction | Numeric "73/100" label always visible; bar has a 25%/50%/75% segment marker (subtle vertical ticks). Vignette severity provides a luminance-based alternate channel. Color shifts: green → blue, orange → yellow, red → dark red per HUD GDD edge case. |
| Detection meter fill | Green/yellow/orange/red distinction | State label text ("Hidden / Suspicious / Alert / Engaged / Detected") is always rendered below the bar. Bar has tier-boundary tick marks at 25/50/75. Color shifts per HUD GDD colorblind mode. |
| Ammo counter | Green/orange/red on text | Numeric value is always visible — text reads "3/12 | 8" regardless of color. Bar segment markers not applicable to text. Low-ammo audio chamber-click is the audio alternate channel. |
| Threat dots (minimap + screen-edge) | Gray/yellow/orange/red distinction across alien states | **Shape encoding**: patrol = circle (●), suspicious = diamond (◆), alert = square (■), combat = triangle (▲). Color and shape together encode state. Per HUD GDD: gray → white, yellow → orange, orange → magenta, red → dark red in colorblind modes. |
| Damage vignette | Red color | Vignette intensity (luminance) carries severity, independent of hue. Hue shifts in colorblind modes are tracked by the post-process system. Reduced motion has separate setting for those who find the pulse animation problematic. |
| Infection vignette | Green color | Pulse rate carries severity, independent of hue. |
| Weapon condition icon | Green/yellow/red distinction | Icon shape encodes state: clean = solid filled circle, dirty = circle with diagonal line, damaged = circle with X mark. Color reinforces but does not solely encode. |
| Minimap icons (camp / hive / POI / cure zone) | Color-faction distinction | Distinct icon shapes per category: camp = pentagon, hive = circle with spikes, POI = star, cure zone = blue ring (shape distinct from any threat). Cardinal direction letters N/E/S/W on minimap ring assist orientation. |
| Context prompt input glyph | Could imply input device by color in some HUDs | Input glyph shape always matches the current input device; supplementary text label (e.g., "Press E" or "Press A") always rendered with the glyph. |

### 10.2 Text Scaling

The Standard WCAG AA tier requires support for text scale 100%–150%. Hostile World HUD must support this range. When the player sets text scale to 150%:

- Health bar numeric label grows with scale; bar width expands to accommodate (within Top-Left zone — verify no overlap with stamina or camp threat indicator).
- Stamina bar label (visible only at < 10%) wraps if needed (rare; "Stamina" is short).
- Detection meter state label grows with scale; the bar itself does not scale. Allow label to expand below the bar's right edge if needed without overlapping the combat state indicator.
- Zone name text grows with scale; Top-Center zone can accommodate two-line zone names at 150% (e.g., "Z03 — Resistance Camp Alpha" wraps to two lines).
- Context prompt label text grows with scale; the pill-shaped element expands horizontally up to 50% screen width before text wrapping kicks in.
- Tutorial hint text grows with scale; supports up to 3 lines at 150%.
- Subtitle text grows per dedicated subtitle scale (Section 10.4 — subtitles have their own size slider independent of general HUD scale).
- Quick slot icons (40×40px) do NOT scale — they are icons, not text. Slot number labels (1/2/3/4) do scale.

**Text scaling test matrix:**

| Element | 100% (baseline) | 125% | 150% | Overflow behavior |
|---|---|---|---|---|
| Health bar numeric label | Pass (designed) | Verify | Verify | Bar expands; must not overlap stamina bar (8px gap minimum maintained). |
| Detection state label | Pass | Verify | Verify | Label can extend past detection bar's bottom edge but must not overlap combat state indicator below. |
| Zone name | Pass | Verify | Verify | Wraps to 2 lines at 150%; Top-Center zone height accommodates 2-line zone names. |
| Context prompt label | Pass | Verify | Verify | Pill expands to 50% screen width max; text wraps if needed at 150%. |
| Notification toast (HUD mode toast) | Pass | Verify | Verify | Toast width expands up to 35% screen width; wraps after. |
| Subtitle text | Pass | Verify | Verify | Subtitles have dedicated size slider (Section 10.4); independent of general HUD text scale. |
| Tutorial hint | Pass | Verify | Verify | Supports up to 3 lines at 150% before wrapping breaks design. |

### 10.3 Motion Sensitivity

| Animation / Motion Element | Severity | Disabled by Reduced Motion Setting? | Replacement Behavior |
|---|---|---|---|
| Health bar fill lerp (200ms on change) | Mild | No (lerp is short and not directional) | Lerp retained; not problematic. |
| Health bar low-HP pulse (1 Hz) | Mild | Yes | Solid red fill at full saturation; no pulse. Vignette remains. |
| Damage direction screen-edge flash (0.1s) | Moderate (directional, high contrast) | Yes | Replace with static darkened band on the damage side at 30% opacity for 0.5s. |
| Damage vignette pulse on subsequent hits (stacking) | Moderate | Yes — partial | Vignette retained (severity-critical) but stacking pulse reduced to single intensity raise without animation. |
| Detection meter pulse (0.5–2 Hz per tier) | Mild | Yes | Solid fill at full saturation; no pulse. State label text color shift remains. |
| Threat dot pulse on combat-state aliens (2 Hz) | Mild | Yes | Static red dot, no pulse. |
| Loading screen heartbeat pulse | Moderate (rhythmic, can affect photosensitive players) | Yes | Static breathing icon, no pulse animation. Progress bar still fills. |
| Notification toast slide-in | Mild | Yes | Instant appear at final position. |
| Zone name slide-down (8px) | Mild | Yes | Instant appear at final position with fade-in only. |
| Crosshair spread expansion/contraction animation | Mild | Yes — option | Optional "Static crosshair" toggle freezes the crosshair at base spread regardless of weapon spread. |
| Quick slot use highlight (200ms single pulse) | Mild | Yes | Instant color change without pulse. |
| Death screen fade and red vignette | High | Yes | Death screen fades in faster (instant + 200ms color fade) with no vignette animation. |
| HUD mode change toast slide-in | Mild | Yes | Instant appear. |

### 10.4 Subtitles Specification

- **Default setting**: ON. Hostile World defaults subtitles to ON per industry standard for premium narrative games (Witcher 3, Horizon Zero Dawn convention) and Standard WCAG AA tier.
- **Position**: Center-Bottom zone, centered horizontally, anchored 15% from bottom edge (above the bottom safe zone margin). Above tutorial hints and context prompts when those are also active.
- **Max characters per line**: 42 characters. Lines break at natural language pause points: before conjunctions, after commas, never mid-word.
- **Max simultaneous lines**: 2 lines on screen at once. Subsequent dialogue text replaces the oldest line (FIFO).
- **Speaker identification**: Speaker name rendered in front of dialogue text, separated by colon and a space. Format: `ARIA: The door is locked.` Speaker name is rendered in a distinguishable color per speaker (a small palette of 4–6 colors assigned to recurring speakers) AND with a colon prefix — so colorblind players still parse who speaks by reading text structure. Anonymous speakers use generic labels: `RESISTANCE FIGHTER:`, `ALIEN VOCALIZATION:`.
- **Background**: Semi-transparent black panel at 70% opacity, with 8px padding around text, behind all subtitle text. Ensures 4.5:1 contrast on any game world background.
- **Font size minimum**: 24px at 1080p reference. Scales with dedicated subtitle scale setting (75% / 100% / 125% / 150%).
- **Line break behavior**: Natural language pause points. Implementation breaks at: end of sentence, after comma, before conjunctions (and, but, or, because), before relative pronouns (which, that, who). Never break mid-word.
- **Subtitle persistence**: Each subtitle line persists for the spoken line duration plus 300ms after audio ends. Never disappears while audio is still playing.
- **Non-dialogue captions**: Critical environmental sound effects are captioned per accessibility tier. Format: `[ALIEN HIVE EMERGING IN THE DISTANCE]`, `[HEAVY BREATHING]`, `[SUPPRESSANT HUM]`. Bold and uppercase to distinguish from dialogue. Same position as subtitles. Player can disable non-dialogue captions independently of dialogue subtitles via "Caption ambient sounds: On/Off" setting.

### 10.5 HUD Opacity and Visibility Controls

The following player-adjustable settings are available from the Accessibility menu:

| Setting | Range | Default | Effect |
|---|---|---|---|
| HUD Opacity — Global | 0% (HUD hidden) to 100% | 100% | Scales all HUD element opacities simultaneously. Does not affect damage vignettes (those are gameplay-critical and have a separate minimum). |
| Damage Vignette Opacity Minimum | 30% to 100% | 100% | Prevents the global HUD opacity from reducing damage feedback below readable severity. |
| HUD Text Scale | 75% to 150% | 100% | Scales all HUD text elements; layout adapts per Section 10.2. |
| Subtitle Text Scale | 75% to 150% | 100% | Independent of HUD text scale; subtitles can be larger than HUD without affecting layout. |
| Caption Ambient Sounds | On / Off | On | Toggles non-dialogue critical sound captions. |
| Minimap Visibility | On / Off | On | Tactical-only setting. No compass fallback when Off — player accepts no map. |
| Tactical Threat Indicator Style | Minimap + Edge / Minimap Only / Edge Only / Off | Minimap + Edge | Tactical-only. |
| Notification Verbosity | All / Important Only / Off | All | All = all toasts including HUD mode toasts and save indicator. Important Only = save indicator + critical warnings only. Off = save indicator + critical warnings only (save indicator cannot be disabled). |
| Tutorial Verbosity | All / Important Only / Off | All | All = all tutorial hints. Important Only = mechanic-critical hints only. Off = no tutorials. |
| Reduced Motion | On / Off | Off | When On, replaces all HUD animations listed in Section 10.3 with instant state changes or static replacements. |
| High Contrast Mode | On / Off | Off | When On, all HUD panel backgrounds increase opacity to 80%, all text gains a 1px black outline for legibility against any background, and all colors shift to higher-saturation values. |
| Colorblind Mode | Off / Deuteranopia / Protanopia / Tritanopia | Off | When set, applies per-mode palette shifts per HUD GDD edge case + 20% vignette intensity boost. |
| Static Crosshair | On / Off | Off | When On, crosshair does not animate with weapon spread; remains at base size. |
| Enlarged Crosshair | On / Off | Off | When On, crosshair diameter doubles to 24px. |
| Always Show Stamina Bar | On / Off | Off | When On, stamina bar is persistent in Tactical regardless of value. |
| HUD Mode | Immersive / Tactical | Immersive | Changes apply when next non-combat state is reached (per HUD GDD Rule 1). |

---

## 11. Tuning Knobs

| Parameter | Current Value | Range | Effect of Increase | Effect of Decrease | Player Adjustable? | Notes |
|---|---|---|---|---|---|---|
| `VignetteMaxOpacity` | 0.6 | 0.3–0.8 | More dramatic damage feedback | Subtle, may be missed | Indirectly via colorblind mode (boost +0.2) | Per HUD GDD tuning knob. |
| `VignetteFadeTime` | 3.0s | 1.0–5.0s | Damage feedback lingers longer | Quick recovery, less tension | No | Per HUD GDD. |
| `DamageFlashDuration` | 0.1s | 0.05–0.3s | More visible directional flash | Barely perceptible | No (replaced by static dark band in reduced motion) | Per HUD GDD. |
| `ContextPromptFadeIn` | 0.2s | 0.1–0.5s | Smoother prompt appearance | Snappy, may feel jarring | No | Per HUD GDD. |
| `ContextPromptFadeOut` | 0.15s | 0.1–0.3s | Smoother prompt disappearance | Snappy removal | No | Per HUD GDD. |
| `ContextPromptMaxRange` | 500cm | 300–800cm | Prompts show from farther | Must be very close to interactable | No | Per HUD GDD. |
| `MinimapRadius` | 5000cm (world units) | 3000–8000cm | More area visible on minimap | Less situational awareness | Yes — Small/Medium/Large preset | Player-exposed as S/M/L not raw value. |
| `MinimapSizePx` | 270px diameter at 1080p | 200–340px | Larger minimap on screen | Smaller minimap on screen | Yes — S/M/L preset | Three sizes exposed: S=200px, M=270px (default), L=340px. |
| `MinimapThreatUpdateRate` | 0.5s | 0.25–2.0s | More responsive threat dots | Laggy threat info | No | Per HUD GDD. |
| `MinimapInfectionUpdateRate` | 10s | 5–30s | More responsive infection heatmap | Stale infection data | No | Per HUD GDD; matches infection tick. |
| `ZoneNameDisplayDuration` | 3.0s | 1.0–5.0s | Zone name visible longer | May miss zone name | No | Per HUD GDD. |
| `ThreatDotMinOpacity` | 0.1 | 0.05–0.3 | Edge threats more visible | Edge threats barely visible | No | Per HUD GDD. |
| `ThreatDotFadeCoefficient` | 0.8 | 0.5–1.0 | Threats fade faster at edge | Threats visible at edge longer | No | Per HUD GDD. |
| `HealthBarGreenThreshold` | 51 | 40–70 | Green zone larger | Green zone smaller, more tension | No | Per HUD GDD. |
| `HealthBarOrangeThreshold` | 26 | 15–40 | Orange zone larger | Red zone larger, more urgency | No | Per HUD GDD. |
| `DetectionMeterUpdateRate` | 0.25s | 0.1–1.0s | Smoother detection bar | Less responsive | No | Per HUD GDD. |
| `LowAmmoPulseThreshold` | 0.20 (20% of magazine) | 0.10–0.40 | Pulse warning fires earlier | Late warning | No | Triggers low-ammo single chamber-click and pulse. |
| `StaminaAutoHideDelay` | 3.0s | 1.0–10.0s | Bar persists longer after returning to full | Bar disappears faster | Yes — via "Always show stamina bar" toggle (binary) | Indirect player control. |
| `CampThreatPollRate` | 30s | 10–120s | More responsive camp warning | Stale camp warning | No | Per HUD GDD. |
| `CampThreatActivationLevel` | 25 | 15–50 | Warning fires earlier (lower infection threshold) | Warning fires later | No | Matches infection state thresholds. |
| `SaveIndicatorMinDuration` | 1500ms | 800–3000ms | Save toast persists longer | Quick dismiss, may be missed | No | Player perception window. |
| `HUDModeChangeToastDuration` | 2000ms | 1000–4000ms | Toast persists longer | Quick dismiss | No | Player feedback. |
| `TutorialHintFadeIn` | 300ms | 100–600ms | Smoother tutorial appearance | Snappier | No | — |
| `TutorialQueueMaxSize` | 5 | 3–10 | More tutorials queued | Older tutorials dropped | No | — |
| `HealIndicatorRingScale` | 1.0 (48px) | 0.5–2.0 | Larger heal indicator | Smaller, less obtrusive | No | — |
| `SubtitleMaxLines` | 2 | 1–3 | More subtitle history visible | Single-line subtitles only | No | Per Section 10.4. |
| `SubtitleHoldAfterAudio` | 300ms | 100–1000ms | Subtitles persist after audio ends | Subtitles cut closer to audio end | No | Accessibility. |
| `GlobalHUDOpacity` | 100% | 0–100% | Fully visible | Fully hidden | Yes — slider in Accessibility | Per Section 10.5. |
| `DamageVignetteOpacityFloor` | 100% | 30–100% | Vignette stays bright even with global opacity reduction | Allows full HUD hide | Yes — Damage Vignette Opacity Minimum slider | Prevents accidental loss of survival-critical feedback. |
| `HUDTextScale` | 100% | 75–150% | Larger text | Smaller text | Yes — slider in Accessibility | Per Section 10.2. |
| `SubtitleTextScale` | 100% | 75–150% | Larger subtitles | Smaller subtitles | Yes — dedicated slider | Independent of HUD text scale. |
| `ReducedMotion` | Off | On / Off | Disables HUD animations per Section 10.3 | Animations active | Yes — toggle | Per Section 10.3. |
| `HighContrastMode` | Off | On / Off | Higher contrast HUD | Default contrast | Yes — toggle | Per Section 10.5. |
| `ColorblindMode` | Off | Off / Deuteranopia / Protanopia / Tritanopia | Palette shifts | Default palette | Yes — preset | Per Section 10.1 and HUD GDD edge case. |
| `HUDModeSetting` | Immersive | Immersive / Tactical | Tactical HUD active | Immersive HUD active | Yes — toggle | Change queued per HUD GDD Rule 1. |
| `NotificationVerbosity` | All | All / Important Only / Off | Fewer notifications | More notifications | Yes — preset | Per Section 10.5. |
| `TutorialVerbosity` | All | All / Important Only / Off | Fewer tutorials | More tutorials | Yes — preset | Per Section 10.5. |
| `MinimapVisibility` | On (Tactical) | On / Off | Minimap hidden | Minimap shown | Yes — toggle | Tactical-only. |
| `ThreatIndicatorStyle` | Minimap + Edge | Multiple modes | Different threat surfacing | — | Yes — preset | Per Section 10.5. |

---

## 12. Acceptance Criteria

**Layout & Visibility**

- [ ] All HUD elements are within the 5% safe zone margin on PC fullscreen.
- [ ] On ultrawide 21:9 and 32:9, all anchor-edge elements respect the 8% horizontal inset.
- [ ] No two HUD elements overlap in any documented gameplay context in Section 5.
- [ ] Immersive HUD occupies less than 6% of screen area at typical state, less than 8% during context-prompt-heavy moments.
- [ ] Tactical HUD occupies less than 14% of screen area in non-combat, less than 22% in combat with all contextual elements active.
- [ ] No HUD element occupies the center 30% of screen in third-person view during exploration. The only center-zone elements are the heal-in-progress indicator (transient) and the crosshair (Tactical scoped FirstPerson only).
- [ ] All HUD elements are visible and legible at 1280×720 minimum resolution.
- [ ] All HUD elements render correctly at 4K (3840×2160) without aliasing or layout breakage.

**Per-Context Correctness**

- [ ] In Immersive mode default state, only quick slots and (when applicable) subtitles render. Health bar, ammo counter, minimap, detection meter, stamina bar, weapon condition, threat indicators, zone name, combat state indicator, nearby source count, and camp threat indicator all hidden.
- [ ] In Tactical mode default state, health bar, detection meter (Hidden state at green), minimap, quick slots all render. Stamina bar, ammo counter (when weapon equipped), and other contextual elements render per their visibility rules.
- [ ] Entering combat (detection = 100) in Tactical: combat state indicator fades in over 300ms with "In Combat" red text. Threat direction indicators activate. Notification toast queue pauses.
- [ ] Exiting combat (disengage timer complete) in Tactical: combat state indicator transitions to "Disengaging" orange, then fades to hidden when state becomes "Clear." Queued notifications flush in sequence.
- [ ] Entering FirstPerson scoped in Tactical: all HUD elements hide except crosshair and minimal ammo counter (magazine-only "3/12" format).
- [ ] Entering FirstPerson scoped in Immersive: all HUD elements hide (full tunnel vision).
- [ ] Entering Cinematic camera state: all HUD elements fade out over 400ms, leaving only subtitles.
- [ ] Pause menu open: all HUD elements fade to 0 over 150ms; on close, HUD fades back in over 150ms.
- [ ] Death state: death screen fades in over 2.0s; all gameplay HUD elements fade out over 600ms in parallel.
- [ ] Loading state: loading screen overlay (heartbeat pulse, zone name, progress bar, tip text) fades in over 800ms.
- [ ] Player changes HUD mode in options during combat: queued toast fires within 100ms; HUD does not change mode until combat exits. On combat exit, mode swaps and "HUD mode changed" confirmation toast fires.

**Accessibility**

- [ ] All HUD text elements meet 4.5:1 contrast ratio against darkest and lightest game world areas verified at implementation across clean and infected zones.
- [ ] No HUD element uses color as the sole information channel. Verify by simulated removal of color from each element: health bar still readable via numeric label, detection meter still readable via state text label, threat dots still readable via shape encoding (Section 10.1), weapon condition still readable via icon shape, damage severity still readable via vignette intensity.
- [ ] Subtitles render for all voiced lines and critical SFX when subtitle setting is ON.
- [ ] Subtitles never disappear while audio is still playing (verified by holding subtitle for line duration + 300ms post-audio).
- [ ] Reduced Motion setting disables all animations listed in Section 10.3 and replaces them with the specified static alternatives.
- [ ] Text Scale at 150% does not cause any HUD text to overflow its container or overlap another element. Verify all elements in the Section 10.2 test matrix.
- [ ] All player-adjustable HUD settings in Section 10.5 are functional and persist between sessions.
- [ ] Colorblind mode (each of Deuteranopia, Protanopia, Tritanopia) applies correct palette shifts to health bar, detection meter, ammo counter, threat dots, and weapon condition icons. Vignette intensity boost of 20% verified.
- [ ] High Contrast Mode increases HUD panel opacity to 80% and adds 1px text outlines.

**Notifications**

- [ ] Save indicator fires within 200ms of save event and persists for minimum 1.5s.
- [ ] HUD mode change toast fires immediately on options change during combat and again on combat exit.
- [ ] Tutorial hints display one at a time; subsequent hints queue and display after current is dismissed or completed.
- [ ] Critical warnings (damage vignette, critical detection meter pulse) render immediately regardless of queue state or combat state.
- [ ] Context prompts respect priority order per HUD GDD Formula 2; quest-critical interactables preempt combat / survival / exploration / ambient prompts.
- [ ] No more than 1 primary + 1 secondary context prompt visible simultaneously.
- [ ] On interactable destruction while prompt is visible: prompt fades out over 0.15s; if secondary exists, it promotes to primary with a 200ms cross-fade.

**Platform**

- [ ] All elements respect 5% safe zone margins on PC fullscreen 1080p reference.
- [ ] Ultrawide 21:9 and 32:9 layouts apply 8% horizontal inset; verified on 3440×1440 and 5120×1440 reference resolutions.
- [ ] HUD displays correctly at 1280×720 (minimum) with no element clipping, overlap, or unreadable text.
- [ ] Input glyphs in context prompts swap automatically per detected input device (keyboard/mouse vs. gamepad).
- [ ] Gamepad D-pad bindings (L/R/D/U) display correctly on quick slots when gamepad is detected; numeric 1/2/3/4 displays when keyboard is detected.
- [ ] HUD repositionable elements (health bar, minimap, ammo counter, quick slots) reposition correctly via accessibility HUD layout editor; saves persist to player profile.

**GDD Compliance**

- [ ] Health bar color transitions match Formula 4 (HUD GDD): green > 50 HP, orange 26–50 HP, red ≤ 25 HP, with 5-pixel linear interpolation at boundaries.
- [ ] Damage vignette intensity calculation matches Formula 1 (HUD GDD): V_initial = clamp(damage/100, 0, 0.6), exponential decay over 3.0s, additive stacking up to 0.6.
- [ ] Context prompt priority calculation matches Formula 2 (HUD GDD): weighted scoring with W_quest=10.0, W_combat=5.0, W_survival=3.0, W_distance=2.0, W_los=1.0.
- [ ] Threat dot opacity calculation matches Formula 3 (HUD GDD): A_dot = clamp(1.0 - (d / 5000) × 0.8, 0.1, 1.0).
- [ ] Detection meter state labels match Stealth GDD Rule 1: "Hidden / Suspicious / Alert / Engaged / Detected."
- [ ] Ammo counter format "Magazine / Capacity | Reserve" matches HUD GDD Rule 4 ("3/12 | 8").
- [ ] Zone name fade timing matches HUD GDD Rule 4: 0.5s fade in, 3.0s hold, 0.3s fade out.
- [ ] HUD mode change queue behavior matches HUD GDD Rule 1: change waits until combat ends.
- [ ] Death screen displays "You Died" and "Killed by: [cause]" per HUD GDD OQ-1 resolution.

**Performance**

- [ ] Tactical HUD with all elements active renders in less than 0.5ms per frame at 60fps (per HUD GDD performance acceptance criteria).
- [ ] Minimap rendering with 10 threat dots active renders in less than 0.2ms per update at 0.5s update rate.

---

## 13. Open Questions

| Question | Owner | Deadline | Resolution |
|---|---|---|---|
| Should the full-screen map (deferred to Vertical Slice — Map System) inherit the minimap's threat dot shape encoding and color palette, or define its own visual language? | ux-lead + map-system-designer | Vertical Slice Map System design | Pending — defer to Map System GDD authoring. Recommend inheriting minimap conventions for consistency. |
| Should the heal-in-progress indicator support cancel feedback intensity scaling — i.e., a "near miss" feeling when heal is interrupted at 90% complete vs. 20% complete? | ux-lead | Playtest of healing mechanics | Pending — playtest will determine whether players need granular interruption feedback or whether the current red flash + fade is sufficient. |
| Should quick slot 4 be reserved for a specific item type (e.g., always cure devices), or remain fully customizable? | game-designer | Inventory System UX spec | Pending — affects player decision freedom vs. accidental misuse of scarce cures. Recommend fully customizable, accept the cost. |
| Should the screen-edge damage flash hue (bone white for physical, green for infection) extend to a third color for fall damage (currently identical to physical per Health GDD)? | game-designer | Playtest | Pending — Health GDD specifies "white flash + brief screen shake" for fall damage. UX recommendation: keep current treatment; fall damage is distinguishable by the screen shake without a hue change. |
| Should the HUD mode change toast also fire when the player successfully changes mode out of combat (a fast confirmation), or only when a change is queued? | ux-lead | Implementation | Recommend yes — fire a brief 1.0s "HUD mode: Tactical" / "HUD mode: Immersive" toast on every successful mode change to confirm the change. Removes ambiguity. Pending confirmation. |
