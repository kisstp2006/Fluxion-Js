export default class Scene {
    constructor() {
        this.objects = [];
        this.name = "Untitled Scene";
        this.camera = null;
        this.audio = [];
    }

    add(object) {
        this.objects.push(object);
    }

    addAudio(audio) {
        this.audio.push(audio);
    }

    setCamera(camera) {
        this.camera = camera;
    }

    getObjectByName(name) {
        if (this.camera && this.camera.name === name) return this.camera;
        
        for (const obj of this.objects) {
            if (obj.name === name) return obj;
        }
        
        for (const aud of this.audio) {
            if (aud.name === name) return aud;
        }
        
        return null;
    }

    remove(object) {
        const index = this.objects.indexOf(object);
        if (index > -1) {
            this.objects.splice(index, 1);
        }
    }

    update(dt) {
        for (const obj of this.objects) {
            if (obj.update) {
                obj.update(dt);
            }
        }
    }

    draw(renderer) {
        for (const obj of this.objects) {
            if (obj.draw) {
                obj.draw(renderer);
            }
        }
    }
}
