import Engine from "../../Fluxion/Core/Engine.js";
import Input from "../../Fluxion/Core/Input.js";
import SceneLoader from "../../Fluxion/Core/SceneLoader.js";
import Audio from "../../Fluxion/Core/Audio.js";

const input = new Input();

// Helper for random numbers
function getRandom(min, max) {
    return Math.random() * (max - min) + min;
}

// Resume audio context helper
function resumeAudioContext() {
    if (Audio.audioContext && Audio.audioContext.state === 'suspended') {
        Audio.audioContext.resume();
    }
}

const game = {
    scene: null,
    elevatorProgress: 0.0,
    shakeIntensity: 0.001,
    aspectRatio: 16 / 9,

    async init(renderer) {
        console.log("Loading Jolly 3 Elevator Scene (XAML)...");
        
        if (this.window) {
            this.window.setTitle("Fluxion - Jolly 3 Elevator (XAML)");
        }

        this.scene = await SceneLoader.load("./scene.xml", renderer);
        
        // Sync engine camera with scene camera
        if (this.scene.camera) {
            this.camera.x = this.scene.camera.x;
            this.camera.y = this.scene.camera.y;
            this.camera.zoom = this.scene.camera.zoom;
            this.camera.rotation = this.scene.camera.rotation;
        }

        console.log("Scene loaded.");
    },

    update(deltaTime) {
        if (!this.scene) return;

        const logo = this.scene.getObjectByName("FluxionLogo");
        const floor1 = this.scene.getObjectByName("Floor1");
        const floor2 = this.scene.getObjectByName("Floor2");
        const floor3 = this.scene.getObjectByName("Floor3");
        const pipes = this.scene.getObjectByName("PipesBg");

        // Camera Movement Logic
        // Move camera based on mouse position at edges of screen
        if (this.camera.x > 0) {
            if (input.getMousePosition().x < 300) {
                const moveAmount = 1.00 * this.aspectRatio * deltaTime;
                this.camera.x -= moveAmount;
                if (logo) logo.x -= moveAmount; // Keep logo fixed relative to camera (UI effect)
            }
        }
        
        if (this.camera.x < 0.5 * this.aspectRatio) {
            if (input.getMousePosition().x > 900) {
                const moveAmount = 1.00 * this.aspectRatio * deltaTime;
                this.camera.x += moveAmount;
                if (logo) logo.x += moveAmount;
            }
        }

        // Zoom controls
        if (input.getKey("q")) this.camera.zoom *= 1.01;
        if (input.getKey("e")) this.camera.zoom /= 1.01;

        // Elevator Sequence
        if (this.elevatorProgress < 54) {
            const moveUp = 0.15 * deltaTime;
            
            if (floor1) floor1.y += moveUp;
            if (floor2) floor2.y += moveUp;
            if (floor3) floor3.y += moveUp;
            if (pipes) pipes.y += moveUp;

            // Camera Shake
            this.camera.x += getRandom(-this.shakeIntensity, this.shakeIntensity);
            this.camera.y += getRandom(-this.shakeIntensity, this.shakeIntensity);

            this.elevatorProgress += 1 * deltaTime;
            // console.log(this.elevatorProgress);
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
    // Resume audio on first interaction
    window.addEventListener("click", resumeAudioContext, { once: true });
    
    new Engine("gameCanvas", game, 1920, 1080, true);
};