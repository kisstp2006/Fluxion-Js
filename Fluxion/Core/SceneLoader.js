import Scene from './Scene.js';
import Sprite from './Sprite.js';
import AnimatedSprite from './AnimatedSprite.js';
import Audio from './Audio.js';
import Camera from './Camera.js';
import Camera3D from './Camera3D.js';
import ClickableArea from './ClickableArea.js';
import Text from './Text.js';
import MeshNode from './MeshNode.js';
import Material from './Material.js';
import Skybox from './Skybox.js';
import { DirectionalLight, PointLight, SpotLight } from './Lights.js';
import { loadGLTF } from './GLTFLoader.js';

/**
 * Utility class for loading scenes from XML files.
 */
export default class SceneLoader {
        /**
         * Resolve a resource URL found in a scene.
         *
         * Rules:
         * - Absolute URLs (http/https/fluxion/etc) are returned as-is.
         * - Relative paths are resolved against the scene file directory (baseUrl).
         *
         * @param {string} p
         * @param {string} baseUrl
         */
        static _resolveSceneResourceUrl(p, baseUrl) {
            const src = String(p || '').trim();
            if (!src) return src;

            // Already an absolute URL (scheme://...)
            if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(src)) return src;

            // Resolve relative to the scene file directory.
            try { return new URL(src, baseUrl).toString(); } catch { return src; }
        }

    /**
     * Loads a scene from an XML file.
     * @param {string} url - The URL of the XML file.
     * @param {Object} renderer - The renderer instance.
     * @returns {Promise<Scene>} The loaded scene.
     */
    static async load(url, renderer) {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Failed to fetch scene file: ${url}`);
            
            const text = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(text, "text/xml");
            
            const sceneNode = doc.querySelector("Scene");
            if (!sceneNode) throw new Error("Invalid scene file: No <Scene> tag found.");

            const scene = new Scene();
            if (sceneNode.hasAttribute("name")) {
                scene.name = sceneNode.getAttribute("name");
            }

            // Resolve base URL for relative path resolution
            let baseUrl;
            try {
                // Try to create absolute URL from the scene URL
                const sceneUrl = new URL(url, window.location.href);
                baseUrl = new URL('.', sceneUrl).toString();
            } catch (e) {
                // Fallback: use document.baseURI or window.location
                baseUrl = (typeof document !== 'undefined' && document.baseURI) 
                    ? document.baseURI 
                    : (typeof window !== 'undefined' ? window.location.href : '');
            }

            const children = Array.from(sceneNode.children);

            // Pass 1: register named mesh resources (top-level <Mesh ... />) and materials
            for (const child of children) {
                if (child.tagName === 'Mesh') {
                    const name = child.getAttribute('name') || '';
                    const type = child.getAttribute('type') || child.getAttribute('source') || child.getAttribute('mesh') || '';
                    if (!name) continue;

                    // Check if this is a GLTF file
                    const source = child.getAttribute('source') || child.getAttribute('src') || '';
                    const isGLTF = source.toLowerCase().endsWith('.gltf') || source.toLowerCase().endsWith('.glb');
                    
                    if (isGLTF && source) {
                        // GLTF file - load asynchronously
                        // Resolve relative to scene file URL (same as materials do)
                        let gltfUrl;
                        try {
                            // First, resolve the scene file URL to absolute
                            const sceneUrl = new URL(url, window.location.href);
                            // Get the directory of the scene file
                            const base = new URL('.', sceneUrl).toString();
                            // Resolve the GLTF path relative to the scene file directory
                            gltfUrl = new URL(source, base).toString();
                        } catch (e) {
                            // Fallback: use document.baseURI or window.location.href
                            const base = (typeof document !== 'undefined' && document.baseURI) ? document.baseURI : (typeof window !== 'undefined' ? window.location.href : '');
                            try {
                                gltfUrl = new URL(source, base).toString();
                            } catch (e2) {
                                // Last resort: use source as-is
                                gltfUrl = source;
                            }
                        }
                        
                        const loadPromise = (async () => {
                            try {
                                const result = await loadGLTF(gltfUrl, renderer.gl, renderer);

                                // Namespace glTF resources under the XAML mesh name to avoid collisions
                                // between multiple models that reuse generic names like "Material".
                                const ns = `${name}::`;
                                const nsMat = (k) => `${ns}${k}`;
                                const nsMesh = (k) => `${ns}${k}`;

                                // Register all meshes from GLTF with their GLTF names
                                for (const [meshName, mesh] of result.meshes.entries()) {
                                    const matKey = result.meshMaterials?.get(meshName);

                                    const hint = nsMat(matKey || '__gltf_default__');
                                    // Prefer namespaced registration; also register the raw name only if unused.
                                    scene.registerMesh(nsMesh(meshName), { type: 'gltf', mesh, material: hint });
                                    if (!scene.getMeshDefinition(meshName)) {
                                        scene.registerMesh(meshName, { type: 'gltf', mesh, material: hint });
                                    }
                                }
                                // Also register the XAML mesh name to point to the first GLTF mesh.
                                // If that mesh is split into multiple primitives, register a group so all
                                // primitives (and their materials) render.
                                if (result.meshes.size > 0) {
                                    const firstEntry = Array.from(result.meshes.entries())[0];
                                    const firstMeshName = firstEntry[0];
                                    const primMatch = /^(.*)_Primitive_(\d+)$/.exec(firstMeshName);
                                    const baseName = primMatch ? primMatch[1] : firstMeshName;

                                    const partEntries = Array.from(result.meshes.entries())
                                        .filter(([k]) => k === baseName || k.startsWith(`${baseName}_Primitive_`))
                                        .sort((a, b) => {
                                            const ma = /_Primitive_(\d+)$/.exec(a[0]);
                                            const mb = /_Primitive_(\d+)$/.exec(b[0]);
                                            const ia = ma ? parseInt(ma[1]) : 0;
                                            const ib = mb ? parseInt(mb[1]) : 0;
                                            return ia - ib;
                                        });

                                    if (partEntries.length <= 1) {
                                        const firstMesh = firstEntry[1];
                                        const matKey = result.meshMaterials?.get(firstMeshName);
                                        scene.registerMesh(name, { type: 'gltf', mesh: firstMesh, material: nsMat(matKey || '__gltf_default__') });
                                    } else {
                                        const parts = partEntries.map(([k, mesh]) => ({
                                            name: nsMesh(k),
                                            mesh,
                                            material: nsMat(result.meshMaterials?.get(k) || '__gltf_default__')
                                        }));
                                        scene.registerMesh(name, { type: 'gltf-group', parts });
                                    }
                                }
                                // Register all materials from GLTF under the namespaced key.
                                for (const [matName, mat] of result.materials.entries()) {
                                    scene.registerMaterial(nsMat(matName), mat);
                                    // Also register raw name only if unused (helps backward-compat / debugging).
                                    if (!scene.getMaterialDefinition(matName)) {
                                        scene.registerMaterial(matName, mat);
                                    }
                                }
                                return result;
                            } catch (err) {
                                console.error(`Failed to load GLTF ${gltfUrl}:`, err);
                                return null;
                            }
                        })();
                        
                        renderer?.trackAssetPromise?.(loadPromise);
                        // Store promise for later resolution (will be replaced with actual mesh when loaded)
                        scene.registerMesh(name, { type: 'gltf', promise: loadPromise, url: gltfUrl });
                        continue;
                    }

                    if (!type) continue;

                    const color = this._parseColor(child.getAttribute('color'));
                    const params = this._parseMeshParams(child);
                    scene.registerMesh(name, { type, color, params });
                    continue;
                }

                // Materials: <Material name="..." source="foo.mat" albedoColor="#fff" albedoTexture="..." />
                if (child.tagName === 'Material') {
                    const name = child.getAttribute('name') || '';
                    if (!name) continue;

                    const src = child.getAttribute('source') || child.getAttribute('src') || null;
                    if (src) {
                        // Resolve relative to the scene URL (not the caller page).
                        const matUrl = new URL(src, baseUrl).toString();
                        const p = Material.load(matUrl, renderer);
                        // Track loading promise on renderer so loading flows can wait
                        renderer?.trackAssetPromise?.(p);
                        // Store promise in scene so callers can await when resolving references
                        scene.registerMaterial(name, p);
                        continue;
                    }

                    // Inline material definition (synchronous)
                    const mat = new Material();
                    // Factors (back-compat: albedoColor/color)
                    const baseColorAttr = child.getAttribute('baseColorFactor') || child.getAttribute('albedoColor') || child.getAttribute('color');
                    if (baseColorAttr) mat.albedoColor = this._parseColor(baseColorAttr);

                    // Metallic/Roughness factors
                    if (child.hasAttribute('metallicFactor') || child.hasAttribute('metallic')) {
                        const m = parseFloat(child.getAttribute('metallicFactor') || child.getAttribute('metallic') || '0');
                        mat.metallicFactor = Math.min(1, Math.max(0, m));
                    }
                    if (child.hasAttribute('roughnessFactor') || child.hasAttribute('roughness')) {
                        const r = parseFloat(child.getAttribute('roughnessFactor') || child.getAttribute('roughness') || '1');
                        mat.roughnessFactor = Math.min(1, Math.max(0.04, r));
                    }

                    // Normal/AO
                    if (child.hasAttribute('normalScale')) {
                        mat.normalScale = parseFloat(child.getAttribute('normalScale') || '1');
                    }
                    if (child.hasAttribute('aoStrength')) {
                        mat.aoStrength = parseFloat(child.getAttribute('aoStrength') || '1');
                    }

                    // Emissive
                    const emissiveAttr = child.getAttribute('emissiveFactor') || child.getAttribute('emissive');
                    if (emissiveAttr) {
                        const c = this._parseColor(emissiveAttr);
                        mat.emissiveFactor = [c[0], c[1], c[2]];
                    }

                    // Alpha
                    if (child.hasAttribute('alphaMode')) {
                        mat.alphaMode = String(child.getAttribute('alphaMode') || 'OPAQUE').toUpperCase();
                    }
                    if (child.hasAttribute('alphaCutoff')) {
                        mat.alphaCutoff = parseFloat(child.getAttribute('alphaCutoff') || '0.5');
                    }

                    // Textures (optional). If any are present, load asynchronously and register a promise.
                    const base = baseUrl;
                    const getTexUrl = (attr) => {
                        const p = child.getAttribute(attr);
                        if (!p) return null;
                        try { return new URL(p, base).toString(); } catch { return p; }
                    };

                    const texBaseColor = getTexUrl('baseColorTexture') || getTexUrl('albedoTexture');
                    const texMetallic = getTexUrl('metallicTexture');
                    const texRoughness = getTexUrl('roughnessTexture');
                    const texNormal = getTexUrl('normalTexture');
                    const texAo = getTexUrl('aoTexture') || getTexUrl('occlusionTexture');
                    const texEmissive = getTexUrl('emissiveTexture');
                    const texAlpha = getTexUrl('alphaTexture');

                    const anyTex = !!(texBaseColor || texMetallic || texRoughness || texNormal || texAo || texEmissive || texAlpha);
                    if (anyTex) {
                        const p = (async () => {
                            const load = async (texUrl) => {
                                if (!texUrl || !renderer) return null;
                                // Cache-aware: acquire if already cached
                                if (renderer.hasCachedTexture?.(texUrl)) {
                                    return renderer.acquireTexture?.(texUrl) || renderer.getCachedTexture?.(texUrl);
                                }
                                const img = await new Promise((resolve) => {
                                    const i = new Image();
                                    i.crossOrigin = 'anonymous';
                                    i.onload = () => resolve(i);
                                    i.onerror = () => resolve(null);
                                    i.src = texUrl;
                                });
                                if (!img) return null;
                                return renderer.createAndAcquireTexture?.(img, texUrl) || renderer.createTexture?.(img, texUrl) || null;
                            };

                            mat.baseColorTexture = await load(texBaseColor);
                            mat.metallicTexture = await load(texMetallic);
                            mat.roughnessTexture = await load(texRoughness);
                            mat.normalTexture = await load(texNormal);
                            mat.aoTexture = await load(texAo);
                            mat.emissiveTexture = await load(texEmissive);
                            mat.alphaTexture = await load(texAlpha);
                            return mat;
                        })();

                        renderer?.trackAssetPromise?.(p);
                        scene.registerMaterial(name, p);
                        continue;
                    }

                    scene.registerMaterial(name, mat);
                    continue;
                }
            }

            // Pass 2: parse objects (including <Camera3D>, <MeshNode>, and <Skybox>)
            for (const child of children) {
                if (child.tagName === 'Mesh') continue;
                if (child.tagName === 'Material') continue;

                // Handle Skybox separately (needs renderer reference)
                if (child.tagName === 'Skybox') {
                    const skybox = await this.parseSkybox(child, renderer, url);
                    if (skybox && renderer) {
                        renderer.setSkybox(skybox);
                    }
                    continue;
                }

                const obj = await this.parseObject(child, renderer, baseUrl);
                if (!obj) continue;

                if (obj instanceof Camera) {
                    scene.setCamera(obj);
                    continue;
                }
                if (obj instanceof Camera3D) {
                    scene.setCamera3D(obj);
                    continue;
                }
                if (obj instanceof Audio) {
                    scene.addAudio(obj);
                    continue;
                }
                // Lights are stored separately from drawable scene objects
                if (obj && obj.isLight) {
                    scene.addLight(obj);
                    continue;
                }

                // Resolve named mesh resources onto mesh nodes.
                if (obj instanceof MeshNode) {
                    const def = scene.getMeshDefinition(obj.source);
                    if (def) {
                        // Check if this is a GLTF promise that needs to be awaited
                        if (def.type === 'gltf' && def.promise) {
                            try {
                                const gltfResult = await def.promise;
                                // After promise resolves, the mesh should be registered with the XAML name
                                // Re-fetch the definition to get the actual mesh
                                const resolvedDef = scene.getMeshDefinition(obj.source);
                                if (resolvedDef && resolvedDef.type === 'gltf' && resolvedDef.mesh) {
                                    console.log(`GLTF: Resolved mesh "${obj.source}" for MeshNode "${obj.name}"`, resolvedDef);
                                    obj.setMeshDefinition(resolvedDef);
                                } else if (resolvedDef && resolvedDef.type === 'gltf-group' && Array.isArray(resolvedDef.parts)) {
                                    console.log(`GLTF: Resolved grouped mesh "${obj.source}" for MeshNode "${obj.name}"`, resolvedDef);
                                    // Expand to children MeshNodes (one per primitive)
                                    await SceneLoader._expandGltfGroupMeshNode(obj, resolvedDef, scene);
                                } else if (gltfResult && gltfResult.meshes && gltfResult.meshes.size > 0) {
                                    // Fallback: use first mesh from GLTF
                                    const gltfMesh = Array.from(gltfResult.meshes.values())[0];
                                    console.log(`GLTF: Using fallback mesh for MeshNode "${obj.name}"`, gltfMesh);
                                    obj.setMeshDefinition({ type: 'gltf', mesh: gltfMesh });
                                } else {
                                    console.warn(`GLTF: No mesh found for "${obj.source}" after promise resolved`);
                                }
                            } catch (e) {
                                console.warn('Failed to resolve GLTF mesh', obj.source, e);
                            }
                        } else if (def.type === 'gltf' && def.mesh) {
                            // GLTF mesh already loaded
                            console.log(`GLTF: Using already-loaded mesh for MeshNode "${obj.name}"`, def);
                            obj.setMeshDefinition(def);
                        } else if (def.type === 'gltf-group' && Array.isArray(def.parts)) {
                            console.log(`GLTF: Using already-loaded grouped mesh for MeshNode "${obj.name}"`, def);
                            await SceneLoader._expandGltfGroupMeshNode(obj, def, scene);
                        } else {
                            obj.setMeshDefinition(def);
                        }
                    } else {
                        console.warn(`MeshNode "${obj.name}": No mesh definition found for source "${obj.source}"`);
                    }

                    // If the mesh definition provides a default material and the node didn't specify one,
                    // auto-apply it (keeps GLTF imports from rendering pure white).
                    if (!obj.material && obj.meshDefinition && obj.meshDefinition.type === 'gltf' && obj.meshDefinition.material) {
                        const hint = obj.meshDefinition.material;
                        const mdef = (typeof hint === 'string') ? scene.getMaterialDefinition(hint) : hint;
                        if (mdef) {
                            if (typeof mdef.then === 'function') {
                                try {
                                    const mat = await mdef;
                                    if (mat) obj.setMaterial(mat);
                                } catch (e) {
                                    console.warn('Failed to resolve GLTF default material', hint, e);
                                }
                            } else {
                                obj.setMaterial(mdef);
                            }
                        }
                    }

                    // Resolve material reference if present
                    if (obj.material) {
                        const mdef = scene.getMaterialDefinition(obj.material);
                        if (mdef) {
                            // mdef may be a promise
                            if (typeof mdef.then === 'function') {
                                try {
                                    const mat = await mdef;
                                    if (mat) obj.setMaterial(mat);
                                } catch (e) {
                                    console.warn('Failed to resolve material', obj.material, e);
                                }
                            } else {
                                obj.setMaterial(mdef);
                            }
                        }
                    }
                }

                scene.add(obj);
            }

            return scene;
        } catch (error) {
            console.error("SceneLoader Error:", error);
            return new Scene(); // Return empty scene on error
        }
    }

    /**
     * Expand a GLTF grouped mesh definition (multiple primitives/parts) into child MeshNodes.
     * Each part keeps its own material hint unless the parent MeshNode specifies an override material.
     * @param {MeshNode} parent
     * @param {{type:'gltf-group', parts:Array<{name:string, mesh:any, material:string}>}} def
     * @param {Scene} scene
     */
    static async _expandGltfGroupMeshNode(parent, def, scene) {
        if (!parent || !def || !Array.isArray(def.parts)) return;

        // Material override on the parent applies to all children.
        // Ensure it's resolved to a Material instance (not a string name / promise).
        let overrideMaterial = parent.material;
        if (overrideMaterial && typeof overrideMaterial === 'string') {
            const mdef = scene.getMaterialDefinition(overrideMaterial);
            if (mdef) {
                if (typeof mdef.then === 'function') {
                    try {
                        overrideMaterial = await mdef;
                    } catch (e) {
                        console.warn('Failed to resolve override material', parent.material, e);
                    }
                } else {
                    overrideMaterial = mdef;
                }
            }
            // Keep parent consistent for any other uses.
            if (overrideMaterial && typeof overrideMaterial !== 'string') {
                parent.setMaterial(overrideMaterial);
            }
        }

        // Convert parent into a container node (no mesh of its own).
        parent.children = [];
        parent.setMeshDefinition({ type: 'group' });

        // Children do not inherit transforms in Fluxion's current MeshNode implementation,
        // so we copy transforms onto each child.
        for (let i = 0; i < def.parts.length; i++) {
            const part = def.parts[i];
            if (!part || !part.mesh) continue;

            const child = new MeshNode();
            child.name = `${parent.name}_part${i}`;

            child.x = parent.x;
            child.y = parent.y;
            child.z = parent.z;

            child.scaleX = parent.scaleX;
            child.scaleY = parent.scaleY;
            child.scaleZ = parent.scaleZ;

            child.rotX = parent.rotX;
            child.rotY = parent.rotY;
            child.rotZ = parent.rotZ;

            child.source = parent.source;
            child.setMeshDefinition({ type: 'gltf', mesh: part.mesh, material: part.material || '__gltf_default__' });

            // Apply override material if present; else auto-apply the per-part hint.
            if (overrideMaterial) {
                child.setMaterial(overrideMaterial);
            } else if (child.meshDefinition?.material) {
                const hint = child.meshDefinition.material;
                const mdef = (typeof hint === 'string') ? scene.getMaterialDefinition(hint) : hint;
                if (mdef) {
                    if (typeof mdef.then === 'function') {
                        try {
                            const mat = await mdef;
                            if (mat) child.setMaterial(mat);
                        } catch (e) {
                            console.warn('Failed to resolve GLTF part material', hint, e);
                        }
                    } else {
                        child.setMaterial(mdef);
                    }
                }
            }

            parent.addChild(child);
        }
    }

    /**
     * Parse a color string into [r,g,b,a] floats.
     * Supports: "r,g,b", "r,g,b,a" (0..1 or 0..255) and "#RRGGBB" / "#RRGGBBAA".
     * @param {string | null} str
     * @returns {[number,number,number,number]}
     */
    static _parseColor(str) {
        if (!str) return [1, 1, 1, 1];
        const s = String(str).trim();

        if (s.startsWith('#')) {
            const hex = s.slice(1);
            if (hex.length === 6 || hex.length === 8) {
                const r = parseInt(hex.slice(0, 2), 16);
                const g = parseInt(hex.slice(2, 4), 16);
                const b = parseInt(hex.slice(4, 6), 16);
                const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) : 255;
                return [r / 255, g / 255, b / 255, a / 255];
            }
        }

        if (s.includes(',')) {
            const parts = s.split(',').map(p => parseFloat(p.trim())).filter(v => !Number.isNaN(v));
            if (parts.length >= 3) {
                const r = parts[0];
                const g = parts[1];
                const b = parts[2];
                const a = parts.length >= 4 ? parts[3] : 1;
                const max = Math.max(r, g, b, a);
                if (max > 1.0) {
                    return [r / 255, g / 255, b / 255, a / 255];
                }
                return [r, g, b, a];
            }
        }

        return [1, 1, 1, 1];
    }

    /**
     * Parses common mesh parameters from an element.
     * @param {Element} node
     */
    static _parseMeshParams(node) {
        const getNum = (name, def = undefined) => {
            const v = node.getAttribute(name);
            return v !== null ? parseFloat(v) : def;
        };
        const getInt = (name, def = undefined) => {
            const v = node.getAttribute(name);
            return v !== null ? (parseInt(v) | 0) : def;
        };

        /** @type {any} */
        const params = {};

        // Dimensions
        const width = getNum('width');
        const height = getNum('height');
        const depth = getNum('depth');
        const size = getNum('size');
        const radius = getNum('radius');

        if (width !== undefined) params.width = width;
        if (height !== undefined) params.height = height;
        if (depth !== undefined) params.depth = depth;
        if (size !== undefined) params.size = size;
        if (radius !== undefined) params.radius = radius;

        // Segments
        const subdivisions = getInt('subdivisions');
        const radialSegments = getInt('radialSegments');
        const heightSegments = getInt('heightSegments');
        const capSegments = getInt('capSegments');

        if (subdivisions !== undefined) params.subdivisions = subdivisions;
        if (radialSegments !== undefined) params.radialSegments = radialSegments;
        if (heightSegments !== undefined) params.heightSegments = heightSegments;
        if (capSegments !== undefined) params.capSegments = capSegments;

        return params;
    }

    /**
     * Parses an XML node into a game object.
     * @param {Element} node - The XML element.
     * @param {Object} renderer - The renderer instance.
     * @returns {Promise<Object|null>} The parsed object, or null if unknown.
     */
    static async parseObject(node, renderer) {
        // NOTE: baseUrl is passed from SceneLoader.load() and is used to resolve asset paths.
        // Relative paths (e.g. 'Assets/foo.png') resolve against the scene file directory.
        const baseUrl = arguments.length >= 3 ? arguments[2] : '';
        const tagName = node.tagName;
        let obj = null;
        
        // Helper to get attributes
        const getFloat = (name, def = 0) => {
            const val = node.getAttribute(name);
            return val !== null ? parseFloat(val) : def;
        };
        const getFloatAny = (names, def = 0) => {
            for (const name of names) {
                const val = node.getAttribute(name);
                if (val !== null) return parseFloat(val);
            }
            return def;
        };
        const getString = (name, def = "") => node.getAttribute(name) || def;
        const getBool = (name, def = false) => node.getAttribute(name) === "true";

        if (tagName === "Sprite") {
            const srcRaw = getString("imageSrc");
            const src = SceneLoader._resolveSceneResourceUrl(srcRaw, baseUrl);
            const x = getFloat("x");
            const y = getFloat("y");
            const w = getFloat("width", 1);
            const h = getFloat("height", 1);
            
            const sprite = new Sprite(renderer, src, x, y, w, h);
            sprite.name = getString("name");
            obj = sprite;
        }
        
        else if (tagName === "AnimatedSprite") {
            const srcRaw = getString("imageSrc");
            const src = SceneLoader._resolveSceneResourceUrl(srcRaw, baseUrl);
            const x = getFloat("x");
            const y = getFloat("y");
            const w = getFloat("width", 1);
            const h = getFloat("height", 1);
            const fw = getFloat("frameWidth");
            const fh = getFloat("frameHeight");
            
            const sprite = new AnimatedSprite(renderer, src, x, y, w, h, fw, fh);
            sprite.name = getString("name");
            
            let firstAnimName = null;
            let hasAutoplay = false;

            // Parse animations
            for (const animNode of node.children) {
                if (animNode.tagName === "Animation") {
                    const name = animNode.getAttribute("name");
                    const framesStr = animNode.getAttribute("frames"); // "0,1,2"
                    const fps = parseFloat(animNode.getAttribute("speed") || "10");
                    const loop = animNode.getAttribute("loop") !== "false";
                    
                    if (name && framesStr) {
                        let frames;
                        // Check if frames are numeric indices or file paths
                        // If any part is not a number, treat as paths
                        if (/[^0-9,\s]/.test(framesStr)) {
                            frames = framesStr
                                .split(',')
                                .map(s => s.trim())
                                .filter(Boolean)
                                .map((p) => SceneLoader._resolveSceneResourceUrl(p, baseUrl));
                        } else {
                            frames = framesStr.split(',').map(s => parseInt(s.trim()));
                        }

                        sprite.addAnimation(name, frames, fps, loop);
                        
                        if (!firstAnimName) firstAnimName = name;

                        // Auto play if specified
                        if (animNode.getAttribute("autoplay") === "true") {
                            sprite.play(name);
                            hasAutoplay = true;
                        }
                    }
                }
            }
            
            // Default to first animation if no autoplay specified
            if (!hasAutoplay && firstAnimName) {
                sprite.play(firstAnimName);
            }
            
            obj = sprite;
        }

        else if (tagName === "ClickableArea") {
            const area = new ClickableArea(renderer);
            area.name = getString("name", "ClickableArea");

            // Optional hitbox rectangle (local to parent top-left).
            // If width/height are omitted, defaults to parent's bounds.
            // Coordinates are in pixels in the new coordinate system.
            area.x = getFloat("x", 0);
            area.y = getFloat("y", 0);
            if (node.hasAttribute("width")) area.width = getFloat("width");
            if (node.hasAttribute("height")) area.height = getFloat("height");

            obj = area;
        }

        else if (tagName === "Text") {
            const textContent = getString("text", "New Text");
            const x = getFloat("x", 0);
            const y = getFloat("y", 0);
            // Accept both XML-style `fontSize` and common XAML-style `FontSize`
            const fontSize = getFloatAny(["fontSize", "FontSize"], 16);
            const fontFamily = getString("fontFamily", "Inter");
            const color = getString("color", "white");

            const textObj = new Text(renderer, textContent, x, y, fontSize, fontFamily, color);
            textObj.name = getString("name", "Text");

            // Optional: allow Text nodes to be clickable without requiring a non-self-closing tag.
            // Example:
            //   <Text name="Play" text="Play" x="..." y="..." clickable="true" />
            // This will create a ClickableArea child that defaults to the Text's bounds.
            const clickableAttr = node.getAttribute("clickable");
            const shouldAutoClickable = clickableAttr !== null && clickableAttr.toLowerCase() === "true";
            if (shouldAutoClickable) {
                // Avoid duplicating if a ClickableArea child is already declared.
                let hasClickableChild = false;
                for (const child of node.children) {
                    if (child.tagName === "ClickableArea") {
                        hasClickableChild = true;
                        break;
                    }
                }

                if (!hasClickableChild) {
                    const area = new ClickableArea(renderer);
                    area.name = getString("clickableName", `${textObj.name}_Hitbox`);
                    // width/height remain null so it inherits Text width/height like Sprites do.
                    textObj.addChild(area);
                }
            }

            obj = textObj;
        }

        else if (tagName === "Audio") {
            const srcRaw = getString("src");
            const src = SceneLoader._resolveSceneResourceUrl(srcRaw, baseUrl);
            const loop = getBool("loop", false);
            const volume = getFloat("volume", 1.0);
            const autoplay = getBool("autoplay", false);
            const stopOnSceneChange = getBool("stopOnSceneChange", true);

            const audio = new Audio();
            audio.name = getString("name");
            if (src) {
                // Track + await audio decoding so loading flows (e.g., splash) can wait.
                const p = audio.load(src);
                renderer?.trackAssetPromise?.(p);
                await p;
            }
            audio.loop = loop;
            audio.volume = volume;
            audio.stopOnSceneChange = stopOnSceneChange;
            audio.autoplay = autoplay; // Store autoplay flag for later use
            
            // Don't autoplay here - let the scene switching logic handle it
            // This prevents audio from playing when loading scenes that aren't active yet

            obj = audio;
        }

        else if (tagName === "Camera") {
            const x = getFloat("x", 0);
            const y = getFloat("y", 0);
            const zoom = getFloat("zoom", 1);
            const rotation = getFloat("rotation", 0);
            
            // Use renderer's target resolution as fallback if available, otherwise default to 1920x1080
            const defaultWidth = renderer ? renderer.targetWidth : 1920;
            const defaultHeight = renderer ? renderer.targetHeight : 1080;

            const width = getFloat("width", defaultWidth);
            const height = getFloat("height", defaultHeight);
            
            // Camera constructor: x, y, zoom, rotation, width, height
            const camera = new Camera(x, y, zoom, rotation, width, height);
            camera.name = getString("name");
            obj = camera;
        }

        else if (tagName === "Camera3D") {
            const cam = new Camera3D();
            cam.position.x = getFloatAny(["x", "posX"], cam.position.x);
            cam.position.y = getFloatAny(["y", "posY"], cam.position.y);
            cam.position.z = getFloatAny(["z", "posZ"], cam.position.z);

            const tx = getFloatAny(["targetX"], cam.target.x);
            const ty = getFloatAny(["targetY"], cam.target.y);
            const tz = getFloatAny(["targetZ"], cam.target.z);
            cam.target.x = tx;
            cam.target.y = ty;
            cam.target.z = tz;

            cam.fovY = getFloatAny(["fovY"], cam.fovY);
            cam.near = getFloatAny(["near"], cam.near);
            cam.far = getFloatAny(["far"], cam.far);

            cam._dirty = true;
            cam.name = getString("name", "Camera3D");
            obj = cam;
        }

        else if (tagName === "MeshNode") {
            const n = new MeshNode();
            n.name = getString("name", "MeshNode");

            // Transform
            n.x = getFloatAny(["x"], 0);
            n.y = getFloatAny(["y"], 0);
            n.z = getFloatAny(["z"], 0);

            n.scaleX = getFloatAny(["scaleX"], 1);
            n.scaleY = getFloatAny(["scaleY"], 1);
            n.scaleZ = getFloatAny(["scaleZ"], 1);

            // Rotation (radians)
            n.rotX = getFloatAny(["rotX", "rotationX"], 0);
            n.rotY = getFloatAny(["rotY", "rotationY"], 0);
            n.rotZ = getFloatAny(["rotZ", "rotationZ"], 0);

            // Source: primitive name (Sphere/Cube/Plane/etc.) or named mesh definition
            n.source = getString("source", getString("mesh", "Cube"));
            // Material reference by name: will be resolved by the loader pass.
            n.material = getString('material', getString('mat', ''));

            if (node.hasAttribute('color')) {
                n.color = this._parseColor(node.getAttribute('color'));
            }

            // Optional primitive parameters if using direct primitive source
            const params = this._parseMeshParams(node);
            if (Object.keys(params).length > 0) {
                n.meshDefinition = { type: n.source, color: n.color, params };
            }

            obj = n;
        }

        else if (tagName === "DirectionalLight") {
            const name = getString("name", "DirectionalLight");
            const intensity = getFloatAny(["intensity"], 1.0);
            const colorAttr = getString("color", "#ffffff");
            const c = this._parseColor(colorAttr);

            // direction="x,y,z" or dirX/dirY/dirZ
            const dirStr = node.getAttribute("direction");
            let dir = null;
            if (dirStr && dirStr.includes(",")) {
                const parts = dirStr.split(",").map(s => parseFloat(s.trim())).filter(v => !Number.isNaN(v));
                if (parts.length >= 3) dir = [parts[0], parts[1], parts[2]];
            }
            if (!dir) {
                const dx = getFloatAny(["dirX", "directionX", "dx"], 0.5);
                const dy = getFloatAny(["dirY", "directionY", "dy"], -1.0);
                const dz = getFloatAny(["dirZ", "directionZ", "dz"], 0.3);
                dir = [dx, dy, dz];
            }

            const light = new DirectionalLight({
                name,
                direction: dir,
                color: [c[0], c[1], c[2]],
                intensity,
            });
            obj = light;
        }

        else if (tagName === "PointLight") {
            const name = getString("name", "PointLight");
            const intensity = getFloatAny(["intensity"], 50.0);
            const range = getFloatAny(["range"], 0.0);
            const colorAttr = getString("color", "#ffffff");
            const c = this._parseColor(colorAttr);

            const px = getFloatAny(["x", "posX"], 0.0);
            const py = getFloatAny(["y", "posY"], 2.0);
            const pz = getFloatAny(["z", "posZ"], 0.0);

            const light = new PointLight({
                name,
                position: [px, py, pz],
                color: [c[0], c[1], c[2]],
                intensity,
                range,
            });
            obj = light;
        }

        else if (tagName === "SpotLight") {
            const name = getString("name", "SpotLight");
            const intensity = getFloatAny(["intensity"], 80.0);
            const range = getFloatAny(["range"], 0.0);
            const innerAngleDeg = getFloatAny(["innerAngle", "innerAngleDeg"], 18.0);
            const outerAngleDeg = getFloatAny(["outerAngle", "outerAngleDeg"], 28.0);
            const colorAttr = getString("color", "#ffffff");
            const c = this._parseColor(colorAttr);

            const px = getFloatAny(["x", "posX"], 0.0);
            const py = getFloatAny(["y", "posY"], 2.0);
            const pz = getFloatAny(["z", "posZ"], 0.0);

            const dirStr = node.getAttribute("direction");
            let dir = null;
            if (dirStr && dirStr.includes(",")) {
                const parts = dirStr.split(",").map(s => parseFloat(s.trim())).filter(v => !Number.isNaN(v));
                if (parts.length >= 3) dir = [parts[0], parts[1], parts[2]];
            }
            if (!dir) {
                const dx = getFloatAny(["dirX", "directionX", "dx"], 0.0);
                const dy = getFloatAny(["dirY", "directionY", "dy"], -1.0);
                const dz = getFloatAny(["dirZ", "directionZ", "dz"], 0.0);
                dir = [dx, dy, dz];
            }

            const light = new SpotLight({
                name,
                position: [px, py, pz],
                direction: dir,
                color: [c[0], c[1], c[2]],
                intensity,
                range,
                innerAngleDeg,
                outerAngleDeg,
            });
            obj = light;
        }

        // Common properties
        if (obj) {
            if (node.hasAttribute("opacity")) {
                const opacity = parseFloat(node.getAttribute("opacity"));
                if (typeof obj.setTransparency === 'function') {
                    obj.setTransparency(opacity);
                }
            }

            if (node.hasAttribute("layer")) {
                const layer = parseFloat(node.getAttribute("layer"));
                if (typeof obj.setLayer === 'function') {
                    obj.setLayer(layer);
                } else {
                    obj.layer = layer;
                }
            }

            const activeAttr = node.getAttribute("Active");
            if (activeAttr !== null) {
                obj.active = activeAttr !== "false";
            }

            const followCameraAttr = node.getAttribute("followCamera");
            if (followCameraAttr !== null && obj.hasOwnProperty('followCamera')) {
                obj.followCamera = followCameraAttr === "true";
                // If following camera, the initial x/y from XML are treated as the relative base positions
                if (obj.followCamera) {
                    obj.baseX = obj.x;
                    obj.baseY = obj.y;
                }
            }
        }

        // Handle children
        if (obj && obj.addChild) {
             for (const childNode of node.children) {
                 if (childNode.tagName === "Animation") continue;
                 const childObj = await this.parseObject(childNode, renderer, baseUrl);
                 if (childObj) {
                     obj.addChild(childObj);
                 }
             }
        }

        return obj;
    }

    /**
     * Parses a Skybox element from XAML.
     * Supports:
     * - Solid color: <Skybox color="#RRGGBB" /> or <Skybox color="r,g,b" />
     * - Cubemap: <Skybox right="..." left="..." top="..." bottom="..." front="..." back="..." />
     * - Equirectangular: <Skybox source="..." equirectangular="true" />
     * @param {Element} node - The XML element.
     * @param {Object} renderer - The renderer instance.
     * @param {string} baseUrl - Base URL for resolving relative paths.
     * @returns {Promise<Skybox|null>} The parsed skybox, or null if invalid.
     */
    static async parseSkybox(node, renderer, baseUrl) {
        if (!renderer || !renderer.gl) {
            console.warn('Skybox requires a renderer with WebGL context');
            return null;
        }

        const getString = (name, def = "") => node.getAttribute(name) || def;
        const getBool = (name, def = false) => node.getAttribute(name) === "true";

        // Check for solid color
        const colorAttr = getString("color");
        if (colorAttr) {
            const color = this._parseColor(colorAttr);
            return new Skybox(renderer.gl, color);
        }

        // Check for equirectangular
        const isEquirectangular = getBool("equirectangular", false);
        const source = getString("source");
        if (source) {
            // Resolve relative to scene URL
            let base;
            try {
                base = new URL('.', baseUrl).toString();
            } catch (e) {
                base = (typeof document !== 'undefined' && document.baseURI) ? document.baseURI : (typeof window !== 'undefined' ? window.location.href : '');
            }
            const sourceUrl = new URL(source, base).toString();
            return new Skybox(renderer.gl, sourceUrl, isEquirectangular);
        }

        // Check for cubemap (6 separate face images)
        const right = getString("right");
        const left = getString("left");
        const top = getString("top");
        const bottom = getString("bottom");
        const front = getString("front");
        const back = getString("back");

        if (right && left && top && bottom && front && back) {
            // Resolve relative to scene URL
            let base;
            try {
                base = new URL('.', baseUrl).toString();
            } catch (e) {
                base = (typeof document !== 'undefined' && document.baseURI) ? document.baseURI : (typeof window !== 'undefined' ? window.location.href : '');
            }

            const faces = [right, left, top, bottom, front, back].map(face => {
                try {
                    return new URL(face, base).toString();
                } catch (e) {
                    return face; // Return as-is if URL parsing fails
                }
            });

            return new Skybox(renderer.gl, faces);
        }

        console.warn('Skybox element missing required attributes. Use color, source, or all 6 face attributes (right, left, top, bottom, front, back).');
        return null;
    }
}
