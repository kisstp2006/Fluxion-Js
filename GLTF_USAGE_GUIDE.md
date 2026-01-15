# GLTF Loader Integration Guide

This guide explains how to use the GLTF loader integration in Fluxion-Js to load 3D models from GLTF files.

## Prerequisites

1. **GLTF Loader Library**: The `minimal-gltf-loader.js` file must be available in the `third-party` folder
2. **gl-matrix**: The loader requires `gl-matrix` library (vec3, vec4, quat, mat4)
3. **WebGL Context**: A WebGL rendering context is required

## Loading GLTF Files

### Method 1: XAML/XML Scene Files

You can load GLTF files directly in your scene XAML files:

```xml
<Scene name="MyScene">
    <!-- Load a GLTF model as a named mesh resource -->
    <Mesh name="MyModel" source="models/character.gltf" />
    
    <!-- Use the GLTF mesh in a MeshNode -->
    <MeshNode name="CharacterNode"
              source="MyModel"
              x="0" y="0" z="-5"
              material="CharacterMat" />
    
    <!-- Optional: Material for the model -->
    <Material name="CharacterMat"
              baseColorFactor="#ffffff"
              metallicFactor="0.5"
              roughnessFactor="0.7" />
</Scene>
```

**Notes:**
- The `source` attribute should point to a `.gltf` file
- The GLTF file will be loaded asynchronously
- All meshes from the GLTF will be registered with their names (or auto-generated names)
- Materials from the GLTF will also be registered automatically

### Method 2: Code-Only Loading

You can load GLTF files programmatically:

```javascript
import { Engine, Scene, loadGLTF, MeshNode } from "./packages/engine/Fluxion/index.js";

const game = {
    currentScene: null,

    async init(renderer) {
        const scene = new Scene();

        // Load GLTF file
        try {
            const gltfResult = await loadGLTF(
                "models/character.gltf",
                renderer.gl,
                renderer
            );

            // Access loaded meshes
            console.log("Loaded meshes:", Array.from(gltfResult.meshes.keys()));
            // Output: ["Character", "Character_Primitive_0", ...]

            // Access loaded materials
            console.log("Loaded materials:", Array.from(gltfResult.materials.keys()));
            // Output: ["CharacterMaterial", ...]

            // Create MeshNode from GLTF mesh
            const meshName = Array.from(gltfResult.meshes.keys())[0];
            const mesh = gltfResult.meshes.get(meshName);

            const meshNode = new MeshNode();
            meshNode.name = "Character";
            meshNode.setMeshDefinition({ type: 'gltf', mesh: mesh });
            meshNode.setPosition(0, 0, -5);

            // Optionally set material
            const matName = Array.from(gltfResult.materials.keys())[0];
            const material = gltfResult.materials.get(matName);
            if (material) {
                meshNode.setMaterial(material);
            }

            scene.add(meshNode);

            // Or use the pre-converted nodes from GLTF
            for (const node of gltfResult.nodes) {
                scene.add(node);
            }

        } catch (error) {
            console.error("Failed to load GLTF:", error);
        }

        this.currentScene = scene;
    },

    update(dt) {
        if (this.currentScene) this.currentScene.update(dt);
    },

    draw(renderer) {
        if (this.currentScene) this.currentScene.draw(renderer);
    },
};

new Engine("gameCanvas", game, 1920, 1080, true, true, {
    renderer: {
        webglVersion: 2,
        allowFallback: true,
    },
});
```

## GLTF Loader API

### `loadGLTF(url, gl, renderer)`

Loads a GLTF file and converts it to Fluxion meshes and materials.

**Parameters:**
- `url` (string): Path to the `.gltf` file
- `gl` (WebGLRenderingContext|WebGL2RenderingContext): WebGL context
- `renderer` (Renderer): Renderer instance (for texture loading)

**Returns:** `Promise<{meshes: Map<string, Mesh>, materials: Map<string, Material>, nodes: Array<MeshNode>}>`

**Example:**
```javascript
const result = await loadGLTF("model.gltf", renderer.gl, renderer);

// Access meshes
for (const [name, mesh] of result.meshes.entries()) {
    console.log(`Mesh: ${name}`);
}

// Access materials
for (const [name, material] of result.materials.entries()) {
    console.log(`Material: ${name}`);
}

// Access pre-converted nodes
for (const node of result.nodes) {
    scene.add(node);
}
```

### `convertGLTFToFluxion(glTF, gl, renderer)`

Converts an already-loaded GLTF object to Fluxion format.

**Parameters:**
- `glTF` (Object): GLTF object from minimal-gltf-loader
- `gl` (WebGLRenderingContext|WebGL2RenderingContext): WebGL context
- `renderer` (Renderer): Renderer instance

**Returns:** `{meshes: Map<string, Mesh>, materials: Map<string, Material>, nodes: Array<MeshNode>}`

## Supported GLTF Features

### ✅ Supported

- **Meshes**: All mesh primitives with positions, normals, and UVs
- **Materials**: PBR metallic-roughness materials
  - Base color factor
  - Metallic factor
  - Roughness factor
  - Emissive factor
  - Alpha mode (OPAQUE, MASK, BLEND)
- **Scene Graph**: Node hierarchy with transforms
- **Multiple Primitives**: Meshes with multiple primitives are split into separate Fluxion meshes

### ⚠️ Partially Supported

- **Textures**: Material textures are not yet automatically loaded (TODO)
- **Animations**: Skeletal animations are not yet supported
- **Morph Targets**: Not yet supported

### ❌ Not Supported

- **GLB Format**: Only `.gltf` files are supported (not binary `.glb`)
- **Extensions**: Custom GLTF extensions are not supported
- **Skins**: Skeletal animation data is not processed

## Mesh Conversion Details

GLTF meshes are converted to Fluxion's interleaved vertex format:
- **Format**: `[x, y, z, nx, ny, nz, u, v]` per vertex
- **Indices**: Automatically converted to Uint16Array or Uint32Array based on vertex count
- **Normals**: Default to `[0, 1, 0]` if missing
- **UVs**: Default to `[0, 0]` if missing

## Material Conversion Details

GLTF materials are converted to Fluxion's PBR material system:
- **Base Color**: Converted from `pbrMetallicRoughness.baseColorFactor`
- **Metallic**: Converted from `pbrMetallicRoughness.metallicFactor`
- **Roughness**: Converted from `pbrMetallicRoughness.roughnessFactor`
- **Emissive**: Converted from `emissiveFactor`
- **Alpha Mode**: Converted from `alphaMode` (OPAQUE, MASK, BLEND)

## Example: Complete Scene with GLTF

```xml
<Scene name="GLTFExample">
    <!-- Camera -->
    <Camera3D name="MainCamera3D"
              x="0" y="2" z="8"
              targetX="0" targetY="0" targetZ="0" />

    <!-- Lights -->
    <DirectionalLight name="Sun"
                      direction="0.35, -1.0, 0.25"
                      color="#ffffff"
                      intensity="1.2" />

    <!-- GLTF Model -->
    <Mesh name="Robot" source="models/robot.gltf" />

    <!-- Use the GLTF model -->
    <MeshNode name="RobotNode"
              source="Robot"
              x="0" y="0" z="0"
              scaleX="1" scaleY="1" scaleZ="1" />
</Scene>
```

## Troubleshooting

### GLTF Loader Not Found

**Error**: `GLTF loader not available`

**Solution**: Make sure `minimal-gltf-loader.js` is loaded before using the GLTF loader. You can:
1. Add it to your HTML: `<script src="third-party/minimal-gltf-loader.js"></script>`
2. Or import it as a module (if using ES modules)

### gl-matrix Not Found

**Error**: `vec3 is not defined` or similar

**Solution**: The GLTF loader requires `gl-matrix`. Make sure it's available:
```html
<script src="https://cdn.jsdelivr.net/npm/gl-matrix@3.4.3/gl-matrix-min.js"></script>
```

### Mesh Not Rendering

**Possible Causes:**
1. GLTF file path is incorrect
2. GLTF file is not accessible (CORS issues)
3. Mesh has no material assigned
4. Camera is not positioned correctly

**Debug Steps:**
```javascript
const result = await loadGLTF("model.gltf", renderer.gl, renderer);
console.log("Meshes:", result.meshes);
console.log("Materials:", result.materials);
console.log("Nodes:", result.nodes);
```

### Multiple Primitives

If your GLTF mesh has multiple primitives, they will be split into separate Fluxion meshes:
- Original mesh name: `"Character"`
- Generated names: `"Character_Primitive_0"`, `"Character_Primitive_1"`, etc.

To use a specific primitive:
```xml
<MeshNode source="Character_Primitive_0" />
```

## Performance Tips

1. **Cache Meshes**: GLTF meshes are automatically cached by MeshNode
2. **Load Once**: Load GLTF files once and reuse the meshes
3. **Optimize Models**: Use optimized GLTF files (compressed, reduced polygon count)
4. **Lazy Loading**: Load GLTF files only when needed

## Future Improvements

- [ ] Automatic texture loading from GLTF
- [ ] GLB binary format support
- [ ] Skeletal animation support
- [ ] Morph target support
- [ ] Better quaternion to Euler conversion for rotations

