import { Engine, Sprite, AnimatedSprite } from "../../Fluxion/index.js";

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
            320, 360,  // x, y (Pixel coordinates)
            200, 200   // w, h
        );

        // 2. Animated Sprite
        // Uses our generated spritesheet
        const sheetUrl = createSpritesheet();
        
        // Create AnimatedSprite
        // x=700, y=360, w=200, h=200
        // frameWidth=64, frameHeight=64 (matches our canvas drawing above)
        this.animSprite = new AnimatedSprite(
            renderer, 
            sheetUrl, 
            700, 360, 
            200, 200, 
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
    new Engine("gameCanvas", game, 1280, 720, true, true, {
        renderer: {
            webglVersion: 2,
            allowFallback: true,
            renderTargets: {
                msaaSamples: 4,
            },
        },
    });
});
