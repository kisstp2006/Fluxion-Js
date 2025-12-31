/**
 * Minimal GPU mesh for the 3D pass.
 * PBR Layout: position (vec3) + normal (vec3) + uv (vec2) interleaved.
 */
export default class Mesh {
  /**
   * @param {WebGLRenderingContext|WebGL2RenderingContext} gl
   * @param {Float32Array} vertices interleaved [x,y,z,nx,ny,nz,u,v]...
   * @param {Uint16Array|Uint32Array|null} indices
   */
  constructor(gl, vertices, indices = null) {
    this.gl = gl;
    this.vertices = vertices;
    this.indices = indices;

    this.vbo = gl.createBuffer();
    this.ibo = indices ? gl.createBuffer() : null;

    this.vao = null;
    this._vaoKey = '';
    /** @type {Map<string, WebGLVertexArrayObject>} */
    this._vaoByKey = new Map();
    this.indexType = null;
    this.indexCount = 0;
    this.vertexCount = 0;

    this._upload();
  }

  _upload() {
    const gl = this.gl;

    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, this.vertices, gl.STATIC_DRAW);

    this.vertexCount = (this.vertices.length / 8) | 0;

    if (this.indices && this.ibo) {
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.indices, gl.STATIC_DRAW);
      this.indexCount = this.indices.length | 0;

      if (this.indices instanceof Uint32Array) {
        this.indexType = gl.UNSIGNED_INT;
      } else {
        this.indexType = gl.UNSIGNED_SHORT;
      }
    }
  }

  /**
   * Bind vertex layout for a specific program.
   * @param {number} positionLoc
   * @param {number} normalLoc
   * @param {number} uvLoc
   */
  bindLayout(positionLoc, normalLoc, uvLoc) {
    const gl = this.gl;

    if (typeof gl.createVertexArray === 'function') {
      const key = `${positionLoc},${normalLoc},${uvLoc}`;
      const cachedVao = this._vaoByKey.get(key) || null;
      if (cachedVao) {
        this.vao = cachedVao;
        this._vaoKey = key;
        return;
      }

      const vao = gl.createVertexArray();
      this.vao = vao;
      this._vaoKey = key;
      this._vaoByKey.set(key, vao);
      gl.bindVertexArray(vao);

      gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
      if (this.ibo) gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);

      const stride = 8 * 4;

      // position (vec3)
      if (positionLoc >= 0) {
        gl.enableVertexAttribArray(positionLoc);
        gl.vertexAttribPointer(positionLoc, 3, gl.FLOAT, false, stride, 0);
      }

      // normal (vec3)
      if (normalLoc >= 0) {
        gl.enableVertexAttribArray(normalLoc);
        gl.vertexAttribPointer(normalLoc, 3, gl.FLOAT, false, stride, 12);
      }

      // uv (vec2)
      if (uvLoc >= 0) {
        gl.enableVertexAttribArray(uvLoc);
        gl.vertexAttribPointer(uvLoc, 2, gl.FLOAT, false, stride, 24);
      }

      gl.bindVertexArray(null);
    }
  }

  draw() {
    const gl = this.gl;

    if (this.vao && typeof gl.bindVertexArray === 'function') {
      gl.bindVertexArray(this.vao);
    } else {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
      if (this.ibo) gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);
    }

    if (this.ibo && this.indices) {
      gl.drawElements(gl.TRIANGLES, this.indexCount, this.indexType, 0);
    } else {
      gl.drawArrays(gl.TRIANGLES, 0, this.vertexCount);
    }

    if (this.vao && typeof gl.bindVertexArray === 'function') {
      gl.bindVertexArray(null);
    }
  }

  dispose() {
    const gl = this.gl;
    if (typeof gl.deleteVertexArray === 'function') {
      for (const vao of this._vaoByKey.values()) {
        if (vao) gl.deleteVertexArray(vao);
      }
    }
    if (this.ibo) gl.deleteBuffer(this.ibo);
    if (this.vbo) gl.deleteBuffer(this.vbo);
    this.vao = null;
    this.ibo = null;
    this.vbo = null;
    this._vaoByKey.clear();
  }

  /**
   * Convenience: cube centered at origin (legacy API name).
   * @param {WebGLRenderingContext|WebGL2RenderingContext} gl
   */
  static createColoredCube(gl) {
    return Mesh.createCube(gl, 2, 2, 2);
  }

  /**
   * 3D quad in XY plane (z=0), centered at origin.
   * @param {WebGLRenderingContext|WebGL2RenderingContext} gl
   * @param {number} [width=1]
   * @param {number} [height=1]
   * @param {[number,number,number,number]} [color=[1,1,1,1]]
   */
  static createQuad(gl, width = 1, height = 1, color = [1, 1, 1, 1]) {
    const hw = width * 0.5;
    const hh = height * 0.5;

    // XY quad facing +Z
    const v = new Float32Array([
      // x, y, z,    nx, ny, nz,   u, v
      -hw, -hh, 0,   0,  0,  1,    0, 0,
       hw, -hh, 0,   0,  0,  1,    1, 0,
       hw,  hh, 0,   0,  0,  1,    1, 1,
      -hw,  hh, 0,   0,  0,  1,    0, 1,
    ]);
    const i = new Uint16Array([
      0, 1, 2,
      0, 2, 3,
    ]);
    return new Mesh(gl, v, i);
  }

  /**
   * 3D triangle in XY plane (z=0), centered-ish.
   * @param {WebGLRenderingContext|WebGL2RenderingContext} gl
   * @param {number} [size=1]
   * @param {[number,number,number,number]} [color=[1,1,1,1]]
   */
  static createTriangle(gl, size = 1, color = [1, 1, 1, 1]) {
    const s = size;
    const v = new Float32Array([
      // x, y, z,    nx, ny, nz,   u, v
       0,  s * 0.577, 0,  0,  0,  1,   0.5, 1.0,
      -s * 0.5, -s * 0.289, 0,  0,  0,  1,   0.0, 0.0,
       s * 0.5, -s * 0.289, 0,  0,  0,  1,   1.0, 0.0,
    ]);
    return new Mesh(gl, v, null);
  }

  /**
   * Plane in XZ (y=0), centered at origin.
   * @param {WebGLRenderingContext|WebGL2RenderingContext} gl
   * @param {number} [width=10]
   * @param {number} [depth=10]
   * @param {number} [subdivisions=1]
   * @param {[number,number,number,number]} [color=[0.7,0.7,0.7,1]]
   */
  static createPlane(gl, width = 10, depth = 10, subdivisions = 1, color = [0.7, 0.7, 0.7, 1]) {
    const div = Math.max(1, subdivisions | 0);

    const verts = [];
    const indices = [];

    const halfW = width * 0.5;
    const halfD = depth * 0.5;

    for (let z = 0; z <= div; z++) {
      const tz = z / div;
      const posZ = -halfD + tz * depth;
      for (let x = 0; x <= div; x++) {
        const tx = x / div;
        const posX = -halfW + tx * width;
        // position (x,z) in XZ plane, normal +Y, UV in [0..1]
        verts.push(posX, 0, posZ, 0, 1, 0, tx, tz);
      }
    }

    const row = div + 1;
    for (let z = 0; z < div; z++) {
      for (let x = 0; x < div; x++) {
        const i0 = z * row + x;
        const i1 = i0 + 1;
        const i2 = i0 + row;
        const i3 = i2 + 1;
        indices.push(i0, i2, i1, i1, i2, i3);
      }
    }

    const v = new Float32Array(verts);
    const vertCount = (v.length / 8) | 0;
    const idx = (vertCount > 65535) ? new Uint32Array(indices) : new Uint16Array(indices);
    return new Mesh(gl, v, idx);
  }

  /**
   * Box/cube with dimensions, centered at origin.
   * @param {WebGLRenderingContext|WebGL2RenderingContext} gl
   * @param {number} [width=1]
   * @param {number} [height=1]
   * @param {number} [depth=1]
   * @param {[number,number,number,number]} [color=[1,1,1,1]]
   */
  static createCube(gl, width = 2, height = 2, depth = 2, color = [1, 1, 1, 1]) {
    const hw = width * 0.5;
    const hh = height * 0.5;
    const hd = depth * 0.5;

    // 24-vertex cube (4 verts per face) so normals/UVs are correct per face.
    /** @type {number[]} */
    const verts = [];
    /** @type {number[]} */
    const indices = [];

    const pushV = (x, y, z, nx, ny, nz, u, v) => {
      verts.push(x, y, z, nx, ny, nz, u, v);
    };

    const pushFace = (nx, ny, nz, v0, v1, v2, v3) => {
      const base = (verts.length / 8) | 0;
      // v0..v3 are [x,y,z]
      pushV(v0[0], v0[1], v0[2], nx, ny, nz, 0, 0);
      pushV(v1[0], v1[1], v1[2], nx, ny, nz, 1, 0);
      pushV(v2[0], v2[1], v2[2], nx, ny, nz, 1, 1);
      pushV(v3[0], v3[1], v3[2], nx, ny, nz, 0, 1);
      indices.push(
        base + 0, base + 1, base + 2,
        base + 0, base + 2, base + 3
      );
    };

    // +Z (front)
    pushFace(0, 0, 1,
      [-hw, -hh,  hd],
      [ hw, -hh,  hd],
      [ hw,  hh,  hd],
      [-hw,  hh,  hd]
    );
    // -Z (back)
    pushFace(0, 0, -1,
      [ hw, -hh, -hd],
      [-hw, -hh, -hd],
      [-hw,  hh, -hd],
      [ hw,  hh, -hd]
    );
    // +X (right)
    pushFace(1, 0, 0,
      [ hw, -hh,  hd],
      [ hw, -hh, -hd],
      [ hw,  hh, -hd],
      [ hw,  hh,  hd]
    );
    // -X (left)
    pushFace(-1, 0, 0,
      [-hw, -hh, -hd],
      [-hw, -hh,  hd],
      [-hw,  hh,  hd],
      [-hw,  hh, -hd]
    );
    // +Y (top)
    pushFace(0, 1, 0,
      [-hw,  hh,  hd],
      [ hw,  hh,  hd],
      [ hw,  hh, -hd],
      [-hw,  hh, -hd]
    );
    // -Y (bottom)
    pushFace(0, -1, 0,
      [-hw, -hh, -hd],
      [ hw, -hh, -hd],
      [ hw, -hh,  hd],
      [-hw, -hh,  hd]
    );

    const v = new Float32Array(verts);
    const idx = new Uint16Array(indices);
    return new Mesh(gl, v, idx);
  }

  /**
   * Lat/long sphere with normals and UVs.
   * @param {WebGLRenderingContext|WebGL2RenderingContext} gl
   * @param {number} [radius=1]
   * @param {number} [radialSegments=24]
   * @param {number} [heightSegments=16]
   */
  static createSphere(gl, radius = 1, radialSegments = 24, heightSegments = 16, color = [1, 1, 1, 1]) {
    const rs = Math.max(3, radialSegments | 0);
    const hs = Math.max(2, heightSegments | 0);

    const verts = [];
    const indices = [];

    for (let y = 0; y <= hs; y++) {
      const v = y / hs;
      const phi = v * Math.PI;
      const sinPhi = Math.sin(phi);
      const cosPhi = Math.cos(phi);

      for (let x = 0; x <= rs; x++) {
        const u = x / rs;
        const theta = u * Math.PI * 2;
        const sinTheta = Math.sin(theta);
        const cosTheta = Math.cos(theta);

        const px = radius * sinPhi * cosTheta;
        const py = radius * cosPhi;
        const pz = radius * sinPhi * sinTheta;
        // normal is position normalized
        const invLen = 1.0 / Math.max(1e-8, Math.hypot(px, py, pz));
        const nx = px * invLen;
        const ny = py * invLen;
        const nz = pz * invLen;
        // UV: u in [0..1], v flipped so 0 is top
        verts.push(px, py, pz, nx, ny, nz, u, 1.0 - v);
      }
    }

    const row = rs + 1;
    for (let y = 0; y < hs; y++) {
      for (let x = 0; x < rs; x++) {
        const i0 = y * row + x;
        const i1 = i0 + 1;
        const i2 = i0 + row;
        const i3 = i2 + 1;
        indices.push(i0, i2, i1, i1, i2, i3);
      }
    }

    const v = new Float32Array(verts);
    const vertCount = (v.length / 8) | 0;
    const idx = (vertCount > 65535) ? new Uint32Array(indices) : new Uint16Array(indices);
    return new Mesh(gl, v, idx);
  }

  /**
   * Cone along Y axis (base at y=0, tip at y=height).
   * @param {WebGLRenderingContext|WebGL2RenderingContext} gl
   * @param {number} [radius=1]
   * @param {number} [height=2]
   * @param {number} [radialSegments=24]
   * @param {[number,number,number,number]} [color=[1,1,1,1]]
   */
  static createCone(gl, radius = 1, height = 2, radialSegments = 24, color = [1, 1, 1, 1]) {
    // TODO: full cone with proper normals/UVs (kept simple for now)
    // Fallback to sphere so the engine never crashes when parsing scenes.
    return Mesh.createSphere(gl, radius, radialSegments, Math.max(2, (radialSegments * 0.66) | 0));
  }

  /**
   * Capsule along Y axis, centered at origin. Total height includes the caps.
   * @param {WebGLRenderingContext|WebGL2RenderingContext} gl
   * @param {number} [radius=0.5]
   * @param {number} [height=2]
   * @param {number} [radialSegments=24]
   * @param {number} [capSegments=8]
   * @param {[number,number,number,number]} [color=[1,1,1,1]]
   */
  static createCapsule(gl, radius = 0.5, height = 2, radialSegments = 24, capSegments = 8, color = [1, 1, 1, 1]) {
    // TODO: full capsule with proper normals/UVs (kept simple for now)
    // Fallback to sphere so the engine never crashes when parsing scenes.
    return Mesh.createSphere(gl, radius, radialSegments, Math.max(2, (radialSegments * 0.66) | 0));
  }
}
