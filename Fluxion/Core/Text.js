import Sprite from './Sprite.js';

export default class Text extends Sprite {
    constructor(renderer, text = "Text", x = 0, y = 0, fontSize = 16, fontFamily = "Inter", color = "white") {
        super(renderer, null, x, y, 1, 1, 0, 0, false);
        
        this.textContent = text; // Rename to avoid conflict if any
        this._fontSize = fontSize;
        this._fontFamily = fontFamily;
        this._textColor = color;
        this.padding = 5;
        this.pixelsPerUnit = 100; // Default PPU
        
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        
        this.updateTexture();
    }

    get text() { return this.textContent; }
    set text(value) {
        if (this.textContent !== value) {
            this.textContent = value;
            this.updateTexture();
        }
    }

    get fontSize() { return this._fontSize; }
    set fontSize(value) {
        if (this._fontSize !== value) {
            this._fontSize = value;
            this.updateTexture();
        }
    }

    // Note: Sprite already uses `color` as a numeric RGBA tint array.
    // For text fill color (CSS string), use `textColor`.
    get textColor() { return this._textColor; }
    set textColor(value) {
        if (this._textColor !== value) {
            this._textColor = value;
            this.updateTexture();
        }
    }

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

        // Update WebGL texture
        if (this.texture) {
            this.renderer.gl.deleteTexture(this.texture);
        }
        this.texture = this.renderer.createTexture(this.canvas);
        
        // Update world dimensions
        this.width = this.canvas.width / this.pixelsPerUnit;
        this.height = this.canvas.height / this.pixelsPerUnit;
    }
}
