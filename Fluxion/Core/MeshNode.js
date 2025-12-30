/**
 * 3D scene node for rendering a primitive mesh.
 * Render layer: 0 (3D base pass).
 */

import Mesh from './Mesh.js';
import { Mat4 } from './Math3D.js';
import Material from './Material.js';

export default class MeshNode {
  constructor() {
    this.name = 'MeshNode';
    this.active = true;

    /** @type {any[]} */
    this.children = [];

    // Mark as 3D base layer.
    this.renderLayer = 0;

    // Transform (units: world units; rotation in radians)
    this.x = 0;
    this.y = 0;
    this.z = 0;

    this.scaleX = 1;
    this.scaleY = 1;
    this.scaleZ = 1;

    this.rotX = 0;
    this.rotY = 0;
    this.rotZ = 0;

    // Mesh source: either a primitive name ("Cube", "Sphere", ...)
    // or a named mesh definition registered in Scene.
    this.source = 'Cube';

    // Optional per-node color (default white). Used when creating primitive meshes.
    this.color = [1, 1, 1, 1];

    // Optional material reference/instance. Can be a string name (resolved by SceneLoader)
    // or a Material instance (set via setMaterial).
    this.material = null;

    // If no explicit material is provided, we render with this node-local default.
    // (Its base color is kept in sync with `this.color` / mesh resource color.)
    this._defaultMaterial = new Material();

    // Optional mesh definition (set by SceneLoader if source matches a named mesh resource).
    this.meshDefinition = null;

    /** @type {import('./Mesh.js').default | null} */
    this._mesh = null;
    this._meshKey = '';

    // Scratch matrices to avoid per-frame allocations.
    this._mS = Mat4.identity();
    this._mRx = Mat4.identity();
    this._mRy = Mat4.identity();
    this._mRz = Mat4.identity();
    this._mT = Mat4.identity();
    this._tmp0 = Mat4.identity();
    this._tmp1 = Mat4.identity();
    this._tmp2 = Mat4.identity();
    this._model = Mat4.identity();
  }

  /** @param {any} child */
  addChild(child) {
    if (!child) return;
    child.parent = this;
    this.children.push(child);
  }

  /** @param {any} child */
  removeChild(child) {
    const idx = this.children.indexOf(child);
    if (idx >= 0) {
      this.children.splice(idx, 1);
      if (child) child.parent = null;
    }
  }

  setPosition(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  setScale(x, y, z) {
    this.scaleX = x;
    this.scaleY = y;
    this.scaleZ = z;
  }

  setRotation(x, y, z) {
    this.rotX = x;
    this.rotY = y;
    this.rotZ = z;
  }

  /**
   * Set primitive or named-mesh source.
   * Changing this will trigger lazy rebuild on next draw.
   * @param {string} source
   */
  setSource(source) {
    this.source = source;
    this.meshDefinition = null;
    this._mesh = null;
    this._meshKey = '';
  }

  /** @param {any} def */
  setMeshDefinition(def) {
    this.meshDefinition = def;
    // Force rebuild
    this._mesh = null;
    this._meshKey = '';
  }

  /** @param {any} materialDef */
  setMaterial(materialDef) {
    this.material = materialDef || null;
  }

  /**
   * Match 2D node update signature.
   * @param {number} dt
   * @param {any} _camera
   */
  update(dt, _camera) {
    if (!this.active) return;
    for (const child of this.children) {
      if (child && typeof child.update === 'function') child.update(dt, _camera);
    }
  }

  static _cacheByGl = new WeakMap();

  /**
   * @param {WebGLRenderingContext|WebGL2RenderingContext} gl
   * @returns {Map<string, import('./Mesh.js').default>}
   */
  static _getCache(gl) {
    let map = MeshNode._cacheByGl.get(gl);
    if (!map) {
      map = new Map();
      MeshNode._cacheByGl.set(gl, map);
    }
    return map;
  }

  /**
   * @param {import('./Renderer.js').default} renderer
   */
  _ensureMesh(renderer) {
    const gl = renderer?.gl;
    if (!gl) return;

    const def = this.meshDefinition;
    const type = (def?.type || def?.source || this.source || 'Cube');
    const params = def?.params || null;

    // Cache meshes by geometry only (materials/colors should not create new meshes).
    const key = JSON.stringify({ type, params });
    if (this._mesh && this._meshKey === key) return;

    const cache = MeshNode._getCache(gl);
    const cached = cache.get(key);
    if (cached) {
      this._mesh = cached;
      this._meshKey = key;
      return;
    }

    const mesh = MeshNode._createMeshFromType(gl, type, params);
    if (mesh) {
      cache.set(key, mesh);
      this._mesh = mesh;
      this._meshKey = key;
    }
  }

  /**
   * @param {WebGLRenderingContext|WebGL2RenderingContext} gl
   * @param {string} type
   * @param {any | null} params
   */
  static _createMeshFromType(gl, type, params) {
    const t = String(type || '').toLowerCase();
    const p = params || {};

    if (t === 'quad') {
      return Mesh.createQuad(gl, p.width ?? 1, p.height ?? 1);
    }
    if (t === 'triangle') {
      return Mesh.createTriangle(gl, p.size ?? 1);
    }
    if (t === 'plane') {
      return Mesh.createPlane(gl, p.width ?? 10, p.depth ?? 10, p.subdivisions ?? 1);
    }
    if (t === 'cube' || t === 'box') {
      return Mesh.createCube(gl, p.width ?? 2, p.height ?? 2, p.depth ?? 2);
    }
    if (t === 'sphere') {
      return Mesh.createSphere(gl, p.radius ?? 1, p.radialSegments ?? 24, p.heightSegments ?? 16);
    }
    if (t === 'cone') {
      return Mesh.createCone(gl, p.radius ?? 1, p.height ?? 2, p.radialSegments ?? 24);
    }
    if (t === 'capsule') {
      return Mesh.createCapsule(gl, p.radius ?? 0.5, p.height ?? 2, p.radialSegments ?? 24, p.capSegments ?? 8);
    }

    // Back-compat default
    if (t === 'coloredcube') {
      return Mesh.createColoredCube(gl);
    }

    // Unknown type: fallback to cube
    return Mesh.createCube(gl, 2, 2, 2);
  }

  /** @returns {Float32Array} */
  _getModelMatrix() {
    // Model = T * Rz * Ry * Rx * S
    Mat4.scaling(this.scaleX, this.scaleY, this.scaleZ, this._mS);
    Mat4.rotationX(this.rotX, this._mRx);
    Mat4.rotationY(this.rotY, this._mRy);
    Mat4.rotationZ(this.rotZ, this._mRz);
    Mat4.translation(this.x, this.y, this.z, this._mT);

    Mat4.multiply(this._mRx, this._mS, this._tmp0);
    Mat4.multiply(this._mRy, this._tmp0, this._tmp1);
    Mat4.multiply(this._mRz, this._tmp1, this._tmp2);
    Mat4.multiply(this._mT, this._tmp2, this._model);

    return this._model;
  }

  /**
   * Called by Scene during 3D pass.
   * @param {import('./Renderer.js').default} renderer
   */
  draw3D(renderer) {
    if (!this.active) return;
    this._ensureMesh(renderer);
    if (!this._mesh) return;

    // Prefer an explicit material if one is assigned, otherwise fall back to node color.
    let matToUse = this.material;
    if (!matToUse) {
      const defCol = this.meshDefinition?.color;
      const col = defCol || this.color || [1, 1, 1, 1];
      // Back-compat: current Material uses albedoColor; PBR upgrade adds baseColorFactor alias.
      this._defaultMaterial.albedoColor = col;
      matToUse = this._defaultMaterial;
    }

    renderer.drawMesh(this._mesh, this._getModelMatrix(), matToUse);

    // Draw child 3D nodes (if any)
    for (const child of this.children) {
      if (child && typeof child.draw3D === 'function') child.draw3D(renderer);
    }
  }
}
