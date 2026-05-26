# ADR-0004: Subsystem & Module Architecture

## Status
Accepted

## Date
2026-05-19

## Engine Compatibility

| Field | Value |
|-------|-------|
| **Engine** | Unreal Engine 5.7 |
| **Domain** | Core |
| **Knowledge Risk** | LOW — Subsystem API stable since UE 5.0; no breaking changes in 5.4–5.7 |
| **References Consulted** | `docs/engine-reference/unreal/VERSION.md` |
| **Post-Cutoff APIs Used** | `FSubsystemCollectionBase::InitializeDependency<T>()` (UE 5.3+, escape hatch only — not primary pattern) |
| **Verification Required** | Confirm ULocalPlayerSubsystem for HUD is created before first HUD BeginPlay in PIE; verify UWorldSubsystem state resets correctly on level transition in PIE multi-world |

## ADR Dependencies

| Field | Value |
|-------|-------|
| **Depends On** | ADR-0002 (UHostileWorldGSM is the canonical UGameInstanceSubsystem — this ADR generalises that pattern) |
| **Enables** | ADR-XXXX Save/Load Serialization, ADR-XXXX Alien AI Architecture, ADR-XXXX Dialogue System, ADR-XXXX Investigation Subsystem, ADR-XXXX HUD/UMG Architecture, ADR-XXXX Inventory & Item Data Model |
| **Blocks** | All implementation stories that author a new subsystem class |
| **Ordering Note** | Must be Accepted before any subsystem class other than UHostileWorldGSM is authored |

## Context

### Problem Statement
Seven game systems (Infection Spread, Alien AI, Dialogue, Investigation, HUD, Inventory, Player Controller access) plan to declare themselves as `UGameInstanceSubsystem`, but no ADR governs when that tier is correct versus `UWorldSubsystem` or `ULocalPlayerSubsystem`. Without a policy, developers will independently pick tiers, causing systems to carry state across level transitions when they should not (stale investigation clues, alien squads from previous level) or fail to persist when they must (infection spread resetting on each map load).

### Constraints
- ADR-0002 locked `UHostileWorldGSM` as `UGameInstanceSubsystem` — this is reinforced, not revisited
- Single-player only — no server-authoritative constraints at this stage
- Single primary game module: `HostileWorld`
- Alien AI squads and investigation clues must reset per level load
- Quest progress, faction standing, and inventory must persist across level transitions
- Infection spread is per-level (World-tier per GDD Rule 8); save/load handles disk persistence across sessions

### Requirements
- Must define a tier decision rule any programmer can apply in under a minute
- Must prevent world-scoped systems from carrying stale state across level transitions
- Must allow session-scoped systems to persist across levels
- Must define the canonical access pattern for each tier
- Must define the one primary game module name and directory layout

## Decision

### Subsystem Tier Policy

| Tier | UE Class | Lifecycle | Use When |
|------|----------|-----------|----------|
| **Session** | `UGameInstanceSubsystem` | Created once per play session; survives level transitions | State must persist across levels (quests, faction, save/load service) |
| **World** | `UWorldSubsystem` | Created per `UWorld`; destroyed on level transition | State is per-level and must reset on load (investigation clues, alien squads, dialogue triggers) |
| **Player** | `ULocalPlayerSubsystem` | Created per `ULocalPlayer`; survives level transitions | Viewport-bound UI state (HUD display config) — gameplay state that must persist uses Session tier instead |
| **Per-Actor** | `UActorComponent` | Lives and dies with the owning `AActor` | Per-actor behaviour and state (health, movement, stealth, combat) — not subsystems |

### System-to-Tier Assignment

| System | Tier | Class | Rationale |
|--------|------|-------|-----------|
| Game State Machine | Session (`UGameInstanceSubsystem`) | `UHostileWorldGSM` | ADR-0002: Loading state spans level transitions |
| Infection Spread | World (`UWorldSubsystem`) | `UInfectionSpreadSubsystem` | Per-level infection grid per GDD Rule 8; each world has independent infection state. Save/Load (ADR-0006) handles disk persistence via `IHostileSaveProvider`. Registers on `Initialize()`, unregisters on `Deinitialize()`. |
| Quest Tracking | Session (`UGameInstanceSubsystem`) | `UQuestSubsystem` | Active quest state persists across levels |
| Faction Reputation | Session (`UGameInstanceSubsystem`) | `UFactionSubsystem` | Standing persists for the full play session |
| Save/Load Service | Session (`UGameInstanceSubsystem`) | `USaveLoadSubsystem` | Save/load operations are session-level; tied to `UGameInstance` |
| Inventory | Session (`UGameInstanceSubsystem`) | `UInventorySubsystem` | Player carries items between levels — gameplay state, not UI state |
| Investigation | Session (`UGameInstanceSubsystem`) | `UInvestigationSubsystem` | Investigation threads are session-persistent revelation chains (`Unknown → Suspected → Confirmed → Revelation → Revealed`); revelation deferral can span multiple level transitions — World-tier would wipe thread state on every load |
| Tutorial | Session (`UGameInstanceSubsystem`) | `UTutorialSubsystem` | `FTutorialSaveData` (completed hint IDs only — DISMISSED state removed per Tutorial GDD Rule 5) persists across all level transitions per Tutorial GDD Rule 8; World-tier would reset learned hints on every map load |
| Alien AI Coordination | World (`UWorldSubsystem`) | `UAlienSquadSubsystem` | Alien squads exist in the current world; must reset on new map |
| Dialogue Controller | World (`UWorldSubsystem`) | `UDialogueSubsystem` | Active conversation state only (current node, wheel, active NPC); destroyed on level transition — no persistent state stored here |
| NPC Relationships | Session (`UGameInstanceSubsystem`) | `UNPCRelationshipSubsystem` | Trust/Fear/Knowledge/Flags/Topics per NPC are session-level per Dialogue GDD Rule 4/8; must survive level transitions. `UDialogueSubsystem` queries this subsystem (cross-tier World→Session access is always safe per this ADR) |
| HUD | Player (`ULocalPlayerSubsystem`) | `UHUDSubsystem` | Viewport-bound display state; per local player |
| Health / Stealth / Movement / Combat | Per-Actor (`UActorComponent`) | Component classes | Per-actor; live and die with the owning `AActor` |

### Module Structure

All game subsystems and gameplay systems live in the single primary module: **`HostileWorld`**

```
Source/
└── HostileWorld/
    ├── HostileWorld.Build.cs
    ├── Public/
    │   ├── Subsystems/       # All UGameInstanceSubsystem, UWorldSubsystem, ULocalPlayerSubsystem headers
    │   ├── Components/       # All UActorComponent headers
    │   ├── Characters/
    │   └── ...
    └── Private/
        ├── Subsystems/
        ├── Components/
        └── ...
```

If a system grows beyond ~20 source files and has a stable public API worth reusing, it may be extracted as a feature module via a new ADR. No preemptive splitting.

### Access Patterns

```cpp
// World subsystem — valid while UWorld exists
UInfectionSpreadSubsystem* Inf = GetWorld()->GetSubsystem<UInfectionSpreadSubsystem>();

// Session subsystem — safe anywhere after GameInstance::Init()
UInvestigationSubsystem* Inv = GetGameInstance()->GetSubsystem<UInvestigationSubsystem>();

// Player subsystem — from APlayerController
UHUDSubsystem* Hud = GetLocalPlayer()->GetSubsystem<UHUDSubsystem>();

// Player subsystem — from AHUD (no GetLocalPlayer() on AHUD directly)
UHUDSubsystem* Hud = GetOwningPlayerController()->GetLocalPlayer()->GetSubsystem<UHUDSubsystem>();

// FORBIDDEN: static pointer caching of any subsystem (see forbidden_patterns)
// FORBIDDEN: GEngine->GetFirstLocalPlayerController() for subsystem access
```

### Load Order — Lazy Access Pattern

Subsystems access their dependencies in the **first functional call**, not in `Initialize()`. This is mandatory because peer subsystem `Initialize()` ordering within the same tier is not guaranteed.

```cpp
// CORRECT — lazy, first use
void UInvestigationSubsystem::RegisterClue(FClueData Clue)
{
    if (UQuestSubsystem* Quests = GetGameInstance()->GetSubsystem<UQuestSubsystem>())
        Quests->NotifyClueFound(Clue.ClueId);
}

// WRONG — caching in Initialize() creates fragile ordering dependency
void UInvestigationSubsystem::Initialize(FSubsystemCollectionBase& Collection)
{
    CachedQuestSubsystem = GetGameInstance()->GetSubsystem<UQuestSubsystem>(); // peer may not be initialized yet
}
```

**Exception**: If a subsystem truly cannot function without a peer being initialized first, use `Collection.InitializeDependency<UPeerSubsystem>()` inside `Initialize()` to force the peer to initialize before proceeding. This is the escape hatch — prefer lazy access.

**Cross-tier access** (e.g., `UWorldSubsystem` accessing a `UGameInstanceSubsystem`) is always safe: the session tier is created before any world or player subsystem initializes.

### Architecture Diagram

```
UGameInstance (session — full play session)
├── UHostileWorldGSM          ← ADR-0002
├── UQuestSubsystem
├── UFactionSubsystem
├── USaveLoadSubsystem
├── UInventorySubsystem
├── UInvestigationSubsystem   ← session-tier: thread state spans level transitions
├── UTutorialSubsystem        ← session-tier: FTutorialSaveData persists across levels
└── UNPCRelationshipSubsystem ← session-tier: Trust/Fear/Knowledge/Flags per NPC persist across levels

UWorld (per level — destroyed on level transition)
├── UAlienSquadSubsystem
├── UInfectionSpreadSubsystem ← World-tier per GDD Rule 8; IHostileSaveProvider; registers/unregisters on Init/Deinit
└── UDialogueSubsystem        ← active conversation state only; queries UNPCRelationshipSubsystem for relationship data

ULocalPlayer (per player — survives level transitions)
└── UHUDSubsystem

AActor hierarchy (per actor)
├── UHealthComponent
├── UMovementComponent (custom)
├── UStealthComponent
└── UCombatComponent
```

## Alternatives Considered

### Alternative 1: All-UGameInstanceSubsystem
- **Description**: Every system uses `UGameInstanceSubsystem` regardless of lifecycle
- **Pros**: One tier, no per-system decision
- **Cons**: World-scoped systems (Investigation, AlienSquad) carry stale per-level state across transitions — investigation clues from level 1 persist in level 2, AI squad state never resets
- **Rejection Reason**: Correctness bug for any system whose state is meaningful only within one level

### Alternative 2: Feature Modules Per System
- **Description**: `HostileWorldGSM`, `HostileWorldInventory`, `HostileWorldAI`, etc. as separate modules
- **Pros**: Maximum isolation, independent recompile
- **Cons**: 10+ `Build.cs` files, complex cross-module dependency declarations, no reuse justification for a single-game project
- **Rejection Reason**: Over-engineering for indie scale; single module is sufficient until a clear reuse boundary emerges

### Alternative 3: Explicit Load Order via ShouldCreateSubsystem
- **Description**: Override `ShouldCreateSubsystem()` to gate on prerequisite subsystem existence
- **Pros**: Explicit, documented ordering
- **Cons**: `ShouldCreateSubsystem()` gates creation (prevents subsystem from existing), not initialization order — wrong tool for ordering. Can produce systems that never exist if prerequisites have conditions
- **Rejection Reason**: Misuse of the API. Lazy access pattern and `InitializeDependency<T>()` handle ordering cleanly without gating creation

## Consequences

### Positive
- Tier decision is a 30-second lookup against the policy table
- Investigation/AlienSquad state resets per level with no teardown code — `UWorldSubsystem::Deinitialize()` fires automatically
- Quest/Faction/Inventory state persists with no extra work — `UGameInstanceSubsystem` lives for the session
- Single module keeps build times short and cross-system headers simple
- Pattern is consistent with ADR-0002's established `GetGameInstance()->GetSubsystem<T>()` idiom

### Negative
- `ULocalPlayerSubsystem` access from `AHUD` requires routing through `GetOwningPlayerController()->GetLocalPlayer()` — two-hop call, not obvious
- Per-actor components are excluded from the subsystem access pattern — callers must find the owning `AActor` first

### Risks
- **Risk**: A `UWorldSubsystem` caches a raw `AActor*` or `TWeakObjectPtr` that is stale after level transition. **Mitigation**: `UWorldSubsystem` implementations must override `virtual void OnWorldEndPlay(UWorld& InWorld)` (or `Deinitialize()`) to null out all cached Actor references.
- **Risk**: `UHUDSubsystem` is not yet initialized when HUD `BeginPlay()` fires in some startup orderings. **Mitigation**: HUD uses lazy access — calls `GetOwningPlayerController()->GetLocalPlayer()->GetSubsystem<UHUDSubsystem>()` in first functional use, never in `BeginPlay()`.
- **Risk**: PIE multi-world creates separate `UWorldSubsystem` instances per world; cross-world PIE sessions may expose unexpected state isolation. **Mitigation**: Verify in PIE two-world session before sprint complete.

## GDD Requirements Addressed

| GDD System | Requirement | How This ADR Addresses It |
|------------|-------------|--------------------------|
| infection-spread.md | TR-infection-001: infection state is per-level (GDD Rule 8); each world has independent infection grid; save/load handles disk persistence | `UWorldSubsystem` tier → destroyed on level transition; `USaveLoadSubsystem` (ADR-0006) serializes grid via `IHostileSaveProvider` |
| alien-ai.md | TR-ai-008: AI coordination subsystem resets when a new level loads | `UWorldSubsystem` tier → auto-destroyed on level transition |
| dialogue-system.md | TR-dialogue-001: dialogue state machine requires a central controller per scene | `UWorldSubsystem` tier; class name `UDialogueSubsystem` (active conversation only) |
| dialogue-system.md | TR-dialogue-003/008: NPC relationship state (Trust/Fear/Knowledge/Flags/Topics) must persist across level transitions and save/load | `UGameInstanceSubsystem` tier; class name `UNPCRelationshipSubsystem`; `UDialogueSubsystem` delegates all relationship reads/writes to it |
| investigation.md | TR-investigation-001: investigation threads are session-persistent revelation chains spanning level transitions | `UGameInstanceSubsystem` tier → thread state survives level loads; per-level clue-discovery events are stored inside this session subsystem |
| hud-system.md | TR-hud-003: HUD requires a subsystem-tier manager tied to the viewport | `ULocalPlayerSubsystem` tier → viewport-bound lifecycle |
| inventory-system.md | TR-inventory-001: inventory state must persist when the player changes levels | `UGameInstanceSubsystem` tier → persists for the full play session |
| player-controller.md | TR-pc-001: systems need a consistent access pattern for PC-owned state | `AHostileWorldPlayerController` is an `AActor`, not a subsystem; accessed via `GetWorld()->GetFirstPlayerController()`. This ADR defines which systems ARE subsystems. |
| game-state-machine.md | TR-gsm-001: GSM must survive level transitions | Reinforces ADR-0002: `UGameInstanceSubsystem` is the correct tier |

## Performance Implications
- **CPU**: Subsystem lifecycle (`Initialize`/`Deinitialize`) is off the hot path; the tier policy itself has no per-frame cost
- **Memory**: 6 session subsystems + 3 world subsystems + 1 player subsystem; negligible overhead vs. game state they hold
- **Load Time**: `UWorldSubsystem` creation fires during world init; 10 subsystems total is well within normal project range
- **Network**: N/A — single-player

## Migration Plan
No existing code to migrate. All subsystem classes are new — the project has not entered implementation.

## Validation Criteria
- All 10 subsystems listed in the tier table compile and `Initialize()` without crash in PIE
- `UInvestigationSubsystem` thread state persists across a PIE level transition (session subsystem confirmed — revelation chain survives map load)
- `UInfectionSpreadSubsystem` initializes fresh on each PIE level load; save/load round-trip restores prior grid state correctly (World-tier confirmed per GDD Rule 8)
- `UInfectionSpreadSubsystem::Deinitialize()` unregisters from `USaveLoadSubsystem` — no stale provider reference after level transition
- `UInventorySubsystem` item list persists when the player travels between PIE levels
- No subsystem class caches raw `AActor*` without clearing it in `OnWorldEndPlay()` or `Deinitialize()`
- Lazy access pattern: no subsystem calls `GetSubsystem<T>()` on a peer inside `Initialize()` without `InitializeDependency<T>()` guard

## Related Decisions
- ADR-0001: Cross-System Communication — delegates and Gameplay Message Router remain the communication mechanism between all subsystems
- ADR-0002: Game State Machine — `UHostileWorldGSM` is the canonical `UGameInstanceSubsystem` this ADR generalises
- ADR-0003: Enhanced Input — `AHostileWorldPlayerController` is an `AActor` (not a subsystem); this ADR clarifies the distinction
