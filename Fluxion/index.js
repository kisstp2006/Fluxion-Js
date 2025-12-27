/**
 * Fluxion Engine - Main entry point
 * 
 * Usage Examples:
 * 
 * 1. Import everything from core:
 *    import * as Fluxion from './Fluxion/index.js'
 *    const engine = new Fluxion.Engine(...)
 * 
 * 2. Import specific modules:
 *    import { Engine, Sprite, Input } from './Fluxion/index.js'
 * 
 * 3. Import core only:
 *    import * as Core from './Fluxion/Core/index.js'
 */

// Re-export all core modules
export * from './Core/index.js';

// Version info
export const VERSION = '1.0.0';
export const ENGINE_NAME = 'Fluxion';
