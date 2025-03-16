import Engine from "../../Fluxion/Core/Engine.js";
import Sprite from "../../Fluxion/Core/Sprite.js";
import Input from "../../Fluxion/Core/Input.js";
import Audio from "../../Fluxion/Core/Audio.js";

const input = new Input();
const elevatorSound = new Audio();
const chiefSound = new Audio();

function getRandom(min, max) {
    return Math.random() * (max - min) + min;
} 

// Load the sound asynchronously
async function loadSounds() {
    await elevatorSound.load("./assets/sounds/elevator loop.mp3");
    elevatorSound.setLoop(true);
    elevatorSound.play();
}

async function loadChiefSounds() {
    await chiefSound.load("./assets/sounds/chief v2 final.mp3");
    chiefSound.setLoop(false);
    chiefSound.play();
}

// Ensure AudioContext is resumed after user interaction (for autoplay policies)
function resumeAudioContext() {
    if (Audio.audioContext && Audio.audioContext.state === 'suspended') {
        Audio.audioContext.resume();
    }
}

const pipesBg="./assets/elevator/pipes1.png";
const floor1="./assets/elevator/floor1.png";
const floor2="./assets/elevator/floor2.png";
const floor3="./assets/elevator/floor3.png";
const elevator = ["./assets/elevator/0.png", "./assets/elevator/0.png"];
const elevatorDoor = ["./assets/elevator/Door_0.png", "./assets/elevator/Door_1.png"];
const monitor=["./assets/elevator/monitor/Active 6_0-0_0.png"];

//Load the Fluxion logo
const FluxionLogo=["../../Fluxion/Icon/Fluxion_bar.png"];

var elevatorprogress=0.0;

const game = {
    spriteList: [],
    camera: { x: 2, y: 0, zoom: 1 },
    shakeIntensity: 0.001,
    originalCameraPosition: { x: 0, y: 0 },

    init(renderer) {
        //Load the Fluxion logo
        const FluxionL = new Sprite(renderer, FluxionLogo, -0.9, -0.8, 0.5, 0.3);

        this.camera.zoom = 1.10;
        this.spriteList.push(new Sprite(renderer, floor1,-0.5, -3, 1.3, 1.5));
        this.spriteList.push(new Sprite(renderer, floor2,-0.5, -6, 1.3, 1.5));
        this.spriteList.push(new Sprite(renderer, floor3,-0.5, -9, 1.3, 1.5));
        this.spriteList.push(new Sprite(renderer, pipesBg,-1, -2.6, 2.5, 2));
        this.spriteList.push(new Sprite(renderer, elevatorDoor[0], -0.2, -0.95, 0.91, 1.9));
        this.spriteList.push(new Sprite(renderer, elevator[0], -1, -1, 2.5, 2));
        this.spriteList.push(new Sprite(renderer, monitor[0], -0.54, 0.22, 0.5, 0.75));
        this.spriteList.push(FluxionL);


        // Store original camera position
        this.originalCameraPosition.x = this.camera.x;
        this.originalCameraPosition.y = this.camera.y;

        this.spriteList[7].visible=true;
        
    },
    
    update(deltaTime) {
        // Update camera position based on input
        if (this.camera.x > 0) {
            if (input.getMousePosition().x < 300) {
                this.camera.x -= 1.00 * deltaTime;
                this.spriteList[7].x-= 1.00 * deltaTime;
            }
        }
        if (this.camera.x < 0.5) {
            if (input.getMousePosition().x > 900) {
                this.camera.x += 1.00 * deltaTime; 
                this.spriteList[7].x+= 1.00 * deltaTime;
            } 
        }

        //Zoom
        if (input.getKey("q")) this.camera.zoom *= 1.01;
        if (input.getKey("e")) this.camera.zoom /= 1.01;

        // Store the updated camera position
        this.originalCameraPosition.x = this.camera.x;
        this.originalCameraPosition.y = this.camera.y;

        
        if(elevatorprogress<54){
            this.spriteList[0].y+=0.15*deltaTime;
            this.spriteList[1].y+=0.15*deltaTime;
            this.spriteList[2].y+=0.15*deltaTime;
            this.spriteList[3].y+=0.15*deltaTime;
            // Add shaking effect to the camera only while the elevator is on
            this.camera.x += getRandom(-this.shakeIntensity, this.shakeIntensity);
            this.camera.y += getRandom(-this.shakeIntensity, this.shakeIntensity);
            elevatorprogress+=1*deltaTime;
            console.log(elevatorprogress);
        }

    },

    draw(renderer) {
        renderer.clear();
        this.spriteList.forEach(sprite => sprite.draw());
    }
};

// Start the game (with sound loading beforehand)
window.onload = async () => {
    // Resume audio context when the user clicks or interacts
    window.addEventListener("click", resumeAudioContext, { once: true });

    // Load and play sounds
    await loadSounds(); // Wait for the elevator sound to load
    await loadChiefSounds(); // Wait for the chief sound to load

    // Start the game after sounds are loaded and AudioContext is resumed
    new Engine("gameCanvas", game, false);
};
