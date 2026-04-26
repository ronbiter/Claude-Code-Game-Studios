---
description: "Analyzes project state, detects stage, identifies gaps, recommends next steps"
---

# Project Stage Detection

Analyze your project to determine its current development stage and gaps.

## Step 1: Scan Key Directories

Check for artifacts in:

**Design** (`design/`):

- Count GDD files in design/gdd/\*.md
- Check for game-concept.md, game-pillars.md, systems-index.md
- Count narrative docs in design/narrative/
- Count level designs in design/levels/

**Source Code** (`src/`):

- Count source files by extension
- Identify major system directories (core/, gameplay/, ai/, networking/, ui/)

**Architecture** (`docs/architecture/`):

- Count ADRs (Architecture Decision Records)
- Check for overview/index documents

**Production** (`production/`):

- Check for sprint plans, milestones, roadmaps

## Step 2: Classify Stage

Based on scanned artifacts (check most advanced first):

| Stage           | Indicators                                  |
| --------------- | ------------------------------------------- |
| Concept         | No game concept doc                         |
| Systems Design  | Game concept exists, no systems index       |
| Technical Setup | Systems index exists, engine not configured |
| Pre-Production  | Engine configured, src/ has <10 files       |
| Production      | src/ has 10+ files, active development      |
| Polish          | Explicit via /gate-check                    |
| Release         | Explicit via /gate-check                    |

## Step 3: Identify Gaps

DON'T just list missing files. Ask clarifying questions:

- "I see combat code but no combat-system.md GDD. Prototyped first, or reverse-document?"
- "No sprint plans found. Are you tracking work elsewhere?"
- "Game concept exists but no systems index. Should we run /map-systems?"

## Step 4: Generate Report

Create a stage report with:

- **Stage**: [detected]
- **Completeness**: Design X%, Code X%, Architecture X%
- **Gaps**: [list with clarifying questions]
- **Recommended Next Steps**: [priority-ordered]

Ask user approval before writing to production/project-stage-report.md

---

Reference: See .agents/skills/project-stage-detect/SKILL.md
