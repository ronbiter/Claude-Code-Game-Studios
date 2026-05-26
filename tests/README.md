# Test Infrastructure

**Engine**: Unreal Engine 5.7
**Test Framework**: UE Automation Testing (IMPLEMENT_SIMPLE_AUTOMATION_TEST / IMPLEMENT_COMPLEX_AUTOMATION_TEST)
**CI**: `.github/workflows/tests.yml`
**Setup date**: 2026-05-26

## Directory Layout

```
tests/
  unit/           # Isolated unit tests (formulas, state machines, logic)
  integration/    # Cross-system and save/load tests
  smoke/          # Critical path test list for /smoke-check gate
  evidence/       # Screenshot logs and manual test sign-off records
```

C++ test source lives in `Source/Tests/` (UE module convention).

## Running Tests

```
# Headless via command line (requires self-hosted runner with UE installed):
"$UE_EDITOR_PATH" "[ProjectName].uproject" -nullrhi -nosound \
  -ExecCmds="Automation RunTests MyGame.; Quit" \
  -log -unattended

# In-editor:
# Session Frontend → Automation → select "MyGame." tests
```

> **Note:** Replace `[ProjectName]` when the UE project is initialized.

## Test Naming

- **Files**: `[System][Feature]Test.cpp` (e.g., `CombatDamageTest.cpp`)
- **Test categories**: `MyGame.[System].[Feature]`
- **Example**: `IMPLEMENT_SIMPLE_AUTOMATION_TEST(FCombatDamageTest, "MyGame.Combat.DamageCalculation", ...)`

## Story Type → Test Evidence

| Story Type | Required Evidence | Location |
|---|---|---|
| Logic | Automated unit test — must pass | `Source/Tests/[System]/` |
| Integration | Integration test OR playtest doc | `Source/Tests/Integration/` |
| Visual/Feel | Screenshot + lead sign-off | `tests/evidence/` |
| UI | Manual walkthrough OR interaction test | `tests/evidence/` |
| Config/Data | Smoke check pass | `production/qa/smoke-*.md` |

## CI

Tests run automatically on every push to `main` and on every pull request.
A failed test suite blocks merging.

CI requires a self-hosted GitHub Actions runner with Unreal Editor installed.
Set `UE_EDITOR_PATH` on the runner before first use.
