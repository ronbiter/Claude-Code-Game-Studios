# Architecture Consistency Failures

Cross-ADR conflicts detected by `/architecture-review`. Each entry is logged when
found and updated when resolved. Unresolved entries block ADR acceptance.

---

## C6 — Infection Subsystem Tier Mismatch

| Field | Value |
|-------|-------|
| **Status** | ✅ Resolved — 2026-05-24 |
| **Detected** | 2026-05-21 (`/architecture-review`) |
| **Blocking** | ADR-0013 acceptance |

**Conflict**: ADR-0004 (Accepted) placed `UInfectionSubsystem` at Session-tier
(`UGameInstanceSubsystem`) with rationale "global spread percentage persists across
all maps." ADR-0013 (Proposed) placed `UInfectionSpreadSubsystem` at World-tier
(`UWorldSubsystem`), explicitly correcting ADR-0004 and citing GDD Rule 8 as the
mandate.

**Root cause**: ADR-0004 was authored before ADR-0013 detailed the infection
architecture. The GDD Rule 8 mandate was not consulted during ADR-0004 authoring.

**Resolution**: ADR-0013 is correct. GDD Rule 8 (line 134) states explicitly:
> `UInfectionSpreadSubsystem : public UWorldSubsystem` — "scoped to UWorld, not
> UGameInstance, to ensure infection state does not persist across world transitions"

Each world (open world, Mountain Prison, etc.) has an independent infection grid.
`OpenLevel()` correctly destroys the subsystem; `USaveLoadSubsystem` (ADR-0006)
handles disk persistence via `IHostileSaveProvider` — `UInfectionSpreadSubsystem`
registers on `Initialize()` and unregisters on `Deinitialize()`.

**Changes applied** (2026-05-24):
- `adr-0004`: Infection row in tier table updated Session→World; class renamed
  `UInfectionSubsystem`→`UInfectionSpreadSubsystem`; diagram, access pattern example,
  constraints, consequences, GDD requirements row, and validation criteria all updated
- `docs/registry/adr-data.yaml`: `save_provider_registration` consumer entry updated;
  `TODO-C6` annotation removed
- `docs/registry/adr-subsystems.yaml`: already correct (updated by ADR-0013 session)

**No GDD change required**: GDD Rule 8 always mandated World-tier. The GDD was not
wrong; ADR-0004 was.

---

## C1 — Save Schema Incomplete

| Field | Value |
|-------|-------|
| **Status** | ✅ Resolved — 2026-05-21 |
| **Detected** | 2026-05-20 (`/architecture-review`) |
| **Blocking** | ADR-0006 acceptance |

**Conflict**: ADR-0006 save schema covered only 5 subsystems; Save/Load GDD Rule 3
requires persistence for 11+ domains.

**Resolution**: ADR-0006 expanded to 12 `IHostileSaveProvider` registrants covering
all GDD Rule 3 domains. See ADR-0006 revision dated 2026-05-21.

---

## C2 — Dialogue World-Tier Persistence

| Field | Value |
|-------|-------|
| **Status** | ✅ Resolved — 2026-05-21 (verified, no changes needed) |
| **Detected** | 2026-05-20 (`/architecture-review`) |
| **Blocking** | None — resolved by existing design |

**Conflict**: Concern that `UDialogueSubsystem` (World-tier) would lose NPC
relationship data (Trust/Fear/Knowledge) across level transitions.

**Resolution**: Design already correct. Two-subsystem split was in place: volatile
conversation state lives in `UDialogueSubsystem` (World-tier, holds nothing
persistent); NPC relationship state lives in `UNPCRelationshipSubsystem`
(Session-tier). Cross-tier access (World→Session) is always safe per ADR-0004.
No changes needed.

---

## C5 — Stale Tutorial DismissedHintIDs

| Field | Value |
|-------|-------|
| **Status** | ✅ Resolved — 2026-05-21 |
| **Detected** | 2026-05-20 (`/architecture-review`) |
| **Blocking** | ADR-0004, ADR-0006 acceptance |

**Conflict**: ADR-0004 and ADR-0006 save schema included `DismissedHintIDs` in
`FTutorialSaveData`. Tutorial GDD Rule 5 removed the DISMISSED hint state, making
this field stale.

**Resolution**: `DismissedHintIDs` removed from `FTutorialSaveData` schema in ADR-0006
and from the ADR-0004 Tutorial tier rationale. `FTutorialSaveData` now contains only
completed hint IDs (step completion flags) per Tutorial GDD Rule 5.

---

## C4 — Input Rebinding Owner

| Field | Value |
|-------|-------|
| **Status** | ✅ Resolved — 2026-05-26 |
| **Detected** | 2026-05-20 (`/architecture-review`) |
| **Blocking** | None — resolved |

**Conflict**: No ADR assigned end-to-end ownership of the input rebinding feature.
ADR-0003 covered the runtime rebinding operation (`ApplyKeyRebind`,
`SaveRebindings`, `LoadRebindings` via `UEnhancedInputUserSettings`) but two sub-
ownerships remained ambiguous: (a) which subsystem owns the Settings-menu key-
capture **UI widget**, and (b) where bindings persist — EIUS own file vs ADR-0006
`USaveGame` (OQ-1 in ADR-0003).

**Resolution**:

- **Rebinding operation owner**: `AHostileWorldPlayerController` (ADR-0003) — sole
  caller of `UEnhancedInputUserSettings`. API is now `UFUNCTION(BlueprintCallable)`.
- **Rebinding UI widget owner**: `UHUDSubsystem` (ADR-0016, `ULocalPlayerSubsystem`
  tier) owns `UWidget_KeyBindingsMenu`. Widget is a thin consumer: captures `FKey`
  from the player, calls `PC::ApplyKeyRebind()` + `SaveRebindings()`. Never touches
  `UEnhancedInputUserSettings` directly.
- **Persistence location** (OQ-1): `UEnhancedInputUserSettings` own save file —
  profile-scoped, applies across all save slots. ADR-0006 explicitly **excludes**
  input bindings from `USaveGame`.

**Rationale**: Bindings are profile-scoped (apply across all save slots and new-
game sessions), so per-slot storage would force re-binding after every new game.
Epic's intended persistence path is `UEnhancedInputUserSettings`; using it avoids
hand-rolled `FKey` array serialization.

**Changes applied** (2026-05-26):
- `adr-0003`: added "Rebinding UI Ownership" + "Rebinding Persistence Location
  (OQ-1 Resolution)" subsections; `ApplyKeyRebind` / `SaveRebindings` /
  `LoadRebindings` marked `UFUNCTION(BlueprintCallable)`; OQ-1 closed; rebinding-
  vs-save risk marked resolved.
- `adr-0006`: Constraints section explicitly excludes input bindings from
  `USaveGame` and points to ADR-0003.
- `adr-0016`: added row in GDD Requirements table — `UHUDSubsystem` owns the
  Settings menu rebinding widget as a thin consumer of ADR-0003 API.
- `docs/registry/adr-input.yaml`: added `rebinding_ui_owner` state ownership +
  `rebinding_persistence` API decision + `direct_eius_access_outside_pc` forbidden
  pattern.
