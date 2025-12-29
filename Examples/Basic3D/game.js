// @ts-check

import { Engine, Scene, Sprite, Text, Camera3D, Mesh, Mat4, Vector3 } from "../../Fluxion/index.js";

/** @typedef {import("../../Fluxion/Core/Renderer.js").default} Renderer */

class Cube3D {
  /** @param {Renderer} renderer */
  constructor(renderer) {
    /** @type {Renderer} */
    this.renderer = renderer;

    // Mark as 3D base layer
    this.renderLayer = 0;

    if (!renderer.gl) {
      throw new Error('Renderer WebGL context is not available');
    }
    this.mesh = Mesh.createColoredCube(renderer.gl);
    this.model = Mat4.identity();

    this.rotation = 0;
  }

  /** @param {number} dt */
  update(dt) {
    this.rotation += dt * 1.2;
  }

  /** @param {Renderer} renderer */
  draw3D(renderer) {
    // Rotate cube and push it a bit forward (negative Z)
    Mat4.rotationY(this.rotation, this.model);
    this.model[12] = 0;
    this.model[13] = 0;
    this.model[14] = -6;

    renderer.drawMesh(this.mesh, this.model, null);
  }

  dispose() {
    this.mesh?.dispose?.();
  }
}

const game = {
  /** @type {Scene | null} */
  currentScene: null,

  /** @param {Renderer} renderer */
  async init(renderer) {
    const scene = new Scene();

    // 3D camera
    const cam3d = new Camera3D();
    cam3d.position = new Vector3(0, 0, 2.5);
    cam3d.lookAt(new Vector3(0, 0, -6));
    scene.setCamera3D(cam3d);

    // 3D object
    const cube = new Cube3D(renderer);
    scene.add(cube);

    // 2D overlay (layer 1 + sub-layer via Sprite.layer)
    const logo = new Sprite(renderer, "../../Fluxion/Icon/Fluxion_icon.png", 40, 40, 96, 96);
    logo.setLayer(1);
    scene.add(logo);

    const title = new Text(renderer, "3D (layer 0) behind 2D (layer 1)", 40, 160, 28, "Inter", "white");
    title.setLayer(2);
    scene.add(title);

    const hint = new Text(renderer, "This example proves the render-pass order.", 40, 200, 18, "Inter", "#cfcfcf");
    hint.setLayer(2);
    scene.add(hint);

    this.currentScene = scene;
  },

  /** @param {number} dt */
  update(dt) {
    if (this.currentScene) this.currentScene.update(dt);
  },

  /** @param {Renderer} renderer */
  draw(renderer) {
    if (this.currentScene) this.currentScene.draw(renderer);
  },
};

new Engine("gameCanvas", game, 1280, 720, true, true, {
  renderer: {
    webglVersion: 2,
    allowFallback: true,
    renderTargets: { msaaSamples: 4 },
  },
});
