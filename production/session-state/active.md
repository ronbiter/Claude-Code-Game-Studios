# Active Session State

## Current Task

- **task**: Designing crafting-system GDD
- **Status**: In Progress — skeleton created, starting Section A: Overview
- **File**: design/gdd/crafting-system.md
- **Review mode**: lean

## Progress

| Section | Status |
|---------|--------|
| Skeleton | ✅ Created |
| Overview | ⏳ In Progress |
| Player Fantasy | |
| Detailed Design | |
| Formulas | |
| Edge Cases | |
| Dependencies | |
| Tuning Knobs | |
| Visual/Audio Requirements | |
| UI Requirements | |
| Acceptance Criteria | |
| Open Questions | |

## Context

- **System**: Crafting System (#20 in systems index)
- **Priority**: Vertical Slice | Layer: Feature (Economy)
- **Depends on**: Inventory System (designed)
- **Depended on by**: None yet
- **Pillars**: Pillar 3 (Tense Survival)
- **Engine**: Unreal Engine 5.7

## Key Decisions Made

- None yet.

## Agent Invocations

- None yet.

## Cross-System Notes

- Inventory GDD Rule 8: Resources are "Not directly usable. Used by Crafting System (Vertical Slice)."
- Inventory defines `ConsumeItem()` and `GetResourceCount()` interfaces that Crafting will consume.
- Resource items: Scrap metal, Fabric, Chemicals — stack up to 10, 0.1–0.5 weight/unit, 1×1 slots.
- Cure device exists (Inventory): 1.0kg, 1×2 slots, deployable suppressant zone. Crafting may extend this.

## Next Systems in Design Order

1. ~~Crafting System (#20)~~ ← Working on this now
2. Save/Load System (#6) — MVP, depends on Game State Machine
3. Map System (#21) — Vertical Slice, depends on Scene Management
4. Tutorial System (#22) — Vertical Slice, depends on Game State Machine
