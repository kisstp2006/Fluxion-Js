import { Mat4, Vector3 } from './Math3D.js';

/**
 * Minimal perspective camera for the 3D pass.
 * Groundwork: view/projection matrices (no controls yet).
 */
export default class Camera3D {
  constructor() {
    this.position = new Vector3(0, 0, 5);
    this.target = new Vector3(0, 0, 0);
    this.up = new Vector3(0, 1, 0);

    this.fovY = Math.PI / 3; // 60deg
    this.near = 0.1;
    this.far = 100.0;

    this._view = Mat4.identity();
    this._proj = Mat4.identity();
    this._viewProj = Mat4.identity();
    this._dirty = true;
  }

  /** Call when aspect changes */
  setPerspective(fovYRad, aspect, near = this.near, far = this.far) {
    this.fovY = fovYRad;
    this.near = near;
    this.far = far;
    this._proj = Mat4.perspective(this.fovY, aspect, this.near, this.far, this._proj);
    this._dirty = true;
  }

  lookAt(target) {
    this.target.x = target.x;
    this.target.y = target.y;
    this.target.z = target.z;
    this._dirty = true;
  }

  /** @returns {Float32Array} */
  getViewMatrix() {
    this._view = Mat4.lookAt(this.position, this.target, this.up, this._view);
    return this._view;
  }

  /** @returns {Float32Array} */
  getProjectionMatrix() {
    return this._proj;
  }

  /** @returns {Float32Array} */
  getViewProjectionMatrix() {
    if (this._dirty) {
      const view = this.getViewMatrix();
      this._viewProj = Mat4.multiply(this._proj, view, this._viewProj);
      this._dirty = false;
    }
    return this._viewProj;
  }
}
