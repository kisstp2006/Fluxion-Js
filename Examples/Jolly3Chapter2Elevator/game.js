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
        // Converted to 1920x1080 pixel coordinates
        // Scale ~ 540 pixels per unit
        
        const FluxionL = new Sprite(renderer, FluxionLogo, 96, 972, 480, 162); 

        this.camera.zoom = 1.10; 
        // Floors (Y was -3, -6, -9 -> 2160, 3780, 5400)
        this.spriteList.push(new Sprite(renderer, floor1, 480, 2160, 1242, 810)); 
        this.spriteList.push(new Sprite(renderer, floor2, 480, 3780, 1242, 810)); 
        this.spriteList.push(new Sprite(renderer, floor3, 480, 5400, 1242, 810)); 
        
        // Pipes
        this.spriteList.push(new Sprite(renderer, pipesBg, 0, 1944, 2400, 1080)); 
        
        // Elevator Door
        this.spriteList.push(new Sprite(renderer, elevatorDoor[0], 770, 1053, 870, 1026)); 
        
        // Elevator
        this.spriteList.push(new Sprite(renderer, elevator[0], 0, 1080, 2400, 1080)); 
        
        // Monitor
        this.spriteList.push(new Sprite(renderer, monitor[0], 441, 421, 475, 405)); 
        
        this.spriteList.push(FluxionL); 

        // Camera start position (was 2 * 1.77 = 3.55 -> ~2880)
        this.camera.x = 2880;
        this.camera.y = 540;

        // Store original camera position
        this.originalCameraPosition.x = this.camera.x;
        this.originalCameraPosition.y = this.camera.y;

        this.spriteList[7].visible = true; // Make the Fluxion logo visible
    },

    update(deltaTime) {
        // Update the game logic
        // Update camera position based on mouse input
        const speed = 1000; // Pixels per second
        
        if (this.camera.x > 960) { // Was > 0
            if (input.getMousePosition().x < 300) {
                this.camera.x -= speed * deltaTime; 
                this.spriteList[7].x -= speed * deltaTime; 
            }
        }
        // Limit right movement (was < 0.5 * AR = 0.88 -> ~1440)
        if (this.camera.x < 1440) {
            if (input.getMousePosition().x > 900) {
                this.camera.x += speed * deltaTime; 
                this.spriteList[7].x += speed * deltaTime; 
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