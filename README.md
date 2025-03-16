![Fluxion_icon](https://github.com/user-attachments/assets/ec7901eb-eed6-48ed-989d-1adc01f75382)  # FulxionJs


A web-based game framework focusing on simplicity and performance while maintaining stability.

## Project Overview

FulxionJs is a JavaScript framework designed specifically for creating lightweight and high-performance games. The framework emphasizes minimalism in code structure, making it easy to use while still providing robust features for complex applications.

Key benefits:
- **Simplicity**: Minimalistic architecture allows developers to focus on core functionalities without unnecessary components.
- **Platform Independence**: Built with JavaScript, FulxionJs can run on any modern web browser without the need for additional plugins or setup.
- **Integrated Audio System**: Prebuilt audio library supports browser-based sound effects and background music.
- **Mathematical Library**: Includes matrices, 2D/3D vectors, axis-aligned bounding boxes, and trigonometric calculations for advanced gameplay mechanics.

---

## Setup Instructions

1. Clone the repository:
   ```bash
   git clone https://github.com/[yourusername]/fulxionjs.git
   cd fulxionjs
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the application:
   ```bash
   npm start
   ```

---

## Usage Guide

FulxionJs provides a clean and intuitive API for game development. Here’s how you can use it:

### Basic Example

```javascript
  import Engine from "../../Fluxion/Core/Engine.js"; // Import the Engine class from the specified path
import Sprite from "../../Fluxion/Core/Sprite.js"; // Import the Sprite class from the specified path
import Input from "../../Fluxion/Core/Input.js"; // Import the Input class from the specified path

const input = new Input(); // Create a new Input instance to handle user input
const FluxionLogo = ["../../Fluxion/Icon/Fluxion_icon.png"]; // Define an array containing the path to the Fluxion logo image

const game = {
    spriteList: [], // Initialize an empty array to store sprites

    init(renderer) {
        // Initialize the game
        this.camera = renderer.camera; // store the camera from the renderer.
        this.spriteList.push(new Sprite(renderer, FluxionLogo, -0.3, -0.5, 0.55, 1)); // Create a new Sprite instance and add it to the spriteList
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

```
  
---

## Features

- **Platform Independence**: No additional software or plugins required.
- **Browser-Based Audio**: Supports sound effects and background music directly in the browser.
- **Mathematical Capabilities**: Includes essential tools for 2D/3D geometry, physics, and more.
- **Node-Based Architecture**: Allows for advanced functionality through custom Node.js integration.
- **Lightweight**: Minimal code structure ensures fast performance and quick development cycles.

---

## Contributing

Contributions are welcome! Here's how you can help:

1. Fork the repository.
2. Create a new branch:
   ```bash
   git checkout -b feature-branch-name
   ```
3. Commit your changes.
4. Push the branch to GitHub.
5. Open a Pull Request with a clear description of your contribution.

We review and merge contributions after discussing them in the issue tracker.

---

## Resources

- **Documentation**: Coming soon!
