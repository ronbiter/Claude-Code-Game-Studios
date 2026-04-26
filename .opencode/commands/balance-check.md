---
description: "Analyze game balance data, identify outliers, broken progressions, degenerate strategies"
---

# Balance Check

Analyze game balance data and configuration.

## Step 1: Identify Balance Files

Search for balance-related files:
- `config/` — game configuration
- `design/balance/` — balance docs
- Any JSON/YAML data files in `src/`

List available balance data.

## Step 2: Analyze

Check each data file for:

### Outliers
- Any values that break the curve
- Missing data points

### Broken Progression
- Steps that are too large/small
- Gaps in the progression curve
- Non-monotonic advancement

### Degenerate Strategies
- Any single option that dominates all others
- No meaningful choices

### Economy Issues
- Inflation/deflation problems
- Impossible prices

## Step 3: Present Findings

```
## Balance Analysis: [file]

### Issues Found
1. [issue] — [severity]
2. [issue] — [severity]

### Recommendations
- [recommendation 1]
- [recommendation 2]

### Severity
- CRITICAL: Breaks the game
- HIGH: Significant imbalance
- MEDIUM: Noticeable but playable
- LOW: Minor tuning
```

---

Reference: See .agents/skills/balance-check/SKILL.md