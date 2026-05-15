---
description: "Translate approved GDDs + architecture into epics — one epic per architectural module"
---

# Create Epics

Map systems to implementation epics.

## Step 1: Read Context

Read these files:

- `design/gdd/systems-index.md` — list of systems
- `design/gdd/game-concept.md` — core concept
- `docs/architecture/` — existing ADRs

## Step 2: Group Systems into Epics

Group systems by architectural module. Typical grouping:

**Core Infrastructure**

- Save/Load System
- Settings System
- Core Utilities

**Gameplay Module**

- Player Controller
- Combat/Interaction
- AI Enemies

**Content Module**

- Level/World Data
- Narrative/Dialogue

**UI Module**

- HUD/Overlay
- Menus/Screens

## Step 3: Define Each Epic

For each epic, define:

```markdown
# Epic: [Name]

## Description

[What this epic covers]

## Systems Included

- [system1]
- [system2]

## GDD Requirements

- [requirement] (from TR-ID in GDDs)

## ADR Guidance

- [relevant ADR decisions]

## Dependencies

- [other epics this depends on]

## Implementation Notes

[Any technical considerations]
```

## Step 4: Write Epics

Write each epic to `production/epics/epic-[slug].md`

---

Reference: See .agents/skills/create-epics/SKILL.md
