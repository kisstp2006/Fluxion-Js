import Engine from "../../Fluxion/Core/Engine.js";
import SceneLoader from "../../Fluxion/Core/SceneLoader.js";
import Input from "../../Fluxion/Core/Input.js";

const input = new Input();

const game = {
    currentScene: null,
    clickCount: 0,

    async init(renderer) {
        this.currentScene = await SceneLoader.load("scene2.xml", renderer);
        console.log("Scene loaded:", this.currentScene);

        // Apply scene camera resolution if defined
        if (this.currentScene.camera && this.currentScene.camera.width > 0 && this.currentScene.camera.height > 0) {
            console.log(`Setting resolution from scene: ${this.currentScene.camera.width}x${this.currentScene.camera.height}`);
            renderer.targetWidth = this.currentScene.camera.width;
            renderer.targetHeight = this.currentScene.camera.height;
            renderer.targetAspectRatio = renderer.targetWidth / renderer.targetHeight;
            renderer.resizeCanvas(); // Force resize update
        }

        const btnHitbox = this.currentScene.getObjectByName("ButtonHitbox");
        const counterText = this.currentScene.getObjectByName("Counter");
        const buttonSprite = this.currentScene.getObjectByName("Button");

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

    update(dt) {
        if (this.currentScene) {
            this.currentScene.update(dt);
        }
        input.update();
    },

    draw(renderer) {
        if (this.currentScene) {
            this.currentScene.draw(renderer);
        }
    }
};

// Use a logical resolution that matches the Electron window defaults (main.js).
// With the engine's pixel coordinate system, (0,0) is top-left and (1280,720) is bottom-right.
new Engine("gameCanvas", game, 1280, 720);
