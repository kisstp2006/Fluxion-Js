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

        this.keys = new Set();
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
        const key = e.key; // Store the exact key string
        if (!this.keys.has(key)) {
            this.keys.add(key);
            this.keyDownListeners.forEach(listener => listener(key));
        }
    }

    handleKeyUp(e) {
        const key = e.key; // Store the exact key string
        if (this.keys.has(key)) {
            this.keys.delete(key);
            this.keyUpListeners.forEach(listener => listener(key));
        }
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