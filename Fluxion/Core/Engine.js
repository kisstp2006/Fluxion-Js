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

        // Debug Key Listener (F8)
        window.addEventListener('keydown', (e) => {
            if (e.key === 'F8') {
                this.dumpScene();
            }
        });

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
            
            // Close Electron window if available
            if (window.electronAPI && window.electronAPI.close) {
                window.electronAPI.close();
            }
            
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
