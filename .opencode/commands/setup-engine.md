---
description: "Configure game engine and pin version in CLAUDE.md"
argument-hint: "[engine name] [version]"
---

# Setup Engine

Configure the game engine for the project.

## Step 1: Ask Engine Preference

Ask the user:

**Prompt**: "Which game engine are you using?"

**Options**:
- Godot 4
- Unity
- Unreal Engine 5
-_help me decide_

## Step 2: If "Help Me Decide"

Present key considerations:
- **Godot**: Open source, great 2D/export to web, limited 3D AAA
- **Unity**: Best mobile support, C#, large ecosystem
- **UE5**: Industry standard for AAA, heavy but powerful

Guide based on their concept from /brainstorm.

## Step 3: Get Version

Ask for specific version:
- Godot: 4.x?
- Unity: 202x.x?
- UE5: 5.x?

## Step 4: Configure

Write engine info to CLAUDE.md:
```
## Engine
- Name: [Engine]
- Version: [Version]
```

## Step 5: Create Engine Reference

Create placeholder for version docs:
`docs/engine-reference/[engine]/VERSION.md`

---

Reference: See .agents/skills/setup-engine/SKILL.md