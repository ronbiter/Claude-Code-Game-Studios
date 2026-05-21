# Design Directory

When authoring or editing files in this directory, follow these standards.

## GDD Files (`design/gdd/`)

Every GDD must include all **8 required sections** in this order:
1. Overview — one-paragraph summary
2. Player Fantasy — intended feeling and experience
3. Detailed Rules — unambiguous mechanics
4. Formulas — all math defined with variables
5. Edge Cases — unusual situations handled
6. Dependencies — other systems listed
7. Tuning Knobs — configurable values identified
8. Acceptance Criteria — testable success conditions

**File naming:** `[system-slug].md` (e.g. `movement-system.md`, `combat-system.md`)

**Systems index:** `design/gdd/systems-index.md` — update when adding a new GDD.

**Design order:** Foundation → Core → Feature → Presentation → Polish

**Validation:** Run `/design-review [path]` after authoring any GDD.
Run `/review-all-gdds` after completing a set of related GDDs.

## Quick Specs (`design/quick-specs/`)

Lightweight specs for tuning changes, minor mechanics, or balance adjustments.
Use `/quick-design` to author.

## UX Specs (`design/ux/`)

- Per-screen specs: `design/ux/[screen-name].md`
- HUD design: `design/ux/hud.md`
- Interaction pattern library: `design/ux/interaction-patterns.md`
- Accessibility requirements: `design/ux/accessibility-requirements.md`

Use `/ux-design` to author. Validate with `/ux-review` before passing to `/team-ui`.

## Entity Registry (`design/registry/`)

The entity registry is split into domain files for token efficiency.

**Entry point:** `design/registry/entities-index.yaml` — lists all domain files.

**Domain files (load on demand):**
- `entities-world.yaml` — factions + scene/zone constants
- `entities-items.yaml` — weapon items + inventory formulas/constants
- `entities-movement.yaml` — movement formulas/constants
- `entities-health.yaml` — health formulas/constants
- `entities-infection.yaml` — infection formulas/constants
- `entities-investigation.yaml` — investigation/stealth formulas/constants
- `entities-faction.yaml` — faction reputation formulas
- `entities-combat.yaml` — combat formula + detection constants

**Load-on-demand rule:** Read the index first. Load only the domain file(s) whose
`systems[]` list matches your current system. Cross-domain work
(`/consistency-check`, `/review-all-gdds`) loads all domain files.

**Never read `entities.yaml` directly** — it is deprecated and will not be updated.
