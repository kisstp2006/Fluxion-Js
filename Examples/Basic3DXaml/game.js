// @ts-check

import { Engine, SceneLoader, Vector3 } from "../../Fluxion/index.js";
import Input from "../../Fluxion/Core/Input.js";

/** @typedef {import("../../Fluxion/Core/Renderer.js").default} Renderer */

const game = {
  /** @type {import("../../Fluxion/Core/Scene.js").default | null} */
  currentScene: null,

  _sunAngle: 0,

  // Free-fly camera controller state
  _flyInit: false,
  _flyYaw: 0,
  _flyPitch: 0,
  _flyLastMouse: { x: 0, y: 0 },

  /** @param {Renderer} renderer */
  async init(renderer) {
    this.currentScene = await SceneLoader.load("./scene.xaml", renderer);

    // Prevent the browser context menu so RMB mouse-look feels natural.
    try {
      const canvas = document.getElementById("gameCanvas");
      if (canvas) {
        canvas.addEventListener("contextmenu", (e) => e.preventDefault());
      }
    } catch {
      // ignore
    }

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

    // Free-fly camera (WASD + QE, RMB mouse-look)
    const cam3d = /** @type {any} */ (this.currentScene.getObjectByName("MainCamera3D"));
    if (cam3d && cam3d.position && typeof cam3d.lookAt === 'function') {
      const input = new Input();

      // Initialize yaw/pitch from current camera target, so there is no jump.
      if (!this._flyInit && cam3d.target) {
        const dx = (cam3d.target.x ?? 0) - (cam3d.position.x ?? 0);
        const dy = (cam3d.target.y ?? 0) - (cam3d.position.y ?? 0);
        const dz = (cam3d.target.z ?? 0) - (cam3d.position.z ?? 0);
        const len = Math.hypot(dx, dy, dz) || 1;
        const dirx = dx / len;
        const diry = dy / len;
        const dirz = dz / len;
        this._flyPitch = Math.asin(Math.max(-1, Math.min(1, diry)));
        // forward.z = -cos(yaw)*cos(pitch)  => yaw = atan2(x, -z)
        this._flyYaw = Math.atan2(dirx, -dirz);
        this._flyInit = true;
      }

      const canvas = /** @type {any} */ (document.getElementById("gameCanvas"));
      const pointerLocked = (typeof document !== 'undefined') && canvas && (document.pointerLockElement === canvas);
      const looking = pointerLocked || input.getMouseButton(2);
      if (looking) {
        const md = (typeof input.getMouseDelta === 'function') ? input.getMouseDelta() : { x: 0, y: 0 };
        const dx = md.x || 0;
        const dy = md.y || 0;
        const sensitivity = 0.0025;
        this._flyYaw += dx * sensitivity;
        this._flyPitch -= dy * sensitivity;
        const limit = 1.55;
        this._flyPitch = Math.max(-limit, Math.min(limit, this._flyPitch));
      }

      const cosP = Math.cos(this._flyPitch);
      const forward = new Vector3(
        Math.sin(this._flyYaw) * cosP,
        Math.sin(this._flyPitch),
        -Math.cos(this._flyYaw) * cosP
      ).normalize();

      const worldUp = new Vector3(0, 1, 0);
      const right = Vector3.cross(forward, worldUp).normalize();
      const up = worldUp;

      // Movement input
      const w = input.getKey('w') ? 1 : 0;
      const s = input.getKey('s') ? 1 : 0;
      const a = input.getKey('a') ? 1 : 0;
      const d = input.getKey('d') ? 1 : 0;
      const q = input.getKey('q') ? 1 : 0;
      const e = input.getKey('e') ? 1 : 0;

      let speed = 4.5;
      if (input.getKey('Shift')) speed *= 3.0;
      if (input.getKey('Control')) speed *= 0.35;

      const move = new Vector3(0, 0, 0);
      if (w || s) move.add(forward.copy().scale(w - s));
      if (d || a) move.add(right.copy().scale(d - a));
      if (e || q) move.add(up.copy().scale(e - q));

      if (move.lengthSq() > 1e-8) {
        move.normalize().scale(speed * dt);
        cam3d.position.x += move.x;
        cam3d.position.y += move.y;
        cam3d.position.z += move.z;
      }

      // Always look where we're facing.
      cam3d.lookAt(new Vector3(
        cam3d.position.x + forward.x,
        cam3d.position.y + forward.y,
        cam3d.position.z + forward.z
      ));
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
  input: {
    lockMouse: true,
  },
});
