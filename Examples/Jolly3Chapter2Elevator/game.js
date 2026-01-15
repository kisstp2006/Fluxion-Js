import { Engine, Sprite, Input } from "../../packages/engine/Fluxion/index.js";
import { Audio } from "../../packages/engine/Fluxion/extras.js";

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
const FluxionLogo = "../../packages/engine/Fluxion/Icon/Fluxion_bar.png";

// Variable to track elevator progress
var elevatorprogress = 0.0;

const game = {
    spriteList: [], // Array to store sprites
    camera: { x: 2880, y: 540, zoom: 1.10, rotation: 0 }, // Camera properties (position and zoom)
    shakeIntensity: 2.0, // Intensity of camera shake effect (pixels)
    originalCameraPosition: { x: 0, y: 0 }, // Store the original camera position

    init(renderer) {
        // Initialize the game
        // Resolution: 1920x1080. Origin: Top-Left.
        // Elevator Room Size: 2400x1080.
        
        // Fluxion Logo (Top-Left of room)
        const FluxionL = new Sprite(renderer, FluxionLogo, 92, 108, 475, 162); 

        this.camera.zoom = 1.0; 
        
        // Floors (Start below screen and move up)
        // X centered relative to room (Room 2400, Floor 1242 -> Offset ~580)
        // Using calculated offset 480 from previous step
        this.spriteList.push(new Sprite(renderer, floor1, 480, 1080, 1242, 810)); 
        this.spriteList.push(new Sprite(renderer, floor2, 480, 2160, 1242, 810)); 
        this.spriteList.push(new Sprite(renderer, floor3, 480, 3240, 1242, 810)); 
        
        // Pipes (Background)
        this.spriteList.push(new Sprite(renderer, pipesBg, 0, 0, 2400, 1080)); 
        
        // Elevator Door
        this.spriteList.push(new Sprite(renderer, elevatorDoor[0], 767, 27, 870, 1026)); 
        
        // Elevator (Frame/Interior)
        this.spriteList.push(new Sprite(renderer, elevator[0], 0, 0, 2400, 1080)); 
        
        // Monitor
        this.spriteList.push(new Sprite(renderer, monitor[0], 437, 658, 475, 405)); 
        
        this.spriteList.push(FluxionL); 

        // Camera Start Position (Right side of room)
        this.camera.x = 480;
        this.camera.y = 0;

        // Store original camera position
        this.originalCameraPosition.x = this.camera.x;
        this.originalCameraPosition.y = this.camera.y;

        this.spriteList[7].visible = true; // Make the Fluxion logo visible
    },

    update(deltaTime) {
        // Update the game logic
        // Update camera position based on mouse input
        const panSpeed = 1000; // Pixels per second
        
        // Pan Left (towards 0)
        if (this.camera.x > 0) { 
            if (input.getMousePosition().x < 300) {
                this.camera.x -= panSpeed * deltaTime; 
            }
        }
        // Pan Right (towards 480)
        if (this.camera.x < 480) {
            if (input.getMousePosition().x > 1620) { // > 1920 - 300
                this.camera.x += panSpeed * deltaTime; 
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
            const moveSpeed = 200; // Pixels per second (Floors moving UP visually = Decrease Y)
            
            this.spriteList[0].y -= moveSpeed * deltaTime; // Floor 1
            this.spriteList[1].y -= moveSpeed * deltaTime; // Floor 2
            this.spriteList[2].y -= moveSpeed * deltaTime; // Floor 3
            
            // Pipes might loop or just move? Let's move them slowly for parallax?
            // Or if they are attached to the shaft, they move at same speed.
            // But we only have one pipes sprite. Let's loop it?
            this.spriteList[3].y -= moveSpeed * deltaTime; 
            if (this.spriteList[3].y < -1080) this.spriteList[3].y += 1080; // Simple loop

            // Add shaking effect to the camera only while the elevator is on
            this.camera.x += getRandom(-this.shakeIntensity, this.shakeIntensity);
            this.camera.y += getRandom(-this.shakeIntensity, this.shakeIntensity);
            
            elevatorprogress += 1 * deltaTime; 
            // console.log(elevatorprogress); 
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
    new Engine("gameCanvas", game, 1920, 1080, true, true, {
        renderer: {
            webglVersion: 2,
            allowFallback: true,
            renderTargets: {
                msaaSamples: 4,
            },
        },
    }); // Create Engine with aspect ratio preservation
};