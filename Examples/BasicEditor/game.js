// @ts-check

import { Engine, SceneLoader, Vector3, Mat4, Input } from "../../Fluxion/index.js";

/** @typedef {import("../../Fluxion/Core/Renderer.js").default} Renderer */

const ui = {
  sceneSelect: /** @type {HTMLSelectElement|null} */ (null),
  reloadBtn: /** @type {HTMLButtonElement|null} */ (null),
  mode2dBtn: /** @type {HTMLButtonElement|null} */ (null),
  mode3dBtn: /** @type {HTMLButtonElement|null} */ (null),
  tree: /** @type {HTMLDivElement|null} */ (null),
  inspectorSubtitle: /** @type {HTMLDivElement|null} */ (null),
  common: /** @type {HTMLDivElement|null} */ (null),
  transform: /** @type {HTMLDivElement|null} */ (null),
  overlay: /** @type {HTMLDivElement|null} */ (null),
  dbgShowAxes: /** @type {HTMLInputElement|null} */ (null),
  dbgShowAabb: /** @type {HTMLInputElement|null} */ (null),
  dbgDepthTest: /** @type {HTMLInputElement|null} */ (null),
};

/**
 * Minimal editor-style example:
 * - Loads a scene via SceneLoader
 * - Displays a scene tree
 * - Allows selecting an object and editing basic fields
 * - Draws simple 3D debug overlays for the selection
 */
const game = {
  /** @type {import("../../Fluxion/Core/Scene.js").default | null} */
  currentScene: null,

  /** @type {any | null} */
  selected: null,

  /** @type {'2d' | '3d'} */
  mode: '2d',

  /** @type {Renderer | null} */
  _renderer: null,

  /** @type {import("../../Fluxion/Core/Input.js").default | null} */
  _input: null,

  _gizmo: {
    active: false,
    mode: /** @type {'translate'} */ ('translate'),
    axis: /** @type {'x'|'y'|'z'|'center'|null} */ (null),
    startPos2D: /** @type {{x:number,y:number}|null} */ (null),
    startPos3D: /** @type {{x:number,y:number,z:number}|null} */ (null),
    startMouseWorld2D: /** @type {{x:number,y:number}|null} */ (null),
    startAxisT: 0,
    startPlaneHit: /** @type {{x:number,y:number,z:number}|null} */ (null),
  },

  _helpVisible: true,

  /** @param {Renderer} renderer */
  async init(renderer) {
    this._renderer = renderer;
    this._input = new Input();

    // Keep the renderer sized to the editor viewport.
    // (Window resize is not enough in editor layouts; panels can affect canvas size.)
    this._setupViewportResize(renderer);

    // Wire DOM
    ui.sceneSelect = /** @type {HTMLSelectElement} */ (document.getElementById("sceneSelect"));
    ui.reloadBtn = /** @type {HTMLButtonElement} */ (document.getElementById("reloadBtn"));
    ui.mode2dBtn = /** @type {HTMLButtonElement} */ (document.getElementById("mode2dBtn"));
    ui.mode3dBtn = /** @type {HTMLButtonElement} */ (document.getElementById("mode3dBtn"));
    ui.tree = /** @type {HTMLDivElement} */ (document.getElementById("sceneTree"));
    ui.inspectorSubtitle = /** @type {HTMLDivElement} */ (document.getElementById("inspectorSubtitle"));
    ui.common = /** @type {HTMLDivElement} */ (document.getElementById("inspectorCommon"));
    ui.transform = /** @type {HTMLDivElement} */ (document.getElementById("inspectorTransform"));
    ui.overlay = /** @type {HTMLDivElement} */ (document.getElementById("overlay"));
    ui.dbgShowAxes = /** @type {HTMLInputElement} */ (document.getElementById("dbgShowAxes"));
    ui.dbgShowAabb = /** @type {HTMLInputElement} */ (document.getElementById("dbgShowAabb"));
    ui.dbgDepthTest = /** @type {HTMLInputElement} */ (document.getElementById("dbgDepthTest"));

    ui.reloadBtn?.addEventListener("click", () => {
      this.loadSelectedScene(renderer).catch(console.error);
    });

    ui.mode2dBtn?.addEventListener('click', () => {
      this.setMode('2d');
    });
    ui.mode3dBtn?.addEventListener('click', () => {
      this.setMode('3d');
    });

    window.addEventListener("keydown", (e) => {
      if (e.key === "F1") {
        e.preventDefault();
        this._helpVisible = !this._helpVisible;
        if (ui.overlay) ui.overlay.style.display = this._helpVisible ? "block" : "none";
      }
      if (e.key.toLowerCase() === "f") {
        this.focusSelection();
      }
    });

    // Ensure renderer layer visibility matches the default mode.
    this._applyRenderLayers();

    await this.loadSelectedScene(renderer);
  },

  _applyRenderLayers() {
    const r = this._renderer;
    if (!r || typeof r.setRenderLayerEnabled !== 'function') return;
    // Exclusive: 2D mode shows only 2D pass, 3D mode shows only 3D pass.
    r.setRenderLayerEnabled(0, this.mode === '3d');
    r.setRenderLayerEnabled(1, this.mode === '2d');
  },

  /** @param {Renderer} renderer */
  _setupViewportResize(renderer) {
    const canvas = /** @type {HTMLCanvasElement | null} */ (document.getElementById('gameCanvas'));
    if (!canvas || typeof ResizeObserver === 'undefined') {
      // Fallback: at least respond to window resize.
      window.addEventListener('resize', () => renderer.resizeCanvas());
      return;
    }

    let queued = false;
    const requestResize = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        renderer.resizeCanvas();
      });
    };

    // Observe both the canvas and its parent viewport container.
    const ro = new ResizeObserver(() => requestResize());
    ro.observe(canvas);
    if (canvas.parentElement) ro.observe(canvas.parentElement);

    // Also respond to window DPI changes / resizes.
    window.addEventListener('resize', () => requestResize());

    // Initial sizing pass.
    requestResize();
  },

  /** @param {'2d' | '3d'} mode */
  setMode(mode) {
    if (this.mode === mode) return;
    this.mode = mode;

    this._applyRenderLayers();

    if (ui.mode2dBtn && ui.mode3dBtn) {
      ui.mode2dBtn.classList.toggle('active', mode === '2d');
      ui.mode3dBtn.classList.toggle('active', mode === '3d');
      ui.mode2dBtn.setAttribute('aria-selected', mode === '2d' ? 'true' : 'false');
      ui.mode3dBtn.setAttribute('aria-selected', mode === '3d' ? 'true' : 'false');
    }

    // Pick a default selection that matches the mode.
    this.selected = this._pickDefaultSelectionForMode();
    this.rebuildTree();
    this.rebuildInspector();
  },

  /** @param {Renderer} renderer */
  async loadSelectedScene(renderer) {
    const path = ui.sceneSelect?.value || "../Basic3DXaml/scene.xaml";
    this.currentScene = await SceneLoader.load(path, renderer);

    // Default selection follows editor mode.
    this.selected = this._pickDefaultSelectionForMode();

    this.rebuildTree();
    this.rebuildInspector();
  },

  _pickDefaultSelectionForMode() {
    const scene = this.currentScene;
    if (!scene) return null;
    const camName = this.mode === '3d' ? 'MainCamera3D' : 'MainCamera';
    const cam = scene.getObjectByName?.(camName);
    if (cam) return cam;

    const objs = Array.isArray(scene.objects) ? scene.objects : [];
    for (const o of objs) {
      if (o && this._matchesMode(o)) return o;
    }
    return objs[0] || null;
  },

  /** @param {any} obj */
  _matchesMode(obj) {
    // Match engine behavior: objects in the 3D pass are those with renderLayer===0
    // or a draw3D() method. Everything else is considered 2D pass.
    const is3DPass = (obj?.renderLayer === 0) || (typeof obj?.draw3D === 'function');
    return this.mode === '3d' ? is3DPass : !is3DPass;
  },

  rebuildTree() {
    if (!ui.tree) return;
    const tree = ui.tree;
    tree.innerHTML = "";

    const scene = this.currentScene;
    if (!scene || !Array.isArray(scene.objects)) return;

    /** @param {any} obj */
    const addItem = (obj) => {
      const div = document.createElement("div");
      div.className = "treeItem" + (obj === this.selected ? " selected" : "");
      const name = obj?.name ? String(obj.name) : obj?.constructor?.name || "(unnamed)";
      div.textContent = name;
      div.addEventListener("click", () => {
        this.selected = obj;
        this.rebuildTree();
        this.rebuildInspector();
      });
      tree.appendChild(div);
    };

    // Keep it simple: top-level objects only (filtered by mode).
    for (const obj of scene.objects) {
      if (!obj) continue;
      if (!this._matchesMode(obj)) continue;
      addItem(obj);
    }
  },

  rebuildInspector() {
    const obj = this.selected;

    if (ui.inspectorSubtitle) {
      const name = obj?.name ? String(obj.name) : (obj ? (obj.constructor?.name || "(object)") : "No selection");
      ui.inspectorSubtitle.textContent = name;
    }

    if (ui.common) ui.common.innerHTML = "";
    if (ui.transform) ui.transform.innerHTML = "";

    if (!obj) return;

    // Common fields
    this._addReadonly(ui.common, "type", obj.constructor?.name || "unknown");
    this._addToggle(ui.common, "active", obj, "active");
    this._addToggle(ui.common, "visible", obj, "visible");

    // Transform fields (mode-specific)
    if (this.mode === '2d') {
      if (typeof obj.x === "number") this._addNumber(ui.transform, "x", obj, "x");
      if (typeof obj.y === "number") this._addNumber(ui.transform, "y", obj, "y");
      if (typeof obj.layer === "number") this._addNumber(ui.transform, "layer", obj, "layer");
      if (typeof obj.width === "number") this._addNumber(ui.transform, "width", obj, "width");
      if (typeof obj.height === "number") this._addNumber(ui.transform, "height", obj, "height");
      if (typeof obj.rotation === "number") this._addNumber(ui.transform, "rotation", obj, "rotation");
      if (typeof obj.zoom === "number") this._addNumber(ui.transform, "zoom", obj, "zoom");
    } else {
      // Support both (x,y,z,rotX,rotY,rotZ) and (position Vector3).
      if (typeof obj.x === "number") this._addNumber(ui.transform, "x", obj, "x");
      if (typeof obj.y === "number") this._addNumber(ui.transform, "y", obj, "y");
      if (typeof obj.z === "number") this._addNumber(ui.transform, "z", obj, "z");

      if (typeof obj.rotX === "number") this._addNumber(ui.transform, "rotX", obj, "rotX");
      if (typeof obj.rotY === "number") this._addNumber(ui.transform, "rotY", obj, "rotY");
      if (typeof obj.rotZ === "number") this._addNumber(ui.transform, "rotZ", obj, "rotZ");

      if (obj.position && typeof obj.position.x === "number") {
        this._addNumber(ui.transform, "pos.x", obj.position, "x");
        this._addNumber(ui.transform, "pos.y", obj.position, "y");
        this._addNumber(ui.transform, "pos.z", obj.position, "z");
      }

      if (obj.target && typeof obj.target.x === "number") {
        this._addNumber(ui.transform, "target.x", obj.target, "x");
        this._addNumber(ui.transform, "target.y", obj.target, "y");
        this._addNumber(ui.transform, "target.z", obj.target, "z");
      }
    }
  },

  /**
   * @param {HTMLElement | null} container
   * @param {string} labelText
   * @param {HTMLElement} node
   */
  _addField(container, labelText, node) {
    if (!container) return;
    const field = document.createElement("div");
    field.className = "field";

    const label = document.createElement("div");
    label.className = "label";
    label.textContent = labelText;

    const value = document.createElement("div");
    value.className = "value";

    field.appendChild(label);
    field.appendChild(value);
    container.appendChild(field);
    value.appendChild(node);
  },

  /**
   * @param {HTMLElement | null} container
   * @param {string} label
   * @param {string | number} text
   */
  _addReadonly(container, label, text) {
    const span = document.createElement("div");
    span.textContent = String(text);
    span.style.padding = "8px 10px";
    span.style.border = "1px solid var(--border)";
    span.style.borderRadius = "6px";
    span.style.background = "#1a1a1a";
    this._addField(container, label, span);
  },

  /**
   * @param {HTMLElement | null} container
   * @param {string} label
   * @param {any} obj
   * @param {string} key
   */
  _addToggle(container, label, obj, key) {
    if (!obj || !(key in obj)) return;
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = !!obj[key];
    input.addEventListener("change", () => {
      obj[key] = !!input.checked;
    });

    const wrap = document.createElement("label");
    wrap.className = "checkRow";
    wrap.style.margin = "0";
    wrap.appendChild(input);
    const t = document.createElement("span");
    t.textContent = "";
    wrap.appendChild(t);

    this._addField(container, label, wrap);
  },

  /**
   * @param {HTMLElement | null} container
   * @param {string} label
   * @param {any} obj
   * @param {string} key
   */
  _addNumber(container, label, obj, key) {
    if (!obj) return;
    const input = document.createElement("input");
    input.type = "number";
    input.step = "0.01";
    input.value = String(Number(obj[key]) || 0);
    input.addEventListener("change", () => {
      const v = Number(input.value);
      if (Number.isFinite(v)) obj[key] = v;
    });
    this._addField(container, label, input);
  },

  focusSelection() {
    if (!this.currentScene || !this.selected) return;
    if (this.mode === '3d') {
      const cam = /** @type {any} */ (this.currentScene.getObjectByName?.("MainCamera3D"));
      if (!cam || !cam.position || typeof cam.lookAt !== "function") return;

      const p = this._getWorldPos(this.selected);
      if (!p) return;

      cam.position.x = p.x + 0.0;
      cam.position.y = p.y + 1.0;
      cam.position.z = p.z + 3.5;
      cam.lookAt(new Vector3(p.x, p.y, p.z));
      return;
    }

    // 2D focus: move the 2D camera to the selection.
    const cam2 = /** @type {any} */ (this.currentScene.getObjectByName?.("MainCamera"));
    if (!cam2) return;
    const p2 = this._get2DPos(this.selected);
    if (!p2) return;
    if (typeof cam2.x === 'number') cam2.x = p2.x;
    if (typeof cam2.y === 'number') cam2.y = p2.y;
  },

  /** @param {any} obj */
  _get2DPos(obj) {
    if (!obj) return null;
    if (typeof obj.x === 'number' || typeof obj.y === 'number') {
      return { x: Number(obj.x) || 0, y: Number(obj.y) || 0 };
    }
    return null;
  },

  /** @param {any} obj */
  _getWorldPos(obj) {
    if (!obj) return null;
    if (obj.position && typeof obj.position.x === "number") {
      return { x: Number(obj.position.x) || 0, y: Number(obj.position.y) || 0, z: Number(obj.position.z) || 0 };
    }
    if (typeof obj.x === "number" || typeof obj.y === "number" || typeof obj.z === "number") {
      return { x: Number(obj.x) || 0, y: Number(obj.y) || 0, z: Number(obj.z) || 0 };
    }
    return null;
  },

  /** @param {any} obj @param {number} x @param {number} y */
  _set2DPos(obj, x, y) {
    if (!obj) return;
    if (typeof obj.x === 'number') obj.x = x;
    if (typeof obj.y === 'number') obj.y = y;
  },

  /** @param {any} obj @param {number} x @param {number} y @param {number} z */
  _setWorldPos(obj, x, y, z) {
    if (!obj) return;
    if (obj.position && typeof obj.position.x === 'number') {
      obj.position.x = x;
      obj.position.y = y;
      obj.position.z = z;
      return;
    }
    if (typeof obj.x === 'number') obj.x = x;
    if (typeof obj.y === 'number') obj.y = y;
    if (typeof obj.z === 'number') obj.z = z;
  },

  _getCanvasRect() {
    const r = this._renderer;
    const canvas = r?.canvas;
    if (!r || !canvas) return null;
    return canvas.getBoundingClientRect();
  },

  /** @param {number} x @param {number} y */
  _isPointInCanvas(x, y) {
    const rect = this._getCanvasRect();
    if (!rect) return false;
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  },

  /**
   * @param {number} px
   * @param {number} py
   * @param {number} ax
   * @param {number} ay
   * @param {number} bx
   * @param {number} by
   */
  _distPointToSegment2D(px, py, ax, ay, bx, by) {
    const abx = bx - ax;
    const aby = by - ay;
    const apx = px - ax;
    const apy = py - ay;
    const abLen2 = abx * abx + aby * aby;
    if (abLen2 <= 1e-8) {
      const dx = px - ax;
      const dy = py - ay;
      return Math.hypot(dx, dy);
    }
    let t = (apx * abx + apy * aby) / abLen2;
    t = Math.max(0, Math.min(1, t));
    const cx = ax + abx * t;
    const cy = ay + aby * t;
    return Math.hypot(px - cx, py - cy);
  },

  /** @param {any} camera3D @param {number} clientX @param {number} clientY */
  _getMouseRay3D(camera3D, clientX, clientY) {
    const r = this._renderer;
    if (!r || !camera3D) return null;

    const viewport = r.viewport;
    if (!viewport) return null;

    /** @type {HTMLCanvasElement} */
    // @ts-ignore - renderer.canvas is a canvas at runtime
    const canvas = r.canvas;

    const rect = canvas.getBoundingClientRect();
    const localCssX = clientX - rect.left;
    const localCssY = clientY - rect.top;
    const cssToDeviceX = canvas.width / rect.width;
    const cssToDeviceY = canvas.height / rect.height;
    const localDeviceX = localCssX * cssToDeviceX;
    const localDeviceY = localCssY * cssToDeviceY;
    const webglDeviceX = localDeviceX;
    const webglDeviceY = canvas.height - localDeviceY;

    const u = (webglDeviceX - viewport.x) / viewport.width;
    const v = (webglDeviceY - viewport.y) / viewport.height;
    const uClamped = Math.max(0, Math.min(1, u));
    const vClamped = Math.max(0, Math.min(1, v));

    const ndcX = uClamped * 2 - 1;
    const ndcY = vClamped * 2 - 1;

    const vp = camera3D.getViewProjectionMatrix?.();
    if (!vp) return null;
    const inv = Mat4.invert(vp);
    if (!inv) return null;

    const unproject = (/** @type {number} */ z) => {
      const x = ndcX, y = ndcY;
      const w = 1;
      const vx = inv[0] * x + inv[4] * y + inv[8] * z + inv[12] * w;
      const vy = inv[1] * x + inv[5] * y + inv[9] * z + inv[13] * w;
      const vz = inv[2] * x + inv[6] * y + inv[10] * z + inv[14] * w;
      const vw = inv[3] * x + inv[7] * y + inv[11] * z + inv[15] * w;
      if (Math.abs(vw) < 1e-8) return { x: vx, y: vy, z: vz };
      return { x: vx / vw, y: vy / vw, z: vz / vw };
    };

    const pNear = unproject(-1);
    const pFar = unproject(1);
    const dx = pFar.x - pNear.x;
    const dy = pFar.y - pNear.y;
    const dz = pFar.z - pNear.z;
    const len = Math.hypot(dx, dy, dz) || 1;
    return {
      origin: pNear,
      dir: { x: dx / len, y: dy / len, z: dz / len },
    };
  },

  /** @param {{x:number,y:number,z:number}} rayO @param {{x:number,y:number,z:number}} rayD @param {{x:number,y:number,z:number}} planeP @param {{x:number,y:number,z:number}} planeN */
  _rayPlane(rayO, rayD, planeP, planeN) {
    const denom = planeN.x * rayD.x + planeN.y * rayD.y + planeN.z * rayD.z;
    if (Math.abs(denom) < 1e-6) return null;
    const t = (planeN.x * (planeP.x - rayO.x) + planeN.y * (planeP.y - rayO.y) + planeN.z * (planeP.z - rayO.z)) / denom;
    if (!Number.isFinite(t)) return null;
    return { x: rayO.x + rayD.x * t, y: rayO.y + rayD.y * t, z: rayO.z + rayD.z * t };
  },

  /** @param {{x:number,y:number,z:number}} p0 @param {{x:number,y:number,z:number}} d0 @param {{x:number,y:number,z:number}} p1 @param {{x:number,y:number,z:number}} d1 */
  _closestAxisT(p0, d0, p1, d1) {
    // Returns t along axis line (p0 + d0 * t) closest to ray (p1 + d1 * s)
    const b = d0.x * d1.x + d0.y * d1.y + d0.z * d1.z;
    const rX = p0.x - p1.x;
    const rY = p0.y - p1.y;
    const rZ = p0.z - p1.z;
    const d = d0.x * rX + d0.y * rY + d0.z * rZ;
    const e = d1.x * rX + d1.y * rY + d1.z * rZ;
    const denom = 1 - b * b;
    if (Math.abs(denom) < 1e-6) return null;
    return (b * e - d) / denom;
  },

  _updateGizmo() {
    const scene = this.currentScene;
    const r = this._renderer;
    const input = this._input;
    const obj = this.selected;
    if (!scene || !r || !input || !obj) {
      this._gizmo.active = false;
      this._gizmo.axis = null;
      return;
    }

    const mouse = input.getMousePosition();
    const mouseDown = input.getMouseButtonDown(0);
    const mouseHeld = input.getMouseButton(0);
    const mouseUp = input.getMouseButtonUp(0);

    // Only interact when the mouse is over the canvas (avoid dragging via UI panels).
    const overCanvas = this._isPointInCanvas(mouse.x, mouse.y);

    if (mouseUp) {
      this._gizmo.active = false;
      this._gizmo.axis = null;
    }

    if (this.mode === '2d') {
      const cam2 = /** @type {any} */ (scene.camera || scene.getObjectByName?.('MainCamera'));
      const p = this._get2DPos(obj);
      if (!cam2 || !p) return;

      const mouseWorld = r.screenToWorld(mouse.x, mouse.y, cam2);
      const zoom = Number(cam2.zoom) || 1;
      const axisLen = 80 / zoom;
      const hitTh = 10 / zoom;

      const ax = p.x, ay = p.y;
      const x1 = ax + axisLen, y1 = ay;
      const x2 = ax, y2 = ay + axisLen;

      // Start drag: pick axis/center.
      if (!this._gizmo.active && mouseDown && overCanvas) {
        const dX = this._distPointToSegment2D(mouseWorld.x, mouseWorld.y, ax, ay, x1, y1);
        const dY = this._distPointToSegment2D(mouseWorld.x, mouseWorld.y, ax, ay, x2, y2);
        const dC = Math.hypot(mouseWorld.x - ax, mouseWorld.y - ay);

        let axis = /** @type {'x'|'y'|'center'|null} */ (null);
        let best = hitTh;
        if (dC < best) { best = dC; axis = 'center'; }
        if (dX < best) { best = dX; axis = 'x'; }
        if (dY < best) { best = dY; axis = 'y'; }

        if (axis) {
          this._gizmo.active = true;
          this._gizmo.axis = axis;
          this._gizmo.startPos2D = { x: p.x, y: p.y };
          this._gizmo.startMouseWorld2D = { x: mouseWorld.x, y: mouseWorld.y };
        }
      }

      // Dragging.
      if (this._gizmo.active && mouseHeld && this._gizmo.startPos2D && this._gizmo.startMouseWorld2D) {
        const dx = mouseWorld.x - this._gizmo.startMouseWorld2D.x;
        const dy = mouseWorld.y - this._gizmo.startMouseWorld2D.y;
        const s = this._gizmo.startPos2D;
        const a = this._gizmo.axis;
        const nx = (a === 'y') ? s.x : (s.x + dx);
        const ny = (a === 'x') ? s.y : (s.y + dy);
        this._set2DPos(obj, nx, ny);
      }

      return;
    }

    // 3D gizmo
    const cam3 = /** @type {any} */ (scene.camera3D || scene.getObjectByName?.('MainCamera3D'));
    const p3 = this._getWorldPos(obj);
    if (!cam3 || !p3) return;

    const ray = this._getMouseRay3D(cam3, mouse.x, mouse.y);
    if (!ray) return;

    const axisLen = 1.2;
    const hitTh = 0.25;
    const o = { x: p3.x, y: p3.y, z: p3.z };

    const axisVecs = /** @type {Array<{axis:'x'|'y'|'z', d:{x:number,y:number,z:number}}>} */ ([
      { axis: 'x', d: { x: 1, y: 0, z: 0 } },
      { axis: 'y', d: { x: 0, y: 1, z: 0 } },
      { axis: 'z', d: { x: 0, y: 0, z: -1 } },
    ]);

    if (!this._gizmo.active && mouseDown && overCanvas) {
      // Center handle: plane perpendicular to camera forward.
      const fwd = {
        x: (cam3.target?.x ?? 0) - (cam3.position?.x ?? 0),
        y: (cam3.target?.y ?? 0) - (cam3.position?.y ?? 0),
        z: (cam3.target?.z ?? 0) - (cam3.position?.z ?? 0),
      };
      const fLen = Math.hypot(fwd.x, fwd.y, fwd.z) || 1;
      const planeN = { x: fwd.x / fLen, y: fwd.y / fLen, z: fwd.z / fLen };
      const hit = this._rayPlane(ray.origin, ray.dir, o, planeN);
      const dC = hit ? Math.hypot(hit.x - o.x, hit.y - o.y, hit.z - o.z) : Infinity;

      let picked = /** @type {'x'|'y'|'z'|'center'|null} */ (null);
      let best = hitTh;
      if (dC < best) { best = dC; picked = 'center'; }

      for (const a of axisVecs) {
        const t = this._closestAxisT(o, a.d, ray.origin, ray.dir);
        if (t === null) continue;
        const tClamped = Math.max(0, Math.min(axisLen, t));
        const px = o.x + a.d.x * tClamped;
        const py = o.y + a.d.y * tClamped;
        const pz = o.z + a.d.z * tClamped;

        // Closest point on ray to this point (project)
        const rx = px - ray.origin.x;
        const ry = py - ray.origin.y;
        const rz = pz - ray.origin.z;
        const s = rx * ray.dir.x + ry * ray.dir.y + rz * ray.dir.z;
        const qx = ray.origin.x + ray.dir.x * s;
        const qy = ray.origin.y + ray.dir.y * s;
        const qz = ray.origin.z + ray.dir.z * s;
        const dist = Math.hypot(px - qx, py - qy, pz - qz);
        if (dist < best) {
          best = dist;
          picked = a.axis;
        }
      }

      if (picked) {
        this._gizmo.active = true;
        this._gizmo.axis = picked;
        this._gizmo.startPos3D = { x: o.x, y: o.y, z: o.z };
        if (picked === 'center') {
          this._gizmo.startPlaneHit = hit;
        } else {
          const d = axisVecs.find(v => v.axis === picked)?.d;
          const t0 = d ? this._closestAxisT(o, d, ray.origin, ray.dir) : null;
          this._gizmo.startAxisT = Number(t0) || 0;
        }
      }
    }

    if (this._gizmo.active && mouseHeld && this._gizmo.startPos3D) {
      const start = this._gizmo.startPos3D;
      const a = this._gizmo.axis;

      if (a === 'center') {
        const fwd = {
          x: (cam3.target?.x ?? 0) - (cam3.position?.x ?? 0),
          y: (cam3.target?.y ?? 0) - (cam3.position?.y ?? 0),
          z: (cam3.target?.z ?? 0) - (cam3.position?.z ?? 0),
        };
        const fLen = Math.hypot(fwd.x, fwd.y, fwd.z) || 1;
        const planeN = { x: fwd.x / fLen, y: fwd.y / fLen, z: fwd.z / fLen };
        const hit = this._rayPlane(ray.origin, ray.dir, start, planeN);
        if (hit && this._gizmo.startPlaneHit) {
          const dx = hit.x - this._gizmo.startPlaneHit.x;
          const dy = hit.y - this._gizmo.startPlaneHit.y;
          const dz = hit.z - this._gizmo.startPlaneHit.z;
          this._setWorldPos(obj, start.x + dx, start.y + dy, start.z + dz);
        }
      } else {
        const d = axisVecs.find(v => v.axis === a)?.d;
        if (d) {
          const tNow = this._closestAxisT(start, d, ray.origin, ray.dir);
          if (tNow !== null) {
            const delta = tNow - (this._gizmo.startAxisT || 0);
            this._setWorldPos(obj, start.x + d.x * delta, start.y + d.y * delta, start.z + d.z * delta);
          }
        }
      }
    }
  },

  /** @param {number} dt */
  update(dt) {
    if (!this.currentScene) return;

    // Gizmo manipulation (uses input + debug-drawn handles).
    this._updateGizmo();

    // Keep the loaded scene running normally.
    this.currentScene.update(dt);

    // Keep inspector values reasonably fresh (but don’t fight user input while typing).
    // Minimal: rebuild every frame if selection exists.
    if (this.selected) this.rebuildInspector();
  },

  /** @param {Renderer} renderer */
  draw(renderer) {
    const dbg = renderer?.debug;
    const obj = this.selected;

    if (dbg && obj) {
      const depth = !!ui.dbgDepthTest?.checked;

      // 2D debug (uses existing 2D debug renderer)
      if (this.mode === '2d') {
        const p2 = this._get2DPos(obj);
        if (p2) {
          // Translate gizmo (2D)
          const cam2 = /** @type {any} */ (this.currentScene?.camera || this.currentScene?.getObjectByName?.('MainCamera'));
          const zoom = cam2 ? (Number(cam2.zoom) || 1) : 1;
          const axisLen = 80 / zoom;
          const cX = (this._gizmo.active && this._gizmo.axis === 'x') ? [255, 180, 180, 255] : [255, 80, 80, 230];
          const cY = (this._gizmo.active && this._gizmo.axis === 'y') ? [180, 255, 180, 255] : [80, 255, 80, 230];
          const cC = (this._gizmo.active && this._gizmo.axis === 'center') ? [255, 255, 255, 255] : [255, 255, 255, 160];
          dbg.drawLine(p2.x, p2.y, p2.x + axisLen, p2.y, cX, 3);
          dbg.drawLine(p2.x, p2.y, p2.x, p2.y + axisLen, cY, 3);
          const hs = 6 / zoom;
          dbg.drawRect(p2.x - hs, p2.y - hs, hs * 2, hs * 2, cC, 2, false);

          const size = 10;
          // Crosshair at position
          dbg.drawLine(p2.x - size, p2.y, p2.x + size, p2.y, [255, 255, 0, 220], 2);
          dbg.drawLine(p2.x, p2.y - size, p2.x, p2.y + size, [255, 255, 0, 220], 2);

          // Rect if width/height are available
          if (typeof obj.width === 'number' && typeof obj.height === 'number') {
            dbg.drawRect(p2.x, p2.y, Number(obj.width) || 0, Number(obj.height) || 0, [255, 0, 255, 120], 2, false);
          }
        }
      }

      // 3D debug (renders at end of 3D pass)
      if (this.mode === '3d' && typeof dbg.drawLine3D === 'function') {
        const p = this._getWorldPos(obj);
        if (p) {
          // Translate gizmo (3D)
          const s = 1.2;
          const cX = (this._gizmo.active && this._gizmo.axis === 'x') ? [255, 180, 180, 255] : [255, 80, 80, 255];
          const cY = (this._gizmo.active && this._gizmo.axis === 'y') ? [180, 255, 180, 255] : [80, 255, 80, 255];
          const cZ = (this._gizmo.active && this._gizmo.axis === 'z') ? [180, 220, 255, 255] : [80, 160, 255, 255];
          dbg.drawLine3D(p.x, p.y, p.z, p.x + s, p.y, p.z, cX, 2, depth);
          dbg.drawLine3D(p.x, p.y, p.z, p.x, p.y + s, p.z, cY, 2, depth);
          dbg.drawLine3D(p.x, p.y, p.z, p.x, p.y, p.z - s, cZ, 2, depth);

          if (ui.dbgShowAxes?.checked) {
            const s = 0.8;
            dbg.drawLine3D(p.x, p.y, p.z, p.x + s, p.y, p.z, [255, 80, 80, 255], 2, depth);
            dbg.drawLine3D(p.x, p.y, p.z, p.x, p.y + s, p.z, [80, 255, 80, 255], 2, depth);
            dbg.drawLine3D(p.x, p.y, p.z, p.x, p.y, p.z - s, [80, 160, 255, 255], 2, depth);
          }

          if (ui.dbgShowAabb?.checked) {
            // Approx AABB as a 2x2x2 cube around the position.
            const s = 1.0;
            const minX = p.x - s, maxX = p.x + s;
            const minY = p.y - s, maxY = p.y + s;
            const minZ = p.z - s, maxZ = p.z + s;
            const c = [255, 0, 255, 170];

            // bottom
            dbg.drawLine3D(minX, minY, minZ, maxX, minY, minZ, c, 1, depth);
            dbg.drawLine3D(maxX, minY, minZ, maxX, minY, maxZ, c, 1, depth);
            dbg.drawLine3D(maxX, minY, maxZ, minX, minY, maxZ, c, 1, depth);
            dbg.drawLine3D(minX, minY, maxZ, minX, minY, minZ, c, 1, depth);
            // top
            dbg.drawLine3D(minX, maxY, minZ, maxX, maxY, minZ, c, 1, depth);
            dbg.drawLine3D(maxX, maxY, minZ, maxX, maxY, maxZ, c, 1, depth);
            dbg.drawLine3D(maxX, maxY, maxZ, minX, maxY, maxZ, c, 1, depth);
            dbg.drawLine3D(minX, maxY, maxZ, minX, maxY, minZ, c, 1, depth);
            // sides
            dbg.drawLine3D(minX, minY, minZ, minX, maxY, minZ, c, 1, depth);
            dbg.drawLine3D(maxX, minY, minZ, maxX, maxY, minZ, c, 1, depth);
            dbg.drawLine3D(maxX, minY, maxZ, maxX, maxY, maxZ, c, 1, depth);
            dbg.drawLine3D(minX, minY, maxZ, minX, maxY, maxZ, c, 1, depth);
          }
        }
      }
    }

    if (this.currentScene) this.currentScene.draw(renderer);
  },
};

new Engine("gameCanvas", game, 1280, 720, true, true, {
  renderer: {
    webglVersion: 2,
    allowFallback: true,
    renderTargets: { msaaSamples: 4 },
    // The editor embeds the canvas in a layout; let CSS drive its on-page size.
    respectCssSize: true,
  },
  input: {
    lockMouse: false,
  },
});
