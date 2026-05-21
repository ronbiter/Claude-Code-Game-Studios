# Infection Spread System

> **Status**: Draft
> **Author**: user + agents
> **Last Updated**: 20 May 2026 (rev 2 — NEEDS REVISION blockers resolved)
> **Last Verified**: 20 May 2026
> **Implements Pillar**: Pillar 1 (Hostile World) — the world transforms in real time

## Summary

The Infection Spread System drives the real-time, procedural transformation of Hostile World's environment from clean to infected states. Infection sources (Alien Hives, Biomass Nodes, Spore Vents) emit infection pressure into nearby World Partition cells. Each cell accumulates pressure over time, crossing thresholds that trigger visual, audio, and gameplay changes via Scene Management's Data Layer system. The player can destroy infection sources permanently or deploy temporary cures to suppress spread in targeted areas. New hives spawn procedurally in fully infected cells, creating an escalating, unpredictable threat that makes every playthrough unique. This system is the mechanical core of Pillar 1 — the world is not static, it is actively becoming more hostile.

> **Quick reference** — Layer: `Core` · Priority: `MVP` · Key deps: `Scene Management, Alien AI`

## Overview

Hostile World's defining feature is that the world changes while the player is in it. The Infection Spread System makes this happen. It tracks every infection source on the map, calculates how much pressure each source exerts on surrounding cells every 10 seconds, and updates each cell's infection level (0–100). As cells cross thresholds, Scene Management swaps Data Layers to mutate the environment: vegetation dies, biomass grows, lighting shifts, audio crossfades, and alien behavior intensifies.

The system operates on three timescales:
- **Moment-to-moment**: Infection pressure ticks every 10 seconds. Player sees spore density increase, hears bio-drone grow louder.
- **Short-term (5–15 minutes)**: Cells transition between infection states. New routes become blocked. Safe zones become dangerous.
- **Session-scale (60–90 minutes)**: Entire zones transform. Procedural hive spawning creates new threat centers. The world the player started in is unrecognizable.

The player is not passive. Destroying a Hive removes its pressure permanently. Deploying a temporary cure creates a suppressant zone that reduces infection for 5 minutes. But the infection always fights back — new hives spawn in fully infected cells, and Biomass Nodes proliferate as the infection spreads.

## Player Fantasy

The Infection Spread System makes the player feel **the weight of time**. Every minute spent exploring is a minute the world gets worse. But it also makes the player feel **agency** — they are not just fleeing the infection, they are fighting it. The signature moment: the player returns to a resistance camp they visited an hour ago and finds it half-consumed by biomass. The survivors are panicked. The route they used before is now blocked by alien growth. The player realizes: *I can't just come back later. The world doesn't wait.*

This is not a disease that affects the player directly (they are immune). It is a disease that affects the world around them — their routes, their allies, their safe spaces. The infection is the antagonist that never stops moving.

The procedural hive spawning adds **unpredictability**. Two players starting from the same point will see the infection spread in different directions. The same zone will feel different on replay. This serves the survival pillar: mastery is not memorizing spawn locations, it is learning to read the infection's behavior and adapt.

This serves **Pillar 1 (Hostile World)** — the world transforms without asking permission. **Pillar 2 (Earned Discovery)** — the player discovers infection patterns through observation, not UI markers. **Pillar 3 (Tense Survival)** — time is always against the player, and safe zones are temporary.

## Detailed Design

### Core Rules

**Rule 1 — Infection Source Types**

Three source types emit infection pressure into surrounding cells. Each source has a position, an output rate, and an effective radius.

| Source Type | Symbol | Pressure/sec | Radius (cm) | HP | Spawn Method |
|-------------|--------|-------------|-------------|----|-------------|
| Alien Hive | H_hive | 10 | 5000 | 500 | Author-time + procedural |
| Biomass Node | H_node | 5 | 2500 | 150 | Procedural (spreads from infected cells) |
| Spore Vent | H_vent | 2 | 1500 | 50 | Procedural (appears in Exposed+ cells) |

**Rule 2 — Cell Infection Model**

Each World Partition cell maintains an independent infection level (0–100). The system updates all cells within range of at least one active source every 10 seconds (the "infection tick").

Per tick, for each cell:
1. Sum infection pressure from all active sources within their radius
2. Apply environmental modifiers (terrain, weather, player cures)
3. Add net pressure to cell's accumulated infection level
4. Clamp to [0, 100]
5. If the cell crossed a state threshold, trigger Data Layer swap via Scene Management

Cells outside all source radii do not tick (no pressure = no change). Infection does not decay naturally — once a cell is infected, it stays infected unless the player intervenes.

**Rule 3 — Infection States per Cell**

| State | Range | Name | Data Layer State | Gameplay Effect |
|-------|-------|------|-----------------|-----------------|
| 0 | Clean | DL_Clean active, DL_Infected inactive | No alien spawns, safe for camp |
| 1–24 | Exposed | DL_Clean active, post-process infection overlay | Spore particles at cell edges, bio-drone audible at low volume |
| 25–49 | Partial | DL_Clean + DL_Infection_Partial additive | Biomass patches visible, some paths blocked, alien scouts may spawn |
| 50–74 | Infected | DL_Infected active, DL_Clean inactive | Full biomass coverage, alien patrols active, resource nodes mutate |
| 75–99 | Fully Infected | DL_Infected + DL_Infected_Advanced | Bioluminescent glow, alien structures forming, hive spawn eligible |
| 100 | Hive Core | DL_Infected + DL_Hive_Core | Hive structure spawned, maximum alien density, new source for further spread |

**Rule 4 — Player Counter-Play**

The player has two tools to fight infection:

**4a — Destroy Sources (Permanent)**
- Attacking and destroying a Hive, Node, or Vent removes it from the active source list immediately
- Cells stop receiving pressure from that source on the next tick
- Destroyed sources do not respawn
- Hive destruction is a significant combat encounter (500 HP, may trigger squad response per Alien AI System)

**4b — Deploy Temporary Cure (Suppressant Zone)**
- Player deploys a cure device at a target location
- Creates a suppressant zone: radius 3000 cm, duration 300 seconds (5 minutes)
- Cells within the zone receive -8 pressure/sec (negative pressure)
- Infection level decreases over time; cells can transition back to lower states
- After 300 seconds, suppressant expires and infection resumes normal accumulation
- Cures are scarce resources (Inventory System) — player carries a maximum of 2 at a time. Cures are loot-only (found in the world, not craftable). Player must choose where and when to deploy. See OQ-5 resolution.
- A cell can be affected by multiple overlapping suppressant zones (pressure stacks)

**Rule 5 — Procedural Hive Spawning**

When a cell reaches infection level 100 (Hive Core state), it becomes eligible for procedural hive spawning:

- **Cooldown**: Minimum 120 seconds between hive spawns globally (prevents cascade)
- **Cap**: Maximum 3 procedural hives per zone at any time (prevents zone saturation)
- **Spawn check**: Every 30 seconds, the system evaluates eligible cells (level 100, no existing hive)
- **Selection**: If multiple cells are eligible, one is chosen weighted by proximity to the player (closer cells have higher weight — infection moves toward areas the player knows and cares about, reinforcing Pillar 1). Formula: W_distance = clamp(2.0 − (distance_from_player / 5000), 1.0, 2.0). At dist=0: W_distance=2.0 (maximum threat near player). At dist≥5000: W_distance=1.0 (baseline).
- **Minimum spawn distance**: A new procedural hive must be at least K_hive_min_spawn_dist = 3000 cm from any existing hive. This prevents multi-hive cluster exploitation.
- **Randomness**: Selected cell's exact hive position has ±200 cm random offset from cell center, constrained to valid spawn locations (flat ground, not in water, not inside buildings)
- **Spawn VFX**: Hive emergence takes 8 seconds — biomass erupts from ground, structure grows, bioluminescence activates. Scene Management swaps to DL_Hive_Core when complete.
- **Player notification**: No explicit UI. The player hears the hive emergence (distinctive audio event, audible zone-wide) and feels a haptic pulse (controller rumble) on emergence start. No screen glow — the player must orient themselves using audio.

**Rule 6 — Procedural Biomass Node Spawning**

Biomass Nodes spawn as the infection spreads, creating intermediate threat between Hives and ambient infection:

- **Trigger**: When a cell transitions from Exposed (24) to Partial (25), roll for Node spawn (40% chance)
- **Cooldown**: 60 seconds per cell (prevents multiple nodes in same cell)
- **Cap**: Maximum 5 procedural nodes per zone
- **Position**: Random within cell, biased toward existing biomass patches (visual coherence)
- **Nodes do not respawn** if destroyed

**Rule 7 — Procedural Spore Vent Spawning**

Spore Vents are the most common and least dangerous source type:

- **Trigger**: When a cell transitions from Clean (0) to Exposed (1), spawn 1–2 vents
- **Position**: Random within cell, near ground level
- **Vents do not respawn** if destroyed
- **Purpose**: Provide low-level infection pressure to sustain Exposed state and seed further spread

**Rule 8 — Infection Tick Performance**

The system uses a **tiered tick rate** to simulate the world transforming regardless of player position while managing CPU cost:

- **Near zone** (cell center within 8,000 cm of player): tick every 10 seconds. Full simulation fidelity. Player sees and feels the world changing in real time.
- **Far zone** (all other cells within range of at least one active source): tick every 60 seconds. Infection spreads off-screen at 1/6 speed, ensuring the world changes while the player is away.
- **On approach**: When the player enters a far-zone cell's locality, a single analytical calculation applies accumulated infection — no tick loop: `I_catchup = clamp(I_old + (P_cell / K_spread_rate_far) × elapsed_seconds, 0, 100)`. `elapsed_seconds` is bounded to `T_catchup_max_seconds` = 1800 (30 minutes of far-zone time). Any thresholds crossed trigger state transitions and spawns; Data Layer swaps are queued and throttled via Scene Management's swap budget (not fired inline).
- **Per-cell calculation**: O(n) where n = active sources in range (typically 2–5)
- **Target CPU time**: <1.0 ms per near-tick sweep (every 10s), <2.0 ms per far-tick sweep (every 60s)
- **Infection data stored in** `UInfectionSpreadSubsystem : public UWorldSubsystem` — scoped to UWorld, not UGameInstance, to ensure infection state does not persist across world transitions
- **Pause behavior**: Infection ticks are suspended when GSM enters Paused or GameOver state. No catch-up ticks on resume — the next tick occurs at the normal interval from the resume time. Fast-travel simulation (Edge Cases) handles time-skips separately.

### States and Transitions

The system itself is stateless — it is a continuous simulation. However, each cell has a state machine:

| Cell State | Entry Condition | Exit Condition | Triggered Action |
|------------|----------------|----------------|-----------------|
| **Clean** | Initial state, or infection reduced to 0 by cure | Infection level ≥ 1 | Spawn 1–2 Spore Vents, fire OnCellExposed |
| **Exposed** | Infection level ≥ 1 | Infection level ≥ 25 OR reduced to 0 | At 25: roll for Biomass Node, fire OnCellPartial. At 0: destroy vents, fire OnCellCleansed |
| **Partial** | Infection level ≥ 25 | Infection level ≥ 50 OR reduced to < 25 | At 50: request Data Layer swap to DL_Infected, fire OnCellInfected. At <25: remove nodes, fire OnCellReceding |
| **Infected** | Infection level ≥ 50 | Infection level ≥ 75 OR reduced to < 50 | At 75: enable hive spawn eligibility, fire OnCellFullyInfected. At <50: request Data Layer swap to DL_Infection_Partial |
| **Fully Infected** | Infection level ≥ 75 | Infection level = 100 OR reduced to < 75 | At 100: queue hive spawn check. At <75: disable hive eligibility, fire OnCellReceding |
| **Hive Core** | Infection level = 100 AND hive spawned | Hive destroyed (infection level drops) | On hive destruction: cell reverts to Infected state, fire OnHiveDestroyed |

**State transition diagram:**

```
Clean → Exposed → Partial → Infected → Fully Infected → Hive Core
  ↑         ↑         ↑         ↑          ↑
  └─────────┴─────────┴─────────┴──────────┘
              (player cure reduces infection)
```

### Interactions with Other Systems

| System | Direction | Data Flow | Interface |
|--------|-----------|-----------|-----------|
| **Scene Management** | Writes | Infection Spread requests Data Layer swaps when cells cross state thresholds | `RequestDataLayerSwap(ZoneId, TargetLayer)` — defined in Scene Management GDD. Infection Spread is the primary caller of this API. |
| **Alien AI** | Writes | Infection Spread provides per-cell infection level for behavior scaling | `GetCellInfectionLevel(CellCoords)` returns 0–100. Replaces provisional `GetZoneInfectionLevel()` contract from Alien AI OQ-8. Alien AI queries the cell the alien currently occupies. |
| **Player Controller** | Reads | Receives OnCellStateChanged events for gameplay responses (e.g., camp threatened) | `SubscribeToCellStateChanged(FCellStateChangedDelegate)` — Player Controller can react to nearby cell changes. |
| **Combat System** | Reads + Writes | Combat destroys infection sources (HP reduction). Infection Spread tracks source HP independently. | `DamageInfectionSource(SourceId, Amount)` → returns `bDestroyed`. Infection Spread manages source HP, not Combat System. |
| **Inventory System** | Reads | Cure devices are inventory items. Infection Spread checks item availability before deployment. | `HasItem(ItemId)`, `ConsumeItem(ItemId)` — standard inventory interface. |
| **Save/Load System** | Reads + Writes | Infection Spread saves all cell infection levels, active source list, suppressant zones, and procedural spawn state. | `SaveInfectionState()`, `RestoreInfectionState()` — includes per-cell data, source positions, cure zone timers. |
| **Audio System** | Writes | Infection Spread fires audio events: OnCellStateChanged, OnHiveSpawned, OnSourceDestroyed, OnCureDeployed. | Audio events defined in Audio System GDD. Infection Spread is the event source. |
| **HUD System** | Reads | HUD reads nearby cell infection levels for display in tactical mode. | `GetNearbyCellInfectionLevels(PlayerPosition, Radius)` — returns array of (CellCoords, Level) for HUD rendering. |
| **Quest System** | Reads | Quest objectives may reference infection state (e.g., "cleanse the camp zone"). | `GetCellInfectionLevel(CellCoords)`, `GetActiveSourceCount(ZoneId)` — quest conditions read infection data. |
| **Physics System** | Reads | Terrain type affects infection spread modifier. | `GetTerrainTypeAt(Location)` — returns terrain classification for M_terrain calculation. |

**Interface Contract:**

```cpp
// --- Type definitions ---

// Unique identifier for each infection source (Hive, Node, Vent). FGuid is
// stable across save/load and works for both author-time and procedural sources.
using FSourceId = FGuid;

// Cell infection state enum — mirrors Rule 3 state table.
UENUM(BlueprintType)
enum class ECellInfectionState : uint8
{
    Clean           UMETA(DisplayName = "Clean"),
    Exposed         UMETA(DisplayName = "Exposed"),
    Partial         UMETA(DisplayName = "Partial"),
    Infected        UMETA(DisplayName = "Infected"),
    FullyInfected   UMETA(DisplayName = "Fully Infected"),
    HiveCore        UMETA(DisplayName = "Hive Core"),
};

// Payload fired when a cell transitions state.
USTRUCT(BlueprintType)
struct FCellStateChangedPayload
{
    GENERATED_BODY()
    UPROPERTY() FIntPoint CellCoords;
    UPROPERTY() ECellInfectionState OldState;
    UPROPERTY() ECellInfectionState NewState;
    UPROPERTY() float InfectionLevel;
};

DECLARE_MULTICAST_DELEGATE_OneParam(FCellStateChangedDelegate, const FCellStateChangedPayload&);

// Save/Load blob — all data needed to restore full infection simulation state.
USTRUCT()
struct FInfectionStateData
{
    GENERATED_BODY()
    UPROPERTY() TMap<FIntPoint, float> CellInfectionLevels;       // per-cell infection 0–100
    UPROPERTY() TArray<FInfectionSource> ActiveSources;            // position, type, HP, ID
    UPROPERTY() TArray<FCureZoneData> ActiveCureZones;             // position, T_remaining
    UPROPERTY() float ElapsedGameSeconds;                           // for W_time in Formula 4
    UPROPERTY() int32 GlobalHiveSpawnCooldownRemaining;
};

// --- Interface ---
// UHT requires I-class name = U-class name with U→I.
UINTERFACE(MinimalAPI, NotBlueprintable)
class UInfectionSpreadInterface : public UInterface { GENERATED_BODY() };

class IInfectionSpreadInterface
{
    GENERATED_BODY()
public:
    // Cell queries
    virtual float GetCellInfectionLevel(FIntPoint CellCoords) = 0;
    virtual ECellInfectionState GetCellState(FIntPoint CellCoords) = 0;
    virtual TArray<FCellInfectionData> GetNearbyCellInfectionLevels(FVector Location, float Radius) = 0;

    // Source management
    virtual int32 GetActiveSourceCount(FName ZoneId) = 0;
    virtual bool DamageInfectionSource(FSourceId SourceId, float Amount) = 0;  // returns true if source destroyed
    virtual TArray<FInfectionSource> GetSourcesInRadius(FVector Location, float Radius) = 0;

    // Player actions
    virtual bool DeployCure(FVector Location) = 0;  // returns false if player carries 0 cures
    virtual FDelegateHandle SubscribeToCellStateChanged(FCellStateChangedDelegate& Callback) = 0;
    virtual void Unsubscribe(FDelegateHandle Handle) = 0;

    // Save/Load is handled exclusively by IHostileSaveProvider (ADR-0013).
    // USaveLoadSubsystem calls PopulateSaveData() / LoadFromSaveData() on the
    // UInfectionSpreadSubsystem directly. No save/load methods are exposed on
    // IInfectionSpreadInterface to prevent dual save paths.
};
```

## Formulas

**Formula 1 — Per-Cell Infection Pressure**

The `cell_infection_pressure` formula calculates total pressure on a single cell from all active sources:

```
P_cell = Σ_{ d_i < R_i } [ H_i × (1 - (d_i / R_i)²) × M_terrain × M_weather ]
```

Summed over all active sources i where d_i < R_i (source is within its effective radius of the cell center).

**Variables:**

| Variable | Symbol | Type | Range | Source | Description |
|----------|--------|------|-------|--------|-------------|
| Source pressure output | H_i | float | 2–10 /sec | This GDD | Base pressure per source type (Hive=10, Node=5, Vent=2) |
| Distance source-to-cell | d_i | float | 0–R_i cm | Calculated | Distance from source position to cell center |
| Source radius | R_i | float | 1500–5000 cm | This GDD | Effective radius per source type |
| Terrain modifier | M_terrain | float | 0.5–1.5 | Physics System | Open ground=1.0, forest=1.3 (spores settle), water=0.5 (washed away), urban=1.2 (sheltered surfaces) |
| Weather modifier | M_weather | float | 0.7–1.3 | This GDD | Clear=1.0, rain=0.7 (washes spores), fog=1.3 (spores linger), storm=0.8 (wind disperses) |
| Cell pressure | P_cell | float | 0 to +30 | Calculated | Source pressure per second (excluding cure effects). Always ≥ 0. Combined with P_cure in Formula 2 to get net pressure. |

**Expected output range:** 0 to ~34 pressure/sec at maximum modifiers (M_terrain=1.5 × M_weather=1.3 × H_sum=17 = 33.15). Under neutral conditions (all modifiers=1.0) max is 17/sec. Source pressure only; cure effects tracked separately as P_cure in Formula 3.
**Edge case:** P_cell = 0 if no active sources are within range. P_cell cannot be negative — negative pressure comes from P_cure (Formula 3), not from sources.

**Example:** Cell center is 2000 cm from a Hive (R=5000, H=10), 1000 cm from a Node (R=2500, H=5), clear weather, open terrain, no cure:
- Hive contribution: 10 × (1 - (2000/5000)²) × 1.0 × 1.0 × 1.0 = 10 × 0.84 = 8.4
- Node contribution: 5 × (1 - (1000/2500)²) × 1.0 × 1.0 × 1.0 = 5 × 0.84 = 4.2
- P_cell = 8.4 + 4.2 = **12.6 pressure/sec**

---

**Formula 2 — Per-Tick Infection Accumulation**

The `infection_tick` formula updates a cell's infection level every 10 seconds:

```
I_new = clamp(I_old + ((P_cell / K_spread_rate) + P_cure) × T_tick, 0, 100)
```

**Variables:**

| Variable | Symbol | Type | Range | Source | Description |
|----------|--------|------|-------|--------|-------------|
| Previous infection level | I_old | float | 0–100 | This GDD | Cell's infection level before this tick |
| Cell pressure | P_cell | float | 0 to +30 | Formula 1 | Source pressure per second (excludes cure effects) |
| Spread rate divisor | K_spread_rate | float | 6.0 (near zone) / K_spread_rate_far=30.0 (far zone) | Tuning Knobs | Zone-dependent pacing divisor. Near-zone (within 8000cm): K_spread_rate=6.0. Far-zone: K_spread_rate_far=30.0. Separates urgency near the player from slow strategic spread off-screen. |
| Cure pressure | P_cure | float | ≤ 0 | Formula 3 | Negative pressure from active cure devices. 0 if no cures active. |
| Tick interval | T_tick | float | 10s (default) | This GDD | Time between infection updates |
| New infection level | I_new | float | 0–100 | Calculated | Cell's infection level after this tick |

**Expected output range:** 0 to 100.
**Example (no active cure):** I_old=30, P_cell=12.6, K_spread_rate=6.0, P_cure=0, T_tick=10 → I_new = clamp(30 + (12.6/6.0 + 0) × 10, 0, 100) = clamp(30 + 21, 0, 100) = **51**.

**Near-zone calibration (K_spread_rate=6.0):** A clean cell (I=0) with a single Spore Vent at cell center (d=0, max pressure):
- P_cell = 2 × (1 - 0) × 1.0 × 1.0 × 1.0 = 2.0/sec
- Per tick: 2.0 × 10 = 20 infection points
- Ticks to reach Exposed (1): 1 tick (10 seconds)
- Ticks to reach Partial (25): 2 ticks (20 seconds)
- Ticks to reach Infected (50): 3 ticks (30 seconds)
- Ticks to reach Fully Infected (75): 4 ticks (40 seconds)
- Ticks to reach Hive Core (100): 5 ticks (50 seconds) — raw source pressure before K_spread_rate division.

**Calibrated pacing example** with K_spread_rate=6.0:
- P_cell / K_spread_rate = 2.0 / 6.0 = 0.333/sec
- Per tick: 0.333 × 10 = 3.33 infection points
- Ticks to reach Exposed (1): 1 tick (10 seconds)
- Ticks to reach Partial (25): 8 ticks (80 seconds ≈ 1.3 minutes)
- Ticks to reach Infected (50): 15 ticks (150 seconds ≈ 2.5 minutes)
- Ticks to reach Fully Infected (75): 23 ticks (230 seconds ≈ 3.8 minutes)
- Ticks to reach Hive Core (100): 30 ticks (300 seconds = 5 minutes)

With a Hive at cell center (H=10, K=6.0):
- Effective P_cell = 10 / 6.0 = 1.667/sec
- Per tick: 16.67 infection points
- Ticks to Hive Core: 6 ticks (60 seconds = 1 minute)

**Far-zone calibration (K_spread_rate_far=30.0):** Far-zone cells use K_spread_rate_far=30.0 and T_tick=60s.

Signature moment calibration — camp cell at 4900cm from a Hive (near radius edge):
- P_cell = 10 × (1 − (4900/5000)²) = 10 × 0.0396 = 0.396/sec
- Per far-zone tick: (0.396 / 30.0) × 60 = **0.792 infection points per tick**
- Ticks to Infected (50): 63 ticks = **~63 minutes**
- Ticks to Fully Infected (75): 95 ticks = ~95 minutes

This delivers the Player Fantasy: a camp near the edge of a Hive's influence is "half-consumed" (Infected state) in ~63 minutes of real time. Nearby Hives (4000cm) reach Infected in ~14 minutes — a faster strategic threat. The distinction between "nearby Hive = urgent" and "distant Hive = slow strategic pressure" is maintained through K_spread_rate_far.

Near-zone cells use K_spread_rate=6.0 — a cell directly under a Hive becomes Hive Core in ~1 minute. Far-zone cells at the edge of a Hive's radius may take 60–90 minutes to reach Infected state. This creates the session-scale pacing: nearby infection is fast and urgent, distant infection is the slow strategic threat the player returns to.

---

**Formula 3 — Cure Suppressant Pressure**

The `cure_suppressant` formula calculates the negative pressure contribution from all active cure zones on a cell:

```
P_cure = -Σ_{ d_c < R_c } [ C_rate × (1 - (d_c / R_c)²) × T_remaining / T_max ]
```

Summed over all active cure devices c where d_c < R_c. P_cure is always ≤ 0. When P_cure is negative, infection level decreases — cells can transition back to lower states.

**Variables:**

| Variable | Symbol | Type | Range | Source | Description |
|----------|--------|------|-------|--------|-------------|
| Cure reversal rate | C_rate | float | 8/sec | This GDD | Negative pressure per second per cure device at full strength at center |
| Distance cure-to-cell | d_c | float | 0–R_c cm | Calculated | Distance from cure deployment point to cell center |
| Cure radius | R_c | float | 3000 cm | This GDD | Effective radius of suppressant zone |
| Time remaining | T_remaining | float | 0–300s | Calculated | Seconds until this cure expires |
| Cure max duration | T_max | float | 300s | This GDD | Maximum cure duration |
| Cure pressure | P_cure | float | ≤ 0 | Calculated | Net negative pressure from all active cures. Stacks additively with multiple overlapping cures. 0 if no cures active. |

**Expected output range:** -8 to 0/sec per cure device. With two overlapping cures at full strength: up to -16/sec.

**Example 1:** One cure at cell center (d=0), 150 seconds remaining:
- P_cure = -(8 × (1 - 0) × 150/300) = -(8 × 1 × 0.5) = **-4/sec**
- In Formula 2 (I_old=60, P_cell=5, K_spread_rate=6.0, T_tick=10): I_new = clamp(60 + (5/6.0 + (−4)) × 10, 0, 100) = clamp(60 − 31.7, 0, 100) = **28** (infection retreating)

**Example 2:** Two overlapping cures at cell center, both at full duration, no active sources (P_cell=0):
- P_cure = −(8 × 1 × 1) + −(8 × 1 × 1) = **-16/sec**
- In Formula 2 (I_old=50, P_cell=0, T_tick=10): I_new = clamp(50 + (0 + (−16)) × 10, 0, 100) = clamp(50 − 160, 0, 100) = **0** (full cleanse in one tick)

---

**Formula 4 — Procedural Hive Spawn Probability**

The `hive_spawn_probability` formula determines whether a hive spawns in an eligible cell:

```
P_spawn = clamp(K_base × W_distance × W_time × R_random, 0, 1)
```

Evaluated every 30 seconds for each eligible cell (infection level = 100, no existing hive, global cooldown expired, zone cap not reached).

**Variables:**

| Variable | Symbol | Type | Range | Source | Description |
|----------|--------|------|-------|--------|-------------|
| Base probability | K_base | float | 0.15 | This GDD | Base chance per evaluation cycle |
| Distance weight | W_distance | float | 1.0–2.0 | Calculated | clamp(2.0 − (distance_from_player / 5000), 1.0, 2.0). Closer cells are more likely to spawn — infection moves toward the player. At dist=0: W_distance=2.0 (maximum). At dist≥5000cm: W_distance=1.0 (baseline). |
| Time weight | W_time | float | 1.0–1.5 | Calculated | 1.0 + (minutes_since_game_start / 60), clamped to 1.5. Later in the game, hives spawn faster. |
| Random factor | R_random | float | 0.5–1.5 | Random | Uniform random multiplier. Adds unpredictability. |
| Spawn probability | P_spawn | float | 0.0–1.0 | Calculated | Chance this cell spawns a hive this cycle. |

**Expected output range:** 0.075 to ~0.68 at default K_base=0.15. The clamp to 1.0 only activates if K_base is tuned above ~0.22; at defaults it is dead code. Typical range: 0.1–0.5.
**Example:** Cell 1000 cm from player (a visited camp cell), 30 minutes into game, R_random=1.2:
- W_distance = clamp(2.0 − (1000/5000), 1.0, 2.0) = clamp(1.8, 1.0, 2.0) = 1.8
- W_time = 1.0 + (30/60) = 1.5
- P_spawn = clamp(0.15 × 1.8 × 1.5 × 1.2, 0, 1) = clamp(0.486, 0, 1) = **0.486**
- 48.6% chance this cycle. At 30-second intervals, expected time to spawn ≈ 62 seconds.

---

**Formula 5 — Biomass Node Spawn Check**

The `node_spawn_probability` formula:

```
spawn = (R_random < K_node)
```

Evaluated once when a cell transitions from Exposed (24) to Partial (25).

**Variables:**

| Variable | Symbol | Type | Range | Source | Description |
|----------|--------|------|-------|--------|-------------|
| Base probability | K_node | float | 0.4 | This GDD | Spawn threshold. 40% baseline chance. |
| Random factor | R_random | float | 0.0–1.0 | Random | Uniform random. Node spawns if R_random < K_node. |

**Expected spawn rate:** 40% per eligible cell transition.
**Example:** R_random=0.31 → 0.31 < 0.4 → Node spawns. R_random=0.72 → 0.72 < 0.4 is false → No spawn.

---

**Formula 6 — Zone Infection Aggregate**

The `zone_infection_level` formula provides a single aggregate value for a zone (used by systems that need zone-level data, like Alien AI's infection-aware behavior when zone-level granularity is sufficient):

```
I_zone = Σ (I_cell × A_cell) / Σ A_cell
```

Weighted average of all cell infection levels in the zone, weighted by cell area (all cells have equal area in World Partition, so this simplifies to arithmetic mean).

**Variables:**

| Variable | Symbol | Type | Range | Source | Description |
|----------|--------|------|-------|--------|-------------|
| Cell infection level | I_cell | float | 0–100 | This GDD | Infection level of each cell in the zone |
| Cell area | A_cell | float | constant | World Partition | All cells have equal area |
| Zone infection | I_zone | float | 0–100 | Calculated | Weighted average for the zone |

**Expected output range:** 0–100.
**Note:** This resolves Alien AI OQ-8. Alien AI can use `GetCellInfectionLevel()` for precise per-cell behavior, or `GetZoneInfectionLevel()` for zone-level scaling. Both are available.

## Edge Cases

| Scenario | Expected Behavior | Rationale |
|----------|------------------|-----------|
| **Player destroys the last infection source in a zone** | All cells stop accumulating. Infection levels freeze at current values. Cells do not decay. Player must deploy cures to reduce infection. | Infection is persistent — it doesn't heal on its own. This reinforces that the player must actively fight the infection, not just wait it out. |
| **Multiple cures overlap on the same cell** | P_cure terms stack additively (Formula 3). Two cures at full strength = P_cure = -16/sec. Three cures = P_cure = -24/sec. All additional stacking is useful — the floor is 0 (Formula 2 clamp), but each additional cure accelerates cleansing. | Stacking encourages precise cure overlapping. With carry limit of 2, double-stacking is the practical maximum in normal play. |
| **Hive spawns while player is in the same cell** | Hive emergence VFX plays over 8 seconds. Player can attack the hive during emergence (HP builds over the 8 seconds). Hive becomes fully active after emergence completes. | Gives the player a reaction window. The hive doesn't instantly appear at full strength — the player sees it forming and can respond. |
| **Cell reaches 100 but hive spawn is on cooldown** | Cell stays at Hive Core state (level 100) but no hive spawns yet. Hive spawns on next evaluation cycle when cooldown expires. Cell remains eligible. | Cooldown prevents cascade spawning. The cell is "ready" but waiting. |
| **Player deploys cure in a cell with no active infection** | Cure activates (P_cure = -8/sec) but infection level is already 0 — clamped to 0, no visible change. Cure timer still runs. | No penalty for "wasting" a cure — but the player learns through observation that cures work best on infected cells. |
| **Save/load mid-tick** | Current cell infection levels, active source list, suppressant zone timers, and procedural spawn state are all saved. On load, the next tick occurs at the normal interval from load time. | Infection simulation is deterministic given state — no tick alignment needed. |
| **Player fast-travels to a distant zone** | Far-zone cells continued ticking at 60s intervals during travel. On arrival, the catch-up pass applies any remaining elapsed ticks (bounded to K_catchup_max_ticks = 30 per cell). Hive spawns that would have occurred during travel are resolved. | The world doesn't pause. Fast-traveling away from infection doesn't stop it — it may have gotten worse while you were gone. |
| **All procedural hive slots in a zone are full (3/3)** | No new hives spawn in that zone until one is destroyed. Cells at level 100 remain eligible but are skipped. | Zone cap prevents runaway infection. Player can "hold back" the infection by destroying hives. |
| **Infection source destroyed during hive emergence** | If a Hive is destroyed during its 8-second emergence, the emergence cancels. The cell reverts to Fully Infected (75–99) state. DL_Hive_Core is not activated. | Player can interrupt hive spawning. Rewards fast reaction. |
| **Weather changes mid-tick** | Weather modifier updates on next tick. No mid-tick recalculation. Weather change effect is felt within 10 seconds. | Tick-based update is simpler and more performant than continuous weather response. |
| **Cell infection level exactly at threshold (e.g., 25.0)** | Threshold is inclusive on the lower bound: level ≥ 25 = Partial. Level 24.999 = Exposed. Floating-point comparison uses epsilon (0.001). | Prevents threshold flickering due to floating-point precision. |
| **Player has no cures but needs to slow infection** | Player must destroy sources instead. This is the intended design — cures are a luxury, source destruction is the primary counter-play. | Reinforces combat/exploration loop. Cures are a safety net, not a crutch. |
| **Cell is cleansed to 0, then re-infected by a nearby source** | Cell transitions from Clean (0) to Exposed (1), triggering Rule 7: 1–2 new Spore Vents spawn. Previously destroyed vents are permanently gone — these are new vents at new positions within the cell. | State transitions drive spawns, not individual vent identity. A cleansed cell that gets reinfected is a new infection event, not a continuation. |
| **Cure drives cell downward through a threshold (e.g., Infected → Partial)** | Cell state reverts (e.g., Infected → Partial). Biomass Nodes spawned at the Partial→Infected transition **persist** — they are not destroyed by cure-driven reversal. Only the Data Layer reverts. Player must destroy Nodes manually. | Reversal through cures reduces infection pressure but does not undo spawned actors. Rewards persistent source destruction over repeated cure use. |

## Dependencies

**Hard Dependencies** (system cannot function without):
- **Scene Management** ✅ (designed) — Infection Spread is the primary caller of `RequestDataLayerSwap()`. Without Scene Management's Data Layer infrastructure, infection state changes have no visual/audio manifestation.
- **Physics System** ✅ (designed) — provides terrain type for M_terrain modifier. Without it, M_terrain defaults to 1.0 (no terrain differentiation).

**Soft Dependencies** (enhanced by but works without):
- **Alien AI** ✅ (designed) — reads per-cell infection level for behavior scaling. Without it, alien behavior is infection-agnostic (still functional, less dynamic).
- **Inventory System** (Not Started) — provides cure devices. Without it, player cannot deploy cures (source destruction still works).
- **Audio System** (Not Started) — plays infection-related audio events. Without it, infection spread is silent (visual-only).
- **HUD System** (Not Started) — displays infection levels in tactical mode. Without it, player reads infection through environmental cues only (immersive mode).
- **Save/Load System** (Not Started) — persists infection state. Without it, infection resets on every load.
- **Combat System** ✅ (designed) — player attacks destroy infection sources via `DamageInfectionSource()`. Without it, sources are indestructible (infection is unstoppable). Note: Source HP is managed by Infection Spread System directly, not by Health System. Combat System applies damage; Infection Spread tracks HP and triggers destruction.
- **Quest System** (Not Started) — may reference infection state in objectives. Without it, no quest integration.

**Depended On By**:

| System | Interface Used | Expected Behavior |
|--------|---------------|-------------------|
| Alien AI | `GetCellInfectionLevel(CellCoords)`, `GetZoneInfectionLevel(ZoneId)` | Reads infection levels for behavior scaling per Rule 10 of Alien AI GDD |
| Player Controller | `SubscribeToCellStateChanged()` | Receives events for gameplay responses (camp threatened, route blocked) |
| HUD System | `GetNearbyCellInfectionLevels()` | Renders infection heatmap in tactical mode |
| Save/Load System | `SaveInfectionState()`, `RestoreInfectionState()` | Persists and restores full infection simulation state |
| Quest System | `GetCellInfectionLevel()`, `GetActiveSourceCount()` | Evaluates quest conditions related to infection |
| Audio System | OnCellStateChanged, OnHiveSpawned, OnSourceDestroyed, OnCureDeployed | Plays infection-related audio events |

## Tuning Knobs

| Parameter | Default | Safe Range | Effect of Increase | Effect of Decrease |
|-----------|---------|------------|-------------------|-------------------|
| `K_spread_rate` | 6.0 | 3.0–12.0 | Near-zone infection spreads slower | Near-zone infection spreads faster, more urgent |
| `K_spread_rate_far` | 30.0 | 12.0–60.0 | Far-zone infection much slower; signature moment delayed | Far-zone spreads faster; less time before return areas are transformed |
| `T_tick` | 10s | 5–30s | Less frequent updates, smoother feel | More frequent updates, more responsive but higher CPU |
| `H_hive_pressure` | 10/sec | 5–20/sec | Hives infect faster, more dangerous | Hives less threatening, easier to ignore |
| `H_node_pressure` | 5/sec | 2–10/sec | Nodes contribute more to spread | Nodes are ambient, not threatening |
| `H_vent_pressure` | 2/sec | 1–5/sec | Vents sustain infection longer | Vents die out quickly |
| `R_hive` | 5000 cm | 3000–8000 cm | Hives affect more cells | Hives are localized threats |
| `R_node` | 2500 cm | 1500–4000 cm | Nodes spread infection wider | Nodes are cell-local |
| `R_vent` | 1500 cm | 800–2500 cm | Vents affect adjacent cells | Vents only affect their own cell |
| `C_cure_rate` | 8/sec | 4–16/sec | Cures reverse infection faster | Cures need longer deployment to achieve reversal |
| `K_near_zone_radius` | 8000 cm | 5000–12000 cm | Larger near-zone, more CPU, better fidelity | Smaller near-zone, less CPU, faster degradation off-screen |
| `T_tick_far` | 60s | 30–120s | Far cells tick less often, more CPU savings | Far cells tick more often, smaller catch-up needed on approach |
| `T_catchup_max_seconds` | 1800s (30 min) | 600–3600s | Longer history simulated on arrival; more surprising transformations | Shorter catch-up window; less transformation during long absences |
| `R_cure` | 3000 cm | 1500–5000 cm | Cures cover more area (easier, less tactical) | Cures are pinpoint; require precise placement |
| `K_hive_min_spawn_dist` | 3000 cm | 1000–6000 cm | Hives more spread out; reduces cluster exploitation | Hives can spawn close together; higher local pressure |
| `T_cure_duration` | 300s | 120–600s | Cures last longer | Cures expire quickly, more resource pressure |
| `K_hive_spawn_base` | 0.15 | 0.05–0.30 | Hives spawn more frequently | Hives are rare, less procedural threat |
| `K_hive_cooldown` | 120s | 60–300s | Less time between hive spawns | More breathing room between spawns |
| `K_hive_zone_cap` | 3 | 1–6 | More hives per zone possible | Fewer hives, easier to manage |
| `K_node_spawn_chance` | 0.4 | 0.1–0.8 | More nodes spawn during spread | Fewer nodes, slower intermediate spread |
| `K_node_zone_cap` | 5 | 2–10 | More nodes per zone | Fewer nodes |
| `K_vent_count_on_expose` | 1–2 | 0–4 | More vents per newly exposed cell | Fewer vents, slower initial spread |
| `T_hive_emerge_duration` | 8s | 4–15s | Longer emergence window for player reaction | Faster emergence, less reaction time |
| `K_hive_hp` | 500 | 200–1000 | Hives are tankier, harder to destroy | Hives are fragile, easier to eliminate |
| `K_node_hp` | 150 | 50–300 | Nodes are tankier | Nodes are fragile |
| `K_vent_hp` | 50 | 20–100 | Vents are tankier | Vents are trivial to destroy |

## Visual/Audio Requirements

### Infection State Visual Progression (per cell)

| State | Visual | VFX | Lighting |
|-------|--------|-----|----------|
| **Clean** | Normal environment | None | Standard (per time of day) |
| **Exposed** | Subtle green tint on surfaces (material parameter) | Spore particles at cell edges (low density, 10–20/m³) | Post-process: chromatic aberration +0.2px, desaturation +5% |
| **Partial** | Visible biomass patches on ground and walls (additive mesh layer) | Spore density increases (30–50/m³), biomass pulse VFX on patches (2s cycle) | Post-process: chromatic aberration +0.5px, desaturation +15%, green volumetric fog at 5% |
| **Infected** | Full biomass coverage. Ground replaced with alien growth texture. Vegetation mutated. | Spore density high (80–120/m³), biomass tendrils animate on surfaces, ground-level fog | Alien Verdant lighting state. Volumetric fog green-yellow at 15%. Post-process: chromatic aberration +1.0px, desaturation +30% |
| **Fully Infected** | Bioluminescent nodes on biomass. Alien structures beginning to form (geo pods, organic arches). | Bioluminescent pulse VFX (3s cycle, green #3D6B2E with SSS), spore density max (150–200/m³), ground fog thick | Full Alien Verdant palette. Bioluminescent point lights scattered across cell. Volumetric fog at 25% |
| **Hive Core** | Full hive structure present (author-time mesh spawned at procedural location). Maximum biomass saturation. | Hive emits continuous spore cloud (particle system, 500/m³ within 500cm), bioluminescent aura, ground tremor VFX | Hive is a light source (green bioluminescence, radius 2000cm). Surrounding area lit by hive glow. Volumetric fog at 35% |

### Hive Emergence VFX (8 seconds)

| Phase | Duration | Visual | Audio |
|-------|----------|--------|-------|
| **Ground rupture** | 0–2s | Ground cracks, biomass erupts upward (particle + mesh animation) | Deep rumble (40Hz, -10dB, felt in subwoofer) |
| **Structure growth** | 2–5s | Hive mesh scales up from 0 to 1.0, biomass tendrils attach to surrounding surfaces | Organic growth sounds (wet, squelching, -14dB) |
| **Bioluminescence activation** | 5–7s | Hive lights up with green glow, bioluminescent nodes pulse on | High-frequency chittering (alien vocalization, -12dB) |
| **Steady state** | 7–8s | Hive fully active, spore cloud begins, ambient particles stabilize | Bio-drone establishes (continuous, -18dB at 5000cm) |

### Source Destruction VFX

| Source | Destruction Visual | Audio |
|--------|-------------------|-------|
| **Spore Vent** | Vent collapses, spore burst (white, dissipating), ground scar remains | Hiss → silence (1s fade, -16dB) |
| **Biomass Node** | Node shatters, biomass dissolves into dark slurry, persistent decal (fades 60s) | Organic collapse (wet crunch, -12dB) |
| **Alien Hive** | Hive structure crumbles, massive biomass dissolution, ground-level shockwave VFX, persistent scar (fades 300s) | Death vocalization (alien scream, -8dB), structural collapse rumble (40Hz, -10dB) |

### Cure Deployment VFX

| Phase | Duration | Visual | Audio |
|-------|----------|--------|-------|
| **Deployment** | 0–1s | Device plants into ground, blue-white energy pulse expands outward (radius 3000cm over 2s) | Device activation (mechanical click + energy hum, -14dB) |
| **Suppressant active** | 1–300s | Subtle blue-white shimmer at ground level within radius (material parameter, 10% opacity) | Low hum (continuous, -24dB, fades with distance) |
| **Expiration** | 0–2s | Shimmer fades, spore particles return, infection VFX resume | Hum fades to silence (2s fade) |

### Audio Events

| Event | Audio Description | Range | Priority |
|-------|------------------|-------|----------|
| **OnCellExposed** | Subtle bio-drone fades in at cell boundary | 5000cm | Low |
| **OnCellPartial** | Organic cracking and wet tearing sounds as biomass patches emerge (-16dB). Teaches the player (in immersive mode) that paths are changing. | 6000cm | Medium |
| **OnCellInfected** | Bio-drone volume increases, alien ambient sounds activate | 8000cm | Medium |
| **OnHiveSpawned** | Hive emergence audio (see table above) + controller rumble haptic pulse on emergence start | Zone-wide (15,000 cm attenuation radius) | High |
| **OnSourceDestroyed** | Source-specific destruction audio (see table above) | 3000cm | Medium |
| **OnCureDeployed** | Cure deployment audio (see table above) | 3000cm | Medium |
| **OnCellCleansed** | Bio-drone fades out, clean ambient audio returns | 5000cm | Low |

## UI Requirements

| Information | Display Location | Update Frequency | Condition |
|-------------|-----------------|-----------------|-----------|
| **Cell infection level (immersive)** | Environmental cues only (VFX, lighting, audio) | Continuous | Default mode |
| **Cell infection level (tactical)** | Minimap heatmap overlay | Every tick (10s) | Tactical HUD mode enabled |
| **Nearby source count** | Tactical HUD, bottom-right | Every 10s | Tactical HUD mode, sources within 5000cm |
| **Active cure zones** | Tactical HUD, blue circle on minimap | On deploy/expire | Tactical HUD mode |
| **Hive emergence warning** | Audio cue (zone-wide, 15,000 cm range) + controller rumble | On emergence start | Always (zone-wide audio + haptic) |
| **Camp threat indicator** | Quest UI / camp HUD | Every 30s | If camp cell infection level > 25 |

## Cross-References

| This Document References | Target GDD | Specific Element Referenced | Nature |
|--------------------------|-----------|----------------------------|--------|
| Data Layer swap API | `design/gdd/scene-management.md` | `RequestDataLayerSwap(ZoneId, TargetLayer)` | Data dependency |
| DL_Clean / DL_Infected layers | `design/gdd/scene-management.md` | Mutually exclusive Data Layer definitions | Rule dependency |
| Per-cell infection level for AI scaling | `design/gdd/alien-ai-system.md` | Rule 10 (Infection-Aware Behavior), OQ-8 resolution | Data dependency |
| Source HP and destruction | `design/gdd/combat-system.md` | Damage application to non-enemy targets | Rule dependency |
| Cure device as inventory item | `design/gdd/inventory-system.md` | Item definition, consumption | Data dependency |
| Terrain type modifier | `design/gdd/physics-system.md` | `GetTerrainTypeAt(Location)` | Data dependency |

## Acceptance Criteria

**Core Rules:**

- **GIVEN** a Spore Vent active at cell center, **WHEN** infection tick runs, **THEN** cell infection level increases by (H_vent / K_spread_rate) × T_tick = (2/6) × 10 = 3.33 points per tick, clamped to [0, 100].

- **GIVEN** a cell at infection level 24, **WHEN** next tick pushes level to ≥ 25, **THEN** cell state transitions to Partial, DL_Infection_Partial additive layer activates, OnCellPartial event fires, and a Node spawn roll executes per Formula 5. **GIVEN** RNG seeded to produce R_random=0.31, **THEN** Biomass Node spawns (0.31 < K_node=0.4). **GIVEN** RNG seeded to produce R_random=0.72, **THEN** no Node spawns.

- **GIVEN** a cell at infection level 49, **WHEN** next tick pushes level to ≥ 50, **THEN** Scene Management receives `RequestDataLayerSwap(ZoneId, DL_Infected)`, cell state transitions to Infected, alien patrols become active in that cell.

- **GIVEN** a cell at infection level 100 with no hive, **WHEN** 30-second spawn check runs and cooldown/cap allow, **THEN** P_spawn is calculated per Formula 4. **GIVEN** inputs matching the Formula 4 example (cell 1000cm from player, 30 min, K_base=0.15) and RNG seeded to R_spawn=0.40, **THEN** spawn occurs (0.40 < P_spawn=0.486) and hive emerges over 8 seconds, DL_Hive_Core activates, OnHiveSpawned fires. **GIVEN** R_spawn=0.60, **THEN** no spawn (0.60 > 0.486).

- **GIVEN** player destroys an active infection source, **WHEN** next infection tick runs, **THEN** that source's pressure contribution is zero, affected cells show reduced P_cell, infection accumulation slows or reverses.

- **GIVEN** player deploys a cure at location L, **WHEN** infection tick runs for cells within 1500cm of L, **THEN** P_cure < 0 for those cells, adding negative pressure. A cell at the cure center with no active sources sees I_new decrease by 80 points per tick (P_cure = -8/sec × T_tick=10, clamped to 0).

- **GIVEN** two cure zones overlapping on the same cell, both at full strength and no active sources, **WHEN** infection tick runs, **THEN** P_cure = -16/sec and I_new = 0 in one tick from any starting level ≤ 160. Each additional overlapping cure stacks further (P_cure = -24/sec for three, etc.); Formula 2 clamp to 0 is the only floor.

- **GIVEN** a cure zone expires (T_remaining = 0), **WHEN** next infection tick runs, **THEN** P_cure recalculates excluding that cure's term. If no other cures are active, P_cure = 0 and infection accumulation resumes at the rate determined by active sources alone.

**Formulas:**

- **GIVEN** Formula 1 (P_cell), **WHEN** cell is 2000cm from Hive (H=10, R=5000) and 1000cm from Node (H=5, R=2500), clear weather, open terrain, no cure, **THEN** P_cell = 8.4 + 4.2 = 12.6 pressure/sec.

- **GIVEN** Formula 2 (infection tick), **WHEN** I_old=30, P_cell=12.6, T_tick=10, K_spread_rate=6.0, **THEN** effective P_cell = 12.6/6.0 = 2.1, I_new = clamp(30 + 2.1×10, 0, 100) = 51.

- **GIVEN** Formula 3 (cure suppressant), **WHEN** one cure at cell center (d=0), 150s remaining, **THEN** P_cure = -(8 × 1 × 150/300) = **-4/sec**.

- **GIVEN** Formula 4 (hive spawn), **WHEN** cell 1000cm from player, 30 minutes into game, R_random=1.2, **THEN** W_distance = clamp(2.0 − 1000/5000, 1.0, 2.0) = 1.8, W_time=1.5, P_spawn = clamp(0.15 × 1.8 × 1.5 × 1.2, 0, 1) = 0.486.

- **GIVEN** Formula 6 (zone aggregate), **WHEN** zone has 16 cells with infection levels [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 100, 100, 50, 25, 0], **THEN** I_zone = sum/16 = 825/16 = 51.56.

**Performance:**

- **GIVEN** all near-zone cells (within 8,000 cm of player) and 5 active sources, **WHEN** near-zone tick runs (every 10s), **THEN** total CPU time < 1.0ms on game thread.

- **GIVEN** max 3 procedural hives per zone, 5 nodes, 10 vents, **WHEN** all sources active, **THEN** memory footprint < 2MB for infection state data.

**Edge Cases:**

- **GIVEN** last infection source in zone destroyed, **WHEN** infection tick runs, **THEN** all cells in zone show P_cell = 0, infection levels freeze. No natural decay occurs.

- **GIVEN** hive emergence in progress (8 seconds), **WHEN** hive HP reaches 0 during emergence, **THEN** emergence cancels, cell reverts to Fully Infected state, DL_Hive_Core not activated.

- **GIVEN** player fast-travels 10 minutes away, **WHEN** arrival completes, **THEN** far-zone cells apply the analytical catch-up formula using elapsed_seconds=600 (bounded by T_catchup_max_seconds=1800). State transitions that would have occurred are fired. Data Layer swaps are queued and throttled via Scene Management.

- **GIVEN** cell infection level at exactly 25.0, **WHEN** state queried, **THEN** state = Partial (threshold inclusive on lower bound, epsilon 0.001).

- **GIVEN** all 3 procedural hive slots in zone are full, **WHEN** another cell reaches level 100, **THEN** cell is eligible but skipped. Hive spawns only after a slot opens (hive destroyed).

**Cross-System:**

- **GIVEN** cell transitions to Infected (level ≥ 50), **WHEN** Scene Management queried, **THEN** `RequestDataLayerSwap` was called with DL_Infected, swap completes within T_swap budget per Scene Management Formula 3.

- **GIVEN** Alien AI queries `GetCellInfectionLevel()` for cell at level 75, **WHEN** infection behavior modifier calculated, **THEN** M_infection uses I_cell=75 per Alien AI Formula 3 (not zone average).

- **GIVEN** cure deployed, **WHEN** Inventory System queried, **THEN** cure item count decremented by 1. If count was 0, deployment fails and returns false.

## Open Questions

| # | Question | Owner | Deadline | Resolution |
|---|----------|-------|----------|-----------|
| OQ-1 | Should infection spread pause when the game is paused (GSM Paused state)? Or does infection continue in real-time regardless? | design | Architecture ADR | ✅ Resolved: Ticks pause when GSM Paused. No catch-up on resume. See Rule 8. |
| OQ-2 | What is the maximum number of World Partition cells in the largest zone? This affects worst-case tick performance. | engine-programmer | Level design finalization | |
| OQ-3 | Should the player receive any explicit notification when a hive spawns procedurally (e.g., controller rumble, subtle screen effect), or should it be purely audio/environmental? | design | UX spec review | ✅ Resolved: Audio + controller rumble. Zone-wide audio audible across the zone (15,000 cm attenuation radius). Haptic pulse fires on emergence start. No screen glow — player uses audio to orient. See Rule 5 and Audio Events. |
| OQ-4 | Can the player observe infection spread in real-time from a distance (e.g., watching a cell transition while on a hill), or is it only noticeable when entering the cell? | design | Playtest | |
| OQ-5 | Should cure devices be craftable (Crafting System) or only found as loot? This affects resource availability and strategic depth. | economy-designer | Crafting System GDD | ✅ Resolved: Loot-only. Player carries a maximum of 2. Found rarely (1 per major area). Source destruction is the primary counter-play; cures are emergency tools, not a routine resource. |
| OQ-6 | If the player returns to a cleansed cell (infection reduced to 0), should Spore Vents respawn if a nearby source re-infects the cell? Or are destroyed vents permanently gone? | design | GDD review | ✅ Resolved: New vents spawn on Clean→Exposed transition. Old vents are gone. See Edge Cases table. |
| OQ-7 | Should the infection spread rate scale with game difficulty setting? (e.g., faster spread on Hard, slower on Easy) | design | Difficulty curve spec | |

---

## Design Review Findings

> **Date**: 30 April 2026
> **Reviewer**: design-review skill
> **Verdict**: PASS (with minor corrections — resolved below)

### Completeness
- **8/8 required sections** present and substantive
- Bonus sections: Visual/Audio Requirements, UI Requirements, Cross-References, Acceptance Criteria (Gherkin), Tuning Knobs (20 parameters)

### Issues Found & Resolved

| # | Issue | Severity | Status | Resolution |
|---|-------|----------|--------|------------|
| 1 | OQ-1 (pause behavior) unresolved — blocker for tick loop design | Must Fix | ✅ Resolved | Infection ticks **pause** when GSM enters Paused state. On resume, tick interval resets (no catch-up). Rationale: Paused means frozen world state. Fast-travel simulation handles time-skips separately. |
| 2 | MVP scope mismatch with game-concept.md ("scripted events" vs. procedural) | Should Clarify | ✅ Resolved | Added MVP Scope section below. MVP = procedural system active but limited to one zone, hive spawn cap = 1, no procedural node spawning (Nodes author-time only). Full procedural spread unlocked at Vertical Slice. |
| 3 | OQ-6 (vent respawn) — logical gap for cleansed-then-reinfected cells | Should Clarify | ✅ Resolved | When a cell is reduced to 0 (Cleansed) and later re-enters Exposed state (level ≥ 1), new Spore Vents spawn per Rule 7. Destroyed vents are permanently gone, but the *state transition* triggers fresh vent spawns. This means a cleansed cell that gets reinfected will have new vents, not the old ones. |
| 4 | Health System dependency not listed for source HP | Should Document | ✅ Resolved | Source HP is managed by Infection Spread System directly (not Health System). Combat System calls `DamageInfectionSource()` which reduces HP internally. Dependencies table updated to clarify: Combat System → Writes (damage application), Health System → Not involved (sources are not actors with health components). |

### MVP Scope

The game-concept.md defines MVP infection spread as "one zone, scripted events." This GDD describes the full procedural system. The MVP subset is:

| Feature | MVP | Full Vision |
|---------|-----|-------------|
| Infection sources | Author-time Hives + Vents only | Procedural Hives, Nodes, Vents |
| Spread model | Pressure-based (same formulas) | Pressure-based (same formulas) |
| Zone scope | One zone only | All zones |
| Hive spawn cap | 1 (author-time only) | 3 procedural per zone |
| Node spawning | Author-time only | Procedural on Exposed→Partial transition |
| Vent spawning | Author-time only | Procedural on Clean→Exposed transition |
| Player cures | Available, functional | Available, craftable (Crafting System) |
| Data Layer swaps | Clean ↔ Infected only | All 6 states with additive layers |

The architecture is the same — only the procedural spawning and multi-zone scope are deferred. This means no rework is needed between MVP and Full Vision; the deferred features are configuration changes and additional spawn logic.

---

## Consistency Check Findings

> **Date**: 30 April 2026
> **Reviewer**: consistency-check skill (cross-reference with Alien AI System and Scene Management GDDs)
> **Verdict**: PASS

### Cross-Document Alignment

| Check | Status | Notes |
|-------|--------|-------|
| Alien AI OQ-8 resolution | ✅ Aligned | Alien AI GDD references `GetZoneInfectionLevel()`. This GDD provides both `GetCellInfectionLevel()` (per-cell) and `GetZoneInfectionLevel()` (Formula 6 aggregate). Contract satisfied. |
| Scene Management Data Layer API | ✅ Aligned | Scene Management GDD defines `RequestDataLayerSwap(ZoneId, TargetLayer)`. This GDD is the primary caller. DL_Clean/DL_Infected layer names match. |
| Infection state thresholds | ✅ Aligned | Cell states (0, 1-24, 25-49, 50-74, 75-99, 100) are consistent with Alien AI's infection-aware behavior scaling (Rule 10 uses I_zone 0-100 linear scale). |
| Alien AI infection coefficients | ⚠️ Note | Alien AI Rule 10 uses zone-level infection for behavior scaling. This GDD's Formula 6 provides zone aggregate. If Alien AI switches to per-cell scaling, coefficients may need retuning. |
