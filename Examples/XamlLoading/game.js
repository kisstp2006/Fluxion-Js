import Engine from "../../Fluxion/Core/Engine.js";
import SceneLoader from "../../Fluxion/Core/SceneLoader.js";

const game = {
    currentScene: null,

    async init(renderer) {
        // Load the scene from XAML
        this.currentScene = await SceneLoader.load("scene.xaml", renderer);
        console.log("Scene loaded:", this.currentScene);
    },

    update(dt) {
        if (this.currentScene) {
            this.currentScene.update(dt);
        }
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
