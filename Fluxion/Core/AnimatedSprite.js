import Sprite from './Sprite.js';

export default class AnimatedSprite extends Sprite {
    constructor(renderer, imageSrc, x = 0, y = 0, width = 100, height = 100, frameWidth = 0, frameHeight = 0) {
        super(renderer, imageSrc, x, y, width, height, frameWidth, frameHeight, true);
        
        this.animations = new Map();
        this.currentAnimation = null;
        this.currentAnimationName = "";
        this.isPlaying = false;
        this.timer = 0;
        this.currentFrameIndex = 0;
        this.speed = 0.1; // Seconds per frame
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
     * @param {Array} frames - Array of frame indices [0, 1, 2] or frame objects {x, y, w, h}
     * @param {number} speed - Time in seconds per frame
     * @param {boolean} loop - Whether to loop the animation
     */
    addAnimation(name, frames, speed = 0.1, loop = true) {
        this.animations.set(name, { frames, speed, loop });
    }

    /**
     * Play a specific animation
     * @param {string} name - Name of the animation to play
     * @param {boolean} force - Force restart if already playing
     */
    play(name, force = false) {
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
        this.speed = this.currentAnimation.speed;
    }

    stop() {
        this.isPlaying = false;
        this.currentFrameIndex = 0;
    }

    pause() {
        this.isPlaying = false;
    }

    resume() {
        if (this.currentAnimation) {
            this.isPlaying = true;
        }
    }

    update(dt, camera) {
        super.update(dt, camera);
        if (!this.isPlaying || !this.currentAnimation) return;

        this.timer += dt;

        if (this.timer >= this.speed) {
            this.timer -= this.speed;
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
        if (!this.visible || !this.texture) return;

        let srcX = 0;
        let srcY = 0;
        let srcW = this.frameWidth || this.width;
        let srcH = this.frameHeight || this.height;

        // Calculate source rectangle based on current frame
        if (this.currentAnimation) {
            const frame = this.currentAnimation.frames[this.currentFrameIndex];
            
            if (typeof frame === 'number') {
                // Grid-based calculation
                if (this.texture.width > 0 && this.frameWidth > 0) {
                    const cols = Math.floor(this.texture.width / this.frameWidth);
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
                 srcW = this.texture.width;
                 srcH = this.texture.height;
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

        // Draw children
        for (const child of this.children) {
            if (child.draw) {
                child.draw(this.renderer);
            }
        }
    }
}
