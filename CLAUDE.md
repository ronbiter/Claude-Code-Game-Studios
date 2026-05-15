# Claude Code Game Studios -- Game Studio Agent Architecture

Indie game development managed through 49 coordinated Claude Code subagents.
Each agent owns a specific domain, enforcing separation of concerns and quality.

## Technology Stack

- **Engine**: Unreal Engine 5.7
- **Language**: C++ (primary), Blueprint (gameplay prototyping)
- **Version Control**: Git with trunk-based development
- **Build System**: Unreal Build Tool (UBT)
- **Asset Pipeline**: Unreal Content Pipeline

## Project Structure

```
/
├── CLAUDE.md                    # Master configuration
├── .agents/                     # Agent definitions, skills, hooks, docs
├── src/                         # Game source code
├── assets/                      # Game assets
├── design/                      # GDDs, narrative, levels, balance
├── docs/                        # Technical docs + engine-reference/
├── tests/                       # Test suites
├── tools/                       # Build and pipeline tools
├── prototypes/                  # Throwaway prototypes (isolated from src/)
└── production/                  # Sprints, milestones, releases
    ├── session-state/           # active.md — living checkpoint (gitignored)
    └── session-logs/            # Session audit trail (gitignored)
```

## Engine Version Reference

UE 5.7. LLM training cutoff: May 2025. Breaking changes: Substrate materials, PCG API, Megalights, Animation Authoring. Search engram memory for "Unreal Engine 5.7 version reference" before suggesting UE APIs. Full reference: `docs/engine-reference/unreal/VERSION.md`.

## Collaboration Protocol

**User-driven collaboration, not autonomous execution.**
Every task follows: **Question -> Options -> Decision -> Draft -> Approval**

- Agents MUST ask "May I write this to [filepath]?" before using Write/Edit tools
- Agents MUST show drafts or summaries before requesting approval
- Multi-file changes require explicit approval for the full changeset
- No commits without user instruction

> **First session?** If the project has no engine configured and no game concept,
> run `/start` to begin the guided onboarding flow.

## Studio Standards (search engram memory for details)

All agent coordination rules, coding standards, design document requirements,
technical preferences, and context management strategies are saved in engram memory.

Search engram memory for:
- **"Agent coordination"** — delegation, model tiers, parallel task protocol
- **"Coding standards"** — doc comments, ADRs, GDD 8-section standard, testing
- **"Technical preferences"** — UE5.7, naming, specialist routing, performance
- **"Context management"** — file-backed state, incremental writing, compaction
- **"Directory structure"** — project layout (also inlined above)
