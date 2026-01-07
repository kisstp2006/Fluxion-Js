// @ts-check

import { Engine, SceneLoader } from "../../Fluxion/index.js";

const SCENE_URL = new URL('./scene.xml', import.meta.url).toString();

const game = {
    currentScene: null,
    animState: 0, // 0: Idle, 1: Walk, 2: Run, 3: Attack

    async init(renderer) {
        this.currentScene = await SceneLoader.load(SCENE_URL, renderer);
        
        const clickArea = this.currentScene.getObjectByName("ScreenClick");
        const hero = this.currentScene.getObjectByName("Hero");

        if (hero) {
            // If attack completes, return to idle.
            hero.onAnimationComplete = (name) => {
                if (name === "Attack") {
                    this.animState = 0;
                    hero.play?.("Idle");
                }
            };
        }
        
        if (clickArea && hero) {
            clickArea.onClick = () => {
                this.animState = (this.animState + 1) % 4;
                
                switch(this.animState) {
                    case 0:
                        hero.play("Idle");
                        break;
                    case 1:
                        hero.play("Walk");
                        break;
                    case 2:
                        hero.play("Run");
                        break;
                    case 3:
                        hero.play("Attack");
                        break;
                }
                console.log("Switched animation to state:", this.animState);
            };
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

new Engine("gameCanvas", game, 1920, 1080, true, true, {
    renderer: {
        webglVersion: 2,
        allowFallback: true,
        renderTargets: {
            msaaSamples: 4,
        },
    },
});
