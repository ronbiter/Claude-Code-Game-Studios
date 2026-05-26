# Active Session State

## Current Task

- **task**: Post-/architecture-review remediation (housekeeping batch)
- **Status**: ✅ Housekeeping #1, #2, #3, #5 DONE — ✅ Phase A (/test-setup) DONE — ✅ Phase B (/ux-design) DONE — #4 (VS-tier ADRs) outstanding
- **Review mode**: full
- **Next action**: `/architecture-decision` × 8 for VS-tier feature ADRs (Phase C); then `/create-architecture` → `/gate-check pre-production`

## Session Extract — /test-setup Phase A 2026-05-26 (22:42 GMT+3)

- ✅ `tests/` directory scaffolded: `unit/`, `integration/`, `smoke/`, `evidence/` subdirectories
- ✅ `tests/README.md` — UE Automation Testing framework docs, run commands, directory layout
- ✅ `tests/smoke/critical-paths.md` — critical path test list for `/smoke-check` gate
- ✅ `.github/workflows/tests.yml` — CI workflow: push/PR to main → UE headless automation tests (self-hosted runner, PowerShell)
- ✅ `.claude/rules/test-standards.md` — test naming convention (`test_[system]_[scenario]_[expected]`), AAA structure, determinism rules
- C++ test source will live in `Source/Tests/` (UE module convention) when UE project is initialized
- Pre-gate `/test-setup` item: ✅ COMPLETE — both pre-gate blockers now done

## Session Extract — /ux-design Phase B 2026-05-26 (23:30 GMT+3)

- ✅ 8 UX specs authored in `design/ux/` — all status: Draft, author: ux-lead
  - `hud.md` — Full HUD design spec (863 lines): Immersive/Tactical dual-mode, all element specs, layout zones, state tables, accessibility (colorblind, motion, screen reader, text scaling)
  - `inventory.md` — Inventory screen spec: 5×4 grid, weapon slots, drag-and-drop, crafting panel integration, all 15 sections including full component inventory, accessibility, localization
  - `dialogue.md` — Dialogue overlay spec: radial choice wheel, 14 states, trust/fear gates, Tactical/Immersive mode duality, full event table
  - `main-menu.md` — Main menu screen spec: Continue/New Game/Settings/Credits flows, GSM Title state
  - `pause-menu.md` — Pause menu overlay spec: Resume/Quest Journal/Map/Settings/Quit flows, GSM Paused state
  - `save-load.md` — Save/Load flow spec: single-slot auto-save model, Save Slot Card confirm, New Game Wipe dialog, corruption notifications
  - `quest-journal.md` — Quest Journal screen spec (Pause Menu tab): active/completed quests, faction tracking, investigation thread display
  - `map.md` — World Map screen spec: infection heatmap, discovered locations, zone boundaries, fast travel explicitly excluded
- Pre-gate `/ux-design` item: ✅ COMPLETE — `design/ux/` directory populated with MVP + VS-tier screens
- Remaining pre-gate blocker: `/test-setup` only (Phase A)

## Session Extract — Post-review remediation 2026-05-26 (21:10–21:14 GMT+3)

- ✅ #1 MED-4 fix to ADR-0009 (camera shake API) — previously completed
- ✅ #2 Registry: UStealthComponent + IAlienPerceptionData registered in `adr-subsystems.yaml` v2
  - Added `state: imc_stealth_lifecycle` (owner UStealthComponent, ADR-0017)
  - Added `contract: alien_perception_data_interface` (UINTERFACE pattern, ADR-0017)
- ✅ #3 ADR-0002 supplement: World Lifecycle Hooks
  - Added `OnLevelReady(UWorld*)` + `OnWorldTearDown(UWorld*)` delegates as additive surface
  - Wired to `FWorldDelegates::OnWorldBeginPlay` / `OnPreWorldFinishDestroy` with `EWorldType::Game` filter
  - Registered as `gsm_level_ready_event` + `gsm_world_tear_down_event` in subsystems registry
  - Added forbidden patterns: `world_tier_bind_in_session_initialize`, `cached_uworld_pointer_across_levels`
  - Updated ADR-0002 GDD Requirements table + Related Decisions to point at ADR-0016
- ✅ #5 Engine reference: `docs/engine-reference/unreal/modules/ai-perception.md` created
  - Covers `UAISense_Hearing::ReportNoiseEvent`, `UAISense_Damage::ReportDamageEvent`, component placement, sight setup, forbidden patterns, common pitfalls, verification trail. Cross-referenced from ADR-0010/0012/0014/0017.
- ⏸ #4 VS-tier Feature ADRs — NOT STARTED (8 systems remaining per architecture review report)
- ✅ Phase A: `/test-setup` — DONE (2026-05-26)
- ✅ Phase B: `/ux-design` — DONE (2026-05-26, 23:30 GMT+3)

## Files modified (this batch)

- `docs/registry/adr-subsystems.yaml` (v1 → v2; +1 state, +3 contracts, +2 forbidden patterns)
- `docs/architecture/adr-0002-game-state-machine-implementation.md` (+World Lifecycle Hooks supplement)
- `docs/engine-reference/unreal/modules/ai-perception.md` (new)

## Prior Session Extract — /architecture-review 2026-05-26

## Session Extract — /architecture-review 2026-05-26
- Verdict: 🟡 CONCERNS (non-blocking)
- Requirements: 207 total — ~154 covered (~74%), ~24 partial, ~29 gaps (Feature/VS-tier remainder)
- ADRs: 18 reviewed (4 Accepted, 14 Proposed); no new conflicts; full dependency order in report
- New TR-IDs registered: None (registry version bumped 3→4; no GDD revisions found)
- GDD revision flags: None (no GDD assumption contradicted by engine)
- HIGH engine fixes confirmed: HIGH-1 (ADR-0008 UDataLayerManager), HIGH-2 (ADR-0011 TransformVector), HIGH-3 (ADR-0010/0012/0014/0017 ReportNoiseEvent)
- Conflicts: C1/C2/C4/C5/C6 all ✅ Resolved (C5 doc residue cleaned this pass: ADR-0006:545 + traceability:308)
- Remaining engine items: MED-4 ✅ FIXED 2026-05-26 (ADR-0009 updated: UCameraShakeBase + RootShakePattern=UPerlinNoiseCameraShakePattern across 7 sections); MED-5/MED-6 not re-verified this pass
- Registry housekeeping: ADR-0017 introduces UStealthComponent + IAlienPerceptionData (need adr-subsystems.yaml registration); ADR-0016 depends on GSM OnLevelReady/OnWorldTearDown hooks (need ADR-0002 supplement OR alternative)
- Pre-gate: all ❌ still (tests/, ux/ — need /test-setup + /ux-design)
- Files written: docs/architecture/architecture-review-2026-05-26.md; docs/architecture/architecture-traceability.md (refreshed matrix + history row); docs/architecture/tr-registry.yaml (v4 bump); docs/architecture/adr-0006-save-load-serialization.md:545 (C5 cleanup)
- Reports: docs/architecture/architecture-review-2026-05-26.md + refreshed docs/architecture/architecture-traceability.md

## Session Extract — ADR-0018 Player Controller (2026-05-26)
- ADR-0018 written: `docs/architecture/adr-0018-player-controller-architecture.md`
- Engine specialist validation: 2 blocking issues found and fixed
  - FIXED: Async trace uses poll model (QueryTraceData) not delegate callback (delegate API does not exist in UE 5.7)
  - FIXED: UStealthComponent + UCombatSubsystem route IMC changes through PC->PushIMC()/PopIMC() — no direct EIUS calls
- Registry updated: adr-input.yaml (+2 state ownerships, +2 API decisions, +1 forbidden pattern); adr-index.yaml (+ADR-0018 entry)
- ADR status: 4 Accepted (0001/0002/0004/0005), 14 Proposed (0003/0006–0018)
- All core MVP gaps closed: Health (ADR-0015), HUD (ADR-0016), Stealth (ADR-0017), Player Controller (ADR-0018), Combat (ADR-0014)
- architecture.md: does not exist — run /create-architecture after /architecture-review passes

## Session Extract — /architecture-review 2026-05-21
- Verdict: FAIL
- Requirements: 207 total — 115 covered (56%), 24 partial, 68 gaps (up from ~50% on 2026-05-20)
- ADRs: 13 reviewed (added ADR-0012 Alien AI, ADR-0013 Infection since 14:20). Alien AI + Infection now fully covered.
- New TR-IDs registered: None (registry current — TR-infection-001 flagged for revision pending C6, not changed)
- GDD revision flags: None (no GDD assumption contradicted by engine reality)
- Conflicts: C6 ✅ RESOLVED 2026-05-24 (ADR-0004 updated: Infection→World-tier, UInfectionSpreadSubsystem; adr-data.yaml TODO-C6 cleared; consistency-failures.md created); C1 ✅ RESOLVED (ADR-0006 expanded); C2 ✅ RESOLVED (two-subsystem split already correct); C5 ✅ RESOLVED (DismissedHintIDs removed); C4 ✅ RESOLVED 2026-05-26 (rebinding op=PC/ADR-0003; UI widget=UHUDSubsystem/ADR-0016; persistence=EIUS own file; ADR-0006 excludes bindings; OQ-1 closed; adr-input.yaml v2 with rebinding_ui_owner + rebinding_persistence_location + direct_eius_access_outside_pc)
- Engine (unreal-specialist, re-confirmed): HIGH-1 ADR-0008 UDataLayerSubsystem→UWorld::GetDataLayerManager(); HIGH-2 ADR-0011 root-motion GetRelativeTransform inverted→TransformVector; HIGH-3 ADR-0010+0012 UAIPerceptionSystem::MakeNoise() nonexistent→UAISense_Hearing::ReportNoiseEvent(); MED-4/5 ADR-0009 PerlinNoiseCameraShakePattern + no CameraRetractSpeed; MED-6 ADR-0010↔0011 foot-IK solver disagreement
- Top required ADRs (Core/MVP gaps, no dedicated ADR): Combat (7), HUD (7), Stealth (5), Health (5), Player Controller (6)
- ADR status: 4 Accepted (0001/0002/0004/0005), 9 Proposed (0003/0006/0007/0008/0009/0010/0011/0012/0013) — full Proposed-on-Proposed chain; accept order 0006→0007→0003→0008→0010→0009→0011→0012→0013
- architecture.md: does not exist (run /create-architecture after Core ADRs)
- Pre-gate: all ❌ (test-setup + ux-design needed)
- Reports: docs/architecture/architecture-review-2026-05-21.md + docs/architecture/architecture-traceability.md (full 207-row matrix)

## Session Extract — /architecture-review 2026-05-20 (14:20)
- Verdict: FAIL (foundation gaps closed; remaining = core-gameplay ADRs + reconciliations)
- Requirements: ~207 total — ~105 covered (~50%), ~40 partial, ~62 gaps (up from ~28% AM)
- New since AM: ADR-0007/0008/0009/0010/0011 written (Physics/Scene/Camera/Movement/Animation) — close all Foundation gaps
- Conflicts (all open): C1 ADR-0006 save schema incomplete vs Save/Load GDD; C2 ADR-0004 Dialogue World-tier loses persistence; C4 input rebinding ownership; C5 NEW stale Tutorial model in ADR-0004/0006
- Engine (unreal-specialist): ADR-0008 UDataLayerSubsystem removed→UWorld::GetDataLayerManager() [HIGH]; ADR-0011 root-motion local→world math inverted [HIGH]; ADR-0010 ReportNoise() purge (MakeNoise correct) [HIGH]; ADR-0009 UPerlinNoiseCameraShakePattern + no SpringArm CameraRetractSpeed [MED]; ADR-0010↔0011 foot-IK node disagreement [MED]
- ADR status: 4 Accepted (0001/0002/0004/0005), 7 Proposed (0003/0006/0007/0008/0009/0010/0011) — Proposed-on-Proposed chain; accept order: 0006(after C1)→0003→0007→0008→0009/0010→0011
- Top required ADRs: Alien AI, Infection Spread (both highest-risk), Combat, HUD, Stealth
- GDD revision flags: None new
- New TR-IDs registered: None (registry current)
- Pre-gate: all ❌ (test-setup + ux-design needed)
- Report: docs/architecture/architecture-review-2026-05-20-1420.md

## Progress — Tutorial System (started 2026-05-19)

| Section | Status |
|---------|--------|
| Skeleton | ✅ |
| Overview | ✅ |
| Player Fantasy | ✅ |
| Detailed Design | ✅ |
| Formulas | ✅ |
| Edge Cases | ✅ |
| Dependencies | ✅ |
| Tuning Knobs | ✅ |
| Visual/Audio Requirements | ✅ |
| UI Requirements | ✅ |
| Acceptance Criteria | ✅ |
| Open Questions | ✅ |

## Context

- **System**: Tutorial System (#22 in systems index)
- **Priority**: Vertical Slice | Layer: Meta
- **Depends on**: Game State Machine (designed)
- **Depended on by**: None
- **Pillars**: Pillar 2 (Earned Discovery), Pillar 3 (Tense Survival)
- **Engine**: Unreal Engine 5.7

## Key Decisions Made

- None yet.

## Agent Invocations

- None yet.

## Cross-System Notes

- GSM has no Tutorial state — tutorial will operate within Playing/other existing states
- GSM subscribe API: SubscribeToStateChange(FStateChangeDelegate)
- Game concept: "First 10 minutes in the prison — teach movement, stealth, survival before infection hits"

## Session Extract — /architecture-review 2026-05-19 (11:25)

- Verdict: 🔴 FAIL (coverage 26%, up from 24%)
- Requirements: 185 total — 49 covered, 8 partial, 128 gaps
- New TR-IDs registered: 11 (TR-tutorial-001..011)
- GDD revision flags: dialogue-system.md, investigation-system.md, hud-system.md (ADR-0004 tier conflicts X-7/X-8/X-9)
- Prior X-2 RESOLVED: GSM GDD Rule 1 now aligned with ADR-0002
- Top ADR gaps: ADR-0005 Data Tables, ADR-0006 Save/Load Serialization, ADR-0008 Physics & Collision
- Report: docs/architecture/architecture-review-2026-05-19-1125.md

<!-- CONSISTENCY-CHECK: 2026-05-19 | GDDs checked: 22 | Conflicts found: 1 | Stale registry: 1 | Both resolved -->

## Session Extract — post-review cleanup 2026-05-19 (11:38)

- ADR-0001: Proposed → **Accepted**
- ADR-0002: Proposed → **Accepted**
- ADR-0004: Investigation tier corrected Session (was World); Tutorial added to tier table (Session)
- GDD fixes: dialogue-system.md → UWorldSubsystem; hud-system.md → ULocalPlayerSubsystem; investigation-system.md unchanged (Session-tier confirmed)
- X-7/X-8/X-9 all RESOLVED
- Next: /clear context → /architecture-decision for ADR-0005 (Data-Driven Authoring Pipeline / Data Tables)

## Session Extract — /review-all-gdds 2026-05-20

- Verdict: **FAIL**
- GDDs reviewed: 22
- Flagged for revision: systems-index, save-load, combat, alien-ai, infection-spread, investigation, dialogue, faction-reputation, crafting, quest (Needs Revision); health/player-controller/hud/gsm/stealth/movement (warnings)
- Blocking issues: 10 — (1) systems-index dep/status drift; (2) Dialogue<->Investigation testimony detection-threshold silent clue loss; (3) Stealth strictly dominates Combat; (4) infection unbounded faucet vs scarce sinks; (5) Chemicals monopoly economy untuned; (6) up-scaling difficulty vs flat player power, no difficulty spec; (7) death-reload retention contradiction; (8) faction NPC-kill silent hostile flip; (9) NPC-kill attribution unowned; (10) cure reversal formula mismatch
- Root causes: systems-index drift / Chemicals-bottlenecked economy / two unowned contracts (NPC-kill attribution + death rollback) / Dialogue-Investigation threshold
- Systems index updated: Save/Load+Crafting+Map status drift fixed; 10 GDDs marked Needs Revision; Quest dep +Faction; Dialogue dep -Quest; circular-deps note corrected
- Recommended next: /design-review on blocking-flagged GDDs, then re-run /review-all-gdds before /create-architecture
- Report: design/gdd/gdd-cross-review-2026-05-20.md

## Session Extract — ADR authoring 2026-05-20 (session 2)

- TR registry fixes: TR-tutorial-003 (DISMISSED→ACTIVE), TR-tutorial-006 (FTutorialProgress→FTutorialSaveData); last_updated bumped
- ADR-0007 Physics & Collision: Written (Proposed). Covers all 10 TR-physics-*. Key decisions: Chaos only, UPhysicsHelperSubsystem (World-tier), 8 custom channels via EHostileCollision namespace, 7 UPhysicalMaterial assets, Chaos Destruction for glass, ragdoll via Timeline+SetSimulatePhysics, substep 3.33ms/6max, OnPlayerLanded/OnImpact delegates. Engine specialist: FChaosBreakEvent confirmed, Chaos plugin default confirmed, 18 channel limit confirmed, substep path confirmed. 3 medium risks added (bone casing, null GetPhysicsMaterial, async physics).
- Registry updated: 1 state_ownership, 2 interface contracts, 2 API decisions, 4 forbidden patterns
- Remaining blocking issues (architecture-review FAIL): ADR-0008 Scene Streaming, ADR-0009 Camera, ADR-0010 Movement; revise ADR-0006 (C1), reconcile ADR-0004/0006 dialogue (C2), accept ADR-0003

## Session Extract — /architecture-review 2026-05-20

- Verdict: 🔴 FAIL (coverage ~28% — 59 covered / 35 partial / 113 gap of 207 reqs)
- ADRs: 0001/0002/0004/0005 Accepted; 0003/0006 still Proposed
- New TR-IDs registered: None
- GDD revision flags: None new (dialogue + save-load already Needs Revision)
- Blocking: (1) Foundation gaps — Physics/Scene Mgmt/Camera/Movement have NO ADR; (2) C1 ADR-0006 save schema incomplete vs new save GDD (missing Health/Crafting/Investigation/Map/WorldFlags/Transform/GSM payloads; slot-name/trigger/blocking-write/corruption mismatch); (3) C2 ADR-0004 Dialogue World-tier loses persistent NPC relationships (TR-dialogue-003/008); (4) ADR-0003 & 0006 Proposed with engine defects
- Engine (unreal-specialist): ADR-0006 CachedSave needs UPROPERTY (GC), SaveSlotName won't compile, 4 verifications unperformed; ADR-0003 bIsPlayerMappable lock overstated + GetUserSettings null guard; ADR-0002 IsTickable ticks before Initialize; ADR-0001 listener-handle UPROPERTY no-op, must Unregister explicitly
- Registry stale (not applied): TR-tutorial-003 (DISMISSED→ACTIVE), TR-tutorial-006 (FTutorialProgress→FTutorialSaveData)
- Required ADRs next: Physics, Scene Streaming, Camera, Movement; then revise+accept 0006, reconcile 0004/0006 dialogue, accept 0003
- Report: docs/architecture/architecture-review-2026-05-20.md

## Session Extract — ADR authoring 2026-05-20 (session 3)

- ADR-0008 Scene Streaming: Written (Proposed). Covers all 13 TR-scene-*. Key decisions: UWorldSubsystem tier, World Partition sole streaming authority, UDataLayerSubsystem for Data Layer activation via RequestDataLayerSwap() chokepoint, FStreamableManager for non-world assets in GSM Loading state, AZoneBoundaryVolume overlap detection with 3.0s FTimerHandle debounce, FTimerHandle memory pressure check (2.0s, NOT Tick), IHostileSaveProvider registration. Engine specialist (3 blocking fixed): FStreamableHandle explicit CancelHandle() in Deinitialize(); UnregisterProvider(this) in Deinitialize(); memory pressure timer not Tick. HIGH-RISK: UDataLayerSubsystem access path may have changed post-5.4 — verify DataLayerSubsystem.h before first story.
- Registry updated: 1 state_ownership (scene_streaming_state), 1 interface contract (zone_crossed_event), 2 API decisions (world_streaming_authority, data_layer_activation), 2 forbidden patterns (manual_level_streaming_in_open_world, direct_data_layer_write)
- ADR-0009 Camera: Written (Proposed). Covers all 8 TR-camera-*. Key decisions: AHostileWorldPlayerCameraManager (APlayerCameraManager subclass), 5 modes via EHostileCameraMode enum + UpdateViewTarget() dispatch, SetViewTargetWithBlend EaseInOut, UCameraShakeBase subclass for procedural shakes with 25px/15° cap via AddShake() chokepoint, recoil as separate FInterpTo decay offset, Cinematic mode via ULevelSequencePlayer + bCinematicActive flag, Lumen exposure on PostProcessVolumes (not camera manager). Engine specialist (3 blocking fixed): UINTERFACE boilerplate added to ICameraSystem; SubscribeToCameraModeChanged → direct AddDynamic pattern; UCameraShakeBase subclass name flagged for engine install verification (check UPerlinNoiseCameraShake vs UWaveOscillatorCameraShake in 5.7 headers).
- Registry updated: 1 state_ownership (camera_mode_state), 1 interface contract (camera_mode_changed_event), 1 API decision (camera_mode_owner)
- Remaining: ADR-0010 Movement (14 TR-movement-*); revise ADR-0006 (missing save payload sub-structs); reconcile ADR-0004/0006 dialogue conflict; accept ADR-0003

## Session Extract — ADR authoring 2026-05-20 (session 4)

- ADR-0010 Movement Architecture: Written (Proposed). Covers all 14 TR-movement-*. Key decisions: UHostileMovementComponent (CMC subclass), MOVE_Custom(0)=Dodge/MOVE_Custom(1)=Cover, UCoverComponent (UActorComponent) 4Hz FTimerHandle poll, stamina on AHostileCharacter (float), CMC queries via CanSprint/CanDodge(float)/CanJump read-only, all phase timers via accumulated DeltaTime. Engine specialist (2 blocking fixed): UAIPerceptionSystem::ReportNoise() does not exist → corrected to MakeNoise()/FAINoiseEvent+ReportEvent(); CanDodge(int32) → CanDodge(float). Minor notes incorporated: ApplyRootMotionToVelocity() required in PhysDodge() Coast phase; cover exit via UpdateCharacterStateAfterMovement() to prevent flicker; FAnimNode_FootPlacement confirmed correct for 5.7.
- Registry updated: 2 state_ownership (movement_state, character_stamina), 3 interface contracts (movement_state_changed_event, dodge_event, noise_emitted_event), 3 API decisions (movement_component_pattern, cover_detection_pattern, noise_emission_api), 3 forbidden patterns (direct_stamina_write, mid_tick_cover_exit, direct_ia_binding_in_movement)
- Remaining: ADR-0011 Animation (TR-movement-011/013/014 ref animation paths); revise ADR-0006 (missing save payload sub-structs); reconcile ADR-0004/0006 dialogue conflict; accept ADR-0003/0006/0007/0008/0009/0010
- Next recommended action: /architecture-review in a FRESH session (never same session as /architecture-decision)

<!-- CONSISTENCY-CHECK: 2026-05-20 | GDDs checked: 22 | Conflicts found: 2 (both resolved) | Stale registry entries: 2 (both fixed) | Files modified: hud-system.md, stealth-system.md, entities.yaml, docs/consistency-failures.md -->

## Session Extract — /review-all-gdds 2026-05-20 (15:16)
- Verdict: FAIL
- GDDs reviewed: 22 (full mode: consistency + design-theory + scenario)
- Totals: 16 blocking, 22 warnings, 3 info
- Flagged for revision: combat-system, stealth-system, alien-ai-system, infection-spread-system, game-state-machine, save-load-system, map-system, tutorial-system, crafting-system, scene-management, health-system, inventory-system (+ entities.yaml registry staleness)
- Blocking root clusters: (1) combat-boundary seam — combat start/end/"in combat" defined 3 ways across Combat/Stealth/Alien-AI/Investigation/Faction/GSM (B-1,B-2,S-B3,S-B5); (2) death↔infection↔save seam undefined (S-B1 orphaned IMC_Combat, S-B2 infection-rewind, S-W4 die-to-undo); (3) economy — stealth dominates combat (D-B1), unbounded infection faucet (D-B2), Chemicals monopoly + cure-source contradiction (D-B3), no difficulty-curve spec (D-B4)
- Standalone blockers: GetTimeOfDay() owned by none/consumed by 4 (B-6); Map↔GSM Paused unmodeled (B-3); Tutorial deps one-directional (B-4); SaveMapState uncontracted (B-5); weapon data + Inventory "4 slots" (B-7); cure radius 1500 vs 3000 (W-7)
- Systems index: 8 GDDs set to Needs Revision (others already flagged)
- Recommended next: resolve combat-state model first (highest leverage, ~6 findings), then re-run /review-all-gdds before /create-architecture
- Report: design/gdd/gdd-cross-review-2026-05-20-1516.md

## Session Extract — Combat-State Model resolution 2026-05-20 (15:31)
- Decision: Unified combat-state model (3 distinct concepts) applied across 5 files
  - Player Combat Mode (ECombatState/IMC_Combat/music/65°FOV) = detection 100 ONLY, Combat-System sole owner (keeps "no warning before attack" ambiguity)
  - Alien combat behavior = detection >=75 (alien Combat Branch, unchanged)
  - IsPlayerUnderThreat() narrative gate = detection >=75 (renamed from bIsInCombat reads); Investigation/Quest/Faction consume
  - Combat end = Combat Formula 3 T_disengage (7-30s) is sole authority; Alien-AI 10.0s/5.0s and Combat's hardcoded 10.0s reconciled to reference it
  - GSM Rule 6b now triggers on Combat OnCombatEngaged() (not raw 1500cm range); Dialogue exempt (melee-range per Dialogue Rule 7)
- Files edited: combat-system.md, stealth-system.md, alien-ai-system.md, game-state-machine.md, entities.yaml (registered disengagement_timer formula + combat_mode_threshold=100 + under_threat_threshold=75 constants)
- Resolves: B-1, B-2, S-B3, S-B4, S-B5, W-4 + combat internal 10s-vs-Formula3 bug (7 findings)
- REMAINING follow-up: quest-system.md + faction-reputation-system.md still phrase their own "in combat" checks; align to IsPlayerUnderThreat() in their Needs-Revision pass (registry already lists them as referenced_by under_threat_threshold)
- ✅ RESOLVED 2026-05-21: GetTimeOfDay ownership (B-6), Map/GSM Paused (B-3), Tutorial deps (B-4), SaveMapState (B-5), weapon data (B-7), cure radius 1500→3000 (W-7)
- Untouched clusters: economy (D-B1..D-B4), death<->infection<->save (S-B1/S-B2/S-W4)

## Session Extract — /architecture-review combat-system 2026-05-21
- Verdict: CONCERNS (single-GDD: combat-system.md → ADR-0014 + deps 0001/0003/0004/0010/0012)
- Requirements: ~15 — 9 covered, 6 partial, 0 hard gaps. Core combat machine fully covered by ADR-0014; partials at seams (camera/animation/alien-projectile/VFX-budget).
- New TR-IDs registered: None. Revised: TR-combat-005 + TR-pc-010 (stale ≥75 → canonical =100 model; IDs preserved, revised 2026-05-21).
- GDD revision flags: None (noise design is design-level; engine fixes are impl-only).
- 🔴 Engine HIGH (unreal-specialist confirmed, systemic across ADR-0010/0012/0014): E-1 UAIPerceptionSystem::MakeNoise() does NOT exist → UAISense_Hearing::ReportNoiseEvent(WorldCtx,Loc,Loudness,Instigator,MaxRange,Tag); E-2 ReportDamageEvent wrong class+sig → UAISense_Damage::ReportDamageEvent(WorldCtx,DamagedActor,Instigator,DamageAmount,EventLocation,HitLocation,Tag) (no HitDirection param). E-3 melee cone LOW (refine: normalize toTarget, ignore self, prefer OverlapMultiByChannel, horizontal dot). E-4 MED: ADR-0014 "Post-Cutoff APIs: None" inaccurate; no ai-perception.md module doc exists.
- Dependency: ADR-0014 Proposed, depends on Proposed 0003/0010/0012 → cannot Accept until chain accepted. Order: 0003→0010→0012→0014.
- Conflicts logged to consistency-failures.md: C-1 IMC ownership + =100 threshold (resolved via TR revisions).
- Required follow-ups: (1) patch E-1/E-2 in ADR-0010/0012/0014; (2) create docs/engine-reference/unreal/modules/ai-perception.md; (3) accept ADR chain; (4) wire combat→camera (ADR-0009) + combat→animation montage (ADR-0011); (5) assign owner for alien projectile pipeline + VFX-budget enforcement.
- Pre-gate: all ❌ (test-setup + ux-design needed before gate-check).
- Report: docs/architecture/architecture-review-combat-2026-05-21.md
