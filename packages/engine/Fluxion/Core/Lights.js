import { Vector3 } from './Math3D.js';

export const LightType = Object.freeze({
  Directional: 0,
  Point: 1,
  Spot: 2,
});

const _toVec3 = (v, fallback) => {
  if (!v) return fallback;
  if (Array.isArray(v) && v.length >= 3) return [Number(v[0]) || 0, Number(v[1]) || 0, Number(v[2]) || 0];
  if (typeof v === 'object') {
    return [Number(v.x) || 0, Number(v.y) || 0, Number(v.z) || 0];
  }
  return fallback;
};

const _norm3 = (v) => {
  const x = Number(v[0]) || 0;
  const y = Number(v[1]) || 0;
  const z = Number(v[2]) || 0;
  const len = Math.hypot(x, y, z) || 1;
  return [x / len, y / len, z / len];
};

/**
 * Directional (sun-like) light.
 * `direction` is the direction light rays travel (world space).
 */
export class DirectionalLight {
  /**
   * @param {{direction?: any, color?: any, intensity?: number, name?: string}=} opts
   */
  constructor(opts = {}) {
    this.isLight = true;
    /** @type {'2D'|'3D'} */
    this.nodeType = '3D';
    /** @type {string} */
    this.category = 'light';
    this.type = LightType.Directional;
    this.name = opts.name || 'DirectionalLight';
    this.direction = _norm3(_toVec3(opts.direction, [0.5, -1, 0.3]));
    this.color = _toVec3(opts.color, [1, 1, 1]);
    this.intensity = Number.isFinite(opts.intensity) ? opts.intensity : 1.0;
  }
}

/**
 * Point light with inverse-square attenuation.
 */
export class PointLight {
  /**
   * @param {{position?: any, color?: any, intensity?: number, range?: number, name?: string}=} opts
   */
  constructor(opts = {}) {
    this.isLight = true;
    /** @type {'2D'|'3D'} */
    this.nodeType = '3D';
    /** @type {string} */
    this.category = 'light';
    this.type = LightType.Point;
    this.name = opts.name || 'PointLight';
    // Match directional-light behavior: shadows work out-of-the-box.
    // Scenes can explicitly disable with castsShadow="false".
    this.castsShadow = true;
    this.position = _toVec3(opts.position, [0, 2, 0]);
    this.color = _toVec3(opts.color, [1, 1, 1]);
    // Intensity is a scalar multiplier (physically-inspired when combined with 1/r^2).
    this.intensity = Number.isFinite(opts.intensity) ? opts.intensity : 50.0;
    // Optional soft range cutoff (0 = infinite).
    this.range = Number.isFinite(opts.range) ? opts.range : 0.0;
  }
}

/**
 * Optional spotlight with cone + falloff.
 * `direction` is the direction light rays travel (world space).
 */
export class SpotLight {
  /**
   * @param {{
   *  position?: any,
   *  direction?: any,
   *  color?: any,
   *  intensity?: number,
   *  range?: number,
   *  innerAngleDeg?: number,
   *  outerAngleDeg?: number,
   *  name?: string
   * }=} opts
   */
  constructor(opts = {}) {
    this.isLight = true;
    /** @type {'2D'|'3D'} */
    this.nodeType = '3D';
    /** @type {string} */
    this.category = 'light';
    this.type = LightType.Spot;
    this.name = opts.name || 'SpotLight';
    // Match directional-light behavior: shadows work out-of-the-box.
    // Scenes can explicitly disable with castsShadow="false".
    this.castsShadow = true;
    this.position = _toVec3(opts.position, [0, 2, 0]);
    this.direction = _norm3(_toVec3(opts.direction, [0, -1, 0]));
    this.color = _toVec3(opts.color, [1, 1, 1]);
    this.intensity = Number.isFinite(opts.intensity) ? opts.intensity : 80.0;
    this.range = Number.isFinite(opts.range) ? opts.range : 0.0;

    this.innerAngleDeg = Number.isFinite(opts.innerAngleDeg) ? opts.innerAngleDeg : 18.0;
    this.outerAngleDeg = Number.isFinite(opts.outerAngleDeg) ? opts.outerAngleDeg : 28.0;
  }

  /** @returns {number} */
  get innerCos() {
    return Math.cos((this.innerAngleDeg * Math.PI) / 180);
  }

  /** @returns {number} */
  get outerCos() {
    return Math.cos((this.outerAngleDeg * Math.PI) / 180);
  }
}


