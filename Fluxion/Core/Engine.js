import Renderer from "./Renderer.js";
import Camera from "./Camera.js";

export default class Engine {
    constructor(canvasId, game, enablePostProcessing = false) {
        // Initialize Renderer with post-processing support
        this.renderer = new Renderer(canvasId, enablePostProcessing);
        this.camera = new Camera();
        
        this.game = game;
        this.game.camera = this.camera;
        
        this.lastTime = 0;

        // Initialize the game
        if (this.game.init) {
            this.game.init(this.renderer);
        }
        
        requestAnimationFrame(this.loop.bind(this));
    } 

    loop(timestamp = 0) {
        const deltaTime = (timestamp - this.lastTime) / 1000;
        this.lastTime = timestamp;

        // Update the game logic
        if (this.game.update) {
            this.game.update(deltaTime);
        }
        
        // Clear the renderer and apply camera transformations
        this.renderer.clear();
        this.renderer.applyTransform(this.camera);

        // If post-processing effects are enabled, apply them
        if (this.renderer.enablePostProcessing) {
            this.renderer.applyPostProcessingEffects();
        }
        
        // Draw the game elements
        if (this.game.draw) {
            this.game.draw(this.renderer);
        }
        
        // Request the next frame
        requestAnimationFrame(this.loop.bind(this));
    }
}
