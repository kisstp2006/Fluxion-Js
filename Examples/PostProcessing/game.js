import Engine from "../../Fluxion/Core/Engine.js";
import Sprite from "../../Fluxion/Core/Sprite.js";
import Input from "../../Fluxion/Core/Input.js";

const input = new Input();
const FluxionLogo = ["../../Fluxion/Icon/Fluxion_icon.png"];

const game = {
    spriteList: [],
    engine: null,

    init(renderer) {
        // Initialize the game
        this.spriteList.push(new Sprite(renderer, FluxionLogo, -0.3, -0.5, 1, 1));
        console.log("Post-processing demo started");
        console.log("Press keys to toggle effects:");
        console.log("1 - Grayscale");
        console.log("2 - Blur");
        console.log("3 - CRT Effect");
        console.log("4 - Contrast");
        console.log("0 - Clear all effects");
    },

    update(deltaTime) {
        // Move the sprite based on keyboard input
        if (input.getKey("w")) {
            this.spriteList[0].y += 1 * deltaTime;
        }
        if (input.getKey("a")) {
            this.spriteList[0].x -= 1 * deltaTime;
        }
        if (input.getKey("s")) {
            this.spriteList[0].y -= 1 * deltaTime;
        }
        if (input.getKey("d")) {
            this.spriteList[0].x += 1 * deltaTime;
        }

        // Camera zoom control
        if (this.camera.zoom > 1) {
            this.camera.zoom -= 10 * deltaTime;
        }

        if (input.getMouseButton(0)) {
            this.camera.zoom = 1.5;
        }

        // Toggle post-processing effects
        if (this.engine && this.engine.renderer.postProcessing) {
            const pp = this.engine.renderer.postProcessing;
            
            if (input.getKeyDown("1")) {
                if (pp.activeEffects.includes("grayscale")) {
                    pp.disableEffect("grayscale");
                    console.log("Grayscale OFF");
                } else {
                    pp.enableEffect("grayscale");
                    console.log("Grayscale ON");
                }
            }
            
            if (input.getKeyDown("2")) {
                if (pp.activeEffects.includes("blur")) {
                    pp.disableEffect("blur");
                    console.log("Blur OFF");
                } else {
                    pp.enableEffect("blur");
                    console.log("Blur ON");
                }
            }
            
            if (input.getKeyDown("3")) {
                if (pp.activeEffects.includes("crt")) {
                    pp.disableEffect("crt");
                    console.log("CRT Effect OFF");
                } else {
                    pp.enableEffect("crt");
                    console.log("CRT Effect ON");
                }
            }
            
            if (input.getKeyDown("4")) {
                if (pp.activeEffects.includes("contrast")) {
                    pp.disableEffect("contrast");
                    console.log("Contrast OFF");
                } else {
                    pp.enableEffect("contrast");
                    console.log("Contrast ON");
                }
            }
            
            if (input.getKeyDown("0")) {
                pp.clearEffects();
                console.log("All effects cleared");
            }

            // Update time uniform for CRT effect
            if (pp.activeEffects.includes("crt")) {
                pp.setUniform("crt", "time", Date.now() / 1000);
            }
        }
    },

    draw(renderer) {
        renderer.clear();
        this.spriteList.forEach(sprite => sprite.draw());
    }
};

window.onload = async () => {
    // Start the game WITHOUT post-processing for now (last param = false)
    // Post-processing needs framebuffer rendering which requires more work
    game.engine = new Engine("gameCanvas", game, 1920, 1080, true, false);
};
