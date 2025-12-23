/** @typedef {import('./Camera.js').default} Camera */

/**
 * Represents a scene in the game, containing objects, audio, and a camera.
 */
export default class Scene {
    /**
     * Creates an instance of Scene.
     */
    constructor() {
        this.objects = [];
        this.name = "Untitled Scene";
        /** @type {Camera | null} */
        this.camera = null;
        this.audio = [];
    }

    /**
     * Adds an object to the scene.
     * @param {Object} object - The object to add.
     */
    add(object) {
        this.objects.push(object);
    }

    /**
     * Adds an audio object to the scene.
     * @param {Object} audio - The audio object to add.
     */
    addAudio(audio) {
        this.audio.push(audio);
    }

    /**
     * Sets the camera for the scene.
     * @param {Camera} camera - The camera object.
     */
    setCamera(camera) {
        this.camera = camera;
    }

    /**
     * Retrieves an object by its name.
     * @param {string} name - The name of the object to retrieve.
     * @returns {Object|null} The object if found, otherwise null.
     */
    getObjectByName(name) {
        if (this.camera && this.camera.name === name) return this.camera;
        
        const findRecursive = (objects) => {
            for (const obj of objects) {
                if (obj.name === name) return obj;
                if (obj.children && obj.children.length > 0) {
                    const found = findRecursive(obj.children);
                    if (found) return found;
                }
            }
            return null;
        };

        const foundObj = findRecursive(this.objects);
        if (foundObj) return foundObj;
        
        for (const aud of this.audio) {
            if (aud.name === name) return aud;
        }
        
        return null;
    }

    /**
     * Removes an object from the scene.
     * @param {Object} object - The object to remove.
     */
    remove(object) {
        const index = this.objects.indexOf(object);
        if (index > -1) {
            this.objects.splice(index, 1);
        }
    }

    /**
     * Updates all objects in the scene.
     * @param {number} dt - The delta time since the last frame.
     */
    update(dt) {
        for (const obj of this.objects) {
            if (obj.update) {
                obj.update(dt, this.camera);
            }
        }
    }

    /**
     * Draws all objects in the scene.
     * @param {Object} renderer - The renderer instance.
     */
    draw(renderer) {
        // Sort objects by layer before drawing
        // Objects without a layer property default to layer 0
        const sortedObjects = [...this.objects].sort((a, b) => {
            const layerA = a.layer !== undefined ? a.layer : 0;
            const layerB = b.layer !== undefined ? b.layer : 0;
            return layerA - layerB;
        });

        for (const obj of sortedObjects) {
            if (obj.draw) {
                obj.draw(renderer);
            }
        }
    }
}
