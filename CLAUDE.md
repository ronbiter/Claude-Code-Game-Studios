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

## Context-Mode Rules (Token Protection)

Context-mode is active on this project. These rules are mandatory and override default tool behavior.

**Tool selection — always follow this hierarchy:**
1. `ctx_batch_execute` — for any shell command that produces >20 lines of output
2. `ctx_execute_file` — for reading/analyzing files (not editing). Read tool is for files you intend to Edit only.
3. `ctx_fetch_and_index` — for all web fetches. Never use WebFetch directly.
4. `ctx_search` — for all follow-up questions. One call, many queries.

**Session start protocol:**
- Run `ctx_search(query="recent", sort="timeline")` before asking the user for context
- Check prior session state before loading any planning files

**Session pressure protocol:**
- If context usage exceeds 50%, run `/compact` before starting the next major task
- Do not attempt to complete 3+ major tasks in a single bloated session

**Architecture registry:**
- Default: load `docs/registry/adr-index.yaml` only
- Load domain files (`adr-input.yaml`, `adr-subsystems.yaml`, etc.) only when actively working on that domain
- Never load all domain files simultaneously unless doing a cross-domain audit

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

## GDD Design Protocol

GDDs are written in stages with mandatory gates. Do NOT write a full GDD in one pass.

**Stage 1**: Player Fantasy only
- Write the Fantasy section
- Run Gate 1 adversarial check (see GDD template)
- Fix fantasy if needed. Max 1 retry before stopping.

**Stage 2**: Core Rules + States
- Write Core Rules and States & Transitions
- Run Gate 2 adversarial check (see GDD template)
- Max 1 revision pass.

**Stage 3**: Full GDD
- Write all remaining sections (Formulas, Edge Cases, Dependencies, etc.)
- Run lean-depth design review ONLY after Stage 1 and Stage 2 passed cleanly
- Full 4-agent adversarial review only if lean-depth finds no structural issues

**Key rule**: If Gate 1 or Gate 2 fails twice, halt the GDD entirely. Fix the design concept before resuming. Do not patch-and-continue.

## Studio Standards (search engram memory for details)

All agent coordination rules, coding standards, design document requirements,
technical preferences, and context management strategies are saved in engram memory.

Search engram memory for:
- **"Agent coordination"** — delegation, model tiers, parallel task protocol
- **"Coding standards"** — doc comments, ADRs, GDD 8-section standard, testing
- **"Technical preferences"** — UE5.7, naming, specialist routing, performance
- **"Context management"** — file-backed state, incremental writing, compaction
- **"Directory structure"** — project layout (also inlined above)
