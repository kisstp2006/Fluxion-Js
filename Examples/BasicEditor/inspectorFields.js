// @ts-check

/**
 * Field builder helpers extracted from `game.js`.
 * Shared by the Inspector panel and other editor UI.
 */

/**
 * Lightweight input binding so the inspector can refresh displayed values
 * without rebuilding the entire DOM.
 *
 * We intentionally keep this minimal: only simple 1:1 object-property fields.
 */

/**
 * @typedef {{
 *  obj: any,
 *  key: string,
 *  kind: 'text'|'number'|'checkbox'|'nullable-number',
 * }} BoundField
 */

/** @type {WeakMap<HTMLElement, BoundField>} */
const _boundFields = new WeakMap();

/** @type {WeakMap<object, number>} */
const _objectIds = new WeakMap();
let _nextObjectId = 1;

/** @param {object} o */
function _getObjectId(o) {
	let id = _objectIds.get(o);
	if (!id) {
		id = _nextObjectId++;
		_objectIds.set(o, id);
	}
	return id;
}

function _getUndo() {
	try {
		const u = /** @type {any} */ (window).__fluxionUndo;
		if (u && typeof u.push === 'function') return u;
	} catch {}
	return null;
}

/** @param {any} obj @param {string} key */
function _captureProp(obj, key) {
	const had = !!(obj && typeof obj === 'object' && Object.prototype.hasOwnProperty.call(obj, key));
	return { had, value: had ? obj[key] : undefined };
}

/** @param {any} obj @param {string} key @param {{had:boolean,value:any}} state */
function _restoreProp(obj, key, state) {
	if (!obj || typeof obj !== 'object') return;
	if (state.had) {
		obj[key] = state.value;
	} else {
		try {
			delete obj[key];
		} catch {
			obj[key] = undefined;
		}
	}
	// Some engine objects cache derived values.
	try {
		if ('_dirty' in obj) {
			// @ts-ignore
			obj._dirty = true;
		}
	} catch {}
}

/** @param {{had:boolean,value:any}} a @param {{had:boolean,value:any}} b */
function _propStateEqual(a, b) {
	if (!!a.had !== !!b.had) return false;
	if (!a.had && !b.had) return true;
	return Object.is(a.value, b.value);
}

/**
 * @param {any} obj
 * @param {string} key
 * @param {{had:boolean,value:any}} before
 * @param {{had:boolean,value:any}} after
 * @param {string} label
 */
function _pushUndoProp(obj, key, before, after, label) {
	const u = _getUndo();
	if (!u) return;
	if (!obj || typeof obj !== 'object') return;
	if (_propStateEqual(before, after)) return;

	const mergeKey = `prop:${_getObjectId(obj)}:${String(key)}`;
	u.push({
		label,
		mergeKey,
		undo: () => _restoreProp(obj, key, before),
		redo: () => _restoreProp(obj, key, after),
	});
}

/**
 * @param {any} obj
 * @param {string} keyA
 * @param {string} keyB
 * @param {{had:boolean,value:any}} beforeA
 * @param {{had:boolean,value:any}} afterA
 * @param {{had:boolean,value:any}} beforeB
 * @param {{had:boolean,value:any}} afterB
 * @param {string} label
 */
function _pushUndoPropPair(obj, keyA, keyB, beforeA, afterA, beforeB, afterB, label) {
	const u = _getUndo();
	if (!u) return;
	if (!obj || typeof obj !== 'object') return;
	const changed = !_propStateEqual(beforeA, afterA) || !_propStateEqual(beforeB, afterB);
	if (!changed) return;
	const mergeKey = `prop2:${_getObjectId(obj)}:${String(keyA)}:${String(keyB)}`;
	u.push({
		label,
		mergeKey,
		undo: () => {
			_restoreProp(obj, keyA, beforeA);
			_restoreProp(obj, keyB, beforeB);
		},
		redo: () => {
			_restoreProp(obj, keyA, afterA);
			_restoreProp(obj, keyB, afterB);
		},
	});
}

/**
 * @param {HTMLElement} el
 * @param {any} obj
 * @param {string} key
 * @param {BoundField['kind']} kind
 */
function _bindField(el, obj, key, kind) {
	try {
		if (!el || !obj || !key) return;
		_boundFields.set(el, { obj, key: String(key), kind });
	} catch {}
}

/**
 * Creates a simple stacked value container with an optional hint line.
 * @param {HTMLElement} control
 * @param {string=} hintText
 */
function _wrapWithHint(control, hintText = '') {
	const wrap = document.createElement('div');
	wrap.className = 'valueStack';
	wrap.appendChild(control);

	const hint = document.createElement('div');
	hint.className = 'fieldHint';
	hint.textContent = hintText;
	wrap.appendChild(hint);

	return { wrap, hint };
}

/** @param {HTMLInputElement} input @param {HTMLElement} hint @param {string} msg */
function _setInvalid(input, hint, msg) {
	input.classList.add('invalid');
	hint.textContent = msg;
	hint.classList.add('show');
}

/** @param {HTMLInputElement} input @param {HTMLElement} hint */
function _clearInvalid(input, hint) {
	input.classList.remove('invalid');
	hint.classList.remove('show');
}

/**
 * Refresh bound inputs under the provided root node.
 * Does nothing for focused inputs to avoid fighting the user.
 * @param {HTMLElement | null} root
 */
export function syncBoundFields(root) {
	if (!root) return;
	const active = (document.activeElement instanceof HTMLElement) ? document.activeElement : null;

	/** @type {HTMLElement[]} */
	const nodes = Array.from(root.querySelectorAll('input, select, textarea'));
	for (const el of nodes) {
		if (!(el instanceof HTMLElement)) continue;
		if (active && (el === active || el.contains(active))) continue;

		const b = _boundFields.get(el);
		if (!b) continue;
		const obj = b.obj;
		const key = b.key;
		try {
			if (!obj || !(key in obj)) continue;

			if (b.kind === 'checkbox') {
				const input = /** @type {HTMLInputElement} */ (/** @type {any} */ (el));
				const next = !!obj[key];
				if (input.checked !== next) input.checked = next;
				continue;
			}

			if (b.kind === 'text') {
				const input = /** @type {HTMLInputElement} */ (/** @type {any} */ (el));
				const next = String(obj[key] ?? '');
				if (input.value !== next) input.value = next;
				continue;
			}

			if (b.kind === 'number') {
				const input = /** @type {HTMLInputElement} */ (/** @type {any} */ (el));
				const cur = Number(obj[key]);
				const next = String(Number.isFinite(cur) ? cur : 0);
				if (input.value !== next) input.value = next;
				continue;
			}

			if (b.kind === 'nullable-number') {
				const input = /** @type {HTMLInputElement} */ (/** @type {any} */ (el));
				const v = obj[key];
				const next = (v === null || v === undefined || v === '') ? '' : String(Number(v));
				if (input.value !== next) input.value = next;
				continue;
			}
		} catch {}
	}
}

/**
 * Hides/shows inspector fields based on the provided query.
 * Matches against the visible label text.
 * @param {HTMLElement | null} root
 * @param {string} query
 */
export function applyInspectorFilter(root, query) {
	if (!root) return;
	const q = String(query || '').trim().toLowerCase();
	const fields = Array.from(root.querySelectorAll('.field')).filter((n) => n instanceof HTMLElement);
	const titles = Array.from(root.querySelectorAll('.sectionTitle.subSectionTitle')).filter((n) => n instanceof HTMLElement);

	if (!q) {
		for (const el of fields) /** @type {HTMLElement} */ (el).style.display = '';
		for (const el of titles) /** @type {HTMLElement} */ (el).style.display = '';
		return;
	}

	// First pass: show/hide fields.
	for (const el of fields) {
		const h = /** @type {HTMLElement} */ (el);
		const lab = h.querySelector('.label');
		const txt = String(lab ? lab.textContent : h.textContent).trim().toLowerCase();
		h.style.display = txt.includes(q) ? '' : 'none';
	}

	// Second pass: hide subsection titles that have no visible fields following them.
	for (const t of titles) {
		/** @type {HTMLElement|null} */
		let cur = /** @type {HTMLElement} */ (t);
		let hasVisible = false;
		for (let i = 0; i < 200; i++) {
			cur = /** @type {HTMLElement|null} */ (cur?.nextElementSibling || null);
			if (!cur) break;
			if (cur.classList && cur.classList.contains('sectionTitle')) break;
			if (cur.classList && cur.classList.contains('field')) {
				if (cur.style.display !== 'none') { hasVisible = true; break; }
			}
		}
		/** @type {HTMLElement} */ (t).style.display = hasVisible ? '' : 'none';
	}
}

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
	const box = document.createElement('div');
	box.className = 'readonlyBox';
	box.textContent = String(text);
	addField(container, label, box);
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
	_bindField(input, obj, key, 'checkbox');
	input.addEventListener('change', () => {
		const before = _captureProp(obj, key);
		obj[key] = !!input.checked;
		const after = _captureProp(obj, key);
		_pushUndoProp(obj, key, before, after, label);
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
	_bindField(input, obj, key, 'checkbox');
	input.addEventListener('change', () => {
		const before = _captureProp(obj, key);
		obj[key] = !!input.checked;
		try {
			onChanged();
		} catch {}
		const after = _captureProp(obj, key);
		_pushUndoProp(obj, key, before, after, label);
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
	_bindField(input, obj, key, 'number');
	const { wrap, hint } = _wrapWithHint(input);
	/** @type {{had:boolean,value:any}|null} */
	let editBefore = null;

	const apply = () => {
		const raw = String(input.value ?? '').trim();
		const v = Number(raw);
		if (!raw || !Number.isFinite(v)) {
			_setInvalid(input, hint, 'Enter a valid number.');
			return;
		}
		_clearInvalid(input, hint);
		if (!editBefore) editBefore = _captureProp(obj, key);
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
	input.addEventListener('change', () => {
		const raw = String(input.value ?? '').trim();
		const v = Number(raw);
		if (!raw || !Number.isFinite(v)) return;
		if (!editBefore) editBefore = _captureProp(obj, key);
		apply();
		const after = _captureProp(obj, key);
		_pushUndoProp(obj, key, editBefore, after, label);
		editBefore = null;
	});
	addField(container, label, wrap);
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
	_bindField(input, obj, key, 'number');
	const { wrap, hint } = _wrapWithHint(input);
	/** @type {{had:boolean,value:any}|null} */
	let editBefore = null;

	const apply = () => {
		const raw = String(input.value ?? '').trim();
		const v = Number(raw);
		if (!raw || !Number.isFinite(v)) {
			_setInvalid(input, hint, 'Enter a valid number.');
			return;
		}
		_clearInvalid(input, hint);
		if (!editBefore) editBefore = _captureProp(obj, key);
		obj[key] = v;
		try {
			onChanged();
		} catch {}
	};

	input.addEventListener('input', apply);
	input.addEventListener('change', () => {
		const raw = String(input.value ?? '').trim();
		const v = Number(raw);
		if (!raw || !Number.isFinite(v)) return;
		if (!editBefore) editBefore = _captureProp(obj, key);
		apply();
		const after = _captureProp(obj, key);
		_pushUndoProp(obj, key, editBefore, after, label);
		editBefore = null;
	});
	addField(container, label, wrap);
}

/**
 * Slider bound to a string property that stores a number (or an empty string for "unset").
 * Useful for XML stubs where numbers are authored as strings.
 * @param {HTMLElement | null} container
 * @param {string} label
 * @param {any} obj
 * @param {string} key
 * @param {() => void} onChanged
 * @param {{ step?: number, min?: number, max?: number, allowEmpty?: boolean }=} opts
 */
export function addSliderStringWith(container, label, obj, key, onChanged, opts = {}) {
	if (!obj) return;
	if (!(key in obj)) return;

	const min = Number.isFinite(Number(opts.min)) ? Number(opts.min) : 0;
	const max = Number.isFinite(Number(opts.max)) ? Number(opts.max) : 1;
	const step = Number.isFinite(Number(opts.step)) ? Number(opts.step) : 0.01;
	const allowEmpty = opts.allowEmpty !== false;

	/** @param {number} v */
	const clamp = (v) => Math.min(max, Math.max(min, v));
	const asNum = () => {
		const raw = String(obj[key] ?? '').trim();
		if (!raw) return null;
		const v = parseFloat(raw);
		return Number.isFinite(v) ? v : null;
	};

	const wrap = document.createElement('div');
	wrap.className = 'rangeRow';

	const range = document.createElement('input');
	range.type = 'range';
	range.min = String(min);
	range.max = String(max);
	range.step = String(step);

	const number = document.createElement('input');
	number.type = 'number';
	number.min = String(min);
	number.max = String(max);
	number.step = String(step);
	number.placeholder = allowEmpty ? '' : String(min);

	const clearBtn = document.createElement('button');
	clearBtn.type = 'button';
	clearBtn.className = 'btn btnSmall';
	clearBtn.textContent = 'Clear';

	const syncFromObj = () => {
		const v = asNum();
		if (v === null) {
			number.value = '';
			range.value = String(min);
			range.disabled = true;
			clearBtn.disabled = true;
			return;
		}
		const c = clamp(v);
		number.value = String(c);
		range.value = String(c);
		range.disabled = false;
		clearBtn.disabled = false;
	};

	const applyNumber = () => {
		const raw = String(number.value ?? '').trim();
		if (!raw) {
			if (!allowEmpty) return;
			obj[key] = '';
			syncFromObj();
			try { onChanged(); } catch {}
			return;
		}
		const v = parseFloat(raw);
		if (!Number.isFinite(v)) return;
		const c = clamp(v);
		obj[key] = String(c);
		syncFromObj();
		try { onChanged(); } catch {}
	};

	const applyRange = () => {
		const v = parseFloat(String(range.value ?? ''));
		if (!Number.isFinite(v)) return;
		const c = clamp(v);
		obj[key] = String(c);
		syncFromObj();
		try { onChanged(); } catch {}
	};

	clearBtn.addEventListener('click', () => {
		if (!allowEmpty) return;
		obj[key] = '';
		syncFromObj();
		try { onChanged(); } catch {}
	});

	range.addEventListener('input', applyRange);
	range.addEventListener('change', applyRange);
	number.addEventListener('input', applyNumber);
	number.addEventListener('change', applyNumber);

	syncFromObj();

	wrap.appendChild(range);
	wrap.appendChild(number);
	wrap.appendChild(clearBtn);
	addField(container, label, wrap);
}

/**
 * Dropdown/select input.
 * @param {HTMLElement | null} container
 * @param {string} label
 * @param {any} obj
 * @param {string} key
 * @param {Array<{ label: string, value: string }>} options
 * @param {() => void} onChanged
 */
export function addSelectWith(container, label, obj, key, options, onChanged) {
	if (!obj) return;
	if (!(key in obj)) return;

	const current = String(obj[key] ?? '');
	const hasCurrent = options.some((o) => String(o.value ?? '') === current);
	/** @type {Array<{ label: string, value: string }>} */
	const opts = hasCurrent || !current
		? options
		: [{ label: `Custom (${current})`, value: current }, ...options];

	const select = document.createElement('select');
	for (const opt of opts) {
		const o = document.createElement('option');
		o.value = String(opt.value ?? '');
		o.textContent = String(opt.label ?? opt.value ?? '');
		select.appendChild(o);
	}

	select.value = current;

	select.addEventListener('change', () => {
		obj[key] = String(select.value ?? '');
		try { onChanged(); } catch {}
	});

	addField(container, label, select);
}

/**
 * Auto-picks a field type based on the current value and (when helpful) the key name.
 * - boolean -> checkbox
 * - number -> number input
 * - string -> text input (or color picker, or a slider for known numeric material params)
 * @param {HTMLElement | null} container
 * @param {string} label
 * @param {any} obj
 * @param {string} key
 * @param {() => void} onChanged
 */
export function addAutoWith(container, label, obj, key, onChanged) {
	if (!obj) return;
	if (!(key in obj)) return;

	const v = obj[key];
	const k = String(key || '').toLowerCase();

	if (typeof v === 'boolean') {
		addToggleWith(container, label, obj, key, onChanged);
		return;
	}

	if (typeof v === 'number') {
		addNumberWith(container, label, obj, key, onChanged);
		return;
	}

	if (typeof v === 'string') {
		// Common enums.
		if (k === 'alphamode') {
			addSelectWith(container, label, obj, key, [
				{ label: '(default)', value: '' },
				{ label: 'OPAQUE', value: 'OPAQUE' },
				{ label: 'MASK', value: 'MASK' },
				{ label: 'BLEND', value: 'BLEND' },
			], onChanged);
			return;
		}

		// Color-ish string fields.
		if (k.includes('color')) {
			addCssColorWith(container, label, obj, key, onChanged);
			return;
		}

		// Known numeric material overrides are authored as strings in XML stubs.
		/** @type {Record<string, { min: number, max: number, step: number }>} */
		const materialNumeric = {
			metallicfactor: { min: 0, max: 1, step: 0.01 },
			roughnessfactor: { min: 0.04, max: 1, step: 0.01 },
			normalscale: { min: 0, max: 2, step: 0.01 },
			aostrength: { min: 0, max: 2, step: 0.01 },
			alphacutoff: { min: 0, max: 1, step: 0.01 },
		};

		if (k in materialNumeric) {
			const m = materialNumeric[k];
			addSliderStringWith(container, label, obj, key, onChanged, { min: m.min, max: m.max, step: m.step, allowEmpty: true });
			return;
		}

		addStringWith(container, label, obj, key, onChanged);
		return;
	}

	// Fallback
	addStringWith(container, label, obj, key, onChanged);
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
	_bindField(input, obj, key, 'text');
	/** @type {{had:boolean,value:any}|null} */
	let editBefore = null;
	const apply = () => {
		if (!editBefore) editBefore = _captureProp(obj, key);
		obj[key] = String(input.value ?? '');
	};
	input.addEventListener('input', apply);
	input.addEventListener('change', () => {
		apply();
		const after = _captureProp(obj, key);
		if (editBefore) _pushUndoProp(obj, key, editBefore, after, label);
		editBefore = null;
	});
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
	_bindField(input, obj, key, 'text');
	/** @type {{had:boolean,value:any}|null} */
	let editBefore = null;
	const apply = () => {
		if (!editBefore) editBefore = _captureProp(obj, key);
		obj[key] = String(input.value ?? '');
		try {
			onChanged();
		} catch {}
	};
	input.addEventListener('input', apply);
	input.addEventListener('change', () => {
		apply();
		const after = _captureProp(obj, key);
		if (editBefore) _pushUndoProp(obj, key, editBefore, after, label);
		editBefore = null;
	});
	addField(container, label, input);
}

/**
 * Like addStringWith but also supports dropping a file/path onto the input.
 * @param {HTMLElement | null} container
 * @param {string} label
 * @param {any} obj
 * @param {string} key
 * @param {() => void} onChanged
 * @param {{ acceptExtensions?: string[], importToWorkspaceUrl?: boolean, debounceMs?: number, onClick?: (ev: MouseEvent, input: HTMLInputElement) => void, onFocus?: (ev: FocusEvent, input: HTMLInputElement) => void }=} opts
 */
export function addStringWithDrop(container, label, obj, key, onChanged, opts = {}) {
	if (!obj) return;
	if (!(key in obj)) return;
	const input = document.createElement('input');
	input.type = 'text';
	input.value = String(obj[key] ?? '');
	const onClick = opts ? opts.onClick : null;
	if (typeof onClick === 'function') {
		input.addEventListener('click', (ev) => {
			try { onClick(/** @type {any} */ (ev), input); } catch {}
		});
	}
	const onFocus = opts ? opts.onFocus : null;
	if (typeof onFocus === 'function') {
		input.addEventListener('focus', (ev) => {
			try { onFocus(/** @type {any} */ (ev), input); } catch {}
		});
	}
	_bindField(input, obj, key, 'text');
	/** @type {{had:boolean,value:any}|null} */
	let editBefore = null;

	const debounceMs = Math.max(0, Number(opts.debounceMs || 0));
	/** @type {any} */
	let debounceTimer = null;
	/** @param {boolean} immediate */
	const runChanged = (immediate) => {
		if (!debounceMs || debounceMs <= 0) {
			try { onChanged(); } catch {}
			return;
		}
		if (immediate) {
			try { if (debounceTimer) clearTimeout(debounceTimer); } catch {}
			debounceTimer = null;
			try { onChanged(); } catch {}
			return;
		}
		try { if (debounceTimer) clearTimeout(debounceTimer); } catch {}
		debounceTimer = setTimeout(() => {
			debounceTimer = null;
			try { onChanged(); } catch {}
		}, debounceMs);
	};

	const accept = Array.isArray(opts.acceptExtensions)
		? opts.acceptExtensions.map((s) => String(s || '').toLowerCase()).filter(Boolean)
		: null;

	/** @param {string} v */
	const acceptValue = (v) => {
		if (!accept || accept.length === 0) return true;
		const s = String(v || '').toLowerCase();
		return accept.some((ext) => s.endsWith(ext));
	};

	/** @param {boolean} immediate */
	const apply = (immediate) => {
		if (!editBefore) editBefore = _captureProp(obj, key);
		obj[key] = String(input.value ?? '');
		runChanged(!!immediate);
	};

	input.addEventListener('input', () => apply(false));
	input.addEventListener('change', () => {
		apply(true);
		const after = _captureProp(obj, key);
		if (editBefore) _pushUndoProp(obj, key, editBefore, after, label);
		editBefore = null;
	});

	input.addEventListener('dragover', (e) => {
		// Allow drop.
		e.preventDefault();
		try {
			if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
		} catch {}
	});

	input.addEventListener('drop', (e) => {
		e.preventDefault();
		e.stopPropagation();
		const dt = e.dataTransfer;
		if (!dt) return;

		// If OS files are dropped, import them into the project via Electron IPC.
		// This enables: drag from Windows Explorer -> drop on inspector field.
		try {
			const electronAPI = /** @type {any} */ ((/** @type {any} */ (window)).electronAPI || null);
			const canImport = !!(electronAPI && typeof electronAPI.importExternalFiles === 'function');
			if (canImport && dt.files && dt.files.length > 0) {
				const paths = [];
				for (const f of Array.from(dt.files)) {
					// In Electron, File usually has .path.
					// @ts-ignore
					const p = String(f && (f.path || '') ? f.path : '').trim();
					if (p) paths.push(p);
				}
				if (paths.length > 0) {
					const destDir = String((/** @type {any} */ (window)).__fluxionAssetCwd || 'Model');
					Promise.resolve(electronAPI.importExternalFiles(paths, destDir))
						.then((res) => {
							if (!res || !res.ok) return;
							const imported = Array.isArray(res.imported) ? res.imported : [];
							const rel = String(imported[0]?.destRel || '').trim();
							if (!rel) return;
							if (!acceptValue(rel)) return;
							const next = opts.importToWorkspaceUrl ? `fluxion://workspace/${rel.replace(/^\/+/, '')}` : rel;
							input.value = next;
							apply(true);
							const after = _captureProp(obj, key);
							if (editBefore) _pushUndoProp(obj, key, editBefore, after, label);
							editBefore = null;
						})
						.catch(() => {});
					return;
				}
			}
		} catch {}

		// Prefer plain text payload from our asset browser.
		let text = '';
		try {
			text = String(dt.getData('text/plain') || '').trim();
		} catch {}
		if (!text) {
			try {
				text = String(dt.getData('text/uri-list') || '').trim();
			} catch {}
		}
		if (!text && dt.files && dt.files.length > 0) {
			// Best-effort: if an OS file is dropped, use its name.
			// (Project-relative wiring is handled by the asset browser drag payload.)
			try {
				text = String(dt.files[0]?.name || '').trim();
			} catch {}
		}

		if (!text) return;
		// Use the first line only.
		text = String(text.split(/\r?\n/)[0] || '').trim();
		if (!text) return;
		if (!acceptValue(text)) return;

		input.value = text;
		apply(true);
		const after = _captureProp(obj, key);
		if (editBefore) _pushUndoProp(obj, key, editBefore, after, label);
		editBefore = null;
	});

	// Optional asset picker button (shows project files matching acceptExtensions).
	const electronAPI = /** @type {any} */ ((/** @type {any} */ (window)).electronAPI || null);
	const canPick = !!(accept && accept.length > 0 && electronAPI && typeof electronAPI.listProjectDir === 'function');

	/** @param {string} rel */
	const toValue = (rel) => {
		const cleanRel = String(rel || '').replace(/^\/+/, '');
		if (!opts.importToWorkspaceUrl) return cleanRel;
		// Avoid double-prefix.
		if (cleanRel.startsWith('fluxion://')) return cleanRel;
		return `fluxion://workspace/${cleanRel}`;
	};

	/** @param {HTMLElement} anchor */
	const openPicker = (anchor) => {
		if (!canPick) return;
		// Reuse the existing menu styling (same as context menus).
		const menu = document.createElement('div');
		menu.className = 'menu contextMenu open';
		menu.setAttribute('role', 'menu');
		menu.style.display = 'block';
		menu.style.zIndex = '200';
		document.body.appendChild(menu);

		let closed = false;
		const close = () => {
			if (closed) return;
			closed = true;
			try { menu.remove(); } catch {}
			window.removeEventListener('blur', close);
			document.removeEventListener('mousedown', onDocMouseDown, true);
			document.removeEventListener('keydown', onKeyDown, true);
		};

		/** @param {MouseEvent} e */
		const onDocMouseDown = (e) => {
			const t = /** @type {HTMLElement|null} */ (e.target instanceof HTMLElement ? e.target : null);
			if (!t) return;
			if (t === menu || menu.contains(t)) return;
			close();
		};

		/** @param {KeyboardEvent} e */
		const onKeyDown = (e) => {
			if (e.key === 'Escape') close();
		};

		window.addEventListener('blur', close);
		document.addEventListener('mousedown', onDocMouseDown, true);
		document.addEventListener('keydown', onKeyDown, true);

		// Position near the anchor.
		try {
			const r = anchor.getBoundingClientRect();
			menu.style.left = `${Math.max(4, Math.floor(r.left))}px`;
			menu.style.top = `${Math.max(4, Math.floor(r.bottom + 6))}px`;
			requestAnimationFrame(() => {
				if (closed) return;
				const mr = menu.getBoundingClientRect();
				const maxX = Math.max(4, window.innerWidth - mr.width - 4);
				const maxY = Math.max(4, window.innerHeight - mr.height - 4);
				const nextX = Math.min(Math.max(4, Math.floor(r.left)), maxX);
				const nextY = Math.min(Math.max(4, Math.floor(r.bottom + 6)), maxY);
				menu.style.left = `${nextX}px`;
				menu.style.top = `${nextY}px`;
			});
		} catch {}

		/**
		 * @param {string} labelText
		 * @param {() => void} onClick
		 * @param {boolean=} enabled
		 */
		const addItem = (labelText, onClick, enabled = true) => {
			const btn = document.createElement('button');
			btn.type = 'button';
			btn.className = 'menuItem';
			btn.textContent = String(labelText);
			if (!enabled) {
				btn.disabled = true;
				btn.style.opacity = '0.6';
				btn.style.cursor = 'default';
			}
			btn.addEventListener('click', /** @param {MouseEvent} e */ (e) => {
				e.preventDefault();
				e.stopPropagation();
				if (!enabled) return;
				try { onClick(); } catch {}
			});
			menu.appendChild(btn);
		};

		addItem('Loading…', () => {}, false);

		/** @returns {Promise<string[]>} */
		const listMatchingFiles = async () => {
			// Prefer scanning typical asset folders first.
			const preferredRoots = ['Model', 'Texture', 'Textures', 'Images', 'Image', 'Audio', 'Sounds', 'Sound', 'Assets', 'Asset'];
			/** @type {string[]} */
			const roots = [];
			const ignore = new Set(['node_modules', '.git', '.vscode', 'Fluxion', 'Examples', 'Docs', '3rdParty', '_GeneratedTestGame']);

			// Keep only roots that exist.
			for (const d of preferredRoots) {
				try {
					const res = await electronAPI.listProjectDir(d);
					if (res && res.ok) roots.push(d);
				} catch {}
			}
			if (roots.length === 0) roots.push('.');

			/** @type {string[]} */
			const out = [];
			/** @type {string[]} */
			const stack = roots.map((r) => String(r));
			let dirOps = 0;
			const maxDirOps = 2500;
			const maxFiles = 2000;

			while (stack.length > 0) {
				const dir = String(stack.pop() || '');
				if (!dir && dir !== '.') continue;
				if (dirOps++ > maxDirOps) break;

				// Skip ignored folder names.
				const last = dir.split('/').pop() || dir.split('\\').pop() || dir;
				if (ignore.has(String(last))) continue;

				let res;
				try {
					res = await electronAPI.listProjectDir(dir === '.' ? '.' : dir);
				} catch {
					continue;
				}
				if (!res || !res.ok) continue;
				const entries = Array.isArray(res.entries) ? res.entries : [];
				for (const ent of entries) {
					if (!ent) continue;
					const p = String(ent.path || '').trim();
					if (!p) continue;
					if (ent.isDir) {
						stack.push(p);
						continue;
					}
					if (!acceptValue(p)) continue;
					out.push(p);
					if (out.length >= maxFiles) break;
				}
				if (out.length >= maxFiles) break;
			}

			out.sort((a, b) => a.localeCompare(b));
			return out;
		};

		Promise.resolve(listMatchingFiles())
			.then((files) => {
				if (closed) return;
				menu.innerHTML = '';
				if (!files || files.length === 0) {
					addItem('No matching files found', () => {}, false);
					return;
				}
				for (const rel of files) {
					addItem(rel, () => {
						input.value = toValue(rel);
						apply(true);
						close();
					});
				}
			})
			.catch(() => {
				if (closed) return;
				menu.innerHTML = '';
				addItem('Failed to list project files', () => {}, false);
			});
	};

	if (!canPick) {
		addField(container, label, input);
		return;
	}

	const pickBtn = document.createElement('button');
	pickBtn.type = 'button';
	pickBtn.className = 'btn';
	pickBtn.textContent = 'Pick';
	pickBtn.style.flex = '0 0 auto';
	pickBtn.classList.add('btnSmall');
	pickBtn.addEventListener('click', (e) => {
		e.preventDefault();
		e.stopPropagation();
		openPicker(pickBtn);
	});

	const row = document.createElement('div');
	row.className = 'rowTight rowCenter';
	row.appendChild(input);
	row.appendChild(pickBtn);
	addField(container, label, row);
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
	_bindField(input, obj, key, 'nullable-number');
	const { wrap, hint } = _wrapWithHint(input);
	/** @type {{had:boolean,value:any}|null} */
	let editBefore = null;

	const apply = () => {
		const raw = String(input.value ?? '').trim();
		if (!raw) {
			_clearInvalid(input, hint);
			if (!editBefore) editBefore = _captureProp(obj, key);
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
		if (!Number.isFinite(v)) {
			_setInvalid(input, hint, 'Enter a valid number, or clear it.');
			return;
		}
		_clearInvalid(input, hint);
		if (!editBefore) editBefore = _captureProp(obj, key);
		obj[key] = v;
	};

	input.addEventListener('input', apply);
	input.addEventListener('change', () => {
		apply();
		const after = _captureProp(obj, key);
		if (editBefore) _pushUndoProp(obj, key, editBefore, after, label);
		editBefore = null;
	});
	addField(container, label, wrap);
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
	wrap.className = 'vec3Row';
	/** @type {number[]|null} */
	let editBefore = null;

	/** @type {HTMLInputElement[]} */
	const inputs = [];

	/** @param {number} i */
	const make = (i) => {
		const input = document.createElement('input');
		input.type = 'number';
		input.step = '0.01';
		input.value = String(Number(arr[i]) || 0);
		input.classList.add('vec3Input');

		const apply = () => {
			const raw = String(input.value ?? '').trim();
			const v = Number(raw);
			if (!raw || !Number.isFinite(v)) {
				input.classList.add('invalid');
				return;
			}
			input.classList.remove('invalid');
			if (!editBefore) editBefore = [Number(arr[0]) || 0, Number(arr[1]) || 0, Number(arr[2]) || 0];
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
		input.addEventListener('change', () => {
			apply();
			if (!editBefore) return;
			const beforeCopy = [Number(editBefore[0]) || 0, Number(editBefore[1]) || 0, Number(editBefore[2]) || 0];
			const afterCopy = [Number(arr[0]) || 0, Number(arr[1]) || 0, Number(arr[2]) || 0];
			const same = Object.is(beforeCopy[0], afterCopy[0]) && Object.is(beforeCopy[1], afterCopy[1]) && Object.is(beforeCopy[2], afterCopy[2]);
			if (!same) {
				const u = _getUndo();
				if (u) {
					const mergeKey = `vec3:${_getObjectId(arr)}:${String(label)}`;
					u.push({
						label: String(label || 'Vector'),
						mergeKey,
						undo: () => { arr[0] = beforeCopy[0]; arr[1] = beforeCopy[1]; arr[2] = beforeCopy[2]; },
						redo: () => { arr[0] = afterCopy[0]; arr[1] = afterCopy[1]; arr[2] = afterCopy[2]; },
					});
				}
			}
			editBefore = null;
		});
		return input;
	};

	inputs.push(make(0), make(1), make(2));
	for (const input of inputs) wrap.appendChild(input);
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
	wrap.className = 'row rowCenter';

	const picker = document.createElement('input');
	picker.type = 'color';
	picker.className = 'colorPicker';

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
export function addCssColorWith(container, label, obj, key, onChanged, opts = {}) {
	if (!obj) return;
	if (!(key in obj)) return;

	const debounceMs = Math.max(0, Number((/** @type {any} */ (opts))?.debounceMs || 0));
	/** @type {any} */
	let debounceTimer = null;
	/** @param {boolean} immediate */
	const runChanged = (immediate) => {
		if (!debounceMs || debounceMs <= 0) {
			try { onChanged(); } catch {}
			return;
		}
		if (immediate) {
			try { if (debounceTimer) clearTimeout(debounceTimer); } catch {}
			debounceTimer = null;
			try { onChanged(); } catch {}
			return;
		}
		try { if (debounceTimer) clearTimeout(debounceTimer); } catch {}
		debounceTimer = setTimeout(() => {
			debounceTimer = null;
			try { onChanged(); } catch {}
		}, debounceMs);
	};

	const wrap = document.createElement('div');
	wrap.className = 'row rowCenter';

	const picker = document.createElement('input');
	picker.type = 'color';
	picker.className = 'colorPicker';

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
		runChanged(false);
	};

	picker.addEventListener('input', () => {
		const hex = String(picker.value || '').trim();
		if (hex) {
			text.value = hex;
			obj[key] = hex;
			runChanged(false);
		}
	});

	text.addEventListener('input', applyText);
	text.addEventListener('change', () => {
		obj[key] = String(text.value ?? '');
		syncPickerFromText();
		runChanged(true);
	});

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
	/** @type {{had:boolean,value:any}|null} */
	let beforeMain = null;
	/** @type {{had:boolean,value:any}|null} */
	let beforeBase = null;
	const baseKey = (key === 'x') ? 'baseX' : 'baseY';
	const apply = () => {
		const raw = String(input.value ?? '').trim();
		const v = Number(raw);
		if (!raw || !Number.isFinite(v)) return;
		if (!beforeMain) beforeMain = _captureProp(obj, key);
		if (!beforeBase) beforeBase = _captureProp(obj, baseKey);
		if (obj.followCamera) {
			if (key === 'x') obj.baseX = v;
			if (key === 'y') obj.baseY = v;
		}
		obj[key] = v;
	};
	input.addEventListener('input', apply);
	input.addEventListener('change', () => {
		apply();
		if (!beforeMain || !beforeBase) { beforeMain = null; beforeBase = null; return; }
		const afterMain = _captureProp(obj, key);
		const afterBase = _captureProp(obj, baseKey);
		_pushUndoPropPair(obj, key, baseKey, beforeMain, afterMain, beforeBase, afterBase, label);
		beforeMain = null;
		beforeBase = null;
	});
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
	/** @type {{had:boolean,value:any}|null} */
	let editBefore = null;
	const apply = () => {
		const raw = String(input.value ?? '').trim();
		const v = Number(raw);
		if (!raw || !Number.isFinite(v)) return;
		if (!editBefore) editBefore = _captureProp(obj, 'layer');
		obj.layer = v;
		// Scene caches sorted 2D objects; mark dirty so the new layer takes effect.
		if (host?.currentScene) {
			// @ts-ignore - internal optimization flag
			host.currentScene._objectsDirty = true;
		}
	};
	input.addEventListener('input', apply);
	input.addEventListener('change', () => {
		apply();
		if (!editBefore) return;
		const after = _captureProp(obj, 'layer');
		_pushUndoProp(obj, 'layer', editBefore, after, 'layer');
		editBefore = null;
	});
	addField(container, 'layer', input);
}

