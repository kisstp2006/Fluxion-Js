import Input from './Input.js';

export default class ClickableArea {
    constructor(renderer) {
        this.renderer = renderer;
        this.parent = null;
        this.name = "ClickableArea";
        
        this.isHovered = false;
        this.isPressed = false;
        
        // Callbacks
        this.onClick = null;
        this.onEnter = null;
        this.onExit = null;
        this.onDown = null;
        this.onUp = null;
    }

    update(dt, camera) {
        if (!this.parent || !camera) return;
        
        const input = Input.instance;
        if (!input) return;

        const mousePos = input.getMousePosition();
        const worldPos = this.renderer.screenToWorld(mousePos.x, mousePos.y, camera);
        
        // Check collision with parent bounds
        // Assuming parent has x, y, width, height (centered or top-left?)
        // Sprite.drawQuad usually assumes x,y is top-left?
        // Let's check Sprite.js drawQuad call.
        // this.renderer.drawQuad(..., this.x, this.y, this.width, this.height, ...)
        // Renderer.drawQuad builds vertices: x,y (TL), x+w,y (TR), x,y+h (BL), x+w,y+h (BR).
        // So x,y is Top-Left.
        // Wait, in WebGL/Cartesian, Y is usually up.
        // But drawQuad uses:
        // x, y (TL) -> u0, v1 (Top in UV)
        // x, y+h (BL) -> u0, v0 (Bottom in UV)
        // So y+h is "below" y?
        // If Y is up, y+h is above y.
        // But UV v1 is Top (1.0), v0 is Bottom (0.0).
        // So (x, y) maps to Top-Left UV.
        // (x, y+h) maps to Bottom-Left UV.
        // This implies (x, y) is the "Top" visually.
        // If Y is up in world space, then "Top" has higher Y.
        // So (x, y) should be the bottom-left if we want standard Cartesian?
        // Or maybe (x, y) is top-left and Y goes down?
        // The vertex shader does: `pos = (Rot * (pos - cam)) * zoom`.
        // If camera is at 0,0.
        // If I draw at 0,0 with w=1, h=1.
        // Vertices: (0,0), (1,0), (0,1), (1,1).
        // If Y is up, (0,1) is above (0,0).
        // UVs: (0,0) -> v1 (Top). So (0,0) is Top?
        // No, (0,0) vertex gets v1 (1.0).
        // (0,1) vertex gets v0 (0.0).
        // So (0,0) corresponds to Top of image.
        // (0,1) corresponds to Bottom of image.
        // This means as Y increases (0 -> 1), we go from Top to Bottom of image.
        // So Y is DOWN in this coordinate system (or the texture is mapped upside down relative to Y-up).
        // Usually 2D games use Y-down (screen coords).
        // If Y is down, then y < mouse.y < y+h checks out.
        
        // Let's assume standard AABB check:
        // x <= mouse.x <= x + width
        // y <= mouse.y <= y + height
        
        const p = this.parent;
        const hit = (
            worldPos.x >= p.x &&
            worldPos.x <= p.x + p.width &&
            worldPos.y >= p.y &&
            worldPos.y <= p.y + p.height
        );

        if (hit) {
            if (!this.isHovered) {
                this.isHovered = true;
                if (this.onEnter) this.onEnter();
            }
            
            if (input.getMouseButtonDown(0)) { // Left click
                this.isPressed = true;
                if (this.onDown) this.onDown();
            }
            
            if (input.getMouseButtonUp(0)) {
                if (this.isPressed) {
                    if (this.onClick) this.onClick();
                }
                this.isPressed = false;
                if (this.onUp) this.onUp();
            }
        } else {
            if (this.isHovered) {
                this.isHovered = false;
                if (this.onExit) this.onExit();
            }
            this.isPressed = false; // Reset pressed if we leave area
        }
    }
}
