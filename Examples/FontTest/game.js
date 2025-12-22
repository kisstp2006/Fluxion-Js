import Engine from "../../Fluxion/Core/Engine.js";
import SceneLoader from "../../Fluxion/Core/SceneLoader.js";

const game = {
    currentScene: null,

    async init(renderer) {
        this.currentScene = await SceneLoader.load("scene.xml", renderer);
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

new Engine("gameCanvas", game);
