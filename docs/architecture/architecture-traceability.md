# Architecture Traceability Index

> **Last Updated:** 2026-05-21
> **Engine:** Unreal Engine 5.7
> **Source review:** `docs/architecture/architecture-review-2026-05-21.md`

## Coverage Summary
- Total requirements: **207**
- ✅ Covered: **115** (56%)
- ⚠️ Partial: **24** (12%)
- ❌ Gaps: **68** (33%)

Legend — ✅ Covered (an ADR explicitly addresses it) · ⚠️ Partial (covered ambiguously, or
covered-but-conflicted) · ❌ Gap (no ADR). Parenthesised ADRs = cross-cutting coverage only.

---

## Full Matrix

### Movement — design/gdd/movement-system.md
| Req ID | Requirement (abbrev) | ADR | Status |
|--------|----------------------|-----|--------|
| TR-movement-001 | Extends CharacterMovementComponent | ADR-0010 | ✅ |
| TR-movement-002 | 8 movement states + priority resolution | ADR-0010 | ✅ |
| TR-movement-003 | Stamina on AHostileCharacter; CMC reads only | ADR-0010 | ✅ |
| TR-movement-004 | Dodge MOVE_Custom(0), 3 phases | ADR-0010 | ✅ |
| TR-movement-005 | UCoverComponent; MOVE_Custom(1) | ADR-0010 | ✅ |
| TR-movement-006 | Cover proximity event-driven 4Hz | ADR-0010 | ✅ |
| TR-movement-007 | OnDodgeStarted/Ended delegates | ADR-0010 | ✅ |
| TR-movement-008 | Noise as spherical sound events (⚠ HIGH-3 API) | ADR-0010 | ✅ |
| TR-movement-009 | OnMovementStateChanged delegate | ADR-0010 | ✅ |
| TR-movement-010 | Real-time-seconds timers | ADR-0010 | ✅ |
| TR-movement-011 | ABP reads state; movement ≠ drives anim | ADR-0010/0011 | ✅ |
| TR-movement-012 | Movement VFX budgets | ADR-0010 | ✅ |
| TR-movement-013 | Foot IK all locomotion (⚠ MED-6 solver) | ADR-0011 | ✅ |
| TR-movement-014 | Cover split-body anim layering | ADR-0011 | ✅ |

### Physics — design/gdd/physics-system.md
| Req ID | Requirement (abbrev) | ADR | Status |
|--------|----------------------|-----|--------|
| TR-physics-001 | UE5.7 Chaos (not PhysX) | ADR-0007 | ✅ |
| TR-physics-002 | 8 custom collision channels | ADR-0007 | ✅ |
| TR-physics-003 | Per-surface PhysicalMaterials | ADR-0007 | ✅ |
| TR-physics-004 | Ground detection line trace; per-frame surface | ADR-0007 | ✅ |
| TR-physics-005 | Hitscan / multi-trace / sphere sweep split | ADR-0007 | ✅ |
| TR-physics-006 | Glass shatter via Chaos Destruction | ADR-0007 | ✅ |
| TR-physics-007 | Ragdoll blend 0.3s on death | ADR-0007 | ✅ |
| TR-physics-008 | IPhysicsSystem interface | ADR-0007 | ✅ |
| TR-physics-009 | Physics sub-step config for 60fps | ADR-0007 | ✅ |
| TR-physics-010 | OnImpact/OnLanded delegates | ADR-0007 | ✅ |

### Scene Management — design/gdd/scene-management.md
| Req ID | Requirement (abbrev) | ADR | Status |
|--------|----------------------|-----|--------|
| TR-scene-001 | World Partition single streaming authority | ADR-0008 | ✅ |
| TR-scene-002 | Cell size 2520m, immutable | ADR-0008 | ✅ |
| TR-scene-003 | Max 500 actors/cell | ADR-0008 | ✅ |
| TR-scene-004 | Runtime Grid Tags + Data Layers (⚠ HIGH-1 API) | ADR-0008 | ✅ |
| TR-scene-005 | HLOD for Clean+Infected variants | ADR-0008 | ✅ |
| TR-scene-006 | Async load via FStreamableManager; 30s timeout | ADR-0008 | ✅ |
| TR-scene-007 | Streaming memory pool budgets | ADR-0008 | ✅ |
| TR-scene-008 | Max 8 concurrent I/O, 60/40 split | ADR-0008 | ✅ |
| TR-scene-009 | ISceneManagementSubsystem interface (⚠ HIGH-1) | ADR-0008 | ✅ |
| TR-scene-010 | Data Layer swap state machine + rollback (⚠ HIGH-1) | ADR-0008 | ✅ |
| TR-scene-011 | OnZoneCrossed/OnDataLayerChanged | ADR-0008 | ✅ |
| TR-scene-012 | Frame-time guarantee on crossfade | ADR-0008 | ✅ |
| TR-scene-013 | GSM Loading fallback if SSD <200MB/s | ADR-0008 | ✅ |

### Infection Spread — design/gdd/infection-spread-system.md
| Req ID | Requirement (abbrev) | ADR | Status |
|--------|----------------------|-----|--------|
| TR-infection-001 | Subsystem as UGameInstanceSubsystem (⚠ C6: ADR-0013 says UWorldSubsystem) | ADR-0013 | ⚠️ |
| TR-infection-002 | Tick 10s; per-cell when sources in range | ADR-0013 | ✅ |
| TR-infection-003 | Max 25 cells/tick; O(n) sources | ADR-0013 | ✅ |
| TR-infection-004 | <1.0ms tick; <2MB state | ADR-0013 | ✅ |
| TR-infection-005 | Pause on Paused/GameOver; no catch-up | ADR-0013 | ✅ |
| TR-infection-006 | RequestDataLayerSwap on threshold | ADR-0013 | ✅ |
| TR-infection-007 | IInfectionSpreadSubsystem interface | ADR-0013 | ✅ |
| TR-infection-008 | OnCellStateChanged/HiveSpawned/etc events | ADR-0013 | ✅ |
| TR-infection-009 | Source HP owned by Infection; DamageInfectionSource | ADR-0013 | ✅ |
| TR-infection-010 | Fast-travel simulates ticks; deterministic | ADR-0013 | ✅ |

### Game State Machine — design/gdd/game-state-machine.md
| Req ID | Requirement (abbrev) | ADR | Status |
|--------|----------------------|-----|--------|
| TR-gsm-001 | Single authoritative GSM; no parallel state | ADR-0002 | ✅ |
| TR-gsm-002 | Event-driven transitions; queued in order | ADR-0002 | ✅ |
| TR-gsm-003 | Priority LIFO stack, 8 states | ADR-0002 | ✅ |
| TR-gsm-004 | Exit-before / Entry-after transition | ADR-0002 | ✅ |
| TR-gsm-005 | SubscribeToStateChange + reentrancy guard | ADR-0002 | ✅ |
| TR-gsm-006 | GameOver priority 100 clears stack | ADR-0002 | ✅ |
| TR-gsm-007 | Reentrancy guard queues nested changes | ADR-0002 | ✅ |
| TR-gsm-008 | Same-frame requests sorted by priority | ADR-0002 | ✅ |
| TR-gsm-009 | Combat engagement bypass | ADR-0002 | ✅ |
| TR-gsm-010 | World timescale ownership (WorldSlowFactor) | ADR-0002 | ✅ |
| TR-gsm-011 | MaxStackDepth 8; queue 16 | ADR-0002 | ✅ |
| TR-gsm-012 | IGameStateMachine interface | ADR-0002 | ✅ |

### Player Controller — design/gdd/player-controller.md
| Req ID | Requirement (abbrev) | ADR | Status |
|--------|----------------------|-----|--------|
| TR-pc-001 | Thin Router; no gameplay logic on PC | ADR-0001/0003 | ✅ |
| TR-pc-002 | Routes input via multicast delegates | ADR-0001 | ✅ |
| TR-pc-003 | Context resolver proximity/async-trace | — | ❌ |
| TR-pc-004 | AsyncLineTraceByChannel for context | — | ❌ |
| TR-pc-005 | Context resolver 4Hz, scales with target count | — | ❌ |
| TR-pc-006 | Subscribes to subsystem events; no poll | ADR-0001 | ✅ |
| TR-pc-007 | Combat input latency <50ms | — | ❌ |
| TR-pc-008 | Movement input latency <100ms | — | ❌ |
| TR-pc-009 | Push/pop IMC_Stealth dual trigger | ADR-0003 | ⚠️ |
| TR-pc-010 | Push/pop IMC_Combat on engagement | ADR-0003 | ⚠️ |
| TR-pc-011 | FContextPrompt struct fields | — | ❌ |

### Camera — design/gdd/camera-system.md
| Req ID | Requirement (abbrev) | ADR | Status |
|--------|----------------------|-----|--------|
| TR-camera-001 | 5 camera modes via PlayerCameraManager | ADR-0009 | ✅ |
| TR-camera-002 | SetViewTargetWithBlend EaseInOut | ADR-0009 | ✅ |
| TR-camera-003 | Spring-arm retract (⚠ MED-5 no CameraRetractSpeed) | ADR-0009 | ✅ |
| TR-camera-004 | Procedural shake Perlin (⚠ MED-4 class name) | ADR-0009 | ✅ |
| TR-camera-005 | Cinematic via Sequencer | ADR-0009 | ✅ |
| TR-camera-006 | Lumen auto-exposure tuning | ADR-0009 | ✅ |
| TR-camera-007 | ICameraSystem interface | ADR-0009 | ✅ |
| TR-camera-008 | Shake stacking caps | ADR-0009 | ✅ |

### Dialogue — design/gdd/dialogue-system.md
| Req ID | Requirement (abbrev) | ADR | Status |
|--------|----------------------|-----|--------|
| TR-dialogue-001 | UDialogueSubsystem (⚠ C2 World tier loses persistence) | ADR-0004 | ⚠️ |
| TR-dialogue-002 | Dialogue trees in Data Tables | ADR-0005 | ✅ |
| TR-dialogue-003 | Per-NPC Trust/Fear/Knowledge | — | ❌ |
| TR-dialogue-004 | 5 NPC types | — | ❌ |
| TR-dialogue-005 | Radial choice wheel input | — | ❌ |
| TR-dialogue-006 | Melee interrupt safety override | — | ❌ |
| TR-dialogue-007 | Camera Conversation mode blend | ADR-0009 | ✅ |
| TR-dialogue-008 | Events + SaveDialogueState (⚠ C2 no FDialogueSaveData) | ADR-0001/0006 | ⚠️ |
| TR-dialogue-009 | Fear recovery rules | — | ❌ |

### Input — design/gdd/input-system.md
| Req ID | Requirement (abbrev) | ADR | Status |
|--------|----------------------|-----|--------|
| TR-input-001 | Enhanced Input only; no legacy | ADR-0003 | ✅ |
| TR-input-002 | 22 Input Actions | ADR-0003 | ✅ |
| TR-input-003 | 8 IMCs with priority | ADR-0003 | ✅ |
| TR-input-004 | Runtime rebinding except IA_Pause | ADR-0003 | ✅ |
| TR-input-005 | Stick/trigger dead zones | ADR-0003 | ⚠️ |
| TR-input-006 | Atomic context transitions | ADR-0003 | ✅ |
| TR-input-007 | Auto-pause on focus loss | ADR-0003 | ✅ |
| TR-input-008 | Dual-mode input when UI open | ADR-0003 | ✅ |
| TR-input-009 | Persist rebinding profiles (⚠ C4 owner unresolved) | ADR-0003/0006 | ⚠️ |
| TR-input-010 | Lean actions gated to Cover | ADR-0003 | ✅ |

### Health — design/gdd/health-system.md
| Req ID | Requirement (abbrev) | ADR | Status |
|--------|----------------------|-----|--------|
| TR-health-001 | int32 HP pool, max 100, no overheal | — | ❌ |
| TR-health-002 | EDamageType enum | — | ❌ |
| TR-health-003 | TakeDamage pipeline | — | ❌ |
| TR-health-004 | Dodge i-frames (Movement coupling) | ADR-0010/0007 | ⚠️ |
| TR-health-005 | Death → RequestStateTransition(PlayerDied) | ADR-0002 | ✅ |
| TR-health-006 | Health VFX budgets | — | ❌ |
| TR-health-007 | SaveHealthState/Restore (no FHealthSaveData) | ADR-0006 | ⚠️ |
| TR-health-008 | Healing consumable interruptibility | — | ❌ |

### Stealth — design/gdd/stealth-system.md
| Req ID | Requirement (abbrev) | ADR | Status |
|--------|----------------------|-----|--------|
| TR-stealth-001 | Per-alien score; global = max | — | ❌ |
| TR-stealth-002 | 5 detection states + de-escalation | — | ❌ |
| TR-stealth-003 | IStealthDetection::GetDetectionScore | ADR-0012 | ⚠️ |
| TR-stealth-004 | Per-alien calc budget; max 20 aliens | — | ❌ |
| TR-stealth-005 | Stealth VFX/audio budgets | — | ❌ |
| TR-stealth-006 | OnDetectionChanged/OnStealthBroken events | ADR-0001 | ⚠️ |
| TR-stealth-007 | Reads Movement/Physics/Scene/Camera/Health per frame | — | ❌ |

### Combat — design/gdd/combat-system.md
| Req ID | Requirement (abbrev) | ADR | Status |
|--------|----------------------|-----|--------|
| TR-combat-001 | 4 weapon classes | — | ❌ |
| TR-combat-002 | Hitscan player / projectile alien | ADR-0012 | ⚠️ |
| TR-combat-003 | Damage formula multipliers | — | ❌ |
| TR-combat-004 | Weapon condition + jam chance | — | ❌ |
| TR-combat-005 | Combat lifecycle + disengage timer | — | ❌ |
| TR-combat-006 | Combat owns IMC_Combat pop; FOV narrow | — | ❌ |
| TR-combat-007 | Reload refund on interrupt | — | ❌ |
| TR-combat-008 | Combat VFX budgets | — | ❌ |
| TR-combat-009 | OnCombatEngaged/Disengaged; AddRecoil→Camera | ADR-0001/0009 | ⚠️ |

### Alien AI — design/gdd/alien-ai-system.md
| Req ID | Requirement (abbrev) | ADR | Status |
|--------|----------------------|-----|--------|
| TR-ai-001 | AAlienCharacter/AAlienAIController | ADR-0012 | ✅ |
| TR-ai-002 | UAIPerceptionComponent, 3 senses | ADR-0012 | ✅ |
| TR-ai-003 | Behavior Trees; C++ BT nodes; Blackboard | ADR-0012 | ✅ |
| TR-ai-004 | Custom BT node classes | ADR-0012 | ✅ |
| TR-ai-005 | EQS queries, caching, budgets | ADR-0012 | ✅ |
| TR-ai-006 | Custom Nav Areas | ADR-0012 | ✅ |
| TR-ai-007 | Biomass Nav Areas painted at runtime | ADR-0012 | ✅ |
| TR-ai-008 | Squad system + UAlienManagerSubsystem | ADR-0012 | ✅ |
| TR-ai-009 | Per-alien CPU budget; max counts | ADR-0012 | ✅ |
| TR-ai-010 | UpdatePerception writes Blackboard | ADR-0012 | ✅ |
| TR-ai-011 | Squad alert propagation | ADR-0012 | ✅ |
| TR-ai-012 | Sight ranges + hysteresis | ADR-0012 | ✅ |

### Investigation — design/gdd/investigation-system.md
| Req ID | Requirement (abbrev) | ADR | Status |
|--------|----------------------|-----|--------|
| TR-investigation-001 | UInvestigationSubsystem | ADR-0004 | ✅ |
| TR-investigation-002 | 3 clue types; one-time discovery | — | ❌ |
| TR-investigation-003 | Clue data in Data Tables | ADR-0005 | ✅ |
| TR-investigation-004 | Thread states + deferred revelation | — | ❌ |
| TR-investigation-005 | Gaze-hold observation + stealth gate | — | ❌ |
| TR-investigation-006 | Revelation deferral poll | — | ❌ |
| TR-investigation-007 | SaveInvestigationState (no sub-struct) | ADR-0006 | ⚠️ |
| TR-investigation-008 | OnClueDiscovered/etc events | ADR-0001 | ✅ |

### HUD — design/gdd/hud-system.md
| Req ID | Requirement (abbrev) | ADR | Status |
|--------|----------------------|-----|--------|
| TR-hud-001 | Two HUD modes; queued mode change | — | ❌ |
| TR-hud-002 | Two rendering pipelines + shared data layer | — | ❌ |
| TR-hud-003 | UHUDSubsystem (Player tier) subscriptions | ADR-0004 | ✅ |
| TR-hud-004 | Tactical HUD frame budget | — | ❌ |
| TR-hud-005 | UMG widgets; resolution support | — | ❌ |
| TR-hud-006 | Minimap circular params | — | ❌ |
| TR-hud-007 | Accessibility hooks | — | ❌ |
| TR-hud-008 | HUD visibility per camera mode | ADR-0009 | ⚠️ |
| TR-hud-009 | Context prompts shared, max 2 | — | ❌ |

### Inventory — design/gdd/inventory-system.md
| Req ID | Requirement (abbrev) | ADR | Status |
|--------|----------------------|-----|--------|
| TR-inventory-001 | UInventorySubsystem; grid + weight | ADR-0004 | ✅ |
| TR-inventory-002 | Item data in Data Tables | ADR-0005 | ✅ |
| TR-inventory-003 | 6 item categories, stack rules | — | ❌ |
| TR-inventory-004 | 2 dedicated weapon slots | — | ❌ |
| TR-inventory-005 | Ammo per-type; weight at pickup | — | ❌ |
| TR-inventory-006 | First-fit top-left placement | — | ❌ |
| TR-inventory-007 | 4 quick slots reference stacks | — | ❌ |
| TR-inventory-008 | IInventorySubsystem incl Save | ADR-0006 | ✅ |
| TR-inventory-009 | Mid-drag not preserved on save | ADR-0006 | ⚠️ |

### Quest — design/gdd/quest-system.md
| Req ID | Requirement (abbrev) | ADR | Status |
|--------|----------------------|-----|--------|
| TR-quest-001 | Quest data in Data Tables; 2 tiers | ADR-0005 | ✅ |
| TR-quest-002 | Continuous poll 1Hz / event-driven | — | ❌ |
| TR-quest-003 | Eval pauses (GSM + Combat) | ADR-0002 | ⚠️ |
| TR-quest-004 | Deferred consequence system | — | ❌ |
| TR-quest-005 | SaveQuestState | ADR-0006 | ✅ |
| TR-quest-006 | No cap; HUD shows 3 | — | ❌ |

### Faction — design/gdd/faction-reputation-system.md
| Req ID | Requirement (abbrev) | ADR | Status |
|--------|----------------------|-----|--------|
| TR-faction-001 | Signed rep; 7 standing tiers | — | ❌ |
| TR-faction-002 | Faction-faction matrix + ripple | — | ❌ |
| TR-faction-003 | Faction-NPC trust cap bridge | — | ❌ |
| TR-faction-004 | SaveFactionState | ADR-0006 | ✅ |
| TR-faction-005 | OnFactionReputationChanged event | ADR-0001 | ✅ |
| TR-faction-006 | Combat state detection | — | ❌ |
| TR-faction-007 | Save corruption defaults | ADR-0006 | ⚠️ |

### Crafting — design/gdd/crafting-system.md
| Req ID | Requirement (abbrev) | ADR | Status |
|--------|----------------------|-----|--------|
| TR-crafting-001 | 2 craft modes; proximity-gated | — | ❌ |
| TR-crafting-002 | Schematics as world items | — | ❌ |
| TR-crafting-003 | Recipes in Data Tables; atomic consume | ADR-0005 | ✅ |
| TR-crafting-004 | Channel timings/interruptibility | — | ❌ |
| TR-crafting-005 | Inventory-full blocks + refunds | — | ❌ |
| TR-crafting-006 | SaveCraftingState (no FCraftingSaveData) | ADR-0006 | ⚠️ |

### Map — design/gdd/map-system.md
| Req ID | Requirement (abbrev) | ADR | Status |
|--------|----------------------|-----|--------|
| TR-map-001 | Fog-of-war per-zone bitmask | — | ❌ |
| TR-map-002 | World Map = GSM Paused sub-state | ADR-0002 | ⚠️ |
| TR-map-003 | Auto location pinning | — | ❌ |
| TR-map-004 | Manual marker cap 10 | — | ❌ |
| TR-map-005 | No fast travel at MVP | — | ❌ |
| TR-map-006 | SaveMapState (no FMapSaveData) | ADR-0006 | ⚠️ |
| TR-map-007 | Fog reveal per frame in Playing | — | ❌ |

### Save/Load — design/gdd/save-load-system.md
| Req ID | Requirement (abbrev) | ADR | Status |
|--------|----------------------|-----|--------|
| TR-save-001 | Single slot; auto-save triggers | ADR-0006 | ✅ |
| TR-save-002 | USaveGame async write; OnSaveComplete | ADR-0006 | ✅ |
| TR-save-003 | Save suppressed in Cutscene/GameOver | ADR-0006 | ✅ |
| TR-save-004 | Load only in GSM Loading; distribute | ADR-0006 | ✅ |
| TR-save-005 | Corruption handling | ADR-0006 | ✅ |
| TR-save-006 | Save indicator UMG (HUD dep) | ADR-0006 | ⚠️ |
| TR-save-007 | Save/Load mutually exclusive | ADR-0006 | ✅ |
| TR-save-008 | Payload completeness (⚠ C1 6 payloads missing) | ADR-0006 | ⚠️ |
| TR-save-009 | Clean-exit blocking write | ADR-0006 | ✅ |
| TR-save-010 | Checkpoint cooldown 30s | ADR-0006 | ✅ |
| TR-save-011 | Storage-full handling | ADR-0006 | ✅ |

### Tutorial — design/gdd/tutorial-system.md
| Req ID | Requirement (abbrev) | ADR | Status |
|--------|----------------------|-----|--------|
| TR-tutorial-001 | Overlay in Playing only; no GSM state | ADR-0004 | ✅ |
| TR-tutorial-002 | Two-stage activation | — | ❌ |
| TR-tutorial-003 | 5 hint states transition table | — | ❌ |
| TR-tutorial-004 | World-space callout via UWidgetComponent | — | ❌ |
| TR-tutorial-005 | Subscribe GSM OnStateEntered/Exited | ADR-0001/0002 | ✅ |
| TR-tutorial-006 | Persist FTutorialSaveData (⚠ C5 stale DismissedHintIDs) | ADR-0006 | ⚠️ |
| TR-tutorial-007 | Observe IMC_Default; never consume input | — | ❌ |
| TR-tutorial-008 | bTutorialEnabled global toggle | — | ❌ |
| TR-tutorial-009 | Max 2 active hints; priority formula | — | ❌ |
| TR-tutorial-010 | Trigger sphere radius formula | — | ❌ |
| TR-tutorial-011 | UnlockCondition gates registration | — | ❌ |

---

## Known Gaps — Suggested ADRs

| Priority | System | Gaps | Suggested ADR |
|----------|--------|------|---------------|
| 1 | Combat | 7 | `/architecture-decision Combat System` |
| 2 | HUD | 7 | `/architecture-decision HUD System` |
| 3 | Stealth | 5 | `/architecture-decision Stealth System` |
| 4 | Health | 5 | `/architecture-decision Health System` |
| 5 | Player Controller | 6 | `/architecture-decision Player Controller` |
| 6 | Tutorial | 8 | ADR or cross-cutting sign-off |
| 6 | Dialogue | 5 | ADR or cross-cutting sign-off |
| 6 | Inventory | 5 | ADR or cross-cutting sign-off |
| 6 | Map | 5 | ADR or cross-cutting sign-off |
| 6 | Investigation | 4 | ADR or cross-cutting sign-off |
| 6 | Faction | 4 | ADR or cross-cutting sign-off |
| 6 | Crafting | 4 | ADR or cross-cutting sign-off |
| 6 | Quest | 3 | ADR or cross-cutting sign-off |

## Superseded / Pending-Revision Requirements
- **TR-infection-001** — text says `UGameInstanceSubsystem`; ADR-0013 establishes
  `UWorldSubsystem`. Pending C6 resolution, then revise registry wording (do not renumber).

## History
| Date | Covered % | Notes |
|------|-----------|-------|
| 2026-05-20 (AM) | ~28% | 4 ADRs accepted, 7 proposed, 5 missing |
| 2026-05-20 (14:20) | ~50% | Foundation ADRs 0007–0011 added |
| 2026-05-21 | 56% | ADR-0012/0013 added; C6 surfaced; full 207-row matrix |
