// @ts-check

import { Engine, SceneLoader } from "../../packages/engine/Fluxion/index.js";

const SCENE_URL = new URL('./scene.xml', import.meta.url).toString();

const game = {
    currentScene: null,

    async init(renderer) {
        this.currentScene = await SceneLoader.load(SCENE_URL, renderer);
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

new Engine("gameCanvas", game, 1920, 1080, true, true, {
    renderer: {
        webglVersion: 2,
        allowFallback: false,
        renderTargets: {
            msaaSamples: 4,
        },
    }
});
