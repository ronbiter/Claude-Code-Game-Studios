---
description: "Lightweight design spec for small changes — tuning, minor mechanics, balance tweaks"
argument-hint: "[system or area]"
---

# Quick Design

Lightweight design spec for small changes.

## Step 1: Identify the Change

Ask user: "What would you like to adjust?"

Common types:
- Tuning (damage values, speeds)
- Minor mechanics (new interaction)
- Balance tweaks (costs, rewards)

## Step 2: Document the Change

For the change, document:

### Current State
What is the current behavior/config?

### Desired Change
What should be different?

### Implementation Notes
- Which file needs changing?
- What values/formulas to adjust?

### Testing Considerations
- How to verify the change works?
- Edge cases to check?

## Step 3: Write Quick Design

```markdown
# Quick Design: [Change Name]

## Type
[Tuning / Minor Mechanic / Balance]

## Current State
[describe current]

## Desired Change
[describe desired]

## Implementation
- File: [path]
- Changes: [specifics]

## Testing
- [test case 1]
- [test case 2]
```

Write to `production/quick-designs/qd-[date]-[name].md`

---

Reference: See .agents/skills/quick-design/SKILL.md