import { Engine, SceneLoader, Input } from "../../Fluxion/index.js";

const game = {
    currentScene: null,
    timer: 0,

    async init(renderer) {
        this.currentScene = await SceneLoader.load("scene.xml", renderer);
        
        // Setup the click handler for the third sprite
        const clickArea = this.currentScene.getObjectByName("ScreenClick");
        const toggleSprite = this.currentScene.getObjectByName("ClickToggleSprite");
        
        if (clickArea && toggleSprite) {
            clickArea.onClick = () => {
                toggleSprite.active = !toggleSprite.active;
                console.log("Toggled sprite active state to:", toggleSprite.active);
            };
        }
    },

    update(dt) {
        if (this.currentScene) {
            this.currentScene.update(dt);
            
            // 1. Rotate the "Always Active" sprite
            const alwaysActive = this.currentScene.getObjectByName("AlwaysActive");
            if (alwaysActive) {
                // We don't have a rotation property on Sprite in the base code I saw earlier, 
                // but let's assume we might want to animate it or just move it.
                // If Sprite doesn't have rotation, we can scale it to pulse.
                alwaysActive.width = 150 + Math.sin(Date.now() / 500) * 20;
                alwaysActive.height = 150 + Math.sin(Date.now() / 500) * 20;
            }

            // 2. Handle the "Blinking Sprite"
            const blinking = this.currentScene.getObjectByName("BlinkingSprite");
            if (blinking) {
                // Accumulate time
                this.timer += dt;
                if (this.timer > 2) { // Every 2 seconds
                    blinking.active = !blinking.active;
                    this.timer = 0;
                }

                // Try to animate it ONLY if it's active. 
                // Note: Since the engine checks `active` before calling update(), 
                // code inside the sprite's update method wouldn't run.
                // But here we are in the Game's update loop manipulating the sprite externally.
                // Even if we change properties here, it won't draw if active is false.
                
                // Let's make it move up and down. When it reappears, it should have "jumped" 
                // if we keep updating it, or stayed still if we stop updating it.
                // Since we are updating x/y here manually, the position WILL change even if invisible,
                // unless we check active here too.
                
                if (blinking.active) {
                    blinking.y = 300 + Math.sin(Date.now() / 200) * 50;
                }
            }
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
