import Renderer from "./Renderer.js";
import Camera from "./Camera.js";
import Window from "./Window.js";
import SplashScreen from "./SplashScreen.js";
import Input from "./Input.js";

/**
 * The main Engine class that manages the game loop, renderer, camera, and window.
 */
export default class Engine {
    /**
     * Creates an instance of the Engine.
     * @param {string} canvasId - The ID of the HTML canvas element.
     * @param {Object} game - The game instance containing init, update, and draw methods.
     * @param {number} [targetWidth=1920] - The target width of the game resolution.
     * @param {number} [targetHeight=1080] - The target height of the game resolution.
     * @param {boolean} [maintainAspectRatio=true] - Whether to maintain the aspect ratio.
     * @param {boolean} [enablePostProcessing=false] - Whether to enable post-processing.
     * @param {{
     *   renderer?: {
     *     webglVersion?: 1|2|'webgl1'|'webgl2'|'auto',
     *     allowFallback?: boolean,
     *     contextAttributes?: WebGLContextAttributes
     *   },
     *   splashScreen?: any,
     *   input?: any
     * }=} options
     */
    constructor(canvasId, game, targetWidth = 1920, targetHeight = 1080, maintainAspectRatio = true, enablePostProcessing = false, options = {}) {
        // Initialize Renderer with aspect ratio settings, post-processing, and WebGL version selection.
        const rendererOptions = (options && typeof options === 'object') ? (options.renderer || {}) : {};
        this.renderer = new Renderer(canvasId, targetWidth, targetHeight, maintainAspectRatio, enablePostProcessing, rendererOptions);
        this.camera = new Camera();
        this.window = new Window();
        
        this.game = game;
        this.game.camera = this.camera;
        this.game.window = this.window;
        
        this.lastTime = 0;
        this.previousScene = null; // Track previous scene for audio management
        
        // Performance monitoring
        this.fps = 0;
        this.frameCount = 0;
        this.fpsUpdateTime = 0;
        this.deltaTimeAccumulator = 0;
        this.showStats = false; // Toggle with F9

        // Splash screen
        this.splashScreen = new SplashScreen();
        const splashCfg = options && typeof options === 'object' ? (options.splashScreen || {}) : {};
        this.splashEnabled = splashCfg.enabled !== false;
        const showBrandingWhenDisabled = splashCfg.showMadeWithFluxionWhenDisabled !== false;

        if (this.splashEnabled) {
            this.splashScreen.showLoading({
                logoText: splashCfg.logoText || 'Made with Fluxion',
                logoUrl: splashCfg.logoUrl || null
            });
        } else if (showBrandingWhenDisabled) {
            this.splashScreen.showMadeWithFluxion(3000);
        }

        // Debug Key Listener (F8)
        window.addEventListener('keydown', (e) => {
            if (e.key === 'F8') {
                this.dumpScene();
            }
            if (e.key === 'F9') {
                this.showStats = !this.showStats;
                console.log(`Performance stats ${this.showStats ? 'enabled' : 'disabled'}`);
            }
        });

        // Boot sequence (async): load fonts/version, wait renderer ready, init game, wait assets, then start loop.
        this._startAsync(options).catch(error => {
            console.error("Engine initialization aborted due to critical error:", error);
        });

        // Input auto-update (so getKeyDown/getMouseButtonDown work without manual ticking)
        const inputCfg = options && typeof options === 'object' ? (options.input || {}) : {};
        this._autoUpdateInput = inputCfg.autoUpdate !== false;
        if (this._autoUpdateInput) {
            // Ensure the singleton exists.
            // Many examples do `new Input()` manually; this remains compatible.
            new Input();
        }
    } 

    async _startAsync(options = {}) {
        await Promise.all([this.loadDefaultFont(), this.loadVersionInfo()]);

        // Wait for renderer to be ready before starting
        await this.renderer.readyPromise;

        // Initialize the game (support async init)
        if (this.game.init) {
            const initResult = this.game.init(this.renderer);
            if (initResult && typeof initResult.then === 'function') {
                await initResult;
            }
        }

        // Wait for tracked assets (textures/audio) spawned during init
        if (this.renderer.waitForTrackedAssets) {
            await this.renderer.waitForTrackedAssets({ timeoutMs: 30000 });
        }

        // Hide splash once ready
        if (this.splashEnabled) {
            await this.splashScreen.hide();
        }

        requestAnimationFrame(this.loop.bind(this));
    }

    /**
     * Loads the engine version information from the version.py file.
     * @async
     * @throws {Error} If the version file is missing or corrupted.
     */
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
            
            // Close Electron window if available
            if (window.electronAPI && window.electronAPI.close) {
                window.electronAPI.close();
            }
            
            throw error; // Stop initialization
        }
    }

    /**
     * Loads the default font for the engine.
     * @async
     */
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

    /**
     * Sets the window to full screen mode.
     * @param {boolean} flag - True to enable full screen, false to disable.
     */
    setFullScreen(flag) {
        this.window.setFullScreen(flag);
    }

    /**
     * Sets the window size.
     * @param {number} width - The new width.
     * @param {number} height - The new height.
     */
    setWindowSize(width, height) {
        this.window.resize(width, height);
    }

    /**
     * Sets the window title.
     * @param {string} title - The new title.
     */
    setWindowTitle(title) {
        this.window.setTitle(title);
    }

    /**
     * Checks if GPU acceleration is enabled and available.
     * @async
     * @returns {Promise<Object>} Object containing GPU acceleration status and details.
     */
    async isGPUAccelerationEnabled() {
        const result = {
            enabled: false,
            webgl: false,
            webgl2: false,
            canvas2d: false,
            details: null
        };

        // Check WebGL support
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        const gl2 = canvas.getContext('webgl2');
        
        result.webgl = gl !== null;
        result.webgl2 = gl2 !== null;
        
        // Check Canvas 2D acceleration
        const ctx2d = canvas.getContext('2d');
        result.canvas2d = ctx2d !== null;

        // Get GPU info from Electron if available
        if (window.electronAPI && window.electronAPI.getGPUInfo) {
            try {
                const gpuInfo = await window.electronAPI.getGPUInfo();
                result.details = gpuInfo;
                
                // Check if key features are enabled
                if (gpuInfo) {
                    result.enabled = (
                        gpuInfo.webgl !== 'disabled' &&
                        gpuInfo.webgl2 !== 'disabled' &&
                        gpuInfo.canvas_oop_rasterization !== 'disabled'
                    );
                }
            } catch (error) {
                console.warn('Could not retrieve GPU info from Electron:', error);
            }
        } else {
            // Fallback for non-Electron environments (browser)
            result.enabled = result.webgl || result.webgl2;
        }

        // Get WebGL renderer info if available
        if (gl) {
            const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
            if (debugInfo) {
                result.renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
                result.vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
            }
        }

        return result;
    }

    /**
     * The main game loop.
     * @param {number} [timestamp=0] - The current timestamp.
     */
    loop(timestamp = 0) {
        const deltaTime = (timestamp - this.lastTime) / 1000;
        this.lastTime = timestamp;
        
        // Cap delta time to prevent huge jumps (e.g., when tab is inactive)
        const cappedDeltaTime = Math.min(deltaTime, 0.1);

        // Automatic scene audio management
        if (this.game.currentScene && this.game.currentScene !== this.previousScene) {
            // Stop audio from previous scene
            if (this.previousScene && this.previousScene.stopAudio) {
                this.previousScene.stopAudio();
            }
            // Optional: dispose previous scene resources (textures, etc.)
            if (this.previousScene && this.previousScene.disposeOnSceneChange && typeof this.previousScene.dispose === 'function') {
                this.previousScene.dispose();
            }
            // Play audio for new scene
            if (this.game.currentScene.playAutoplayAudio) {
                this.game.currentScene.playAutoplayAudio();
            }
            this.previousScene = this.game.currentScene;
        }
        
        // Update the game logic
        if (this.game.update) {
            this.game.update(cappedDeltaTime);
        }

        // Tick input state once per frame (edge detection).
        if (this._autoUpdateInput && Input.instance) {
            Input.instance.update();
        }
        
        // FPS calculation
        this.frameCount++;
        this.deltaTimeAccumulator += deltaTime;
        if (timestamp - this.fpsUpdateTime >= 1000) {
            this.fps = Math.round(this.frameCount * 1000 / (timestamp - this.fpsUpdateTime));
            this.frameCount = 0;
            this.fpsUpdateTime = timestamp;
            
            if (this.showStats) {
                const stats = this.renderer.getStats();
                console.log(`FPS: ${this.fps} | Draw Calls: ${stats.drawCalls} | Textures: ${stats.texturesCached}`);
            }
        }
        
        // Clear the renderer and apply camera transformations
        this.renderer.beginFrame();
        
        // Use the scene's camera if available, otherwise use the default engine camera
        let activeCamera = this.camera;
        if (this.game.currentScene && this.game.currentScene.camera) {
            activeCamera = this.game.currentScene.camera;
        }
        
        this.renderer.applyTransform(activeCamera);
        
        // Draw the game elements
        if (this.game.draw) {
            this.game.draw(this.renderer);
        }
        
        // Finish the frame (apply post-processing if enabled)
        this.renderer.endFrame();
        
        // Request the next frame
        requestAnimationFrame(this.loop.bind(this));
    }

    /**
     * Dumps the current scene data to a file or console.
     * Triggered by pressing F8.
     */
    dumpScene() {
        if (!this.game.currentScene) {
            console.warn("No active scene to dump.");
            return;
        }

        const scene = this.game.currentScene;
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `scene_dump_${timestamp}.js`;

        let content = `// Scene Dump: ${scene.name || 'Untitled'}\n`;
        content += `// Generated: ${new Date().toLocaleString()}\n\n`;
        content += `export const sceneData = {\n`;
        content += `    name: "${scene.name || 'Untitled'}",\n`;
        content += `    objects: [\n`;

        const processObject = (obj, indent = 8) => {
            const spaces = ' '.repeat(indent);
            let str = `${spaces}{\n`;
            str += `${spaces}    name: "${obj.name || 'Unnamed'}",\n`;
            str += `${spaces}    type: "${obj.constructor.name}",\n`;
            str += `${spaces}    active: ${obj.active},\n`;
            
            // Common properties
            if (obj.x !== undefined) str += `${spaces}    x: ${obj.x},\n`;
            if (obj.y !== undefined) str += `${spaces}    y: ${obj.y},\n`;
            if (obj.width !== undefined) str += `${spaces}    width: ${obj.width},\n`;
            if (obj.height !== undefined) str += `${spaces}    height: ${obj.height},\n`;
            if (obj.layer !== undefined) str += `${spaces}    layer: ${obj.layer},\n`;
            if (obj.visible !== undefined) str += `${spaces}    visible: ${obj.visible},\n`;
            
            // Specific properties
            if (obj.text !== undefined) str += `${spaces}    text: "${obj.text}",\n`;
            if (obj.fontSize !== undefined) str += `${spaces}    fontSize: ${obj.fontSize},\n`;
            
            // Children
            if (obj.children && obj.children.length > 0) {
                str += `${spaces}    children: [\n`;
                obj.children.forEach(child => {
                    str += processObject(child, indent + 4);
                });
                str += `${spaces}    ],\n`;
            }

            str += `${spaces}},\n`;
            return str;
        };

        if (scene.objects) {
            scene.objects.forEach(obj => {
                content += processObject(obj);
            });
        }

        content += `    ]\n`;
        content += `};\n`;

        if (window.electronAPI && window.electronAPI.saveDebugFile) {
            window.electronAPI.saveDebugFile(filename, content);
            console.log(`Scene dump requested: ${filename}`);
        } else {
            console.log(content);
            console.warn("File saving not available (Electron API missing). Check console output above.");
        }
    }
}
