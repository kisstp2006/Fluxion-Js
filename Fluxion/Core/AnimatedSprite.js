import Sprite from './Sprite.js';

/**
 * Represents an animated sprite that extends the base Sprite class.
 * Supports sprite sheet animations and multi-image animations.
 */
export default class AnimatedSprite extends Sprite {
    /**
     * Creates an instance of AnimatedSprite.
     * @param {Object} renderer - The renderer instance.
     * @param {string|string[]} imageSrc - The source URL of the image or an array of URLs.
     * @param {number} [x=0] - The x-coordinate.
     * @param {number} [y=0] - The y-coordinate.
     * @param {number} [width=100] - The width.
     * @param {number} [height=100] - The height.
     * @param {number} [frameWidth=0] - The width of a single frame.
     * @param {number} [frameHeight=0] - The height of a single frame.
     */
    constructor(renderer, imageSrc, x = 0, y = 0, width = 100, height = 100, frameWidth = 0, frameHeight = 0) {
        super(renderer, imageSrc, x, y, width, height, frameWidth, frameHeight, true);
        
        this.animations = new Map();
        this.currentAnimation = null;
        this.currentAnimationName = "";
        this.isPlaying = false;
        this.timer = 0;
        this.currentFrameIndex = 0;
        this.fps = 10; // Frames per second
        this.loop = true;
        this.flipX = false;
        this.flipY = false;
        
        // Event callbacks
        this.onAnimationComplete = null;
        this.onFrameChange = null;
    }

    /**
     * Add an animation sequence
     * @param {string} name - Name of the animation
     * @param {Array} frames - Array of frame indices [0, 1, 2] or frame objects {x, y, w, h} or image paths
     * @param {number} [fps=10] - Frames per second
     * @param {boolean} [loop=true] - Whether to loop the animation
     */
    addAnimation(name, frames, fps = 10, loop = true) {
        const anim = { frames, fps, loop };
        
        // Check if frames are image paths (strings)
        if (frames.length > 0 && typeof frames[0] === 'string') {
            console.log(`[AnimatedSprite] Adding animation '${name}' with images:`, frames);
            anim.images = new Array(frames.length).fill(null);
            anim._frameKeys = frames.slice();
            
            frames.forEach((src, index) => {
                // Fast path: if already cached, avoid loading.
                if (this.renderer?.hasCachedTexture?.(src)) {
                    anim.images[index] = this.renderer.acquireTexture?.(src) || this.renderer.getCachedTexture(src);
                    return;
                }

                const img = new Image();
                const loadPromise = new Promise((resolve) => {
                    img.onload = () => {
                    console.log(`[AnimatedSprite] Loaded frame ${index} for '${name}': ${src}`);
                    // Create texture with caching
                    if (this._disposed) {
                        resolve(false);
                        return;
                    }
                    anim.images[index] = this.renderer.createAndAcquireTexture?.(img, src) || this.renderer.createTexture(img, src);
                    resolve(true);
                    };
                    img.onerror = (e) => {
                    console.error(`[AnimatedSprite] Failed to load animation frame: ${src}`, e);
                    resolve(false);
                    };
                });

                this.renderer?.trackAssetPromise?.(loadPromise);
                img.src = src;
            });
        } else {
             console.log(`[AnimatedSprite] Adding animation '${name}' with frame indices:`, frames);
        }
        
        this.animations.set(name, anim);
    }

    /**
     * Releases GPU resources owned by this AnimatedSprite.
     */
    dispose() {
        if (this._disposed) return;

        // Release per-frame textures for image-path animations.
        if (this.animations && this.renderer?.releaseTexture) {
            const released = new Set();
            for (const anim of this.animations.values()) {
                if (!anim || !anim._frameKeys) continue;
                for (const key of anim._frameKeys) {
                    if (!key || released.has(key)) continue;
                    released.add(key);
                    this.renderer.releaseTexture(key);
                }
            }
        }

        super.dispose();
    }

    /**
     * Play a specific animation
     * @param {string} name - Name of the animation to play
     * @param {boolean} [force=false] - Force restart if already playing
     */
    play(name, force = false) {
        console.log(`[AnimatedSprite] Play requested for '${name}'`);
        if (!this.animations.has(name)) {
            console.warn(`Animation '${name}' not found.`);
            return;
        }

        if (!force && this.currentAnimationName === name && this.isPlaying) return;

        this.currentAnimationName = name;
        this.currentAnimation = this.animations.get(name);
        this.currentFrameIndex = 0;
        this.timer = 0;
        this.isPlaying = true;
        this.loop = this.currentAnimation.loop;
        this.fps = this.currentAnimation.fps;
    }

    /**
     * Stops the animation and resets to the first frame.
     */
    stop() {
        this.isPlaying = false;
        this.currentFrameIndex = 0;
    }

    /**
     * Pauses the animation at the current frame.
     */
    pause() {
        this.isPlaying = false;
    }

    /**
     * Resumes the animation from the current frame.
     */
    resume() {
        if (this.currentAnimation) {
            this.isPlaying = true;
        }
    }

    /**
     * Updates the animation state.
     * @param {number} dt - The delta time since the last frame.
     * @param {Object} camera - The camera object.
     */
    update(dt, camera) {
        super.update(dt, camera);
        if (!this.isPlaying || !this.currentAnimation) return;

        this.timer += dt;
        const frameDuration = this.fps > 0 ? 1 / this.fps : 0;

        if (frameDuration > 0 && this.timer >= frameDuration) {
            this.timer -= frameDuration;
            const nextFrame = this.currentFrameIndex + 1;

            if (nextFrame >= this.currentAnimation.frames.length) {
                if (this.loop) {
                    this.currentFrameIndex = 0;
                    if (this.onFrameChange) this.onFrameChange(this.currentFrameIndex);
                } else {
                    this.currentFrameIndex = this.currentAnimation.frames.length - 1;
                    this.isPlaying = false;
                    if (this.onAnimationComplete) this.onAnimationComplete(this.currentAnimationName);
                }
            } else {
                this.currentFrameIndex = nextFrame;
                if (this.onFrameChange) this.onFrameChange(this.currentFrameIndex);
            }
        }
    }

    draw() {
        if (!this.active) return;
        if (!this.visible) return;

        // Determine drawing mode based on current animation
        const useImages = this.currentAnimation && this.currentAnimation.images;

        if (useImages) {
             // Draw using images
             const tex = this.currentAnimation.images[this.currentFrameIndex];
             if (tex) {
                let drawX = this.x;
                let drawY = this.y;
                let drawW = this.width;
                let drawH = this.height;

                if (this.flipX) {
                    drawX += drawW;
                    drawW = -drawW;
                }
                if (this.flipY) {
                    drawY += drawH;
                    drawH = -drawH;
                }

                this.renderer.drawQuad(tex, drawX, drawY, drawW, drawH, this.color);
             } else {
                 // Debug log for missing texture (throttle to avoid spam)
                 if (Math.random() < 0.01) console.log(`[AnimatedSprite] Waiting for texture for '${this.currentAnimationName}' frame ${this.currentFrameIndex}`);
             }
        } else if (this.texture) {
            // Draw using sprite sheet (texture)
            let srcX = 0;
            let srcY = 0;
            let srcW = this.frameWidth || this.width;
            let srcH = this.frameHeight || this.height;

            // Calculate source rectangle based on current frame
            if (this.currentAnimation) {
                const frame = this.currentAnimation.frames[this.currentFrameIndex];
                
                if (typeof frame === 'number') {
                    // Grid-based calculation
                    const dims = this.renderer?._textureDimensions?.get(this.texture);
                    const texWidth = dims ? dims.width : 0;
                    if (texWidth > 0 && this.frameWidth > 0) {
                        const cols = Math.floor(texWidth / this.frameWidth);
                        const col = frame % cols;
                        const row = Math.floor(frame / cols);
                        
                        srcX = col * this.frameWidth;
                        srcY = row * this.frameHeight;
                        srcW = this.frameWidth;
                        srcH = this.frameHeight;
                    }
                } else if (typeof frame === 'object') {
                    // Explicit frame object {x, y, w, h}
                    srcX = frame.x;
                    srcY = frame.y;
                    srcW = frame.w || frame.width || this.frameWidth;
                    srcH = frame.h || frame.height || this.frameHeight;
                }
            } else {
                // Default to first frame or full image
                 if (this.frameWidth > 0 && this.frameHeight > 0) {
                     srcX = 0;
                     srcY = 0;
                     srcW = this.frameWidth;
                     srcH = this.frameHeight;
                 } else {
                     const dims = this.renderer?._textureDimensions?.get(this.texture);
                     if (dims) {
                         srcW = dims.width;
                         srcH = dims.height;
                     }
                 }
            }

            let drawX = this.x;
            let drawY = this.y;
            let drawW = this.width;
            let drawH = this.height;

            // Handle flipping by modifying geometry
            if (this.flipX) {
                drawX += drawW;
                drawW = -drawW;
            }
            if (this.flipY) {
                drawY += drawH;
                drawH = -drawH;
            }

            // Pass color to drawQuad (requires updated Renderer)
            this.renderer.drawQuad(
                this.texture, 
                drawX, drawY, drawW, drawH, 
                srcX, srcY, srcW, srcH,
                this.color
            );
        }

        // Draw children (Sprite handles cached sorting)
        if (this.children && this.children.length > 0) {
            if (!this._sortedChildren || this._childrenDirty) {
                this._sortedChildren = [...this.children].sort((a, b) => {
                    const layerA = a.layer !== undefined ? a.layer : 0;
                    const layerB = b.layer !== undefined ? b.layer : 0;
                    return layerA - layerB;
                });
                this._childrenDirty = false;
            }

            for (const child of this._sortedChildren) {
                if (child.draw) child.draw(this.renderer);
            }
        }
    }
}
