// @ts-check

import { AnimatedSprite } from "../../engine/Fluxion/index.js";

/**
 * @typedef {{
 *  animSpriteModal: HTMLDivElement|null,
 *  animSpriteCloseBtn: HTMLButtonElement|null,
 *  animSpriteSubtitle: HTMLDivElement|null,
 *  animSpriteAnimList: HTMLDivElement|null,
 *  animSpriteNameInput: HTMLInputElement|null,
 *  animSpriteApplyBtn: HTMLButtonElement|null,
 *  animSpritePreviewWrap: HTMLDivElement|null,
 *  animSpriteFrameLabel: HTMLDivElement|null,
 *  animSpriteFramePreview: HTMLImageElement|null,
 *  animSpriteFramesStrip: HTMLDivElement|null,
 *  animSpriteError: HTMLDivElement|null,
 * }} AnimSpriteUI
 */

/** @param {any} obj */
export function isAnimatedSprite(obj) {
  if (!obj) return false;
  if (obj instanceof AnimatedSprite) return true;
  // Fallback for cross-realm/module duplication: heuristic.
  return (obj?.animations instanceof Map) && (typeof obj?.play === 'function') && (typeof obj?.stop === 'function');
}

/** @param {any} host @param {AnimSpriteUI} ui */
export function wireAnimSpriteEditorUI(host, ui) {
  ui.animSpriteCloseBtn?.addEventListener('click', () => host._closeAnimSpriteEditor());
  ui.animSpriteModal?.addEventListener('mousedown', (e) => {
    if (e.target === ui.animSpriteModal) host._closeAnimSpriteEditor();
  });

  ui.animSpriteApplyBtn?.addEventListener('click', () => host._applyAnimSpriteRename());
  ui.animSpriteNameInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      host._applyAnimSpriteRename();
    }
  });
}

/** @param {any} host @param {AnimSpriteUI} ui */
export function openAnimSpriteEditor(host, ui) {
  const obj = host.selected;
  if (!isAnimatedSprite(obj)) return;
  if (!ui.animSpriteModal) return;

  host._animSpriteOpen = true;
  host._animSpriteTarget = obj;
  host._animSpriteAnimName = null;
  host._animSpriteFrameIndex = null;

  // Capture prior playback state so the editor can preview frames in the viewport
  // without permanently changing the scene.
  host._animSpritePrevPlayback = {
    animName: (obj && typeof obj.currentAnimationName === 'string') ? obj.currentAnimationName : null,
    frameIndex: Number(obj?.currentFrameIndex) || 0,
    wasPlaying: !!obj?.isPlaying,
  };

  ui.animSpriteModal.hidden = false;
  populateAnimSpriteEditor(host, ui);
  if (host.menuBar) host.menuBar.closeMenus();
  ui.animSpriteCloseBtn?.focus();
}

/** @param {any} host @param {AnimSpriteUI} ui */
export function closeAnimSpriteEditor(host, ui) {
  if (!ui.animSpriteModal) return;

  // Restore prior playback state if possible.
  const sprite = host._animSpriteTarget;
  const prev = host._animSpritePrevPlayback;
  if (isAnimatedSprite(sprite) && prev) {
    try {
      if (prev.animName && (sprite.animations instanceof Map) && sprite.animations.has(prev.animName)) {
        sprite.currentAnimationName = prev.animName;
        sprite.currentAnimation = sprite.animations.get(prev.animName);
      }
      const fi = Number(prev.frameIndex);
      sprite.currentFrameIndex = Number.isFinite(fi) ? Math.max(0, Math.trunc(fi)) : 0;
      sprite.isPlaying = !!prev.wasPlaying;
    } catch {}
  }

  host._animSpriteOpen = false;
  host._animSpriteTarget = null;
  host._animSpriteAnimName = null;
  host._animSpriteFrameIndex = null;
  host._animSpritePrevPlayback = null;
  ui.animSpriteModal.hidden = true;
}

/** @param {any} host @param {AnimSpriteUI} ui @param {string} msg */
export function setAnimSpriteError(host, ui, msg) {
  void host;
  if (!ui.animSpriteError) return;
  ui.animSpriteError.textContent = msg ? String(msg) : '';
}

/** @param {any} host @param {AnimSpriteUI} ui */
export function updateAnimSpriteFramePreview(host, ui) {
  const sprite = host._animSpriteTarget;
  const animName = host._animSpriteAnimName;

  /** @param {string} label */
  const setEmpty = (label) => {
    if (ui.animSpriteFrameLabel) ui.animSpriteFrameLabel.textContent = label;
    if (ui.animSpriteFramePreview) ui.animSpriteFramePreview.removeAttribute('src');
  };

  if (!isAnimatedSprite(sprite) || !animName) {
    setEmpty('No frame');
    return;
  }

  const anims = sprite.animations;
  if (!(anims instanceof Map)) {
    setEmpty('No frame');
    return;
  }

  const anim = anims.get(animName);
  if (!anim || !Array.isArray(anim.frames) || anim.frames.length === 0) {
    setEmpty('No frame');
    return;
  }

  let idx = Number(host._animSpriteFrameIndex);
  if (!Number.isFinite(idx) || idx < 0 || idx >= anim.frames.length) idx = 0;
  host._animSpriteFrameIndex = idx;

  const frame = anim.frames[idx];
  if (ui.animSpriteFrameLabel) ui.animSpriteFrameLabel.textContent = `Frame ${idx}`;

  if (typeof frame === 'string') {
    const src = String(frame || '').trim();
    if (ui.animSpriteFramePreview) {
      if (src) ui.animSpriteFramePreview.src = src;
      else ui.animSpriteFramePreview.removeAttribute('src');
    }

    // While the editor modal is open, force the sprite to display the selected frame
    // so it's visible in the main viewport.
    if (host._animSpriteOpen && isAnimatedSprite(sprite) && (sprite.animations instanceof Map)) {
      const anim = sprite.animations.get(animName);
      if (anim) {
        sprite.currentAnimationName = animName;
        sprite.currentAnimation = anim;
        sprite.currentFrameIndex = idx;
        // Pause playback during manual frame inspection.
        sprite.isPlaying = false;
      }
    }
  } else {
    // Preview is only meaningful for image-path frames.
    if (ui.animSpriteFrameLabel) ui.animSpriteFrameLabel.textContent = `Frame ${idx} (no image preview)`;
    if (ui.animSpriteFramePreview) ui.animSpriteFramePreview.removeAttribute('src');
  }
}

/** @param {any} host @param {AnimSpriteUI} ui */
export function populateAnimSpriteEditor(host, ui) {
  const sprite = host._animSpriteTarget;
  if (!ui.animSpriteAnimList || !ui.animSpriteFramesStrip || !ui.animSpriteNameInput) return;

  if (!isAnimatedSprite(sprite)) {
    if (ui.animSpriteSubtitle) ui.animSpriteSubtitle.textContent = 'No selection';
    ui.animSpriteAnimList.innerHTML = '';
    ui.animSpriteFramesStrip.innerHTML = '';
    ui.animSpriteNameInput.value = '';
    host._animSpriteFrameIndex = null;
    updateAnimSpriteFramePreview(host, ui);
    setAnimSpriteError(host, ui, 'Select an AnimatedSprite to edit its animations.');
    return;
  }

  const name = sprite?.name ? String(sprite.name) : (sprite?.constructor?.name || 'AnimatedSprite');
  if (ui.animSpriteSubtitle) ui.animSpriteSubtitle.textContent = name;

  const anims = sprite.animations;
  if (!(anims instanceof Map)) {
    ui.animSpriteAnimList.innerHTML = '';
    ui.animSpriteFramesStrip.innerHTML = '';
    ui.animSpriteNameInput.value = '';
    setAnimSpriteError(host, ui, 'This sprite has no animations map.');
    return;
  }

  /** @type {string[]} */
  const keys = Array.from(anims.keys()).map((k) => String(k));

  const preferred = (sprite.currentAnimationName && anims.has(sprite.currentAnimationName))
    ? String(sprite.currentAnimationName)
    : (keys.length ? keys[0] : null);

  if (!host._animSpriteAnimName || !anims.has(host._animSpriteAnimName)) {
    host._animSpriteAnimName = preferred;
  }

  ui.animSpriteAnimList.innerHTML = '';
  for (const k of keys) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'animListItem' + (k === host._animSpriteAnimName ? ' active' : '');
    btn.textContent = k;
    btn.addEventListener('click', () => {
      host._animSpriteAnimName = k;
      host._animSpriteFrameIndex = null;
      populateAnimSpriteEditor(host, ui);
    });
    ui.animSpriteAnimList.appendChild(btn);
  }

  if (!host._animSpriteAnimName) {
    ui.animSpriteNameInput.value = '';
    ui.animSpriteFramesStrip.innerHTML = '';
    host._animSpriteFrameIndex = null;
    updateAnimSpriteFramePreview(host, ui);
    setAnimSpriteError(host, ui, 'No animations found on this sprite.');
    return;
  }

  ui.animSpriteNameInput.value = host._animSpriteAnimName;
  setAnimSpriteError(host, ui, '');
  renderAnimSpriteFrames(host, ui);
}

/** @param {any} host @param {AnimSpriteUI} ui */
export function applyAnimSpriteRename(host, ui) {
  const sprite = host._animSpriteTarget;
  if (!isAnimatedSprite(sprite)) return;
  if (!ui.animSpriteNameInput) return;
  const anims = sprite.animations;
  if (!(anims instanceof Map)) return;

  const oldName = host._animSpriteAnimName;
  const newName = String(ui.animSpriteNameInput.value || '').trim();
  if (!oldName) return;
  if (!newName) {
    setAnimSpriteError(host, ui, 'Animation name cannot be empty.');
    ui.animSpriteNameInput.value = oldName;
    return;
  }
  if (newName === oldName) {
    setAnimSpriteError(host, ui, '');
    return;
  }
  if (anims.has(newName)) {
    setAnimSpriteError(host, ui, 'An animation with that name already exists.');
    ui.animSpriteNameInput.value = oldName;
    return;
  }

  const anim = anims.get(oldName);
  if (!anim) return;
  anims.delete(oldName);
  anims.set(newName, anim);

  if (sprite.currentAnimationName === oldName) {
    sprite.currentAnimationName = newName;
  }

  host._animSpriteAnimName = newName;
  setAnimSpriteError(host, ui, '');
  populateAnimSpriteEditor(host, ui);
  host.rebuildInspector();
}

/** @param {any} host @param {AnimSpriteUI} ui */
export function renderAnimSpriteFrames(host, ui) {
  const sprite = host._animSpriteTarget;
  const animName = host._animSpriteAnimName;
  if (!isAnimatedSprite(sprite) || !animName) return;
  if (!ui.animSpriteFramesStrip) return;

  const anims = sprite.animations;
  if (!(anims instanceof Map)) return;
  const anim = anims.get(animName);
  if (!anim || !Array.isArray(anim.frames)) {
    ui.animSpriteFramesStrip.innerHTML = '';
    setAnimSpriteError(host, ui, 'This animation has no frames array.');
    return;
  }

  const frames = anim.frames;
  const isImageFrames = frames.length > 0 && typeof frames[0] === 'string';

  if (frames.length === 0) {
    host._animSpriteFrameIndex = null;
    updateAnimSpriteFramePreview(host, ui);
    return;
  }

  // Default to the sprite's current frame when editing its current animation.
  if (host._animSpriteFrameIndex === null || host._animSpriteFrameIndex === undefined) {
    const preferredIdx = (sprite.currentAnimationName === animName)
      ? Number(sprite.currentFrameIndex)
      : 0;
    host._animSpriteFrameIndex = Number.isFinite(preferredIdx)
      ? Math.max(0, Math.min(frames.length - 1, Math.trunc(preferredIdx)))
      : 0;
  }

  let selectedIndex = Number(host._animSpriteFrameIndex);
  if (!Number.isFinite(selectedIndex) || selectedIndex < 0 || selectedIndex >= frames.length) selectedIndex = 0;
  host._animSpriteFrameIndex = selectedIndex;
  if (isImageFrames && !Array.isArray(anim.images)) {
    anim.images = new Array(frames.length).fill(null);
  }
  if (isImageFrames && !Array.isArray(anim._frameKeys)) {
    anim._frameKeys = frames.slice();
  }

  ui.animSpriteFramesStrip.className = isImageFrames
    ? 'framesStrip framesStripImage'
    : 'framesStrip framesStripGrid';
  ui.animSpriteFramesStrip.innerHTML = '';

  /** @param {number} index */
  const ensureImage = (index) => {
    const src = String(frames[index] || '');
    if (!src) return;
    if (sprite.renderer?.hasCachedTexture?.(src)) {
      anim.images[index] = sprite.renderer.acquireTexture?.(src) || sprite.renderer.getCachedTexture?.(src) || anim.images[index];
      return;
    }

    const img = new Image();
    const loadPromise = new Promise((resolve) => {
      img.onload = () => {
        if (sprite._disposed) {
          resolve(false);
          return;
        }
        anim.images[index] = sprite.renderer?.createAndAcquireTexture?.(img, src) || sprite.renderer?.createTexture?.(img, src) || null;
        resolve(true);
      };
      img.onerror = () => resolve(false);
    });
    sprite.renderer?.trackAssetPromise?.(loadPromise);
    img.src = src;
  };

  for (let i = 0; i < frames.length; i++) {
    const cell = document.createElement('div');
    cell.className = 'frameCell' + (i === selectedIndex ? ' active' : '');
    cell.dataset.index = String(i);
    cell.addEventListener('click', () => {
      host._animSpriteFrameIndex = i;
      const strip = ui.animSpriteFramesStrip;
      if (strip) {
        for (const el of Array.from(strip.children)) {
          if (!(el instanceof HTMLElement)) continue;
          el.classList.toggle('active', el.dataset.index === String(i));
        }
      }
      updateAnimSpriteFramePreview(host, ui);
    });

    const idx = document.createElement('div');
    idx.className = 'frameIdx';
    idx.textContent = `Frame ${i}`;
    cell.appendChild(idx);

    const frame = frames[i];

    if (typeof frame === 'number') {
      const input = document.createElement('input');
      input.type = 'number';
      input.step = '1';
      input.value = String(frame);
      input.addEventListener('input', () => {
        const v = Number(input.value);
        if (!Number.isFinite(v)) return;
        frames[i] = Math.trunc(v);
      });
      cell.appendChild(input);
    } else if (typeof frame === 'string') {
      const thumb = document.createElement('img');
      thumb.className = 'frameThumb';
      thumb.loading = 'lazy';
      thumb.decoding = 'async';
      thumb.alt = `Frame ${i}`;
      thumb.src = String(frame);
      cell.appendChild(thumb);

      const input = document.createElement('input');
      input.type = 'text';
      input.value = String(frame);
      input.placeholder = 'image path';
      input.addEventListener('input', () => {
        const v = String(input.value || '').trim();
        frames[i] = v;
        if (Array.isArray(anim._frameKeys)) anim._frameKeys[i] = v;
        if (Array.isArray(anim.images)) anim.images[i] = null;
        thumb.src = v;
        if (host._animSpriteFrameIndex === i) updateAnimSpriteFramePreview(host, ui);
      });
      input.addEventListener('change', () => {
        // Re-load texture on commit.
        ensureImage(i);
      });
      cell.appendChild(input);
    } else if (frame && typeof frame === 'object') {
      const fx = document.createElement('input');
      fx.type = 'number';
      fx.step = '1';
      fx.value = String(Number(frame.x) || 0);
      fx.placeholder = 'x';

      const fy = document.createElement('input');
      fy.type = 'number';
      fy.step = '1';
      fy.value = String(Number(frame.y) || 0);
      fy.placeholder = 'y';

      const fw = document.createElement('input');
      fw.type = 'number';
      fw.step = '1';
      fw.value = String(Number(frame.w ?? frame.width) || 0);
      fw.placeholder = 'w';

      const fh = document.createElement('input');
      fh.type = 'number';
      fh.step = '1';
      fh.value = String(Number(frame.h ?? frame.height) || 0);
      fh.placeholder = 'h';

      const applyObj = () => {
        const nx = Number(fx.value);
        const ny = Number(fy.value);
        const nw = Number(fw.value);
        const nh = Number(fh.value);
        if (!Number.isFinite(nx) || !Number.isFinite(ny) || !Number.isFinite(nw) || !Number.isFinite(nh)) return;
        frames[i] = { x: Math.trunc(nx), y: Math.trunc(ny), w: Math.trunc(nw), h: Math.trunc(nh) };
      };
      fx.addEventListener('input', applyObj);
      fy.addEventListener('input', applyObj);
      fw.addEventListener('input', applyObj);
      fh.addEventListener('input', applyObj);

      cell.appendChild(fx);
      cell.appendChild(fy);
      cell.appendChild(fw);
      cell.appendChild(fh);
    } else {
      const input = document.createElement('input');
      input.type = 'text';
      input.value = '';
      input.placeholder = 'frame';
      input.addEventListener('input', () => {
        frames[i] = String(input.value || '');
      });
      cell.appendChild(input);
    }

    ui.animSpriteFramesStrip.appendChild(cell);
  }

  updateAnimSpriteFramePreview(host, ui);
}
