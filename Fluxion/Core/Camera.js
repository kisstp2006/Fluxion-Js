export default class Camera {
    constructor(x = 0, y = 0, zoom = 1, rotation = 0, width = 0, height = 0) {
        this.x = x;
        this.y = y;
        this.zoom = zoom;
        this.rotation = rotation;
        this.width = width;
        this.height = height;
        this.active = true;
    }
    setSize(width, height) {
        this.width = width;
        this.height = height;
    }

    getSize() {
        return { width: this.width, height: this.height };
    }

    move(dx, dy) {
        this.x += dx;
        this.y += dy;
    }

    setPosition(x, y) {
        this.x = x;
        this.y = y;
    }

    zoomIn(factor) {
        this.zoom *= factor;
    }

    zoomOut(factor) {
        this.zoom /= factor;
    }

    rotate(angle) {
        this.rotation += angle;
    }

    setRotation(angle) {
        this.rotation = angle;
    }

    getTransform() {
        return {
            x: this.x,
            y: this.y,
            zoom: this.zoom,
            rotation: this.rotation,
            width: this.width,
            height: this.height
        };
    }
}

