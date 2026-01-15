// @ts-check

import { Engine, SceneLoader, Input } from "../../packages/engine/Fluxion/index.js";

const SCENE_URL = new URL('./scene2.xml', import.meta.url).toString();

/** @typedef {import("../../packages/engine/Fluxion/Core/Renderer.js").default} Renderer */
/** @typedef {import("../../packages/engine/Fluxion/Core/Scene.js").default} Scene */
/** @typedef {import("../../packages/engine/Fluxion/Core/ClickableArea.js").default} ClickableArea */
/** @typedef {import("../../packages/engine/Fluxion/Core/Text.js").default} TextNode */
/** @typedef {import("../../packages/engine/Fluxion/Core/Sprite.js").default} Sprite */

const input = new Input();

/**
 * @type {{
 *   currentScene: Scene | null,
 *   clickCount: number,
 *   init(renderer: Renderer): Promise<void>,
 *   update(dt: number): void,
 *   draw(renderer: Renderer): void,
 * }}
 */
const game = {
    /** @type {Scene | null} */
    currentScene: null,
    clickCount: 0,

    /** @param {Renderer} renderer */
    async init(renderer) {
        const scene = await SceneLoader.load(SCENE_URL, renderer);
        this.currentScene = scene;
        console.log("Scene loaded:", scene);

        // Apply scene camera resolution if defined
        const cam = scene.camera;
        if (cam && cam.width > 0 && cam.height > 0) {
            console.log(`Setting resolution from scene: ${cam.width}x${cam.height}`);
            renderer.targetWidth = cam.width;
            renderer.targetHeight = cam.height;
            renderer.targetAspectRatio = cam.width / cam.height;
            renderer.resizeCanvas(); // Force resize update
        }

        /** @type {ClickableArea | null} */
        const btnHitbox = /** @type {any} */ (scene.getObjectByName("ButtonHitbox"));
        /** @type {TextNode | null} */
        const counterText = /** @type {any} */ (scene.getObjectByName("Counter"));
        /** @type {Sprite | null} */
        const buttonSprite = /** @type {any} */ (scene.getObjectByName("Button"));

        if (btnHitbox) {
            btnHitbox.onEnter = () => {
                document.body.style.cursor = "pointer";
                if (buttonSprite) buttonSprite.setColor(200, 200, 255);
            };
            btnHitbox.onExit = () => {
                document.body.style.cursor = "default";
                if (buttonSprite) buttonSprite.setColor(255, 255, 255);
            };
            btnHitbox.onClick = () => {
                this.clickCount++;
                if (counterText) {
                    counterText.text = "Clicks: " + this.clickCount;
                    // Random color
                    const r = Math.floor(Math.random() * 255);
                    const g = Math.floor(Math.random() * 255);
                    const b = Math.floor(Math.random() * 255);
                    counterText.textColor = `rgb(${r},${g},${b})`;
                    
                }
            };
        }
    },

    /** @param {number} dt */
    update(dt) {
        if (this.currentScene) {
            this.currentScene.update(dt);
        }
        // Input is updated by Engine each frame.
    },

    /** @param {Renderer} renderer */
    draw(renderer) {
        if (this.currentScene) {
            this.currentScene.draw(renderer);
        }
    }
};

// Use a logical resolution that matches the Electron window defaults (main.js).
// With the engine's pixel coordinate system, (0,0) is top-left and (1280,720) is bottom-right.
new Engine("gameCanvas", game, 1280, 720, true, true, {
    renderer: {
        webglVersion: 2,
        allowFallback: true,
        renderTargets: {
            msaaSamples: 4,
        },
    }
});
