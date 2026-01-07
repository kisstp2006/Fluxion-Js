/**
 * Minimal 3D math utilities (groundwork for 3D renderer).
 * Column-major matrices (WebGL-friendly).
 */

export class Vector3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  set(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }

  copy() {
    return new Vector3(this.x, this.y, this.z);
  }

  /** @returns {number} */
  length() {
    return Math.hypot(this.x, this.y, this.z);
  }

  /** @returns {number} */
  lengthSq() {
    return this.x * this.x + this.y * this.y + this.z * this.z;
  }

  /**
   * @param {Vector3} v
   */
  add(v) {
    this.x += v.x;
    this.y += v.y;
    this.z += v.z;
    return this;
  }

  /**
   * @param {Vector3} v
   */
  subtract(v) {
    this.x -= v.x;
    this.y -= v.y;
    this.z -= v.z;
    return this;
  }

  /**
   * @param {number} s
   */
  scale(s) {
    this.x *= s;
    this.y *= s;
    this.z *= s;
    return this;
  }

  /**
   * Linear interpolation towards b.
   * @param {Vector3} b
   * @param {number} t
   */
  lerp(b, t) {
    this.x += (b.x - this.x) * t;
    this.y += (b.y - this.y) * t;
    this.z += (b.z - this.z) * t;
    return this;
  }

  /**
   * @param {Vector3} a
   * @param {Vector3} b
   */
  static add(a, b) {
    return new Vector3(a.x + b.x, a.y + b.y, a.z + b.z);
  }

  /**
   * @param {Vector3} a
   * @param {Vector3} b
   * @returns {number}
   */
  static distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
  }

  /**
   * @param {Vector3} a
   * @param {Vector3} b
   * @returns {number}
   */
  static distanceSq(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = a.z - b.z;
    return dx * dx + dy * dy + dz * dz;
  }

  /**
   * @param {Vector3} a
   * @param {Vector3} b
   * @param {number} t
   */
  static lerp(a, b, t) {
    return new Vector3(
      a.x + (b.x - a.x) * t,
      a.y + (b.y - a.y) * t,
      a.z + (b.z - a.z) * t
    );
  }

  /**
   * @param {number[]} arr
   * @param {number} [offset=0]
   */
  static fromArray(arr, offset = 0) {
    return new Vector3(arr[offset] || 0, arr[offset + 1] || 0, arr[offset + 2] || 0);
  }

  /** @returns {number[]} */
  toArray() {
    return [this.x, this.y, this.z];
  }

  static subtract(a, b) {
    return new Vector3(a.x - b.x, a.y - b.y, a.z - b.z);
  }

  static cross(a, b) {
    return new Vector3(
      a.y * b.z - a.z * b.y,
      a.z * b.x - a.x * b.z,
      a.x * b.y - a.y * b.x
    );
  }

  static dot(a, b) {
    return a.x * b.x + a.y * b.y + a.z * b.z;
  }

  normalize() {
    const len = Math.hypot(this.x, this.y, this.z);
    if (len > 0) {
      this.x /= len;
      this.y /= len;
      this.z /= len;
    }
    return this;
  }
}

export class Mat4 {
  /** @returns {Float32Array} */
  static identity() {
    const m = new Float32Array(16);
    m[0] = 1;
    m[5] = 1;
    m[10] = 1;
    m[15] = 1;
    return m;
  }

  /** out = a * b */
  static multiply(a, b, out = new Float32Array(16)) {
    const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
    const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
    const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
    const a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];

    let b0, b1, b2, b3;

    b0 = b[0]; b1 = b[1]; b2 = b[2]; b3 = b[3];
    out[0] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
    out[1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    out[2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
    out[3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

    b0 = b[4]; b1 = b[5]; b2 = b[6]; b3 = b[7];
    out[4] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
    out[5] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    out[6] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
    out[7] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

    b0 = b[8]; b1 = b[9]; b2 = b[10]; b3 = b[11];
    out[8] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
    out[9] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    out[10] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
    out[11] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

    b0 = b[12]; b1 = b[13]; b2 = b[14]; b3 = b[15];
    out[12] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
    out[13] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    out[14] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
    out[15] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

    return out;
  }

  /** @param {Float32Array} m */
  static copy(m, out = new Float32Array(16)) {
    out.set(m);
    return out;
  }

  /**
   * Transpose matrix.
   * @param {Float32Array} m
   */
  static transpose(m, out = new Float32Array(16)) {
    if (out === m) {
      const a01 = m[1], a02 = m[2], a03 = m[3];
      const a12 = m[6], a13 = m[7];
      const a23 = m[11];
      out[1] = m[4];
      out[2] = m[8];
      out[3] = m[12];
      out[4] = a01;
      out[6] = m[9];
      out[7] = m[13];
      out[8] = a02;
      out[9] = a12;
      out[11] = m[14];
      out[12] = a03;
      out[13] = a13;
      out[14] = a23;
      return out;
    }

    out[0] = m[0];
    out[1] = m[4];
    out[2] = m[8];
    out[3] = m[12];
    out[4] = m[1];
    out[5] = m[5];
    out[6] = m[9];
    out[7] = m[13];
    out[8] = m[2];
    out[9] = m[6];
    out[10] = m[10];
    out[11] = m[14];
    out[12] = m[3];
    out[13] = m[7];
    out[14] = m[11];
    out[15] = m[15];
    return out;
  }

  /**
   * Invert matrix. Returns null if not invertible.
   * @param {Float32Array} m
   */
  static invert(m, out = new Float32Array(16)) {
    const a00 = m[0], a01 = m[1], a02 = m[2], a03 = m[3];
    const a10 = m[4], a11 = m[5], a12 = m[6], a13 = m[7];
    const a20 = m[8], a21 = m[9], a22 = m[10], a23 = m[11];
    const a30 = m[12], a31 = m[13], a32 = m[14], a33 = m[15];

    const b00 = a00 * a11 - a01 * a10;
    const b01 = a00 * a12 - a02 * a10;
    const b02 = a00 * a13 - a03 * a10;
    const b03 = a01 * a12 - a02 * a11;
    const b04 = a01 * a13 - a03 * a11;
    const b05 = a02 * a13 - a03 * a12;
    const b06 = a20 * a31 - a21 * a30;
    const b07 = a20 * a32 - a22 * a30;
    const b08 = a20 * a33 - a23 * a30;
    const b09 = a21 * a32 - a22 * a31;
    const b10 = a21 * a33 - a23 * a31;
    const b11 = a22 * a33 - a23 * a32;

    // Determinant
    let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
    if (!det) return null;
    det = 1.0 / det;

    out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
    out[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
    out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
    out[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
    out[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
    out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
    out[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
    out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
    out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
    out[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
    out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
    out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
    out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
    out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
    out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
    out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
    return out;
  }

  static translation(tx, ty, tz, out = Mat4.identity()) {
    out[12] = tx;
    out[13] = ty;
    out[14] = tz;
    return out;
  }

  static rotationY(rad, out = Mat4.identity()) {
    const c = Math.cos(rad);
    const s = Math.sin(rad);
    out[0] = c;
    out[2] = -s;
    out[8] = s;
    out[10] = c;
    return out;
  }

  /**
   * Orthographic projection.
   * @param {number} left
   * @param {number} right
   * @param {number} bottom
   * @param {number} top
   * @param {number} near
   * @param {number} far
   */
  static ortho(left, right, bottom, top, near, far, out = new Float32Array(16)) {
    const lr = 1 / (left - right);
    const bt = 1 / (bottom - top);
    const nf = 1 / (near - far);

    out[0] = -2 * lr;
    out[1] = 0;
    out[2] = 0;
    out[3] = 0;

    out[4] = 0;
    out[5] = -2 * bt;
    out[6] = 0;
    out[7] = 0;

    out[8] = 0;
    out[9] = 0;
    out[10] = 2 * nf;
    out[11] = 0;

    out[12] = (left + right) * lr;
    out[13] = (top + bottom) * bt;
    out[14] = (far + near) * nf;
    out[15] = 1;

    return out;
  }

  /**
   * Compose a transform matrix from translation, Euler rotation (XYZ), and scale.
   * This is a convenience wrapper around existing helpers, using the engine's Mat4.multiply.
   * @param {Vector3} position
   * @param {Vector3} rotationEulerRad
   * @param {Vector3} scale
   */
  static composeTRS(position, rotationEulerRad, scale, out = Mat4.identity()) {
    // out = T * Rz * Ry * Rx * S
    const s = Mat4.scaling(scale.x, scale.y, scale.z, Mat4.identity());
    const rx = Mat4.rotationX(rotationEulerRad.x, Mat4.identity());
    const ry = Mat4.rotationY(rotationEulerRad.y, Mat4.identity());
    const rz = Mat4.rotationZ(rotationEulerRad.z, Mat4.identity());
    const t = Mat4.translation(position.x, position.y, position.z, Mat4.identity());

    const tmp0 = Mat4.multiply(rx, s, new Float32Array(16));
    const tmp1 = Mat4.multiply(ry, tmp0, new Float32Array(16));
    const tmp2 = Mat4.multiply(rz, tmp1, new Float32Array(16));
    Mat4.multiply(t, tmp2, out);
    return out;
  }

  /**
   * Transform a point (assumes w=1).
   * @param {Float32Array} m
   * @param {Vector3} v
   */
  static transformPoint(m, v, out = new Vector3()) {
    const x = v.x, y = v.y, z = v.z;
    const rx = m[0] * x + m[4] * y + m[8] * z + m[12];
    const ry = m[1] * x + m[5] * y + m[9] * z + m[13];
    const rz = m[2] * x + m[6] * y + m[10] * z + m[14];
    const rw = m[3] * x + m[7] * y + m[11] * z + m[15];
    if (rw && rw !== 1) {
      out.x = rx / rw;
      out.y = ry / rw;
      out.z = rz / rw;
    } else {
      out.x = rx;
      out.y = ry;
      out.z = rz;
    }
    return out;
  }

  /**
   * Transform a direction vector (assumes w=0, ignores translation).
   * @param {Float32Array} m
   * @param {Vector3} v
   */
  static transformVector(m, v, out = new Vector3()) {
    const x = v.x, y = v.y, z = v.z;
    out.x = m[0] * x + m[4] * y + m[8] * z;
    out.y = m[1] * x + m[5] * y + m[9] * z;
    out.z = m[2] * x + m[6] * y + m[10] * z;
    return out;
  }

  static rotationX(rad, out = Mat4.identity()) {
    const c = Math.cos(rad);
    const s = Math.sin(rad);
    out[5] = c;
    out[6] = s;
    out[9] = -s;
    out[10] = c;
    return out;
  }

  static rotationZ(rad, out = Mat4.identity()) {
    const c = Math.cos(rad);
    const s = Math.sin(rad);
    out[0] = c;
    out[1] = s;
    out[4] = -s;
    out[5] = c;
    return out;
  }

  static scaling(sx, sy, sz, out = Mat4.identity()) {
    out[0] = sx;
    out[5] = sy;
    out[10] = sz;
    return out;
  }

  static perspective(fovYRad, aspect, near, far, out = new Float32Array(16)) {
    const f = 1.0 / Math.tan(fovYRad * 0.5);

    out[0] = f / aspect;
    out[1] = 0;
    out[2] = 0;
    out[3] = 0;

    out[4] = 0;
    out[5] = f;
    out[6] = 0;
    out[7] = 0;

    out[8] = 0;
    out[9] = 0;
    out[11] = -1;

    out[12] = 0;
    out[13] = 0;
    out[15] = 0;

    if (far != null && far !== Infinity) {
      const nf = 1 / (near - far);
      out[10] = (far + near) * nf;
      out[14] = (2 * far * near) * nf;
    } else {
      out[10] = -1;
      out[14] = -2 * near;
    }

    return out;
  }

  static lookAt(eye, target, up, out = new Float32Array(16)) {
    const z = Vector3.subtract(eye, target).normalize();
    const x = Vector3.cross(up, z).normalize();
    const y = Vector3.cross(z, x);

    out[0] = x.x; out[1] = y.x; out[2] = z.x; out[3] = 0;
    out[4] = x.y; out[5] = y.y; out[6] = z.y; out[7] = 0;
    out[8] = x.z; out[9] = y.z; out[10] = z.z; out[11] = 0;
    out[12] = -Vector3.dot(x, eye);
    out[13] = -Vector3.dot(y, eye);
    out[14] = -Vector3.dot(z, eye);
    out[15] = 1;

    return out;
  }
}
