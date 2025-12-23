/**
 * Represents a 2D sprite object that can be rendered on the screen.
 */
export default class Sprite {
    /**
     * Creates an instance of Sprite.
     * @param {Object} renderer - The renderer instance.
     * @param {string|string[]} imageSrc - The source URL of the image or an array of URLs for animation.
     * @param {number} [x=1] - The x-coordinate of the sprite.
     * @param {number} [y=1] - The y-coordinate of the sprite.
     * @param {number} [width=1] - The width of the sprite.
     * @param {number} [height=1] - The height of the sprite.
     * @param {number} [frameWidth=0] - The width of a single frame in a sprite sheet.
     * @param {number} [frameHeight=0] - The height of a single frame in a sprite sheet.
     * @param {boolean} [useSpriteSheet=true] - Whether to treat the image as a sprite sheet.
     */
    constructor(renderer, imageSrc, x=1, y=1, width=1, height=1, frameWidth = 0, frameHeight = 0, useSpriteSheet = true) {
        this.renderer = renderer;
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.frameWidth = frameWidth;
        this.frameHeight = frameHeight;
        this.useSpriteSheet = useSpriteSheet;
        this.texture = null;
        this.images = [];
        this.currentFrame = 0;
        this.isAnimating = false;
        this.animationSpeed = 100;
        this.lastFrameTime = 0;
        this.animation = null;
 
        // Color properties
        this.transparency = 255;
        this.red = 255;
        this.green = 255;
        this.blue = 255;
        this.color = [this.red, this.green, this.blue, this.transparency];
        this.visible = true;
        this.active = true;
        this.layer = 0;
        this.children = [];
        
        this.loadTexture(imageSrc);
    }

    /**
     * Sets the rendering layer of the sprite.
     * @param {number} layer - The layer index.
     */
    setLayer(layer) {
        this.layer = layer;
    }

    /**
     * Adds a child object to this sprite.
     * @param {Object} child - The child object to add.
     */
    addChild(child) {
        child.parent = this;
        this.children.push(child);
    }

    /**
     * Removes a child object from this sprite.
     * @param {Object} child - The child object to remove.
     */
    removeChild(child) {
        const index = this.children.indexOf(child);
        if (index > -1) {
            this.children.splice(index, 1);
            child.parent = null;
        }
    }

    /**
     * Updates the sprite and its children.
     * @param {number} dt - The delta time since the last frame.
     * @param {Object} camera - The camera object.
     */
    update(dt, camera) {
        if (!this.active) return;

        for (const child of this.children) {
            if (child.update) {
                child.update(dt, camera);
            }
        }
    }

    /**
     * Sets the color tint of the sprite.
     * @param {number} red - The red component (0-255).
     * @param {number} green - The green component (0-255).
     * @param {number} blue - The blue component (0-255).
     */
    setColor(red, green, blue) {
        this.red = Math.max(0, Math.min(255, red));
        this.green = Math.max(0, Math.min(255, green));
        this.blue = Math.max(0, Math.min(255, blue));
        this.color = [this.red, this.green, this.blue, this.transparency];
    }

    /**
     * Gets the current color tint of the sprite.
     * @returns {{red: number, green: number, blue: number, transparency: number}} The color components.
     */
    getColor() {
        return { red: this.red, green: this.green, blue: this.blue, transparency: this.transparency };
    }

    /**
     * Sets the transparency (alpha) of the sprite.
     * @param {number} alpha - The alpha value (0-255).
     */
    setTransparency(alpha) {
        this.transparency = Math.max(0, Math.min(255, alpha));
        this.color[3] = this.transparency;
    }

    /**
     * Gets the current transparency of the sprite.
     * @returns {number} The alpha value (0-255).
     */
    getTransparency() {
        return this.transparency;
    }

    /**
     * Loads the texture(s) for the sprite.
     * @param {string|string[]} imageSrc - The source URL(s) of the image(s).
     */
    loadTexture(imageSrc) {
        // Allow invisible/logic-only sprites by omitting imageSrc.
        // Also avoids accidental fetches of the current page when img.src is "".
        if (imageSrc === null || imageSrc === undefined) return;
        if (typeof imageSrc === 'string' && imageSrc.trim() === '') return;

        if (this.useSpriteSheet) {
            const img = new Image();
            img.src = imageSrc;
            img.onload = () => {
                this.texture = this.renderer.createTexture(img);
            };
        } else if (Array.isArray(imageSrc)) {
            imageSrc.forEach((src) => {
                const img = new Image();
                img.src = src;
                img.onload = () => this.images.push(img);
            });
        }
    }

    draw() {
        if (!this.active) return;
        if (!this.visible || !this.texture) return;

        const currentTime = Date.now();
        
        if (this.useSpriteSheet && this.texture) {
            if (this.animation && this.isAnimating) {
                if (currentTime - this.lastFrameTime > this.animationSpeed) {
                    this.lastFrameTime = currentTime;
                    this.currentFrame = (this.currentFrame + 1) % this.animation.frames.length;
                }
                const frame = this.animation.frames[this.currentFrame];
                this.renderer.drawQuad(this.texture, this.x, this.y, this.width, this.height, frame.x, frame.y, frame.width, frame.height, this.color);
            } else {
                this.renderer.drawQuad(this.texture, this.x, this.y, this.width, this.height, 0, 0, this.frameWidth, this.frameHeight, this.color);
            }
        } else if (!this.useSpriteSheet) {
            if (this.images.length > 0 && this.isAnimating && currentTime - this.lastFrameTime > this.animationSpeed) {
                this.lastFrameTime = currentTime;
                this.currentFrame = (this.currentFrame + 1) % this.images.length;
            }
            this.renderer.drawQuad(this.texture, this.x, this.y, this.width, this.height, this.color);

        }

        // Draw children
        const sortedChildren = [...this.children].sort((a, b) => {
            const layerA = a.layer !== undefined ? a.layer : 0;
            const layerB = b.layer !== undefined ? b.layer : 0;
            return layerA - layerB;
        });

        for (const child of sortedChildren) {
            if (child.draw) {
                child.draw(this.renderer); // Pass renderer just in case
            }
        }
    }

    startAnimation(animationName) {
        if (this.animation && this.animation.name === animationName) {
            this.isAnimating = true;
            this.currentFrame = 0;
            this.lastFrameTime = Date.now();
        }
    }

    stopAnimation() {
        this.isAnimating = false;
        this.currentFrame = 0;
    }

    setCurrentFrame(frameIndex) {
        if (this.animation && frameIndex >= 0 && frameIndex < this.animation.frames.length) {
            this.currentFrame = frameIndex;
        }
    }

    addAnimation(name, frames, loop = true) {
        this.animation = { name, frames, loop };
    }
}
