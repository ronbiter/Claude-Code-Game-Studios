# Architecture Review — 2026-05-19 (11:25 update)

**Project:** Claude Code Game Studios — Hostile World
**Engine:** Unreal Engine 5.7 (LLM training cutoff: May 2025)
**Reviewer:** /architecture-review skill (delta run)
**Prior review:** `docs/architecture/architecture-review-2026-05-19.md` (08:32)
**GDDs in scope:** 22 (added: `tutorial-system.md`)
**ADRs reviewed:** 4 (ADR-0001..0004 — all `Proposed`)
**Total Technical Requirements:** 185 (174 prior + 11 new tutorial)

---

## 1. Delta Since Prior Review

| Change | Effect |
|--------|--------|
| ✅ **GSM GDD Rule 1 rewritten** — now declares `UHostileWorldGSM : public UGameInstanceSubsystem` per ADR-0002 | Resolves prior **X-2** (GameMode-component vs GameInstanceSubsystem). GSM GDD ↔ ADR-0002 now aligned. |
| ✅ **ADR-0004 authored** — Subsystem & Module Architecture (Proposed) | Closes prior Foundation Gap **F-1**. Defines tier policy + module layout + load-order rule. |
| 🟣 **Tutorial System GDD completed** | +11 new TRs; no ADR yet; not listed in ADR-0004 tier table. |
| 🔴 **3 NEW conflicts surfaced** | ADR-0004 reassigns Dialogue / Investigation / HUD tiers in ways that contradict their GDDs (which all declare `UGameInstanceSubsystem`). See §3. |

---

## 2. Traceability Summary (updated)

| System | TRs | Covered (ADR) | Partial | Gap |
|--------|----:|--------------:|--------:|----:|
| Movement | 14 | 2 | 1 | 11 |
| Physics | 10 | 0 | 1 | 9 |
| Scene Management | 13 | 0 | 1 | 12 |
| Infection Spread | 10 | **2** (+1 ADR-0004 tier) | 1 | 7 |
| Game State Machine | 12 | 12 | 0 | 0 |
| Player Controller | 11 | 6 | 2 | 3 |
| Camera System | 8 | 0 | 0 | 8 |
| Dialogue System | 9 | 1 (conflict, see §3) | 0 | 8 |
| Input System | 10 | 10 | 0 | 0 |
| Health System | 8 | 1 | 0 | 7 |
| Stealth System | 7 | 1 | 1 | 5 |
| Combat System | 9 | 1 | 1 | 7 |
| Alien AI | 12 | **2** (+1 ADR-0004 tier) | 1 | 9 |
| Investigation | 8 | 1 (conflict) | 0 | 7 |
| HUD System | 9 | 1 (conflict) | 0 | 8 |
| Inventory | 9 | **2** (+1 ADR-0004 tier) | 0 | 7 |
| Quest | 6 | **2** (+1 ADR-0004 tier) | 0 | 4 |
| Faction Reputation | 7 | **2** (+1 ADR-0004 tier) | 0 | 5 |
| Crafting | 6 | 0 | 0 | 6 |
| Map | 7 | 1 | 0 | 6 |
| Save/Load | 11 | **2** (+1 ADR-0004 tier) | 0 | 9 |
| **Tutorial (new)** | **11** | **0** | 0 | **11** |
| **TOTAL** | **185** | **49 (26%)** | **8 (4%)** | **128 (69%)** |

Coverage moved from 24% → 26%. ADR-0004 raises baseline by directly governing 7 subsystem-tier requirements (the 8th — GSM — was already covered by ADR-0002).

---

## 3. NEW Cross-ADR / ADR-vs-GDD Conflicts

ADR-0004 reassigns subsystem tiers. Three GDDs still declare the prior tier in their C++ sketch:

| # | Conflict | ADR-0004 says | GDD says | Severity |
|---|----------|---------------|----------|----------|
| **X-7** | Dialogue tier | `UWorldSubsystem` (per-level, resets on transition) | `class UDialogueSubsystem : public UGameInstanceSubsystem` (`dialogue-system.md:267`) | **High** |
| **X-8** | Investigation tier | `UWorldSubsystem` (clues per-level) | `class UInvestigationSubsystem : public UGameInstanceSubsystem` (`investigation-system.md:213`) | **High** — investigation threads explicitly persist across levels per GDD; ADR-0004 rationale ("Clues and threads are per-level; cleared automatically on transition") **contradicts the GDD's investigation thread persistence design**. |
| **X-9** | HUD tier | `ULocalPlayerSubsystem` | `class UHUDSubsystem : public UGameInstanceSubsystem` (`hud-system.md:241`) | Medium — tier is correct per UE viewport-bound HUD pattern, but GDD is unrevised. |
| ✓ Inventory | `UGameInstanceSubsystem` | `UGameInstanceSubsystem` | ✅ Aligned |

**X-8 is the most consequential.** The Investigation GDD designs threads as **session-persistent revelation chains** (`Unknown → Suspected → Confirmed → Revelation → Revealed`, with revelation deferral that can span multiple zones / load cycles). If `UInvestigationSubsystem` is a `UWorldSubsystem`, every level transition wipes thread state — this **breaks the design**, not just the C++ sketch. Either:
- (a) Revise ADR-0004 to make Investigation `UGameInstanceSubsystem` (rationale: thread state IS session-persistent), or
- (b) Split: per-level clue-discovery state in a `UWorldSubsystem`, persistent thread state in a `UGameInstanceSubsystem`. Two-class design.

Resolution must come before ADR-0004 advances to Accepted.

### Prior conflicts re-check

| ID | Status |
|----|--------|
| X-1 (pattern overlap) | None — still aligned. |
| **X-2 (GSM ownership)** | ✅ **RESOLVED**. GSM GDD Rule 1 rewritten to match ADR-0002. |
| X-3 (GSM tick budget) | Still open — minor. |
| X-4 (input routing) | Still aligned. |
| X-5 (dep cycle) | None. |
| X-6 (plugin dependency) | Still open — needs `.uproject` plugin manifest decision. |

---

## 4. ADR Dependency Topological Order

Updated for ADR-0004:

```
ADR-0001 (Cross-System Communication)        [foundation, no deps]
   ├── ADR-0002 (Game State Machine)         depends ADR-0001
   │      ├── ADR-0003 (Enhanced Input)      depends ADR-0001, ADR-0002
   │      └── ADR-0004 (Subsystem & Module)  depends ADR-0002
```

Linear acceptance order: **0001 → 0002 → 0003 → 0004** (ADR-0003 and ADR-0004 can advance in parallel once ADR-0002 is Accepted).

All four are currently `Proposed`. Per `docs/CLAUDE.md`, no stories may reference them until they reach `Accepted`. Promotion blocked behind X-7/X-8/X-9.

---

## 5. GDD Revision Flags

| GDD | Flag | Action |
|-----|------|--------|
| `dialogue-system.md` | C++ sketch declares `UGameInstanceSubsystem`; ADR-0004 says `UWorldSubsystem` | Revise GDD or ADR — pick one. |
| `investigation-system.md` | C++ declares `UGameInstanceSubsystem`; ADR-0004 says `UWorldSubsystem`; **but GDD design requires session-persistent thread state**. | **Architecture decision required**: revise ADR-0004 (recommend) or split the subsystem. Then update GDD. |
| `hud-system.md` | C++ declares `UGameInstanceSubsystem`; ADR-0004 says `ULocalPlayerSubsystem` | Revise GDD C++ sketch + access pattern. |
| `tutorial-system.md` | Not listed in ADR-0004 tier table | Add Tutorial to ADR-0004 (recommend Session tier — `FTutorialProgress` persists across levels per GDD Rule 8). |
| `game-state-machine.md` | ✅ Aligned with ADR-0002. (Two duplicate `## Open Questions` headers in file — cosmetic.) | Optional cleanup. |
| All other GDDs | No new flags since 08:32 review. | None. |

---

## 6. Engine Compatibility Audit

No deltas from 08:32 review. ADR-0004 introduces one post-cutoff API:
- `FSubsystemCollectionBase::InitializeDependency<T>()` (UE 5.3+) — explicitly disclosed as an escape hatch in the ADR; primary pattern is lazy access. ✅ Acceptable.

Engine-reference plugin notes (`UGameplayMessageSubsystem`, `UEnhancedInputUserSettings`) still need live-install verification — unchanged from prior review.

---

## 7. New TRs — Tutorial System (to be appended to tr-registry.yaml)

| Proposed TR-ID | Requirement (from `tutorial-system.md`) |
|----------------|------------------------------------------|
| TR-tutorial-001 | Tutorial operates as overlay within Playing only; no GSM Tutorial state added |
| TR-tutorial-002 | Two-stage activation per hint: Stage 1 trigger volume (PENDING), Stage 2 first-time action (COMPLETE) |
| TR-tutorial-003 | 5 hint states: INACTIVE, PENDING, COMPLETE, DISMISSED, MUTED with deterministic transitions |
| TR-tutorial-004 | World-space callout only — `UWidgetComponent` on world actor; no HUD elements, no screen-space prompts |
| TR-tutorial-005 | Subscribe to GSM `OnStateEntered`/`OnStateExited`; non-Playing → MUTE all PENDING; Playing return → restore |
| TR-tutorial-006 | Persist completed/dismissed HintIDs via Save/Load (`FTutorialProgress`); load skips trigger registration for terminal hints |
| TR-tutorial-007 | Observe `IMC_Default` actions for first-time-action detection; never consume input |
| TR-tutorial-008 | `bTutorialEnabled` global toggle; effect immediate, no restart; PENDING hints hold position invisibly when off |
| TR-tutorial-009 | Max concurrent active hints `N_max=2`; excess queues by priority `P_hint = 0.70/D_player + 0.30/SEQ_idx` |
| TR-tutorial-010 | Trigger radius `R_trigger = clamp((R_obj × 3.0) × M_density, 150, 500)` cm |
| TR-tutorial-011 | `UnlockCondition` (zone tag / quest flag / mechanic flag) gates trigger-volume registration for progressive hints |

All 11 are NEW — no prior registry match. Append on user approval.

---

## 8. Pre-Gate Checklist (Test & UX Infrastructure)

Re-checked via Glob:

| Artifact | Status |
|----------|--------|
| `tests/unit/` | ❌ Missing |
| `tests/integration/` | ❌ Missing |
| `.github/workflows/tests.yml` | ❌ Missing |
| `design/ux/accessibility-requirements.md` | ❌ Missing |
| `design/ux/interaction-patterns.md` | ❌ Missing |
| `design/ux/` directory | ❌ Missing entirely |

Unchanged from prior review. Gate-check still blocked.

---

## 9. Verdict

# 🔴 FAIL

**Rationale (delta-aware):**
1. **Coverage**: 26% (49/185) — small improvement over 24% from prior review. Most system-specific architecture (Physics, World Partition, Camera, Health, Combat, AI, Save/Load serialization, dialogue/clue/quest internals, crafting, map, infection tick loop, movement CMC extension, PC context resolver, UMG dual-mode) remains undocumented.
2. **NEW cross-ADR conflicts (X-7/X-8/X-9)**: ADR-0004 reassigns three subsystem tiers in ways that contradict the dialogue / investigation / HUD GDDs. **X-8 is a design correctness issue** — investigation thread persistence is broken if Investigation is a `UWorldSubsystem` as ADR-0004 currently states.
3. **ADR status**: All 4 ADRs still `Proposed`. ADR-0002 is now eligible for promotion (X-2 resolved). ADR-0001 also promotable. ADR-0003 and ADR-0004 blocked behind their respective issues (post-cutoff API verification; X-7/X-8/X-9).
4. **Tutorial GDD has no ADR coverage** and is not in ADR-0004's tier table.
5. **Pre-gate infrastructure**: unchanged — no tests, no CI, no UX specs.

---

## 10. Blocking Issues (must fix before gate pass)

| # | Blocker | Action |
|---|---------|--------|
| B-1 | ✅ ~~GSM ownership contradiction~~ | RESOLVED (GSM GDD Rule 1 updated). |
| B-2 | **X-8 Investigation tier vs persistence design** | Decide: revise ADR-0004 to make Investigation Session-tier (recommended), or split (per-level clue + session thread). |
| B-3 | **X-7 Dialogue tier conflict** | Reconcile `dialogue-system.md:267` with ADR-0004 (`UWorldSubsystem` is correct — revise GDD). |
| B-4 | **X-9 HUD tier conflict** | Revise `hud-system.md:241` C++ sketch to `ULocalPlayerSubsystem`. |
| B-5 | Tutorial System absent from ADR-0004 tier table | Add row: Tutorial → Session tier (`UGameInstanceSubsystem`) per Rule 8 cross-level persistence. |
| B-6 | All ADRs still `Proposed` | Promote ADR-0001 and (after X-2 conflict closure) ADR-0002 to Accepted. ADR-0003/0004 after their respective open issues close. |
| B-7 | No Physics ADR (C-1) | Author next per backlog. |
| B-8 | No Save/Load ADR (F-3) | Author per backlog. |
| B-9 | No test infrastructure | Run `/test-setup`. |
| B-10 | No UX accessibility spec | Run `/ux-design`. |
| B-11 | Post-cutoff API verification (UGameplayMessageSubsystem, UEnhancedInputUserSettings, FSubsystemCollectionBase::InitializeDependency) | Verify against UE 5.7 install; update engine-reference module docs. |

---

## 11. Required ADRs — Updated Priority Backlog

Unchanged from prior list except F-1 is closed (ADR-0004 written, pending acceptance). Next priorities:

1. **ADR-0005 — Data-Driven Authoring Pipeline (Data Tables)** *(Foundation, F-2)*
2. **ADR-0006 — Save/Load Serialization Architecture** *(Foundation, F-3)*
3. **ADR-0007 — UE 5.7 Engine API Pinning Policy** *(Foundation, F-4)*
4. **ADR-0008 — Physics & Collision Architecture** *(Core, C-1)*
5. **ADR-0009 — World Partition & Streaming Strategy** *(Core, C-2)*
6. *(Items 6–22 unchanged from `architecture-review-2026-05-19.md` §10)*

After Foundation + Core ADRs (5–11) land, run `/create-control-manifest` then re-run `/architecture-review`.

---

## 12. Notes

- The 08:32 review's biggest blocker (X-2) closed cleanly with a single GDD rewrite. Good propagation hygiene.
- ADR-0004 is high-quality but the tier reassignments need to round-trip back into the affected GDDs before it can be Accepted. Run `/propagate-design-change` on dialogue / investigation / hud GDDs after the X-7/X-8/X-9 decisions land.
- Tutorial System is well-designed and self-contained — adding its TRs to the registry and one row to ADR-0004's tier table covers it fully. Tutorial likely does not need its own ADR.
- Prior review's §10 backlog is still valid; do not duplicate it here.
