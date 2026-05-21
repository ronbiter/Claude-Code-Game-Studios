# Review Log: Combat System

## Review — 2026-05-20 (Re-review ×2 + Revision) — Verdict: IN REVIEW (Revised ×2 — re-review required)

Scope signal: XL
Specialists: game-designer, systems-designer, qa-lead, unreal-specialist, gameplay-programmer, audio-director, creative-director
Blocking items resolved: 12 | Recommended resolved: 8
Prior verdict resolved: No — 18 prior blockers were resolved, but 12 new blockers found in this review.

Summary: 12 blockers in this pass, all resolved in same session. CD verdict: MAJOR REVISION NEEDED (second consecutive). Blockers were primarily contradictions (cheaper than prior omissions): (1) Weapon condition schema redesigned — IsDirty bool + ConditionTier enum replacing single M_condition float, enabling the dirty+damaged compound state; (2) Formula 3 vs Rule 5 vs AC 3-way timer contradiction resolved — rule text and ACs updated to reference Formula 3 (7.0s min confirmed as design intent); (3) Reload reserve underflow guarded with min() clamp + new AC added; (4) TakeDamage() signature corrected throughout (FPointDamageEvent passed as DamageEvent arg, not first); (5) IMC delegation pattern specified — Combat System calls PC->PushCombatIMC()/PopCombatIMC() to reach UEnhancedInputLocalPlayerSubsystem; (6) Melee stun-lock closed — hit stun reduced 0.3s→0.15s so alien re-attacks before player can re-swing; (7) Panic survivable exit added — point-blank exemption (≤150cm) preserves shotgun/melee as escape options when both panic conditions active; (8) Alien-kill ambient contradiction resolved — mixing table is authoritative, event-table "resumes full intensity" note removed; (9) Formula 1 output range corrected to per-pellet (810 headshot max documented); (10) Backup-call suppression during Disengaging state added as explicit rule; (11) Melee counter data model specified (TMap<AlienID, HitCount>, A→B→A resets to 0); (12) Rifle burst mode clarified — always burst, new trigger press per burst, no hold-to-repeat. AC #11/#12 rewritten to fix cover-state ambiguity; AC #15 corrected (swing initiation, not connection, triggers combat); AC #28 rewritten with timing constraint. Audio additions: ambient Disengaging fade duration (3.0s), panic de-escalation spec (3.0s fade), low-ammo cue semantics (single threshold-crossing event), backup-responder alien audio, "No Ammo"/"Too Exhausted" audio specs for Immersive Mode. N_consecutive specified as ring buffer. Requires a fresh /design-review session before verdict can advance to Approved.

---

## Review — 2026-05-20 (Re-review + Revision) — Verdict: IN REVIEW (Revised — re-review required)

Scope signal: XL
Specialists: game-designer, systems-designer, qa-lead, unreal-specialist, gameplay-programmer, audio-director, creative-director
Blocking items resolved: 18 (12 carried + 6 new) | Recommended resolved: 8
Prior verdict resolved: No — document was unrevised since first review. All revisions applied in this session.

Summary: All 18 blocking items addressed in one revision pass. Priority fixes: (1) Shotgun D_base clarified to 60 per-pellet — "(all pellets)" annotation removed; (2) Panic mechanic (OQ-4) promoted from Open Question to Rule 7 + Formula 4 (HP≤30%: +1.5° spread; alien ≤300cm: +1.0°); (3) Rule 8 (Call for Backup) added with 2s LOS threshold and rifle noise propagation tie-in; (4) Rifle given three differentiation costs — loud (2500cm noise radius), heavy spread climb (+0.6°/shot), scarce ammo (5-8 finds); (5) IMC_Combat ownership explicitly assigned to Combat System only — PC language removed; (6) IMC push threshold corrected to detection=100 throughout; (7) TakeDamage signature corrected to FPointDamageEvent; (8) LOS query APIs added to Alien AI interface (OnAlienLOSLost/Regained); (9) Formula 2 rewritten — dead S_movement/S_stance terms removed, weapon-specific S_per_shot added, M_panic added, max(0) clamp added; (10) Reload-cancel rule replaced with proportional formula + reserve refund; (11) Ambient duck Active Combat corrected to -6dB (CD ruling); (12) Alien kill audio "silence" removed and replaced with ambient return. State machine gained two missing formal transitions. 10 new ACs added. GetSurfaceTypeAtLocation removed (read from hitscan FHitResult directly). Requires a fresh /design-review session before verdict can advance to Approved.

---

## Review — 2026-05-20 — Verdict: MAJOR REVISION NEEDED

Scope signal: XL
Specialists: game-designer, systems-designer, ai-programmer, qa-lead, gameplay-programmer, ux-designer, audio-director, unreal-specialist, creative-director
Blocking items: 12 | Recommended: 12
Prior verdict resolved: No — first review

Summary: The combat system's lethality design (weapons, damage formula, spread, disengagement) is thorough and well-structured. However, the document omits the player-side damage model entirely — no player HP, alien DPS budget, or time-to-down — making the "desperation survival" pillar unvalidatable. Three ambiguities fork the implementation: (1) shotgun D_base "60 (all pellets)" conflicts with formulas and ACs treating 60 as per-pellet (9× damage difference); (2) IMC_Combat push threshold is 75 in Rule 5 and 100 in Acceptance Criteria, with CD decision that 100 is correct and music must NOT telegraph pre-attack; (3) IMC ownership is split between Player Controller and Combat System, which will softlock input on double-remove in UE5. Additional blockers: per-alien LOS API required for disengagement does not exist in any GDD; Formula 2 has dead variables that double-count movement penalty; `TakeDamage(EDamageType.Physical)` is not a valid UE5 signature; reload-cancel AC contradicts the partial-fill rule; state machine is missing two transitions; "call for backup" appears in Player Fantasy with no mechanic. Creative Director promoted OQ-4 (panic mechanic) to design intent and resolved ambient duck to ~-6dB (not -12dB) to preserve world presence in combat.
