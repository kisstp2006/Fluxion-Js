/**
 * Simple material format for 3D objects.
 * Current features: albedo color (RGBA floats or 0-255), optional albedo texture path.
 * .mat files are JSON with keys: albedoColor (string or array), albedoTexture (string path)
 */
export default class Material {
  constructor() {
    this.albedoColor = [1, 1, 1, 1];
    this.albedoTexturePath = null;
    /** @type {WebGLTexture|null} */
    this.albedoTexture = null;
  }

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
      if (data.albedoColor) {
        if (Array.isArray(data.albedoColor)) {
          // assume numeric array; convert 0..255 -> 0..1 if needed
          const max = Math.max(...data.albedoColor);
          if (max > 1) {
            mat.albedoColor = data.albedoColor.map((v) => (v / 255));
          } else {
            mat.albedoColor = data.albedoColor.slice(0, 4);
            if (mat.albedoColor.length < 4) mat.albedoColor[3] = 1;
          }
        } else if (typeof data.albedoColor === 'string') {
          // Accept hex like #RRGGBB[AA] or comma list
          const s = data.albedoColor.trim();
          if (s.startsWith('#')) {
            const hex = s.slice(1);
            if (hex.length === 6 || hex.length === 8) {
              const r = parseInt(hex.slice(0, 2), 16) / 255;
              const g = parseInt(hex.slice(2, 4), 16) / 255;
              const b = parseInt(hex.slice(4, 6), 16) / 255;
              const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
              mat.albedoColor = [r, g, b, a];
            }
          } else if (s.includes(',')) {
            const parts = s.split(',').map((p) => parseFloat(p.trim()));
            const max = Math.max(...parts);
            if (max > 1) {
              mat.albedoColor = parts.map((v) => v / 255);
            } else {
              mat.albedoColor = parts;
            }
            if (mat.albedoColor.length < 4) mat.albedoColor[3] = 1;
          }
        }
      }

      if (data.albedoTexture) {
        mat.albedoTexturePath = data.albedoTexture;

        // Load texture image relative to material URL
        if (renderer && typeof window !== 'undefined') {
          const base = new URL('.', url).toString();
          const texUrl = new URL(data.albedoTexture, base).toString();
          const img = await new Promise((resolve) => {
            const i = new Image();
            i.crossOrigin = 'anonymous';
            i.onload = () => resolve(i);
            i.onerror = () => resolve(null);
            i.src = texUrl;
          });
          if (img && renderer) {
            try {
              mat.albedoTexture = renderer.createTexture?.(img, texUrl) || null;
            } catch (e) {
              console.warn('Material: failed to create texture', texUrl, e);
            }
          }
        }
      }

      return mat;
    } catch (err) {
      console.error('Material.load error', err);
      return null;
    }
  }
}
