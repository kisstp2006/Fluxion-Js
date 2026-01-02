/**
 * GLTF loader integration for Fluxion-Js.
 * Converts GLTF models to Fluxion Mesh objects.
 * 
 * Requires: minimal-gltf-loader.js from 3rdParty folder
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
                    const loaderPath = new URL('../../3rdParty/minimal-gltf-loader.js', import.meta.url).href;
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
            // Check if buffers loaded successfully
            if (glTFLoader._bufferRequested > 0 && glTFLoader._bufferLoaded < glTFLoader._bufferRequested) {
                console.warn(`GLTF: Some buffers failed to load. Requested: ${glTFLoader._bufferRequested}, Loaded: ${glTFLoader._bufferLoaded}`);
            }
            
            const result = convertGLTFToFluxion(glTF, gl, renderer);
            resolve(result);
        } catch (err) {
            reject(new Error(`Failed to convert GLTF: ${err.message}`));
        }
    });
    
    // Note: The minimal-gltf-loader handles .bin file loading automatically
    // It extracts the base URI from the GLTF file path and loads all buffers
    // referenced in the JSON. No additional code needed here.
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

    // Convert materials
    if (glTF.materials) {
        for (let i = 0; i < glTF.materials.length; i++) {
            const gltfMat = glTF.materials[i];
            const mat = convertGLTFMaterial(gltfMat, renderer);
            const name = gltfMat.name || `Material_${i}`;
            materials.set(name, mat);
        }
    }

    // Convert meshes
    if (glTF.meshes) {
        for (let i = 0; i < glTF.meshes.length; i++) {
            const gltfMesh = glTF.meshes[i];
            const fluxionMeshes = convertGLTFMesh(gltfMesh, gl);
            const baseName = gltfMesh.name || `Mesh_${i}`;
            
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

    // Convert scene nodes to MeshNodes
    if (glTF.scenes && glTF.scenes.length > 0) {
        const scene = glTF.scenes[0]; // Use first scene
        if (scene.nodes) {
            for (const nodeId of scene.nodes) {
                const node = glTF.nodes[nodeId];
                if (node) {
                    const meshNodes = convertGLTFNode(node, glTF, meshes, materials);
                    nodes.push(...meshNodes);
                }
            }
        }
    }

    return { meshes, materials, nodes };
}

/**
 * Convert a GLTF mesh to Fluxion Mesh objects.
 * @param {Object} gltfMesh - GLTF mesh object
 * @param {WebGLRenderingContext|WebGL2RenderingContext} gl - WebGL context
 * @returns {Array<Mesh>} Array of Fluxion Mesh objects (one per primitive)
 */
function convertGLTFMesh(gltfMesh, gl) {
    const fluxionMeshes = [];

    if (!gltfMesh.primitives || gltfMesh.primitives.length === 0) {
        console.warn('GLTF: Mesh has no primitives', gltfMesh.name);
        return fluxionMeshes;
    }

    for (const primitive of gltfMesh.primitives) {
        // Get accessors
        const positionAccessor = primitive.attributes.POSITION;
        const normalAccessor = primitive.attributes.NORMAL;
        const texCoordAccessor = primitive.attributes.TEXCOORD_0 || primitive.attributes.TEXCOORD;
        const indicesAccessor = primitive.indices;

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
        const texCoordData = texCoordAccessor ? _extractAccessorData(texCoordAccessor) : null;
        const indicesData = indicesAccessor ? _extractAccessorData(indicesAccessor) : null;

        // Convert to interleaved format: [x,y,z, nx,ny,nz, u,v]
        const vertexCount = positionAccessor.count;
        const vertices = new Float32Array(vertexCount * 8);

        for (let i = 0; i < vertexCount; i++) {
            const posIdx = i * 3;
            const normIdx = i * 3;
            const uvIdx = i * 2;
            const vertIdx = i * 8;

            // Position
            vertices[vertIdx + 0] = positionData[posIdx + 0] || 0;
            vertices[vertIdx + 1] = positionData[posIdx + 1] || 0;
            vertices[vertIdx + 2] = positionData[posIdx + 2] || 0;

            // Normal (default to [0,1,0] if missing)
            if (normalData && normalData.length > normIdx + 2) {
                vertices[vertIdx + 3] = normalData[normIdx + 0] || 0;
                vertices[vertIdx + 4] = normalData[normIdx + 1] || 1;
                vertices[vertIdx + 5] = normalData[normIdx + 2] || 0;
            } else {
                vertices[vertIdx + 3] = 0;
                vertices[vertIdx + 4] = 1;
                vertices[vertIdx + 5] = 0;
            }

            // UV (default to [0,0] if missing)
            if (texCoordData && texCoordData.length > uvIdx + 1) {
                vertices[vertIdx + 6] = texCoordData[uvIdx + 0] || 0;
                vertices[vertIdx + 7] = texCoordData[uvIdx + 1] || 0;
            } else {
                vertices[vertIdx + 6] = 0;
                vertices[vertIdx + 7] = 0;
            }
        }

        // Convert indices
        let indices = null;
        if (indicesData) {
            // Determine index type based on max index value
            const maxIndex = Math.max(...Array.from(indicesData));
            if (maxIndex > 65535) {
                indices = new Uint32Array(indicesData);
            } else {
                indices = new Uint16Array(indicesData);
            }
        }

        // Create Fluxion Mesh
        const mesh = new Mesh(gl, vertices, indices);
        console.log(`GLTF: Created mesh "${gltfMesh.name || 'unnamed'}" with ${vertexCount} vertices, ${indices ? indices.length : 0} indices`);
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
function convertGLTFNode(gltfNode, glTF, meshes, materials) {
    const meshNodes = [];

    // If this node has a mesh, create a MeshNode for it
    if (gltfNode.mesh) {
        const gltfMesh = glTF.meshes[gltfNode.mesh.meshID];
        if (gltfMesh) {
            const baseName = gltfMesh.name || `Mesh_${gltfNode.mesh.meshID}`;
            
            // Create a MeshNode for each primitive (or single if only one)
            const meshKeys = Array.from(meshes.keys()).filter(k => k.startsWith(baseName));
            
            for (const meshKey of meshKeys) {
                const meshNode = new MeshNode();
                meshNode.name = gltfNode.name || meshKey;
                
                // Set transform from GLTF node
                if (gltfNode.translation) {
                    meshNode.x = gltfNode.translation[0] || 0;
                    meshNode.y = gltfNode.translation[1] || 0;
                    meshNode.z = gltfNode.translation[2] || 0;
                }
                
                if (gltfNode.scale) {
                    meshNode.scaleX = gltfNode.scale[0] || 1;
                    meshNode.scaleY = gltfNode.scale[1] || 1;
                    meshNode.scaleZ = gltfNode.scale[2] || 1;
                }
                
                if (gltfNode.rotation) {
                    // Convert quaternion to Euler (simplified - just use Y rotation)
                    // For full quaternion support, you'd need a quat-to-euler conversion
                    const q = gltfNode.rotation;
                    // Simple approximation: extract Y rotation from quaternion
                    const yaw = Math.atan2(2 * (q[3] * q[1] + q[0] * q[2]), 1 - 2 * (q[1] * q[1] + q[2] * q[2]));
                    meshNode.rotY = yaw;
                }
                
                // Set mesh reference (will be resolved by MeshNode._ensureMesh)
                meshNode.source = meshKey;
                meshNode.meshDefinition = { type: 'gltf', meshKey };
                
                // Set material if available
                if (gltfMesh.primitives && gltfMesh.primitives[0]) {
                    const materialId = gltfMesh.primitives[0].material;
                    if (materialId !== undefined && glTF.materials) {
                        const gltfMat = glTF.materials[materialId];
                        if (gltfMat) {
                            const matName = gltfMat.name || `Material_${materialId}`;
                            const mat = materials.get(matName);
                            if (mat) {
                                meshNode.setMaterial(mat);
                            }
                        }
                    }
                }
                
                meshNodes.push(meshNode);
            }
        }
    }

    // Recursively process children
    if (gltfNode.children) {
        for (const childId of gltfNode.children) {
            const childNode = glTF.nodes[childId];
            if (childNode) {
                const childMeshNodes = convertGLTFNode(childNode, glTF, meshes, materials);
                meshNodes.push(...childMeshNodes);
            }
        }
    }

    return meshNodes;
}

/**
 * Convert a GLTF material to Fluxion Material.
 * @param {Object} gltfMat - GLTF material object
 * @param {Object} renderer - Renderer instance
 * @returns {Material} Fluxion Material object
 */
function convertGLTFMaterial(gltfMat, renderer) {
    const mat = new Material();

    // PBR Metallic-Roughness workflow
    if (gltfMat.pbrMetallicRoughness) {
        const pbr = gltfMat.pbrMetallicRoughness;

        // Base color
        if (pbr.baseColorFactor) {
            mat.baseColorFactor = [
                pbr.baseColorFactor[0] || 1,
                pbr.baseColorFactor[1] || 1,
                pbr.baseColorFactor[2] || 1,
                pbr.baseColorFactor[3] || 1
            ];
        }

        // Metallic/Roughness
        if (pbr.metallicFactor !== undefined) {
            mat.metallicFactor = pbr.metallicFactor;
        }
        if (pbr.roughnessFactor !== undefined) {
            mat.roughnessFactor = pbr.roughnessFactor;
        }

        // Textures (would need to be loaded from GLTF images)
        // For now, we'll just store references - full texture loading would require
        // accessing glTF.images and converting to WebGL textures
        // TODO: Implement texture loading from GLTF
    }

    // Emissive
    if (gltfMat.emissiveFactor) {
        mat.emissiveFactor = [
            gltfMat.emissiveFactor[0] || 0,
            gltfMat.emissiveFactor[1] || 0,
            gltfMat.emissiveFactor[2] || 0
        ];
    }

    // Alpha mode
    if (gltfMat.alphaMode) {
        mat.alphaMode = gltfMat.alphaMode.toUpperCase();
    }
    if (gltfMat.alphaCutoff !== undefined) {
        mat.alphaCutoff = gltfMat.alphaCutoff;
    }

    return mat;
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

