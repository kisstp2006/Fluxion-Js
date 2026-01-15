// @ts-check

/**
 * Topbar mounting helpers for the MenuBar.
 */

/**
 * @param {any} menuBar
 * @param {any} host
 * @param {{ selector?: string, addReloadButton?: boolean }=} options
 */
export function mountMenuBarToTopbar(menuBar, host, options) {
  const selector = (options && options.selector) ? String(options.selector) : '.topbar';
  const addReloadButton = (options && typeof options.addReloadButton === 'boolean') ? options.addReloadButton : true;

  const topbar = /** @type {HTMLElement|null} */ (document.querySelector(selector));
  if (!topbar || !menuBar) return;

  menuBar.mount(topbar, host);

  if (!addReloadButton) return;

  const reloadBtn = document.createElement('button');
  reloadBtn.className = 'menuBtn';
  reloadBtn.type = 'button';
  reloadBtn.textContent = 'Reload (Ctrl+R)';
  reloadBtn.addEventListener('click', () => window.location.reload());
  topbar.appendChild(reloadBtn);
}
