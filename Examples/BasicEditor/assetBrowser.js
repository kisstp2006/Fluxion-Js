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
    clipboard: /** @type {string|null} */ (null),
  };

  const ctx = {
    menu: /** @type {HTMLDivElement|null} */ (null),
    visible: false,
    targetPath: /** @type {string|null} */ (null),
    targetIsDir: false,
    pasteDestDir: /** @type {string|null} */ (null),
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
      render().catch(console.error);
      return;
    }
    state.selected = p;
    if (onOpenFile) {
      await onOpenFile(p);
    }
    render().catch(console.error);
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

    if (isDir) {
      state.cwd = p;
      state.selected = null;
      render().catch(console.error);
      return;
    }

    state.selected = p;

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
