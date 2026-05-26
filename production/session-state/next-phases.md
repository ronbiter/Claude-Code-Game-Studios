# Next Phases — Post Architecture-Review Remediation

**Created:** 2026-05-26
**Project state:** All Core/MVP ADRs (ADR-0001..0018) authored. Coverage ~74%. Verdict CONCERNS (non-blocking). Housekeeping items #1, #2, #3, #5 from architecture-review-2026-05-26.md are DONE.

This document is the handoff for fresh sessions to complete the remaining work. Run each phase in its own session (use `/clear` between phases).

---

## Phase A — `/test-setup` ✅ DONE (2026-05-26)

**Goal:** Scaffold the test framework + CI/CD pipeline so stories can produce test evidence. This is a Pre-Production gate blocker.

**Completed 2026-05-26:** `tests/` scaffolded (unit, integration, smoke, evidence), `.github/workflows/tests.yml`, `.claude/rules/test-standards.md`. Both pre-gate blockers now done.

**Why now:** No `tests/` directory exists yet. `/gate-check pre-production` will FAIL until this is run. Smallest scope of the remaining items — do this first.

### Pre-flight check

Before starting the session, verify:
- `CLAUDE.md` pins engine: Unreal Engine 5.7 ✅
- `docs/engine-reference/unreal/VERSION.md` exists ✅
- No `tests/` directory yet (expected — that's what this creates)

### Session prompt (paste after `/clear`)

```
Run /test-setup for this project.

Context:
- Engine: Unreal Engine 5.7 (C++ primary, Blueprint secondary)
- Architecture: 18 ADRs authored (docs/architecture/adr-0001..0018-*.md)
- Test framework choice: use Unreal Automation Testing (UE's built-in framework
  via IMPLEMENT_SIMPLE_AUTOMATION_TEST / IMPLEMENT_COMPLEX_AUTOMATION_TEST)
  unless you find a compelling reason to recommend otherwise.
- CI: GitHub Actions on Windows runners (build + test). Project is git-backed
  but does not yet have .github/workflows/.

The skill will guide you through:
1. tests/ directory structure (unit/, integration/, fixtures/, helpers/)
2. Test runner configuration (RunUAT / Automation commandlet wrapper)
3. GitHub Actions workflow (.github/workflows/ci.yml) — build + test on PR
4. First sample test per category so future stories have a template

Follow the skill's collaboration protocol — ask before each write.
```

### Expected outputs

- `tests/` directory tree with at least one example test per category
- `.github/workflows/ci.yml` (or equivalent CI config)
- Test runner script (Powershell + UAT invocation)
- Updates to `production/session-state/active.md` marking pre-gate test-setup ✅

### Estimated time

1 session. Skill is well-scoped. If it takes >1 session, the skill probably found unexpected complexity — pause and review.

---

## Phase B — `/ux-design` ✅ DONE (2026-05-26)

**Goal:** Author UX specs for the screens, flows, and HUD elements that the GDDs reference. This is the other Pre-Production gate blocker.

**Completed 2026-05-26:** 8 specs written in `design/ux/` — hud.md, inventory.md, dialogue.md, main-menu.md, pause-menu.md, save-load.md, quest-journal.md, map.md. Gate requirement met.

**Why now:** HUD-related TRs (covered by ADR-0016) reference UX specs that don't exist. `/gate-check pre-production` requires `ux/` directory populated.

**Order:** Run AFTER `/test-setup` (smaller scope first). They are technically parallelizable across two separate humans but should not be done in the same session.

### Pre-flight check

- `design/gdd/hud-system.md` exists ✅
- `design/gdd/player-controller-system.md` exists ✅
- `ux/` directory does not yet exist (expected)

### Session prompt (paste after `/clear`)

```
Run /ux-design for the HUD and core gameplay screens.

Context:
- Game concept: First-person hostile-world survival, infection-spread mechanic,
  stealth-vs-combat dual loop. See design/gdd/ for the full GDD set.
- HUD owner: UHUDSubsystem (ULocalPlayerSubsystem tier) — see ADR-0016.
- Input rebinding UI: lives in HUD widget hierarchy per C4 resolution (ADR-0003).
- All 18 Core/MVP ADRs are authored — read them via the index before designing
  to avoid contradicting locked architecture.

Recommended scope for this session (the skill will help you pick):
1. HUD design (hud-design.md) — combat HUD, stealth HUD, infection heatmap,
   health/stamina, detection meter, threat indicators
2. Main menu flow
3. Pause menu flow
4. Settings / input rebinding screen (C4 resolution requires this)
5. Inventory screen (VS-tier — can defer if scope is tight)
6. Save/Load screen flow

Save/Load and Inventory may be deferred to VS-tier ADR work — confirm with the
skill which screens are MVP-blocking vs VS-tier.

Read first (the skill will tell you which to load):
- design/gdd/hud-system.md
- design/gdd/player-controller-system.md
- design/gdd/save-load-system.md
- docs/architecture/adr-0016-hud-system-architecture.md
- docs/architecture/adr-0003-enhanced-input-architecture.md
- docs/architecture/adr-0018-player-controller-architecture.md

Follow the skill's section-by-section flow. Ask before each write.
```

### Expected outputs

- `ux/hud-design.md`
- `ux/flows/main-menu.md`, `ux/flows/pause.md`, `ux/flows/settings.md`
- Optionally: inventory/save-load screen specs (or defer to VS-tier)
- `production/session-state/active.md` updated marking ux/ ✅

### Estimated time

1–2 sessions depending on scope. MVP-only HUD/menus = 1 session. Adding VS-tier
screens = split across 2 sessions.

---

## Phase C — VS-tier Feature ADRs / Sign-offs (8 systems)

**Goal:** For each of the 8 VS-tier Feature systems, either (a) author a dedicated ADR, or (b) write an explicit "covered by cross-cutting ADRs" sign-off documenting the behavioural rules and which existing ADRs satisfy them.

**Why now:** Non-blocking for Pre-Production gate. Can run during VS-tier development. But if you want clean architecture closure before `/create-architecture`, run this phase before that.

**Order recommendation:** Group by complexity. Sign-offs first (smaller scope), dedicated ADRs second.

### The 8 systems

| # | System | Recommended treatment | Cross-cutting ADRs partially covering |
|---|--------|----------------------|---------------------------------------|
| 1 | **Tutorial** | Sign-off | ADR-0001 (events), ADR-0002 (GSM), ADR-0004 (subsystem), ADR-0006 (save) |
| 2 | **Map** | Sign-off (UI-heavy; covered by HUD + Save) | ADR-0002 (GSM), ADR-0006 (save) |
| 3 | **Faction** | Sign-off | ADR-0001 (events), ADR-0006 (save) |
| 4 | **Crafting** | Sign-off | ADR-0005 (data tables), ADR-0006 (save) |
| 5 | **Inventory** | Sign-off (may need lightweight ADR) | ADR-0004 (subsystem), ADR-0005 (data), ADR-0006 (save) |
| 6 | **Quest** | Dedicated ADR (state machine complexity) | ADR-0002 (GSM), ADR-0005 (data), ADR-0006 (save) |
| 7 | **Dialogue** | Dedicated ADR (already C2-resolved but needs full ADR) | ADR-0001 (events), ADR-0004 (subsystem) |
| 8 | **Investigation** | Dedicated ADR (clue/evidence pipeline complexity) | ADR-0001 (events), ADR-0004 (subsystem), ADR-0005 (data) |

### Pre-flight check (run once before Phase C starts)

- All 22 GDDs exist in `design/gdd/`
- ADR index up to date: `docs/registry/adr-index.yaml` shows ADR-0001..0018
- TR registry current: `docs/architecture/tr-registry.yaml` v4

### Session prompt template — for SIGN-OFF (Tutorial, Map, Faction, Crafting, Inventory)

Run this one system per session. `/clear` between systems.

```
I want to write a "covered-by-cross-cutting-ADRs" sign-off for the [SYSTEM NAME] system.

Goal: produce docs/architecture/sign-off-[system-slug].md that explicitly
documents:
1. Every behavioural rule from design/gdd/[system-slug]-system.md
2. Which existing ADR satisfies each rule
3. Any rules NOT covered by an existing ADR (and decide: defer, add ADR, or
   add a one-paragraph supplement to an existing ADR)
4. The system's tier (Session / World / Player / Per-Actor) — must align
   with adr-subsystems.yaml registry
5. Implementation routing: which existing classes/subsystems will own the
   behaviour vs which need new ones

Read first:
- design/gdd/[system-slug]-system.md
- docs/registry/adr-index.yaml
- docs/architecture/tr-registry.yaml (filter to TR-[system-slug]-* entries)
- The cross-cutting ADRs from the table above for this system

Then propose the sign-off doc structure before writing. Follow the project's
GDD design protocol (collaboration, gates, approval before writes).
```

### Session prompt template — for DEDICATED ADR (Quest, Dialogue, Investigation)

Each one is a full `/architecture-decision` run. Allocate one session per ADR.

```
Run /architecture-decision for the [SYSTEM NAME] system.

Context:
- All 18 Core/MVP ADRs are Accepted/Proposed. This is a VS-tier feature ADR.
- The system GDD: design/gdd/[system-slug]-system.md
- Engine: Unreal Engine 5.7 (UE 5.7 breaking changes apply — see
  docs/engine-reference/unreal/VERSION.md and modules/ai-perception.md)
- Existing partial coverage from cross-cutting ADRs (the skill will discover
  via the registry):
  [list from the table above]

The new ADR will be:
- Quest: ADR-0019 (recommended) — UQuestSubsystem (Session-tier per ADR-0004),
  quest state FSM, save payload sub-struct, dialogue/investigation hooks
- Dialogue: ADR-0020 — already C2-resolved as UWorldSubsystem split with
  Session-tier relationship persistence. Full ADR formalising the split.
- Investigation: ADR-0021 — UInvestigationSubsystem (Session-tier), clue
  registration, threshold model, narrative-defer gate via IsPlayerUnderThreat()

Follow the skill — engine specialist validation, registry updates, no
acceptance until dependent ADRs are themselves Accepted.
```

### Expected outputs (Phase C complete)

- 5 sign-off docs: `docs/architecture/sign-off-tutorial.md`, `sign-off-map.md`, `sign-off-faction.md`, `sign-off-crafting.md`, `sign-off-inventory.md`
- 3 ADRs: ADR-0019 (Quest), ADR-0020 (Dialogue), ADR-0021 (Investigation)
- Registry updates: `adr-index.yaml` + relevant domain files
- `architecture-traceability.md` refreshed — coverage should jump from ~74% to ~95%+

### Estimated time

5 sign-off sessions + 3 ADR sessions = 8 sessions total. Budget 1 per day if context-heavy.

---

## Phase D — `/create-architecture` (Synthesis)

**Goal:** Read all ADRs, GDDs, and registry files; produce the master `docs/architecture/architecture.md` blueprint. This is what `/gate-check pre-production` validates against.

**Prerequisite:** Phases A, B, and ideally C are complete. Architecture review verdict is CONCERNS or PASS (not FAIL).

### Session prompt

```
Run /create-architecture for this project.

Context:
- 18 Core/MVP ADRs + (8 VS-tier ADRs/sign-offs if Phase C complete)
- Engine: Unreal Engine 5.7
- Registry: docs/registry/adr-index.yaml + 5 domain files
- Most recent architecture-review verdict: see
  docs/architecture/architecture-review-2026-05-26.md

The skill will section-by-section synthesise the master doc. Approve each
section before it moves on. Do not let it skip ADR conformance verification.
```

### Expected outputs

- `docs/architecture/architecture.md` (the master doc)
- Updates to `production/project-stage-report.md`

---

## Phase E — `/gate-check pre-production`

**Goal:** Verify the project is ready to enter Production phase. PASS / CONCERNS / FAIL verdict.

**Prerequisite:** Phases A, B, D complete. Phase C strongly recommended.

### Session prompt

```
Run /gate-check pre-production.

Context:
- All Core/MVP ADRs authored. Coverage >=95% per architecture-traceability.md.
- tests/ scaffolded (Phase A)
- ux/ specs authored for MVP screens (Phase B)
- docs/architecture/architecture.md exists (Phase D)
- VS-tier ADRs/sign-offs: [DONE / DEFERRED to Production]

Run the standard gate criteria. Surface any blockers explicitly. If the verdict
is CONCERNS, list the specific items the team needs to resolve before
proceeding to Production.
```

### Expected outputs

- `production/gate-checks/pre-production-2026-MM-DD.md`
- Updates to `production/project-stage-report.md`
- Verdict: PASS / CONCERNS / FAIL with action list

---

## Quick Reference — Order of Operations

```
Phase A: /test-setup            (1 session)  ← do first
Phase B: /ux-design             (1-2 sessions)
Phase C: VS-tier ADRs/sign-offs (8 sessions, optional before D)
Phase D: /create-architecture   (1 session)
Phase E: /gate-check pre-prod   (1 session)
```

Minimum path to enter Production: A → B → D → E (Phase C deferred).
Clean path: A → B → C → D → E.

---

## Notes for fresh sessions

- **CLAUDE.md still active:** All project rules (UE 5.7, context-mode rules, collaboration protocol) persist across `/clear`.
- **Session state:** `production/session-state/active.md` is the living checkpoint. Update it at the end of each session.
- **Registry hygiene:** Never load all `docs/registry/adr-*.yaml` domain files at once unless doing a cross-domain audit. Load `adr-index.yaml` first, then the specific domain.
- **Architecture review re-run:** After Phase C completes, re-run `/architecture-review` once before `/create-architecture` to refresh the coverage matrix.
