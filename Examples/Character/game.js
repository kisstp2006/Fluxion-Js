import { Engine, Sprite, Input, SceneLoader } from "../../Fluxion/index.js";

const input = new Input(); // Create a new Input instance to handle user input

const game = {
    scene: null,

    async init(renderer) {
        // Initialize the game
        this.scene = await SceneLoader.load("./scene.xml", renderer);
        console.log("Scene loaded:", this.scene);
        
        // Optional: Sync engine camera with scene camera if it exists
        if (this.scene.camera) {
            // We can copy properties or just use the scene camera values to set the engine camera
            // Since Engine.js holds the reference to this.camera, we update its properties
            const sc = this.scene.camera;
            this.camera.x = sc.x;
            this.camera.y = sc.y;
            this.camera.zoom = sc.zoom;
            this.camera.rotation = sc.rotation;
        }
        
        console.log("Game started"); // Log a message to the console indicating the game has started
    },

    update(deltaTime) {
        if (!this.scene) return;

        // Update the game logic
        // console.log("Game running: " + deltaTime); // Log the deltaTime to the console for debugging purposes

        const player = this.scene.getObjectByName("Player");

        if (player) {
            const speed = 500;
            // Move the sprite based on keyboard input
            if (input.getKey("w")) {
                // If the 'w' key is pressed, move the sprite up
                player.y -= speed * deltaTime; // Adjust the sprite's y-coordinate based on deltaTime
            }
            if (input.getKey("a")) {
                // If the 'a' key is pressed, move the sprite left
                player.x -= speed * deltaTime; // Adjust the sprite's x-coordinate based on deltaTime
            }
            if (input.getKey("s")) {
                // If the 's' key is pressed, move the sprite down
                player.y += speed * deltaTime; // Adjust the sprite's y-coordinate based on deltaTime
            }
            if (input.getKey("d")) {
                // If the 'd' key is pressed, move the sprite right
                player.x += speed * deltaTime; // Adjust the sprite's x-coordinate based on deltaTime
            }
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
        
        this.scene.update(deltaTime);
    },

    draw(renderer) {
        // Draw the game elements
        if (this.scene) {
            this.scene.draw(renderer);
        }
    }
};

window.onload = async () => {
    // Event listener for when the window finishes loading
    // Start the game with aspect ratio preservation (1920x1080, 16:9)
    new Engine("gameCanvas", game, 1920, 1080, true, true, {
        renderer: {
            webglVersion: 2,
            allowFallback: true,
            renderTargets: {
                msaaSamples: 4,
            },
        },
    }); // Create a new Engine instance with aspect ratio preservation
};