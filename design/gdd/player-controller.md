# Player Controller

> **Status**: Draft
> **Author**: user + agents
> **Last Updated**: 29 April 2026
> **Last Verified**: 29 April 2026
> **Implements Pillar**: Pillar 2 (Earned Discovery), Pillar 3 (Tense Survival)

## Overview

The Player Controller is the central input router and context coordinator for Hostile World. It receives raw input from the Enhanced Input System, resolves which subsystem should handle each action based on current game state, and manages the Input Mapping Context stack that determines what the player can do at any moment. It does NOT own movement, health, combat, or stealth logic — those live in the Character class and their respective subsystems. The Player Controller is a thin router: it decides *who* handles input, not *how* it is handled.

It also owns the **context action resolver** — a hybrid system that uses proximity detection for NPCs and dialogue targets, and camera-centered line traces for world items, switches, and interactive objects. When the player presses IA_Interact, the Player Controller determines what they're trying to interact with, validates the interaction, and routes the request to the appropriate system (Dialogue, Investigation, Inventory, etc.).

**Key design decisions:**
1. **Thin Router pattern** — APlayerController routes input, manages IMC stack, resolves context actions. All gameplay logic lives in Character and subsystems.
2. **Hybrid context resolution** — proximity for NPCs/dialogue, trace for world items. Fast NPC interaction, precise object targeting.
3. **State-driven input gating** — the GSM state determines which Input Mapping Contexts are active. No input during Cutscene, dampened movement during Inventory.
4. **Event-driven, not polled** — the PC subscribes to subsystem state changes (health, movement, stealth) rather than polling. Reacts, doesn't query.

> **Quick reference** — Layer: `Core` · Priority: `MVP` · Key deps: `Input, Physics, Camera, Health, Movement, Game State Machine`

## Player Fantasy

The Player Controller is invisible infrastructure — players never think about it directly. What they experience is **fluid agency**: the right action available at the right moment, without menu diving or mode confusion. When they crouch near an NPC, the context prompt appears — "Talk." When they aim at a locked door, it reads — "Search for Key." When combat erupts, the same buttons that opened doors now fire weapons. The player never presses the wrong thing because the controller knows what they mean.

This serves **Pillar 2 (Earned Discovery)** — clues and interactions are earned through player intent, not handed through UI prompts. The context system respects player intelligence: it shows what's available, not what to do. And it serves **Pillar 3 (Tense Survival)** — in a hostile world, fumbling with controls kills you. Input must be reliable, context must be clear, and the gap between intention and action must be zero. It also serves **Pillar 1 (Hostile World)** — the event-driven architecture ensures the controller responds dynamically to a world that is actively transforming. When infection spreads and zones change, context actions update without polling. The world changes; the controller adapts.

## Detailed Design

### Core Rules

**Rule 1 — Input Routing Architecture**

The Player Controller owns the Enhanced Input system's **Input Mapping Context (IMC) stack**. It pushes and pops contexts based on game state, ensuring the right actions are available at the right time.

| Responsibility | Owner | Rationale |
|----------------|-------|-----------|
| IMC stack management | Player Controller | Central authority for what input is active |
| Input action binding | Player Controller | Routes IA_* to the correct subsystem |
| Context priority resolution | Player Controller | Handles IMC conflicts per Input System GDD |
| Gameplay logic (movement, health, combat) | Character + Subsystems | Thin router — PC doesn't own gameplay |
| Context action resolution | Player Controller | Hybrid proximity + trace |

**Input Routing Flow:**
1. Enhanced Input fires action callback → Player Controller receives it via `UEnhancedInputComponent::BindAction()`.
2. Player Controller checks current GSM state and active IMC stack.
3. Player Controller routes to the correct subsystem via **Unreal dynamic multicast delegates** (`FOnActionRouted`). Each subsystem registers its handler during `BeginPlay()`. The PC fires the delegate; all subscribers execute in registration order. No direct function calls — loose coupling.
4. Subsystem executes gameplay logic (Character moves, Health takes damage, etc.).
5. Subsystem fires event back → PC updates context prompts, HUD state.

**Rule 2 — Context Action Resolver (Hybrid)**

When the player presses IA_Interact, the Player Controller resolves what they're trying to interact with using two methods:

**Threading Model**: The context resolver runs on the **game thread** using **async line traces** (`UWorld::AsyncLineTraceByChannel`). Async traces prevent frame spikes — the trace is dispatched, completes next frame, and results are processed in a callback. The resolver does NOT use background threads (Unreal's game logic must stay on the game thread). Async = non-blocking on the game thread, not multi-threaded.

**Proximity Detection (NPCs, Dialogue Targets):**
- Sphere overlap with radius = `ContextProximityRadius` (200 cm).
- Filters for actors tagged with `EInteractableType.NPC` or `EInteractableType.Dialogue`.
- Picks the closest valid target within radius.
- Runs at 4 Hz (every 0.25s) — not per-frame. Sphere overlap is cheap (no trace), runs synchronously on game thread.

**Line Trace (World Items, Switches, Interactive Objects):**
- Single async line trace from camera center, length = `ContextTraceLength` (500 cm).
- Filters for actors tagged with `EInteractableType.Item`, `EInteractableType.Switch`, `EInteractableType.Door`, `EInteractableType.Loot`.
- Picks the first hit actor.
- Dispatched at 4 Hz, results processed on next frame via callback. Non-blocking.

**Priority Resolution (when both methods return targets):**
1. NPC/Dialogue target (proximity) takes priority over world items (trace).
2. If multiple NPCs in range: closest to player center wins.
3. If no proximity target: trace result wins.
4. If neither returns a target: no context action available.

**Context Prompt Data Structure:**
```
struct FContextPrompt {
    AActor* Target;
    FText ActionLabel;        // "Talk", "Pick Up", "Open", "Search"
    FText TargetName;         // "Dr. Elena Vasquez", "Locked Door", "Medkit"
    EInteractableType Type;   // NPC, Item, Switch, Door, Loot
    float Priority;           // Higher = shown first when multiple available
    bool bRequiresTool;       // True if interaction needs a specific item
    FName RequiredTool;       // Item tag needed (e.g., "Lockpick")
}
```

**Rule 3 — State-Driven Input Gating**

The Player Controller subscribes to GSM state changes and adjusts the IMC stack accordingly.

| GSM State | Active IMCs | Input Behavior |
|-----------|-------------|----------------|
| **Playing** | IMC_Default (or IMC_Stealth / IMC_Combat pushed) | Full input enabled |
| **Paused** | IMC_Menu | All gameplay input blocked. Menu navigation only. |
| **Cutscene** | IMC_Cutscene | All input blocked except unpause (if allowed). |
| **Dialogue** | IMC_Dialogue | Movement locked. Dialogue choices enabled. |
| **Inventory** | IMC_Inventory | Movement dampened to 20%. Inventory navigation enabled. |
| **GameOver** | IMC_Cutscene | All input blocked except restart prompt. |

**IMC Push/Pop Rules:**
- IMCs are pushed onto a stack, not replaced. Pop returns to previous.
- IMC_Combat pushed when alien enters engagement range (per Stealth/Combat GDD).
- IMC_Stealth pushed when player crouches (per Movement System GDD).
- IMC_Menu and IMC_Cutscene block all gameplay input including movement.
- IMC_Inventory blocks movement but allows limited camera look.

**Rule 4 — Subsystem Event Subscription**

The Player Controller subscribes to events from all subsystems it coordinates. It does NOT poll subsystem state.

| Event Source | Event Subscribed | PC Response |
|--------------|-----------------|-------------|
| **Health System** | `OnHealthChanged` | Update context prompt urgency (low health = flee prompts prioritized) |
| **Health System** | `OnPlayerDied` | Route to GSM for GameOver transition |
| **Movement System** | `OnMovementStateChanged` | Update camera arm length, FOV, context prompt visibility |
| **Movement System** | `OnStaminaChanged` | Update exhaustion state for input gating |
| **Movement System** | `OnCoverEntered` / `OnCoverExited` | Push/pop lean input actions |
| **Camera System** | `OnCameraModeChanged` | Update trace origin for context resolver |
| **Combat System** | `OnCombatEngaged` / `OnCombatDisengaged` | Push/pop IMC_Combat |
| **Stealth System** | `OnDetectionStateChanged` | Push/pop IMC_Stealth |
| **GSM** | `OnStateEntered` / `OnStateExited` | Push/pop IMCs per state |

**Character exception**: The Player Controller does NOT subscribe to Character events. Instead, it queries the Character's public interface on-demand (e.g., `GetMovementState()`, `GetStamina()`) when routing decisions require current state. This is intentional: the Character is the PC's pawn, not an independent subsystem. Querying the Character is a direct read, not a poll — it happens only during input routing (once per input action), not on a timer. All other subsystems use event subscription.

**Rule 5 — Character Ownership Boundary**

The Player Controller does NOT own any gameplay state. The Character class (`AHostileCharacter`) owns:

| Owned By Character | Owned By Player Controller |
|-------------------|---------------------------|
| Movement state (Idle, Walk, Sprint, etc.) | IMC stack |
| Stamina value | Context action resolver |
| Health pool (read-only from PC) | Input routing |
| Dodge i-frame state | GSM state subscription |
| Cover state | Subsystem event routing |
| Animation triggers | Context prompt data |
| Surface type (from Physics) | — |

The Player Controller queries the Character for state when needed (e.g., "what movement state are we in?") but never modifies it directly. All modifications go through the Character's public interface. This is a direct query (Rule 4 exception), not a poll — it happens only during input routing, once per input action.

**Rule 6 — Context Prompt Lifecycle**

Context prompts follow a strict lifecycle:

1. **Detection**: Context resolver finds a valid target (proximity or trace).
2. **Validation**: Target is checked — is it interactable? Does the player have required tools? Is the interaction blocked by current state?
3. **Presentation**: HUD displays the prompt (label + target name).
4. **Activation**: Player presses IA_Interact → routed to target's interaction handler.
5. **Resolution**: Interaction completes → prompt cleared, subsystem notified.
6. **Cooldown**: 0.3s cooldown before next context prompt appears (prevents prompt spam).

**Validation Rules:**
- No context prompts during Cutscene, Paused, GameOver.
- No context prompts during combat engagement (unless target is a healing item).
- Context prompts blocked if player is in Dodge animation.
- Context prompts blocked if player is in Jump/Fall state.
- Context prompts visible only when player is in Playing state.

### States and Transitions

The Player Controller maintains an **input state machine** that reflects what the player can currently do.

| State | Entry Condition | Exit Condition | Active IMCs | Available Actions |
|-------|----------------|----------------|-------------|-------------------|
| **Free Play** | GSM = Playing, no special conditions | Combat engaged OR crouch toggled OR inventory opened | IMC_Default | Move, Sprint, Jump, Dodge, Interact, Attack, Aim |
| **Stealth Mode** | Crouch toggled (Movement System) | Crouch toggled off OR combat engaged | IMC_Default + IMC_Stealth | Move (crouch), Interact, Attack (silent), Aim |
| **Combat Mode** | Alien enters engagement range (Combat System) | All enemies defeated OR player escapes (Stealth System) | IMC_Default + IMC_Combat | Move, Sprint, Attack, Aim, Reload, Dodge, Use Item |
| **Dialogue Mode** | GSM = Dialogue | Dialogue ends | IMC_Dialogue | Dialogue choices only |
| **Inventory Mode** | GSM = Inventory | Inventory closed | IMC_Inventory | Inventory navigation, limited camera look |
| **Paused** | GSM = Paused | Unpaused | IMC_Menu | Menu navigation only |
| **Cutscene** | GSM = Cutscene | Cutscene ends | IMC_Cutscene | None (or unpause if allowed) |
| **Context Active** | Valid interactable detected | IA_Interact pressed OR target out of range | Current IMC + context action | All current + IA_Interact |
| **Cover Mode** | Movement System enters cover | Movement System exits cover | IMC_Default + Lean actions | Lean Left/Right, Aim, Attack, Interact |

**Context Active (overlay, not a state)**: A context prompt can appear on top of Free Play, Cover, or Stealth. It does not change the active IMC or input behavior — it only enables IA_Interact routing to the detected target. When no valid target exists, the overlay disappears and the underlying state continues unchanged.

**Input State Priority (highest wins):** Cutscene > Paused > Dialogue > Inventory > Combat > Stealth > Cover > Free Play

**Note**: This priority chain is for the PC's internal input state machine only — it determines which input actions are available when multiple states overlap. It is separate from the GSM priority stack (which uses numeric priorities: Title=0, Playing=10, Paused=20, etc.). The GSM controls global game state; the PC's input state machine controls which IMCs are active within the current GSM state.

### Interactions with Other Systems

| System | Direction | Data Flow | Interface |
|--------|-----------|-----------|-----------|
| **Input System** | Reads | All IA_* actions | Enhanced Input callbacks routed by PC |
| **Game State Machine** | Reads + Writes | GSM state, state change events | `SubscribeToStateChange()`, `RequestStateTransition()` |
| **Movement System** | Reads | Movement state, stamina, cover state | `OnMovementStateChanged()`, `OnStaminaChanged()`, `OnCoverEntered/Exited()` |
| **Health System** | Reads | HP value, injury state, death events | `OnHealthChanged()`, `OnPlayerDied()` |
| **Camera System** | Reads | Camera mode, camera rotation, FOV | `OnCameraModeChanged()`, `GetCameraRotation()`, `GetCameraFOV()` |
| **Physics System** | Reads | Surface type (for context validation) | `IPhysicsSystem::GetSurfaceType()` |
| **Combat System** | Reads + Writes | Combat engagement state | `OnCombatEngaged()`, `OnCombatDisengaged()`, `RequestStateTransition()` |
| **Stealth System** | Reads | Detection state, stealth mode | `OnDetectionStateChanged()`, `GetCurrentDetectionLevel()` |
| **Dialogue System** | Reads + Writes | Dialogue start/end, choice selection | `OnDialogueStarted()`, `OnDialogueEnded()`, `SelectDialogueChoice()` |
| **Investigation System** | Writes | Clue discovery, interaction | `OnClueInteracted()`, `DiscoverClue()` |
| **HUD System** | Writes | Context prompts, state indicators | `SetContextPrompt(FContextPrompt)`, `ClearContextPrompt()`, `UpdateStateIndicator()` |
| **Inventory System** | Reads + Writes | Item interactions, consumable use | `OnItemInteracted()`, `UseItem()`, `HasItem()` |
| **Alien AI System** | Reads | Enemy positions (for context priority) | `GetNearestEnemyPosition()` — used to prioritize flee prompts |
| **Scene Management** | Reads | Zone state (for context validation) | `GetCurrentZone()` — some interactions zone-locked |
| **Animation System** | Reads | Animation state (for input gating) | `IsInMontage()`, `GetCurrentAnimationState()` — blocks input during certain animations |

## Formulas

**Formula 1 — Context Target Priority Score**

The `context_priority_score` formula determines which interactable to show when multiple are detected:

`P = P_base(type) + D_proximity × W_proximity + D_camera × W_camera + P_state`

**Variables:**

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| Base priority by type | P_base(type) | float | 0–100 | NPC=80, Door=50, Item=40, Switch=30, Loot=20 |
| Proximity distance | D_proximity | float | 0–200 cm | Distance from player to target |
| Proximity weight | W_proximity | float | -0.5 | Negative: closer = higher priority |
| Camera angle offset | D_camera | float | 0–180° | Angle between camera forward and target direction |
| Camera weight | W_camera | float | -0.3 | Negative: more centered = higher priority |
| State modifier | P_state | float | -50 to +50 | Low health = +30 for healing items, combat = +50 for cover |

**Output Range:** -50 to 180. Higher score = shown as primary context prompt.

**Example:** NPC 150cm away, 30° off-camera, normal health: P = 80 + (150 × -0.5) + (30 × -0.3) + 0 = 80 - 75 - 9 = **-4**.
**Example:** Medkit 50cm away, 10° off-camera, low health (10 HP): P = 40 + (50 × -0.5) + (10 × -0.3) + 30 = 40 - 25 - 3 + 30 = **42**.

---

**Formula 2 — Context Polling Rate**

The `context_polling_interval` determines how often the resolver scans for interactables. Polling interval *increases* (frequency decreases) when more targets are nearby, reducing CPU load during complex scenes:

`T_poll = clamp(T_base × (1 + N_nearby_targets × W_scaling), T_min, T_max)`

**Variables:**

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| Base polling interval | T_base | float | 0.25s | Default: 4 Hz |
| Nearby target count | N_nearby_targets | int | 0–10 | Number of interactables within proximity radius |
| Scaling weight | W_scaling | float | 0.15 | Increases interval as targets increase |
| Minimum interval | T_min | float | 0.15s | Fastest poll rate (6.7 Hz) |
| Maximum interval | T_max | float | 0.50s | Slowest poll rate (2 Hz) |

**Output Range:** 0.15s to 0.50s (clamped). Poll rate decreases from 4 Hz to 2 Hz as scene complexity increases.
**Example:** 3 nearby targets: T = clamp(0.25 × (1 + 3 × 0.15), 0.15, 0.50) = clamp(0.3625, 0.15, 0.50) = **0.36s** (~2.8 Hz).
**Example:** 0 nearby targets: T = clamp(0.25 × 1.0, 0.15, 0.50) = **0.25s** (4 Hz).

---

**Performance Targets — Input Latency Budget**

The Player Controller must route input within strict latency budgets. Total latency is the sum of four stages:

`T_total = T_input + T_routing + T_subsystem + T_animation`

**Variables:**

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| Input processing time | T_input | float | 1–8ms | Enhanced Input callback latency |
| PC routing time | T_routing | float | 1–3ms | PC delegates to subsystem via multicast delegate |
| Subsystem processing | T_subsystem | float | 1–10ms | Subsystem executes logic |
| Animation response | T_animation | float | 16–100ms | First visible frame of response |

**Latency Budgets by Action Type:**

| Action Type | Target T_total | Frame Budget (60fps) | Notes |
|-------------|----------------|---------------------|-------|
| Combat (attack, aim) | <50ms | <3 frames | Must feel instant |
| Movement (walk, sprint) | <100ms | <6 frames | Acceptable for locomotion |
| Context interaction | <150ms | <9 frames | Prompt appearance + activation |
| Menu navigation | <200ms | <12 frames | UI actions tolerate more latency |

**Example (combat):** 3 + 2 + 5 + 16 = **26ms** — well within 50ms target.
**Example (heavy animation):** 5 + 3 + 10 + 100 = **118ms** — acceptable for non-combat actions.

## Edge Cases

- **If player holds IA_Interact while no valid target exists**: No prompt shown. No error. Input is consumed silently. Prevents "interaction failed" feedback that breaks immersion.

- **If context resolver finds both an NPC (proximity) and a door (trace) simultaneously**: NPC wins (P_base = 80 vs 50). Player must look away from NPC or move past proximity radius to interact with door. Prevents accidental door-opening during conversations.

- **If player opens inventory while an enemy is within engagement range**: Inventory is immediately interrupted and closed. IMC_Combat pushed. Player loses inventory browsing progress. Prevents "inventory stalling" during combat.

- **If player is in dialogue and an alien enters engagement range**: Dialogue is NOT interrupted. Dialogue (priority 30) > Combat engagement. Alien waits at edge of detection range. If alien reaches melee range during dialogue, dialogue IS interrupted (safety override).

- **If context prompt shows "Pick Up" for an item but inventory is full**: Prompt changes to "Inventory Full" with red tint. IA_Interact does nothing. Prevents item loss and player confusion.

- **If player presses IA_Interact during the 0.3s context cooldown**: Input is consumed, no action fires. No feedback — prevents input queue buildup that would fire after cooldown ends.

- **If GSM transitions to Cutscene while a context prompt is active**: Prompt is immediately cleared. Context resolver stops polling. On cutscene end, resolver resumes from fresh scan.

- **If player is in cover and presses IA_Interact toward a cover-adjacent interactable**: Cover exits first (0.2s), then interaction resolves. Cover > Interact in state priority. Prevents "interact through cover" exploits.

- **If context resolver trace hits a destructible object that was destroyed between poll and activation**: Interaction silently fails. No error. Resolver re-polls next cycle. Prevents "ghost interaction" on destroyed objects.

- **If player has multiple interactables of the same type within proximity radius**: Closest to player center wins. If equidistant: closest to camera forward wins. If still tied: lowest Actor ID wins (deterministic).

- **If IA_Interact is pressed during dodge wind-up (0.10s)**: Interaction is queued, not executed. If dodge completes successfully, interaction fires. If dodge is cancelled, interaction is discarded. Prevents "dodge-cancel into interact" exploits.

- **If context prompt target moves out of range while prompt is visible**: Prompt fades out over 0.2s. No hard disappearance. If target re-enters range within 1.0s, prompt fades back in. Prevents "flickering prompt" on boundary edges.

- **If player is exhausted (stamina = 0) and tries to interact with a stamina-cost action (e.g., force-open a door)**: Interaction fails. Prompt shows "Too Exhausted" for 1.0s. Prevents stamina-free interaction exploits.

- **If Enhanced Input fires the same action twice in one frame (input spam)**: PC processes only the first instance. Second is logged and discarded. Prevents double-interaction bugs.

- **If context resolver has a pending async trace callback and the player dies**: Pending trace callback is discarded. No further prompts generated. GameOver state takes priority over all context resolution.

## Dependencies

**Hard Dependencies** (system cannot function without):
- **Input System** ✅ (designed) — provides all IA_* actions. Player Controller routes every input action to the correct subsystem.
- **Game State Machine** ✅ (designed) — provides state change events. Player Controller subscribes to GSM and adjusts IMC stack per state.
- **Physics System** ✅ (designed) — provides surface type queries and collision data. Context resolver uses physics traces for world item detection.
- **Camera System** ✅ (designed) — provides camera rotation and mode. Context trace origin and direction depend on camera state.

**Soft Dependencies** (enhanced by but works without):
- **Movement System** ✅ (designed) — provides movement state and cover state. PC reads these for input gating but can function with default assumptions.
- **Health System** ✅ (designed) — provides death events and HP state. PC routes death to GSM but can function without HP data.

**Depended On By** (key downstream systems):

| System | Interface Used | Expected Behavior |
|--------|---------------|-------------------|
| Combat System | IMC_Combat push/pop, input routing | Receives IA_Attack, IA_Aim, IA_Reload from PC routing |
| Stealth System | IMC_Stealth push/pop, input routing | Receives IA_Crouch, IA_LeanLeft/Right from PC routing |
| Dialogue System | IA_Interact routing, state transitions | Receives dialogue start/end events, routes choice selection |
| Investigation System | IA_Interact routing, clue discovery | Receives clue interaction events, triggers discovery |
| HUD System | Context prompt data, state indicators | Receives FContextPrompt for display, updates per state |
| Inventory System | IA_Inventory routing, item interactions | Receives inventory open/close, item use events |
| Save/Load System | GSM state reads | Save enabled/disabled based on current GSM state |
| Alien AI System | Player state reads | Reads player movement state and position for detection |

## Tuning Knobs

| Knob | Default | Safe Range | Affects | Too High | Too Low |
|------|---------|------------|---------|----------|---------|
| `ContextProximityRadius` | 200 cm | 100–400 | NPC detection range | Too many NPCs detected, wrong target | Miss nearby NPCs, frustrating |
| `ContextTraceLength` | 500 cm | 200–1000 | World item trace distance | Interact with distant objects, confusing | Must be too close, tedious |
| `ContextPollingRate` | 4 Hz | 2–8 Hz | How often context is scanned | Too fast: CPU waste, prompt flicker | Too slow: slow prompt appearance, unresponsive |
| `ContextCooldown` | 0.3s | 0.1–1.0s | Min time between interactions | Interaction spam, exploit potential | Feels unresponsive, sluggish |
| `PromptFadeDuration` | 0.2s | 0.1–0.5s | Prompt appear/disappear speed | Prompt pops in/out harshly | Prompt lingers after target gone |
| `IMC_PushLatency` | 0.05s | 0.0–0.2s | Delay when pushing new IMC | Input feels delayed | IMC switches feel instant/jarring |
| `CombatEngagementRange` | 1500 cm | 800–3000 | When IMC_Combat is pushed | Combat mode always active | Combat mode activates too late |
| `StealthDetectionThreshold` | 50/100 | 30–80 | When IMC_Stealth is pushed | Stealth mode always active | Stealth mode never activates |
| `LowHealthThreshold` | 25 HP | 10–50 | When healing items get priority boost | Always prioritizing healing | Never prioritizing healing |
| `ExhaustionInteractionBlock` | true | bool | Whether exhausted blocks stamina-cost interactions | Exhausted players can't interact | Stamina-free interaction exploits |

## Visual/Audio Requirements

### Context Prompt Visuals

| Element | Visual Style | Animation | Notes |
|---------|-------------|-----------|-------|
| **Primary prompt** | White text, clean sans-serif, slight drop shadow | Fade in 0.2s (EaseOut), fade out 0.2s (EaseIn) | Shows action label + target name |
| **Secondary prompt** | Gray text, 70% opacity | Same as primary | Shows when multiple targets available |
| **Blocked prompt** | Red text, 50% opacity | Same as primary | Shows when interaction is blocked (inventory full, exhausted) |
| **Prompt icon** | Small icon left of text (hand, key, magnifying glass) | Fade in with prompt | Context-specific icon per interactable type |
| **Tool required indicator** | Yellow icon + tooltip | Fade in with prompt | Shows when interaction requires a specific item |

### Audio Feedback

| Event | Audio | Volume | Notes |
|-------|-------|--------|-------|
| **Context prompt appears** | Soft UI click | Low (-18dB) | Subtle, not distracting |
| **Context prompt changes** | Soft UI click (different pitch) | Low (-18dB) | Indicates target switch |
| **Context prompt blocked** | Low thud | Medium (-12dB) | Clear feedback for blocked action |
| **Interaction successful** | Context-specific SFX | Variable | Door creak, item pickup, dialogue start |
| **Interaction failed** | Soft negative tone | Low (-15dB) | No target, cooldown active |
| **IMC switch** | None | — | IMC changes are silent; player feels it through available actions |

### Art Bible Alignment

| Principle | Application |
|-----------|------------|
| **Earned Discovery** (Pillar 2) | Context prompts are minimal and diegetic. No floating exclamation marks, no glowing outlines. The world tells you what's interactive through visual design, not UI. |
| **Survival Tension** (Pillar 3) | When health is low, context prompts for healing items get visual priority (larger, brighter). The UI subtly guides you toward survival without breaking immersion. |
| **Immersive-first HUD** | Context prompts are the ONLY persistent UI element during gameplay. No crosshair, no minimap, no action bar. Just the prompt when something is interactable. |

## UI Requirements

| Context | HUD Element | Update Frequency | Condition |
|---------|-------------|-----------------|-----------|
| **Context prompt** | Bottom-center of screen, above crosshair area | On context change | Valid interactable detected |
| **Blocked prompt** | Same position as context prompt, red tint | On interaction attempt | Interaction blocked |
| **State indicator** | None (immersive-first) | — | State communicated through character animation and audio |
| **Tactical HUD (toggleable)** | Current IMC stack display | On IMC change | Debug/dev tool only |
| **Tactical HUD (toggleable)** | Context resolver results | Every poll cycle | Debug/dev tool only |

**Context Prompt Layout:**
```
[Icon] Action Label — Target Name
```
Example: `[Hand] Pick Up — Medkit`
Example: `[Talk] Speak — Dr. Elena Vasquez`
Example: `[Key] Unlock — Reinforced Door (requires Lockpick)`

**Tactical HUD adds:**
- Active IMC list (e.g., "IMC_Default + IMC_Combat")
- Context poll rate and target count
- Input latency measurement (ms)

## Cross-References

| This Document References | Target GDD | Specific Element Referenced | Nature |
|--------------------------|-----------|----------------------------|--------|
| "IA_Interact context-sensitive" | `design/gdd/input-system.md` | IA_Interact action definition, IMC priority table | Data dependency |
| "IMC stack management" | `design/gdd/input-system.md` | Input Mapping Contexts, push/pop rules | Rule dependency |
| "GSM state determines IMC" | `design/gdd/game-state-machine.md` | GSM states, priority stack, transition events | State trigger |
| "Movement state drives camera" | `design/gdd/movement-system.md` | Movement states, cover state, stamina | Data dependency |
| "Dodge i-frame state" | `design/gdd/movement-system.md` | Dodge wind-up, active, recovery phases | Rule dependency |
| "Health state for input gating" | `design/gdd/health-system.md` | HP thresholds, injury states, death events | Data dependency |
| "Camera mode for trace origin" | `design/gdd/camera-system.md` | Camera rotation, FOV, mode switching | Data dependency |
| "Combat engagement triggers IMC_Combat" | `design/gdd/combat-system.md` (Designed) | Combat engagement range, disengagement conditions | State trigger |
| "Stealth detection triggers IMC_Stealth" | `design/gdd/stealth-system.md` (Designed) | Detection level thresholds | State trigger |
| "Dialogue start/end events" | `design/gdd/dialogue-system.md` (Designed) | Dialogue state transitions | State trigger |
| "Clue discovery routing" | `design/gdd/investigation-system.md` (Designed) | Clue interaction, discovery events | Data dependency |
| "Inventory state for context validation" | `design/gdd/inventory-system.md` (Designed) | Item capacity, tool requirements | Rule dependency |

## Acceptance Criteria

- **GIVEN** Player Controller is in Playing state, **WHEN** player moves within 200 cm of an NPC, **THEN** context prompt appears showing "Talk — [NPC Name]" within 0.25s.

- **GIVEN** Player Controller has a valid context prompt, **WHEN** player presses IA_Interact, **THEN** the interaction is routed to the correct subsystem and the prompt enters 0.3s cooldown.

- **GIVEN** player is in Playing state with no nearby interactables, **WHEN** player aims at a world item within 500 cm and presses IA_Interact, **THEN** line trace hits the item and interaction is routed to the correct subsystem.

- **GIVEN** both an NPC (proximity) and a door (trace) are valid targets, **WHEN** context resolver runs, **THEN** NPC is shown as primary prompt (priority score higher than door).

- **GIVEN** GSM transitions to Cutscene, **WHEN** context prompt is active, **THEN** prompt is immediately cleared and context resolver stops polling.

- **GIVEN** player opens inventory while an enemy is within engagement range, **WHEN** inventory opens, **THEN** inventory is immediately interrupted and closed, IMC_Combat is pushed.

- **GIVEN** player is in dialogue and an alien enters engagement range (not melee), **WHEN** combat engagement fires, **THEN** dialogue is NOT interrupted (priority 30 > combat engagement).

- **GIVEN** player is in dialogue and an alien reaches melee range, **WHEN** melee threat detected, **THEN** dialogue IS interrupted (safety override).

- **GIVEN** context prompt shows "Pick Up" for an item, **WHEN** player inventory is full, **THEN** prompt changes to "Inventory Full" with red tint and IA_Interact does nothing.

- **GIVEN** player presses IA_Interact during the 0.3s context cooldown, **WHEN** input is processed, **THEN** input is consumed with no action fired and no feedback.

- **GIVEN** player is in cover and presses IA_Interact toward a cover-adjacent interactable, **WHEN** interaction is attempted, **THEN** cover exits first (0.2s), then interaction resolves.

- **GIVEN** Enhanced Input fires the same action twice in one frame, **WHEN** PC processes input, **THEN** only the first instance is executed and the second is logged and discarded.

- **GIVEN** player is exhausted (stamina = 0) and tries to interact with a stamina-cost action, **WHEN** interaction is attempted, **THEN** interaction fails and prompt shows "Too Exhausted" for 1.0s.

- **GIVEN** total input latency for combat actions, **WHEN** measured from input to visible response, **THEN** latency is <50ms at target 60fps framerate (per Performance Targets section).

- **GIVEN** total input latency for movement actions, **WHEN** measured from input to visible response, **THEN** latency is <100ms at target 60fps framerate (per Performance Targets section).

- **GIVEN** context resolver polling, **WHEN** 3 nearby interactables are within proximity radius, **THEN** polling interval increases from 0.25s to approximately 0.36s (~2.8 Hz), reducing CPU load.

- **GIVEN** context prompt target moves out of range while prompt is visible, **WHEN** target exits proximity/trace range, **THEN** prompt fades out over 0.2s (no hard disappearance).

- **GIVEN** context prompt target re-enters range within 1.0s of fading out, **WHEN** target is re-detected, **THEN** prompt fades back in over 0.2s.

## Open Questions

| # | Question | Owner | Target Resolution |
|---|----------|-------|-------------------|
| OQ-1 | Should context prompts show a progress bar for timed interactions (e.g., "Searching... 3s remaining") or just the initial prompt? Affects HUD System GDD. | game-designer | HUD System GDD |
| OQ-2 | Should the context resolver use async traces (non-blocking) or sync traces? | **RESOLVED**: Async traces via `UWorld::AsyncLineTraceByChannel`. Prevents frame spikes, results processed next frame via callback. Game thread only — no background threads. | engine-programmer | Architecture ADR |
| OQ-3 | Should IA_Interact have a hold-to-activate variant for high-stakes interactions (e.g., holding to pick up a key item)? Prevents accidental pickups. | game-designer | Combat System GDD review |
| OQ-4 | How does the Player Controller handle multiplayer (future)? Each player has their own PC, but context resolution may need server validation. | architecture | Multiplayer ADR |
| OQ-5 | Should context prompts persist across GSM state transitions (e.g., pause → resume) or be re-evaluated on resume? | game-designer | Before MVP implementation |
| OQ-6 | Should the context resolver prioritize interactables based on player gaze (camera forward) even in proximity mode? Currently proximity-only for NPCs. | ux-designer | UX spec review |
| OQ-7 | What is the maximum number of simultaneous context prompts before the UI becomes cluttered? Currently designed for 1 primary + 1 secondary. | game-designer | HUD System GDD |
