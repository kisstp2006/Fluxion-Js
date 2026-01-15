/**
 * Fluxion Extras - Optional/Advanced features
 * Import these separately when needed to keep your bundle size smaller
 * 
 * Usage:
 * import { PostProcessing, Physic, Audio } from './Fluxion/extras.js'
 */

// Advanced Features (can be imported separately)
export { default as PostProcessing } from './Core/PostProcessing.js';
// Note: Physic is not yet implemented
export { default as Audio } from './Core/Audio.js';
export { default as SpritePool } from './Extras/SpritePool.js';

// You can add more extras here as your engine grows
// For example:
// - Particle systems
// - Advanced shaders
// - Networking utilities
// - Level editors
// etc.
