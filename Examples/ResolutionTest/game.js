import { Engine, Text, Input, Sprite } from '../../Fluxion/index.js';

const input = new Input();

class ResolutionGame {
    constructor() {
        this.engine = null;
        this.infoText = null;
        this.hintText = null;
        this.centerText = null;
        this.logo = null;
        this.isFullscreen = false;
        this._t = 0;
        this.uiCamera = { x: 0, y: 0, zoom: 1, rotation: 0 };
    }

    init(renderer) {
        // Put a sprite on screen so MSAA differences are visible when rotated.
        const LOGO = "../../Fluxion/Icon/Fluxion_icon.png";
        this.logo = new Sprite(renderer, LOGO, 440, 160, 400, 400);

        // Create text overlays
        // Constructor: renderer, text, x, y, fontSize, fontFamily, color
        this.infoText = new Text(renderer, "Resolution Test", 50, 50, 44, "Arial", "white");
        this.hintText = new Text(renderer, "", 50, 120, 22, "Arial", "white");
        this.centerText = new Text(renderer, "", 0, 0, 80, "Arial", "white");

        // Keep camera at default position so UI text stays visible.
        // We'll still rotate slightly to make diagonal edges.
        
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

            const msaaRequested = this.engine.getRequestedMsaaSamples?.() ?? 0;
            const msaaActive = this.engine.getMsaaSamples?.() ?? 0;
            
            statusDiv.innerText =
                `Window: ${winW}x${winH}` +
                `\nCanvas: ${canvasW}x${canvasH}` +
                `\nFullscreen: ${this.isFullscreen}` +
                `\nMSAA: ${msaaActive}x (requested: ${msaaRequested}x)` +
                `\nKeys: 1-4 set MSAA, 0 disables`;
        };

        // Initial status update
        setTimeout(() => this.updateStatus(), 100);
        
        // Listen for resize events to update status
        window.addEventListener('resize', () => {
            setTimeout(() => this.updateStatus(), 100); // Small delay to let layout settle
        });
    }

    update(deltaTime) {
        this._t += deltaTime;

        // Slow camera rotation to create diagonal edges
        if (this.engine && this.engine.camera) {
            this.engine.camera.rotation = Math.sin(this._t * 0.7) * 0.25;
        }

        // Realtime MSAA controls (works because this example enables post-processing)
        if (input.getKeyDown('1')) this.engine.setMsaaSamples(1);
        if (input.getKeyDown('2')) this.engine.setMsaaSamples(2);
        if (input.getKeyDown('3')) this.engine.setMsaaSamples(3);
        if (input.getKeyDown('4')) this.engine.setMsaaSamples(4);
        if (input.getKeyDown('0')) this.engine.setMsaaSamples(0);

        if (this.infoText) {
            const w = this.engine.renderer.canvas.width;
            const h = this.engine.renderer.canvas.height;
            const requested = this.engine.getRequestedMsaaSamples();
            const active = this.engine.getMsaaSamples();
            this.infoText.text =
                `Internal Resolution: ${w}x${h}` +
                `\nMSAA: ${active}x (requested: ${requested}x)` +
                `\nKeys: 1-4 set MSAA, 0 disables`;
        }

        if (this.hintText) {
            this.hintText.text = 'Tip: look at the rotated logo edges while switching MSAA';
        }

        if (this.centerText) {
            const requested = this.engine.getRequestedMsaaSamples();
            const active = this.engine.getMsaaSamples();
            this.centerText.text = `MSAA: ${active}x`;

            // Center in the logical game resolution (world units == pixels)
            const tw = this.engine.renderer.targetWidth;
            const th = this.engine.renderer.targetHeight;
            this.centerText.x = (tw - this.centerText.width) / 2;
            this.centerText.y = (th - this.centerText.height) / 2;
        }
    }

    draw(renderer) {
        if (this.logo) {
            this.logo.draw();
        }

        // Draw UI text unrotated/unmoved so it's always readable.
        renderer.applyTransform(this.uiCamera);

        if (this.centerText) this.centerText.draw();
        if (this.infoText) this.infoText.draw();
        if (this.hintText) this.hintText.draw();
    }
}

const game = new ResolutionGame();
// Initialize engine with a default resolution
const engine = new Engine("gameCanvas", game, 1280, 720, true, true, {
    renderer: {
        webglVersion: 2,
        allowFallback: true,
        renderTargets: {
            msaaSamples: 4,
        },
    },
});
game.engine = engine; // Give game access to engine