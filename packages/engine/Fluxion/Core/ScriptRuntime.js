// @ts-check

/**
 * Minimal Unity-like scripting support.
 *
 * Attach scripts to any node by setting:
 *   node.scripts = [{ src: '...', enabled: true }]
 *
 * Each script module can export either:
 * - default class/object with start() + update(dt)
 * - named functions start(ctx?) and update(dt, ctx?)
 * - Start/Update (PascalCase) equivalents
 */

/**
 * @typedef {Object} ScriptEntry
 * @property {string=} src
 * @property {boolean=} enabled
 * @property {string=} __lastSrc
 * @property {string=} __cacheBust
 * @property {Promise<any>|null=} __loading
 * @property {any=} __module
 * @property {any=} __instance
 * @property {boolean=} __started
 * @property {boolean=} __faulted
 * @property {any=} __error
 */

/** @param {any} p */
function _swallowPromise(p) {
  if (!p || typeof p.then !== 'function') return;
  try { p.catch(() => {}); } catch {}
}

/** @param {any} target */
function _getLifecycle(target) {
  if (!target) return { start: null, update: null };
  const start = (typeof target.start === 'function') ? target.start
    : ((typeof target.Start === 'function') ? target.Start : null);
  const update = (typeof target.update === 'function') ? target.update
    : ((typeof target.Update === 'function') ? target.Update : null);
  return { start, update };
}

/** @param {any} mod */
function _instantiateDefault(mod) {
  if (!mod) return null;

  const def = mod.default;
  if (def === undefined || def === null) return null;

  // default export as class/constructor
  if (typeof def === 'function') {
    try {
      return new def();
    } catch {
      // default export may be a factory function; fall through
      try { return def(); } catch { return null; }
    }
  }

  // default export as plain object
  if (typeof def === 'object') return def;

  return null;
}

/**
 * Ensure a script entry has stable defaults.
 * @param {ScriptEntry} e
 */
function _normalizeEntry(e) {
  if (!e || typeof e !== 'object') return;
  if (e.enabled === undefined) e.enabled = true;
  if (e.__loading === undefined) e.__loading = null;
  if (e.__started === undefined) e.__started = false;
  if (e.__faulted === undefined) e.__faulted = false;
}

/**
 * Queue a module load for a script entry if needed.
 * @param {ScriptEntry} e
 * @param {string} url
 */
function _ensureModuleLoading(e, url) {
  if (e.__loading) return;

  // In editor workflows, cache-bust on (src) changes so edits are picked up.
  const bust = e.__cacheBust ? String(e.__cacheBust) : '';
  const moduleUrl = bust
    ? `${url}${url.includes('?') ? '&' : '?'}v=${encodeURIComponent(bust)}`
    : url;

  e.__loading = import(moduleUrl)
    .then((mod) => {
      e.__module = mod;
      e.__instance = _instantiateDefault(mod);
      return mod;
    })
    .catch((err) => {
      e.__faulted = true;
      e.__error = err;
      console.warn('[Fluxion ScriptRuntime] Failed to load script', url, err);
      return null;
    })
    .finally(() => {
      e.__loading = null;
    });
}

/**
 * Run scripts for a node.
 * Called from node update methods.
 * @param {any} node
 * @param {number} dt
 */
export function updateNodeScripts(node, dt) {
  const arr = node && Array.isArray(node.scripts) ? /** @type {ScriptEntry[]} */ (node.scripts) : null;
  if (!arr || arr.length === 0) return;

  const scene = node && node.scene ? node.scene : null;
  const time = (typeof performance !== 'undefined' && performance.now)
    ? performance.now() / 1000
    : (Date.now() / 1000);

  /** @type {any} */
  const ctx = {
    node,
    gameObject: node,
    scene,
    dt,
    time,
  };

  for (const entry of arr) {
    if (!entry || typeof entry !== 'object') continue;
    _normalizeEntry(entry);

    if (entry.enabled === false) continue;

    const src = String(entry.src || '').trim();
    if (!src) continue;

    // If src changed, reset runtime state and cache-bust next import.
    if (entry.__lastSrc !== src) {
      entry.__lastSrc = src;
      entry.__cacheBust = Date.now().toString(36);
      entry.__module = null;
      entry.__instance = null;
      entry.__started = false;
      entry.__faulted = false;
      entry.__error = null;
    }

    if (entry.__faulted) continue;

    if (!entry.__module && !entry.__instance) {
      _ensureModuleLoading(entry, src);
      continue;
    }

    const moduleTarget = entry.__module;
    const instanceTarget = entry.__instance;

    // Prefer lifecycle on instance, then on module exports.
    const life = _getLifecycle(instanceTarget);
    const modLife = _getLifecycle(moduleTarget);

    const startFn = life.start || modLife.start;
    const updateFn = life.update || modLife.update;

    // Bind `this` to instance when available; else module.
    const thisArg = (life.start || life.update) ? instanceTarget : moduleTarget;

    // Inject context onto the instance for Unity-like access patterns.
    if (instanceTarget && typeof instanceTarget === 'object') {
      try { instanceTarget.node = node; } catch {}
      try { instanceTarget.gameObject = node; } catch {}
      try { instanceTarget.scene = scene; } catch {}
    }

    if (!entry.__started) {
      entry.__started = true;
      if (typeof startFn === 'function') {
        try {
          const r = startFn.call(thisArg, ctx);
          _swallowPromise(r);
        } catch (err) {
          entry.__faulted = true;
          entry.__error = err;
          console.warn('[Fluxion ScriptRuntime] start() failed', src, err);
          continue;
        }
      }
    }

    if (typeof updateFn === 'function') {
      try {
        const r = updateFn.call(thisArg, dt, ctx);
        _swallowPromise(r);
      } catch (err) {
        entry.__faulted = true;
        entry.__error = err;
        console.warn('[Fluxion ScriptRuntime] update() failed', src, err);
      }
    }
  }
}
