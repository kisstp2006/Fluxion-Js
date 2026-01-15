// @ts-check

/**
 * Minimal Fluxion project descriptor.
 *
 * This is intentionally small and JSON-friendly so it can be generated and
 * loaded in both browser and Electron contexts.
 */
export default class Project {
  /** @param {{ name?: string, creator?: string, resolution?: {width?: number, height?: number} | [number, number], engineVersion?: string, mainScene?: string }} [opts] */
  constructor(opts = {}) {
    /** @type {string} */
    this.name = String(opts.name ?? 'Fluxion Project');

    /** @type {string} */
    this.creator = String(opts.creator ?? '');

    /** @type {{ width: number, height: number }} */
    this.resolution = (() => {
      const r = /** @type {any} */ (opts.resolution);
      if (Array.isArray(r) && r.length >= 2) {
        const w = Number(r[0]) || 0;
        const h = Number(r[1]) || 0;
        return { width: w > 0 ? w : 1280, height: h > 0 ? h : 720 };
      }
      if (r && typeof r === 'object') {
        const w = Number(r.width) || 0;
        const h = Number(r.height) || 0;
        return { width: w > 0 ? w : 1280, height: h > 0 ? h : 720 };
      }
      return { width: 1280, height: 720 };
    })();

    /** @type {string} */
    this.engineVersion = String(opts.engineVersion ?? '');

    /** @type {string} */
    this.mainScene = String(opts.mainScene ?? './scene.xml');
  }

  /** @param {any} obj */
  static fromObject(obj) {
    const o = obj && typeof obj === 'object' ? obj : {};
    return new Project({
      name: o.name,
      creator: o.creator,
      resolution: o.resolution,
      engineVersion: o.engineVersion,
      mainScene: o.mainScene,
    });
  }

  /** @param {string} url */
  static async load(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to load project: ${url}`);
    const json = await res.json();
    return Project.fromObject(json);
  }

  toJSON() {
    return {
      name: this.name,
      creator: this.creator,
      resolution: this.resolution,
      engineVersion: this.engineVersion,
      mainScene: this.mainScene,
    };
  }
}
