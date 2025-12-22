import Engine from "../../Fluxion/Core/Engine.js";
import SceneLoader from "../../Fluxion/Core/SceneLoader.js";

const game = {
    currentScene: null,

    async init(renderer) {
        this.currentScene = await SceneLoader.load("scene.xml", renderer);
        
        // Color the sprites to make them distinct
        const bg = this.currentScene.getObjectByName("Background");
        if (bg) bg.setColor(100, 100, 100, 255); // Darker

        const mid = this.currentScene.getObjectByName("Middle");
        if (mid) mid.setColor(255, 0, 0, 255); // Red tint

        const fg = this.currentScene.getObjectByName("Foreground");
        if (fg) fg.setColor(0, 255, 0, 255); // Green tint
    },

    update(dt) {
        if (this.currentScene) {
            this.currentScene.update(dt);
            
            // Animate the middle layer to show it passing behind/in-front if we changed layers dynamically
            // But here we just show static layering.
            
            // Let's move the foreground object to prove it stays on top
            const fg = this.currentScene.getObjectByName("Foreground");
            if (fg) {
                fg.x = 250 + Math.sin(Date.now() / 1000) * 100;
            }
        }
    },

    draw(renderer) {
        if (this.currentScene) {
            this.currentScene.draw(renderer);
        }
    }
};

new Engine("gameCanvas", game, 1280, 720);