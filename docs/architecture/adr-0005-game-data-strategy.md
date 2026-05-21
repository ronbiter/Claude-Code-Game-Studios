# ADR-0005: Game Data Strategy — DataTable & DataAsset

## Status
Accepted

## Date
2026-05-19

## Engine Compatibility

| Field | Value |
|-------|-------|
| **Engine** | Unreal Engine 5.7 |
| **Domain** | Core |
| **Knowledge Risk** | LOW — UDataTable and UPrimaryDataAsset APIs have been stable since UE 4.14 / 4.17. No breaking changes in the 5.4–5.7 window. |
| **References Consulted** | `docs/engine-reference/unreal/VERSION.md` |
| **Post-Cutoff APIs Used** | None |
| **Verification Required** | Confirm CSV import pipeline works end-to-end in UE 5.7 project settings before first data authoring sprint. |

## ADR Dependencies

| Field | Value |
|-------|-------|
| **Depends On** | ADR-0004 (defines the single primary module `HostileWorld` where all data assets live) |
| **Enables** | Inventory implementation, Quest implementation, Dialogue implementation, Investigation implementation, Crafting implementation, Alien AI tuning — any story that authors a DataTable asset or DataAsset class |
| **Blocks** | All implementation stories that define a `DT_` or `DA_` asset, or declare a `FTableRowBase` struct |
| **Ordering Note** | Must be Accepted before any DataTable asset is created or any `FTableRowBase` struct is declared in C++ |

## Context

### Problem Statement
Six GDD systems independently reference DataTable assets (`DT_Items`, `DT_Quests`, `DT_QuestRewards`, `DT_Dialogue_{NPCId}`, `DT_Clues`, `DT_Revelations`, `DT_Recipes`) and one system flags the data format as an open question (Faction Reputation). No ADR governs when to use `UDataTable` versus `UPrimaryDataAsset`, what naming and content directory conventions apply, which subsystem owns each table, or how tables are loaded at runtime. Without this decision, developers will independently choose formats, creating a mix of hard-loaded and soft-loaded tables, inconsistent naming, and subsystems reading data they do not own.

### Constraints
- Single primary module: `HostileWorld` (ADR-0004)
- Single-player only — no server-side data streaming concerns
- PC target — memory ceiling not yet set, but indie scale; full startup load is acceptable
- GDDs have already named several DataTable assets (`DT_Items`, `DT_Quests`, etc.) — this ADR formalises those names as the canonical contract

### Requirements
- Must define a decision rule for DataTable vs DataAsset any programmer can apply in under a minute
- Must assign each identified DataTable to a single owning subsystem
- Must specify naming conventions for assets and row struct types
- Must define the runtime access pattern (how subsystems reference their tables)
- Must prevent cross-subsystem DataTable reads

## Decision

### Storage Strategy — Hybrid Policy

| When to Use | Format | UE Class |
|-------------|--------|----------|
| Bulk tabular game data with fixed columns and CSV/JSON import workflow | DataTable | `UDataTable` + `FTableRowBase` |
| Complex game entities requiring Blueprint subclassing, per-instance Blueprint logic, or independent async streaming | DataAsset | `UPrimaryDataAsset` subclass |

**Rule**: If the data has fixed columns, can be expressed as a flat row, and does not need Blueprint-per-instance logic → use `UDataTable`. If a game entity needs custom Blueprint logic per variant (e.g., enemy types with different behavior trees authored in Blueprint) → use `UPrimaryDataAsset`.

For the current Vertical Slice, all identified data is DataTable-appropriate. DataAssets are reserved for future complex entities (e.g., unique enemy type definitions with per-type Blueprint behavior).

### System DataTable Inventory

| Asset Name | Row Struct | Owner Subsystem | Source GDD |
|------------|-----------|-----------------|-----------|
| `DT_Items` | `FItemRow` | `UInventorySubsystem` | inventory-system.md |
| `DT_Recipes` | `FCraftingRecipeRow` | `UInventorySubsystem` | crafting-system.md |
| `DT_Quests` | `FQuestRow` | `UQuestSubsystem` | quest-system.md |
| `DT_QuestRewards` | `FQuestRewardRow` | `UQuestSubsystem` | quest-system.md |
| `DT_Dialogue_{NPCId}` | `FDialogueNodeRow` | `UDialogueSubsystem` | dialogue-system.md |
| `DT_Clues` | `FClueRow` | `UInvestigationSubsystem` | investigation-system.md |
| `DT_Revelations` | `FRevelationRow` | `UInvestigationSubsystem` | investigation-system.md |
| `DT_AIPerceptionTuning` | `FAIPerceptionTuningRow` | `UAlienSquadSubsystem` | alien-ai-system.md |
| `DT_FactionBaselines` | `FFactionBaselineRow` | `UFactionSubsystem` | faction-reputation-system.md (open question OQ-6 resolved by this ADR) |

### Load Strategy — Hard References

All DataTables are hard-referenced from their owning subsystem as a `TObjectPtr<UDataTable>` `UPROPERTY`. They load at game startup with the `GameInstance`. This is appropriate for indie PC scale where total data set is small.

```
// Soft-loading via FStreamableManager is reserved for future open-world content
// streaming, if table sizes grow significantly. Not adopted now.
```

### Naming Conventions

| Artifact | Convention | Example |
|----------|------------|---------|
| DataTable assets (Content) | `DT_<System>_<Purpose>` or `DT_<Purpose>` for single-table systems | `DT_Items`, `DT_Quests`, `DT_Dialogue_Guard01` |
| DataAsset classes (C++) | `U<Type>DataAsset` | `UEnemyTypeDataAsset` |
| DataAsset assets (Content) | `DA_<Type>_<Name>` | `DA_EnemyType_Crawler` |
| Row struct types (C++) | `F<Purpose>Row` | `FItemRow`, `FQuestRow` |
| Content directory | `Content/Data/DataTables/` and `Content/Data/DataAssets/` | — |

### Architecture Diagram

```
UGameInstance
├── UInventorySubsystem
│   ├── TObjectPtr<UDataTable> ItemDataTable        ← DT_Items
│   └── TObjectPtr<UDataTable> RecipeDataTable      ← DT_Recipes
├── UQuestSubsystem
│   ├── TObjectPtr<UDataTable> QuestDataTable       ← DT_Quests
│   └── TObjectPtr<UDataTable> QuestRewardDataTable ← DT_QuestRewards
├── UFactionSubsystem
│   └── TObjectPtr<UDataTable> FactionBaselines     ← DT_FactionBaselines
└── UInvestigationSubsystem
    ├── TObjectPtr<UDataTable> ClueDataTable         ← DT_Clues
    └── TObjectPtr<UDataTable> RevelationDataTable   ← DT_Revelations

UWorld
├── UAlienSquadSubsystem
│   └── TObjectPtr<UDataTable> PerceptionTuning     ← DT_AIPerceptionTuning
└── UDialogueSubsystem
    └── TMap<FName, TObjectPtr<UDataTable>> DialogueTables  ← DT_Dialogue_{NPCId} (keyed by NPC ID)
```

### Key Interfaces

```cpp
// ─── Subsystem declaration (example: UInventorySubsystem) ───────────────────
UPROPERTY(EditDefaultsOnly, Category = "Data")
TObjectPtr<UDataTable> ItemDataTable;

// ─── Row lookup (safe pattern) ───────────────────────────────────────────────
const FItemRow* Row = ItemDataTable->FindRow<FItemRow>(
    ItemId, TEXT("UInventorySubsystem::GetItemDefinition"));
// Always pass a non-empty ContextString — logged on failed lookup for debugging
// FindRow returns nullptr on miss — ALWAYS null-check before dereferencing

// ─── Row struct declaration ──────────────────────────────────────────────────
USTRUCT(BlueprintType)
struct FItemRow : public FTableRowBase
{
    GENERATED_BODY()
    UPROPERTY(EditAnywhere) FName ItemId;
    UPROPERTY(EditAnywhere) FText DisplayName;
    // ... further fields per GDD schema
};

// ─── DataAsset subclass (future use pattern) ─────────────────────────────────
UCLASS(BlueprintType)
class UEnemyTypeDataAsset : public UPrimaryDataAsset
{
    GENERATED_BODY()
public:
    UPROPERTY(EditAnywhere) UBehaviorTree* BehaviorTree;
    UPROPERTY(EditAnywhere) float BaseHealthPoints;
};
```

### Ownership Rule

Each DataTable is owned by exactly one subsystem. **No other subsystem may hold a reference to it or call `FindRow` on it directly.** If a subsystem needs data owned by another, it calls a method on the owning subsystem:

```cpp
// CORRECT: UQuestSubsystem needs an item name for a reward display
FName ItemName = GetGameInstance()->GetSubsystem<UInventorySubsystem>()
    ->GetItemDisplayName(RewardItemId);

// FORBIDDEN: UQuestSubsystem holding TObjectPtr<UDataTable> to DT_Items
```

## Alternatives Considered

### Alternative 1: UDataTable Only
- **Description**: All static data as DataTable rows; no DataAsset usage.
- **Pros**: Single consistent format; simple CSV import workflow; low overhead.
- **Cons**: Cannot subclass rows in Blueprint; nested arrays in rows require JSON import only; complex hierarchical entities become unwieldy multi-column rows.
- **Rejection Reason**: Not rejected — DataTable is the primary format. DataAssets are an escape hatch for future complex entities, not excluded entirely.

### Alternative 2: UPrimaryDataAsset Only
- **Description**: Every game entity is a DataAsset instance with Blueprint subclassing.
- **Pros**: Maximum per-entity flexibility; async streaming per asset; Blueprint-native.
- **Cons**: No built-in tabular view or CSV import; asset count explodes for bulk data (100 items = 100 files); harder for designers to batch-edit.
- **Rejection Reason**: Poor fit for bulk tabular data (items, quests, clues). DataTables are the ergonomically correct choice for fixed-schema row data.

### Alternative 3: Soft Object References (TSoftObjectPtr) for All Tables
- **Description**: Tables stored as `TSoftObjectPtr<UDataTable>` and streamed on demand via `FStreamableManager`.
- **Pros**: Lower startup memory; unloads unused tables.
- **Cons**: Requires async loading infrastructure and callback patterns throughout subsystems; at indie PC scale the memory saving is negligible against the added complexity.
- **Rejection Reason**: Complexity not justified at current project scale. Can be introduced per-subsystem later if profiling identifies table memory as a concern.

## Consequences

### Positive
- Single decision rule (tabular = DataTable, BP-subclassable = DataAsset) eliminates per-system format bikeshedding
- CSV/JSON import workflow available for all DataTables — designers can edit without opening Unreal
- Ownership rule prevents data coupling between subsystems
- Hard references guarantee tables are available from `GameInstance::Init()` — no async loading guards needed in subsystem logic

### Negative
- DataTable rows cannot be Blueprint-subclassed — if a row needs per-type custom logic, a DataAsset refactor is required
- Hard references add startup memory proportional to total row count — acceptable now, revisit if tables exceed ~50,000 rows total

### Risks
- **Risk**: A designer misspells an NPC ID when naming a `DT_Dialogue_{NPCId}` table, causing `FindRow` miss at runtime. **Mitigation**: `UDialogueSubsystem` validates all expected table names on `Initialize()` and logs warnings for missing entries in Debug builds.
- **Risk**: Table ownership rule is violated as the codebase grows. **Mitigation**: Register as a forbidden pattern (no cross-subsystem DataTable access); enforce in code review checklist.
- **Risk**: `FindRow` called with an empty `ContextString`, making lookup failures silent in logs. **Mitigation**: Register as a forbidden pattern; linting or code review catches empty context strings.
- **Risk**: `UDialogueSubsystem::DialogueTables` (`TMap<FName, TObjectPtr<UDataTable>>`) not marked `UPROPERTY()` — GC will not trace the map values and tables may be garbage collected while in use. **Mitigation**: Declare the field with `UPROPERTY()`. Enforce in code review.
- **Risk**: `FindRow` return value dereferenced without a null check, crashing on a missing row. **Mitigation**: All `FindRow` call sites must null-check the result before use. Register as a forbidden pattern (see Key Interfaces).

## GDD Requirements Addressed

| GDD System | Requirement | How This ADR Addresses It |
|------------|-------------|--------------------------|
| inventory-system.md | `DT_Items` data format referenced but unspecified | Formalises `FItemRow : FTableRowBase` owned by `UInventorySubsystem`, hard-referenced |
| quest-system.md | `DT_Quests`, `DT_QuestRewards` referenced | Formalises both tables as owned by `UQuestSubsystem` |
| crafting-system.md | Recipe data format unspecified | Introduces `DT_Recipes` / `FCraftingRecipeRow`, owned by `UInventorySubsystem` |
| dialogue-system.md | `DT_Dialogue_[NPCId]` referenced, format partially defined | Canonises naming pattern; owned by `UDialogueSubsystem` |
| investigation-system.md | `DT_Revelations`, clue data record referenced | Formalises `DT_Clues` + `DT_Revelations`, both owned by `UInvestigationSubsystem` |
| alien-ai-system.md | Perception decay configurable via DataTable | Introduces `DT_AIPerceptionTuning`, owned by `UAlienSquadSubsystem` |
| faction-reputation-system.md | OQ-6: "struct-based UObject or data table?" | Resolved: `DT_FactionBaselines` DataTable owned by `UFactionSubsystem` |
| scene-management.md | Async-loading non-world assets including "data tables" during Loading state | Hard-reference strategy means tables are already loaded before Loading state fires; scene management does not need to stream them |

## Performance Implications
- **CPU**: `FindRow` is O(log n) via internal `TMap`; negligible per-call cost at any expected row count.
- **Memory**: All tables load at startup. Estimated peak: ~10 tables × avg 500 rows × ~200 bytes/row ≈ ~1 MB total. Acceptable.
- **Load Time**: DataTables load as part of `GameInstance` initialization before first frame; no incremental loading cost.
- **Network**: N/A — single-player.

## Migration Plan
No existing code to migrate. The project has not entered implementation. GDD open question OQ-6 in faction-reputation-system.md is resolved by this ADR — no GDD edit required (the question is answered here).

## Validation Criteria
- All 9 DataTable assets listed in the System Inventory exist in `Content/Data/DataTables/` and are assigned in their owning subsystem's `EditDefaultsOnly` property before the first implementation sprint
- Every `FindRow` call site passes a non-empty `ContextString`
- No subsystem holds a `TObjectPtr<UDataTable>` to a table it does not own per the inventory above
- CSV round-trip test: export `DT_Items` to CSV, edit one row, reimport — `FindRow` returns updated data in PIE
- DataAsset pattern is used only when a BP-subclassable entity is explicitly required; no DataAssets exist for data that fits flat rows

## Related Decisions
- ADR-0001: Cross-System Communication — subsystems request data from the owning subsystem via method call, not direct DataTable access
- ADR-0004: Subsystem & Module Architecture — defines the owning subsystems and the single `HostileWorld` module; DataTable assets live in `Content/Data/` within that module's content directory
