---
description: "Audit existing project artifacts for format compliance, identify gaps and migration plan"
---

# Adopt — Brownfield Onboarding

Audit existing project artifacts to see if they work with the template's skills.

## Step 1: Scan Existing Artifacts

**Design Docs**:
- List all files in `design/gdd/`
- Check format of each (required sections present?)

**Architecture**:
- List ADRs in `docs/architecture/`
- Check ADR format (required sections?)

**Production**:
- List sprint plans in `production/sprints/`
- List stories in `production/stories/`
- Check story format

**Source Code**:
- List files in `src/`

## Step 2: Identify Gaps by Impact

Classify each gap:

| Gap | Impact | Action |
|-----|-------|--------|
| Missing required sections in GDD | HIGH | Retrofitting required |
| Missing ADRs | MEDIUM | Can add later |
| No story format | HIGH | Templates needed |
| Engine not configured | HIGH | /setup-engine first |

## Step 3: Generate Migration Plan

Present numbered plan:

1. **Critical** (must fix before template skills work)
2. **High** (should fix before production)
3. **Medium** (can defer)
4. **Low** (nice to have)

For each item:
- What needs to change
- Where
- Estimated effort

## Step 4: Confirm Plan

Ask user: "May I write the migration plan to production/adopt-plan.md?"

---

Reference: See .agents/skills/adopt/SKILL.md