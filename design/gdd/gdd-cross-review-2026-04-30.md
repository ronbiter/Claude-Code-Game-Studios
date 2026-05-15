# Cross-GDD Review Report

> **Date:** 30 April 2026
> **GDDs Reviewed:** 16
> **Systems Covered:** Input, GSM, Physics, Camera, Scene Management, Player Controller, Movement, Health, Stealth, Combat, Alien AI, Infection Spread, HUD, Investigation, Dialogue, Inventory
> **Verdict:** PASS — all blocking issues resolved. 7 warnings remain (non-blocking).
> **Re-Review Date:** 30 April 2026 — All 9 original blocking issues + 2 partial fixes confirmed resolved.

---

## Consistency Issues

### Blocking (must resolve before architecture begins)

🔴 **Input System duplicate QuickSlot definitions with conflicting gamepad mappings**
- **Input GDD** has two conflicting tables defining IA_QuickSlot1–4 with different gamepad D-pad mappings (lines 49-52 vs 62-65). IA_QuickSlot5 also appears in the second table only.
- **Fix:** Remove duplicate rows, keep single definition, ensure 1-4 keys.

🔴 **GSM Priority Stack logic contradicts its own examples**
- **GSM GDD** (line 90): `CanPush = priority(newState) > priority(currentState)` — higher number wins
- **GSM GDD** (line 179): "Dialogue (priority 30) > Inventory (35) — numerically lower priority wins" — inverted logic
- **Fix:** Line 179 is wrong. Inventory (35) > Dialogue (30). Fix the example text.

🔴 **Health System Near Death sprint drain math error**
- **Health GDD** (line 97): "Sprint drains 10% faster (15→16.5/s)"
- **Registry** (injury_sprint_drain_penalty): P_drain=0.15, giving 15 × 1.15 = **17.25/s**
- **Fix:** Either update Health GDD to 17.25/s, or change P_drain to 0.10

🔴 **Death + Infection overlap — infection ticks during GameOver**
- **Infection Spread Rule 8**: Ticks pause only on GSM `Paused`. GameOver does NOT pause infection.
- **Health System Rule 5**: Player respawns with checkpoint inventory/HP, but world infection has advanced.
- Player can respawn into a zone that has infected further or spawned new hives during their death screen.
- **Fix:** Either freeze infection during GameOver, advance checkpoint infection state on reload, or document as intended punitive design.

🔴 **Inventory + Combat overlap — GSM transition path undefined**
- **GSM GDD** lists Inventory as "Interruptible" but the priority stack (35) would block Combat from pushing.
- **Player Controller** and **Inventory System** both say inventory is "immediately interrupted" by combat engagement.
- The mechanism (IMC_Combat push + GSM→Playing) bypasses GSM transition validation.
- **Fix:** Define the exact GSM transition path when combat interrupts inventory.

🔴 **Investigation + Stealth overlap — observation cancelled mid-progress**
- **Investigation System** requires 2s stationary observation for environmental clues.
- **Stealth Gate** requires detection < 25. If detection crosses 25 during the 2s window, behavior is undefined.
- **Fix:** Define what happens when stealth gate is violated mid-observation (cancel, complete, or partial).

### Warnings (should resolve, but won't block)

⚠️ **Player Controller stale cross-reference status** — Lists 5 systems as "(Not Started)" when all are designed. Update to "(Designed)".

⚠️ **WorldSlowFactor tuning knob duplicated** — Both Dialogue and Inventory GDDs define `WorldSlowFactor` (0.85x). Define once in GSM GDD, have others reference it.

⚠️ **Alien AI Charge attack range mismatch** — Rule 1 says 600-1000cm, BT tree says 500-1500cm. Align.

⚠️ **Quick slot Q key conflicts with Dodge** — Input System binds Q to Dodge, Inventory System references Q as Quick Slot 1. Clarify context-dependent resolution. (Note: already resolved to 1-4 keys, but Input GDD still has duplicate rows.)

⚠️ **Camera System FOV 90° dead value** — Appears in formula's valid range but never defined as an actual mode FOV.

⚠️ **Sprint speed formula description mismatch** — Input System describes sprint as 1.5x multiplier, Movement System bakes it into V_base (900 cm/s). Conceptual vs. runtime discrepancy.

⚠️ **Stealth System V_base composition ambiguous** — Additive (100 + modifier) vs. Movement System's multiplicative visibility modifier. Clarify relationship.

⚠️ **Movement System Dodge during Jump vs. Fall** — Dodge allowed during Jump but NOT during Fall. Distinction is subtle and error-prone.

### Clean (no issues found)

✅ **Health System damage pipeline** — Fall damage formula consistent across Physics, Movement, and Health.
✅ **Stealth detection thresholds** — Stealth System (25/50/75/100), Alien AI System, Investigation System all aligned.
✅ **GSM state priorities** — All GDDs reference consistent priority values.
✅ **Infection spread formula chain** — Output range [0, 100] consistent across Infection Spread, Alien AI, HUD.
✅ **Player mass, Max HP, Max Stamina** — All consistent across GDDs.
✅ **Context prompt range (500cm)** — Consistent across Player Controller, Investigation, Inventory.
✅ **Dodge timing (0.65s total, 0.25s i-frames)** — Consistent across Movement, Health, Combat.

---

## Game Design Issues

### Blocking

🔴 **Inventory System Player Fantasy contradicts Anti-Pillar**
- **Inventory GDD**: "like a professional preparing for a dangerous mission" — frames player as competent, prepared, in control.
- **Game Concept Anti-Pillar**: "NOT a power fantasy: The player is capable and dangerous, but the world is deadlier."
- **Fix:** Rewrite inventory fantasy around "scavenger making hard choices with inadequate resources."

🔴 **Camera System FOV inverted for sprint**
- **Camera GDD**: Sprint FOV = 70° (narrower than default 75°). Sprinting should WIDEN FOV, not narrow it.
- **Fix:** Sprint FOV should be 80-85°.

### Warnings

⚠️ **Cognitive overload: 7+ simultaneous attention systems** during core loop moment.

⚠️ **Infection Spread pacing too aggressive** — Cell under Hive reaches Hive Core in ~1 minute. Playtest K_spread_rate.

⚠️ **Dialogue System over-invested for MVP** — 3D relationship model for only 3 NPCs. Consider scoping down.

⚠️ **Health System "operational capacity" fantasy undermines Tense Survival** — Character always calm reduces visceral tension.

⚠️ **Combat System only cites Pillar 3, misses Pillar 1** — Add Pillar 1.

⚠️ **No catch-up mechanics for falling behind** — Death spiral has no mechanical catch-up beyond checkpoint HP restore.

---

## Cross-System Scenario Issues

**Scenarios walked:** 5

### Blockers
🔴 **Death + Infection overlap** — Infection ticks during GameOver. Player respawns into advanced world state.
🔴 **Inventory + Combat overlap** — GSM transition path undefined when combat interrupts inventory.
🔴 **Investigation + Stealth overlap** — 2s observation window has no defined behavior if detection crosses Hidden threshold mid-observation.

### Warnings
⚠️ **Combat + Infection overlap** — Infection exposure damage stacks with alien attack damage. No DPS cap.
⚠️ **Dialogue + Combat overlap** — Player locked in dialogue while alien closes from 1500cm to 150cm. No abort mechanism.
⚠️ **Death + Infection overlap** — Hive spawn check could fire during GameOver near respawn location.
⚠️ **Investigation + Stealth overlap** — Revelation deferral requires 13s+ of Hidden state after combat disengagement.

### Info
ℹ️ **Projectile vs. Infection collision** — Set to Ignore. Confirm Combat System traces use ECC_Visibility.
ℹ️ **Dialogue/Investigation stealth threshold band** — NPCs talk at Suspicious but clues require Hidden.
ℹ️ **World slow revert on inventory interrupt** — Ensure world timescale reset owned by GSM.

---

## GDDs Flagged for Revision

| GDD | Reason | Type | Priority |
|-----|--------|------|----------|
| input-system.md | Duplicate QuickSlot definitions with conflicting mappings | Consistency | Blocking |
| game-state-machine.md | Priority stack logic contradicts examples | Consistency | Blocking |
| health-system.md | Near Death sprint drain math error (16.5 vs 17.25) | Consistency | Blocking |
| inventory-system.md | Player Fantasy contradicts Anti-Pillar; Quick slot Q conflict | Consistency + Design | Blocking |
| camera-system.md | Sprint FOV inverted (70° should be 80-85°) | Design | Blocking |
| investigation-system.md | Stealth gate violation mid-observation undefined | Consistency | Blocking |
| player-controller.md | Stale "(Not Started)" cross-references | Consistency | Warning |
| dialogue-system.md | Over-invested for MVP (3D relationship model for 3 NPCs) | Design | Warning |
| alien-ai-system.md | Charge attack range mismatch (600-1000 vs 500-1500) | Consistency | Warning |
| combat-system.md | Missing Pillar 1 citation | Design | Warning |
