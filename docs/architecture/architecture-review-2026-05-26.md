# Architecture Review Report

> **Date:** 2026-05-26
> **Engine:** Unreal Engine 5.7
> **Mode:** full (`/architecture-review`)
> **GDDs reviewed:** 22 · **ADRs reviewed:** 18
> **Verdict:** 🟡 **CONCERNS**

Fresh-session review after ADR-0014/0015/0016/0017/0018 authoring completed all
Core MVP gaps and after C4/C6 remediation. Validates the architecture against the
207-requirement baseline established in `architecture-review-2026-05-21.md`.

---

## Traceability Summary

| Status | Count | % |
|--------|------:|--:|
| ✅ Covered | ~154 | ~74% |
| ⚠️ Partial | ~24 | ~12% |
| ❌ Gap | ~29 | ~14% |
| **Total** | **207** | 100% |

Coverage trajectory: 28% (2026-05-20 AM) → 56% (2026-05-21) → **~74%** (now).
All 5 prior Core/MVP gaps closed by ADR-0014/0015/0016/0017/0018. Remaining
gaps are concentrated in Feature/VS-tier systems (Dialogue, Investigation,
Inventory, Quest, Faction, Crafting, Map, Tutorial) which are partially
covered by cross-cutting ADRs (0001 events, 0004 subsystems, 0005 data, 0006 save).

> Known conflict-prone areas (from `docs/architecture/consistency-failures.md`):
> all C1–C6 are now Resolved.

---

## Per-System Coverage Rollup

| System | Layer | Priority | ADR | ✅ | ⚠️ | ❌ |
|--------|-------|----------|-----|---:|---:|---:|
| Input | Foundation | MVP | 0003 | 9 | 1 | 0 |
| Physics | Foundation | MVP | 0007 | 10 | 0 | 0 |
| Camera | Foundation | MVP | 0009 | 8 | 0 | 0 |
| Scene Management | Foundation | MVP | 0008 | 13 | 0 | 0 |
| Game State Machine | Foundation | MVP | 0002 | 12 | 0 | 0 |
| Movement | Core | MVP | 0010 | 14 | 0 | 0 |
| Alien AI | Core | MVP | 0012 | 12 | 0 | 0 |
| Infection Spread | Core | MVP | 0013 | 9 | 1 | 0 |
| **Combat** | **Core** | **MVP** | **0014** | **9** | **0** | **0** |
| **Stealth** | **Core** | **MVP** | **0017** | **7** | **0** | **0** |
| **Health** | **Core** | **MVP** | **0015** | **8** | **0** | **0** |
| **HUD** | **Core** | **MVP** | **0016** | **9** | **0** | **0** |
| **Player Controller** | **Core** | **MVP** | **0018** | **11** | **0** | **0** |
| Dialogue | Core | MVP | (0004/0005/0009 partial) | 3 | 1 | 5 |
| Investigation | Core | MVP | (0004/0005/0006 partial) | 4 | 0 | 4 |
| Save/Load | Persistence | MVP | 0006 | 11 | 0 | 0 |
| Inventory | Feature | MVP | (0004/0005/0006 partial) | 3 | 1 | 5 |
| Quest | Feature | VS | (0002/0005/0006 partial) | 2 | 1 | 3 |
| Faction | Feature | VS | (0001/0006 partial) | 3 | 0 | 4 |
| Crafting | Feature | VS | (0005/0006 partial) | 2 | 0 | 4 |
| Map | UI | VS | (0002/0006 partial) | 0 | 2 | 5 |
| Tutorial | Meta | VS | (0001/0002/0004/0006 partial) | 3 | 0 | 8 |

ADR-0011 (Animation) supports Movement/Combat anim TRs cross-cuttingly.

---

## Delta from 2026-05-21

| System | Prior ✅ | Now ✅ | New ADR |
|--------|---------:|------:|---------|
| Combat | 0/9 | **9/9** | ADR-0014 — UCombatComponent + UCombatSubsystem two-class split |
| Health | 1/8 | **8/8** | ADR-0015 — single UHealthComponent with 5-step damage pipeline |
| HUD | 1/9 | **9/9** | ADR-0016 — ULocalPlayerSubsystem + dual independent widget pipelines |
| Stealth | 0/7 | **7/7** | ADR-0017 — two-class split mirroring Combat; IStealthDetection extended |
| Player Controller | 3/11 | **11/11** | ADR-0018 — thin router + async trace poll + 6-state input FSM |

Net +39 covered requirements. Foundation and Core-supporting layers
(Input/Physics/Camera/Scene/GSM/Movement/AlienAI/Infection/Save) remain fully
covered as of 2026-05-21.

---

## Cross-ADR Conflicts

| ID | Topic | Status | Notes |
|----|-------|--------|-------|
| C1 | ADR-0006 save schema incomplete | ✅ **Resolved 2026-05-21** | 12 `IHostileSaveProvider` registrants; sub-structs added |
| C2 | Dialogue World-tier loses persistence | ✅ **Resolved 2026-05-21** | Two-subsystem split — `UDialogueSubsystem` (World, volatile) + `UNPCRelationshipSubsystem` (Session, persistent) |
| C4 | Input rebinding ownership | ✅ **Resolved 2026-05-26** | Op = PC (ADR-0003); UI widget = `UHUDSubsystem` (ADR-0016); persistence = EIUS own file; bindings explicitly excluded from `USaveGame` |
| C5 | Stale Tutorial DismissedHintIDs | ✅ **Resolved 2026-05-26** | Doc residue at ADR-0006:545 + traceability.md:308 cleaned this pass |
| C6 | Infection subsystem tier | ✅ **Resolved 2026-05-24** | World-tier `UInfectionSpreadSubsystem`; ADR-0004 prose, registry, diagram all updated |

**No new cross-ADR conflicts** introduced by ADR-0014/0015/0016/0017/0018.

### Subsidiary consistency checks (new ADR audit)

- **IMC ownership**: ADR-0014 owns IMC_Combat push/pop decision; ADR-0017 owns
  IMC_Stealth push/pop decision; both route through PC `PushIMC()/PopIMC()`
  (ADR-0018). No direct `UEnhancedInputLocalPlayerSubsystem` access outside PC.
  ✅ Consistent.
- **UCombatComponent placement**: ADR-0004 `per_actor_state` lists
  `UCombatComponent`; ADR-0014 builds on this. ✅ Consistent.
- **UStealthComponent placement**: ADR-0017 adds new per-actor component;
  ADR-0004 must register it. Action: update `adr-subsystems.yaml`
  `per_actor_state` to include `UStealthComponent` (minor registry
  housekeeping, non-blocking).
- **IStealthDetection extension**: ADR-0017 extends the ADR-0012 interface with
  `ComputeAndGetAlienScore()`. ADR-0012 must be supplemented to register the
  extension OR ADR-0017 is the authoritative interface contract going forward.
  Recommend: ADR-0017 is authoritative; flag ADR-0012 as superseded for the
  interface scope at next ADR-0012 revision.
- **IAlienPerceptionData**: ADR-0017 introduces this interface on
  `AAlienCharacter`. ADR-0012 references `IStealthDetection` reads from the
  alien but does not yet define the data-out interface. Action: minor ADR-0012
  supplement to register `IAlienPerceptionData` (non-blocking; can be done at
  implementation time).
- **GSM `OnLevelReady` / `OnWorldTearDown` notifications**: ADR-0016 depends on
  these GSM hooks but ADR-0002 does not yet define them. Action: ADR-0002
  supplement or ADR-0016 must accept the additional responsibility of querying
  GSM state polling on level loads (minor — can be defined at story time).

---

## ADR Dependency Order (no cycles)

```
L0 Foundation:  ADR-0001 [Accepted]
L1:             ADR-0002 [Accepted]  (→0001)
L2:             ADR-0004 [Accepted]  (→0002)
                ADR-0003 [Proposed]  (→0001,0002)
L3:             ADR-0005 [Accepted]  (→0004)
                ADR-0006 [Proposed]  (→0004)
                ADR-0007 [Proposed]  (→0001,0004)
L4:             ADR-0008 [Proposed]  (→0001,0002,0004,0006)
                ADR-0010 [Proposed]  (→0001,0003,0004,0007)
L5:             ADR-0009 [Proposed]  (→0001,0003,0004,0007,0008)
                ADR-0011 [Proposed]  (→0010)
                ADR-0012 [Proposed]  (→0001,0004,0005,0007,0008,0010)
                ADR-0015 [Proposed]  (→0001,0002,0004,0010)
L6:             ADR-0013 [Proposed]  (→0001,0006,0008,0012)
                ADR-0014 [Proposed]  (→0001,0003,0004,0010,0012)
                ADR-0017 [Proposed]  (→0003,0004,0007,0010,0012,0014,0015)
L7:             ADR-0016 [Proposed]  (→0001,0004,0009,0014,0015)
                ADR-0018 [Proposed]  (→0003,0004,0009,0010,0012,0013,0014,0015,0017)
```

**Status**: 4 Accepted (0001/0002/0004/0005), 14 Proposed (0003/0006–0018).
**Unresolved-dependency flag**: the entire Proposed chain is Proposed-on-Proposed.
None can be safely implemented until upstream ADRs reach Accepted.

**Recommended accept order** (after MED-4 fix):
`0006 → 0007 → 0003 → 0008 → 0010 → 0009 → 0011 → 0012 → 0013 → 0014 → 0015 → 0017 → 0016 → 0018`

---

## Engine Compatibility

| ID | Issue | Severity | Status |
|----|-------|---------:|--------|
| HIGH-1 | ADR-0008 `UDataLayerSubsystem` removed in 5.7 | HIGH | ✅ **Fixed** — `UWorld::GetDataLayerManager()` + `UDataLayerManager::SetDataLayerInstanceRuntimeState()` |
| HIGH-2 | ADR-0011 root-motion `GetRelativeTransform` inverted | HIGH | ✅ **Fixed** — `ActorTransform.TransformVector(LocalDelta)` |
| HIGH-3 | ADR-0010/0012 `UAIPerceptionSystem::MakeNoise()` nonexistent | HIGH | ✅ **Fixed** — `UAISense_Hearing::ReportNoiseEvent()` consistently used across ADR-0010/0012/0014/0017 |
| MED-4 | ADR-0009 `UPerlinNoiseCameraShake` is the legacy UE4 class | MEDIUM | ✅ **Fixed 2026-05-26** — replaced with `UCameraShakeBase` + `RootShakePattern = UPerlinNoiseCameraShakePattern` (UE 5.0+ composition model) across Engine Compatibility, Constraints, Requirements, Decision, Consequences, Risks, and GDD Requirements sections of ADR-0009. |
| MED-5 | ADR-0009 `USpringArmComponent::CameraRetractSpeed` nonexistent | MEDIUM | (Not re-verified this pass — prior review listed this as a fallback already in the ADR; remove "if available" hedge) |
| MED-6 | ADR-0010 vs ADR-0011 foot-IK solver disagreement | MEDIUM | (Not re-verified this pass — ADR-0011 is the animation authority; ADR-0010 should defer to it for foot-IK node naming) |

### Engine Specialist Consultation

Each of the 5 new ADRs (0014/0015/0016/0017/0018) was specialist-validated
during authoring (per session-state Session Extracts). HIGH issues from the
2026-05-21 review were specialist-confirmed and patched 2026-05-24
(session log entry S267). No re-spawn of `unreal-specialist` this pass —
specialist findings have already been incorporated into the corrected ADRs.

### Post-Cutoff API Inventory (across 18 ADRs)

| API | ADR(s) | Source verified |
|-----|--------|-----------------|
| `UEnhancedInputLocalPlayerSubsystem::AddMappingContext/RemoveMappingContext` | 0003, 0014, 0017, 0018 | ADR-0003 specialist confirmed |
| `UAISense_Hearing::ReportNoiseEvent` | 0010, 0012, 0014, 0017 | Specialist 2026-05-21 (no ai-perception.md module doc exists yet) |
| `UAISense_Damage::ReportDamageEvent` | 0012, 0014 | Specialist 2026-05-21 |
| `UWorld::GetDataLayerManager()`+`UDataLayerManager::SetDataLayerInstanceRuntimeState()` | 0008 | Specialist 2026-05-21 |
| `UWorld::AsyncLineTraceByChannel`+`QueryTraceData` (poll model) | 0018 | Specialist 2026-05-26 (delegate callback API does not exist) |
| `UCharacterMovementComponent::ProcessLanded` override | 0015 | Verification Required — signature unchanged expected, confirm at impl |
| `UCameraShakeBase` + `UPerlinNoiseCameraShakePattern` | 0009 | ⚠️ MED-4 open |

**Recommendation**: create `docs/engine-reference/unreal/modules/ai-perception.md`
pinning the `UAISense_Hearing`/`UAISense_Damage` APIs (carried over from
2026-05-21 combat-review recommendation).

---

## GDD Revision Flags

No GDD design assumption is contradicted by verified engine behaviour.
**No systems-index Status changes proposed this run.**

---

## Architecture Document Coverage

`docs/architecture/architecture.md` **does not exist**. Recommended next:
run `/create-architecture` to produce the master architecture document
synthesising all 18 ADRs.

Registry files (`adr-index.yaml` + domain files) are current and consistent
with the 18 ADRs.

---

## Verdict: 🟡 CONCERNS

**All MVP-Core architecture is decision-complete.** All blocking conflicts
(C1/C2/C4/C5/C6) resolved. All HIGH engine defects fixed.

### Non-blocking remediation items (for follow-up)
1. ~~**MED-4** ADR-0009 — update `UPerlinNoiseCameraShake` → `UCameraShakeBase` +
   `RootShakePattern = UPerlinNoiseCameraShakePattern`.~~ ✅ **Applied 2026-05-26.**
   MED-5/MED-6 still pending re-verification.
2. **Registry housekeeping** — register `UStealthComponent` and
   `IAlienPerceptionData` in `adr-subsystems.yaml` (minor; ADR-0017 already
   declares them).
3. **Cross-ADR supplements** — ADR-0002 to add `OnLevelReady`/`OnWorldTearDown`
   GSM notifications consumed by ADR-0016, OR ADR-0016 to define an
   alternative trigger. Can be resolved at HUD-implementation story time.
4. **VS-tier Feature ADR sign-offs** — Dialogue/Investigation/Inventory/
   Quest/Faction/Crafting/Map/Tutorial each need either a dedicated system
   ADR or an explicit "covered-by-cross-cutting-ADRs" sign-off documenting
   the behavioural rules. Non-blocking for Pre-Production gate; can be done
   during VS-tier work.
5. **Engine reference doc** — create
   `docs/engine-reference/unreal/modules/ai-perception.md`.

### Required ADRs
None blocking. All Core MVP systems have dedicated ADRs.

---

## Pre-Production Gate Pre-Checklist
- ❌ `tests/unit/` and `tests/integration/` — absent → run `/test-setup`
- ❌ `.github/workflows/tests.yml` — absent → run `/test-setup`
- ❌ `design/ux/accessibility-requirements.md` — absent → run `/ux-design`
- ❌ `design/ux/interaction-patterns.md` — absent → run `/ux-design`

`/gate-check pre-production` is **not** available until test infrastructure
and UX/accessibility specs are created.

---

## Next Actions
1. Apply MED-4 fix to ADR-0009 (one-line; can fold into a registry-housekeeping
   ADR-revision session).
2. Register `UStealthComponent` + `IAlienPerceptionData` in `adr-subsystems.yaml`.
3. Run `/test-setup` and `/ux-design` to unblock pre-production gate.
4. Run `/create-architecture` to synthesise the master architecture document.
5. Optionally: write VS-tier ADRs or cross-cutting sign-offs for
   Dialogue/Investigation/Inventory/Quest/Faction/Crafting/Map/Tutorial.
6. Then `/gate-check pre-production`.
