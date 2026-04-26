---
description: "Break a single epic into implementable story files"
---

# Create Stories

Break an epic into implementable story files.

## Step 1: Select Epic

List available epics from `production/epics/`

Ask user: "Which epic would you like to break into stories?"

## Step 2: Read Epic

Read the selected epic file to understand:
- Systems included
- GDD requirements
- ADR guidance
- Dependencies

## Step 3: Identify Stories

Break each system in the epic into stories:

**Story Format**:
```markdown
# Story: [Title]

## Description
[What this story implements]

## GDD Requirement
- TR-ID: [from GDD]

## Acceptance Criteria
1. [Criteria 1]
2. [Criteria 2]

## Implementation Notes
- [Technical notes from ADR]
- [Engine-specific notes]
```

## Step 4: Write Stories

Write each story to `production/stories/story-[epic]-[number]-[title].md`

---

Reference: See .agents/skills/create-stories/SKILL.md