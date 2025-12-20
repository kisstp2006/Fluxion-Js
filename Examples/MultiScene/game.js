import Engine from "../../Fluxion/Core/Engine.js";
import SceneLoader from "../../Fluxion/Core/SceneLoader.js";
import Input from "../../Fluxion/Core/Input.js";

const input = new Input();

const game = {
    currentScene: null,
    menuScene: null,
    gameScene: null,
    renderer: null,

    async init(renderer) {
        this.renderer = renderer;
        
        console.log("Loading scenes...");
        // Load both scenes
        this.menuScene = await SceneLoader.load("./menu.xml", renderer);
        this.gameScene = await SceneLoader.load("./game.xml", renderer);
        
        // Start with Menu
        this.switchScene(this.menuScene);
        
        console.log("MultiScene Example Started.");
        console.log("Controls:");
        console.log("  Menu: Click the Icon or Press ENTER to Start Game");
        console.log("  Game: WASD to move, ESC to return to Menu");
    },

    switchScene(scene) {
        this.currentScene = scene;
        
        // Sync engine camera with scene camera if it exists
        if (this.currentScene.camera) {
            const sc = this.currentScene.camera;
            // We update the engine's camera which is injected into this object
            if (this.camera) {
                this.camera.x = sc.x;
                this.camera.y = sc.y;
                this.camera.zoom = sc.zoom;
                this.camera.rotation = sc.rotation;
            }
        }

        // Setup Menu Interactions if we are in Menu Scene
        if (scene.name === "MenuScene") {
            const btnHitbox = scene.getObjectByName("StartButtonHitbox");
            const btnSprite = scene.getObjectByName("StartButton");
            
            if (btnHitbox && btnSprite) {
                btnHitbox.onEnter = () => {
                    document.body.style.cursor = "pointer";
                    btnSprite.setColor(200, 200, 255); // Tint
                };
                btnHitbox.onExit = () => {
                    document.body.style.cursor = "default";
                    btnSprite.setColor(255, 255, 255); // Reset
                };
                btnHitbox.onClick = () => {
                    this.switchScene(this.gameScene);
                    document.body.style.cursor = "default";
                };
            }
        }
        
        console.log("Switched to scene:", scene.name);
    },

    update(deltaTime) {
        if (!this.currentScene) return;

        // Scene switching logic
        if (this.currentScene === this.menuScene) {
            // In Menu: Press Enter to start
            if (input.getKeyDown("Enter")) {
                this.switchScene(this.gameScene);
            }
            
            // Visual effect: Rotate the start button
            const btn = this.currentScene.getObjectByName("StartButton");
            if (btn) {
                btn.rotation += 1 * deltaTime;
            }
        } else if (this.currentScene === this.gameScene) {
            // In Game: Press Escape to go back to menu
            if (input.getKeyDown("Escape")) {
                this.switchScene(this.menuScene);
            }
            
            // Game logic: Move player
            const player = this.currentScene.getObjectByName("Player");
            if (player) {
                const speed = 3;
                if (input.getKey("w")) player.y += speed * deltaTime;
                if (input.getKey("s")) player.y -= speed * deltaTime;
                if (input.getKey("a")) player.x -= speed * deltaTime;
                if (input.getKey("d")) player.x += speed * deltaTime;
            }
            
            // Simple enemy logic: Rotate enemy
            const enemy = this.currentScene.getObjectByName("Enemy");
            if (enemy) {
                enemy.rotation -= 2 * deltaTime;
            }
        }

        // Update current scene objects
        this.currentScene.update(deltaTime);

        // Update input state for next frame (required for getKeyDown/Up)
        input.update();
    },

    draw(renderer) {
        if (this.currentScene) {
            this.currentScene.draw(renderer);
        }
    }
};

// Start the engine
new Engine("gameCanvas", game);
