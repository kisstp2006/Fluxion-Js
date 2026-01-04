// @ts-check

/**
 * Editor Settings logic extracted from `game.js`.
 *
 * This module owns:
 * - persistence (localStorage)
 * - settings modal open/close
 * - settings UI rebuild + filter + category selection
 *
 * It relies on the host editor (the `game` object in `game.js`) for:
 * - `this._editorSettings` state
 * - `this._addToggleWith(...)` and `this._addNumberWith(...)` UI helpers
 */

/**
 * @typedef {{
 *  editorSettingsModal: HTMLDivElement|null,
 *  editorSettingsCloseBtn: HTMLButtonElement|null,
 *  editorSettingsFilterInput: HTMLInputElement|null,
 *  editorSettingsNav: HTMLDivElement|null,
 *  editorSettingsSectionTitle: HTMLDivElement|null,
 *  editorSettingsForm: HTMLDivElement|null,
 *  editorSettingsCatGeneral: HTMLButtonElement|null,
 *  editorSettingsCatGrid2D: HTMLButtonElement|null,
 *  editorSettingsCatGrid3D: HTMLButtonElement|null,
 *  overlay: HTMLDivElement|null,
 *  _closeTopbarMenus?: (() => void) | null,
 * }} EditorSettingsUI
 */

/**
 * @typedef {{
 *  _editorSettingsOpen: boolean,
 *  _editorSettingsCategory: 'general'|'grid2d'|'grid3d',
 *  _editorSettingsFilter: string,
 *  _editorSettings: {
 *    general: { showHelpOverlay: boolean },
 *    grid2d: { enabled: boolean, baseMinor: number, majorMultiplier: number, minGridPx: number, maxGridLines: number, showAxes: boolean },
 *    grid3d: { enabled: boolean, autoScale: boolean, minor: number, majorMultiplier: number, halfSpan: number, showAxes: boolean }
 *  },
 *  _helpVisible: boolean,
 *  _addToggleWith: (container: HTMLElement|null, label: string, obj: any, key: string, onChanged: () => void) => void,
 *  _addNumberWith: (container: HTMLElement|null, label: string, obj: any, key: string, onChanged: () => void, opts?: any) => void,
 *  _closeTopbarMenus: () => void,
 * }} EditorSettingsHost
 */

export function loadEditorSettingsFromStorage(/** @type {EditorSettingsHost} */ host) {
  try {
    const raw = localStorage.getItem('fluxion.editor.settings.v1');
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return;

    const cur = host._editorSettings;
    if (!cur) return;

    const p = /** @type {any} */ (parsed);
    if (p.general && typeof p.general === 'object') {
      if (typeof p.general.showHelpOverlay === 'boolean') cur.general.showHelpOverlay = p.general.showHelpOverlay;
    }
    if (p.grid2d && typeof p.grid2d === 'object') {
      if (typeof p.grid2d.enabled === 'boolean') cur.grid2d.enabled = p.grid2d.enabled;
      if (Number.isFinite(Number(p.grid2d.baseMinor))) cur.grid2d.baseMinor = Number(p.grid2d.baseMinor);
      if (Number.isFinite(Number(p.grid2d.majorMultiplier))) cur.grid2d.majorMultiplier = Number(p.grid2d.majorMultiplier);
      if (Number.isFinite(Number(p.grid2d.minGridPx))) cur.grid2d.minGridPx = Number(p.grid2d.minGridPx);
      if (Number.isFinite(Number(p.grid2d.maxGridLines))) cur.grid2d.maxGridLines = Number(p.grid2d.maxGridLines);
      if (typeof p.grid2d.showAxes === 'boolean') cur.grid2d.showAxes = p.grid2d.showAxes;
    }
    if (p.grid3d && typeof p.grid3d === 'object') {
      if (typeof p.grid3d.enabled === 'boolean') cur.grid3d.enabled = p.grid3d.enabled;
      if (typeof p.grid3d.autoScale === 'boolean') cur.grid3d.autoScale = p.grid3d.autoScale;
      if (Number.isFinite(Number(p.grid3d.minor))) cur.grid3d.minor = Number(p.grid3d.minor);
      if (Number.isFinite(Number(p.grid3d.majorMultiplier))) cur.grid3d.majorMultiplier = Number(p.grid3d.majorMultiplier);
      if (Number.isFinite(Number(p.grid3d.halfSpan))) cur.grid3d.halfSpan = Number(p.grid3d.halfSpan);
      if (typeof p.grid3d.showAxes === 'boolean') cur.grid3d.showAxes = p.grid3d.showAxes;
    }
  } catch {
    // ignore
  }
}

export function saveEditorSettingsToStorage(/** @type {EditorSettingsHost} */ host) {
  try {
    localStorage.setItem('fluxion.editor.settings.v1', JSON.stringify(host._editorSettings));
  } catch {
    // ignore
  }
}

export function applyEditorSettingsFilter(/** @type {EditorSettingsHost} */ host, /** @type {EditorSettingsUI} */ ui) {
  const form = ui.editorSettingsForm;
  if (!form) return;
  const q = String(host._editorSettingsFilter || '').trim().toLowerCase();
  const fields = Array.from(form.querySelectorAll('.field'));
  if (!q) {
    for (const f of fields) /** @type {HTMLElement} */ (f).style.display = '';
    return;
  }

  for (const f of fields) {
    const label = /** @type {HTMLElement|null} */ (f.querySelector('.label'));
    const text = String(label?.textContent || '').toLowerCase();
    /** @type {HTMLElement} */ (f).style.display = text.includes(q) ? '' : 'none';
  }
}

/** @param {'general'|'grid2d'|'grid3d'} cat */
export function setEditorSettingsCategory(/** @type {EditorSettingsHost} */ host, /** @type {EditorSettingsUI} */ ui, cat) {
  host._editorSettingsCategory = cat;

  const items = [ui.editorSettingsCatGeneral, ui.editorSettingsCatGrid2D, ui.editorSettingsCatGrid3D];
  for (const b of items) {
    if (!b) continue;
    const bCat = b.getAttribute('data-cat');
    const active = bCat === cat;
    b.classList.toggle('active', active);
    b.setAttribute('aria-selected', active ? 'true' : 'false');
  }
}

export function rebuildEditorSettingsUI(/** @type {EditorSettingsHost} */ host, /** @type {EditorSettingsUI} */ ui) {
  if (!ui.editorSettingsForm || !ui.editorSettingsSectionTitle) return;

  setEditorSettingsCategory(host, ui, host._editorSettingsCategory);

  const cat = host._editorSettingsCategory;
  ui.editorSettingsSectionTitle.textContent = (cat === 'general') ? 'General' : (cat === 'grid2d' ? '2D Grid' : '3D Grid');
  ui.editorSettingsForm.innerHTML = '';

  if (cat === 'general') {
    const obj = host._editorSettings.general;
    host._addToggleWith(ui.editorSettingsForm, 'Show help overlay', obj, 'showHelpOverlay', () => {
      host._helpVisible = !!obj.showHelpOverlay;
      if (ui.overlay) ui.overlay.style.display = host._helpVisible ? 'block' : 'none';
      saveEditorSettingsToStorage(host);
    });
  } else if (cat === 'grid2d') {
    const obj = host._editorSettings.grid2d;
    host._addToggleWith(ui.editorSettingsForm, 'Enabled', obj, 'enabled', () => saveEditorSettingsToStorage(host));
    host._addToggleWith(ui.editorSettingsForm, 'Show axes', obj, 'showAxes', () => saveEditorSettingsToStorage(host));
    host._addNumberWith(ui.editorSettingsForm, 'Minor spacing', obj, 'baseMinor', () => saveEditorSettingsToStorage(host), { step: 1, min: 0.0001 });
    host._addNumberWith(ui.editorSettingsForm, 'Major multiplier', obj, 'majorMultiplier', () => saveEditorSettingsToStorage(host), { step: 1, min: 1 });
    host._addNumberWith(ui.editorSettingsForm, 'Min grid pixels', obj, 'minGridPx', () => saveEditorSettingsToStorage(host), { step: 1, min: 1 });
    host._addNumberWith(ui.editorSettingsForm, 'Max grid lines', obj, 'maxGridLines', () => saveEditorSettingsToStorage(host), { step: 1, min: 10 });
  } else {
    const obj = host._editorSettings.grid3d;
    host._addToggleWith(ui.editorSettingsForm, 'Enabled', obj, 'enabled', () => saveEditorSettingsToStorage(host));
    host._addToggleWith(ui.editorSettingsForm, 'Auto scale', obj, 'autoScale', () => saveEditorSettingsToStorage(host));
    host._addToggleWith(ui.editorSettingsForm, 'Show axes', obj, 'showAxes', () => saveEditorSettingsToStorage(host));
    host._addNumberWith(ui.editorSettingsForm, 'Minor spacing', obj, 'minor', () => saveEditorSettingsToStorage(host), { step: 0.1, min: 0.0001 });
    host._addNumberWith(ui.editorSettingsForm, 'Major multiplier', obj, 'majorMultiplier', () => saveEditorSettingsToStorage(host), { step: 1, min: 1 });
    host._addNumberWith(ui.editorSettingsForm, 'Half span', obj, 'halfSpan', () => saveEditorSettingsToStorage(host), { step: 1, min: 1 });
  }

  if (ui.editorSettingsFilterInput) {
    ui.editorSettingsFilterInput.value = String(host._editorSettingsFilter || '');
  }
  applyEditorSettingsFilter(host, ui);
}

export function openEditorSettings(/** @type {EditorSettingsHost} */ host, /** @type {EditorSettingsUI} */ ui) {
  if (!ui.editorSettingsModal) return;
  host._editorSettingsOpen = true;
  ui.editorSettingsModal.hidden = false;

  rebuildEditorSettingsUI(host, ui);
  host._closeTopbarMenus();
  ui.editorSettingsCloseBtn?.focus();
}

export function closeEditorSettings(/** @type {EditorSettingsHost} */ host, /** @type {EditorSettingsUI} */ ui) {
  if (!ui.editorSettingsModal) return;
  host._editorSettingsOpen = false;
  ui.editorSettingsModal.hidden = true;
}

export function wireEditorSettingsUI(/** @type {EditorSettingsHost} */ host, /** @type {EditorSettingsUI} */ ui) {
  // Close behavior
  ui.editorSettingsCloseBtn?.addEventListener('click', () => closeEditorSettings(host, ui));
  ui.editorSettingsModal?.addEventListener('mousedown', (e) => {
    if (e.target === ui.editorSettingsModal) closeEditorSettings(host, ui);
  });

  // Category navigation
  ui.editorSettingsNav?.addEventListener('click', (e) => {
    const t = /** @type {HTMLElement|null} */ (e.target instanceof HTMLElement ? e.target : null);
    const btn = /** @type {HTMLButtonElement|null} */ (t?.closest('button[data-cat]') || null);
    const cat = /** @type {any} */ (btn?.getAttribute('data-cat'));
    if (cat !== 'general' && cat !== 'grid2d' && cat !== 'grid3d') return;
    host._editorSettingsCategory = cat;
    rebuildEditorSettingsUI(host, ui);
  });

  // Filter
  ui.editorSettingsFilterInput?.addEventListener('input', () => {
    host._editorSettingsFilter = String(ui.editorSettingsFilterInput?.value || '');
    applyEditorSettingsFilter(host, ui);
  });
}
