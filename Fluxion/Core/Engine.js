import Renderer from "./Renderer.js";
import Camera from "./Camera.js";
import Window from "./Window.js";

export default class Engine {
    constructor(canvasId, game, targetWidth = 1920, targetHeight = 1080, maintainAspectRatio = true, enablePostProcessing = false) {
        // Initialize Renderer with aspect ratio settings and post-processing
        this.renderer = new Renderer(canvasId, targetWidth, targetHeight, maintainAspectRatio, enablePostProcessing);
        this.camera = new Camera();
        this.window = new Window();
        
        this.game = game;
        this.game.camera = this.camera;
        this.game.window = this.window;
        
        this.lastTime = 0;

        // Wait for renderer to be ready before starting
        this.renderer.readyPromise.then(() => {
            // Initialize the game
            if (this.game.init) {
                this.game.init(this.renderer);
            }
            
            requestAnimationFrame(this.loop.bind(this));
        });
    } 

    loop(timestamp = 0) {
        const deltaTime = (timestamp - this.lastTime) / 1000;
        this.lastTime = timestamp;

        // Update the game logic
        if (this.game.update) {
            this.game.update(deltaTime);
        }
        
        // Clear the renderer and apply camera transformations
        this.renderer.beginFrame();
        this.renderer.applyTransform(this.camera);
        
        // Draw the game elements
        if (this.game.draw) {
            this.game.draw(this.renderer);
        }
        
        // Finish the frame (apply post-processing if enabled)
        this.renderer.endFrame();
        
        // Request the next frame
        requestAnimationFrame(this.loop.bind(this));
    }
}
