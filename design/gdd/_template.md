# [System Name]

> **Status**: Draft
> **Author**: [author]
> **Last Updated**: [date]
> **Implements Pillar**: [Pillar N: Name]

## Overview

[One-paragraph summary of what this system does, why it exists, and what breaks without it.]

## Player Fantasy

> *Describe the intended feeling and experience. What does the player feel — not what the system does.*

[Player fantasy content here.]

---
## ⛔ GATE: Adversarial Fantasy Check

**STOP. Do not write Core Rules until this gate passes.**

Run a single adversarial check on the Player Fantasy above:
- Does this fantasy hold under the game's core survival tension?
- Is it achievable with existing confirmed systems?
- Does it contradict any accepted ADR or other GDD?

If the fantasy fails: pause the GDD, fix the fantasy, re-check. Do not continue.
If the fantasy passes: proceed to Core Rules.

---

## Detailed Design

### Core Rules

[Numbered rules. Each rule must be unambiguous — no "the system should feel good".]

**Rule 1 — [Name]**
[Rule content.]

**Rule 2 — [Name]**
[Rule content.]

---

### States and Transitions

[State machine definition. List all valid states and the transitions between them.]

| State | Entry Condition | Exit Condition | Notes |
|---|---|---|---|
| [STATE] | [when entered] | [when exited] | |

---
## ⛔ GATE: Core Rules Adversarial Check

**STOP. Do not write Formulas or Edge Cases until this gate passes.**

Run a targeted adversarial check on the Core Rules and States above:
- Do these rules produce the Player Fantasy as written?
- Are there activation/deactivation contradictions?
- Do the states cover all required transitions without gaps?

Maximum 1 revision pass. If it fails twice, stop and escalate to design review.
If it passes: proceed to Formulas.

---

### Interactions with Other Systems

[How this system talks to other systems. List each system and the nature of the interaction.]

## Formulas

[All math defined with variables, expected value ranges, and example calculations.]

**Formula 1 — [Name]**

```
[formula]
```

Variables:
- `[var]` — [definition], range [min–max]

Example: [worked example]

## Edge Cases

[Unusual situations handled explicitly. State what happens — not "handle gracefully".]

- **[Condition]:** [Exact behavior.]

## Dependencies

### Hard Dependencies

[Systems that must exist and be functional for this system to work at all.]

- `[SystemName]` — [why needed]

### Soft Dependencies

[Systems that enhance this system but are not required for baseline function.]

- `[SystemName]` — [what degrades without it]

### Dependents

[Systems that depend on this system.]

- `[SystemName]` — [what it uses from this system]

### Cross-System Consistency Flags

[Known constraints imposed by or on other GDDs.]

- [Flag description]

## Tuning Knobs

[Configurable values with safe ranges and gameplay impact.]

| Knob | Default | Safe Range | Affects |
|---|---|---|---|
| `[KnobName]` | [value] | [min–max] | [gameplay aspect] |

## Visual/Audio Requirements

### Visual Requirements

- [Requirement]

### Audio Requirements

- [Requirement]

## UI Requirements

[All UI elements this system requires. Reference existing patterns where possible.]

- [Requirement]

## Acceptance Criteria

[Testable conditions. A QA tester must be able to verify pass/fail for each.]

**GIVEN** [precondition], **WHEN** [action], **THEN** [expected outcome].

## Open Questions

[Unresolved design questions. Each must be owned and have a resolution deadline.]

- [ ] [Question] — Owner: [name], Deadline: [date]
