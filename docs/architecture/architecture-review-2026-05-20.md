# Architecture Review Report

> **Date:** 2026-05-20
> **Engine:** Unreal Engine 5.7
> **Mode:** `/architecture-review` (full)
> **GDDs Reviewed:** 22 (via TR registry baseline)
> **ADRs Reviewed:** 6 (4 Accepted, 2 Proposed)
> **Verdict:** 🔴 FAIL

---

## Traceability Summary

207 technical requirements across 22 systems (source: `docs/architecture/tr-registry.yaml`).
The 6 existing ADRs are **cross-cutting foundation ADRs** (communication, GSM, input,
subsystem tiers, data strategy, save/load) — not per-system ADRs. Coverage is therefore
assessed at the system level.

| Bucket | Count | % |
|--------|-------|---|
| ✅ Covered | ~59 | 28% |
| ⚠️ Partial (cross-cutting concern covered; core system architecture undocumented) | ~35 | 17% |
| ❌ Gap | ~113 | 55% |

### Per-System Coverage

| System | Reqs | Cov | Part | Gap | Notes |
|--------|------|-----|------|-----|-------|
| Game State Machine | 12 | 12 | 0 | 0 | ADR-0002 fully covers |
| Input | 10 | 9 | 1 | 0 | ADR-0003 (Proposed); TR-input-009 persistence unresolved (OQ-1) |
| Investigation | 8 | 4 | 2 | 2 | tier/data/save/events covered |
| Inventory | 9 | 3 | 3 | 3 | tier/data/save covered |
| Faction Reputation | 7 | 3 | 3 | 1 | data/save/events covered |
| Health | 8 | 4 | 3 | 1 | component tier + events + save |
| Tutorial | 11 | 4 | 4 | 3 | GSM/save/input covered |
| Quest | 6 | 2 | 2 | 2 | data + save only |
| Crafting | 6 | 2 | 2 | 2 | data + save only |
| Dialogue | 9 | 1 | 3 | 5 | **tier conflict (C2)** |
| Infection Spread | 10 | 2 | 2 | 6 | tier/events ok; **core tick architecture GAP** (highest-risk system) |
| HUD | 9 | 1 | 2 | 6 | tier ok; dual-renderer/UMG architecture GAP |
| Player Controller | 11 | 3 | 2 | 6 | input routing ok; context-action-resolver GAP |
| Alien AI | 12 | 1 | 1 | 10 | subsystem tier ok; **BT/EQS/Perception/Nav architecture GAP** |
| Combat | 9 | 2 | 0 | 7 | events/IMC only |
| Stealth | 7 | 1 | 0 | 6 | events only |
| Map | 7 | 1 | 1 | 5 | save only |
| Save/Load | 11 | 0 | 3 | 8 | **ADR-0006 predates GDD, does not map TR-save-\* (C1/C3)** |
| Movement | 14 | 2 | 0 | 12 | ❌ **no dedicated ADR** (CMC extension, MOVE_Custom, foot IK, cover) |
| Scene Management | 13 | 1 | 1 | 11 | ❌ **no ADR** (World Partition, Data Layers, HLOD, streaming budgets) |
| Physics | 10 | 0 | 0 | 10 | ❌ **no ADR** (Chaos, collision channels, destruction, ragdoll) |
| Camera | 8 | 1 | 0 | 7 | ❌ **no ADR** (modes, spring arm, shake, Lumen exposure) |

> Counts are an analytical estimate assessed at the system level; the aggregate (~28% covered)
> aligns with the prior review's measured ~24% ADR coverage.

---

## Cross-ADR Conflicts

### 🔴 C1 (HIGH) — ADR-0006 save schema incomplete vs Save/Load GDD
**Type:** Integration / State persistence
ADR-0006 was authored before `design/gdd/save-load-system.md` existed (the ADR still records
that GDD as "Not Started"). The GDD now defines TR-save-001..011. The ADR's
`UHostileWorldSaveGame` schema contains only Tutorial/Quest/Faction/Inventory/Infection
sub-structs, but **TR-save-008 requires** Player Transform, Health, Crafting, Investigation,
Map, World Flags, and GSM state — all missing. Additional mismatches:
- Slot name: ADR `hostile_world_autosave` vs GDD `HostileWorldSave_Slot0` (TR-save-002)
- Trigger model: ADR generic checkpoint message vs GDD zone-entry + investigation-event + clean-exit (TR-save-001)
- Clean-exit blocking write (TR-save-009) not addressed by an async-only ADR
- Corruption handling (TR-save-005: delete + fallback to defaults) absent from ADR

**Impact:** Implementing ADR-0006 as written produces a save system that cannot persist the
state the GDD requires.
**Resolution:** Revise ADR-0006 to align with the new Save/Load GDD, then move to Accepted.

### 🔴 C2 (HIGH) — ADR-0004 Dialogue World-tier conflicts with persistence requirement
**Type:** State management / Lifecycle
ADR-0004 assigns `UDialogueSubsystem` to **World tier** (destroyed/recreated per level). But
TR-dialogue-003 (per-NPC Trust/Fear/Knowledge) and TR-dialogue-008 (SaveDialogueState/Restore)
require relationship state to persist across the session — and ADR-0006 contains **no
`FDialogueSaveData` sub-struct**.
**Impact:** NPC relationship state is wiped on every level transition; nothing persists it.
**Resolution options:**
1. Move the persistent relationship store to a Session-tier subsystem (split active-conversation
   world state from persistent relationship state), or
2. Keep Dialogue World-tier but add a Dialogue save provider + `FDialogueSaveData` to ADR-0006.
Reconcile across ADR-0004 and ADR-0006.

### 🟠 C4 (MEDIUM, open question) — ADR-0003 vs ADR-0006 input rebinding ownership
**Type:** Data ownership
TR-input-009 requires rebindings persisted "via Save/Load (per-player profile)." ADR-0003 stores
them in `UEnhancedInputUserSettings`' own file; ADR-0006 does not include them. ADR-0003 OQ-1
flags this and it remains unresolved.
**Resolution:** Decide ownership when ADR-0006 is revised; document in both ADRs.

---

## ADR Dependency Order

No cycles detected. Topological order (status in brackets):

```
Foundation:
  1. ADR-0001  Cross-System Communication        [Accepted]
Depends on Foundation:
  2. ADR-0002  Game State Machine                 [Accepted]   (requires 0001)
     ADR-0004  Subsystem & Module Architecture    [Accepted]   (requires 0002)
Feature layer:
  3. ADR-0003  Enhanced Input                     [PROPOSED]   (requires 0001, 0002)
     ADR-0005  Game Data Strategy                 [Accepted]   (requires 0004)
     ADR-0006  Save/Load Serialization            [PROPOSED]   (requires 0004)
```

No unresolved-dependency blocks — all dependencies of the Proposed ADRs are Accepted.
However **ADR-0003 and ADR-0006 are themselves still Proposed**, so input and save/load
implementation are gated until they are Accepted (and ADR-0006 must clear C1 first).

---

## Engine Compatibility

All 6 ADRs have an Engine Compatibility section ✅. All target UE 5.7 ✅. No deprecated-API
usage — ADR-0003 correctly forbids legacy `BindAction`/`BindAxis` and the pre-5.3
`AddPlayerMappedKey`/`PlayerMappableInputConfig` rebinding path ✅.

Post-cutoff APIs in use:
- ADR-0001: `UGameplayMessageSubsystem` (UE 5.1, LOW)
- ADR-0003: `UEnhancedInputUserSettings` (UE 5.3+, MEDIUM — validated against `modules/input.md`)
- ADR-0004: `FSubsystemCollectionBase::InitializeDependency<T>()` (UE 5.3+, LOW)
- ADR-0006: `AsyncSaveGameToSlot` / `AsyncLoadGameFromSlot` (HIGH — 4 Verification-Required items unperformed)

### Engine Specialist Findings (unreal-specialist)

- **ADR-0006 [HIGH]:** Async save/load delegate signatures confirmed correct for 5.7. New defects:
  `CachedSave` must be `UPROPERTY()` or it is garbage-collected between checkpoint and async-write
  completion; `static constexpr TCHAR* SaveSlotName` will **not compile** (needs `TCHAR[]` or
  `FString`); the "OnStart() not Init()" rationale is weak (correct call site, wrong stated cause —
  real reason is no valid world during `Init()`); the 4 Verification-Required items remain
  unperformed. **Not ready to accept.**
- **ADR-0003 [MEDIUM]:** Rebinding path confirmed. The "`bIsPlayerMappable=false` auto-locks
  IA_Pause" claim is overstated — mappability is governed by the IMC mapping's
  PlayerMappableKeySettings, not a bool on the UInputAction; add a code guard rather than relying
  on silent rejection. `GetUserSettings()` can return null unless `bEnableUserSettings` is enabled
  in Enhanced Input project settings — add a null guard and a Verification item.
- **ADR-0002 [NEW]:** `IsTickable() { return !IsTemplate(); }` is insufficient —
  `FTickableGameObject` ticks from construction, *before* `Initialize()`, risking queue drain
  before `InitValidTransitions()` runs. Gate `IsTickable` on a `bInitialized` flag set in
  `Initialize()`.
- **ADR-0001 [NEW]:** `UPROPERTY()` on `FGameplayMessageListenerHandle` does nothing (it is a
  plain struct, not a UObject ref); the "let the UPROPERTY destructor unregister" comment is false.
  Listeners must call `Unregister()` explicitly in `EndPlay`/`Deinitialize`.
- **ADR-0004:** Confirmed correct (tier table, lazy access, `InitializeDependency<T>()`,
  cross-tier ordering).

---

## GDD Revision Flags (Architecture → Design Feedback)

No *new* engine-reality revision flags. The GDDs affected by the conflicts above
(`dialogue-system.md`, `save-load-system.md`) are already marked `Needs Revision` in the systems
index. The C1/C2 conflicts are ADR-side reconciliations, not GDD assumptions contradicted by
verified engine behaviour.

---

## Architecture Document Coverage

`docs/architecture/architecture.md` does not exist. The `/create-architecture` master document is
still pending (per the systems-index Next Steps). Orphaned-architecture check is N/A.

---

## TR Registry Notes (not applied this run)

Two registry entries have text that is stale relative to the current Tutorial GDD (IDs unchanged;
only `requirement` text + a `revised` date should be updated):
- **TR-tutorial-003** still lists the removed `DISMISSED` state — design now uses `ACTIVE`.
- **TR-tutorial-006** still says `FTutorialProgress` — renamed to `FTutorialSaveData`.

Correspondingly, ADR-0006's `FTutorialSaveData.DismissedHintIDs` field is stale if `DISMISSED`
was removed from the design.

---

## Verdict: 🔴 FAIL

### Blocking Issues (must resolve before PASS)

1. **Foundation-layer systems have zero dedicated ADR coverage.** Physics, Scene Management,
   Camera, and Movement involve the highest knowledge-risk UE 5.7 APIs (Chaos physics, World
   Partition / Data Layers / HLOD, Substrate / Lumen, custom CharacterMovementComponent) and have
   no architectural decision.
2. **C1** — ADR-0006 save schema is incomplete and contradicts the now-existing Save/Load GDD
   (missing 6 of the required save payloads; slot-name / trigger / blocking-write / corruption
   mismatches).
3. **C2** — ADR-0004 Dialogue World-tier assignment loses the persistent NPC relationship state
   required by TR-dialogue-003 / TR-dialogue-008.
4. **ADR-0003 and ADR-0006 are still Proposed** with the engine defects listed above; input and
   save/load implementation are gated.

### Required ADRs (most foundational first)

1. **Physics & Collision Architecture** — Chaos, custom collision channels, physical materials,
   Chaos Destruction, ragdoll blend.
2. **Scene Streaming Architecture** — World Partition authority, Data Layer swap state machine,
   HLOD variants, streaming memory/I-O budgets.
3. **Camera Architecture** — 5 camera modes, spring-arm collision, shake stacking, Lumen
   auto-exposure.
4. **Movement Architecture** — CMC extension, MOVE_Custom dodge/cover, foot IK, noise emission.
5. Then: revise + accept **ADR-0006** (clear C1, fix specialist defects), reconcile
   **ADR-0004 / ADR-0006** dialogue persistence (C2), and accept **ADR-0003** after the input
   fixes.

### Pre-Gate Checklist

- ❌ `tests/unit/` and `tests/integration/` — run `/test-setup`
- ❌ `.github/workflows/tests.yml` — run `/test-setup`
- ❌ `design/accessibility-requirements.md` — run `/ux-design`
- ❌ `design/ux/interaction-patterns.md` — run `/ux-design`

Do not run `/gate-check pre-production` until the blocking issues above and the pre-gate items
are resolved.
