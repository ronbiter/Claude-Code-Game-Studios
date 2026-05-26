---
name: ux-design-team
description: "Autonomous UX design pipeline. Spawns a ux-lead orchestrator that reads all project context, makes design decisions from GDD requirements and pillars, and produces complete UX specs with minimal interruption. Use instead of /ux-design when you want batch or uninterrupted spec authoring."
argument-hint: "[screen-name | hud | all | list]"
user-invocable: true
model: opus
allowed-tools: Read, Glob, Grep, Write, Edit, Task, AskUserQuestion, TodoWrite
---

When this skill is invoked, run the autonomous UX design pipeline via the `ux-lead` orchestrator.

---

## Step 0: Understand the Mode Difference

This skill exists because `/ux-design` is interactive — it asks questions at every section. This skill is autonomous — the team reads all context first, resolves decisions from GDDs and game pillars, and delivers completed specs. The user is consulted at most once per session for batched creative decisions.

---

## Step 1: Resolve Target

**If an argument was passed:**
- `hud` → target is `design/ux/hud.md` using the `hud-design.md` template
- `all` → proceed to Step 1b to identify all screens
- `list` → list all screens that have documented UI Requirements and stop — do not design anything
- Any other value → treat as screen name, kebab-case normalize (e.g., "Pause Menu" → `pause-menu`)

**If no argument was passed**, ask once:

> "What are we designing?"
> - Options: "Name a specific screen", "The HUD", "All screens (batch)", "List screens first"

### Step 1b: Identify All Screens ("all" mode)

Read `design/gdd/systems-index.md` if it exists. Then grep all GDDs in `design/gdd/*.md` for `## UI Requirements` sections. Build the full list of screens with documented requirements.

Present the list and ask:
> "Found [N] screens with UI requirements: [list]. Design all, or pick a subset?"

---

## Step 2: Check Existing Specs

For each target screen, check if `design/ux/[screen-name].md` already exists.

- **Exists with real content** → retrofit mode: fill placeholder sections only, preserve existing content
- **Does not exist** → fresh authoring mode

---

## Step 3: Spawn Context Analysts (parallel)

For each target screen, spawn a `ux-context-analyst` subagent in parallel:

```
Task(
  subagent_type: "ux-context-analyst",
  prompt: "Research context for the '[screen-name]' screen in the Hostile World game project.

  Check all GDDs in design/gdd/*.md for UI Requirements that reference this screen or its category.
  
  Also read:
  - design/player-journey.md (player state + journey phases)
  - design/ux/interaction-patterns.md (existing patterns to reuse)
  - design/ux/accessibility-requirements.md (committed accessibility tier)
  - .claude/docs/technical-preferences.md (input methods, platform targets)
  - design/gdd/game-concept.md (pillars, comparable titles, target audience)
  - docs/registry/adr-index.yaml (architecture constraints on UI)
  - Glob design/ux/*.md (related screens already specced)
  
  Return the full structured brief as defined in your instructions."
)
```

While analysts run, also read in parallel:
- `design/gdd/game-concept.md`
- `.claude/docs/technical-preferences.md`
- `design/ux/interaction-patterns.md` (if exists)

---

## Step 4: Identify Genuine Decision Points

Review all analyst briefs. For each screen, ask: can this decision be resolved from the GDD, pillars, comparable titles, or UX best practices for PC survival action games?

**If yes — resolve it yourself. Do not ask the user.**

Escalate to the user only for decisions that are ALL THREE of:
1. Not answerable from any project document
2. Not answerable by genre convention (Dying Light / Witcher 3 / Horizon comparable)
3. Would materially change the spec if answered differently

Batch ALL escalated questions across ALL screens into a **single `AskUserQuestion` call** — maximum 4 questions total. If no genuine ambiguities exist, skip this step entirely and proceed directly to Step 5.

---

## Step 5: Write Specs

For each target screen, spawn a `ux-spec-writer` subagent:

```
Task(
  subagent_type: "ux-spec-writer",
  prompt: "Write a complete UX spec for the '[screen-name]' screen.

  Output file: design/ux/[screen-name].md
  Template: .claude/docs/templates/ux-spec.md  (or hud-design.md for the HUD)

  CONTEXT BRIEF:
  [paste full analyst brief here]

  PRE-RESOLVED DESIGN DECISIONS:
  [list every decision made in Step 4, with reasoning]

  USER ANSWERS:
  [paste answers from Step 4 AskUserQuestion, or 'No user questions asked']

  Write every section of the template. Do not ask questions. Make all remaining micro-decisions using your defaults and the context brief. Write each section to file immediately after drafting it."
)
```

**Sequencing rule for linked screens:**
- Screens that share navigation (e.g., pause-menu and settings) must be sequenced — write the parent first so exit points are defined before the child's entry points are written
- Unrelated screens can run in parallel

---

## Step 6: Review (parallel)

After all specs are written, run `/ux-review` on each spec file in parallel.

Collect all verdicts. If any spec has NEEDS REVISION findings, address them by spawning the `ux-spec-writer` again with the specific review findings — do not ask the user for fix direction. Fix and report.

---

## Step 7: Session Report

Present a single consolidated report to the user:

```
UX Design Team — Session Complete
══════════════════════════════════

Screens designed: [N]

| Screen          | File                        | Review      | Open Questions |
|-----------------|-----------------------------|-------------|----------------|
| [name]          | design/ux/[file].md         | APPROVED    | 0              |
| [name]          | design/ux/[file].md         | APPROVED    | 0              |

New interaction patterns introduced: [list or "none — all reused existing patterns"]
Pattern library needs update: [yes/no — if yes, list patterns to add]

Next steps:
- Run /ux-review on any NEEDS REVISION specs
- Run /team-ui [screen-name] to begin visual design + implementation pipeline
- Run /gate-check pre-production once all key screens have approved specs
```

---

## Autonomy Contract

The user is consulted:
1. **Once** — to confirm the target (Step 1, only if no argument provided)
2. **Once** — for batched creative decisions (Step 4, only if genuine ambiguities exist)
3. **Once** — for the final session report (Step 7)

Everything else is resolved by the team from project context.

---

## Error Recovery

If any subagent returns BLOCKED:
1. Surface the specific blocker in the session report
2. Continue with remaining screens — never halt the pipeline for one blocker
3. Common blockers and resolutions:
   - GDD for this screen does not exist → note in report, skip spec
   - Conflicting GDD requirements → ux-lead makes the design decision and documents it as an open question in the spec
   - Missing player journey → proceed without it; note gap in spec's Open Questions section
   - Template file not found → read `.claude/docs/templates/ux-spec.md` directly

---

## Quick Reference

| Command | When to use |
|---------|-------------|
| `/ux-design-team [screen]` | Design one screen autonomously |
| `/ux-design-team hud` | Design the HUD autonomously |
| `/ux-design-team all` | Batch design all screens with documented UI Requirements |
| `/ux-design-team list` | See which screens need specs without designing anything |
| `/ux-design [screen]` | Interactive design with per-section approval (original skill) |
| `/team-ui [screen]` | Full pipeline: UX spec → visual design → implementation → review |
