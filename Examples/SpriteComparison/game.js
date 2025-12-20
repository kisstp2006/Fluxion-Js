import Engine from "../../Fluxion/Core/Engine.js";
import Sprite from "../../Fluxion/Core/Sprite.js";
import AnimatedSprite from "../../Fluxion/Core/AnimatedSprite.js";

// Helper to generate a simple spritesheet data URL
function createSpritesheet() {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    // Frame 0: Red Circle
    ctx.fillStyle = '#444';
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = '#ff4444';
    ctx.beginPath();
    ctx.arc(32, 32, 25, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'white';
    ctx.font = '20px Arial';
    ctx.fillText('1', 26, 38);

    // Frame 1: Blue Square
    ctx.fillStyle = '#444';
    ctx.fillRect(64, 0, 64, 64);
    ctx.fillStyle = '#4444ff';
    ctx.fillRect(64 + 10, 10, 44, 44);
    ctx.fillStyle = 'white';
    ctx.font = '20px Arial';
    ctx.fillText('2', 64 + 26, 38);

    return canvas.toDataURL();
}

const game = {
    staticSprite: null,
    animSprite: null,
    
    init(renderer) {
        // 1. Static Sprite
        // Uses the Fluxion icon
        this.staticSprite = new Sprite(
            renderer, 
            "../../Fluxion/Icon/Fluxion_icon.png", 
            -0.5, 0,  // x, y (Normalized coordinates -1 to 1)
            0.4, 0.4  // w, h
        );

        // 2. Animated Sprite
        // Uses our generated spritesheet
        const sheetUrl = createSpritesheet();
        
        // Create AnimatedSprite
        // x=0.1, y=0, w=0.4, h=0.4
        // frameWidth=64, frameHeight=64 (matches our canvas drawing above)
        this.animSprite = new AnimatedSprite(
            renderer, 
            sheetUrl, 
            0.1, 0, 
            0.4, 0.4, 
            64, 64
        );

        // Define animation: frames [0, 1]
        this.animSprite.addAnimation("blink", [0, 1], 0.5, true);
        this.animSprite.play("blink");
    },

    update(dt) {
        // AnimatedSprite needs explicit update call to advance frames
        if (this.animSprite) {
            this.animSprite.update(dt);
        }
    },

    draw(renderer) {
        if (this.staticSprite) this.staticSprite.draw();
        if (this.animSprite) this.animSprite.draw();
    }
};

window.addEventListener("load", () => {
    // Start engine with post-processing disabled for this simple demo
    new Engine("gameCanvas", game, 1280, 720, true, false);
});
