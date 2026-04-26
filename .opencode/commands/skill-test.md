---
description: "Validate skill files for structural compliance and behavioral correctness"
agent: explore
---

# Skill Test

Validate skill files for compliance.

## Step 1: Identify Skills to Test

The user should specify which skill to test. If not specified, ask:

**Prompt**: "Which skill would you like to test?"

Options: List skills from `.agents/skills/*/SKILL.md`

## Step 2: Run Static Checks

For the selected skill, read and check:

### Frontmatter Required Fields
- `name:` — matches filename
- `description:` — present
- `user-invocable:` — true/false
- `allowed-tools:` — list

### Content Structure
- Has clear steps or phases
- Uses question tool at decision points
- Has clear output (file write or verdict)

## Step 3: Run Spec Checks

Check against skill behavior:
- Does it match its description?
- Are the steps executable?
- Are the outputs clear?

## Step 4: Present Findings

```
## Skill Test: [skill-name]

### Static
✓ PASS / ✗ FAIL
- [issues]

### Spec
✓ PASS / ✗ FAIL
- [issues]

### Verdict
PASS / NEEDS WORK / FAIL

### Recommendations
- [fixes needed]
```

---

Reference: See .agents/skills/skill-test/SKILL.md