import { Vector2 } from "./Math.js";

export default class Transform {
    constructor(position = new Vector2(0, 0), scale = new Vector2(1, 1)) {
        this.position = position;
        this.scale = scale;
    }

    copy() {
        return new Transform(
            new Vector2(this.position.x, this.position.y),
            new Vector2(this.scale.x, this.scale.y)
        );
    }

    copyTo(target) {
        target.position.x = this.position.x;
        target.position.y = this.position.y;
        target.scale.x = this.scale.x;
        target.scale.y = this.scale.y;
    }

    equals(obj) {
        if (!obj) return false;
        if (!(obj instanceof Transform)) return false;
        return (
            this.position.x === obj.position.x &&
            this.position.y === obj.position.y &&
            this.scale.x === obj.scale.x &&
            this.scale.y === obj.scale.y
        );
    }
}
