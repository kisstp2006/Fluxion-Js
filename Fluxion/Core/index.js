/**
 * Fluxion Core - Main entry point for all core engine features
 * Import everything with: import * as Fluxion from './Fluxion/Core/index.js'
 * Or selectively: import { Engine, Sprite, Input } from './Fluxion/Core/index.js'
 */

// Core Engine
export { default as Engine } from './Engine.js';
export { default as SplashScreen } from './SplashScreen.js';

// Rendering
export { default as Renderer } from './Renderer.js';
export { default as Camera } from './Camera.js';
export { default as Camera3D } from './Camera3D.js';
export { default as Window } from './Window.js';

// Sprites and Animation
export { default as Sprite } from './Sprite.js';
export { default as AnimatedSprite } from './AnimatedSprite.js';

// Scene Management
export { default as Scene } from './Scene.js';
export { default as SceneLoader } from './SceneLoader.js';
// Note: Layers.js doesn't have a default export - it's currently empty

// Input and Interaction
export { default as Input } from './Input.js';
export { default as ClickableArea } from './ClickableArea.js';

// Utilities
export { default as Transform } from './Transform.js';
export { default as Math } from './Math.js';
// Also export other math utilities
export { Vector2, Matrix3, AABB } from './Math.js';

// 3D groundwork
export { default as Mesh } from './Mesh.js';
export { default as MeshNode } from './MeshNode.js';
export { Vector3, Mat4 } from './Math3D.js';
export { default as Material } from './Material.js';
export { default as Skybox } from './Skybox.js';
export { LightType, DirectionalLight, PointLight, SpotLight } from './Lights.js';
export { loadGLTF, convertGLTFToFluxion } from './GLTFLoader.js';

// Text Rendering
export { default as Text } from './Text.js';

// Note: Physic.js is not yet implemented

// Audio (Optional - can be in extras if preferred)
export { default as Audio } from './Audio.js';

// Post Processing (Optional - can be in extras if preferred)
export { default as PostProcessing } from './PostProcessing.js';

// Debug Rendering
export { default as DebugRenderer } from './DebugRenderer.js';