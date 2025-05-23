import Engine from "../../Fluxion/Core/Engine.js"; // Import the Engine class from the specified path
import Sprite from "../../Fluxion/Core/Sprite.js"; // Import the Sprite class from the specified path
import Input from "../../Fluxion/Core/Input.js"; // Import the Input class from the specified path

const input = new Input(); // Create a new Input instance to handle user input
const FluxionLogo = ["../../Fluxion/Icon/Fluxion_icon.png"]; // Define an array containing the path to the Fluxion logo image

const game = {
    spriteList: [], // Initialize an empty array to store sprites

    init(renderer) {
        // Initialize the game
        this.spriteList.push(new Sprite(renderer, FluxionLogo, -0.3, -0.5, 1, 1)); // Create a new Sprite instance and add it to the spriteList
        // Parameters for Sprite: renderer, image paths, x, y, width, height
        console.log("Game started"); // Log a message to the console indicating the game has started
    },

    update(deltaTime) {
        // Update the game logic
        console.log("Game running: " + deltaTime); // Log the deltaTime to the console for debugging purposes

        // Move the sprite based on keyboard input
        if (input.getKey("w")) {
            // If the 'w' key is pressed, move the sprite up
            this.spriteList[0].y += 1 * deltaTime; // Adjust the sprite's y-coordinate based on deltaTime
        }
        if (input.getKey("a")) {
            // If the 'a' key is pressed, move the sprite left
            this.spriteList[0].x -= 1 * deltaTime; // Adjust the sprite's x-coordinate based on deltaTime
        }
        if (input.getKey("s")) {
            // If the 's' key is pressed, move the sprite down
            this.spriteList[0].y -= 1 * deltaTime; // Adjust the sprite's y-coordinate based on deltaTime
        }
        if (input.getKey("d")) {
            // If the 'd' key is pressed, move the sprite right
            this.spriteList[0].x += 1 * deltaTime; // Adjust the sprite's x-coordinate based on deltaTime
        }

        // Camera zoom control
        if (this.camera.zoom > 1) {
            // If the camera zoom is greater than 1, zoom out
            this.camera.zoom -= 10 * deltaTime; // Decrease the camera zoom based on deltaTime
            console.log("Zooming out"); // Log a message indicating the camera is zooming out
        }

        if (input.getMouseButton(0)) {
            // If the left mouse button is pressed, zoom in
            this.camera.zoom = 1.5; // Set the camera zoom to 1.5
            console.log("Zoomed"); // Log a message indicating the camera has zoomed in
        }
    },

    draw(renderer) {
        // Draw the game elements
        renderer.clear(); // Clear the renderer's canvas
        this.spriteList.forEach(sprite => sprite.draw()); // Iterate over the spriteList and draw each sprite
    }
};

window.onload = async () => {
    // Event listener for when the window finishes loading
    // Start the game
    new Engine("gameCanvas", game); // Create a new Engine instance with the specified canvas ID and game object
};