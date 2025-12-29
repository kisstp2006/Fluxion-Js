import { Engine, SceneLoader, Input } from "../../Fluxion/index.js";

const input = new Input();

const game = {
    currentScene: null,
    menuScene: null,
    gameScene: null,
    renderer: null,
    _loadingGameScene: false,
    _loadingMenuScene: false,
    menuSceneUrl: "./menu.xml",
    gameSceneUrl: "./game.xml",

    async init(renderer) {
        this.renderer = renderer;

        // Set a practical cache budget so huge projects don't grow forever.
        // Eviction only removes textures that are not referenced (refCount==0).
        renderer.setTextureCacheLimits({
            maxBytes: 256 * 1024 * 1024,
            maxTextures: 4096
        });
        
        console.log("Loading scenes...");
        // Load Menu scene up-front; both scenes are disposable and will be reloaded on demand.
        this.menuScene = await SceneLoader.load(this.menuSceneUrl, renderer);
        this.menuScene.disposeOnSceneChange = true;
        
        // Start with Menu
        this.switchScene(this.menuScene);
        
        console.log("MultiScene Example Started.");
        console.log("Controls:");
        console.log("  Menu: Click the Icon or Press ENTER to Start Game");
        console.log("  Game: WASD to move, ESC to return to Menu");
    },

    async ensureMenuSceneLoaded() {
        if (this.menuScene) return true;
        if (this._loadingMenuScene) return false;
        this._loadingMenuScene = true;
        try {
            this.menuScene = await SceneLoader.load(this.menuSceneUrl, this.renderer);
            this.menuScene.disposeOnSceneChange = true;
            return true;
        } finally {
            this._loadingMenuScene = false;
        }
    },

    async ensureGameSceneLoaded() {
        if (this.gameScene) return true;
        if (this._loadingGameScene) return false;
        this._loadingGameScene = true;
        try {
            this.gameScene = await SceneLoader.load(this.gameSceneUrl, this.renderer);
            // Dispose game resources when switching away from it.
            this.gameScene.disposeOnSceneChange = true;
            return true;
        } finally {
            this._loadingGameScene = false;
        }
    },

    async startGame() {
        const ready = await this.ensureGameSceneLoaded();
        if (ready && this.gameScene) {
            this.switchScene(this.gameScene);

            // We just left the menu; it is disposable. Clear reference so it will reload next time.
            this.menuScene = null;
        }
    },

    async startMenu() {
        const ready = await this.ensureMenuSceneLoaded();
        if (ready && this.menuScene) {
            this.switchScene(this.menuScene);

            // We just left the game; it is disposable. Clear reference so it will reload next time.
            this.gameScene = null;
        }
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
                    this.startGame();
                    document.body.style.cursor = "default";
                };
            }
        }
        
        console.log("Switched to scene:", scene.name);
    },

    update(deltaTime) {
        if (!this.currentScene) return;

        // Scene switching logic
        if (this.currentScene.name === "MenuScene") {
            // In Menu: Press Enter to start
            if (input.getKeyDown("Enter")) {
                this.startGame();
            }
            
            // Visual effect: Rotate the start button
            const btn = this.currentScene.getObjectByName("StartButton");
            if (btn) {
                btn.rotation += 1 * deltaTime;
            }
        } else if (this.currentScene.name === "GameScene") {
            // In Game: Press Escape to go back to menu
            if (input.getKeyDown("Escape")) {
                this.startMenu();
            }
            
            // Game logic: Move player
            const player = this.currentScene.getObjectByName("Player");
            if (player) {
                const speed = 500;
                if (input.getKey("w")) player.y -= speed * deltaTime;
                if (input.getKey("s")) player.y += speed * deltaTime;
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
        // Input is updated by Engine each frame.
    },

    draw(renderer) {
        if (this.currentScene) {
            this.currentScene.draw(renderer);
        }
    }
};

// Start the engine
new Engine("gameCanvas", game, 1920, 1080, true, false, {
    renderer: {
        webglVersion: 2,
        allowFallback: true,
    }
});
