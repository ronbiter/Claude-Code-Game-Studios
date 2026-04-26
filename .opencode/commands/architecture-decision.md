---
description: "Create an Architecture Decision Record documenting a significant technical decision"
argument-hint: "[title or 'new']"
---

# Architecture Decision

Write an ADR (Architecture Decision Record).

## Step 1: Determine Context

This documents a technical decision. Check existing ADRs in `docs/architecture/`:

- List existing ADRs to avoid duplication
- Note patterns already established

## Step 2: Identify the Decision

Ask user: "What's the technical decision you need to document?"

Example decisions:
- What game engine to use
- How to handle save data
- Networking architecture
- AI system design
- UI framework choice

## Step 3: ADR Structure

Document with these sections:

### Title
[Area]: [Decision]

### Status
PROPOSED / ACCEPTED / DEPRECATED

### Context
What prompted this decision?

### Alternatives Considered
1. **Option A** — [description]
   - Pros: [list]
   - Cons: [list]

2. **Option B** — [description]
   - Pros: [list]
   - Cons: [list]

### Decision
[Selected option and rationale]

### Consequences
- [positive consequence]
- [negative consequence]

## Step 4: Write ADR

Write to `docs/architecture/adr-[number]-[slug].md`

Use template: `.agents/docs/templates/adr.md`

Ask user approval before writing.

---

Reference: See .agents/skills/architecture-decision/SKILL.md