/**
 * Fluxion Engine - Import Examples
 * This file demonstrates all the different ways to import Fluxion modules
 */

// ============================================================================
// OPTION 1: Import everything from core with one line (recommended for most projects)
// ============================================================================
import * as Fluxion from '../packages/engine/Fluxion/index.js';

// Usage:
// const engine = new Fluxion.Engine('canvas', game);
// const sprite = new Fluxion.Sprite(renderer, 'image.png');
// const input = new Fluxion.Input();


// ============================================================================
// OPTION 2: Import only what you need (best for smaller bundles)
// ============================================================================
import { Engine, Sprite, Input, SceneLoader } from '../packages/engine/Fluxion/index.js';

// Usage:
// const engine = new Engine('canvas', game);
// const sprite = new Sprite(renderer, 'image.png');
// const input = new Input();


// ============================================================================
// OPTION 3: Import from Core directly (for granular control)
// ============================================================================
import * as Core from '../packages/engine/Fluxion/Core/index.js';

// Usage:
// const engine = new Core.Engine('canvas', game);
// const sprite = new Core.Sprite(renderer, 'image.png');


// ============================================================================
// OPTION 4: Import extras separately (for advanced features)
// ============================================================================
import { PostProcessing, Physic, Audio } from '../packages/engine/Fluxion/extras.js';

// Usage:
// const postFx = new PostProcessing(renderer);
// const physics = new Physic();
// const audio = new Audio();


// ============================================================================
// OPTION 5: Mix core and extras
// ============================================================================
import { Engine, Sprite, Input } from '../packages/engine/Fluxion/index.js';
import { PostProcessing } from '../packages/engine/Fluxion/extras.js';

// Usage:
// const engine = new Engine('canvas', game);
// const postFx = new PostProcessing(renderer);


// ============================================================================
// EXAMPLE GAME USING NEW IMPORT SYSTEM
// ============================================================================

// Simple import
import { Engine as FluxionEngine, Sprite as FluxionSprite, Input as FluxionInput, SceneLoader as FluxionSceneLoader } from '../packages/engine/Fluxion/index.js';

const input = new FluxionInput();

const game = {
    scene: null,

    async init(renderer) {
        this.scene = await FluxionSceneLoader.load("./scene.xml", renderer);
        console.log("Game initialized with new import system!");
    },

    update(deltaTime) {
        // Game update logic
    },

    draw(renderer, camera) {
        // Game draw logic
        if (this.scene) {
            this.scene.draw(renderer, camera);
        }
    }
};

// Create engine instance
const engine = new FluxionEngine("gameCanvas", game, 1920, 1080);
