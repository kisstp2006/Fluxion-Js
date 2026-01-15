// @ts-check

import { Engine, SceneLoader, Vector3 } from "../../packages/engine/Fluxion/index.js";
import Input from "../../packages/engine/Fluxion/Core/Input.js";

/** @typedef {import("../../packages/engine/Fluxion/Core/Renderer.js").default} Renderer */

const game = {
  /** @type {import("../../packages/engine/Fluxion/Core/Scene.js").default | null} */
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
    const dbg = renderer?.debug;

    // --- 3D debug draw examples ---
    // Must be queued BEFORE the scene draws, because 3D debug is rendered at the end of the 3D pass.
    if (dbg && typeof dbg.drawLine3D === 'function') {
      // 1) World axes at origin (overlay)
      const axisLen = 1.0;
      dbg.drawLine3D(0, 0, 0, axisLen, 0, 0, [255, 80, 80, 255], 2, false);   // +X (red)
      dbg.drawLine3D(0, 0, 0, 0, axisLen, 0, [80, 255, 80, 255], 2, false);   // +Y (green)
      dbg.drawLine3D(0, 0, 0, 0, 0, -axisLen, [80, 160, 255, 255], 2, false); // -Z (blue)

      // 2) Ground grid (depth-tested)
      const gridY = -1.49; // slightly above plane at y=-1.5 to reduce z-fighting
      const half = 7.0;
      const step = 1.0;
      const gridColor = [255, 255, 255, 35];
      for (let x = -half; x <= half + 1e-6; x += step) {
        dbg.drawLine3D(x, gridY, -half, x, gridY, half, gridColor, 1, true);
      }
      for (let z = -half; z <= half + 1e-6; z += step) {
        dbg.drawLine3D(-half, gridY, z, half, gridY, z, gridColor, 1, true);
      }

      // 3) Camera forward ray (overlay)
      const cam3d = this.currentScene ? /** @type {any} */ (this.currentScene.getObjectByName("MainCamera3D")) : null;
      if (cam3d && cam3d.position && cam3d.target) {
        const px = Number(cam3d.position.x) || 0;
        const py = Number(cam3d.position.y) || 0;
        const pz = Number(cam3d.position.z) || 0;
        const dx = (Number(cam3d.target.x) || 0) - px;
        const dy = (Number(cam3d.target.y) || 0) - py;
        const dz = (Number(cam3d.target.z) || 0) - pz;
        const len = Math.hypot(dx, dy, dz) || 1;
        const fx = dx / len;
        const fy = dy / len;
        const fz = dz / len;
        const rayLen = 3.0;
        dbg.drawLine3D(px, py, pz, px + fx * rayLen, py + fy * rayLen, pz + fz * rayLen, [255, 255, 0, 255], 2, false);
      }

      // 4) Simple AABB around the HalfGlowingCube slot (depth-tested)
      const cx = 7.5, cy = 0.0, cz = -5.0;
      const s = 1.0;
      const minX = cx - s, maxX = cx + s;
      const minY = cy - s, maxY = cy + s;
      const minZ = cz - s, maxZ = cz + s;
      const box = [255, 0, 255, 180];
      // Bottom rectangle
      dbg.drawLine3D(minX, minY, minZ, maxX, minY, minZ, box, 1, true);
      dbg.drawLine3D(maxX, minY, minZ, maxX, minY, maxZ, box, 1, true);
      dbg.drawLine3D(maxX, minY, maxZ, minX, minY, maxZ, box, 1, true);
      dbg.drawLine3D(minX, minY, maxZ, minX, minY, minZ, box, 1, true);
      // Top rectangle
      dbg.drawLine3D(minX, maxY, minZ, maxX, maxY, minZ, box, 1, true);
      dbg.drawLine3D(maxX, maxY, minZ, maxX, maxY, maxZ, box, 1, true);
      dbg.drawLine3D(maxX, maxY, maxZ, minX, maxY, maxZ, box, 1, true);
      dbg.drawLine3D(minX, maxY, maxZ, minX, maxY, minZ, box, 1, true);
      // Vertical edges
      dbg.drawLine3D(minX, minY, minZ, minX, maxY, minZ, box, 1, true);
      dbg.drawLine3D(maxX, minY, minZ, maxX, maxY, minZ, box, 1, true);
      dbg.drawLine3D(maxX, minY, maxZ, maxX, maxY, maxZ, box, 1, true);
      dbg.drawLine3D(minX, minY, maxZ, minX, maxY, maxZ, box, 1, true);
    }

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
