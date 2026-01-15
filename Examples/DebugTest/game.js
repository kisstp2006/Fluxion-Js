// @ts-check

import { Engine, Scene, Sprite, Text } from "../../packages/engine/Fluxion/index.js";

/** @typedef {import("../../packages/engine/Fluxion/Core/Renderer.js").default} Renderer */

const game = {
  /** @type {Scene | null} */
  currentScene: null,

  /** @type {Renderer | null} */
  renderer: null,

  /** @type {number} */
  _debugCircleX: 400,

  /** @type {number} */
  _debugCircleY: 300,

  /** @type {number} */
  _debugCircleSpeed: 100, // pixels per second

  /** @type {number} */
  _debugCircleDirection: 0, // angle in radians

  /** @param {Renderer} renderer */
  async init(renderer) {
    this.renderer = renderer;
    const scene = new Scene();

    // Add a sprite to the scene
    const sprite = new Sprite(renderer, "../../packages/engine/Fluxion/Icon/Fluxion_icon.png", 200, 200, 96, 96);
    scene.add(sprite);

    // Add some text
    const title = new Text(renderer, "Debug Rendering Test", 50, 50, 24, "Inter", "white");
    scene.add(title);

    // Initialize moving circle position
    this._debugCircleX = 400;
    this._debugCircleY = 300;

    this.currentScene = scene;
  },


  /** @type {number} */
  _lastDeltaTime: 0,

  /** @param {number} dt */
  update(dt) {
    this._lastDeltaTime = dt;
    if (this.currentScene) this.currentScene.update(dt);

    // Update moving debug circle position
    // Move in a circular/elliptical pattern
    this._debugCircleDirection += dt * 1.5; // Rotate direction
    const radiusX = 200; // Horizontal radius
    const radiusY = 150; // Vertical radius
    const centerX = 640; // Center of screen (1280/2)
    const centerY = 360; // Center of screen (720/2)
    
    this._debugCircleX = centerX + Math.cos(this._debugCircleDirection) * radiusX;
    this._debugCircleY = centerY + Math.sin(this._debugCircleDirection) * radiusY;
  },

  /** @param {Renderer} renderer */
  draw(renderer) {
    if (this.currentScene) this.currentScene.draw(renderer);

    // Debug rendering examples
    const debug = renderer.debug;
    if (!debug) return;

    // Draw a line from top-left to bottom-right
    debug.drawLine(0, 0, 1280, 720, [255, 0, 0, 255], 2);

    // Draw rectangle outline around the sprite (at 200, 200, 96x96)
    debug.drawRect(200, 200, 96, 96, [0, 255, 0, 255], 2);

    // Draw a filled rectangle
    debug.drawRectFilled(400, 300, 100, 50, [255, 255, 0, 128]);

    // Draw a circle outline
    debug.drawCircle(600, 400, 50, [0, 0, 255, 255], 2);

    // Draw a filled circle
    debug.drawCircleFilled(800, 400, 40, [255, 0, 255, 128]);

    // Draw a moving debug circle
    debug.drawCircleFilled(this._debugCircleX, this._debugCircleY, 30, [255, 165, 0, 200]); // Orange
    debug.drawCircle(this._debugCircleX, this._debugCircleY, 30, [255, 255, 255, 255], 2); // White outline
    debug.drawPoint(this._debugCircleX, this._debugCircleY, [255, 255, 255, 255], 4); // Center point
    debug.drawText("Moving Circle", this._debugCircleX - 40, this._debugCircleY - 50, [255, 165, 0, 255], 12);

    // Draw some points
    debug.drawPoint(100, 100, [255, 255, 0, 255], 8);
    debug.drawPoint(500, 500, [0, 255, 255, 255], 6);

    // Draw debug text at world positions
    debug.drawText("Debug Point 1", 100, 120, [255, 255, 0, 255], 14);
    debug.drawText("Debug Point 2", 500, 520, [0, 255, 255, 255], 14);
    const fps = this._lastDeltaTime > 0 ? Math.round(1 / this._lastDeltaTime) : 0;
    debug.drawText("FPS: " + fps, 50, 100, [255, 255, 255, 255], 16);

    // Draw a grid for reference
    for (let x = 0; x < 1280; x += 50) {
      debug.drawLine(x, 0, x, 720, [100, 100, 100, 100], 1);
    }
    for (let y = 0; y < 720; y += 50) {
      debug.drawLine(0, y, 1280, y, [100, 100, 100, 100], 1);
    }
  },
};

new Engine("gameCanvas", game, 1280, 720, true, false);

