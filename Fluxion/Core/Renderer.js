import PostProcessing from './PostProcessing.js';
import Camera3D from './Camera3D.js';
import { Mat4 } from './Math3D.js';
import DebugRenderer from './DebugRenderer.js';
import { LightType } from './Lights.js';
import { Vector3 } from './Math3D.js';

/**
 * Handles WebGL rendering, including shader management, resizing, and post-processing.
 */
export default class Renderer {
  /**
   * Creates an instance of Renderer.
   * @param {string} canvasId - The ID of the HTML canvas element.
   * @param {number} [targetWidth=1920] - The target width of the game resolution.
   * @param {number} [targetHeight=1080] - The target height of the game resolution.
   * @param {boolean} [maintainAspectRatio=true] - Whether to maintain the aspect ratio.
   * @param {boolean} [enablePostProcessing=false] - Whether to enable post-processing.
   * @param {{
   *   webglVersion?: 1|2|'webgl1'|'webgl2'|'auto',
   *   allowFallback?: boolean,
    *   contextAttributes?: WebGLContextAttributes,
    *   renderTargets?: {
    *     msaaSamples?: number
    *   }
    *   instancing2D?: boolean
   * }=} options
   */
  constructor(canvasId, targetWidth = 1920, targetHeight = 1080, maintainAspectRatio = true, enablePostProcessing = false, options = {}) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) {
      throw new Error(`Canvas element with id "${canvasId}" not found`);
    }

    /** @type {any} */
    const cfg = (options && typeof options === 'object') ? options : {};
    const requested = cfg.webglVersion ?? 2;
    const allowFallback = cfg.allowFallback !== false;
    const contextAttributes = cfg.contextAttributes;
    const renderTargets = (cfg.renderTargets && typeof cfg.renderTargets === 'object') ? cfg.renderTargets : {};
    const instancing2D = cfg.instancing2D !== false;

    this.requestedWebGLVersion = requested;
    this.allowWebGLFallback = allowFallback;
    this.contextAttributes = contextAttributes;

    const ctx = this._createGLContext(requested, allowFallback, contextAttributes);
    this.gl = ctx.gl;
    this.isWebGL2 = ctx.isWebGL2;
    this.webglContextName = ctx.contextName;
    this._loggedContextInfo = false;

    // WebGL2-only: use instanced rendering for 2D sprites (default true).
    // Falls back automatically to the legacy quad-vertex batching path.
    this.instancing2D = !!instancing2D;

    // 3D pass (layer 0) groundwork
    this._in3DPass = false;
    this._defaultCamera3D = new Camera3D();
    this._identityModel3D = Mat4.identity();
    this.program3D = null;
    this._program3DAttribs = null;
    this._program3DUniforms = null;
    
    // Skybox support
    this.skyboxProgram = null;
    this._skyboxAttribs = null;
    this._skyboxUniforms = null;
    this.currentSkybox = null;

    // --- Directional shadow mapping (WebGL2) ---
    this.shadowsEnabled = true;
    this.shadowMapSize = 1024;
    this.shadowBias = 0.0025;
    this.shadowOrthoSize = 25.0;
    this.shadowNear = 0.1;
    this.shadowFar = 80.0;
    // Cascaded Shadow Maps (CSM)
    this.csmEnabled = true;
    this.csmCascadeCount = 4; // 1..4
    this.csmSplitLambda = 0.6; // 0 = linear, 1 = logarithmic
    this.csmBlend = 0.15; // 0..0.5 (fraction of cascade length)
    this.csmMaxDistance = 0.0; // 0 = use camera far; otherwise clamp CSM range

    // --- Contact shadows (screen/view-space micro-occlusion) ---
    this.contactShadowsEnabled = true;
    this.contactShadowStrength = 0.35; // subtle by default
    this.contactShadowMaxDistance = 0.35; // world units along ray
    this.contactShadowSteps = 12;
    this.contactShadowThickness = 0.0015; // depth thickness in clip depth units

    this.depthPrepassProgram = null;
    this._depthPrepassAttribs = null;
    this._depthPrepassUniforms = null;
    this.sceneDepthFramebuffer = null;
    this.sceneDepthTexture = null;
    this._sceneDepthW = 0;
    this._sceneDepthH = 0;
    // Shadow filtering / quality
    // 1 = hard (PS2 style), 3 or 5 = PCF kernel size
    this.shadowPcfKernel = 3;
    // Radius in texels for PCF taps (uniform softness across scene)
    this.shadowPcfRadius = 1.25;
    // Fade shadows out with camera distance (world units)
    this.shadowFadeStart = 35.0;
    this.shadowFadeEnd = 90.0;
    // If true, shadows also darken INDIRECT diffuse (ambient + diffuse IBL). Emissive is never affected.
    this.shadowAffectsIndirect = true;
    // Shadow strength (0..1). 0 disables shadowing without disabling the shadow pass.
    this.shadowStrength = 1.0;

    this.shadowProgram = null;
    this._shadowAttribs = null;
    this._shadowUniforms = null;
    this.shadowFramebuffer = null;
    this.shadowDepthTexture = null;
    this._shadowLightViewProj = Mat4.identity();
    this._shadowReady = false;
    this._inShadowPass = false;
    this._shadowPrevFb = null;
    this._shadowPrevVp = null;

    // Scratch vectors/matrices for shadow computations
    this._shadowLightPos = new Vector3();
    this._shadowTarget = new Vector3();
    this._shadowUp = new Vector3(0, 1, 0);
    this._shadowView = Mat4.identity();
    this._shadowProj = Mat4.identity();

    // CSM data (packed for uniform upload)
    this._csmLightViewProjData = new Float32Array(16 * 4);
    this._csmSplitsData = new Float32Array(4);
    this._csmNearUsed = 0.1;
    this._csmFarUsed = 100.0;
    // Scratch for frustum corner computation
    this._csmCorners = [
      new Vector3(), new Vector3(), new Vector3(), new Vector3(),
      new Vector3(), new Vector3(), new Vector3(), new Vector3(),
    ];
    this._csmTmp = {
      forward: new Vector3(),
      right: new Vector3(),
      up: new Vector3(),
      centerNear: new Vector3(),
      centerFar: new Vector3(),
      center: new Vector3(),
      lightPos: new Vector3(),
      tmpP: new Vector3(),
    };

    // PBR lighting defaults (can be overridden by game code)
    // Direction is the direction light rays travel (world space).
    this.pbrLightDirection = [0.5, -1.0, 0.3];
    this.pbrLightColor = [1.0, 1.0, 1.0];
    this.pbrAmbientColor = [0.03, 0.03, 0.03];
    // HDR exposure for tone mapping (1.0 = neutral)
    this.pbrExposure = 1.0;

    // Environment lighting (IBL via skybox)
    this.pbrEnvIntensity = 1.0;

    // Real-time lights (PBR): use fixed-size uniform arrays for speed.
    this.maxPbrLights = 8;
    /** @type {any[]} */
    this._sceneLights = [];
    /** @type {any[] | null} */
    this._overrideLights = null;

    // --- Material debug view (3D PBR) ---
    // 0 = OFF, 1 = BaseColor, 2 = Metallic, 3 = Roughness, 4 = Normal, 5 = Ambient Occlusion
    this.materialDebugView = 0;

    // Scratch buffers to avoid per-draw allocations
    this._tmpInvModel = new Float32Array(16);
    this._tmpInvModelT = new Float32Array(16);
    this._normalMatrix3 = new Float32Array(9);

    // Scratch arrays for uploading light uniforms
    this._lightPosTypeData = null;
    this._lightDirInnerData = null;
    this._lightColorIntensityData = null;
    this._lightParamsData = null;

    if (!this.gl) {
      const wantedLabel = (requested === 1 || requested === 'webgl1') ? 'WebGL 1' : (requested === 2 || requested === 'webgl2') ? 'WebGL 2' : 'WebGL';
      alert(`${wantedLabel} not supported!`);
      return;
    }

    // Validate and sanitize input parameters
    // Ensure targetWidth is a valid positive number
    if (typeof targetWidth !== 'number' || !isFinite(targetWidth) || targetWidth <= 0) {
      console.warn(`Invalid targetWidth: ${targetWidth}. Defaulting to 1920.`);
      targetWidth = 1920;
    }

    // Ensure targetHeight is a valid positive number
    if (typeof targetHeight !== 'number' || !isFinite(targetHeight) || targetHeight <= 0) {
      console.warn(`Invalid targetHeight: ${targetHeight}. Defaulting to 1080.`);
      targetHeight = 1080;
    }

    // Ensure maintainAspectRatio is a boolean
    if (typeof maintainAspectRatio !== 'boolean') {
      console.warn(`Invalid maintainAspectRatio: ${maintainAspectRatio}. Defaulting to true.`);
      maintainAspectRatio = true;
    }

    this.targetWidth = targetWidth;
    this.targetHeight = targetHeight;
    this.targetAspectRatio = targetWidth / targetHeight;
    this.maintainAspectRatio = maintainAspectRatio;
    this.enablePostProcessing = enablePostProcessing;
    this.postProcessing = null;

    this.viewport = { x: 0, y: 0, width: 1, height: 1 };
    this.currentAspectRatio = this.targetAspectRatio;

    this.mainScreenFramebuffer = null;
    this.mainScreenTexture = null;

    // WebGL2 render-target improvements (optional)
    this.mainScreenDepthStencilRbo = null;
    this.mainScreenMsaaFramebuffer = null;
    this.mainScreenMsaaColorRbo = null;
    this.mainScreenMsaaDepthStencilRbo = null;
    this.mainScreenMsaaSamples = Math.max(0, (renderTargets.msaaSamples ?? 0) | 0);
    this._activeMainScreenMsaaSamples = 0;
    
    // Performance optimizations
    // Texture cache entries: cacheKey -> { texture, refCount, bytes, lastUsedFrame }
    this.textureCache = new Map();
    this._textureToCacheKey = new WeakMap();
    // Store texture dimensions (WebGLTexture doesn't have width/height properties)
    this._textureDimensions = new WeakMap();
    this._frameId = 0;
    this._cacheLimits = {
      maxTextures: Infinity,
      maxBytes: Infinity,
    };
    this._cacheBytes = 0;
    this.drawCallCount = 0; // Track draw calls for profiling
    this.lastFrameDrawCalls = 0;

    // Per-frame stats
    this._spritesThisFrame = 0;
    this.lastFrameSprites = 0;
    this._instancedDrawCallsThisFrame = 0;
    this._legacyDrawCallsThisFrame = 0;
    this.lastFrameInstancedDrawCalls = 0;
    this.lastFrameLegacyDrawCalls = 0;
    this._usedInstancingThisFrame = false;
    this.lastFrameUsedInstancing = false;

    // Asset tracking (textures/audio/etc). Used for splash screens / loading flows.
    this._pendingAssets = new Set();
    
    this.isReady = false; // Track initialization state
    this.readyPromise = null; // Store the initialization promise
    
    // Debug renderer for drawing lines, shapes, and debug text
    this.debug = new DebugRenderer(this);
    
    this.resizeCanvas();
    
    // Debounce resize events for better performance
    this._resizeAnimationFrame = null;
    this._resizeHandler = () => {
      if (this._resizeAnimationFrame) {
        cancelAnimationFrame(this._resizeAnimationFrame);
      }
      this._resizeAnimationFrame = requestAnimationFrame(() => {
        this._resizeAnimationFrame = null;
        this.resizeCanvas();

        // Keep post-processing buffers in sync with the canvas size
        if (this.enablePostProcessing && this.postProcessing) {
            this.postProcessing.resize(this.canvas.width, this.canvas.height);
        }
      });
    };
    window.addEventListener("resize", this._resizeHandler);

    this.canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      console.warn('WebGL context lost! Attempting to restore...');
      this.isReady = false;
      // Don't alert - just log, as context restoration is usually automatic
    });

    this.canvas.addEventListener('webglcontextrestored', async () => {
      console.log('WebGL context restored! Reinitializing...');
      // Some browsers restore the same context object. Re-acquire defensively.
      if (!this.gl) {
        const restored = this._createGLContext(this.requestedWebGLVersion, this.allowWebGLFallback, this.contextAttributes);
        if (!restored.gl) {
          console.error('Failed to restore WebGL context');
          return;
        }
        this.gl = restored.gl;
        this.isWebGL2 = restored.isWebGL2;
        this.webglContextName = restored.contextName;
      }
      try {
        await this.initGL();
        this.isReady = true;
        console.log('WebGL context successfully restored');
      } catch (error) {
        console.error('Failed to reinitialize WebGL after context restore:', error);
      }
    });

    // Initialize shaders asynchronously and store the promise
    this.readyPromise = this.initGL().then(() => {
      this.isReady = true;
    });
  } 

  /**
   * Enable/disable MSAA for the main offscreen render target.
   *
   * Notes:
   * - This MSAA path only applies to the offscreen post-processing input target.
   * - Changing the sample count reallocates GPU renderbuffers (do it on a frame boundary).
   *
   * @param {number} samples 0 disables MSAA; 1-4 enables it.
   * @returns {boolean} true if applied (or queued), false if not supported/usable.
   */
  setMsaaSamples(samples) {
    const raw = Number(samples);
    if (!Number.isFinite(raw)) {
      console.warn('Renderer.setMsaaSamples: samples must be a finite number');
      return false;
    }

    // Requested API: clamp to 1-4 when enabling; allow 0 to disable.
    let desired = raw | 0;
    if (desired < 0) desired = 0;
    if (desired > 4) desired = 4;

    // This MSAA implementation is WebGL2-only.
    if (!this.isWebGL2) {
      this.mainScreenMsaaSamples = 0;
      this._activeMainScreenMsaaSamples = 0;
      console.warn('Renderer.setMsaaSamples: MSAA render targets require WebGL2');
      return false;
    }

    // This MSAA implementation is only used when post-processing is enabled.
    if (!this.enablePostProcessing) {
      console.warn('Renderer.setMsaaSamples: enablePostProcessing must be true to use MSAA render targets');
      return false;
    }

    // Clamp to device capabilities.
    try {
      const maxSamples = this.gl.getParameter(this.gl.MAX_SAMPLES) | 0;
      if (maxSamples > 0) desired = Math.min(desired, maxSamples);
    } catch {
      // ignore
    }

    this.mainScreenMsaaSamples = desired;
    this.ensureMainScreenTargets();
    return true;
  }

  /** @param {number} [samples=4] */
  enableMsaa(samples = 4) {
    return this.setMsaaSamples(samples);
  }

  disableMsaa() {
    return this.setMsaaSamples(0);
  }

  /** Returns the currently active MSAA sample count (0 if disabled/unavailable). */
  getMsaaSamples() {
    return (this._activeMainScreenMsaaSamples | 0) || 0;
  }

  /** Returns the currently requested MSAA sample count (0 if disabled). */
  getRequestedMsaaSamples() {
    return (this.mainScreenMsaaSamples | 0) || 0;
  }

  /**
   * Create a WebGL context with requested version and fallback rules.
   * @param {1|2|'webgl1'|'webgl2'|'auto'|any} requested
   * @param {boolean} allowFallback
   * @param {WebGLContextAttributes=} contextAttributes
   * @returns {{gl: (WebGLRenderingContext|WebGL2RenderingContext|null), isWebGL2: boolean, contextName: string|null}}
   */
  _createGLContext(requested, allowFallback, contextAttributes) {
    /** @type {string[]} */
    let tryOrder;

    const req = (requested === 1) ? 'webgl1'
      : (requested === 2) ? 'webgl2'
      : (requested === 'webgl1' || requested === 'webgl2' || requested === 'auto') ? requested
      : 'webgl2';

    if (req === 'webgl1') {
      tryOrder = ['webgl', 'experimental-webgl'];
      if (allowFallback) tryOrder.push('webgl2');
    } else if (req === 'webgl2') {
      tryOrder = ['webgl2'];
      if (allowFallback) tryOrder.push('webgl', 'experimental-webgl');
    } else {
      // auto
      tryOrder = ['webgl2', 'webgl', 'experimental-webgl'];
    }

    /** @type {WebGLRenderingContext|WebGL2RenderingContext|null} */
    let gl = null;
    /** @type {string|null} */
    let contextName = null;

    for (const name of tryOrder) {
      try {
        gl = this.canvas.getContext(name, contextAttributes);
      } catch {
        gl = null;
      }
      if (gl) {
        contextName = name;
        break;
      }
    }

    return {
      gl,
      isWebGL2: contextName === 'webgl2',
      contextName,
    };
  }

  /**
   * Returns true if a texture is already cached for a given key.
   * @param {string} cacheKey
   */
  hasCachedTexture(cacheKey) {
    return !!cacheKey && this.textureCache.has(cacheKey);
  }

  /**
   * Gets a cached texture by key, or null.
   * @param {string} cacheKey
   */
  getCachedTexture(cacheKey) {
    if (!cacheKey) return null;
    const entry = this.textureCache.get(cacheKey);
    return entry ? entry.texture : null;
  }

  /**
   * Configure texture cache limits.
   * @param {{maxTextures?: number, maxBytes?: number}} limits
   */
  setTextureCacheLimits(limits = {}) {
    if (limits && typeof limits === 'object') {
      if (typeof limits.maxTextures === 'number' && isFinite(limits.maxTextures) && limits.maxTextures > 0) {
        this._cacheLimits.maxTextures = limits.maxTextures;
      }
      if (typeof limits.maxBytes === 'number' && isFinite(limits.maxBytes) && limits.maxBytes > 0) {
        this._cacheLimits.maxBytes = limits.maxBytes;
      }
    }
    this._evictIfNeeded();
  }

  /**
   * Increment ref-count for a cached texture key and return the WebGLTexture.
   * @param {string} cacheKey
   * @returns {WebGLTexture|null}
   */
  acquireTexture(cacheKey) {
    if (!cacheKey) return null;
    const entry = this.textureCache.get(cacheKey);
    if (!entry) return null;
    entry.refCount++;
    entry.lastUsedFrame = this._frameId;
    return entry.texture;
  }

  /**
   * Decrement ref-count for a cached texture key.
   * If cache is over limits, unused (refCount==0) textures are evicted by LRU.
   * @param {string} cacheKey
   */
  releaseTexture(cacheKey) {
    if (!cacheKey) return;
    const entry = this.textureCache.get(cacheKey);
    if (!entry) return;
    entry.refCount = Math.max(0, entry.refCount - 1);
    this._evictIfNeeded();
  }

  _estimateTextureBytes(width, height) {
    const w = Math.max(0, width | 0);
    const h = Math.max(0, height | 0);
    // Approx RGBA8. (Mips not included; this is a heuristic for budgeting.)
    return w * h * 4;
  }

  _setCacheEntry(cacheKey, texture, bytes) {
    if (!cacheKey) return;

    const existing = this.textureCache.get(cacheKey);
    if (existing) {
      // Keep refCount/usage; replace texture handle + byte accounting.
      this._cacheBytes -= existing.bytes || 0;
      existing.texture = texture;
      existing.bytes = bytes || 0;
      existing.lastUsedFrame = this._frameId;
      this._cacheBytes += existing.bytes;
      this._textureToCacheKey.set(texture, cacheKey);
      return;
    }

    const entry = {
      texture,
      refCount: 0,
      bytes: bytes || 0,
      lastUsedFrame: this._frameId,
    };
    this.textureCache.set(cacheKey, entry);
    this._textureToCacheKey.set(texture, cacheKey);
    this._cacheBytes += entry.bytes;
  }

  /**
   * Create a texture and immediately acquire it (refCount++).
   * This is the preferred API for sprites/animations.
   * @param {HTMLImageElement|HTMLCanvasElement|ImageBitmap} image
   * @param {string} cacheKey
   */
  createAndAcquireTexture(image, cacheKey) {
    if (!cacheKey) {
      // No key: behave like createTexture (no caching).
      return this.createTexture(image, null);
    }

    const existing = this.textureCache.get(cacheKey);
    if (existing && existing.texture) {
      existing.refCount++;
      existing.lastUsedFrame = this._frameId;
      return existing.texture;
    }

    const texture = this.createTexture(image, cacheKey);
    // createTexture will call _setCacheEntry; now acquire.
    const entry = this.textureCache.get(cacheKey);
    if (entry) {
      entry.refCount++;
      entry.lastUsedFrame = this._frameId;
    }
    this._evictIfNeeded();
    return texture;
  }

  _evictIfNeeded() {
    if (!isFinite(this._cacheLimits.maxTextures) && !isFinite(this._cacheLimits.maxBytes)) return;

    const overTextures = this.textureCache.size > this._cacheLimits.maxTextures;
    const overBytes = this._cacheBytes > this._cacheLimits.maxBytes;
    if (!overTextures && !overBytes) return;

    // Evict only entries that are not referenced by any live object (refCount==0).
    // Use least-recently-used (oldest lastUsedFrame) first.
    /** @type {Array<[string, any]>} */
    const candidates = [];
    for (const [key, entry] of this.textureCache.entries()) {
      if (!entry || !entry.texture) continue;
      if ((entry.refCount || 0) === 0) candidates.push([key, entry]);
    }
    if (candidates.length === 0) return;

    candidates.sort((a, b) => (a[1].lastUsedFrame || 0) - (b[1].lastUsedFrame || 0));

    for (const [key, entry] of candidates) {
      const stillOverTextures = this.textureCache.size > this._cacheLimits.maxTextures;
      const stillOverBytes = this._cacheBytes > this._cacheLimits.maxBytes;
      if (!stillOverTextures && !stillOverBytes) break;

      this.gl.deleteTexture(entry.texture);
      this._cacheBytes -= entry.bytes || 0;
      this.textureCache.delete(key);
      // WeakMap entries will go away naturally.
    }
  }

  /**
   * Track a promise representing an asset load.
   * The promise is removed once it settles.
   * @template T
   * @param {Promise<T>} promise
   * @returns {Promise<T>}
   */
  trackAssetPromise(promise) {
    if (!promise || typeof promise.then !== 'function') return promise;

    this._pendingAssets.add(promise);
    promise.finally(() => {
      this._pendingAssets.delete(promise);
    });
    return promise;
  }

  /**
   * Number of pending tracked asset promises.
   */
  getPendingAssetCount() {
    return this._pendingAssets.size;
  }

  /**
   * Wait until all currently tracked assets have settled.
   * If new assets are tracked while waiting, they are also awaited.
   * @param {{timeoutMs?: number}} [opts]
   */
  async waitForTrackedAssets(opts = {}) {
    const timeoutMs = typeof opts.timeoutMs === 'number' ? opts.timeoutMs : 30000;
    const start = performance.now();

    // Loop until stable empty.
    while (this._pendingAssets.size > 0) {
      if (performance.now() - start > timeoutMs) {
        console.warn(`[Renderer] waitForTrackedAssets timed out with ${this._pendingAssets.size} pending assets.`);
        return;
      }

      const snapshot = Array.from(this._pendingAssets);
      await Promise.allSettled(snapshot);
    }
  }

  /**
   * Resizes the canvas to fit the window, maintaining aspect ratio if configured.
   */
  resizeCanvas() {
    const dpi = window.devicePixelRatio || 1;
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    if (this.maintainAspectRatio) {
      const windowAspectRatio = windowWidth / windowHeight;
      
      let viewportX = 0, viewportY = 0;
      let viewportWidth, viewportHeight;

      if (windowAspectRatio > this.targetAspectRatio) {
        // Window is wider than target - add black bars on sides
        const canvasHeight = windowHeight;
        const canvasWidth = canvasHeight * this.targetAspectRatio;
        
        viewportWidth = canvasWidth * dpi;
        viewportHeight = canvasHeight * dpi;
        viewportX = ((windowWidth - canvasWidth) / 2) * dpi;
      } else {
        // Window is taller than target - add black bars on top/bottom
        const canvasWidth = windowWidth;
        const canvasHeight = canvasWidth / this.targetAspectRatio;
        
        viewportWidth = canvasWidth * dpi;
        viewportHeight = canvasHeight * dpi;
        viewportY = ((windowHeight - canvasHeight) / 2) * dpi;
      }

      // Set canvas pixel size to full window
      this.canvas.width = windowWidth * dpi;
      this.canvas.height = windowHeight * dpi;

      // Set canvas DOM size
      this.canvas.style.width = windowWidth + 'px';
      this.canvas.style.height = windowHeight + 'px';

      // Store viewport info (pixels)
      this.viewport.x = Math.round(viewportX);
      this.viewport.width = Math.round(viewportWidth);
      this.viewport.height = Math.round(viewportHeight);

      // IMPORTANT: WebGL viewport Y is measured from the bottom of the drawing buffer.
      // Our computed viewportY is measured from the top (DOM-style). Convert it.
      const viewportBottomY = (this.canvas.height - viewportY - viewportHeight);
      this.viewport.y = Math.round(viewportBottomY);
      this.currentAspectRatio = this.viewport.width / this.viewport.height;

      // Set viewport to maintain aspect ratio with letterboxing
      this.gl.viewport(this.viewport.x, this.viewport.y, this.viewport.width, this.viewport.height);
    } else {
      // Original stretching behavior
      this.canvas.width = windowWidth * dpi;
      this.canvas.height = windowHeight * dpi;
      this.canvas.style.width = windowWidth + 'px';
      this.canvas.style.height = windowHeight + 'px';

      this.viewport.x = 0;
      this.viewport.y = 0;
      this.viewport.width = this.canvas.width;
      this.viewport.height = this.canvas.height;
      this.currentAspectRatio = this.viewport.width / this.viewport.height;

      this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    }
    
    this.ensureMainScreenTargets();
  }

  /**
   * Ensures that the main screen framebuffer and texture are created and sized correctly.
   */
  ensureMainScreenTargets() {
    // Main screen targets are only needed when post-processing is enabled.
    if (!this.enablePostProcessing) return;

    const desiredWidth = this.canvas.width;
    const desiredHeight = this.canvas.height;

    const gl = this.gl;

    // Clamp requested MSAA (0 disables). API target: 1-4.
    let requestedSamples = (this.mainScreenMsaaSamples | 0);
    if (requestedSamples < 0) requestedSamples = 0;
    if (requestedSamples > 4) requestedSamples = 4;

    if (this.isWebGL2 && requestedSamples > 0) {
      try {
        const maxSamples = gl.getParameter(gl.MAX_SAMPLES) | 0;
        if (maxSamples > 0) requestedSamples = Math.min(requestedSamples, maxSamples);
      } catch {
        // ignore
      }
    }

    const wantMsaa = this.isWebGL2 && requestedSamples > 0;

    // WebGLTexture objects do not expose width/height. Track dimensions ourselves.
    // (Use unique variable names here; the function later declares currentDims/currentWidth/currentHeight.)
    const _msDims = this.mainScreenTexture ? this._textureDimensions.get(this.mainScreenTexture) : null;
    const _msW = _msDims ? (_msDims.width | 0) : 0;
    const _msH = _msDims ? (_msDims.height | 0) : 0;

    const sizeChanged =
      !this.mainScreenTexture ||
      (_msW !== (desiredWidth | 0) || _msH !== (desiredHeight | 0));

    const msaaStateChanged = wantMsaa ? (!this.mainScreenMsaaFramebuffer) : (!!this.mainScreenMsaaFramebuffer);
    const msaaSamplesChanged = wantMsaa && (this._activeMainScreenMsaaSamples !== requestedSamples);

    if (sizeChanged || msaaStateChanged || msaaSamplesChanged) {
      // Dispose old resources (safe to call with nulls)
      if (this.mainScreenFramebuffer) gl.deleteFramebuffer(this.mainScreenFramebuffer);
      if (this.mainScreenTexture) gl.deleteTexture(this.mainScreenTexture);
      if (this.mainScreenDepthStencilRbo) gl.deleteRenderbuffer(this.mainScreenDepthStencilRbo);
      if (this.mainScreenMsaaFramebuffer) gl.deleteFramebuffer(this.mainScreenMsaaFramebuffer);
      if (this.mainScreenMsaaColorRbo) gl.deleteRenderbuffer(this.mainScreenMsaaColorRbo);
      if (this.mainScreenMsaaDepthStencilRbo) gl.deleteRenderbuffer(this.mainScreenMsaaDepthStencilRbo);

      this.mainScreenFramebuffer = null;
      this.mainScreenTexture = null;
      this.mainScreenDepthStencilRbo = null;
      this.mainScreenMsaaFramebuffer = null;
      this.mainScreenMsaaColorRbo = null;
      this.mainScreenMsaaDepthStencilRbo = null;
      this._activeMainScreenMsaaSamples = 0;
    }

    if (!this.mainScreenFramebuffer) {
      this.mainScreenFramebuffer = gl.createFramebuffer();
    }
    if (!this.mainScreenTexture) {
      this.mainScreenTexture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this.mainScreenTexture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }

    // Check if we need to resize the texture
    // Store dimensions separately (WebGLTexture doesn't have width/height properties)
    const currentDims = this._textureDimensions.get(this.mainScreenTexture);
    const currentWidth = currentDims ? currentDims.width : 0;
    const currentHeight = currentDims ? currentDims.height : 0;
    
    if (currentWidth !== desiredWidth || currentHeight !== desiredHeight) {
      this._textureDimensions.set(this.mainScreenTexture, { width: desiredWidth, height: desiredHeight });

      gl.bindTexture(gl.TEXTURE_2D, this.mainScreenTexture);

      if (this.isWebGL2 && typeof gl.texStorage2D === 'function') {
        // WebGL2: immutable storage with a sized internal format
        gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, desiredWidth, desiredHeight);
      } else {
        // WebGL1 fallback
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          desiredWidth,
          desiredHeight,
          0,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          null
        );
      }

      // Resolve target framebuffer (texture-backed)
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.mainScreenFramebuffer);
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        this.mainScreenTexture,
        0
      );

      // Optional depth-stencil for scene rendering (useful for 3D / depth-aware effects)
      if (this.isWebGL2) {
        if (!this.mainScreenDepthStencilRbo) {
          this.mainScreenDepthStencilRbo = gl.createRenderbuffer();
        }
        gl.bindRenderbuffer(gl.RENDERBUFFER, this.mainScreenDepthStencilRbo);
        gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH24_STENCIL8, desiredWidth, desiredHeight);
        gl.framebufferRenderbuffer(
          gl.FRAMEBUFFER,
          gl.DEPTH_STENCIL_ATTACHMENT,
          gl.RENDERBUFFER,
          this.mainScreenDepthStencilRbo
        );
        gl.bindRenderbuffer(gl.RENDERBUFFER, null);
      }

      // Check resolve framebuffer status
      {
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.mainScreenFramebuffer);
        const resolveStatus = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
        if (resolveStatus !== gl.FRAMEBUFFER_COMPLETE) {
          console.error('Resolve framebuffer is not complete: ' + resolveStatus);
        }
      }

      // Optional MSAA render target (WebGL2 only): render into multisampled renderbuffers, then resolve into texture
      if (wantMsaa && this.isWebGL2 && typeof gl.renderbufferStorageMultisample === 'function') {
        this.mainScreenMsaaFramebuffer = gl.createFramebuffer();
        this.mainScreenMsaaColorRbo = gl.createRenderbuffer();
        this.mainScreenMsaaDepthStencilRbo = gl.createRenderbuffer();

        gl.bindFramebuffer(gl.FRAMEBUFFER, this.mainScreenMsaaFramebuffer);

        gl.bindRenderbuffer(gl.RENDERBUFFER, this.mainScreenMsaaColorRbo);
        gl.renderbufferStorageMultisample(
          gl.RENDERBUFFER,
          requestedSamples,
          gl.RGBA8,
          desiredWidth,
          desiredHeight
        );
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, this.mainScreenMsaaColorRbo);

        gl.bindRenderbuffer(gl.RENDERBUFFER, this.mainScreenMsaaDepthStencilRbo);
        gl.renderbufferStorageMultisample(
          gl.RENDERBUFFER,
          requestedSamples,
          gl.DEPTH24_STENCIL8,
          desiredWidth,
          desiredHeight
        );
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_STENCIL_ATTACHMENT, gl.RENDERBUFFER, this.mainScreenMsaaDepthStencilRbo);

        gl.bindRenderbuffer(gl.RENDERBUFFER, null);

        // Check MSAA framebuffer status
        const msaaStatus = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
        if (msaaStatus !== gl.FRAMEBUFFER_COMPLETE) {
          console.error('MSAA framebuffer is not complete: ' + msaaStatus);
          gl.deleteFramebuffer(this.mainScreenMsaaFramebuffer);
          gl.deleteRenderbuffer(this.mainScreenMsaaColorRbo);
          gl.deleteRenderbuffer(this.mainScreenMsaaDepthStencilRbo);
          this.mainScreenMsaaFramebuffer = null;
          this.mainScreenMsaaColorRbo = null;
          this.mainScreenMsaaDepthStencilRbo = null;
          this._activeMainScreenMsaaSamples = 0;
        } else {
          this._activeMainScreenMsaaSamples = requestedSamples;
        }
      }

      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.bindTexture(gl.TEXTURE_2D, null);
    }
  }

  /**
   * If MSAA is enabled for the main screen target, resolves it into the texture-backed framebuffer.
   */
  resolveMainScreenTargetIfNeeded() {
    if (!this.enablePostProcessing) return;
    if (!this.isWebGL2) return;
    if (!this.mainScreenMsaaFramebuffer || !this.mainScreenFramebuffer) return;
    if (!this.mainScreenTexture) return;

    const gl = this.gl;
    const dims = this._textureDimensions.get(this.mainScreenTexture);
    if (!dims) return;
    const w = dims.width | 0;
    const h = dims.height | 0;
    if (w <= 0 || h <= 0) return;

    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.mainScreenMsaaFramebuffer);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.mainScreenFramebuffer);
    gl.blitFramebuffer(0, 0, w, h, 0, 0, w, h, gl.COLOR_BUFFER_BIT, gl.NEAREST);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
  }

  /**
   * Loads a shader file from a URL.
   * @param {string} url - The URL of the shader file.
   * @returns {Promise<string>} The shader source code.
   * @throws {Error} If the shader file fails to load.
   */
  async loadShaderFile(url) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to load shader: ${url}`);
      }
      return await response.text();
    } catch (error) {
      console.error('Error loading shader file:', error);
      throw error;
    }
  }
  

  /**
   * Initializes WebGL, including shaders, buffers, and post-processing.
   * @returns {Promise<void>}
   */
  async initGL() {
    if (!this._loggedContextInfo && this.gl) {
      this._loggedContextInfo = true;
      try {
        const gl = this.gl;
        const version = gl.getParameter(gl.VERSION);
        const shadingLang = gl.getParameter(gl.SHADING_LANGUAGE_VERSION);
        console.log(`Fluxion Renderer: ${this.webglContextName || 'unknown'} (WebGL2=${this.isWebGL2})`);
        console.log(`  GL_VERSION: ${version}`);
        console.log(`  GLSL: ${shadingLang}`);
      } catch (e) {
        console.log(`Fluxion Renderer: ${this.webglContextName || 'unknown'} (WebGL2=${this.isWebGL2})`);
      }
    }

    this.gl.clearColor(0, 0, 0, 1);
    this.gl.enable(this.gl.BLEND);
    this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);

    // Load shaders from files.
    // Use dedicated GLSL 3.00 ES sources for WebGL2 and keep GLSL 1.00 sources for WebGL1 fallback.
    const vertexShaderPath = this.isWebGL2
      ? '../../Fluxion/Shaders/vertex_300es.glsl'
      : '../../Fluxion/Shaders/vertex.glsl';
    const fragmentShaderPath = this.isWebGL2
      ? '../../Fluxion/Shaders/fragment_300es.glsl'
      : '../../Fluxion/Shaders/fragment.glsl';

    const instancedVertexShaderPath = '../../Fluxion/Shaders/vertex_instanced_300es.glsl';
    const vertex3DShaderPath = '../../Fluxion/Shaders/vertex3d_300es.glsl';
    const fragment3DShaderPath = '../../Fluxion/Shaders/fragment3d_300es.glsl';
    const skyboxVertexShaderPath = '../../Fluxion/Shaders/skybox_vertex_300es.glsl';
    const skyboxFragmentShaderPath = '../../Fluxion/Shaders/skybox_fragment_300es.glsl';
    const shadowVertexShaderPath = '../../Fluxion/Shaders/shadow_depth_vertex_300es.glsl';
    const shadowFragmentShaderPath = '../../Fluxion/Shaders/shadow_depth_fragment_300es.glsl';
    const depthPrepassVertexShaderPath = '../../Fluxion/Shaders/depth_prepass_vertex_300es.glsl';
    const depthPrepassFragmentShaderPath = '../../Fluxion/Shaders/depth_prepass_fragment_300es.glsl';

    const vertexShaderSource = await this.loadShaderFile(vertexShaderPath);
    const fragmentShaderSource = await this.loadShaderFile(fragmentShaderPath);

    // Create shaders
    this.vertexShader = this.createShader(this.gl.VERTEX_SHADER, vertexShaderSource);
    this.fragmentShader = this.createShader(this.gl.FRAGMENT_SHADER, fragmentShaderSource);
  
    if (!this.vertexShader || !this.fragmentShader) {
      throw new Error("Shader compilation failed. Renderer initialization aborted.");
    }

    this.program = this.createProgram(this.vertexShader, this.fragmentShader);
    if (!this.program) {
      throw new Error("Program linking failed. Renderer initialization aborted.");
    }

    // Optional WebGL2 instanced sprite program
    this.instancedProgram = null;
    this.instancedVertexShader = null;
    this._instancedAttribs = null;
    this._instancedUniforms = null;
    this.instancedVao = null;
    this.instanceBuffer = null;
    this.baseQuadBuffer = null;
    this._baseQuadStride = 0;
    this._instanceStride = 0;
    this._instanceFloats = 0;
    this.instanceData = null;

    if (this.isWebGL2 && this.instancing2D) {
      try {
        const instancedVertexSource = await this.loadShaderFile(instancedVertexShaderPath);
        this.instancedVertexShader = this.createShader(this.gl.VERTEX_SHADER, instancedVertexSource);
        if (this.instancedVertexShader) {
          this.instancedProgram = this.createProgram(this.instancedVertexShader, this.fragmentShader);
        }
      } catch (e) {
        // If instanced shader fails to load/compile/link, continue with legacy batching.
        this.instancedProgram = null;
      }
    }

    // Optional 3D program (WebGL2 groundwork)
    if (this.isWebGL2) {
      try {
        const v3 = await this.loadShaderFile(vertex3DShaderPath);
        const f3 = await this.loadShaderFile(fragment3DShaderPath);
        const vs3 = this.createShader(this.gl.VERTEX_SHADER, v3);
        const fs3 = this.createShader(this.gl.FRAGMENT_SHADER, f3);
        if (vs3 && fs3) {
          this.program3D = this.createProgram(vs3, fs3);
          if (this.program3D) {
            // PBR attribute layout (see Shaders/vertex3d_300es.glsl)
            this._program3DAttribs = {
              position: this.gl.getAttribLocation(this.program3D, 'a_position'),
              normal: this.gl.getAttribLocation(this.program3D, 'a_normal'),
              uv: this.gl.getAttribLocation(this.program3D, 'a_uv'),
            };

            // PBR uniforms
            this._program3DUniforms = {
              viewProj: this.gl.getUniformLocation(this.program3D, 'u_viewProj'),
              model: this.gl.getUniformLocation(this.program3D, 'u_model'),
              normalMatrix: this.gl.getUniformLocation(this.program3D, 'u_normalMatrix'),

              cameraPos: this.gl.getUniformLocation(this.program3D, 'u_cameraPos'),
              // Light arrays
              lightCount: this.gl.getUniformLocation(this.program3D, 'u_lightCount'),
              lightPosType: this.gl.getUniformLocation(this.program3D, 'u_lightPosType[0]'),
              lightDirInner: this.gl.getUniformLocation(this.program3D, 'u_lightDirInner[0]'),
              lightColorIntensity: this.gl.getUniformLocation(this.program3D, 'u_lightColorIntensity[0]'),
              lightParams: this.gl.getUniformLocation(this.program3D, 'u_lightParams[0]'),
              ambientColor: this.gl.getUniformLocation(this.program3D, 'u_ambientColor'),

              baseColorFactor: this.gl.getUniformLocation(this.program3D, 'u_baseColorFactor'),
              metallicFactor: this.gl.getUniformLocation(this.program3D, 'u_metallicFactor'),
              roughnessFactor: this.gl.getUniformLocation(this.program3D, 'u_roughnessFactor'),
              normalScale: this.gl.getUniformLocation(this.program3D, 'u_normalScale'),
              aoStrength: this.gl.getUniformLocation(this.program3D, 'u_aoStrength'),
              emissiveFactor: this.gl.getUniformLocation(this.program3D, 'u_emissiveFactor'),
              exposure: this.gl.getUniformLocation(this.program3D, 'u_exposure'),

              alphaMode: this.gl.getUniformLocation(this.program3D, 'u_alphaMode'),
              alphaCutoff: this.gl.getUniformLocation(this.program3D, 'u_alphaCutoff'),

              baseColorMap: this.gl.getUniformLocation(this.program3D, 'u_baseColorMap'),
              metallicMap: this.gl.getUniformLocation(this.program3D, 'u_metallicMap'),
              roughnessMap: this.gl.getUniformLocation(this.program3D, 'u_roughnessMap'),
              normalMap: this.gl.getUniformLocation(this.program3D, 'u_normalMap'),
              aoMap: this.gl.getUniformLocation(this.program3D, 'u_aoMap'),
              emissiveMap: this.gl.getUniformLocation(this.program3D, 'u_emissiveMap'),
              alphaMap: this.gl.getUniformLocation(this.program3D, 'u_alphaMap'),

              // Environment reflections (IBL split-sum)
              irradianceMap: this.gl.getUniformLocation(this.program3D, 'u_irradianceMap'),
              prefilterMap: this.gl.getUniformLocation(this.program3D, 'u_prefilterMap'),
              brdfLut: this.gl.getUniformLocation(this.program3D, 'u_brdfLut'),
              envIntensity: this.gl.getUniformLocation(this.program3D, 'u_envIntensity'),
              prefilterMaxLod: this.gl.getUniformLocation(this.program3D, 'u_prefilterMaxLod'),
              // Environment fallback sampling (raw skybox cubemap)
              envMap: this.gl.getUniformLocation(this.program3D, 'u_envMap'),
              envMaxLod: this.gl.getUniformLocation(this.program3D, 'u_envMaxLod'),
              hasIbl: this.gl.getUniformLocation(this.program3D, 'u_hasIbl'),

              // Material debug visualization
              materialDebugView: this.gl.getUniformLocation(this.program3D, 'u_materialDebugView'),

              // Shadow mapping (directional)
              shadowBias: this.gl.getUniformLocation(this.program3D, 'u_shadowBias'),
              hasShadowMap: this.gl.getUniformLocation(this.program3D, 'u_hasShadowMap'),
              shadowPcfKernel: this.gl.getUniformLocation(this.program3D, 'u_shadowPcfKernel'),
              shadowPcfRadius: this.gl.getUniformLocation(this.program3D, 'u_shadowPcfRadius'),
              shadowFadeStart: this.gl.getUniformLocation(this.program3D, 'u_shadowFadeStart'),
              shadowFadeEnd: this.gl.getUniformLocation(this.program3D, 'u_shadowFadeEnd'),
              shadowAffectsIndirect: this.gl.getUniformLocation(this.program3D, 'u_shadowAffectsIndirect'),
              shadowStrength: this.gl.getUniformLocation(this.program3D, 'u_shadowStrength'),
              // CSM
              csmShadowMap: this.gl.getUniformLocation(this.program3D, 'u_csmShadowMap'),
              csmLightViewProj: this.gl.getUniformLocation(this.program3D, 'u_csmLightViewProj[0]'),
              csmSplits: this.gl.getUniformLocation(this.program3D, 'u_csmSplits[0]'),
              csmCount: this.gl.getUniformLocation(this.program3D, 'u_csmCount'),
              cameraNear: this.gl.getUniformLocation(this.program3D, 'u_cameraNear'),
              cameraFar: this.gl.getUniformLocation(this.program3D, 'u_cameraFar'),
              csmBlend: this.gl.getUniformLocation(this.program3D, 'u_csmBlend'),

              // Contact shadows (camera depth prepass + ray-march)
              sceneDepthTex: this.gl.getUniformLocation(this.program3D, 'u_sceneDepthTex'),
              hasSceneDepth: this.gl.getUniformLocation(this.program3D, 'u_hasSceneDepth'),
              contactShadowStrength: this.gl.getUniformLocation(this.program3D, 'u_contactShadowStrength'),
              contactShadowMaxDistance: this.gl.getUniformLocation(this.program3D, 'u_contactShadowMaxDistance'),
              contactShadowSteps: this.gl.getUniformLocation(this.program3D, 'u_contactShadowSteps'),
              contactShadowThickness: this.gl.getUniformLocation(this.program3D, 'u_contactShadowThickness'),
            };

            // Bind sampler units once
            this.gl.useProgram(this.program3D);
            if (this._program3DUniforms.baseColorMap) this.gl.uniform1i(this._program3DUniforms.baseColorMap, 0);
            if (this._program3DUniforms.metallicMap) this.gl.uniform1i(this._program3DUniforms.metallicMap, 1);
            if (this._program3DUniforms.roughnessMap) this.gl.uniform1i(this._program3DUniforms.roughnessMap, 2);
            if (this._program3DUniforms.normalMap) this.gl.uniform1i(this._program3DUniforms.normalMap, 3);
            if (this._program3DUniforms.aoMap) this.gl.uniform1i(this._program3DUniforms.aoMap, 4);
            if (this._program3DUniforms.emissiveMap) this.gl.uniform1i(this._program3DUniforms.emissiveMap, 5);
            if (this._program3DUniforms.alphaMap) this.gl.uniform1i(this._program3DUniforms.alphaMap, 6);
            // IBL samplers
            if (this._program3DUniforms.irradianceMap) this.gl.uniform1i(this._program3DUniforms.irradianceMap, 7);
            if (this._program3DUniforms.prefilterMap) this.gl.uniform1i(this._program3DUniforms.prefilterMap, 8);
            if (this._program3DUniforms.brdfLut) this.gl.uniform1i(this._program3DUniforms.brdfLut, 9);
            // Raw environment cubemap (skybox) for fallback sampling
            if (this._program3DUniforms.envMap) this.gl.uniform1i(this._program3DUniforms.envMap, 10);

            // CSM shadow map sampler (depth texture array)
            if (this._program3DUniforms.csmShadowMap) this.gl.uniform1i(this._program3DUniforms.csmShadowMap, 11);
            // Scene depth sampler for contact shadows
            if (this._program3DUniforms.sceneDepthTex) this.gl.uniform1i(this._program3DUniforms.sceneDepthTex, 12);

            // Material debug visualization (default OFF)
            if (this._program3DUniforms.materialDebugView) this.gl.uniform1i(this._program3DUniforms.materialDebugView, 0);
          }
        }
      } catch {
        this.program3D = null;
      }

      // Shadow depth program (WebGL2 only)
      try {
        const vsS = await this.loadShaderFile(shadowVertexShaderPath);
        const fsS = await this.loadShaderFile(shadowFragmentShaderPath);
        const shVS = this.createShader(this.gl.VERTEX_SHADER, vsS);
        const shFS = this.createShader(this.gl.FRAGMENT_SHADER, fsS);
        if (shVS && shFS) {
          this.shadowProgram = this.createProgram(shVS, shFS);
          if (this.shadowProgram) {
            this._shadowAttribs = {
              position: this.gl.getAttribLocation(this.shadowProgram, 'a_position'),
              normal: this.gl.getAttribLocation(this.shadowProgram, 'a_normal'),
              uv: this.gl.getAttribLocation(this.shadowProgram, 'a_uv'),
            };
            this._shadowUniforms = {
              model: this.gl.getUniformLocation(this.shadowProgram, 'u_model'),
              lightViewProj: this.gl.getUniformLocation(this.shadowProgram, 'u_lightViewProj'),
            };
            this._initShadowMapResources();
          }
        }
      } catch (e) {
        this.shadowProgram = null;
      }

      // Depth prepass program (WebGL2 only) - used for contact shadows
      try {
        const vsD = await this.loadShaderFile(depthPrepassVertexShaderPath);
        const fsD = await this.loadShaderFile(depthPrepassFragmentShaderPath);
        const dpVS = this.createShader(this.gl.VERTEX_SHADER, vsD);
        const dpFS = this.createShader(this.gl.FRAGMENT_SHADER, fsD);
        if (dpVS && dpFS) {
          this.depthPrepassProgram = this.createProgram(dpVS, dpFS);
          if (this.depthPrepassProgram) {
            this._depthPrepassAttribs = {
              position: this.gl.getAttribLocation(this.depthPrepassProgram, 'a_position'),
              normal: this.gl.getAttribLocation(this.depthPrepassProgram, 'a_normal'),
              uv: this.gl.getAttribLocation(this.depthPrepassProgram, 'a_uv'),
            };
            this._depthPrepassUniforms = {
              viewProj: this.gl.getUniformLocation(this.depthPrepassProgram, 'u_viewProj'),
              model: this.gl.getUniformLocation(this.depthPrepassProgram, 'u_model'),
            };
          }
        }
      } catch (e) {
        this.depthPrepassProgram = null;
      }
      
      // Skybox shader program
      try {
        const vsSky = await this.loadShaderFile(skyboxVertexShaderPath);
        const fsSky = await this.loadShaderFile(skyboxFragmentShaderPath);
        const vsSkyShader = this.createShader(this.gl.VERTEX_SHADER, vsSky);
        const fsSkyShader = this.createShader(this.gl.FRAGMENT_SHADER, fsSky);
        if (vsSkyShader && fsSkyShader) {
          this.skyboxProgram = this.createProgram(vsSkyShader, fsSkyShader);
          if (this.skyboxProgram) {
            this._skyboxAttribs = {
              position: this.gl.getAttribLocation(this.skyboxProgram, 'a_position'),
            };
            this._skyboxUniforms = {
              viewProj: this.gl.getUniformLocation(this.skyboxProgram, 'u_viewProj'),
              skybox: this.gl.getUniformLocation(this.skyboxProgram, 'u_skybox'),
            };
          }
        }
      } catch (e) {
        console.warn('Failed to load skybox shaders:', e);
        this.skyboxProgram = null;
      }
    }

    // --- PBR default textures (1x1) ---
    // These let the shader always sample all maps without branching.
    // (All textures are linear except baseColor/emissive which are decoded as sRGB in the shader.)
    const make1x1 = (r, g, b, a = 255) => {
      const t = this.gl.createTexture();
      this.gl.bindTexture(this.gl.TEXTURE_2D, t);
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
      const data = new Uint8Array([r, g, b, a]);
      this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, 1, 1, 0, this.gl.RGBA, this.gl.UNSIGNED_BYTE, data);
      this.gl.bindTexture(this.gl.TEXTURE_2D, null);
      // Track dimensions for any code that relies on it (e.g., UV calculations).
      if (this._textureDimensions) this._textureDimensions.set(t, { width: 1, height: 1 });
      return t;
    };

    this._defaultPbrTextures = {
      baseColor: make1x1(255, 255, 255, 255),
      metallic: make1x1(0, 0, 0, 255),
      roughness: make1x1(255, 255, 255, 255),
      normal: make1x1(128, 128, 255, 255),
      ao: make1x1(255, 255, 255, 255),
      emissive: make1x1(0, 0, 0, 255),
      alpha: make1x1(255, 255, 255, 255),
    };

    // --- IBL generation programs (WebGL2 only) ---
    this._ibl = {
      ready: false,
      cache: new WeakMap(), // cubemapTexture -> { irradianceMap, prefilterMap, prefilterMaxLod, brdfLut }
      inFlight: new WeakMap(), // cubemapTexture -> Promise
      // programs
      progIrradiance: null,
      progPrefilter: null,
      progBrdf: null,
      // uniforms
      uIrr: { view: null, proj: null, envMap: null },
      uPre: { view: null, proj: null, envMap: null, roughness: null },
      uBrdf: { },
      // capture matrices
      captureProj: Mat4.perspective(Math.PI / 2, 1, 0.1, 10.0),
      captureViews: null,
    };

    if (this.isWebGL2) {
      try {
        const vCap = await this.loadShaderFile('../../Fluxion/Shaders/IBL/cubemap_capture_vertex_300es.glsl');
        const fIrr = await this.loadShaderFile('../../Fluxion/Shaders/IBL/irradiance_convolution_fragment_300es.glsl');
        const fPre = await this.loadShaderFile('../../Fluxion/Shaders/IBL/prefilter_env_fragment_300es.glsl');
        const vBrdf = await this.loadShaderFile('../../Fluxion/Shaders/IBL/brdf_lut_vertex_300es.glsl');
        const fBrdf = await this.loadShaderFile('../../Fluxion/Shaders/IBL/brdf_lut_fragment_300es.glsl');

        const vsCap = this.createShader(this.gl.VERTEX_SHADER, vCap);
        const fsIrr = this.createShader(this.gl.FRAGMENT_SHADER, fIrr);
        const fsPre = this.createShader(this.gl.FRAGMENT_SHADER, fPre);
        const vsBrdf = this.createShader(this.gl.VERTEX_SHADER, vBrdf);
        const fsBrdfS = this.createShader(this.gl.FRAGMENT_SHADER, fBrdf);

        if (vsCap && fsIrr) {
          this._ibl.progIrradiance = this.createProgram(vsCap, fsIrr);
        }
        if (vsCap && fsPre) {
          this._ibl.progPrefilter = this.createProgram(vsCap, fsPre);
        }
        if (vsBrdf && fsBrdfS) {
          this._ibl.progBrdf = this.createProgram(vsBrdf, fsBrdfS);
        }

        // Cache uniform locations
        if (this._ibl.progIrradiance) {
          this._ibl.uIrr.view = this.gl.getUniformLocation(this._ibl.progIrradiance, 'u_view');
          this._ibl.uIrr.proj = this.gl.getUniformLocation(this._ibl.progIrradiance, 'u_proj');
          this._ibl.uIrr.envMap = this.gl.getUniformLocation(this._ibl.progIrradiance, 'u_envMap');
          this.gl.useProgram(this._ibl.progIrradiance);
          if (this._ibl.uIrr.envMap) this.gl.uniform1i(this._ibl.uIrr.envMap, 0);
        }
        if (this._ibl.progPrefilter) {
          this._ibl.uPre.view = this.gl.getUniformLocation(this._ibl.progPrefilter, 'u_view');
          this._ibl.uPre.proj = this.gl.getUniformLocation(this._ibl.progPrefilter, 'u_proj');
          this._ibl.uPre.envMap = this.gl.getUniformLocation(this._ibl.progPrefilter, 'u_envMap');
          this._ibl.uPre.roughness = this.gl.getUniformLocation(this._ibl.progPrefilter, 'u_roughness');
          this.gl.useProgram(this._ibl.progPrefilter);
          if (this._ibl.uPre.envMap) this.gl.uniform1i(this._ibl.uPre.envMap, 0);
        }

        // Capture view matrices (lookAt from origin)
        const mkView = (tx, ty, tz, ux, uy, uz) => {
          const eye = { x: 0, y: 0, z: 0 };
          const target = { x: tx, y: ty, z: tz };
          const up = { x: ux, y: uy, z: uz };
          return Mat4.lookAt(eye, target, up, new Float32Array(16));
        };
        this._ibl.captureViews = [
          mkView(1, 0, 0, 0, -1, 0),
          mkView(-1, 0, 0, 0, -1, 0),
          mkView(0, 1, 0, 0, 0, 1),
          mkView(0, -1, 0, 0, 0, -1),
          mkView(0, 0, 1, 0, -1, 0),
          mkView(0, 0, -1, 0, -1, 0),
        ];

        this._ibl.ready = !!(this._ibl.progIrradiance && this._ibl.progPrefilter && this._ibl.progBrdf);
      } catch (e) {
        this._ibl.ready = false;
      }
    }

    this.gl.useProgram(this.program);

    // Get attribute and uniform locations
    this.positionLocation = this.gl.getAttribLocation(this.program, "a_position");
    this.texcoordLocation = this.gl.getAttribLocation(this.program, "a_texcoord");
    this.colorLocation = this.gl.getAttribLocation(this.program, "a_color"); // Changed to attribute
    
    this.textureLocation = this.gl.getUniformLocation(this.program, "u_texture");
    this.cameraPositionLocation = this.gl.getUniformLocation(this.program, "u_cameraPosition");
    this.cameraZoomLocation = this.gl.getUniformLocation(this.program, "u_cameraZoom");
    this.cameraRotationLocation = this.gl.getUniformLocation(this.program, "u_cameraRotation");
    this.resolutionLocation = this.gl.getUniformLocation(this.program, "u_resolution");
    // this.colorLocation = this.gl.getUniformLocation(this.program, "u_color"); // Removed uniform

    // Sampler defaults to unit 0, but set explicitly once for clarity.
    if (this.textureLocation) {
      this.gl.uniform1i(this.textureLocation, 0);
    }

    // --- Batch Rendering Initialization ---
    this.MAX_QUADS = 2000;
    this.VERTEX_SIZE = 8; // x, y, u, v, r, g, b, a
    this.STRIDE = this.VERTEX_SIZE * 4; // bytes
    
    this.vertexData = new Float32Array(this.MAX_QUADS * 4 * this.VERTEX_SIZE);
    this.quadCount = 0;
    this.currentTexture = null;

    // Create and bind vertex buffer (dynamic)
    this.vertexBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, this.vertexData.byteLength, this.gl.DYNAMIC_DRAW);

    // Create and bind index buffer (static)
    this.indexBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
    
    // Generate indices: 0,1,2, 0,2,3, 4,5,6, 4,6,7, ...
    const indices = new Uint16Array(this.MAX_QUADS * 6);
    for (let i = 0; i < this.MAX_QUADS; i++) {
        const v = i * 4;
        const idx = i * 6;
        indices[idx] = v;
        indices[idx + 1] = v + 1;
        indices[idx + 2] = v + 2;
        indices[idx + 3] = v;
        indices[idx + 4] = v + 2;
        indices[idx + 5] = v + 3;
    }
    this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, indices, this.gl.STATIC_DRAW);

    // WebGL2: capture the quad vertex format with a VAO (fast rebind + less state churn).
    // WebGL1: fall back to the classic attribute setup.
    this.quadVao = null;
    if (this.isWebGL2 && typeof this.gl.createVertexArray === 'function') {
      this.quadVao = this.gl.createVertexArray();
      this.gl.bindVertexArray(this.quadVao);

      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBuffer);
      this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);

      this.gl.enableVertexAttribArray(this.positionLocation);
      this.gl.vertexAttribPointer(this.positionLocation, 2, this.gl.FLOAT, false, this.STRIDE, 0);

      this.gl.enableVertexAttribArray(this.texcoordLocation);
      this.gl.vertexAttribPointer(this.texcoordLocation, 2, this.gl.FLOAT, false, this.STRIDE, 8);

      this.gl.enableVertexAttribArray(this.colorLocation);
      this.gl.vertexAttribPointer(this.colorLocation, 4, this.gl.FLOAT, false, this.STRIDE, 16);

      this.gl.bindVertexArray(null);
    } else {
      // Enable attributes (WebGL1 path)
      this.gl.enableVertexAttribArray(this.positionLocation);
      this.gl.vertexAttribPointer(this.positionLocation, 2, this.gl.FLOAT, false, this.STRIDE, 0);

      this.gl.enableVertexAttribArray(this.texcoordLocation);
      this.gl.vertexAttribPointer(this.texcoordLocation, 2, this.gl.FLOAT, false, this.STRIDE, 8); // Offset 2 floats (8 bytes)

      this.gl.enableVertexAttribArray(this.colorLocation);
      this.gl.vertexAttribPointer(this.colorLocation, 4, this.gl.FLOAT, false, this.STRIDE, 16); // Offset 4 floats (16 bytes)
    }

    // --- WebGL2 Instanced Sprite Path ---
    if (this.isWebGL2 && this.instancedProgram) {
      // Ensure sampler uses texture unit 0 for this program.
      this.gl.useProgram(this.instancedProgram);

      // Cache locations for the instanced program
      this._instancedAttribs = {
        position: this.gl.getAttribLocation(this.instancedProgram, 'a_position'),
        texcoord: this.gl.getAttribLocation(this.instancedProgram, 'a_texcoord'),
        iPos: this.gl.getAttribLocation(this.instancedProgram, 'a_i_pos'),
        iSize: this.gl.getAttribLocation(this.instancedProgram, 'a_i_size'),
        iUv: this.gl.getAttribLocation(this.instancedProgram, 'a_i_uv'),
        iColor: this.gl.getAttribLocation(this.instancedProgram, 'a_i_color'),
      };
      this._instancedUniforms = {
        texture: this.gl.getUniformLocation(this.instancedProgram, 'u_texture'),
        cameraPosition: this.gl.getUniformLocation(this.instancedProgram, 'u_cameraPosition'),
        cameraZoom: this.gl.getUniformLocation(this.instancedProgram, 'u_cameraZoom'),
        cameraRotation: this.gl.getUniformLocation(this.instancedProgram, 'u_cameraRotation'),
        resolution: this.gl.getUniformLocation(this.instancedProgram, 'u_resolution'),
      };

      if (this._instancedUniforms.texture) {
        this.gl.uniform1i(this._instancedUniforms.texture, 0);
      }

      // Base quad: (x,y,u,v) for TRIANGLE_STRIP with positions in 0..1
      const baseQuad = new Float32Array([
        0, 0, 0, 0, // top-left
        1, 0, 1, 0, // top-right
        0, 1, 0, 1, // bottom-left
        1, 1, 1, 1, // bottom-right
      ]);

      this._baseQuadStride = 4 * 4; // 4 floats
      this.baseQuadBuffer = this.gl.createBuffer();
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.baseQuadBuffer);
      this.gl.bufferData(this.gl.ARRAY_BUFFER, baseQuad, this.gl.STATIC_DRAW);

      // Per-instance layout: pos(2), size(2), uv(4), color(4) = 12 floats
      this._instanceFloats = 12;
      this._instanceStride = this._instanceFloats * 4;
      this.instanceData = new Float32Array(this.MAX_QUADS * this._instanceFloats);

      this.instanceBuffer = this.gl.createBuffer();
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.instanceBuffer);
      this.gl.bufferData(this.gl.ARRAY_BUFFER, this.instanceData.byteLength, this.gl.DYNAMIC_DRAW);

      // VAO captures base + instance attributes
      this.instancedVao = this.gl.createVertexArray();
      this.gl.bindVertexArray(this.instancedVao);

      // Base quad attributes
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.baseQuadBuffer);
      this.gl.enableVertexAttribArray(this._instancedAttribs.position);
      this.gl.vertexAttribPointer(this._instancedAttribs.position, 2, this.gl.FLOAT, false, this._baseQuadStride, 0);
      this.gl.enableVertexAttribArray(this._instancedAttribs.texcoord);
      this.gl.vertexAttribPointer(this._instancedAttribs.texcoord, 2, this.gl.FLOAT, false, this._baseQuadStride, 8);

      // Instance attributes (divisor = 1)
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.instanceBuffer);
      this.gl.enableVertexAttribArray(this._instancedAttribs.iPos);
      this.gl.vertexAttribPointer(this._instancedAttribs.iPos, 2, this.gl.FLOAT, false, this._instanceStride, 0);
      this.gl.vertexAttribDivisor(this._instancedAttribs.iPos, 1);

      this.gl.enableVertexAttribArray(this._instancedAttribs.iSize);
      this.gl.vertexAttribPointer(this._instancedAttribs.iSize, 2, this.gl.FLOAT, false, this._instanceStride, 8);
      this.gl.vertexAttribDivisor(this._instancedAttribs.iSize, 1);

      this.gl.enableVertexAttribArray(this._instancedAttribs.iUv);
      this.gl.vertexAttribPointer(this._instancedAttribs.iUv, 4, this.gl.FLOAT, false, this._instanceStride, 16);
      this.gl.vertexAttribDivisor(this._instancedAttribs.iUv, 1);

      this.gl.enableVertexAttribArray(this._instancedAttribs.iColor);
      this.gl.vertexAttribPointer(this._instancedAttribs.iColor, 4, this.gl.FLOAT, false, this._instanceStride, 32);
      this.gl.vertexAttribDivisor(this._instancedAttribs.iColor, 1);

      this.gl.bindVertexArray(null);
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null);
    }

    // Restore the default sprite program as active.
    this.gl.useProgram(this.program);

    // Scratch buffer for blitting (avoid per-call allocations).
    this._blitQuadScratch = new Float32Array(4 * this.VERTEX_SIZE);
    
    // Initialize post-processing if enabled
    if (this.enablePostProcessing) {
      this.postProcessing = new PostProcessing(this.gl);

      // Allocate scene targets to full canvas size, and init post-processing at that size
      this.ensureMainScreenTargets();
      await this.postProcessing.init(this.canvas.width, this.canvas.height);
      console.log('Post-processing initialized');
    } else {
        // Even if PP is disabled, we need the main screen targets
        this.ensureMainScreenTargets();
    }
  }

  /**
   * Creates and compiles a shader.
   * @param {number} type - The type of shader (VERTEX_SHADER or FRAGMENT_SHADER).
   * @param {string} source - The shader source code.
   * @returns {WebGLShader|null} The compiled shader, or null if compilation failed.
   */
  createShader(type, source) {
    const shader = this.gl.createShader(type);
    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);
    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      console.error("Shader compilation error:", this.gl.getShaderInfoLog(shader));
      this.gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  /**
   * Creates and links a WebGL program.
   * @param {WebGLShader} vertexShader - The compiled vertex shader.
   * @param {WebGLShader} fragmentShader - The compiled fragment shader.
   * @returns {WebGLProgram|null} The linked program, or null if linking failed.
   */
  createProgram(vertexShader, fragmentShader) {
    const program = this.gl.createProgram();
    this.gl.attachShader(program, vertexShader);
    this.gl.attachShader(program, fragmentShader);
    this.gl.linkProgram(program);
    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      console.error("Program linking error:", this.gl.getProgramInfoLog(program));
      return null;
    }
    return program;
  }

  createTexture(image, cacheKey = null) {
    // Check cache if key provided
    if (cacheKey && this.textureCache.has(cacheKey)) {
      return this.textureCache.get(cacheKey).texture;
    }

    const texture = this.gl.createTexture();
    // Store texture dimensions (WebGLTexture doesn't have width/height properties)
    this._textureDimensions.set(texture, { width: image.width, height: image.height });

    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
    this.gl.pixelStorei(this.gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    // Make (0,0) in UV space correspond to the top-left of the source image/canvas.
    // This matches our engine's 2D convention (Y down) and keeps sprites/text upright.
    // this.gl.pixelStorei(this.gl.UNPACK_FLIP_Y_WEBGL, true);

    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
    
    // Use mipmapping for better performance when downscaling
    const isPowerOf2 = (value) => (value & (value - 1)) === 0;
    if (isPowerOf2(image.width) && isPowerOf2(image.height)) {
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR_MIPMAP_LINEAR);
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
    } else {
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
    }

    this.gl.texImage2D(
      this.gl.TEXTURE_2D,
      0,
      this.gl.RGBA,
      this.gl.RGBA,
      this.gl.UNSIGNED_BYTE,
      image
    );

    // Generate mipmaps for power-of-2 textures
    if (isPowerOf2(image.width) && isPowerOf2(image.height)) {
      this.gl.generateMipmap(this.gl.TEXTURE_2D);
    }

    // Reset state to avoid surprising other uploads.
    this.gl.pixelStorei(this.gl.UNPACK_FLIP_Y_WEBGL, false);

    this.gl.bindTexture(this.gl.TEXTURE_2D, null);
    
    // Cache texture if key provided
    if (cacheKey) {
      const dims = this._textureDimensions.get(texture);
      const bytes = this._estimateTextureBytes(dims ? dims.width : 0, dims ? dims.height : 0);
      this._setCacheEntry(cacheKey, texture, bytes);
      this._evictIfNeeded();
    }
    
    return texture;
  }

  beginFrame() {
    if (!this.isReady) return;

    this._frameId++;

    // Clear debug renderer commands for new frame
    if (this.debug) {
      this.debug.clear();
    }

    // Reset batch state
    this.quadCount = 0;
    this.currentTexture = null;
    this.lastFrameDrawCalls = this.drawCallCount;
    this.lastFrameSprites = this._spritesThisFrame;
    this.lastFrameInstancedDrawCalls = this._instancedDrawCallsThisFrame;
    this.lastFrameLegacyDrawCalls = this._legacyDrawCallsThisFrame;
    this.lastFrameUsedInstancing = this._usedInstancingThisFrame;
    this.drawCallCount = 0;
    this._spritesThisFrame = 0;
    this._instancedDrawCallsThisFrame = 0;
    this._legacyDrawCallsThisFrame = 0;
    this._usedInstancingThisFrame = false;

    if (this.enablePostProcessing && this.mainScreenFramebuffer) {
      // Render to offscreen target for post-processing.
      this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.mainScreenMsaaFramebuffer || this.mainScreenFramebuffer);

      // Clear the entire framebuffer (including black bars area)
      this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      const clearMask = (this.mainScreenMsaaFramebuffer || this.mainScreenDepthStencilRbo)
        ? (this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT | this.gl.STENCIL_BUFFER_BIT)
        : this.gl.COLOR_BUFFER_BIT;
      this.gl.clear(clearMask);

      // Set viewport to the letterboxed area for the game to draw into
      this.gl.viewport(this.viewport.x, this.viewport.y, this.viewport.width, this.viewport.height);
      return;
    }

    // No post-processing: render directly to the default framebuffer.
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    this.gl.viewport(this.viewport.x, this.viewport.y, this.viewport.width, this.viewport.height);
  }

  /**
   * Clears the currently bound framebuffer.
   * Kept for backward compatibility with older examples.
   * @param {number} [r]
   * @param {number} [g]
   * @param {number} [b]
   * @param {number} [a]
   */
  clear(r, g, b, a) {
    if (!this.isReady) return;

    // Ensure pending draws are submitted before clearing.
    this.flush();

    if (
      typeof r === 'number' && typeof g === 'number' &&
      typeof b === 'number' && typeof a === 'number'
    ) {
      this.gl.clearColor(r, g, b, a);
    }

    const mask = (this.mainScreenMsaaFramebuffer || this.mainScreenDepthStencilRbo)
      ? (this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT | this.gl.STENCIL_BUFFER_BIT)
      : this.gl.COLOR_BUFFER_BIT;
    this.gl.clear(mask);
  }
  
  endFrame() {
    if (!this.isReady) return;

    // Flush any remaining quads
    this.flush();

    // Ensure we exit any 3D pass before post-processing.
    if (this._in3DPass) {
      this.end3D();
    }

    // Render debug overlay (before post-processing so it's included)
    if (this.debug) {
      this.debug.render();
    }

    if (this.enablePostProcessing && this.postProcessing && this.mainScreenTexture) {
      // Resolve MSAA render target (if enabled) into the main screen texture before post-processing.
      this.resolveMainScreenTargetIfNeeded();

      // Pass the main screen texture to the post-processing system
      // The output goes to the default framebuffer (null)
      const dims = this._textureDimensions.get(this.mainScreenTexture);
      if (dims && dims.width > 0 && dims.height > 0) {
        this.postProcessing.render(this.mainScreenTexture, null);
      }
    }
  }

  /**
   * Begin 3D rendering (render layer 0).
   * 3D pass is intentionally explicit so the engine can treat 3D as a base layer.
   * @param {Camera3D|null|undefined} camera3D
   */
  begin3D(camera3D) {
    if (!this.isReady) return false;
    if (!this.isWebGL2 || !this.program3D) return false;

    // Flush 2D before switching programs/state.
    this.flush();

    const gl = this.gl;
    const cam = camera3D || this._defaultCamera3D;

    // Keep perspective aspect synced to renderer target.
    const aspect = (this.targetWidth > 0 && this.targetHeight > 0)
      ? (this.targetWidth / this.targetHeight)
      : 1;
    cam.setPerspective(cam.fovY, aspect, cam.near, cam.far);

    // Render skybox first (if available) - before depth testing
    if (this.currentSkybox && this.currentSkybox.isLoaded() && this.skyboxProgram) {
      this._renderSkybox(cam);
    }

    gl.useProgram(this.program3D);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.depthMask(true);
    gl.disable(gl.BLEND);

    // Clear depth to avoid leaking previous frame depth.
    gl.clear(gl.DEPTH_BUFFER_BIT);

    const vp = cam.getViewProjectionMatrix();
    if (this._program3DUniforms?.viewProj) gl.uniformMatrix4fv(this._program3DUniforms.viewProj, false, vp);

    // Global lighting uniforms (per-frame)
    const u = this._program3DUniforms;
    if (u?.cameraPos) gl.uniform3f(u.cameraPos, cam.position.x, cam.position.y, cam.position.z);
    if (u?.exposure) gl.uniform1f(u.exposure, Number.isFinite(this.pbrExposure) ? this.pbrExposure : 1.0);
    if (u?.materialDebugView) gl.uniform1i(u.materialDebugView, (this.materialDebugView | 0));

    // Shadow map uniforms (per-frame)
    const csmCount = this.csmEnabled ? Math.max(1, Math.min(4, this.csmCascadeCount | 0)) : 1;
    if (u?.hasShadowMap) gl.uniform1i(u.hasShadowMap, (this._shadowReady && this.shadowDepthTexture && this.shadowsEnabled) ? 1 : 0);
    if (u?.shadowBias) gl.uniform1f(u.shadowBias, Number.isFinite(this.shadowBias) ? this.shadowBias : 0.0025);
    if (u?.shadowPcfKernel) gl.uniform1i(u.shadowPcfKernel, (this.shadowPcfKernel | 0) || 1);
    if (u?.shadowPcfRadius) gl.uniform1f(u.shadowPcfRadius, Number.isFinite(this.shadowPcfRadius) ? this.shadowPcfRadius : 1.25);
    if (u?.shadowFadeStart) gl.uniform1f(u.shadowFadeStart, Number.isFinite(this.shadowFadeStart) ? this.shadowFadeStart : 35.0);
    if (u?.shadowFadeEnd) gl.uniform1f(u.shadowFadeEnd, Number.isFinite(this.shadowFadeEnd) ? this.shadowFadeEnd : 90.0);
    if (u?.shadowAffectsIndirect) gl.uniform1i(u.shadowAffectsIndirect, this.shadowAffectsIndirect ? 1 : 0);
    if (u?.shadowStrength) gl.uniform1f(u.shadowStrength, Number.isFinite(this.shadowStrength) ? this.shadowStrength : 1.0);

    // CSM uniforms (updated by renderShadowMaps() each frame)
    if (u?.csmCount) gl.uniform1i(u.csmCount, csmCount);
    // Use the same near/far that were used to compute cascade splits (CSM range may be clamped).
    if (u?.cameraNear) gl.uniform1f(u.cameraNear, this._csmNearUsed || cam.near);
    if (u?.cameraFar) gl.uniform1f(u.cameraFar, this._csmFarUsed || cam.far);
    if (u?.csmBlend) gl.uniform1f(u.csmBlend, Number.isFinite(this.csmBlend) ? this.csmBlend : 0.15);
    if (u?.csmSplits) gl.uniform1fv(u.csmSplits, this._csmSplitsData);
    if (u?.csmLightViewProj) gl.uniformMatrix4fv(u.csmLightViewProj, false, this._csmLightViewProjData);

    if (u?.csmShadowMap) {
      gl.activeTexture(gl.TEXTURE11);
      gl.bindTexture(gl.TEXTURE_2D_ARRAY, (this._shadowReady && this.shadowsEnabled) ? this.shadowDepthTexture : null);
      gl.activeTexture(gl.TEXTURE0);
    }

    // Contact shadow uniforms (camera depth prepass)
    const hasSceneDepth = !!(this.sceneDepthTexture && this.contactShadowsEnabled);
    if (u?.hasSceneDepth) gl.uniform1i(u.hasSceneDepth, hasSceneDepth ? 1 : 0);
    if (u?.contactShadowStrength) gl.uniform1f(u.contactShadowStrength, Number.isFinite(this.contactShadowStrength) ? this.contactShadowStrength : 0.35);
    if (u?.contactShadowMaxDistance) gl.uniform1f(u.contactShadowMaxDistance, Number.isFinite(this.contactShadowMaxDistance) ? this.contactShadowMaxDistance : 0.35);
    if (u?.contactShadowSteps) gl.uniform1i(u.contactShadowSteps, (this.contactShadowSteps | 0) || 0);
    if (u?.contactShadowThickness) gl.uniform1f(u.contactShadowThickness, Number.isFinite(this.contactShadowThickness) ? this.contactShadowThickness : 0.0015);
    if (u?.sceneDepthTex) {
      gl.activeTexture(gl.TEXTURE12);
      gl.bindTexture(gl.TEXTURE_2D, hasSceneDepth ? this.sceneDepthTexture : null);
      gl.activeTexture(gl.TEXTURE0);
    }

    // IBL (split-sum): irradiance cubemap + GGX prefilter cubemap + BRDF LUT
    // Kick off generation if needed; we’ll fall back to a dim ambient until ready.
    //
    // NOTE: IBL generation uses its own programs/FBO/viewport. It runs synchronously (async fn with no awaits),
    // so we MUST restore GL state afterwards or subsequent uniform uploads/draws will fail.
    const _prevFb = gl.getParameter(gl.FRAMEBUFFER_BINDING);
    const _prevVp = gl.getParameter(gl.VIEWPORT);
    const _prevProg = gl.getParameter(gl.CURRENT_PROGRAM);
    const _prevActiveTex = gl.getParameter(gl.ACTIVE_TEXTURE);
    this.ensureIblForCurrentSkybox?.();
    gl.bindFramebuffer(gl.FRAMEBUFFER, _prevFb);
    gl.viewport(_prevVp[0], _prevVp[1], _prevVp[2], _prevVp[3]);
    gl.useProgram(this.program3D);
    gl.activeTexture(_prevActiveTex);

    const hasEnv = !!(this.currentSkybox && this.currentSkybox.isLoaded && this.currentSkybox.isLoaded() && this.currentSkybox.cubemapTexture);
    const envIntensity = hasEnv ? (Number.isFinite(this.pbrEnvIntensity) ? this.pbrEnvIntensity : 1.0) : 0.0;
    if (u?.envIntensity) gl.uniform1f(u.envIntensity, envIntensity);

    let ibl = null;
    if (hasEnv && this._ibl?.cache) {
      ibl = this._ibl.cache.get(this.currentSkybox.cubemapTexture) || null;
    }

    const preMax = ibl ? (ibl.prefilterMaxLod || 0) : 0;
    if (u?.prefilterMaxLod) gl.uniform1f(u.prefilterMaxLod, preMax);
    if (u?.hasIbl) gl.uniform1i(u.hasIbl, ibl ? 1 : 0);
    if (u?.envMaxLod) gl.uniform1f(u.envMaxLod, hasEnv ? (this.currentSkybox.getMaxLod?.() || 0) : 0);

    if (u?.irradianceMap) {
      gl.activeTexture(gl.TEXTURE7);
      gl.bindTexture(gl.TEXTURE_CUBE_MAP, ibl ? ibl.irradianceMap : null);
    }
    if (u?.prefilterMap) {
      gl.activeTexture(gl.TEXTURE8);
      gl.bindTexture(gl.TEXTURE_CUBE_MAP, ibl ? ibl.prefilterMap : null);
    }
    if (u?.brdfLut) {
      gl.activeTexture(gl.TEXTURE9);
      gl.bindTexture(gl.TEXTURE_2D, ibl ? ibl.brdfLut : null);
    }
    if (u?.envMap) {
      gl.activeTexture(gl.TEXTURE10);
      gl.bindTexture(gl.TEXTURE_CUBE_MAP, hasEnv ? this.currentSkybox.cubemapTexture : null);
    }
    // Keep 2D safe: restore active texture to unit 0 for subsequent sprite flushes.
    gl.activeTexture(gl.TEXTURE0);

    const ac = this.pbrAmbientColor || [0.03, 0.03, 0.03];
    if (u?.ambientColor) gl.uniform3f(u.ambientColor, Number(ac[0] ?? 0.03), Number(ac[1] ?? 0.03), Number(ac[2] ?? 0.03));

    // Upload real-time lights (directional/point/spot)
    this._uploadPbrLights();

    this._in3DPass = true;
    return true;
  }

  /**
   * Set active PBR lights for subsequent 3D draws (CODE OVERRIDE).
   * If set, these override any scene/XAML lights until cleared.
   * @param {any[] | null | undefined} lights
   */
  setLights(lights) {
    if (!Array.isArray(lights)) {
      this._overrideLights = null;
      return;
    }
    this._overrideLights = lights;
  }

  /**
   * Set lights coming from the scene (XML/XAML or code that adds to `scene.lights`).
   * This is called by Scene.draw automatically.
   * @param {any[] | null | undefined} lights
   */
  setSceneLights(lights) {
    this._sceneLights = Array.isArray(lights) ? lights : [];
  }

  clearLightsOverride() {
    this._overrideLights = null;
  }

  _uploadPbrLights() {
    const u = this._program3DUniforms;
    if (!u) return;

    const max = Math.max(1, this.maxPbrLights | 0);
    const total = max * 4;

    if (!this._lightPosTypeData || this._lightPosTypeData.length !== total) this._lightPosTypeData = new Float32Array(total);
    if (!this._lightDirInnerData || this._lightDirInnerData.length !== total) this._lightDirInnerData = new Float32Array(total);
    if (!this._lightColorIntensityData || this._lightColorIntensityData.length !== total) this._lightColorIntensityData = new Float32Array(total);
    if (!this._lightParamsData || this._lightParamsData.length !== total) this._lightParamsData = new Float32Array(total);

    const posType = this._lightPosTypeData;
    const dirInner = this._lightDirInnerData;
    const colInt = this._lightColorIntensityData;
    const params = this._lightParamsData;

    posType.fill(0);
    dirInner.fill(0);
    colInt.fill(0);
    params.fill(0);

    // Choose active lights: override (code) > scene (XAML/XML) > default sun.
    const srcLights = (this._overrideLights && this._overrideLights.length > 0)
      ? this._overrideLights
      : this._sceneLights;

    // If nothing is provided, use a default sun light.
    const activeLights = (srcLights && srcLights.length > 0)
      ? srcLights
      : [{
          type: LightType.Directional,
          direction: this.pbrLightDirection,
          color: this.pbrLightColor,
          intensity: 1.0,
        }];

    let count = 0;
    for (let i = 0; i < activeLights.length && count < max; i++) {
      const L = activeLights[i];
      if (!L) continue;

      const type = (typeof L.type === 'number')
        ? (L.type | 0)
        : (String(L.type || '').toLowerCase() === 'point')
          ? LightType.Point
          : (String(L.type || '').toLowerCase() === 'spot')
            ? LightType.Spot
            : LightType.Directional;

      const base = count * 4;

      // Color + intensity (linear)
      const c = Array.isArray(L.color) ? L.color : [1, 1, 1];
      colInt[base + 0] = Number(c[0] ?? 1);
      colInt[base + 1] = Number(c[1] ?? 1);
      colInt[base + 2] = Number(c[2] ?? 1);
      colInt[base + 3] = Number.isFinite(L.intensity) ? L.intensity : 1.0;

      // Common params
      params[base + 0] = Number.isFinite(L.range) ? L.range : 0.0; // range

      if (type === LightType.Directional) {
        const d = Array.isArray(L.direction) ? L.direction : this.pbrLightDirection;
        const dx = Number(d[0] ?? 0.5), dy = Number(d[1] ?? -1.0), dz = Number(d[2] ?? 0.3);
        const len = Math.hypot(dx, dy, dz) || 1;
        dirInner[base + 0] = dx / len;
        dirInner[base + 1] = dy / len;
        dirInner[base + 2] = dz / len;
        dirInner[base + 3] = 1.0;
        posType[base + 3] = LightType.Directional;
      } else {
        const p = Array.isArray(L.position) ? L.position : [0, 0, 0];
        posType[base + 0] = Number(p[0] ?? 0);
        posType[base + 1] = Number(p[1] ?? 0);
        posType[base + 2] = Number(p[2] ?? 0);
        posType[base + 3] = type;

        if (type === LightType.Spot) {
          const d = Array.isArray(L.direction) ? L.direction : [0, -1, 0];
          const dx = Number(d[0] ?? 0), dy = Number(d[1] ?? -1), dz = Number(d[2] ?? 0);
          const len = Math.hypot(dx, dy, dz) || 1;
          dirInner[base + 0] = dx / len;
          dirInner[base + 1] = dy / len;
          dirInner[base + 2] = dz / len;

          const innerCos = Number.isFinite(L.innerCos)
            ? L.innerCos
            : Number.isFinite(L.innerAngleDeg)
              ? Math.cos((L.innerAngleDeg * Math.PI) / 180)
              : 0.95;
          const outerCos = Number.isFinite(L.outerCos)
            ? L.outerCos
            : Number.isFinite(L.outerAngleDeg)
              ? Math.cos((L.outerAngleDeg * Math.PI) / 180)
              : 0.85;

          dirInner[base + 3] = innerCos;
          params[base + 1] = outerCos;
        } else {
          // Point light
          dirInner[base + 3] = 1.0;
        }
      }

      count++;
    }

    if (u.lightCount) this.gl.uniform1i(u.lightCount, count);
    if (u.lightPosType) this.gl.uniform4fv(u.lightPosType, posType);
    if (u.lightDirInner) this.gl.uniform4fv(u.lightDirInner, dirInner);
    if (u.lightColorIntensity) this.gl.uniform4fv(u.lightColorIntensity, colInt);
    if (u.lightParams) this.gl.uniform4fv(u.lightParams, params);
  }

  /**
   * Renders the skybox.
   * @private
   */
  _renderSkybox(camera3D) {
    if (!this.skyboxProgram || !this.currentSkybox || !this.currentSkybox.isLoaded()) return;
    
    const gl = this.gl;
    const skybox = this.currentSkybox;
    
    // Save current state
    const prevDepthFunc = gl.getParameter(gl.DEPTH_FUNC);
    const prevDepthMask = gl.getParameter(gl.DEPTH_WRITEMASK);
    
    // Setup skybox rendering state
    gl.useProgram(this.skyboxProgram);
    gl.depthFunc(gl.LEQUAL); // Draw at far plane
    gl.depthMask(false); // Don't write to depth buffer
    gl.disable(gl.BLEND);
    
    // Get view matrix without translation (skybox always centered)
    const viewMatrix = camera3D.getViewMatrix();
    // Remove translation from view matrix
    const viewNoTranslation = new Float32Array(viewMatrix);
    viewNoTranslation[12] = 0;
    viewNoTranslation[13] = 0;
    viewNoTranslation[14] = 0;
    
    // Combine with projection
    const projMatrix = camera3D.getProjectionMatrix();
    const viewProj = Mat4.multiply(projMatrix, viewNoTranslation);
    
    // Set uniforms
    if (this._skyboxUniforms?.viewProj) {
      gl.uniformMatrix4fv(this._skyboxUniforms.viewProj, false, viewProj);
    }
    
    // Bind cubemap texture
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, skybox.cubemapTexture);
    if (this._skyboxUniforms?.skybox) {
      gl.uniform1i(this._skyboxUniforms.skybox, 0);
    }
    
    // Draw skybox mesh
    const mesh = skybox._mesh;
    if (mesh && mesh.vbo) {
      // Manually set up attributes for skybox (only position, no color)
      gl.bindBuffer(gl.ARRAY_BUFFER, mesh.vbo);
      if (mesh.ibo) gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.ibo);
      
      const stride = 8 * 4; // position(3) + normal(3) + uv(2) - we only use position
      gl.enableVertexAttribArray(this._skyboxAttribs.position);
      gl.vertexAttribPointer(this._skyboxAttribs.position, 3, gl.FLOAT, false, stride, 0);
      
      // Ensure PBR-only attributes don't interfere when using the default VAO
      const normalLoc = this._program3DAttribs?.normal;
      const uvLoc = this._program3DAttribs?.uv;
      if (normalLoc !== undefined && normalLoc >= 0) gl.disableVertexAttribArray(normalLoc);
      if (uvLoc !== undefined && uvLoc >= 0) gl.disableVertexAttribArray(uvLoc);
      
      // Draw
      if (mesh.ibo && mesh.indices) {
        gl.drawElements(gl.TRIANGLES, mesh.indexCount, mesh.indexType, 0);
      } else {
        gl.drawArrays(gl.TRIANGLES, 0, mesh.vertexCount);
      }
    }
    
    // Restore state
    gl.depthFunc(prevDepthFunc);
    gl.depthMask(prevDepthMask);
  }

  /**
   * Sets the skybox for 3D rendering.
   * @param {import('./Skybox.js').default|null} skybox - The skybox instance, or null to disable.
   */
  setSkybox(skybox) {
    this.currentSkybox = skybox;
  }

  /**
   * Ensure IBL textures (irradiance, prefilter, brdfLUT) exist for the current skybox.
   * Kicks off async generation and returns immediately.
   */
  ensureIblForCurrentSkybox() {
    if (!this.isWebGL2 || !this._ibl?.ready) return;
    const sb = this.currentSkybox;
    if (!sb || !sb.isLoaded?.() || !sb.cubemapTexture) return;

    const key = sb.cubemapTexture;
    if (this._ibl.cache.has(key)) return;
    if (this._ibl.inFlight.has(key)) return;

    const p = this._generateIblFromCubemap(key, sb);
    this._ibl.inFlight.set(key, p);
    this.trackAssetPromise?.(p);
    p.finally(() => {
      this._ibl.inFlight.delete(key);
    });
  }

  async _generateIblFromCubemap(envCubemap, skybox) {
    const gl = this.gl;
    if (!gl || !this._ibl?.ready) return null;

    // IMPORTANT: IBL generation runs as an async function (even if it contains no awaits),
    // and it mutates GL state heavily (programs, FBOs, viewport, VAOs, active texture).
    // We MUST restore state so the main render loop doesn't break with "uniform location not from associated program"
    // or framebuffer completeness errors.
    const _prevProg = gl.getParameter(gl.CURRENT_PROGRAM);
    const _prevFb = gl.getParameter(gl.FRAMEBUFFER_BINDING);
    const _prevRb = gl.getParameter(gl.RENDERBUFFER_BINDING);
    const _prevVp = gl.getParameter(gl.VIEWPORT);
    const _prevActiveTex = gl.getParameter(gl.ACTIVE_TEXTURE);
    const _prevTex2D = gl.getParameter(gl.TEXTURE_BINDING_2D);
    const _prevTexCube = gl.getParameter(gl.TEXTURE_BINDING_CUBE_MAP);
    const _prevVao = (typeof gl.getParameter === 'function' && gl.VERTEX_ARRAY_BINDING !== undefined)
      ? gl.getParameter(gl.VERTEX_ARRAY_BINDING)
      : null;

    // Try to use float render targets when supported for best quality.
    gl.getExtension('EXT_color_buffer_float');

    const createCubemap = (size, withMips) => {
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_CUBE_MAP, tex);

      const levels = withMips ? (Math.floor(Math.log2(size)) + 1) : 1;
      for (let level = 0; level < levels; level++) {
        const w = Math.max(1, size >> level);
        const h = Math.max(1, size >> level);
        for (let face = 0; face < 6; face++) {
          gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X + face, level, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
        }
      }

      gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, withMips ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
      gl.bindTexture(gl.TEXTURE_CUBE_MAP, null);
      return { tex, levels };
    };

    const create2D = (w, h) => {
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.bindTexture(gl.TEXTURE_2D, null);
      return tex;
    };

    let fbo = null;
    let rbo = null;
    try {
      fbo = gl.createFramebuffer();
      rbo = gl.createRenderbuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.bindRenderbuffer(gl.RENDERBUFFER, rbo);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rbo);

      // Use the skybox cube mesh as capture geometry.
      const cubeMesh = skybox?._mesh;
      if (!cubeMesh) return null;

      // Bind env cubemap to unit 0 for all IBL generation shaders.
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_CUBE_MAP, envCubemap);

      // 1) Irradiance map (diffuse)
      const irrSize = 32;
      const irr = createCubemap(irrSize, false);
      gl.viewport(0, 0, irrSize, irrSize);
      // Depth attachment must match the color attachment size.
      gl.bindRenderbuffer(gl.RENDERBUFFER, rbo);
      gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, irrSize, irrSize);
      gl.useProgram(this._ibl.progIrradiance);
      if (this._ibl.uIrr.proj) gl.uniformMatrix4fv(this._ibl.uIrr.proj, false, this._ibl.captureProj);

      // Bind cube vertex layout for capture shader (position only at offset 0)
      cubeMesh.bindLayout?.(0, 1, 2);
      if (cubeMesh.vao && typeof gl.bindVertexArray === 'function') gl.bindVertexArray(cubeMesh.vao);
      else gl.bindBuffer(gl.ARRAY_BUFFER, cubeMesh.vbo);

      for (let face = 0; face < 6; face++) {
        if (this._ibl.uIrr.view) gl.uniformMatrix4fv(this._ibl.uIrr.view, false, this._ibl.captureViews[face]);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_CUBE_MAP_POSITIVE_X + face, irr.tex, 0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        cubeMesh.draw();
      }

      // 2) Prefiltered env map (specular) with mip chain
      const preSize = 128;
      const pre = createCubemap(preSize, true);
      gl.useProgram(this._ibl.progPrefilter);
      if (this._ibl.uPre.proj) gl.uniformMatrix4fv(this._ibl.uPre.proj, false, this._ibl.captureProj);

      for (let mip = 0; mip < pre.levels; mip++) {
        const w = Math.max(1, preSize >> mip);
        const h = Math.max(1, preSize >> mip);
        gl.viewport(0, 0, w, h);
        // Resize depth buffer
        gl.bindRenderbuffer(gl.RENDERBUFFER, rbo);
        gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, w, h);
        const roughness = (pre.levels <= 1) ? 0.0 : (mip / (pre.levels - 1));
        if (this._ibl.uPre.roughness) gl.uniform1f(this._ibl.uPre.roughness, roughness);

        for (let face = 0; face < 6; face++) {
          if (this._ibl.uPre.view) gl.uniformMatrix4fv(this._ibl.uPre.view, false, this._ibl.captureViews[face]);
          gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_CUBE_MAP_POSITIVE_X + face, pre.tex, mip);
          gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
          cubeMesh.draw();
        }
      }

      // 3) BRDF LUT (2D)
      const brdfSize = 256;
      const brdfTex = create2D(brdfSize, brdfSize);
      gl.viewport(0, 0, brdfSize, brdfSize);
      gl.bindRenderbuffer(gl.RENDERBUFFER, rbo);
      gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, brdfSize, brdfSize);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, brdfTex, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.useProgram(this._ibl.progBrdf);
      if (typeof gl.bindVertexArray === 'function') gl.bindVertexArray(null);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      const record = {
        irradianceMap: irr.tex,
        prefilterMap: pre.tex,
        prefilterMaxLod: pre.levels - 1,
        brdfLut: brdfTex,
      };
      this._ibl.cache.set(envCubemap, record);
      return record;
    } finally {
      // Cleanup our temporary capture targets (objects are kept alive via textures cached above).
      if (typeof gl.bindVertexArray === 'function') gl.bindVertexArray(_prevVao);
      gl.useProgram(_prevProg);
      gl.bindFramebuffer(gl.FRAMEBUFFER, _prevFb);
      gl.bindRenderbuffer(gl.RENDERBUFFER, _prevRb);
      gl.viewport(_prevVp[0], _prevVp[1], _prevVp[2], _prevVp[3]);
      gl.activeTexture(_prevActiveTex);
      gl.bindTexture(gl.TEXTURE_2D, _prevTex2D);
      gl.bindTexture(gl.TEXTURE_CUBE_MAP, _prevTexCube);

      // Detach and release temporary GPU objects.
      if (fbo) gl.deleteFramebuffer(fbo);
      if (rbo) gl.deleteRenderbuffer(rbo);
    }
  }

  /**
   * Draw a mesh during the 3D pass.
   * @param {import('./Mesh.js').default} mesh
   * @param {Float32Array|null|undefined} modelMatrix
   */
  drawMesh(mesh, modelMatrix, material) {
    if (!this._in3DPass) {
      // Caller must begin3D() explicitly so we preserve predictable layering.
      return false;
    }
    if (!mesh) return false;

    const gl = this.gl;
    // Defensive: ensure the correct program is bound (other subsystems like IBL generation may change it).
    if (this.program3D) gl.useProgram(this.program3D);
    const model = modelMatrix || this._identityModel3D;

    // Bind mesh VAO/layout (cached on mesh side)
    mesh.bindLayout(this._program3DAttribs.position, this._program3DAttribs.normal, this._program3DAttribs.uv);

    if (mesh.vao && typeof gl.bindVertexArray === 'function') {
      gl.bindVertexArray(mesh.vao);
    } else {
      // WebGL1/compat fallback: set attrib pointers each draw
      gl.bindBuffer(gl.ARRAY_BUFFER, mesh.vbo);
      if (mesh.ibo) gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.ibo);
      const stride = 8 * 4;
      gl.enableVertexAttribArray(this._program3DAttribs.position);
      gl.vertexAttribPointer(this._program3DAttribs.position, 3, gl.FLOAT, false, stride, 0);
      gl.enableVertexAttribArray(this._program3DAttribs.normal);
      gl.vertexAttribPointer(this._program3DAttribs.normal, 3, gl.FLOAT, false, stride, 12);
      gl.enableVertexAttribArray(this._program3DAttribs.uv);
      gl.vertexAttribPointer(this._program3DAttribs.uv, 2, gl.FLOAT, false, stride, 24);
    }

    const u = this._program3DUniforms;
    // Allow switching debug mode mid-pass without needing to restart begin3D().
    if (u?.materialDebugView) gl.uniform1i(u.materialDebugView, (this.materialDebugView | 0));

    // Model + normal matrix
    if (u?.model) gl.uniformMatrix4fv(u.model, false, model);
    if (u?.normalMatrix) {
      // normalMatrix = transpose(inverse(model)) upper-left 3x3
      const inv = Mat4.invert(model, this._tmpInvModel);
      const src = inv ? Mat4.transpose(inv, this._tmpInvModelT) : model;
      const nm = this._normalMatrix3;
      nm[0] = src[0];  nm[1] = src[1];  nm[2] = src[2];
      nm[3] = src[4];  nm[4] = src[5];  nm[5] = src[6];
      nm[6] = src[8];  nm[7] = src[9];  nm[8] = src[10];
      gl.uniformMatrix3fv(u.normalMatrix, false, nm);
    }

    // --- Material params (PBR metallic-roughness) ---
    const m = material || {};

    // Factors (prefer PBR naming, but accept legacy albedoColor)
    const baseFactor = m.baseColorFactor || m.albedoColor || [1, 1, 1, 1];
    if (u?.baseColorFactor) gl.uniform4fv(u.baseColorFactor, baseFactor);

    const metallicFactor = Number.isFinite(m.metallicFactor) ? Math.min(1.0, Math.max(0.0, m.metallicFactor)) : 0.0;
    if (u?.metallicFactor) gl.uniform1f(u.metallicFactor, metallicFactor);

    const roughnessFactor = Number.isFinite(m.roughnessFactor) ? Math.min(1.0, Math.max(0.04, m.roughnessFactor)) : 1.0;
    if (u?.roughnessFactor) gl.uniform1f(u.roughnessFactor, roughnessFactor);

    const normalScale = Number.isFinite(m.normalScale) ? m.normalScale : 1.0;
    if (u?.normalScale) gl.uniform1f(u.normalScale, normalScale);

    const aoStrength = Number.isFinite(m.aoStrength) ? m.aoStrength : 1.0;
    if (u?.aoStrength) gl.uniform1f(u.aoStrength, aoStrength);

    const emissiveFactor = m.emissiveFactor || [0, 0, 0];
    if (u?.emissiveFactor) gl.uniform3fv(u.emissiveFactor, emissiveFactor);

    // Alpha mode: 0 OPAQUE, 1 MASK, 2 BLEND
    const alphaMode = (m.alphaMode || 'OPAQUE');
    const alphaModeInt = (alphaMode === 'MASK') ? 1 : (alphaMode === 'BLEND') ? 2 : 0;
    const alphaCutoff = Number.isFinite(m.alphaCutoff) ? m.alphaCutoff : 0.5;
    if (u?.alphaMode) gl.uniform1i(u.alphaMode, alphaModeInt);
    if (u?.alphaCutoff) gl.uniform1f(u.alphaCutoff, alphaCutoff);

    // Blend state (basic)
    if (alphaModeInt === 2) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
    } else {
      gl.disable(gl.BLEND);
      gl.depthMask(true);
    }

    // Textures (bind defaults if missing)
    const d = this._defaultPbrTextures || {};

    const baseTex = m.baseColorTexture || m.albedoTexture || d.baseColor;
    const metallicTex = m.metallicTexture || d.metallic;
    const roughnessTex = m.roughnessTexture || d.roughness;
    const normalTex = m.normalTexture || d.normal;
    const aoTex = m.aoTexture || d.ao;
    const emissiveTex = m.emissiveTexture || d.emissive;
    const alphaTex = m.alphaTexture || d.alpha;

    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, baseTex);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, metallicTex);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, roughnessTex);
    gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, normalTex);
    gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D, aoTex);
    gl.activeTexture(gl.TEXTURE5); gl.bindTexture(gl.TEXTURE_2D, emissiveTex);
    gl.activeTexture(gl.TEXTURE6); gl.bindTexture(gl.TEXTURE_2D, alphaTex);

    // Draw call
    mesh.draw();
    return true;
  }

  // --- Shadow mapping (directional light) ---
  _initShadowMapResources() {
    const gl = this.gl;
    if (!this.isWebGL2) return;
    const size = Math.max(64, (this.shadowMapSize | 0) || 1024);
    this.shadowMapSize = size;
    const layers = this.csmEnabled ? Math.max(1, Math.min(4, this.csmCascadeCount | 0)) : 1;

    // Recreate the depth texture if missing (or if previous was 2D).
    if (!this.shadowDepthTexture) this.shadowDepthTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.shadowDepthTexture);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    // Manual depth compare in shader, so keep compare mode disabled.
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_COMPARE_MODE, gl.NONE);
    // Use DEPTH_COMPONENT16 for broad WebGL2 compatibility (some drivers are picky with DEPTH_COMPONENT24 for TEXTURE_2D_ARRAY).
    gl.texImage3D(
      gl.TEXTURE_2D_ARRAY,
      0,
      gl.DEPTH_COMPONENT16,
      size,
      size,
      layers,
      0,
      gl.DEPTH_COMPONENT,
      gl.UNSIGNED_SHORT,
      null
    );
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, null);

    if (!this.shadowFramebuffer) this.shadowFramebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFramebuffer);
    // Attach layer 0 for completeness check; rendering will attach per-layer.
    gl.framebufferTextureLayer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, this.shadowDepthTexture, 0, 0);
    // Depth-only FBO: no color attachments
    gl.drawBuffers([gl.NONE]);
    gl.readBuffer(gl.NONE);
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this._shadowReady = (status === gl.FRAMEBUFFER_COMPLETE);
    if (!this._shadowReady) {
      console.warn('Shadow framebuffer incomplete:', status, '(try lowering resolution or disabling CSM)');
    }
  }

  _initSceneDepthResources(width, height) {
    const gl = this.gl;
    if (!this.isWebGL2) return false;
    const w = Math.max(1, width | 0);
    const h = Math.max(1, height | 0);
    if (this.sceneDepthTexture && this.sceneDepthFramebuffer && this._sceneDepthW === w && this._sceneDepthH === h) {
      return true;
    }

    this._sceneDepthW = w;
    this._sceneDepthH = h;

    if (!this.sceneDepthTexture) this.sceneDepthTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.sceneDepthTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.NONE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT16, w, h, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_SHORT, null);
    gl.bindTexture(gl.TEXTURE_2D, null);

    if (!this.sceneDepthFramebuffer) this.sceneDepthFramebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.sceneDepthFramebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this.sceneDepthTexture, 0);
    gl.drawBuffers([gl.NONE]);
    gl.readBuffer(gl.NONE);
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      console.warn('Scene depth prepass framebuffer incomplete:', status);
      return false;
    }
    return true;
  }

  /**
   * Render a camera-depth prepass into a depth texture (used for contact shadows).
   * @param {import('./Camera3D.js').default|null|undefined} camera3D
   * @param {() => void} drawCasters
   * @returns {boolean}
   */
  renderContactDepth(camera3D, drawCasters) {
    if (!this.isReady) return false;
    if (!this.isWebGL2 || !this.contactShadowsEnabled) return false;
    if (!this.depthPrepassProgram || !this._depthPrepassUniforms) return false;
    if (typeof drawCasters !== 'function') return false;

    const gl = this.gl;
    const cam = camera3D || this._defaultCamera3D;

    const vp = gl.getParameter(gl.VIEWPORT);
    const w = vp[2] | 0;
    const h = vp[3] | 0;
    if (!this._initSceneDepthResources(w, h)) return false;

    const prevFb = gl.getParameter(gl.FRAMEBUFFER_BINDING);
    const prevVp = vp;
    const prevProg = gl.getParameter(gl.CURRENT_PROGRAM);

    try {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.sceneDepthFramebuffer);
      gl.viewport(0, 0, w, h);
      gl.clearDepth(1.0);
      gl.clear(gl.DEPTH_BUFFER_BIT);

      gl.useProgram(this.depthPrepassProgram);
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);
      gl.depthMask(true);
      gl.disable(gl.BLEND);

      const vpMat = cam.getViewProjectionMatrix();
      if (this._depthPrepassUniforms.viewProj) gl.uniformMatrix4fv(this._depthPrepassUniforms.viewProj, false, vpMat);

      // During drawCasters(), MeshNode.drawShadow will call renderer.drawMeshShadow (shadow program).
      // For the depth prepass we want the same caster traversal but calling our depth variant.
      this._inContactDepthPass = true;
      drawCasters();
      this._inContactDepthPass = false;

      return true;
    } finally {
      this._inContactDepthPass = false;
      gl.useProgram(prevProg);
      gl.bindFramebuffer(gl.FRAMEBUFFER, prevFb);
      gl.viewport(prevVp[0], prevVp[1], prevVp[2], prevVp[3]);
    }
  }

  // Shadow tuning / options
  static ShadowFilter = Object.freeze({
    PS2: 1,   // hard, 1 tap
    PCF3: 3,  // 3x3
    PCF5: 5,  // 5x5
  });

  /**
   * Set shadow filter mode.
   * @param {number|string} mode - 1|'ps2'|'hard' or 3|'pcf3' or 5|'pcf5'
   */
  setShadowFilter(mode) {
    let k = 3;
    if (typeof mode === 'number' && Number.isFinite(mode)) {
      k = mode | 0;
    } else {
      const s = String(mode || '').toLowerCase().replace(/[\s_-]/g, '');
      if (s === 'ps2' || s === 'hard' || s === 'nearest') k = 1;
      else if (s === 'pcf5') k = 5;
      else k = 3;
    }
    if (k !== 1 && k !== 3 && k !== 5) k = 3;
    this.shadowPcfKernel = k;
    // Keep depth textures NEAREST-filtered for broad WebGL compatibility.
    // Softness is controlled by PCF taps + radius instead.
  }

  /** @param {number} texels */
  setShadowSoftness(texels) {
    this.shadowPcfRadius = Math.max(0.0, Number(texels) || 0.0);
  }

  /** @param {number} start @param {number} end */
  setShadowFade(start, end) {
    this.shadowFadeStart = Number(start) || 0.0;
    this.shadowFadeEnd = Number(end) || 0.0;
  }

  /** @param {boolean} enabled */
  setShadowAffectsIndirect(enabled) {
    this.shadowAffectsIndirect = !!enabled;
  }

  /** @param {number} strength 0..1 */
  setShadowStrength(strength) {
    const s = Number(strength);
    this.shadowStrength = Number.isFinite(s) ? Math.max(0.0, Math.min(1.0, s)) : 1.0;
  }

  /** @param {number} count 1..4 */
  setCsmCascadeCount(count) {
    const c = Math.max(1, Math.min(4, (Number(count) || 0) | 0));
    this.csmCascadeCount = c;
    this._initShadowMapResources();
  }

  /** @param {number} lambda 0..1 */
  setCsmSplitLambda(lambda) {
    const l = Number(lambda);
    this.csmSplitLambda = Number.isFinite(l) ? Math.max(0.0, Math.min(1.0, l)) : 0.6;
  }

  /** @param {number} blend 0..0.5 (fraction of cascade length) */
  setCsmBlend(blend) {
    const b = Number(blend);
    this.csmBlend = Number.isFinite(b) ? Math.max(0.0, Math.min(0.5, b)) : 0.15;
  }

  /** @param {number} maxDistance 0 = use camera far */
  setCsmMaxDistance(maxDistance) {
    const d = Number(maxDistance);
    this.csmMaxDistance = Number.isFinite(d) ? Math.max(0.0, d) : 0.0;
  }

  /**
   * Reallocate the shadow map depth texture to a new resolution.
   * @param {number} size e.g. 512, 1024, 2048
   * @returns {boolean}
   */
  setShadowMapResolution(size) {
    const s = Math.max(64, (Number(size) || 0) | 0);
    // Round to power-of-two-ish values helps tooling and predictability.
    const snapped = (s <= 64) ? 64 : (s <= 128) ? 128 : (s <= 256) ? 256 : (s <= 512) ? 512 : (s <= 1024) ? 1024 : (s <= 2048) ? 2048 : s;
    this.shadowMapSize = snapped;
    if (!this.isWebGL2) return false;
    // Re-init resources to apply new size.
    this._initShadowMapResources();
    return !!this._shadowReady;
  }

  /** @returns {{resolution:number,kernel:number,radius:number,strength:number}} */
  getShadowQuality() {
    return {
      resolution: this.shadowMapSize | 0,
      kernel: (this.shadowPcfKernel | 0) || 1,
      radius: Number(this.shadowPcfRadius) || 0,
      strength: Number(this.shadowStrength) || 0,
    };
  }

  // Contact shadow API
  setContactShadowsEnabled(enabled) { this.contactShadowsEnabled = !!enabled; }
  setContactShadowStrength(v) { this.contactShadowStrength = Math.max(0.0, Math.min(1.0, Number(v) || 0.0)); }
  setContactShadowMaxDistance(v) { this.contactShadowMaxDistance = Math.max(0.0, Number(v) || 0.0); }
  setContactShadowSteps(v) { this.contactShadowSteps = Math.max(0, Math.min(32, (Number(v) || 0) | 0)); }
  setContactShadowThickness(v) { this.contactShadowThickness = Math.max(0.0, Number(v) || 0.0); }

  // --- Cascaded Shadow Maps (CSM) ---
  _getMainDirectionalLightDir(lights) {
    // Pick a directional light direction (fallback to renderer default).
    let dirArr = this.pbrLightDirection;
    if (Array.isArray(lights)) {
      for (const L of lights) {
        if (!L) continue;
        const type = (typeof L.type === 'number') ? (L.type | 0)
          : (String(L.type || '').toLowerCase() === 'directional') ? LightType.Directional
            : (String(L.type || '').toLowerCase() === 'sun') ? LightType.Directional
              : null;
        if (type === LightType.Directional) {
          if (Array.isArray(L.direction)) dirArr = L.direction;
          break;
        }
      }
    }
    const dx = Number(dirArr[0] ?? 0.5);
    const dy = Number(dirArr[1] ?? -1.0);
    const dz = Number(dirArr[2] ?? 0.3);
    const len = Math.hypot(dx, dy, dz) || 1;
    return [dx / len, dy / len, dz / len];
  }

  _computeCsmForCamera(camera3D, lights) {
    const cam = camera3D || this._defaultCamera3D;
    const count = this.csmEnabled ? Math.max(1, Math.min(4, this.csmCascadeCount | 0)) : 1;

    const near = Math.max(1e-4, Number(cam.near) || 0.1);
    const farRaw = Math.max(near + 1e-3, Number(cam.far) || 100.0);
    const far = (Number.isFinite(this.csmMaxDistance) && this.csmMaxDistance > 0)
      ? Math.min(farRaw, this.csmMaxDistance)
      : farRaw;

    this._csmNearUsed = near;
    this._csmFarUsed = far;

    const lambda = Math.max(0.0, Math.min(1.0, Number(this.csmSplitLambda) || 0.6));

    // Split ends (view space)
    for (let i = 0; i < 4; i++) this._csmSplitsData[i] = far;
    for (let i = 1; i <= count; i++) {
      const p = i / count;
      const log = near * Math.pow(far / near, p);
      const lin = near + (far - near) * p;
      this._csmSplitsData[i - 1] = log * lambda + lin * (1.0 - lambda);
    }

    // Camera basis
    const tmp = this._csmTmp;
    tmp.forward.set(cam.target.x - cam.position.x, cam.target.y - cam.position.y, cam.target.z - cam.position.z).normalize();
    tmp.up.set(cam.up.x, cam.up.y, cam.up.z).normalize();
    // right = cross(forward, up)
    tmp.right.set(
      (tmp.forward.y * tmp.up.z - tmp.forward.z * tmp.up.y),
      (tmp.forward.z * tmp.up.x - tmp.forward.x * tmp.up.z),
      (tmp.forward.x * tmp.up.y - tmp.forward.y * tmp.up.x),
    ).normalize();
    // up = cross(right, forward) (re-orthonormalize)
    tmp.up.set(
      (tmp.right.y * tmp.forward.z - tmp.right.z * tmp.forward.y),
      (tmp.right.z * tmp.forward.x - tmp.right.x * tmp.forward.z),
      (tmp.right.x * tmp.forward.y - tmp.right.y * tmp.forward.x),
    ).normalize();

    const aspect = (this.targetWidth > 0 && this.targetHeight > 0) ? (this.targetWidth / this.targetHeight) : 1.0;
    const tanFov = Math.tan((Number(cam.fovY) || (Math.PI / 3)) * 0.5);

    const [lx, ly, lz] = this._getMainDirectionalLightDir(lights);
    // Avoid degenerate up vector when light is near vertical.
    if (Math.abs(ly) > 0.99) this._shadowUp.set(0, 0, 1);
    else this._shadowUp.set(0, 1, 0);

    let prev = near;
    for (let cIdx = 0; cIdx < count; cIdx++) {
      const splitEnd = this._csmSplitsData[cIdx];
      const splitStart = prev;
      prev = splitEnd;

      const hn = tanFov * splitStart;
      const wn = hn * aspect;
      const hf = tanFov * splitEnd;
      const wf = hf * aspect;

      // centers
      tmp.centerNear.set(
        cam.position.x + tmp.forward.x * splitStart,
        cam.position.y + tmp.forward.y * splitStart,
        cam.position.z + tmp.forward.z * splitStart,
      );
      tmp.centerFar.set(
        cam.position.x + tmp.forward.x * splitEnd,
        cam.position.y + tmp.forward.y * splitEnd,
        cam.position.z + tmp.forward.z * splitEnd,
      );

      const corners = this._csmCorners;
      // Near plane
      corners[0].set(tmp.centerNear.x + tmp.up.x * hn - tmp.right.x * wn, tmp.centerNear.y + tmp.up.y * hn - tmp.right.y * wn, tmp.centerNear.z + tmp.up.z * hn - tmp.right.z * wn);
      corners[1].set(tmp.centerNear.x + tmp.up.x * hn + tmp.right.x * wn, tmp.centerNear.y + tmp.up.y * hn + tmp.right.y * wn, tmp.centerNear.z + tmp.up.z * hn + tmp.right.z * wn);
      corners[2].set(tmp.centerNear.x - tmp.up.x * hn + tmp.right.x * wn, tmp.centerNear.y - tmp.up.y * hn + tmp.right.y * wn, tmp.centerNear.z - tmp.up.z * hn + tmp.right.z * wn);
      corners[3].set(tmp.centerNear.x - tmp.up.x * hn - tmp.right.x * wn, tmp.centerNear.y - tmp.up.y * hn - tmp.right.y * wn, tmp.centerNear.z - tmp.up.z * hn - tmp.right.z * wn);
      // Far plane
      corners[4].set(tmp.centerFar.x + tmp.up.x * hf - tmp.right.x * wf, tmp.centerFar.y + tmp.up.y * hf - tmp.right.y * wf, tmp.centerFar.z + tmp.up.z * hf - tmp.right.z * wf);
      corners[5].set(tmp.centerFar.x + tmp.up.x * hf + tmp.right.x * wf, tmp.centerFar.y + tmp.up.y * hf + tmp.right.y * wf, tmp.centerFar.z + tmp.up.z * hf + tmp.right.z * wf);
      corners[6].set(tmp.centerFar.x - tmp.up.x * hf + tmp.right.x * wf, tmp.centerFar.y - tmp.up.y * hf + tmp.right.y * wf, tmp.centerFar.z - tmp.up.z * hf + tmp.right.z * wf);
      corners[7].set(tmp.centerFar.x - tmp.up.x * hf - tmp.right.x * wf, tmp.centerFar.y - tmp.up.y * hf - tmp.right.y * wf, tmp.centerFar.z - tmp.up.z * hf - tmp.right.z * wf);

      // cascade center
      tmp.center.set(0, 0, 0);
      for (let i = 0; i < 8; i++) tmp.center.add(corners[i]);
      tmp.center.scale(1 / 8);

      // light view (position doesn't affect an ortho shadow much; just keep it stable)
      const dist = Math.max(10.0, (Number(this.shadowFar) || 80) * 0.5);
      tmp.lightPos.set(tmp.center.x - lx * dist, tmp.center.y - ly * dist, tmp.center.z - lz * dist);
      Mat4.lookAt(tmp.lightPos, tmp.center, this._shadowUp, this._shadowView);

      // bounds in light space
      let minX = Infinity, minY = Infinity, minZ = Infinity;
      let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
      for (let i = 0; i < 8; i++) {
        Mat4.transformPoint(this._shadowView, corners[i], tmp.tmpP);
        const x = tmp.tmpP.x, y = tmp.tmpP.y, z = tmp.tmpP.z;
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
        if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
      }

      // Stabilize: square extents + snap to texel grid to reduce shimmering.
      const extent = Math.max(maxX - minX, maxY - minY);
      let cx = (minX + maxX) * 0.5;
      let cy = (minY + maxY) * 0.5;
      const texels = Math.max(1, this.shadowMapSize | 0);
      const unitsPerTexel = extent / texels;
      if (unitsPerTexel > 0) {
        cx = Math.floor(cx / unitsPerTexel) * unitsPerTexel;
        cy = Math.floor(cy / unitsPerTexel) * unitsPerTexel;
      }
      minX = cx - extent * 0.5;
      maxX = cx + extent * 0.5;
      minY = cy - extent * 0.5;
      maxY = cy + extent * 0.5;

      const zPad = 10.0;
      // Mat4.ortho in this engine expects near/far as POSITIVE distances along -Z (OpenGL convention),
      // while our light-view Z values for points in front are typically NEGATIVE.
      // Convert the light-space Z bounds into positive near/far distances so depth testing stores the nearest surface.
      const nearDist = Math.max(0.1, (-maxZ) - zPad);
      const farDist = Math.max(nearDist + 1.0, (-minZ) + zPad);
      Mat4.ortho(minX, maxX, minY, maxY, nearDist, farDist, this._shadowProj);
      Mat4.multiply(this._shadowProj, this._shadowView, this._shadowLightViewProj);
      this._csmLightViewProjData.set(this._shadowLightViewProj, cIdx * 16);
    }

    // Fill remaining matrices with identity (stable uniform upload)
    for (let i = count; i < 4; i++) this._csmLightViewProjData.set(Mat4.identity(), i * 16);
    return count;
  }

  /**
   * Render all shadow maps for the main directional light.
   * For CSM this renders multiple cascades into a depth texture array.
   *
   * @param {import('./Camera3D.js').default|null|undefined} camera3D
   * @param {any[]|null|undefined} lights
   * @param {() => void} drawCasters
   * @returns {boolean}
   */
  renderShadowMaps(camera3D, lights, drawCasters) {
    if (!this.isReady) return false;
    if (!this.isWebGL2 || !this.shadowsEnabled) return false;
    if (!this.shadowProgram || !this.shadowFramebuffer || !this.shadowDepthTexture) return false;
    if (!this._shadowReady) return false;
    if (typeof drawCasters !== 'function') return false;

    const gl = this.gl;
    const prevFb = gl.getParameter(gl.FRAMEBUFFER_BINDING);
    const prevVp = gl.getParameter(gl.VIEWPORT);
    const prevProg = gl.getParameter(gl.CURRENT_PROGRAM);
    const prevPolyOffset = gl.isEnabled(gl.POLYGON_OFFSET_FILL);

    const cascadeCount = this._computeCsmForCamera(camera3D || this._defaultCamera3D, lights);

    try {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFramebuffer);
      gl.viewport(0, 0, this.shadowMapSize, this.shadowMapSize);
      gl.useProgram(this.shadowProgram);
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);
      gl.depthMask(true);
      gl.disable(gl.BLEND);
      gl.enable(gl.POLYGON_OFFSET_FILL);
      gl.polygonOffset(2.0, 4.0);

      this._inShadowPass = true;

      for (let cIdx = 0; cIdx < cascadeCount; cIdx++) {
        gl.framebufferTextureLayer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, this.shadowDepthTexture, 0, cIdx);
        gl.clearDepth(1.0);
        gl.clear(gl.DEPTH_BUFFER_BIT);

        if (this._shadowUniforms?.lightViewProj) {
          gl.uniformMatrix4fv(
            this._shadowUniforms.lightViewProj,
            false,
            this._csmLightViewProjData.subarray(cIdx * 16, cIdx * 16 + 16)
          );
        }

        drawCasters();
      }
      return true;
    } finally {
      this._inShadowPass = false;
      if (!prevPolyOffset) gl.disable(gl.POLYGON_OFFSET_FILL);
      gl.useProgram(prevProg);
      gl.bindFramebuffer(gl.FRAMEBUFFER, prevFb);
      gl.viewport(prevVp[0], prevVp[1], prevVp[2], prevVp[3]);
    }
  }

  /**
   * Begin the directional shadow depth pass. Call `drawMeshShadow` for each caster, then `endShadowPass`.
   * @param {import('./Camera3D.js').default|null|undefined} camera3D
   * @param {any[]|null|undefined} lights - scene/override lights
   */
  beginShadowPass(camera3D, lights) {
    if (!this.isReady) return false;
    if (!this.isWebGL2 || !this.shadowsEnabled) return false;
    if (!this.shadowProgram || !this.shadowFramebuffer || !this.shadowDepthTexture) return false;
    if (!this._shadowReady) return false;

    const gl = this.gl;
    const cam = camera3D || this._defaultCamera3D;

    // Save state so we can restore the active render target + viewport for the main pass.
    this._shadowPrevFb = gl.getParameter(gl.FRAMEBUFFER_BINDING);
    const vp = gl.getParameter(gl.VIEWPORT);
    this._shadowPrevVp = new Int32Array(vp); // copy

    // Pick a directional light direction (fallback to renderer default).
    let dirArr = this.pbrLightDirection;
    if (Array.isArray(lights)) {
      for (const L of lights) {
        if (!L) continue;
        const type = (typeof L.type === 'number') ? (L.type | 0)
          : (String(L.type || '').toLowerCase() === 'directional') ? LightType.Directional
            : (String(L.type || '').toLowerCase() === 'sun') ? LightType.Directional
              : null;
        if (type === LightType.Directional) {
          if (Array.isArray(L.direction)) dirArr = L.direction;
          break;
        }
      }
    }

    const dx = Number(dirArr[0] ?? 0.5);
    const dy = Number(dirArr[1] ?? -1.0);
    const dz = Number(dirArr[2] ?? 0.3);
    const len = Math.hypot(dx, dy, dz) || 1;
    const lx = dx / len, ly = dy / len, lz = dz / len;

    // Shadow target: focus around the camera target (simple + stable).
    this._shadowTarget.set(cam.target.x, cam.target.y, cam.target.z);

    // Light position: move backward along light direction so the ortho frustum covers the scene.
    const dist = Math.max(1.0, (this.shadowFar * 0.5));
    this._shadowLightPos.set(
      this._shadowTarget.x - lx * dist,
      this._shadowTarget.y - ly * dist,
      this._shadowTarget.z - lz * dist
    );

    // Avoid degenerate up vector when light is near vertical.
    if (Math.abs(ly) > 0.99) this._shadowUp.set(0, 0, 1);
    else this._shadowUp.set(0, 1, 0);

    Mat4.lookAt(this._shadowLightPos, this._shadowTarget, this._shadowUp, this._shadowView);
    const s = Number.isFinite(this.shadowOrthoSize) ? this.shadowOrthoSize : 25.0;
    Mat4.ortho(-s, s, -s, s, this.shadowNear, this.shadowFar, this._shadowProj);
    Mat4.multiply(this._shadowProj, this._shadowView, this._shadowLightViewProj);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFramebuffer);
    gl.viewport(0, 0, this.shadowMapSize, this.shadowMapSize);
    gl.clearDepth(1.0);
    gl.clear(gl.DEPTH_BUFFER_BIT);

    gl.useProgram(this.shadowProgram);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.depthMask(true);
    gl.disable(gl.BLEND);

    // Optional rasterization bias helps reduce acne in addition to shader bias.
    gl.enable(gl.POLYGON_OFFSET_FILL);
    gl.polygonOffset(2.0, 4.0);

    if (this._shadowUniforms?.lightViewProj) gl.uniformMatrix4fv(this._shadowUniforms.lightViewProj, false, this._shadowLightViewProj);

    this._inShadowPass = true;
    return true;
  }

  drawMeshShadow(mesh, modelMatrix) {
    // This function is reused by multiple depth-only passes:
    // - shadow map pass (CSM / single)
    // - camera depth prepass for contact shadows
    if (!this._inShadowPass && !this._inContactDepthPass) return false;
    if (!mesh) return false;

    const gl = this.gl;
    const model = modelMatrix || this._identityModel3D;

    const isContact = !!this._inContactDepthPass;
    const prog = isContact ? this.depthPrepassProgram : this.shadowProgram;
    const a = isContact ? (this._depthPrepassAttribs || {}) : (this._shadowAttribs || {});
    const u = isContact ? (this._depthPrepassUniforms || {}) : (this._shadowUniforms || {});

    if (!prog) return false;
    gl.useProgram(prog);

    // Bind mesh VAO/layout for the active depth program.
    mesh.bindLayout(a.position ?? 0, a.normal ?? -1, a.uv ?? -1);

    if (mesh.vao && typeof gl.bindVertexArray === 'function') gl.bindVertexArray(mesh.vao);
    else {
      gl.bindBuffer(gl.ARRAY_BUFFER, mesh.vbo);
      if (mesh.ibo) gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.ibo);
      const stride = 8 * 4;
      if ((a.position ?? -1) >= 0) {
        gl.enableVertexAttribArray(a.position);
        gl.vertexAttribPointer(a.position, 3, gl.FLOAT, false, stride, 0);
      }
    }

    if (u?.model) gl.uniformMatrix4fv(u.model, false, model);

    mesh.draw();
    return true;
  }

  endShadowPass() {
    if (!this._inShadowPass) return;
    const gl = this.gl;
    gl.disable(gl.POLYGON_OFFSET_FILL);
    // Restore the framebuffer + viewport that were active before the shadow pass.
    gl.bindFramebuffer(gl.FRAMEBUFFER, this._shadowPrevFb);
    const vp = this._shadowPrevVp;
    if (vp && vp.length >= 4) gl.viewport(vp[0], vp[1], vp[2], vp[3]);
    this._inShadowPass = false;
  }

  /** End 3D rendering and restore 2D state. */
  end3D() {
    if (!this._in3DPass) return;
    const gl = this.gl;
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    // Restore the active 2D program (instanced vs legacy).
    if (this._isInstancingEnabled()) {
      gl.useProgram(this.instancedProgram);
    } else {
      gl.useProgram(this.program);
    }
    this._in3DPass = false;
  }

  flush() {
    if (this.quadCount === 0) return;

    if (this._isInstancingEnabled()) {
      // 2D sprite shader samples from texture unit 0.
      // PBR may leave the active unit at 1..6, so force it back to 0 here.
      this.gl.activeTexture(this.gl.TEXTURE0);
      this.gl.bindTexture(this.gl.TEXTURE_2D, this.currentTexture);
      this.gl.bindVertexArray(this.instancedVao);

      // Upload only the used portion
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.instanceBuffer);
      const view = this.instanceData.subarray(0, this.quadCount * this._instanceFloats);
      this.gl.bufferSubData(this.gl.ARRAY_BUFFER, 0, view);

      // Draw instanced quad strip
      this.gl.drawArraysInstanced(this.gl.TRIANGLE_STRIP, 0, 4, this.quadCount);

      this.gl.bindVertexArray(null);
      this.drawCallCount++;
      this._instancedDrawCallsThisFrame++;
      this.quadCount = 0;
      return;
    }

    // 2D sprite shader samples from texture unit 0.
    this.gl.activeTexture(this.gl.TEXTURE0);
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.currentTexture);

    if (this.quadVao) {
      this.gl.bindVertexArray(this.quadVao);
    } else {
      // WebGL1 safety: make sure the index buffer is bound (ELEMENT_ARRAY_BUFFER binding can be disturbed).
      this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
    }
    
    // Bind vertex buffer and upload data
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBuffer);
    // Only upload the used portion of the buffer
    const view = this.vertexData.subarray(0, this.quadCount * 4 * this.VERTEX_SIZE);
    this.gl.bufferSubData(this.gl.ARRAY_BUFFER, 0, view);

    if (!this.quadVao) {
      // WebGL1: Ensure attributes are enabled and pointing to the correct buffer
      this.gl.enableVertexAttribArray(this.positionLocation);
      this.gl.vertexAttribPointer(this.positionLocation, 2, this.gl.FLOAT, false, this.STRIDE, 0);
      
      this.gl.enableVertexAttribArray(this.texcoordLocation);
      this.gl.vertexAttribPointer(this.texcoordLocation, 2, this.gl.FLOAT, false, this.STRIDE, 8);

      this.gl.enableVertexAttribArray(this.colorLocation);
      this.gl.vertexAttribPointer(this.colorLocation, 4, this.gl.FLOAT, false, this.STRIDE, 16);
    }

    // Draw
    this.gl.drawElements(this.gl.TRIANGLES, this.quadCount * 6, this.gl.UNSIGNED_SHORT, 0);

    if (this.quadVao) {
      this.gl.bindVertexArray(null);
    }
    
    this.drawCallCount++;
    this._legacyDrawCallsThisFrame++;
    this.quadCount = 0;
  }

  blitTexture(texture) {
      // Simple full-screen quad draw using the current program (which is likely the sprite shader)
      // We need to reset uniforms to identity/screen space
      this.gl.useProgram(this.program);
      
      // Reset camera uniforms to identity
      this.gl.uniform2f(this.cameraPositionLocation, 0, 0);
      this.gl.uniform1f(this.cameraZoomLocation, 1.0);
      this.gl.uniform1f(this.cameraRotationLocation, 0.0);
      // When blitting, we draw in *pixel* space to cover the full canvas.
      this.gl.uniform2f(this.resolutionLocation, this.canvas.width, this.canvas.height);
      
      // Draw a quad that covers the full canvas (device pixels).
      
      this.gl.activeTexture(this.gl.TEXTURE0);

      // When sampling from a framebuffer texture, WebGL's texture origin ends up effectively flipped
      // relative to our normal sprite/image upload path. Flip V here to keep the final image upright.
      this.gl.bindTexture(this.gl.TEXTURE_2D, texture);

      // Use a separate buffer or just overwrite the batch buffer for this single draw
      // For simplicity, let's use the batch buffer but treat it as a single quad
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBuffer);
      
      // White tint
      // this.gl.uniform4fv(this.colorLocation, [1, 1, 1, 1]); // Removed uniform

      const w = this.canvas.width;
      const h = this.canvas.height;

      // Vertex structure: x, y, u, v, r, g, b, a
      // Flip V: top uses v=1, bottom uses v=0
      const quad = this._blitQuadScratch;
      // Top-left
      quad[0] = 0;   quad[1] = 0;   quad[2] = 0; quad[3] = 1; quad[4] = 1; quad[5] = 1; quad[6] = 1; quad[7] = 1;
      // Top-right
      quad[8] = w;   quad[9] = 0;   quad[10] = 1; quad[11] = 1; quad[12] = 1; quad[13] = 1; quad[14] = 1; quad[15] = 1;
      // Bottom-left
      quad[16] = 0;  quad[17] = h;  quad[18] = 0; quad[19] = 0; quad[20] = 1; quad[21] = 1; quad[22] = 1; quad[23] = 1;
      // Bottom-right
      quad[24] = w;  quad[25] = h;  quad[26] = 1; quad[27] = 0; quad[28] = 1; quad[29] = 1; quad[30] = 1; quad[31] = 1;

      // vertexBuffer was allocated large enough in initGL; no need to reallocate per blit.
      this.gl.bufferSubData(this.gl.ARRAY_BUFFER, 0, quad);

      if (this.quadVao) {
        this.gl.bindVertexArray(this.quadVao);
      } else {
        // Ensure attributes (WebGL1)
        this.gl.enableVertexAttribArray(this.positionLocation);
        this.gl.vertexAttribPointer(this.positionLocation, 2, this.gl.FLOAT, false, this.STRIDE, 0);
        this.gl.enableVertexAttribArray(this.texcoordLocation);
        this.gl.vertexAttribPointer(this.texcoordLocation, 2, this.gl.FLOAT, false, this.STRIDE, 8);
        this.gl.enableVertexAttribArray(this.colorLocation);
        this.gl.vertexAttribPointer(this.colorLocation, 4, this.gl.FLOAT, false, this.STRIDE, 16);
      }

      this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);

      if (this.quadVao) {
        this.gl.bindVertexArray(null);
      }
  }

  applyTransform(camera) {
    if (!this.isReady) return;
    
    // Flush current batch because camera uniforms are changing
    this.flush();

    if (this._isInstancingEnabled()) {
      this.gl.useProgram(this.instancedProgram);

      this.activeCamera = camera;
      this.gl.uniform2f(this._instancedUniforms.cameraPosition, camera.x, camera.y);
      this.gl.uniform1f(this._instancedUniforms.cameraZoom, camera.zoom);
      this.gl.uniform1f(this._instancedUniforms.cameraRotation, camera.rotation);
      this.gl.uniform2f(this._instancedUniforms.resolution, this.targetWidth, this.targetHeight);
      return;
    }

    this.gl.useProgram(this.program);

    // Store the camera used for rendering so other systems (e.g. input hit-testing)
    // can use the exact same transform.
    this.activeCamera = camera;

    // Set individual uniforms for position, zoom, and rotation
    this.gl.uniform2f(this.cameraPositionLocation, camera.x, camera.y);
    this.gl.uniform1f(this.cameraZoomLocation, camera.zoom);
    this.gl.uniform1f(this.cameraRotationLocation, camera.rotation);

    // Godot-like logical pixel resolution for world coords.
    // Objects are placed in [0..targetWidth] x [0..targetHeight] by default.
    this.gl.uniform2f(this.resolutionLocation, this.targetWidth, this.targetHeight);
  }

  drawQuad(texture, x, y, width, height, srcX, srcY, srcWidth, srcHeight, color = [255, 255, 255, 255]) {
    if (!this.isReady) return;

    this._spritesThisFrame++;

    // Mark cache usage for LRU.
    const key = this._textureToCacheKey.get(texture);
    if (key) {
      const entry = this.textureCache.get(key);
      if (entry) entry.lastUsedFrame = this._frameId;
    }
    
    let finalColor = color;
    let u0 = 0, v0 = 0, u1 = 1, v1 = 1;

    // Handle overloaded arguments
    // Case 1: drawQuad(tex, x, y, w, h, colorArray)
    if (Array.isArray(srcX)) {
        finalColor = srcX;
    } 
    // Case 2: drawQuad(tex, x, y, w, h, srcX, srcY, srcW, srcH, [color])
    else if (typeof srcX === 'number') {
        const dims = this._textureDimensions.get(texture);
        const texW = dims ? dims.width : 1;
        const texH = dims ? dims.height : 1;
        
        // If srcWidth/Height are 0 (or missing), use full texture dimensions
        const sX = srcX || 0;
        const sY = srcY || 0;
        const sW = srcWidth || texW;
        const sH = srcHeight || texH;

        // Calculate UVs using a top-left origin.
        // Textures are uploaded with UNPACK_FLIP_Y_WEBGL, so v=0 corresponds to the top.
        u0 = sX / texW;
        u1 = (sX + sW) / texW;

        v0 = sY / texH;          // Top
        v1 = (sY + sH) / texH;   // Bottom
    }

    // Check if we need to flush
    if (this.currentTexture !== texture || this.quadCount >= this.MAX_QUADS) {
        this.flush();
        this.currentTexture = texture;
    }

    // Normalize color once (optimization: avoid repeated division)
    const r = finalColor[0] * 0.00392156862745098; // 1/255
    const g = finalColor[1] * 0.00392156862745098;
    const b = finalColor[2] * 0.00392156862745098;
    const a = finalColor[3] * 0.00392156862745098;

    // WebGL2 instanced path: one instance per sprite (no per-vertex expansion)
    if (this._isInstancingEnabled()) {
      this._usedInstancingThisFrame = true;
      let i = this.quadCount * this._instanceFloats;
      this.instanceData[i++] = x;
      this.instanceData[i++] = y;
      this.instanceData[i++] = width;
      this.instanceData[i++] = height;
      this.instanceData[i++] = u0;
      this.instanceData[i++] = v0;
      this.instanceData[i++] = u1;
      this.instanceData[i++] = v1;
      this.instanceData[i++] = r;
      this.instanceData[i++] = g;
      this.instanceData[i++] = b;
      this.instanceData[i++] = a;
      this.quadCount++;
      return;
    }

    // Append to vertex data
    let offset = this.quadCount * 4 * this.VERTEX_SIZE;

    // Top-left
    this.vertexData[offset++] = x;
    this.vertexData[offset++] = y;
    this.vertexData[offset++] = u0;
    this.vertexData[offset++] = v0;
    this.vertexData[offset++] = r;
    this.vertexData[offset++] = g;
    this.vertexData[offset++] = b;
    this.vertexData[offset++] = a;

    // Top-right
    this.vertexData[offset++] = x + width;
    this.vertexData[offset++] = y;
    this.vertexData[offset++] = u1;
    this.vertexData[offset++] = v0;
    this.vertexData[offset++] = r;
    this.vertexData[offset++] = g;
    this.vertexData[offset++] = b;
    this.vertexData[offset++] = a;

    // Bottom-right
    this.vertexData[offset++] = x + width;
    this.vertexData[offset++] = y + height;
    this.vertexData[offset++] = u1;
    this.vertexData[offset++] = v1;
    this.vertexData[offset++] = r;
    this.vertexData[offset++] = g;
    this.vertexData[offset++] = b;
    this.vertexData[offset++] = a;

    // Bottom-left
    this.vertexData[offset++] = x;
    this.vertexData[offset++] = y + height;
    this.vertexData[offset++] = u0;
    this.vertexData[offset++] = v1;
    this.vertexData[offset++] = r;
    this.vertexData[offset++] = g;
    this.vertexData[offset++] = b;
    this.vertexData[offset++] = a;

    this.quadCount++;
}

  _isInstancingEnabled() {
    return !!(
      this.isWebGL2 &&
      this.instancing2D &&
      this.instancedProgram &&
      this.instancedVao &&
      this.instanceBuffer &&
      this.instanceData
    );
  }

  getStats() {
    return {
      drawCalls: this.lastFrameDrawCalls,
      spritesLastFrame: this.lastFrameSprites,
      instanced2DActive: this._isInstancingEnabled(),
      instancedUsedLastFrame: !!this.lastFrameUsedInstancing,
      instancedDrawCalls: this.lastFrameInstancedDrawCalls,
      legacyDrawCalls: this.lastFrameLegacyDrawCalls,
      quadsRendered: this.lastFrameSprites,
      maxQuads: this.MAX_QUADS,
      texturesCached: this.textureCache.size,
      textureCacheBytes: this._cacheBytes
    };
  }

  clearTextureCache() {
    // Delete all cached textures from GPU
    for (const entry of this.textureCache.values()) {
      if (entry?.texture) this.gl.deleteTexture(entry.texture);
    }
    this.textureCache.clear();
    this._cacheBytes = 0;
  }

  screenToWorld(screenX, screenY, camera) {
      if (!camera) return { x: 0, y: 0 };

      // Convert client (CSS pixel) coordinates into canvas-relative CSS pixels.
      // Input uses e.clientX/e.clientY (window coords), so we subtract canvas rect.
      const rect = this.canvas.getBoundingClientRect();
      const localCssX = screenX - rect.left;
      const localCssY = screenY - rect.top;

      // Convert CSS pixels to device pixels (matches this.viewport units).
      const cssToDeviceX = this.canvas.width / rect.width;
      const cssToDeviceY = this.canvas.height / rect.height;
      const localDeviceX = localCssX * cssToDeviceX;
      const localDeviceY = localCssY * cssToDeviceY;

      // Convert mouse position into WebGL device pixels (origin bottom-left)
      const webglDeviceX = localDeviceX;
      const webglDeviceY = this.canvas.height - localDeviceY;

      // Map WebGL device pixels inside the (letterboxed) viewport into normalized viewport UVs.
      // Note: this.viewport.{x,y,width,height} are in WebGL coordinates (bottom-left).
      const u = (webglDeviceX - this.viewport.x) / this.viewport.width;
      const v = (webglDeviceY - this.viewport.y) / this.viewport.height;

      const uClamped = Math.max(0, Math.min(1, u));
      const vClamped = Math.max(0, Math.min(1, v));

      // Convert to logical pixel coordinates where (0,0) is top-left.
      const screenPxX = uClamped * this.targetWidth;
      const screenPxY = (1 - vClamped) * this.targetHeight;

      // Invert the vertex shader math (pixel-space camera):
      // viewPos = (R * (world - cameraPos)) * zoom
      // => world = (R^-1 * (viewPos / zoom)) + cameraPos
      const viewX = screenPxX;
      const viewY = screenPxY;

      const unzoomX = viewX / camera.zoom;
      const unzoomY = viewY / camera.zoom;

      const cosR = Math.cos(camera.rotation);
      const sinR = Math.sin(camera.rotation);

      // Inverse rotation (transpose)
      const worldRelX = unzoomX * cosR + unzoomY * sinR;
      const worldRelY = -unzoomX * sinR + unzoomY * cosR;

      return { x: worldRelX + camera.x, y: worldRelY + camera.y };
  }

  // --- Material debug visualization (3D PBR) ---
  static MaterialDebugView = Object.freeze({
    Off: 0,
    BaseColor: 1,
    Metallic: 2,
    Roughness: 3,
    Normal: 4,
    AmbientOcclusion: 5,
  });

  /**
   * Set material debug visualization mode for the 3D PBR shader.
   * This mode bypasses all lighting and displays raw material values.
   *
   * @param {number|string} mode
   * - number: use Renderer.MaterialDebugView enum
   * - string: 'off'|'basecolor'|'metallic'|'roughness'|'normal'|'ao'|'ambientocclusion'
   */
  setMaterialDebugView(mode) {
    const m = Renderer.MaterialDebugView;
    let v = 0;
    if (typeof mode === 'number' && Number.isFinite(mode)) {
      v = mode | 0;
    } else {
      const s = String(mode || '').toLowerCase().replace(/[\s_-]/g, '');
      if (s === 'basecolor') v = m.BaseColor;
      else if (s === 'metallic') v = m.Metallic;
      else if (s === 'roughness') v = m.Roughness;
      else if (s === 'normal') v = m.Normal;
      else if (s === 'ao' || s === 'ambientocclusion') v = m.AmbientOcclusion;
      else v = m.Off;
    }

    this.materialDebugView = v;

    // If currently in a 3D pass, apply immediately.
    if (this._in3DPass && this.program3D && this._program3DUniforms?.materialDebugView) {
      this.gl.useProgram(this.program3D);
      this.gl.uniform1i(this._program3DUniforms.materialDebugView, v);
    }
  }

  /** @returns {number} */
  getMaterialDebugView() {
    return (this.materialDebugView | 0);
  }

}
