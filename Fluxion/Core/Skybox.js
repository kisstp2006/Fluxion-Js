import { Mat4 } from './Math3D.js';
import Mesh from './Mesh.js';

/**
 * Skybox class for rendering environment backgrounds in 3D scenes.
 * Supports cubemap (6 images), equirectangular formats, and solid colors.
 */
export default class Skybox {
  /**
   * Creates an instance of Skybox.
   * @param {WebGLRenderingContext|WebGL2RenderingContext} gl - The WebGL context.
   * @param {string|string[]|HTMLImageElement|HTMLImageElement[]|number[]} source - 
   *   Cubemap: Array of 6 image URLs/paths in order [right, left, top, bottom, front, back]
   *   Equirectangular: Single image URL/path or HTMLImageElement
   *   Solid Color: Array of 3 or 4 numbers [r, g, b] or [r, g, b, a] (0-1 range)
   * @param {boolean} [isEquirectangular=false] - Whether the source is equirectangular.
   */
  constructor(gl, source, isEquirectangular = false) {
    /** @type {'2D'|'3D'} */
    this.type = '3D';
    /** @type {string} */
    this.category = 'visual';

    this.gl = gl;
    this.cubemapTexture = null;
    this.isEquirectangular = isEquirectangular;

    // Best-effort metadata for editor tooling / round-tripping.
    /** @type {'color'|'equirectangular'|'cubemap'|'unknown'} */
    this._sourceKind = 'unknown';
    /** @type {any} */
    this._sourceValue = null;
    this._mesh = null;
    this._loaded = false;
    // For environment reflections (roughness LOD)
    this._size = 1;
    this._maxLod = 0;
    
    // Create skybox mesh (large cube)
    this._createSkyboxMesh();
    
    // Check if source is a solid color (array of numbers)
    if (Array.isArray(source) && source.length >= 3 && typeof source[0] === 'number') {
      this._sourceKind = 'color';
      this._sourceValue = Array.isArray(source) ? source.slice(0, 4) : source;
      this._loadSolidColor(source);
    } else if (isEquirectangular) {
      this._sourceKind = 'equirectangular';
      this._sourceValue = source;
      this._loadEquirectangular(source);
    } else {
      // Expecting a cubemap face array.
      if (Array.isArray(source) && source.length === 6) {
        this._sourceKind = 'cubemap';
        this._sourceValue = source.slice(0, 6);
      }
      this._loadCubemap(source);
    }
  }

  /**
   * Best-effort original source metadata (useful for editors).
   * @returns {{ kind: 'color', color: number[] } | { kind: 'equirectangular', source: any, isEquirectangular: true } | { kind: 'cubemap', faces: any[] } | { kind: 'unknown' }}
   */
  getSourceSpec() {
    if (this._sourceKind === 'color') {
      return { kind: 'color', color: Array.isArray(this._sourceValue) ? this._sourceValue : [] };
    }
    if (this._sourceKind === 'equirectangular') {
      return { kind: 'equirectangular', source: this._sourceValue, isEquirectangular: true };
    }
    if (this._sourceKind === 'cubemap') {
      return { kind: 'cubemap', faces: Array.isArray(this._sourceValue) ? this._sourceValue : [] };
    }
    return { kind: 'unknown' };
  }

  /**
   * Creates a large cube mesh for the skybox.
   * @private
   */
  _createSkyboxMesh() {
    // Cube centered at origin. We only use position in the skybox shader,
    // but the engine's Mesh layout is PBR (pos+normal+uv), so we reuse createCube.
    this._mesh = Mesh.createCube(this.gl, 2, 2, 2);
  }

  /**
   * Loads a solid color skybox.
   * @param {number[]} color - Array of 3 or 4 numbers [r, g, b] or [r, g, b, a] (0-1 range).
   * @private
   */
  _loadSolidColor(color) {
    const gl = this.gl;
    
    // Normalize color to [r, g, b, a] format
    const r = Math.max(0, Math.min(1, color[0] || 0));
    const g = Math.max(0, Math.min(1, color[1] || 0));
    const b = Math.max(0, Math.min(1, color[2] || 0));
    const a = color.length >= 4 ? Math.max(0, Math.min(1, color[3])) : 1.0;
    
    // Convert to 0-255 range
    const r255 = Math.floor(r * 255);
    const g255 = Math.floor(g * 255);
    const b255 = Math.floor(b * 255);
    const a255 = Math.floor(a * 255);
    
    // Create a 1x1 pixel canvas with the solid color
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = `rgba(${r255}, ${g255}, ${b255}, ${a255})`;
    ctx.fillRect(0, 0, 1, 1);
    
    // Create cubemap texture
    this.cubemapTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, this.cubemapTexture);
    
    // Upload the same color to all 6 faces
    const faces = [
      gl.TEXTURE_CUBE_MAP_POSITIVE_X, // right
      gl.TEXTURE_CUBE_MAP_NEGATIVE_X, // left
      gl.TEXTURE_CUBE_MAP_POSITIVE_Y, // top
      gl.TEXTURE_CUBE_MAP_NEGATIVE_Y, // bottom
      gl.TEXTURE_CUBE_MAP_POSITIVE_Z, // front
      gl.TEXTURE_CUBE_MAP_NEGATIVE_Z, // back
    ];
    
    for (const face of faces) {
      gl.texImage2D(face, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
    }
    
    // Set texture parameters
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
    
    // Generate mipmaps so roughness-based reflections can use LOD.
    gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, null);

    this._size = 1;
    this._maxLod = 0;
    this._loaded = true;
  }

  /**
   * Loads a cubemap from 6 images.
   * @param {string[]|HTMLImageElement[]} sources - Array of 6 image sources.
   * @private
   */
  async _loadCubemap(sources) {
    if (!Array.isArray(sources) || sources.length !== 6) {
      throw new Error('Cubemap requires exactly 6 images: [right, left, top, bottom, front, back]');
    }

    const gl = this.gl;
    const faces = [
      gl.TEXTURE_CUBE_MAP_POSITIVE_X, // right
      gl.TEXTURE_CUBE_MAP_NEGATIVE_X, // left
      gl.TEXTURE_CUBE_MAP_POSITIVE_Y, // top
      gl.TEXTURE_CUBE_MAP_NEGATIVE_Y, // bottom
      gl.TEXTURE_CUBE_MAP_POSITIVE_Z, // front
      gl.TEXTURE_CUBE_MAP_NEGATIVE_Z, // back
    ];

    // Create cubemap texture
    this.cubemapTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, this.cubemapTexture);

    // Load each face
    const loadPromises = sources.map((src, index) => {
      return new Promise((resolve, reject) => {
        const img = src instanceof HTMLImageElement ? src : new Image();
        
        if (src instanceof HTMLImageElement) {
          this._uploadCubemapFace(faces[index], img);
          resolve();
        } else {
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            this._uploadCubemapFace(faces[index], img);
            resolve();
          };
          img.onerror = () => reject(new Error(`Failed to load cubemap face ${index}: ${src}`));
          img.src = src;
        }
      });
    });

    try {
      await Promise.all(loadPromises);

      // Store size from first face if possible (used for env LOD)
      const first = sources[0];
      const w = (first && typeof first === 'object' && 'width' in first) ? first.width : 0;
      this._size = (w && Number.isFinite(w)) ? w : (this._size || 1);
      this._maxLod = Math.max(0, Math.floor(Math.log2(Math.max(1, this._size))) );
      
      // Set texture parameters
      gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);

      // Generate mipmaps so roughness-based reflections can use LOD.
      gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
      
      gl.bindTexture(gl.TEXTURE_CUBE_MAP, null);
      this._loaded = true;
    } catch (error) {
      console.error('Failed to load cubemap:', error);
      if (this.cubemapTexture) {
        gl.deleteTexture(this.cubemapTexture);
        this.cubemapTexture = null;
      }
      throw error;
    }
  }

  /**
   * Uploads a single face to the cubemap texture.
   * @private
   */
  _uploadCubemapFace(face, image) {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, this.cubemapTexture);
    gl.texImage2D(face, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
  }

  /**
   * Loads an equirectangular image and converts it to a cubemap.
   * Uses proper equirectangular to cubemap projection.
   * @param {string|HTMLImageElement} source - Equirectangular image source.
   * @private
   */
  async _loadEquirectangular(source) {
    const img = source instanceof HTMLImageElement ? source : await this._loadImage(source);
    
    const gl = this.gl;
    // Use a reasonable cubemap size (power of 2 for best compatibility)
    const size = 512; // Can be adjusted (256, 512, 1024, etc.)
    
    this.cubemapTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, this.cubemapTexture);
    
    // Create source canvas for sampling
    const sourceCanvas = document.createElement('canvas');
    sourceCanvas.width = img.width;
    sourceCanvas.height = img.height;
    const sourceCtx = sourceCanvas.getContext('2d');
    sourceCtx.drawImage(img, 0, 0);
    const sourceImageData = sourceCtx.getImageData(0, 0, img.width, img.height);
    
    // Create output canvas for each face
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const imageData = ctx.createImageData(size, size);
    
    const glFaces = [
      gl.TEXTURE_CUBE_MAP_POSITIVE_X, // right (+X)
      gl.TEXTURE_CUBE_MAP_NEGATIVE_X, // left (-X)
      // NOTE: Our skybox sampling convention expects +Y/-Y swapped compared
      // to the naive equirect->cubemap assignment (otherwise top/bottom appear flipped).
      gl.TEXTURE_CUBE_MAP_NEGATIVE_Y, // top (+Y)
      gl.TEXTURE_CUBE_MAP_POSITIVE_Y, // bottom (-Y)
      gl.TEXTURE_CUBE_MAP_POSITIVE_Z, // front (+Z)
      gl.TEXTURE_CUBE_MAP_NEGATIVE_Z, // back (-Z)
    ];
    
    // Convert equirectangular to cubemap faces using proper projection
    for (let face = 0; face < 6; face++) {
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          // Convert cubemap face coordinates to 3D direction
          const dir = this._cubemapFaceToDirection(face, x, y, size);
          
          // Convert 3D direction to equirectangular UV coordinates
          const uv = this._directionToEquirectangularUV(dir);
          
          // Sample from equirectangular image
          const imgX = Math.floor(uv.u * img.width) % img.width;
          const imgY = Math.floor(uv.v * img.height) % img.height;
          
          // Get pixel from source image
          const srcIdx = (imgY * img.width + imgX) * 4;
          
          // Write to cubemap face
          const idx = (y * size + x) * 4;
          imageData.data[idx] = sourceImageData.data[srcIdx];         // R
          imageData.data[idx + 1] = sourceImageData.data[srcIdx + 1]; // G
          imageData.data[idx + 2] = sourceImageData.data[srcIdx + 2]; // B
          imageData.data[idx + 3] = sourceImageData.data[srcIdx + 3]; // A
        }
      }
      
      ctx.putImageData(imageData, 0, 0);
      gl.texImage2D(glFaces[face], 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
    }
    
    // Set texture parameters
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
    
    // Generate mipmaps so roughness-based reflections can use LOD.
    gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, null);

    this._size = size;
    this._maxLod = Math.max(0, Math.floor(Math.log2(Math.max(1, size))) );
    this._loaded = true;
  }

  /**
   * Maximum cubemap mip LOD usable for roughness-based sampling.
   * @returns {number}
   */
  getMaxLod() {
    return this._maxLod || 0;
  }

  /**
   * Converts cubemap face coordinates to 3D direction vector.
   * @private
   */
  _cubemapFaceToDirection(face, x, y, size) {
    // Normalize coordinates to [-1, 1]
    const u = (2.0 * x / size) - 1.0;
    const v = 1.0 - (2.0 * y / size); // Flip Y
    
    let dir = { x: 0, y: 0, z: 0 };
    
    switch (face) {
      case 0: // +X (right)
        dir = { x: 1, y: -v, z: -u };
        break;
      case 1: // -X (left)
        dir = { x: -1, y: -v, z: u };
        break;
      case 2: // +Y (top)
        dir = { x: u, y: 1, z: v };
        break;
      case 3: // -Y (bottom)
        dir = { x: u, y: -1, z: -v };
        break;
      case 4: // +Z (front)
        dir = { x: u, y: -v, z: 1 };
        break;
      case 5: // -Z (back)
        dir = { x: -u, y: -v, z: -1 };
        break;
    }
    
    // Normalize
    const len = Math.sqrt(dir.x * dir.x + dir.y * dir.y + dir.z * dir.z);
    return { x: dir.x / len, y: dir.y / len, z: dir.z / len };
  }

  /**
   * Converts 3D direction to equirectangular UV coordinates.
   * @private
   */
  _directionToEquirectangularUV(dir) {
    const u = 0.5 + Math.atan2(dir.z, dir.x) / (2 * Math.PI);
    // NOTE: The engine's skybox sampling convention effectively flips Y compared to
    // the naive equirectangular mapping, so we flip V here to avoid an upside-down panorama.
    const v = 0.5 + Math.asin(dir.y) / Math.PI;
    return { u, v };
  }

  /**
   * Loads an image from a URL.
   * @private
   */
  _loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
      img.src = src;
    });
  }

  /**
   * Checks if the skybox is loaded and ready.
   * @returns {boolean}
   */
  isLoaded() {
    return this._loaded && this.cubemapTexture !== null;
  }

  /**
   * Disposes the skybox resources.
   */
  dispose() {
    if (this.cubemapTexture) {
      this.gl.deleteTexture(this.cubemapTexture);
      this.cubemapTexture = null;
    }
    if (this._mesh) {
      this._mesh.dispose();
      this._mesh = null;
    }
    this._loaded = false;
  }
}

