# Unreal Automation Tests

**Framework**: UE Automation Testing (built-in, no third-party install)
**Engine**: Unreal Engine 5.7

## Running Tests

```
# In-editor:
Session Frontend → Automation → select "MyGame." tests

# Headless (CI / command line):
"$UE_EDITOR_PATH" "[ProjectName].uproject" -nullrhi -nosound \
  -ExecCmds="Automation RunTests MyGame.; Quit" \
  -log -unattended
```

> Replace `[ProjectName]` when the UE project is initialized.

## Writing a Test

```cpp
#include "Misc/AutomationTest.h"

IMPLEMENT_SIMPLE_AUTOMATION_TEST(
    FMySystemTest,
    "MyGame.MySystem.FeatureName",
    EAutomationTestFlags::ApplicationContextMask | EAutomationTestFlags::ProductFilter
)

bool FMySystemTest::RunTest(const FString& Parameters)
{
    // TestEqual, TestTrue, TestFalse, AddError, etc.
    TestEqual(TEXT("Expected value"), ActualValue, ExpectedValue);
    return true;
}
```

## Naming Conventions

- **Class**: `F[SystemName][Feature]Test`
- **Category**: `"MyGame.[System].[Feature]"`
- **File**: `[System][Feature]Test.cpp` alongside the system under test, or in `Source/Tests/[System]/`

## Directory Layout

```
Source/Tests/
  Combat/         — Combat formula and damage calculation tests
  Health/         — Health/stamina and damage application tests
  Stealth/        — Detection score and stealth state machine tests
  SaveLoad/       — Save data serialization round-trip tests
  AI/             — Alien behavior and perception tests
  [System]/       — One subdirectory per game system
```

## Module Setup

Tests should live in a dedicated `[ProjectName]Tests` module.
Add to `[ProjectName].uproject` Build.cs dependencies:
```
PublicDependencyModuleNames.AddRange(new string[] { "AutomationController" });
```
