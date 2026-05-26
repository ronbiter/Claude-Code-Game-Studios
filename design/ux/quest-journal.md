# UX Specification: Quest Journal

> **Status**: Draft
> **Author**: ux-lead
> **Last Updated**: 2026-05-26
> **Screen / Flow Name**: `QuestJournalScreen`
> **Platform Target**: PC (Keyboard/Mouse primary, Gamepad secondary)
> **Related GDDs**: `design/gdd/quest-system.md § UI Requirements`, `design/gdd/faction-reputation-system.md`, `design/gdd/map-system.md`
> **Related ADRs**: `ADR-0003: Enhanced Input Architecture`, `ADR-0002: Game State Machine`, `ADR-0016: HUD System Architecture`
> **Related UX Specs**: `design/ux/map.md` (sibling tab — deep-link target)
> **Accessibility Tier**: Standard (WCAG 2.1 AA — default per UX Lead directive, no `accessibility-requirements.md` present)

> **Scope boundary**: Quest Journal is a tab within the Pause Menu, opened via `IA_Pause` then selecting Quest Journal tab. It is a screen (overlay, game paused). For active in-game HUD objective tracking, see `hud-design.md` (out of scope here). For the World Map deep-link target, see `design/ux/map.md`.

---

## 1. Purpose & Player Need

**What player need does this screen serve?**

The Quest Journal lets the player re-orient themselves inside a long, branching, non-linear investigation. Hostile World does not hold the player's hand — Conspiracy Thread Quests spawn passively, Survivor Contracts can stack indefinitely, and consequences fire hours after a quest closes. After a 90-minute exploration session, a player must be able to open the journal and recover the answer to a single question: *"What did I commit to, what is still open, and what did I just learn?"* The journal is the player's memory aid for a world that does not narrate itself.

**The player goal** (what the player wants to accomplish):

Locate the quest they are currently pursuing, read its current objectives, and either send themselves to its location on the map or remind themselves why they took the contract — within 10 seconds of opening the journal.

**The game goal** (what the game needs to communicate or capture):

Surface the active Conspiracy Thread Quests (non-optional, main-story-critical) without burying them under Survivor Contracts, expose every active objective so the player can prioritize, and provide a controlled deep-link into the World Map so navigation between investigation and traversal is one input away.

---

## 2. Player Context on Arrival

| Question | Answer |
|----------|--------|
| What was the player just doing? | Most common: between encounters in a hostile zone, deciding what to do next. Less common: just dismissed a consequence alert ("Aftermath" entry appeared) and wants to read the full text. Less common: returned to a safehouse, planning the next 30-60 minutes of play. |
| What is their emotional state? | Calm-to-moderate tension. The pause menu freezes the world (GSM Paused), so combat-driven panic is not the primary state. Players opening this in combat are deferring threat — they want answers fast. |
| What cognitive load are they carrying? | Moderate to high. Multiple active contracts (Quest GDD: no hard cap), competing CTQs, faction reputation pressure, possibly a ticking contract timer. The player is holding several narrative threads. |
| What information do they already have? | They know roughly which quest they took on. They may not remember exact objectives or who the quest-giver was. They likely do not remember which contract has a time limit. |
| What are they most likely trying to do? | Primary (60%): find the active quest they want to pursue next and check its current objective. Secondary (25%): check time remaining on a timed contract. Tertiary (10%): re-read a recent consequence/lore note. Rare (5%): abandon a contract. |
| What are they likely afraid of? | Letting a timed contract expire without realizing. Forgetting which NPC gave a contract (which means losing the turn-in). Missing the existence of a CTQ that spawned silently. |

**Emotional design target for this screen**:

Calm clarity. The journal is the one place in Hostile World where the player is *not* being attacked, hunted, or surprised. Information density is high but presentation is composed — handwritten field-journal aesthetic, no animations beyond functional ones, no FOMO badges screaming for attention. The player should feel they have full command of their commitments, not that they are drowning in them.

---

## 3. Navigation Position

**Screen hierarchy**:

```
Gameplay (Playing state)
  └── Pause Menu (Paused state, IA_Pause)
        ├── Resume
        ├── Quest Journal  ← THIS SCREEN
        │     ├── Active tab
        │     ├── Completed / Failed tab
        │     └── Lore Notes tab
        ├── Map  → see design/ux/map.md
        ├── Character
        ├── Settings
        └── Quit to Main Menu
```

**Modal behavior**: Overlay (renders over the game world, game paused via GSM Paused state). Pause Menu is the parent overlay; Quest Journal is a tab within it.

Dismiss behavior: `IA_Cancel` (Esc / B) returns to the Pause Menu tab bar (one level up). A second `IA_Cancel` from the tab bar resumes gameplay. The Quest Journal cannot be dismissed directly back into gameplay in a single input — this is intentional to keep the Pause Menu as the consistent root.

**Reachability — all entry points**:

| Entry Point | Triggered By | Notes |
|-------------|-------------|-------|
| Pause Menu → Quest Journal tab | Player presses `IA_Pause` in Playing state, then activates the Quest Journal tab | Primary entry — explicit player intent |
| Consequence alert "View in Journal" link | Player presses confirm on an in-world consequence toast | Deep-link entry — opens Pause Menu → Quest Journal → Lore Notes tab, scrolled to the new entry |
| HUD objective tracker context action | Tactical HUD mode: player presses `IA_OpenJournal` (held shortcut) | Direct entry — bypasses Pause Menu tab bar, lands on Active tab with most recent quest selected. Still transitions GSM to Paused. |

---

## 4. Entry & Exit Points

**Entry table**:

| Trigger | Source Screen / State | Transition Type | Data Passed In | Notes |
|---------|----------------------|-----------------|----------------|-------|
| Pause Menu tab activation | Pause Menu tab bar | Tab swap (in-place) | None — journal reads quest state from Quest Subsystem | Default tab: Active. Default selected row: most recently updated quest. |
| HUD shortcut `IA_OpenJournal` | Playing state | Overlay push (with Pause Menu as parent shell) | None | Lands on Active tab. Selected row: most recently updated quest. |
| Consequence alert "View in Journal" | Consequence toast (HUD overlay) | Overlay push | `consequence_id: string` (lore note ID) | Lands on Lore Notes tab. Scrolls to and selects the matching consequence entry. |
| Map → "Back to Journal" | Map screen | Tab swap | `quest_id: string` (optional — preserves selection context) | Returns from a Show-on-Map round-trip. Active tab, original quest still selected. |

**Exit table**:

| Exit Action | Destination | Transition Type | Data Returned / Saved | Notes |
|-------------|------------|-----------------|----------------------|-------|
| `IA_Cancel` (Esc / B) | Pause Menu tab bar | Tab deselect (in-place) | None | Single back-step. Quest state is read-only from this screen — no commits needed. |
| Activate Resume from Pause Menu | Playing state | Overlay pop (full close) | None | Standard pause menu exit. GSM returns to Playing. |
| Activate "Show on Map" on a quest | Map screen | Tab swap (sibling tab) | `{quest_id, objective_id, world_position}` | See Section 9. Map screen receives focus context. |
| Activate "Abandon Contract" (after confirmation) | Same screen, refreshed | In-place state change | `quest_id` to Quest Subsystem via event | Quest moves from Active → Abandoned. Row removes from Active list. |
| Quit to Main Menu | Main Menu | Full unload | None | Standard quit path. No journal-specific behavior. |

---

## 5. Layout Specification

### 5.1 Wireframe

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  HOSTILE WORLD                                            [X Close]  [? Help]│  ← PAUSE MENU HEADER (shared)
│  [Resume]  [● Journal]  [Map]  [Character]  [Settings]  [Quit]               │  ← PAUSE MENU TAB BAR
├──────────────────────────────────────────────────────────────────────────────┤
│  QUEST JOURNAL                                                               │  ← SCREEN TITLE BAR
│  [● Active (4)]   [ Completed / Failed (7)]   [ Lore Notes (3) ]             │  ← JOURNAL TAB BAR
├──────────────────────────────────────────────────────────────────────────────┤
│ ┌────────────────────────────────┐ ┌─────────────────────────────────────┐  │
│ │ QUEST LIST                     │ │ QUEST DETAIL                        │  │
│ │                                │ │                                     │  │
│ │ ─ CONSPIRACY THREADS ─         │ │  ┌─ TYPE ─┐                         │  │
│ │ ● [⊚] Find the Military Lab    │ │  │ THREAD │  Find the Military Lab  │  │
│ │     CONFIRMED · 2/3 done       │ │  └────────┘                         │  │
│ │                                │ │                                     │  │
│ │ ─ SURVIVOR CONTRACTS ─         │ │  Investigation: Immunity Cause      │  │
│ │   [⌖] Rescue the Brother       │ │  Status: ACTIVE — Confirmed         │  │
│ │       Sarah · ACTIVE           │ │                                     │  │
│ │   [⌖] Sabotage the Dam         │ │  Documents from Subject Zero's      │  │
│ │       Marcus · ACTIVE · ⏱ 47m  │ │  cell reference a military research │  │
│ │   [⌖] Supplies for the Camp    │ │  facility north of the sulfur      │  │
│ │       Nadia · ACTIVE           │ │  flats. Find it.                   │  │
│ │                                │ │                                     │  │
│ │ ...                            │ │  OBJECTIVES                         │  │
│ │                                │ │  ☑ Read Subject Zero's documents   │  │
│ │                                │ │  ☑ Speak to The Watch about the lab│  │
│ │                                │ │  ☐ Locate the lab entrance         │  │
│ │                                │ │  ☐ [Optional] Recover field notes  │  │
│ │                                │ │                                     │  │
│ │                                │ │  Quest Giver: (Thread — automatic) │  │
│ │                                │ │  Faction: (none)                    │  │
│ └────────────────────────────────┘ └─────────────────────────────────────┘  │
├──────────────────────────────────────────────────────────────────────────────┤
│  [▶ Show on Map]   [✗ Abandon]   [⊠ Track]                  [Esc] Back       │  ← ACTION BAR
└──────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Zone Definitions

| Zone Name | Description | Approximate Size | Scrollable? | Overflow Behavior |
|-----------|-------------|-----------------|-------------|-------------------|
| Pause Menu Header | Shared with parent Pause Menu — title and global close/help | Full width, ~6% height | No | Truncate help label only |
| Pause Menu Tab Bar | Shared with parent — Resume / Journal / Map / Character / Settings / Quit | Full width, ~5% height | No | Tabs are fixed-width; cannot overflow at supported resolutions |
| Screen Title Bar | "QUEST JOURNAL" label | Full width, ~5% height | No | N/A |
| Journal Tab Bar | Active / Completed-Failed / Lore Notes — with counts | Full width, ~5% height | No | Counts truncate at 99+ |
| Quest List | Left panel — grouped, scrollable list of quests | ~40% width, ~70% height | Yes (vertical) | Scroll indicator on right edge. No pagination — single scroll list with group headers. |
| Quest Detail | Right panel — full detail of selected quest | ~60% width, ~70% height | Yes (vertical) | Long descriptions scroll within panel. Objective list does not scroll separately — entire detail panel scrolls as one body. |
| Action Bar | Bottom — context actions for selected quest | Full width, ~9% height | No | Actions hide when not applicable (Abandon hidden for CTQs). If all actions hide, "[Esc] Back" hint remains. |

### 5.3 Component Inventory

| Component Name | Type | Zone | Purpose | Required? | Reuses Existing Component? |
|----------------|------|------|---------|-----------|---------------------------|
| PauseMenuShell | Container | Header + Tab Bar | Shared shell — owns global close, tab bar | Yes | Yes — `WBP_PauseMenuShell` (shared across all pause tabs) |
| JournalTabBar | Tab Group | Journal Tab Bar | Active / Completed-Failed / Lore Notes tabs | Yes | No — new component, reusable as `WBP_TabBar` |
| TabBadgeCount | Numeric Badge | Journal Tab Bar | Shows count next to each tab label (e.g., "Active (4)") | Yes | No — new, reusable |
| QuestListGroup | Section Header | Quest List | "Conspiracy Threads" / "Survivor Contracts" / "Completed" / "Failed" / "Abandoned" group headers | Yes | No — new |
| QuestListRow | List Item | Quest List | One quest entry — icon, name, status sub-line | Yes | No — new, central component of this screen |
| QuestTypeBadge | Inline Badge | Quest List Row + Detail | "THREAD" or "CONTRACT" — visually distinct (silver for Thread, gold for Contract) | Yes | No — new |
| QuestStatusLabel | Text + Optional Icon | Quest List Row | "ACTIVE" / "COMPLETED" / "FAILED" / "ABANDONED" / "CONFIRMED" / "REVEALED" | Yes | No — new |
| TimerPill | Compound (icon + countdown text) | Quest List Row + Detail | Shows time remaining on timed contracts ("⏱ 47m") | Yes (when applicable) | No — new |
| ObjectiveRow | Compound (checkbox + label) | Quest Detail | One objective with completion state and optional flag | Yes | No — new |
| OptionalTag | Inline Badge | Objective Row | Marks "[Optional]" objectives | Yes | Yes — generic `Tag` component |
| QuestGiverLabel | Compound (NPC name + faction icon) | Quest Detail | "Sarah — The Tethered" | Yes | No — new |
| FactionIcon | Icon | Quest Detail + Quest List Row | Per-faction icon (Remnant / Tethered) | Yes | Yes — `WBP_FactionIcon` (shared with Faction UI) |
| QuestDescriptionBody | Rich Text | Quest Detail | Multi-paragraph description with quest flavor | Yes | Yes — `BodyText` component |
| ShowOnMapButton | Primary Button | Action Bar | Deep-links to Map screen | Yes | Yes — `PrimaryAction` component |
| AbandonButton | Destructive Button | Action Bar | Abandons selected Survivor Contract (hidden for CTQs) | Yes | Yes — `DestructiveAction` component |
| TrackToggle | Toggle Button | Action Bar | Sets/unsets this quest as the HUD-tracked quest (Tactical mode only) | Yes | No — new |
| AbandonConfirmDialog | Modal Dialog | Overlay | Confirms abandon action | Yes | Yes — `ConfirmDialog` component |
| LoreNoteCard | Card | Quest List (Lore Notes tab) | Single consequence/lore entry — date, source quest, body text | Yes | No — new |
| EmptyStateMessage | Compound (icon + text) | Quest List | Shown when tab has no entries | Yes | Yes — `EmptyState` component |
| ErrorStateMessage | Compound (icon + text + retry) | Quest List | Shown if Quest Subsystem query fails | Yes | Yes — `ErrorState` component |
| LoadingShimmer | Skeleton | Quest List + Detail | Brief shimmer while data resolves on tab open | Yes | Yes — `Skeleton` component |

**Primary focus element on open**: The first row in the Active tab list. If a CTQ is present, that is the first row (CTQs are sorted above Contracts). If no quests exist in Active, focus lands on the Journal Tab Bar at the Active tab.

---

## 6. States & Variants

| State Name | Trigger | What Changes Visually | What Changes Behaviorally | Notes |
|------------|---------|----------------------|--------------------------|-------|
| Loading | Tab activated, Quest Subsystem query in flight | Quest List shows 6 skeleton rows; Quest Detail shows skeleton placeholders | All interactions disabled except IA_Cancel and tab swap | Should resolve in <100ms — Quest Subsystem reads cached state. If visible >300ms, log a perf warning. |
| Empty — Active (no quests yet) | Player has not accepted any contracts and no CTQ has spawned | Quest List replaced with EmptyStateMessage: "No active quests. Talk to survivors. Investigate the world." | Action bar buttons hidden; "[Esc] Back" hint visible | Possible at the very start of the game. The empty state is a quiet prompt, not a tutorial. |
| Empty — Completed/Failed | Player has not closed or failed any quests | EmptyStateMessage: "No completed or failed quests yet." | Same as above | Common early-game state |
| Empty — Lore Notes | No consequences have fired | EmptyStateMessage: "Consequences will be recorded here." | Same as above | Becomes populated as quests close and consequences fire |
| Populated — Active | At least one quest is Active or Completed-pending-turn-in | Quest List populated, grouped by Threads then Contracts. First row auto-focused. Detail panel populated. | All applicable action bar buttons enabled | Default state for any mid-game session |
| Populated — Completed/Failed | At least one quest has reached Closed, Failed, or Abandoned | Quest List grouped: Completed (most recent first) → Failed → Abandoned | Action bar: Show on Map enabled if quest had a location; Abandon / Track hidden | Closed quests are read-only history |
| Populated — Lore Notes | At least one consequence has fired | LoreNoteCard list, sorted by discovery date descending. First card auto-focused. Detail panel shows full body text. | Action bar: Show on Map enabled if the consequence references a location; other actions hidden | New (unread) notes show a small dot indicator until focused once |
| Quest Selected — CTQ | Player navigates to a Conspiracy Thread Quest row | Detail panel shows THREAD badge (silver), no quest-giver line, no Abandon button | Abandon button hidden; Show on Map enabled if mappable; Track toggle enabled | CTQs are non-optional per GDD Rule 3 |
| Quest Selected — Contract | Player navigates to a Survivor Contract row | Detail panel shows CONTRACT badge (gold), quest-giver line populated, all action buttons visible | Abandon button visible (and enabled if Active); Show on Map enabled if mappable; Track toggle enabled | Standard contract state |
| Quest Selected — Timed Contract | Selected contract has T_limit > 0 | TimerPill visible next to status in both list row and detail header. Text updates every 1s based on game time. | Same actions as Quest Selected — Contract | Timer freezes while GSM is Paused (game time does not advance) — per Quest GDD EC |
| Quest Selected — Failed | Player navigates to a Failed quest in Completed/Failed tab | Detail panel shows red FAILED status; description includes failure reason ("Quest-giver killed", "Time expired", etc.) | Action bar: Show on Map enabled (if location known) for replay reference; Abandon / Track hidden | Failed CTQs may auto-retrigger per GDD Rule 8 — they appear here briefly then move back to Active |
| Quest Selected — Abandoned | Player navigates to an Abandoned quest | Detail panel grays out; status "ABANDONED"; description notes that completed objectives were reset | Action bar: Show on Map disabled; Abandon hidden; Track hidden. A "Re-accept" hint shows only if quest is still available from its NPC | Per GDD Rule 8: abandoned contracts can be re-accepted via dialogue |
| Confirmation Pending — Abandon | Player activates Abandon button | AbandonConfirmDialog overlays the screen: "Abandon [Quest Name]? Completed objectives will be reset. This cannot be undone." [Cancel] [Abandon] | All background interactions suspended | Modal — required because the action resets quest progress and is irreversible |
| Error — Quest Subsystem unavailable | Quest Subsystem returns null or fails | ErrorStateMessage: "Could not load quests. [Retry]" | Only Retry and Esc Back active | Should not happen in normal play. Logs error. |
| New Lore Note Indicator | A consequence fires while the journal is closed | When journal reopens, Lore Notes tab shows a "•" badge next to its count. The unread card has a "NEW" tag until focused once. | Tag clears on first focus of that card | Persists across sessions until viewed |

---

## 7. Interaction Map

### 7.1 Navigation Inputs

| Input | Platform | Action | Visual Response | Audio Cue | Notes |
|-------|----------|--------|-----------------|-----------|-------|
| Up / Down arrow / D-Pad Up-Down | All | Move focus within Quest List (skipping group headers) | Focus ring moves to next/previous quest row | Soft navigation tick | Wraps at top/bottom of list. Group headers are visual only — not focusable. |
| Left / D-Pad Left | All | When focus is on a Quest List row: no-op (list is single-column). When focus is on a Detail scroll: returns focus to Quest List. When focus is on Action Bar: moves to previous action. | Focus ring shifts | Soft tick | |
| Right / D-Pad Right | All | When focus is on Quest List row: moves focus into Detail panel (for scrolling long descriptions). When in Detail: scrolls or moves to Action Bar. When on Action Bar: next action. | Focus ring shifts | Soft tick | |
| Tab / RB (R1) | KB / Gamepad | Move focus to next zone: Journal Tab Bar → Quest List → Action Bar → loops | Focus ring jumps to first focusable in next zone | Distinct zone-change tone | Shift+Tab / LB reverses |
| Q / E / LB / RB | KB / Gamepad | Cycle Journal tabs: Active ↔ Completed-Failed ↔ Lore Notes | Tab indicator slides; list reloads | Tab swap tone | Faster than mouse navigation to tab bar — common power-user shortcut |
| Mouse hover | PC | Show hover state on interactive elements (rows, tabs, buttons) | Subtle background lighten, no focus movement | None | Hover does not commit focus — only click does |
| Mouse click on quest row | PC | Select and focus the row | Row highlights and shows selected state; Detail panel updates | Soft select tone | |
| Mouse wheel scroll | PC | Scroll the zone under the cursor (Quest List or Detail panel) | Content scrolls smoothly | None | Direction follows OS scroll-direction preference |
| Mouse click on tab | PC | Activate clicked tab | Tab indicator moves | Tab swap tone | |
| Page Up / Page Down | KB | Jump 6 rows in Quest List | Focus ring jumps; list scrolls if needed | Soft tick | Convenience for long completed lists |
| Home / End | KB | Jump to first / last quest in list | Focus ring jumps to top or bottom | Soft tick | |

### 7.2 Action Inputs

| Input | Platform | Context | Action | Response | Animation | Audio Cue | Notes |
|-------|----------|---------|--------|----------|-----------|-----------|-------|
| Enter / A / Left click | All | Quest List row focused | Confirm selection (re-asserts focus + ensures Detail is fully scrolled to top) | Detail panel scrolls to top | Cross-fade content 120ms | Soft select tone | If row is already selected: no-op |
| Enter / A / Left click | All | Action Bar button focused | Activate the action | Button press flash; downstream effect (map open, confirm dialog, track toggle) | Press scale 95%→100% (60ms) | Confirm tone | |
| M / X (gamepad) | KB / Gamepad | Quest List row focused with mappable objective | Quick "Show on Map" without traversing to Action Bar | Map screen opens with deep-link | Tab swap to Map (200ms) | Map-open tone | Shortcut equivalent to Show on Map button |
| T / Y (gamepad) | KB / Gamepad | Quest List row focused | Toggle Track for this quest (Tactical HUD only) | TrackToggle pill in Action Bar flips on/off; small "TRACKING" badge appears on the row | Badge fade 80ms | Track tone | If HUD is in Immersive mode, action still fires but only persists state — no in-world indicator |
| Backspace / X (gamepad) | KB / Gamepad | Survivor Contract row focused, contract is Active | Initiate Abandon — opens AbandonConfirmDialog | Dialog scales up from 95% (150ms) | Warning tone | Modal | CTQs are exempt — action is a no-op |
| Enter / A | All | AbandonConfirmDialog focused on "Abandon" button | Confirm abandon — fires DropQuestRequested event | Dialog dismisses; quest row removes from Active list and reappears in Completed/Failed tab as Abandoned | Dialog scale-out 150ms | Quest-failed tone (soft, descending) | Per Quest GDD Rule 8: no relationship penalty |
| Esc / B | All | AbandonConfirmDialog open | Cancel abandon — dismiss dialog | Dialog scales out, focus returns to row | Dialog scale-out 150ms | Cancel tone | |
| Esc / B | All | Journal Tab open (no dialog) | Return to Pause Menu tab bar | Journal tab content fades 200ms | Cross-fade | Back tone | One back-step — not full close to gameplay |
| F / Y (gamepad) | KB / Gamepad | Any state | Open Help / Legend overlay (explains badges, status terms) | Help overlay slides in from right (250ms) | Panel open tone | Help is a future-proof feature; at Vertical Slice it shows a static text panel | |
| Mouse wheel scroll in Detail panel | PC | Hover over Detail | Scroll long quest descriptions | Detail content scrolls | None | | |

### 7.3 State-Specific Behaviors

| State | Input Restriction | Reason |
|-------|------------------|--------|
| Loading | All inputs disabled except IA_Cancel and tab swap | No data to act on — prevents race conditions |
| Empty (any tab) | Quest List inputs disabled (nothing to focus); tab swap and Esc remain active | No quests exist to interact with |
| AbandonConfirmDialog open | Only Confirm, Cancel, and dialog navigation active | Modal — background locked |
| Error state | Only Retry and Esc Back active | No quest data available |
| Quest is Abandoned | Track and Abandon hidden; Show on Map disabled | Abandoned quests are inert; only available action is to re-accept via dialogue with the NPC (outside this screen) |
| Quest is Failed | Track and Abandon hidden; Show on Map enabled if location known | Failed quests are read-only history; map link is for reference only |

---

## 8. Data Requirements

| Data Element | Source System | Update Frequency | Who Owns It | Format | Null / Missing Handling |
|--------------|--------------|-----------------|-------------|--------|------------------------|
| Active quest list | Quest Subsystem | On screen open; on `OnQuestStateChanged` event while open | Quest Subsystem | Array of `FQuestRuntime` structs: `{quest_id, quest_type, name, status, quest_giver_npc_id, faction_id, objectives, description, time_limit_remaining_s, mappable, world_position}` | Empty array → Empty state. Never null. |
| Objective list per quest | Quest Subsystem | Same event | Quest Subsystem | Array of `FObjectiveRuntime`: `{objective_id, type, description, is_complete, is_optional, is_sequential, target_world_position}` | Empty array → "No objectives" placeholder (rare — likely error state). |
| Completed / Failed / Abandoned quest history | Quest Subsystem | On screen open; on quest state transitions while open | Quest Subsystem | Same as active list, with `status ∈ {Closed, Failed, Abandoned}` and `completion_timestamp` | Empty → Empty state |
| Lore notes (consequence entries) | Quest Subsystem (Consequence System) | On screen open; on `OnConsequenceFired` event while open | Quest Subsystem | Array of `FLoreNote`: `{note_id, source_quest_id, discovery_timestamp, title, body_text, world_position (optional), is_read}` | Empty → Empty state. `is_read` defaults to false for new entries. |
| Quest-giver NPC data | Dialogue System | On detail panel populate | Dialogue System | `{npc_id, display_name, faction_id, current_location_known}` | If NPC is dead → show "Deceased" in place of name. If location is unknown → omit location subline. |
| Faction membership for quest-giver | Faction Reputation System | On detail panel populate | Faction System | `{faction_id, display_name, icon_id}` | If NPC has no faction → omit FactionIcon. |
| Current game time | Game State Machine | Per-frame while timed quest is visible | GSM | float (game seconds) | Used to compute TimerPill display. Frozen while GSM is Paused. |
| Tracked quest ID | HUD Subsystem | On screen open; on Track toggle | HUD Subsystem | `quest_id: string` (nullable — only one tracked at a time) | If null → no row shows the "TRACKING" badge. |
| HUD mode (Tactical / Immersive) | HUD Subsystem | On screen open | HUD Subsystem | enum | Track toggle is enabled in both modes (state still persists) but only visible in-world in Tactical mode. |

> **Rule**: This screen reads from Quest Subsystem and writes nothing directly. All mutations fire events (see Section 9).

---

## 9. Events Fired

| Player Action | Event Fired | Payload | Receiver System | Notes |
|---------------|-------------|---------|-----------------|-------|
| Player activates "Show on Map" | `QuestJournalShowOnMapRequested` | `{quest_id: string, objective_id: string, world_position: FVector}` | UI Navigation Controller + Map Screen | UI Navigation Controller swaps Pause Menu tab to Map. Map screen receives the payload and centers/highlights the target marker. See `design/ux/map.md § 4 Entry`. |
| Player activates "Abandon" and confirms | `DropQuestRequested` | `{quest_id: string}` | Quest Subsystem | Quest Subsystem validates, transitions quest to Abandoned state, fires `OnQuestStateChanged`. Journal listens to `OnQuestStateChanged` and re-renders. |
| Player toggles "Track" | `TrackedQuestChanged` | `{quest_id: string \| null, is_tracked: bool}` | HUD Subsystem | HUD updates objective tracker in-world (Tactical mode only). Untracking sends `null`. |
| Player opens a lore note for the first time | `LoreNoteRead` | `{note_id: string}` | Quest Subsystem (Consequence System) | Marks the note as read. Clears NEW tag. |
| Journal tab opened | `QuestJournalOpened` | `{tab: "active" \| "completed_failed" \| "lore_notes", quest_count: int}` | Analytics System | Session metric only. No game-state effect. |
| Journal tab closed | `QuestJournalClosed` | `{session_duration_ms: int, final_tab: string}` | Analytics System | Session metric only |
| Player switches tabs within journal | `QuestJournalTabChanged` | `{from_tab: string, to_tab: string}` | Analytics System | Session metric only |
| Player selects a quest row | `QuestJournalQuestSelected` | `{quest_id: string, quest_type: "thread" \| "contract"}` | Analytics System | Session metric only |

---

## 10. Transition & Animation

| Transition | Trigger | Direction / Type | Duration (ms) | Easing | Interruptible? | Skipped by Reduced Motion? |
|------------|---------|-----------------|--------------|--------|----------------|---------------------------|
| Journal tab enter (from Pause Menu tab bar) | Tab activated | Cross-fade content | 180 | Ease out | No | Yes — instant swap |
| Journal tab exit (Esc) | Player presses Esc | Cross-fade content | 180 | Ease in | No | Yes — instant |
| Sub-tab swap (Active ↔ Completed-Failed ↔ Lore Notes) | Tab clicked / Q-E shortcut | Slide list 8px + cross-fade 120ms | 120 | Linear | Yes — if double-tapped, latest wins | Yes — instant |
| Quest List row focus change | Up/Down navigation | Focus ring slides to new row | 80 | Ease out | Yes — keyboard repeat cancels | No — focus ring is essential feedback |
| Detail panel content swap | New quest selected | Cross-fade content | 120 | Linear | Yes — fast navigation cancels prior | Yes — instant swap |
| Timer text update | Game tick (every 1s) | Direct text replace | 0 | N/A | N/A | N/A |
| Action Bar button press | Player activates a button | Scale 100%→95%→100% | 60 down / 60 up | Ease out / ease in | Yes — release early returns | No — tactile feedback retained |
| AbandonConfirmDialog open | Player activates Abandon | Background dims 60%; dialog scales 95%→100% | 150 | Ease out | No | Yes — instant appear at 100% scale |
| AbandonConfirmDialog dismiss | Confirm or Cancel | Reverse of open | 150 | Ease in | No | Yes — instant |
| LoreNote NEW badge fade-in | Card first rendered | Opacity 0→1 + scale 0%→110%→100% | 200 | Ease out back | No | Yes — instant at 100% |
| NEW badge clear (on first focus) | LoreNoteRead event | Fade out opacity 1→0 | 150 | Linear | No | Yes — instant disappear |
| Show on Map navigation | Player activates Show on Map | Sub-tab slide-out left + Map sub-tab slide-in right | 200 | Ease in / Ease out | No | Yes — instant tab swap |

---

## 11. Input Method Completeness Checklist

**Keyboard**
- [x] All interactive elements reachable using Tab and arrow keys alone
- [x] Tab order: Pause Menu Tab Bar → Journal Tab Bar → Quest List → Action Bar → loops
- [x] Every mouse action has a keyboard equivalent (click → Enter, hover → focus, scroll → arrows / Page Up-Down)
- [x] Focus is visible at all times (focus ring drawn in accent color, 2px stroke, never hidden)
- [x] Focus does not escape the screen — when at Action Bar last element, Tab wraps to top of Journal Tab Bar
- [x] Esc returns to Pause Menu tab bar; does not quit the game

**Gamepad**
- [x] All elements reachable with D-Pad and face buttons
- [x] Face button mapping: A = Confirm, B = Back, X = Abandon (when on Contract row), Y = Help. RB/LB cycle sub-tabs. R1/L1 same as RB/LB.
- [x] No analog stick precision required — D-Pad navigation only
- [x] Trigger usage: none (reserved for future zoom on Map screen)
- [x] Controller disconnect while open: pause input poll halts, journal remains visible. On reconnect, focus restores to last focused element.

**Mouse**
- [x] Hover states defined for: tab bar buttons, quest list rows, action bar buttons, LoreNote cards
- [x] All hit targets minimum 32x32px (quest rows are ~48px tall, action buttons ~44px tall, tab labels ~40px tall)
- [x] Right-click: opens contextual quick-action menu on quest rows (Show on Map / Track / Abandon). On all other elements: no-op.
- [x] Scroll wheel scrolls the zone under the cursor (Quest List or Detail Panel). If cursor is over Header / Tab Bar / Action Bar, scroll is a no-op.

**Touch** — Not applicable (PC-only target per `technical-preferences.md`)

---

## 12. Screen-Level Accessibility Requirements

**Accessibility Tier**: Standard (WCAG 2.1 AA).

**Text contrast requirements**:

| Text Element | Background Context | Required Ratio | Current Ratio | Pass? |
|--------------|-------------------|---------------|---------------|-------|
| Quest name in list row | Dark journal panel (~#1a1a1a paper-tinted) | 4.5:1 | Verify in implementation against ArtBible swatches | [ ] |
| Quest status label ("ACTIVE" / "FAILED" etc.) | Dark panel | 4.5:1 | Verify | [ ] |
| Objective description text | Mid-tone panel (~#252525) | 4.5:1 | Verify | [ ] |
| Optional tag label | Sub-tone panel | 4.5:1 | Verify | [ ] |
| Timer countdown text | Dark panel | 4.5:1 — and timer color (urgent red below 5min) must not be the sole urgency cue | Verify | [ ] |
| Action button labels (Show on Map, Abandon, Track) | Button color (varies: primary, destructive, toggle) | 4.5:1 each variant | Verify | [ ] |
| Tab bar labels (active / inactive) | Tab background | 4.5:1 active state, 4.5:1 inactive state | Verify | [ ] |
| FAILED status label (red) | Dark panel | 4.5:1 — red color reinforced with FAILED text and red border | Verify | [ ] |
| Quest-giver "Deceased" text | Dark panel | 4.5:1 — supplemented with skull icon | Verify | [ ] |

**Colorblind-unsafe elements and mitigations**:

| Element | Colorblind Risk | Mitigation |
|---------|----------------|------------|
| QuestTypeBadge (silver for Thread, gold for Contract) | Difficult to distinguish for some color vision types | Badges include text labels "THREAD" and "CONTRACT" — color is supplemental, not sole differentiator |
| Quest status colors (gray = abandoned, red = failed, green = completed, blue = active) | Red-green colorblindness most common | Each status has a text label and a distinct icon: failed = ✗, completed = ✓, active = ●, abandoned = ⊘ |
| Timer urgency color (turns red below 5 minutes remaining) | Red-only signaling would fail color blindness | Below 5 minutes, timer also bolds and prefixes with "!" — color is a redundant indicator |
| FactionIcon color coding (per faction) | Some faction colors may collide | Each faction has a distinct symbol/glyph; color is secondary identifier |

**Focus order** (Tab key sequence):

1. Resume (Pause Menu tab bar)
2. Quest Journal tab (active)
3. Map tab
4. Character tab
5. Settings tab
6. Quit tab
7. Active sub-tab (Journal Tab Bar)
8. Completed/Failed sub-tab
9. Lore Notes sub-tab
10. First quest row in Quest List
11. ... subsequent quest rows in display order ...
12. Last quest row
13. Show on Map button (Action Bar)
14. Track toggle (Action Bar)
15. Abandon button (Action Bar, if visible)
16. Help button (Action Bar)
17. → wraps back to Resume

Detail panel is not in the focus order — it is a display-only panel driven by Quest List focus. Detail panel becomes focusable only when long content requires scrolling, in which case focus enters via Right arrow / D-Pad Right and Tab skips it otherwise.

**Screen reader announcements**:

| State Change | Announcement Text | Announcement Timing |
|--------------|------------------|---------------------|
| Journal tab opens | "Quest Journal. Active tab. [N] active quests. [M] completed or failed. [K] lore notes." | On focus settle |
| Sub-tab change | "[Tab name] tab. [N] entries." | On tab activation |
| Quest row focused | "[Quest type]. [Quest name]. [Status]. [N] of [M] objectives complete. [Quest giver name, if Contract]. [Time remaining, if timed]." | On focus arrival |
| Objective focused (within detail) | "[Objective description]. [Complete / Not complete]. [Optional, if applicable]." | On focus arrival |
| Track toggled on | "[Quest name] is now tracked." | After TrackedQuestChanged event confirmed |
| Track toggled off | "Tracking off." | After event confirmed |
| Show on Map activated | "Showing [Quest name] on map." | Before transition |
| Abandon confirm opens | "Confirm abandon [Quest name]? Completed objectives will be reset." | On dialog appear |
| Abandon confirmed | "[Quest name] abandoned." | After DropQuestRequested confirmed |
| Empty state shown | "No active quests yet. Talk to survivors. Investigate the world." | When empty state renders |
| Lore note new tag | "New consequence: [Note title]." | When card first renders (Lore Notes tab) |

**Cognitive load assessment**:

Active streams the player tracks on this screen: (1) which tab is active, (2) which quest is selected, (3) what the current objectives are, (4) time remaining on any timed contract, (5) which actions are available in the action bar. That is 5 concurrent streams — within the standard 7±2 limit.

Mitigations: detail panel auto-updates on row navigation (no manual fetch); Active tab is opened by default; the most recently updated quest is auto-focused so the player rarely needs to scroll to find their current intent; non-applicable actions are removed from the Action Bar (not disabled) to reduce decision noise.

---

## 13. Localization Considerations

**General rules for this screen**:
- All text elements tolerate ≥40% expansion from English baseline.
- RTL layout: Quest List moves to right side, Detail panel to left side, tab bar reverses order, focus traversal direction inverts.
- CJK languages: text may be 20-30% shorter — layouts must not look broken with short labels.
- No baked-in text — all strings via localization tables.

| Text Element | English Baseline | Max Characters | Expansion Budget | RTL Behavior | Overflow Behavior | Risk |
|--------------|-----------------|----------------|-----------------|--------------|-------------------|------|
| Screen title "QUEST JOURNAL" | 13 chars | 24 chars | 85% | Mirror to left side | Truncate with ellipsis | Low |
| Tab labels "Active" / "Completed / Failed" / "Lore Notes" | 6 / 19 / 10 chars | 30 chars each | 58% (worst case) | Tabs mirror, text right-aligns | Truncate with tooltip showing full label | Medium — German equivalents will stretch |
| Quest name | ~20-40 chars avg | 80 chars | 100%+ | Right-align in RTL | Truncate with ellipsis at row; full name in Detail panel header | Medium — quest names can be long ("Sabotage the Resistance Dam Operation") |
| Objective description | ~50-100 chars | 250 chars | 150% | Right-align, wrap normally | Scroll within Detail | Low — Detail is scrollable |
| Quest description | ~150-400 chars | 1500 chars | 275% | Right-align, wrap normally | Scroll within Detail | Low |
| Status label ("ACTIVE", "FAILED", etc.) | 6-9 chars | 16 chars | 78% | Mirror | Truncate (rare given short source) | Low |
| Quest type badge ("THREAD" / "CONTRACT") | 6 / 8 chars | 14 chars | 75% | Mirror | Shrink font to 90% then truncate | Low |
| Action button labels (Show on Map, Abandon, Track) | 11 / 7 / 5 chars | 24 chars each | 118% (Track) / 220% (Show on Map worst case) | Button content right-aligns | Wrap to 2 lines if needed; else truncate | High — "Show on Map" in German ("Auf Karte zeigen") is 16 chars, expansion within budget. Track ("Verfolgen") fits at 9 chars. |
| Timer text "47m" / "1h 12m" / "Expired" | 3-12 chars | 16 chars | 33% | Mirror digits per locale | Truncate; expired state shows "EXP." | Low |
| Empty state messages | ~30-60 chars | 120 chars | 100% | Mirror | Wrap to 3 lines | Low |
| Quest giver line "Sarah — The Tethered" | ~20 chars | 60 chars | 200% | Mirror | Truncate with tooltip | Medium |
| Lore note titles | ~20-40 chars | 80 chars | 100% | Right-align | Truncate with ellipsis on card | Medium |

---

## 14. Acceptance Criteria

**Performance**
- [ ] Journal tab opens (first frame visible) within 200ms of trigger on minimum-spec hardware
- [ ] Quest list fully populated and interactive within 500ms of trigger
- [ ] Navigation between quest rows produces no perceptible frame drop (maintain target 60fps ±5fps)
- [ ] Timer text updates do not cause re-layout (updates only the text span, not the row)

**Layout & Rendering**
- [ ] Renders correctly at 1920x1080, 2560x1440, 3840x2160
- [ ] Renders correctly at 1280x720 minimum supported resolution
- [ ] Renders correctly at 16:9, 16:10, 21:9 aspect ratios
- [ ] No text overflow or truncation in English within defined max-character bounds
- [ ] No text overflow or truncation in German (the longest-translation target)
- [ ] All states render correctly: Loading, Empty (each tab), Populated, Quest Selected (CTQ / Contract / Timed / Failed / Abandoned), Confirmation Pending, Error
- [ ] Quest List scrolls smoothly with 50+ quests populated (Quest GDD `QuestLogHistorySize` default = 50)
- [ ] Group headers in Quest List stay visible while scrolling within their group (sticky-to-scroll if supported by UI framework; otherwise inline)

**Input**
- [ ] All elements reachable via keyboard (Tab + arrows + Page Up/Down + Home/End)
- [ ] All elements reachable via gamepad (D-Pad + face buttons + LB/RB for tab cycling)
- [ ] All elements reachable via mouse (click + scroll wheel)
- [ ] No action requires simultaneous input combinations
- [ ] Focus is visible at all times during keyboard/gamepad navigation
- [ ] Focus does not escape the screen while it is open
- [ ] Esc / B returns to Pause Menu tab bar (single back-step), does not quit gameplay directly

**Events & Data**
- [ ] All events in Section 9 fire with correct payloads on all exit paths (verify via debug log)
- [ ] Screen never writes directly to Quest Subsystem state (verify: no direct mutation calls — all changes via events)
- [ ] Quest changes made by other systems while journal is open are reflected within 1 frame (subscribe to `OnQuestStateChanged`)
- [ ] Track toggle persists across screen open/close (state owned by HUD Subsystem)
- [ ] Lore note `is_read` flag persists after card is focused once

**Accessibility**
- [ ] All text passes 4.5:1 contrast ratio per Section 12 table
- [ ] No information conveyed by color alone — every color-coded element has a redundant text label, icon, or shape cue
- [ ] Screen reader announces quest name, status, objective count, and giver on focus (verify with NVDA on PC)
- [ ] Reduced motion setting results in instant transitions (verify by toggling OS-level Reduce Motion)
- [ ] Focus ring visible against all panel backgrounds (verify with HUD-mode-equivalent palette)
- [ ] All interactive targets ≥32x32px (verify with overlay grid)

**Localization**
- [ ] No text element overflows its container in English, German, French, Spanish, Brazilian Portuguese, Japanese, Korean, Simplified Chinese
- [ ] RTL layout (Arabic) mirrors correctly: tab order, focus direction, panel positions, action bar order
- [ ] All text driven by localization strings — verify by scanning the screen's `.uasset` for hardcoded display strings (none expected)
- [ ] Timer format respects locale (e.g., "47m" → "47分" for ja, "47分鐘" for zh)
- [ ] Date format on completed quests respects locale (e.g., consequence discovery timestamp on lore notes)

**Quest-System-Specific**
- [ ] CTQs always render above Survivor Contracts within the Active tab list
- [ ] Abandon button is hidden for CTQs (per Quest GDD Rule 3: CTQs are non-optional)
- [ ] Timer freezes while GSM is in Paused state — game time does not advance (per Quest GDD EC)
- [ ] Abandoning a contract resets its completed objectives (per Quest GDD Rule 8 — verify by re-accepting and confirming reset)
- [ ] A new Lore Note shows NEW badge until first focus, then clears (verify across save/load cycle)
- [ ] Failed CTQ remains in Failed list briefly, then moves back to Active when re-triggered (per Quest GDD Rule 8)

---

## 15. Open Questions

| Question | Owner | Deadline | Resolution |
|----------|-------|----------|-----------|
| Should Quest Journal expose investigation thread clue text (full or synthesized)? Per Quest GDD OQ-8 the journal shows thread synthesis; this spec scopes Lore Notes to consequence-only. If investigation deep-link is added later, this section may expand. | game-designer + narrative-director | Investigation System UX spec | Deferred — clue text belongs to a future Investigation Journal screen. Quest Journal is scoped to quest progress and consequence aftermath. |
| Should Track Toggle support multiple concurrently tracked quests, or always exactly one? Quest GDD `MaxActiveContractsHUD` defaults to 3, suggesting the in-world tracker shows up to 3 quests, but Track on the journal is currently single-quest. | game-designer | Vertical Slice HUD review | Deferred — single tracked quest at Vertical Slice. Multi-track is a HUD-side decision, not a journal-side one. |
| Should the journal expose a contract's faction reputation reward preview (Quest GDD Rewards table)? This could enable min-max behavior. Per Faction System OQ-1, exposing reputation numerics is debated. | narrative-director | Pre-VS | Deferred — preview is hidden at Vertical Slice. Reputation surprise serves Pillar 1 (Hostile World — every alliance has a cost). |
| Should consequences expire from Lore Notes if ignored? Quest GDD OQ-5 raises this. Current spec: notes never expire. | game-designer | Playtest | Notes persist indefinitely per current Quest GDD default. May be revisited at playtest. |
