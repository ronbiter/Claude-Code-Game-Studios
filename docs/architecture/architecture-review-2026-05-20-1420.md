# Architecture Review Report

> **Date:** 2026-05-20 (14:20)
> **Engine:** Unreal Engine 5.7
> **Mode:** `/architecture-review` (full)
> **GDDs Reviewed:** 22 (via `docs/architecture/tr-registry.yaml` baseline, ~207 reqs)
> **ADRs Reviewed:** 11 (4 Accepted, 7 Proposed)
> **Verdict:** 🔴 FAIL (foundation gaps closed since AM review; remaining blockers are core-gameplay ADRs + ADR reconciliations)

---

## Progress Since 2026-05-20 (AM) Review

The morning review's #1 blocker was *"Foundation-layer systems have zero dedicated ADR
coverage"* and listed 4 required ADRs. **All four were authored — plus a fifth (Animation):**

| New ADR | Status | Closes |
|---------|--------|--------|
| ADR-0007 Physics & Collision | Proposed | TR-physics ×10 ✅ |
| ADR-0008 Scene Streaming | Proposed | TR-scene ×13 ✅ |
| ADR-0009 Camera | Proposed | TR-camera ×8 ✅ |
| ADR-0010 Movement | Proposed | TR-movement ×14 ✅ |
| ADR-0011 Animation | Proposed | foot IK / cover layering / combat montages ✅ |

System-level coverage rose from ~28% → **~50%**.

---

## Traceability Summary

Assessed at the system level against the 22-system, ~207-requirement TR registry. The 11 ADRs
are a mix of cross-cutting foundation ADRs (0001–0006) and per-domain ADRs (0007–0011); several
core gameplay systems still have no dedicated ADR for their internal logic.

| Bucket | ~Count | % |
|--------|--------|---|
| ✅ Covered | ~105 | ~50% |
| ⚠️ Partial (cross-cutting concern covered; core logic undocumented) | ~40 | ~19% |
| ❌ Gap | ~62 | ~30% |

### Per-System Coverage

| System | Reqs | Status | Notes |
|--------|------|--------|-------|
| Game State Machine | 12 | ✅ Full | ADR-0002 |
| Input | 10 | ✅ Full* | ADR-0003 (Proposed); OQ-1 rebinding persistence open |
| Physics | 10 | ✅ Full | ADR-0007 (Proposed) |
| Scene Management | 13 | ✅ Full | ADR-0008 (Proposed) |
| Camera | 8 | ✅ Full | ADR-0009 (Proposed) |
| Movement | 14 | ✅ Full | ADR-0010 + ADR-0011 + ADR-0007 (all Proposed) |
| Health | 8 | ⚠️ Mostly | tier + events + save + fall damage (ADR-0007); damage pipeline partial |
| Investigation | 8 | ⚠️ Partial | tier/data/save/events; thread state machine + gaze/revelation logic undocumented |
| Inventory | 9 | ⚠️ Partial | tier/data/save; grid/category/weapon-slot logic undocumented |
| Faction Reputation | 7 | ⚠️ Partial | data/save/events; relationship matrix logic undocumented |
| Tutorial | 11 | ⚠️ Partial | GSM/save/input; **C5 stale model in ADR-0004/0006** |
| Dialogue | 9 | ⚠️ Partial | tier(**C2**)/data/events/conversation-camera; relationship persistence broken |
| Quest | 6 | ❌ Mostly Gap | data + save only; evaluation + deferred-consequence undocumented |
| Crafting | 6 | ❌ Mostly Gap | data + save only; channel logic undocumented |
| Player Controller | 11 | ⚠️ Partial | input routing ok; async context-action resolver partial |
| Combat | 9 | ❌ Mostly Gap | hitscan(0007)+recoil(0009)+montages(0011)+events; **weapon data/damage pipeline/jam/lifecycle GAP** |
| Stealth | 7 | ❌ Mostly Gap | events + movement reads only; **detection scoring/state machine GAP** |
| HUD | 9 | ❌ Mostly Gap | tier ok; **dual-renderer (Immersive/Tactical) + UMG architecture GAP** |
| Map | 7 | ❌ Mostly Gap | scene dep only; **also missing from ADR-0006 save schema (C1)** |
| Save/Load | 11 | ❌ Gap | **ADR-0006 predates GDD; maps no TR-save-\* (C1)** |
| Alien AI | 12 | ❌ Gap | subsystem tier + perception channel + perception-tuning data only; **BT/EQS/Nav/squad GAP** (highest risk) |
| Infection Spread | 10 | ❌ Gap | tier + events + DataLayer-swap consumer; **tick loop / per-cell eval / source HP / fast-travel sim GAP** (highest risk) |

> Estimates assessed at the system level; aggregate (~50%) is up from the AM review's ~28%.

---

## Cross-ADR Conflicts

### 🔴 C1 (HIGH) — ADR-0006 save schema incomplete vs Save/Load GDD
**Type:** Integration / State persistence
ADR-0006 was authored before `design/gdd/save-load-system.md` existed and still records that GDD
as "Not Started." `UHostileWorldSaveGame` contains only Tutorial/Quest/Faction/Inventory/Infection
sub-structs, but **TR-save-008 requires** Player Transform, Health, Crafting, Investigation, Map,
World Flags, and GSM state — all missing. ADR-0008 also references an `FSceneStateData` sub-struct
that ADR-0006 never defines. Further mismatches:
- Slot name: ADR `hostile_world_autosave` vs GDD `HostileWorldSave_Slot0` (TR-save-002)
- Trigger model: ADR generic checkpoint message vs GDD zone-entry + investigation-event + clean-exit (TR-save-001)
- Clean-exit blocking write (TR-save-009) not addressed by an async-only ADR
- Corruption handling (TR-save-005: delete + fallback to defaults) absent from ADR

**Impact:** Implementing ADR-0006 as written produces a save system that cannot persist the state
the GDD requires.
**Resolution:** Revise ADR-0006 to align with the Save/Load GDD (add the 6 missing payloads +
`FSceneStateData` + `FDialogueSaveData`); then move to Accepted.

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
them in `UEnhancedInputUserSettings`' own file; ADR-0006 does not include them. ADR-0003 OQ-1 flags
this and it remains unresolved.
**Resolution:** Decide ownership when ADR-0006 is revised; document in both ADRs.

### 🟡 C5 (MEDIUM, NEW) — Stale Tutorial model in ADR-0004 and ADR-0006
**Type:** Integration / stale contract
The TR registry was updated (TR-tutorial-003 → 5 states INACTIVE/PENDING/ACTIVE/COMPLETE/MUTED, no
`DISMISSED`; TR-tutorial-006 → `FTutorialSaveData`), but:
- **ADR-0004** (line 70) still says `FTutorialProgress` ("completed/dismissed hint IDs").
- **ADR-0006** still defines `FTutorialSaveData.DismissedHintIDs` and its GDD-requirements table
  (line 317) still references `FTutorialProgress` / "completed/dismissed."
**Impact:** Implementer would re-introduce the removed `DISMISSED` concept and an unused save field.
**Resolution:** Remove `DismissedHintIDs` from ADR-0006; update ADR-0004 line 70 and ADR-0006 GDD
table to `FTutorialSaveData` (completed IDs only).

---

## ADR Dependency Order

No cycles detected. Topological order (status in brackets):

```
Foundation:
  1. ADR-0001  Cross-System Communication        [Accepted]
Depends on Foundation:
  2. ADR-0002  Game State Machine                 [Accepted]   (requires 0001)
     ADR-0004  Subsystem & Module Architecture    [Accepted]   (requires 0002)
     ADR-0005  Game Data Strategy                 [Accepted]   (requires 0004)
Feature / domain layer:
  3. ADR-0003  Enhanced Input                     [PROPOSED]   (requires 0001, 0002)
     ADR-0006  Save/Load Serialization            [PROPOSED]   (requires 0004) — must clear C1
     ADR-0007  Physics & Collision                [PROPOSED]   (requires 0001, 0004)
  4. ADR-0008  Scene Streaming                     [PROPOSED]   (requires 0001,0002,0004,0006)
     ADR-0010  Movement                            [PROPOSED]   (requires 0001,0003,0004,0007)
  5. ADR-0009  Camera                              [PROPOSED]   (requires 0001,0003,0004,0007,0008)
  6. ADR-0011  Animation                           [PROPOSED]   (requires 0010)
```

### ⚠️ Proposed-on-Proposed dependency chain
- **ADR-0008 Depends On ADR-0006** (Proposed) — cannot be safely implemented until ADR-0006 is
  Accepted (and ADR-0006 must clear C1 first).
- **ADR-0009** depends on ADR-0003, ADR-0007, ADR-0008 — all Proposed.
- **ADR-0010** depends on ADR-0003, ADR-0007 — Proposed.
- **ADR-0011** depends on ADR-0010 — Proposed.

**Recommended acceptance order:** fix C1 → accept **0006**; fix input defects → accept **0003**;
fix Chaos detail → accept **0007**; correct DataLayer API → accept **0008**; then **0009 / 0010**;
then **0011**.

---

## Engine Compatibility

All 11 ADRs include an Engine Compatibility section ✅; all target UE 5.7 ✅. No legacy/deprecated
APIs used in the strict sense (ADR-0003 forbids legacy input; ADR-0008 uses World Partition not
deprecated Level Streaming; ADR-0011 uses IK Rig not legacy retargeting). Several ADRs (0006, 0007,
0008, 0011) are HIGH knowledge-risk with **unperformed Verification-Required items** — acceptable
pre-implementation only if verified before stories begin.

### Engine Specialist Findings (unreal-specialist)

Findings carry the same weight as audit findings. Must be addressed before the respective ADR moves
to Accepted:

- **ADR-0008 [HIGH]:** `UDataLayerSubsystem` is removed/replaced in UE 5.7 — the canonical path is
  `UWorld::GetDataLayerManager()` returning `UDataLayerManager`, with
  `SetDataLayerRuntimeState(const UDataLayerAsset*, EDataLayerRuntimeState)`. This is the ADR's
  central mechanism; its own Verification item 1 suspected this — now confirmed. `UDataLayerAsset`
  and `EDataLayerRuntimeState` remain valid.
- **ADR-0011 [HIGH]:** Root-motion local→world conversion is inverted —
  `RootMotion.GetRootMotionTransform().GetRelativeTransform(ActorTransform)` computes a delta
  between transforms, not a local→world transform. Use `ActorTransform.TransformPosition(...)` (or
  compose `LocalRM * ActorTransform`). As written, dodge Coast displacement will be wrong.
- **ADR-0010 [HIGH, internal contradiction]:** `UAIPerceptionSystem::MakeNoise()` is correct and
  `ReportNoise()` does NOT exist — but the requirements table (TR-movement-008, TR-ai-002), Risks
  section, and architecture diagram still say `ReportNoise()`. Purge all three. Also note
  `MakeNoise` requires a registered `UAISense_Hearing`.
- **ADR-0009 [MEDIUM]:** `UPerlinNoiseCameraShake` is not a class in 5.7 — use a `UCameraShakeBase`
  subclass whose RootShakePattern is `UPerlinNoiseCameraShakePattern`. `USpringArmComponent::CameraRetractSpeed`
  does not exist — use the `TargetArmLength` FInterpTo fallback (drop the "if available" hedge).
- **ADR-0010 ↔ ADR-0011 [MEDIUM]:** Disagree on the foot-IK node (`FAnimNode_FootPlacement` vs
  "IK Rig runtime node"). Reconcile to the **Foot Placement** node.
- **ADR-0011 [MEDIUM]:** `LinkAnimClassLayers` receiver is inconsistent (`GetSkelMeshComponent()`
  vs `GetMesh()->GetAnimInstance()`); both compile but standardize.
- **ADR-0007 [MEDIUM]:** `FHitResult::PhysMaterial` is a `TWeakObjectPtr` — access via `.Get()`
  then null-check. Ragdoll uses both `SetAllBodiesBelowSimulatePhysics` and `SetSimulatePhysics(true)`
  — redundant/contradictory; use the former only (or set the Ragdoll collision profile first).
- **ADR-0007 [LOW]:** Substep arithmetic ("16.6ms ÷ 5 = 3.33ms") and the "×3 substeps = 10ms"
  Performance note are inconsistent — confirm intended substep config.
- **ADR-0010 [LOW]:** `CanDodge(float)` (interface) vs `CanDodge(25.0f)`/int32 usage — pick one
  signature.

---

## GDD Revision Flags (Architecture → Design Feedback)

**None new.** C1/C2/C4/C5 are ADR-side reconciliations, not GDD assumptions contradicted by
verified engine behaviour. `dialogue-system.md` and `save-load-system.md` are already marked
`Needs Revision` in the systems index.

---

## Known Conflict-Prone Areas (from `docs/consistency-failures.md`)

- **Alien AI ↔ Infection Spread interface owner** (`GetZoneInfectionLevel()`,
  `ISceneManagement` vs `IInfectionSpreadSubsystem`) — still ⏳ Unresolved at the GDD level.
  Treat AI/Infection integration as fragile when those two ADRs are authored.

---

## Architecture Document Coverage

`docs/architecture/architecture.md` does not exist — the `/create-architecture` master document is
still pending. Orphaned-architecture check is N/A.

---

## Verdict: 🔴 FAIL

This is no longer a *foundation* FAIL — Foundation systems (Input, Physics, Camera, Scene, GSM,
Movement) are now fully covered. The remaining blockers are **core-gameplay ADRs + ADR
reconciliations + the Proposed acceptance chain**.

### Blocking Issues (must resolve before PASS)

1. **C1** — ADR-0006 save schema cannot persist the state the Save/Load GDD requires (6 missing
   payloads + `FSceneStateData` + `FDialogueSaveData`; slot/trigger/blocking-write/corruption
   mismatches).
2. **C2** — ADR-0004 Dialogue World-tier loses persistent NPC relationship state required by
   TR-dialogue-003 / TR-dialogue-008.
3. **Core-layer architecture gaps** for the two highest technical-risk systems — **Alien AI** and
   **Infection Spread** — plus Combat, Stealth, and HUD have no dedicated ADR for their internal
   logic.
4. **7 of 11 ADRs are still Proposed**, with a Proposed-on-Proposed dependency chain. ADR-0008 also
   needs the `UDataLayerManager` API correction before it can be Accepted.

### Required ADRs (most foundational first)

1. **Alien AI Architecture** — Behavior Trees, custom BT nodes, EQS queries, Nav Areas, perception,
   squad coordination. (Highest risk.)
2. **Infection Spread Architecture** — tick loop, per-cell evaluation, source HP ownership,
   fast-travel deterministic simulation, `IInfectionSpreadSubsystem` interface. (Highest risk.)
3. **Combat Architecture** — weapon class data, damage pipeline/formula, condition & jam, combat
   lifecycle/disengage, reload, IMC pop ownership.
4. **HUD Architecture** — dual ImmersiveRenderer/TacticalRenderer pipelines + shared data layer +
   UMG widget structure + accessibility hooks.
5. **Stealth Architecture** — per-alien detection scoring, 5-state machine, de-escalation.

Then: revise + accept **ADR-0006** (clear C1, add Scene/Dialogue/missing payloads), reconcile
**ADR-0004 / ADR-0006** dialogue persistence (C2), correct **ADR-0008** DataLayer API, fix the
**ADR-0009 / 0010 / 0011** engine defects above and the **C5** stale Tutorial model, then accept the
Proposed ADRs in dependency order.

### Pre-Gate Checklist

- ❌ `tests/unit/` and `tests/integration/` — run `/test-setup`
- ❌ `.github/workflows/tests.yml` — run `/test-setup`
- ❌ `design/accessibility-requirements.md` — run `/ux-design`
- ❌ `design/ux/interaction-patterns.md` — run `/ux-design`

Do not run `/gate-check pre-production` until the blocking issues above and the pre-gate items are
resolved.

### TR Registry

Already current — TR-tutorial-003/006 revisions are applied (`revised: 2026-05-20`); no new
requirements surfaced this run. No registry write performed.
