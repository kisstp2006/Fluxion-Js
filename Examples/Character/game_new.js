// ============================================================================
// NEW IMPROVED VERSION - Single line import!
// ============================================================================
import { Engine, Input, SceneLoader } from "../../packages/engine/Fluxion/index.js";

const input = new Input();

const game = {
    scene: null,

    async init(renderer) {
        // Initialize the game
        this.scene = await SceneLoader.load("./scene.xml", renderer);
        console.log("Scene loaded:", this.scene);
        
        // Optional: Sync engine camera with scene camera if it exists
        if (this.scene.camera) {
            const sc = this.scene.camera;
            this.camera.x = sc.x;
            this.camera.y = sc.y;
            this.camera.zoom = sc.zoom;
            this.camera.rotation = sc.rotation;
        }
        
        console.log("Game started");
    },

    update(deltaTime) {
        if (!this.scene) return;

        const player = this.scene.getObjectByName("Player");

        if (player) {
            const speed = 500;
            // Move the sprite based on keyboard input
            if (input.getKey("w")) {
                player.y -= speed * deltaTime;
            }
            if (input.getKey("a")) {
                player.x -= speed * deltaTime;
            }
            if (input.getKey("s")) {
                player.y += speed * deltaTime;
            }
            if (input.getKey("d")) {
                player.x += speed * deltaTime;
            }
        }

        // Camera zoom control
        if (this.camera.zoom > 1) {
            this.camera.zoom -= 10 * deltaTime;
            console.log("Zooming out");
        }

        if (input.getMouseButton(0)) {
            this.camera.zoom = 1.5;
            console.log("Zoomed");
        }
        
        this.scene.update(deltaTime);
    },

    draw(renderer) {
        // Draw the game elements
        if (this.scene) {
            this.scene.draw(renderer);
        }
    }
};

window.onload = async () => {
    // Start the game with aspect ratio preservation (1920x1080, 16:9)
    new Engine("gameCanvas", game, 1920, 1080, true, true, {
        renderer: {
            webglVersion: 2,
            allowFallback: true,
            renderTargets: {
                msaaSamples: 4,
            },
        },
    });
};
