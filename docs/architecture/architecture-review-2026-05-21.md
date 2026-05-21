# Architecture Review Report

> **Date:** 2026-05-21
> **Engine:** Unreal Engine 5.7
> **Mode:** full (`/architecture-review`)
> **GDDs reviewed:** 22 · **ADRs reviewed:** 13
> **Verdict:** 🔴 **FAIL**

This is an independent review session (separate from the ADR-authoring sessions) to
remove author bias, as flagged in the prior session state.

---

## Traceability Summary

| Status | Count | % |
|--------|-------|---|
| ✅ Covered | 115 | 56% |
| ⚠️ Partial | 24 | 12% |
| ❌ Gap | 68 | 33% |
| **Total requirements** | **207** | 100% |

Coverage trajectory: ~28% (2026-05-20 AM) → ~50% (PM) → **56%** (this run). Foundation
layer is fully covered. Remaining gaps concentrate in Core-gameplay and Feature systems
that have no dedicated ADR.

> Known conflict-prone areas (from `docs/consistency-failures.md`): State Persistence
> (ADR-0006 schema), Subsystem Lifecycle (ADR-0004 tiers), Stale Contracts (Tutorial
> struct names), Alien-AI↔Infection interface ownership.

---

## Per-System Coverage Rollup

| System | Layer | Priority | Dedicated ADR | ✅ | ⚠️ | ❌ |
|--------|-------|----------|---------------|----|----|----|
| Input | Foundation | MVP | 0003 | 8 | 2 | 0 |
| Physics | Foundation | MVP | 0007 | 10 | 0 | 0 |
| Camera | Foundation | MVP | 0009 | 8 | 0 | 0 |
| Scene Management | Foundation | MVP | 0008 | 13 | 0 | 0 |
| Game State Machine | Foundation | MVP | 0002 | 12 | 0 | 0 |
| Movement | Core | MVP | 0010 | 14 | 0 | 0 |
| Alien AI | Core | MVP | 0012 | 12 | 0 | 0 |
| Infection Spread | Core | MVP | 0013 | 9 | 1 | 0 |
| **Combat** | **Core** | **MVP** | **— none** | **0** | **2** | **7** |
| **Stealth** | **Core** | **MVP** | **— none** | **0** | **2** | **5** |
| **Health** | **Core** | **MVP** | **— none** | **1** | **2** | **5** |
| **HUD** | **Core** | **MVP** | **— none** | **1** | **1** | **7** |
| **Player Controller** | **Core** | **MVP** | **(0001/0003 partial)** | **3** | **2** | **6** |
| Dialogue | Core | MVP | (0004/0005/0009 partial) | 2 | 2 | 5 |
| Investigation | Core | MVP | (0004/0005 partial) | 3 | 1 | 4 |
| Save/Load | Persistence | MVP | 0006 | 9 | 2 | 0 |
| Inventory | Feature | MVP | (0004/0005/0006 partial) | 3 | 1 | 5 |
| Quest | Feature | VS | (0005/0006 partial) | 2 | 1 | 3 |
| Faction | Feature | VS | (0006 partial) | 2 | 1 | 4 |
| Crafting | Feature | VS | (0005 partial) | 1 | 1 | 4 |
| Map | UI | VS | (partial) | 0 | 2 | 5 |
| Tutorial | Meta | VS | (0004/0006 partial) | 2 | 1 | 8 |

ADR-0011 (Animation) is a cross-cutting ADR supporting Movement/Combat animation TRs
(TR-movement-011/013/014); it has no standalone GDD system row.

The cross-cutting ADRs (0001 events, 0004 subsystems, 0005 data, 0006 save) provide only
**partial** coverage of feature-system behavioural requirements — they fix tier/storage/
eventing but not the system-specific rules.

---

## Coverage Gaps — Required ADRs (most foundational first)

1. **❌ Combat System ADR** (Core, MVP) — 7 gaps: 4-weapon-class model, damage-formula
   pipeline, hitscan-vs-projectile split, weapon condition + jam chance, combat lifecycle/
   disengage timer, reload refund, VFX budget. Engine Risk: **MEDIUM**.
   → `/architecture-decision Combat System`
2. **❌ HUD System ADR** (Core, MVP) — 7 gaps: dual Immersive/Tactical renderers, shared
   data layer, frame budgets, UMG widget architecture, minimap, accessibility hooks,
   context-prompt arbitration. Engine Risk: **LOW** (UMG/CommonUI).
   → `/architecture-decision HUD System`
3. **❌ Stealth System ADR** (Core, MVP) — 5 gaps: per-alien detection scoring, 5-state
   model + cooldown de-escalation, detection-calc budget, multi-system per-frame inputs.
   Engine Risk: **MEDIUM**. → `/architecture-decision Stealth System`
4. **❌ Health System ADR** (Core, MVP) — 5 gaps: HP pool + damage-type model, TakeDamage
   pipeline, i-frame coupling, healing interruptibility, VFX budget. Engine Risk: **LOW**.
   → `/architecture-decision Health System`
5. **❌ Player Controller ADR** (Core, MVP) — 6 gaps: context resolver (proximity sphere /
   async line trace / 4Hz), input-latency budgets, FContextPrompt struct. Engine Risk:
   **MEDIUM**. → `/architecture-decision Player Controller`
6. **Lower priority** (Feature/Meta, partially covered by cross-cutting ADRs) — Dialogue,
   Investigation, Inventory, Quest, Faction, Crafting, Map, Tutorial each need either a
   system ADR or an explicit "covered-by-cross-cutting-ADRs" sign-off documenting the
   behavioural rules.

Full requirement-level matrix: `docs/architecture/architecture-traceability.md`.

---

## Cross-ADR Conflicts

### 🔴 C6 (NEW — blocking): Infection subsystem tier / class name / persistence
- **ADR-0004 (Accepted):** `UInfectionSubsystem` = Session tier (`UGameInstanceSubsystem`);
  "global spread percentage persists across all maps."
- **ADR-0013 (Proposed):** `UInfectionSpreadSubsystem` = World tier (`UWorldSubsystem`);
  Rule 8 = must **not** persist into Mountain Prison. Declares ADR-0004's registry entry
  "incorrect."
- **TR-infection-001 (registry):** still reads `UGameInstanceSubsystem`.
- **Type:** State ownership / lifecycle / naming.
- **Impact:** an **Accepted** ADR is directly contradicted by a Proposed one; class name
  drifts (`UInfectionSubsystem` vs `UInfectionSpreadSubsystem`) across ADR-0001/0004/0005/
  0012/0013.
- **Resolution options:**
  1. Ratify World tier: rewrite ADR-0004 prose table, revise TR-infection-001 text,
     rename to `UInfectionSpreadSubsystem` project-wide. (Recommended — matches design intent.)
  2. Keep Session tier and revise ADR-0013 + infection GDD Rule 8. (Contradicts the
     stated "no persist into prison" design.)

### 🔴 C1 (carried — blocking): ADR-0006 save schema incomplete
- Root `UHostileWorldSaveGame` defines only 5 sub-structs (Tutorial/Quest/Faction/
  Inventory/Infection). **TR-save-008** requires Player Transform, Health, Crafting,
  Investigation, Map, World Flags, GSM state. ADR-0008 references `FSceneStateData` and
  ADR-0013 implements `IHostileSaveProvider`, but neither sub-struct exists in ADR-0006.
- **Type:** State / Integration.
- **Resolution:** add the 6 missing payloads + `FSceneStateData` + `FDialogueSaveData`;
  align slot name/trigger model/clean-exit/corruption rules to the Save/Load GDD; then accept.

### 🔴 C2 (carried — blocking for Dialogue): World-tier Dialogue loses persistence
- ADR-0004 puts `UDialogueSubsystem` at World tier (destroyed per level), but
  **TR-dialogue-003** (Trust/Fear/Knowledge) + **TR-dialogue-008** (SaveDialogueState)
  require session persistence, and ADR-0006 has no `FDialogueSaveData`.
- **Type:** Subsystem lifecycle / persistence.
- **Resolution:** split persistent relationship state to a Session-tier store, OR keep
  World tier and add a Dialogue save provider + `FDialogueSaveData` to ADR-0006.

### 🟠 C4 (carried — medium): Input rebinding ownership unresolved
- ADR-0003 stores rebinds in `UEnhancedInputUserSettings` (separate file); ADR-0006
  defines no input sub-struct. ADR-0003 OQ-1 remains open — no reconciled owner.
- **Type:** State ownership.
- **Resolution:** record the decision in ADR-0006 — either "rebinds live in the
  EnhancedInput user settings file, not the save game" or add an input sub-struct.

### 🟠 C5 (carried — should fix): Stale Tutorial model
- ADR-0004 ("FTutorialProgress, completed/dismissed hint IDs") and ADR-0006
  (`FTutorialSaveData.DismissedHintIDs`) still carry the removed `DISMISSED` state.
  Registry/GDD (TR-tutorial-003/006) = completed IDs only.
- **Type:** Stale contract.
- **Resolution:** remove `DismissedHintIDs`; reconcile `FTutorialProgress` (runtime) vs
  `FTutorialSaveData` (save) naming across ADR-0004/0006.

### 🟡 Pattern conflict (engine): foot-IK solver
- ADR-0010 names `FAnimNode_FootPlacement`; ADR-0011 (animation authority) specifies an
  IK Rig runtime node. One source of truth needed — see MED-6.

---

## ADR Dependency Order (topologically sorted — no cycles)

```
Foundation:  ADR-0001 [Accepted]
L1:          ADR-0002 [Accepted]  (→0001)
L2:          ADR-0004 [Accepted]  (→0002)
             ADR-0003 [Proposed]  (→0001,0002)
L3:          ADR-0005 [Accepted]  (→0004)
             ADR-0006 [Proposed]  (→0004)
             ADR-0007 [Proposed]  (→0001,0004)
L4:          ADR-0008 [Proposed]  (→0001,0002,0004,0006)
             ADR-0010 [Proposed]  (→0001,0003,0004,0007)
L5:          ADR-0009 [Proposed]  (→0001,0003,0004,0007,0008)
             ADR-0011 [Proposed]  (→0010)
             ADR-0012 [Proposed]  (→0001,0004,0005,0007,0008,0010)
L6:          ADR-0013 [Proposed]  (→0001,0006,0008,0012)
```

**Unresolved-dependency flags:** the entire Proposed chain (0003, 0006, 0007, 0008, 0009,
0010, 0011, 0012, 0013) is Proposed-on-Proposed. None can be safely implemented until its
upstream ADRs reach Accepted.

**Recommended accept order (after fixes):**
`0006 (C1/C4/C5)` → `0007` → `0003` → `0008 (HIGH-1)` → `0010 (HIGH-3)` →
`0009 (MED-4/5)` → `0011 (HIGH-2/MED-6)` → `0012 (HIGH-3)` → `0013 (C6)`.

---

## Engine Compatibility Issues

Audited by `unreal-specialist` against `VERSION.md`, `breaking-changes.md`,
`deprecated-apis.md`, `current-best-practices.md`, and module/plugin references.
**All 13 ADRs contain an Engine Compatibility section** (none missing).

### HIGH (blocks Accept)
- **HIGH-1 · ADR-0008** — `UDataLayerSubsystem` was removed before UE 5.7. The ADR commits
  to it in the Decision body. Correct API: `UWorld::GetDataLayerManager()` →
  `UDataLayerManager::SetDataLayerRuntimeState(const UDataLayerAsset*, EDataLayerRuntimeState)`.
- **HIGH-2 · ADR-0011** — Root-motion local→world conversion is inverted:
  `RootMotion...GetRelativeTransform(ActorTransform)` is world→local. Use
  `ActorTransform.TransformVector(LocalTranslation)` or
  `USkeletalMeshComponent::ConvertLocalRootMotionToWorld()`. Causes position pop on any
  rotated actor.
- **HIGH-3 · ADR-0010 + ADR-0012** — `UAIPerceptionSystem::MakeNoise()` does not exist. Use
  `UAISense_Hearing::ReportNoiseEvent(...)` or `UPawnNoiseEmitterComponent` +
  `APawn::MakeNoise()`. Both ADRs reference the symbol and must change together.

### MEDIUM
- **MED-4 · ADR-0009** — `UPerlinNoiseCameraShake` is the legacy UE4 class. Use
  `UCameraShakeBase` with `RootShakePattern = UPerlinNoiseCameraShakePattern`.
- **MED-5 · ADR-0009** — `USpringArmComponent::CameraRetractSpeed` does not exist. Hand-roll
  smoothing via `FInterpTo` on `TargetArmLength` (the ADR already lists this fallback —
  remove the "if available" hedge).
- **MED-6 · ADR-0010 ↔ ADR-0011** — foot-IK solver disagreement (Foot Placement node vs IK
  Rig runtime node). ADR-0011 is the animation authority; make ADR-0010 defer to it.

### LOW
- ADR-0012 `RunEQSQuery` is borderline (BP-library helper exists) — acceptable.
- ADR-0013 `UWorldPartitionSubsystem::IsStreamingCompleted()` is a global check; using it to
  gate single-cell hive spawns is overly broad (retry-next-cycle mitigation makes it safe
  but laggy). Prefer a per-cell load query.

---

## GDD Revision Flags (Architecture → Design)

No GDD design assumption is contradicted by verified engine behaviour. The infection-tier
issue (C6) is an ADR/registry reconciliation, not a GDD-vs-engine flag (handled under
Conflicts). **No systems-index Status changes proposed this run.**

---

## Architecture Document Coverage

`docs/architecture/architecture.md` **does not exist** — there is no master architecture
document to validate the systems-index against. Recommend running `/create-architecture`
once the Core ADR gaps (Combat/HUD/Stealth/Health/Player Controller) are closed.

---

## Verdict: 🔴 FAIL

### Blocking issues (must resolve before PASS)
1. Five Core/MVP systems (Combat, HUD, Stealth, Health, Player Controller) have **no
   dedicated ADR** — ~30 uncovered Core-layer requirements.
2. Blocking cross-ADR conflicts: **C6** (Accepted ADR-0004 vs Proposed ADR-0013 infection
   tier), **C1** (save schema incomplete), **C2** (Dialogue persistence).
3. Three **HIGH** engine defects (ADR-0008, ADR-0010/0012, ADR-0011) block Accepting those
   ADRs.
4. Entire Proposed-on-Proposed dependency chain cannot be implemented until upstream ADRs
   reach Accepted.

### Required ADRs (priority order)
Combat → HUD → Stealth → Health → Player Controller → (then Dialogue/Investigation/
Inventory/Quest/Faction/Crafting/Map/Tutorial sign-offs).

---

## Pre-Production Gate Pre-Checklist
- ❌ `tests/unit/` and `tests/integration/` — absent → run `/test-setup`
- ❌ `.github/workflows/tests.yml` — absent → run `/test-setup`
- ❌ `design/.../accessibility-requirements.md` — absent → run `/ux-design`
- ❌ `design/ux/interaction-patterns.md` — absent → run `/ux-design`

`/gate-check pre-production` is **not** available until the above are created and the
blocking ADR gaps close.

---

## Next Actions
1. Open fresh sessions to author the 5 Core ADRs (Combat, HUD, Stealth, Health, Player
   Controller) — one per session.
2. Revise ADR-0006 (C1/C4/C5), reconcile ADR-0004↔0013 (C6), fix ADR-0008/0010/0011/0012
   engine defects.
3. Run `/test-setup` and `/ux-design` to unblock the pre-production gate.
4. Re-run `/architecture-review` after each new ADR to verify coverage climbs.
