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

        // Load default font and version info
        Promise.all([this.loadDefaultFont(), this.loadVersionInfo()])
            .then(() => {
                // Wait for renderer to be ready before starting
                this.renderer.readyPromise.then(() => {
                    // Initialize the game
                    if (this.game.init) {
                        this.game.init(this.renderer);
                    }
                    
                    requestAnimationFrame(this.loop.bind(this));
                });
            })
            .catch(error => {
                console.error("Engine initialization aborted due to critical error:", error);
            });
    } 

    async loadVersionInfo() {
        try {
            const response = await fetch(new URL('../version.py', import.meta.url));
            if (!response.ok) {
                throw new Error(`Version file missing or inaccessible (Status: ${response.status})`);
            }

            const text = await response.text();
            const lines = text.split('\n');
            const versionInfo = {};
            lines.forEach(line => {
                const match = line.match(/^([A-Z_]+)\s*=\s*"(.*)"/);
                if (match) {
                    versionInfo[match[1]] = match[2];
                }
            });

            if (!versionInfo.ENGINE_NAME || !versionInfo.VERSION) {
                throw new Error("Version file is corrupted or missing required fields.");
            }

            console.log(`Fluxion Engine Loaded: ${versionInfo.ENGINE_NAME} v${versionInfo.VERSION} (${versionInfo.CODENAME})`);
            this.versionInfo = versionInfo;
        } catch (error) {
            console.error("CRITICAL ERROR: Failed to load engine version info.", error);
            alert("CRITICAL ERROR: Engine version file (version.py) is missing or corrupted. The engine cannot start.");
            throw error; // Stop initialization
        }
    }

    async loadDefaultFont() {
        try {
            // Resolve font path relative to this module
            const fontUrl = new URL('../Font/Inter-VariableFont_opsz,wght.ttf', import.meta.url).href;
            const font = new FontFace('Inter', `url(${fontUrl})`);
            await font.load();
            document.fonts.add(font);
            console.log("Default font 'Inter' loaded successfully.");
        } catch (error) {
            console.error("Failed to load default font:", error);
        }
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
