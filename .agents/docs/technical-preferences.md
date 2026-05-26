# Technical Preferences

<!-- Populated by /setup-engine. Updated as the user makes decisions throughout development. -->
<!-- All agents reference this file for project-specific standards and conventions. -->

## Engine & Language

- **Engine**: Unreal Engine 5.7
- **Language**: C++ (primary), Blueprint (gameplay prototyping)
- **Rendering**: Substrate materials (production-ready in 5.7)
- **Physics**: Chaos physics engine

## Input & Platform

- **Target Platforms**: PC (Steam / Epic)
- **Input Methods**: Keyboard/Mouse, Gamepad
- **Primary Input**: Keyboard/Mouse
- **Gamepad Support**: Partial (recommended for UI d-pad navigation)
- **Touch Support**: None
- **Platform Notes**: All UI must support keyboard navigation and d-pad. No hover-only interactions.

## Naming Conventions

- **Classes**: Prefixed PascalCase — `A` Actor, `U` UObject, `F` struct
- **Variables**: PascalCase (e.g., `MoveSpeed`, `Health`)
- **Booleans**: `b` prefix (e.g., `bIsAlive`, `bHasDetectedPlayer`)
- **Functions**: PascalCase (e.g., `TakeDamage()`, `BeginPlay()`)
- **Files**: Match class without prefix (e.g., `PlayerCharacter.h`)
- **Constants**: PascalCase or UPPER_SNAKE_CASE
- **Blueprint classes**: No prefix — follow standard naming (e.g., `BP_PlayerCharacter`)

## Performance Budgets

- **Target Framerate**: 60 fps (adaptive acceptable)
- **Frame Budget**: 16.6 ms at 60 fps
- **Draw Calls**: Target < 2000 per frame at high settings
- **Memory Ceiling**: [TO BE CONFIGURED — set after target hardware testing]

## Testing

- **Framework**: UE Automation Testing (IMPLEMENT_SIMPLE_AUTOMATION_TEST / IMPLEMENT_COMPLEX_AUTOMATION_TEST)
- **Minimum Coverage**: Logic systems, balance formulas, save/load
- **Required Tests**: Balance formulas, gameplay systems, save data integrity

## Forbidden Patterns

<!-- Add patterns that should never appear in this project's codebase -->
- [None configured yet — add as architectural decisions are made]

## Allowed Libraries / Addons

<!-- Add approved third-party dependencies here -->
- [None configured yet — add as dependencies are approved]

## Architecture Decisions Log

<!-- Quick reference linking to full ADRs in docs/architecture/ -->
- [No ADRs yet — use /architecture-decision to create one]

## Engine Specialists

<!-- Read by /code-review, /architecture-decision, /architecture-review, and team skills -->
<!-- to know which specialist to spawn for engine-specific validation. -->

- **Primary**: unreal-specialist
- **Language/Code Specialist**: ue-blueprint-specialist (Blueprint graphs) or unreal-specialist (C++)
- **Shader Specialist**: unreal-specialist (no dedicated shader specialist — primary covers materials)
- **UI Specialist**: ue-umg-specialist (UMG widgets, CommonUI, input routing, widget styling)
- **Additional Specialists**: ue-gas-specialist (Gameplay Ability System, attributes, gameplay effects), ue-replication-specialist (property replication, RPCs, client prediction, netcode)
- **Routing Notes**: Invoke primary for C++ architecture and broad engine decisions. Invoke Blueprint specialist for Blueprint graph architecture and BP/C++ boundary design. Invoke GAS specialist for all ability and attribute code. Invoke replication specialist for any multiplayer or networked systems. Invoke UMG specialist for all UI implementation.

### File Extension Routing

| File Extension / Type | Specialist to Spawn |
|-----------------------|---------------------|
| Game code (.cpp, .h files) | unreal-specialist |
| Shader / material files (.usf, .ush, Material assets) | unreal-specialist |
| UI / screen files (.umg, UMG Widget Blueprints) | ue-umg-specialist |
| Scene / prefab / level files (.umap, .uasset) | unreal-specialist |
| Native extension / plugin files (Plugin .uplugin, modules) | unreal-specialist |
| Blueprint graphs (.uasset BP classes) | ue-blueprint-specialist |
| General architecture review | unreal-specialist |