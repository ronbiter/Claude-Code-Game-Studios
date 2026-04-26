---
description: "Architectural and quality code review on specified files or set of files"
agent: explore
---

# Code Review

Review code for quality, patterns, and best practices.

## Step 1: Select Files

List code files in `src/`

Ask user: "Which files would you like to review?" 
- Can pick specific files or directories

Note: `/code-review` is for CODE. For design doc reviews, use `/design-review`.

## Step 2: Read Files

Read the selected code files.

## Step 3: Check Against Standards

Apply relevant checks based on file location:

### For gameplay code (`src/gameplay/**`)
- Data-driven values (no hardcoded magic numbers)
- Delta time usage (frame-rate independent)
- No UI references in game logic

### For core code (`src/core/**`)
- Zero allocations in hot paths
- Thread safety considerations
- API stability

### For AI code (`src/ai/**`)
- Performance budgets defined
- Debugging/logging in place
- Data-driven parameters

### For networking code (`src/networking/**`)
- Server-authoritative patterns
- Versioned messages
- Security considerations

### For UI code (`src/ui/**`)
- No game state ownership
- Localization-ready strings
- Accessibility considerations

## Step 4: Check SOLID Principles
- Single Responsibility
- Open/Closed (open for extension, closed for modification)
- Liskov Substitution
- Interface Segregation
- Dependency Inversion

## Step 5: Present Findings

```
## Code Review: [files]

### Quality Issues
- [issue 1] — line [N]
- [issue 2] — line [N]

### Pattern Suggestions
- [suggestion 1]
- [suggestion 2]

### Verdict
APPROVED / NEEDS REVISION / MAJOR ISSUES
```

---

Reference: See .agents/skills/code-review/SKILL.md