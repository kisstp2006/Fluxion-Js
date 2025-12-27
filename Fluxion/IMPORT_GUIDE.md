# Fluxion Engine - Import System Guide

## Overview

The Fluxion engine now supports a streamlined import system that allows you to import all core features with a single line of code, or selectively import only what you need for optimal bundle sizes.

## Quick Start

### Before (Old Way)
```javascript
import Engine from "../../Fluxion/Core/Engine.js";
import Sprite from "../../Fluxion/Core/Sprite.js";
import Input from "../../Fluxion/Core/Input.js";
import SceneLoader from "../../Fluxion/Core/SceneLoader.js";
```

### After (New Way)
```javascript
// Import everything you need in one line!
import { Engine, Sprite, Input, SceneLoader } from "../../Fluxion/index.js";
```

## Import Options

### 1. Import All Core Features (Namespace Import)

Perfect for larger projects where you use most of the engine features.

```javascript
import * as Fluxion from './Fluxion/index.js';

// Usage:
const engine = new Fluxion.Engine('canvas', game);
const sprite = new Fluxion.Sprite(renderer, 'image.png');
const input = new Fluxion.Input();
```

### 2. Selective Import (Recommended)

Best for most projects - import only what you need for smaller bundle sizes.

```javascript
import { Engine, Sprite, Input, Camera } from './Fluxion/index.js';

// Usage:
const engine = new Engine('canvas', game);
const sprite = new Sprite(renderer, 'image.png');
const input = new Input();
```

### 3. Import Extras Separately

Advanced features like PostProcessing, Physics, and Audio can be imported from extras to keep your core bundle lean.

```javascript
// Import core features
import { Engine, Sprite, Input } from './Fluxion/index.js';

// Import extras only when needed
import { PostProcessing, Physic, Audio } from './Fluxion/extras.js';

// Usage:
const engine = new Engine('canvas', game);
const postFx = new PostProcessing(renderer);
```

### 4. Core-Only Import

If you only want core modules without any extras.

```javascript
import * as Core from './Fluxion/Core/index.js';

// Usage:
const engine = new Core.Engine('canvas', game);
```

## Available Modules

### Core Modules (from `./Fluxion/index.js`)

#### Engine & Rendering
- **Engine** - Main game engine class
- **Renderer** - WebGL renderer
- **Camera** - Camera system
- **Window** - Window management

#### Sprites & Animation
- **Sprite** - Basic sprite rendering
- **AnimatedSprite** - Animated sprite support

#### Scene Management
- **Scene** - Scene management
- **SceneLoader** - Load scenes from XML
- **Layers** - Layer management

#### Input & Interaction
- **Input** - Keyboard and mouse input
- **ClickableArea** - Clickable regions

#### Utilities
- **Transform** - Transform utilities
- **Math** - Math utilities
- **Text** - Text rendering

#### Optional Core Features
- **Physic** - Physics system (also in extras)
- **Audio** - Audio system (also in extras)
- **PostProcessing** - Post-processing effects (also in extras)

### Extra Modules (from `./Fluxion/extras.js`)

Advanced features that can be imported separately:
- **PostProcessing** - Advanced visual effects
- **Physic** - Physics simulation
- **Audio** - Audio playback and management

## Migration Guide

### Step 1: Update Your Imports

**Old:**
```javascript
import Engine from "../../Fluxion/Core/Engine.js";
import Sprite from "../../Fluxion/Core/Sprite.js";
import Input from "../../Fluxion/Core/Input.js";
import SceneLoader from "../../Fluxion/Core/SceneLoader.js";
```

**New:**
```javascript
import { Engine, Sprite, Input, SceneLoader } from "../../Fluxion/index.js";
```

### Step 2: No Code Changes Needed!

The rest of your code remains exactly the same. The classes work identically.

### Step 3: (Optional) Optimize with Extras

If you're using PostProcessing, Physics, or Audio, consider importing them from extras:

```javascript
// Core imports
import { Engine, Sprite, Input } from './Fluxion/index.js';

// Advanced features
import { PostProcessing } from './Fluxion/extras.js';
```

## Examples

### Complete Game Example

```javascript
import { Engine, Input, SceneLoader } from "../../Fluxion/index.js";

const input = new Input();

const game = {
    scene: null,

    async init(renderer) {
        this.scene = await SceneLoader.load("./scene.xml", renderer);
        console.log("Game started!");
    },

    update(deltaTime) {
        if (!this.scene) return;
        
        const player = this.scene.getObjectByName("Player");
        if (player) {
            const speed = 500;
            if (input.getKey("w")) player.y -= speed * deltaTime;
            if (input.getKey("s")) player.y += speed * deltaTime;
            if (input.getKey("a")) player.x -= speed * deltaTime;
            if (input.getKey("d")) player.x += speed * deltaTime;
        }
        
        this.scene.update(deltaTime);
    },

    draw(renderer) {
        if (this.scene) {
            this.scene.draw(renderer);
        }
    }
};

window.onload = async () => {
    new Engine("gameCanvas", game, 1920, 1080, true);
};
```

### Advanced Example with Post-Processing

```javascript
import { Engine, Sprite, Camera } from './Fluxion/index.js';
import { PostProcessing } from './Fluxion/extras.js';

const game = {
    postFx: null,

    async init(renderer) {
        // Enable post-processing effects
        this.postFx = new PostProcessing(renderer);
        this.postFx.addEffect('blur', 0.5);
        this.postFx.addEffect('crt', 1.0);
    },

    update(deltaTime) {
        // Game logic
    },

    draw(renderer) {
        // Render with post-processing
    }
};

window.onload = async () => {
    new Engine("gameCanvas", game, 1920, 1080, true, true);
};
```

## Benefits

✅ **Cleaner Code**: One import line instead of many  
✅ **Better Organization**: Clear separation between core and extras  
✅ **Smaller Bundles**: Import only what you need  
✅ **Easier Refactoring**: Change imports in one place  
✅ **Type-Safe**: Full IDE autocomplete support  
✅ **Backwards Compatible**: Old imports still work!

## File Structure

```
Fluxion/
├── index.js              # Main entry point - exports all core
├── extras.js             # Advanced/optional features
└── Core/
    ├── index.js          # Core module aggregator
    ├── Engine.js
    ├── Sprite.js
    ├── Input.js
    └── ... (all core modules)
```

## Best Practices

1. **Use selective imports** for most projects - only import what you need
2. **Import extras separately** to keep your bundle size optimized
3. **Use namespace imports** (`import * as Fluxion`) for demos or when using most features
4. **Consistent paths**: Always import from `./Fluxion/index.js` or `./Fluxion/extras.js`

## Compatibility

- ✅ Works with existing code (no breaking changes)
- ✅ Works with all modern browsers
- ✅ Works with bundlers (Webpack, Vite, etc.)
- ✅ Full ES6 module support

## See Also

- [Examples/IMPORT_EXAMPLES.js](../Examples/IMPORT_EXAMPLES.js) - Comprehensive import examples
- [Examples/Character/game_new.js](../Examples/Character/game_new.js) - Migrated example
