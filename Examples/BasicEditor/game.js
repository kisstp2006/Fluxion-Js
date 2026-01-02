// @ts-check

import { Engine, SceneLoader, Vector3 } from "../../Fluxion/index.js";

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

  _helpVisible: true,

  /** @param {Renderer} renderer */
  async init(renderer) {
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

    await this.loadSelectedScene(renderer);
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
    const is3D = (obj?.renderLayer === 0) || (typeof obj?.draw3D === 'function');
    return this.mode === '3d' ? is3D : !is3D;
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

  /** @param {number} dt */
  update(dt) {
    if (!this.currentScene) return;

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
