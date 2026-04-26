---
description: Guided onboarding — asks where you are, then routes to the right workflow
agent: explore
---

# Guided Onboarding

Ask the user where they're at with their game project, then guide them to the right next step.

## Step 1: Ask Where the User Is

Use a question with these exact options so the user can click:

**Prompt**: "Welcome! Before I suggest anything, where are you at with your game idea?"

**Options**:

- A) No idea yet — I want to explore and figure out what to make
- B) Vague idea — I have a rough theme or genre in mind but nothing concrete
- C) Clear concept — I know the core idea but haven't formalized it yet
- D) Existing work — I already have design docs, prototypes, or code done

## Step 2: Route Based on Answer

**If A (No idea yet)**:

- Recommend running /brainstorm open as the next step
- Show the recommended path briefly

**If B (Vague idea)**:

- Ask them to share their vague idea in a few words
- Recommend running /brainstorm with their hint

**If C (Clear concept)**:

- Ask them to describe their concept in one sentence
- Offer two paths: /brainstorm (to formalize) OR /setup-engine (to jump in)

**If D (Existing work)**:

- Check what artifacts exist in: design/gdd/, src/, prototypes/, production/
- Recommend /project-stage-detect for a gap analysis

## Step 3: Set Review Mode (if new)

If this is a fresh session, ask:

**Prompt**: "How much design review would you want as you work?"

**Options**:

- Full — Director reviews at each key step
- Lean (recommended) — Directors only at phase gates
- Solo — No director reviews, maximum speed

Write the choice to production/review-mode.txt

## Step 4: Confirm Before Proceeding

After presenting the recommended path, ask: "Would you like to start with [recommended step]?"

---

Reference: See .agents/skills/start/SKILL.md for the full workflow.
