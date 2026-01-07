// @ts-check

/**
 * About dialog logic extracted from `game.js`.
 */

/**
 * @typedef {{
 *  aboutModal: HTMLDivElement|null,
 *  aboutCloseBtn: HTMLButtonElement|null,
 *  aboutVersionsText: HTMLTextAreaElement|null,
 *  aboutCopyBtn: HTMLButtonElement|null,
 * }} AboutUI
 */

/**
 * @typedef {{
 *  _aboutOpen: boolean,
 *  _closeTopbarMenus: () => void,
 * }} AboutHost
 */

/** @param {string} text @param {HTMLTextAreaElement|null} fallbackTextarea */
async function copyTextToClipboard(text, fallbackTextarea) {
  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(String(text));
      return;
    }
  } catch {}

  // Fallback: select textarea content and use execCommand.
  const ta = fallbackTextarea;
  if (ta) {
    ta.focus();
    ta.select();
    document.execCommand?.('copy');
  }
}

/** @param {AboutUI} ui */
export async function populateAboutVersions(ui) {
  if (!ui.aboutVersionsText) return;

  ui.aboutVersionsText.value = 'Loading...';

  /** @type {string[]} */
  const lines = [];

  let engine = null;
  const electronAPI = /** @type {any} */ (window).electronAPI;
  if (electronAPI && typeof electronAPI.getVersions === 'function') {
    const res = await electronAPI.getVersions();
    if (res && res.ok) {
      engine = res.engine || null;
      if (res.app && (res.app.name || res.app.version)) {
        lines.push(`App: ${String(res.app.name || 'Fluxion')}${res.app.version ? ' ' + String(res.app.version) : ''}`);
      }
      if (res.electron) lines.push(`Electron: ${String(res.electron)}`);
      if (res.npm) lines.push(`npm: ${String(res.npm)}`);
      if (res.node) lines.push(`Node: ${String(res.node)}`);
      if (res.chrome) lines.push(`Chrome: ${String(res.chrome)}`);
    }
  }

  // Fallback for engine version if not provided via IPC.
  if (!engine) {
    try {
      const r = await fetch('../../Fluxion/version.py');
      if (r.ok) {
        const txt = await r.text();
        const mVer = /^\s*VERSION\s*=\s*\"([^\"]*)\"/m.exec(txt);
        const mCode = /^\s*CODENAME\s*=\s*\"([^\"]*)\"/m.exec(txt);
        engine = { version: mVer ? mVer[1] : null, codename: mCode ? mCode[1] : null };
      }
    } catch {}
  }

  if (engine && (engine.version || engine.codename)) {
    const tag = `${engine.version ? String(engine.version) : ''}${engine.codename ? ' (' + String(engine.codename) + ')' : ''}`.trim();
    lines.unshift(`Engine: ${tag}`);
  }

  if (lines.length === 0) {
    lines.push('Version info unavailable in this runtime.');
  }

  ui.aboutVersionsText.value = lines.join('\n');
}

export function openAbout(/** @type {AboutHost} */ host, /** @type {AboutUI} */ ui) {
  if (!ui.aboutModal) return;
  host._aboutOpen = true;
  ui.aboutModal.hidden = false;
  populateAboutVersions(ui).catch(console.error);
  host._closeTopbarMenus();
  ui.aboutCloseBtn?.focus();
}

export function closeAbout(/** @type {AboutHost} */ host, /** @type {AboutUI} */ ui) {
  if (!ui.aboutModal) return;
  host._aboutOpen = false;
  ui.aboutModal.hidden = true;
}

export function wireAboutUI(/** @type {AboutHost} */ host, /** @type {AboutUI} */ ui) {
  // Ensure About starts closed.
  if (ui.aboutModal) ui.aboutModal.hidden = true;

  ui.aboutCloseBtn?.addEventListener('click', () => closeAbout(host, ui));
  ui.aboutModal?.addEventListener('mousedown', (e) => {
    // Click outside the dialog closes.
    if (e.target === ui.aboutModal) closeAbout(host, ui);
  });

  ui.aboutCopyBtn?.addEventListener('click', () => {
    const text = String(ui.aboutVersionsText?.value || '').trim();
    if (!text) return;
    copyTextToClipboard(text, ui.aboutVersionsText).catch(console.error);
  });
}
