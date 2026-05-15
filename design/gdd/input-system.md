# Input System

> **Status**: Designed (pending design-review)
> **Author**: user + agents
> **Last Updated**: 26 April 2026
> **Implements Pillar**: Foundation — enables all pillars

---

## Overview

The Input System is the player's direct link to the world. Every action — movement, stealth, combat, investigation — begins as input. The system must be reliable enough that the player never feels their input was ignored, responsive enough that latency is imperceptible, and context-aware enough that the right actions are available at the right time. When input fails, the game fails — regardless of how good the movement, combat, or investigation systems are.

Key design decisions:

1. **Enhanced Input** (UE 5.7 default) for all input — modular, rebindable, context-switchable
2. **Input Actions** defined in editor — IA_Move, IA_Look, IA_Sprint, IA_Crouch, IA_Jump, IA_Interact, IA_Attack, IA_Aim, IA_Reload, IA_QuickSlot1–4, IA_Inventory, IA_Map, IA_Pause
3. **Input Mapping Contexts** per game state — default walking, stealth, dialogue, inventory/menu, cutscene, mounted
4. **Runtime rebinding** — full support for player remapping via settings
5. **No legacy input** — Enhanced Input only, legacy BindAction/BindAxis not permitted

---

## Player Fantasy

[To be designed — indirect infrastructure system]

The player fantasy is **invisible** — players never engage with the Input System directly. What they experience instead: movement that feels responsive, combat that fires when they press the button, stealth that activates when they crouch. When the Input System works, players don't know it exists. When it fails, they notice immediately.

---

## Detailed Design

### Core Rules

**Input Actions (editor-defined via Content Browser → Input):**

| Action | Type | Keyboard | Gamepad | Notes |
|--------|------|----------|---------|-------|
| IA_Move | Axis2D | WASD | Left Stick | — |
| IA_Look | Axis2D | Mouse XY | Right Stick | Mouse sensitivity tuning variable |
| IA_Sprint | Digital (hold) | Left Shift | Left Stick Press | Hold to sprint |
| IA_Crouch | Digital (toggle) | Left Ctrl | Right Stick Click | Toggle crouch — switches to IMC_Stealth |
| IA_Jump | Digital | Space | A Button | — |
| IA_Interact | Digital | E | B Button | Context-sensitive (grab, pick up, talk) |
| IA_Attack | Digital | Left Mouse | Right Trigger | Light attack; aim held for charged |
| IA_Aim | Digital (hold) | Right Mouse | Left Trigger | Hold for aim mode |
| IA_Reload | Digital | R | Y Button | — |
| IA_QuickSlot1 | Digital | 1 | D-pad Left | Quick slot 1 (e.g., medkit) |
| IA_QuickSlot2 | Digital | 2 | D-pad Right | Quick slot 2 (e.g., cure device) |
| IA_QuickSlot3 | Digital | 3 | D-pad Down | Quick slot 3 (e.g., grenade) |
| IA_QuickSlot4 | Digital | 4 | D-pad Up | Quick slot 4 (e.g., stimshot) |
| IA_Inventory | Digital | Tab | Start | Opens inventory screen |
| IA_Map | Digital | M | Select | Opens world map |
| IA_Pause | Digital | Escape | Start | Opens pause menu — NOT rebindable |
| IA_Dodge | Digital | Q | Left Bumper (when not on item) | Dodge/roll with i-frames |
| IA_Melee | Digital | Right Mouse (unarmed) | X Button | Improvised melee weapon attack |
| IA_Flashlight | Digital | G | Right Bumper | PC primary, gamepad optional |
| IA_LeanLeft | Digital | A (while in cover) | — | Lean left around cover only |
| IA_LeanRight | Digital | D (while in cover) | — | Lean right around cover only |
| IA_Zoom | Digital (hold) | Z | — | Compass / binoculars zoom |

**Lean constraint**: IA_LeanLeft/IA_LeanRight activate ONLY when player is in cover state (as defined by Movement System). Lean while moving is disabled — must be in cover.

**Dead zone strategy** (per specialist agent recommendation — see Section G for tuning knobs):
- Stick dead zone: 0.125 radial
- Trigger dead zone: 0.1

**Runtime rebinding**:
- All actions rebindable EXCEPT IA_Pause (always Escape + Start — hardlocked)
- Rebinding stored in Save/Load profile
- Conflict detection: if new binding conflicts with existing binding, show warning before confirming

**HUD interaction — dual-mode simultaneous**:
- When UI is open (inventory, map, menu): keyboard+mouse AND gamepad both active
- Mouse: hover, click. Gamepad: stick navigation + face button selection
- IMC_Inventory dampens movement to 20% so stick input doesn't walk character while browsing

### Input Mapping Contexts (priority order — highest wins conflicts)

| Context | Priority | Active When |
|---------|----------|-------------|
| IMC_Cutscene | +3 | Locked during cinematic |
| IMC_Dialogue | +3 | NPC conversation |
| IMC_Menu | +2 | Pause/settings screen |
| IMC_Inventory | +2 | Inventory open |
| IMC_Combat | +1 | Combat engaged |
| IMC_Stealth | +1 | Crouched / sneaking |
| IMC_Mounted | +1 | Vehicle/travel |
| IMC_Default | 0 | Normal gameplay |

**Context transition rules**:
- Transitions are atomic — push new context on top, pop to return
- When contexts share an action (e.g., IA_Attack in Default and Stealth), active context determines execution — no hybrid execution
- IMC_Menu and IMC_Cutscene block all gameplay input including movement
- IMC_Inventory blocks movement but allows limited camera look

### States and Transitions

| State | Entry Condition | Exit Condition | Notes |
|-------|----------------|----------------|-------|
| **Input Active** | Game running, no UI open | UI open or game paused | All gameplay contexts active |
| **Input UI Mode** | Inventory/Map/Menu open | UI closed | HUD dampened movement, dual input mode |
| **Input Cutscene** | Cutscene playing | Cutscene complete | All input blocked except unpause |
| **Input Locked** | Game paused | Game resumed | All input blocked |

### Interactions with Other Systems

| System | Direction | Data Flow |
|--------|-----------|-----------|
| Movement System | Consumes | IA_Move, IA_Sprint, IA_Crouch, IA_Jump, IA_Dodge, IA_LeanLeft, IA_LeanRight |
| Combat System | Consumes | IA_Attack, IA_Aim, IA_Reload, IA_Melee |
| Stealth System | Consumes | IA_Crouch, IA_LeanLeft, IA_LeanRight |
| Health System | Consumes | IA_QuickSlot1–4 (healing items) |
| HUD System | Consumes | All context state (to know when to dampen) |
| Player Controller | Owns | Input routing to subsystems |
| Save/Load System | Reads/Writes | Rebinding profiles |

---

## Formulas

No direct game formulas in the Input System — it's a routing layer. Tuning knobs are in Section G.

**Sprint speed scale** (passed to Movement System):
```
Sprint_MoveScale = 1.5x base Move magnitude while IA_Sprint held
```
Movement System defines and applies the actual sprint formula: V_base(Sprint) = 900 cm/s = 600 × 1.5.

---

## Edge Cases

- **If player holds sprint during dialogue**: Sprint input ignored during dialogue. If still holding sprint when dialogue exits, sprint executes immediately.
- **If inventory is open and enemy enters engagement range**: Inventory interrupted, IMC_Combat pushed, UI closed immediately. Player loses inventory browsing progress if mid-action.
- **If player Alt+Tab during combat**: Game auto-pauses. All input contexts frozen, game state preserved.
- **If player binds Pause to a gamepad button already mapped**: Show conflict warning. If confirmed, remove old mapping first.
- **If two contexts both map IA_Attack**: Active context determines execution. No hybrid execution.
- **If gamepad is disconnected during gameplay**: Fall back to keyboard-only. No pause on disconnect. Show reconnect prompt on gamepad reconnect.
- **If input focus lost during menu navigation**: Cancel any pending input state, return to default gameplay on focus regain.
- **If sprint held during stealth then combat triggered**: IMC_Stealth popped → IMC_Combat pushed → sprint state released (player must re-hold sprint to sprint in combat). Prevents accidental sprint from stealth into danger.
- **If lean pressed while not in cover**: Input ignored. No error, no feedback — lean only available in cover by design.

---

## Dependencies

- **Depends on**: Nothing (foundation layer — no dependencies)
- **Depended on by**: Physics, Camera, Movement, Stealth, Combat, Health, HUD, Player Controller

---

## Tuning Knobs

| Knob | Default | Range | Affects |
|------|---------|-------|---------|
| Stick Dead Zone | 0.125 | 0.05–0.25 | Thumbstick drift prevention |
| Trigger Dead Zone | 0.1 | 0.0–0.2 | Trigger input threshold |
| Mouse Sensitivity | 1.0 | 0.1–3.0 | Look rotation speed |
| Gamepad Sensitivity | 1.0 | 0.1–3.0 | Right stick look speed |
| Invert Y | false | bool | Mouse Y axis direction |
| Invert Gamepad Y | false | bool | Gamepad Y axis direction |
| Hold Threshold (sprint) | 0.0s | 0.0–0.5s | Sprint activates on press (0.0 = instant) |

> **Note:** `MovementDampenFactor` (0.2) is defined in Inventory System as the authoritative owner. Input System references it but does not own it.

---

## Visual/Audio Requirements

No dedicated VFX for input — input is invisible infrastructure. Audio feedback for sprint stamina, footstep volume relative to movement speed, and weapon fire audio are handled by Movement System, Health System, and Combat System respectively. No dedicated audio bus required in Input System.

---

## UI Requirements

**Rebinding UI** (in settings menu):
- Show all rebindable actions with current bindings
- Show conflict warnings before confirming new binding
- Option to reset all bindings to default
- Gamepad bindings shown separately from keyboard bindings
- IA_Pause shows "Fixed — not rebindable" (not clickable)

**Settings submenu structure**:
- Controls → Mouse Sensitivity slider
- Controls → Gamepad Sensitivity slider
- Controls → Invert Y (keyboard) toggle
- Controls → Invert Y (gamepad) toggle
- Controls → Rebind Keys → full rebinding screen

---

## Acceptance Criteria

- GIVEN default gameplay, WHEN player presses WASD, THEN character moves in correct direction
- GIVEN sprint held, WHEN sprint released, THEN movement speed returns to walk
- GIVEN dialogue active, WHEN sprint pressed, THEN sprint is NOT executed
- GIVEN in IMC_Default, WHEN crouch toggled, THEN IMC switches to IMC_Stealth
- GIVEN in IMC_Stealth, WHEN combat engaged, THEN IMC switches to IMC_Combat
- GIVEN inventory open, WHEN right stick moved, THEN movement is dampened to 20%
- GIVEN player rebinds IA_Attack to new key, WHEN attack executed, THEN new key triggers attack
- GIVEN Alt+Tab while in combat, THEN game auto-pauses
- GIVEN gamepad disconnected, WHEN gameplay active, THEN keyboard-only input continues without pause
- GIVEN input focus lost, WHEN focus regained, THEN game returns to default gameplay state
- GIVEN lean pressed without cover, THEN no action executed and no error shown
- GIVEN rebinding IA_Pause, THEN system prevents the binding with an explanation

---

## Open Questions

- **Q1**: Should IA_Flashlight be toggle (hold to activate) or latch (press to toggle)? **Owner**: game-designer — affects flashlight GDD
- **Q2**: Lean only from cover confirmed. But should lean direction also invert when player faces opposite direction (mirror lean)? **Owner**: game-designer — affects stealth GDD