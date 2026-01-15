// @ts-check

/**
 * Inspector panel wiring + rebuild logic extracted from `game.js`.
 */

import * as InspectorFields from "./inspectorFields.js";
import * as InspectorWidgets from "./inspectorWidgets.js";
import { SceneLoader, Skybox, Material, loadGLTF } from "../../engine/Fluxion/index.js";
import { preserveUiStateDuring } from "./uiStatePreservation.js";

// Cache last-applied values for Skybox stubs so inspector rebuilds don't
// constantly recreate skyboxes (which can flash black while textures upload).
/** @type {WeakMap<any, { skyboxKey?: string, ambientKey?: string }>} */
const _skyboxApplyCache = new WeakMap();

/**
 * @typedef {{
 *  inspectorSubtitle: HTMLDivElement|null,
 *  common: HTMLDivElement|null,
 *  transform: HTMLDivElement|null,
 * }} InspectorUI
 */

export function isEditingInspector() {
  const el = /** @type {HTMLElement|null} */ (document.activeElement instanceof HTMLElement ? document.activeElement : null);
  if (!el) return false;

  const tag = String(el.tagName || '').toLowerCase();
  const isEditor = tag === 'input' || tag === 'textarea' || tag === 'select';
  if (!isEditor) return false;

  return !!(el.closest('#inspectorCommon') || el.closest('#inspectorTransform'));
}

/** @param {any} host @param {number} seconds */
export function blockInspectorAutoRefresh(host, seconds) {
  const s = Number(seconds);
  if (!Number.isFinite(s) || s <= 0) return;
  host._inspectorRefreshBlockT = Math.max(host._inspectorRefreshBlockT || 0, s);
}

/** @param {any} host */
export function setupInspectorInteractionGuards(host) {
  const panel = /** @type {HTMLElement|null} */ (document.getElementById('rightPanel'));
  if (!panel) return;

  // Capture so we run before any bubbling handlers.
  panel.addEventListener('pointerdown', () => blockInspectorAutoRefresh(host, 0.35), true);
  panel.addEventListener('mousedown', () => blockInspectorAutoRefresh(host, 0.35), true);
  panel.addEventListener('wheel', () => blockInspectorAutoRefresh(host, 0.25), { capture: true, passive: true });
}

/**
 * Inspector for scene-level XML stub entries like <Font/>, <Mesh/>, <Material/>, <Skybox/>.
 * @param {any} host
 * @param {InspectorUI} ui
 * @param {any} stub
 */
export function rebuildInspectorXmlStub(host, ui, stub) {
  if (ui.common) ui.common.innerHTML = '';
  if (ui.transform) ui.transform.innerHTML = '';

  InspectorFields.addReadonly(ui.common, 'type', String(stub.__xmlTag || 'XML'));

  const tag = String(stub.__xmlTag || '');
  if (tag === 'Font') {
    InspectorFields.addStringWith(ui.common, 'family', stub, 'family', () => host.rebuildTree());
    InspectorFields.addStringWithDrop(ui.common, 'src', stub, 'src', () => {}, InspectorWidgets.getTexturePickerOpts('font'));
    return;
  }
  if (tag === 'Mesh') {
    InspectorFields.addStringWith(ui.common, 'name', stub, 'name', () => host.rebuildTree());
      InspectorFields.addStringWithDrop(ui.common, 'source', stub, 'source', () => {}, InspectorWidgets.getTexturePickerOpts('model'));
    InspectorFields.addString(ui.common, 'type', stub, 'type');
    InspectorFields.addCssColor(ui.common, 'color', stub, 'color');

    // GLTF material summary (count + names).
    try {
      const sceneAny = /** @type {any} */ (host?.currentScene || null);
      const meshName = String(stub?.name || '').trim();
      if (sceneAny && meshName) {
        if (!(sceneAny.__gltfMaterialKeysByMeshResource instanceof Map)) {
          sceneAny.__gltfMaterialKeysByMeshResource = new Map();
        }
        /** @type {Map<string, string[]>} */
        const keyMap = sceneAny.__gltfMaterialKeysByMeshResource;

        /** @param {string[]} keys */
        const showMaterials = (keys) => {
          const uniq = Array.from(new Set((keys || []).map((k) => String(k || '').trim()).filter(Boolean)));
          if (uniq.length === 0) return;
          InspectorFields.addReadonly(ui.common, 'materials', uniq.length);

          const list = document.createElement('div');
          list.className = 'readonlyBox';
          list.style.whiteSpace = 'pre-wrap';
          list.textContent = uniq
            .map((k) => (k.includes('::') ? k.split('::').slice(-1)[0] : k))
            .join('\n');
          InspectorFields.addField(ui.common, 'materialNames', list);
        };

        // Prefer editor-tracked list.
        let materialKeys = keyMap.get(meshName) || null;

        // Fallback: if SceneLoader registered a gltf-group, read unique materials from parts.
        if ((!materialKeys || materialKeys.length === 0) && typeof sceneAny.getMeshDefinition === 'function') {
          const def = sceneAny.getMeshDefinition(meshName);
          if (def && def.type === 'gltf-group' && Array.isArray(def.parts)) {
            const derived = def.parts.map((/** @type {any} */ p) => String(p?.material || '')).filter(Boolean);
            materialKeys = derived;
            if (derived.length > 0) {
              try { keyMap.set(meshName, derived); } catch {}
            }
          } else if (def && def.type === 'gltf' && typeof def.material === 'string') {
            // Best-effort scan for namespaced materials.
            const prefix = `${meshName}::`;
            const found = [];
            try {
              if (sceneAny.materialDefinitions instanceof Map) {
                for (const k of sceneAny.materialDefinitions.keys()) {
                  const ks = String(k || '');
                  if (ks.startsWith(prefix)) found.push(ks);
                }
              }
            } catch {}
            if (found.length > 0) {
              materialKeys = found;
              try { keyMap.set(meshName, found); } catch {}
            }
          }

          // If we still don't have a list but a GLTF promise is present, compute it when loaded.
          if ((!materialKeys || materialKeys.length === 0) && def && typeof def.promise?.then === 'function') {
            Promise.resolve(def.promise)
              .then((result) => {
                const resAny = /** @type {any} */ (result);
                const names = resAny?.materials && typeof resAny.materials?.keys === 'function'
                  ? Array.from(resAny.materials.keys()).map((k) => `${meshName}::${k}`)
                  : [];
                if (names.length > 0) {
                  try { keyMap.set(meshName, names); } catch {}
                  try { host.rebuildInspector?.(); } catch {}
                }
              })
              .catch(() => {});
          }
        }

        if (materialKeys && Array.isArray(materialKeys) && materialKeys.length > 0) {
          showMaterials(materialKeys);
        }
      }
    } catch {}

    if (!stub.params || typeof stub.params !== 'object') stub.params = {};
    const p = stub.params;
    for (const k of ['width', 'height', 'depth', 'size', 'radius', 'subdivisions', 'radialSegments', 'heightSegments', 'capSegments']) {
      InspectorFields.addNullableNumber(ui.common, k, p, k);
    }
    return;
  }
  if (tag === 'Material') {
    InspectorFields.addStringWith(ui.common, 'name', stub, 'name', () => host.rebuildTree());

    const onTextureAuthored = () => {
      // If author sets a texture but leaves factors unset/zero, default them to 1 so the map actually contributes.
      try {
        const mf = Number(stub.metallicFactor);
        const rf = Number(stub.roughnessFactor);
        const ao = Number(stub.aoStrength);

        if (String(stub.metallicTexture || '').trim() && (!Number.isFinite(mf) || mf === 0)) stub.metallicFactor = '1';
        if (String(stub.roughnessTexture || '').trim() && (!Number.isFinite(rf) || rf === 0)) stub.roughnessFactor = '1';
        if (String(stub.aoTexture || '').trim() && (!Number.isFinite(ao) || ao === 0)) stub.aoStrength = '1';

        // Packed MR convenience: if enabled and either field is set, keep them the same.
        const packed = !!stub.metallicRoughnessPacked;
        if (packed) {
          const mtx = String(stub.metallicTexture || '').trim();
          const rtx = String(stub.roughnessTexture || '').trim();
          const use = mtx || rtx;
          if (use) {
            stub.metallicTexture = use;
            stub.roughnessTexture = use;
          }
        }
      } catch {}
    };

    /** @param {HTMLElement|null} container */
    const getLastField = (container) => {
      if (!container) return null;
      const fields = container.querySelectorAll('.field');
      return fields.length > 0 ? /** @type {HTMLDivElement} */ (fields[fields.length - 1]) : null;
    };

    /** @type {Map<string, HTMLDivElement|null>} */
    const factorFields = new Map();

    const updateMaterialStubVisibility = () => {
      InspectorWidgets.updateFieldVisibility(factorFields.get('baseColorFactor') || null, stub, 'baseColorTexture');
      InspectorWidgets.updateFieldVisibility(factorFields.get('metallicFactor') || null, stub, 'metallicTexture');
      InspectorWidgets.updateFieldVisibility(factorFields.get('roughnessFactor') || null, stub, 'roughnessTexture');
      InspectorWidgets.updateFieldVisibility(factorFields.get('aoStrength') || null, stub, 'aoTexture');
    };

    // Source field
    InspectorFields.addAutoWith(ui.common, 'source', stub, 'source', () => {});

    // Groups matching standalone material UI
    const gAlbedo = InspectorWidgets.createGroup(ui.common, 'Albedo', true);
    const gOrm = InspectorWidgets.createGroup(ui.common, 'Orm', true);
    const gNormal = InspectorWidgets.createGroup(ui.common, 'Normal Map', false);
    const gAo = InspectorWidgets.createGroup(ui.common, 'Ambient Occlusion', false);
    const gEmission = InspectorWidgets.createGroup(ui.common, 'Emission', false);
    const gTransparency = InspectorWidgets.createGroup(ui.common, 'Transparency', false);

    const texOpts = InspectorWidgets.getTexturePickerOpts('image');

    // Albedo
    InspectorFields.addAutoWith(gAlbedo, 'Color', stub, 'baseColorFactor', () => {});
    factorFields.set('baseColorFactor', InspectorWidgets.getLastField(gAlbedo));
    InspectorFields.addStringWithDrop(gAlbedo, 'Texture', stub, 'baseColorTexture', () => {
      onTextureAuthored();
      updateMaterialStubVisibility();
    }, texOpts);

    // ORM
    InspectorFields.addAutoWith(gOrm, 'Metallic', stub, 'metallicFactor', () => {});
    factorFields.set('metallicFactor', InspectorWidgets.getLastField(gOrm));
    InspectorFields.addAutoWith(gOrm, 'Roughness', stub, 'roughnessFactor', () => {});
    factorFields.set('roughnessFactor', InspectorWidgets.getLastField(gOrm));
    InspectorFields.addAutoWith(gOrm, 'Packed MR', stub, 'metallicRoughnessPacked', () => {});
    InspectorFields.addStringWithDrop(gOrm, 'Metallic Texture', stub, 'metallicTexture', () => {
      onTextureAuthored();
      updateMaterialStubVisibility();
    }, texOpts);
    InspectorFields.addStringWithDrop(gOrm, 'Roughness Texture', stub, 'roughnessTexture', () => {
      onTextureAuthored();
      updateMaterialStubVisibility();
    }, texOpts);

    // Normal Map
    InspectorFields.addAutoWith(gNormal, 'Scale', stub, 'normalScale', () => {});
    InspectorFields.addStringWithDrop(gNormal, 'Texture', stub, 'normalTexture', () => {
      onTextureAuthored();
      updateMaterialStubVisibility();
    }, texOpts);

    // Ambient Occlusion
    InspectorFields.addAutoWith(gAo, 'Strength', stub, 'aoStrength', () => {});
    factorFields.set('aoStrength', InspectorWidgets.getLastField(gAo));
    InspectorFields.addStringWithDrop(gAo, 'Texture', stub, 'aoTexture', () => {
      onTextureAuthored();
      updateMaterialStubVisibility();
    }, texOpts);

    // Emission
    InspectorFields.addAutoWith(gEmission, 'Color', stub, 'emissiveFactor', () => {});
    InspectorFields.addStringWithDrop(gEmission, 'Texture', stub, 'emissiveTexture', () => {
      onTextureAuthored();
      updateMaterialStubVisibility();
    }, texOpts);

    // Transparency
    InspectorFields.addAutoWith(gTransparency, 'Alpha Mode', stub, 'alphaMode', () => {});
    InspectorFields.addAutoWith(gTransparency, 'Alpha Cutoff', stub, 'alphaCutoff', () => {});
    InspectorFields.addStringWithDrop(gTransparency, 'Alpha Texture', stub, 'alphaTexture', () => {
      onTextureAuthored();
      updateMaterialStubVisibility();
    }, texOpts);

    // UV
    if (!('uvScale' in stub)) stub.uvScale = [1, 1];
    if (!Array.isArray(stub.uvScale) || stub.uvScale.length < 2) stub.uvScale = [1, 1];
    const gUv = InspectorWidgets.createGroup(ui.common, 'Uv', false);
    InspectorWidgets.addVec2ArrayWith(gUv, 'UV Scale', stub.uvScale, () => {});

    // Initial visibility (hide factors when a texture is present).
    updateMaterialStubVisibility();
    return;
  }
  if (tag === 'Skybox') {
    const getRenderer = () => /** @type {any} */ (host?._renderer || host?.engine?.renderer || null);

    const getSceneBaseUrl = () => {
      try {
        const p = String(host?._scenePath || '').trim();
        if (!p) throw new Error('no scene path');
        const sceneUrl = new URL(p, window.location.href);
        return new URL('.', sceneUrl).toString();
      } catch {
        return (typeof document !== 'undefined' && document.baseURI) ? document.baseURI : (typeof window !== 'undefined' ? window.location.href : '');
      }
    };

    const applyAmbientFromStub = () => {
      const r = getRenderer();
      if (!r) return;
      const s = String(stub.ambientColor || '').trim();

		const cache = _skyboxApplyCache.get(stub) || {};
		const ambientKey = `ambient:${s}`;
		if (cache.ambientKey === ambientKey) return;
		cache.ambientKey = ambientKey;
		_skyboxApplyCache.set(stub, cache);

      if (!s) {
        r.pbrAmbientColor = [0.03, 0.03, 0.03];
        return;
      }
      const c = SceneLoader._parseColor(s);
      r.pbrAmbientColor = [c[0], c[1], c[2]];
    };

    const applySkyboxFromStub = () => {
      const r = getRenderer();
      if (!r || !r.gl) return;

      const baseUrl = getSceneBaseUrl();
      const colorStr = String(stub.color || '').trim();
      const srcStr = String(stub.source || '').trim();

      const right = String(stub.right || '').trim();
      const left = String(stub.left || '').trim();
      const top = String(stub.top || '').trim();
      const bottom = String(stub.bottom || '').trim();
      const front = String(stub.front || '').trim();
      const back = String(stub.back || '').trim();

    // Skip re-applying if nothing changed; avoids black flashing.
    const cache = _skyboxApplyCache.get(stub) || {};
    const skyboxKey = JSON.stringify({
      equirectangular: !!stub.equirectangular,
      src: srcStr,
      color: colorStr,
      right,
      left,
      top,
      bottom,
      front,
      back,
    });

    // If the renderer already has a matching skybox (e.g. loaded from scene),
    // don't recreate it just because the inspector opened.
    try {
      if (!cache.skyboxKey) {
        const sb = /** @type {any} */ (r.currentSkybox || null);
        const spec = sb && typeof sb.getSourceSpec === 'function' ? sb.getSourceSpec() : null;
        if (spec && spec.kind === 'color' && Array.isArray(spec.color)) {
          // We don't know exact string formatting; skip this optimization for colors.
        } else if (spec && spec.kind === 'equirectangular' && !!stub.equirectangular) {
          const currentSrc = typeof spec.source === 'string' ? String(spec.source).trim() : '';
          if (currentSrc && currentSrc === srcStr) {
            cache.skyboxKey = skyboxKey;
            _skyboxApplyCache.set(stub, cache);
            return;
          }
        } else if (spec && spec.kind === 'cubemap' && Array.isArray(spec.faces) && !stub.equirectangular) {
          const faces = spec.faces;
          const cur = {
            equirectangular: false,
            src: '',
            color: '',
            right: typeof faces[0] === 'string' ? String(faces[0]).trim() : '',
            left: typeof faces[1] === 'string' ? String(faces[1]).trim() : '',
            top: typeof faces[2] === 'string' ? String(faces[2]).trim() : '',
            bottom: typeof faces[3] === 'string' ? String(faces[3]).trim() : '',
            front: typeof faces[4] === 'string' ? String(faces[4]).trim() : '',
            back: typeof faces[5] === 'string' ? String(faces[5]).trim() : '',
          };
          const curKey = JSON.stringify(cur);
          if (curKey === skyboxKey) {
            cache.skyboxKey = skyboxKey;
            _skyboxApplyCache.set(stub, cache);
            return;
          }
        }
      }
    } catch {}
    if (cache.skyboxKey === skyboxKey) return;
    cache.skyboxKey = skyboxKey;
    _skyboxApplyCache.set(stub, cache);

      try {
        if (!!stub.equirectangular) {
          if (srcStr) {
            const src = SceneLoader._resolveSceneResourceUrl(srcStr, baseUrl);
            r.setSkybox(new Skybox(r.gl, src, true));
          } else {
            r.setSkybox(null);
          }
          return;
        }

        // Cubemap (6 faces)
        if (right && left && top && bottom && front && back) {
          const faces = [right, left, top, bottom, front, back].map((p) => SceneLoader._resolveSceneResourceUrl(p, baseUrl));
          r.setSkybox(new Skybox(r.gl, faces, false));
          return;
        }

        // Solid color fallback
        if (colorStr) {
          const c = SceneLoader._parseColor(colorStr);
          r.setSkybox(new Skybox(r.gl, [c[0], c[1], c[2], c[3]]));
          return;
        }

        r.setSkybox(null);
      } catch (e) {
        console.warn('Failed to apply skybox from inspector', e);
      }
    };

    // Ensure fields exist (older scenes)
    if (!('ambientColor' in stub)) stub.ambientColor = '';
    if (!('equirectangular' in stub)) stub.equirectangular = false;
    for (const k of ['color', 'source', 'right', 'left', 'top', 'bottom', 'front', 'back']) {
      if (!(k in stub)) stub[k] = '';
    }

    InspectorFields.addCssColorWith(ui.common, 'color', stub, 'color', () => {
      applySkyboxFromStub();
    }, { debounceMs: 200 });

    // PBR indirect ambient (u_ambientColor). Stored as a color string in XML.
    InspectorFields.addCssColorWith(ui.common, 'ambientColor', stub, 'ambientColor', () => {
      applyAmbientFromStub();
    }, { debounceMs: 200 });

    InspectorFields.addToggleWith(ui.common, 'equirectangular', stub, 'equirectangular', () => {
      applySkyboxFromStub();
      // Rebuild to show/hide the correct fields.
      try { host.rebuildInspector(); } catch {}
    });

    // Show only the relevant inputs.
    if (!!stub.equirectangular) {
      InspectorFields.addStringWithDrop(ui.common, 'source', stub, 'source', () => {
        applySkyboxFromStub();
      }, { acceptExtensions: ['.hdr', '.exr', '.png', '.jpg', '.jpeg', '.webp'], debounceMs: 250 });
    } else {
      InspectorFields.addStringWithDrop(ui.common, 'right', stub, 'right', () => {
        applySkyboxFromStub();
      }, { acceptExtensions: ['.hdr', '.exr', '.png', '.jpg', '.jpeg', '.webp'], debounceMs: 250 });
      InspectorFields.addStringWithDrop(ui.common, 'left', stub, 'left', () => {
        applySkyboxFromStub();
      }, { acceptExtensions: ['.hdr', '.exr', '.png', '.jpg', '.jpeg', '.webp'], debounceMs: 250 });
      InspectorFields.addStringWithDrop(ui.common, 'top', stub, 'top', () => {
        applySkyboxFromStub();
      }, { acceptExtensions: ['.hdr', '.exr', '.png', '.jpg', '.jpeg', '.webp'], debounceMs: 250 });
      InspectorFields.addStringWithDrop(ui.common, 'bottom', stub, 'bottom', () => {
        applySkyboxFromStub();
      }, { acceptExtensions: ['.hdr', '.exr', '.png', '.jpg', '.jpeg', '.webp'], debounceMs: 250 });
      InspectorFields.addStringWithDrop(ui.common, 'front', stub, 'front', () => {
        applySkyboxFromStub();
      }, { acceptExtensions: ['.hdr', '.exr', '.png', '.jpg', '.jpeg', '.webp'], debounceMs: 250 });
      InspectorFields.addStringWithDrop(ui.common, 'back', stub, 'back', () => {
        applySkyboxFromStub();
      }, { acceptExtensions: ['.hdr', '.exr', '.png', '.jpg', '.jpeg', '.webp'], debounceMs: 250 });
    }

    // Apply current values once so selecting the stub syncs renderer state.
    applyAmbientFromStub();
    applySkyboxFromStub();
    return;
  }
}

/** @param {any} host @param {InspectorUI} ui */
export function rebuildInspector(host, ui) {
  const rightPanelBody = document.getElementById('rightPanelBody');
  if (!rightPanelBody) {
    // Fallback to direct rebuild if container not found
    _rebuildInspectorCore(host, ui);
    return;
  }

  preserveUiStateDuring(rightPanelBody, () => {
    _rebuildInspectorCore(host, ui);
  });
}

/** @param {any} host @param {InspectorUI} ui */
function _rebuildInspectorCore(host, ui) {
  /**
   * @param {string} title
   * @param {boolean=} open
   * @returns {HTMLDivElement|null}
   */
  function addGroup(title, open = true) {
    if (!ui.common) return null;
    const details = document.createElement('details');
    details.open = !!open;
    const summary = document.createElement('summary');
    summary.className = 'sectionTitle subSectionTitle';
    summary.textContent = title;
    details.appendChild(summary);
    const inner = document.createElement('div');
    inner.className = 'form';
    details.appendChild(inner);
    ui.common.appendChild(details);
    return inner;
  }

  const matAsset = /** @type {any} */ (host?._inspectorMatAsset || null);
  if (matAsset && typeof matAsset === 'object' && typeof matAsset.pathRel === 'string' && matAsset.pathRel) {
    const pathRel = String(matAsset.pathRel || '');
    const base = (() => {
      const s = String(pathRel || '').replace(/\\/g, '/');
      const i = s.lastIndexOf('/');
      return i >= 0 ? s.slice(i + 1) : s;
    })();

    if (ui.inspectorSubtitle) ui.inspectorSubtitle.textContent = base || 'Material';
    if (ui.common) ui.common.innerHTML = '';
    if (ui.transform) ui.transform.innerHTML = '';

    InspectorFields.addReadonly(ui.common, 'type', 'Material Asset (.mat)');
    InspectorFields.addReadonly(ui.common, 'path', pathRel);

    const err = (matAsset.error != null) ? String(matAsset.error || '') : '';
    if (err) {
      InspectorFields.addReadonly(ui.common, 'error', err);
      return;
    }

    const isDirty = !!matAsset.dirty;
    const status = isDirty ? 'Unsaved…' : (matAsset.lastSaveOkT > 0 ? 'Saved' : '');
    if (status) InspectorFields.addReadonly(ui.common, 'status', status);

    const data = (matAsset.data && typeof matAsset.data === 'object') ? matAsset.data : null;
    if (!data) {
      InspectorFields.addReadonly(ui.common, 'error', 'No material data loaded.');
      return;
    }

    /** @param {string} key @param {boolean} def */
    const ensureUiBool = (key, def) => {
      try {
        // If it exists and is enumerable (from old saves), keep but we will strip on save.
        if (Object.prototype.hasOwnProperty.call(data, key)) {
          data[key] = !!data[key];
          return;
        }
        Object.defineProperty(data, key, { value: !!def, writable: true, configurable: true, enumerable: false });
      } catch {
        // Fallback: enumerable property (will be stripped on save).
        // @ts-ignore
        data[key] = !!def;
      }
    };

    const requestSave = () => {
      try {
        if (typeof host._requestSaveMatAsset === 'function') host._requestSaveMatAsset();
      } catch {}
    };

    const ensureTextureDrivenDefaults = () => {
      try {
        // If user sets maps, ensure the scalar multipliers are non-zero.
        const mf = Number(data.metallicFactor);
        const rf = Number(data.roughnessFactor);
        const ao = Number(data.aoStrength);

        if (String(data.metallicTexture || '').trim() && (!Number.isFinite(mf) || mf === 0)) data.metallicFactor = 1.0;
        if (String(data.roughnessTexture || '').trim() && (!Number.isFinite(rf) || rf === 0)) data.roughnessFactor = 1.0;
        if (String(data.aoTexture || '').trim() && (!Number.isFinite(ao) || ao === 0)) data.aoStrength = 1.0;

        // Packed MR: keep metallic/roughness texture fields consistent.
        if (data.metallicRoughnessPacked) {
          const mtx = String(data.metallicTexture || '').trim();
          const rtx = String(data.roughnessTexture || '').trim();
          const use = mtx || rtx;
          if (use) {
            data.metallicTexture = use;
            data.roughnessTexture = use;
          }
        }
      } catch {}
    };

    /**
     * @param {HTMLElement | null} container
     * @param {string} label
     * @param {any} obj
     * @param {string} key
     */
    const addVec3ArrayWith = (container, label, obj, key) => {
      if (!container || !obj || !(key in obj)) return;
      const arr = obj[key];
      if (!Array.isArray(arr) || arr.length < 3) return;

      const wrap = document.createElement('div');
      wrap.style.display = 'flex';
      wrap.style.gap = '6px';

      /** @param {number} i */
      const make = (i) => {
        const input = document.createElement('input');
        input.type = 'number';
        input.step = '0.01';
        input.value = String(Number(arr[i]) || 0);
        input.style.width = '80px';
        const apply = () => {
          const v = Number(input.value);
          if (!Number.isFinite(v)) return;
          arr[i] = v;
          requestSave();
        };
        input.addEventListener('input', apply);
        input.addEventListener('change', apply);
        return input;
      };

      wrap.appendChild(make(0));
      wrap.appendChild(make(1));
      wrap.appendChild(make(2));
      InspectorFields.addField(container, label, wrap);
    };

    /**
     * @param {HTMLElement | null} container
     * @param {string} label
     * @param {any} obj
     * @param {string} key
     */
    const addVec2ArrayWith = (container, label, obj, key) => {
      InspectorWidgets.addVec2ArrayWith(container, label, Array.isArray(obj[key]) ? obj[key] : [], () => requestSave());
    };

    /** @type {Map<string, HTMLDivElement|null>} */
    const factorFields = new Map();

    const updateMatAssetVisibility = () => {
      // Hide scalar multipliers when textures are present (per user requirement)
      InspectorWidgets.updateFieldVisibility(factorFields.get('baseColorFactor') || null, data, 'baseColorTexture');
      InspectorWidgets.updateFieldVisibility(factorFields.get('metallicFactor') || null, data, 'metallicTexture');
      InspectorWidgets.updateFieldVisibility(factorFields.get('roughnessFactor') || null, data, 'roughnessTexture');
      InspectorWidgets.updateFieldVisibility(factorFields.get('aoStrength') || null, data, 'aoTexture');
    };

    // Groups
    const gAlbedo = InspectorWidgets.createGroup(ui.common, 'Albedo', true);
    const gOrm = InspectorWidgets.createGroup(ui.common, 'Orm', true);
    const gNormal = InspectorWidgets.createGroup(ui.common, 'Normal Map', false);
    const gAo = InspectorWidgets.createGroup(ui.common, 'Ambient Occlusion', false);
    const gEmission = InspectorWidgets.createGroup(ui.common, 'Emission', false);
    const gTransparency = InspectorWidgets.createGroup(ui.common, 'Transparency', false);
    const gUv = InspectorWidgets.createGroup(ui.common, 'Uv', false);

    // Albedo
    InspectorFields.addAutoWith(gAlbedo, 'Color', data, 'baseColorFactor', requestSave);
    factorFields.set('baseColorFactor', InspectorWidgets.getLastField(gAlbedo));

    // ORM
    InspectorFields.addAutoWith(gOrm, 'Metallic', data, 'metallicFactor', requestSave);
    factorFields.set('metallicFactor', InspectorWidgets.getLastField(gOrm));
    InspectorFields.addAutoWith(gOrm, 'Roughness', data, 'roughnessFactor', requestSave);
    factorFields.set('roughnessFactor', InspectorWidgets.getLastField(gOrm));
    InspectorFields.addAutoWith(gOrm, 'Packed MR', data, 'metallicRoughnessPacked', () => {
      ensureTextureDrivenDefaults();
      requestSave();
    });

    // Normal/AO/Emission/Transparency/UV
    InspectorFields.addAutoWith(gNormal, 'Scale', data, 'normalScale', requestSave);
    InspectorFields.addAutoWith(gAo, 'Strength', data, 'aoStrength', requestSave);
    factorFields.set('aoStrength', InspectorWidgets.getLastField(gAo));
    InspectorFields.addAutoWith(gEmission, 'Color', data, 'emissiveFactor', requestSave);
    InspectorFields.addAutoWith(gTransparency, 'Alpha Mode', data, 'alphaMode', requestSave);
    InspectorFields.addAutoWith(gTransparency, 'Alpha Cutoff', data, 'alphaCutoff', requestSave);
    if (!('uvScale' in data)) data.uvScale = [1, 1];
    if (!Array.isArray(data.uvScale) || data.uvScale.length < 2) data.uvScale = [1, 1];
    addVec2ArrayWith(gUv, 'UV Scale', data, 'uvScale');

    // Texture pickers
    const texOpts = InspectorWidgets.getTexturePickerOpts('image');
    InspectorFields.addStringWithDrop(gAlbedo, 'Texture', data, 'baseColorTexture', () => {
      ensureTextureDrivenDefaults();
      updateMatAssetVisibility();
      requestSave();
    }, texOpts);

    InspectorFields.addStringWithDrop(gOrm, 'Metallic Texture', data, 'metallicTexture', () => {
      ensureTextureDrivenDefaults();
      updateMatAssetVisibility();
      requestSave();
    }, texOpts);

    InspectorFields.addStringWithDrop(gOrm, 'Roughness Texture', data, 'roughnessTexture', () => {
      ensureTextureDrivenDefaults();
      updateMatAssetVisibility();
      requestSave();
    }, texOpts);

    InspectorFields.addStringWithDrop(gNormal, 'Texture', data, 'normalTexture', () => {
      ensureTextureDrivenDefaults();
      requestSave();
    }, texOpts);

    InspectorFields.addStringWithDrop(gAo, 'Texture', data, 'aoTexture', () => {
      ensureTextureDrivenDefaults();
      updateMatAssetVisibility();
      requestSave();
    }, texOpts);

    InspectorFields.addStringWithDrop(gEmission, 'Texture', data, 'emissiveTexture', () => {
      ensureTextureDrivenDefaults();
      requestSave();
    }, texOpts);

    InspectorFields.addStringWithDrop(gTransparency, 'Alpha Texture', data, 'alphaTexture', () => {
      ensureTextureDrivenDefaults();
      requestSave();
    }, texOpts);

    // Initial visibility.
    updateMatAssetVisibility();

    // Apply inspector filter (if any) after building UI.
    try {
      InspectorFields.applyInspectorFilter(ui.common, String(host?._inspectorFilter || ''));
    } catch {}

    return;
  }

  const obj = host.selected;

  if (ui.inspectorSubtitle) {
    const name = obj?.name ? String(obj.name) : (obj ? (obj.constructor?.name || '(object)') : 'No selection');
    ui.inspectorSubtitle.textContent = name;
  }

  if (ui.common) ui.common.innerHTML = '';
  if (ui.transform) ui.transform.innerHTML = '';

  if (!obj) {
    if (ui.inspectorSubtitle) {
      ui.inspectorSubtitle.textContent = host._projectMeta ? 'Project' : 'No selection';
    }

    // When nothing is selected, the inspector acts as a project inspector.
    host._rebuildProjectInspector(ui.common);
    return;
  }

  // Editor XML stubs (scene-level declarations)
  if (obj && typeof obj === 'object' && typeof obj.__xmlTag === 'string') {
    rebuildInspectorXmlStub(host, ui, obj);
    return;
  }

  // Common fields
  InspectorFields.addReadonly(ui.common, 'type', obj.constructor?.name || 'unknown');
  InspectorFields.addStringWith(ui.common, 'name', obj, 'name', () => host.rebuildTree());
  InspectorFields.addToggle(ui.common, 'active', obj, 'active');
  InspectorFields.addToggle(ui.common, 'visible', obj, 'visible');

  // Primary camera selection (supports multiple cameras per scene).
  const isCam2D = (obj?.constructor?.name === 'Camera') || (obj?.category === 'camera' && obj?.type === '2D');
  const isCam3D = (obj?.constructor?.name === 'Camera3D') || (obj?.category === 'camera' && obj?.type === '3D');
  if (isCam2D || isCam3D) {
    const isPrimary = isCam2D
      ? (obj === host._sceneCamera2D)
      : (obj === host._sceneCamera3D);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn';
    btn.textContent = isPrimary ? 'Primary Camera' : 'Set As Primary';
    btn.disabled = !!isPrimary;
    btn.addEventListener('click', () => {
      try {
        if (isCam2D && typeof host._setPrimaryAuthoredCamera2D === 'function') host._setPrimaryAuthoredCamera2D(obj);
        if (isCam3D && typeof host._setPrimaryAuthoredCamera3D === 'function') host._setPrimaryAuthoredCamera3D(obj);
      } catch (e) {
        console.warn('Failed to set primary camera', e);
      }
    });

    const wrap = document.createElement('div');
    wrap.style.display = 'flex';
    wrap.style.gap = '8px';
    wrap.style.alignItems = 'center';
    wrap.appendChild(btn);
    InspectorFields.addField(ui.common, 'primary', wrap);
  }

  // followCamera + base offsets
  if (obj && typeof obj === 'object' && ('followCamera' in obj)) {
    // followCamera toggles conditional fields (baseX/baseY), so rebuild.
    InspectorFields.addToggleWith(ui.common, 'followCamera', obj, 'followCamera', () => {
      try { host._blockInspectorAutoRefresh?.(0.35); } catch {}
      try { host.rebuildInspector?.(); } catch {}
    });
    if (obj.followCamera) {
      InspectorFields.addNumber(host, ui.common, 'baseX', obj, 'baseX');
      InspectorFields.addNumber(host, ui.common, 'baseY', obj, 'baseY');
    }
  }

  // Shared 2D tint opacity (Sprite-style). Expose as 0..1.
  if (obj && typeof obj.setTransparency === 'function' && (('transparency' in obj) || ('color' in obj))) {
    InspectorFields.addOpacity01(ui.common, 'opacity', obj);
  }

  // Text fill color (CSS string) is separate from Sprite tint.
  if (obj && (typeof obj.textColor === 'string' || typeof obj._textColor === 'string')) {
    InspectorFields.addCssColor(ui.common, 'color', obj, 'textColor');
  }

  // Sprite / AnimatedSprite image source
  if (obj && typeof obj === 'object' && ('imageSrc' in obj)) {
    InspectorFields.addStringWithDrop(ui.common, 'imageSrc', obj, 'imageSrc', () => {
      // Best-effort live reload for sprites.
      try {
        if (typeof obj.loadTexture === 'function') {
          // Release previous cached texture if renderer supports it.
          const key = obj.textureKey;
          if (key && obj.renderer?.releaseTexture) {
            try { obj.renderer.releaseTexture(key); } catch {}
          }
          obj.texture = null;
          obj.textureKey = null;
          obj.loadTexture(String(obj.imageSrc || ''));
        }
      } catch {}
    }, { acceptExtensions: ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp'], importToWorkspaceUrl: true, debounceMs: 200 });
  }

  // AnimatedSprite frame size
  if (host._isAnimatedSprite(obj)) {
    if (typeof obj.frameWidth === 'number') InspectorFields.addNumber(host, ui.common, 'frameWidth', obj, 'frameWidth');
    if (typeof obj.frameHeight === 'number') InspectorFields.addNumber(host, ui.common, 'frameHeight', obj, 'frameHeight');
  }

  // Text fields
  if (obj && obj.constructor?.name === 'Text') {
    InspectorFields.addString(ui.common, 'text', obj, 'text');
    InspectorFields.addNumber(host, ui.common, 'fontSize', obj, 'fontSize');
    InspectorFields.addTextFontFamily(ui.common, 'fontFamily', obj);
  }

  // ClickableArea nullable width/height (XML allows omission)
  if (obj && obj.constructor?.name === 'ClickableArea') {
    InspectorFields.addNullableNumber(ui.common, 'width', obj, 'width');
    InspectorFields.addNullableNumber(ui.common, 'height', obj, 'height');
  }

  // Camera fields
  if (isCam3D) {
    InspectorFields.addNumber(host, ui.common, 'fovY', obj, 'fovY');
    InspectorFields.addNumber(host, ui.common, 'near', obj, 'near');
    InspectorFields.addNumber(host, ui.common, 'far', obj, 'far');
  }

  // Audio fields
  if (obj && obj.constructor?.name === 'Audio') {
    InspectorFields.addStringWithDrop(ui.common, 'src', obj, 'src', () => {
      // Note: src is authoring-only here; live reload requires scene URL resolution.
    }, { acceptExtensions: ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac'], importToWorkspaceUrl: true });
    InspectorFields.addToggle(ui.common, 'loop', obj, 'loop');
    InspectorFields.addToggle(ui.common, 'autoplay', obj, 'autoplay');
    InspectorFields.addToggle(ui.common, 'stopOnSceneChange', obj, 'stopOnSceneChange');
    InspectorFields.addNumber(host, ui.common, 'volume', obj, 'volume');
  }

  /** @param {string} title */
  const addSubSection = (title) => {
    if (!ui.common) return;
    const el = document.createElement('div');
    el.className = 'sectionTitle subSectionTitle';
    el.textContent = title;
    ui.common.appendChild(el);
  };

  // MeshNode fields
  if (obj && obj.constructor?.name === 'MeshNode') {
    addSubSection('Assets');
    // MeshNode.source is normally a primitive name or a named <Mesh name="..."/> resource.
    // In the editor, also accept a direct .gltf/.glb path and auto-register a mesh resource.
    const sceneAny = /** @type {any} */ (host.currentScene || null);
    const getRenderer = () => /** @type {any} */ (host?._renderer || host?.engine?.renderer || null);
    const getSceneBaseUrl = () => {
      try {
        const p = String(host?._scenePath || '').trim();
        if (!p) throw new Error('no scene path');
        const sceneUrl = new URL(p, window.location.href);
        return new URL('.', sceneUrl).toString();
      } catch {
        return (typeof document !== 'undefined' && document.baseURI) ? document.baseURI : (typeof window !== 'undefined' ? window.location.href : '');
      }
    };

    const ensureMeshXmlArray = () => {
      if (!sceneAny) return /** @type {any[]} */ ([]);
      if (!Array.isArray(sceneAny._meshXml)) sceneAny._meshXml = [];
      return /** @type {any[]} */ (sceneAny._meshXml);
    };

    /** @returns {Map<string, string[]>} */
    const getGltfMaterialKeysByMeshResource = () => {
      if (!sceneAny) return new Map();
      if (!(sceneAny.__gltfMaterialKeysByMeshResource instanceof Map)) {
        sceneAny.__gltfMaterialKeysByMeshResource = new Map();
      }
      return /** @type {Map<string, string[]>} */ (sceneAny.__gltfMaterialKeysByMeshResource);
    };

    /** @returns {Map<string, string>} */
    const getMaterialOverrideSourceByKey = () => {
      if (!sceneAny) return new Map();
      if (!(sceneAny.__materialOverrideSourceByKey instanceof Map)) {
        sceneAny.__materialOverrideSourceByKey = new Map();
      }
      return /** @type {Map<string, string>} */ (sceneAny.__materialOverrideSourceByKey);
    };

    /** @param {string} base */
    const makeUniqueMeshName = (base) => {
      const clean = String(base || 'Mesh').replace(/[^a-zA-Z0-9_\-]/g, '_') || 'Mesh';
      const used = new Set();
      try {
        if (sceneAny?.meshDefinitions instanceof Map) {
          for (const k of sceneAny.meshDefinitions.keys()) used.add(String(k));
        }
      } catch {}
      for (const m of ensureMeshXmlArray()) used.add(String(m?.name || ''));
      if (!used.has(clean)) return clean;
      for (let i = 2; i < 10000; i++) {
        const n = `${clean}_${i}`;
        if (!used.has(n)) return n;
      }
      return `${clean}_${Date.now()}`;
    };

    /** @param {string} srcRaw */
    const registerGltfMeshResource = (srcRaw) => {
      if (!sceneAny) return null;
      const r = getRenderer();
      if (!r || !r.gl) return null;

      const src = String(srcRaw || '').trim();
      const baseUrl = getSceneBaseUrl();

      const meshes = ensureMeshXmlArray();

      // Reuse an existing <Mesh> resource if it already points at this GLTF.
      // This avoids creating duplicates every time the user picks the same file.
      /** @param {any} s */
      const normalizeSrc = (s) => String(s || '').trim().replace(/\\/g, '/');
      const srcNorm = normalizeSrc(src);
      const srcAlt = srcNorm.startsWith('fluxion://workspace/') ? srcNorm.replace(/^fluxion:\/\/workspace\//, '') : `fluxion://workspace/${srcNorm.replace(/^\/+/, '')}`;
      const existing = meshes.find((m) => {
        if (!m || m.__xmlTag !== 'Mesh') return false;
        const ms = normalizeSrc(m.source);
        return ms === srcNorm || ms === srcAlt;
      }) || null;

      if (existing && String(existing.name || '').trim()) {
        const existingName = String(existing.name).trim();
        // Ensure there's at least a placeholder definition for the renderer to resolve.
        // If it already exists, we won't stomp it.
        try {
          const hasDef = !!(sceneAny.getMeshDefinition?.(existingName));
          if (!hasDef) sceneAny.registerMesh?.(existingName, { type: 'gltf', url: (() => { try { return new URL(src, baseUrl).toString(); } catch { return src; } })() });
        } catch {}
        return { meshName: existingName, createdStub: false, loadPromise: null };
      }

      // Derive a stable mesh name from the file name.
      const file = src.replace(/^fluxion:\/\/workspace\//, '').split('/').pop()?.split('\\').pop() || 'Model';
      const base = file.replace(/\.[^.]+$/, '') || 'Model';
      const meshName = makeUniqueMeshName(base);

      // Add/keep XML stub for round-tripping.
      meshes.push({
        __xmlTag: 'Mesh',
        name: meshName,
        source: src,
        type: '',
        color: '',
        params: {},
      });

      // Track editor-imported resources for cleanup if the last referencing MeshNode is deleted.
      if (!(sceneAny.__importedMeshResources instanceof Map)) {
        sceneAny.__importedMeshResources = new Map();
      }
      /** @type {{ source: string, meshKeys: string[], materialKeys: string[] }} */
      const importMeta = { source: src, meshKeys: [meshName], materialKeys: [] };
      try { sceneAny.__importedMeshResources.set(meshName, importMeta); } catch {}

      // Resolve URL like SceneLoader does.
      let gltfUrl = '';
      try {
        gltfUrl = new URL(src, baseUrl).toString();
      } catch {
        gltfUrl = src;
      }

      const loadPromise = (async () => {
        try {
          const result = await loadGLTF(gltfUrl, r.gl, r);
          if (!result) return null;

		  const resultAny = /** @type {any} */ (result);

          // Namespace to avoid collisions, same strategy as SceneLoader.
          const ns = `${meshName}::`;
      /** @param {string} k */
      const nsMat = (k) => `${ns}${k}`;
      /** @param {string} k */
      const nsMesh = (k) => `${ns}${k}`;

          for (const [meshKey, mesh] of result.meshes.entries()) {
			const matKey = resultAny.meshMaterials?.get(meshKey || '');
            const hint = nsMat(matKey || '__gltf_default__');
            sceneAny.registerMesh?.(nsMesh(meshKey), { type: 'gltf', mesh, material: hint });
            try { importMeta.meshKeys.push(nsMesh(meshKey)); } catch {}
            if (!sceneAny.getMeshDefinition?.(meshKey)) sceneAny.registerMesh?.(meshKey, { type: 'gltf', mesh, material: hint });
          }

          // Point meshName at the first mesh.
          // IMPORTANT: avoid registering a gltf-group here.
          // The SceneLoader expands gltf-group into NEW MeshNodes, but in the inspector flow
          // we want to keep editing the currently selected MeshNode.
          if (result.meshes.size > 0) {
            const firstEntry = Array.from(result.meshes.entries())[0];
            const firstMeshName = firstEntry[0];
            const mesh = firstEntry[1];
            const matKey = resultAny.meshMaterials?.get(firstMeshName);
            sceneAny.registerMesh?.(meshName, { type: 'gltf', mesh, material: nsMat(matKey || '__gltf_default__') });
          }

          // Register materials.
          /** @type {string[]} */
          const materialKeys = [];
          for (const [matName, mat] of result.materials.entries()) {
            const key = nsMat(matName);
            materialKeys.push(key);
            sceneAny.registerMaterial?.(key, mat);
            try { importMeta.materialKeys.push(key); } catch {}
            if (!sceneAny.getMaterialDefinition?.(matName)) sceneAny.registerMaterial?.(matName, mat);
          }

          // Track how many materials are present on this model so the inspector can show N inputs.
          try {
            getGltfMaterialKeysByMeshResource().set(meshName, materialKeys);
          } catch {}

          return result;
        } catch (e) {
          console.warn('Failed to load GLTF for MeshNode source', gltfUrl, e);
          return null;
        }
      })();

      r.trackAssetPromise?.(loadPromise);
      // Seed definition as a promise (mirrors SceneLoader behavior)
      sceneAny.registerMesh?.(meshName, { type: 'gltf', promise: loadPromise, url: gltfUrl });
      return { meshName, createdStub: true, loadPromise };
    };

    InspectorFields.addStringWithDrop(ui.common, 'source', obj, 'source', () => {
      const raw = String(obj.source || '').trim();
      const lower = raw.toLowerCase();
      const isGltfPath = lower.endsWith('.gltf') || lower.endsWith('.glb') || lower.includes('.gltf?') || lower.includes('.glb?') || lower.endsWith('.gltf#') || lower.endsWith('.glb#');

      if (sceneAny && isGltfPath) {
        const reg = registerGltfMeshResource(raw);
        const meshName = reg && typeof reg === 'object' ? reg.meshName : null;
        const createdStub = !!(reg && typeof reg === 'object' && reg.createdStub);
        const loadPromise = (reg && typeof reg === 'object') ? reg.loadPromise : null;
        if (meshName) {
          // Bind node to the named mesh resource so it resolves like normal MeshNodes.
          // Note: don't set meshDefinition immediately (it may still be a promise-only placeholder).
          // We'll set the real meshDefinition once the promise resolves.
          try { obj.setSource?.(meshName); } catch { obj.source = meshName; }

          // Preserve current selection (the MeshNode) even if the UI rebuilds.
          const prevSelected = host?.selected;
          try {
            if (createdStub) host.rebuildTree?.();
          } catch {}
          try {
            host.selected = prevSelected;
          } catch {}
          try {
            host.rebuildInspector?.();
          } catch {}
          try {
            host.selected = prevSelected;
          } catch {}

          // Once the GLTF promise resolves, re-fetch the resolved mesh definition and apply it
          // to THIS MeshNode so it actually draws the imported mesh.
          if (loadPromise && typeof loadPromise.then === 'function') {
            Promise.resolve(loadPromise)
              .then(() => {
                try {
                  const def2 = sceneAny.getMeshDefinition?.(meshName) || null;
                  if (def2 && def2.type === 'gltf' && def2.mesh) {
                    obj.setMeshDefinition?.(def2);

                    // Match SceneLoader behavior: if the mesh definition suggests a default material
                    // and the node doesn't have one, auto-apply it so GLTF imports aren't white.
                    if (!obj.material && def2.material && typeof def2.material === 'string') {
                      const mdef = sceneAny.getMaterialDefinition?.(def2.material) || null;
                      if (mdef) {
                        if (typeof mdef.then === 'function') {
                          Promise.resolve(mdef).then((mat) => {
                            if (mat && !obj.material) obj.setMaterial?.(mat);
                          }).catch(() => {});
                        } else {
                          obj.setMaterial?.(mdef);
                        }
                      }
                    }
                  }
                } catch {}
              })
              .catch(() => {});
          }
          return;
        }
      }

      // Primitive/named resource path: clear cached mesh so it rebuilds next draw.
      try { obj.setSource?.(raw); } catch { obj.source = raw; }
    }, { acceptExtensions: ['.gltf', '.glb'], importToWorkspaceUrl: true, debounceMs: 250 });

    // Material assignment and per-material overrides show up frequently; group them.
    addSubSection('Rendering');
    // --- Material (.mat) input + inline overrides ---
    // (sceneAny/getRenderer/getSceneBaseUrl are defined above)

    /** @returns {any[]} */
    const getMaterialsXml = () => {
      if (!sceneAny) return [];
      if (!Array.isArray(sceneAny._materialXml)) sceneAny._materialXml = [];
      return sceneAny._materialXml;
    };

    /** @param {string} name */
    const findMatStub = (name) => {
      if (!name) return null;
      const mats = getMaterialsXml();
      return mats.find((m) => m && m.__xmlTag === 'Material' && String(m.name) === String(name)) || null;
    };

    /** @param {string} base */
    const makeUniqueMatName = (base) => {
      const mats = getMaterialsXml();
      const used = new Set(mats.map((m) => String(m?.name || '')).filter(Boolean));
      const clean = String(base || 'Material').replace(/[^a-zA-Z0-9_\-]/g, '_') || 'Material';
      if (!used.has(clean)) return clean;
      for (let i = 2; i < 10000; i++) {
        const n = `${clean}_${i}`;
        if (!used.has(n)) return n;
      }
      return `${clean}_${Date.now()}`;
    };

    /** @param {string} suggestedSource */
    const ensureMatStubForNode = (suggestedSource) => {
      // Preserve authoring name even if material resolves to an instance.
      if (!('materialName' in obj) && typeof obj.material === 'string') {
        obj.materialName = obj.material;
      }

      const existing = findMatStub(String(obj.materialName || ''));
      if (existing) return existing;

      const mats = getMaterialsXml();
      const src = String(suggestedSource || '').trim();
      const baseFromFile = src ? src.split('/').pop()?.split('\\').pop()?.replace(/\.[^.]+$/, '') : '';
      const baseFromNode = String(obj.name || 'Mesh') + '_Mat';
      const name = makeUniqueMatName(baseFromFile || baseFromNode);
      /** @type {any} */
      const stub = {
        __xmlTag: 'Material',
        name,
        source: '',
        baseColorFactor: '',
        metallicFactor: '',
        roughnessFactor: '',
        normalScale: '',
        aoStrength: '',
        emissiveFactor: '',
        alphaMode: '',
        alphaCutoff: '',
      };
      mats.push(stub);

      // Bind node to this material name.
      obj.materialName = name;
      try { obj.material = name; } catch {}

      // Tree includes scene-level stubs.
      try { host.rebuildTree(); } catch {}
      return stub;
    };

    /** @param {any} stub @param {any} mat */
    const applyStubOverridesToMaterial = (stub, mat) => {
      if (!stub || !mat) return;
      const baseColor = String(stub.baseColorFactor || '').trim();
      if (baseColor) {
        const c = SceneLoader._parseColor(baseColor);
        mat.baseColorFactor = [c[0], c[1], c[2], c[3]];
        try { mat.albedoColor = [c[0], c[1], c[2], c[3]]; } catch {}
      }

      const metallic = parseFloat(String(stub.metallicFactor || '').trim());
      if (Number.isFinite(metallic)) mat.metallicFactor = Math.min(1, Math.max(0, metallic));

      const roughness = parseFloat(String(stub.roughnessFactor || '').trim());
      if (Number.isFinite(roughness)) mat.roughnessFactor = Math.min(1, Math.max(0.04, roughness));

      const normalScale = parseFloat(String(stub.normalScale || '').trim());
      if (Number.isFinite(normalScale)) mat.normalScale = normalScale;

      const aoStrength = parseFloat(String(stub.aoStrength || '').trim());
      if (Number.isFinite(aoStrength)) mat.aoStrength = aoStrength;

      const emissive = String(stub.emissiveFactor || '').trim();
      if (emissive) {
        const c = SceneLoader._parseColor(emissive);
        mat.emissiveFactor = [c[0], c[1], c[2]];
      }

      const alphaMode = String(stub.alphaMode || '').trim();
      if (alphaMode) mat.alphaMode = alphaMode.toUpperCase();

      const alphaCutoff = parseFloat(String(stub.alphaCutoff || '').trim());
      if (Number.isFinite(alphaCutoff)) mat.alphaCutoff = alphaCutoff;
    };

    /** @param {any} stub */
    const applyLiveMaterialFromStub = (stub) => {
      if (!sceneAny || !stub) return;
      const name = String(stub.name || '').trim();
      if (!name) return;
      const def = sceneAny.getMaterialDefinition?.(name) || null;
      if (!def) return;

      /** @param {any} mat */
      const apply = (mat) => {
        applyStubOverridesToMaterial(stub, mat);
        // If this MeshNode references this material, ensure it uses the instance.
        if (String(obj.materialName || '') === name) {
          try { obj.setMaterial?.(mat); } catch {}
        }
      };

      if (def && typeof def.then === 'function') {
        def.then((/** @type {any} */ mat) => {
          if (mat) apply(mat);
        }).catch(() => {});
      } else {
        apply(def);
      }
    };

    // If this MeshNode is backed by a GLTF-imported mesh resource, show a .mat override input
    // for each GLTF material present in the model.
    // (This is independent from the node's single "material" override below.)
    try {
      const keyMap = getGltfMaterialKeysByMeshResource();
      const meshResKey = String(obj.source || '').trim();
      let matKeys = keyMap.get(meshResKey) || null;

      // Fallbacks for meshes created by SceneLoader (no editor tracking):
      // - gltf-group: collect unique material hints from parts
      // - gltf: scan materialDefinitions for namespaced keys, or wait on promise
      if ((!matKeys || matKeys.length === 0) && sceneAny && meshResKey) {
        try {
          const def = sceneAny.getMeshDefinition?.(meshResKey) || null;
          if (def && def.type === 'gltf-group' && Array.isArray(def.parts)) {
            const derived = def.parts.map((/** @type {any} */ p) => String(p?.material || '')).filter(Boolean);
            matKeys = derived;
            if (derived.length > 0) keyMap.set(meshResKey, derived);
          } else {
            const prefix = `${meshResKey}::`;
            const found = [];
            try {
              if (sceneAny.materialDefinitions instanceof Map) {
                for (const k of sceneAny.materialDefinitions.keys()) {
                  const ks = String(k || '');
                  if (ks.startsWith(prefix)) found.push(ks);
                }
              }
            } catch {}
            if (found.length > 0) {
              matKeys = found;
              keyMap.set(meshResKey, matKeys);
            }

            if ((!matKeys || matKeys.length === 0) && def && typeof def.promise?.then === 'function') {
              Promise.resolve(def.promise)
                .then((result) => {
                  const resAny = /** @type {any} */ (result);
                  const names = resAny?.materials && typeof resAny.materials?.keys === 'function'
                    ? Array.from(resAny.materials.keys()).map((k) => `${meshResKey}::${k}`)
                    : [];
                  if (names.length > 0) {
                    try { keyMap.set(meshResKey, names); } catch {}
                    try { host.rebuildInspector?.(); } catch {}
                  }
                })
                .catch(() => {});
            }
          }
        } catch {}
      }

      if (matKeys && Array.isArray(matKeys) && matKeys.length > 0) {
        // Show summary (count + names) above the per-material override inputs.
        try {
          const uniq = Array.from(new Set(matKeys.map((k) => String(k || '').trim()).filter(Boolean)));
          if (uniq.length > 0) {
            InspectorFields.addReadonly(ui.common, 'materials', uniq.length);
            const list = document.createElement('div');
            list.className = 'readonlyBox';
            list.style.whiteSpace = 'pre-wrap';
            list.textContent = uniq
              .map((k) => (k.includes('::') ? k.split('::').slice(-1)[0] : k))
              .join('\n');
            InspectorFields.addField(ui.common, 'materialNames', list);
          }
        } catch {}

        const overrideMap = getMaterialOverrideSourceByKey();
        const r = getRenderer();
        const baseUrl = getSceneBaseUrl();

        /** @param {string} rawPath */
        const tryOpenMatAsset = async (rawPath) => {
          const raw = String(rawPath || '').trim();
          if (!raw) return;
          if (!raw.toLowerCase().endsWith('.mat')) return;
          try {
            if (typeof host._loadMatAssetForInspector === 'function') await host._loadMatAssetForInspector(raw);
            if (typeof host.rebuildInspector === 'function') host.rebuildInspector();
          } catch (e) {
            console.warn('Failed to open material asset inspector for', raw, e);
          }
        };

        /** @param {string} matKey @param {string} rawPath */
        const applyMatOverride = (matKey, rawPath) => {
          const raw = String(rawPath || '').trim();
          if (!sceneAny || !matKey) return;
          if (!raw) {
            overrideMap.delete(matKey);
            return;
          }
          overrideMap.set(matKey, raw);
          if (!r) return;
          const resolved = SceneLoader._resolveSceneResourceUrl(raw, baseUrl);
          const p = Material.load(resolved, r);
          r.trackAssetPromise?.(p);
          sceneAny.registerMaterial?.(matKey, p);

          // If this node is currently using this GLTF material hint, apply live.
          try {
            const hint = obj?.meshDefinition?.material;
            if (typeof hint === 'string' && hint === matKey) {
              p.then((mat) => {
                if (mat) obj.setMaterial?.(mat);
              }).catch(() => {});
            }
          } catch {}
        };

        for (let i = 0; i < matKeys.length; i++) {
          const matKey = String(matKeys[i] || '').trim();
          if (!matKey) continue;
          const short = matKey.includes('::') ? matKey.split('::').slice(-1)[0] : matKey;
          /** @type {any} */
          const rowObj = { file: overrideMap.get(matKey) || '' };
          InspectorFields.addStringWith(ui.common, `gltfMat[${i}] ${short}`, rowObj, 'file', () => {
            applyMatOverride(matKey, String(rowObj.file || ''));
          });
        }
      }
    } catch {}

    // Bind a UI field to the material source path (stored on the scene-level Material stub).
    const currentStub = findMatStub(String(obj.materialName || ''));
    obj.materialFile = currentStub?.source || '';

    /** @param {string} rawPath */
    const tryOpenMatAsset = async (rawPath) => {
      const raw = String(rawPath || '').trim();
      if (!raw) return;
      if (!raw.toLowerCase().endsWith('.mat')) return;
      try {
        if (typeof host._loadMatAssetForInspector === 'function') await host._loadMatAssetForInspector(raw);
        if (typeof host.rebuildInspector === 'function') host.rebuildInspector();
      } catch (e) {
        console.warn('Failed to open material asset inspector for', raw, e);
      }
    };

    InspectorFields.addStringWithDrop(ui.common, 'material', obj, 'materialFile', () => {
      const raw = String(obj.materialFile || '').trim();
      if (!raw) {
        // Unassign explicit material (falls back to default material).
        obj.materialName = '';
        try { obj.material = ''; } catch {}
        try { obj.setMaterial?.(null); } catch {}
        return;
      }

      const stub = ensureMatStubForNode(raw);
      stub.source = raw;

      // Load and register material for this scene.
      const r = getRenderer();
      if (!r) return;
      const baseUrl = getSceneBaseUrl();
      const resolved = SceneLoader._resolveSceneResourceUrl(stub.source, baseUrl);

      // Ensure node references this material name.
      obj.materialName = String(stub.name || '');
      try { obj.material = obj.materialName; } catch {}

      // Load .mat and apply overrides on top.
      const p = Material.load(resolved, r).then((mat) => {
        applyStubOverridesToMaterial(stub, mat);
        return mat;
      });
      r?.trackAssetPromise?.(p);
      sceneAny.registerMaterial?.(obj.materialName, p);
      p.then((mat) => {
        if (mat) obj.setMaterial?.(mat);
      }).catch(() => {});
    }, {
      acceptExtensions: ['.mat'],
      debounceMs: 250,
      onClick: (_ev, input) => { tryOpenMatAsset(input.value); },
      onFocus: (_ev, input) => { tryOpenMatAsset(input.value); },
    });

    // Inline material settings (stored on the Material stub; applied live to the loaded material).
    // Ensure a material stub exists if the node has a material assigned
    let matStub = findMatStub(String(obj.materialName || ''));
    if (!matStub && (obj.materialName || obj.materialFile)) {
      // Create a stub for the material if it doesn't exist
      matStub = ensureMatStubForNode(obj.materialFile || '');
    }
    
    if (matStub) {
      addSubSection('Overrides');

      // Distinguish shared material (scene-level stub) vs per-instance override on node.
      /** @param {any} stub */
      const cloneStubToOverride = (stub) => {
        /** @type {any} */
        const o = {
          name: String(stub?.name || ''),
          source: String(stub?.source || ''),
          baseColorFactor: String(stub?.baseColorFactor || ''),
          metallicFactor: String(stub?.metallicFactor || ''),
          roughnessFactor: String(stub?.roughnessFactor || ''),
          normalScale: String(stub?.normalScale || ''),
          aoStrength: String(stub?.aoStrength || ''),
          emissiveFactor: String(stub?.emissiveFactor || ''),
          alphaMode: String(stub?.alphaMode || ''),
          alphaCutoff: String(stub?.alphaCutoff || ''),
          baseColorTexture: String(stub?.baseColorTexture || ''),
          metallicTexture: String(stub?.metallicTexture || ''),
          roughnessTexture: String(stub?.roughnessTexture || ''),
          metallicRoughnessPacked: !!stub?.metallicRoughnessPacked,
          normalTexture: String(stub?.normalTexture || ''),
          aoTexture: String(stub?.aoTexture || ''),
          emissiveTexture: String(stub?.emissiveTexture || ''),
          alphaTexture: String(stub?.alphaTexture || ''),
          uvScale: Array.isArray(stub?.uvScale) && stub.uvScale.length >= 2 ? [Number(stub.uvScale[0])||1, Number(stub.uvScale[1])||1] : [1,1],
        };
        return o;
      };

      // Status + controls
      const modeRow = document.createElement('div');
      modeRow.className = 'row rowCenter';
      const statusBox = document.createElement('div');
      statusBox.className = 'readonlyBox';
      statusBox.style.flex = '1 1 auto';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn';
      btn.style.flex = '0 0 auto';
      const overrideEnabled = !!obj._materialOverrideEnabled;
      statusBox.textContent = overrideEnabled ? 'Material Mode: Instance Override' : 'Material Mode: Shared Asset';
      btn.textContent = overrideEnabled ? 'Disable Override' : 'Enable Override';
      btn.addEventListener('click', () => {
        if (obj._materialOverrideEnabled) {
          obj._materialOverrideEnabled = false;
          // keep override object, but stop using it
        } else {
          obj._materialOverrideEnabled = true;
          if (!obj._materialOverride) obj._materialOverride = cloneStubToOverride(matStub);
          // Ensure name/source are in sync
          obj._materialOverride.name = String(matStub?.name || obj.materialName || '');
          obj._materialOverride.source = String(matStub?.source || obj.materialFile || '');
        }
        try { host.rebuildInspector?.(); } catch {}
      });
      modeRow.appendChild(statusBox);
      modeRow.appendChild(btn);
      InspectorFields.addField(ui.common, 'Material Mode', modeRow);

      // Choose active target object for UI bindings (override or shared stub).
      /** @type {any} */
      let activeOverrides = obj._materialOverrideEnabled ? (obj._materialOverride || (obj._materialOverride = cloneStubToOverride(matStub))) : matStub;
      if (!('baseColorFactor' in matStub)) matStub.baseColorFactor = '';
      if (!('metallicFactor' in matStub)) matStub.metallicFactor = '';
      if (!('roughnessFactor' in matStub)) matStub.roughnessFactor = '';
      if (!('normalScale' in matStub)) matStub.normalScale = '';
      if (!('aoStrength' in matStub)) matStub.aoStrength = '';
      if (!('emissiveFactor' in matStub)) matStub.emissiveFactor = '';
      if (!('alphaMode' in matStub)) matStub.alphaMode = '';
      if (!('alphaCutoff' in matStub)) matStub.alphaCutoff = '';
      if (!('baseColorTexture' in matStub)) matStub.baseColorTexture = '';
      if (!('metallicTexture' in matStub)) matStub.metallicTexture = '';
      if (!('roughnessTexture' in matStub)) matStub.roughnessTexture = '';
      if (!('metallicRoughnessPacked' in matStub)) matStub.metallicRoughnessPacked = false;
      if (!('normalTexture' in matStub)) matStub.normalTexture = '';
      if (!('aoTexture' in matStub)) matStub.aoTexture = '';
      if (!('emissiveTexture' in matStub)) matStub.emissiveTexture = '';
      if (!('alphaTexture' in matStub)) matStub.alphaTexture = '';
      if (!('uvScale' in matStub)) matStub.uvScale = [1, 1];
      if (!Array.isArray(matStub.uvScale) || matStub.uvScale.length < 2) matStub.uvScale = [1, 1];

      const apply = () => applyLiveMaterialFromStub(activeOverrides);

      // Groups matching standalone material UI
      const gAlbedo = addGroup('Albedo', true);
      const gOrm = addGroup('Orm', true);
      const gNormal = addGroup('Normal Map', false);
      const gAo = addGroup('Ambient Occlusion', false);
      const gEmission = addGroup('Emission', false);
      const gTransparency = addGroup('Transparency', false);
      const gUv = addGroup('Uv', false);

      // Albedo
      InspectorFields.addAutoWith(gAlbedo, 'Color', activeOverrides, 'baseColorFactor', apply);
      const texOpts = { acceptExtensions: ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.tga'], importToWorkspaceUrl: true };
      /** @param {string} labelHint */
      const texPreviewOpts = (labelHint) => ({
        ...texOpts,
        preview: true,
        hintText: labelHint,
        /** @param {string} rel */
        previewResolve: (rel) => {
          try {
            const baseUrl = getSceneBaseUrl();
            return SceneLoader._resolveSceneResourceUrl(rel, baseUrl);
          } catch {
            return String(rel || '');
          }
        },
      });
      InspectorFields.addStringWithDrop(gAlbedo, 'Texture', activeOverrides, 'baseColorTexture', apply, texPreviewOpts('Albedo RGB texture')); 

      // ORM
      InspectorFields.addAutoWith(gOrm, 'Metallic', activeOverrides, 'metallicFactor', apply);
      InspectorFields.addAutoWith(gOrm, 'Roughness', activeOverrides, 'roughnessFactor', apply);
      InspectorFields.addAutoWith(gOrm, 'Packed MR', activeOverrides, 'metallicRoughnessPacked', apply);
      InspectorFields.addStringWithDrop(gOrm, 'Metallic Texture', activeOverrides, 'metallicTexture', apply, texPreviewOpts('Metallic in R channel (packed)'));
      InspectorFields.addStringWithDrop(gOrm, 'Roughness Texture', activeOverrides, 'roughnessTexture', apply, texPreviewOpts('Roughness in G channel (packed)'));

      // Normal Map
      InspectorFields.addAutoWith(gNormal, 'Scale', activeOverrides, 'normalScale', apply);
      InspectorFields.addStringWithDrop(gNormal, 'Texture', activeOverrides, 'normalTexture', apply, texPreviewOpts('Normal map RGB (tangent-space)'));

      // Ambient Occlusion
      InspectorFields.addAutoWith(gAo, 'Strength', activeOverrides, 'aoStrength', apply);
      InspectorFields.addStringWithDrop(gAo, 'Texture', activeOverrides, 'aoTexture', apply, texPreviewOpts('Ambient occlusion in R channel'));

      // Emission
      /**
       * @param {HTMLElement|null} container
       * @param {string} label
       * @param {any} obj
       * @param {string} key
       */
      const addVec3ArrayWith = (container, label, obj, key) => {
        if (!container || !obj || !(key in obj)) return;
        const arr = obj[key];
        if (!Array.isArray(arr) || arr.length < 3) return;
        const wrap = document.createElement('div');
        wrap.style.display = 'flex';
        wrap.style.gap = '6px';
        /** @param {number} i */
        const make = (i) => {
          const input = document.createElement('input');
          input.type = 'number';
          input.step = '0.01';
          input.value = String(Number(arr[i]) || 0);
          input.style.width = '80px';
          const applyVec = () => {
            const v = Number(input.value);
            if (!Number.isFinite(v)) return;
            arr[i] = v;
            apply();
          };
          input.addEventListener('input', applyVec);
          input.addEventListener('change', applyVec);
          return input;
        };
        wrap.appendChild(make(0));
        wrap.appendChild(make(1));
        wrap.appendChild(make(2));
        InspectorFields.addField(container, label, wrap);
      };
      InspectorFields.addAutoWith(gEmission, 'Color', activeOverrides, 'emissiveFactor', apply);
      InspectorFields.addStringWithDrop(gEmission, 'Texture', activeOverrides, 'emissiveTexture', apply, texPreviewOpts('Emission RGB texture'));

      // Transparency
      InspectorFields.addAutoWith(gTransparency, 'Alpha Mode', activeOverrides, 'alphaMode', apply);
      InspectorFields.addAutoWith(gTransparency, 'Alpha Cutoff', activeOverrides, 'alphaCutoff', apply);
      InspectorFields.addStringWithDrop(gTransparency, 'Alpha Texture', activeOverrides, 'alphaTexture', apply, texPreviewOpts('Alpha in A channel (or grayscale)'));

      // UV
      /**
       * @param {HTMLElement|null} container
       * @param {string} label
       * @param {any} obj
       * @param {string} key
       */
      const addVec2ArrayWith = (container, label, obj, key) => {
        if (!container || !obj || !(key in obj)) return;
        const arr = obj[key];
        if (!Array.isArray(arr) || arr.length < 2) return;
        const wrap = document.createElement('div');
        wrap.style.display = 'flex';
        wrap.style.gap = '6px';
        /** @param {number} i */
        const make = (i) => {
          const input = document.createElement('input');
          input.type = 'number';
          input.step = '0.01';
          input.value = String(Number(arr[i]) || 1);
          input.style.width = '80px';
          const applyVec = () => {
            const v = Number(input.value);
            if (!Number.isFinite(v)) return;
            arr[i] = v;
            apply();
          };
          input.addEventListener('input', applyVec);
          input.addEventListener('change', applyVec);
          return input;
        };
        wrap.appendChild(make(0));
        wrap.appendChild(make(1));
        InspectorFields.addField(container, label, wrap);
      };
      addVec2ArrayWith(gUv, 'UV Scale', activeOverrides, 'uvScale');
    }

    // Primitive params when meshDefinition is inline
    const p = obj?.meshDefinition?.params;
    if (p && typeof p === 'object') {
      addSubSection('Primitive Params');
      for (const k of ['width', 'height', 'depth', 'size', 'radius', 'subdivisions', 'radialSegments', 'heightSegments', 'capSegments']) {
        if (!(k in p)) continue;
        InspectorFields.addNumber(host, ui.common, `param.${k}`, p, k);
      }
    }
  }

  // Lights
  if (obj && obj.isLight) {
    addSubSection('Lighting');
    if (Array.isArray(obj.color) && obj.color.length >= 3) InspectorFields.addColorVec3(ui.common, 'color', obj.color);
    if (typeof obj.intensity === 'number') InspectorFields.addNumber(host, ui.common, 'intensity', obj, 'intensity');
    if (obj.constructor?.name === 'DirectionalLight') {
      if (Array.isArray(obj.direction) && obj.direction.length >= 3) InspectorFields.addVec3Array(ui.common, 'direction', obj.direction, { normalize: true });
    }
    if (obj.constructor?.name === 'PointLight') {
      if (Array.isArray(obj.position) && obj.position.length >= 3) InspectorFields.addVec3Array(ui.common, 'position', obj.position);
      if (typeof obj.range === 'number') InspectorFields.addNumber(host, ui.common, 'range', obj, 'range');
    }
    if (obj.constructor?.name === 'SpotLight') {
      if (Array.isArray(obj.position) && obj.position.length >= 3) InspectorFields.addVec3Array(ui.common, 'position', obj.position);
      if (Array.isArray(obj.direction) && obj.direction.length >= 3) InspectorFields.addVec3Array(ui.common, 'direction', obj.direction, { normalize: true });
      if (typeof obj.range === 'number') InspectorFields.addNumber(host, ui.common, 'range', obj, 'range');
      if (typeof obj.innerAngleDeg === 'number') InspectorFields.addNumber(host, ui.common, 'innerAngleDeg', obj, 'innerAngleDeg');
      if (typeof obj.outerAngleDeg === 'number') InspectorFields.addNumber(host, ui.common, 'outerAngleDeg', obj, 'outerAngleDeg');
    }
  }

  if (host._isAnimatedSprite(obj)) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn';
    btn.textContent = 'Animations...';
    btn.addEventListener('click', () => host._openAnimSpriteEditor());
    InspectorFields.addField(ui.common, 'animations', btn);
  }

  // Transform fields (mode-specific)
  if (host.mode === '2d') {
    if (typeof obj.x === 'number') InspectorFields.addNumber2DPos(ui.transform, 'x', obj, 'x');
    if (typeof obj.y === 'number') InspectorFields.addNumber2DPos(ui.transform, 'y', obj, 'y');
    InspectorFields.add2DLayerField(host, ui.transform, obj);
    if (typeof obj.width === 'number') InspectorFields.addNumber(host, ui.transform, 'width', obj, 'width');
    if (typeof obj.height === 'number') InspectorFields.addNumber(host, ui.transform, 'height', obj, 'height');
    if (typeof obj.rotation === 'number') InspectorFields.addNumber(host, ui.transform, 'rotation', obj, 'rotation');
    if (typeof obj.zoom === 'number') InspectorFields.addNumber(host, ui.transform, 'zoom', obj, 'zoom');
  } else {
    // Support both (x,y,z,rotX,rotY,rotZ) and vector-style (position/rotation).
    // Some node types expose BOTH; avoid showing duplicates by preferring vectors.
    const hasPosVec = !!(obj.position && typeof obj.position.x === 'number' && typeof obj.position.y === 'number' && typeof obj.position.z === 'number');
    const hasRotVec = !!(obj.rotation && typeof obj.rotation.x === 'number' && typeof obj.rotation.y === 'number' && typeof obj.rotation.z === 'number');

    if (hasPosVec) {
      InspectorFields.addNumber(host, ui.transform, 'pos.x', obj.position, 'x');
      InspectorFields.addNumber(host, ui.transform, 'pos.y', obj.position, 'y');
      InspectorFields.addNumber(host, ui.transform, 'pos.z', obj.position, 'z');
    } else {
      if (typeof obj.x === 'number') InspectorFields.addNumber(host, ui.transform, 'x', obj, 'x');
      if (typeof obj.y === 'number') InspectorFields.addNumber(host, ui.transform, 'y', obj, 'y');
      if (typeof obj.z === 'number') InspectorFields.addNumber(host, ui.transform, 'z', obj, 'z');
    }

    if (hasRotVec) {
      InspectorFields.addNumber(host, ui.transform, 'rot.x', obj.rotation, 'x');
      InspectorFields.addNumber(host, ui.transform, 'rot.y', obj.rotation, 'y');
      InspectorFields.addNumber(host, ui.transform, 'rot.z', obj.rotation, 'z');
    } else {
      if (typeof obj.rotX === 'number') InspectorFields.addNumber(host, ui.transform, 'rotX', obj, 'rotX');
      if (typeof obj.rotY === 'number') InspectorFields.addNumber(host, ui.transform, 'rotY', obj, 'rotY');
      if (typeof obj.rotZ === 'number') InspectorFields.addNumber(host, ui.transform, 'rotZ', obj, 'rotZ');
    }

    if (obj.target && typeof obj.target.x === 'number') {
      InspectorFields.addNumber(host, ui.transform, 'target.x', obj.target, 'x');
      InspectorFields.addNumber(host, ui.transform, 'target.y', obj.target, 'y');
      InspectorFields.addNumber(host, ui.transform, 'target.z', obj.target, 'z');
    }
  }
}

/**
 * Lightweight refresh of the inspector UI without rebuilding its DOM.
 * This avoids focus/scroll flicker from the timer-based rebuild.
 *
 * @param {any} host
 * @param {InspectorUI} ui
 */
export function syncInspector(host, ui) {
  try {
    const matAsset = /** @type {any} */ (host?._inspectorMatAsset || null);
    const obj = host?.selected;

    if (ui.inspectorSubtitle) {
      if (matAsset && typeof matAsset === 'object' && typeof matAsset.pathRel === 'string' && matAsset.pathRel) {
        const pathRel = String(matAsset.pathRel || '');
        const base = (() => {
          const s = String(pathRel || '').replace(/\\/g, '/');
          const i = s.lastIndexOf('/');
          return i >= 0 ? s.slice(i + 1) : s;
        })();
        ui.inspectorSubtitle.textContent = base || 'Material';
      } else if (!obj) {
        ui.inspectorSubtitle.textContent = host?._projectMeta ? 'Project' : 'No selection';
      } else {
        const name = obj?.name ? String(obj.name) : (obj ? (obj.constructor?.name || '(object)') : 'No selection');
        ui.inspectorSubtitle.textContent = name;
      }
    }

    // Sync only simple bound fields; complex compound widgets are left alone.
    InspectorFields.syncBoundFields(ui.common);
    InspectorFields.syncBoundFields(ui.transform);

    // Keep filter applied while syncing.
    try {
      InspectorFields.applyInspectorFilter(ui.common, String(host?._inspectorFilter || ''));
      InspectorFields.applyInspectorFilter(ui.transform, String(host?._inspectorFilter || ''));
    } catch {}
  } catch {}
}
