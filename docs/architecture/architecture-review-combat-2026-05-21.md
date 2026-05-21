# Architecture Review Report — Combat System (single-GDD)

> Date: 2026-05-21
> Engine: Unreal Engine 5.7
> Mode: `/architecture-review combat-system`
> Reviewed: `design/gdd/combat-system.md` → `ADR-0014` (dedicated) + dependency ADRs 0001 / 0003 / 0004 / 0010 / 0012
> Verdict: **CONCERNS**

---

## Traceability Matrix

| TR-ID | Requirement | ADR Coverage | Status |
|-------|-------------|--------------|--------|
| TR-combat-001 | 4 weapon classes (fire rate/dmg/mag/ammo) | ADR-0014 Rule 1 | ✅ Covered |
| TR-combat-002 | Player hitscan **+ alien projectile w/ travel time** | ADR-0014 (hitscan only) | ⚠️ Partial — alien projectile pipeline not architecturally owned |
| TR-combat-003 | Damage formula (5 multipliers, ceil, min 1) | ADR-0014 Formula 1 | ✅ Covered |
| TR-combat-004 | Condition tiers **+ jam (5%/15%, 2.0s clear)** | ADR-0014 (condition only) | ⚠️ Partial — jam roll/FSM not in decision |
| TR-combat-005 | Lifecycle + disengage timer | ADR-0014 ECombatState + Formula 3 | ✅ Covered (TR text was stale — revised, see C-2) |
| TR-combat-006 | Combat owns IMC_Combat pop; **FOV 65°** | ADR-0014 (IMC ✅) | ⚠️ Partial — FOV/camera interface absent (Camera = ADR-0009) |
| TR-combat-007 | Reload pre-deduct + refund on cancel | ADR-0014 reload FSM | ✅ Covered |
| TR-combat-008 | VFX budget <0.5ms, decal/casing caps | ADR-0014 (deferred to impl) | ⚠️ Partial — no architectural enforcement owner |
| TR-combat-009 | OnCombatEngaged/Disengaged + **AddRecoil→Camera** | ADR-0014 (delegates ✅) | ⚠️ Partial — camera recoil interface not wired |
| *(no TR)* | Panic Rule 7 / Formula 4 | ADR-0014 GetPanicModifier | ✅ Covered |
| *(no TR)* | Spread Formula 2 (ring buffer) | ADR-0014 | ✅ Covered |
| *(no TR)* | Melee cone Rule 6 | ADR-0014 (sweep + dot) | ✅ Covered (engine refinements — E-3) |
| *(no TR)* | Backup call Rule 8 | ADR-0014 NotifyBackupCalled / ADR-0012 | ✅ Covered |
| *(no TR)* | IsPlayerUnderThreat() narrative gate | ADR-0014 | ✅ Covered |
| *(no TR)* | Animation montage slots (incl. jam slot) | ADR-0011 exists, not referenced by ADR-0014 | ⚠️ Partial |

**Totals:** ~15 requirements — **9 ✅ covered, 6 ⚠️ partial, 0 ❌ hard gaps.**

The core combat machine (ECombatState ownership, Formulas 1–4, IMC lifecycle, melee, reload FSM, panic, backup) is fully covered by ADR-0014. All partials sit at integration seams owned by adjacent systems (Camera ADR-0009, Animation ADR-0011, Alien AI ADR-0012, plus an unwritten VFX/Audio owner) — not combat-internal gaps.

### Coverage-completeness note (optional new TRs)
Five GDD requirements are covered by ADR-0014 but have no TR-ID: Panic (Rule 7/Formula 4), Spread (Formula 2), Melee cone (Rule 6), Backup call (Rule 8), and the `IsPlayerUnderThreat()` narrative-defer gate. Consider adding TR-combat-010..014 in a future full review for story traceability. Not added in this run (single-GDD scope).

---

## Cross-System Conflicts

### C-1 — IMC_Combat ownership + trigger threshold (Player Controller vs Combat)
- **TR-pc-010 (player-controller GDD, original):** "PC pushes/pops IMC_Combat on combat engagement (detection ≥75…)".
- **ADR-0014 + combat GDD canonical:** Combat System **owns** the IMC push/pop decision; PC exposes `PushCombatIMC()`/`PopCombatIMC()` bridge methods only. Combat Mode triggers at **detection =100**, never 75.
- **Impact:** Two systems appear to claim IMC ownership; the `≥75` threshold contradicts the unified combat-state model and would push IMC/combat music during the intended "no warning" window (Pillar 3).
- **Resolution:** ✅ Applied — TR-pc-010 revised to "PC is the API bridge; Combat System owns the decision; trigger =100."

### C-2 — Stale trigger threshold in TR-combat-005
- **TR-combat-005 (original):** "trigger at detection ≥75 OR melee in stealth".
- **GDD unified combat-state model (canonical, 2026-05-20):** Combat Mode = detection **=100**; detection **≥75** drives *alien combat behavior* only (not a player-facing combat signal).
- **Impact:** Story authors referencing TR-combat-005 would implement the wrong trigger.
- **Resolution:** ✅ Applied — TR-combat-005 revised to the `=100` model.

*Note: ADR-0014 does **not** conflict with ADR-0010/0012 — they agree on the noise/damage API. That agreement is itself the defect (see E-1/E-2): a shared engine error, not a cross-ADR contradiction.*

---

## ADR Dependency Order

ADR-0014 (**Proposed**) `Depends On`: ADR-0001 ✅ Accepted · ADR-0003 ⏳ Proposed · ADR-0004 ✅ Accepted · ADR-0010 ⏳ Proposed · ADR-0012 ⏳ Proposed.

🔴 **ADR-0014 cannot be Accepted or implemented until ADR-0003, ADR-0010, and ADR-0012 are Accepted.** ADR-0014 also queries `UAlienSquadSubsystem` (ADR-0012) and the IMC_Combat lifecycle depends on `UEnhancedInputLocalPlayerSubsystem` (ADR-0003).

Recommended accept order: **ADR-0003 → ADR-0010 → ADR-0012 → ADR-0014.**

---

## Engine Compatibility (unreal-specialist confirmed)

| ID | Finding | Severity |
|----|---------|----------|
| **E-1** | `UAIPerceptionSystem::MakeNoise()` **does not exist** in UE 5.7. Correct API: `UAISense_Hearing::ReportNoiseEvent(WorldCtx, NoiseLocation, Loudness, Instigator, MaxRange, Tag)`. `AActor::MakeNoise()` / `UPawnNoiseEmitterComponent` is the separate legacy noise system. **Systemic — same wrong static appears in ADR-0010, ADR-0012, ADR-0014.** Will not compile. | 🔴 HIGH |
| **E-2** | `UAIPerceptionSystem::ReportDamageEvent()` wrong class **and** signature (no `HitDirection` param). Correct API: `UAISense_Damage::ReportDamageEvent(WorldCtx, DamagedActor, Instigator, DamageAmount, EventLocation, HitLocation, Tag)`. Affects ADR-0012, ADR-0014. | 🔴 HIGH |
| **E-3** | Melee `SweepMultiByChannel` + dot-product, `cos(30°)` threshold for a 60° (±30°) arc — sound. Refinements: normalize `toTarget` before Dot; `FCollisionQueryParams::AddIgnoredActor(this)`; prefer `OverlapMultiByChannel` for fixed-reach (sweep adds nothing and can miss already-overlapping actors); use horizontal-plane dot (zero Z) if vertical separation should not break the cone. | 🟢 LOW |
| **E-4** | ADR-0014 "Post-Cutoff APIs Used: **None**" is inaccurate — E-1/E-2 are unverified post-cutoff APIs. No `docs/engine-reference/unreal/modules/ai-perception.md` exists to pin them. **Recommend creating that module doc** so future ADR reviews verify against a pinned reference. | 🟡 MED |

*Specialist source caveat: confirmation drawn from stable AIModule API knowledge (unaffected by the UE 5.7 breaking-change set: Substrate/PCG/Megalights/Animation), not a live 5.7 header snapshot — because no AI-perception engine-reference doc exists in-project.*

---

## GDD Revision Flags

**None** — the combat GDD's noise design (radii, propagation, stealth interaction) is design-level and remains valid. The E-1/E-2 fixes change implementation only, not the GDD's mechanics.

---

## Verdict: CONCERNS

Coverage of the combat machine is essentially complete (no hard gaps) and the architectural decisions in ADR-0014 are sound. Three items must clear before ADR-0014 is Accepted:

1. 🔴 **E-1 + E-2** — fix the AI-perception API (`ReportNoiseEvent` / `UAISense_Damage::ReportDamageEvent`) across ADR-0010, ADR-0012, ADR-0014. Systemic; will not compile as written.
2. 🔴 **Dependency chain** — Accept ADR-0003 → ADR-0010 → ADR-0012 before ADR-0014.
3. 🟡 **C-1 + C-2** — stale `≥75` TRs revised to the canonical `=100` model (applied this run).

### Required follow-ups (most foundational first)
1. Patch E-1/E-2 in ADR-0010, ADR-0012, ADR-0014 (and set ADR-0014 "Post-Cutoff APIs Used" honestly).
2. Create `docs/engine-reference/unreal/modules/ai-perception.md` pinning `UAISense_Hearing::ReportNoiseEvent` + `UAISense_Damage::ReportDamageEvent` (E-4).
3. Accept the ADR dependency chain in order, then re-run `/architecture-review combat-system`.
4. Wire combat→camera (AddRecoil/FOV via ADR-0009) and combat→animation montage slots (ADR-0011) — partials TR-combat-006/009 + animation.
5. Decide architectural owner for the alien projectile pipeline (TR-combat-002) and VFX-budget enforcement (TR-combat-008).

### Pre-gate checklist
- `tests/unit/` — ❌ → run `/test-setup`
- `tests/integration/` — ❌ → run `/test-setup`
- `.github/workflows/tests.yml` — ❌ → run `/test-setup`
- `design/accessibility-requirements.md` — ❌ → run `/ux-design`
- `design/ux/interaction-patterns.md` — ❌ → run `/ux-design`

`/gate-check` is not available until the above are resolved.
