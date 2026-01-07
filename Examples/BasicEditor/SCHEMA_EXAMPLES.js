// @ts-check

/**
 * Example demonstrating data-driven inspector migration.
 * Shows before/after patterns for common component types.
 * 
 * This file is for reference only - integrate patterns into your own code.
 */

import * as InspectorRenderer from './inspectorRenderer.js';
import { SchemaRegistry, PropertyFactory } from './inspectorSchema.js';

/**
 * EXAMPLE 1: Simple Component Schema
 * 
 * BEFORE (Hardcoded in rebuildInspector):
 * ```
 * if (obj && obj.constructor?.name === 'Audio') {
 *   InspectorFields.addStringWithDrop(ui.common, 'src', obj, 'src', () => {}, 
 *     { acceptExtensions: ['.mp3', '.wav', '.ogg'] });
 *   InspectorFields.addToggle(ui.common, 'loop', obj, 'loop');
 *   InspectorFields.addToggle(ui.common, 'autoplay', obj, 'autoplay');
 *   InspectorFields.addNumber(host, ui.common, 'volume', obj, 'volume');
 * }
 * ```
 * 
 * AFTER (Declarative Schema):
 */
function example1_AudioComponent() {
  // Register once (could be in BuiltInSchemas.initializeAll())
  SchemaRegistry.register('Audio', [
    PropertyFactory
      .texture('src', 'Source', ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac'])
      .build(),
    PropertyFactory.boolean('loop', 'Loop').build(),
    PropertyFactory.boolean('autoplay', 'Autoplay').build(),
    PropertyFactory.boolean('stopOnSceneChange', 'Stop On Scene Change').build(),
    PropertyFactory
      .number('volume', 'Volume', { min: 0, max: 1, step: 0.01 })
      .build(),
  ]);

  // In rebuildInspector():
  // const schema = SchemaRegistry.getSchema(obj);
  // if (schema) {
  //   InspectorRenderer.renderSchemaUI(host, ui.common, obj, schema, {
  //     onChanged: () => { /* ... */ },
  //     requestSave: () => { /* ... */ }
  //   });
  // }
}

/**
 * EXAMPLE 2: Conditional Properties
 * 
 * BEFORE (Hardcoded):
 * ```
 * if (obj && typeof obj === 'object' && ('followCamera' in obj)) {
 *   InspectorFields.addToggleWith(ui.common, 'followCamera', obj, 'followCamera', () => {
 *     host.rebuildInspector?.();
 *   });
 *   if (obj.followCamera) {
 *     InspectorFields.addNumber(host, ui.common, 'baseX', obj, 'baseX');
 *     InspectorFields.addNumber(host, ui.common, 'baseY', obj, 'baseY');
 *   }
 * }
 * ```
 * 
 * AFTER (Conditional visibility in schema):
 */
function example2_ConditionalProperties() {
  // Register with visible() conditions
  SchemaRegistry.register('Camera', [
    PropertyFactory.boolean('followCamera', 'Follow Camera').build(),
    
    // These are only visible when followCamera is true
    new (require('./inspectorSchema.js').PropertySchemaBuilder)('baseX', 'number')
      .label('Base X')
      .visible(obj => obj.followCamera)
      .build(),
    
    new (require('./inspectorSchema.js').PropertySchemaBuilder)('baseY', 'number')
      .label('Base Y')
      .visible(obj => obj.followCamera)
      .build(),
  ]);

  // In rebuildInspector():
  // const schema = SchemaRegistry.getSchema(obj);
  // if (schema) {
  //   InspectorRenderer.renderSchemaUI(host, ui.common, obj, schema);
  //   // Visibility is handled automatically!
  // }
}

/**
 * EXAMPLE 3: Grouped Properties (Material)
 * 
 * BEFORE (Lots of manual grouping):
 * ```
 * const gAlbedo = InspectorWidgets.createGroup(ui.common, 'Albedo', true);
 * InspectorFields.addStringWithDrop(gAlbedo, 'Base Color Texture', stub, 'baseColorTexture', 
 *   () => { ... }, texOpts);
 * InspectorFields.addColorVec3With(gAlbedo, 'Base Color', stub, 'baseColorFactor', 
 *   () => { ... });
 * 
 * const gOrm = InspectorWidgets.createGroup(ui.common, 'Orm', true);
 * InspectorFields.addStringWithDrop(gOrm, 'Metallic-Roughness Texture', stub, 
 *   'metallicRoughnessTexture', () => { ... }, texOpts);
 * // ... etc
 * ```
 * 
 * AFTER (Declarative groups):
 */
function example3_MaterialGroups() {
  SchemaRegistry.register('Material', [
    PropertyFactory.string('name', 'Name').build(),
    
    // Grouped properties automatically rendered with collapsible sections
    PropertyFactory.group('Albedo', [
      PropertyFactory.texture('baseColorTexture', 'Texture', ['.png', '.jpg', '.jpeg']).build(),
      PropertyFactory.color('baseColorFactor', 'Color').build(),
    ], false),  // false = starts expanded
    
    PropertyFactory.group('ORM', [
      PropertyFactory.texture('occlusionTexture', 'Occlusion', ['.png', '.jpg']).build(),
      PropertyFactory
        .number('aoStrength', 'AO Strength', { min: 0, max: 2, step: 0.01 })
        .build(),
      PropertyFactory.texture('metallicRoughnessTexture', 'Metallic-Roughness', ['.png', '.jpg']).build(),
      PropertyFactory
        .number('metallicFactor', 'Metallic', { min: 0, max: 1, step: 0.01 })
        .build(),
      PropertyFactory
        .number('roughnessFactor', 'Roughness', { min: 0.04, max: 1, step: 0.01 })
        .build(),
    ], false),
    
    PropertyFactory.group('Normal Map', [
      PropertyFactory.texture('normalTexture', 'Texture', ['.png', '.jpg']).build(),
      PropertyFactory
        .number('normalScale', 'Scale', { min: 0, max: 2, step: 0.01 })
        .build(),
    ], true),  // true = starts collapsed
    
    PropertyFactory.group('Emission', [
      PropertyFactory.texture('emissiveTexture', 'Texture', ['.png', '.jpg']).build(),
      PropertyFactory.color('emissiveFactor', 'Color').build(),
    ], true),
  ]);

  // Rendered in one call with groups handled automatically!
}

/**
 * EXAMPLE 4: Enum Properties
 * 
 * BEFORE (Hardcoded options):
 * ```
 * if (k === 'alphamode') {
 *   addSelectWith(container, label, obj, key, [
 *     { label: '(default)', value: '' },
 *     { label: 'OPAQUE', value: 'OPAQUE' },
 *     { label: 'MASK', value: 'MASK' },
 *     { label: 'BLEND', value: 'BLEND' },
 *   ], onChanged);
 *   return;
 * }
 * ```
 * 
 * AFTER (In schema definition):
 */
function example4_EnumProperty() {
  SchemaRegistry.register('Material', [
    PropertyFactory.enum('alphaMode', [
      { label: '(default)', value: '' },
      { label: 'OPAQUE', value: 'OPAQUE' },
      { label: 'MASK', value: 'MASK' },
      { label: 'BLEND', value: 'BLEND' },
    ], 'Alpha Mode').build(),
  ]);
}

/**
 * EXAMPLE 5: Transform Section (Reusable)
 * 
 * BEFORE (Lots of type checking):
 * ```
 * const hasPosVec = !!(obj.position && typeof obj.position.x === 'number' && ...);
 * const hasRotVec = !!(obj.rotation && typeof obj.rotation.x === 'number' && ...);
 * 
 * if (hasPosVec) {
 *   InspectorFields.addNumber(host, ui.transform, 'pos.x', obj.position, 'x');
 *   InspectorFields.addNumber(host, ui.transform, 'pos.y', obj.position, 'y');
 *   InspectorFields.addNumber(host, ui.transform, 'pos.z', obj.position, 'z');
 * } else {
 *   if (typeof obj.x === 'number') InspectorFields.addNumber(host, ui.transform, 'x', obj, 'x');
 *   if (typeof obj.y === 'number') InspectorFields.addNumber(host, ui.transform, 'y', obj, 'y');
 *   if (typeof obj.z === 'number') InspectorFields.addNumber(host, ui.transform, 'z', obj, 'z');
 * }
 * // ... etc
 * ```
 * 
 * AFTER (Generic handler):
 */
function example5_Transform(host, transformContainer, obj, mode = '3d') {
  // One-liner that handles all the structure checking!
  InspectorRenderer.renderTransformSection(host, transformContainer, obj, mode);
}

/**
 * EXAMPLE 6: Complex Component with All Features
 * 
 * A realistic component combining multiple patterns.
 */
function example6_ComplexComponent() {
  const { PropertySchemaBuilder, PropertyFactory } = require('./inspectorSchema.js');

  SchemaRegistry.register('GameManager', [
    // Basic properties
    PropertyFactory.string('name', 'Name').build(),
    PropertyFactory.string('version', 'Version').build(),
    
    // Difficulty section
    PropertyFactory.group('Difficulty', [
      PropertyFactory.enum('difficulty', [
        { label: 'Easy', value: 'easy' },
        { label: 'Normal', value: 'normal' },
        { label: 'Hard', value: 'hard' },
      ], 'Difficulty').build(),
      
      PropertyFactory
        .number('damageMultiplier', 'Damage', { min: 0.5, max: 2, step: 0.1 })
        .build(),
      
      PropertyFactory
        .number('enemyCount', 'Enemy Count', { min: 1, max: 100 })
        .visible(obj => obj.difficulty !== 'easy')
        .build(),
    ], false),
    
    // Audio settings
    PropertyFactory.group('Audio', [
      PropertyFactory.boolean('musicEnabled', 'Music').build(),
      
      new PropertySchemaBuilder('musicVolume', 'number')
        .label('Music Volume')
        .range(0, 1, 0.01)
        .visible(obj => obj.musicEnabled)
        .build(),
      
      PropertyFactory.boolean('sfxEnabled', 'Sound Effects').build(),
      
      new PropertySchemaBuilder('sfxVolume', 'number')
        .label('SFX Volume')
        .range(0, 1, 0.01)
        .visible(obj => obj.sfxEnabled)
        .build(),
    ], true),
    
    // Advanced options (collapsed by default)
    PropertyFactory.group('Advanced', [
      PropertyFactory.boolean('debugMode', 'Debug Mode').build(),
      PropertyFactory.boolean('skipIntro', 'Skip Intro').build(),
      PropertyFactory
        .number('targetFPS', 'Target FPS', { min: 30, max: 240, step: 10 })
        .build(),
    ], true),
  ]);
}

/**
 * EXAMPLE 7: Integration Pattern - Updated rebuildInspector()
 */
function example7_IntegrationPattern(host, ui, obj) {
  if (!obj) return;

  // Try schema-driven rendering first
  const schema = SchemaRegistry.getSchema(obj);
  if (schema) {
    InspectorRenderer.renderSchemaUI(host, ui.common, obj, schema, {
      onChanged: () => {
        try { host._blockInspectorAutoRefresh?.(0.35); } catch {}
        try { host.rebuildInspector?.(); } catch {}
      },
      requestSave: () => {
        try { host.requestSave?.(); } catch {}
      },
    });
  } else {
    // Fall back to auto-detection for unknown types
    console.warn(`No schema registered for ${obj.constructor?.name}`, obj);
    // ... existing fallback code ...
  }

  // Always render transform section
  const mode = host.mode === '2d' ? '2d' : '3d';
  InspectorRenderer.renderTransformSection(host, ui.transform, obj, mode);
}

/**
 * EXAMPLE 8: Custom Component Extension
 * 
 * Show how to extend the system for user-defined components.
 */
function example8_CustomComponent() {
  const { SchemaRegistry, PropertyFactory, PropertySchemaBuilder } = require('./inspectorSchema.js');

  // User-defined game component
  class EnemySpawner {
    constructor() {
      this.name = 'Spawner';
      this.enabled = true;
      this.spawnRate = 2;
      this.spawnType = 'basic';
      this.maxEnemies = 10;
      this.useWaves = false;
      this.waveCount = 3;
    }
  }

  // Register its schema
  SchemaRegistry.register('EnemySpawner', [
    PropertyFactory.string('name', 'Name').build(),
    PropertyFactory.boolean('enabled', 'Enabled').build(),
    
    PropertyFactory.group('Spawning', [
      PropertyFactory
        .number('spawnRate', 'Spawn Rate (per sec)', { min: 0.1, max: 10, step: 0.1 })
        .build(),
      
      PropertyFactory.enum('spawnType', [
        { label: 'Basic', value: 'basic' },
        { label: 'Advanced', value: 'advanced' },
        { label: 'Boss', value: 'boss' },
      ], 'Enemy Type').build(),
      
      PropertyFactory
        .number('maxEnemies', 'Max Enemies', { min: 1, max: 100 })
        .build(),
    ], false),
    
    PropertyFactory.group('Waves', [
      PropertyFactory.boolean('useWaves', 'Use Waves').build(),
      
      new PropertySchemaBuilder('waveCount', 'number')
        .label('Wave Count')
        .range(1, 20)
        .visible(obj => obj.useWaves)
        .build(),
    ], true),
  ]);

  // Usage:
  // const spawner = new EnemySpawner();
  // InspectorRenderer.renderBySchema(host, container, null, spawner);
}

export {
  example1_AudioComponent,
  example2_ConditionalProperties,
  example3_MaterialGroups,
  example4_EnumProperty,
  example5_Transform,
  example6_ComplexComponent,
  example7_IntegrationPattern,
  example8_CustomComponent,
};
