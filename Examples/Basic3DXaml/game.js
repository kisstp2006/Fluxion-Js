// @ts-check

import { Engine, SceneLoader, Vector3 } from "../../Fluxion/index.js";

/** @typedef {import("../../Fluxion/Core/Renderer.js").default} Renderer */

const game = {
  /** @type {import("../../Fluxion/Core/Scene.js").default | null} */
  currentScene: null,

  _orbitAngle: 0,
  _sunAngle: 0,

  /** @param {Renderer} renderer */
  async init(renderer) {
    this.currentScene = await SceneLoader.load("./scene.xaml", renderer);

    // Enable screen-space shadows (post-process) to enhance small-scale detail.
    // This complements shadow maps / CSM and helps prevent "floating" objects.
    if (renderer?.setScreenSpaceShadowsEnabled) {
      renderer.setScreenSpaceShadowsEnabled(true);
      renderer.setScreenSpaceShadowStrength?.(0.25);
      renderer.setScreenSpaceShadowMaxDistance?.(0.8);
      renderer.setScreenSpaceShadowSteps?.(16);
      renderer.setScreenSpaceShadowEdgeFade?.(0.06);
    }
  },

  /** @param {number} dt */
  update(dt) {
    if (!this.currentScene) return;

    // Animate directional light so shadows clearly move (debugging).
    const sun = /** @type {any} */ (this.currentScene.getObjectByName("Sun"));
    if (sun && Array.isArray(sun.direction)) {
      // Keep Y negative so the light points downwards; rotate around Y axis.
      this._sunAngle += dt * 0.35;
      const r = 0.6;
      sun.direction[0] = Math.cos(this._sunAngle) * r;
      sun.direction[1] = -1.0;
      sun.direction[2] = Math.sin(this._sunAngle) * r;
    }

    // Animate the sphere node if present
    const sphere = /** @type {any} */ (this.currentScene.getObjectByName("SphereNode"));
    if (sphere) {
      sphere.rotY += dt * 1.2;
      sphere.rotX += dt * 0.6;
    }

    // Orbit the 3D camera around the sphere
    const cam3d = /** @type {any} */ (this.currentScene.getObjectByName("MainCamera3D"));
    if (cam3d && cam3d.position) {
      const targetX = sphere?.x ?? 0;
      const targetY = sphere?.y ?? 0;
      const targetZ = sphere?.z ?? -6;

      const orbitRadius = 4.5;
      const orbitHeight = 1.5;
      const orbitSpeed = 0.6;

      this._orbitAngle += dt * orbitSpeed;

      cam3d.position.x = targetX + Math.cos(this._orbitAngle) * orbitRadius;
      cam3d.position.z = targetZ + Math.sin(this._orbitAngle) * orbitRadius;
      cam3d.position.y = targetY + orbitHeight;

      // Keep looking at the ball
      cam3d.lookAt(new Vector3(targetX, targetY, targetZ));
    }

    this.currentScene.update(dt);
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
