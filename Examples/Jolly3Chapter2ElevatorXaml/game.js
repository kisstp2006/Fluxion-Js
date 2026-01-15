import { Engine, Input, SceneLoader } from "../../packages/engine/Fluxion/index.js";
import { Audio } from "../../packages/engine/Fluxion/extras.js";

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
    shakeIntensity: 1.0, // Increased for pixel coords
    aspectRatio: 16 / 9,
    scrollLeftActive: false,
    scrollRightActive: false,
    scrollSpeed: 1000.0, // Pixels per second
    cameraMinX: 960,
    cameraMaxX: 0,

    async init(renderer) {
        console.log("Loading Jolly 3 Elevator Scene (XAML)...");
        
        if (this.window) {
            this.window.setTitle("Fluxion - Jolly 3 Elevator (XAML)");
        }

        this.scene = await SceneLoader.load("./scene.xml", renderer);

        // Sync engine camera with scene camera and make them the same object
        if (this.scene.camera) {
            this.camera.x = this.scene.camera.x;
            this.camera.y = this.scene.camera.y;
            this.camera.zoom = this.scene.camera.zoom;
            this.camera.rotation = this.scene.camera.rotation;
            this.camera.name = this.scene.camera.name;
        }
        this.scene.setCamera(this.camera);

        // Camera pan bounds (start position is the right-most limit)
        this.cameraMinX = 960;
        this.cameraMaxX = this.camera.x;

        // Hook up scroll hitboxes
        const leftHitbox = this.scene.getObjectByName("ScrollLeftHitbox");
        const rightHitbox = this.scene.getObjectByName("ScrollRightHitbox");

        if (leftHitbox) {
            leftHitbox.onEnter = () => { this.scrollLeftActive = true; };
            leftHitbox.onExit = () => { this.scrollLeftActive = false; };
        }
        if (rightHitbox) {
            rightHitbox.onEnter = () => { this.scrollRightActive = true; };
            rightHitbox.onExit = () => { this.scrollRightActive = false; };
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

        // Position scroll zones at the screen edges (FNAF1-style)
        const leftZone = this.scene.getObjectByName("ScrollLeftZone");
        const rightZone = this.scene.getObjectByName("ScrollRightZone");
        if (leftZone && rightZone) {
            const halfViewWidth = (1920 / this.camera.zoom) / 2;
            const halfViewHeight = (1080 / this.camera.zoom) / 2;

            const viewWidth = halfViewWidth * 2;
            const viewHeight = halfViewHeight * 2;
            const zoneWidth = viewWidth * 0.12;

            const viewLeft = this.camera.x - halfViewWidth;
            const viewTop = this.camera.y - halfViewHeight;

            leftZone.x = viewLeft;
            leftZone.y = viewTop;
            leftZone.width = zoneWidth;
            leftZone.height = viewHeight;

            rightZone.x = viewLeft + viewWidth - zoneWidth;
            rightZone.y = viewTop;
            rightZone.width = zoneWidth;
            rightZone.height = viewHeight;
        }

        // Camera Movement Logic (driven by ClickableArea hover)
        let dx = 0;
        if (this.scrollLeftActive) dx -= this.scrollSpeed * this.aspectRatio * deltaTime;
        if (this.scrollRightActive) dx += this.scrollSpeed * this.aspectRatio * deltaTime;

        if (dx !== 0) {
            const nextX = Math.min(this.cameraMaxX, Math.max(this.cameraMinX, this.camera.x + dx));
            const appliedDx = nextX - this.camera.x;
            this.camera.x = nextX;
            if (logo) logo.x += appliedDx; // Keep logo fixed relative to camera (UI effect)
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
    
    new Engine("gameCanvas", game, 1920, 1080, true, true, {
        renderer: {
            webglVersion: 2,
            allowFallback: true,
            renderTargets: {
                msaaSamples: 4,
            },
        },
    });
};