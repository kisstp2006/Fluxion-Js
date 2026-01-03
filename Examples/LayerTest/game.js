// @ts-check

import { Engine, SceneLoader } from "../../Fluxion/index.js";

const SCENE_URL = new URL('./scene.xml', import.meta.url).toString();

const game = {
    currentScene: null,
    _bg: null,
    _mid: null,
    _fg: null,

    async init(renderer) {
        this.currentScene = await SceneLoader.load(SCENE_URL, renderer);
        
        // Color the sprites to make them distinct
        this._bg = this.currentScene.getObjectByName("Background");
        if (this._bg) this._bg.setColor(100, 100, 100, 255); // Darker

        this._mid = this.currentScene.getObjectByName("Middle");
        if (this._mid) this._mid.setColor(255, 0, 0, 255); // Red tint

        this._fg = this.currentScene.getObjectByName("Foreground");
        if (this._fg) this._fg.setColor(0, 255, 0, 255); // Green tint
    },

    update(dt) {
        if (this.currentScene) {
            this.currentScene.update(dt);
            
            // Animate the middle layer to show it passing behind/in-front if we changed layers dynamically
            // But here we just show static layering.
            
            // Let's move the foreground object to prove it stays on top
            if (this._fg) this._fg.x = 250 + Math.sin(Date.now() / 1000) * 100;
        }
    },

    draw(renderer) {
        if (this.currentScene) {
            this.currentScene.draw(renderer);
        }
    }
};

new Engine("gameCanvas", game, 1280, 720, true, true, {
    renderer: {
        webglVersion: 2,
        allowFallback: true,
        renderTargets: {
            msaaSamples: 4,
        },
    },
});