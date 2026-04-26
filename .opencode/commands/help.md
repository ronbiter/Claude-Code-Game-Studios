---
description: "Analyzes what is done and offers advice on what to do next"
---

# What Do I Do Next?

This figures out exactly where you are in the game development pipeline.

## Step 1: Read Catalog

Read `.agents/docs/workflow-catalog.yaml` — the authoritative list of all phases and steps.

## Step 2: Determine Phase

Check in this order:

1. **Read `production/stage.txt`** — if exists, use its value
2. **Infer from artifacts** (most-advanced match wins):
   - `production/stories/*.md` exists → Pre-Production
   - `docs/architecture/adr-*.md` exists → Technical Setup
   - `design/gdd/systems-index.md` exists → Systems Design
   - `design/gdd/game-concept.md` exists → Concept
   - Nothing → Concept (fresh)

## Step 3: Check In-Progress Work

If `production/session-state/active.md` exists, check for active tasks.

## Step 4: Determine Next Steps

For each step in the current phase:

- Check if required artifacts exist
- First incomplete required step = what user must do next

## Step 5: Present Output

Keep it short:

```
## Where You Are: [Phase]

### ✓ Done
- [completed step]
- [completed step]

### → Next up (REQUIRED)
**[Step name]**
Command: /[command]

### ~ Also available (OPTIONAL)
- [Step] → /[command]
```

---

Reference: See .agents/skills/help/SKILL.md
