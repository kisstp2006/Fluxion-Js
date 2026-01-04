// @ts-check

/**
 * Inspector panel wiring + rebuild logic extracted from `game.js`.
 */

import * as InspectorFields from "./inspectorFields.js";
import { SceneLoader, Skybox } from "../../Fluxion/index.js";

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
    InspectorFields.addString(ui.common, 'src', stub, 'src');
    return;
  }
  if (tag === 'Mesh') {
    InspectorFields.addStringWith(ui.common, 'name', stub, 'name', () => host.rebuildTree());
    InspectorFields.addString(ui.common, 'source', stub, 'source');
    InspectorFields.addString(ui.common, 'type', stub, 'type');
    InspectorFields.addCssColor(ui.common, 'color', stub, 'color');

    if (!stub.params || typeof stub.params !== 'object') stub.params = {};
    const p = stub.params;
    for (const k of ['width', 'height', 'depth', 'size', 'radius', 'subdivisions', 'radialSegments', 'heightSegments', 'capSegments']) {
      InspectorFields.addNullableNumber(ui.common, k, p, k);
    }
    return;
  }
  if (tag === 'Material') {
    InspectorFields.addStringWith(ui.common, 'name', stub, 'name', () => host.rebuildTree());
    InspectorFields.addString(ui.common, 'source', stub, 'source');
    InspectorFields.addCssColor(ui.common, 'baseColorFactor', stub, 'baseColorFactor');
    InspectorFields.addString(ui.common, 'metallicFactor', stub, 'metallicFactor');
    InspectorFields.addString(ui.common, 'roughnessFactor', stub, 'roughnessFactor');
    InspectorFields.addString(ui.common, 'normalScale', stub, 'normalScale');
    InspectorFields.addString(ui.common, 'aoStrength', stub, 'aoStrength');
    InspectorFields.addCssColor(ui.common, 'emissiveFactor', stub, 'emissiveFactor');
    InspectorFields.addString(ui.common, 'alphaMode', stub, 'alphaMode');
    InspectorFields.addString(ui.common, 'alphaCutoff', stub, 'alphaCutoff');
    InspectorFields.addString(ui.common, 'baseColorTexture', stub, 'baseColorTexture');
    InspectorFields.addString(ui.common, 'metallicTexture', stub, 'metallicTexture');
    InspectorFields.addString(ui.common, 'roughnessTexture', stub, 'roughnessTexture');
    InspectorFields.addString(ui.common, 'normalTexture', stub, 'normalTexture');
    InspectorFields.addString(ui.common, 'aoTexture', stub, 'aoTexture');
    InspectorFields.addString(ui.common, 'emissiveTexture', stub, 'emissiveTexture');
    InspectorFields.addString(ui.common, 'alphaTexture', stub, 'alphaTexture');
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
    });

    // PBR indirect ambient (u_ambientColor). Stored as a color string in XML.
    InspectorFields.addCssColorWith(ui.common, 'ambientColor', stub, 'ambientColor', () => {
      applyAmbientFromStub();
    });

    InspectorFields.addToggleWith(ui.common, 'equirectangular', stub, 'equirectangular', () => {
      applySkyboxFromStub();
      // Rebuild to show/hide the correct fields.
      try { host.rebuildInspector(); } catch {}
    });

    // Show only the relevant inputs.
    if (!!stub.equirectangular) {
      InspectorFields.addStringWith(ui.common, 'source', stub, 'source', () => {
        applySkyboxFromStub();
      });
    } else {
      InspectorFields.addStringWith(ui.common, 'right', stub, 'right', () => {
        applySkyboxFromStub();
      });
      InspectorFields.addStringWith(ui.common, 'left', stub, 'left', () => {
        applySkyboxFromStub();
      });
      InspectorFields.addStringWith(ui.common, 'top', stub, 'top', () => {
        applySkyboxFromStub();
      });
      InspectorFields.addStringWith(ui.common, 'bottom', stub, 'bottom', () => {
        applySkyboxFromStub();
      });
      InspectorFields.addStringWith(ui.common, 'front', stub, 'front', () => {
        applySkyboxFromStub();
      });
      InspectorFields.addStringWith(ui.common, 'back', stub, 'back', () => {
        applySkyboxFromStub();
      });
    }

    // Apply current values once so selecting the stub syncs renderer state.
    applyAmbientFromStub();
    applySkyboxFromStub();
    return;
  }
}

/** @param {any} host @param {InspectorUI} ui */
export function rebuildInspector(host, ui) {
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
  if (ui.common) {
    const title = document.createElement('div');
    title.className = 'sectionTitle';
    title.textContent = 'Selection';
    title.style.marginTop = '12px';
    ui.common.appendChild(title);
  }

  InspectorFields.addReadonly(ui.common, 'type', obj.constructor?.name || 'unknown');
  InspectorFields.addStringWith(ui.common, 'name', obj, 'name', () => host.rebuildTree());
  InspectorFields.addToggle(ui.common, 'active', obj, 'active');
  InspectorFields.addToggle(ui.common, 'visible', obj, 'visible');

  // followCamera + base offsets
  if (obj && typeof obj === 'object' && ('followCamera' in obj)) {
    InspectorFields.addToggle(ui.common, 'followCamera', obj, 'followCamera');
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
    InspectorFields.addStringWith(ui.common, 'imageSrc', obj, 'imageSrc', () => {
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
    });
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

  // Audio fields
  if (obj && obj.constructor?.name === 'Audio') {
    InspectorFields.addStringWith(ui.common, 'src', obj, 'src', () => {
      // Note: src is authoring-only here; live reload requires scene URL resolution.
    });
    InspectorFields.addToggle(ui.common, 'loop', obj, 'loop');
    InspectorFields.addToggle(ui.common, 'autoplay', obj, 'autoplay');
    InspectorFields.addToggle(ui.common, 'stopOnSceneChange', obj, 'stopOnSceneChange');
    InspectorFields.addNumber(host, ui.common, 'volume', obj, 'volume');
  }

  // MeshNode fields
  if (obj && obj.constructor?.name === 'MeshNode') {
    InspectorFields.addString(ui.common, 'source', obj, 'source');
    // Preserve authoring name even if material resolves to an instance.
    if (!('materialName' in obj) && typeof obj.material === 'string') {
      obj.materialName = obj.material;
    }
    InspectorFields.addStringWith(ui.common, 'material', obj, 'materialName', () => {
      try { obj.material = String(obj.materialName || ''); } catch {}
    });
    if (Array.isArray(obj.color) && obj.color.length >= 3) {
      InspectorFields.addColorVec3(ui.common, 'color', obj.color);
    }

    // Primitive params when meshDefinition is inline
    const p = obj?.meshDefinition?.params;
    if (p && typeof p === 'object') {
      for (const k of ['width', 'height', 'depth', 'size', 'radius', 'subdivisions', 'radialSegments', 'heightSegments', 'capSegments']) {
        if (!(k in p)) continue;
        InspectorFields.addNumber(host, ui.common, `param.${k}`, p, k);
      }
    }
  }

  // Lights
  if (obj && obj.isLight) {
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
    // Support both (x,y,z,rotX,rotY,rotZ) and (position Vector3).
    if (typeof obj.x === 'number') InspectorFields.addNumber(host, ui.transform, 'x', obj, 'x');
    if (typeof obj.y === 'number') InspectorFields.addNumber(host, ui.transform, 'y', obj, 'y');
    if (typeof obj.z === 'number') InspectorFields.addNumber(host, ui.transform, 'z', obj, 'z');

    if (typeof obj.rotX === 'number') InspectorFields.addNumber(host, ui.transform, 'rotX', obj, 'rotX');
    if (typeof obj.rotY === 'number') InspectorFields.addNumber(host, ui.transform, 'rotY', obj, 'rotY');
    if (typeof obj.rotZ === 'number') InspectorFields.addNumber(host, ui.transform, 'rotZ', obj, 'rotZ');

    if (obj.position && typeof obj.position.x === 'number') {
      InspectorFields.addNumber(host, ui.transform, 'pos.x', obj.position, 'x');
      InspectorFields.addNumber(host, ui.transform, 'pos.y', obj.position, 'y');
      InspectorFields.addNumber(host, ui.transform, 'pos.z', obj.position, 'z');
    }

    if (obj.target && typeof obj.target.x === 'number') {
      InspectorFields.addNumber(host, ui.transform, 'target.x', obj.target, 'x');
      InspectorFields.addNumber(host, ui.transform, 'target.y', obj.target, 'y');
      InspectorFields.addNumber(host, ui.transform, 'target.z', obj.target, 'z');
    }
  }
}
