// @ts-check

import Engine from '../../engine/Fluxion/Core/Engine.js';
import SceneLoader from '../../engine/Fluxion/Core/SceneLoader.js';

/** @typedef {{ title?: string, sceneUrl?: string, resolution?: { width?: number, height?: number } }} PlayPreviewPayload */

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('playCanvas'));
let started = false;

/**
 * @param {any} v
 * @param {number} def
 * @param {number} min
 * @param {number} max
 */
function clampInt(v, def, min, max) {
  const n = Math.trunc(Number(v));
  if (!Number.isFinite(n)) return def;
  return Math.max(min, Math.min(max, n));
}

/** @param {number} w @param {number} h */
function sizeWindowToResolution(w, h) {
  // Keep window sizes reasonable to avoid desktop lock-ups.
  const maxW = 2000;
  const maxH = 1400;
  const cw = Math.min(maxW, Math.max(480, w));
  const ch = Math.min(maxH, Math.max(320, h));

  try {
    const api = /** @type {any} */ (window).electronAPI;
    if (api?.setContentSize) api.setContentSize(cw, ch);
    else if (api?.resize) api.resize(cw, ch);
  } catch {}
}

/** @param {PlayPreviewPayload} payload */
async function start(payload) {
  if (started) return;
  started = true;

  const title = String(payload?.title || 'Play');
  try {
    document.title = title;
    /** @type {any} */ (window).electronAPI?.setTitle?.(title);
  } catch {}

  const sceneUrl = String(payload?.sceneUrl || '').trim();
  if (!sceneUrl) {
    console.error('Play preview missing sceneUrl');
    return;
  }

  const rw = clampInt(payload?.resolution?.width, 1280, 1, 16384);
  const rh = clampInt(payload?.resolution?.height, 720, 1, 16384);
  sizeWindowToResolution(rw, rh);

  // Ensure key events land here by default.
  try { canvas?.focus?.(); } catch {}

  const game = {
    /** @type {any} */
    currentScene: null,
    /** @param {any} renderer */
    async init(renderer) {
      // Apply project/editor resolution if provided.
      try {
        if (renderer && rw > 0 && rh > 0) {
          renderer.targetWidth = rw;
          renderer.targetHeight = rh;
          renderer.resizeCanvas?.();
        }
      } catch {}

      const scene = await SceneLoader.load(sceneUrl, renderer);
      this.currentScene = scene;
    },
    /** @param {number} dt */
    update(dt) {
      const s = /** @type {any} */ (this.currentScene);
      if (s && typeof s.update === 'function') s.update(dt);
    },
    /** @param {any} renderer */
    draw(renderer) {
      const s = /** @type {any} */ (this.currentScene);
      if (s && typeof s.draw === 'function') s.draw(renderer);
    },
  };

  // Engine auto-starts its loop.
  new Engine(canvas, game, rw, rh, true, false, {
    renderer: {
      webglVersion: 'auto',
      allowFallback: true,
      respectCssSize: true,
    },
    splashScreen: {
      enabled: false,
      showMadeWithFluxionWhenDisabled: false,
    },
  });
}

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    try { /** @type {any} */ (window).electronAPI?.close?.(); } catch {}
  }
});

try {
  /** @type {any} */ (window).electronAPI?.onPlayPreviewData?.((/** @type {any} */ payload) => {
    try { start(/** @type {PlayPreviewPayload} */ (payload)); } catch (e) { console.error(e); }
  });
} catch (e) {
  console.error(e);
}
