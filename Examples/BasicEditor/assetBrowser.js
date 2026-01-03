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
