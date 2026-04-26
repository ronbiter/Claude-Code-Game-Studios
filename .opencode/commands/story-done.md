---
description: "Verify story implementation, check acceptance criteria, update status to Complete"
argument-hint: "[story-path]"
---

# Story Done

Close the loop between design and implementation.

## Step 1: Find the Story

If path provided, use it.
If not found, check active.md or list in-progress stories.

## Step 2: Read Story Context

Read:
- Story file for acceptance criteria
- Implementation files created
- Test files created
- Any ADR references

## Step 3: Verify Acceptance Criteria

For each acceptance criterion:
- Check if implementation exists
- Check if tests pass
- Note any deviations from GDD requirements

## Step 4: Code Review

Check implementation files against:
- Control manifest rules
- Coding standards
- ADR guidelines

## Step 5: Update Status

```
## Story Done: [story-name]

### Acceptance Criteria
- [✓] [criterion 1]
- [ ] [criterion 2]

### Code Review
[findings]

### Verdict
[COMPLETE / NEEDS WORK]
```

Update the story file Status to Complete. Surface the next ready story.

---

Reference: See .agents/skills/story-done/SKILL.md