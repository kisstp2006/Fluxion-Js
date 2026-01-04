// @ts-check

/**
 * Asset browser UI logic extracted from `game.js`.
 * Keeps behavior identical: lists folders/files via Electron IPC and supports
 * navigating into folders, selecting files, and navigating up.
 */

/**
 * @typedef {{
 *  assetUpBtn: HTMLButtonElement|null,
 *  assetPath: HTMLDivElement|null,
 *  assetFolders: HTMLDivElement|null,
 *  assetGrid: HTMLDivElement|null,
 * }} AssetBrowserUI
 */

/**
 * @param {{ ui: AssetBrowserUI, root?: string, onOpenFile?: ((pathRel: string) => (void | Promise<void>)) | null }} opts
 */
export function createAssetBrowser(opts) {
  const ui = opts.ui;
  const onOpenFile = opts.onOpenFile || null;
  const state = {
    root: String(opts.root || 'Model'),
    cwd: String(opts.root || 'Model'),
    selected: /** @type {string|null} */ (null),
    selectedIsDir: false,
    focused: false,
    clipboard: /** @type {string|null} */ (null),
  };

  const ctx = {
    menu: /** @type {HTMLDivElement|null} */ (null),
    visible: false,
    targetPath: /** @type {string|null} */ (null),
    targetIsDir: false,
    pasteDestDir: /** @type {string|null} */ (null),
  };

  const renameUI = {
    modal: /** @type {HTMLDivElement|null} */ (null),
    closeBtn: /** @type {HTMLButtonElement|null} */ (null),
    cancelBtn: /** @type {HTMLButtonElement|null} */ (null),
    okBtn: /** @type {HTMLButtonElement|null} */ (null),
    subtitle: /** @type {HTMLDivElement|null} */ (null),
    input: /** @type {HTMLInputElement|null} */ (null),
    targetPath: /** @type {string|null} */ (null),
    targetIsDir: false,
    open: false,
  };

  /** @param {string} pathRel */
  async function list(pathRel) {
    const electronAPI = /** @type {any} */ (window).electronAPI;
    const res = await electronAPI.listProjectDir(pathRel);
    if (!res || !res.ok) throw new Error(res && res.error ? res.error : 'Failed to list directory');
    return res;
  }

  async function render() {
    const root = state.root;
    const cwd = state.cwd;

    if (ui.assetPath) ui.assetPath.textContent = cwd;

    // Left: root folder list (root + its subfolders)
    const rootRes = await list(root);
    const rootEntries = /** @type {any[]} */ (rootRes.entries || []);
    const folders = [{ name: root, path: root, isRoot: true }]
      .concat(rootEntries.filter((x) => x && x.isDir).map((x) => ({ name: x.name, path: x.path, isRoot: false })));

    if (ui.assetFolders) {
      ui.assetFolders.innerHTML = '';
      for (const f of folders) {
        const btn = document.createElement('button');
        btn.className = 'assetFolderItem' + (cwd === f.path ? ' active' : '');
        btn.type = 'button';
        btn.textContent = f.isRoot ? 'Assets' : f.name;
        btn.addEventListener('click', () => {
          state.cwd = f.path;
          state.selected = null;
          render().catch(console.error);
        });
        ui.assetFolders.appendChild(btn);
      }
    }

    // Right: current folder contents
    const cwdRes = await list(cwd);
    const entries = cwdRes.entries || [];
    if (ui.assetGrid) {
      ui.assetGrid.innerHTML = '';
      for (const ent of entries) {
        const item = document.createElement('div');
        item.className = 'assetItem' + (state.selected === ent.path ? ' selected' : '');
        item.setAttribute('data-path', ent.path);
        item.setAttribute('data-isdir', ent.isDir ? '1' : '0');

        const thumb = document.createElement('div');
        thumb.className = 'assetThumb';
        if (ent.isDir) thumb.textContent = 'FOLDER';
        else {
          const dot = ent.name.lastIndexOf('.');
          const ext = dot >= 0 ? ent.name.slice(dot + 1) : '';
          thumb.textContent = ext ? ext.toUpperCase() : 'FILE';
        }

        const name = document.createElement('div');
        name.className = 'assetName';
        name.textContent = ent.name;

        item.appendChild(thumb);
        item.appendChild(name);
        ui.assetGrid.appendChild(item);
      }
    }
  }

  function ensureContextMenu() {
    if (ctx.menu) return;
    const menu = document.createElement('div');
    menu.className = 'menu contextMenu';
    menu.setAttribute('role', 'menu');
    document.body.appendChild(menu);
    ctx.menu = menu;

    document.addEventListener('click', () => hideContextMenu());
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') hideContextMenu();
    });
    window.addEventListener('blur', () => hideContextMenu());
  }

  function hideContextMenu() {
    if (!ctx.menu || !ctx.visible) return;
    ctx.visible = false;
    ctx.menu.classList.remove('open');
  }

  /** @param {number} x @param {number} y */
  function positionContextMenu(x, y) {
    if (!ctx.menu) return;
    // Start at click position
    ctx.menu.style.left = `${Math.max(4, x)}px`;
    ctx.menu.style.top = `${Math.max(4, y)}px`;

    // Clamp to viewport after layout
    requestAnimationFrame(() => {
      if (!ctx.menu) return;
      const r = ctx.menu.getBoundingClientRect();
      const maxX = Math.max(4, window.innerWidth - r.width - 4);
      const maxY = Math.max(4, window.innerHeight - r.height - 4);
      const nextX = Math.min(Math.max(4, x), maxX);
      const nextY = Math.min(Math.max(4, y), maxY);
      ctx.menu.style.left = `${nextX}px`;
      ctx.menu.style.top = `${nextY}px`;
    });
  }

  /** @param {{ label: string, enabled?: boolean, onClick?: (() => void | Promise<void>) | null }} item */
  function addMenuItem(item) {
    if (!ctx.menu) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'menuItem';
    btn.textContent = item.label;
    const enabled = item.enabled !== false;
    if (!enabled) {
      btn.disabled = true;
      btn.style.opacity = '0.5';
      btn.style.cursor = 'default';
    }
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!enabled) return;
      hideContextMenu();
      Promise.resolve(item.onClick ? item.onClick() : undefined).catch(console.error);
    });
    ctx.menu.appendChild(btn);
  }

  function addMenuSep() {
    if (!ctx.menu) return;
    const sep = document.createElement('div');
    sep.className = 'menuSep';
    ctx.menu.appendChild(sep);
  }

  async function doDeleteSelected() {
    const p = ctx.targetPath;
    if (!p) return;
    if (!confirm(`Delete "${p}"?`)) return;
    const electronAPI = /** @type {any} */ (window).electronAPI;
    const res = await electronAPI.deleteProjectPath(p);
    if (!res || !res.ok) {
      alert(res && res.error ? res.error : 'Delete failed');
      return;
    }
    // If we deleted the currently selected item, clear selection.
    if (state.selected === p) state.selected = null;
    render().catch(console.error);
  }

  async function doOpenExternal() {
    const p = ctx.targetPath;
    if (!p) return;
    const electronAPI = /** @type {any} */ (window).electronAPI;
    const res = await electronAPI.openProjectPathExternal(p);
    if (!res || !res.ok) {
      alert(res && res.error ? res.error : 'Open failed');
    }
  }

  async function doRevealInExplorer() {
    const p = ctx.targetPath;
    if (!p) return;
    const electronAPI = /** @type {any} */ (window).electronAPI;
    const res = await electronAPI.revealProjectPathInExplorer(p, ctx.targetIsDir);
    if (!res || !res.ok) {
      alert(res && res.error ? res.error : 'Reveal failed');
    }
  }

  function doCopy() {
    const p = ctx.targetPath;
    if (!p) return;
    state.clipboard = p;
  }

  async function doPaste() {
    const src = state.clipboard;
    const destDir = ctx.pasteDestDir || state.cwd;
    if (!src || !destDir) return;
    const electronAPI = /** @type {any} */ (window).electronAPI;
    const res = await electronAPI.copyProjectPathToDir(src, destDir);
    if (!res || !res.ok) {
      alert(res && res.error ? res.error : 'Paste failed');
      return;
    }
    render().catch(console.error);
  }

  async function doOpenItem() {
    const p = ctx.targetPath;
    if (!p) return;
    if (ctx.targetIsDir) {
      state.cwd = p;
      state.selected = null;
      state.selectedIsDir = false;
      render().catch(console.error);
      return;
    }
    state.selected = p;
    state.selectedIsDir = false;
    if (onOpenFile) {
      await onOpenFile(p);
    }
    render().catch(console.error);
  }

  /** @param {unknown} t */
  function _isTextInputTarget(t) {
    const el = (t && t instanceof HTMLElement) ? t : null;
    if (!el) return false;
    const tag = (el.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
    if (el.isContentEditable) return true;
    return false;
  }

  /** @param {string} relPath */
  function _basename(relPath) {
    const s = String(relPath || '');
    const i = s.lastIndexOf('/');
    return i >= 0 ? s.slice(i + 1) : s;
  }

  /** @param {string} relPath */
  function _dirname(relPath) {
    const s = String(relPath || '');
    const i = s.lastIndexOf('/');
    return i >= 0 ? s.slice(0, i) : '';
  }

  /** @param {string} name */
  function _safeNameOrNull(name) {
    const s = String(name || '').trim();
    if (!s) return null;
    if (s.includes('/') || s.includes('\\')) return null;
    if (s === '.' || s === '..') return null;
    if (/[\\/:*?"<>|]/.test(s)) return null;
    return s;
  }

  function _ensureRenameModalWired() {
    if (renameUI.modal) return;
    renameUI.modal = /** @type {HTMLDivElement|null} */ (document.getElementById('renameAssetModal'));
    renameUI.closeBtn = /** @type {HTMLButtonElement|null} */ (document.getElementById('renameAssetCloseBtn'));
    renameUI.cancelBtn = /** @type {HTMLButtonElement|null} */ (document.getElementById('renameAssetCancelBtn'));
    renameUI.okBtn = /** @type {HTMLButtonElement|null} */ (document.getElementById('renameAssetOkBtn'));
    renameUI.subtitle = /** @type {HTMLDivElement|null} */ (document.getElementById('renameAssetSubtitle'));
    renameUI.input = /** @type {HTMLInputElement|null} */ (document.getElementById('renameAssetInput'));

    const modal = renameUI.modal;
    if (!modal) return;

    const close = () => _closeRenameModal();
    renameUI.closeBtn?.addEventListener('click', close);
    renameUI.cancelBtn?.addEventListener('click', close);
    modal.addEventListener('mousedown', (e) => {
      if (e.target === modal) close();
    });
    renameUI.okBtn?.addEventListener('click', () => {
      _applyRenameFromModal().catch(console.error);
    });
    renameUI.input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        _applyRenameFromModal().catch(console.error);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        close();
      }
    });
  }

  /** @param {string} relPath @param {boolean} isDir */
  function _openRenameModalFor(relPath, isDir) {
    _ensureRenameModalWired();
    if (!renameUI.modal || !renameUI.input) return;

    const oldRel = String(relPath || '');
    if (!oldRel) return;
    const oldBase = _basename(oldRel);
    if (renameUI.subtitle) renameUI.subtitle.textContent = oldRel;

    renameUI.targetPath = oldRel;
    renameUI.targetIsDir = !!isDir;

    renameUI.modal.hidden = false;
    renameUI.open = true;
    renameUI.input.value = oldBase;
    renameUI.input.focus();
    renameUI.input.select();
  }

  function _openRenameModal() {
    if (!state.selected) return;
    _openRenameModalFor(state.selected, !!state.selectedIsDir);
  }

  function _closeRenameModal() {
    if (!renameUI.modal) return;
    renameUI.modal.hidden = true;
    renameUI.open = false;
  }

  async function _applyRenameFromModal() {
    if (!renameUI.input) return;
    const oldRel = String(renameUI.targetPath || '');
    if (!oldRel) return;

    const electronAPI = /** @type {any} */ (window).electronAPI;
    const canRename = !!(electronAPI && typeof electronAPI.renameProjectPath === 'function');
    if (!canRename) {
      alert('Rename is only available in the Electron editor.');
      return;
    }

    const oldBase = _basename(oldRel);
    const dot = oldBase.lastIndexOf('.');
    const oldExt = (dot > 0 && dot < oldBase.length - 1) ? oldBase.slice(dot) : '';

    let nextName = _safeNameOrNull(renameUI.input.value);
    if (!nextName) {
      alert('Invalid name.');
      return;
    }

    // If user omitted extension, keep the old one (files only).
    if (!renameUI.targetIsDir && oldExt && !nextName.includes('.')) {
      nextName = `${nextName}${oldExt}`;
    }

    if (nextName === oldBase) {
      _closeRenameModal();
      return;
    }

    const res = await electronAPI.renameProjectPath(oldRel, nextName);
    if (!res || !res.ok) {
      alert(res && res.error ? res.error : 'Rename failed');
      return;
    }

    const newRel = String(res.path || '') || (_dirname(oldRel) ? `${_dirname(oldRel)}/${nextName}` : nextName);
    state.selected = newRel;
    state.selectedIsDir = !!renameUI.targetIsDir;
    _closeRenameModal();
    await render();
  }

  /** @param {string} rel */
  function _cleanRel(rel) {
    return String(rel || '').replace(/^[.](?:\\|\/)?/, '').replace(/^\/+/, '').replace(/\\/g, '/');
  }

  /**
   * Create a unique filename inside a directory.
   * @param {string} dirRel
   * @param {string} base
   * @param {string} extWithDot
   */
  async function _pickUniqueName(dirRel, base, extWithDot) {
    const res = await list(dirRel);
    const entries = /** @type {{ name?: string }[]} */ (res.entries || []);
    const existing = new Set(entries.map(e => String(e?.name || '')).filter(Boolean));
    const ext = String(extWithDot || '');
    const safeBase = String(base || 'NewFile');

    let idx = 0;
    while (idx < 9999) {
      const name = idx === 0 ? `${safeBase}${ext}` : `${safeBase}${idx + 1}${ext}`;
      if (!existing.has(name)) return name;
      idx++;
    }
    return `${safeBase}${Date.now()}${ext}`;
  }

  /**
   * Create a file in the given directory and refresh the UI.
   * @param {'scene'|'script'|'material'} kind
   * @param {string} dirRel
   */
  async function doCreate(kind, dirRel) {
    const electronAPI = /** @type {any} */ (window).electronAPI;
    const canUse = !!(electronAPI && typeof electronAPI.getWorkspaceRoot === 'function' && typeof electronAPI.saveProjectFile === 'function' && typeof electronAPI.listProjectDir === 'function');
    if (!canUse) {
      alert('Create is only available in the Electron editor.');
      return;
    }

    const rootRes = await electronAPI.getWorkspaceRoot();
    if (!rootRes || !rootRes.ok || !rootRes.path) {
      alert(`Failed to resolve workspace root: ${rootRes && rootRes.error ? rootRes.error : 'Unknown error'}`);
      return;
    }

    const rootAbs = String(rootRes.path || '').replace(/[\\/]+$/, '');
    const dirClean = _cleanRel(dirRel || state.cwd);

    let base = 'NewFile';
    let ext = '';
    let content = '';

    if (kind === 'scene') {
      base = 'NewScene';
      ext = '.xml';
      content = `<Scene name="NewScene">\n    <Camera name="MainCamera" x="0" y="0" zoom="1" />\n</Scene>\n`;
    } else if (kind === 'script') {
      base = 'NewScript';
      ext = '.js';
      content = `// New Fluxion script\n// (Not auto-wired; import/use it from your game code as needed.)\n\nexport function start(scene) {\n  // TODO\n}\n`;
    } else if (kind === 'material') {
      base = 'NewMaterial';
      ext = '.mat';
      content = JSON.stringify({
        baseColorFactor: '#ffffffff',
        metallicFactor: 0.0,
        roughnessFactor: 0.65,
        normalScale: 1.0,
        aoStrength: 1.0,
        emissiveFactor: [0, 0, 0],
        alphaMode: 'OPAQUE',
        alphaCutoff: 0.5
      }, null, 2) + '\n';
    }

    const filename = await _pickUniqueName(dirClean, base, ext);
    const relPath = dirClean ? `${dirClean}/${filename}` : filename;
    const absPath = `${rootAbs}/${_cleanRel(relPath)}`;

    const res = await electronAPI.saveProjectFile(absPath, content);
    if (!res || !res.ok) {
      alert(res && res.error ? res.error : 'Create failed');
      return;
    }

    state.selected = relPath;
    await render();
  }

  /** @param {MouseEvent} e */
  function onGridContextMenu(e) {
    const electronAPI = /** @type {any} */ (window).electronAPI;
    const canUse = !!(electronAPI && typeof electronAPI.listProjectDir === 'function');
    if (!canUse) return;

    ensureContextMenu();
    if (!ctx.menu) return;

    e.preventDefault();
    e.stopPropagation();

    const t = /** @type {HTMLElement|null} */ (e.target instanceof HTMLElement ? e.target : null);
    const item = t?.closest('.assetItem');
    const targetPath = item?.getAttribute('data-path') || null;
    const targetIsDir = item?.getAttribute('data-isdir') === '1';

    ctx.targetPath = targetPath;
    ctx.targetIsDir = !!targetIsDir;
    // Paste destination: if right-clicked a folder, paste into that folder; otherwise paste into current folder.
    ctx.pasteDestDir = (targetPath && targetIsDir) ? targetPath : state.cwd;

    // Build menu
    ctx.menu.innerHTML = '';

    const hasTarget = !!targetPath;
    addMenuItem({ label: 'Open', enabled: hasTarget, onClick: hasTarget ? doOpenItem : null });
    addMenuItem({ label: 'Open in External Editor', enabled: hasTarget, onClick: hasTarget ? doOpenExternal : null });
    addMenuItem({ label: 'Open in File Explorer', enabled: hasTarget, onClick: hasTarget ? doRevealInExplorer : null });
    addMenuSep();
    addMenuItem({ label: 'Copy', enabled: hasTarget, onClick: hasTarget ? doCopy : null });
    addMenuItem({ label: 'Paste', enabled: !!state.clipboard, onClick: state.clipboard ? doPaste : null });
    addMenuItem({
      label: 'Rename...',
      enabled: hasTarget,
      onClick: hasTarget ? () => {
        // Keep state in sync so the selection follows the rename.
        state.selected = targetPath;
        state.selectedIsDir = !!targetIsDir;
        _openRenameModalFor(String(targetPath || ''), !!targetIsDir);
      } : null,
    });
    addMenuSep();
    // Create
    addMenuItem({
      label: 'Create Scene (.xml)',
      enabled: true,
      onClick: () => doCreate('scene', ctx.pasteDestDir || state.cwd),
    });
    addMenuItem({
      label: 'Create Script (.js)',
      enabled: true,
      onClick: () => doCreate('script', ctx.pasteDestDir || state.cwd),
    });
    addMenuItem({
      label: 'Create Material (.mat)',
      enabled: true,
      onClick: () => doCreate('material', ctx.pasteDestDir || state.cwd),
    });
    addMenuSep();
    addMenuItem({ label: 'Delete', enabled: hasTarget, onClick: hasTarget ? doDeleteSelected : null });

    positionContextMenu(e.clientX, e.clientY);
    ctx.visible = true;
    ctx.menu.classList.add('open');
  }

  function navigateUp() {
    const root = state.root;
    const cwd = state.cwd;
    if (cwd === root) return;
    const parts = cwd.split('/');
    parts.pop();
    const next = parts.join('/') || root;

    // Clamp to root
    if (!next.startsWith(root)) {
      state.cwd = root;
    } else {
      state.cwd = next;
    }
    state.selected = null;
    render().catch(console.error);
  }

  /** @param {MouseEvent} e */
  async function onGridClick(e) {
    const t = /** @type {HTMLElement|null} */ (e.target instanceof HTMLElement ? e.target : null);
    const item = t?.closest('.assetItem');
    if (!item) return;
    const p = item.getAttribute('data-path');
    const isDir = item.getAttribute('data-isdir') === '1';
    if (!p) return;

    state.focused = true;
    if (ui.assetGrid && typeof ui.assetGrid.focus === 'function') {
      ui.assetGrid.focus();
    }

    if (isDir) {
      state.cwd = p;
      state.selected = null;
      state.selectedIsDir = false;
      render().catch(console.error);
      return;
    }

    state.selected = p;
    state.selectedIsDir = false;

    if (onOpenFile) {
      try {
        await onOpenFile(p);
      } catch (err) {
        console.error(err);
      }
    }

    render().catch(console.error);
  }

  function init() {
    // If not running in Electron, show a friendly message.
    const electronAPI = /** @type {any} */ (window).electronAPI;
    const canList = !!(electronAPI && typeof electronAPI.listProjectDir === 'function');
    if (!canList) {
      if (ui.assetFolders) ui.assetFolders.innerHTML = '<div class="hint">Asset browser requires the Electron app.</div>';
      if (ui.assetGrid) ui.assetGrid.innerHTML = '';
      return;
    }

    ui.assetUpBtn?.addEventListener('click', () => navigateUp());
    ui.assetGrid?.addEventListener('click', (e) => onGridClick(e).catch(console.error));
    ui.assetGrid?.addEventListener('contextmenu', onGridContextMenu);

    if (ui.assetGrid) {
      ui.assetGrid.tabIndex = 0;
      ui.assetGrid.addEventListener('mousedown', () => { state.focused = true; });
    }

    document.addEventListener('mousedown', (e) => {
      const t = (e.target instanceof HTMLElement) ? e.target : null;
      if (!t) return;
      if (ui.assetGrid && ui.assetGrid.contains(t)) return;
      state.focused = false;
    });

    document.addEventListener('keydown', (e) => {
      if (e.key !== 'F2') return;
      if (!state.focused) return;
      if (_isTextInputTarget(e.target)) return;
      if (!state.selected || state.selectedIsDir) return;
      e.preventDefault();
      _openRenameModal();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (!renameUI.open) return;
      e.preventDefault();
      _closeRenameModal();
    });

    // Initial render
    render().catch(console.error);
  }

  return {
    init,
    render,
    navigateUp,
    onGridClick,
    state,
  };
}
