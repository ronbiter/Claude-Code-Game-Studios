# Physics System

> **Status**: Designed (pending design-review)
> **Author**: user + agents
> **Last Updated**: 26 April 2026
> **Implements Pillar**: Foundation — enables all gameplay pillars

## Overview

The Physics System is the foundational infrastructure layer that governs how objects move, collide, and interact within Hostile World. It is built on Unreal Engine 5.7's Chaos Physics framework and encompasses collision detection, rigid body dynamics, character movement, raycasting, and environmental interaction. The system provides the mathematical and physical rules that make the world feel real — every footstep, every gunshot impact, every object push, every fall damage flows through this system.

There is no existing ADR for the Physics System — this GDD establishes the design decisions; implementation patterns (Chaos vs. legacy, collision channel strategy, CharacterMovementComponent usage) will be documented in the accompanying ADR.

**Key design decisions:**
1. **Chaos Physics** — use UE 5.7's Chaos Physics (not legacy PhysX)
2. **CharacterMovementComponent** — use built-in component for player movement; extend but don't replace
3. **Custom collision channels** — define Hostile World-specific channels (Alien, Infection, Player, WorldObject, Vehicle)
4. **Raycasting-first detection** — use line traces for weapon hits, interaction checks, AI perception rather than relying solely on overlap events
5. **Physical Materials** — define per-surface friction/restitution for snow, ice, metal, concrete, alien biomass

## Player Fantasy

The Physics System has no player-facing interface — players never interact with it directly. What they experience instead is the weight of their gear, the crunch of snow under boots, the recoil of a rifle, the momentum of a slide, the thud of a body hitting the ground. When physics feels right, the world feels real. When it fails, players say things like "this game feels floaty" or "why did I get stuck on that rock?" — never naming the Physics System, but feeling every one of its decisions.

The player fantasy is **consequential physicality** — every action has mass, every surface has feel, every collision has weight. The mercenary moves like a 90kg soldier in full tactical gear, not a 70kg sprinter. Snow slows. Ice slides. Metal clangs. Alien biomass is soft and yields. The physics is the language the world uses to resist or yield to the player.

## Detailed Design

### Core Rules

**Player Physics:**
- **Mass**: Player fixed at 90kg. Affects momentum during collisions, push force, fall damage.
- **Movement**: Ground acceleration 2048 cm/s², max walk speed 600 cm/s, sprint 900 cm/s, braking deceleration 4000 cm/s².
- **Gravity**: Global multiplier 1.0 (realistic). Custom gravity zones possible (alien artifacts: 0.3x gravity).

**Ground Detection:**
- Line trace downward from pelvis, 150cm trace length.
- Surface type classified per-frame via Physical Material.
- Transition triggers immediate movement parameter recalculation.

**Fall Damage:**
- Safe fall velocity: 800 cm/s (~8 m/s).
- `FallDamage = max(0, (Velocity − 800) × 0.15)` — damage per cm/s over threshold.
- 800-1200 cm/s: 0-60 damage (minor injury).
- 1200-1800 cm/s: 60-150 damage (severe injury).
- 1800+ cm/s: 150+ damage (lethal, potential instant death below 2200 cm/s).
- Landing in crouch or roll reduces damage by 50%.

**Ragdoll:**
- On death: blend from animation to full ragdoll over 0.3s.
- Ragdoll persists until state clears (respawn or cleanup).

**Object Physics:**
- **Light** (dust, debris, empty cans): player pushes with movement input.
- **Medium** (chairs, small tables, crates): player can move but it resists.
- **Heavy** (locked doors, vehicles): cannot be moved by player; require interaction or key.

### Collision Architecture

**Custom Collision Channels:**

| Channel | Object Type | Default Response |
|---------|------------|-----------------|
| ECC_Player | Player character | — |
| ECC_Alien | Alien enemies | Block |
| ECC_Infection | Infection zones, alien biomass | Overlap |
| ECC_WorldObject | Static/dynamic world objects | Block |
| ECC_Vehicle | Vehicles, mounts | Block |
| ECC_Projectile | Bullets, thrown objects | Overlap |
| ECC_Interactable | Interactable objects, NPCs | Overlap |
| ECC_AIPerception | AI sight/hearing triggers | Overlap |

**Collision Matrix (key responses):**

| | Player | Alien | Infection | WorldObject | Projectile | Interactable |
|--|--------|-------|-----------|-------------|-----------|-------------|
| **Player** | — | Block | Overlap | Block | Overlap | Overlap |
| **Alien** | Block | — | Ignore | Overlap | Overlap | Overlap |
| **Infection** | Overlap | Ignore | — | Overlap | Ignore | Ignore |
| **Projectile** | Overlap | Overlap | Ignore | Block | — | Ignore |
| **Interactable** | Overlap | Overlap | Ignore | Block | Ignore | — |

**Rationale**: Player vs. Alien = Block (physical contact). Player vs. Infection = Overlap (triggers infection check, not physical stop). Alien vs. Infection = Ignore (aliens are immune). Projectile vs. WorldObject = Block (hits walls). Projectile vs. Infection = Ignore (bullets pass through biomass).

**Physical Materials:**

| Surface | Friction | Restitution | Notes |
|---------|----------|-------------|-------|
| Snow | 0.6 | 0.0 | High friction, no bounce. Movement speed penalty 10%. |
| Ice | 0.15 | 0.05 | Very slippery. Player slides. Sprint reduced 30%. |
| Metal | 0.5 | 0.3 | Footstep audio: metallic clang. |
| Concrete | 0.7 | 0.0 | Standard friction. No bounce. |
| Alien Biomass | 0.4 | 0.5 | Soft, slightly bouncy. Player slows 20%, slight sink. |
| Wood | 0.55 | 0.1 | Standard. Footstep audio: creak. |
| Glass | 0.3 | 0.4 | Breaks on impact above threshold force. Shatters via Chaos Destruction. |

### Raycasting Strategy

| Use Case | Method | Justification |
|----------|--------|---------------|
| **Weapon hit detection** | Line trace (single) | Precise impact point, no false overlaps, predictable hit detection |
| **AI perception** | Multi-trace + overlap cone | Cover-aware sight, overlap catches flanking sounds |
| **Interaction checks** | Line trace (short range) | Context-sensitive (E key), not continuous |
| **Grapple hook / zipline** | Line trace + sweep | Validates attachment, detects obstacles |
| **Landing detection** | Sweep (sphere) | Catches ground before full penetration |

**Raycast configuration**: All gameplay traces use `ECC_Visibility` channel. AI perception traces use `ECC_Alien` channel to align with alien sight.

### Interactions with Other Systems

| System | Direction | Data Flow |
|--------|-----------|-----------|
| Input System | Reads physics | Physics provides ground surface type to Input System for footstep audio routing |
| Camera System | Reads physics | Physics impact forces trigger camera shake events |
| Movement System | Reads physics | Ground detection, surface friction, slope angle affect movement parameters |
| Combat System | Reads + writes | Uses raycasting for hit detection; applies physics forces on impact |
| Health System | Reads physics | Fall damage calculation from velocity on ground impact |
| Alien AI System | Reads physics | Navigation meshes respect physics obstacles; perception uses physics traces |
| Infection Spread System | Reads physics | Physics zones (custom gravity, friction changes) affect infection spread |
| HUD System | Reads physics | Shows surface type indicator (immersive mode), fall damage warning |



## Formulas

**Formula 1 — Fall Damage**

`FallDamage = max(0, (ImpactVelocity − 800) × 0.15)`

**Variables:**

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| ImpactVelocity | V | float | 0–3000 cm/s | Velocity magnitude at ground contact |
| SafeFallVelocity | V_s | const | 800 cm/s | Threshold below which no damage occurs |
| DamageCoefficient | D_c | const | 0.15 | Damage per cm/s over threshold |

**Output Range:** 0 (V ≤ 800) to 330+ (V = 3000, extreme fall). Normal falls: 0–150.
**Example:** V = 1200 cm/s → max(0, (1200 − 800) × 0.15) = 60 damage.

---

**Formula 2 — Surface Movement Speed Multiplier**

`SurfaceSpeedMultiplier = 1.0 − FrictionPenalty + SlideBonus`

**Variables:**

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| FrictionPenalty | F_p | float | 0.0–0.3 | Penalty from surface friction (Snow=0.1, Ice=0.3) |
| SlideBonus | S_b | float | 0.0–0.2 | Speed bonus on very low friction (Ice=0.2) |

**Output Range:** 0.7 (Ice, friction penalty dominates) to 1.2 (slick surface with slide bonus). Normal: 0.9–1.0.
**Example:** Snow (Friction=0.6 → FrictionPenalty=0.1): 1.0 − 0.1 + 0 = 0.9× speed.

---

**Formula 3 — Push Force**

`PushForce = (PlayerMass × Acceleration) / TargetMass`

**Variables:**

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| PlayerMass | M_p | const | 90 kg | Player mass (fixed) |
| Acceleration | A | float | 500–2000 cm/s² | Movement acceleration when pushing |
| TargetMass | M_t | float | 1–500 kg | Mass of pushed object |

**Output Range:** 90–180000+ (very light objects fly, heavy objects resist). Normal push: 180–900.
**Example:** Push medium crate (M_t=30kg) with A=500: (90 × 500) / 30 = 1500 push force.

---

**Formula 4 — Ragdoll Blend Weight**

`BlendWeight = clamp(t / 0.3, 0.0, 1.0)` where t = time since death.

**Variables:**

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| t | t | float | 0.0–1.0s | Time since death event |
| BlendDuration | B_d | const | 0.3s | Blend from animation to ragdoll |

**Output Range:** 0.0 (alive, full animation) to 1.0 (0.3s after death, full ragdoll).

## Edge Cases

**If Player falls at 1200 cm/s onto a 45° snow slope (triangle mesh):** Fall damage uses velocity projected onto surface normal: 1200 × cos(45°) ≈ 848.5 cm/s → damage = max(0, (848.5 − 800) × 0.15) ≈ 7.28 HP, not 60 HP. Slope alters effective impact speed.

**If Player falls at 900 cm/s toward a vertically ascending platform moving at 200 cm/s, with frame rate drop to 15 FPS:** Player clips through platform (no collision detected), no fall damage applied, player enters free fall again until hitting static surface. Temporal aliasing — fast-moving platforms + low FPS cause missed collision frames.

**If Player sprints at 600 cm/s from snow (friction 0.6) onto ice (friction 0.15) mid-stride:** Sprint speed immediately drops to 600 × 0.7 = 420 cm/s, friction changes to 0.15 causing a 0.5s slide until friction decelerates player to ice's base walking speed. Surface change applies instantly with no blend.

**If Player falls at 1500 cm/s and activates crouch 0.1s before impact:** Unmodified damage = (1500 − 800) × 0.15 = 105 HP; crouch reduces final damage to ceil(105 × 0.5) = 53 HP. Damage reduction applies post-formula based on state at exact impact frame.

**If Player dies, ragdoll blends 0.3s, and ragdoll overlaps ECC_Infection during the blend window:** Infection zone applies damage for 0.3s but no HP loss (player is dead); ragdoll physics continue unaffected (ECC_Infection = Overlap only, doesn't block).

**If Player pushes a Light object (mass 60kg) into a static Concrete wall:** Light object stops moving, player enters 0.5s "push blocked" cooldown where push input is ignored to prevent physics jitter. ECC_World blocks movement.

**If Player is standing on Glass when it shatters (>5000 impulse impact):** Glass shatters instantly, deleting its collision mesh; player loses ground contact immediately, enters free fall, triggers fall damage from Glass surface height.

**If Player has left foot on Snow (0.6) and right foot on Metal (0.5) in same frame:** Surface friction averaged to (0.6 + 0.5)/2 = 0.55 for that frame; conflicting speed modifiers skipped (no defined behavior for dual surfaces).

**If projectile travels through ECC_Infection zone:** Projectile passes through with no collision registered, continues flight. ECC_Projectile = Ignore vs ECC_Infection per collision matrix.

**If Player falls at 2500 cm/s (extreme velocity):** FallDamage = max(0, (2500 − 800) × 0.15) = 255 HP. Formula has no upper clamp — damage scales linearly. **Intentionally uncapped**: all falls above ~1467 cm/s are instantly lethal (damage > 100 HP, exceeds max player HP). This is by design — extreme falls should always kill.

## Dependencies

**Hard Dependencies** (system cannot function without):
- **Input System** ✅ (designed) — provides input actions for movement, crouch, jump, and interaction that drive physics-based movement and object interaction.

**Soft Dependencies** (enhanced by physics but works without):
- **Game State Machine** ✅ (designed) — physics respects game state (e.g., ragdoll only in Playing state; no physics during Cutscene).

**Depended On By** (key downstream systems that read physics state):

| System | Interface Used | Expected Behavior |
|--------|---------------|-------------------|
| Camera System | `OnImpact(Force)` | Physics impacts trigger camera shake events |
| Movement System | `GetSurfaceType()`, `GetGroundVelocity()` | Uses surface friction, slope angle to calculate movement parameters |
| Combat System | `LineTraceSingle()`, `AddImpulse()` | Uses raycasting for weapon hits; applies impact forces on enemies |
| Health System | `OnLanded(Velocity)` | Receives landing velocity for fall damage calculation |
| Alien AI System | `TraceMulti()`, `ECC_AIPerception` | Uses perception traces, respects physics obstacles in navigation |
| Infection Spread System | `GetGravityMultiplier()`, `GetSurfaceType()` | Reads custom gravity zones and surface types for infection mechanics |
| HUD System | `GetSurfaceType()`, `GetFallDamageWarning()` | Shows current surface indicator (immersive mode), fall damage warning |
| Scene Management | `OnObjectDestroyed()` | Receives break events (Glass shatter) for scene state updates |

**Interface Contract:**

```cpp
// Physics System public interface (C++ sketch)
class IPhysicsSystem {
    // Surface queries
    EHostileSurfaceType GetSurfaceType(FVector Location);
    float GetSurfaceFriction(EHostileSurfaceType SurfaceType);
    float GetSurfaceRestitution(EHostileSurfaceType SurfaceType);

    // Movement physics
    float GetModifiedSpeed(float BaseSpeed, EHostileSurfaceType SurfaceType);
    bool IsOnSteepSlope(FVector Location, float MaxSlopeDeg=45.0f);

    // Damage
    float CalculateFallDamage(float ImpactVelocity);
    bool IsSafeFall(float Velocity);

    // Raycasting
    bool LineTrace(FVector Start, FVector End, ECollisionChannel Channel, FHitResult& OutHit);
    bool MultiTrace(FVector Start, FVector End, ECollisionChannel Channel, TArray<FHitResult>& OutHits);

    // Object physics
    float GetPushForce(float TargetMass);
    bool CanPushObject(float TargetMass, float TargetType);

    // Events
    FDelegateHandle SubscribeToImpact(FImpactDelegate Callback);
    FDelegateHandle SubscribeToLanding(FLandingDelegate Callback);
    void Unsubscribe(FDelegateHandle Handle);
}
```

## Tuning Knobs

| Knob | Type | Default | Range | Effect if too high | Effect if too low |
|------|------|---------|-------|-------------------|-------------------|
| `MaxWalkSpeed` | float | 600 cm/s | 300–1200 | Player feels too fast, physics collision jitter | Player feels sluggish, slow pacing |
| `SprintSpeed` | float | 900 cm/s | 500–1500 | Hard to control collisions, slide too far | Sprint doesn't feel meaningfully faster |
| `GroundAcceleration` | float | 2048 cm/s² | 500–5000 | Instant stops/starts feel jerky | Slow acceleration feels unresponsive |
| `BrakingDeceleration` | float | 4000 cm/s² | 1000–10000 | Immediate stops feel unnatural | Long slide before stopping |
| `SafeFallVelocity` | float | 800 cm/s | 400–1500 | Fall damage almost never triggers | Death from very short falls |
| `FallDamageCoefficient` | float | 0.15 | 0.05–0.5 | Falls become one-shot kills | Fall damage feels meaningless |
| `GravityMultiplier` | float | 1.0 | 0.3–3.0 | Harder to jump, faster falls = more damage | Low gravity feels floaty, unrealistic |
| `PushForceCap` | float | 5000 | 1000–20000 | Light objects fly at dangerous speeds | Can't push medium objects |
| `RagdollBlendDuration` | float | 0.3s | 0.1–1.0 | Long uncanny overlap between animation and ragdoll | Snap transition looks jarring |
| `SurfaceFrictionPenalty_Snow` | float | 0.1 | 0.0–0.5 | Snow feels like mud, player stuck | Snow feels no different from concrete |
| `SurfaceFrictionPenalty_Ice` | float | 0.3 | 0.1–0.8 | Ice becomes almost unplayable | Ice feels identical to snow |

## Visual/Audio Requirements

### Impact VFX
- **Hard surface hits** (concrete, metal): dust cloud + spark particles on impact. Scale with impact force.
- **Soft surface hits** (snow, alien biomass): snow puff / biomass squish particles. No sparks.
- **Glass shatter**: radial fragment particles + tinkle audio. Chaos Destruction handles mesh fracture; VFX layer adds glass shard particles.

### Footstep VFX (per surface)

| Surface | VFX | Audio |
|---------|-----|-------|
| Snow | Snow puff per step, 8-12 particles | Crunch layer, low frequency |
| Ice | Minimal particles, slight slide trail | Scrape + clamp, high frequency |
| Metal | Spark particles on sharp impact | Metallic clang, resonant |
| Concrete | Dust puff, small debris | Thud, mid-frequency |
| Alien Biomass | Sticky droplet particles, slight squish | Wet slap, organic |
| Wood | Wood chip particles | Creak + thud, mid-low |
| Glass | Shatter particles (Chaos) | Tinkle, high frequency, rapid decay |

### Camera Shake on Impact
- Hard landing (fall damage >0): `Amplitude=5-15px`, `Duration=0.3-0.8s` based on damage.
- Weapon impact: `Amplitude=2-5px`, `Duration=0.1s`, localized to hit direction.

### Ragdoll Audio
- Body hit surfaces: impact sound based on surface type + fall velocity.
- Ragdoll dragging: scraping sounds if moving on rough surfaces.

## UI Requirements

Physics system has minimal direct UI (Foundation/Infrastructure). However, for immersive-first HUD:

| Context | HUD Element | Notes |
|---------|-------------|-------|
| Surface indicator | Small contextual icon (bottom-right, minimal) | Shows current surface type (Snow/Ice/Metal/etc.) when player looks down |
| Fall damage warning | Red vignette pulse when falling >600 cm/s | Scales with velocity; max at 1500+ cm/s |
| Push interaction | Context prompt "E — Push" when near pushable | Only shows for Light/Medium pushables within interaction range |

**Toggleable Full Tactical HUD adds:**
- Current surface type + friction value display
- Fall velocity meter (cm/s)
- Active physics debug visualization toggle (dev/debug only)

## Open Questions

**OQ-1: Physics sub-stepping — performance vs. accuracy tradeoff?**
UE 5.7 allows configurable physics substeps (`Project Settings > Engine > Physics > Max Substep Delta Time`). More substeps = better collision accuracy but higher CPU cost. What's the target for Hostile World? **Owner**: Engine/Perf | **Target**: Architecture ADR

**OQ-2: Chaos Destruction — how much destructible content?**
Glass shattering is confirmed. Are concrete walls destructible? Metal crates? Building sections? Each destructible asset requires a Geometry Collection. **Owner**: Art + Design | **Target**: Art bible approval

**OQ-3: Player mass — always 90kg or does gear affect it?**
Currently fixed at 90kg. Should carrying heavy weapons, armor upgrades, or inventory load affect mass and thus momentum? **Owner**: Design | **Target**: Movement System GDD

**OQ-4: Surface type detection — foot IK vs. capsule trace?**
Currently using line trace downward from pelvis. Should the system use foot IK traces for more accurate per-foot surface detection (left foot on snow, right on metal)? **Owner**: Engine/Animation | **Target**: Movement System GDD

**OQ-5: Infection zone physics — how does biomass affect movement?**
Alien Biomass surface has friction 0.4 and speed penalty 20%. But should it also have: physics impulses (player gets "stuck" in biomass)? Special movement mode (wading)? **Owner**: Design + Infection Spread System | **Target**: Infection Spread GDD

**OQ-6: Multi-surface per frame — conflict resolution strategy?**
Currently averaging friction when both feet on different surfaces. Is arithmetic mean the right approach, or should it be: min/max/dominant foot? **Owner**: Design | **Target**: Review with Movement System GDD

## UI Requirements

[To be designed]

## Acceptance Criteria

**GIVEN** Player falls at 1200 cm/s onto flat concrete, **WHEN** ground contact occurs, **THEN** fall damage = 60 HP applied to Health System.

**GIVEN** Player sprints at 600 cm/s, **WHEN** surface type changes to Ice (friction 0.15), **THEN** max speed drops to 420 cm/s (×0.7) immediately.

**GIVEN** Player falls at 1500 cm/s, **WHEN** crouch activates 0.1s before impact, **THEN** fall damage = 53 HP (ceil(105 × 0.5) reduction).

**GIVEN** Player fires a projectile, **WHEN** line trace hits WorldObject (concrete wall), **THEN** projectile stops, impact effect spawns at hit location.

**GIVEN** Player fires a projectile, **WHEN** trace passes through ECC_Infection zone, **THEN** projectile continues flight (no collision registered).

**GIVEN** Player (mass 90kg) pushes Light object (mass 30kg) with acceleration 1500 cm/s², **WHEN** movement input held, **THEN** push force = 4500 applied to object.

**GIVEN** Player dies, **WHEN** death event fires, **THEN** ragdoll blend weight reaches 1.0 after 0.3s, full ragdoll physics active.

**GIVEN** Player stands on Glass surface, **WHEN** impact force > 5000, **THEN** Glass shatters via Chaos Destruction, player loses ground contact and enters free fall.

**GIVEN** Player and Alien both present, **WHEN** they collide, **THEN** collision blocks both (ECC_Player vs ECC_Alien = Block).

**GIVEN** Player walks with left foot on Snow (friction 0.6) and right foot on Metal (0.5), **WHEN** frame processes, **THEN** surface friction averaged to 0.55 for that frame.