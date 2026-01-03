// @ts-check

/**
 * Create Project dialog + Electron IPC workflow extracted from `game.js`.
 */

/**
 * @typedef {{
 *  createProjectModal: HTMLDivElement|null,
 *  createProjectNameInput: HTMLInputElement|null,
 *  createProjectTemplateSelect: HTMLSelectElement|null,
 *  createProjectPathInput: HTMLInputElement|null,
 *  createProjectBrowseBtn: HTMLButtonElement|null,
 *  createProjectOkBtn: HTMLButtonElement|null,
 *  createProjectCancelBtn: HTMLButtonElement|null,
 * }} CreateProjectUI
 */

/**
 * @param {{ ui: CreateProjectUI, closeMenus?: (() => void) | null }} opts
 */
export function createProjectDialog(opts) {
  const ui = opts.ui;
  const closeMenus = opts.closeMenus || null;

  let open = false;
  /** @type {((v: {name: string, parentDir: string, template: string} | null) => void) | null} */
  let resolve = null;
  let lastParentDir = '';
  let lastTemplate = 'empty';
  let busy = false;

  function isOpen() {
    return open;
  }

  /** @param {{name: string, parentDir: string, template: string} | null} v */
  function close(v) {
    if (ui.createProjectModal) ui.createProjectModal.hidden = true;
    open = false;
    const r = resolve;
    resolve = null;
    busy = false;
    if (r) r(v);
  }

  function cancel() {
    close(null);
  }

  async function browseParentDir() {
    const electronAPI = /** @type {any} */ (window).electronAPI;
    if (!electronAPI || typeof electronAPI.selectFolder !== 'function') return null;

    const pick = await electronAPI.selectFolder();
    if (!pick || !pick.ok || pick.canceled) return null;
    const parentDir = String(pick.path || '').trim();
    if (!parentDir) return null;

    lastParentDir = parentDir;
    if (ui.createProjectPathInput) ui.createProjectPathInput.value = parentDir;
    return parentDir;
  }

  async function confirm() {
    if (busy) return;

    const name = String(ui.createProjectNameInput?.value || '').trim();
    if (!name) return;

    busy = true;
    try {
      let parentDir = String(ui.createProjectPathInput?.value || '').trim();
      if (!parentDir) {
        const picked = await browseParentDir();
        if (!picked) return;
        parentDir = picked;
      }

      const template = String(ui.createProjectTemplateSelect?.value || lastTemplate || 'empty').trim() || 'empty';
      lastTemplate = template;

      close({ name, parentDir, template });
    } finally {
      busy = false;
    }
  }

  /** @param {string} initialName */
  function promptOptions(initialName) {
    if (!ui.createProjectModal || !ui.createProjectNameInput || !ui.createProjectPathInput || !ui.createProjectTemplateSelect) {
      alert('Create Project UI is missing.');
      return Promise.resolve(null);
    }

    if (closeMenus) closeMenus();

    open = true;
    ui.createProjectModal.hidden = false;
    ui.createProjectNameInput.value = String(initialName ?? '');
    ui.createProjectPathInput.value = String(lastParentDir || '');
    ui.createProjectTemplateSelect.value = String(lastTemplate || 'empty');
    ui.createProjectNameInput.focus();
    ui.createProjectNameInput.select();

    return new Promise((r) => {
      resolve = r;
    });
  }

  async function createProjectFromEditor(initialName = 'MyFluxionGame') {
    const electronAPI = /** @type {any} */ (window).electronAPI;
    const can = !!(electronAPI && typeof electronAPI.selectFolder === 'function' && typeof electronAPI.createProject === 'function');
    if (!can) {
      alert('Create Project is only available in the Electron editor.');
      return;
    }

    const cfg = await promptOptions(initialName);
    if (!cfg) return;

    const res = await electronAPI.createProject({ parentDir: cfg.parentDir, name: cfg.name, template: cfg.template });
    if (!res || !res.ok) {
      alert(`Failed to create project: ${res && res.error ? res.error : 'Unknown error'}`);
      return;
    }

    alert(`Project created at:\n${res.path}\n\nNext:\n  npm install\n  npm start`);
  }

  function init() {
    ui.createProjectCancelBtn?.addEventListener('click', () => cancel());
    ui.createProjectOkBtn?.addEventListener('click', () => confirm().catch(console.error));
    ui.createProjectBrowseBtn?.addEventListener('click', () => browseParentDir().catch(console.error));

    ui.createProjectModal?.addEventListener('mousedown', (e) => {
      if (e.target === ui.createProjectModal) cancel();
    });

    ui.createProjectNameInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        confirm().catch(console.error);
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        cancel();
      }
    });

    ui.createProjectPathInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        confirm().catch(console.error);
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        cancel();
      }
    });

    ui.createProjectTemplateSelect?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        confirm().catch(console.error);
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        cancel();
      }
    });
  }

  return {
    init,
    isOpen,
    cancel,
    createProjectFromEditor,
    promptOptions,
  };
}
