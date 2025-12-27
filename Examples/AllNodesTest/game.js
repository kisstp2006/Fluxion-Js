import { Engine, Input, SceneLoader } from "../../Fluxion/index.js";

const input = new Input();

const game = {
    scene: null,

    async init(renderer) {
        console.log("Loading AllNodesTest scene...");
        
        // Set the window title
        if (this.window) {
            this.window.setTitle("Fluxion - All Nodes Test");
        }

        this.scene = await SceneLoader.load("./scene.xml", renderer);
        
        if (this.scene.camera) {
            // Sync engine camera
            this.camera.x = this.scene.camera.x;
            this.camera.y = this.scene.camera.y;
            this.camera.zoom = this.scene.camera.zoom;
            this.camera.rotation = this.scene.camera.rotation;
        }
        
        console.log("Scene loaded:", this.scene);
    },

    update(deltaTime) {
        if (!this.scene) return;

        // 1. Test Sprite Manipulation
        const sprite = this.scene.getObjectByName("LogoSprite");
        if (sprite) {
            // Move it up and down
            sprite.y = 360 + Math.sin(Date.now() / 1000) * 100;
        }

        // 2. Test AnimatedSprite Manipulation
        const animSprite = this.scene.getObjectByName("AnimSprite");
        if (animSprite) {
            // Move it left and right
            animSprite.x = 960 + Math.cos(Date.now() / 1000) * 100;
        }

        // 3. Test Camera Manipulation
        const cam = this.scene.getObjectByName("MainCamera");
        if (cam) {
            // Zoom in/out with Q/E
            if (input.getKey("q")) this.camera.zoom += deltaTime;
            if (input.getKey("e")) this.camera.zoom -= deltaTime;
        }

        // 4. Test Audio Manipulation
        const audio = this.scene.getObjectByName("BackgroundAudio");
        if (audio) {
            // Toggle volume with M (simple toggle check)
            if (input.getKey("m")) {
                audio.volume = audio.volume > 0 ? 0 : 0.2;
                // Debounce would be better, but this is a quick test
            }
        }

        this.scene.update(deltaTime);
    },

    draw(renderer) {
        if (this.scene) {
            this.scene.draw(renderer);
        }
    }
};

window.onload = () => {
    new Engine("gameCanvas", game, 1280, 720, true);
};