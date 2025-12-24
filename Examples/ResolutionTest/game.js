import Engine from '../../Fluxion/Core/Engine.js';
import Text from '../../Fluxion/Core/Text.js';

class ResolutionGame {
    constructor() {
        this.engine = null;
        this.infoText = null;
        this.isFullscreen = false;
    }

    init(renderer) {
        // Create a text object to show internal resolution
        // Constructor: renderer, text, x, y, fontSize, fontFamily, color
        this.infoText = new Text(renderer, "Resolution Test", 50, 50, 24, "Arial", "white");
        
        // Setup UI handlers
        this.setupUI();
    }

    setupUI() {
        const btnFullscreen = document.getElementById('btn-fullscreen');
        const statusDiv = document.getElementById('status');

        btnFullscreen.addEventListener('click', () => {
            this.isFullscreen = !this.isFullscreen;
            this.engine.setFullScreen(this.isFullscreen);
            this.updateStatus();
        });

        // Expose setRes to global scope for HTML buttons
        window.setRes = (w, h) => {
            this.engine.setWindowSize(w, h);
            // Status update will happen on resize event
        };

        this.updateStatus = () => {
            const winW = window.innerWidth;
            const winH = window.innerHeight;
            const canvasW = this.engine.renderer.canvas.width;
            const canvasH = this.engine.renderer.canvas.height;
            
            statusDiv.innerText = `Window: ${winW}x${winH}\nCanvas: ${canvasW}x${canvasH}\nFullscreen: ${this.isFullscreen}`;
        };

        // Initial status update
        setTimeout(() => this.updateStatus(), 100);
        
        // Listen for resize events to update status
        window.addEventListener('resize', () => {
            setTimeout(() => this.updateStatus(), 100); // Small delay to let layout settle
        });
    }

    update(deltaTime) {
        // Update logic if needed
        if (this.infoText) {
            this.infoText.text = `Internal Resolution: ${this.engine.renderer.canvas.width}x${this.engine.renderer.canvas.height}`;
        }
    }

    draw(renderer) {
        renderer.clear();
        if (this.infoText) {
            this.infoText.render(renderer);
        }
    }
}

const game = new ResolutionGame();
// Initialize engine with a default resolution
const engine = new Engine("gameCanvas", game, 1280, 720);
game.engine = engine; // Give game access to engine