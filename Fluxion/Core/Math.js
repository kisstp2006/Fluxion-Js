/**
 * Provides static utility methods for 2D math operations.
 */
export default class Math2D {
    /**
     * Converts degrees to radians.
     * @param {number} deg - The angle in degrees.
     * @returns {number} The angle in radians.
     */
    static degToRad(deg) {
        return deg * (Math.PI / 180);
    }

    /**
     * Converts radians to degrees.
     * @param {number} rad - The angle in radians.
     * @returns {number} The angle in degrees.
     */
    static radToDeg(rad) {
        return rad * (180 / Math.PI);
    }

    /**
     * Linearly interpolates between two values.
     * @param {number} a - The start value.
     * @param {number} b - The end value.
     * @param {number} t - The interpolation factor (0-1).
     * @returns {number} The interpolated value.
     */
    static lerp(a, b, t) {
        return a + (b - a) * t;
    } 

    /**
     * Clamps a value between a minimum and maximum.
     * @param {number} value - The value to clamp.
     * @param {number} min - The minimum value.
     * @param {number} max - The maximum value.
     * @returns {number} The clamped value.
     */
    static clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }
}

/**
 * Represents a 2D vector.
 */
export class Vector2 {
    /**
     * Creates an instance of Vector2.
     * @param {number} [x=0] - The x-component.
     * @param {number} [y=0] - The y-component.
     */
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
    }

    /**
     * Adds another vector to this one.
     * @param {Vector2} v - The vector to add.
     * @returns {Vector2} A new vector representing the sum.
     */
    add(v) {
        return new Vector2(this.x + v.x, this.y + v.y);
    }

    /**
     * Subtracts another vector from this one.
     * @param {Vector2} v - The vector to subtract.
     * @returns {Vector2} A new vector representing the difference.
     */
    subtract(v) {
        return new Vector2(this.x - v.x, this.y - v.y);
    }

    /**
     * Multiplies this vector by a scalar.
     * @param {number} scalar - The scalar value.
     * @returns {Vector2} A new scaled vector.
     */
    multiply(scalar) {
        return new Vector2(this.x * scalar, this.y * scalar);
    }

    /**
     * Divides this vector by a scalar.
     * @param {number} scalar - The scalar value.
     * @returns {Vector2} A new scaled vector.
     */
    divide(scalar) {
        return new Vector2(this.x / scalar, this.y / scalar);
    }

    /**
     * Calculates the magnitude (length) of the vector.
     * @returns {number} The magnitude.
     */
    magnitude() {
        return Math.sqrt(this.x ** 2 + this.y ** 2);
    }

    /**
     * Normalizes the vector (makes it unit length).
     * @returns {Vector2} A new normalized vector.
     */
    normalize() {
        const mag = this.magnitude();
        return mag === 0 ? new Vector2(0, 0) : this.divide(mag);
    }

    /**
     * Calculates the dot product with another vector.
     * @param {Vector2} v - The other vector.
     * @returns {number} The dot product.
     */
    dot(v) {
        return this.x * v.x + this.y * v.y;
    }

    /**
     * Rotates the vector by an angle.
     * @param {number} angle - The angle in degrees.
     * @returns {Vector2} A new rotated vector.
     */
    rotate(angle) {
        const rad = Math2D.degToRad(angle);
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        return new Vector2(
            this.x * cos - this.y * sin,
            this.x * sin + this.y * cos
        );
    }
}

/**
 * Represents a 3x3 matrix for 2D transformations.
 */
export class Matrix3 {
    /**
     * Creates an identity matrix.
     */
    constructor() {
        this.m = [
            1, 0, 0,
            0, 1, 0,
            0, 0, 1
        ];
    }

    /**
     * Creates an identity matrix.
     * @returns {Matrix3} The identity matrix.
     */
    static identity() {
        return new Matrix3();
    }

    /**
     * Creates a translation matrix.
     * @param {number} x - The x translation.
     * @param {number} y - The y translation.
     * @returns {Matrix3} The translation matrix.
     */
    static translation(x, y) {
        const m = new Matrix3();
        m.m[6] = x;
        m.m[7] = y;
        return m;
    }

    /**
     * Creates a rotation matrix.
     * @param {number} angle - The rotation angle in degrees.
     * @returns {Matrix3} The rotation matrix.
     */
    static rotation(angle) {
        const m = new Matrix3();
        const rad = Math2D.degToRad(angle);
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);

        m.m[0] = cos;
        m.m[1] = -sin;
        m.m[3] = sin;
        m.m[4] = cos;
        return m;
    }

    static scale(sx, sy) {
        const m = new Matrix3();
        m.m[0] = sx;
        m.m[4] = sy;
        return m;
    }

    multiply(mat) {
        const result = new Matrix3();
        this.m.forEach((val, i) => {
            const row = Math.floor(i / 3);
            const col = i % 3;
            result.m[i] = this.m[row * 3] * mat.m[col] +
                          this.m[row * 3 + 1] * mat.m[col + 3] +
                          this.m[row * 3 + 2] * mat.m[col + 6];
        });
        return result;
    }
}

// Axis-Aligned Bounding Box (AABB) (useful for collision detection)
export class AABB {
    constructor(x, y, width, height) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
    }

    intersects(other) {
        return (
            this.x < other.x + other.width &&
            this.x + this.width > other.x &&
            this.y < other.y + other.height &&
            this.y + this.height > other.y
        );
    }

    contains(point) {
        return (
            point.x >= this.x &&
            point.x <= this.x + this.width &&
            point.y >= this.y &&
            point.y <= this.y + this.height
        );
    }
}
