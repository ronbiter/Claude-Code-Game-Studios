---
description: "Validate readiness to advance between development phases"
---

# Gate Check

Validate readiness to move between phases.

## Step 1: Determine Current Phase

Read `production/stage.txt` to get current phase.

## Step 2: Identify Gate

Determine which gate the user is approaching:

| From | To | Gate |
|------|-----|------|
| Concept | Systems Design | C→SD |
| Systems Design | Technical Setup | SD→TS |
| Technical Setup | Pre-Production | TS→PP |
| Pre-Production | Production | PP→P |
| Production | Polish | P→Po |
| Polish | Release | Po→R |

## Step 3: Check Requirements

For each gate, check required artifacts:

**C→SD (Concept → Systems Design)**
- [ ] game-concept.md exists
- [ ] game-pillars.md exists

**SD→TS (Systems Design → Technical Setup)**
- [ ] systems-index.md exists
- [ ] All MVP system GDDs written

**TS→PP (Technical Setup → Pre-Production)**
- [ ] Engine configured in CLAUDE.md
- [ ] ADRs written for key decisions

**PP→P (Pre-Production → Production)**
- [ ] At least one epic created
- [ ] Stories broken from epics
- [ ] First sprint planned

**P→Po (Production → Polish)**
- [ ] MVP complete (all T1 stories done)
- [ ] No critical bugs

**Po→R (Polish → Release)**
- [ ] All bugs resolved
- [ ] Playtest passed
- [ ] Release checklist complete

## Step 4: Present Verdict

```
## Gate: [From] → [To]

### Requirements
- [ ] [requirement 1]
- [✓] [requirement 2]

### Missing
- [missing items]

### Verdict
PASS / CONCERNS / FAIL
```

---

Reference: See .agents/skills/gate-check/SKILL.md