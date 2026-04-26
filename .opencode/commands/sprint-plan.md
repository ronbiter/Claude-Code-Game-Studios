---
description: "Generate a new sprint plan or update existing one based on milestone and capacity"
---

# Sprint Plan

Generate or update a sprint plan.

## Step 1: Determine Context

Check existing state:
- Read `production/stage.txt` for current stage
- Check `production/sprint-status.yaml` for active sprint
- List stories in `production/stories/` with status

## Step 2: Ask for Sprint Type

**Prompt**: "What would you like to do?"

**Options**:
- New sprint — Plan a new sprint
- Update — Update the current sprint
- Check status — See how the current sprint is going

## Step 3: If "New Sprint"

### 3a. Set Sprint Scope
- How many weeks? (1 week / 2 weeks / 4 weeks)
- What's the capacity? (solo / small team)

### 3b. Select Stories
List ready-for-dev stories from `production/stories/`

Ask user to select which stories to include:

**Prompt**: "Which stories should be in this sprint?"

Options: List stories with their GDD requirements

### 3c. Estimate
For each selected story:
- Break down into tasks
- Estimate complexity (XS/S/M/L/XL)

### 3d. Write Sprint Plan

```markdown
# Sprint Plan: [Name]

## Duration
[Start] - [End]

## Goal
[What this sprint aims to achieve]

## Commitments
| Story | Estimate | Notes |
|-------|----------|-------|
| [name] | [est] | [notes] |

## Capacity
[total points available]

## Burndown
- Total: [X] points
- Committed: [Y] points
- Remaining: [Z] points
```

Write to `production/sprints/sprint-[name].md`

---

Reference: See .agents/skills/sprint-plan/SKILL.md