# Cross-GDD Review Report — Hostile World

> **Date:** 2026-05-20 15:16
> **GDDs Reviewed:** 22 system GDDs
> **Pillars:** Hostile World · Earned Discovery · Tense Survival
> **Anti-Pillars:** NOT power fantasy · NOT infection-as-horror-gimmick · NOT chosen-one
> **Engine:** Unreal Engine 5.7
> **Mode:** full (consistency + design-theory + scenario walkthrough)
> **Method:** three parallel review passes against `design/registry/entities.yaml` baseline

**Systems covered:** Input, Physics, Camera, Scene Management, Game State Machine, Save/Load, Player Controller, Movement, Health, Stealth, Combat, Alien AI, Infection Spread, Investigation, Dialogue, HUD, Inventory, Faction Reputation, Quest, Crafting, Map, Tutorial.

**Note:** A prior same-day review (`gdd-cross-review-2026-05-20.md`) exists. This report is an independent fresh full run; findings were re-derived from the GDD sources.

---

## Verdict: **FAIL**

One or more blocking issues must be resolved before architecture begins.

**Totals:** 16 blocking · 22 warnings · 3 info.

Blocking issues collapse into **three root clusters** plus standalone structural gaps:

1. **The combat-boundary seam** — combat start, combat end, and "in combat" are each defined multiple, disagreeing ways across Combat / Stealth / Alien-AI / Investigation / Faction / GSM. *Highest-leverage fix: a single authoritative combat-state definition + IMC ownership contract resolves ~6 findings.*
2. **The death ↔ infection ↔ save seam** — the real-time infection pillar has no defined relationship with the checkpoint-reload contract.
3. **The economy** — stealth strictly dominates combat; infection is an unbounded faucet with no renewable sink for the dominant build; Chemicals are a monopoly resource with a cure-source contradiction; no difficulty-curve spec reconciles up-scaling enemies with flat player power.

Standalone structural gaps: `GetTimeOfDay()` owned by no system (consumed by 4); Map's reliance on GSM `Paused` is unmodeled; Tutorial dependencies are entirely one-directional.

---

## Section 1 — Consistency Issues (Phase 2)

**7 blocking · 12 warnings.**

### Blocking

#### 🔴 B-1 [2b] Combat disengagement timer vs Stealth/Alien-AI — three numbers govern "when combat ends"
- **GDDs:** `combat-system.md` (Rule 5, Formula 3, States table, AC ~525) vs `stealth-system.md` (Rule 3 transition table, Rule 5) vs `alien-ai-system.md` (States table ~266–267).
- **Issue:** Combat Formula 3 floor = 7.0s (all dead + cover), base 10.0s, up to 30s. Combat Rule 5 says on disengage "Stealth recalculates from zero." But Stealth requires stepped de-escalation totalling ~13s (Engaged→Alert 5s + Alert→Suspicious 3s + Suspicious→Hidden 5s). Alien AI exits Combat only after "breaks LOS + undetected 10.0s." Three different times for the same moment.
- **Resolve (options):** (a) Combat Formula 3 is the single authority, Stealth/AI decay slaved to it; (b) Alien-AI references `disengagement_timer`; (c) prove the three timers measure genuinely different things and cannot deadlock. `disengagement_timer`/`T_disengage` is unregistered despite being cross-system — register regardless.

#### 🔴 B-2 [2b] Alien AI Combat-exit hardcodes 10.0s; Combat owns disengagement
- **GDDs:** `alien-ai-system.md` (States table: "breaks LOS + undetected 10.0s OR all aliens dead") vs `combat-system.md` (Rule 5 + Formula 3 variable 7–30s; Combat is sole IMC_Combat owner).
- **Issue:** Alien can return to patrol (AI 10s) while Combat still considers combat active (e.g. 14s with 2 aliens alive), or vice versa.
- **Resolve:** Alien-AI references Combat's `disengagement_timer`, or both cite a shared constant. Register `disengagement_timer`.

#### 🔴 B-3 [2c/2b] Map routes World Map through GSM `Paused`, which GSM doesn't model
- **GDDs:** `map-system.md` (Rule 4 "map is a sub-view of Paused"; EC1, EC5) vs `game-state-machine.md` (Paused = pause menu, IMC_Menu, no Map sub-state) vs `save-load-system.md` (Rule 2 clean-exit save fires from Paused; AC8) vs `input-system.md` (IA_Map digital press, separate from IA_Pause).
- **Issue:** GSM Paused shows full tactical HUD + IMC_Menu — opening the map shows the pause menu, not a map. Save/Load treats Paused as the clean-exit context, so a checkpoint save during map-open (allowed by Map EC5) collides. Also Map says open via `IA_Map` **hold** while Input defines it as a **press**.
- **Resolve (options):** (a) add an explicit Map/Overlay state to GSM with its own priority + IMC; (b) keep Map under Paused but patch GSM to document the sub-view and reconcile HUD/IMC; (c) reconcile IA_Map press-vs-hold.

#### 🔴 B-4 [2a/2c] Tutorial dependencies are one-directional (self-flagged)
- **GDDs:** `tutorial-system.md` ("Cross-System Consistency Flags" ~249–253) vs `game-state-machine.md` (no Tutorial in Depended-On-By), `save-load-system.md` (no `FTutorialSaveData` in payload), `hud-system.md` (no `ShowTutorialScreenLabel`).
- **Issue:** Tutorial hard-depends on GSM (state mute) + Save/Load (`FTutorialSaveData`), soft-depends on HUD. None reciprocate. Save/Load Rule 3's 10-domain payload omits tutorial completion, so hint persistence (Tutorial Rule 8, AC ~358) has no backing contract.
- **Resolve:** Patch GSM Depended-On-By, Save/Load payload + interface table, HUD interactions. (No design judgment needed — Tutorial GDD names exactly what's missing.)

#### 🔴 B-5 [2c] `SaveMapState()` referenced but not formally contracted
- **GDDs:** `save-load-system.md` (Rule 3 payload lists Map fog-of-war + `SaveMapState()`) vs `map-system.md` (OQ-6: "the interface is not yet formally contracted there").
- **Issue:** Payload table references the interface but both GDDs' OQs admit it isn't formalised; reciprocity incomplete; hard/soft dep classification unsettled (see B-6).
- **Resolve:** Confirm payload-table entry is the contract (close both OQs) or add a formal interface row; decide hard vs soft dep.

#### 🔴 B-6 [2c] `GetTimeOfDay()` consumed by 4 systems, owned by none; Map/Scene status clash
- **GDDs:** `stealth-system.md` (Rule 4 lighting / `GetTimeOfDay()`), `investigation-system.md` (Time Gate), `alien-ai-system.md` (`GetTimeOfDay()`), `hud-system.md` all reference time-of-day **owned by Scene Management** — but `scene-management.md` defines no time-of-day subsystem or `GetTimeOfDay()`. Separately, `map-system.md` calls Scene Management a HARD dep "Not Started" while `scene-management.md` is "In Design" and already lists Map as a dependent.
- **Issue:** (1) Stale reference to a mechanic that does not exist in the owning GDD; (2) status strings disagree.
- **Resolve:** (a) Add a time-of-day subsystem + `GetTimeOfDay()` to Scene Management (or assign ownership elsewhere); (b) reconcile "Not Started" vs "In Design".

#### 🔴 B-7 [2b/2c] Weapon weights/footprints uncovered cross-system + internal Inventory contradiction
- **GDDs:** `inventory-system.md` (Rule 2: weapon 1.5–5.0kg, footprint 1×2–2×3; Summary "rifle 3.5kg / 4 slots") vs `combat-system.md` (Rule 1: Pistol/Shotgun/Rifle/Melee) vs `entities.yaml` (`weapon_slot_count: 2`, no per-weapon weight/footprint registered).
- **Issue:** Weapon weight/footprint is cross-system (feeds `can_carry` + weapon switching) but lives only in Inventory prose with no registry entry or Combat confirmation. "4 slots" example is neither 1×2 (2) nor 2×3 (6).
- **Resolve:** Register each weapon (weight, footprint, ammo type, magazine) in entities.yaml; reconcile the "4 slots" example with the stated footprint range.

### Warnings

- ⚠️ **W-1 [2d]** Near-Death sprint-drain unspecified in Health Rule 6 (registry has P_drain=0.15 for both Critical & Near-Death; Health lists +15% only under Critical). Registry self-flags considering 0.20 for Near-Death.
- ⚠️ **W-2 [2e]** Movement noise radius is meters (0–200m); Alien-AI hearing is 1500cm (15m). A 156m sprint-on-biomass radius vastly exceeds any alien's 15m hearing — ~10× mismatch. Stealth patches with ×100 note but design intent unreconciled.
- ⚠️ **W-3 [2b]** "Engagement range" resolves to different distances across Combat (1500cm), Player Controller (CombatEngagementRange 1500cm), and the dialogue melee exception (150cm); GSM Rule 6b trigger phrasing differs. Define "combat engagement" once as a registry constant.
- ⚠️ **W-4 [2c]** Stealth States table still shows IMC_Combat transitions per stealth state, reading as Stealth-owned, despite the resolved rule that Combat owns the IMC pop. Clarify the column is Combat-owned/read-only.
- ⚠️ **W-5 [2d]** Faction GDD authors a full faction HUD (toasts, standing bars, zone indicator) all tagged Vertical Slice, while HUD GDD lists faction display "Not designed." Treat Faction's UI section as forward-spec; add HUD interfaces when VS HUD is authored. (Registry correctly tracks the deferral.)
- ⚠️ **W-6 [2a]** Investigation calls Dialogue a HARD dep; Dialogue calls Investigation SOFT. Reciprocal but asymmetric — agree on one classification (likely both soft + co-implementation note).
- ⚠️ **W-7 [2c] (borderline blocking)** Infection Spread Rule 4b says cure "radius 1500 cm" while its own Formula 3, registry `cure_radius`, and Inventory Rule 8 all say **3000cm**. Fix Rule 4b → 3000cm.
- ⚠️ **W-8 [2b]** Registry `cell_infection_pressure` still includes `× M_cure` and `cure_suppressant` is a 0–1 multiplier, but the revised Infection Spread Formula 1 dropped `M_cure` and moved cures to additive `P_cure` (Formula 2). Update both registry entries to match the revised model; reconcile Rule 4b flat "-8" vs Formula 3 scaled value.
- ⚠️ **W-9 [2c]** Dialogue review note (~615) claims Camera has no conversation/OTS mode, but `camera-system.md` defines Conversation mode (250cm/30°/55°, consistent). Remove the stale note.
- ⚠️ **W-10 [2a]** Physics↔Scene `OnObjectDestroyed()` is reciprocal; cosmetic completeness only. Low priority.
- ⚠️ **W-11 [2f]** HUD Summary (~11) says mode "cannot be changed during gameplay," contradicting Rule 1 + ACs which allow queued out-of-combat changes. Update the Summary.
- ⚠️ **W-12 [2e]** Faction maps rep→Dialogue Trust caps ("Wary caps Trust at 40"), but Dialogue's Trust tier table doesn't acknowledge the cap. Co-document the faction→Trust relationship.

---

## Section 2 — Game Design Issues (Phase 3)

**4 blocking · 5 warnings.**

### Blocking

#### 🔴 D-B1 [3c/3a] Stealth strictly dominates Combat
- **GDDs:** `stealth-system.md`, `combat-system.md` (Overview, Rule 4), `health-system.md`, `crafting-system.md`.
- **Problem:** Stealth costs only stamina (free regen). Combat costs finite ammo (no vendor, no craft, zero reserve) + non-regen HP. Every exchange is a permanent net drain; stealth is renewable and free. The rational player always avoids combat — yet Combat is MVP core. The anti-power-fantasy working *too well*: combat becomes vestigial rather than a tense alternative.
- **Options:** (a) stealth tax — timed/forced-defender encounters; (b) combat reward — combat-only ammo caches; (c) stealth cost — noise/time-against-infection soft resource; (d) accept stealth-dominant and demote Combat to a last-resort failure state (re-scope).

#### 🔴 D-B2 [3d] Infection is an unbounded self-accelerating faucet with no renewable sink for the dominant build
- **GDDs:** `infection-spread-system.md` (Rules 2/4/5), `alien-ai-system.md` (Rule 10), `crafting-system.md`.
- **Problem:** Infection never decays; hives spawn hives; `W_time = 1 + minutes/60` accelerates over a session (reinforcing loop, no balancing loop). Sinks: destroy a 500-HP hive (combat-gated → dominated per D-B1) or temp cure (300s, max 2, loot-only). The pure-stealth player has no economical renewable way to push infection back.
- **Options:** cap `W_time`; add a stealth-accessible renewable sink (silent vent sabotage); OR explicitly design and document this as a "get out before it's too late" doom timer.

#### 🔴 D-B3 [3c/3d] Chemicals are a single-resource monopoly + cure-source contradiction
- **GDDs:** `crafting-system.md` (recipes, tuning), `health-system.md`, `infection-spread-system.md`.
- **Problem:** Chemicals gate the Cure Device (2×), the dominant Stimshot heal (1×, see D-W3), grenade, and Molotov. One bottleneck sets both the infection ceiling and the healing ceiling — and crafting OQ-3 admits all spawn rates are undefined. **Source contradiction:** infection-spread says cures are "loot-only (not craftable)"; crafting lists a craftable Cure Device recipe.
- **Options:** split the bottleneck (separate cure-component from heal-component) OR commit to the monopoly as designed scarcity and tune the Chemical faucet explicitly. Separately: pick ONE cure source and delete the other.

#### 🔴 D-B4 [3e] Up-scaling difficulty vs flat player power, no difficulty-curve spec
- **GDDs:** `alien-ai-system.md` (Rule 10), `infection-spread-system.md`, `health-system.md`, `investigation-system.md`, `movement-system.md`.
- **Problem:** Alien AI scales speed +30% / perception +40% / cooldowns −20% / alert +50% off zone infection; infection accelerates over time; player power is flat by design (fixed HP, no upgrades). Two compounding up-escalators vs flat power, countered only by the scarce/broken economy. **The flat power is correct per the anti-power-fantasy pillar — the defect is the missing spec** reconciling flat power with up-scaling enemies (infection OQ-7 deferred; no GDD caps simultaneous Rule-10 scaling).
- **Options:** write the difficulty-curve spec; cap the Rule-10 combined effect; define the intended TTK/escape-feasibility band per infection level.

### Warnings

- ⚠️ **D-W1 [3a/3f]** Primary Story/Investigation track is mechanically leanest (no unlocks/scaling); support Faction system is the richest progression (7 tiers, ripple matrix, amplifiers, discounts, allies, shelters). Achievers will optimise Factions and treat story as secondary — inverting intended aesthetic priority. Add a mechanical hook to Investigation OR flatten Faction so it reads as flavour.
- ⚠️ **D-W2 [3d/3f/anti-pillar]** Faction faucet (8 positive sources) >> sink (one weak conditional −2/day decay); Allied↔Allied halves negative ripples → dual-Allied reachable, collapsing "every alliance has a cost." Allied benefits (AI allies, safe shelter, 30% discount) edge toward the power-fantasy anti-pillar. Strengthen the sink / cap simultaneous Allied / gate shelter safety.
- ⚠️ **D-W3 [3c]** Stimshot (+40, usable while moving, not interrupted by damage) strictly beats Field Dressing (+25) and Medkit (+60) (both interruptible) in any contested moment. Rarity is the only lever — couples back to D-B3. Add a downside to Stimshot or a niche for the others.
- ⚠️ **D-W4 [3e]** Injury death-spiral: Critical/Near-Death apply speed/stamina/sprint/dodge penalties with no passive regen — damage makes you slower, louder, worse at fleeing. Reinforcing loop with no floor; compounds D-B4. Add a minimal recovery affordance or cap the combined injury+infection penalty.
- ⚠️ **D-W5 [3c]** Shotgun point-blank output far exceeds the only MVP enemy's 100 HP (one-shot trivialization); crouch-on-ice is a near-zero-detection optimal path. Self-limiting at one enemy but dominant as the roster thins. Add point-blank falloff / enemy variety before vertical slice.

### Player Attention Budget (3b)
Concurrent **active** systems during traversal: **4** — Movement, Stealth, Health triage, Infection pressure. **Rises to 5 in combat** (+ weapon/ammo/reload). At the upper edge of the healthy 3–4 ceiling, tipping to overload in combat. **Mitigated** because all heavy informational systems (Dialogue, Inventory, Crafting, Map, Investigation menus) are correctly **modal** and suspend/slow traversal. Recommendation: treat 4/5 as the hard ceiling — add no further always-on active system.

### Resource Source/Sink Table (3d)
| Resource | Faucets | Sinks | Flag |
|---|---|---|---|
| Health (HP) | Field Dressing +25, Medkit +60, Stimshot +40 | combat/env/infection damage; no passive regen | sink-heavy by design; OK |
| Stamina | passive regen (free) | sprint/dodge/jump | **infinite renewable** → underpins stealth dominance (D-B1) |
| Ammo (per type) | world scavenge only | firing, reload waste | **source<<sink, no renewable faucet** (D-B1) |
| Scrap Metal | world loot (rate undefined) | Cure Device, grenades | rate undefined (D-B3) |
| Fabric | world loot (rate undefined) | Bandage, Molotov, Stimshot | rate undefined (D-B3) |
| Chemicals | world loot (rate undefined) | Cure Device, Stimshot, grenade, Molotov | **monopoly bottleneck + undefined** (D-B3) |
| Cure Device | loot-only AND craftable | one-time deploy, 300s | **source contradiction** (D-B3) |
| Infection (world) | hives/nodes/vents; self-spawning + time-accelerating | hive destruction (combat-gated), temp cure | **unbounded faucet, no renewable sink** (D-B2) |
| Faction Reputation | 8 positive sources | −2/day conditional decay | **faucet>>sink** (D-W2) |
| Investigation (clues) | discovery; permanent | none (monotonic) | one-way by design; OK (see D-W1) |

No catch-up mechanism exists for a player who falls behind the infection curve (other than fleeing).

### Pillar / Fantasy (3f/3g) — Healthy
No system serves zero pillars (no scope creep). No anti-pillar hard violations (one drift vector: Faction Allied power — D-W2). No auto-reveal violation (Investigation gates all clues). No chosen-one violation (immunity is acquired/investigable). Fantasy coherence strong: all systems reinforce "competent operator + investigator + survivor, capable but never dominant." One tension to watch: Faction's "valued asset" fantasy softens "uniquely immune but never safe."

---

## Section 3 — Cross-System Scenario Issues (Phase 4)

**6 scenarios walked · 5 blockers · 5 warnings · 3 info.**

Scenarios: (1) Detection→Combat trigger; (2) Death mid-combat in a real-time-infecting zone; (3) Final-clue via dialogue mid-loop; (4) Combat interrupt of inventory/dialogue via GSM override; (5) Cure/craft while zone infects; (6) Quest consequence + faction ripple during combat.

### Blockers

#### 🔴 S-B1 Orphaned IMC_Combat on death (no pop path)
Scenario 2. `combat-system`, `game-state-machine`, `player-controller`, `health-system`. GSM GameOver "clears entire stack" = the GSM **state** stack; the Enhanced Input **IMC** stack is owned solely by Combat System and popped only via the Disengaged lifecycle. Death (Health Rule 5 → GSM GameOver) bypasses Disengaged. No GDD specifies who pops IMC_Combat (or IMC_Stealth) on death → undefined input state on checkpoint reload.

#### 🔴 S-B2 Death doesn't define infection-state rewind
Scenario 2. `save-load`, `infection-spread`, `alien-ai`, game-concept. Save payload restores per-cell infection to the last checkpoint, but no system documents that death "rewinds" the real-time infection that escalated during the run. Infection Rule 8 only pauses ticks in GameOver — it never addresses the following load. Result: contradictory-causality experience (world worsens → die → world clean) on the signature system.

#### 🔴 S-B3 IMC_Combat dual-ownership at detection 75 vs 100
Scenario 1. `stealth-system`, `combat-system`. Combat triggers only at detection **100** (Combat Rule 5; AC "at 75: no IMC push"). But Stealth's state table puts the player Engaged (75–99) with IMC_Combat pushed/queued. Two systems claim to push IMC_Combat at different thresholds → undefined input mode at 75–99.

#### 🔴 S-B4 Dialogue-interrupt contradiction: engagement vs melee range
Scenario 4. `game-state-machine`, `player-controller`, `dialogue-system`, `combat-system`. GSM Rule 6b pops Dialogue when an enemy enters **engagement range** (1500cm); PC edge case + Dialogue Rule 7 keep Dialogue alive until **melee range** (150cm). Direct contradiction on the same trigger — undefined combined behavior for an alien at 1500cm during dialogue.

#### 🔴 S-B5 Three conflicting "in combat" definitions gate narrative delivery
Scenarios 3 & 6. `alien-ai`, `combat-system`, `investigation-system`, `quest-system`, `dialogue-system`, `faction-system`. `bIsInCombat` set at detection ≥75 (Alien-AI blackboard); Combat's `ECombatState` engages only at 100; Faction EC-7 uses a third definition (aggro pool OR damage in last 5s). Investigation/Quest/Faction defer player-facing events on "in combat" — so a revelation or faction toast can fire while the player is hunted at detection 80. Contradictory feedback timing.

### Warnings
- ⚠️ **S-W1** Single quest turn-in cascades faction delta + ripple + clue unlock + consequence, with infection/desperation amplification (up to 2×), uncapped against tier jumps (faction EC-1, OQ-2 open). Unbounded reward/penalty swing per action.
- ⚠️ **S-W2** Infection escalating mid-combat raises alien speed/perception and lowers cooldowns while the disengage timer (max 30s) keeps the player locked in — reinforcing difficulty loop with no balancing cap. Freeze infection scaling for aliens already in Active Combat.
- ⚠️ **S-W3** Craft cancel ("enemy enters detection range", source undefined per OQ-4), environmental observation cancel (≥25), and stealth gate (<25) use three different "is it safe" thresholds for the three "slow action in danger" mechanics. Unify the safe-state semantics.
- ⚠️ **S-W4** Die-to-undo-NPC-death exploit: checkpoint reload revives an NPC whose death permanently failed a contract + dropped faction rep. Correct rollback but unstated, and conflicts with the stated permanence. Address in the death/save contract.
- ⚠️ **S-W5** Hive emergence is audio+haptic only (no screen glow by design); if it fires during a zone-crossing audio vacuum/crossfade or combat ambient duck (−6dB), the sole orientation cue for a new permanent infection source is masked.

### Info
- ℹ️ **S-I1** GSM Rule 6b, PC, and Inventory all describe the inventory-open-during-combat interrupt with slightly different timings — consistent intent, minor ordering ambiguity.
- ℹ️ **S-I2** WorldSlowFactor 0.85x restore path during a Dialogue↔combat-interrupt race is unspecified for the same-frame case.
- ℹ️ **S-I3** Faction per-day decay samples `GetZoneInfectionLevel` (per-tick aggregate updated every 10–60s) — sampling-rate mismatch only, cosmetic.

---

## GDDs Flagged for Revision

| GDD | Reason | Type | Priority |
|-----|--------|------|----------|
| combat-system.md | Combat-end timer disagreement; IMC ownership at 75 vs 100; "in combat" definition; weapon data | Consistency + Scenario | Blocking |
| stealth-system.md | Combat-end stepped decay vs Combat timer; IMC push at 75; states-table presentation | Consistency + Scenario | Blocking |
| alien-ai-system.md | Hardcoded 10s combat exit; `bIsInCombat`≥75 vs engaged=100; Rule-10 scaling uncapped | Consistency + Scenario + Design | Blocking |
| infection-spread-system.md | Unbounded faucet/no renewable sink; cure radius 1500 vs 3000; cure-source contradiction; death-rewind undefined | Design + Scenario + Consistency | Blocking |
| game-state-machine.md | Map sub-state unmodeled; Tutorial dep; dialogue-interrupt range; IMC vs state stack on death | Consistency + Scenario | Blocking |
| save-load-system.md | Paused/map collision; Tutorial payload; SaveMapState contract; infection rewind on death | Consistency + Scenario | Blocking |
| map-system.md | GSM Paused reliance; IA_Map press/hold; Scene status clash; SaveMapState OQ | Consistency | Blocking |
| tutorial-system.md | One-directional hard dependencies (self-flagged) | Consistency | Blocking |
| crafting-system.md | Chemicals monopoly; cure-source contradiction; undefined spawn rates; craft-cancel threshold | Design + Scenario | Blocking |
| scene-management.md | `GetTimeOfDay()` not defined though 4 systems consume it; status label | Consistency | Blocking |
| health-system.md | Stealth-vs-combat resource asymmetry; Stimshot dominance; injury death-spiral; Near-Death sprint-drain | Design + Consistency | Warning→Blocking context |
| inventory-system.md | Weapon weight/footprint uncovered + internal "4 slots" contradiction | Consistency | Blocking |
| faction-reputation-system.md | Faucet>>sink; Allied power drift; competes with Story track; HUD forward-spec; Trust-cap co-doc | Design + Consistency | Warning |
| investigation-system.md | Dialogue hard/soft label; lean primary track | Consistency + Design | Warning |
| dialogue-system.md | Investigation label; stale Camera note; Trust-cap; interrupt range | Consistency + Scenario | Warning |
| hud-system.md | Summary vs Rule 1 mode-change AC; faction display deferral; Tutorial label interface | Consistency | Warning |
| movement-system.md | Noise-radius units vs alien hearing; injury penalties | Consistency + Design | Warning |
| physics-system.md | Cosmetic Depended-On-By completeness | Consistency | Low |
| entities.yaml (registry) | Stale `cell_infection_pressure`/`cure_suppressant`; missing `disengagement_timer`, weapon data, combat-engagement constant | Consistency | Blocking-support |

---

## Required Actions Before Re-Running

1. **Define one authoritative combat-state model** (combat start, combat end, "in combat") and one IMC_Combat ownership contract across Combat / Stealth / Alien-AI / Investigation / Faction / GSM. Register `disengagement_timer` and a `combat_engagement` constant. (Resolves B-1, B-2, S-B3, S-B5, W-3, W-4; informs S-B1.)
2. **Define the death ↔ infection ↔ save contract** — what pops IMC_Combat on death (S-B1), whether infection rewinds with checkpoint state (S-B2), and the NPC-death/quest-fail rollback rule (S-W4).
3. **Resolve the economy** — stealth-vs-combat resource balance (D-B1), infection faucet/sink + doom-timer-or-not decision (D-B2), Chemicals monopoly + single cure source (D-B3), and write the difficulty-curve spec reconciling flat power with up-scaling enemies (D-B4).
4. **Close structural gaps** — assign `GetTimeOfDay()` ownership (B-6), model Map's GSM relationship + IA_Map press/hold (B-3), reciprocate Tutorial dependencies (B-4), formalise SaveMapState (B-5), register weapon data + fix Inventory "4 slots" (B-7).
5. **Fix the cure-radius contradiction** (W-7) and update stale registry formula entries (W-8).
6. Re-run `/review-all-gdds` after the blocking items above are addressed.
