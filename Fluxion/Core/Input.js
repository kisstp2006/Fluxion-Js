export default class Input {
    constructor() {
        this.keys = new Set();
        this.previousKeys = new Set();
        this.keyDownListeners = [];
        this.keyUpListeners = [];

        this.mouseButtons = new Set();
        this.previousMouseButtons = new Set();
        this.mousePosition = { x: 0, y: 0 };
        this.mouseDownListeners = [];
        this.mouseUpListeners = [];
        this.mouseMoveListeners = [];

        window.addEventListener('keydown', this.handleKeyDown.bind(this));
        window.addEventListener('keyup', this.handleKeyUp.bind(this));
        window.addEventListener('mousedown', this.handleMouseDown.bind(this));
        window.addEventListener('mouseup', this.handleMouseUp.bind(this));
        window.addEventListener('mousemove', this.handleMouseMove.bind(this));
    }

    getKey(key) {
        return this.keys.has(key);
    }

    getKeyDown(key) {
        return this.keys.has(key) && !this.previousKeys.has(key);
    }

    getKeyUp(key) {
        return !this.keys.has(key) && this.previousKeys.has(key);
    }

    onKeyDown(listener) {
        this.keyDownListeners.push(listener);
    }

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

    getMouseButton(buttonIndex) {
        return this.mouseButtons.has(buttonIndex);
    }

    getMouseButtonDown(buttonIndex) {
        return this.mouseButtons.has(buttonIndex) && !this.previousMouseButtons.has(buttonIndex);
    }

    getMouseButtonUp(buttonIndex) {
        return !this.mouseButtons.has(buttonIndex) && this.previousMouseButtons.has(buttonIndex);
    }

    getMousePosition() {
        return { ...this.mousePosition };
    }

    onMouseDown(listener) {
        this.mouseDownListeners.push(listener);
    }

    onMouseUp(listener) {
        this.mouseUpListeners.push(listener);
    }

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
        this.mousePosition = { x: e.clientX, y: e.clientY };
        this.mouseMoveListeners.forEach(listener => listener(this.mousePosition));
    }

    update() {
        this.previousKeys = new Set(this.keys);
        this.previousMouseButtons = new Set(this.mouseButtons);
    }

    clearListeners() {
        this.keyDownListeners.length = 0;
        this.keyUpListeners.length = 0;
        this.mouseDownListeners.length = 0;
        this.mouseUpListeners.length = 0;
        this.mouseMoveListeners.length = 0;
    }
}