// @ts-check

/**
 * Create Script dialog extracted from `game.js`.
 * Prompts for script name, folder (project-relative), template, and optional actions.
 */

/**
 * @typedef {{
 *  createScriptModal: HTMLDivElement|null,
 *  createScriptTitle: HTMLDivElement|null,
 *  createScriptSubtitle: HTMLDivElement|null,
 *  createScriptNameInput: HTMLInputElement|null,
 *  createScriptFolderInput: HTMLInputElement|null,
 *  createScriptUseAssetCwdBtn: HTMLButtonElement|null,
 *  createScriptTemplateSelect: HTMLSelectElement|null,
 *  createScriptAttachToggle: HTMLInputElement|null,
 *  createScriptOpenToggle: HTMLInputElement|null,
 *  createScriptOkBtn: HTMLButtonElement|null,
 *  createScriptCancelBtn: HTMLButtonElement|null,
 *  createScriptError: HTMLDivElement|null,
 * }} CreateScriptUI
 */

/**
 * @typedef {{
 *  name: string,
 *  folderRel: string,
 *  template: 'class'|'functions'|'empty',
 *  attachToSelection: boolean,
 *  openAfterCreate: boolean,
 * }} CreateScriptConfig
 */

/**
 * @param {{ ui: CreateScriptUI, closeMenus?: (() => void) | null }} opts
 */
export function createScriptDialog(opts) {
  const ui = opts.ui;
  const closeMenus = opts.closeMenus || null;

  let open = false;
  let busy = false;
  /** @type {((v: CreateScriptConfig | null) => void) | null} */
  let resolve = null;

  let lastFolderRel = 'src/scripts';
  /** @type {CreateScriptConfig['template']} */
  let lastTemplate = 'class';
  let lastAttach = true;
  let lastOpenAfter = true;

  function isOpen() {
    return open;
  }

  /** @param {string} s */
  function _cleanRel(s) {
    return String(s || '')
      .trim()
      .replace(/\\/g, '/')
      .replace(/^\.(?:\/)?/, '')
      .replace(/^\/+/, '')
      .replace(/\/+$/, '')
      .replace(/\/\/+?/g, '/')
      .trim();
  }

  /** @param {string} msg */
  function _setError(msg) {
    if (ui.createScriptError) {
      ui.createScriptError.textContent = String(msg || '');
      ui.createScriptError.style.display = msg ? '' : 'none';
    }
  }

  /** @param {CreateScriptConfig | null} v */
  function close(v) {
    if (ui.createScriptModal) ui.createScriptModal.hidden = true;
    open = false;
    busy = false;
    _setError('');
    const r = resolve;
    resolve = null;
    if (r) r(v);
  }

  function cancel() {
    close(null);
  }

  function _getAssetCwdRel() {
    try {
      const v = /** @type {any} */ (window).__fluxionAssetCwd;
      const s = String(v || '').trim();
      return _cleanRel(s);
    } catch {
      return '';
    }
  }

  function _applyUseAssetCwd() {
    const cwd = _getAssetCwdRel();
    if (!cwd) return;
    if (ui.createScriptFolderInput) ui.createScriptFolderInput.value = cwd;
    lastFolderRel = cwd;
  }

  async function confirm() {
    if (busy) return;

    const nameRaw = String(ui.createScriptNameInput?.value || '').trim();
    if (!nameRaw) {
      _setError('Script name is required.');
      return;
    }

    busy = true;
    try {
      const folderRel = _cleanRel(String(ui.createScriptFolderInput?.value || lastFolderRel || ''));
      const template = /** @type {CreateScriptConfig['template']} */ (String(ui.createScriptTemplateSelect?.value || lastTemplate || 'class'));
      const attachToSelection = !!ui.createScriptAttachToggle?.checked;
      const openAfterCreate = !!ui.createScriptOpenToggle?.checked;

      lastFolderRel = folderRel || lastFolderRel;
      lastTemplate = template || lastTemplate;
      lastAttach = attachToSelection;
      lastOpenAfter = openAfterCreate;

      close({
        name: nameRaw,
        folderRel: folderRel,
        template,
        attachToSelection,
        openAfterCreate,
      });
    } finally {
      busy = false;
    }
  }

  /**
   * @param {{ initialName?: string, initialFolderRel?: string, canAttach?: boolean, selectionLabel?: string }} args
   */
  function promptOptions(args = {}) {
    if (!ui.createScriptModal || !ui.createScriptNameInput || !ui.createScriptFolderInput || !ui.createScriptTemplateSelect) {
      alert('Create Script UI is missing.');
      return Promise.resolve(null);
    }

    if (closeMenus) closeMenus();

    open = true;
    busy = false;
    _setError('');

    const initialName = String(args.initialName || '').trim();
    const initialFolderRel = _cleanRel(String(args.initialFolderRel || ''));
    const canAttach = args.canAttach !== false;

    if (ui.createScriptTitle) ui.createScriptTitle.textContent = 'Create Script';
    if (ui.createScriptSubtitle) ui.createScriptSubtitle.textContent = String(args.selectionLabel || '');

    ui.createScriptModal.hidden = false;
    ui.createScriptNameInput.value = initialName || 'NewScript.js';
    ui.createScriptFolderInput.value = initialFolderRel || lastFolderRel || 'src/scripts';
    ui.createScriptTemplateSelect.value = String(lastTemplate || 'class');

    if (ui.createScriptAttachToggle) {
      ui.createScriptAttachToggle.disabled = !canAttach;
      ui.createScriptAttachToggle.checked = canAttach ? lastAttach : false;
    }
    if (ui.createScriptOpenToggle) {
      ui.createScriptOpenToggle.checked = lastOpenAfter;
    }

    // Offer a nice default: select base name without extension.
    ui.createScriptNameInput.focus();
    const v = ui.createScriptNameInput.value;
    const dot = v.lastIndexOf('.');
    if (dot > 0) ui.createScriptNameInput.setSelectionRange(0, dot);
    else ui.createScriptNameInput.select();

    return new Promise((r) => {
      resolve = r;
    });
  }

  function init() {
    ui.createScriptCancelBtn?.addEventListener('click', () => cancel());
    ui.createScriptOkBtn?.addEventListener('click', () => confirm().catch(console.error));
    ui.createScriptUseAssetCwdBtn?.addEventListener('click', () => _applyUseAssetCwd());

    ui.createScriptModal?.addEventListener('mousedown', (e) => {
      if (e.target === ui.createScriptModal) cancel();
    });

    /** @param {KeyboardEvent} e */
    const onKey = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        confirm().catch(console.error);
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        cancel();
      }
    };

    ui.createScriptNameInput?.addEventListener('keydown', onKey);
    ui.createScriptFolderInput?.addEventListener('keydown', onKey);
    ui.createScriptTemplateSelect?.addEventListener('keydown', onKey);

    // Clear error when user edits.
    ui.createScriptNameInput?.addEventListener('input', () => _setError(''));
    ui.createScriptFolderInput?.addEventListener('input', () => _setError(''));
  }

  return {
    init,
    isOpen,
    cancel,
    promptOptions,
  };
}
