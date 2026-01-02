/**
 * Physically Based Rendering (PBR) material (metallic–roughness workflow).
 *
 * Supported texture maps:
 * - BaseColor / Albedo (sRGB)
 * - Metallic (linear grayscale, R)
 * - Roughness (linear grayscale, R)
 * - Normal (tangent-space, OpenGL +Y)
 * - Ambient Occlusion (linear grayscale, R; indirect only)
 * - Emissive (sRGB)
 * - Alpha (linear grayscale, R) + baseColor alpha
 *
 * Alpha modes:
 * - OPAQUE: fully opaque
 * - MASK: cutout using alphaCutoff
 * - BLEND: alpha blending (no guaranteed sorting)
 *
 * .mat files are JSON. Preferred keys:
 * - baseColorFactor: "#RRGGBB[AA]" | "r,g,b[,a]" | [r,g,b,a] (0..1 or 0..255)
 * - baseColorTexture: "path.png"
 * - metallicFactor: number (0..1)
 * - metallicTexture: "path.png"
 * - roughnessFactor: number (0..1)
 * - roughnessTexture: "path.png"
 * - normalTexture: "path.png"
 * - normalScale: number
 * - aoTexture: "path.png"
 * - aoStrength: number
 * - emissiveFactor: "#RRGGBB" | "r,g,b" | [r,g,b] (0..1 or 0..255)
 * - emissiveTexture: "path.png"
 * - alphaTexture: "path.png"
 * - alphaMode: "OPAQUE" | "MASK" | "BLEND"
 * - alphaCutoff: number (0..1)
 *
 * Backward-compatible keys:
 * - albedoColor -> baseColorFactor
 * - albedoTexture -> baseColorTexture
 */
export default class Material {
  constructor() {
    /** @type {[number,number,number,number]} linear RGBA */
    this.baseColorFactor = [1, 1, 1, 1];
    this.metallicFactor = 0.0;
    this.roughnessFactor = 1.0;
    this.normalScale = 1.0;
    this.aoStrength = 1.0;
    /** @type {[number,number,number]} linear RGB */
    this.emissiveFactor = [0, 0, 0];

    /** @type {'OPAQUE'|'MASK'|'BLEND'} */
    this.alphaMode = 'OPAQUE';
    this.alphaCutoff = 0.5;

    /** @type {WebGLTexture|null} */ this.baseColorTexture = null;
    /** @type {WebGLTexture|null} */ this.metallicTexture = null;
    /** @type {WebGLTexture|null} */ this.roughnessTexture = null;
    /** @type {WebGLTexture|null} */ this.normalTexture = null;
    /** @type {WebGLTexture|null} */ this.aoTexture = null;
    /** @type {WebGLTexture|null} */ this.emissiveTexture = null;
    /** @type {WebGLTexture|null} */ this.alphaTexture = null;

    // glTF commonly packs roughness (G) + metallic (B) into one texture.
    // When true, the renderer/shader will read roughness from G and metallic from B
    // (instead of reading both from the R channel).
    /** @type {boolean} */
    this.metallicRoughnessPacked = false;

    // Track acquired cache keys so we can release them.
    /** @type {Set<string>} */
    this._textureKeys = new Set();
    /** @type {import('./Renderer.js').default | null} */
    this._renderer = null;
  }

  // --- Backward compatible aliases (older engine code + scenes) ---
  /** @returns {[number,number,number,number]} */
  get albedoColor() { return this.baseColorFactor; }
  /** @param {any} v */
  set albedoColor(v) { this.baseColorFactor = Material._parseColor(v, this.baseColorFactor); }

  /** @returns {WebGLTexture|null} */
  get albedoTexture() { return this.baseColorTexture; }
  /** @param {WebGLTexture|null} t */
  set albedoTexture(t) { this.baseColorTexture = t; }

  /**
   * Load material from a .mat JSON file.
   * @param {string} url
   * @param {import('./Renderer.js').default} renderer
   */
  static async load(url, renderer) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to fetch material: ${url}`);
      const text = await res.text();

      // Try parse JSON
      let data = null;
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.warn('Material.parse: invalid JSON, ignoring', url);
        return null;
      }

      const mat = new Material();
      mat._renderer = renderer || null;

      // BaseColor / Albedo factor
      mat.baseColorFactor = Material._parseColor(
        data.baseColorFactor ?? data.baseColor ?? data.albedoColor,
        mat.baseColorFactor
      );

      // Metallic / Roughness factors
      mat.metallicFactor = Material._clamp(Material._parseNumber(data.metallicFactor ?? data.metallic, mat.metallicFactor), 0.0, 1.0);
      mat.roughnessFactor = Material._clamp(Material._parseNumber(data.roughnessFactor ?? data.roughness, mat.roughnessFactor), 0.04, 1.0);

      // Normal / AO
      mat.normalScale = Material._parseNumber(data.normalScale, mat.normalScale);
      mat.aoStrength = Material._parseNumber(data.aoStrength, mat.aoStrength);

      // Emissive
      mat.emissiveFactor = Material._parseVec3(data.emissiveFactor ?? data.emissive, mat.emissiveFactor);

      // Alpha
      mat.alphaMode = Material._parseAlphaMode(data.alphaMode ?? data.alpha);
      mat.alphaCutoff = Material._parseNumber(data.alphaCutoff, mat.alphaCutoff);

      // Resolve relative paths against the material URL
      const base = new URL('.', url).toString();
      const resolvePath = (p) => {
        if (!p || typeof p !== 'string') return null;
        try { return new URL(p, base).toString(); } catch { return p; }
      };

      // Textures (all optional)
      const texBaseColor = resolvePath(data.baseColorTexture ?? data.baseColorMap ?? data.albedoTexture);
      const texMetallic = resolvePath(data.metallicTexture ?? data.metallicMap);
      const texRoughness = resolvePath(data.roughnessTexture ?? data.roughnessMap);
      const texNormal = resolvePath(data.normalTexture ?? data.normalMap);
      const texAo = resolvePath(data.aoTexture ?? data.occlusionTexture ?? data.aoMap);
      const texEmissive = resolvePath(data.emissiveTexture ?? data.emissiveMap);
      const texAlpha = resolvePath(data.alphaTexture ?? data.alphaMap);

      // Load textures in parallel
      await Promise.all([
        Material._loadTexture(renderer, texBaseColor, mat, 'baseColorTexture'),
        Material._loadTexture(renderer, texMetallic, mat, 'metallicTexture'),
        Material._loadTexture(renderer, texRoughness, mat, 'roughnessTexture'),
        Material._loadTexture(renderer, texNormal, mat, 'normalTexture'),
        Material._loadTexture(renderer, texAo, mat, 'aoTexture'),
        Material._loadTexture(renderer, texEmissive, mat, 'emissiveTexture'),
        Material._loadTexture(renderer, texAlpha, mat, 'alphaTexture'),
      ]);

      return mat;
    } catch (err) {
      console.error('Material.load error', url, err);
      return null;
    }
  }

  /**
   * Release any acquired textures back to the renderer cache.
   * Safe to call multiple times.
   */
  dispose() {
    const r = this._renderer;
    if (r && typeof r.releaseTexture === 'function') {
      for (const key of this._textureKeys) {
        try { r.releaseTexture(key); } catch { /* ignore */ }
      }
    }
    this._textureKeys.clear();
    this.baseColorTexture = null;
    this.metallicTexture = null;
    this.roughnessTexture = null;
    this.normalTexture = null;
    this.aoTexture = null;
    this.emissiveTexture = null;
    this.alphaTexture = null;
  }

  // --- Parsing helpers ---

  static _parseNumber(v, fallback) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }

  static _clamp(x, min, max) {
    const n = Number(x);
    if (!Number.isFinite(n)) return min;
    return Math.min(max, Math.max(min, n));
  }

  static _parseAlphaMode(v) {
    const s = String(v || '').toUpperCase();
    if (s === 'MASK' || s === 'CUTOUT') return 'MASK';
    if (s === 'BLEND' || s === 'TRANSPARENT') return 'BLEND';
    return 'OPAQUE';
  }

  static _parseColor(v, fallback) {
    if (Array.isArray(v)) {
      const arr = v.map((x) => Number(x)).filter((x) => Number.isFinite(x));
      if (arr.length >= 3) {
        const a = arr.length >= 4 ? arr[3] : 1;
        const max = Math.max(arr[0], arr[1], arr[2], a);
        if (max > 1.0) {
          return [arr[0] / 255, arr[1] / 255, arr[2] / 255, a / 255];
        }
        return [arr[0], arr[1], arr[2], a];
      }
    }

    if (typeof v === 'string') {
      const s = v.trim();
      if (s.startsWith('#')) {
        const hex = s.slice(1);
        if (hex.length === 6 || hex.length === 8) {
          const r = parseInt(hex.slice(0, 2), 16) / 255;
          const g = parseInt(hex.slice(2, 4), 16) / 255;
          const b = parseInt(hex.slice(4, 6), 16) / 255;
          const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
          return [r, g, b, a];
        }
      }
      if (s.includes(',')) {
        const parts = s.split(',').map((p) => parseFloat(p.trim())).filter((n) => Number.isFinite(n));
        if (parts.length >= 3) {
          const a = parts.length >= 4 ? parts[3] : 1;
          const max = Math.max(parts[0], parts[1], parts[2], a);
          if (max > 1.0) return [parts[0] / 255, parts[1] / 255, parts[2] / 255, a / 255];
          return [parts[0], parts[1], parts[2], a];
        }
      }
    }

    return fallback || [1, 1, 1, 1];
  }

  static _parseVec3(v, fallback) {
    if (Array.isArray(v)) {
      const arr = v.map((x) => Number(x)).filter((x) => Number.isFinite(x));
      if (arr.length >= 3) {
        const max = Math.max(arr[0], arr[1], arr[2]);
        if (max > 1.0) return [arr[0] / 255, arr[1] / 255, arr[2] / 255];
        return [arr[0], arr[1], arr[2]];
      }
    }

    if (typeof v === 'string') {
      const s = v.trim();
      if (s.startsWith('#')) {
        const hex = s.slice(1);
        if (hex.length === 6 || hex.length === 8) {
          const r = parseInt(hex.slice(0, 2), 16) / 255;
          const g = parseInt(hex.slice(2, 4), 16) / 255;
          const b = parseInt(hex.slice(4, 6), 16) / 255;
          return [r, g, b];
        }
      }
      if (s.includes(',')) {
        const parts = s.split(',').map((p) => parseFloat(p.trim())).filter((n) => Number.isFinite(n));
        if (parts.length >= 3) {
          const max = Math.max(parts[0], parts[1], parts[2]);
          if (max > 1.0) return [parts[0] / 255, parts[1] / 255, parts[2] / 255];
          return [parts[0], parts[1], parts[2]];
        }
      }
    }

    return fallback || [0, 0, 0];
  }

  /**
   * @param {import('./Renderer.js').default} renderer
   * @param {string|null} texUrl
   * @param {Material} mat
   * @param {'baseColorTexture'|'metallicTexture'|'roughnessTexture'|'normalTexture'|'aoTexture'|'emissiveTexture'|'alphaTexture'} field
   */
  static async _loadTexture(renderer, texUrl, mat, field) {
    if (!renderer || !texUrl) return;

    // If cached, acquire immediately (refcount-aware).
    if (renderer.hasCachedTexture?.(texUrl)) {
      const tex = renderer.acquireTexture?.(texUrl) || renderer.getCachedTexture?.(texUrl);
      if (tex) {
        mat[field] = tex;
        mat._textureKeys.add(texUrl);
      }
      return;
    }

    const img = await new Promise((resolve) => {
      const i = new Image();
      i.crossOrigin = 'anonymous';
      i.onload = () => resolve(i);
      i.onerror = () => resolve(null);
      i.src = texUrl;
    });

    if (!img) return;

    try {
      const tex =
        renderer.createAndAcquireTexture?.(img, texUrl) ||
        renderer.createTexture?.(img, texUrl) ||
        null;
      if (tex) {
        mat[field] = tex;
        mat._textureKeys.add(texUrl);
      }
    } catch (e) {
      console.warn('Material: failed to create texture', texUrl, e);
    }
  }
}
