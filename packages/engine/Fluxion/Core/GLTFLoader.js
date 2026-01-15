/**
 * GLTF loader integration for Fluxion-Js.
 * Converts GLTF models to Fluxion Mesh objects.
 * 
 * Requires: minimal-gltf-loader.js from third-party folder
 */

import Mesh from './Mesh.js';
import Material from './Material.js';
import MeshNode from './MeshNode.js';
import { Mat4, Vector3 } from './Math3D.js';

/**
 * Load a GLTF file and convert it to Fluxion meshes.
 * @param {string} url - URL to the .gltf file
 * @param {WebGLRenderingContext|WebGL2RenderingContext} gl - WebGL context
 * @param {Object} renderer - Renderer instance (for texture loading)
 * @returns {Promise<{meshes: Map<string, Mesh>, materials: Map<string, Material>, nodes: Array}>}
 */
export async function loadGLTF(url, gl, renderer) {
    return new Promise(async (resolve, reject) => {
        try {
            if (typeof url === 'string' && url.toLowerCase().endsWith('.glb')) {
                reject(new Error('GLB (.glb) is not supported by the current minimal-gltf-loader integration. Please export as .gltf (JSON) + .bin + images, or switch to a GLB-capable loader.'));
                return;
            }
            let glTFLoader;
            
            // Check if loader is already available globally
            if (typeof MinimalGLTFLoader !== 'undefined' && MinimalGLTFLoader.glTFLoader) {
                glTFLoader = new MinimalGLTFLoader.glTFLoader(gl);
            } else {
                // Try to dynamically import the loader
                // Note: This requires gl-matrix to be available as a module
                // The user should add an import map or install gl-matrix
                try {
                    // Use import with a relative path - the browser will handle URL encoding
                    const loaderPath = new URL('../../../../third-party/minimal-gltf-loader.js', import.meta.url).href;
                    const module = await import(loaderPath);
                    if (module.glTFLoader) {
                        glTFLoader = new module.glTFLoader(gl);
                    } else {
                        throw new Error('GLTF loader module loaded but glTFLoader not found');
                    }
                } catch (importErr) {
                    // If import fails, check if it's a gl-matrix issue
                    if (importErr.message.includes('gl-matrix') || importErr.message.includes('Failed to resolve')) {
                        reject(new Error(
                            'GLTF loader requires gl-matrix. Please add this to your HTML:\n' +
                            '<script type="importmap">{"imports":{"gl-matrix":"https://cdn.jsdelivr.net/npm/gl-matrix@3.4.3/+esm"}}</script>\n' +
                            'Or install gl-matrix: npm install gl-matrix'
                        ));
                        return;
                    }
                    throw importErr;
                }
            }
            
            // The URL should already be resolved to an absolute URL by SceneLoader
            // But if it's still relative, resolve it relative to the current page
            // The GLTF loader needs absolute URLs to correctly resolve .bin files relative to the .gltf file
            let resolvedUrl = url;
            if (url && !url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('data:') && !url.startsWith('file://')) {
                // Resolve relative to current page as fallback
                try {
                    resolvedUrl = new URL(url, window.location.href).href;
                } catch (e) {
                    // If URL construction fails, use as-is
                    resolvedUrl = url;
                }
            }
            
            _loadGLTF(glTFLoader, resolvedUrl, gl, renderer, resolve, reject);
        } catch (err) {
            reject(new Error(`Failed to load GLTF: ${err.message}`));
        }
    });
}

function _loadGLTF(glTFLoader, url, gl, renderer, resolve, reject) {
    // Add error handling for buffer loading failures
    const originalOnload = glTFLoader.onload;
    glTFLoader.loadGLTF(url, (glTF) => {
        try {
            // Attach source URL so texture cache keys can be namespaced per model.
            // (Otherwise multiple models with texture index 0 collide.)
            try {
                glTF.__fluxionSourceUrl = url;
            } catch {
                // ignore
            }
            // Check if buffers loaded successfully
            if (glTFLoader._bufferRequested > 0 && glTFLoader._bufferLoaded < glTFLoader._bufferRequested) {
                console.warn(`GLTF: Some buffers failed to load. Requested: ${glTFLoader._bufferRequested}, Loaded: ${glTFLoader._bufferLoaded}`);
            }
            
            const result = convertGLTFToFluxion(glTF, gl, renderer);

            // Optional: emit a metadata file in Electron builds.
            // Uses the existing preload IPC hook (saved under Electron userData/Debug).
            try {
                _maybeWriteGLTFMetadataFile(url, glTF, result);
            } catch (e) {
                console.warn('GLTF: Failed to write metadata file', e);
            }

            resolve(result);
        } catch (err) {
            reject(new Error(`Failed to convert GLTF: ${err.message}`));
        }
    });
    
    // Note: The minimal-gltf-loader handles .bin file loading automatically
    // It extracts the base URI from the GLTF file path and loads all buffers
    // referenced in the JSON. No additional code needed here.
}

function _getGLTFTextureCacheNamespace(glTF) {
    const u = glTF && (glTF.__fluxionSourceUrl || glTF._sourceUrl);
    if (!u) return 'gltf';
    return `gltf@${String(u)}`;
}

function _safeNumber(n, fallback = 0) {
    const v = Number(n);
    return Number.isFinite(v) ? v : fallback;
}

function _pickFileStemFromUrl(url) {
    try {
        const u = new URL(url, (typeof window !== 'undefined' ? window.location.href : undefined));
        const parts = decodeURIComponent(u.pathname).split('/').filter(Boolean);
        const file = parts.length ? parts[parts.length - 1] : 'model.gltf';
        return file.replace(/\.[^/.]+$/, '');
    } catch {
        const s = String(url || 'model.gltf');
        const last = s.split('/').pop() || s;
        return last.replace(/\.[^/.]+$/, '');
    }
}

function _fileUrlToAbsolutePath(sourceUrl) {
    try {
        const u = new URL(sourceUrl, (typeof window !== 'undefined' ? window.location.href : undefined));
        if (u.protocol !== 'file:') return null;

        // URL pathname is forward-slash separated; decode percent-escapes.
        let p = decodeURIComponent(u.pathname || '');

        // Windows file URLs look like: /C:/path/to/file
        if (p.startsWith('/') && /^[A-Za-z]:\//.test(p.slice(1))) {
            p = p.slice(1);
        }

        return p;
    } catch {
        return null;
    }
}

function _dirnameFromPath(p) {
    const s = String(p || '');
    const i = s.lastIndexOf('/');
    if (i <= 0) return '';
    return s.slice(0, i);
}

function _buildGLTFMetadata(sourceUrl, glTF, converted) {
    const meshes = converted?.meshes;
    const materials = converted?.materials;
    const nodes = converted?.nodes;

    const meshList = [];
    if (meshes && typeof meshes.forEach === 'function') {
        meshes.forEach((mesh, key) => {
            if (!mesh) return;
            meshList.push({
                key,
                vertexCount: _safeNumber(mesh.vertexCount, 0),
                indexCount: _safeNumber(mesh.indexCount, 0),
                indexed: !!(mesh.indices && mesh.indexCount > 0),
            });
        });
    }

    const materialList = [];
    if (materials && typeof materials.forEach === 'function') {
        materials.forEach((mat, key) => {
            if (!mat) return;
            materialList.push({
                key,
                baseColorFactor: Array.isArray(mat.baseColorFactor) ? mat.baseColorFactor.slice(0, 4) : undefined,
                metallicFactor: _safeNumber(mat.metallicFactor, 0),
                roughnessFactor: _safeNumber(mat.roughnessFactor, 1),
                emissiveFactor: Array.isArray(mat.emissiveFactor) ? mat.emissiveFactor.slice(0, 3) : undefined,
                alphaMode: mat.alphaMode || 'OPAQUE',
                alphaCutoff: _safeNumber(mat.alphaCutoff, 0.5),
                metallicRoughnessPacked: !!mat.metallicRoughnessPacked,
                textures: {
                    baseColor: !!mat.baseColorTexture,
                    normal: !!mat.normalTexture,
                    metallic: !!mat.metallicTexture,
                    roughness: !!mat.roughnessTexture,
                    ao: !!mat.aoTexture,
                    emissive: !!mat.emissiveTexture,
                    alpha: !!mat.alphaTexture,
                },
            });
        });
    }

    const totalVerts = meshList.reduce((a, m) => a + (m.vertexCount | 0), 0);
    const totalIdx = meshList.reduce((a, m) => a + (m.indexCount | 0), 0);

    return {
        type: 'gltf-metadata',
        version: 1,
        sourceUrl: String(sourceUrl || ''),
        timestamp: new Date().toISOString(),

        gltf: {
            asset: glTF?.asset || null,
            sceneCount: Array.isArray(glTF?.scenes) ? glTF.scenes.length : 0,
            nodeCount: Array.isArray(glTF?.nodes) ? glTF.nodes.length : 0,
            meshCount: Array.isArray(glTF?.meshes) ? glTF.meshes.length : 0,
            materialCount: Array.isArray(glTF?.materials) ? glTF.materials.length : 0,
            imageCount: Array.isArray(glTF?.images) ? glTF.images.length : 0,
            textureCount: Array.isArray(glTF?.textures) ? glTF.textures.length : 0,
            bufferCount: Array.isArray(glTF?.buffers) ? glTF.buffers.length : 0,
            bufferViewCount: Array.isArray(glTF?.bufferViews) ? glTF.bufferViews.length : 0,
            accessorCount: Array.isArray(glTF?.accessors) ? glTF.accessors.length : 0,
        },

        fluxion: {
            meshEntries: meshList.length,
            materialEntries: materialList.length,
            nodeEntries: Array.isArray(nodes) ? nodes.length : 0,
            totalVertices: totalVerts,
            totalIndices: totalIdx,
            meshes: meshList,
            materials: materialList,
        },
    };
}

function _maybeWriteGLTFMetadataFile(sourceUrl, glTF, converted) {
    // Only possible in the Electron app (preload exposes `window.electronAPI`).
    const api = (typeof window !== 'undefined') ? window.electronAPI : null;
    if (!api) return;

    const meta = _buildGLTFMetadata(sourceUrl, glTF, converted);
    const stem = _pickFileStemFromUrl(sourceUrl);

    // Prefer writing next to the .gltf when we have a local file URL and the IPC hook.
    const absGltfPath = _fileUrlToAbsolutePath(sourceUrl);
    if (absGltfPath && typeof api.saveProjectFile === 'function') {
        const dir = _dirnameFromPath(absGltfPath);
        const outPath = `${dir}/${stem}.metadata.json`;
        api.saveProjectFile(outPath, JSON.stringify(meta, null, 2))
            .then((res) => {
                if (res && res.ok) {
                    console.log('GLTF: Metadata saved next to model:', res.path || outPath);
                } else {
                    console.warn('GLTF: Failed to save metadata next to model; falling back to Debug.', res?.error);
                    if (typeof api.saveDebugFile === 'function') {
                        const filename = `GLTF/${stem}.metadata.json`;
                        api.saveDebugFile(filename, JSON.stringify(meta, null, 2));
                        console.log('GLTF: Metadata saved (Debug):', filename);
                    }
                }
            })
            .catch((e) => {
                console.warn('GLTF: saveProjectFile threw; falling back to Debug.', e);
                if (typeof api.saveDebugFile === 'function') {
                    const filename = `GLTF/${stem}.metadata.json`;
                    api.saveDebugFile(filename, JSON.stringify(meta, null, 2));
                    console.log('GLTF: Metadata saved (Debug):', filename);
                }
            });
        return;
    }

    // Fallback: Debug folder
    if (typeof api.saveDebugFile === 'function') {
        const filename = `GLTF/${stem}.metadata.json`;
        api.saveDebugFile(filename, JSON.stringify(meta, null, 2));
        console.log('GLTF: Metadata saved (Debug):', filename);
    }
}

/**
 * Convert a loaded GLTF model to Fluxion meshes and materials.
 * @param {Object} glTF - The loaded GLTF object from minimal-gltf-loader
 * @param {WebGLRenderingContext|WebGL2RenderingContext} gl - WebGL context
 * @param {Object} renderer - Renderer instance
 * @returns {{meshes: Map<string, Mesh>, materials: Map<string, Material>, nodes: Array}}
 */
export function convertGLTFToFluxion(glTF, gl, renderer) {
    const meshes = new Map();
    const materials = new Map();
    const nodes = [];
    const meshMaterials = new Map();

    // Always have a fallback material for primitives that don't specify one.
    // (Some exporters omit materials entirely; Fluxion still needs something to bind.)
    if (!materials.has('__gltf_default__')) {
        materials.set('__gltf_default__', new Material());
    }

    // Convert materials
    if (glTF.materials) {
        for (let i = 0; i < glTF.materials.length; i++) {
            const gltfMat = glTF.materials[i];
            const mat = convertGLTFMaterial(glTF, gltfMat, renderer);
            const name = gltfMat.name || `Material_${i}`;
            materials.set(name, mat);
        }
    }

    // Convert meshes
    if (glTF.meshes) {
        for (let i = 0; i < glTF.meshes.length; i++) {
            const gltfMesh = glTF.meshes[i];
            const fluxionMeshes = convertGLTFMesh(gltfMesh, glTF, gl);
            const baseName = gltfMesh.name || `Mesh_${i}`;

            // Record default material per primitive mesh key so scene mesh resources can auto-assign.
            const primCount = Array.isArray(gltfMesh.primitives) ? gltfMesh.primitives.length : 0;
            for (let pIdx = 0; pIdx < primCount; pIdx++) {
                const key = (fluxionMeshes.length === 1) ? baseName : `${baseName}_Primitive_${pIdx}`;
                const prim = gltfMesh.primitives[pIdx];
                const primMat = (prim && Object.prototype.hasOwnProperty.call(prim, 'material')) ? prim.material : null;

                // minimal-gltf-loader variants may store primitive.material as:
                // - a Material object, OR
                // - a numeric material index
                let gltfMat = primMat;
                let gltfMatIndex = -1;
                if (typeof primMat === 'number' && Number.isFinite(primMat)) {
                    gltfMatIndex = primMat | 0;
                    gltfMat = Array.isArray(glTF.materials) ? (glTF.materials[gltfMatIndex] || null) : null;
                } else if (primMat && Array.isArray(glTF.materials)) {
                    gltfMatIndex = glTF.materials.indexOf(primMat);
                }

                let matKey = '__gltf_default__';
                if (gltfMat) {
                    const named = gltfMat.name;
                    if (named && materials.has(named)) {
                        matKey = named;
                    } else if (gltfMatIndex >= 0) {
                        const fallback = `Material_${gltfMatIndex}`;
                        if (materials.has(fallback)) matKey = fallback;
                    }
                } else if (gltfMatIndex >= 0) {
                    const fallback = `Material_${gltfMatIndex}`;
                    if (materials.has(fallback)) matKey = fallback;
                }
                meshMaterials.set(key, matKey);
            }
            
            // If mesh has multiple primitives, create multiple meshes
            if (fluxionMeshes.length === 1) {
                meshes.set(baseName, fluxionMeshes[0]);
            } else {
                fluxionMeshes.forEach((mesh, idx) => {
                    const name = fluxionMeshes.length > 1 ? `${baseName}_Primitive_${idx}` : baseName;
                    meshes.set(name, mesh);
                });
            }
        }
    }

    // Convert scene nodes to MeshNodes.
    // NOTE: Fluxion's MeshNode does not currently inherit parent transforms when drawing children,
    // so we compute WORLD transforms here by traversing the glTF scene graph.
    // Process all scenes (not just the first one)
    if (glTF.scenes && glTF.scenes.length > 0) {
        for (let sceneIdx = 0; sceneIdx < glTF.scenes.length; sceneIdx++) {
            const scene = glTF.scenes[sceneIdx];
            if (scene.nodes) {
                const identity = Mat4.identity();
                for (const nodeId of scene.nodes) {
                    const node = glTF.nodes[nodeId];
                    if (!node) continue;
                    // Prefix node names with scene name to avoid collisions across scenes
                    const scenePrefix = glTF.scenes.length > 1 && scene.name ? `${scene.name}_` : '';
                    _convertGLTFNodeRecursive(node, glTF, meshes, materials, identity, nodes, scenePrefix);
                }
            }
        }
    }

    return { meshes, materials, nodes, meshMaterials };
}

function _clamp(x, a, b) { return Math.min(b, Math.max(a, x)); }

function _decomposeMat4TRSEuler(m) {
    // Column-major mat4.
    const tx = m[12], ty = m[13], tz = m[14];

    const sx = Math.hypot(m[0], m[1], m[2]);
    const sy = Math.hypot(m[4], m[5], m[6]);
    const sz = Math.hypot(m[8], m[9], m[10]);

    const invSx = sx > 1e-8 ? 1.0 / sx : 1.0;
    const invSy = sy > 1e-8 ? 1.0 / sy : 1.0;
    const invSz = sz > 1e-8 ? 1.0 / sz : 1.0;

    // Normalized rotation matrix columns
    const c0x = m[0] * invSx, c0y = m[1] * invSx, c0z = m[2] * invSx;
    const c1x = m[4] * invSy, c1y = m[5] * invSy, c1z = m[6] * invSy;
    const c2x = m[8] * invSz, c2y = m[9] * invSz, c2z = m[10] * invSz;

    // Convert to row-major entries for formulas (R = Rz * Ry * Rx)
    const R00 = c0x, R01 = c1x, R02 = c2x;
    const R10 = c0y, R11 = c1y, R12 = c2y;
    const R20 = c0z, R21 = c1z, R22 = c2z;

    // Extract Euler angles matching MeshNode composition: T * Rz * Ry * Rx * S
    const y = Math.asin(_clamp(-R20, -1.0, 1.0));
    const cy = Math.cos(y);
    let x = 0.0;
    let z = 0.0;
    if (Math.abs(cy) > 1e-6) {
        x = Math.atan2(R21, R22);
        z = Math.atan2(R10, R00);
    } else {
        // Gimbal lock
        x = Math.atan2(-R12, R11);
        z = 0.0;
    }

    return {
        position: [tx, ty, tz],
        rotation: [x, y, z],
        scale: [sx, sy, sz]
    };
}

function _composeGltfTRSMatrix(node) {
    const tArr = Array.isArray(node?.translation) ? node.translation : null;
    const rArr = Array.isArray(node?.rotation) ? node.rotation : null;
    const sArr = Array.isArray(node?.scale) ? node.scale : null;

    const tx = Number(tArr?.[0] ?? 0);
    const ty = Number(tArr?.[1] ?? 0);
    const tz = Number(tArr?.[2] ?? 0);

    // glTF rotation is a unit quaternion [x,y,z,w]
    const qx = Number(rArr?.[0] ?? 0);
    const qy = Number(rArr?.[1] ?? 0);
    const qz = Number(rArr?.[2] ?? 0);
    const qw = Number(rArr?.[3] ?? 1);

    const sx = Number(sArr?.[0] ?? 1);
    const sy = Number(sArr?.[1] ?? 1);
    const sz = Number(sArr?.[2] ?? 1);

    // Quaternion to 3x3 rotation (column-major), then apply scale on columns.
    const x2 = qx + qx;
    const y2 = qy + qy;
    const z2 = qz + qz;

    const xx = qx * x2;
    const xy = qx * y2;
    const xz = qx * z2;
    const yy = qy * y2;
    const yz = qy * z2;
    const zz = qz * z2;
    const wx = qw * x2;
    const wy = qw * y2;
    const wz = qw * z2;

    // Rotation matrix (row-major here for readability):
    // [ 1-(yy+zz) , xy+wz     , xz-wy     ]
    // [ xy-wz     , 1-(xx+zz) , yz+wx     ]
    // [ xz+wy     , yz-wx     , 1-(xx+yy) ]
    const r00 = 1 - (yy + zz);
    const r01 = xy + wz;
    const r02 = xz - wy;
    const r10 = xy - wz;
    const r11 = 1 - (xx + zz);
    const r12 = yz + wx;
    const r20 = xz + wy;
    const r21 = yz - wx;
    const r22 = 1 - (xx + yy);

    // Column-major mat4, with scale baked in.
    const out = Mat4.identity();
    // Column 0
    out[0] = r00 * sx;
    out[1] = r10 * sx;
    out[2] = r20 * sx;
    // Column 1
    out[4] = r01 * sy;
    out[5] = r11 * sy;
    out[6] = r21 * sy;
    // Column 2
    out[8] = r02 * sz;
    out[9] = r12 * sz;
    out[10] = r22 * sz;
    // Translation
    out[12] = tx;
    out[13] = ty;
    out[14] = tz;
    return out;
}

function _convertGLTFNodeRecursive(gltfNode, glTF, meshes, materials, parentWorld, outNodes, scenePrefix = '') {
    const local = gltfNode.matrix ? gltfNode.matrix : _composeGltfTRSMatrix(gltfNode);
    const world = Mat4.multiply(parentWorld, local, new Float32Array(16));

    // If this node has a mesh, create one MeshNode per primitive mesh key.
    if (gltfNode.mesh) {
        const gltfMesh = glTF.meshes[gltfNode.mesh.meshID];
        if (gltfMesh) {
            const baseName = gltfMesh.name || `Mesh_${gltfNode.mesh.meshID}`;
            const meshKeys = Array.from(meshes.keys()).filter(k => k === baseName || k.startsWith(`${baseName}_Primitive_`));

            const trs = _decomposeMat4TRSEuler(world);
            for (const meshKey of meshKeys) {
                const meshObj = meshes.get(meshKey);
                if (!meshObj) continue;

                const meshNode = new MeshNode();
                meshNode.name = `${scenePrefix}${gltfNode.name || meshKey}`;
                meshNode.x = trs.position[0];
                meshNode.y = trs.position[1];
                meshNode.z = trs.position[2];
                meshNode.scaleX = trs.scale[0];
                meshNode.scaleY = trs.scale[1];
                meshNode.scaleZ = trs.scale[2];
                meshNode.rotX = trs.rotation[0];
                meshNode.rotY = trs.rotation[1];
                meshNode.rotZ = trs.rotation[2];

                // IMPORTANT: store the actual mesh object (MeshNode expects def.mesh).
                meshNode.setMeshDefinition({ type: 'gltf', mesh: meshObj });

                // Pick the correct glTF primitive material for this meshKey
                let primIndex = 0;
                const m = /_Primitive_(\d+)$/.exec(meshKey);
                if (m) primIndex = parseInt(m[1], 10) || 0;

                const prim = (gltfMesh.primitives && gltfMesh.primitives[primIndex]) ? gltfMesh.primitives[primIndex] : (gltfMesh.primitives ? gltfMesh.primitives[0] : null);
                const gltfMat = prim?.material || null;
                if (gltfMat) {
                    const matName = gltfMat.name || `Material_${glTF.materials ? glTF.materials.indexOf(gltfMat) : 0}`;
                    const mat = materials.get(matName) || null;
                    if (mat) {
                        meshNode.setMaterial(mat);
                    } else {
                        // Shouldn't normally happen, but keep imports resilient.
                        meshNode.setMaterial(materials.get('__gltf_default__'));
                    }
                } else {
                    meshNode.setMaterial(materials.get('__gltf_default__'));
                }

                outNodes.push(meshNode);
            }
        }
    }

    // Recurse children
    if (gltfNode.children) {
        for (const child of gltfNode.children) {
            if (!child) continue;
            _convertGLTFNodeRecursive(child, glTF, meshes, materials, world, outNodes, scenePrefix);
        }
    }
}

/**
 * Convert a GLTF mesh to Fluxion Mesh objects.
 * @param {Object} gltfMesh - GLTF mesh object
 * @param {Object} glTF - Full GLTF object (needed to resolve index accessor IDs)
 * @param {WebGLRenderingContext|WebGL2RenderingContext} gl - WebGL context
 * @returns {Array<Mesh>} Array of Fluxion Mesh objects (one per primitive)
 */
function convertGLTFMesh(gltfMesh, glTF, gl) {
    const fluxionMeshes = [];

    if (!gltfMesh.primitives || gltfMesh.primitives.length === 0) {
        console.warn('GLTF: Mesh has no primitives', gltfMesh.name);
        return fluxionMeshes;
    }

    for (const primitive of gltfMesh.primitives) {
        // Get accessors
        const positionAccessor = primitive.attributes.POSITION;
        const normalAccessor = primitive.attributes.NORMAL;
        const tangentAccessor = primitive.attributes.TANGENT;
        const colorAccessor = primitive.attributes.COLOR_0 || primitive.attributes.COLOR;
        const texCoordAccessor = primitive.attributes.TEXCOORD_0 || primitive.attributes.TEXCOORD;
        const jointsAccessor = primitive.attributes.JOINTS_0 || primitive.attributes.JOINTS;
        const weightsAccessor = primitive.attributes.WEIGHTS_0 || primitive.attributes.WEIGHTS;
        
        // Log missing required attributes (NORMAL, TEXCOORD_0 are required by PBR shader)
        const missingAttribs = [];
        if (!normalAccessor) missingAttribs.push('NORMAL');
        if (!texCoordAccessor) missingAttribs.push('TEXCOORD_0');
        if (missingAttribs.length > 0) {
            console.warn(`GLTF primitive missing required attributes: [${missingAttribs.join(', ')}]. Safe defaults will be injected.`, {
                mesh: gltfMesh.name,
                defaults: {
                    NORMAL: '[0,1,0] (up vector)',
                    TEXCOORD_0: '[0,0] (origin)'
                }
            });
        }
        // minimal-gltf-loader keeps `primitive.indices` as an accessor ID (number)
        // and only hooks up attributes to accessor objects.
        const indicesRef = primitive.indices;
        const indicesAccessor = (typeof indicesRef === 'number')
            ? (glTF?.accessors ? glTF.accessors[indicesRef] : null)
            : indicesRef;

        if (!positionAccessor) {
            console.warn('GLTF primitive missing POSITION attribute, skipping');
            continue;
        }

        // Get vertex data - use accessor's data directly if available
        // The GLTF loader should have already processed the accessor data
        const positionData = _extractAccessorData(positionAccessor);
        if (!positionData || positionData.length === 0) {
            console.error('GLTF: Failed to extract position data from accessor', {
                accessor: positionAccessor,
                bufferView: positionAccessor?.bufferView,
                hasData: !!positionAccessor?.bufferView?.data
            });
            continue;
        }
        const normalData = normalAccessor ? _extractAccessorData(normalAccessor) : null;
        const tangentData = tangentAccessor ? _extractAccessorData(tangentAccessor) : null;
        const colorData = colorAccessor ? _extractAccessorData(colorAccessor) : null;
        const texCoordData = texCoordAccessor ? _extractAccessorData(texCoordAccessor) : null;
        const jointsData = jointsAccessor ? _extractAccessorData(jointsAccessor) : null;
        const weightsData = weightsAccessor ? _extractAccessorData(weightsAccessor) : null;
        const indicesData = indicesAccessor ? _extractAccessorData(indicesAccessor) : null;
        
        // Get vertex count to document fallbacks
        const vertexCount = positionAccessor.count;
        
        // Document attribute extraction status
        if (!normalData) {
            console.log(`GLTF: NORMAL attribute missing, using default [0,1,0] for ${vertexCount} vertices`);
        }
        if (!texCoordData) {
            console.log(`GLTF: TEXCOORD_0 attribute missing, using default [0,0] for ${vertexCount} vertices`);
        }

        // Convert to interleaved format: [x,y,z, nx,ny,nz, u,v, <optional attributes>]
        // Base layout (ALWAYS present, required by PBR shader):
        //   - position (3 floats): vec3 at location 0
        //   - normal   (3 floats): vec3 at location 1 - defaults to [0,1,0] if missing
        //   - uv       (2 floats): vec2 at location 2 - defaults to [0,0] if missing
        // Optional extended attributes (included only if present in GLTF):
        //   - tangent  (4 floats): vec4 at location 3
        //   - color    (4 floats): vec4 at location 4
        //   - joints   (4 floats): vec4 at location 5
        //   - weights  (4 floats): vec4 at location 6
        
        // Determine vertex stride based on what's available
        let vertexStride = 8; // base: position (3) + normal (3) + uv (2) - ALWAYS present
        if (tangentData) vertexStride += 4;
        if (colorData) vertexStride += 4;
        if (jointsData) vertexStride += 4;
        if (weightsData) vertexStride += 4;
        
        const vertices = new Float32Array(vertexCount * vertexStride);

        for (let i = 0; i < vertexCount; i++) {
            const posIdx = i * 3;
            const normIdx = i * 3;
            const tanIdx = i * 4;
            const colIdx = i * 4;
            const uvIdx = i * 2;
            const jointIdx = i * 4;
            const weightIdx = i * 4;
            let vertIdx = i * vertexStride;

            // Position
            vertices[vertIdx + 0] = positionData[posIdx + 0] || 0;
            vertices[vertIdx + 1] = positionData[posIdx + 1] || 0;
            vertices[vertIdx + 2] = positionData[posIdx + 2] || 0;
            vertIdx += 3;

            // Normal (REQUIRED by shader, default to [0,1,0] up vector if missing)
            // Safe default: vertical normal prevents lighting issues
            if (normalData && normalData.length > normIdx + 2) {
                vertices[vertIdx + 0] = normalData[normIdx + 0] || 0;
                vertices[vertIdx + 1] = normalData[normIdx + 1] || 1;
                vertices[vertIdx + 2] = normalData[normIdx + 2] || 0;
            } else {
                // FALLBACK: No NORMAL data in GLTF
                vertices[vertIdx + 0] = 0;
                vertices[vertIdx + 1] = 1;
                vertices[vertIdx + 2] = 0;
            }
            vertIdx += 3;

            // UV/TexCoord (REQUIRED by shader, default to [0,0] origin if missing)
            // Safe default: origin coordinates prevent texture sampling errors
            if (texCoordData && texCoordData.length > uvIdx + 1) {
                vertices[vertIdx + 0] = texCoordData[uvIdx + 0] || 0;
                vertices[vertIdx + 1] = texCoordData[uvIdx + 1] || 0;
            } else {
                // FALLBACK: No TEXCOORD_0 data in GLTF
                vertices[vertIdx + 0] = 0;
                vertices[vertIdx + 1] = 0;
            }
            vertIdx += 2;

            // Tangent (OPTIONAL, only included if GLTF provides it)
            // NOTE: TANGENT is currently not used by the shader (normal mapping uses screen-space derivatives)
            // If TANGENT is present in GLTF, we include it in the vertex buffer for future shader support
            if (tangentData) {
                if (tangentData.length > tanIdx + 3) {
                    vertices[vertIdx + 0] = tangentData[tanIdx + 0] || 1;
                    vertices[vertIdx + 1] = tangentData[tanIdx + 1] || 0;
                    vertices[vertIdx + 2] = tangentData[tanIdx + 2] || 0;
                    vertices[vertIdx + 3] = tangentData[tanIdx + 3] || 1; // tangent.w indicates handedness
                } else {
                    // FALLBACK: TANGENT accessor exists but data is incomplete
                    vertices[vertIdx + 0] = 1;  // X-axis tangent
                    vertices[vertIdx + 1] = 0;
                    vertices[vertIdx + 2] = 0;
                    vertices[vertIdx + 3] = 1;  // right-handed
                }
                vertIdx += 4;
            }

            // Vertex Color (default to [1,1,1,1] if missing but requested)
            if (colorData) {
                if (colorData.length > colIdx + 3) {
                    vertices[vertIdx + 0] = colorData[colIdx + 0] || 1;
                    vertices[vertIdx + 1] = colorData[colIdx + 1] || 1;
                    vertices[vertIdx + 2] = colorData[colIdx + 2] || 1;
                    vertices[vertIdx + 3] = colorData[colIdx + 3] !== undefined ? colorData[colIdx + 3] : 1;
                } else {
                    vertices[vertIdx + 0] = 1;
                    vertices[vertIdx + 1] = 1;
                    vertices[vertIdx + 2] = 1;
                    vertices[vertIdx + 3] = 1;
                }
                vertIdx += 4;
            }

            // Skeletal Joints (default to [0,0,0,0] if missing but requested)
            if (jointsData) {
                if (jointsData.length > jointIdx + 3) {
                    vertices[vertIdx + 0] = jointsData[jointIdx + 0] || 0;
                    vertices[vertIdx + 1] = jointsData[jointIdx + 1] || 0;
                    vertices[vertIdx + 2] = jointsData[jointIdx + 2] || 0;
                    vertices[vertIdx + 3] = jointsData[jointIdx + 3] || 0;
                } else {
                    vertices[vertIdx + 0] = 0;
                    vertices[vertIdx + 1] = 0;
                    vertices[vertIdx + 2] = 0;
                    vertices[vertIdx + 3] = 0;
                }
                vertIdx += 4;
            }

            // Skeletal Weights (default to [1,0,0,0] if missing but requested)
            if (weightsData) {
                if (weightsData.length > weightIdx + 3) {
                    vertices[vertIdx + 0] = weightsData[weightIdx + 0] || 0;
                    vertices[vertIdx + 1] = weightsData[weightIdx + 1] || 0;
                    vertices[vertIdx + 2] = weightsData[weightIdx + 2] || 0;
                    vertices[vertIdx + 3] = weightsData[weightIdx + 3] || 0;
                } else {
                    vertices[vertIdx + 0] = 1; // First weight = 1 if only one weight
                    vertices[vertIdx + 1] = 0;
                    vertices[vertIdx + 2] = 0;
                    vertices[vertIdx + 3] = 0;
                }
                vertIdx += 4;
            }
        }

        // Convert indices
        let indices = null;
        if (indicesData) {
            // Determine index type based on max index value (avoid spreading huge arrays)
            let maxIndex = 0;
            for (let i = 0; i < indicesData.length; i++) {
                const v = indicesData[i] | 0;
                if (v > maxIndex) maxIndex = v;
            }
            if (maxIndex > 65535) {
                indices = new Uint32Array(indicesData);
            } else {
                indices = new Uint16Array(indicesData);
            }
        }

        // Create Fluxion Mesh with attributes metadata
        const meshAttributes = {
            tangent: !!tangentData,
            color: !!colorData,
            joints: !!jointsData,
            weights: !!weightsData
        };
        const mesh = new Mesh(gl, vertices, indices, meshAttributes);
        console.log(`GLTF: Created mesh "${gltfMesh.name || 'unnamed'}" with ${vertexCount} vertices, ${indices ? indices.length : 0} indices`, {
            hasNormals: !!normalData,
            hasTangents: !!tangentData,
            hasColors: !!colorData,
            hasJoints: !!jointsData,
            hasWeights: !!weightsData
        });
        fluxionMeshes.push(mesh);
    }

    if (fluxionMeshes.length === 0) {
        console.warn('GLTF: No meshes created from GLTF mesh', gltfMesh.name);
    } else {
        console.log(`GLTF: Successfully converted mesh "${gltfMesh.name || 'unnamed'}" to ${fluxionMeshes.length} Fluxion mesh(es)`);
    }

    return fluxionMeshes;
}

/**
 * Convert a GLTF node to Fluxion MeshNodes.
 * @param {Object} gltfNode - GLTF node object
 * @param {Object} glTF - Full GLTF object
 * @param {Map<string, Mesh>} meshes - Map of converted meshes
 * @param {Map<string, Material>} materials - Map of converted materials
 * @returns {Array<MeshNode>} Array of MeshNode objects
 */
// Legacy convertGLTFNode removed in favor of _convertGLTFNodeRecursive (world transform traversal).

/**
 * Convert a GLTF material to Fluxion Material.
 * @param {Object} gltfMat - GLTF material object
 * @param {Object} renderer - Renderer instance
 * @returns {Material} Fluxion Material object
 */
function convertGLTFMaterial(glTF, gltfMat, renderer) {
    const mat = new Material();
    const ns = _getGLTFTextureCacheNamespace(glTF);

    // ========================================================================
    // PBR Metallic-Roughness Workflow (GLTF 2.0 Core)
    // ========================================================================
    // All GLTF materials have pbrMetallicRoughness (minimal-gltf-loader provides defaults).
    // GLTF spec defaults:
    //   - baseColorFactor: [1,1,1,1] (white, opaque)
    //   - metallicFactor: 1.0 (fully metallic)
    //   - roughnessFactor: 1.0 (fully rough)
    // These are applied by minimal-gltf-loader if not present in the file.
    if (gltfMat.pbrMetallicRoughness) {
        const pbr = gltfMat.pbrMetallicRoughness;

        // Base Color Factor (linear RGBA, spec default: [1,1,1,1])
        if (pbr.baseColorFactor) {
            mat.baseColorFactor = [
                Number(pbr.baseColorFactor[0] ?? 1),
                Number(pbr.baseColorFactor[1] ?? 1),
                Number(pbr.baseColorFactor[2] ?? 1),
                Number(pbr.baseColorFactor[3] ?? 1)
            ];
        }

        // Metallic Factor (0.0 = dielectric, 1.0 = metal, spec default: 1.0)
        if (pbr.metallicFactor !== undefined) {
            const mf = Number(pbr.metallicFactor);
            if (Number.isFinite(mf)) mat.metallicFactor = Math.max(0.0, Math.min(1.0, mf));
        }
        
        // Roughness Factor (0.0 = smooth/glossy, 1.0 = rough/matte, spec default: 1.0)
        if (pbr.roughnessFactor !== undefined) {
            const rf = Number(pbr.roughnessFactor);
            if (Number.isFinite(rf)) mat.roughnessFactor = Math.max(0.0, Math.min(1.0, rf));
        }

        // Base Color Texture (sRGB, multiplied with baseColorFactor)
        const baseColorTexInfo = pbr.baseColorTexture;
        if (baseColorTexInfo && glTF.textures && glTF.textures[baseColorTexInfo.index]) {
            const t = glTF.textures[baseColorTexInfo.index];
            const img = t?.source;
            const tex = _createGLTFTexture(renderer, img, `${ns}:baseColor:${baseColorTexInfo.index}`, t?.sampler);
            if (tex) mat.baseColorTexture = tex;
        }

        // Metallic-Roughness Texture (linear, packed)
        // GLTF spec: G channel = roughness, B channel = metallic, R/A unused
        // Multiplied with metallicFactor and roughnessFactor respectively
        const mrTexInfo = pbr.metallicRoughnessTexture;
        if (mrTexInfo && glTF.textures && glTF.textures[mrTexInfo.index]) {
            const t = glTF.textures[mrTexInfo.index];
            const img = t?.source;
            const tex = _createGLTFTexture(renderer, img, `${ns}:metallicRoughness:${mrTexInfo.index}`, t?.sampler);
            if (tex) {
                mat.metallicTexture = tex;
                mat.roughnessTexture = tex;
                mat.metallicRoughnessPacked = true; // Signal shader to read G=roughness, B=metallic
            }
        }
    }
    // ========================================================================
    // Normal Mapping (tangent-space, OpenGL convention: +Y up)
    // ========================================================================
    // GLTF spec: RGB channels encode tangent-space normal (OpenGL +Y up), scale defaults to 1.0
    if (gltfMat.normalTexture && glTF.textures && glTF.textures[gltfMat.normalTexture.index]) {
        const t = glTF.textures[gltfMat.normalTexture.index];
        const img = t?.source;
        const tex = _createGLTFTexture(renderer, img, `${ns}:normal:${gltfMat.normalTexture.index}`, t?.sampler);
        if (tex) {
            mat.normalTexture = tex;
            console.log(`[GLTF] Normal map loaded for material "${gltfMat.name || 'unnamed'}":`, {
                textureIndex: gltfMat.normalTexture.index,
                imageIndex: t?.source,
                scale: gltfMat.normalTexture.scale ?? 1.0,
                note: 'GLTF uses OpenGL convention (+Y up in tangent space). Shader uses screen-space derivatives (Mikkelsen method) for TBN.'
            });
        }
        // Normal scale: intensity of normal map effect (spec default: 1.0)
        if (typeof gltfMat.normalTexture.scale === 'number') mat.normalScale = gltfMat.normalTexture.scale;
    }

    // ========================================================================
    // Ambient Occlusion (baked indirect shadowing)
    // ========================================================================
    // GLTF spec: R channel = AO factor, strength defaults to 1.0
    // Note: AO only affects indirect/ambient lighting, not direct lights
    if (gltfMat.occlusionTexture && glTF.textures && glTF.textures[gltfMat.occlusionTexture.index]) {
        const t = glTF.textures[gltfMat.occlusionTexture.index];
        const img = t?.source;
        const tex = _createGLTFTexture(renderer, img, `${ns}:occlusion:${gltfMat.occlusionTexture.index}`, t?.sampler);
        if (tex) mat.aoTexture = tex;
        // AO strength: intensity of occlusion effect (spec default: 1.0)
        if (typeof gltfMat.occlusionTexture.strength === 'number') mat.aoStrength = gltfMat.occlusionTexture.strength;
    }

    // ========================================================================
    // Emissive (self-illumination, added to final color)
    // ========================================================================
    // GLTF spec: emissiveFactor defaults to [0,0,0] (no emission)
    if (gltfMat.emissiveTexture && glTF.textures && glTF.textures[gltfMat.emissiveTexture.index]) {
        const t = glTF.textures[gltfMat.emissiveTexture.index];
        const img = t?.source;
        const tex = _createGLTFTexture(renderer, img, `${ns}:emissive:${gltfMat.emissiveTexture.index}`, t?.sampler);
        if (tex) mat.emissiveTexture = tex;
    }
    // Emissive Factor (linear RGB, multiplied with emissiveTexture)
    if (gltfMat.emissiveFactor) {
        mat.emissiveFactor = [
            Number(gltfMat.emissiveFactor[0] ?? 0),
            Number(gltfMat.emissiveFactor[1] ?? 0),
            Number(gltfMat.emissiveFactor[2] ?? 0)
        ];
    }

    // ========================================================================
    // Alpha / Transparency
    // ========================================================================
    // GLTF spec: alphaMode = "OPAQUE" | "MASK" | "BLEND" (default: "OPAQUE")
    //            alphaCutoff = threshold for MASK mode (default: 0.5)
    if (gltfMat.alphaMode) {
        mat.alphaMode = gltfMat.alphaMode.toUpperCase();
    }
    if (gltfMat.alphaCutoff !== undefined) {
        mat.alphaCutoff = gltfMat.alphaCutoff;
    }

    // ========================================================================
    // Backface Culling
    // ========================================================================
    // GLTF spec: doubleSided defaults to false (cull backfaces)
    if (gltfMat.doubleSided !== undefined) {
        mat.doubleSided = !!gltfMat.doubleSided;
    }

    return mat;
}

function _createGLTFTexture(renderer, image, cacheKey, sampler) {
    const gl = renderer?.gl;
    if (!gl || !image) return null;

    // Basic caching for glTF textures (keyed by glTF texture index + semantic).
    if (cacheKey && renderer.textureCache && renderer.textureCache.has(cacheKey)) {
        return renderer.textureCache.get(cacheKey).texture;
    }

    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);

    // IMPORTANT: do NOT leave premultiply enabled globally; that can zero-out packed maps.
    // NOTE: In our pipeline, glTF UVs are already in the correct orientation for WebGL sampling,
    // so we do NOT flip images on upload (flipping would make them appear upside-down).
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);

    const isPowerOf2 = (value) => (value & (value - 1)) === 0;
    const w = image.width | 0;
    const h = image.height | 0;
    const isPOT = w > 0 && h > 0 && isPowerOf2(w) && isPowerOf2(h);
    const isWebGL2 = !!renderer?.isWebGL2;

    // glTF sampler defaults
    const wrapS = (sampler && sampler.wrapS !== undefined) ? sampler.wrapS : gl.REPEAT;
    const wrapT = (sampler && sampler.wrapT !== undefined) ? sampler.wrapT : gl.REPEAT;
    const magFilter = (sampler && sampler.magFilter) ? sampler.magFilter : gl.LINEAR;
    const minFilter = (sampler && sampler.minFilter) ? sampler.minFilter : gl.LINEAR_MIPMAP_LINEAR;
    const wantsMips = (minFilter === gl.NEAREST_MIPMAP_NEAREST || minFilter === gl.LINEAR_MIPMAP_NEAREST ||
        minFilter === gl.NEAREST_MIPMAP_LINEAR || minFilter === gl.LINEAR_MIPMAP_LINEAR);
    const canMips = (isWebGL2 || isPOT);

    // WebGL1 restriction: NPOT textures cannot use repeat or mipmaps.
    const finalWrapS = (!isWebGL2 && !isPOT) ? gl.CLAMP_TO_EDGE : wrapS;
    const finalWrapT = (!isWebGL2 && !isPOT) ? gl.CLAMP_TO_EDGE : wrapT;
    let finalMin = minFilter;
    if (wantsMips && !canMips) finalMin = gl.LINEAR;

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, finalWrapS);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, finalWrapT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, finalMin);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, magFilter);

    try {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        if (wantsMips && canMips) {
            gl.generateMipmap(gl.TEXTURE_2D);
        }
    } catch (e) {
        console.warn('GLTF: texImage2D failed, using fallback texture', e);
        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            1,
            1,
            0,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            new Uint8Array([255, 255, 255, 255])
        );
    }

    // Restore to WebGL defaults (do not premultiply by default)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.bindTexture(gl.TEXTURE_2D, null);

    // Best-effort cache (if renderer cache infra exists)
    if (cacheKey && renderer._setCacheEntry && renderer._estimateTextureBytes) {
        const bytes = renderer._estimateTextureBytes(image.width, image.height);
        renderer._setCacheEntry(cacheKey, texture, bytes);
        if (renderer._evictIfNeeded) renderer._evictIfNeeded();
    }

    return texture;
}

/**
 * Extract data from a GLTF accessor.
 * Uses the minimal-gltf-loader's internal _getAccessorData if available,
 * otherwise extracts manually from bufferView.
 * @param {Object} accessor - GLTF accessor object
 * @returns {Float32Array|Uint16Array|Uint32Array} Typed array with accessor data
 */
function _extractAccessorData(accessor) {
    if (!accessor || !accessor.bufferView) {
        return null;
    }

    // Try to use the loader's built-in function if available
    if (typeof MinimalGLTFLoader !== 'undefined' && MinimalGLTFLoader._getAccessorData) {
        try {
            const data = MinimalGLTFLoader._getAccessorData(accessor);
            // Convert to Float32Array for vertex attributes (except indices)
            if (accessor.componentType === 5123 || accessor.componentType === 5125) {
                // Indices - return as-is
                return data;
            }
            return data instanceof Float32Array ? data : new Float32Array(data);
        } catch (e) {
            console.warn('Failed to use loader _getAccessorData, falling back to manual extraction', e);
        }
    }

    // Manual extraction - use the loader's approach
    // The loader uses _arrayBuffer2TypedArray(bufferView.data, byteOffset, count * components, componentType)
    const bufferView = accessor.bufferView;
    const componentType = accessor.componentType;
    const count = accessor.count;
    const type = accessor.type;
    const byteOffset = accessor.byteOffset || 0;

    // Number of components per element (matching loader's Type2NumOfComponent)
    const Type2NumOfComponent = {
        'SCALAR': 1,
        'VEC2': 2,
        'VEC3': 3,
        'VEC4': 4
    };
    const componentsPerElement = Type2NumOfComponent[type] || 1;
    const totalComponents = count * componentsPerElement;
    
    // The bufferView.data should be an ArrayBuffer (raw binary data)
    const data = bufferView.data;
    if (!data) {
        console.warn('GLTF: bufferView.data is null', bufferView);
        return null;
    }

    // Use the same approach as the loader's _arrayBuffer2TypedArray
    const TypedArray = _getTypedArrayForComponentType(componentType);
    let result;

    try {
        // The loader's _getAccessorData uses: _arrayBuffer2TypedArray(bufferView.data, accessor.byteOffset, ...)
        // This means bufferView.data is the buffer to use, and accessor.byteOffset is the offset within it
        // The bufferView.data should already be positioned correctly (either the full buffer or a view)
        // So we should use accessor.byteOffset directly, matching the loader's behavior
        
        let bufferToUse;
        let offsetToUse;
        
        // The loader creates bufferView.data as: bufferData.slice(byteOffset, byteOffset + byteLength)
        // So bufferView.data is already a slice starting at bufferView.byteOffset in the original buffer
        // Therefore, we use accessor.byteOffset directly (matching the loader's _getAccessorData)
        if (data instanceof ArrayBuffer) {
            // bufferView.data is already a slice, so use accessor.byteOffset directly
            offsetToUse = byteOffset;
            bufferToUse = data;
        } else if (data.buffer instanceof ArrayBuffer) {
            // Data is already a TypedArray view
            // Use the buffer and add the data's byteOffset + accessor.byteOffset
            offsetToUse = data.byteOffset + byteOffset;
            bufferToUse = data.buffer;
        } else {
            throw new Error('Unexpected data type: ' + (typeof data));
        }
        
        // Verify we have enough data
        const componentSize = _getComponentSize(componentType);
        const requiredBytes = totalComponents * componentSize;
        const availableBytes = bufferToUse.byteLength - offsetToUse;
        
        if (availableBytes < requiredBytes) {
            throw new Error(`Insufficient data: need ${requiredBytes} bytes at offset ${offsetToUse}, have ${availableBytes} bytes available (buffer size: ${bufferToUse.byteLength}, bufferView.byteLength: ${bufferView.byteLength})`);
        }
        
        // Create typed array view
        // The TypedArray constructor: new TypedArray(buffer, byteOffset, length)
        // where length is the number of ELEMENTS, not bytes
        result = new TypedArray(bufferToUse, offsetToUse, totalComponents);
    } catch (e) {
        console.error('GLTF: Failed to extract accessor data', {
            error: e,
            accessor: { componentType, count, type, byteOffset },
            bufferView: { byteOffset: bufferView.byteOffset, byteLength: bufferView.byteLength },
            dataType: data?.constructor?.name,
            dataLength: data?.byteLength || data?.length,
            totalComponents,
            componentSize: _getComponentSize(componentType)
        });
        return null;
    }

    // For positions/normals/UVs, always return Float32Array
    // For indices, return the appropriate integer type
    if (componentType === 5123 || componentType === 5125) { // UNSIGNED_SHORT/INT (indices)
        return result;
    }
    
    // Convert to Float32Array for vertex attributes
    if (result instanceof Float32Array) {
        return result;
    }
    return new Float32Array(result);
}

function _getComponentSize(componentType) {
    const sizes = {
        5120: 1, // BYTE
        5121: 1, // UNSIGNED_BYTE
        5122: 2, // SHORT
        5123: 2, // UNSIGNED_SHORT
        5125: 4, // UNSIGNED_INT
        5126: 4  // FLOAT
    };
    return sizes[componentType] || 4;
}

function _getTypedArrayForComponentType(componentType) {
    const types = {
        5120: Int8Array,    // BYTE
        5121: Uint8Array,   // UNSIGNED_BYTE
        5122: Int16Array,   // SHORT
        5123: Uint16Array, // UNSIGNED_SHORT
        5125: Uint32Array,  // UNSIGNED_INT
        5126: Float32Array // FLOAT
    };
    return types[componentType] || Float32Array;
}

