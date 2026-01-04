// @ts-check

/**
 * Field builder helpers extracted from `game.js`.
 * Shared by the Inspector panel and other editor UI.
 */

/**
 * @param {HTMLElement | null} container
 * @param {string} labelText
 * @param {HTMLElement} node
 */
export function addField(container, labelText, node) {
	if (!container) return undefined;
	const field = document.createElement('div');
	field.className = 'field';

	const label = document.createElement('div');
	label.className = 'label';
	label.textContent = labelText;

	const value = document.createElement('div');
	value.className = 'value';

	field.appendChild(label);
	field.appendChild(value);
	container.appendChild(field);
	value.appendChild(node);

	return field;
}

/**
 * @param {HTMLElement | null} container
 * @param {string} label
 * @param {string | number} text
 */
export function addReadonly(container, label, text) {
	const span = document.createElement('div');
	span.textContent = String(text);
	span.style.padding = '8px 10px';
	span.style.border = '1px solid var(--border)';
	span.style.borderRadius = '6px';
	span.style.background = '#1a1a1a';
	addField(container, label, span);
}

/**
 * @param {HTMLElement | null} container
 * @param {string} label
 * @param {any} obj
 * @param {string} key
 */
export function addToggle(container, label, obj, key) {
	if (!obj || !(key in obj)) return;
	const input = document.createElement('input');
	input.type = 'checkbox';
	input.checked = !!obj[key];
	input.addEventListener('change', () => {
		obj[key] = !!input.checked;
	});

	const wrap = document.createElement('label');
	wrap.className = 'checkRow';
	wrap.style.margin = '0';
	wrap.appendChild(input);
	const t = document.createElement('span');
	t.textContent = '';
	wrap.appendChild(t);

	addField(container, label, wrap);
}

/**
 * Like addToggle but runs a callback after change.
 * @param {HTMLElement | null} container
 * @param {string} label
 * @param {any} obj
 * @param {string} key
 * @param {() => void} onChanged
 */
export function addToggleWith(container, label, obj, key, onChanged) {
	if (!obj || !(key in obj)) return;
	const input = document.createElement('input');
	input.type = 'checkbox';
	input.checked = !!obj[key];
	input.addEventListener('change', () => {
		obj[key] = !!input.checked;
		try {
			onChanged();
		} catch {}
	});

	const wrap = document.createElement('label');
	wrap.className = 'checkRow';
	wrap.style.margin = '0';
	wrap.appendChild(input);
	const t = document.createElement('span');
	t.textContent = '';
	wrap.appendChild(t);

	addField(container, label, wrap);
}

/**
 * @param {any} host
 * @param {HTMLElement | null} container
 * @param {string} label
 * @param {any} obj
 * @param {string} key
 */
export function addNumber(host, container, label, obj, key) {
	if (!obj) return;
	const input = document.createElement('input');
	input.type = 'number';
	input.step = '0.01';
	input.value = String(Number(obj[key]) || 0);

	const apply = () => {
		const v = Number(input.value);
		if (!Number.isFinite(v)) return;
		obj[key] = v;
		// Some engine objects cache matrices (e.g. Camera3D).
		if (obj && typeof obj === 'object' && ('_dirty' in obj)) {
			// @ts-ignore
			obj._dirty = true;
		}
		const sel = /** @type {any} */ (host?.selected);
		if (sel && sel !== obj && typeof sel === 'object' && ('_dirty' in sel)) {
			// @ts-ignore
			sel._dirty = true;
		}
	};

	input.addEventListener('input', apply);
	input.addEventListener('change', apply);
	addField(container, label, input);
}

/**
 * Like addNumber but runs a callback after change.
 * @param {HTMLElement | null} container
 * @param {string} label
 * @param {any} obj
 * @param {string} key
 * @param {() => void} onChanged
 * @param {{ step?: number, min?: number, max?: number }=} opts
 */
export function addNumberWith(container, label, obj, key, onChanged, opts = {}) {
	if (!obj) return;
	if (!(key in obj)) return;

	const input = document.createElement('input');
	input.type = 'number';
	input.step = String(Number.isFinite(Number(opts.step)) ? Number(opts.step) : 0.01);
	if (Number.isFinite(Number(opts.min))) input.min = String(Number(opts.min));
	if (Number.isFinite(Number(opts.max))) input.max = String(Number(opts.max));
	input.value = String(Number(obj[key]) || 0);

	const apply = () => {
		const v = Number(input.value);
		if (!Number.isFinite(v)) return;
		obj[key] = v;
		try {
			onChanged();
		} catch {}
	};

	input.addEventListener('input', apply);
	input.addEventListener('change', apply);
	addField(container, label, input);
}

/**
 * @param {HTMLElement | null} container
 * @param {string} label
 * @param {any} obj
 * @param {string} key
 */
export function addString(container, label, obj, key) {
	if (!obj) return;
	if (!(key in obj)) return;
	const input = document.createElement('input');
	input.type = 'text';
	input.value = String(obj[key] ?? '');
	const apply = () => {
		obj[key] = String(input.value ?? '');
	};
	input.addEventListener('input', apply);
	input.addEventListener('change', apply);
	addField(container, label, input);
}

/**
 * Like addString but also runs a callback after applying.
 * @param {HTMLElement | null} container
 * @param {string} label
 * @param {any} obj
 * @param {string} key
 * @param {() => void} onChanged
 */
export function addStringWith(container, label, obj, key, onChanged) {
	if (!obj) return;
	if (!(key in obj)) return;
	const input = document.createElement('input');
	input.type = 'text';
	input.value = String(obj[key] ?? '');
	const apply = () => {
		obj[key] = String(input.value ?? '');
		try {
			onChanged();
		} catch {}
	};
	input.addEventListener('input', apply);
	input.addEventListener('change', apply);
	addField(container, label, input);
}

/**
 * Nullable number input: allows clearing the field to represent "unset".
 * - For ClickableArea width/height, empty sets to null.
 * - For plain objects (e.g. mesh params), empty deletes the key.
 * @param {HTMLElement | null} container
 * @param {string} label
 * @param {any} obj
 * @param {string} key
 */
export function addNullableNumber(container, label, obj, key) {
	if (!obj) return;

	const isClickableArea = !!(obj?.constructor?.name === 'ClickableArea');
	const emptyMode = isClickableArea ? 'null' : 'delete';

	const input = document.createElement('input');
	input.type = 'number';
	input.step = '0.01';
	input.placeholder = emptyMode === 'null' ? '(inherit)' : '(unset)';

	const cur = obj[key];
	if (cur === null || cur === undefined || cur === '') input.value = '';
	else input.value = String(Number(cur));

	const apply = () => {
		const raw = String(input.value ?? '').trim();
		if (!raw) {
			if (emptyMode === 'null') {
				obj[key] = null;
			} else {
				try {
					delete obj[key];
				} catch {
					obj[key] = undefined;
				}
			}
			return;
		}
		const v = Number(raw);
		if (!Number.isFinite(v)) return;
		obj[key] = v;
	};

	input.addEventListener('input', apply);
	input.addEventListener('change', apply);
	addField(container, label, input);
}

/**
 * Edit a vec3 stored as an array [x,y,z].
 * @param {HTMLElement | null} container
 * @param {string} label
 * @param {number[]} arr
 * @param {{ normalize?: boolean }=} opts
 */
export function addVec3Array(container, label, arr, opts = {}) {
	if (!container || !Array.isArray(arr) || arr.length < 3) return;
	const normalize = !!opts.normalize;

	const wrap = document.createElement('div');
	wrap.style.display = 'flex';
	wrap.style.gap = '6px';

	/** @type {HTMLInputElement[]} */
	const inputs = [];

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
			if (normalize) {
				const x = Number(arr[0]) || 0;
				const y = Number(arr[1]) || 0;
				const z = Number(arr[2]) || 0;
				const len = Math.hypot(x, y, z) || 1;
				arr[0] = x / len;
				arr[1] = y / len;
				arr[2] = z / len;
				if (inputs.length >= 3) {
					inputs[0].value = String(arr[0]);
					inputs[1].value = String(arr[1]);
					inputs[2].value = String(arr[2]);
				}
			}
		};

		input.addEventListener('input', apply);
		input.addEventListener('change', apply);
		return input;
	};

	inputs.push(make(0), make(1), make(2));
	for (const i of inputs) wrap.appendChild(i);
	addField(container, label, wrap);
}

/** @param {number} r @param {number} g @param {number} b */
export function rgb01ToHex(r, g, b) {
	const R = Math.max(0, Math.min(255, Math.round((Number(r) || 0) * 255)));
	const G = Math.max(0, Math.min(255, Math.round((Number(g) || 0) * 255)));
	const B = Math.max(0, Math.min(255, Math.round((Number(b) || 0) * 255)));
	/** @param {number} n */
	const toHex2 = (n) => n.toString(16).padStart(2, '0');
	return `#${toHex2(R)}${toHex2(G)}${toHex2(B)}`;
}

/** @param {string} hex @returns {[number,number,number] | null} */
export function hexToRgb01(hex) {
	const s = String(hex || '').trim();
	const m6 = /^#([0-9a-fA-F]{6})$/.exec(s);
	if (!m6) return null;
	const h = m6[1];
	const r = parseInt(h.slice(0, 2), 16) / 255;
	const g = parseInt(h.slice(2, 4), 16) / 255;
	const b = parseInt(h.slice(4, 6), 16) / 255;
	return [r, g, b];
}

/**
 * Edit an RGB vec3 (0..1) stored as an array [r,g,b].
 * @param {HTMLElement | null} container
 * @param {string} label
 * @param {number[]} arr
 */
export function addColorVec3(container, label, arr) {
	if (!container || !Array.isArray(arr) || arr.length < 3) return;

	const wrap = document.createElement('div');
	wrap.style.display = 'flex';
	wrap.style.gap = '8px';
	wrap.style.alignItems = 'center';

	const picker = document.createElement('input');
	picker.type = 'color';
	picker.style.width = '44px';
	picker.style.height = '34px';
	picker.style.padding = '0';
	picker.style.border = '1px solid var(--border)';
	picker.style.borderRadius = '6px';
	picker.style.background = 'transparent';

	const r = Math.max(0, Math.min(1, Number(arr[0]) || 0));
	const g = Math.max(0, Math.min(1, Number(arr[1]) || 0));
	const b = Math.max(0, Math.min(1, Number(arr[2]) || 0));
	picker.value = rgb01ToHex(r, g, b);

	picker.addEventListener('input', () => {
		const rgb = hexToRgb01(String(picker.value || ''));
		if (!rgb) return;
		arr[0] = rgb[0];
		arr[1] = rgb[1];
		arr[2] = rgb[2];
	});

	wrap.appendChild(picker);
	addField(container, label, wrap);
}

/**
 * Text font family is stored as _fontFamily (no public setter).
 * @param {HTMLElement | null} container
 * @param {string} label
 * @param {any} textObj
 */
export function addTextFontFamily(container, label, textObj) {
	if (!textObj || typeof textObj !== 'object') return;
	if (!('_fontFamily' in textObj)) return;
	const input = document.createElement('input');
	input.type = 'text';
	// @ts-ignore
	input.value = String(textObj._fontFamily ?? '');
	const apply = () => {
		// @ts-ignore
		textObj._fontFamily = String(input.value ?? '');
		if (typeof textObj.updateTexture === 'function') {
			try {
				textObj.updateTexture();
			} catch {}
		}
	};
	input.addEventListener('input', apply);
	input.addEventListener('change', apply);
	addField(container, label, input);
}

/**
 * Convert a CSS color string to #RRGGBB if possible.
 * Returns null if the browser can't parse it.
 * @param {string} css
 * @returns {string|null}
 */
export function cssColorToHex(css) {
	const s = String(css || '').trim();
	if (!s) return null;

	// Fast path for #rgb/#rrggbb
	const m3 = /^#([0-9a-fA-F]{3})$/.exec(s);
	if (m3) {
		const r = m3[1][0];
		const g = m3[1][1];
		const b = m3[1][2];
		return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
	}
	const m6 = /^#([0-9a-fA-F]{6})$/.exec(s);
	if (m6) return `#${m6[1]}`.toLowerCase();
	// Ignore alpha in picker; keep RGB.
	const m8 = /^#([0-9a-fA-F]{8})$/.exec(s);
	if (m8) return `#${m8[1].slice(0, 6)}`.toLowerCase();

	// Use the browser parser for named colors / rgb() / hsl(), etc.
	try {
		const el = document.createElement('div');
		el.style.color = '';
		el.style.color = s;
		if (!el.style.color) return null;

		// Attach briefly to ensure computedStyle is available.
		el.style.display = 'none';
		if (document.body) document.body.appendChild(el);
		const computed = getComputedStyle(el).color || '';
		el.remove();

		const m = /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([0-9.]+))?\)$/.exec(computed.trim());
		if (!m) return null;
		const r = Math.max(0, Math.min(255, parseInt(m[1], 10) || 0));
		const g = Math.max(0, Math.min(255, parseInt(m[2], 10) || 0));
		const b = Math.max(0, Math.min(255, parseInt(m[3], 10) || 0));
		/** @param {number} n */
		const toHex2 = (n) => n.toString(16).padStart(2, '0');
		return `#${toHex2(r)}${toHex2(g)}${toHex2(b)}`;
	} catch {
		return null;
	}
}

/**
 * Better color input: color picker (when possible) + text field (always).
 * Stores the color as a CSS string (e.g. "#ff00aa", "white", "rgba(...)"),
 * which matches Text.textColor.
 * @param {HTMLElement | null} container
 * @param {string} label
 * @param {any} obj
 * @param {string} key
 */
export function addCssColor(container, label, obj, key) {
	if (!obj) return;
	if (!(key in obj)) return;

	const wrap = document.createElement('div');
	wrap.style.display = 'flex';
	wrap.style.gap = '8px';
	wrap.style.alignItems = 'center';

	const picker = document.createElement('input');
	picker.type = 'color';
	picker.style.width = '44px';
	picker.style.height = '34px';
	picker.style.padding = '0';
	picker.style.border = '1px solid var(--border)';
	picker.style.borderRadius = '6px';
	picker.style.background = 'transparent';

	const text = document.createElement('input');
	text.type = 'text';
	text.placeholder = 'e.g. #ff00aa, white, rgba(255,0,0,0.5)';
	text.value = String(obj[key] ?? '');

	const syncPickerFromText = () => {
		const v = String(text.value ?? '').trim();
		if (!v) {
			picker.disabled = false;
			picker.value = '#ffffff';
			return;
		}
		const hex = cssColorToHex(v);
		if (hex) {
			picker.disabled = false;
			picker.value = hex;
		} else {
			picker.disabled = true;
		}
	};

	const applyText = () => {
		obj[key] = String(text.value ?? '');
		syncPickerFromText();
	};

	picker.addEventListener('input', () => {
		const hex = String(picker.value || '').trim();
		if (hex) {
			text.value = hex;
			obj[key] = hex;
		}
	});

	text.addEventListener('input', applyText);
	text.addEventListener('change', applyText);

	syncPickerFromText();

	wrap.appendChild(picker);
	wrap.appendChild(text);
	addField(container, label, wrap);
}

/**
 * Like addCssColor but also runs a callback after applying.
 * @param {HTMLElement | null} container
 * @param {string} label
 * @param {any} obj
 * @param {string} key
 * @param {() => void} onChanged
 */
export function addCssColorWith(container, label, obj, key, onChanged) {
	if (!obj) return;
	if (!(key in obj)) return;

	const wrap = document.createElement('div');
	wrap.style.display = 'flex';
	wrap.style.gap = '8px';
	wrap.style.alignItems = 'center';

	const picker = document.createElement('input');
	picker.type = 'color';
	picker.style.width = '44px';
	picker.style.height = '34px';
	picker.style.padding = '0';
	picker.style.border = '1px solid var(--border)';
	picker.style.borderRadius = '6px';
	picker.style.background = 'transparent';

	const text = document.createElement('input');
	text.type = 'text';
	text.placeholder = 'e.g. #ff00aa, white, rgba(255,0,0,0.5)';
	text.value = String(obj[key] ?? '');

	const syncPickerFromText = () => {
		const v = String(text.value ?? '').trim();
		if (!v) {
			picker.disabled = false;
			picker.value = '#ffffff';
			return;
		}
		const hex = cssColorToHex(v);
		if (hex) {
			picker.disabled = false;
			picker.value = hex;
		} else {
			picker.disabled = true;
		}
	};

	const applyText = () => {
		obj[key] = String(text.value ?? '');
		syncPickerFromText();
		try {
			onChanged();
		} catch {}
	};

	picker.addEventListener('input', () => {
		const hex = String(picker.value || '').trim();
		if (hex) {
			text.value = hex;
			obj[key] = hex;
			try {
				onChanged();
			} catch {}
		}
	});

	text.addEventListener('input', applyText);
	text.addEventListener('change', applyText);

	syncPickerFromText();

	wrap.appendChild(picker);
	wrap.appendChild(text);
	addField(container, label, wrap);
}

/**
 * Opacity shown as 0..1 but stored as Sprite transparency 0..255.
 * Works for Sprite-derived nodes (including Text).
 * @param {HTMLElement | null} container
 * @param {string} label
 * @param {any} obj
 */
export function addOpacity01(container, label, obj) {
	if (!obj || typeof obj.setTransparency !== 'function') return;
	const t = Number(obj.transparency);
	const opacity = Number.isFinite(t) ? Math.max(0, Math.min(1, t / 255)) : 1;

	const input = document.createElement('input');
	input.type = 'number';
	input.step = '0.01';
	input.min = '0';
	input.max = '1';
	input.value = String(opacity);

	const apply = () => {
		const v = Number(input.value);
		if (!Number.isFinite(v)) return;
		const clamped = Math.max(0, Math.min(1, v));
		obj.setTransparency(clamped * 255);
	};

	input.addEventListener('input', apply);
	input.addEventListener('change', apply);
	addField(container, label, input);
}

/**
 * 2D position editing: if followCamera is enabled, write baseX/baseY instead of x/y
 * to avoid the engine overwriting the value next frame.
 * @param {HTMLElement | null} container
 * @param {string} label
 * @param {any} obj
 * @param {'x'|'y'} key
 */
export function addNumber2DPos(container, label, obj, key) {
	if (!obj) return;
	const input = document.createElement('input');
	input.type = 'number';
	input.step = '0.01';
	input.value = String(Number(obj[key]) || 0);
	const apply = () => {
		const v = Number(input.value);
		if (!Number.isFinite(v)) return;
		if (obj.followCamera) {
			if (key === 'x') obj.baseX = v;
			if (key === 'y') obj.baseY = v;
		}
		obj[key] = v;
	};
	input.addEventListener('input', apply);
	input.addEventListener('change', apply);
	addField(container, label, input);
}

/**
 * Layer support for 2D objects: allow editing even if the object didn't explicitly
 * define a numeric layer (engine treats missing as 0).
 * Also forces scene resorting so changes take effect immediately.
 * @param {any} host
 * @param {HTMLElement | null} container
 * @param {any} obj
 */
export function add2DLayerField(host, container, obj) {
	if (!container || !obj) return;

	// Only show for objects that look like 2D drawables.
	if (typeof host?._matchesMode === 'function' && !host._matchesMode(obj)) return;
	if (typeof obj.draw !== 'function') return;

	if (obj.layer === undefined || obj.layer === null || obj.layer === '') {
		obj.layer = 0;
	}
	if (!Number.isFinite(Number(obj.layer))) {
		obj.layer = 0;
	}

	const input = document.createElement('input');
	input.type = 'number';
	input.step = '1';
	input.value = String(Number(obj.layer) || 0);
	const apply = () => {
		const v = Number(input.value);
		if (!Number.isFinite(v)) return;
		obj.layer = v;
		// Scene caches sorted 2D objects; mark dirty so the new layer takes effect.
		if (host?.currentScene) {
			// @ts-ignore - internal optimization flag
			host.currentScene._objectsDirty = true;
		}
	};
	input.addEventListener('input', apply);
	input.addEventListener('change', apply);
	addField(container, 'layer', input);
}

