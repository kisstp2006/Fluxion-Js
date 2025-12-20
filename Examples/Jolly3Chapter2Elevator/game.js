import Engine from "../../Fluxion/Core/Engine.js"; // Import the Engine class
import Sprite from "../../Fluxion/Core/Sprite.js"; // Import the Sprite class
import Input from "../../Fluxion/Core/Input.js"; // Import the Input class
import Audio from "../../Fluxion/Core/Audio.js"; // Import the Audio class

const input = new Input(); // Create an Input instance for handling user input
const elevatorSound = new Audio(); // Create an Audio instance for the elevator sound
const chiefSound = new Audio(); // Create an Audio instance for playing  the chief's speech

// Function to generate a random number within a given range
function getRandom(min, max) {
    return Math.random() * (max - min) + min;
}

// Asynchronous function to load the elevator sound
async function loadSounds() {
    await elevatorSound.load("./assets/sounds/elevator loop.mp3"); // Load the elevator sound file
    elevatorSound.setLoop(true); // Set the elevator sound to loop
    elevatorSound.play(); // Play the elevator sound
}

// Asynchronous function to load the chief
async function loadChiefSounds() {
    await chiefSound.load("./assets/sounds/chief v2 final.mp3"); // Load the chief sound file
    chiefSound.setLoop(false); // Ensure the chief sound does not loop
    chiefSound.play(); // Play the chief sound
}

// Function to resume the AudioContext after user interaction (for autoplay policies)
function resumeAudioContext() {
    if (Audio.audioContext && Audio.audioContext.state === 'suspended') {
        Audio.audioContext.resume(); // Resume the AudioContext if it's suspended
    }
}

// Define paths to various image assets
const pipesBg = "./assets/elevator/pipes1.png";
const floor1 = "./assets/elevator/floor1.png";
const floor2 = "./assets/elevator/floor2.png";
const floor3 = "./assets/elevator/floor3.png";
const elevator = ["./assets/elevator/0.png", "./assets/elevator/0.png"];
const elevatorDoor = ["./assets/elevator/Door_0.png", "./assets/elevator/Door_1.png"];
const monitor = ["./assets/elevator/monitor/Active 6_0-0_0.png"];

// Load the Fluxion logo asset
const FluxionLogo = ["../../Fluxion/Icon/Fluxion_bar.png"];

// Variable to track elevator progress
var elevatorprogress = 0.0;

const game = {
    spriteList: [], // Array to store sprites
    camera: { x: 2 * (16/9), y: 0, zoom: 1 }, // Camera properties (position and zoom) - adjusted for aspect ratio
    shakeIntensity: 0.001, // Intensity of camera shake effect
    originalCameraPosition: { x: 0, y: 0 }, // Store the original camera position

    init(renderer) {
        // Initialize the game
        const aspectRatio = 16 / 9;
        const FluxionL = new Sprite(renderer, FluxionLogo, -0.9 * aspectRatio, -0.8, 0.5 * aspectRatio, 0.3); // Create and position the Fluxion logo

        this.camera.zoom = 1.10; // Set initial camera zoom
        this.spriteList.push(new Sprite(renderer, floor1, -0.5 * aspectRatio, -3, 1.3 * aspectRatio, 1.5)); // Create and add floor1 sprite
        this.spriteList.push(new Sprite(renderer, floor2, -0.5 * aspectRatio, -6, 1.3 * aspectRatio, 1.5)); // Create and add floor2 sprite
        this.spriteList.push(new Sprite(renderer, floor3, -0.5 * aspectRatio, -9, 1.3 * aspectRatio, 1.5)); // Create and add floor3 sprite
        this.spriteList.push(new Sprite(renderer, pipesBg, -1 * aspectRatio, -2.6, 2.5 * aspectRatio, 2)); // Create and add pipes background sprite
        this.spriteList.push(new Sprite(renderer, elevatorDoor[0], -0.2 * aspectRatio, -0.95, 0.91 * aspectRatio, 1.9)); // Create and add elevator door sprite
        this.spriteList.push(new Sprite(renderer, elevator[0], -1 * aspectRatio, -1, 2.5 * aspectRatio, 2)); // Create and add elevator sprite
        this.spriteList.push(new Sprite(renderer, monitor[0], -0.54 * aspectRatio, 0.22, 0.5 * aspectRatio, 0.75)); // Create and add monitor sprite
        this.spriteList.push(FluxionL); // Add the Fluxion logo sprite

        // Store original camera position
        this.originalCameraPosition.x = this.camera.x;
        this.originalCameraPosition.y = this.camera.y;

        this.spriteList[7].visible = true; // Make the Fluxion logo visible
    },

    update(deltaTime) {
        // Update the game logic
        // Update camera position based on mouse input
        const aspectRatio = 16 / 9;
        if (this.camera.x > 0) {
            if (input.getMousePosition().x < 300) {
                this.camera.x -= 1.00 * aspectRatio * deltaTime; // Move camera left
                this.spriteList[7].x -= 1.00 * aspectRatio * deltaTime; //Move logo left.
            }
        }
        if (this.camera.x < 0.5 * aspectRatio) {
            if (input.getMousePosition().x > 900) {
                this.camera.x += 1.00 * aspectRatio * deltaTime; // Move camera right
                this.spriteList[7].x += 1.00 * aspectRatio * deltaTime; //Move logo right.
            }
        }

        // Camera zoom controls
        if (input.getKey("q")) this.camera.zoom *= 1.01; // Zoom in
        if (input.getKey("e")) this.camera.zoom /= 1.01; // Zoom out

        // Store the updated camera position
        this.originalCameraPosition.x = this.camera.x;
        this.originalCameraPosition.y = this.camera.y;

        // Elevator movement and camera shake
        if (elevatorprogress < 54) {
            this.spriteList[0].y += 0.15 * deltaTime; // Move floor1 up
            this.spriteList[1].y += 0.15 * deltaTime; // Move floor2 up
            this.spriteList[2].y += 0.15 * deltaTime; // Move floor3 up
            this.spriteList[3].y += 0.15 * deltaTime; // Move pipes background up
            // Add shaking effect to the camera only while the elevator is on
            this.camera.x += getRandom(-this.shakeIntensity, this.shakeIntensity);
            this.camera.y += getRandom(-this.shakeIntensity, this.shakeIntensity);
            elevatorprogress += 1 * deltaTime; // Increment elevator progress
            console.log(elevatorprogress); // Log elevator progress
        }
    },

    draw(renderer) {
        // Draw the game elements
        renderer.clear(); // Clear the renderer
        this.spriteList.forEach(sprite => sprite.draw()); // Draw each sprite in the spriteList
    }
};

// Start the game (with sound loading beforehand)
window.onload = async () => {
    // Resume audio context when the user clicks or interacts
    window.addEventListener("click", resumeAudioContext, { once: true });

    // Load and play sounds
    await loadSounds(); // Load and play the elevator sound
    await loadChiefSounds(); // Load and play the chief sound

    // Start the game after sounds are loaded and AudioContext is resumed
    new Engine("gameCanvas", game, 1920, 1080, true); // Create Engine with aspect ratio preservation
};