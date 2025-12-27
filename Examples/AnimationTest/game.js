import { Engine, SceneLoader } from "../../Fluxion/index.js";

const game = {
    currentScene: null,
    animState: 0, // 0: Idle, 1: Walk, 2: Run

    async init(renderer) {
        this.currentScene = await SceneLoader.load("scene.xml", renderer);
        
        const clickArea = this.currentScene.getObjectByName("ScreenClick");
        const hero = this.currentScene.getObjectByName("Hero");
        
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
                        // After attack finishes, go back to idle
                        hero.onAnimationComplete = (name) => {
                            if (name === "Attack") {
                                this.animState = 0;
                                hero.play("Idle");
                            }
                        };
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

new Engine("gameCanvas", game);
