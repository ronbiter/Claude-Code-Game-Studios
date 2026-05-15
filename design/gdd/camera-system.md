# Camera System

> **Status**: Designed (pending design-review)
> **Author**: user + agents
> **Last Updated**: 26 April 2026
> **Implements Pillar**: Foundation — supports all player-facing pillars

## Overview

The Camera System manages the player's viewpoint in Hostile World. It is the lens through which the player experiences the snowy mountain prison, the alien terraforming, and every moment of tension in between. Built on Unreal Engine 5.7's Camera Component framework, the system defines camera modes (Third-Person, First-Person, Cinematic, Mounted), handles smooth transitions between them, and applies dynamic effects (shake, recoil, zoom) in response to gameplay events.

There is no existing ADR for the Camera System — this GDD establishes the design; implementation patterns (SpringArm vs. custom camera manager, Lumen exposure settings, etc.) will be documented in the accompanying ADR.

**Key design decisions:**
1. **Third-Person over-the-shoulder** — default gameplay camera with slight offset for weapon visibility
2. **Camera modes** — 5 modes: ThirdPerson, FirstPerson (scoped weapons), Cinematic (cutscenes), Mounted (vehicles/ziplines), Conversation (dialogue OTS framing)
3. **Smooth blending** — transitions between modes use `SetViewTargetWithBlend()` with configurable curve (EaseInOut)
4. **Dynamic effects** — camera shake on impacts, recoil, explosions; spring-arm collision avoidance
5. **Lumen exposure** — auto-exposure tuned for snow glare (bright) vs. prison interior (dark)

## Player Fantasy

The player fantasy is **Exposed Prey** — the camera makes you feel small, vulnerable, and watched. In third-person over-the-shoulder, the player character fills only 15% of the frame; the snowy mountain, the crumbling prison, the alien terraforming in the distance — these dominate. When you step out of cover into open snow, the camera doesn't zoom in for a heroic shot. It holds wide. You feel exposed.

First-person scoping reverses this: the world shrinks to a narrow, claustrophobic tunnel. No peripheral vision. Just the reticle, the breathing, the target. You're a professional, but you're outgunned.

Then the world reacts. When alien terraforming cracks a wall, the camera lurches 15 degrees — not a scripted cutscene, but a living world shifting around you. **Witness to Collapse** — you're not just escaping a prison; you're watching a planet transform, and the camera makes sure you never forget who's really in control.

The fantasy serves **Pillar 1 (Hostile World)** — camera frames the player as small against the transforming world. **Pillar 3 (Tense Survival)** — exposed framing creates vulnerability; scoping creates claustrophobia.

## Detailed Design

### Core Rules

**Camera Mode Switching:**
1. **Default Mode**: ThirdPerson (over-the-shoulder, 15% frame fill). Activates on `Game State = Playing`.
2. **FirstPerson Mode**: Activates when scoping a weapon (Input: `IA_Aim` hold). Returns to ThirdPerson when released.
3. **Cinematic Mode**: Activates on `Game State = Cutscene`. Camera switches to director-framed shot. No player control.
4. **Mounted Mode**: Activates when entering vehicle/zipline. Camera attaches to mount point.
5. **Conversation Mode**: Activates on `Game State = Dialogue`. Over-the-shoulder framing with both characters visible. 250cm from NPC, 30° offset, 55° FOV. 0.5s smooth blend from ThirdPerson.

**Third-Person Parameters:**
- **Arm Length**: 300cm (default), 250cm (crouch), 350cm (sprint)
- **Socket Offset**: (X=0, Y=50, Z=20) — slight right offset for weapon visibility
- **Camera Lag**: `Location=5.0`, `Rotation=5.0` (weighty feel, TLOU2 style)
- **Field of View**: 75° (default), 85° (sprint)

**First-Person Parameters:**
- **FOV**: 60° (scoped), 75° (unscoped)
- **Eye Height**: 165cm (stand), 110cm (crouch)
- **Weapon Visibility**: Full weapon mesh visible, no character mesh
- **Peripheral Vision**: None — full tunnel vision with 10% vignette

**Spring-Arm Collision:**
- Uses `ProbeChannel=ECC_Camera`. Camera retracts on wall proximity.
- Retraction speed: 500cm/s (prevents snapping).
- Minimum arm length: 50cm (prevents camera inside head).

**Camera Shake Triggers:**
- **Hard landing** (fall damage >0): Amplitude=5-15px, Duration=0.3-0.8s based on damage.
- **Weapon recoil**: Amplitude=2-5px, Duration=0.1s, localized to hit direction.
- **Terraforming event**: Camera lurches 15° toward event epicenter, Duration=0.5s.
- **Explosion**: Amplitude=10-20px, Duration=0.3s, falls off with distance.

### Camera Modes

| Mode | FOV | Arm Length | Offset | Lag | Trigger | Transition |
|------|-----|------------|--------|-----|---------|-------------|
| **ThirdPerson** | 75° (def), 85° (sprint) | 300cm | (0,50,20) | 5.0 | `Game State=Playing` | Default on Play |
| **FirstPerson** | 60° (scoped), 75° (unscoped) | N/A | N/A | 0.0 | `IA_Aim` hold (weapon scope) | 0.2s EaseOut |
| **Cinematic** | Shot-specific | Shot-specific | Shot-specific | 0.0 | `Game State=Cutscene` | 0.5s EaseInOut |
| **Mounted** | 75° | Mount-dependent | Mount socket | 2.0 | Vehicle/zipline enter | 0.3s EaseIn |
| **Conversation** | 55° | 250cm from NPC | 30° offset from NPC-to-player vector | 0.0 | `Game State=Dialogue` | 0.5s EaseInOut |

### Interactions with Other Systems

| System | Direction | Data Flow |
|--------|-----------|-----------|
| Input System | Reads camera | `IA_Look` (Axis2D) drives camera rotation. IMC contexts switch with camera mode. |
| Physics System | Reads camera | Impact forces trigger camera shake events via `OnImpact(Force)`. |
| Game State Machine | Reads camera | Camera mode switches based on GSM state (Playing→Cinematic, etc.). |
| Combat System | Writes camera | Applies recoil shakes via `AddRecoil(Amplitude, Duration)`. |
| Movement System | Reads camera | Camera rotation determines movement direction (bOrientRotationToMovement). |
| Player Controller | Reads camera | Owns `APlayerCameraManager` and active camera mode state. |



## Formulas

**Formula 1 — Shake Amplitude**

`A = A_base(c) + (A_max(c) - A_base(c)) × clamp(s, 0, 1)`

**Variables:**

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| c | input | {hard_landing, weapon_recoil, terraform, explosion} | Cause of the shake |
| A_base(c) | lookup | hard_landing:5px, weapon_recoil:2px, terraform:15°, explosion:10px | Base amplitude per cause |
| A_max(c) | lookup | hard_landing:15px, weapon_recoil:5px, terraform:15°, explosion:20px | Maximum amplitude per cause |
| s | input | [0.0, 1.0] | Severity/intensity (fall distance, damage ratio, etc.) |

**Output Range:** hard_landing: [5, 15] px; weapon_recoil: [2, 5] px; terraform: [15, 15]°; explosion: [10, 20] px
**Example:** Explosion at 70% of max radius: A = 10 + (20 - 10) × clamp(0.7, 0, 1) = 17 px.

---

**Formula 2 — FOV Lerp**

`FOV = FOV_source + (FOV_target - FOV_source) × clamp(t, 0, 1)`

**Variables:**

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| FOV_source | input | {75, 70, 90, 60}° | Starting FOV for the transition |
| FOV_target | input | {75, 70, 90, 60}° | Target FOV for the transition |
| t | input | [0.0, 1.0] | Lerp progress (0 = source, 1 = target) |

**Output Range:** [60, 90]° (clamped to valid FOV range)
**Example:** Transition from sprint FOV (85°) to default (75°), 40% through: FOV = 85 + (75 - 85) × clamp(0.4, 0, 1) = 81°.

---

**Formula 3 — Arm Length**

`L = L_state(s)`

**Variables:**

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| s | input | {default, crouch, sprint} | Player state |
| L_state(s) | lookup | default:300, crouch:250, sprint:350 | Arm length per state (cm) |

**Output Range:** Discrete: {250, 300, 350} cm
**Example:** Player starts sprinting: s = sprint → L = L_state(sprint) = 350 cm.

---

**Formula 4 — Peripheral Vignette Intensity**

`V = V_max × clamp(I_scope, 0, 1)`

**Variables:**

| Variable | Symbol | Type | Range | Description |
|----------|--------|------|-------|-------------|
| V_max | const | 10 % | Maximum vignette intensity for first-person scope |
| I_scope | input | [0.0, 1.0] | Scope intensity (0 = not scoped, 1 = fully scoped) |

**Output Range:** [0, 10] % (clamped)
**Example:** Player enters scoped view fully: V_max = 10%, I_scope = 1.0 → V = 10%.

## Edge Cases

1. **If player toggles scope while sprinting**: Camera uses 60° FOV (scoped takes priority over sprint). On scope release, FOV returns to 85° (sprint), not 75° (default). Sprint state is cached during scope.

2. **If spring-arm retracts to minimum 50cm in tiny room**: Camera stops at 50cm. Player view clips through character mesh if space <50cm. No further retraction possible. Rationale: 50cm minimum prevents camera-inside-head.

3. **If switching to Cinematic mode while FirstPerson scoped is active**: Camera cuts immediately to Cinematic view (no blend from FirstPerson). On cinematic end, returns to ThirdPerson default — scope state is cleared, not restored. Rationale: Cutscenes are narrative interruptions; restoring temporary weapon state breaks gameplay flow.

4. **If explosion and terraform shake trigger simultaneously**: Shakes stack additively, capped at 25px amplitude / 15° rotation. Explosion drives positional shake; terraform drives rotational lurch; both apply independently.

5. **If spring-arm collision triggers during sprint (350cm arm + wall proximity)**: Retraction speed remains 500cm/s regardless of player sprint velocity. Camera retracts smoothly; sprint speed doesn't cause snap-back. Rationale: Retraction is a camera-system constant, not tied to movement speed.

6. **If player mounts vehicle while in FirstPerson mode**: Camera switches immediately to Mounted mode (no blend from FirstPerson). Scope state cleared. Mounted camera uses mount-point socket, ignoring previous arm length. Rationale: Blending from FirstPerson would expose interior geometry during transition.

7. **If cutscene ends**: Camera returns to ThirdPerson mode unconditionally. Pre-cutscene state (scoped, sprint FOV, etc.) is NOT restored. Rationale: The cutscene is a hard narrative override; the player must re-establish gameplay states intentionally afterward.

8. **If camera lag (5.0) combines with fast 180° turn**: Camera rotation lags ~300ms behind input at max turn speed. May overshoot slightly due to inertia, then settle. Rationale: TLOU2-style weighty feel is intentional; 5.0 is the safe upper bound to prevent disorientation.

9. **If multiplayer (future) with two players**: Each player has an independent `APlayerCameraManager`. Camera priority order: Cinematic > Mounted > FirstPerson > ThirdPerson. No cross-player camera conflicts exist. Rationale: Each player's camera is locally managed; priority only applies within a single player's camera stack.

## Dependencies

**Hard Dependencies** (system cannot function without):
- **Input System** ✅ (designed) — `IA_Look` (Axis2D) drives camera rotation. IMC contexts switch with camera mode changes.
- **Physics System** ✅ (designed) — impact forces trigger camera shake events via `OnImpact(Force)`.

**Soft Dependencies** (enhanced by camera but works without):
- **Game State Machine** ✅ (designed) — camera mode switches based on GSM state (Playing→Cinematic, etc.).

**Depended On By:**

| System | Interface Used | Expected Behavior |
|--------|---------------|-------------------|
| Player Controller | `GetCameraMode()`, `GetCameraRotation()` | Owns `APlayerCameraManager`, active mode state |
| Movement System | `GetCameraRotation()` | Camera rotation determines movement direction |
| Combat System | `AddRecoil(Amplitude, Duration)` | Applies recoil shakes per weapon class |
| HUD System | `GetCameraFOV()`, `IsFirstPerson()` | HUD visibility changes per camera mode |
| Photo Mode | `SetCameraMode(Cinematic)` | Uses cinematic mode for photo framing |

**Interface Contract:**

```cpp
// Camera System public interface (C++ sketch)
class ICameraSystem {
    // Mode management
    ECameraMode GetCurrentMode();
    void SetCameraMode(ECameraMode NewMode, float BlendTime=0.2f);
    void BlendToMode(ECameraMode Target, float Duration, EEasingFunc Easing=EaseInOut);

    // Parameters
    float GetFOV();
    FVector GetSocketOffset();
    float GetArmLength();

    // Dynamic effects
    void AddShake(ECameraShakeType Type, float Amplitude, float Duration);
    void AddRecoil(FVector2D RecoilAmount);

    // Events
    FDelegateHandle SubscribeToModeChanged(FModeChangedDelegate Callback);
    void Unsubscribe(FDelegateHandle Handle);
}
```

## Tuning Knobs

| Knob | Type | Default | Range | Effect if too high | Effect if too low |
|------|------|---------|-------|-------------------|-------------------|
| `DefaultFOV` | float | 75° | 60–90° | Tunnel vision, narrow awareness | Too wide, distortion at edges |
| `SprintFOV` | float | 85° | 60–95° | Dizzying FOV change on sprint | Sprint doesn't feel faster |
| `ScopedFOV` | float | 60° | 50–75° | Too narrow, can't see threats | Scope doesn't feel zoomed |
| `ArmLength_Default` | float | 300cm | 200–500cm | Player fills too much of frame | Player too small, disorienting |
| `ArmLength_Crouch` | float | 250cm | 150–400cm | Camera clips through floor | Crouch doesn't feel lower |
| `ArmLength_Sprint` | float | 350cm | 250–500cm | Over-the-shoulder feel lost | Sprint doesn't feel faster |
| `CameraLag_Location` | float | 5.0 | 0.0–15.0 | Very sluggish, motion sickness | Camera feels snappy, arcade |
| `CameraLag_Rotation` | float | 5.0 | 0.0–15.0 | Severe overshoot on fast turns | Camera snaps, feels robotic |
| `SpringRetractSpeed` | float | 500cm/s | 200–1000cm/s | Snap-back on wall proximity | Slow retraction, camera stays clipped |
| `ShakeAmplitude_Max` | float | 20px | 5–50px | Excessive shake, motion sickness | Impacts feel weak |
| `Vignette_MaxScope` | float | 10% | 0–25% | Too dark in scope, can't see | Scope doesn't feel claustrophobic |
| `BlendDuration_Default` | float | 0.2s | 0.1–1.0s | Long, noticeable transitions | Snap transitions, jarring |

## Visual/Audio Requirements

### Visual Effects
- **Camera shake**: Perlin noise procedural shake (UCameraShakeBase). Positional for impacts, rotational for terraform events.
- **Vignette (FirstPerson scope)**: 10% radial vignette, smooth lerp over 0.1s on scope activation.
- **FOV transition**: Smooth lerp between FOV states. No snap transitions.
- **Cinematic framing**: Director-set camera shots via Sequencer. Camera System reads shot parameters (location, rotation, FOV, DOF).

### Audio Requirements
- **Camera movement audio**: Subtle whoosh on fast camera rotation (180°+ turns), 0.1s fade.
- **Mode switch audio**: Soft click on FirstPerson↔ThirdPerson transition (0.05s, low frequency).
- **Scope audio**: Lens zoom whoosh (0.15s, mid-frequency slide), breathing audio layer in scope mode (TLOU2 reference).
- **Terraform rumble**: Low-frequency rumble (40Hz) during camera lurch events, 0.5s decay.

### Art Bible Alignment
- **"World as antagonist"**: Camera frames player small against transforming world (15% frame fill).
- **"Cinematic Realism"**: TLOU2-style weighty lag (5.0), RDR2-style cinematic cutscene framing.
- **"Immersive-first HUD"**: Camera integrates with HUD — minimal HUD in ThirdPerson, none in FirstPerson scope.

## UI Requirements

| Context | HUD Element | Notes |
|---------|-------------|-------|
| ThirdPerson (default) | Minimal HUD (immersive-first) | Small ammo/health indicators, no crosshair |
| FirstPerson unscoped | Weapon crosshair centered | No peripheral HUD elements |
| FirstPerson scoped | Full tunnel vision, 10% vignette, no HUD | Crosshair only, immersive focus |
| Cinematic | No HUD elements | Full director framing, player input blocked |
| Mounted | Minimal speed/altitude indicator | Context-dependent (vehicle vs. zipline) |

**Toggleable Full Tactical HUD adds:**
- Current FOV display
- Camera mode indicator
- Arm length / lag values (debug only)


## Acceptance Criteria

**GIVEN** Camera is in ThirdPerson mode (300cm arm, 75° FOV), **WHEN** player scopes a weapon (IA_Aim hold), **THEN** camera switches to FirstPerson (60° FOV), 10% vignette activates, transition completes in 0.2s.

**GIVEN** Camera in ThirdPerson (arm=300cm), **WHEN** player starts sprinting, **THEN** arm length lerps to 350cm, FOV lerps to 85°, transition completes in 0.2s.

**GIVEN** Camera in ThirdPerson, **WHEN** player falls with impact velocity 1200 cm/s (fall damage 60 HP), **THEN** camera shake triggers with amplitude 5-15px (scaled to damage), duration 0.3-0.8s. 

**GIVEN** Camera in FirstPerson scoped (60° FOV, 10% vignette), **WHEN** player releases IA_Aim, **THEN** camera returns to ThirdPerson (75° FOV), vignette removed, transition completes in 0.2s. 

**GIVEN** Camera in ThirdPerson, **WHEN** Game State changes to Cutscene, **THEN** camera switches to Cinematic mode (shot-specific parameters), all player control disabled, transition completes in 0.5s. 

**GIVEN** Camera in ThirdPerson (arm=300cm), **WHEN** spring-arm detects wall proximity <50cm, **THEN** arm retracts smoothly to 50cm minimum, retract speed 500cm/s. 

**GIVEN** Camera in ThirdPerson, **WHEN** terraform event triggers nearby, **THEN** camera lurches 15° toward epicenter, duration 0.5s, independent of other shakes. 

**GIVEN** Camera in ThirdPerson, **WHEN** player enters vehicle, **THEN** camera switches to Mounted mode (mount socket), FirstPerson state cleared, transition completes in 0.3s. 

**GIVEN** Camera in ThirdPerson, **WHEN** player performs 180° fast turn, **THEN** camera rotation lags ~300ms behind input (lag=5.0), may overshoot slightly then settle. 

## Open Questions

**OQ-1: Camera-first vs. player-first during cutscenes?** When in Cinematic mode, should the player retain limited camera rotation (TLOU2 style) or fully lock (RDR2 style)? **Owner**: Creative Director + Design | **Target**: Player Fantasy alignment.

**OQ-2: Should sprint FOV change be instant or lerped?** Currently uses Formula 2 (lerp over 0.2s). Some games (Doom Eternal) use instant FOV jump for combat feel. **Owner**: Design | **Target**: Player Fantasy.

**OQ-3: First-person scope — render weapon or just environment?** Full weapon mesh visible (Halo style) or just the scoped view (COD style)? Affects performance budget. **Owner**: Art + Performance | **Target**: Art bible approval.

**OQ-4: Camera lag — separate values for location vs. rotation?** Currently both at 5.0. Should rotation lag be lower (faster response) while location lag stays high (weighty feel)? **Owner**: Design + Gameplay Programmer | **Target**: Tuning Knobs.

**OQ-5: Terraform camera reactions — how many degrees?** Currently 15° lurch. Should this scale with event severity (small crack = 5°, massive terraform = 20°)? **Owner**: Design + Creative Director | **Target**: Edge Cases.

**OQ-6: Multiplayer camera priority — each player independent?** Currently designed for single-player. If multiplayer added, should camera modes sync or stay independent? **Owner**: Architecture | **Target**: Architecture ADR.

**OQ-7: Photo Mode — which camera mode does it use?** Photo Mode (system #25) depends on Camera System. Does it use a special "Photo" mode or repurpose Cinematic mode? **Owner**: Design + Photo Mode GDD | **Target**: Photo Mode GDD.