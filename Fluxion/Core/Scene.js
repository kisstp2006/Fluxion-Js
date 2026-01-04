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
        /** @type {import('./Camera3D.js').default | null} */
        this.camera3D = null;

        /** @type {Camera[]} */
        this.cameras = [];
        /** @type {import('./Camera3D.js').default[]} */
        this.cameras3D = [];

        // If any camera has active===true (i.e. explicit Active="true" in XML),
        // that becomes the primary and we stop using "last one wins" fallback.
        this._hasExplicitPrimary2D = false;
        this._hasExplicitPrimary3D = false;
        /** @type {Map<string, any>} */
        this.meshDefinitions = new Map();
        /** @type {Map<string, any>} */
        this.materialDefinitions = new Map();
        this.audio = [];
        /** @type {any[]} */
        this.lights = [];
        this.disposeOnSceneChange = false;
        this._disposed = false;
    }

    /**
     * Register a named mesh definition (used by XAML/XML loading).
     * @param {string} name
     * @param {any} definition
     */
    registerMesh(name, definition) {
        if (!name) return;
        this.meshDefinitions.set(name, definition);
    }

    /**
     * Register a named material definition or instance.
     * @param {string} name
     * @param {any} definition
     */
    registerMaterial(name, definition) {
        if (!name) return;
        this.materialDefinitions.set(name, definition);
    }

    /**
     * @param {string} name
     * @returns {any | null}
     */
    getMeshDefinition(name) {
        if (!name) return null;
        return this.meshDefinitions.get(name) || null;
    }

    /**
     * Get a registered material by name. May be a Material instance or a Promise that resolves to one.
     * @param {string} name
     * @returns {any|null}
     */
    getMaterialDefinition(name) {
        if (!name) return null;
        return this.materialDefinitions.get(name) || null;
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
     * Adds a light to the scene (used by the PBR renderer).
     * @param {any} light
     */
    addLight(light) {
        if (!light) return;
        this.lights.push(light);
    }

    /**
     * Removes a light from the scene.
     * @param {any} light
     */
    removeLight(light) {
        const idx = this.lights.indexOf(light);
        if (idx >= 0) this.lights.splice(idx, 1);
    }

    /**
     * Sets the camera for the scene.
     * @param {Camera} camera - The camera object.
     */
    setCamera(camera) {
        this.camera = camera;
    }

    /** @param {import('./Camera3D.js').default} camera */
    setCamera3D(camera) {
        this.camera3D = camera;
    }

    /**
     * Register a 2D camera as part of the scene.
     * Keeps legacy behavior when no explicit Active="true" exists: last camera wins.
     * When Active="true" is present on any camera, that camera is the primary.
     * @param {Camera} camera
     */
    registerCamera(camera) {
        if (!camera) return;
        if (!Array.isArray(this.cameras)) this.cameras = [];
        if (!this.cameras.includes(camera)) this.cameras.push(camera);

        // Explicit primary overrides fallback.
        if (camera.active === true) {
            this._hasExplicitPrimary2D = true;
            this.camera = camera;
            return;
        }

        // Back-compat: if no explicit primary exists, last one wins.
        if (!this._hasExplicitPrimary2D) {
            this.camera = camera;
            return;
        }

        // If we have an explicit primary elsewhere, ignore non-primary cameras.
        if (!this.camera) this.camera = camera;
    }

    /**
     * Register a 3D camera as part of the scene.
     * @param {import('./Camera3D.js').default} camera
     */
    registerCamera3D(camera) {
        if (!camera) return;
        if (!Array.isArray(this.cameras3D)) this.cameras3D = [];
        if (!this.cameras3D.includes(camera)) this.cameras3D.push(camera);

        if (camera.active === true) {
            this._hasExplicitPrimary3D = true;
            this.camera3D = camera;
            return;
        }

        if (!this._hasExplicitPrimary3D) {
            this.camera3D = camera;
            return;
        }

        if (!this.camera3D) this.camera3D = camera;
    }

    /**
     * Set the primary 2D camera (authoring).
     * @param {Camera} camera
     */
    setPrimaryCamera(camera) {
        if (!camera) return;
        if (!Array.isArray(this.cameras)) this.cameras = [];
        if (!this.cameras.includes(camera)) this.cameras.push(camera);
        this._hasExplicitPrimary2D = true;
        for (const c of this.cameras) {
            if (!c) continue;
            c.active = (c === camera);
        }
        this.camera = camera;
    }

    /**
     * Set the primary 3D camera (authoring).
     * @param {import('./Camera3D.js').default} camera
     */
    setPrimaryCamera3D(camera) {
        if (!camera) return;
        if (!Array.isArray(this.cameras3D)) this.cameras3D = [];
        if (!this.cameras3D.includes(camera)) this.cameras3D.push(camera);
        this._hasExplicitPrimary3D = true;
        for (const c of this.cameras3D) {
            if (!c) continue;
            c.active = (c === camera);
        }
        this.camera3D = camera;
    }

    /**
     * Retrieves an object by its name.
     * @param {string} name - The name of the object to retrieve.
     * @returns {Object|null} The object if found, otherwise null.
     */
    getObjectByName(name) {
        if (this.camera && this.camera.name === name) return this.camera;
        if (this.camera3D && this.camera3D.name === name) return this.camera3D;

        if (Array.isArray(this.cameras)) {
            for (const c of this.cameras) {
                if (c && c.name === name) return c;
            }
        }
        if (Array.isArray(this.cameras3D)) {
            for (const c of this.cameras3D) {
                if (c && c.name === name) return c;
            }
        }

        for (const l of this.lights) {
            if (l && l.name === name) return l;
        }
        
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
            if (audio.autoplay) {
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
        // Groundwork render layering:
        // - Render layer 0: 3D (base)
        // - Render layer 1: 2D (existing sprite pipeline), using obj.layer for sub-layer sorting
        // Existing content that only uses obj.layer keeps working (defaults to 2D).

        if (!this._sortedObjects || this._objectsDirty) {
            // Optimize: only create arrays if we have objects
            if (this.objects.length === 0) {
                this._sorted3DObjects = [];
                this._sortedObjects = [];
                this._objectsDirty = false;
                return;
            }

            const objects = this.objects;
            const sorted3D = [];
            const sorted2D = [];

            // Single pass: categorize and sort 2D objects
            for (let i = 0; i < objects.length; i++) {
                const o = objects[i];
                if (!o) continue;
                
                if (o.renderLayer === 0 || typeof o.draw3D === 'function') {
                    sorted3D.push(o);
                } else {
                    sorted2D.push(o);
                }
            }

            // Sort 2D objects by layer
            if (sorted2D.length > 1) {
                sorted2D.sort((a, b) => {
                    const layerA = a?.layer !== undefined ? a.layer : 0;
                    const layerB = b?.layer !== undefined ? b.layer : 0;
                    return layerA - layerB;
                });
            }

            this._sorted3DObjects = sorted3D;
            this._sortedObjects = sorted2D;
            this._objectsDirty = false;
        }

        const layer3DEnabled = renderer?.isRenderLayerEnabled ? renderer.isRenderLayerEnabled(0) : true;
        const layer2DEnabled = renderer?.isRenderLayerEnabled ? renderer.isRenderLayerEnabled(1) : true;

        // 3D base pass
        if (layer3DEnabled && this._sorted3DObjects && this._sorted3DObjects.length > 0) {
            // Push scene lights into the renderer before beginning the 3D pass.
            if (renderer?.setSceneLights) renderer.setSceneLights(this.lights);
            else if (renderer?.setLights) renderer.setLights(this.lights);

            // Shadow pass (directional light depth map) - must run before the main 3D shading pass.
            const drawCasters = () => {
                for (const obj of this._sorted3DObjects) {
                    if (obj && typeof obj.drawShadow === 'function') obj.drawShadow(renderer);
                }
            };

            // Depth+normal prepass (camera depth + world normals). Needed for:
            // - contact shadows (PBR shader)
            // - screen-space shadows (post-process)
            if (typeof renderer?.renderContactDepth === 'function') {
                renderer.renderContactDepth(this.camera3D, drawCasters);
            }

            if (typeof renderer?.renderShadowMaps === 'function') {
                renderer.renderShadowMaps(this.camera3D, this.lights, drawCasters);
            } else if (renderer?.beginShadowPass?.(this.camera3D, this.lights)) {
                drawCasters();
                renderer.endShadowPass?.();
            }

            if (renderer?.begin3D?.(this.camera3D)) {
                for (const obj of this._sorted3DObjects) {
                    if (typeof obj.draw3D === 'function') {
                        obj.draw3D(renderer);
                    }
                }
                renderer.end3D?.();
            }
        }

        // 2D pass (existing behavior)
        if (layer2DEnabled) {
            for (const obj of this._sortedObjects) {
                if (obj && obj.draw) {
                    obj.draw(renderer);
                }
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
        this.lights.length = 0;
        this._sortedObjects = null;
        this._sorted3DObjects = null;
        this._objectsDirty = true;
        this.camera = null;
        this.camera3D = null;
    }
}
