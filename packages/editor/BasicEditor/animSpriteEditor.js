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
 *  animSpritePlayBtn: HTMLButtonElement|null,
 *  animSpriteCancelBtn: HTMLButtonElement|null,
 *  animSpriteOkBtn: HTMLButtonElement|null,
 *  animSpritePreviewWrap: HTMLDivElement|null,
 *  animSpriteFrameLabel: HTMLDivElement|null,
 *  animSpriteFramePreview: HTMLImageElement|null,
 *  animSpriteFramesStrip: HTMLDivElement|null,
 *  animSpriteError: HTMLDivElement|null,
 * }} AnimSpriteUI
 */

/**
 * @typedef {{
 *  animations: Array<{ name: string, frames: any[], fps: number, loop: boolean }>,
 * }} AnimSpriteEditSnapshot
 */

/** @param {any[]} frames */
function cloneFrames(frames) {
  /** @type {any[]} */
  const out = [];
  for (const f of frames || []) {
    if (typeof f === 'string' || typeof f === 'number' || f == null) {
      out.push(f);
      continue;
    }
    if (typeof f === 'object') {
      out.push({
        x: Number(f.x) || 0,
        y: Number(f.y) || 0,
        w: Number(f.w ?? f.width) || 0,
        h: Number(f.h ?? f.height) || 0,
      });
      continue;
    }
    out.push(f);
  }
  return out;
}

/** @param {any} sprite @returns {AnimSpriteEditSnapshot} */
function captureSnapshot(sprite) {
  /** @type {AnimSpriteEditSnapshot} */
  const snap = { animations: [] };
  const anims = sprite?.animations;
  if (!(anims instanceof Map)) return snap;

  for (const [name, anim] of anims.entries()) {
    const n = String(name);
    const frames = Array.isArray(anim?.frames) ? cloneFrames(anim.frames) : [];
    const fps = Number(anim?.fps);
    const loop = !!anim?.loop;
    snap.animations.push({ name: n, frames, fps: Number.isFinite(fps) ? fps : 10, loop });
  }
  return snap;
}

/** Release any per-frame textures owned by current animations (best-effort). @param {any} sprite */
function releaseAnimationTextures(sprite) {
  const r = sprite?.renderer;
  if (!r?.releaseTexture) return;
  const anims = sprite?.animations;
  if (!(anims instanceof Map)) return;

  const released = new Set();
  for (const anim of anims.values()) {
    const keys = anim?._frameKeys;
    if (!Array.isArray(keys)) continue;
    for (const k of keys) {
      const key = String(k || '');
      if (!key || released.has(key)) continue;
      released.add(key);
      try { r.releaseTexture(key); } catch {}
    }
  }
}

/**
 * Open a project-file picker (multi-select) for image assets.
 * @param {HTMLElement} anchor
 * @param {(selectedRelPaths: string[]) => void} onAdd
 */
function openImageMultiPicker(anchor, onAdd) {
  try {
    const api = /** @type {any} */ (window).electronAPI;
    if (!api || typeof api.listProjectDir !== 'function') return false;

    const menu = document.createElement('div');
    // Use context-menu styling (topbar .menu dropdowns are hidden by default).
    menu.className = 'contextMenu open';
    menu.setAttribute('role', 'menu');
    menu.style.display = 'block';
    // Must be above modals/backdrops.
    menu.style.zIndex = '10006';
    menu.style.maxWidth = '560px';
    menu.style.maxHeight = `${Math.max(240, window.innerHeight - 8)}px`;
    menu.style.overflow = 'hidden';
    document.body.appendChild(menu);

    const header = document.createElement('div');
    header.className = 'menuSearchRow';
    const search = document.createElement('input');
    search.type = 'text';
    search.className = 'menuSearchInput';
    search.placeholder = 'Search…';
    search.autocomplete = 'off';
    search.spellcheck = false;
    header.appendChild(search);
    menu.appendChild(header);

    const list = document.createElement('div');
    list.className = 'menuList';
    list.style.maxHeight = '55vh';
    list.style.overflow = 'auto';
    menu.appendChild(list);

    const footer = document.createElement('div');
    footer.className = 'menuFooterRow';
    menu.appendChild(footer);

    /** Clamp + flip the menu to stay within viewport. */
    const reposition = () => {
      try {
        const pad = 4;
        // Ensure menu can't exceed viewport height.
        menu.style.maxHeight = `${Math.max(240, window.innerHeight - pad * 2)}px`;
        const headerH = header.getBoundingClientRect().height || 0;
        const footerH = footer.getBoundingClientRect().height || 0;
        const maxList = Math.max(140, (window.innerHeight - pad * 2) - headerH - footerH - 16);
        list.style.maxHeight = `${maxList}px`;

        const r = anchor.getBoundingClientRect();
        menu.style.left = `${Math.max(pad, Math.floor(r.left))}px`;
        menu.style.top = `${Math.max(pad, Math.floor(r.bottom + 6))}px`;

        requestAnimationFrame(() => {
          if (closed) return;
          const mr = menu.getBoundingClientRect();
          const maxX = Math.max(pad, window.innerWidth - mr.width - pad);
          let x = Math.min(Math.max(pad, Math.floor(r.left)), maxX);

          const yDown = Math.floor(r.bottom + 6);
          const yUp = Math.floor(r.top - 6 - mr.height);
          let y;
          if (yDown + mr.height + pad <= window.innerHeight) {
            y = Math.max(pad, yDown);
          } else if (yUp >= pad) {
            y = yUp;
          } else {
            const maxY = Math.max(pad, window.innerHeight - mr.height - pad);
            y = Math.min(Math.max(pad, yDown), maxY);
          }

          menu.style.left = `${x}px`;
          menu.style.top = `${y}px`;
        });
      } catch {}
    };

    let repositionRAF = 0;
    const scheduleReposition = () => {
      try { if (repositionRAF) cancelAnimationFrame(repositionRAF); } catch {}
      repositionRAF = requestAnimationFrame(() => {
        repositionRAF = 0;
        reposition();
      });
    };

    let closed = false;
    const close = () => {
      if (closed) return;
      closed = true;
      try { menu.remove(); } catch {}
      window.removeEventListener('blur', close);
      window.removeEventListener('resize', scheduleReposition);
      document.removeEventListener('mousedown', onDocMouseDown, true);
      document.removeEventListener('keydown', onKeyDown, true);
    };

    /** @param {MouseEvent} e */
    const onDocMouseDown = (e) => {
      const t = /** @type {HTMLElement|null} */ (e.target instanceof HTMLElement ? e.target : null);
      if (!t) return;
      if (t === menu || menu.contains(t)) return;
      close();
    };

    /** @param {KeyboardEvent} e */
    const onKeyDown = (e) => {
      if (e.key === 'Escape') close();
    };

    window.addEventListener('blur', close);
    window.addEventListener('resize', scheduleReposition);
    document.addEventListener('mousedown', onDocMouseDown, true);
    document.addEventListener('keydown', onKeyDown, true);

    scheduleReposition();

    /** @param {string} rel */
    const isImageRel = (rel) => {
      const p = String(rel || '').trim().toLowerCase();
      if (!p) return false;
      return p.endsWith('.png') || p.endsWith('.jpg') || p.endsWith('.jpeg') || p.endsWith('.gif') || p.endsWith('.webp') || p.endsWith('.bmp');
    };

    /** @returns {Promise<string[]>} */
    const listMatchingFiles = async () => {
      const preferredRoots = ['Texture', 'Textures', 'Images', 'Image', 'Model', 'Assets', 'Asset'];
      /** @type {string[]} */
      const roots = [];
      const ignore = new Set(['node_modules', '.git', '.vscode', 'packages', 'examples', 'docs', 'third-party', 'tests', 'dist']);

      for (const d of preferredRoots) {
        try {
          const res = await api.listProjectDir(d);
          if (res && res.ok) roots.push(d);
        } catch {}
      }
      if (roots.length === 0) roots.push('.');

      /** @type {string[]} */
      const out = [];
      /** @type {string[]} */
      const stack = roots.map((r) => String(r));
      let dirOps = 0;
      const maxDirOps = 2500;
      const maxFiles = 2500;

      while (stack.length > 0) {
        const dir = String(stack.pop() || '');
        if (!dir && dir !== '.') continue;
        if (dirOps++ > maxDirOps) break;

        const last = dir.split('/').pop() || dir.split('\\').pop() || dir;
        if (ignore.has(String(last))) continue;

        let res;
        try {
          res = await api.listProjectDir(dir === '.' ? '.' : dir);
        } catch {
          continue;
        }
        if (!res || !res.ok) continue;
        const entries = Array.isArray(res.entries) ? res.entries : [];
        for (const ent of entries) {
          if (!ent) continue;
          const p = String(ent.path || '').trim();
          if (!p) continue;
          if (ent.isDir) {
            stack.push(p);
            continue;
          }
          if (!isImageRel(p)) continue;
          out.push(p);
          if (out.length >= maxFiles) break;
        }
        if (out.length >= maxFiles) break;
      }

      out.sort((a, b) => a.localeCompare(b));
      return out;
    };

    /** @type {string[]} */
    let allFiles = [];
    const selected = new Set();

    /** @param {string} rel */
    const renderRowLabel = (rel) => `${selected.has(rel) ? '☑' : '☐'} ${rel}`;

    const renderFooter = () => {
      footer.innerHTML = '';
      const addBtn = document.createElement('button');
      addBtn.type = 'button';
      addBtn.className = 'btn btnSmall';
      addBtn.textContent = `Add Selected (${selected.size})`;
      addBtn.disabled = selected.size === 0;
      addBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (selected.size === 0) return;
        try { onAdd(Array.from(selected)); } catch {}
        close();
      });

      const cancelBtn = document.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.className = 'btn btnSmall';
      cancelBtn.textContent = 'Cancel';
      cancelBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        close();
      });

      footer.appendChild(addBtn);
      footer.appendChild(cancelBtn);
    };

    const renderList = () => {
      list.innerHTML = '';
      const q = String(search.value || '').trim().toLowerCase();
      const maxShow = 600;
      let shown = 0;

      const src = Array.isArray(allFiles) ? allFiles : [];
      for (const rel of src) {
        if (!rel) continue;
        if (q) {
          const hay = String(rel).toLowerCase();
          if (!hay.includes(q)) continue;
        }

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'menuItem';
        btn.textContent = renderRowLabel(rel);
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (selected.has(rel)) selected.delete(rel);
          else selected.add(rel);
          btn.textContent = renderRowLabel(rel);
          renderFooter();
        });
        list.appendChild(btn);

        shown++;
        if (shown >= maxShow) break;
      }

      if (shown === 0) {
        const empty = document.createElement('button');
        empty.type = 'button';
        empty.className = 'menuItem';
        empty.textContent = 'No matching images found';
        empty.disabled = true;
        list.appendChild(empty);
      } else if (src.length > maxShow) {
        const note = document.createElement('button');
        note.type = 'button';
        note.className = 'menuItem';
        note.textContent = `Showing ${maxShow} max. Refine search…`;
        note.disabled = true;
        list.appendChild(note);
      }

      renderFooter();
    };

    search.addEventListener('input', () => {
      renderList();
      scheduleReposition();
    });
    search.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      }
    });

    // Initial state
    list.innerHTML = '';
    const loading = document.createElement('button');
    loading.type = 'button';
    loading.className = 'menuItem';
    loading.textContent = 'Loading…';
    loading.disabled = true;
    list.appendChild(loading);
    renderFooter();

    Promise.resolve(listMatchingFiles())
      .then((files) => {
        if (closed) return;
        allFiles = Array.isArray(files) ? files : [];
        renderList();
        scheduleReposition();
        try { search.focus(); } catch {}
      })
      .catch(() => {
        if (closed) return;
        list.innerHTML = '';
        const err = document.createElement('button');
        err.type = 'button';
        err.className = 'menuItem';
        err.textContent = 'Failed to list project files';
        err.disabled = true;
        list.appendChild(err);
        renderFooter();
      });
    return true;
  } catch {
    // ignore
  }
  return false;
}

/** @param {any} sprite @param {AnimSpriteEditSnapshot} snap */
function restoreSnapshot(sprite, snap) {
  if (!isAnimatedSprite(sprite)) return;
  if (!snap || !Array.isArray(snap.animations)) return;

  // Release textures created/held by current animations.
  releaseAnimationTextures(sprite);

  sprite.animations = new Map();
  sprite.currentAnimation = null;
  sprite.currentAnimationName = '';
  sprite.currentFrameIndex = 0;
  sprite.timer = 0;
  sprite.isPlaying = false;

  for (const a of snap.animations) {
    try {
      const name = String(a?.name || '').trim();
      if (!name) continue;
      const frames = Array.isArray(a?.frames) ? cloneFrames(a.frames) : [];
      const fps = Number(a?.fps);
      const loop = !!a?.loop;
      sprite.addAnimation(name, frames, Number.isFinite(fps) ? fps : 10, loop);
    } catch {}
  }
}

/** @param {any} host @param {AnimSpriteUI} ui */
function syncPlaybackUI(host, ui) {
  if (!ui.animSpritePlayBtn) return;
  const sprite = host._animSpriteTarget;
  const canPlay = isAnimatedSprite(sprite) && !!host._animSpriteAnimName;
  ui.animSpritePlayBtn.disabled = !canPlay;
  ui.animSpritePlayBtn.textContent = 'Play';

  if (ui.animSpriteOkBtn) ui.animSpriteOkBtn.disabled = !isAnimatedSprite(sprite);
  if (ui.animSpriteCancelBtn) ui.animSpriteCancelBtn.disabled = !isAnimatedSprite(sprite);
}

/** @param {any} obj */
export function isAnimatedSprite(obj) {
  if (!obj) return false;
  if (obj instanceof AnimatedSprite) return true;
  // Fallback for cross-realm/module duplication: heuristic.
  return (obj?.animations instanceof Map) && (typeof obj?.play === 'function') && (typeof obj?.stop === 'function');
}

/** @param {any} host @param {AnimSpriteUI} ui */
export function wireAnimSpriteEditorUI(host, ui) {
  const onCancel = () => cancelAnimSpriteEditor(host, ui);
  ui.animSpriteCloseBtn?.addEventListener('click', onCancel);
  ui.animSpriteModal?.addEventListener('mousedown', (e) => {
    if (e.target === ui.animSpriteModal) onCancel();
  });

  ui.animSpriteApplyBtn?.addEventListener('click', () => host._applyAnimSpriteRename());
  ui.animSpriteNameInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      host._applyAnimSpriteRename();
    }
  });

  ui.animSpritePlayBtn?.addEventListener('click', () => toggleAnimSpritePlay(host, ui));
  ui.animSpriteCancelBtn?.addEventListener('click', onCancel);
  ui.animSpriteOkBtn?.addEventListener('click', () => okAnimSpriteEditor(host, ui));
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
  host._animSpriteEditSnapshot = captureSnapshot(obj);

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
  syncPlaybackUI(host, ui);
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
  host._animSpriteEditSnapshot = null;
  ui.animSpriteModal.hidden = true;
}

/** OK = keep edits, close modal (restores prior playback state). @param {any} host @param {AnimSpriteUI} ui */
export function okAnimSpriteEditor(host, ui) {
  closeAnimSpriteEditor(host, ui);
}

/** Cancel = restore snapshot, close modal (restores prior playback state). @param {any} host @param {AnimSpriteUI} ui */
export function cancelAnimSpriteEditor(host, ui) {
  const sprite = host._animSpriteTarget;
  const snap = host._animSpriteEditSnapshot;
  if (isAnimatedSprite(sprite) && snap) {
    restoreSnapshot(sprite, snap);
    try { host.rebuildInspector?.(); } catch {}
  }
  closeAnimSpriteEditor(host, ui);
}

/** Toggle preview play/pause inside the editor. @param {any} host @param {AnimSpriteUI} ui */
export async function toggleAnimSpritePlay(host, ui) {
  const sprite = host._animSpriteTarget;
  const animName = host._animSpriteAnimName;
  if (!isAnimatedSprite(sprite) || !animName) return;
  if (!(sprite.animations instanceof Map)) return;

  const anim = sprite.animations.get(animName);
  if (!anim || !Array.isArray(anim.frames) || anim.frames.length === 0) return;

  // Build a minimal payload for the preview window.
  const fps = Number(anim.fps);
  const frames = anim.frames.slice();

  /** @type {any} */
  let payload;
  if (typeof frames[0] === 'string') {
    payload = {
      kind: 'images',
      name: animName,
      fps: Number.isFinite(fps) ? fps : 10,
      loop: true,
      frames,
    };
  } else {
    payload = {
      kind: 'sheet',
      name: animName,
      fps: Number.isFinite(fps) ? fps : 10,
      loop: true,
      frames,
      sheetSrc: String(sprite.textureKey || ''),
      frameWidth: Number(sprite.frameWidth) || 0,
      frameHeight: Number(sprite.frameHeight) || 0,
    };
  }

  try {
    const api = /** @type {any} */ (window).electronAPI;
    if (api && typeof api.openAnimSpritePreview === 'function') {
      await api.openAnimSpritePreview(payload);
    }
  } catch (e) {
    console.error(e);
  }

  syncPlaybackUI(host, ui);
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
  syncPlaybackUI(host, ui);
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
  const isImageFrames = frames.length === 0 || typeof frames[0] === 'string';

  // Default to the sprite's current frame when editing its current animation.
  if (frames.length === 0) {
    host._animSpriteFrameIndex = null;
  } else {
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
  }

  let selectedIndex = Number(host._animSpriteFrameIndex);
  if (!Number.isFinite(selectedIndex)) selectedIndex = -1;
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

  // Add-frames button after the last frame.
  const addCell = document.createElement('div');
  addCell.className = 'frameCell frameCellAdd';
  addCell.dataset.index = 'add';

  const addLabel = document.createElement('div');
  addLabel.className = 'frameIdx';
  addLabel.textContent = 'Add frame(s)';
  addCell.appendChild(addLabel);

  const addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.className = 'btn btnSmall frameAddBtn';
  addBtn.textContent = isImageFrames ? '+ Add Images…' : '+ Add Frame';

  addBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();

    // If this animation uses image frames, allow selecting multiple project images.
    if (isImageFrames) {
      const opened = openImageMultiPicker(addBtn, (selectedRelPaths) => {
        const rels = Array.isArray(selectedRelPaths) ? selectedRelPaths : [];
        if (rels.length === 0) return;

        const beforeLen = frames.length;
        for (const rel of rels) {
          const cleanRel = String(rel || '').replace(/^\/+/, '');
          if (!cleanRel) continue;
          const url = cleanRel.startsWith('fluxion://') ? cleanRel : `fluxion://workspace/${cleanRel}`;
          frames.push(url);
        }

        if (!Array.isArray(anim.images)) anim.images = new Array(frames.length).fill(null);
        if (!Array.isArray(anim._frameKeys)) anim._frameKeys = frames.slice();
        while (anim.images.length < frames.length) anim.images.push(null);
        while (anim._frameKeys.length < frames.length) anim._frameKeys.push(String(frames[anim._frameKeys.length] || ''));

        // Select first newly added frame.
        host._animSpriteFrameIndex = beforeLen < frames.length ? beforeLen : host._animSpriteFrameIndex;
        renderAnimSpriteFrames(host, ui);
      });
      if (!opened) {
        setAnimSpriteError(host, ui, 'File picker unavailable (electronAPI.listProjectDir missing).');
      }
      return;
    }

    // Non-image animations: add a reasonable default frame.
    try {
      if (frames.length > 0 && typeof frames[0] === 'number') {
        const last = Number(frames[frames.length - 1]);
        const next = Number.isFinite(last) ? (Math.trunc(last) + 1) : frames.length;
        frames.push(next);
      } else if (frames.length > 0 && frames[0] && typeof frames[0] === 'object') {
        const f0 = /** @type {any} */ (frames[frames.length - 1]);
        frames.push({ x: Number(f0.x) || 0, y: Number(f0.y) || 0, w: Number(f0.w ?? f0.width) || 0, h: Number(f0.h ?? f0.height) || 0 });
      } else {
        frames.push(0);
      }
      host._animSpriteFrameIndex = frames.length - 1;
      renderAnimSpriteFrames(host, ui);
    } catch {}
  });

  addCell.appendChild(addBtn);
  ui.animSpriteFramesStrip.appendChild(addCell);

  updateAnimSpriteFramePreview(host, ui);
  syncPlaybackUI(host, ui);
}
