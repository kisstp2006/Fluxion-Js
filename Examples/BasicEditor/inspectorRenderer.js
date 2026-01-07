// @ts-check

/**
 * Schema-driven inspector UI renderer.
 * Converts PropertySchema definitions into interactive inspector fields.
 * Replaces imperative field building with declarative reflection-based generation.
 */

import * as InspectorFields from "./inspectorFields.js";
import * as InspectorWidgets from "./inspectorWidgets.js";
import { SchemaRegistry } from "./inspectorSchema.js";

/**
 * Renders a complete inspector UI from a PropertySchema.
 * @param {any} host - Editor host with callbacks (rebuildInspector, rebuildTree, etc.)
 * @param {HTMLElement | null} container - Target container to render into
 * @param {any} obj - Object being inspected
 * @param {import('./inspectorSchema.js').PropertySchema[]} schema - Property schema
 * @param {{
 *   onChanged?: () => void,
 *   requestSave?: () => void,
 *   debounceMs?: number
 * }} opts
 */
export function renderSchemaUI(host, container, obj, schema, opts = {}) {
  if (!container) return;

  container.innerHTML = '';
  const { onChanged, requestSave, debounceMs = 200 } = opts;

  // Group properties by section/group
  const sections = new Map();
  const ungrouped = [];

  for (const prop of schema) {
    if (!shouldShowProperty(prop, obj)) continue;

    if (prop.type === 'group') {
      const groupKey = prop.section || prop.label || 'Unnamed';
      if (!sections.has(groupKey)) {
        sections.set(groupKey, []);
      }
      sections.get(groupKey).push(prop);
    } else {
      ungrouped.push(prop);
    }
  }

  // Render ungrouped properties first
  for (const prop of ungrouped) {
    renderProperty(host, container, obj, prop, opts);
  }

  // Render grouped properties
  for (const [groupKey, props] of sections) {
    const groupContainer = InspectorWidgets.createGroup(container, groupKey, false);
    for (const prop of props) {
      if (prop.type === 'group' && prop.properties) {
        for (const nestedProp of prop.properties) {
          renderProperty(host, groupContainer, obj, nestedProp, opts);
        }
      }
    }
  }
}

/**
 * Render a single property field based on its schema.
 * @param {any} host
 * @param {HTMLElement} container
 * @param {any} obj
 * @param {import('./inspectorSchema.js').PropertySchema} prop
 * @param {{
 *   onChanged?: () => void,
 *   requestSave?: () => void,
 *   debounceMs?: number
 * }} opts
 */
export function renderProperty(host, container, obj, prop, opts = {}) {
  if (!container || !obj) return;

  const {
    type = 'string',
    key,
    label = key,
    visible = true,
    enabled = true,
  } = prop;

  // Skip if not visible
  if (!shouldShowProperty(prop, obj)) return;

  // Skip if property doesn't exist on object
  if (key && !(key in obj)) {
    // For primitive params, might need to initialize
    if (!obj) return;
  }

  const { onChanged, requestSave } = opts;

  const handleChange = () => {
    onChanged?.();
    requestSave?.();
  };

  switch (type) {
    case 'string':
      if (key) {
        InspectorFields.addStringWith(container, label, obj, key, handleChange);
      }
      break;

    case 'number':
      if (key) {
        const opts = {};
        if (prop.min !== undefined) opts.min = prop.min;
        if (prop.max !== undefined) opts.max = prop.max;
        if (prop.step !== undefined) opts.step = prop.step;

        InspectorFields.addNumberWith(
          container,
          label,
          obj,
          key,
          handleChange,
          Object.keys(opts).length > 0 ? opts : undefined
        );
      }
      break;

    case 'boolean':
      if (key) {
        InspectorFields.addToggleWith(container, label, obj, key, handleChange);
      }
      break;

    case 'enum':
      if (key && prop.options) {
        InspectorFields.addSelectWith(container, label, obj, key, prop.options, handleChange);
      }
      break;

    case 'color':
      if (key) {
        if (Array.isArray(obj[key]) && obj[key].length === 3) {
          InspectorFields.addColorVec3With(container, label, obj, key, handleChange);
        } else if (typeof obj[key] === 'string') {
          InspectorFields.addCssColor(container, label, obj, key);
        }
      }
      break;

    case 'vec2':
      if (key && Array.isArray(obj[key]) && obj[key].length >= 2) {
        InspectorWidgets.addVec2ArrayWith(container, label, obj[key], handleChange);
      }
      break;

    case 'vec3':
      if (key && Array.isArray(obj[key]) && obj[key].length >= 3) {
        InspectorFields.addVec3Array(container, label, obj[key]);
      }
      break;

    case 'vec4':
      if (key && Array.isArray(obj[key]) && obj[key].length >= 4) {
        InspectorFields.addColorVec4With(container, label, obj, key, handleChange);
      }
      break;

    case 'texture':
      if (key) {
        const texOpts = {
          acceptExtensions: prop.textureExtensions || ['.png', '.jpg', '.jpeg'],
          importToWorkspaceUrl: true,
        };
        InspectorFields.addStringWithDrop(
          container,
          label,
          obj,
          key,
          handleChange,
          texOpts
        );
      }
      break;

    case 'group':
      if (prop.label && prop.properties) {
        const groupContainer = InspectorWidgets.createGroup(
          container,
          prop.label,
          prop.collapse !== false
        );
        for (const nestedProp of prop.properties) {
          renderProperty(host, groupContainer, obj, nestedProp, opts);
        }
      }
      break;

    case 'custom':
      // Custom properties can be rendered by caller
      break;
  }
}

/**
 * Check if a property should be displayed for an object.
 * @param {import('./inspectorSchema.js').PropertySchema} prop
 * @param {any} obj
 * @returns {boolean}
 */
export function shouldShowProperty(prop, obj) {
  if (prop.visible === false) return false;
  if (typeof prop.visible === 'function') {
    try {
      return prop.visible(obj);
    } catch {
      return true;
    }
  }
  return true;
}

/**
 * Check if a property should be editable for an object.
 * @param {import('./inspectorSchema.js').PropertySchema} prop
 * @param {any} obj
 * @returns {boolean}
 */
export function isPropertyEnabled(prop, obj) {
  if (prop.enabled === false) return false;
  if (typeof prop.enabled === 'function') {
    try {
      return prop.enabled(obj);
    } catch {
      return true;
    }
  }
  return true;
}

/**
 * Render inspector for an object using its registered schema.
 * Falls back to auto-detection if no schema is registered.
 * @param {any} host
 * @param {HTMLElement | null} commonContainer
 * @param {HTMLElement | null} transformContainer
 * @param {any} obj
 * @param {{
 *   onChanged?: () => void,
 *   requestSave?: () => void,
 *   autoDetectFallback?: boolean
 * }} opts
 * @returns {boolean} - true if schema was found and used
 */
export function renderBySchema(host, commonContainer, transformContainer, obj, opts = {}) {
  const schema = SchemaRegistry.getSchema(obj);

  if (!schema) {
    // No schema registered - return false to indicate fallback needed
    return false;
  }

  const { autoDetectFallback = true } = opts;

  // Render common properties
  renderSchemaUI(host, commonContainer, obj, schema, opts);

  return true;
}

/**
 * Create a transform section with position/rotation fields based on object structure.
 * @param {any} host
 * @param {HTMLElement | null} transformContainer
 * @param {any} obj
 * @param {string} mode - '2d' or '3d'
 */
export function renderTransformSection(host, transformContainer, obj, mode = '3d') {
  if (!transformContainer || !obj) return;

  transformContainer.innerHTML = '';

  if (mode === '2d') {
    render2DTransform(host, transformContainer, obj);
  } else {
    render3DTransform(host, transformContainer, obj);
  }
}

/**
 * @param {any} host
 * @param {HTMLElement} container
 * @param {any} obj
 */
function render2DTransform(host, container, obj) {
  if (typeof obj.x === 'number') {
    InspectorFields.addNumber2DPos(container, 'x', obj, 'x');
  }
  if (typeof obj.y === 'number') {
    InspectorFields.addNumber2DPos(container, 'y', obj, 'y');
  }
  if (typeof obj.width === 'number') {
    InspectorFields.addNumber(host, container, 'width', obj, 'width');
  }
  if (typeof obj.height === 'number') {
    InspectorFields.addNumber(host, container, 'height', obj, 'height');
  }
  if (typeof obj.rotation === 'number') {
    InspectorFields.addNumber(host, container, 'rotation', obj, 'rotation');
  }
  if (typeof obj.zoom === 'number') {
    InspectorFields.addNumber(host, container, 'zoom', obj, 'zoom');
  }
}

/**
 * @param {any} host
 * @param {HTMLElement} container
 * @param {any} obj
 */
function render3DTransform(host, container, obj) {
  const hasPosVec = !!(obj.position && typeof obj.position.x === 'number' && typeof obj.position.y === 'number' && typeof obj.position.z === 'number');
  const hasRotVec = !!(obj.rotation && typeof obj.rotation.x === 'number' && typeof obj.rotation.y === 'number' && typeof obj.rotation.z === 'number');

  if (hasPosVec) {
    InspectorFields.addNumber(host, container, 'pos.x', obj.position, 'x');
    InspectorFields.addNumber(host, container, 'pos.y', obj.position, 'y');
    InspectorFields.addNumber(host, container, 'pos.z', obj.position, 'z');
  } else {
    if (typeof obj.x === 'number') InspectorFields.addNumber(host, container, 'x', obj, 'x');
    if (typeof obj.y === 'number') InspectorFields.addNumber(host, container, 'y', obj, 'y');
    if (typeof obj.z === 'number') InspectorFields.addNumber(host, container, 'z', obj, 'z');
  }

  if (hasRotVec) {
    InspectorFields.addNumber(host, container, 'rot.x', obj.rotation, 'x');
    InspectorFields.addNumber(host, container, 'rot.y', obj.rotation, 'y');
    InspectorFields.addNumber(host, container, 'rot.z', obj.rotation, 'z');
  } else {
    if (typeof obj.rotX === 'number') InspectorFields.addNumber(host, container, 'rotX', obj, 'rotX');
    if (typeof obj.rotY === 'number') InspectorFields.addNumber(host, container, 'rotY', obj, 'rotY');
    if (typeof obj.rotZ === 'number') InspectorFields.addNumber(host, container, 'rotZ', obj, 'rotZ');
  }

  if (typeof obj.scaleX === 'number') InspectorFields.addNumber(host, container, 'scaleX', obj, 'scaleX');
  if (typeof obj.scaleY === 'number') InspectorFields.addNumber(host, container, 'scaleY', obj, 'scaleY');
  if (typeof obj.scaleZ === 'number') InspectorFields.addNumber(host, container, 'scaleZ', obj, 'scaleZ');
}
