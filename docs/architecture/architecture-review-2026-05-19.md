# Architecture Review — 2026-05-19

**Project:** Claude Code Game Studios — Hostile World
**Engine:** Unreal Engine 5.7 (LLM training cutoff: May 2025)
**Reviewer:** /architecture-review skill
**GDDs in scope:** 21 (24 total − 3 non-system: game-concept, systems-index, gdd-cross-review)
**ADRs reviewed:** 3 (ADR-0001, ADR-0002, ADR-0003 — all Proposed)
**Total Technical Requirements catalogued:** 174 (new TR-IDs)

---

## 1. Traceability Summary

| System | TRs | Covered (ADR) | Partial | Gap |
|--------|----:|--------------:|--------:|----:|
| Movement | 14 | 2 | 1 | 11 |
| Physics | 10 | 0 | 1 | 9 |
| Scene Management | 13 | 0 | 1 | 12 |
| Infection Spread | 10 | 1 | 1 | 8 |
| Game State Machine | 12 | **12** | 0 | 0 |
| Player Controller | 11 | 6 | 2 | 3 |
| Camera System | 8 | 0 | 0 | 8 |
| Dialogue System | 9 | 1 | 0 | 8 |
| Input System | 10 | **10** | 0 | 0 |
| Health System | 8 | 1 | 0 | 7 |
| Stealth System | 7 | 1 | 1 | 5 |
| Combat System | 9 | 1 | 1 | 7 |
| Alien AI | 12 | 1 | 1 | 10 |
| Investigation | 8 | 1 | 0 | 7 |
| HUD System | 9 | 1 | 0 | 8 |
| Inventory | 9 | 1 | 0 | 8 |
| Quest | 6 | 1 | 0 | 5 |
| Faction Reputation | 7 | 1 | 0 | 6 |
| Crafting | 6 | 0 | 0 | 6 |
| Map | 7 | 1 | 0 | 6 |
| Save/Load | 11 | 1 | 0 | 10 |
| **TOTAL** | **174** | **42 (24%)** | **8 (5%)** | **124 (71%)** |

**Verdict basis:** Only ~24% of TRs have governing ADR coverage. The 3 existing ADRs are foundation/cross-cutting and their reach is broad but shallow — they govern communication, GSM contract, and Enhanced Input. Almost every system-specific architectural decision (subsystem class choice, perception/AI architecture, Chaos physics setup, World Partition strategy, Save/Load USaveGame mechanism, Behavior Tree topology, UMG widget pipeline, etc.) is currently undocumented.

Full per-TR coverage matrix lives in this file's git history of the registry — only summary above is reproduced here to keep the report scannable.

---

## 2. Coverage Gaps — Prioritized

Gaps are grouped by architectural impact and prioritized as **Foundation > Core > Feature**. Suggested ADRs are listed in dependency-friendly order.

### Foundation Gaps (block everything else)

| # | Suggested ADR | Governs TRs | Why blocking |
|---|---------------|-------------|--------------|
| F-1 | **ADR-XXXX — Subsystem & Module Architecture** | TR-infection-001, TR-ai-008, TR-dialogue-001, TR-investigation-001, TR-hud-003, TR-inventory-001, TR-pc-001, TR-gsm-001 (cross-cut) | 7 systems declare themselves as UGameInstanceSubsystem. No ADR confirms the subsystem-tier policy (UGameInstance vs ULocalPlayer vs UWorld), module boundaries, or load order. Without this, every other system ADR is implicitly making the choice. |
| F-2 | **ADR-XXXX — Data-Driven Authoring Pipeline (Data Tables)** | TR-dialogue-002, TR-investigation-003, TR-inventory-002, TR-quest-001, TR-crafting-003, TR-ai-* (behavior trees) | 5+ systems declare authoring via Data Tables. No ADR defines schema conventions, hot-reload policy, struct hashing, validation, or build-time checks. |
| F-3 | **ADR-XXXX — Save/Load Serialization Architecture** | All 11 TR-save-* and every Save*/Restore* interface in other systems | Save/Load GDD is fully designed but has no ADR. USaveGame version migration, struct serialization, mid-async-write semantics, world-flag actor GUID stability all need decisions before any system implementing Save*/Restore is built. |
| F-4 | **ADR-XXXX — UE 5.7 Engine Subsystem Versioning & API Pinning** | All TRs that reference UE APIs | Pinned engine is UE 5.7 with cutoff May 2025. ADR-0003 already invokes UE 5.3+ post-cutoff API (UEnhancedInputUserSettings). Need a project-wide decision on how to gate post-cutoff API use (Megalights, PCG, Substrate, ApplyRadiusModifier behavior change). |

### Core Gaps (block multiple feature systems)

| # | Suggested ADR | Governs TRs | Why core |
|---|---------------|-------------|----------|
| C-1 | **ADR-XXXX — Physics & Collision Architecture** | TR-physics-001..010, TR-movement-001/004/005/006 | Chaos Physics adoption, custom collision channels (ECC_Player..ECC_AIPerception), Physical Materials, line-trace strategy, ragdoll blend, sub-step config. Movement, Stealth, Combat all depend on this. |
| C-2 | **ADR-XXXX — World Partition & Streaming Strategy** | TR-scene-001..013, TR-infection-006/010, TR-map-001/006 | Cell size 2520m is immutable post-creation. Data Layer state machine, HLOD generation, memory pressure tiers, FStreamableManager async loading. Infection, Map, Scene all depend. |
| C-3 | **ADR-XXXX — Camera System Architecture** | TR-camera-001..008, TR-dialogue-007, TR-combat-006 | 5 camera modes, SetViewTargetWithBlend, SpringArm collision, UCameraShakeBase, Sequencer integration, Lumen exposure. Dialogue and Combat depend on it. |
| C-4 | **ADR-XXXX — Health & Damage Pipeline** | TR-health-001..008, TR-combat-003, TR-infection-009 | TakeDamage(float, EDamageType) routing, EDamageType extensibility, dodge i-frame coupling to Movement delegates, GSM death handoff. Combat and Infection both call this. |
| C-5 | **ADR-XXXX — Stealth Detection Pipeline** | TR-stealth-001..007, TR-ai-002/010/012, TR-investigation-005 | Per-alien detection score, IStealthDetection contract, 0.1ms/alien budget, 20-alien cap, multi-input read every frame. Alien AI and Investigation both depend. |
| C-6 | **ADR-XXXX — Alien AI Architecture (BT + Perception + EQS + Squad)** | TR-ai-001..012 | UAIPerceptionComponent on Character (not Controller), Behavior Trees + custom C++ BT nodes, EQS query budgets, Nav Mesh areas (incl. runtime biomass painting), Squad subsystem. Largest single architecture decision still undocumented. |
| C-7 | **ADR-XXXX — Combat System Architecture** | TR-combat-001..009, TR-ai-001 (alien attacks) | Hitscan vs projectile policy, weapon class data model, jam mechanic, reload state machine, disengagement timer, recoil routing to Camera. |

### Feature Gaps (single-system, lower blocking weight)

| # | Suggested ADR | Governs TRs |
|---|---------------|-------------|
| Ft-1 | **ADR-XXXX — UMG/HUD Rendering Architecture (dual-mode)** | TR-hud-001..009, TR-inventory-009, TR-map-002 |
| Ft-2 | **ADR-XXXX — Inventory & Item Data Model** | TR-inventory-001..009, TR-crafting-005 |
| Ft-3 | **ADR-XXXX — Dialogue System Architecture (Data Table trees + radial wheel)** | TR-dialogue-001..009 |
| Ft-4 | **ADR-XXXX — Investigation Clue & Thread Subsystem** | TR-investigation-001..008, TR-quest-002 |
| Ft-5 | **ADR-XXXX — Quest System Architecture (objective polling + deferred consequences)** | TR-quest-001..006 |
| Ft-6 | **ADR-XXXX — Faction Reputation Subsystem** | TR-faction-001..007 |
| Ft-7 | **ADR-XXXX — Crafting System Architecture** | TR-crafting-001..006 |
| Ft-8 | **ADR-XXXX — Map System & Fog-of-War Persistence** | TR-map-001..007 |
| Ft-9 | **ADR-XXXX — Infection Spread Subsystem (tick loop + procedural spawn)** | TR-infection-001..010 |
| Ft-10 | **ADR-XXXX — Player Controller Context Resolver (async traces + proximity)** | TR-pc-003..005, TR-pc-011 |
| Ft-11 | **ADR-XXXX — Movement System (CMC extension + Cover Component)** | TR-movement-001..014 |

---

## 3. Cross-ADR Conflicts

Three ADRs reviewed (0001, 0002, 0003). Conflict scan dimensions: data ownership, integration contracts, performance budgets, dependency cycles, pattern, state authority.

| # | Type | Detail | Severity |
|---|------|--------|----------|
| X-1 | Pattern overlap (minor) | ADR-0001 declares Dynamic Multicast Delegates as Tier 1 (owner→subscriber). ADR-0003 routes input events "via ADR-0001 Tier 1 delegates" — consistent. ADR-0002 declares GSM exposes OnStateEntered subscription — also consistent. **No conflict.** | None |
| X-2 | State authority boundary | ADR-0002 says GSM is a UGameInstanceSubsystem (UHostileWorldGSM). GSM GDD Rule 1 says GSM is **owned by GameMode**, not GameInstance. This is a real disagreement between the GDD design and ADR-0002. | **High — must reconcile before Accepting ADR-0002** |
| X-3 | Performance budget | ADR-0002 declares GSM as FTickableGameObject. No frame budget specified. Other systems set explicit budgets (Stealth 0.1ms/alien, AI 0.5ms/alien, HUD 0.5ms). GSM should declare its tick cost. | Low |
| X-4 | Integration contract — input routing | ADR-0003 says PlayerController owns 22 IA_* and 8 IMCs and subscribes to ADR-0002 OnStateEntered for IMC overlay switching. PC GDD Rule 3 also says PC manages IMC stack. Aligned. | None |
| X-5 | Dependency cycle | ADR-0002 depends ADR-0001 (uses Tier 1 delegates). ADR-0003 depends ADR-0001 and ADR-0002. No cycle. | None |
| X-6 | Plugin dependency divergence | ADR-0001 requires GameplayMessageRouter plugin for Tier 2. No project-wide ADR confirms which plugins are enabled in `.uproject` — risk that engineers will toggle plugins ad-hoc. | Medium |

---

## 4. ADR Dependency Topological Order

Derived from `Depends On` fields in ADR bodies:

```
ADR-0001 (Cross-System Communication)              [foundation, no deps]
   ├── ADR-0002 (Game State Machine)               depends ADR-0001
   │      └── ADR-0003 (Enhanced Input)            depends ADR-0001, ADR-0002
   └── ADR-0003 (Enhanced Input)
```

Linear acceptance order: **0001 → 0002 → 0003**.

All three are currently **Proposed**. Per `docs/CLAUDE.md` ("Never skip Accepted — stories referencing a Proposed ADR are auto-blocked"), no story implementing these systems can proceed until they advance to Accepted. Before promotion, address conflict X-2 (GSM ownership).

---

## 5. GDD Revision Flags

Cross-check each GDD against the 3 ADRs for stale assumptions:

| GDD | Flag | Action |
|-----|------|--------|
| `input-system.md` | ✅ **Aligned** — Rule "No legacy input — Enhanced Input only, legacy BindAction/BindAxis not permitted" matches ADR-0003 explicitly. | None |
| `player-controller.md` | ✅ Routes via "dynamic multicast delegates" (Rule 1 step 3) — matches ADR-0001 Tier 1. ✅ States PC manages IMC stack — matches ADR-0003. | None |
| `game-state-machine.md` | ⚠️ **Rule 1: "GSM exists as a single component owned by the GameMode"** — contradicts ADR-0002 (`UHostileWorldGSM : UGameInstanceSubsystem`). | **Must reconcile** with ADR-0002 (X-2). Either revise GDD to GameInstanceSubsystem or revise ADR. |
| `movement-system.md` | Subscribes to GSM via `OnStateEntered` per its Soft Dependencies — implicitly relies on ADR-0002 contract. No conflict. | None — note dependency on ADR-0002 finalisation. |
| `dialogue-system.md` | References `OnStateEntered` / `OnTransitionStarted` (ADR-0002 pattern); fires `OnClueDiscovered` via multicast delegate (ADR-0001 Tier 1). ✅ Aligned. | None |
| `health-system.md`, `combat-system.md`, `stealth-system.md`, `alien-ai-system.md`, `hud-system.md`, `inventory-system.md`, `investigation-system.md`, `quest-system.md`, `faction-reputation-system.md`, `crafting-system.md`, `map-system.md`, `save-load-system.md` | All use multicast delegates or GSM event subscription patterns — consistent with ADR-0001 / ADR-0002. None reference legacy BindAction/BindAxis. | None |
| `infection-spread-system.md` | Rule 8 "Pause behavior" explicitly references GSM Paused state via subscription — matches ADR-0002. | None |
| `physics-system.md`, `scene-management.md`, `camera-system.md` | Foundation/middleware — no direct ADR reference. They emit events (OnImpact, OnZoneCrossed, OnImpact) and others subscribe via multicast — fits ADR-0001 implicitly. | None — these systems will need their own ADRs (gaps C-1, C-2, C-3). |

**Critical revision:** GSM GDD Rule 1 vs ADR-0002 ownership mismatch (X-2 above).

---

## 6. Engine Compatibility Audit

Cross-checked the 3 ADRs against `docs/engine-reference/unreal/deprecated-apis.md`:

| Check | ADR-0001 | ADR-0002 | ADR-0003 | Result |
|-------|----------|----------|----------|--------|
| Legacy BindAction / BindAxis | n/a | n/a | Explicitly forbids legacy bindings | ✅ Pass |
| Cascade UParticleSystem | n/a | n/a | n/a | ✅ N/A |
| World Composition | n/a | n/a | n/a | ✅ N/A — note: Scene Management GDD already commits to World Partition |
| Sound Cue | n/a | n/a | n/a | ✅ N/A |
| TSharedPtr<UObject> | n/a | n/a | n/a | ✅ N/A |
| DOREPLIFETIME bare | n/a | n/a | n/a | ✅ N/A — game is single-player; no replication yet |
| Legacy Material editor | n/a | n/a | n/a | ✅ N/A |
| UGameplayMessageSubsystem (ADR-0001) | Post-cutoff API (UE 5.3+). Requires `GameplayMessageRouter` plugin in `.uproject`. | — | — | ⚠️ Engine compat: must verify plugin ships with UE 5.7 binary install and is correctly enabled in the project. Logged in Required ADRs list. |
| UEnhancedInputUserSettings (ADR-0003) | — | — | Post-cutoff API (UE 5.3+) for runtime rebinding | ⚠️ Engine compat: ADR-0003 explicitly flags this is post-cutoff; needs engine-reference snapshot verification before implementation. |

**Verdict:** No deprecated-API violations. Two post-cutoff dependencies (UGameplayMessageSubsystem, UEnhancedInputUserSettings) are explicitly disclosed in their ADRs — acceptable but requires engine-reference doc update once verified against the live UE 5.7 install.

---

## 7. Pre-Gate Checklist (Test & UX Infrastructure)

| Artifact | Path | Status |
|----------|------|--------|
| Unit tests directory | `tests/unit/` | ❌ Missing |
| Integration tests directory | `tests/integration/` | ❌ Missing |
| CI test workflow | `.github/workflows/tests.yml` | ❌ Missing |
| Accessibility requirements | `design/ux/accessibility-requirements.md` (or `design/accessibility-requirements.md`) | ❌ Missing — referenced by `hud-system.md` Cross-References as `(Alpha)` |
| Interaction patterns library | `design/ux/interaction-patterns.md` | ❌ Missing |
| `design/ux/` directory | — | ❌ Missing entirely (no UX specs authored yet) |

**Implication:** Pre-Production gate **cannot be passed** with these gaps. Test infrastructure setup (`/test-setup`) and UX accessibility spec authoring (`/ux-design`) are blockers for Vertical Slice work.

---

## 8. Verdict

# 🔴 FAIL

**Rationale:**
1. **Coverage**: Only 24% of catalogued technical requirements have ADR coverage. The 3 existing ADRs are essential cross-cutting decisions, but 124 of 174 TRs have no architectural ruling. Implementation cannot begin on systems where the architecture is undocumented.
2. **Cross-ADR conflict**: X-2 (GSM ownership: GameMode component vs GameInstanceSubsystem) is a real disagreement between GSM GDD and ADR-0002 and must be reconciled before ADR-0002 can advance to Accepted.
3. **ADR status**: All 3 ADRs are `Proposed`. Per project policy, stories cannot reference Proposed ADRs. Promotion to Accepted is blocked behind X-2.
4. **Pre-gate infrastructure**: No tests directory, no CI workflow, no UX/accessibility specs. Architecture review's gate criteria includes these; all missing.
5. **Missing foundational ADRs**: Subsystem/module architecture, Data-Table pipeline, Save/Load serialization, Engine API pinning — none of these exist, but ~half of the GDDs make implicit assumptions about them.

---

## 9. Blocking Issues (must fix before gate pass)

| # | Blocker | Action |
|---|---------|--------|
| B-1 | GSM ownership contradiction (X-2) | Edit either `game-state-machine.md` Rule 1 or ADR-0002 to align. Recommended: GameInstanceSubsystem (ADR-0002 wins — survives map travel cleanly). |
| B-2 | All 3 ADRs in `Proposed` state | Reconcile B-1, then promote 0001 → 0002 → 0003 to `Accepted`. |
| B-3 | No Physics ADR (C-1) | Author before any Movement/Combat/AI implementation. |
| B-4 | No Save/Load ADR (F-3) | Author before any system implementing `Save*/Restore*` is built. |
| B-5 | No Subsystem Architecture ADR (F-1) | 7 systems declare UGameInstanceSubsystem without a governing decision. |
| B-6 | No test infrastructure | Run `/test-setup` to scaffold `tests/`, `.github/workflows/tests.yml`. |
| B-7 | No UX accessibility spec | Run `/ux-design accessibility-requirements` — HUD GDD already references it. |
| B-8 | Post-cutoff API verification | Run engine-reference doc update for `UGameplayMessageSubsystem` and `UEnhancedInputUserSettings` in UE 5.7. |

---

## 10. Required ADRs — Priority-Ordered Backlog

Author in this order (each can route via `/architecture-decision`):

1. **ADR-0004 — Subsystem & Module Architecture** *(Foundation, F-1)*
2. **ADR-0005 — Data-Driven Authoring Pipeline (Data Tables)** *(Foundation, F-2)*
3. **ADR-0006 — Save/Load Serialization Architecture** *(Foundation, F-3)*
4. **ADR-0007 — UE 5.7 Engine API Pinning Policy** *(Foundation, F-4)*
5. **ADR-0008 — Physics & Collision Architecture** *(Core, C-1)*
6. **ADR-0009 — World Partition & Streaming Strategy** *(Core, C-2)*
7. **ADR-0010 — Camera System Architecture** *(Core, C-3)*
8. **ADR-0011 — Health & Damage Pipeline** *(Core, C-4)*
9. **ADR-0012 — Stealth Detection Pipeline** *(Core, C-5)*
10. **ADR-0013 — Alien AI Architecture (BT + Perception + EQS + Squad)** *(Core, C-6)*
11. **ADR-0014 — Combat System Architecture** *(Core, C-7)*
12. **ADR-0015 — Movement System (CMC + Cover Component)** *(Feature, Ft-11)*
13. **ADR-0016 — Player Controller Context Resolver** *(Feature, Ft-10)*
14. **ADR-0017 — UMG/HUD Dual-Mode Rendering** *(Feature, Ft-1)*
15. **ADR-0018 — Inventory & Item Data Model** *(Feature, Ft-2)*
16. **ADR-0019 — Dialogue System Architecture** *(Feature, Ft-3)*
17. **ADR-0020 — Investigation Clue & Thread Subsystem** *(Feature, Ft-4)*
18. **ADR-0021 — Quest System Architecture** *(Feature, Ft-5)*
19. **ADR-0022 — Faction Reputation Subsystem** *(Feature, Ft-6)*
20. **ADR-0023 — Crafting System Architecture** *(Feature, Ft-7)*
21. **ADR-0024 — Map System & Fog-of-War Persistence** *(Feature, Ft-8)*
22. **ADR-0025 — Infection Spread Subsystem** *(Feature, Ft-9)*

After authoring Foundation + Core ADRs (1–11), run `/create-control-manifest` to extract a programmer rules sheet, then re-run `/architecture-review` for a re-verdict.

---

## 11. Notes & Observations

- The 3 existing ADRs are well-scoped foundation decisions and the conflict X-2 is the only material disagreement. Quality of authored ADRs is high; the issue is **breadth of coverage**, not depth.
- TR catalog density is uneven: GSM and Input fully covered (12/12 and 10/10) by their respective ADRs; Crafting at 0/6. This reflects the actual authoring order and is expected.
- `propagate-design-change` skill should be run on `game-state-machine.md` after B-1 is resolved.
- Many soft dependencies in the GDDs reference systems that exist as designs but not implementations (Audio System, Accessibility System are repeatedly flagged as "Not Started"). These should be tracked in the Required ADRs list once the dependent system designs land.
