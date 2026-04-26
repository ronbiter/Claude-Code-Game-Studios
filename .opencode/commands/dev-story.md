---
description: "Read a story file and implement it with full context, route to correct programmer agent"
argument-hint: "[story-path]"
---

# Dev Story

Implement a story from start to finish.

## Step 1: Find the Story

If path provided → read it.
If not → check active.md or list in-progress stories.

## Step 2: Load Full Context

Read these files:

- Story file (TR-ID, ADR, Acceptance Criteria, Implementation Notes)
- TR registry (docs/architecture/tr-registry.yaml) — get requirement text
- Governing ADR — get decision and implementation guidelines
- Control manifest (docs/architecture/control-manifest.md) — get layer rules
- Engine reference (.agents/docs/technical-preferences.md) — get engine

## Step 3: Validate Dependencies

Check each dependency story's status:

- Must be Complete before proceeding
- If blocked → STOP

## Step 4: Route to Programmer

Based on story's Layer + Type:

| If Layer              | Use Agent           |
| --------------------- | ------------------- |
| Foundation            | engine-programmer   |
| UI                    | ui-programmer       |
| Core/Feature gameplay | gameplay-programmer |
| AI/behavior           | ai-programmer       |
| Network               | network-programmer  |

**Spawn the programmer agent** with full context:

1. Story file content
2. GDD requirement text (from TR registry)
3. ADR Decision + Implementation Guidelines
4. Control manifest rules
5. Engine naming conventions
6. Test file path to create
7. Instruction: implement story + write test

## Step 5: Verify Implementation

When implementation is done:

1. Verify test passes
2. Check acceptance criteria met
3. Run /code-review on implementation

## Step 6: Close Story

After verification:

1. Mark story Status: Complete
2. Surface next ready story

---

Reference: See .agents/skills/dev-story/SKILL.md
