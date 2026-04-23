# OpenCode Adoption Plan

> **Generated**: 2026-04-23
> **Project phase**: Fresh template
> **Engine**: Not configured

Work through these steps in order. Check off each item as you complete it.

---

## Step 1: Rename Directory Structure

### 1a. Rename `.claude/` to `.agents/`

Rename the entire directory to match OpenCode's expected structure:

```bash
mv .claude .agents
```

### 1b. Update root file references

**Files to create/update**:
- `AGENTS.md` (new primary for OpenCode) — copy or reference CLAUDE.md content

**CLAUDE.md** (keep for Claude Code users):
- Already correctly named for Claude Code compatibility
- OpenCode reads CLAUDE.md as fallback when no AGENTS.md exists

**Create AGENTS.md**:
```bash
# Create AGENTS.md as primary (OpenCode reads this first)
cp CLAUDE.md AGENTS.md
```

Or create a new `AGENTS.md` that references `.agents/` structure:

```markdown
# Agent Game Studios -- Game Studio Agent Architecture

[Same content as CLAUDE.md, but update paths]

## Project Structure

@.agents/docs/directory-structure.md
```

- [ ] `.claude/` renamed to `.agents/`
- [ ] `AGENTS.md` created in project root

---

## Step 2: Tool Name Replacements

### 2a. Replace `TodoWrite` → `todowrite`

**Files**: All skill files with `allowed-tools:` header lines
**Pattern**: `TodoWrite` → `todowrite`

```bash
# Find all files with TodoWrite
grep -rl "TodoWrite" .agents/skills/ | head -20
```

Manual edit in each file's header (line ~6):
```
allowed-tools: Read, Glob, Grep, Write, Edit, Bash, Task, AskUserQuestion, todowrite
```

- [ ] All skill files updated: TodoWrite → todowrite

### 2b. Replace `AskUserQuestion` → `question`

**Files**: ~40 skill files using AskUserQuestion
**Pattern**: `AskUserQuestion` → `question`

```bash
# Replace in allowed-tools header
sed -i 's/AskUserQuestion/question/g' .agents/skills/*.md

# Replace tool call references
sed -i 's/AskUserQuestion/question/g' .agents/skills/*.md
```

- [ ] All skill files updated: AskUserQuestion → question

---

## Step 3: Update Agent/Subagent Pattern

### 3a. Review Task tool usage

**Files**: ~40 skill files using `Task` to spawn agents
**Change needed**: OpenCode uses `@mention` or task tool for subagents

```diff
- Spawn `qa-lead` via Task
+ Spawn `@qa-lead` or use task tool
```

**Time**: Requires case-by-case review

- [ ] Agent spawn patterns reviewed and updated

### 3b. Update agent roster docs

**Files**: 
- `.agents/docs/agent-roster.md`
- `.agents/agents/*.md`

**Change**: Update documentation to reference OpenCode's agent format

- [ ] Agent roster docs updated

---

## Step 4: Update CLAUDE.md (for dual support)

### 4a. Keep CLAUDE.md for Claude Code users

The existing `CLAUDE.md` works for Claude Code. Keep it as-is.

- [ ] CLAUDE.md kept for Claude Code compatibility

### 4b. Update AGENTS.md paths

**File**: `AGENTS.md` (new)

Update references from `.claude/` to `.agents/`:

```diff
- @.claude/docs/directory-structure.md
+ @.agents/docs/directory-structure.md

- @.claude/docs/technical-preferences.md
+ @.agents/docs/technical-preferences.md
```

- [ ] AGENTS.md path references updated

---

## Step 5: Settings and Config

### 5a. Update settings file location

**Files**: 
- `.agents/settings.json`
- `.agents/docs/settings-local-template.md`

- [ ] Settings path reviewed and updated

### 5b. Add OpenCode-specific settings

Create `.agents/opencode.json` if needed for OpenCode-specific config:

```json
{
  "instructions": [
    ".agents/docs/CLAUDE.md"
  ]
}
```

- [ ] OpenCode config if needed

---

## Step 6: Validate

Run test skills to verify changes work:
```bash
# Test reading a skill file
opencode .agents/skills/adopt/SKILL.md
# Verify todowrite and question appear correctly
# Test skill invocation
skill(name="adopt")
```

- [ ] Tool name changes validated
- [ ] Directory rename validated

---

## Summary

| Step | Priority | Items | Est. Time |
|------|----------|-------|----------|
| 1 | BLOCKING | Directory rename + AGENTS.md | 5 min |
| 2 | BLOCKING | Tool name replacements | 10 min |
| 3 | HIGH | Subagent pattern review | 30 min |
| 4 | MEDIUM | AGENTS.md path updates | 10 min |
| 5 | LOW | Settings if needed | 5 min |
| 6 | REQUIRED | Validate | 5 min |
| **Total** | | | **~65 min** |

---

## Dual Platform Support

After this migration, the template works with both platforms:

| Platform | Root file | Skills directory |
|---------|----------|-----------------|
| Claude Code | `CLAUDE.md` | `.claude/skills/` |
| OpenCode | `AGENTS.md` | `.agents/skills/` |

Users choose which to use based on their platform.

---

## Re-run

Run `/adopt` again after completing steps to verify all gaps are resolved.