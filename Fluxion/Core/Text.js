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

        // Metadata
        /** @type {'2D'|'3D'} */
        this.type = '2D';
        /** @type {string} */
        this.category = 'text';
        
        this.textContent = text; // Rename to avoid conflict if any
        this._fontSize = fontSize;
        this._fontFamily = fontFamily;
        this._textColor = color;
        this.padding = 5;
        // In the engine's Godot-like coordinate system, 1 world unit = 1 pixel.
        // This acts as a supersampling factor for the text texture.
        this._pixelsPerUnit = 1;
        
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        
        this.updateTexture();
    }

    /**
     * Pixels per world unit for the text texture.
     * Higher values render sharper text when the camera zooms in.
     */
    get pixelsPerUnit() { return this._pixelsPerUnit; }
    set pixelsPerUnit(v) {
        const n = Number(v);
        const next = Number.isFinite(n) ? Math.max(1, Math.min(8, n)) : 1;
        if (next !== this._pixelsPerUnit) {
            this._pixelsPerUnit = next;
            this.updateTexture();
        }
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
        const ppu = Number.isFinite(this._pixelsPerUnit) ? this._pixelsPerUnit : 1;
        const scaledFontSize = Math.max(1, Math.round((Number(this._fontSize) || 0) * ppu));
        const scaledPadding = Math.max(0, Math.round((Number(this.padding) || 0) * ppu));

        // Measure text
        const fontStr = `${scaledFontSize}px ${this._fontFamily}`;
        this.ctx.font = fontStr;
        const metrics = this.ctx.measureText(this.textContent);
        const textWidth = Math.ceil(metrics.width);
        const textHeight = Math.ceil(scaledFontSize * 1.2); // Approximate height

        // Resize canvas
        // Note: Changing canvas dimensions clears it
        const newWidth = textWidth + scaledPadding * 2;
        const newHeight = textHeight + scaledPadding * 2;
        
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
        this.ctx.fillText(this.textContent, scaledPadding, scaledPadding);

        // Update WebGL texture - don't use cache for text (dynamic content)
        // Ensure canvas has valid dimensions before creating texture
        if (this.canvas.width <= 0 || this.canvas.height <= 0) {
            // Canvas has no size, create a minimal texture
            this.canvas.width = 1;
            this.canvas.height = 1;
        }
        
        if (this.texture) {
            this.renderer.gl.deleteTexture(this.texture);
            // Clean up dimension entry (WeakMap will auto-cleanup, but explicit is better)
            if (this.renderer._textureDimensions) {
                // WeakMap doesn't have delete, but the texture is deleted so entry will be GC'd
            }
        }
        this.texture = this.renderer.createTexture(this.canvas);
        
        // Update world dimensions
        this.width = this.canvas.width / ppu;
        this.height = this.canvas.height / ppu;
    }

    /**
     * Releases the underlying GPU texture.
     */
    dispose() {
        if (this._disposed) return;
        this._disposed = true;

        // Dispose children if any.
        if (this.children && this.children.length > 0) {
            for (const child of this.children) {
                if (child && typeof child.dispose === 'function') child.dispose();
            }
        }

        if (this.texture && this.renderer?.gl) {
            this.renderer.gl.deleteTexture(this.texture);
        }
        this.texture = null;
    }
}
