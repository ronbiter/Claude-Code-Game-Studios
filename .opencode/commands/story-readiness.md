---
description: "Validate a story file is implementation-ready with all required fields"
argument-hint: "[story-path or 'sprint' or 'all']"
---

# Story Readiness

Validate that story files contain everything needed to implement.

## Step 1: Determine Scope

Ask user or parse argument:
- Specific story file path
- `sprint` — validate all stories in current sprint
- `all` — validate all stories in production/epics/

## Step 2: Load Reference Docs

Load these once:
- Read `docs/architecture/tr-registry.yaml` for TR-ID lookups
- Read `docs/architecture/control-manifest.md` for layer rules

## Step 3: Check Each Story

For each story, verify:

### Required Fields
- [ ] TR-ID (GDD requirement reference)
- [ ] ADR Governing (Architecture Decision Record)
- [ ] Acceptance Criteria (clear, testable)
- [ ] Implementation Notes (enough to implement)
- [ ] Dependencies (documented)

### Completeness
- Are all 8 sections present?
- Are acceptance criteria clear enough to test?
- Are there open design questions?

## Step 4: Present Verdict

```
## Story Readiness: [story-name]

### Status: READY / NEEDS WORK / BLOCKED

### Gaps:
1. [missing field] — [action needed]

### Verdict
[READY / NEEDS WORK / BLOCKED]
```

---

Reference: See .agents/skills/story-readiness/SKILL.md