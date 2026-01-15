// @ts-check

/**
 * Reusable inspector UI widget builders.
 * Extracted from duplicated patterns in inspectorPanel.js and inspectorFields.js
 */

import * as InspectorFields from "./inspectorFields.js";

/**
 * Create a collapsible group/section for inspector fields.
 * @param {HTMLElement | null} container
 * @param {string} title
 * @param {boolean=} open
 * @returns {HTMLDivElement|null}
 */
export function createGroup(container, title, open = true) {
	if (!container) return null;
	const details = document.createElement('details');
	details.open = !!open;
	const summary = document.createElement('summary');
	summary.className = 'sectionTitle subSectionTitle';
	summary.textContent = title;
	details.appendChild(summary);
	const inner = document.createElement('div');
	inner.className = 'form';
	details.appendChild(inner);
	container.appendChild(details);
	return inner;
}

/**
 * Get the last `.field` element in a container.
 * Useful for hiding/showing fields based on texture presence.
 * @param {HTMLElement|null} container
 * @returns {HTMLDivElement|null}
 */
export function getLastField(container) {
	if (!container) return null;
	const fields = container.querySelectorAll('.field');
	return fields.length > 0 ? /** @type {HTMLDivElement} */ (fields[fields.length - 1]) : null;
}

/**
 * Create a single vector component input for use in vec2/vec3/vec4 builders.
 * @param {number[]} arr
 * @param {number} index
 * @param {string} step
 * @param {string} width
 * @param {() => void} onApply
 * @returns {HTMLInputElement}
 */
export function createVectorInput(arr, index, step = '0.01', width = '80px', onApply = () => {}) {
	const input = document.createElement('input');
	input.type = 'number';
	input.step = step;
	input.value = String(Number(arr[index]) || 0);
	input.style.width = width;
	const apply = () => {
		const v = Number(input.value);
		if (!Number.isFinite(v)) return;
		arr[index] = v;
		onApply();
	};
	input.addEventListener('input', apply);
	input.addEventListener('change', apply);
	return input;
}

/**
 * Create a vec2 input group (X, Y components).
 * Commonly used for UV scale, offset, etc.
 * @param {HTMLElement | null} container
 * @param {string} label
 * @param {number[]} arr
 * @param {() => void} onApply
 */
export function addVec2ArrayWith(container, label, arr, onApply = () => {}) {
	if (!container || !Array.isArray(arr) || arr.length < 2) return;

	const wrap = document.createElement('div');
	wrap.style.display = 'flex';
	wrap.style.gap = '6px';

	wrap.appendChild(createVectorInput(arr, 0, '0.01', '80px', onApply));
	wrap.appendChild(createVectorInput(arr, 1, '0.01', '80px', onApply));

	InspectorFields.addField(container, label, wrap);
}

/**
 * Create a vec3 input group (X, Y, Z components).
 * @param {HTMLElement | null} container
 * @param {string} label
 * @param {number[]} arr
 * @param {() => void} onApply
 */
export function addVec3ArrayWith(container, label, arr, onApply = () => {}) {
	if (!container || !Array.isArray(arr) || arr.length < 3) return;

	const wrap = document.createElement('div');
	wrap.style.display = 'flex';
	wrap.style.gap = '6px';

	wrap.appendChild(createVectorInput(arr, 0, '0.01', '80px', onApply));
	wrap.appendChild(createVectorInput(arr, 1, '0.01', '80px', onApply));
	wrap.appendChild(createVectorInput(arr, 2, '0.01', '80px', onApply));

	InspectorFields.addField(container, label, wrap);
}

/**
 * Hide/show scalar factor fields based on whether corresponding texture is present.
 * Common pattern: if a texture is set, hide the scalar multiplier field.
 * @param {HTMLDivElement|null} factorField
 * @param {any} obj
 * @param {string} textureKey
 */
export function updateFieldVisibility(factorField, obj, textureKey) {
	if (!factorField || !obj) return;
	const hasTexture = !!String(obj[textureKey] || '').trim();
	factorField.style.display = hasTexture ? 'none' : '';
}

/**
 * Create a reusable texture + factor field pair with automatic visibility management.
 * Example: "Metallic Texture" + "Metallic Factor" where factor is hidden when texture is present.
 * @param {HTMLElement | null} container
 * @param {string} textureName
 * @param {string} textureLabel
 * @param {string} factorName
 * @param {string} factorLabel
 * @param {any} obj
 * @param {() => void} onTextureChange
 * @param {() => void} onVisibilityChange
 * @param {{ acceptExtensions?: string[], importToWorkspaceUrl?: boolean }=} texOpts
 */
export function addTextureWithFactorPair(
	container,
	textureName,
	textureLabel,
	factorName,
	factorLabel,
	obj,
	onTextureChange = () => {},
	onVisibilityChange = () => {},
	texOpts = {}
) {
	if (!container || !obj) return;

	// Add the factor field first so we can reference it
	InspectorFields.addAutoWith(container, factorLabel, obj, factorName, () => {});
	const factorField = getLastField(container);

	// Add the texture field
	InspectorFields.addStringWithDrop(container, textureLabel, obj, textureName, () => {
		onTextureChange();
		updateFieldVisibility(factorField, obj, textureName);
		onVisibilityChange();
	}, texOpts);

	// Initial visibility
	updateFieldVisibility(factorField, obj, textureName);
}

/**
 * Build a material group with standard texture + factor pairs.
 * Reduces boilerplate for adding color/metallic/roughness/etc sections.
 * @param {HTMLElement | null} container
 * @param {string} groupTitle
 * @param {Array<{ textureName: string, textureLabel: string, factorName?: string, factorLabel?: string }>} textureFields
 * @param {any} obj
 * @param {() => void} onTextureChange
 * @param {() => void} onVisibilityChange
 * @param {boolean=} open
 * @returns {{ group: HTMLDivElement|null, factorFields: Map<string, HTMLDivElement|null> }}
 */
export function addMaterialGroup(
	container,
	groupTitle,
	textureFields,
	obj,
	onTextureChange = () => {},
	onVisibilityChange = () => {},
	open = true
) {
	const group = createGroup(container, groupTitle, open);
	/** @type {Map<string, HTMLDivElement|null>} */
	const factorFields = new Map();

	const texOpts = { acceptExtensions: ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.tga'], importToWorkspaceUrl: true };

	for (const field of textureFields) {
		const { textureName, textureLabel, factorName, factorLabel } = field;

		if (factorName && factorLabel) {
			// Add factor field
			InspectorFields.addAutoWith(group, factorLabel, obj, factorName, () => {});
			factorFields.set(factorName, getLastField(group));
		}

		// Add texture field
		InspectorFields.addStringWithDrop(group, textureLabel, obj, textureName, () => {
			onTextureChange();
			// Update visibility for this specific factor field
			const ff = factorFields.get(factorName || '');
			updateFieldVisibility(ff || null, obj, textureName);
			onVisibilityChange();
		}, texOpts);
	}

	// Initial visibility for all factor fields
	for (const [factorName, factorField] of factorFields) {
		// Find the corresponding texture name by searching textureFields
		const texField = textureFields.find(f => f.factorName === factorName);
		if (texField) {
			updateFieldVisibility(factorField, obj, texField.textureName);
		}
	}

	return { group, factorFields };
}

/**
 * Create a subsection title (non-collapsible, lightweight divider).
 * @param {HTMLElement | null} container
 * @param {string} title
 */
export function addSubSection(container, title) {
	if (!container) return;
	const el = document.createElement('div');
	el.className = 'sectionTitle subSectionTitle';
	el.textContent = title;
	container.appendChild(el);
}

/**
 * Common pattern: build visibility toggling logic for texture-factor pairs.
 * Returns a function that can be called when textures change.
 * @param {Map<string, HTMLDivElement|null>} factorFieldMap - Map of factorName -> field element
 * @param {Array<{ textureName: string, factorName: string }>} mappings - Which texture hides which factor
 * @param {any} obj - Object containing the data
 * @returns {() => void}
 */
export function createVisibilityUpdater(factorFieldMap, mappings, obj) {
	return () => {
		for (const { textureName, factorName } of mappings) {
			const field = factorFieldMap.get(factorName) || null;
			updateFieldVisibility(field, obj, textureName);
		}
	};
}

/**
 * Extract common defaults for texture picker options.
 * Avoids repeating acceptExtensions and importToWorkspaceUrl.
 * @param {string} fileType - 'image', 'model', 'audio', 'font', or custom extensions string
 * @returns {{ acceptExtensions: string[], importToWorkspaceUrl: boolean }}
 */
export function getTexturePickerOpts(fileType = 'image') {
	const opts = {
		importToWorkspaceUrl: true,
		acceptExtensions: ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp'],
	};

	switch (String(fileType).toLowerCase()) {
		case 'model':
		case 'mesh':
			opts.acceptExtensions = ['.gltf', '.glb'];
			break;
		case 'audio':
		case 'sound':
			opts.acceptExtensions = ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac'];
			break;
		case 'font':
			opts.acceptExtensions = ['.ttf', '.otf', '.woff', '.woff2'];
			break;
		case 'image':
		default:
			// Already set above
			break;
	}

	return opts;
}
