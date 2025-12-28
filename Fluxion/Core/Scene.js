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
        this.disposeOnSceneChange = false;
        this._disposed = false;
    }

    /**
     * Adds an object to the scene.
     * @param {Object} object - The object to add.
     */
    add(object) {
        this.objects.push(object);
        this._objectsDirty = true;
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
            this._objectsDirty = true;
        }
    }

    /**
     * Stops all audio in the scene that has stopOnSceneChange set to true.
     * Call this method when switching away from this scene.
     */
    stopAudio() {
        for (const audio of this.audio) {
            if (audio.stopOnSceneChange) {
                audio.stop();
            }
        }
    }

    /**
     * Plays all audio in the scene that has autoplay enabled.
     * Call this method when switching to this scene.
     */
    playAutoplayAudio() {
        for (const audio of this.audio) {
            if (audio.autoplay && audio.stopOnSceneChange) {
                audio.play(true);
            }
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
        // Cache sorted objects to avoid sorting every frame
        if (!this._sortedObjects || this._objectsDirty) {
            this._sortedObjects = [...this.objects].sort((a, b) => {
                const layerA = a.layer !== undefined ? a.layer : 0;
                const layerB = b.layer !== undefined ? b.layer : 0;
                return layerA - layerB;
            });
            this._objectsDirty = false;
        }

        for (const obj of this._sortedObjects) {
            if (obj.draw) {
                obj.draw(renderer);
            }
        }
    }

    /**
     * Dispose scene resources (textures, etc.) by calling dispose on objects.
     * Safe to call multiple times.
     */
    dispose() {
        if (this._disposed) return;
        this._disposed = true;

        // Stop audio.
        this.stopAudio();

        const disposeRecursive = (obj) => {
            if (!obj) return;
            if (obj.children && obj.children.length > 0) {
                for (const child of obj.children) disposeRecursive(child);
            }
            if (typeof obj.dispose === 'function') obj.dispose();
        };

        for (const obj of this.objects) disposeRecursive(obj);

        // Clear references.
        this.objects.length = 0;
        this.audio.length = 0;
        this._sortedObjects = null;
        this._objectsDirty = true;
        this.camera = null;
    }
}
