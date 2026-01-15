# Examples Guide

Fluxion-Js includes a set of runnable examples in the `examples/` folder. Each example is a small, focused project with its own `index.html` and `game.js`.

## How to run examples

Most examples use ES modules (`<script type="module">`) and should be served from a local web server (opening via `file://` may fail due to browser module/CORS rules).

1. Install deps (once):

```bash
npm install
```

2. Start the static server:

```bash
npm run web
```

3. Open an example in your browser:

- `http://localhost:8080/examples/ActiveTest/`
- `http://localhost:8080/examples/PostProcessing/`

(You can also add `index.html` explicitly if you prefer.)

## Categories

### Core / Basics

- **ActiveTest** (`examples/ActiveTest/`)

  - Minimal scene that demonstrates the `active` flag behavior.

- **LayerTest** (`examples/LayerTest/`)

  - Loads a scene from `scene.xml` and shows how draw order is controlled by object `layer`.

- **ResolutionTest** (`examples/ResolutionTest/`)

  - Demonstrates how the engine scales/letterboxes to a target resolution.

- **AllNodesTest** (`examples/AllNodesTest/`)
  - Broad coverage test scene for many built-in node/object types.

### Animation

- **AnimationTest** (`examples/AnimationTest/`)

  - Sprite sheet animation basics.

- **MultiImageAnimationTest** (`examples/MultiImageAnimationTest/`)

  - Animation using multiple images/frames.

- **Character** (`examples/Character/`)
  - Character-style movement/behavior sample.

### Text / Fonts

- **TextTest** (`examples/TextTest/`)

  - Text rendering and updating.

- **FontTest** (`examples/FontTest/`)
  - Font loading/rendering behavior.

### Scenes / Loading / UI

- **MultiScene** (`examples/MultiScene/`)

  - Switches between a menu and game scene loaded from XML.
  - Controls:
    - Menu: click the icon or press `Enter`
    - Game: `WASD` move, `Escape` to return to menu

- **XamlLoading** (`examples/XamlLoading/`)

  - Loads a scene from `scene.xaml` and demonstrates hitbox interactions.
  - Controls:
    - Hover/click: interactive sprite reacts
    - Arrow keys: move the camera defined in the scene

- **Jolly3Chapter2Elevator** (`examples/Jolly3Chapter2Elevator/`)

  - Larger FNAF game style example (includes assets and sounds).

- **Jolly3Chapter2ElevatorXaml** (`examples/Jolly3Chapter2ElevatorXaml/`)
  - XAML-loading variant of the elevator example.

### Rendering / Effects

- **PostProcessing** (`examples/PostProcessing/`)

  - Demonstrates post-processing effects.
  - Controls: `1` grayscale, `2` blur, `3` CRT, `4` contrast, `0` clear

- **SpriteComparison** (`examples/SpriteComparison/`)
  - Compares sprite usage/performance patterns.

## Import patterns (not a runnable example)

- `examples/IMPORT_EXAMPLES.js` shows different ways to import Fluxion modules (from `packages/engine/Fluxion/index.js`, from `packages/engine/Fluxion/Core/index.js`, and from `packages/engine/Fluxion/extras.js`).
