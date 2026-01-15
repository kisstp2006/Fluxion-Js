// @ts-check

/**
 * Property schema system for data-driven inspector UI generation.
 * Inspired by Godot's inspector system, defines component properties declaratively.
 */

/**
 * @typedef {{
 *   type: 'string' | 'number' | 'boolean' | 'enum' | 'color' | 'vec2' | 'vec3' | 'vec4' | 'texture' | 'array' | 'group' | 'custom',
 *   label?: string,
 *   description?: string,
 *   key?: string,
 *   default?: any,
 *   min?: number,
 *   max?: number,
 *   step?: number,
 *   options?: Array<{label: string, value: any}>,
 *   validate?: (value: any) => boolean,
 *   onChange?: () => void,
 *   visible?: boolean | ((obj: any) => boolean),
 *   enabled?: boolean | ((obj: any) => boolean),
 *   properties?: PropertySchema[],
 *   textureExtensions?: string[],
 *   group?: string,
 *   section?: string,
 *   collapse?: boolean,
 *   category?: string,
 * }} PropertySchema
 */

/**
 * PropertySchema builder with fluent API.
 */
export class PropertySchemaBuilder {
  /** @type {PropertySchema} */
  #schema;

  /**
   * @param {string} key
   * @param {'string'|'number'|'boolean'|'enum'|'color'|'vec2'|'vec3'|'vec4'|'texture'|'array'|'group'|'custom'} type
   */
  constructor(key, type) {
    this.#schema = { key, type };
  }

  /**
   * @param {string} label
   * @returns {PropertySchemaBuilder}
   */
  label(label) {
    this.#schema.label = label;
    return this;
  }

  /**
   * @param {string} description
   * @returns {PropertySchemaBuilder}
   */
  description(description) {
    this.#schema.description = description;
    return this;
  }

  /**
   * @param {number} min
   * @param {number} max
   * @param {number} [step]
   * @returns {PropertySchemaBuilder}
   */
  range(min, max, step = 0.01) {
    this.#schema.min = min;
    this.#schema.max = max;
    this.#schema.step = step;
    return this;
  }

  /**
   * @param {number} step
   * @returns {PropertySchemaBuilder}
   */
  step(step) {
    this.#schema.step = step;
    return this;
  }

  /**
   * @param {Array<{label: string, value: any}>} options
   * @returns {PropertySchemaBuilder}
   */
  enum(options) {
    this.#schema.options = options;
    return this;
  }

  /**
   * @param {string[]} extensions
   * @returns {PropertySchemaBuilder}
   */
  textureExtensions(extensions) {
    this.#schema.textureExtensions = extensions;
    return this;
  }

  /**
   * @param {any} defaultValue
   * @returns {PropertySchemaBuilder}
   */
  default(defaultValue) {
    this.#schema.default = defaultValue;
    return this;
  }

  /**
   * @param {boolean | ((obj: any) => boolean)} condition
   * @returns {PropertySchemaBuilder}
   */
  visible(condition) {
    this.#schema.visible = condition;
    return this;
  }

  /**
   * @param {boolean | ((obj: any) => boolean)} condition
   * @returns {PropertySchemaBuilder}
   */
  enabled(condition) {
    this.#schema.enabled = condition;
    return this;
  }

  /**
   * @param {string} section
   * @returns {PropertySchemaBuilder}
   */
  section(section) {
    this.#schema.section = section;
    return this;
  }

  /**
   * @param {PropertySchema[]} properties
   * @returns {PropertySchemaBuilder}
   */
  properties(properties) {
    this.#schema.properties = properties;
    return this;
  }

  /**
   * @param {boolean} collapse
   * @returns {PropertySchemaBuilder}
   */
  collapse(collapse = true) {
    this.#schema.collapse = collapse;
    return this;
  }

  /**
   * @param {string} category
   * @returns {PropertySchemaBuilder}
   */
  category(category) {
    this.#schema.category = category;
    return this;
  }

  /**
   * @returns {PropertySchema}
   */
  build() {
    return { ...this.#schema };
  }
}

/**
 * Factory for common property definitions.
 */
export class PropertyFactory {
  /**
   * @param {string} key
   * @param {string} [label]
   * @returns {PropertySchemaBuilder}
   */
  static string(key, label) {
    return new PropertySchemaBuilder(key, 'string').label(label || key);
  }

  /**
   * @param {string} key
   * @param {string} [label]
   * @param {{min?: number, max?: number, step?: number}} [opts]
   * @returns {PropertySchemaBuilder}
   */
  static number(key, label, opts) {
    const builder = new PropertySchemaBuilder(key, 'number').label(label || key);
    if (opts?.min !== undefined && opts?.max !== undefined) {
      builder.range(opts.min, opts.max, opts.step);
    }
    return builder;
  }

  /**
   * @param {string} key
   * @param {string} [label]
   * @returns {PropertySchemaBuilder}
   */
  static boolean(key, label) {
    return new PropertySchemaBuilder(key, 'boolean').label(label || key);
  }

  /**
   * @param {string} key
   * @param {Array<{label: string, value: any}>} options
   * @param {string} [label]
   * @returns {PropertySchemaBuilder}
   */
  static enum(key, options, label) {
    return new PropertySchemaBuilder(key, 'enum').label(label || key).enum(options);
  }

  /**
   * @param {string} key
   * @param {string} [label]
   * @returns {PropertySchemaBuilder}
   */
  static color(key, label) {
    return new PropertySchemaBuilder(key, 'color').label(label || key);
  }

  /**
   * @param {string} key
   * @param {string} [label]
   * @returns {PropertySchemaBuilder}
   */
  static vec2(key, label) {
    return new PropertySchemaBuilder(key, 'vec2').label(label || key);
  }

  /**
   * @param {string} key
   * @param {string} [label]
   * @returns {PropertySchemaBuilder}
   */
  static vec3(key, label) {
    return new PropertySchemaBuilder(key, 'vec3').label(label || key);
  }

  /**
   * @param {string} key
   * @param {string} [label]
   * @returns {PropertySchemaBuilder}
   */
  static vec4(key, label) {
    return new PropertySchemaBuilder(key, 'vec4').label(label || key);
  }

  /**
   * @param {string} key
   * @param {string} [label]
   * @param {string[]} [extensions]
   * @returns {PropertySchemaBuilder}
   */
  static texture(key, label, extensions) {
    const builder = new PropertySchemaBuilder(key, 'texture').label(label || key);
    if (extensions) {
      builder.textureExtensions(extensions);
    }
    return builder;
  }

  /**
   * @param {string} label
   * @param {PropertySchema[]} properties
   * @param {boolean} [collapsed]
   * @returns {PropertySchema}
   */
  static group(label, properties, collapsed = false) {
    return {
      type: 'group',
      label,
      properties,
      collapse: collapsed,
    };
  }

  /**
   * @param {string} label
   * @param {PropertySchema[]} properties
   * @returns {PropertySchema}
   */
  static section(label, properties) {
    return {
      type: 'group',
      label,
      properties,
      section: label,
    };
  }
}

/**
 * Component Schema Registry - maps components to their property definitions.
 * Similar to Godot's class database system.
 */
export class SchemaRegistry {
  /** @type {Map<string, PropertySchema[]>} */
  static #registry = new Map();

  /**
   * Register a component schema by constructor name or __xmlTag.
   * @param {string} componentKey - Constructor name or __xmlTag (e.g., 'Sprite', 'Camera3D', 'Material')
   * @param {PropertySchema[]} schema
   */
  static register(componentKey, schema) {
    SchemaRegistry.#registry.set(componentKey, schema);
  }

  /**
   * Get schema for a component.
   * @param {any} obj
   * @returns {PropertySchema[] | null}
   */
  static getSchema(obj) {
    if (!obj) return null;

    // Try __xmlTag first (for XML stubs)
    if (typeof obj.__xmlTag === 'string') {
      const xmlSchema = SchemaRegistry.#registry.get(obj.__xmlTag);
      if (xmlSchema) return xmlSchema;
    }

    // Try constructor name
    const className = obj.constructor?.name;
    if (className) {
      return SchemaRegistry.#registry.get(className) || null;
    }

    return null;
  }

  /**
   * Check if a component has a registered schema.
   * @param {any} obj
   * @returns {boolean}
   */
  static hasSchema(obj) {
    return SchemaRegistry.getSchema(obj) !== null;
  }

  /**
   * List all registered component keys.
   * @returns {string[]}
   */
  static listRegistered() {
    return Array.from(SchemaRegistry.#registry.keys());
  }

  /**
   * Clear all schemas (useful for testing).
   */
  static clear() {
    SchemaRegistry.#registry.clear();
  }
}

/**
 * Built-in schema definitions for common Fluxion components.
 */
export class BuiltInSchemas {
  /**
   * Initialize all built-in component schemas.
   */
  static initializeAll() {
    this.registerNodeSchemas();
    this.registerLightSchemas();
    this.registerCameraSchemas();
    this.registerSpriteSchemas();
    this.registerTextSchemas();
    this.registerAudioSchemas();
    this.registerXmlSchemas();
    this.registerMaterialSchemas();
  }

  static registerNodeSchemas() {
    // Base Node schema
    SchemaRegistry.register('Node', [
      PropertyFactory.string('name', 'Name').build(),
      PropertyFactory.boolean('active', 'Active').build(),
      PropertyFactory.boolean('visible', 'Visible').build(),
      PropertyFactory.string('category', 'Category').build(),
    ]);
  }

  static registerLightSchemas() {
    const baseLightProps = [
      PropertyFactory.color('color', 'Color').build(),
      PropertyFactory.number('intensity', 'Intensity', { min: 0, max: 10, step: 0.1 }).build(),
    ];

    SchemaRegistry.register('DirectionalLight', [
      ...baseLightProps,
      PropertyFactory.vec3('direction', 'Direction').build(),
    ]);

    SchemaRegistry.register('PointLight', [
      ...baseLightProps,
      PropertyFactory.vec3('position', 'Position').build(),
      PropertyFactory.number('range', 'Range', { min: 0, max: 1000, step: 1 }).build(),
    ]);

    SchemaRegistry.register('SpotLight', [
      ...baseLightProps,
      PropertyFactory.vec3('position', 'Position').build(),
      PropertyFactory.vec3('direction', 'Direction').build(),
      PropertyFactory.number('range', 'Range', { min: 0, max: 1000, step: 1 }).build(),
      PropertyFactory.number('innerAngleDeg', 'Inner Angle', { min: 0, max: 90, step: 1 }).build(),
      PropertyFactory.number('outerAngleDeg', 'Outer Angle', { min: 0, max: 90, step: 1 }).build(),
    ]);
  }

  static registerCameraSchemas() {
    SchemaRegistry.register('Camera', [
      PropertyFactory.boolean('primary', 'Is Primary').build(),
      PropertyFactory.boolean('followCamera', 'Follow Camera').build(),
      new PropertySchemaBuilder('baseX', 'number')
        .label('Base X')
        .visible(obj => obj.followCamera)
        .build(),
      new PropertySchemaBuilder('baseY', 'number')
        .label('Base Y')
        .visible(obj => obj.followCamera)
        .build(),
    ]);

    SchemaRegistry.register('Camera3D', [
      PropertyFactory.number('fovY', 'FOV Y', { min: 1, max: 180, step: 1 }).build(),
      PropertyFactory.number('near', 'Near Plane', { min: 0.01, max: 100, step: 0.1 }).build(),
      PropertyFactory.number('far', 'Far Plane', { min: 1, max: 10000, step: 1 }).build(),
    ]);
  }

  static registerSpriteSchemas() {
    SchemaRegistry.register('Sprite', [
      PropertyFactory.texture('imageSrc', 'Image', ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp']).build(),
      new PropertySchemaBuilder('opacity', 'number')
        .label('Opacity')
        .range(0, 1, 0.01)
        .build(),
    ]);

    SchemaRegistry.register('AnimatedSprite', [
      PropertyFactory.texture('imageSrc', 'Image', ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp']).build(),
      PropertyFactory.number('frameWidth', 'Frame Width', { min: 1, max: 2048, step: 1 }).build(),
      PropertyFactory.number('frameHeight', 'Frame Height', { min: 1, max: 2048, step: 1 }).build(),
    ]);
  }

  static registerTextSchemas() {
    SchemaRegistry.register('Text', [
      PropertyFactory.string('text', 'Text').build(),
      PropertyFactory.number('fontSize', 'Font Size', { min: 1, max: 256, step: 1 }).build(),
      PropertyFactory.string('fontFamily', 'Font Family').build(),
      PropertyFactory.color('textColor', 'Color').build(),
    ]);
  }

  static registerAudioSchemas() {
    SchemaRegistry.register('Audio', [
      PropertyFactory.texture('src', 'Source', ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac']).build(),
      PropertyFactory.boolean('loop', 'Loop').build(),
      PropertyFactory.boolean('autoplay', 'Autoplay').build(),
      PropertyFactory.boolean('stopOnSceneChange', 'Stop On Scene Change').build(),
      PropertyFactory.number('volume', 'Volume', { min: 0, max: 1, step: 0.01 }).build(),
    ]);
  }

  static registerXmlSchemas() {
    // Font XML stub
    SchemaRegistry.register('Font', [
      PropertyFactory.string('family', 'Family').build(),
      PropertyFactory.texture('src', 'Source', ['.ttf', '.otf']).build(),
    ]);

    // Mesh XML stub
    SchemaRegistry.register('Mesh', [
      PropertyFactory.string('name', 'Name').build(),
      PropertyFactory.string('source', 'Source').build(),
    ]);

    // Skybox XML stub
    SchemaRegistry.register('Skybox', [
      PropertyFactory.string('name', 'Name').build(),
      PropertyFactory.texture('skyboxImage', 'Skybox Image', ['.png', '.jpg', '.jpeg']).build(),
      PropertyFactory.texture('ambientImage', 'Ambient Image', ['.png', '.jpg', '.jpeg']).build(),
    ]);

    // Material XML stub - contains nested PBR properties
    SchemaRegistry.register('Material', [
      PropertyFactory.string('name', 'Name').build(),
      PropertyFactory.string('source', 'Source').build(),

      PropertyFactory.group('Albedo', [
        PropertyFactory.texture('baseColorTexture', 'Texture', ['.png', '.jpg', '.jpeg']).build(),
        PropertyFactory.color('baseColorFactor', 'Color').build(),
      ], false),

      PropertyFactory.group('ORM', [
        PropertyFactory.texture('occlusionTexture', 'Occlusion', ['.png', '.jpg', '.jpeg']).build(),
        PropertyFactory.number('aoStrength', 'AO Strength', { min: 0, max: 2, step: 0.01 }).build(),
        PropertyFactory.texture('metallicRoughnessTexture', 'Metallic-Roughness', ['.png', '.jpg', '.jpeg']).build(),
        PropertyFactory.number('metallicFactor', 'Metallic', { min: 0, max: 1, step: 0.01 }).build(),
        PropertyFactory.number('roughnessFactor', 'Roughness', { min: 0.04, max: 1, step: 0.01 }).build(),
      ], false),

      PropertyFactory.group('Normal Map', [
        PropertyFactory.texture('normalTexture', 'Texture', ['.png', '.jpg', '.jpeg']).build(),
        PropertyFactory.number('normalScale', 'Scale', { min: 0, max: 2, step: 0.01 }).build(),
      ], true),

      PropertyFactory.group('Emission', [
        PropertyFactory.texture('emissiveTexture', 'Texture', ['.png', '.jpg', '.jpeg']).build(),
        PropertyFactory.color('emissiveFactor', 'Color').build(),
      ], true),

      PropertyFactory.group('UV', [
        PropertyFactory.vec2('uvScale', 'Scale').build(),
      ], true),

      PropertyFactory.enum('alphamode', [
        { label: '(default)', value: '' },
        { label: 'OPAQUE', value: 'OPAQUE' },
        { label: 'MASK', value: 'MASK' },
        { label: 'BLEND', value: 'BLEND' },
      ], 'Alpha Mode').build(),
    ]);
  }

  static registerMaterialSchemas() {
    // Runtime Material asset
    SchemaRegistry.register('Material', [
      PropertyFactory.string('name', 'Name').build(),
      PropertyFactory.color('baseColorFactor', 'Base Color').build(),
      PropertyFactory.texture('baseColorTexture', 'Base Color Texture', ['.png', '.jpg', '.jpeg']).build(),
      PropertyFactory.number('metallicFactor', 'Metallic', { min: 0, max: 1, step: 0.01 }).build(),
      PropertyFactory.number('roughnessFactor', 'Roughness', { min: 0.04, max: 1, step: 0.01 }).build(),
      PropertyFactory.texture('metallicRoughnessTexture', 'MR Texture', ['.png', '.jpg', '.jpeg']).build(),
      PropertyFactory.texture('normalTexture', 'Normal Map', ['.png', '.jpg', '.jpeg']).build(),
      PropertyFactory.number('normalScale', 'Normal Scale', { min: 0, max: 2, step: 0.01 }).build(),
    ]);
  }
}

// Auto-initialize built-in schemas on module load
if (typeof window !== 'undefined') {
  BuiltInSchemas.initializeAll();
}
