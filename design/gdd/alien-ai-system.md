# Alien AI System

> **Status**: In Design
> **Author**: user + agents
> **Last Updated**: 29 April 2026
> **Implements Pillar**: Pillar 1 (Hostile World), Pillar 3 (Tense Survival)

## Overview

The Alien AI System governs how alien threats perceive, pursue, and attack the player in Hostile World. It is the mechanical embodiment of Pillar 1 (Hostile World) — the world is not passively dangerous, it actively hunts you. The system manages alien perception (hearing, vision, environmental awareness), patrol behavior, combat tactics, and adaptive responses to player actions. When the player makes noise, aliens hear it. When the player hides, aliens search. When the player fights, aliens flank, call for backup, and use the environment.

The system operates as both a **data layer** (perception scores, behavior trees, patrol routes, alert states, group coordination) and a **player-facing experience** (the dread of hearing an alien turn toward your position, the panic of being flanked, the relief of slipping past a patrol unnoticed). It reads detection scores from the Stealth System, combat state from the Combat System, and zone infection data from the Infection Spread System, then produces alien behavior that makes the world feel alive and hostile.

**Key design decisions:**
1. **Behavior Trees over custom state machines** — UE5's BT system provides the flexibility needed for adaptive alien behavior without reinventing AI architecture.
2. **Perception is asymmetric** — different alien types have different sensory capabilities. Some hear better, some see in darkness, some track biomass disturbance.
3. **Group coordination** — aliens share information and coordinate attacks. They are not independent agents — they are a hive.
4. **Infection-aware behavior** — alien behavior changes based on zone infection level. In heavily infected zones, aliens are more aggressive and numerous.
5. **MVP: one alien type** — the "Drone" — a basic alien with standard hearing, vision, melee, and ranged attacks. Additional types deferred to Vertical Slice.

## Player Fantasy

The Alien AI System makes the player feel **hunted** — not scared, but dreading. Fear is reactive; dread is anticipatory. The player does not panic when an alien appears. They tense. They listen. They calculate. Because the alien is not a monster to fight — it is a predator that treats the player as a problem to solve.

The signature moment: the player crouches behind a collapsed wall in an infected town. They hear the alien's chittering — not a roar, but a clicking, assessing sound. It stops. Turns its head. The player holds still. The alien doesn't charge — it emits a low-frequency pulse, and from two other directions, answering clicks. It called for backup. The player realizes: *it knew I was here the whole time, and it was herding me.*

This is not a horde game. Aliens are not mindless spawns. They communicate, they flank, they use the environment, and they are patient. The player can hear their state changes — idle patrol becomes suspicious clicking becomes hunting vocalizations. The tension comes from knowing the alien is out there, not from it suddenly appearing.

This serves **Pillar 1 (Hostile World)** — the world does not tolerate the player's presence. Every zone has its own patrol patterns, its own awareness, its own response to intrusion. The alien is not placed on top of the world; it belongs to it. And **Pillar 3 (Tense Survival)** — being detected is not a combat encounter. It is a survival crisis. The player must decide: fight with scarce resources, or flee and find another route. The alien does not care which. It will pursue either way.

## Detailed Design

### Core Rules

**Rule 1 — Alien Type: Drone (MVP)**

| Stat | Value | Unit | Notes |
|------|-------|------|-------|
| Hit Points | 100 | HP | Dies in 2–5 shots (Combat System) |
| Walk Speed | 350 | cm/s | Patrol/pursuit walk |
| Sprint Speed | 650 | cm/s | Active pursuit |
| Charge Speed | 900 | cm/s | Charge attack (0.4s wind-up) |
| Hearing Sensitivity (P_hearing) | 1.0 | multiplier | Baseline per Stealth System |
| Vision Acuity (P_vision) | 1.0 | multiplier | Baseline per Stealth System |
| Hearing Range | 1500 | cm | Max distance for noise events |
| Vision Range | 800 | cm | Max distance for visual detection |
| Vision FOV | 110° | degrees | Horizontal field of view |
| Armor Tier | Unarmored | — | M_armor = 1.0 (Combat System) |
| Melee Range | 150 | cm | Contact attack |
| Melee Damage | 20 | HP | 0.3s wind-up |
| Spit Range | 1200 | cm | Projectile attack |
| Spit Damage | 15 | HP | 1200 cm/s projectile, 0.5s wind-up, 3.0s cooldown |
| Charge Range | 600–1000 | cm | Initiation window |
| Charge Damage | 25 | HP | 0.4s wind-up, 5.0s cooldown |
| Biomass Burst Range | 300 | cm | Zone attack |
| Biomass Burst Damage | 10 | HP/s | 8.0s cooldown |

**Rule 2 — UE5 Class Architecture**

```
AAlienCharacter (inherits ACharacter)
├── UAIPerceptionComponent* PerceptionComp
│   ├── UAISenseConfig_Sight*    SightConfig
│   ├── UAISenseConfig_Hearing*  HearingConfig
│   └── UAISenseConfig_Damage*   DamageConfig
├── USkeletalMeshComponent* BiomassVFX
├── UAudioComponent* AlienAudioComp
└── UAnimInstance* AlienAnimBP

AAlienAIController (inherits AAIController)
├── UBehaviorTree* AlienBehaviorTree
├── UBlackboardComponent* Blackboard
├── UEnvQueryManager* EQSManager
├── FPerceptionContext PerceptionContext
└── TArray<AAlienAIController*> SquadMembers

Custom BT Nodes (C++):
├── UAlienBTService_DetectionDecay (UBTService_BlackboardBase)
├── UAlienBTService_UpdatePerception (UBTService_BlackboardBase)
├── UAlienBTDecorator_IsDetectionThreshold (UBTDecorator)
├── UAlienBTTask_MeleeAttack (UBTTaskNode)
├── UAlienBTTask_SpitAttack (UBTTaskNode)
├── UAlienBTTask_ChargeAttack (UBTTaskNode)
├── UAlienBTTask_BiomassBurst (UBTTaskNode)
├── UAlienBTTask_FindPatrolLocation (UBTTaskNode)
└── UAlienBTTask_MoveToCover (UBTTaskNode)
```

**Key design decisions:**
- Perception components live on `AAlienCharacter` (not controller) so perception persists across controller swaps and allows direct access to actor transforms.
- One `AAlienAIController` per alien — no shared controllers.
- Custom BT nodes in C++ for performance-critical paths (attack tasks). Blueprint-only BT nodes avoided for attacks.

**Rule 3 — Behavior Tree Structure**

```
Root
└── Selector (Top-Level Decision)
    ├── [Decorator: bIsDead == false]
    │
    ├── Sequence: Combat Branch
    │   ├── Decorator: bIsInCombat == true (Dynamic Filter)
    │   └── Selector: Combat Actions
    │       ├── Sequence: Retreat if Low Health
    │       │   ├── Decorator: HealthPercent < 0.25
    │       │   └── Task: FindRetreatPosition (EQS) → MoveTo
    │       ├── Sequence: Ranged Attack
    │       │   ├── Decorator: CanUseRanged + DistanceToPlayer > 300
    │       │   └── Task: SpitAttack
    │       ├── Sequence: Melee Attack
    │       │   ├── Decorator: DistanceToPlayer <= 300
    │       │   └── Task: MeleeAttack
    │       ├── Sequence: Charge Attack
    │       │   ├── Decorator: bCanCharge + Distance 600–1000cm
    │       │   └── Task: ChargeAttack
    │       └── Sequence: Biomass Burst
    │             ├── Decorator: bCanBiomassBurst + PlayerInBiomassRange
    │             └── Task: BiomassBurst
    │
    ├── Sequence: Alert Branch
    │   ├── Decorator: DetectionScore >= 50 AND < 75
    │   └── Selector: Search
    │       ├── Task: FindFlankPosition (EQS) → MoveTo
    │       └── Service: UpdatePerception (continuous)
    │
    ├── Sequence: Suspicious Branch
    │   ├── Decorator: DetectionScore >= 25 AND < 50
    │   └── Selector: Investigate
    │       ├── Task: MoveToLastKnownPlayerLocation
    │       ├── Task: PlayAnimation (LookAround)
    │       └── Service: UpdatePerception (continuous)
    │
    └── Sequence: Patrol Branch (Default)
        ├── Decorator: DetectionScore < 25
        └── Selector: Patrol Actions
            ├── Task: FindPatrolLocation → MoveTo
            ├── Task: Wait (Random 2–5s)
            └── Service: DetectionDecay (interval 0.5s)
```

**Abort Logic:**
- **Lower Priority Aborts** on Combat branch: Detection score crossing thresholds immediately aborts lower-priority branches.
- **Self Aborts** on Attack tasks: If player moves out of range during wind-up, abort and re-evaluate.

**Rule 4 — Blackboard Keys**

| Key Name | Type | Purpose | Updated By |
|----------|------|---------|------------|
| `TargetActor` | Object | Current target (player) | Perception Service |
| `TargetLocation` | Vector | Last known player position | Perception Service |
| `DetectionScore` | Float | 0–100 detection value | UpdatePerception Service |
| `bIsInCombat` | Bool | Has detection hit Combat threshold (≥75)? | Set by `UAlienBTService_UpdatePerception` when `DetectionScore >= 75`. Cleared when `DetectionScore < 50` (after 3s decay). This bool gates the Combat Branch decorator — when true, the BT prioritizes attack/retreat tasks over investigation or patrol. |
| `bIsPlayerVisible` | Bool | Direct line of sight | Perception Service |
| `DistanceToPlayer` | Float | Distance to target | BT Service (every 0.25s) |
| `PatrolRoute` | Object | Waypoint array | Init on BeginPlay |
| `CurrentPatrolIndex` | Int | Index in patrol route | FindPatrolLocation Task |
| `PatrolDestination` | Vector | Next patrol point | FindPatrolLocation Task |
| `FlankLocation` | Vector | EQS result for flanking | FindFlankPosition Task |
| `RetreatLocation` | Vector | EQS result for retreat | FindRetreatPosition Task |
| `CoverLocation` | Vector | EQS result for cover | FindCover Task |
| `HealthPercent` | Float | Current HP / Max HP | Character → Controller event |
| `bCanCharge` | Bool | Charge attack available | Cooldown system |
| `bCanBiomassBurst` | Bool | Biomass attack available | Cooldown system |
| `SquadLeader` | Object | Leader AIController ref | Group coordination |
| `bSquadInCombat` | Bool | Any squad member in combat | Event dispatcher |
| `LastSeenPlayerTime` | Float | World time when last seen | Perception Service |

**Rule 5 — AI Perception Setup**

| Sense | Configuration | Notes |
|-------|--------------|-------|
| **Sight** | Range=2000cm, LoseSight=2500cm, FOV=110°, Peripheral=90° each side | Hysteresis prevents flickering at edge of vision. **Note:** Sight Range (2000cm) is the UE5 perception component's maximum detection radius — it determines when the UAISenseConfig_Sight fires events. Vision Range (800cm, Rule 1) is the *effective* visual detection range used in the D_visual formula — beyond 800cm, visual detection scores are too low to matter even if the perception component still fires. The 2000cm range ensures LOS checks happen at distance, but actual detection requires closer proximity. |
| **Hearing** | Range=1500cm, LoSHearing=800cm (through walls) | Receives noise events from Movement System |
| **Damage** | Threshold=5 HP | Reacts when shot — adds to detection score |

Detection score is computed by the Stealth System formula. UAIPerception fires `OnTargetPerceptionUpdated` when stimuli are detected; the AI Controller converts stimuli into score deltas using the alien's P_hearing/P_vision multipliers, then writes to Blackboard every 0.5s.

**Decay**: When no stimuli received for >2s, score decays at 5 points/sec (configurable via DataTable).

**Rule 6 — Attack Decision Scoring**

Every 0.5s, the alien scores each available attack:

`A_score(type) = W_range × S_range + W_health × S_health + W_cooldown × S_cooldown + W_position × S_position + W_infection × S_infection`

Weights: W_range=3.0, W_cooldown=2.0, W_health=1.5, W_position=1.0, W_infection=0.5.

| Attack | S_range | S_health | S_cooldown | S_position | S_infection |
|--------|---------|----------|------------|------------|-------------|
| Melee | 1.0 if d≤150, else 0 | 1.0 if HP≤40, else 0.3 | 1.0 if ready, else 0 | 1.0 if back turned, else 0.5 | I_zone/100 |
| Spit | 1.0 if 150<d≤1200, 0.3 if d≤150, else 0 | 0.5 always | 1.0 if ready, else 0 | 1.0 if LOS clear, else 0 | I_zone/100 |
| Charge | 1.0 if 600≤d≤1000, else 0 | 1.0 if HP≤60, else 0.4 | 1.0 if ready, else 0 | 1.0 if clear path, else 0.2 | I_zone/100 |
| Biomass Burst | 1.0 if d≤300, else 0 | 0.6 if HP≤50, else 0.3 | 1.0 if ready, else 0 | 1.0 if player in cover, else 0.4 | I_zone/100 |

Highest valid score wins. If no attack valid (all cooldown or out of range), alien pursues player.

**Rule 7 — Group Coordination (Event-Driven Squad System)**

Aliens organized into squads (assigned in level blueprint). Squad architecture:

```
AAlienAIController
├── SquadId (int32)
├── SquadMembers (TArray<AAlienAIController*>)
├── OnSquadAlerted (FMulticastDelegate)
└── BroadcastSquadState()
```

**Information sharing:**
1. **Squad Blackboard**: Shared `UBlackboardData_SquadShared` contains `SquadTargetLocation`, `SquadAlertLevel` (max detection in squad), `bSquadEngaged`.
2. **Event Dispatchers**: When alien detects player → `OnSquadAlerted.Broadcast(this, TargetLocation, DetectionScore)`.
3. **Squad Leader**: One alien per squad (first spawned) makes tactical decisions, broadcasts orders via `OnSquadOrder` delegate.
4. **UAlienManagerSubsystem** (UGameInstanceSubsystem): Global coordination — `GetAllActiveAliens()`, `GetSquadById()`, `NotifyPlayerPosition()`, `RegisterAlien()`.

**Alert propagation formula:**
`S_alert = clamp(A_base × (1 - (d/2000)²) × M_terrain × M_infection, 0, 100)`

Receiving alien: `D_total_received = max(D_total_own, S_alert × M_state)` after 1.5s delay.
- Idle aliens receive 80% of alert. Suspicious receive 100%. Alert+ receive 50%.
- Debounce: Squad alerts at 1s intervals to prevent BT thrashing.
- Distance filter: Only aliens within 30m of alerting member receive broadcast.

**Rule 8 — EQS Queries**

| Query | Generator | Filters | Scoring |
|-------|-----------|---------|---------|
| **FindCover** | Grid (500cm radius, 100cm spacing) | Path exists, no LOS to player, cover within 100cm | Distance to player, cover quality |
| **FindFlankPosition** | Circle (800–1500cm around player, 8 points) | Path exists, not in player FOV, walkable ground | Angle to player facing, distance to cover |
| **FindRetreatPosition** | Grid (1000cm behind current) | Distance from player >800cm, path exists | Distance from player, cover availability |
| **FindPatrolLocation** | Points along PatrolRoute | Path exists, not occupied by another alien | Distance, time since last visit |

EQS performance: Max 1 query per alien at a time. Timeout 0.1s. Results cached 2s. Game thread only — keep point counts <50.

**Rule 9 — Nav Mesh Requirements**

| Nav Area | Cost Multiplier | Purpose | Color |
|----------|----------------|---------|-------|
| Default | 1.0x | Standard ground | White |
| Low (custom) | 1.5x | Crouch/stealth paths | Blue |
| Biomass (custom) | 0.5x | Biomass zones (aliens faster) | Green |
| Restricted (custom) | ∞ (blocked) | No-go zones (cliffs, water) | Red |

Biomass Nav Areas painted at runtime via `UNavSystem::ApplyRadiusModifier` when infection spreads. Cell size 30cm. Agent radius 50cm. Max slope 45°. Dynamic obstacles: player and other aliens registered as `UNavTest` with `ENavDataGatheringMode::Dynamic`.

**Rule 10 — Infection-Aware Behavior (Provisional)**

Zone infection level (0–100) scales alien behavior:

| Behavior | Coefficient | Effect at I_zone=100 |
|----------|------------|---------------------|
| Movement speed | +0.3 | +30% speed (350→455 cm/s walk) |
| Perception range | +0.4 | +40% range (1500→2100cm hearing) |
| Aggression threshold | -0.3 | -30% threshold (attacks sooner) |
| Alert propagation | +0.5 | +50% alert strength |
| Attack cooldown reduction | -0.2 | -20% cooldowns (spit 3.0→2.4s) |

Provisional — values tuned during playtesting. Contract with Infection Spread System: `ISceneManagement::GetZoneInfectionLevel(ZoneId)` returns 0–100.

### States and Transitions

| State | Detection Score | Entry Condition | Exit Condition | BT Branch | Behavior |
|-------|----------------|-----------------|----------------|-----------|----------|
| **Idle/Patrol** | 0–24 | Game start, or detection decayed below 25 | Detection ≥ 25 OR alert received | Patrol Branch | Patrol waypoints, wait 2–5s, scan environment |
| **Suspicious** | 25–49 | Detection ≥ 25 OR alert from squad member | Detection < 25 for 5.0s OR detection ≥ 50 | Suspicious Branch | Move to last known player position, play "look around" animation, listen for stimuli |
| **Alert** | 50–74 | Detection ≥ 50 | Detection < 50 for 3.0s OR detection ≥ 75 | Alert Branch | EQS flank query, move to flanking position, scan with wider FOV |
| **Combat** | 75–99 | Detection ≥ 75 | Player breaks LOS + undetected 10.0s OR all aliens dead | Combat Branch | Attack selection via scoring. Melee, spit, charge, or biomass burst. Squad converges. |
| **Detected** | 100 | Detection = 100 | Player breaks LOS + undetected 10.0s OR all aliens dead | Combat Branch | Same as Combat. Full engagement — no de-escalation until LOS broken. |

**State transition audio cues (player-facing):**
- Idle → Suspicious: Alien stops patrol audio, emits low click/hiss (-18dB).
- Suspicious → Alert: Rapid clicking increases (-14dB), movement speed increases.
- Alert → Combat: Aggressive vocalization (-10dB), sprint animation begins.
- Combat → Idle: All combat audio ceases. Alien returns to patrol route after 5.0s cooldown.

### Interactions with Other Systems

| System | Direction | Data Flow | Interface |
|--------|-----------|-----------|-----------|
| **Stealth System** | Reads + Writes | Detection score (0–100), P_hearing, P_vision | **Interface contract:** Stealth System exposes `IStealthDetection::GetDetectionScore(ActorRef)` returning 0–100. `UAlienBTService_UpdatePerception` calls this every 0.5s, writes result to Blackboard key `DetectionScore`. Alien does NOT write to Stealth System — it is read-only from the alien's perspective. Stealth System owns all D_total computation; Alien AI only consumes the result. |
| **Combat System** | Reads + Writes | Alien health, attack execution, armor tier | Combat System calls `TakeDamage()` on alien. Alien fires `OnAlienKilled()` when HP=0. Alien attacks call `TakeDamage()` on player. |
| **Movement System** | Reads | Player noise level, noise propagation radius | Movement System broadcasts noise events. Alien's HearingConfig receives stimuli within R_noise. |
| **Player Controller** | Reads | Player position, movement state | PC provides player actor reference for perception targeting. |
| **Health System** | Reads | Player HP (for attack decision scoring) | Alien reads player HP to choose finishing attacks (melee when HP≤40). |
| **Physics System** | Reads | Surface type, weather state, terrain occlusion | Physics provides M_surface_noise, M_terrain for detection and alert propagation. |
| **Camera System** | Reads | Camera mode, FOV | Alien checks if player is in FirstPerson scope (reduced peripheral vision). |
| **Scene Management** | Reads | Zone ID, infection level, time of day | `GetZoneInfectionLevel()` for infection-aware scaling. `GetTimeOfDay()` for lighting modifier. |
| **Audio System** | Writes | Alien vocalizations, combat audio, alert sounds | Alien fires audio events per state change. |
| **Animation System** | Writes | Alien animation state, attack montages | Alien plays patrol, investigate, attack, and death animations. |
| **HUD System** | Writes | Threat direction indicators (tactical mode) | HUD reads alien positions for threat dots. |
| **Investigation System** | Reads | Combat state for clue accessibility | Investigation System checks `bIsInCombat` — some clues inaccessible during combat. |
| **Infection Spread System** (Provisional) | Reads | Zone infection level (0–100) | `ISceneManagement::GetZoneInfectionLevel()` — scales alien behavior per Rule 10. |

## Formulas

**Formula 1 — Attack Decision Score**

The `attack_decision_score` formula determines which attack the Drone selects:

`A_score(type) = W_range × S_range(type) + W_health × S_health(type) + W_cooldown × S_cooldown(type) + W_position × S_position(type) + W_infection × S_infection(type)`

**Variables:**

| Variable | Symbol | Type | Range | Source | Description |
|----------|--------|------|-------|--------|-------------|
| Range weight | W_range | float | 3.0 | This GDD | Most important factor — attack must reach player |
| Health weight | W_health | float | 1.5 | This GDD | Prefer finishing attacks on wounded players |
| Cooldown weight | W_cooldown | float | 2.0 | This GDD | Prefer attacks that are ready |
| Position weight | W_position | float | 1.0 | This GDD | Bonus for favorable positioning |
| Infection weight | W_infection | float | 0.5 | This GDD | Provisional — scales with zone infection |
| Distance to player | d | float | 0–2000 cm | Calculated | Current alien-to-player distance |
| Player HP | HP_player | float | 0–100 | Health System | Player's current health |
| Zone infection | I_zone | float | 0–100 | Scene Management | Current zone infection level |

**Output Range:** 0.0 to 8.0. Selection: highest A_score among valid attacks. If no attack valid, alien pursues.

**Example:** Drone vs player at 400cm, player HP=35, clear LOS, all cooldowns expired, I_zone=60:
- Melee: INVALID (d=400 > R_melee=150).
- Spit: VALID. A_score = 3.0×1.0 + 1.5×0.5 + 2.0×1.0 + 1.0×1.0 + 0.5×0.6 = **7.05**.
- Charge: INVALID (d=400 < R_charge=600).
- Biomass Burst: INVALID (d=400 > R_burst=300).
**Result: Spit attack selected.**

---

**Formula 2 — Alert Signal Strength**

The `alert_signal_strength` formula governs how detection propagates between squad members:

`S_alert = clamp(A_base × (1 - (d / R_alert)²) × M_terrain × M_infection, 0, 100)`

**Variables:**

| Variable | Symbol | Type | Range | Source | Description |
|----------|--------|------|-------|--------|-------------|
| Alerting alien's detection | A_base | float | 0–100 | Stealth System | The alerting alien's current D_total |
| Distance between aliens | d | float | 0–2000 cm | Calculated | Alerting-to-receiving alien distance |
| Alert range | R_alert | float | 2000 cm | This GDD | Maximum alert propagation distance |
| Terrain occlusion | M_terrain | float | 0.3–1.0 | Physics System | Open=1.0, partial cover=0.6, dense=0.3 |
| Infection modifier | M_infection | float | 1.0–1.5 | Scene Management | I_zone=0 → 1.0, I_zone=100 → 1.5 (linear) |

**Output Range:** 0 to 100.
**Example:** Alien A has D_total=80. Alien B is 1200cm away in open terrain, I_zone=40:
- M_infection = 1.0 + (40/100)×0.5 = 1.2
- S_alert = clamp(80 × (1-(1200/2000)²) × 1.0 × 1.2, 0, 100) = clamp(80 × 0.64 × 1.2, 0, 100) = **61.44**

Receiving alien (Idle): D_total = max(5, 61.44 × 0.8) = **49.15** → Suspicious after 1.5s delay.

---

**Formula 3 — Infection Behavior Modifier**

The `infection_behavior_modifier` formula scales alien behavior per zone infection level:

`M_infection(type) = 1.0 + (I_zone / 100) × K_type`

**Variables:**

| Variable | Symbol | Type | Range | Source | Description |
|----------|--------|------|-------|--------|-------------|
| Zone infection | I_zone | float | 0–100 | Scene Management | Current zone infection level |
| Behavior coefficient | K_type | float | -0.3 to 0.5 | This GDD | Per-behavior scaling coefficient |

**Per-behavior coefficients:**

| Behavior | K_type | Effect at I_zone=100 |
|----------|--------|---------------------|
| Movement speed | +0.3 | +30% (350→455 cm/s) |
| Perception range | +0.4 | +40% (1500→2100cm) |
| Aggression threshold | -0.3 | -30% (attacks sooner) |
| Alert propagation | +0.5 | +50% alert strength |
| Attack cooldown | -0.2 | -20% (spit 3.0→2.4s) |

**Output Range:** 0.7 to 1.5.
**Example:** I_zone=75. Drone walk speed: 350 × (1.0 + 0.75×0.3) = 350 × 1.225 = **428.75 cm/s**.

---

**Formula 4 — Patrol Point Score**

The `patrol_point_score` formula determines the Drone's next patrol destination:

`P_score = W_time × S_time + W_random × S_random + W_alert × S_alert + W_infection × S_infection + W_cover × S_cover`

**Variables:**

| Variable | Symbol | Type | Range | Source | Description |
|----------|--------|------|-------|--------|-------------|
| Time weight | W_time | float | 2.0 | This GDD | Prefer unvisited points |
| Random weight | W_random | float | 1.0 | This GDD | Prevent predictable patterns |
| Alert weight | W_alert | float | 3.0 (0 if squad alert < 25) | This GDD | Bias toward player position when alerted |
| Infection weight | W_infection | float | 0.5 | This GDD | Prefer high-infection areas |
| Cover weight | W_cover | float | 1.0 | This GDD | Prefer defensible points |

**Output Range:** 0.0 to 7.5. Selection: highest P_score. Hysteresis: stay at current point if score difference < 0.5.

## Edge Cases

- **If player kills an alien while it is in Alert state**: The dead alien's detection score is removed from global calculation. Dead aliens do not broadcast their detection to squad members — but the death sound (damage stimulus) may trigger nearby aliens' hearing sense.

- **If all aliens in a squad are killed**: Squad is disbanded. Remaining aliens in other squads are unaffected. Global squad alert resets to 0 for that squad ID.

- **If player is detected by Alien A (D_total=100) but all other squad members are at Hidden (D_total<25)**: Alien A broadcasts alert. Squad members within R_alert receive S_alert and transition to Suspicious after 1.5s delay. Combat noise from Alien A's attack may also trigger hearing stimuli for aliens outside R_alert.

- **If alien's Nav Mesh path is blocked by dynamic obstacle (collapsed building, biomass growth)**: Alien re-routes via Nav Mesh rebuild. If no path exists, alien switches to alternative behavior (e.g., spit attack from current position instead of melee approach).

- **If alien is in Combat state and player enters a new zone (Scene Management streaming)**: Alien does NOT follow across zone boundaries. Combat state ends for that alien. Player's new zone aliens may engage if player is detected there.

- **If two aliens target the same patrol point simultaneously**: Patrol point scoring includes "not occupied by another alien" filter. Second alien selects next-best point. Simple distance check (no complex negotiation).

- **If alien's EQS query times out (0.1s limit)**: Query aborts. Alien falls back to default behavior (move toward player's last known position for combat, continue patrol for idle).

- **If infection level changes mid-patrol (zone infection increases)**: Alien's infection modifier recalculates on next BT tick. Movement speed, perception range, and cooldowns adjust immediately. No transition animation.

- **If alien receives alert from squad member while already in Combat**: M_state = 0.5 (Alert+ receives 50% of new alert). D_total = max(own score, S_alert × 0.5). Since alien is already at D_total=100, new alert has no effect. Prevents double-counting.

- **If alien's perception detects player but player is behind one-way glass or thin cover**: LOS = 0.5 (partial). D_visual is halved. Alien investigates but does not immediately engage.

- **If player dodges during alien attack wind-up**: Attack executes but may miss (alien attacks last known position, not predicted position). Dodge i-frames negate damage if attack connects during i-frame window.

- **If alien is in Biomass Burst zone and player is also in zone**: Alien takes no damage from biomass burst (immune to own zone damage). Player takes 10 HP/s. Alien gains positional advantage.

- **If squad leader is killed**: Next oldest alien in squad becomes leader (by spawn order). Squad coordination continues with minimal disruption (1-frame gap during leader reassignment).

- **If alien's hearing range overlaps player's noise radius but player is on a surface with M_surface_noise=0.4 (ice, crouching)**: D_noise may be too low to trigger detection. Alien does not react. Crouching on ice is the quietest movement combination.

## Dependencies

**Hard Dependencies** (system cannot function without):
- **Stealth System** ✅ (designed) — provides detection score formula, P_hearing/P_vision integration. Alien AI reads detection score from Blackboard every 0.5s.
- **Combat System** ✅ (designed) — defines alien attack types, damage values, armor tiers. Alien AI executes attacks defined by Combat System.
- **Movement System** ✅ (designed) — provides noise propagation radius and noise events. Alien hearing depends on Movement System's noise output.
- **Physics System** ✅ (designed) — provides surface type, terrain occlusion, weather state. Environmental modifiers depend on physics data.

**Soft Dependencies** (enhanced by but works without):
- **Player Controller** ✅ (designed) — provides player actor reference for perception targeting.
- **Camera System** ✅ (designed) — provides camera mode for peripheral vision checks.
- **Health System** ✅ (designed) — provides player HP for attack decision scoring.
- **Scene Management** ✅ (designed) — provides zone infection level, time of day. Infection-aware behavior depends on zone state.
- **Audio System** (Not Started) — plays alien vocalizations, combat audio, alert sounds.
- **Animation System** (Not Started) — plays alien patrol, investigate, attack, and death animations.
- **HUD System** (Not Started) — displays threat direction indicators.
- **Infection Spread System** (In Design) — provides dynamic zone infection level. Contract resolved (OQ-8): `GetCellInfectionLevel(CellCoords)` returns 0–100 per cell, `GetZoneInfectionLevel(ZoneId)` returns zone aggregate (Formula 6).

**Depended On By**:

| System | Interface Used | Expected Behavior |
|--------|---------------|-------------------|
| Stealth System | Detection score, P_hearing, P_vision | Reads alien perception params for D_total calculation |
| Combat System | Alien health, attack execution, OnAlienKilled() | Receives alien death events, alien attack damage calls |
| Investigation System | bIsInCombat flag | Some clues inaccessible during combat |
| Scene Management | Zone infection level | Infection-aware behavior scaling |
| HUD System | Alien positions | Threat direction indicators (tactical mode) |

## Tuning Knobs

| Knob | Default | Safe Range | Affects | Too High | Too Low |
|------|---------|------------|---------|----------|---------|
| `DroneHP` | 100 | 60–150 | Alien survivability | Ammo starvation, combat too long | Aliens die too fast, no threat |
| `DroneWalkSpeed` | 350 cm/s | 250–500 | Patrol pace | Alien catches player too easily | Alien feels sluggish |
| `DroneSprintSpeed` | 650 cm/s | 500–800 | Pursuit pressure | Player cannot outrun alien | Pursuit has no tension |
| `HearingRange` | 1500 cm | 800–2500 | How far alien hears | Player never safe from noise | Alien deaf, stealth trivial |
| `VisionRange` | 800 cm | 400–1200 | How far alien sees | Player always spotted | Alien blind, stealth too easy |
| `VisionFOV` | 110° | 80°–150° | Alien peripheral awareness | No blind spots to exploit | Easy to sneak behind |
| `AlertRange` | 2000 cm | 1000–3000 | How far alert propagates | Entire zone alerted instantly | No coordination between aliens |
| `AlertDelay` | 1.5s | 0.5–3.0s | Reaction time to squad alert | Instant hive response | Aliens react too slowly |
| `AttackDecisionInterval` | 0.5s | 0.25–1.0s | How often attack is re-scored | Alien changes attacks too fast | Alien stuck on bad attack |
| `W_range` | 3.0 | 2.0–5.0 | Range importance in attack choice | Alien only uses in-range attacks | Alien picks unreachable attacks |
| `W_cooldown` | 2.0 | 1.0–3.0 | Cooldown importance in attack choice | Alien only uses ready attacks | Alien waits for specific attack |
| `W_health` | 1.5 | 0.5–3.0 | Player HP importance in attack choice | Alien focuses wounded too much | Alien ignores wounded player |
| `K_speed_infection` | 0.3 | 0.1–0.5 | Infection speed scaling | High-infection zones unwinnable | Infection has no behavioral impact |
| `K_perception_infection` | 0.4 | 0.2–0.6 | Infection perception scaling | Player always detected in infected zones | Infection irrelevant |
| `PatrolHysteresis` | 0.5 | 0.2–1.0 | Patrol point switching threshold | Alien never moves | Alien jitters between points |
| `T_max_visit` | 120s | 60–300s | Patrol recency window | Alien revisits too quickly | Alien never returns to points |

## Visual/Audio Requirements

### Art Bible Principles Governing Alien AI

| Principle | Application |
|-----------|------------|
| **Environmental Transformation** (Pillar 1) | Aliens belong to the world, not placed on top of it. Biomass zones are their home turf — they move faster, perceive better, and feel at ease. The alien's visual design should reflect the infection: dark, organic, integrated with the biomass aesthetic. |
| **Earned Revelation Through Scarcity** (Pillar 2) | Alien behavior is readable through audio and animation, not UI markers. The player learns to recognize the click of a suspicious alien, the rapid movement of an alert alien, the sprint of a combat alien. Information is earned through observation. |
| **Survival Tension Through Visual Legibility** (Pillar 3) | When an alien detects the player, the player should know immediately — not through a UI indicator, but through the alien's body language. Head turns, posture changes, vocalizations. The alien's state is communicated through its behavior, not a floating icon. |

### Alien State Visual/Audio Progression

| State | Visual | Audio | Animation |
|-------|--------|-------|-----------|
| **Idle/Patrol** | Biomass VFX subtle (slow pulse). Alien posture relaxed. | Ambient chittering (low, -24dB). Footstep sounds on current surface. | Slow patrol walk, occasional head turn, scanning animation every 5–10s. |
| **Suspicious** | Biomass VFX intensifies (faster pulse, 0.5s cycle). Alien stops, faces player's last known direction. | Low click/hiss (-18dB). Movement stops — silence is the cue. | Stop patrol. Turn head toward last known position. "Look around" animation (360° scan over 2s). |
| **Alert** | Biomass VFX strong pulse (0.3s cycle). Alien posture aggressive (lowered stance, forward lean). | Rapid clicking (-14dB). Movement speed increases — audible footstep acceleration. | Move toward last known position. Wider FOV scan. EQS flank query — alien may circle. |
| **Combat** | Full biomass glow (green bioluminescence). Alien sprint animation. Attack wind-up telegraphs (melee: rear back, spit: throat pulsing, charge: low stance). | Aggressive vocalization (-10dB). Attack-specific SFX: melee roar, spit gurgle, charge rumble. | Sprint toward player. Attack montages with wind-up (0.3–0.5s). Death: collapse + biomass dissolution. |

### Death VFX

- Alien collapses (0.5s), biomass dissolves into dark slurry (1.0s), leaves persistent blood/biomass decal (fades after 60s).
- Audio: Death vocalization (gurgling, -12dB), body impact, then silence.
- No explosion, no dramatic particle effects. Death is organic and unsettling.

### Performance Budget

| Metric | Budget |
|--------|--------|
| Per-alien BT tick | <0.15ms |
| Per-alien AI Perception | <0.05ms |
| Per-alien EQS query (when active) | <0.10ms |
| Per-alien navigation | <0.10ms |
| Per-alien total | <0.50ms |
| Max simultaneous aliens (MVP target) | 8 |
| Max simultaneous aliens (PC high-end) | 20 |

## UI Requirements

| Context | HUD Element | Update Frequency | Condition |
|---------|-------------|-----------------|-----------|
| **Immersive mode** | No alien UI | — | Default. Player reads alien state from behavior and audio. |
| **Tactical HUD** | Threat direction indicators | Every 0.5s | Mini dots on screen edge showing alien positions within 5000cm. Color-coded: gray (patrol), yellow (suspicious), orange (alert), red (combat). |
| **Tactical HUD** | Squad alert level | On state change | Small indicator showing highest detection score in nearest squad. |

## Acceptance Criteria

- **GIVEN** Drone alien on patrol with no player stimuli, **WHEN** detection score is checked, **THEN** D_total < 5 and alien is in Idle/Patrol state.

- **GIVEN** player sprints on concrete (noise=80) within 500cm of Drone, **WHEN** detection is calculated, **THEN** D_total ≥ 50 and alien transitions to Alert state within 1.0s.

- **GIVEN** Drone in Suspicious state, **WHEN** player breaks LOS and remains quiet for 5.0s, **THEN** detection decays below 25 and alien returns to Patrol state.

- **GIVEN** Drone in Combat state (D_total=100), **WHEN** attack decision is scored, **THEN** highest-scoring valid attack is selected and executed within 0.5s.

- **GIVEN** two Drones in same squad, 800cm apart, **WHEN** Alien A detects player (D_total=80), **THEN** Alien B receives alert signal S_alert ≥ 50 and transitions to Suspicious within 1.5s + alert delay.

- **GIVEN** Drone in zone with I_zone=100, **WHEN** alien stats are checked, **THEN** walk speed ≥ 455 cm/s, hearing range ≥ 2100cm, and spit cooldown ≤ 2.4s.

- **GIVEN** Drone's EQS_FindCover query, **WHEN** query executes, **THEN** result returns a position within 500cm that has no LOS to player and has cover object within 100cm, OR query times out at 0.1s.

- **GIVEN** Drone patrol with 3 waypoints, **WHEN** patrol point scoring runs, **THEN** highest-scoring point is selected and alien moves toward it. If current point score differs from next by < 0.5, alien stays.

- **GIVEN** Drone in Combat state and player dodges during melee wind-up (0.3s), **WHEN** attack connects during i-frame window, **THEN** damage is fully negated and HP unchanged.

- **GIVEN** all aliens in a squad are killed, **WHEN** detection is recalculated, **THEN** global detection resets to 0 and remaining squads are unaffected.

- **GIVEN** Drone's hearing range overlaps player's noise radius but player is crouching on ice (M_surface_noise=0.4, noise=6), **WHEN** detection is calculated, **THEN** D_noise < 10 and alien does not react.

- **GIVEN** Drone in Biomass Burst zone and player also in zone, **WHEN** burst activates, **THEN** player takes 10 HP/s and alien takes 0 HP/s (immune to own zone damage).

- **GIVEN** Drone squad leader is killed, **WHEN** squad coordination is checked, **THEN** next oldest alien becomes leader within 1 frame and squad behavior continues.

- **GIVEN** max 8 aliens running simultaneously (MVP target), **WHEN** per-alien CPU is measured, **THEN** total AI CPU < 4.0ms/frame (0.5ms × 8) at 60fps.

## Open Questions

| # | Question | Owner | Target Resolution |
|---|----------|-------|-------------------|
| OQ-1 | Should alien armor be breakable (sustained fire on armored sections reduces armor)? Combat System OQ-3 raises this. | game-designer | Combat System GDD review |
| OQ-2 | Should the player be able to scavenge ammo from dead aliens? Combat System OQ-2 raises this. | game-designer | Combat System GDD review |
| OQ-3 | Should the player be able to pick up alien weapons (biomass-based weapons)? Combat System OQ-6 raises this. | game-designer | Alien AI System GDD review |
| OQ-4 | Should alien biomass "remember" player presence even after player leaves (persistent disturbance visible to aliens)? Stealth System OQ-3 raises this. | design | Infection Spread System GDD |
| OQ-5 | Should the alien have a "confidence meter" — a hidden value that affects how quickly aliens escalate? Stealth System OQ-5 raises this. | game-designer | Alien AI System GDD review |
| OQ-6 | Should the player be able to distract aliens (throw rocks, create noise)? Stealth System OQ-6 raises this. | game-designer | Combat System GDD review |
| OQ-7 | Multiplayer (future) — how does AI scale with multiple players? Shared detection? Individual? | architecture | Multiplayer ADR |
| OQ-8 | Infection Spread System provisional contract — should `GetZoneInfectionLevel()` return a single value per zone, or a gradient across the zone? | engine-programmer | Infection Spread System GDD |

---

## Design Review Findings

> **Date**: 29 April 2026
> **Reviewer**: design-review skill
> **Verdict**: PASS (with minor corrections — all resolved below)

### Completeness
- **8/8 required sections** present and substantive
- Bonus sections: Visual/Audio Requirements, UI Requirements, Open Questions

### Issues Found & Resolved

| # | Issue | Severity | Status | Resolution |
|---|-------|----------|--------|------------|
| 1 | Character encoding error: "解散" in Edge Cases | Must Fix | ✅ Resolved | Replaced with "disbanded" |
| 2 | Sight Range (2000cm) vs Vision Range (800cm) ambiguity | Should Clarify | ✅ Resolved | Added note explaining perception component range vs. effective detection range |
| 3 | `bIsInCombat` bool transition mechanism unspecified | Should Clarify | ✅ Resolved | Updated Blackboard entry to specify `UAlienBTService_UpdatePerception` sets/clears the bool based on DetectionScore thresholds |
| 4 | Stealth System `D_total` interface contract unclear | Should Document | ✅ Resolved | Updated interaction table to specify `IStealthDetection::GetDetectionScore()` read-only interface |

### Summary
The Alien AI System GDD is thorough, well-structured, and highly implementable. All identified issues were documentation clarifications, not fundamental design gaps. The GDD is ready for implementation planning.

---

## Consistency Check Findings

> **Date**: 29 April 2026
> **Reviewer**: consistency-check skill
> **Verdict**: PASS (conflict resolved)

### Conflict Found & Resolved

| # | Issue | Severity | Status | Resolution |
|---|-------|----------|--------|------------|
| 1 | Detection thresholds mismatched with Stealth System (was 30/70/100, Stealth System uses 25/50/75/100) | 🔴 CONFLICT | ✅ Resolved | Aligned Alien AI System to Stealth System thresholds. Updated BT decorators, state table, `bIsInCombat` bool, and acceptance criteria. Added "Detected" state (D_total=100) to match Stealth System's 5-state model. |

### Threshold Alignment (post-resolution)

| State | Detection Score | Stealth System Equivalent |
|-------|----------------|--------------------------|
| Idle/Patrol | 0–24 | Hidden (0–24) |
| Suspicious | 25–49 | Suspicious (25–49) |
| Alert | 50–74 | Alert (50–74) |
| Combat | 75–99 | Engaged (75–99) |
| Detected | 100 | Detected (100) |
