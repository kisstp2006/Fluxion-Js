// @ts-check

/**
 * Minimal Fluxion project descriptor.
 *
 * This is intentionally small and JSON-friendly so it can be generated and
 * loaded in both browser and Electron contexts.
 */
export default class Project {
  /** @param {{ name?: string, mainScene?: string }} [opts] */
  constructor(opts = {}) {
    /** @type {string} */
    this.name = String(opts.name ?? 'Fluxion Project');
    /** @type {string} */
    this.mainScene = String(opts.mainScene ?? './scene.xml');
  }

  /** @param {any} obj */
  static fromObject(obj) {
    const o = obj && typeof obj === 'object' ? obj : {};
    return new Project({
      name: o.name,
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
      mainScene: this.mainScene,
    };
  }
}
