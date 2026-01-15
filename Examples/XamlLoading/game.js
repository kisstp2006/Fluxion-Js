// @ts-check

import { Engine, SceneLoader, Input } from "../../packages/engine/Fluxion/index.js";

const SCENE_URL = new URL('./scene.xaml', import.meta.url).toString();

const input = new Input(); // Initialize input system

const game = {
    currentScene: null,
    _camera: null,

    async init(renderer) {
        // Load the scene from XAML
        this.currentScene = await SceneLoader.load(SCENE_URL, renderer);
        console.log("Scene loaded:", this.currentScene);

        // Setup interaction
        const hitbox = this.currentScene.getObjectByName("MyHitbox");
        const sprite = this.currentScene.getObjectByName("ClickableSprite");

        if (hitbox && sprite) {
            console.log("Hitbox found, attaching listeners");
            
            hitbox.onEnter = () => {
                console.log("Mouse Enter");
                sprite.setColor(255, 100, 100); // Tint red
                document.body.style.cursor = "pointer";
            };

            hitbox.onExit = () => {
                console.log("Mouse Exit");
                sprite.setColor(255, 255, 255); // Reset color
                document.body.style.cursor = "default";
            };

            hitbox.onDown = () => {
                console.log("Mouse Down");
                sprite.width *= 0.9;
                sprite.height *= 0.9;
            };

            hitbox.onUp = () => {
                console.log("Mouse Up/Click");
                sprite.width /= 0.9;
                sprite.height /= 0.9;
            };
        }

        this._camera = this.currentScene.getObjectByName("MainCamera");
    },

    update(dt) {
        if (this.currentScene) {
            this.currentScene.update(dt);
            
            // Test Camera Movement
            const cam = this._camera;
            if (cam) {
                // Move camera with arrow keys
                const speed = 200 * dt;
                if (input.getKey("ArrowRight")) cam.x += speed;
                if (input.getKey("ArrowLeft")) cam.x -= speed;
                if (input.getKey("ArrowDown")) cam.y += speed;
                if (input.getKey("ArrowUp")) cam.y -= speed;
            }
        }
        // Input is updated by Engine each frame.
    },

    draw(renderer) {
        if (this.currentScene) {
            this.currentScene.draw(renderer);
        }
    }
};

window.addEventListener("load", () => {
    new Engine("gameCanvas", game, 1280, 720, true, true, {
        renderer: {
            webglVersion: 2,
            allowFallback: true,
            renderTargets: {
                msaaSamples: 4,
            },
        },
    });
});
