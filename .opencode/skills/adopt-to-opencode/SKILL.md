---
name: adopt-to-opencode
description: "Adapts Claude Code Game Studios skills to OpenCode format. Use when the user wants to adapt more skills from .agents/skills/ to .opencode/ for OpenCode compatibility. Handles both simple skills (direct conversion) and complex skills (using OpenCode's task/subagent system)."
argument-hint: "[skill-name or 'all']"
user-invocable: true
allowed-tools: Read, Glob, Write, Edit, question
---

# Adopt to OpenCode

This skill adapts Claude Code Game Studios skills to OpenCode custom commands and agents.

**Output:**
- `.opencode/commands/[skill-name].md` — command file
- `.opencode/agents/[agent-name].md` — agent file (if skill spawns subagents)
- Updates `opencode.jsonc` with config

## Step 1: Identify Skills to Adapt

If argument provided (e.g., `/adopt-to-opencode brainstorm`):
- Find that skill in `.agents/skills/[skill-name]/SKILL.md`

If no argument or `all`:
- Ask user: "Which skill(s) should I adapt?"
- Use `question` with options from available skills

## Step 2: Analyze the Skill

Read the skill's SKILL.md and analyze:

### Classification

**Simple Skills** (can convert directly):
- Read-only analysis (help, project-stage-detect)
- Single guided workflow (design-review, code-review)
- Document generation (architecture-decision, sprint-plan)

**Complex Skills** (need subagent system):
- Uses `task` to spawn subagents
- Multi-phase with agent routing
- Team orchestration (team-X skills)

### Frontmatter Analysis
Extract from skill's SKILL.md:
- `name:` → command name
- `description:` → use in frontmatter
- `allowed-tools:` → map to OpenCode permissions
- `model:` → use if specified

## Step 3: Convert Format

### For Simple Skills → Command

Create `.opencode/commands/[name].md`:

```markdown
---
description: "[description from skill]"
argument-hint: "[from skill or empty]"
---

# [Title]

[Guided workflow from skill - simplified]

## Step 1: [Action]
[Instructions]

## Step 2: [Action]
[Instructions]

[Reference: See .agents/skills/[skill]/SKILL.md]
```

### For Complex Skills → Command + Agent

**1. Create Agent** (for the programmer roles):
Create `.opencode/agents/[role].md`:

```markdown
---
description: "[Role description]"
mode: subagent
model: [from skill or sonnet]
permission:
  edit: allow
  bash: deny
---

You are a [Role]. [Focus areas].

Reference: See .agents/agents/[role].md
```

**2. Create Command** with task routing:
Create command that spawns the agent via `@agent` mention.

## Step 4: Update Config

Add to `opencode.jsonc` command section:

```json
"[name]": {
  "description": "[description]",
  "template": "[simplified workflow]",
  "agent": "[agent-name if complex]"
}
```

## Step 5: Ask for Priority

After conversion, ask user:
- "Would you like to continue adapting more skills?"
- "Should I test these commands?"
- "Ready to commit?"

---

## Adaptation Patterns

### Pattern 1: Direct Command
For skills that just guide through a workflow:

| Original Tool | OpenCode Replacement |
|---------------|---------------------|
| task spawn | agent field |
| question | template includes questions |
| Write | Ask approval before writing |

### Pattern 2: Agent + Command
For skills that route to specialists:

| Original | OpenCode |
|----------|---------|
| task spawn gameplay-programmer | @gameplay-programmer in command |
| task spawn creative-director | @creative-director in command |
| Multi-agent coordination | Commands reference agents via @ |

### Pattern 3: Keep as Skill
Some skills don't need conversion:
- Skills using internal tools (hooks, validation)
- Skills requiring file system access outside project
- Skills integrating with external services

---

## Available Skills to Adapt

Navigation: start, help, project-stage-detect
Design: brainstorm, map-systems, design-system, quick-design, review-all-gdds
Architecture: create-architecture, architecture-decision, architecture-review, create-control-manifest
Epics/Stories: create-epics, create-stories, dev-story, story-readiness, story-done
Engine: setup-engine, adopt
Sprints: sprint-plan, sprint-status
Reviews: design-review, code-review, gate-check, consistency-check
QA: qa-plan, smoke-check, soak-test, regression-suite, test-setup, test-helpers
Production: milestone-review, retrospective, bug-report, bug-triage, playtest-report
Release: release-checklist, launch-checklist, changelog, patch-notes, hotfix
Teams: team-combat, team-narrative, team-ui, team-release, team-polish, team-audio, team-level, team-qa, team-live-ops

---

## Completion

After adapting requested skills:
- List created files
- Show coverage (adapted vs available)
- Ask: "Continue with more skills?"

Verdict: **COMPLETE** — skills adapted to OpenCode format.