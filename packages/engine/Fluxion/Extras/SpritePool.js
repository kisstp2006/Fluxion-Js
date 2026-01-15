// @ts-check

import Sprite from '../Core/Sprite.js';

/**
 * Simple object pool for frequently created/destroyed Sprites.
 *
 * Notes:
 * - Uses `renderer.acquireTexture/releaseTexture` when available (refcount-aware).
 * - `release()` resets state and releases texture refs so pooled sprites don't leak GPU memory.
 */
export default class SpritePool {
  /**
   * @param {number=} size
   */
  constructor(size = 100) {
    /** @type {Sprite[]} */
    this.available = [];
    /** @type {Set<Sprite>} */
    this.active = new Set();

    this.preAllocate(size);
  }

  /** @param {number} size */
  preAllocate(size) {
    const n = Math.max(0, Number(size) || 0);
    for (let i = 0; i < n; i++) {
      // Create a sprite without triggering a texture load.
      // (Sprite.loadTexture early-outs for null/undefined.)
      const sp = new Sprite(/** @type {any} */ (null), /** @type {any} */ (null), 0, 0, 1, 1);
      sp.visible = false;
      sp.active = false;
      this.available.push(sp);
    }
  }

  /**
   * Acquire a sprite from the pool.
   * @param {any} renderer
   * @param {string|string[]=} imageSrc
   * @param {{x?: number, y?: number, width?: number, height?: number, layer?: number}=} opts
   */
  get(renderer, imageSrc, opts = undefined) {
    /** @type {Sprite} */
    let sprite = this.available.pop() || new Sprite(renderer, /** @type {any} */ (null), 0, 0, 1, 1);

    // If someone disposed a pooled sprite, don't try to reuse it.
    if (sprite && sprite._disposed) {
      sprite = new Sprite(renderer, /** @type {any} */ (null), 0, 0, 1, 1);
    }

    sprite.renderer = renderer;

    const x = opts && Number.isFinite(Number(opts.x)) ? Number(opts.x) : 0;
    const y = opts && Number.isFinite(Number(opts.y)) ? Number(opts.y) : 0;
    const width = opts && Number.isFinite(Number(opts.width)) ? Number(opts.width) : 1;
    const height = opts && Number.isFinite(Number(opts.height)) ? Number(opts.height) : 1;

    sprite.x = x;
    sprite.y = y;
    sprite.width = width;
    sprite.height = height;
    sprite.baseX = x;
    sprite.baseY = y;

    sprite.rotation = 0;
    sprite.followCamera = false;

    sprite.layer = opts && Number.isFinite(Number(opts.layer)) ? Number(opts.layer) : 0;

    // Reset visuals
    sprite.red = 255;
    sprite.green = 255;
    sprite.blue = 255;
    sprite.transparency = 255;
    sprite.color = [255, 255, 255, 255];

    sprite.visible = true;
    sprite.active = true;

    // Reset animation state
    sprite.currentFrame = 0;
    sprite.isAnimating = false;
    sprite.animation = null;
    sprite.lastFrameTime = 0;

    // Reset hierarchy
    /** @type {any} */ (sprite).parent = null;
    if (Array.isArray(sprite.children) && sprite.children.length) sprite.children.length = 0;
    sprite._sortedChildren = undefined;
    sprite._childrenDirty = false;

    // Ensure "not disposed" for pooled usage.
    sprite._disposed = false;

    // Load texture if requested.
    // (Sprite.loadTexture handles caching/refcounted acquire.)
    if (imageSrc !== undefined) {
      sprite.loadTexture(imageSrc);
    }

    this.active.add(sprite);
    return sprite;
  }

  /**
   * Return a sprite to the pool.
   * @param {Sprite} sprite
   */
  release(sprite) {
    if (!sprite) return;

    // Remove from active first.
    this.active.delete(sprite);

    // Release any GPU texture refs (refcount-aware).
    try {
      const r = /** @type {any} */ (sprite.renderer);
      if (sprite.textureKey && r && typeof r.releaseTexture === 'function') {
        r.releaseTexture(sprite.textureKey);
      }
    } catch {}

    // Reset state.
    sprite.textureKey = null;
    sprite.texture = null;
    if (Array.isArray(sprite.images)) sprite.images.length = 0;

    sprite.visible = false;
    sprite.active = false;

    sprite.animation = null;
    sprite.isAnimating = false;
    sprite.currentFrame = 0;

    // Detach children/parent to avoid retaining scene graphs.
    /** @type {any} */ (sprite).parent = null;
    if (Array.isArray(sprite.children) && sprite.children.length) sprite.children.length = 0;
    sprite._sortedChildren = undefined;
    sprite._childrenDirty = false;

    this.available.push(sprite);
  }

  /** Release all active sprites back into the pool. */
  releaseAll() {
    const items = Array.from(this.active);
    for (const sp of items) this.release(sp);
  }

  /** @returns {{ available: number, active: number }} */
  stats() {
    return { available: this.available.length, active: this.active.size };
  }
}
