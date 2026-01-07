// @ts-check

/**
 * Project selection modal + Recent Projects persistence extracted from `game.js`.
 */

/**
 * @typedef {{
 *  projectSelectModal: HTMLDivElement|null,
 *  projectSelectCreateBtn: HTMLButtonElement|null,
 *  projectSelectOpenBtn: HTMLButtonElement|null,
 *  projectSelectOpenLegacyBtn: HTMLButtonElement|null,
 *  projectSelectRecentList: HTMLDivElement|null,
 * }} ProjectSelectUI
 */

/**
 * @param {any} host
 * @param {ProjectSelectUI} ui
 */
export function wireProjectSelectionUI(host, ui) {
  // Project Select behavior (mandatory - cannot dismiss without choosing/creating)
  ui.projectSelectCreateBtn?.addEventListener('click', () => host._createAndOpenNewProject().catch(console.error));
  ui.projectSelectOpenBtn?.addEventListener('click', () => host._openProjectFolderStrict().catch(console.error));
  ui.projectSelectOpenLegacyBtn?.addEventListener('click', () => host._openLegacyProjectFolder().catch(console.error));
}

/** @param {any} host @param {ProjectSelectUI} ui */
export function openProjectSelect(host, ui) {
  if (!ui.projectSelectModal) return;
  host._projectSelectOpen = true;
  ui.projectSelectModal.hidden = false;
  loadRecentProjectsFromStorage(host);
  renderProjectSelectRecents(host, ui);
  ui.projectSelectOpenBtn?.focus();
}

/** @param {any} host @param {ProjectSelectUI} ui */
export function closeProjectSelect(host, ui) {
  if (!ui.projectSelectModal) return;
  host._projectSelectOpen = false;
  ui.projectSelectModal.hidden = true;
}

/** @param {any} host @param {ProjectSelectUI} ui */
export async function createAndOpenNewProject(host, ui) {
  const electronAPI = /** @type {any} */ (window).electronAPI;
  if (!electronAPI || typeof electronAPI.createProject !== 'function' || typeof electronAPI.setWorkspaceRoot !== 'function') {
    alert('Create Project is only available in the Electron editor.');
    return;
  }

  const cfg = await host._createProjectDialog?.promptOptions?.('MyFluxionGame');
  if (!cfg) return;

  const res = await electronAPI.createProject({ parentDir: cfg.parentDir, name: cfg.name, template: cfg.template });
  if (!res || !res.ok || !res.path) {
    alert(`Failed to create project: ${res && res.error ? res.error : 'Unknown error'}`);
    return;
  }

  const setRes = await electronAPI.setWorkspaceRoot(String(res.path));
  if (!setRes || !setRes.ok) {
    alert(`Failed to open project: ${setRes && setRes.error ? setRes.error : 'Unknown error'}`);
    return;
  }

  await host._setAssetBrowserRoot('.');
  await host._tryLoadProjectMainScene();
  await host._loadProjectMetaFromWorkspace();
  rememberRecentProject(host, ui, String(res.path), false);
  closeProjectSelect(host, ui);
}

/** @param {any} host @param {ProjectSelectUI} ui */
export async function openProjectFolderStrict(host, ui) {
  const electronAPI = /** @type {any} */ (window).electronAPI;
  if (!electronAPI || typeof electronAPI.selectFolder !== 'function' || typeof electronAPI.setWorkspaceRoot !== 'function' || typeof electronAPI.getWorkspaceRoot !== 'function' || typeof electronAPI.listProjectDir !== 'function') {
    alert('Open Project is only available in the Electron editor.');
    return;
  }

  const prev = await electronAPI.getWorkspaceRoot();
  const prevPath = prev && prev.ok && prev.path ? String(prev.path) : null;

  const pick = await electronAPI.selectFolder();
  if (!pick || !pick.ok || pick.canceled) return;
  const abs = String(pick.path || '').trim();
  if (!abs) return;

  const setRes = await electronAPI.setWorkspaceRoot(abs);
  if (!setRes || !setRes.ok) {
    alert(`Failed to set workspace root: ${setRes && setRes.error ? setRes.error : 'Unknown error'}`);
    return;
  }

  const rootList = await electronAPI.listProjectDir('.');
  const entries = (rootList && rootList.ok && Array.isArray(rootList.entries))
    ? /** @type {{ name?: string }[]} */ (rootList.entries)
    : /** @type {{ name?: string }[]} */ ([]);

  const hasJsonProject = entries.some((ent) => String(ent?.name || '') === 'fluxion.project.json');
  const fluxProjects = entries
    .map((ent) => String(ent?.name || ''))
    .filter((name) => name.toLowerCase().endsWith('.flux'))
    .sort();
  const hasFluxProject = fluxProjects.length > 0;

  if (!hasJsonProject && !hasFluxProject) {
    // Revert
    if (prevPath) await electronAPI.setWorkspaceRoot(prevPath);
    alert('That folder does not look like a Fluxion project (missing fluxion.project.json or *.flux).\n\nUse "Open Legacy Project..." to open arbitrary folders.');
    return;
  }

  await host._setAssetBrowserRoot('.');
  await host._tryLoadProjectMainScene(hasJsonProject ? null : (fluxProjects[0] || null));
  await host._loadProjectMetaFromWorkspace();
  rememberRecentProject(host, ui, abs, false);
  closeProjectSelect(host, ui);
}

/** @param {any} host @param {ProjectSelectUI} ui */
export async function openLegacyProjectFolder(host, ui) {
  const ok = await host._openWorkspaceFolder().catch(/** @param {any} e */ (e) => {
    console.error(e);
    return false;
  });
  if (!ok) return;

  try {
    const electronAPI = /** @type {any} */ (window).electronAPI;
    if (electronAPI && typeof electronAPI.getWorkspaceRoot === 'function') {
      const root = await electronAPI.getWorkspaceRoot();
      const abs = root && root.ok && root.path ? String(root.path) : '';
      if (abs) rememberRecentProject(host, ui, abs, true);
    }
  } catch {}

  // Legacy projects may not have fluxion.project.json; keep the scene as-is.
  await host._loadProjectMetaFromWorkspace();
  closeProjectSelect(host, ui);
}

/** @param {any} host */
export function loadRecentProjectsFromStorage(host) {
  try {
    const raw = localStorage.getItem('fluxion.editor.recentProjects');
    const parsed = raw ? JSON.parse(raw) : null;
    const arr = Array.isArray(parsed) ? parsed : [];
    /** @type {{ path: string, legacy: boolean, t: number }[]} */
    const cleaned = [];
    for (const it of arr) {
      const path = String(it && it.path ? it.path : '').trim();
      if (!path) continue;
      const legacy = Boolean(it && it.legacy);
      const t = Math.max(0, Number(it && it.t ? it.t : 0) || 0);
      cleaned.push({ path, legacy, t });
    }
    cleaned.sort((a, b) => (b.t - a.t));
    host._recentProjects = cleaned.slice(0, Math.max(1, (host._recentProjectsMax | 0) || 10));
  } catch {
    host._recentProjects = [];
  }
}

/** @param {any} host */
export function saveRecentProjectsToStorage(host) {
  try {
    localStorage.setItem('fluxion.editor.recentProjects', JSON.stringify(host._recentProjects));
  } catch {}
}

/** @param {any} host @param {ProjectSelectUI} ui @param {string} absPath @param {boolean} legacy */
export function rememberRecentProject(host, ui, absPath, legacy) {
  const path = String(absPath || '').trim();
  if (!path) return;

  const key = path.toLowerCase();
  host._recentProjects = (Array.isArray(host._recentProjects) ? host._recentProjects : [])
    .filter(/** @param {any} p */ (p) => String(p?.path || '').toLowerCase() !== key);

  host._recentProjects.unshift({ path, legacy: Boolean(legacy), t: Date.now() });
  host._recentProjects = host._recentProjects.slice(0, Math.max(1, (host._recentProjectsMax | 0) || 10));
  saveRecentProjectsToStorage(host);
  renderProjectSelectRecents(host, ui);
}

/** @param {any} host @param {ProjectSelectUI} ui @param {string} absPath */
export function removeRecentProject(host, ui, absPath) {
  const path = String(absPath || '').trim();
  if (!path) return;
  const key = path.toLowerCase();
  host._recentProjects = (Array.isArray(host._recentProjects) ? host._recentProjects : [])
    .filter(/** @param {any} p */ (p) => String(p?.path || '').toLowerCase() !== key);
  saveRecentProjectsToStorage(host);
  renderProjectSelectRecents(host, ui);
}

/** @param {string} p */
function pathBaseName(p) {
  const s = String(p || '').replace(/[\\/]+$/, '');
  const parts = s.split(/[\\/]/g).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : s;
}

/** @param {any} host @param {ProjectSelectUI} ui */
export function renderProjectSelectRecents(host, ui) {
  const wrap = ui.projectSelectRecentList;
  if (!wrap) return;

  wrap.replaceChildren();

  const items = Array.isArray(host._recentProjects) ? host._recentProjects : [];
  if (items.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'recentProjectEmpty';
    empty.textContent = 'No recent projects yet.';
    wrap.appendChild(empty);
    return;
  }

  for (const ent of items) {
    const path = String(ent?.path || '').trim();
    if (!path) continue;
    const legacy = Boolean(ent?.legacy);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'recentProjectBtn';
    btn.addEventListener('click', () => {
      openRecentProject(host, ui, { path, legacy }).catch(console.error);
    });

    const top = document.createElement('div');
    top.className = 'recentProjectTopRow';

    const name = document.createElement('div');
    name.className = 'recentProjectName';
    name.textContent = pathBaseName(path);

    top.appendChild(name);

    if (legacy) {
      const badge = document.createElement('div');
      badge.className = 'recentProjectBadge recentProjectBadgeLegacy';
      badge.textContent = 'LEGACY';
      top.appendChild(badge);
    }

    const p = document.createElement('div');
    p.className = 'recentProjectPath';
    p.textContent = path;

    btn.appendChild(top);
    btn.appendChild(p);

    wrap.appendChild(btn);
  }
}

/** @param {any} host @param {ProjectSelectUI} ui @param {{ path: string, legacy: boolean }} ent */
export async function openRecentProject(host, ui, ent) {
  const path = String(ent?.path || '').trim();
  if (!path) return;

  if (ent.legacy) {
    const ok = await openWorkspaceAtPath(host, ui, path);
    if (!ok) return;
    // Legacy projects may not have fluxion.project.json; keep the scene as-is.
    await host._loadProjectMetaFromWorkspace();
    rememberRecentProject(host, ui, path, true);
    closeProjectSelect(host, ui);
    return;
  }

  const ok = await openProjectAtPathStrict(host, ui, path);
  if (!ok) return;
  rememberRecentProject(host, ui, path, false);
  closeProjectSelect(host, ui);
}

/** @param {any} host @param {ProjectSelectUI} ui @param {string} abs @returns {Promise<boolean>} */
export async function openWorkspaceAtPath(host, ui, abs) {
  const electronAPI = /** @type {any} */ (window).electronAPI;
  if (!electronAPI || typeof electronAPI.setWorkspaceRoot !== 'function') {
    alert('Open Folder is only available in the Electron editor.');
    return false;
  }

  const res = await electronAPI.setWorkspaceRoot(String(abs));
  if (!res || !res.ok) {
    removeRecentProject(host, ui, abs);
    alert(`Failed to open folder: ${res && res.error ? res.error : 'Unknown error'}`);
    return false;
  }

  await host._setAssetBrowserRoot('.');
  return true;
}

/** @param {any} host @param {ProjectSelectUI} ui @param {string} abs @returns {Promise<boolean>} */
export async function openProjectAtPathStrict(host, ui, abs) {
  const electronAPI = /** @type {any} */ (window).electronAPI;
  if (!electronAPI || typeof electronAPI.setWorkspaceRoot !== 'function' || typeof electronAPI.getWorkspaceRoot !== 'function' || typeof electronAPI.listProjectDir !== 'function') {
    alert('Open Project is only available in the Electron editor.');
    return false;
  }

  const prev = await electronAPI.getWorkspaceRoot();
  const prevPath = prev && prev.ok && prev.path ? String(prev.path) : null;

  const setRes = await electronAPI.setWorkspaceRoot(String(abs));
  if (!setRes || !setRes.ok) {
    removeRecentProject(host, ui, abs);
    alert(`Failed to set workspace root: ${setRes && setRes.error ? setRes.error : 'Unknown error'}`);
    return false;
  }

  const rootList = await electronAPI.listProjectDir('.');
  const entries = (rootList && rootList.ok && Array.isArray(rootList.entries))
    ? /** @type {{ name?: string }[]} */ (rootList.entries)
    : /** @type {{ name?: string }[]} */ ([]);

  const hasJsonProject = entries.some((ent) => String(ent?.name || '') === 'fluxion.project.json');
  const fluxProjects = entries
    .map((ent) => String(ent?.name || ''))
    .filter((name) => name.toLowerCase().endsWith('.flux'))
    .sort();
  const hasFluxProject = fluxProjects.length > 0;

  if (!hasJsonProject && !hasFluxProject) {
    if (prevPath) await electronAPI.setWorkspaceRoot(prevPath);
    alert('That folder does not look like a Fluxion project (missing fluxion.project.json or *.flux).\n\nUse "Open Legacy Project..." to open arbitrary folders.');
    return false;
  }

  await host._setAssetBrowserRoot('.');
  await host._tryLoadProjectMainScene(hasJsonProject ? null : (fluxProjects[0] || null));
  await host._loadProjectMetaFromWorkspace();
  return true;
}
