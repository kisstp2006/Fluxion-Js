/**
 * Handles keyboard and mouse input.
 * Implements the Singleton pattern.
 */
export default class Input {
    static instance = null;

    /**
     * Creates an instance of Input.
     * If an instance already exists, returns that instance.
     */
    constructor() {
        if (Input.instance) {
            return Input.instance;
        }
        Input.instance = this;

        // Keys are stored as stable identifiers (derived from event.code) plus
        // legacy-friendly identifiers so existing games can keep using getKey('w').
        // We also track pressed physical keys by event.code to avoid "stuck" keys
        // when modifiers change event.key (e.g. Digit1 => '1' vs '!').
        this.keys = new Set();
        this.keyCodes = new Set();
        /** @type {Map<string, Set<string>>} */
        this._codeToKeys = new Map();
        this.previousKeys = new Set();
        this.keyDownListeners = [];
        this.keyUpListeners = [];

        this.mouseButtons = new Set();
        this.previousMouseButtons = new Set();
        this.mousePosition = { x: 0, y: 0 };
        this.mouseDelta = { x: 0, y: 0 };
        this._prevMousePosition = { x: 0, y: 0 };
        this.mouseDownListeners = [];
        this.mouseUpListeners = [];
        this.mouseMoveListeners = [];

        window.addEventListener('keydown', this.handleKeyDown.bind(this));
        window.addEventListener('keyup', this.handleKeyUp.bind(this));
        window.addEventListener('mousedown', this.handleMouseDown.bind(this));
        window.addEventListener('mouseup', this.handleMouseUp.bind(this));
        window.addEventListener('mousemove', this.handleMouseMove.bind(this));

        // When the tab/app loses focus, browsers may not deliver keyup/mouseup.
        // Clearing state prevents "stuck" keys/buttons.
        window.addEventListener('blur', () => this._resetAllInputState());
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) this._resetAllInputState();
        });
        document.addEventListener('pointerlockchange', () => {
            // Pointer lock transitions change how mouse delta is reported.
            // Don't clear pressed buttons here (it breaks RMB camera controls);
            // just clear per-frame motion.
            this.mouseDelta = { x: 0, y: 0 };
        });
    }

    /**
     * Convert a KeyboardEvent into a stable, game-friendly key id.
     * Prefer event.code since it is not affected by Shift/Alt/caps.
     * @param {KeyboardEvent} e
     * @returns {string}
     */
    _normalizeKey(e) {
        const code = String(e.code || '');
        if (code.startsWith('Key') && code.length === 4) {
            return code.slice(3).toLowerCase();
        }
        if (code.startsWith('Key') && code.length > 3) {
            // e.g. KeyA -> 'a'
            return code.slice(3).toLowerCase();
        }
        if (code.startsWith('Digit') && code.length > 5) {
            // Digit1 -> '1' (stable across !)
            return code.slice(5);
        }
        if (code === 'Space') return ' ';
        // Fallback to event.key (ArrowUp, Enter, etc.)
        return String(e.key || '');
    }

    /** @param {string} code @param {string[]} keys */
    _rememberCodeKeys(code, keys) {
        if (!code) return;
        let set = this._codeToKeys.get(code);
        if (!set) {
            set = new Set();
            this._codeToKeys.set(code, set);
        }
        for (const k of keys) {
            const s = String(k || '');
            if (s) set.add(s);
        }
    }

    _resetKeyboardState() {
        this.keys.clear();
        this.keyCodes.clear();
        this._codeToKeys.clear();
        this.previousKeys = new Set();
    }

    _resetMouseState() {
        this.mouseButtons.clear();
        this.previousMouseButtons = new Set();
        this.mouseDelta = { x: 0, y: 0 };
    }

    _resetAllInputState() {
        this._resetKeyboardState();
        this._resetMouseState();
    }

    /**
     * Checks if a key is currently held down.
     * @param {string} key - The key to check.
     * @returns {boolean} True if the key is held down, false otherwise.
     */
    getKey(key) {
        return this.keys.has(key);
    }

    /**
     * Checks if a key was pressed in the current frame.
     * @param {string} key - The key to check.
     * @returns {boolean} True if the key was pressed, false otherwise.
     */
    getKeyDown(key) {
        return this.keys.has(key) && !this.previousKeys.has(key);
    }

    /**
     * Checks if a key was released in the current frame.
     * @param {string} key - The key to check.
     * @returns {boolean} True if the key was released, false otherwise.
     */
    getKeyUp(key) {
        return !this.keys.has(key) && this.previousKeys.has(key);
    }

    /**
     * Adds a listener for key down events.
     * @param {Function} listener - The listener function.
     */
    onKeyDown(listener) {
        this.keyDownListeners.push(listener);
    }

    /**
     * Adds a listener for key up events.
     * @param {Function} listener - The listener function.
     */
    onKeyUp(listener) {
        this.keyUpListeners.push(listener);
    }

    handleKeyDown(e) {
        // Ignore auto-repeat for "pressed this frame" semantics.
        if (e && e.repeat) return;

        const code = String(e.code || '');
        const normalized = this._normalizeKey(e);
        const exact = String(e.key || '');

        if (code && this.keyCodes.has(code)) return;

        if (code) this.keyCodes.add(code);

        // Store multiple identifiers for backward compatibility.
        const keysToAdd = [];
        if (normalized) keysToAdd.push(normalized);
        if (exact && exact !== normalized) keysToAdd.push(exact);

        if (code) this._rememberCodeKeys(code, keysToAdd);

        let didAdd = false;
        for (const k of keysToAdd) {
            if (!this.keys.has(k)) {
                this.keys.add(k);
                didAdd = true;
            }
        }

        if (didAdd) {
            // Prefer normalized identifier for listeners.
            this.keyDownListeners.forEach(listener => listener(normalized || exact));
        }
    }

    handleKeyUp(e) {
        const code = String(e.code || '');
        const normalized = this._normalizeKey(e);
        const exact = String(e.key || '');

        if (code) this.keyCodes.delete(code);

        // Remove whatever we previously associated with this physical key.
        if (code && this._codeToKeys.has(code)) {
            const set = this._codeToKeys.get(code);
            if (set) {
                for (const k of set) this.keys.delete(k);
            }
            this._codeToKeys.delete(code);
        } else {
            // Best-effort fallback.
            if (normalized) this.keys.delete(normalized);
            if (exact) this.keys.delete(exact);
        }

        this.keyUpListeners.forEach(listener => listener(normalized || exact));
    }

    /**
     * Checks if a mouse button is currently held down.
     * @param {number} buttonIndex - The index of the mouse button (0: left, 1: middle, 2: right).
     * @returns {boolean} True if the button is held down, false otherwise.
     */
    getMouseButton(buttonIndex) {
        return this.mouseButtons.has(buttonIndex);
    }

    /**
     * Checks if a mouse button was pressed in the current frame.
     * @param {number} buttonIndex - The index of the mouse button.
     * @returns {boolean} True if the button was pressed, false otherwise.
     */
    getMouseButtonDown(buttonIndex) {
        return this.mouseButtons.has(buttonIndex) && !this.previousMouseButtons.has(buttonIndex);
    }

    /**
     * Checks if a mouse button was released in the current frame.
     * @param {number} buttonIndex - The index of the mouse button.
     * @returns {boolean} True if the button was released, false otherwise.
     */
    getMouseButtonUp(buttonIndex) {
        return !this.mouseButtons.has(buttonIndex) && this.previousMouseButtons.has(buttonIndex);
    }

    /**
     * Gets the current mouse position.
     * @returns {{x: number, y: number}} The mouse position.
     */
    getMousePosition() {
        return { ...this.mousePosition };
    }

    /**
     * Gets mouse movement delta for the current frame.
     * Under pointer lock, this uses movementX/movementY.
     * @returns {{x: number, y: number}}
     */
    getMouseDelta() {
        return { ...this.mouseDelta };
    }

    /**
     * Adds a listener for mouse down events.
     * @param {Function} listener - The listener function.
     */
    onMouseDown(listener) {
        this.mouseDownListeners.push(listener);
    }

    /**
     * Adds a listener for mouse up events.
     * @param {Function} listener - The listener function.
     */
    onMouseUp(listener) {
        this.mouseUpListeners.push(listener);
    }

    /**
     * Adds a listener for mouse move events.
     * @param {Function} listener - The listener function.
     */
    onMouseMove(listener) {
        this.mouseMoveListeners.push(listener);
    }

    handleMouseDown(e) {
        if (!this.mouseButtons.has(e.button)) {
            this.mouseButtons.add(e.button);
            this.mouseDownListeners.forEach(listener => listener(e.button, this.mousePosition));
        }
    }

    handleMouseUp(e) {
        if (this.mouseButtons.has(e.button)) {
            this.mouseButtons.delete(e.button);
            this.mouseUpListeners.forEach(listener => listener(e.button, this.mousePosition));
        }
    }

    handleMouseMove(e) {
        // When pointer lock is active, clientX/Y are not meaningful; use movementX/Y.
        const dx = (typeof e.movementX === 'number') ? e.movementX : (e.clientX - this._prevMousePosition.x);
        const dy = (typeof e.movementY === 'number') ? e.movementY : (e.clientY - this._prevMousePosition.y);
        this.mouseDelta = { x: dx || 0, y: dy || 0 };
        this.mousePosition = { x: e.clientX, y: e.clientY };
        this._prevMousePosition = { x: e.clientX, y: e.clientY };
        this.mouseMoveListeners.forEach(listener => listener(this.mousePosition));
    }

    update() {
        this.previousKeys = new Set(this.keys);
        this.previousMouseButtons = new Set(this.mouseButtons);
        // Reset per-frame mouse delta after consumers have had a chance to read it.
        this.mouseDelta = { x: 0, y: 0 };
    }

    clearListeners() {
        this.keyDownListeners.length = 0;
        this.keyUpListeners.length = 0;
        this.mouseDownListeners.length = 0;
        this.mouseUpListeners.length = 0;
        this.mouseMoveListeners.length = 0;
    }
}