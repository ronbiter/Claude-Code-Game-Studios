---
description: "Guided, section-by-section GDD authoring for a single game system"
---

# Design System — Author a System GDD

Guided workflow to write a Game Design Document for a specific system.

## Step 1: Identify the System

Read `design/gdd/systems-index.md` to see available systems.

Ask the user: "Which system would you like to design?" with options from the index.

## Step 2: Check Existing Work

If a draft already exists at `design/gdd/[system-name].md`:

- Read it and offer to continue or start fresh

## Step 3: GDD Sections

Walk through each section collaboratively:

### 1. System Overview

- What is this system? (1-2 sentences)
- How does it connect to the core loop?
- What player need does it fulfill?

### 2. Core Mechanics

- What are the primary actions?
- What are the rules?
- How do players interact with this system?

### 3. Player Experience

- What feeling does this system evoke?
- What are the "juice" moments?
- How does it feel to master?

### 4. Progression & Depth

- How does the system evolve?
- What mastery curve exists?
- What new content unlocks?

### 5. Systems Integration

- What other systems does this connect to?
- How do they communicate?
- Any potential conflicts?

### 6. Balance & Numbers

- Key formulas (keep as variables)
- Scaling curves
- Critical thresholds

### 7. Edge Cases

- What happens when things go wrong?
- Bounds checking
- Recovery paths

### 8. Future Considerations

- What's deferred?
- Scalability notes

## Step 4: Write Document

Use template `.agents/docs/templates/game-design-document.md`

Write to `design/gdd/[system-name].md`

Ask user approval before writing.

---

Reference: See .agents/skills/design-system/SKILL.md
