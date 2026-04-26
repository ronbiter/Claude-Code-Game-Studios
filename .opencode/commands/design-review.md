---
description: "Reviews a game design document for completeness, consistency, implementability"
agent: explore
---

# Design Review

Review a GDD for completeness and quality.

## Step 1: Select GDD

List available GDDs in `design/gdd/`

Ask user: "Which GDD would you like to review?" with options.

Note: `/design-review` is for reviewing DESIGN docs. For code reviews, use `/code-review`.

## Step 2: Review Sections

Read the GDD and check each required section:

### Required Sections
1. **System Overview** — What is this system?
2. **Core Mechanics** — Actions and rules
3. **Player Experience** — The "feel" and "juice"
4. **Progression & Depth** — Evolution over time
5. **Systems Integration** — Connections to other systems
6. **Balance & Numbers** — Formulas and scaling
7. **Edge Cases** — Failure modes and recovery
8. **Future Considerations** — What's deferred

## Step 3: Quality Checks

### Completeness
- Are all 8 sections present?
- Are sections substantive or placeholder?

### Consistency
- Does this align with game-concept.md pillars?
- Are the mechanics achievable in scope?
- Do numbers/formulas make sense?

### Implementability
- Is this too vague to implement?
- Are there hidden assumptions?
- Are acceptance criteria clear?

## Step 4: Present Findings

```
## Review: [GDD Name]

### Completeness
✓ Sections present: [N]/8
- [missing sections]

### Consistency
- [issues with pillars/mechanics]

### Implementability
- [vague areas]
- [hidden assumptions]

### Verdict
PASS / NEEDS WORK / MAJOR REVISION NEEDED
```

Ask user: "May I write the review findings as a comment in the GDD?"

---

Reference: See .agents/skills/design-review/SKILL.md