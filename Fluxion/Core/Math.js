export default class Math2D {
    // Converts degrees to radians
    static degToRad(deg) {
        return deg * (Math.PI / 180);
    }

    // Converts radians to degrees
    static radToDeg(rad) {
        return rad * (180 / Math.PI);
    }

    // Linear interpolation (lerp) between a and b
    static lerp(a, b, t) {
        return a + (b - a) * t;
    } 

    // Clamps a value between min and max
    static clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }
}

// 2D Vector Class
export class Vector2 {
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
    }

    add(v) {
        return new Vector2(this.x + v.x, this.y + v.y);
    }

    subtract(v) {
        return new Vector2(this.x - v.x, this.y - v.y);
    }

    multiply(scalar) {
        return new Vector2(this.x * scalar, this.y * scalar);
    }

    divide(scalar) {
        return new Vector2(this.x / scalar, this.y / scalar);
    }

    magnitude() {
        return Math.sqrt(this.x ** 2 + this.y ** 2);
    }

    normalize() {
        const mag = this.magnitude();
        return mag === 0 ? new Vector2(0, 0) : this.divide(mag);
    }

    dot(v) {
        return this.x * v.x + this.y * v.y;
    }

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

// 3x3 Matrix for 2D Transformations
export class Matrix3 {
    constructor() {
        this.m = [
            1, 0, 0,
            0, 1, 0,
            0, 0, 1
        ];
    }

    static identity() {
        return new Matrix3();
    }

    static translation(x, y) {
        const m = new Matrix3();
        m.m[6] = x;
        m.m[7] = y;
        return m;
    }

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
