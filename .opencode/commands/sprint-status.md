---
description: "Fast sprint status check — progress snapshot with burndown"
---

# Sprint Status

Quick snapshot of the current sprint progress.

## Step 1: Read Current Sprint

Find active sprint:

- List files in `production/sprints/`
- Read latest sprint plan

## Step 2: Check Story Status

For each story in the sprint:

- Read status from `production/stories/` files
- Count: in-progress, ready, done, blocked

## Step 3: Calculate Burndown

```
Total points: [X]
Completed: [Y]
Remaining: [Z]
```

## Step 4: Identify Blockers

Check for blocked stories:

- Note the blocker reason

## Step 5: Present Output

```
## Sprint: [Name]
## [Start] → [End]

### Progress
✓ Done: [N] stories
→ In Progress: [N] stories
⏳ Ready: [N] stories
🚫 Blocked: [N] stories

### Burndown
[X]/[Y] points completed

### Blockers
[blocked stories, if any]

### Next Up
[next ready story]
```

---

Reference: See .agents/skills/sprint-status/SKILL.md
