// @ts-check

/** @typedef {{ kind: 'images', name: string, fps: number, frames: string[], loop: boolean }} ImagesPayload */
/** @typedef {{ kind: 'sheet', name: string, fps: number, frames: any[], loop: boolean, sheetSrc: string, frameWidth: number, frameHeight: number }} SheetPayload */
/** @typedef {ImagesPayload | SheetPayload} PreviewPayload */

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('c'));
const ctx = canvas.getContext('2d');

function resize() {
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const w = Math.max(1, Math.floor(window.innerWidth * dpr));
  const h = Math.max(1, Math.floor(window.innerHeight * dpr));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
}

window.addEventListener('resize', resize);
resize();

window.addEventListener('mousedown', () => {
  try { /** @type {any} */ (window).electronAPI?.close?.(); } catch {}
});

/**
 * Resize the BrowserWindow content area to match the largest frame.
 * Adds a tiny padding so the frame isn't flush.
 * @param {number} frameW
 * @param {number} frameH
 */
function sizeWindowToFrame(frameW, frameH) {
  const w = Math.max(64, Math.trunc(Number(frameW) || 0));
  const h = Math.max(64, Math.trunc(Number(frameH) || 0));

  // Prevent ridiculous sizes from locking up the desktop.
  const max = 1400;
  const cw = Math.min(max, w + 24);
  const ch = Math.min(max, h + 24);

  try {
    const api = /** @type {any} */ (window).electronAPI;
    if (api?.setContentSize) api.setContentSize(cw, ch);
    else if (api?.resize) api.resize(cw, ch);
  } catch {}
}

/** @param {string} url */
function resolveUrl(url) {
  const s = String(url || '').trim();
  if (!s) return '';
  if (/^[a-z]+:\/\//i.test(s)) return s;
  if (s.startsWith('/')) return `fluxion://workspace${s}`;
  return `fluxion://workspace/${s}`;
}

/** @param {HTMLImageElement} img */
function waitImage(img) {
  if (img.complete && img.naturalWidth > 0) return Promise.resolve(true);
  return new Promise((resolve) => {
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
  });
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {HTMLImageElement} img
 * @param {number} sx
 * @param {number} sy
 * @param {number} sw
 * @param {number} sh
 */
function drawFrame(ctx, img, sx, sy, sw, sh) {
  const cw = ctx.canvas.width;
  const ch = ctx.canvas.height;
  ctx.clearRect(0, 0, cw, ch);

  if (sw <= 0 || sh <= 0) return;

  const scale = Math.min(cw / sw, ch / sh);
  const dw = Math.floor(sw * scale);
  const dh = Math.floor(sh * scale);
  const dx = Math.floor((cw - dw) / 2);
  const dy = Math.floor((ch - dh) / 2);

  // Pixel-ish look when scaled up
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
}

/** @param {PreviewPayload} payload */
async function start(payload) {
  if (!ctx) return;

  const fps = Math.max(1, Number(payload?.fps) || 10);
  const frameDurationMs = 1000 / fps;

  let startMs = performance.now();

  if (payload.kind === 'images') {
    const frames = Array.isArray(payload.frames) ? payload.frames : [];
    const imgs = frames.map((src) => {
      const img = new Image();
      img.src = resolveUrl(src);
      return img;
    });

    // Load at least the first frame so the window isn't blank.
    if (imgs[0]) await waitImage(imgs[0]);

    // Compute max frame size (best-effort) and size window.
    // Do this asynchronously so playback can start immediately.
    Promise.all(imgs.map(waitImage)).then(() => {
      let maxW = 0;
      let maxH = 0;
      for (const img of imgs) {
        if (!img || img.naturalWidth <= 0 || img.naturalHeight <= 0) continue;
        if (img.naturalWidth > maxW) maxW = img.naturalWidth;
        if (img.naturalHeight > maxH) maxH = img.naturalHeight;
      }
      if (maxW > 0 && maxH > 0) sizeWindowToFrame(maxW, maxH);
    }).catch(() => {});

    /** @param {number} now */
    const tick = (now) => {
      const elapsed = now - startMs;
      const i = frames.length ? (Math.floor(elapsed / frameDurationMs) % frames.length) : 0;
      const img = imgs[i];
      if (img && img.naturalWidth > 0) {
        drawFrame(ctx, img, 0, 0, img.naturalWidth, img.naturalHeight);
      } else {
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      }
      requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
    return;
  }

  // Sprite-sheet preview
  const sheet = new Image();
  sheet.src = resolveUrl(payload.sheetSrc);
  await waitImage(sheet);

  const frames = Array.isArray(payload.frames) ? payload.frames : [];
  const fw = Math.max(1, Math.trunc(Number(payload.frameWidth) || 0));
  const fh = Math.max(1, Math.trunc(Number(payload.frameHeight) || 0));

  const cols = fw > 0 ? Math.max(1, Math.floor(sheet.naturalWidth / fw)) : 1;

  /** @param {any} frame */
  const getRect = (frame) => {
    if (typeof frame === 'number') {
      const idx = Math.max(0, Math.trunc(frame));
      const x = (idx % cols) * fw;
      const y = Math.floor(idx / cols) * fh;
      return { x, y, w: fw, h: fh };
    }
    if (frame && typeof frame === 'object') {
      const x = Math.max(0, Math.trunc(Number(frame.x) || 0));
      const y = Math.max(0, Math.trunc(Number(frame.y) || 0));
      const w = Math.max(1, Math.trunc(Number(frame.w ?? frame.width) || fw || 1));
      const h = Math.max(1, Math.trunc(Number(frame.h ?? frame.height) || fh || 1));
      return { x, y, w, h };
    }
    // fallback
    return { x: 0, y: 0, w: fw || sheet.naturalWidth, h: fh || sheet.naturalHeight };
  };

  // Size window to the largest frame rect.
  try {
    let maxW = fw;
    let maxH = fh;
    for (const fr of frames) {
      const r = getRect(fr);
      if (r.w > maxW) maxW = r.w;
      if (r.h > maxH) maxH = r.h;
    }
    if (maxW > 0 && maxH > 0) sizeWindowToFrame(maxW, maxH);
  } catch {}

  /** @param {number} now */
  const tick = (now) => {
    const elapsed = now - startMs;
    const i = frames.length ? (Math.floor(elapsed / frameDurationMs) % frames.length) : 0;
    const rect = getRect(frames[i]);

    if (sheet.naturalWidth > 0) {
      drawFrame(ctx, sheet, rect.x, rect.y, rect.w, rect.h);
    } else {
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    }

    requestAnimationFrame(tick);
  };

  requestAnimationFrame(tick);
}

try {
  /** @type {any} */ (window).electronAPI?.onAnimSpritePreviewData?.((/** @type {any} */ payload) => {
    try { start(/** @type {PreviewPayload} */ (payload)); } catch (e) { console.error(e); }
  });
} catch (e) {
  console.error(e);
}
