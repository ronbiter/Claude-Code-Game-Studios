# Cross-GDD Review Report

> **Date:** 2026-05-20
> **GDDs Reviewed:** 22 system GDDs + entity registry
> **Engine:** Unreal Engine 5.7
> **Mode:** `focus:full` (consistency + design theory + cross-system scenario walkthrough)
> **Verdict:** **FAIL** — 10 blocking issues must be resolved before architecture begins.

**Systems covered:** Input, Physics, Camera, Scene Management, Game State Machine, Save/Load,
Player Controller, Movement, Health, Stealth, Combat, Alien AI, Infection Spread, Investigation,
Dialogue, HUD, Inventory, Faction Reputation, Quest, Crafting, Map, Tutorial.

**Headline:** The design is unusually disciplined — flat player power, anti-power-fantasy
consistently enforced, one coherent player identity, modal systems that prevent attention
overload, aligned detection thresholds, and every system maps to a pillar. The blocking issues
collapse into **four root causes**:

1. **systems-index.md drift** — wrong dependencies and stale "Not Started" statuses.
2. **An unspecified, Chemicals-bottlenecked resource economy** that must simultaneously (a) make
   combat a real choice vs. dominant stealth, (b) give the player a renewable counter to
   ever-worsening infection, and (c) let flat-power skill keep pace with up-scaling enemies.
3. **Two unowned cross-cutting contracts** — NPC-kill attribution cascade, and death/checkpoint
   rollback scope.
4. **The Dialogue ↔ Investigation detection-threshold conflict** causing silent clue loss.

---

## Consistency Issues

### Blocking

**🔴 C-1 — systems-index dependency + status drift**
- Quest's `Depends On` lists only "Dialogue" — omits the documented Quest ↔ Faction Reputation
  coupling (faction gates in Quest Rule 6, faction rewards in Quest Rule 7; Faction GDD
  hard-depends on Quest).
- `systems-index.md` rows 6/20/21 mark Save/Load, Crafting, and Map as **"Not Started"** with
  Design Doc = "—", but `save-load-system.md`, `crafting-system.md`, and `map-system.md` all
  exist and are authored.
- Row 15 lists Dialogue `Depends On: Quest` — direction inverted (true relationship is
  Quest → Dialogue). The "Circular Dependencies: None found" claim is also wrong:
  Investigation ↔ Dialogue and Dialogue ↔ Quest form cycles.
- The systems-index is the authoritative dependency/status map used for design ordering; it
  under-records real couplings and misreports status.

**🔴 C-2 — Dialogue vs. Investigation testimony detection-threshold → silent clue loss**
- `dialogue-system.md`: NPC refuses to talk only when **detection ≥ 50 (Alert)**;
  `topic_availability` gate = "detection < 50."
- `investigation-system.md` Stealth Gate (Rule 5): testimony/sensitive clue requires
  **detection < 25 (Hidden)**.
- Testimony clues are delivered *through* dialogue (Dialogue Rule 5 fires `OnClueDiscovered`).
  At detection 25–49 the player holds the conversation, selects the `[CLUE]` option, hears the
  testimony — and the clue silently fails to register because Investigation's gate rejected it.
  Two GDDs disagree on the threshold governing the same shared event. Produces a silent
  clue-loss bug, not just a design-preference difference.

### Warnings

- **⚠️ C-3 — Player death → GameOver double-owner.** `health-system.md` Rule 5 fires
  `RequestStateTransition(PlayerDied)` directly to GSM; `player-controller.md` Rule 4 also
  "routes death to GSM." GSM GDD lists Health as the initiator. Two described initiators →
  double-fire risk. Assign a single owner.
- **⚠️ C-4 — IMC_Stealth push threshold mismatch.** `player-controller.md` knob
  `StealthDetectionThreshold` defaults to 50; Stealth Rule 7 / Stealth↔PC contract says PC
  pushes IMC_Stealth at **≥ 25**.
- **⚠️ C-5 — HUD internal contradiction.** `hud-system.md` Summary: "HUD mode … cannot be
  changed during gameplay." Rule 1 + Edge Case: changes are "queued and applied on next GSM
  Playing state when not in combat." Summary line was never updated.
- **⚠️ C-6 — Combat one-directional dependencies.** `combat-system.md` never documents firing
  `OnNPCDied/OnNPCRescued` to Faction (Faction relies on them), nor referencing
  `DamageInfectionSource` (Infection routes hive/source HP through it).
- **⚠️ C-7 — Tutorial back-references unpatched.** `tutorial-system.md` self-flags that GSM,
  Save/Load, and HUD GDDs must list Tutorial as a dependent / expose `ShowTutorialScreenLabel()`.
  Verified still absent in all three target GDDs.
- **⚠️ C-8 — Unit-conversion landmines documented only in prose.**
  - Movement `noise_emission_radius` outputs **meters** [0,200]; Stealth `D_noise` distance term
    is in **cm**. The ×100 conversion exists only as a prose note in Stealth Formula 3.
  - `faction_reputation_delta` Formula 1 expects `infection_level` ∈ [0.0,1.0], but its source
    `GetZoneInfectionLevel()` returns **0–100**. The ÷100 normalization is undocumented in the
    Faction GDD (worked example assumes 0.60).
- **⚠️ C-9 — Stale cross-reference tables / OQs.**
  - Stealth/Combat/Investigation cross-ref tables tag now-Designed systems as "(Not Started)."
  - `alien-ai-system.md` Rule 10 names `ISceneManagement::GetZoneInfectionLevel` — the owning
    interface is Infection Spread (`IInfectionSpreadSubsystem`), per the resolved contract.
  - `save-load-system.md` OQ-4 says `SaveCraftingState()` is undefined in Crafting — it is now
    defined. `dialogue-system.md` review note "Camera has no OTS mode" — Camera now defines a
    Conversation mode. Index row 22 marks Tutorial "Approved" while the GDD header says
    "In Review."

### Verified clean (explicitly)
Shared tuning-knob ownership is single-owned with reference notes (`MovementDampenFactor` 0.2 →
Inventory; `WorldSlowFactor` 0.85x → GSM; `TutorialCalloutVisibilityRange` merged to one knob).
Fall-damage formula consistent across Physics/Movement/Health; dodge i-frame windows (0.25s)
consistent across Movement/Health/Combat; detection thresholds 25/50/75/100 reconciled
Stealth ↔ Alien AI; `weapon_slot_count` (2) and Drone combat stats consistent Combat ↔ Alien AI;
crafting weight example uses the correct 50 kg `max_weight_base`.

---

## Game Design Issues

All four blocking design issues trace to **one root cause: an unspecified,
Chemicals-bottlenecked resource economy.**

### Blocking

**🔴 D-1 — Stealth strictly dominates Combat; combat is never a real choice.**
Stealth has no resource cost (only regenerating stamina). Combat consumes finite ammo (no vendor,
no crafting faucet) and unregenerating health. The optimal answer is always "avoid combat." This
is intended per the anti-power-fantasy pillar, but nothing ever forces or rewards combat enough to
make the choice meaningful — Silent Takedown is cut, throw/distract tools are open questions.
A choice with one always-correct answer has no weight, violating Pillar 3. Recommend a deliberate
"stealth tax" in some encounters (timed objectives, unavoidable defenses).

**🔴 D-2 — Infection is an unbounded, time-accelerating faucet with no natural decay.**
Hives spawn new hives in level-100 cells; `W_time = 1 + minutes/60` makes spawns accelerate over
a session; infection never decays naturally (Infection Rule 2). The only sinks are source
destruction (a 500-HP combat encounter needing the dominated combat loop + ammo) and cures
(temporary 300s, scarce). A pure-stealth player — the dominant playstyle — has no economical way
to reduce infection. Confirm whether this is intended fail-state pacing or an unwinnable spiral;
either give a renewable counter, cap the time-scaling, or make the "get out before it's too late"
timer explicit and pillar-consistent.

**🔴 D-3 — Chemicals are a single-resource monopoly bottleneck.**
Chemicals gate *both* the only infection sink (Cure Device: 2 Chemicals) *and* the dominant heal
(Stimshot: 1 Chemical). The Cure ↔ Stimshot competition for Chemicals is the single most important
economic tension in the game, and *all* spawn/faucet rates are undefined (crafting OQ-3). Whoever
tunes Chemical spawns effectively sets the entire difficulty curve. Highest-leverage open balance
question in the project.

**🔴 D-4 — Up-scaling difficulty vs. flat-by-design player power, with no difficulty spec.**
Player power is intentionally flat (no stat growth; Health/Stamina/Investigation all "no upgrades").
Two escalators compound: infection scales with time (D-2), and aliens scale with infection
(Alien AI Rule 10: at I_zone=100, +30% speed, +40% perception, −30% aggression threshold,
−20% cooldowns, +50% alert propagation). The only counter-scaling is the scarce economy of D-2/D-3.
The curves are directionally incompatible with a flat-power player unless the economy is tuned to
let skill keep pace. No difficulty-curve spec exists (infection OQ-7 deferred). Write it.

### Warnings

- **⚠️ D-5 — Support loop out-competes the dominant loop.** Story/Investigation is the declared
  primary aesthetic but is mechanically the leanest (no unlocks, no scaling), while the *support*
  Faction loop is the richest progression system (7 tiers, ripple matrix, desperation amplifier,
  trade discounts, allies, shelters). Risk: players optimize Factions and treat the story as
  secondary. Strengthen the dominant loop's mechanical hook or deliberately subordinate Factions.
- **⚠️ D-6 — Attention budget at ceiling.** Concurrent ACTIVE systems during traversal = 4
  (Movement, Stealth, Health-triage, Infection-pressure), rising to 5 in combat. Modal systems
  (Dialogue/Inventory/Crafting/Map/Investigation) correctly suspend traversal. Add no further
  always-on active system.
- **⚠️ D-7 — Stimshot dominates the healing tier.** Stimshot (+40) is usable while moving and is
  *not* interrupted by damage; Field Dressing (+25) and Medkit (+60) are both interruptible and
  thus useless mid-combat. Rarity is the only balancing lever, which couples back to D-3.
- **⚠️ D-8 — Faction faucet >> sink; safe-haven power vs. anti-pillar.** Many positive sources,
  weak decay (−2/day after 7 days idle), weak Rival ripple brake → possible dual-Allied,
  collapsing "every alliance has a cost." Faction power (AI allies, safe shelters, 30% trade
  discounts) is the one vector that makes the world feel *safe*, edging toward the power-fantasy
  anti-pillar. Faction GDD also over-claims Pillar 2 (mechanics serve P1/P3; the P2 link is
  narrative aspiration).
- **⚠️ D-9 — Injury death-spiral.** Critical/Near-Death make the player slower, louder, worse at
  dodging, and worse at fleeing, with no regen — damage makes more damage more likely. Compounds
  dangerously with D-4's up-scaling. (Registry also flags Critical & NearDeath share P_drain
  0.15 — minor tier-escalation smell, documented.)
- **⚠️ D-10 — Single-enemy dominant options.** Shotgun point-blank (up to 540 dmg) one-shots the
  only MVP enemy (Drone HP 100); crouch-on-ice is a near-zero-detection optimal traversal path.
  Both self-limiting now; monitor as the enemy roster grows.

### Pillar alignment & fantasy coherence
No system serves zero pillars (no scope-creep). No hard anti-pillar violation — the design is
unusually disciplined about anti-power-fantasy, and immunity is established as *acquired*
(counter-agent exposure), satisfying the "not a chosen one" anti-pillar. Player fantasy is
strongly coherent across all systems (competent operator + investigator + survivor). The one
identity tension to watch is the "valued asset" fantasy (Faction power) softening the
"never safe" fantasy (D-8).

---

## Cross-System Scenario Issues

**Scenarios walked:** 6
1. Stealth-broken combat in an actively infecting zone
2. Killing a faction NPC mid-combat who is also a quest-giver / dialogue partner
3. Final clue discovered via dialogue while an alien closes to melee
4. Crafting + deploying a Cure Device; the cell re-infects under the player
5. Auto-save on zone boundary with infection ticking, a revelation pending, a deferred consequence due
6. Death + checkpoint reload after looting, sharing a clue, and shifting faction rep

### Blockers

**🔴 S-1 — Death-reload state retention is contradictory** (Health, Save/Load, Investigation,
Faction, Inventory). Inventory Edge Case: run-loot is rolled back to checkpoint. Investigation
Rule 6: discovered clues "persist permanently." A clue discovered *after* the last checkpoint and
then lost on death satisfies neither rule consistently — the checkpoint genuinely doesn't contain
it, yet Investigation promises permanence. Same ambiguity for faction rep and dialogue
relationship changes gained mid-run. No GDD owns "what survives death."

**🔴 S-2 — Faction NPC kill mid-combat → silent hostile flip** (Combat, Faction, Alien AI).
Killing an allied faction member flips surviving guards to hostile *immediately* (they join the
fight; Faction EC-7 says behavior changes apply immediately) but the *notification* defers until
combat ends. The player is shot by former allies with zero feedback explaining why — behavior
changed, UI silent. The −40 kill delta is also amplified up to ×1.5 in an infected zone.

**🔴 S-3 — NPC-kill attribution is unowned** (Combat, Alien AI, Faction, Quest, Investigation).
No GDD defines how "was this kill player-caused?" is arbitrated (last-damage-instigator? any
player damage in a window?). Faction EC-6 exempts alien/environmental kills, but combat blurs
this — if the player tags an NPC for 1 damage and an alien finishes them, does −40 apply?
Undefined, and it gates quest-failure + clue-loss. Load-bearing ambiguity with no owner.

### Warnings

- **⚠️ S-4 — Uncapped infection-driven combat compound** (Infection, Alien AI, Stealth, Combat).
  When a cell crosses to Infected mid-combat, alien speed (+30%), alien perception (+40%), and the
  player's own detection floor (`E_infection +15`, stealth decay ×0.5) all scale off the *same*
  infection value at once. No GDD caps the combined effect; disengagement (`T_disengage`) may
  become effectively impossible in a fully infected cell.
- **⚠️ S-5 — Mid-combat Data Layer swap** (Infection, Scene Mgmt, Combat, Alien AI). The infection
  tick is independent of combat; crossing level 50 triggers a `DL_Clean → DL_Infected` async swap
  (0.5–2.0s) during an active firefight — repainting nav areas, cover, and cached EQS geometry.
  Undefined combat behavior during the swap.
- **⚠️ S-6 — Cure "reversal" promise contradicted by its formula** (Crafting, Inventory,
  Infection). Infection Rule 4b says cure cells get "−8 pressure/sec … infection decreases," but
  `cure_suppressant` produces `M_cure` as a *multiplier* (0.0–1.0) that can only slow positive
  pressure, never create flat negative pressure. A single cure barely moves a weak-source cell and
  only slows a strong-source cell — breaking the player-facing promise that deploying a cure
  reverses infection.
- **⚠️ S-7 — Cure item source disagreement** (Crafting, Infection). Crafting says it is "the only
  way to produce `item_cure_device` at Vertical Slice"; Infection OQ-5 still asks whether cures are
  craftable or loot-only. If wired loot-only, Scenario 4's entire counter-play loop has no item.
- **⚠️ S-8 — Quest NPC-death triple-fire with conflicting notification policies** (Quest,
  Investigation, Faction). One death fires quest-fail (visible), clue-Lost (silent — "the death is
  the notification"), and faction-delta (deferred). The player cannot reconstruct what their stray
  shot cost.
- **⚠️ S-9 — Save payload gaps** (Save/Load, Dialogue, Investigation, Infection). Save/Load Rule 3
  payload omits **Dialogue relationship state entirely** (NPC Trust/Fear/Knowledge, conversation
  memory, promise flags), plus Investigation pending-revelation, and Infection cure timers /
  hive-emergence progress. Systems specify richer save data than the payload captures.
- **⚠️ S-10 — Deferred consequence vs. checkpoint ordering** (Quest, Save/Load). No defined
  ordering between a checkpoint snapshot and a deferred consequence becoming due in the same window
  → captured-as-pending-after-firing (double-fire on reload) or fired-before-actually (lost).

### Info
- ℹ️ Per-cell vs. zone-aggregate infection for AI scaling (Alien AI OQ-8) — same encounter differs
  drastically by which contract is wired.
- ℹ️ Revelation can never deliver if the player chains combat→stealth in an infected zone
  (detection floor keeps it pending; intentional but under-anticipated).
- ℹ️ Immunity-reveal one-time flag scope (checkpoint vs. sticky) undefined on death reload.
- ℹ️ "Key investigation event" auto-save vs. death rollback → inconsistent clue retention
  (Save/Load OQ-2 unresolved).
- ℹ️ Three time models (pause / fast-travel / save-quit-reload) individually specified, never
  reconciled. Dying rolls back world infection, lightly undercutting "the world doesn't wait."
- ℹ️ Kill-quest reward vs. faction penalty for the same NPC death — reward conflict by design.
- ℹ️ Clue Knowledge-bump vs. dialogue melee-interrupt in a contested frame — ordering undefined.

---

## GDDs Flagged for Revision

| GDD | Reason | Type | Priority |
|-----|--------|------|----------|
| systems-index.md | Quest dep omits Faction; Save/Load/Crafting/Map status drift; inverted Dialogue dep; "no cycles" wrong | Consistency | Blocking |
| dialogue-system.md | Testimony detection-threshold conflict (silent clue loss); stale Camera OTS note | Consistency | Blocking |
| investigation-system.md | Testimony threshold conflict; internal cross-ref inconsistency | Consistency | Blocking |
| save-load-system.md | Death-reload retention contract; payload gaps (Dialogue/revelation/cure timers); stale OQ-4 | Scenario | Blocking |
| combat-system.md | NPC-kill attribution; Stealth dominance; missing Faction/Infection back-refs | Design + Scenario | Blocking |
| faction-reputation-system.md | Silent hostile flip; faucet>>sink; safe-haven power; ÷100 unit bug; P2 over-claim | Design + Scenario | Blocking |
| crafting-system.md | Chemicals economy untuned (OQ-3); cure source disagreement (OQ-5) | Design + Scenario | Blocking |
| infection-spread-system.md | Unbounded faucet; cure reversal formula mismatch; up-scaling difficulty; no difficulty spec | Design + Scenario | Blocking |
| alien-ai-system.md | Up-scaling vs flat power; wrong interface owner (Rule 10); per-cell/zone OQ-8 | Design + Consistency | Blocking |
| quest-system.md | Faction dependency under-recorded; deferred-consequence vs save ordering | Consistency + Scenario | Blocking |
| health-system.md | Stimshot dominance; injury death-spiral; Critical/NearDeath drain parity; death double-fire | Design + Consistency | Warning |
| player-controller.md | Death double-fire; IMC_Stealth threshold default | Consistency | Warning |
| hud-system.md | Summary vs Rule 1 mode-change contradiction; Tutorial back-ref | Consistency | Warning |
| game-state-machine.md | Tutorial back-reference unpatched | Consistency | Warning |
| stealth-system.md | Stale "(Not Started)" cross-ref tags; meters/cm conversion only in prose | Consistency | Warning |
| movement-system.md | Noise-unit conversion contract; injury formula references | Consistency | Warning |

---

## Verdict: **FAIL**

10 blocking issues must be resolved before architecture begins. They collapse into four root
causes:

1. **systems-index drift** (C-1) — a quick, mechanical fix.
2. **The unspecified Chemicals-bottlenecked economy** (D-1, D-2, D-3, D-4, S-6, S-7) — the central
   design risk. Requires a tuning pass + a written difficulty-curve spec that makes combat a real
   choice, gives a renewable infection counter, and lets flat-power skill keep pace.
3. **Two unowned cross-cutting contracts** — NPC-kill attribution cascade (S-2, S-3, S-8) and
   death/checkpoint rollback scope (S-1, S-9, and Info items) — each needs a single owning GDD.
4. **The Dialogue ↔ Investigation detection-threshold conflict** (C-2) — pick one threshold for
   testimony delivery.

### Required actions before re-running
- **systems-index.md:** correct Quest's dependencies (add Faction Reputation), fix Save/Load /
  Crafting / Map status + Design Doc columns, fix the inverted Dialogue→Quest edge, and remove the
  "no circular dependencies" claim.
- **Economy:** define Scrap/Fabric/Chemical spawn/faucet rates (crafting OQ-3); resolve Cure
  source (loot vs. craft, infection OQ-5); reconcile Cure Rule 4b prose with the `M_cure` formula;
  write the deferred difficulty-curve spec (infection OQ-7); decide whether/how combat is ever
  forced or rewarded vs. dominant stealth.
- **Contracts:** assign an owner + rule for NPC-kill attribution during combat (Combat or Faction),
  including the fan-out to Quest/Investigation and the notification policy for mid-combat hostility;
  define the authoritative death/checkpoint rollback scope (Save/Load) and expand the Rule 3 payload
  to include Dialogue relationship state, pending revelation, cure timers, and hive-emergence.
- **Thresholds:** reconcile the Dialogue (≥50) and Investigation (<25) detection gates for testimony
  delivery so the `[CLUE]` path cannot silently fail.

After these are resolved, re-run `/review-all-gdds` (or `/review-all-gdds focus:since-last-review`),
then proceed to `/create-architecture`.
