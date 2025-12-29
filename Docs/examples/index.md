# Examples Guide

Fluxion-Js includes a set of runnable examples in the `Examples/` folder. Each example is a small, focused project with its own `index.html` and `game.js`.

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

- `http://localhost:8080/Examples/ActiveTest/`
- `http://localhost:8080/Examples/PostProcessing/`

(You can also add `index.html` explicitly if you prefer.)

## Categories

### Core / Basics

- **ActiveTest** (`Examples/ActiveTest/`)

  - Minimal scene that demonstrates the `active` flag behavior.

- **LayerTest** (`Examples/LayerTest/`)

  - Loads a scene from `scene.xml` and shows how draw order is controlled by object `layer`.

- **ResolutionTest** (`Examples/ResolutionTest/`)

  - Demonstrates how the engine scales/letterboxes to a target resolution.

- **AllNodesTest** (`Examples/AllNodesTest/`)
  - Broad coverage test scene for many built-in node/object types.

### Animation

- **AnimationTest** (`Examples/AnimationTest/`)

  - Sprite sheet animation basics.

- **MultiImageAnimationTest** (`Examples/MultiImageAnimationTest/`)

  - Animation using multiple images/frames.

- **Character** (`Examples/Character/`)
  - Character-style movement/behavior sample.

### Text / Fonts

- **TextTest** (`Examples/TextTest/`)

  - Text rendering and updating.

- **FontTest** (`Examples/FontTest/`)
  - Font loading/rendering behavior.

### Scenes / Loading / UI

- **MultiScene** (`Examples/MultiScene/`)

  - Switches between a menu and game scene loaded from XML.
  - Controls:
    - Menu: click the icon or press `Enter`
    - Game: `WASD` move, `Escape` to return to menu

- **XamlLoading** (`Examples/XamlLoading/`)

  - Loads a scene from `scene.xaml` and demonstrates hitbox interactions.
  - Controls:
    - Hover/click: interactive sprite reacts
    - Arrow keys: move the camera defined in the scene

- **Jolly3Chapter2Elevator** (`Examples/Jolly3Chapter2Elevator/`)

  - Larger FNAF game style example (includes assets and sounds).

- **Jolly3Chapter2ElevatorXaml** (`Examples/Jolly3Chapter2ElevatorXaml/`)
  - XAML-loading variant of the elevator example.

### Rendering / Effects

- **PostProcessing** (`Examples/PostProcessing/`)

  - Demonstrates post-processing effects.
  - Controls: `1` grayscale, `2` blur, `3` CRT, `4` contrast, `0` clear

- **SpriteComparison** (`Examples/SpriteComparison/`)
  - Compares sprite usage/performance patterns.

## Import patterns (not a runnable example)

- `Examples/IMPORT_EXAMPLES.js` shows different ways to import Fluxion modules (from `Fluxion/index.js`, from `Fluxion/Core/index.js`, and from `Fluxion/extras.js`).
