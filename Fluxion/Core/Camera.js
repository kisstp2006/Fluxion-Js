/**
 * Represents a camera that controls the view of the game world.
 */
export default class Camera {
    /**
     * Creates an instance of Camera.
     * @param {number} [x=0] - The x-coordinate of the camera.
     * @param {number} [y=0] - The y-coordinate of the camera.
     * @param {number} [zoom=1] - The zoom level.
     * @param {number} [rotation=0] - The rotation angle in radians.
     * @param {number} [width=0] - The width of the camera view.
     * @param {number} [height=0] - The height of the camera view.
     */
    constructor(x = 0, y = 0, zoom = 1, rotation = 0, width = 0, height = 0) {
        /** @type {'2D'|'3D'} */
        this.type = '2D';
        /** @type {string} */
        this.category = 'camera';

        /** @type {string} */
        this.name = 'Camera';

        this.x = x;
        this.y = y;
        this.zoom = zoom;
        this.rotation = rotation;
        this.width = width;
        this.height = height;
        this.active = true;
    }

    /**
     * Sets the size of the camera view.
     * @param {number} width - The width.
     * @param {number} height - The height.
     */
    setSize(width, height) {
        this.width = width;
        this.height = height;
    }

    /**
     * Gets the size of the camera view.
     * @returns {{width: number, height: number}} The size.
     */
    getSize() {
        return { width: this.width, height: this.height };
    }

    /**
     * Moves the camera by a delta amount.
     * @param {number} dx - The change in x.
     * @param {number} dy - The change in y.
     */
    move(dx, dy) {
        this.x += dx;
        this.y += dy;
    }

    /**
     * Sets the position of the camera.
     * @param {number} x - The new x-coordinate.
     * @param {number} y - The new y-coordinate.
     */
    setPosition(x, y) {
        this.x = x;
        this.y = y;
    }

    /**
     * Zooms in the camera by a factor.
     * @param {number} factor - The zoom factor.
     */
    zoomIn(factor) {
        this.zoom *= factor;
    }

    /**
     * Zooms out the camera by a factor.
     * @param {number} factor - The zoom factor.
     */
    zoomOut(factor) {
        this.zoom /= factor;
    }

    /**
     * Rotates the camera by an angle.
     * @param {number} angle - The angle to rotate in radians.
     */
    rotate(angle) {
        this.rotation += angle;
    }

    /**
     * Sets the rotation of the camera.
     * @param {number} angle - The new rotation angle in radians.
     */
    setRotation(angle) {
        this.rotation = angle;
    }

    /**
     * Gets the current transform properties of the camera.
     * @returns {{x: number, y: number, zoom: number, rotation: number, width: number, height: number}} The transform properties.
     */
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

