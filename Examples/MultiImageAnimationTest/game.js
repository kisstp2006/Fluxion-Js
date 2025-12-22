import Engine from "../../Fluxion/Core/Engine.js";
import SceneLoader from "../../Fluxion/Core/SceneLoader.js";

const game = {
    currentScene: null,

    async init(renderer) {
        this.currentScene = await SceneLoader.load("scene.xml", renderer);
        
        const hero = this.currentScene.getObjectByName("MultiImgHero");
        if (hero) {
            // We can manually modify the color to prove it's drawing
            hero.setColor(200, 200, 255);
        }
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
