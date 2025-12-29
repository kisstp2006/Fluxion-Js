/**
 * Minimal GPU mesh for the 3D pass.
 * Layout: position (vec3) + color (vec4) interleaved.
 */
export default class Mesh {
  /**
   * @param {WebGLRenderingContext|WebGL2RenderingContext} gl
   * @param {Float32Array} vertices interleaved [x,y,z,r,g,b,a]...
   * @param {Uint16Array|Uint32Array|null} indices
   */
  constructor(gl, vertices, indices = null) {
    this.gl = gl;
    this.vertices = vertices;
    this.indices = indices;

    this.vbo = gl.createBuffer();
    this.ibo = indices ? gl.createBuffer() : null;

    this.vao = null;
    this.indexType = null;
    this.indexCount = 0;
    this.vertexCount = 0;

    this._upload();
  }

  _upload() {
    const gl = this.gl;

    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, this.vertices, gl.STATIC_DRAW);

    this.vertexCount = (this.vertices.length / 7) | 0;

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
   * @param {number} colorLoc
   */
  bindLayout(positionLoc, colorLoc) {
    const gl = this.gl;

    if (typeof gl.createVertexArray === 'function') {
      if (!this.vao) {
        this.vao = gl.createVertexArray();
        gl.bindVertexArray(this.vao);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
        if (this.ibo) gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);

        const stride = 7 * 4;
        gl.enableVertexAttribArray(positionLoc);
        gl.vertexAttribPointer(positionLoc, 3, gl.FLOAT, false, stride, 0);

        gl.enableVertexAttribArray(colorLoc);
        gl.vertexAttribPointer(colorLoc, 4, gl.FLOAT, false, stride, 12);

        gl.bindVertexArray(null);
      }
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
    if (this.vao && typeof gl.deleteVertexArray === 'function') gl.deleteVertexArray(this.vao);
    if (this.ibo) gl.deleteBuffer(this.ibo);
    if (this.vbo) gl.deleteBuffer(this.vbo);
    this.vao = null;
    this.ibo = null;
    this.vbo = null;
  }

  /**
   * Convenience: colored cube centered at origin.
   * @param {WebGLRenderingContext|WebGL2RenderingContext} gl
   */
  static createColoredCube(gl) {
    // 8 unique vertices, but use indexed triangles.
    const v = new Float32Array([
      // x, y, z,   r, g, b, a
      -1, -1, -1,  1, 0, 0, 1,
       1, -1, -1,  0, 1, 0, 1,
       1,  1, -1,  0, 0, 1, 1,
      -1,  1, -1,  1, 1, 0, 1,
      -1, -1,  1,  1, 0, 1, 1,
       1, -1,  1,  0, 1, 1, 1,
       1,  1,  1,  1, 1, 1, 1,
      -1,  1,  1,  0.2, 0.2, 0.2, 1,
    ]);

    const i = new Uint16Array([
      // back
      0, 1, 2, 0, 2, 3,
      // front
      4, 6, 5, 4, 7, 6,
      // left
      4, 5, 1, 4, 1, 0,
      // right
      3, 2, 6, 3, 6, 7,
      // bottom
      4, 0, 3, 4, 3, 7,
      // top
      1, 5, 6, 1, 6, 2,
    ]);

    return new Mesh(gl, v, i);
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
    const [r, g, b, a] = color;

    const v = new Float32Array([
      -hw, -hh, 0, r, g, b, a,
       hw, -hh, 0, r, g, b, a,
       hw,  hh, 0, r, g, b, a,
      -hw,  hh, 0, r, g, b, a,
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
    const [r, g, b, a] = color;
    const v = new Float32Array([
      0,  s * 0.577, 0, r, g, b, a,
     -s * 0.5, -s * 0.289, 0, r, g, b, a,
      s * 0.5, -s * 0.289, 0, r, g, b, a,
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
    const [r, g, b, a] = color;

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
        verts.push(posX, 0, posZ, r, g, b, a);
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
    const idx = (v.length / 7 > 65535) ? new Uint32Array(indices) : new Uint16Array(indices);
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
    const [r, g, b, a] = color;

    // 8 vertices + indices (same topology as createColoredCube)
    const v = new Float32Array([
      -hw, -hh, -hd, r, g, b, a,
       hw, -hh, -hd, r, g, b, a,
       hw,  hh, -hd, r, g, b, a,
      -hw,  hh, -hd, r, g, b, a,
      -hw, -hh,  hd, r, g, b, a,
       hw, -hh,  hd, r, g, b, a,
       hw,  hh,  hd, r, g, b, a,
      -hw,  hh,  hd, r, g, b, a,
    ]);
    const i = new Uint16Array([
      0, 1, 2, 0, 2, 3,
      4, 6, 5, 4, 7, 6,
      4, 5, 1, 4, 1, 0,
      3, 2, 6, 3, 6, 7,
      4, 0, 3, 4, 3, 7,
      1, 5, 6, 1, 6, 2,
    ]);
    return new Mesh(gl, v, i);
  }

  /**
   * UV-less lat/long sphere.
   * @param {WebGLRenderingContext|WebGL2RenderingContext} gl
   * @param {number} [radius=1]
   * @param {number} [radialSegments=24]
   * @param {number} [heightSegments=16]
   * @param {[number,number,number,number]} [color=[1,1,1,1]]
   */
  static createSphere(gl, radius = 1, radialSegments = 24, heightSegments = 16, color = [1, 1, 1, 1]) {
    const rs = Math.max(3, radialSegments | 0);
    const hs = Math.max(2, heightSegments | 0);
    const [r, g, b, a] = color;

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
        verts.push(px, py, pz, r, g, b, a);
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
    const idx = (v.length / 7 > 65535) ? new Uint32Array(indices) : new Uint16Array(indices);
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
    const rs = Math.max(3, radialSegments | 0);
    const [r, g, b, a] = color;

    const verts = [];
    const indices = [];

    // Tip vertex
    const tipIndex = 0;
    verts.push(0, height, 0, r, g, b, a);

    // Base ring
    for (let i = 0; i < rs; i++) {
      const t = (i / rs) * Math.PI * 2;
      verts.push(Math.cos(t) * radius, 0, Math.sin(t) * radius, r, g, b, a);
    }

    // Base center
    const baseCenterIndex = 1 + rs;
    verts.push(0, 0, 0, r, g, b, a);

    // Side triangles
    for (let i = 0; i < rs; i++) {
      const aIdx = 1 + i;
      const bIdx = 1 + ((i + 1) % rs);
      indices.push(tipIndex, aIdx, bIdx);
    }

    // Base triangles (fan)
    for (let i = 0; i < rs; i++) {
      const aIdx = 1 + i;
      const bIdx = 1 + ((i + 1) % rs);
      indices.push(baseCenterIndex, bIdx, aIdx);
    }

    const v = new Float32Array(verts);
    const idx = (v.length / 7 > 65535) ? new Uint32Array(indices) : new Uint16Array(indices);
    return new Mesh(gl, v, idx);
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
    const rs = Math.max(3, radialSegments | 0);
    const cs = Math.max(2, capSegments | 0);
    const [r, g, b, a] = color;

    const cylinderHeight = Math.max(0, height - 2 * radius);
    const halfCyl = cylinderHeight * 0.5;

    const verts = [];
    const indices = [];

    // Helper to add a ring at given y with spherical latitude factor
    const addRing = (y, ringRadius) => {
      const startIndex = (verts.length / 7) | 0;
      for (let i = 0; i <= rs; i++) {
        const t = (i / rs) * Math.PI * 2;
        verts.push(Math.cos(t) * ringRadius, y, Math.sin(t) * ringRadius, r, g, b, a);
      }
      return startIndex;
    };

    // Build from top to bottom: top hemisphere, cylinder, bottom hemisphere
    const ringStarts = [];

    // Top hemisphere: from 0..cs (excluding pole ring duplication via small radius)
    for (let y = 0; y <= cs; y++) {
      const v = y / cs;
      const phi = v * (Math.PI / 2); // 0..pi/2
      const ringR = Math.cos(phi) * radius;
      const ringY = halfCyl + Math.sin(phi) * radius;
      ringStarts.push(addRing(ringY, ringR));
    }

    // Cylinder rings (skip if no cylinder)
    if (cylinderHeight > 0) {
      ringStarts.push(addRing(halfCyl, radius));
      ringStarts.push(addRing(-halfCyl, radius));
    }

    // Bottom hemisphere
    for (let y = cs; y >= 0; y--) {
      const v = y / cs;
      const phi = v * (Math.PI / 2);
      const ringR = Math.cos(phi) * radius;
      const ringY = -halfCyl - Math.sin(phi) * radius;
      ringStarts.push(addRing(ringY, ringR));
    }

    // Stitch rings
    const ringVertexCount = rs + 1;
    for (let ri = 0; ri < ringStarts.length - 1; ri++) {
      const aStart = ringStarts[ri];
      const bStart = ringStarts[ri + 1];
      for (let i = 0; i < rs; i++) {
        const i0 = aStart + i;
        const i1 = aStart + i + 1;
        const i2 = bStart + i;
        const i3 = bStart + i + 1;
        indices.push(i0, i2, i1, i1, i2, i3);
      }
    }

    const v = new Float32Array(verts);
    const vertCount = (v.length / 7) | 0;
    const idx = (vertCount > 65535) ? new Uint32Array(indices) : new Uint16Array(indices);
    return new Mesh(gl, v, idx);
  }
}
