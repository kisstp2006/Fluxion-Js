export default class Camera {
    constructor(x = 0, y = 0, zoom = 1, rotation = 0) {
        this.x = x;
        this.y = y;
        this.zoom = zoom;
        this.rotation = rotation;
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
        return { x: this.x, y: this.y, zoom: this.zoom, rotation: this.rotation };
    }
}
