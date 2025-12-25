import Sprite from './Sprite.js';

/**
 * Represents a text object that can be rendered on the screen.
 * Extends the Sprite class and uses an internal canvas to render text to a texture.
 */
export default class Text extends Sprite {
    /**
     * Creates an instance of Text.
     * @param {Object} renderer - The renderer instance.
     * @param {string} [text="Text"] - The initial text content.
     * @param {number} [x=0] - The x-coordinate.
     * @param {number} [y=0] - The y-coordinate.
     * @param {number} [fontSize=16] - The font size in pixels.
     * @param {string} [fontFamily="Inter"] - The font family.
     * @param {string} [color="white"] - The text color (CSS string).
     */
    constructor(renderer, text = "Text", x = 0, y = 0, fontSize = 16, fontFamily = "Inter", color = "white") {
        super(renderer, null, x, y, 1, 1, 0, 0, false);
        
        this.textContent = text; // Rename to avoid conflict if any
        this._fontSize = fontSize;
        this._fontFamily = fontFamily;
        this._textColor = color;
        this.padding = 5;
        // In the engine's Godot-like coordinate system, 1 world unit = 1 pixel.
        this.pixelsPerUnit = 1;
        
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        
        this.updateTexture();
    }

    /**
     * Gets the text content.
     * @returns {string} The text content.
     */
    get text() { return this.textContent; }

    /**
     * Sets the text content and updates the texture.
     * @param {string} value - The new text content.
     */
    set text(value) {
        if (this.textContent !== value) {
            this.textContent = value;
            this.updateTexture();
        }
    }

    /**
     * Gets the font size.
     * @returns {number} The font size.
     */
    get fontSize() { return this._fontSize; }

    /**
     * Sets the font size and updates the texture.
     * @param {number} value - The new font size.
     */
    set fontSize(value) {
        if (this._fontSize !== value) {
            this._fontSize = value;
            this.updateTexture();
        }
    }

    // Note: Sprite already uses `color` as a numeric RGBA tint array.
    // For text fill color (CSS string), use `textColor`.
    /**
     * Gets the text color.
     * @returns {string} The text color.
     */
    get textColor() { return this._textColor; }

    /**
     * Sets the text color and updates the texture.
     * @param {string} value - The new text color.
     */
    set textColor(value) {
        if (this._textColor !== value) {
            this._textColor = value;
            this.updateTexture();
        }
    }

    /**
     * Updates the internal canvas and WebGL texture with the current text settings.
     */
    updateTexture() {
        // Measure text
        const fontStr = `${this._fontSize}px ${this._fontFamily}`;
        this.ctx.font = fontStr;
        const metrics = this.ctx.measureText(this.textContent);
        const textWidth = Math.ceil(metrics.width);
        const textHeight = Math.ceil(this._fontSize * 1.2); // Approximate height

        // Resize canvas
        // Note: Changing canvas dimensions clears it
        const newWidth = textWidth + this.padding * 2;
        const newHeight = textHeight + this.padding * 2;
        
        if (this.canvas.width !== newWidth || this.canvas.height !== newHeight) {
            this.canvas.width = newWidth;
            this.canvas.height = newHeight;
        } else {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
        
        // Draw
        this.ctx.font = fontStr;
        this.ctx.fillStyle = this._textColor;
        this.ctx.textBaseline = 'top';
        this.ctx.fillText(this.textContent, this.padding, this.padding);

        // Update WebGL texture - don't use cache for text (dynamic content)
        if (this.texture) {
            this.renderer.gl.deleteTexture(this.texture);
        }
        this.texture = this.renderer.createTexture(this.canvas);
        
        // Update world dimensions
        this.width = this.canvas.width / this.pixelsPerUnit;
        this.height = this.canvas.height / this.pixelsPerUnit;
    }
}
