---
description: "Decompose game concept into individual systems, map dependencies, assign priorities"
---

# Map Systems

Decompose the game concept into individual systems with dependencies.

## Step 1: Read Concept

Read `design/gdd/game-concept.md` to understand the core loop and pillars.

## Step 2: Identify Core Systems

Break down the game into individual systems:

**Core Systems** (must exist):
- Player Controller / Input
- Core Loop (the main repeated action)
- Progression System (growth over time)
- Save/Load System

**Gameplay Systems** (genre-dependent):
- Combat System
- Exploration System
- Crafting System
- Dialogue/Story System
- AI System

**Support Systems**:
- UI/HUD System
- Audio System
- Settings System

## Step 3: Map Dependencies

For each system, identify what it depends on:

Example:
- Combat System DEPENDS ON: Player Controller
- Player Controller DEPENDS ON: Input System
- Progression System DEPENDS ON: Save System

## Step 4: Assign Priorities

Tier systems by implementation order:
- **Tier 1** (MVP): Systems essential to core loop
- **Tier 2** (Support): Systems that tier 1 depends on
- **Tier 3** (Polish): Systems that add depth

## Step 5: Write Systems Index

Use template to write `design/gdd/systems-index.md`:

```markdown
# Systems Index

## Core Systems
| System | Description | Priority | Dependencies |
|--------|-------------|----------|--------------|
| [Name] | [Description] | T1 | [Deps] |

## Gameplay Systems
...

## Support Systems
...

## Dependency Graph
[Describe or diagram the key dependencies]
```

---

Reference: See .agents/skills/map-systems/SKILL.md