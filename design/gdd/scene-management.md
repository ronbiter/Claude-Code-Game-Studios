# Scene Management

> **Status**: In Design
> **Author**: user + agents
> **Last Updated**: 29 April 2026
> **Implements Pillar**: Pillar 1 (Hostile World) — seamless world streaming

## Overview

The Scene Management system is the infrastructure that governs how Hostile World's environments load, stream, and transition as the player moves through the mountain prison, infected towns, and open world zones. Built on Unreal Engine 5.7's World Partition system, it manages the seamless streaming of world cells, coordinates loading transitions with the Game State Machine, and controls runtime content activation through Data Layers. When the player walks from a clean zone into an infected area, Scene Management streams in the transformed environment without a loading screen — the world mutates around them. When crossing between major zones, it coordinates with the GSM's Loading state to present a seamless transition with the heartbeat pulse animation. This system has no direct player-facing interface, but its failures break Pillar 1 (Hostile World) instantly — a visible loading screen or pop-in shatters the illusion of a living, transforming world.

**Key responsibilities:**
1. World cell streaming via World Partition (automatic, distance-based)
2. Zone transition coordination with GSM (Loading ↔ Playing)
3. Data Layer management for dynamic world states (infected vs. clean, destroyed vs. intact)
4. Async asset loading during GSM Loading state
5. Scene state persistence (what's been destroyed, what's changed)

## Player Fantasy

The player experiences Hostile World as a single, continuous place — not a collection of levels stitched together by loading screens. The world exists whether the player is looking at it or not. It transforms around them in real time, without interruption, without asking them to wait.

When the player crosses from a Clean Zone into an Infected Zone, the environment changes while they keep walking. Vegetation mutates. Lighting shifts. Audio crossfades. The world does not pause. It does not fade to black. It simply *is* different on the other side of an invisible line.

This seamlessness is not a technical feature — it is a narrative one. The infection is not a separate area. It is a contiguous reality that bleeds into everything. The player should feel, viscerally, that the world is one thing, and it is changing.

**Anchor Moment:** The first Clean-to-Infected zone crossing. The player walks through an invisible boundary and the world transforms around them in real time. No loading screen. No fade. No interruption. The only indication is environmental — the air looks different, sounds different, feels different. The GSM heartbeat pulse provides a subtle visual confirmation that the world is working to stay alive around them.

**Emotional Target:** Unease. The seamless transition is itself unsettling — it tells the player that the infection is not contained, not separate, but contiguous. The world is one thing, and it is changing.

This serves **Pillar 1 (Hostile World)** — the world transforms without asking permission. **Pillar 2 (Earned Discovery)** — the player discovers infection by walking into it, not through a loading screen announcement. **Pillar 3 (Tense Survival)** — losing control to a loading screen breaks tension; seamlessness maintains it.

## Detailed Design

### Core Rules

**Rule 1 — World Partition is the Single Streaming Authority**
All world geometry streams through World Partition. No manual level streaming overlaps with World Partition. The mountain prison is a separate World (Level); the open world uses a single World Partition. Transition from prison → open world uses a GSM-coordinated level transition with loading screen.

**Rule 2 — Cell Configuration**
- Cell size: 25,200,000 cm (2520m) — set at project creation, immutable.
- Streaming distance: 2 cells (5040m radius) — player sees 1 cell ahead in each direction.
- Simultaneous cells loaded: 5 (center + 4 surrounding).
- Movement prediction: pre-loads cells 2 seconds ahead of player velocity vector.
- Actor count per cell: < 500 actors (use HLOD, instanced meshes, Nanite to reduce).

**Rule 3 — Zone Definition**
Zones are logical groupings of World Partition cells, identified by Runtime Grid Tags. Zone boundaries are invisible — no hard level borders. Environmental transitions (lighting, audio, Data Layers) signal zone changes to the player.

| Zone ID | Name | Est. Cells | Type |
|---------|------|-----------|------|
| Z01 | Mountain Prison | 9 (3×3) | Separate World (linear tutorial) |
| Z02 | Infected Town | 16 (4×4) | Open World |
| Z03 | Resistance Camp | 4 (2×2) | Open World (hub) |
| Z04 | Alien Hive | 9 (3×3) | Open World |
| Z05 | Dead Zone (wilderness) | 25 (5×5) | Open World (sparse) |

**Rule 4 — Data Layer Strategy**
Data Layers control runtime content activation. Two categories:

*Mutually Exclusive Layers (only one active at a time):*
- `DL_Clean` / `DL_Infected` — zone state (clean vs. infected)
- `DL_Destroyed` / `DL_Intact` — building integrity
- `DL_Lighting_Clean` / `DL_Lighting_Infected` — lighting state

*Additive Layers (can coexist):*
- `DL_Patrols` — enemy patrol routes
- `DL_Events` — dynamic encounters
- `DL_Weather` — weather effects
- `DL_Infection_Partial` — early-stage biomass patches (activated at cell infection level 25–49, additive to DL_Clean)
- `DL_Infected_Advanced` — bioluminescent nodes and alien structures (activated at cell infection level 75–99, additive to DL_Infected)
- `DL_Hive_Core` — full hive structure (activated at cell infection level 100, additive to DL_Infected)

Data Layer swaps are asynchronous (0.5–2.0s latency). Clean→Infected transition: unload Clean, wait for streaming flush, load Infected. HLOD is generated for both Clean and Infected layers at build time.

**Rule 5 — Loading Coordination with GSM**
Three loading protocols:
1. **Seamless Zone Crossing** (within 4 cells / 10,080m): No GSM state change. World Partition streams automatically. Fires `OnZoneCrossed(FromZone, ToZone)` event.
2. **Coordinated Loading** (beyond 4 cells / fast-travel): GSM enters Loading state. Scene Management uses `FStreamableManager` to async-load non-world assets (UI, audio, data tables). World geometry streams via World Partition. Target: 5–15s. 30-second timeout — proceeds with partial load if exceeded.
3. **Level Transition** (prison → open world): Full level load. GSM Loading state with deep inhale animation (1.5s).

**Rule 6 — Scene State Tracking**
Tracked per cell, persisted to save:
- Infection state (Clean/Infected/Partial)
- Building integrity (Destroyed/Intact per actor)
- Event completion flags
- Discovery flags (locations found, clues gathered)
- Loot state (collected vs. available)

Session-only (regenerated on load):
- Patrol positions
- Weather state
- Transient AI spawns

Physics integration: `OnObjectDestroyed()` → records destruction → activates `DL_Destroyed` → deactivates `DL_Intact` (real-time, no GSM transition).

**Rule 8 — Time of Day**
Scene Management is the sole owner of the game clock and `GetTimeOfDay()`. Time of day is a float in [0.0, 24.0) representing in-game hours. One real-time minute equals one in-game hour at default rate (1:60 real-to-game ratio, tunable). The clock advances only when GSM state is Playing — it freezes in Paused, Dialogue, Inventory, Cutscene, and GameOver. The current time is broadcast via `OnTimeOfDayChanged(float NewHour)` once per in-game hour.

Four systems consume time of day:
- **Stealth System** — Rule 4 lighting modifier (`GetTimeOfDay()` → darkness window 20:00–06:00)
- **Investigation System** — Time Gate clues (require time-of-day range to unlock)
- **Alien AI System** — patrol density modifier (heavier patrols 22:00–04:00)
- **HUD System** — Tactical mode clock display

No system may own or advance the clock independently. All callers read `GetTimeOfDay()` from `ISceneManagementSubsystem`.

**Rule 7 — Streaming Priority**
Priority order (highest to lowest):
1. Player-proximate geometry (current cell)
2. Collision meshes
3. Navmesh data
4. Nearby actors (direction of travel)
5. Medium LOD geometry
6. VFX systems
7. Audio sources
8. Distant AI
9. HLOD geometry
10. Foliage / detail
11. Non-critical Data Layers

Memory pressure levels:
- **Normal** (<70% streaming pool): All priorities active.
- **Elevated** (70–85%): Deactivate priorities 10–11.
- **High** (85–95%): Deactivate priorities 8–11.
- **Critical** (>95%): Deactivate priorities 6–11, log warning.

I/O bandwidth: max 8 concurrent requests, 60/40 split (World Partition / Data Layers).

### States and Transitions

| State | Description | Trigger | Exit Condition |
|-------|-------------|---------|----------------|
| **Idle** | Normal streaming, no active transitions | Default state in Playing | Loading request received |
| **Streaming** | Active cell/Data Layer loading | Player moves into new cell range, Data Layer swap requested | All requested assets loaded |
| **ZoneTransition** | Crossing between major zones | Player crosses zone boundary trigger | Target zone cells loaded, OnZoneCrossed fired |
| **LevelLoading** | Full level load (prison→open world) | GSM Loading state + level transition requested | Level fully loaded, GSM Playing |
| **MemoryPressure** | Streaming pool approaching limit | Memory >70% of streaming pool | Memory drops below 70% |

**State Machine Rules:**
- Idle → Streaming: automatic, triggered by player movement
- Idle → ZoneTransition: automatic, triggered by zone boundary
- Idle → LevelLoading: GSM-coordinated
- Streaming → MemoryPressure: automatic, triggered by memory threshold
- MemoryPressure → Streaming: when memory drops below threshold (deactivations complete)
- ZoneTransition → Idle: when target zone fully streamed
- LevelLoading → Idle: when level load complete, GSM transitions to Playing

**Data Layer Swap States:**
- `DL_Idle` → `DL_Unloading` → `DL_Flushing` → `DL_Loading` → `DL_Active`
- Each step has a completion callback. If any step fails, rollback to previous stable state.

### Interactions with Other Systems

| System | Direction | Data Flow | Interface Used |
|--------|-----------|-----------|----------------|
| Game State Machine | Reads + writes | Scene Management requests Loading/Playing transitions; GSM notifies via `OnTransitionStarted` | `RequestStateTransition()`, `OnTransitionStarted` |
| Physics System | Reads | Receives `OnObjectDestroyed()` events for scene state updates | `SubscribeToImpact()` |
| Infection Spread System | Writes | Scene Management exposes Data Layer swap API; Infection Spread requests Clean→Infected transitions | `RequestDataLayerSwap(ZoneId, TargetLayer)` |
| Map System | Reads | Scene Management provides zone boundary data, discovered location flags | `GetZoneBounds()`, `GetDiscoveredLocations()` |
| Save/Load System | Reads + writes | Scene Management saves/restores Data Layer states, destroyed actors, zone infection levels | `SaveSceneState()`, `RestoreSceneState()` |
| Camera System | Reads | Scene Management fires `OnZoneCrossed()` for camera environmental effects | `OnZoneCrossed(FromZone, ToZone)` |
| Alien AI System | Reads | Scene Management provides zone state (Clean/Infected) for AI behavior selection | `GetZoneState(ZoneId)` |
| HUD System | Reads | Scene Management provides current zone name, streaming state for debug HUD | `GetCurrentZone()`, `GetStreamingState()` |

**Interface Contract:**

```cpp
// Scene Management public interface (C++ sketch)
class ISceneManagementSubsystem {
    // Zone queries
    FName GetCurrentZone();
    FZoneState GetZoneState(FName ZoneId);
    TArray<FName> GetAdjacentZones(FName ZoneId);
    
    // Data Layer management
    void RequestDataLayerSwap(FName ZoneId, FName TargetLayer);
    bool IsDataLayerActive(FName DataLayerName);
    
    // Streaming
    FStreamingState GetStreamingState();
    float GetStreamingProgress();
    
    // Events
    FDelegateHandle SubscribeToZoneCrossed(FZoneCrossedDelegate Callback);
    FDelegateHandle SubscribeToDataLayerChanged(FDataLayerChangedDelegate Callback);
    void Unsubscribe(FDelegateHandle Handle);
    
    // Time of day (Rule 8 — sole owner)
    float GetTimeOfDay();                                              // returns 0.0–24.0 in-game hours
    FDelegateHandle SubscribeToTimeOfDayChanged(FTimeOfDayDelegate Callback);  // fires once per in-game hour

    // Save/Load
    FSceneStateData SaveSceneState();
    void RestoreSceneState(const FSceneStateData& State);
}
```

## Formulas

**Formula 1 — Streaming Cell Count (Velocity-Adaptive)**

`N_cells = clamp(2 + (|V| / 630) × 1, 2, 3)`

**Variables:**
| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| Player speed magnitude | \|V\| | float | 0–630 cm/s | 0 = idle, 630 = max sprint |
| Base cells | N_base | const | 2 | Minimum cells at standstill |
| Velocity bonus | N_vel_bonus | const | 1 | Additional cells at max speed |
| Result cells | N_cells | int | 2–3 | Cells to preload ahead of player |

**Output Range:** 2 (standing still) to 3 (any movement). Ceiled to integer.
**Example:** Sprinting at 630 cm/s → clamp(2 + 630/630 × 1, 2, 3) = 3 cells ahead.

---

**Formula 2 — Streaming Pool Utilization**

`P_mem = clamp((M_used / M_pool_max) × 100, 0, 100)`

**Variables:**
| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| Memory used | M_used | float | 0–M_pool_max MB | Currently allocated streaming memory |
| Pool max | M_pool_max | const | platform-dependent | 4096 MB (PC high), 2048 MB (PC med), 3072 MB (PS5), 1536 MB (PS4) |
| Utilization % | P_mem | float | 0–100% | Current streaming pool utilization |

**Output Range:** 0–100%. Drives pressure level: Normal (<70%), Elevated (70–85%), High (85–95%), Critical (>95%).
**Example:** M_used=2900 MB, M_pool_max=4096 MB → (2900/4096)×100 = 70.8% → Elevated.

---

**Formula 3 — Data Layer Swap Time Estimate**

`T_swap = 0.1 + N_actors × 0.002 + (S_total / 100) × 0.05`

**Variables:**
| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| Affected actors | N_actors | int | 0–500 | Actors activated + deactivated |
| Asset size | S_total | float | 0–2000 MB | Total asset size being swapped in |
| Base overhead | T_base | const | 0.1s | State machine transition, callback setup |
| Per-actor cost | T_per_actor | const | 0.002s | Per-actor registration/deregistration |
| Per-asset cost | T_per_mb | const | 0.05s | Time per 100 MB of asset streaming |
| Swap time | T_swap | float | 0.1–10.0s | Estimated complete swap time |

**Output Range:** 0.1s (minimal change) to 10.0s (cap — beyond this, use GSM Loading screen).
**Example:** Clean→Infected town (200 actors, 500 MB) → 0.1 + 200×0.002 + (500/100)×0.05 = 0.75s.

---

**Formula 4 — Zone Transition Trigger Distance**

`D_trigger = 4 × 25,200,000 = 100,800,000 cm (10.08 km)`

Constant. When the player is within 10.08 km of a zone boundary, the system begins preloading the target zone's cells. At max sprint (630 cm/s), this gives ~44 minutes of lead time.

---

**Formula 5 — HLOD Activation Distance**

`D_hlod = 25,200,000 × K_hlod` where K_hlod is a tuning knob [8–12].

**Variables:**
| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| Cell size | C | const | 25,200,000 cm | World Partition cell size |
| HLOD multiplier | K_hlod | float | 8–12 | Tunable per zone density |
| HLOD distance | D_hlod | float | 2016–3024m | Distance at which HLOD replaces regular geometry |

**Output Range:** 2016m (dense urban, K=8) to 3024m (sparse wilderness, K=12). Default: 2520m (K=10).
**Example:** Infected Town (dense) → K=8 → D_hlod = 25,200,000 × 8 = 201,600,000 cm = 2016m.

## Edge Cases

- **If player teleports (fast-travel or debug command)**: Flush all streaming cells, cancel in-flight Data Layer swaps, force-load target zone. If target zone fails to load within 30s, show greybox fallback and log error. Rationale: Teleport invalidates all streaming predictions — clean slate required.

- **If Data Layer swap fails mid-way**: Rollback to previous stable state (re-activate unloaded layer, deactivate partially loaded layer). 5s retry cooldown. If same swap fails 3 times, mark zone as permanently blocked and notify player via GSM Loading screen. Rationale: Partial swaps leave the world in an inconsistent state — rollback is safer than partial completion.

- **If player sprints directly at zone boundary at max speed**: Seamless transition (4-cell threshold = 10.08km lead time = 44 minutes at max sprint). No special handling needed — World Partition preloads cells ahead of velocity vector per Formula 1.

- **If memory pressure hits Critical during a Data Layer swap**: Swap continues on reserved 40% I/O bandwidth. If the swap itself caused the Critical pressure, abort swap, rollback to previous state, and trigger memory pressure deactivation (priorities 6–11). Rationale: A swap that causes Critical pressure is too large for seamless — should have used GSM Loading.

- **If player dies during zone transition**: Preserve partially loaded cells. On respawn, if respawn location is within the target zone, resume loading. If respawn is in a different zone, flush all cells and load respawn zone. Rationale: Death doesn't invalidate world state — but respawn location determines what needs to be loaded.

- **If two zones request Data Layer swaps simultaneously**: Serialize by player proximity (closest zone first). Max queue depth: 4. Excess requests dropped and logged. Rationale: Concurrent swaps compete for I/O bandwidth — serialization prevents starvation.

- **If save file references destroyed actors that no longer exist in the world**: Skip missing actors with warning. If >10% of saved actor references are missing, show "world state mismatch" notification and load with default zone state. Rationale: Content updates may remove actors — save files must be forward-compatible.

- **If player stands exactly on a zone boundary**: Deterministic tiebreaker — higher infection level wins (Infected > Clean). 5m crossfade zone blends both states visually. Rationale: Player should never experience a hard seam — the boundary is a gradient, not a line.

- **If HLOD fails to generate for an Infected layer**: Fall back to regular LODs for that zone. If >20% of zones lack HLOD, show debug HUD warning. Rationale: HLOD is a performance optimization, not a functional requirement — game works without it, just with higher draw calls.

- **If SSD is slower than 200MB/s**: Switch all zone crossings to Coordinated Loading (GSM Loading state). Retry detection every 60s with exponential backoff. Rationale: Slow storage cannot sustain seamless streaming — must use loading screens to prevent pop-in.

- **If player rapidly oscillates across zone boundary**: 3.0s debounce on Data Layer swaps (longer than T_swap max of 2.0s). Rapid boundary crossing fires OnZoneCrossed only once per 3.0s window. Rationale: Prevents thrashing — the world should not flicker between states.

- **If Data Layer swap is requested for a cell currently unloading**: Defer swap to scene state tracker. Apply on next cell load. Rationale: Cannot swap what isn't loaded — but the intent should persist.

## Dependencies

**Hard Dependencies** (system cannot function without):
- **Game State Machine** ✅ (designed) — Scene Management coordinates Loading/Playing transitions via `OnTransitionStarted` and `RequestStateTransition()`. GSM state determines when loading is permitted.

**Soft Dependencies** (enhanced by but works without):
- **Physics System** ✅ (designed) — receives `OnObjectDestroyed()` events for scene state tracking. Without it, destruction state must be tracked via alternative triggers.
- **Infection Spread System** ✅ (in design) — Scene Management provides Data Layer swap API. Infection Spread is the primary caller of `RequestDataLayerSwap()`. New additive layers added: DL_Infection_Partial, DL_Infected_Advanced, DL_Hive_Core.

**Depended On By** (downstream systems):

| System | Interface Used | Expected Behavior |
|--------|---------------|-------------------|
| Infection Spread System | `RequestDataLayerSwap(ZoneId, TargetLayer)` | Requests Clean→Infected transitions; receives completion callback |
| Map System | `GetZoneBounds()`, `GetDiscoveredLocations()` | Reads zone boundaries and discovery flags for map rendering |
| Save/Load System | `SaveSceneState()`, `RestoreSceneState()` | Persists Data Layer states, destroyed actors, infection levels |
| Camera System | `OnZoneCrossed(FromZone, ToZone)` | Triggers environmental camera effects on zone change |
| Alien AI System | `GetZoneState(ZoneId)` | Reads zone infection state for AI behavior selection |
| HUD System | `GetCurrentZone()`, `GetStreamingState()`, `GetTimeOfDay()` | Displays zone name, streaming debug info, Tactical mode clock |
| Stealth System | `GetTimeOfDay()` | Darkness window lighting modifier (20:00–06:00) |
| Investigation System | `GetTimeOfDay()`, `SubscribeToTimeOfDayChanged()` | Time Gate clue unlock conditions |
| Alien AI System | `GetTimeOfDay()` | Patrol density modifier (heavier 22:00–04:00) |

## Tuning Knobs

| Knob | Type | Default | Range | Effect if too high | Effect if too low |
|------|------|---------|-------|-------------------|-------------------|
| `CellSize` | float | 25,200,000 cm | 12,600,000–50,400,000 cm | More granular streaming but higher overhead | Coarse streaming, memory waste |
| `StreamingDistance` | int (cells) | 2 | 1–4 | More cells loaded, higher memory | Pop-in at distance, world feels empty |
| `MaxSimultaneousCells` | int | 5 | 3–9 | Better coverage but memory spike | Insufficient coverage, visible loading |
| `StreamingPoolMax_MB` | int | 4096 MB | 1024–8192 MB | More assets in memory, less pressure | Frequent pressure events, deactivations |
| `DataLayerSwapTimeout` | float | 10.0s | 2.0–30.0s | Allows large swaps but risks hangs | Large swaps fail, forces GSM Loading |
| `MemoryPressure_Elevated` | float | 70% | 50–80% | Early deactivation, conservative | Late deactivation, risk of Critical |
| `MemoryPressure_High` | float | 85% | 75–95% | Aggressive deactivation | Very aggressive, visual quality drops |
| `MemoryPressure_Critical` | float | 95% | 90–99% | Near-max before emergency action | OOM crashes before action triggers |
| `HLOD_ActivationMultiplier` | float | 10.0 | 8–12 | HLOD activates further away | HLOD too close, visible pop-in |
| `ZoneTransitionDebounce` | float | 3.0s | 1.0–10.0s | Prevents thrashing but feels unresponsive | Rapid zone flickering at boundaries |
| `MaxConcurrentIO` | int | 8 | 4–16 | Faster streaming but I/O contention | Slow streaming, visible pop-in |
| `IO_Split_WorldPartition` | float | 60% | 40–80% | World geometry prioritized | Data Layers starve, slow swaps |
| `ActorBatchSize` | int | 50 | 20–200 | Faster batch processing | Frame spikes during activation |
| `MaxDataLayerQueueDepth` | int | 4 | 2–8 | More swaps queued | Queue starvation, dropped requests |

## Visual/Audio Requirements

### Zone Transition Visuals (Clean → Infected)

The transition is a **gradient, not a boundary**. The player feels the world change before they can articulate why.

**5-Meter Crossfade Zone:**

| Distance | Visual State |
|----------|-------------|
| -15m (approaching) | Lighting temperature shifts 200K cooler. Chromatic aberration increases (0.3px → 0.8px). Ambient fog density +15%. |
| -5m (entering gradient) | Volumetric fog shifts to sickly green-yellow (Alien Verdant #3D6B2E at 10% opacity). Post-process desaturation ramps 0% → 30%. |
| 0m (boundary) | Spore particles activate (0.5px dust motes, green specular). Ground-level fog thickens. Light shafts take green cast. |
| +5m (exiting gradient) | Full Alien Verdant palette. Desaturation at 40%. Volumetric fog green-yellow. Wet/specular infection sheen on surfaces. |
| +15m (deep infected) | Bioluminescent nodes visible. Full infection VFX at steady state. |

**VFX — Zone Transition Particles:**

| Particle System | Color | Density | Lifetime | Size |
|----------------|-------|---------|----------|------|
| Spore Drift | Alien Verdant (#3D6B2E) at 15% opacity, white specular | 50–200/m³ | 8–12s | 0.3–0.8px |
| Ground Mist | Green-yellow (#5C7A3C) at 20% opacity | Zone-wide, height 0–2m | Persistent | Volumetric |
| Surface Bloom | Bioluminescent pulse (material parameter) | Per-surface, 2–4s cycle | Persistent | Shader |
| Air Distortion | Post-process heat haze (refraction) | Intensity 0.05 → 0.15 | Persistent | Post-process |

**Camera Effects on Zone Cross** (fires `OnZoneCrossed` event):
- Chromatic aberration: 0.3px → 1.2px over 2s, settles at 0.8px
- Film grain: +20% in infected zones
- Vignette: tightens 5% in infected zones
- Duration: all effects ramp over 2.0s, hold 0.5s, settle 1.0s (total 3.5s)

### Data Layer Swap Visuals

**Clean → Infected Swap:**

| Phase | Duration | Visual |
|-------|----------|--------|
| DL_Unloading | 0.2–0.5s | Surfaces lose "clean" material — paint appears to peel. Color temperature drops. |
| DL_Flushing | 0.1–0.3s | Brief "naked" geometry (<0.2s). Covered by dust/particle burst. |
| DL_Loading | 0.3–1.0s | Infection growth VFX: tendrils "crawl" across surfaces (material animation). Bioluminescent nodes pulse on. |
| DL_Active | instant | Full infected state. All VFX steady. |

**Intact → Destroyed Swap:**

| Phase | Duration | Visual |
|-------|----------|--------|
| DL_Unloading | 0.2–0.4s | Building "shudders" — camera shake 0.5px, 15Hz. Dust erupts from structure base. |
| DL_Flushing | 0.1–0.2s | Dust cloud obscures structure (particle, 1–2s lifetime). Covers asset swap. |
| DL_Loading | 0.3–0.8s | Dust settles to reveal destroyed state. Rubble visible. Smoke wisps (gray-white, 3–5s). |
| DL_Active | instant | Full destroyed state. |

**VFX — Data Layer Swap Particles:**

| Particle System | Trigger | Color | Density | Lifetime |
|----------------|---------|-------|---------|----------|
| Dust Burst | Intact→Destroyed start | Warm gray (#8A8580) | 100–300 particles | 2–4s |
| Growth Crawl | Clean→Infected swap | Alien Verdant (#3D6B2E) with SSS | Surface-bound, follows UVs | 1–2s animation |
| Debris Fall | Intact→Destroyed swap | Material-matched | 20–50 particles | 1–3s (gravity) |
| Smoke Wisps | Post-destroyed reveal | Gray-white (#C0BDB8) at 30% | 10–30 particles, rising | 3–5s |

**Performance constraint**: All swap VFX must complete within T_swap budget (0.1–10.0s). GPU time <0.5ms per swap VFX.

### Loading Screen Visual (GSM Loading State)

| Element | Description | Color | Animation |
|---------|-------------|-------|-----------|
| Background | Near-black with volumetric noise (infected tissue feel) | #0A0A0F base, #3D6B2E noise at 3% | Noise drifts 0.1 units/s |
| Heartbeat Line | EKG-style waveform, center-third | Prison Red (#8B1E1E) human / Alien Verdant (#3D6B2E) infected | 60 BPM normal → 90 BPM loading → 120 BPM near timeout |
| Zone Name | Current zone, bottom-left, small caps | Off-white (#E8E4DC) at 60% | Fade in 0.5s, hold, fade out 0.3s |
| Environmental Context | Zone subtitle | Amber (#C9A227) 40% (human) / Alien Verdant 40% (infected) | Same timing as zone name |
| Progress Indicator | Heartbeat line fills left-to-right | Same as heartbeat | Line fills as loading progresses |
| Timeout Warning | If loading >20s of 30s timeout | Screen edges pulse Prison Red 10% | Pulse accelerates with remaining time |

**Loading screen exit**: Heartbeat completes final pulse, screen dissolves through "tissue" effect (background noise expands like pupil dilating). Duration: 0.8s.

### Audio Crossfade — Zone Transitions

Audio leads visual by 0.5s. Player *hears* the zone change before *seeing* it.

| Phase | Timing | Clean Audio | Infected Audio |
|-------|--------|------------|----------------|
| Approach | -15m to -5m | Full mix (100%) | Silent |
| Pre-transition | -5m to 0m | Full mix (100%) | Bio-drone fades in at -24dB → -12dB |
| Boundary | 0m | Fades 100% → 0% over 3.0s | Ramps -12dB → 0dB over 3.0s |
| Settle | 0m to +5m | Fading to 0% | Ramping to 100% |
| Stabilized | +5m+ | Silent | Full mix (100%) |

**Audio Rules:**
1. Low-pass filter on clean audio approaching boundary: cutoff 20kHz → 2kHz over 5m gradient.
2. Bio-drone (40–120Hz) is the infection signature — felt in subwoofer/controller before consciously heard.
3. 0.2s "audio vacuum" at exact boundary (0m) — both mixes at minimum.
4. Minimum 2.0s crossfade for all transitions (1.0s for emergency: teleport, death respawn).
5. Reverb IR crossfade duration: 3.0s.

**Art Bible Alignment:**
- Color: Alien Verdant (#3D6B2E) for infection, Prison Red (#8B1E1E) for human threat zones
- Mood: "Biological Horror" lighting state for infected zones
- The world as antagonist: nothing celebrates, everything resists — transitions feel like survival responses, not UI events

## UI Requirements

Scene Management has no direct player-facing UI (Foundation/Infrastructure). All UI is handled by the GSM Loading screen and the HUD System.

**Debug HUD (dev/test only):**
- Current zone name and ID
- Active Data Layers list
- Streaming pool utilization %
- Cell load/unload events (scrolling log)
- HLOD activation distance indicator

## Acceptance Criteria

**Core Rules:**

- **GIVEN** World Partition active in open world, **WHEN** player moves through any area, **THEN** all geometry streamed exclusively through World Partition — no manual level streaming overlaps (LevelStreaming actors count = 0).

- **GIVEN** player standing still in center of cell, **WHEN** streaming system queried, **THEN** exactly 5 cells loaded (center + 4 surrounding), cell size = 25,200,000 cm, streaming distance radius = 5,040,000 cm (2 cells).

- **GIVEN** player crosses from Z02 (Infected Town) into Z04 (Alien Hive), **WHEN** `GetCurrentZone()` called before and after, **THEN** zone ID changes from Z02 to Z04, no visible level border, `OnZoneCrossed(Z02, Z04)` fires exactly once.

- **GIVEN** zone with DL_Clean active, **WHEN** `RequestDataLayerSwap(ZoneId, DL_Infected)` called, **THEN** DL_Clean inactive and DL_Infected active within 0.5–2.0s, additive layers (Patrols, Events, Weather, Infection_Partial, Infected_Advanced, Hive_Core) unaffected.

- **GIVEN** three scenarios: (a) within 4 cells, (b) fast-travel beyond 4 cells, (c) prison exit, **WHEN** each transition triggered, **THEN** (a) no GSM state change, OnZoneCrossed fires; (b) GSM Loading, assets load 5–15s (30s timeout); (c) full level load with deep inhale (1.5s).

- **GIVEN** cell modified (buildings destroyed, infection changed, loot collected), **WHEN** save and reload, **THEN** all tracked state matches pre-save values; session-only data (patrols, weather, transient AI) regenerates fresh.

- **GIVEN** streaming pool at Elevated (70–85%), **WHEN** memory pressure evaluates, **THEN** priorities 10–11 deactivated. At Critical (>95%), priorities 6–11 deactivated, warning logged. I/O maintains 60/40 split, max 8 concurrent.

**Formulas:**

- **GIVEN** Formula 1 (N_cells), **WHEN** tested at |V|=0, 315, 630 cm/s, **THEN** N_cells = 2, 3, 3 respectively (ceiled to integer, clamped [2,3]).

- **GIVEN** Formula 2 (P_mem), **WHEN** M_used=2900 MB, M_pool_max=4096 MB, **THEN** P_mem = 70.8% → Elevated.

- **GIVEN** Formula 3 (T_swap), **WHEN** 200 actors, 500 MB, **THEN** T_swap = 0.75s. Any result >10.0s triggers GSM Loading screen.

- **GIVEN** player at exactly 100,800,000 cm from zone boundary, **WHEN** distance checked, **THEN** preloading begins. At 100,800,001 cm, preloading NOT started.

- **GIVEN** Formula 5 (D_hlod), **WHEN** K_hlod = 8, 10, 12, **THEN** D_hlod = 2016m, 2520m, 3024m respectively.

**Cross-System:**

- **GIVEN** fast-travel beyond 4 cells, **WHEN** Scene Management requests GSM Loading, **THEN** GSM acknowledges via OnTransitionStarted, async-load via FStreamableManager, GSM returns to Playing after assets loaded or 30s timeout.

- **GIVEN** building destroyed by physics impact, **WHEN** Physics fires OnObjectDestroyed(), **THEN** Scene Management records destruction, activates DL_Destroyed, deactivates DL_Intact, persists through save/load — no GSM transition.

- **GIVEN** Infection Spread requests DataLayerSwap, **WHEN** swap completes, **THEN** OnZoneCrossed fires, Camera System receives event, Alien AI reads updated zone state, Map System reflects new infection boundary.

**Performance:**

- **GIVEN** any World Partition cell, **WHEN** actor count measured, **THEN** < 500 actors. Cells exceeding 500 fail build validation.

- **GIVEN** Data Layer swap triggered, **WHEN** GPU time measured for swap VFX, **THEN** < 0.5ms per swap, all VFX complete within T_swap budget.

- **GIVEN** player crosses zone boundary at max sprint, **WHEN** frame times measured during 5m crossfade, **THEN** no frame exceeds 33.3ms, no visible pop-in beyond 50m, audio crossfade leads visual by 0.5s.

**Edge Cases:**

- **GIVEN** player teleports to distant zone, **WHEN** teleport completes, **THEN** all cells flushed, in-flight swaps cancelled, target zone loads within 30s, greybox fallback on failure.

- **GIVEN** Data Layer swap fails mid-way, **WHEN** failure detected, **THEN** rollback to previous stable state within 5s, 5s retry cooldown, 3 failures = permanently blocked + GSM Loading notification.

- **GIVEN** player repeatedly crosses zone boundary, **WHEN** frequency exceeds 1 per 3.0s, **THEN** OnZoneCrossed fires once per 3.0s window, no world state flickering.

## Open Questions

**OQ-1: Formula 4 lead time math error**
The GDD states "44 minutes of lead time" at max sprint for D_trigger (10.08 km). Actual calculation: 10,080m / 6.3 m/s = 1,600s = **26.7 minutes**, not 44. The formula value is correct — only the narrative description is wrong. **Owner**: Design | **Target**: Fix before architecture.

**OQ-2: Formula 1 integer ceiling — binary switch?**
At any non-zero speed, N_cells ceils from 2.0+ to 3. This means the system jumps from 2→3 cells at the first step, not gradually. Is this intentional (conservative streaming) or should the formula use round() instead of ceil()? **Owner**: Design + Engine Programmer | **Target**: Architecture ADR.

**OQ-3: Rule 2 vs Formula 1 — fixed vs adaptive streaming distance?**
Rule 2 states "Streaming distance: 2 cells" as fixed. Formula 1 makes cells-to-preload velocity-adaptive (2–3). Need reconciliation: is "2 cells" the minimum streaming radius or the fixed value? **Owner**: Design | **Target**: GDD revision.

**OQ-4: Audio acceptance criteria missing**
The audio crossfade rules (0.5s audio lead, 0.2s "audio vacuum" at boundary, low-pass filter ramp 20kHz→2kHz) have no dedicated acceptance criteria. **Owner**: QA | **Target**: Add during design-review.

**OQ-5: Simultaneous swap serialization — no acceptance criterion**
Edge case "two zones request Data Layer swaps simultaneously" (serialize by proximity, max queue depth 4) has no acceptance criterion. **Owner**: QA | **Target**: Add during design-review.

**OQ-6: Mountain Prison transition — one-way or returnable?**
The prison is a separate World. Can the player return to it after escaping? If yes, does it require another loading screen? If no, can the prison world be unloaded from memory after transition? **Owner**: Design + Narrative | **Target**: Story arc definition.

**OQ-7: World Partition cell size — immutable after project creation**
Cell size (25,200,000 cm) is set at project creation and cannot be changed without rebuilding the entire world. Should we prototype with a smaller cell size first to validate streaming behavior, or commit to 2520m? **Owner**: Engine Programmer | **Target**: Technical prototype before content authoring.
