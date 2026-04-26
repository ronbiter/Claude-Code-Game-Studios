---
description: "Analyze sprint or feature for scope creep — flags additions, quantifies bloat, recommends cuts"
---

# Scope Check

Analyze current project scope against original plan.

## Step 1: Find Original Scope

Check for scope-defining documents:
- `design/gdd/game-concept.md` — MVP definition
- `production/sprints/` — first sprint's commitments

Read the MVP definition and scope tiers.

## Step 2: Assess Current Scope

List what's been added:
- New features in `design/gdd/`
- New systems in `src/`
- Any feature flags or configs

## Step 3: Identify Scope Creep

Compare against original scope:

### Additions
- What's been added beyond MVP?
- Who requested each addition?

### Bloat
- Any feature that's grown beyond original intent?
- Any system with unnecessary complexity?

### Potential Cuts
- What's in the scope but not essential?
- What's taking more time than planned?

## Step 4: Present Findings

```
## Scope Analysis

### Original MVP
[what was planned]

### Additions Beyond MVP
- [addition 1] — requested by [who]
- [addition 2]

### Areas of Bloat
- [feature] — [how it grew]

### Recommended Cuts
- [item] — [rationale for cutting]

### Verdict
ON TRACK / SCOPE CREEP / NEEDS ATTENTION
```

---

Reference: See .agents/skills/scope-check/SKILL.md