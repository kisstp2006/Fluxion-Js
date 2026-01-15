// @ts-check

import { Engine, Input, SceneLoader } from "../../packages/engine/Fluxion/index.js";

const SCENE_URL = new URL('./scene.xml', import.meta.url).toString();

const input = new Input();

const game = {
    scene: null,
    _logoSprite: null,
    _animSprite: null,
    _backgroundAudio: null,

    async init(renderer) {
        console.log("Loading AllNodesTest scene...");
        
        // Set the window title
        if (this.window) {
            this.window.setTitle("Fluxion - All Nodes Test");
        }

        this.scene = await SceneLoader.load(SCENE_URL, renderer);

        this._logoSprite = this.scene.getObjectByName("LogoSprite");
        this._animSprite = this.scene.getObjectByName("AnimSprite");
        this._backgroundAudio = this.scene.getObjectByName("BackgroundAudio");
        
        if (this.scene.camera) {
            // Sync engine camera
            this.camera.x = this.scene.camera.x;
            this.camera.y = this.scene.camera.y;
            this.camera.zoom = this.scene.camera.zoom;
            this.camera.rotation = this.scene.camera.rotation;
        }
        
        console.log("Scene loaded:", this.scene);
    },

    update(deltaTime) {
        if (!this.scene) return;

        // 1. Test Sprite Manipulation
        if (this._logoSprite) {
            // Move it up and down
            this._logoSprite.y = 360 + Math.sin(Date.now() / 1000) * 100;
        }

        // 2. Test AnimatedSprite Manipulation
        if (this._animSprite) {
            // Move it left and right
            this._animSprite.x = 960 + Math.cos(Date.now() / 1000) * 100;
        }

        // 3. Test Camera Manipulation
        // Zoom in/out with Q/E
        if (input.getKey("q")) this.camera.zoom += deltaTime;
        if (input.getKey("e")) this.camera.zoom -= deltaTime;

        // 4. Test Audio Manipulation
        // Toggle volume with M (use getKeyDown to avoid toggling every frame).
        if (this._backgroundAudio && input.getKeyDown("m")) {
            this._backgroundAudio.volume = this._backgroundAudio.volume > 0 ? 0 : 0.2;
        }

        this.scene.update(deltaTime);
    },

    draw(renderer) {
        if (this.scene) {
            this.scene.draw(renderer);
        }
    }
};

window.onload = () => {
    new Engine("gameCanvas", game, 1280, 720, true, true, {
        renderer: {
            webglVersion: 2,
            allowFallback: true,
            renderTargets: {
                msaaSamples: 4,
            },
        },
    });
};