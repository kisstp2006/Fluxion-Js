import Engine from "../../Fluxion/Core/Engine.js";
import SceneLoader from "../../Fluxion/Core/SceneLoader.js";
import Input from "../../Fluxion/Core/Input.js";

const input = new Input(); // Initialize input system

const game = {
    currentScene: null,

    async init(renderer) {
        // Load the scene from XAML
        this.currentScene = await SceneLoader.load("scene.xaml", renderer);
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

window.addEventListener("load", () => {
    new Engine("gameCanvas", game, 1280, 720, true);
});
