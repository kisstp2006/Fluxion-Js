import PostProcessing from './PostProcessing.js';

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
    this._frameId = 0;
    this._cacheLimits = {
      maxTextures: Infinity,
      maxBytes: Infinity,
    };
    this._cacheBytes = 0;
    this.drawCallCount = 0; // Track draw calls for profiling
    this.lastFrameDrawCalls = 0;

    // Asset tracking (textures/audio/etc). Used for splash screens / loading flows.
    this._pendingAssets = new Set();
    
    this.isReady = false; // Track initialization state
    this.readyPromise = null; // Store the initialization promise
    this.resizeCanvas();
    
    // Debounce resize events for better performance
    this.resizeTimeout = null;
    window.addEventListener("resize", () => {
      if (this.resizeTimeout) {
        cancelAnimationFrame(this.resizeTimeout);
      }
      this.resizeTimeout = requestAnimationFrame(() => {
        this.resizeCanvas();

        // Keep post-processing buffers in sync with the canvas size
        if (this.enablePostProcessing && this.postProcessing) {
            this.postProcessing.resize(this.canvas.width, this.canvas.height);
        }
      });
    });

    this.canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      alert('WebGL context lost! Please wait...');
    });

    this.canvas.addEventListener('webglcontextrestored', () => {
      // Some browsers restore the same context object. Re-acquire defensively.
      if (!this.gl) {
        const restored = this._createGLContext(this.requestedWebGLVersion, this.allowWebGLFallback, this.contextAttributes);
        this.gl = restored.gl;
        this.isWebGL2 = restored.isWebGL2;
        this.webglContextName = restored.contextName;
      }
      this.initGL();
      alert('WebGL context restored!');
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

    const sizeChanged =
      !this.mainScreenTexture ||
      (this.mainScreenTexture.width !== desiredWidth || this.mainScreenTexture.height !== desiredHeight);

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
    // We can store the current size on the texture object or in the class
    if (this.mainScreenTexture.width !== desiredWidth || this.mainScreenTexture.height !== desiredHeight) {
      this.mainScreenTexture.width = desiredWidth;
      this.mainScreenTexture.height = desiredHeight;

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
    const w = this.mainScreenTexture.width | 0;
    const h = this.mainScreenTexture.height | 0;
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
    texture.width = image.width;
    texture.height = image.height;

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
      const bytes = this._estimateTextureBytes(texture.width, texture.height);
      this._setCacheEntry(cacheKey, texture, bytes);
      this._evictIfNeeded();
    }
    
    return texture;
  }

  beginFrame() {
    if (!this.isReady) return;

    this._frameId++;

    // Reset batch state
    this.quadCount = 0;
    this.currentTexture = null;
    this.lastFrameDrawCalls = this.drawCallCount;
    this.drawCallCount = 0;

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

    if (this.enablePostProcessing && this.postProcessing && this.mainScreenTexture) {
      // Resolve MSAA render target (if enabled) into the main screen texture before post-processing.
      this.resolveMainScreenTargetIfNeeded();

      // Pass the main screen texture to the post-processing system
      // The output goes to the default framebuffer (null)
      this.postProcessing.render(this.mainScreenTexture, null);
    }
  }

  flush() {
    if (this.quadCount === 0) return;

    if (this._isInstancingEnabled()) {
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
      this.quadCount = 0;
      return;
    }

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
      
      // Ensure texture unit 0 is used
      this.gl.uniform1i(this.textureLocation, 0);
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
      const quad = new Float32Array([
        0, 0, 0, 1, 1, 1, 1, 1,      // Top-left
        w, 0, 1, 1, 1, 1, 1, 1,      // Top-right
        0, h, 0, 0, 1, 1, 1, 1,      // Bottom-left
        w, h, 1, 0, 1, 1, 1, 1,      // Bottom-right
      ]);

      this.gl.bufferData(this.gl.ARRAY_BUFFER, this.vertexData.byteLength, this.gl.DYNAMIC_DRAW); // Reallocate to be safe
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

      // Ensure sampler uses texture unit 0 for this program as well.
      if (this._instancedUniforms?.texture) {
        this.gl.uniform1i(this._instancedUniforms.texture, 0);
      }

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
        const texW = texture.width || 1;
        const texH = texture.height || 1;
        
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

    const r = finalColor[0] / 255;
    const g = finalColor[1] / 255;
    const b = finalColor[2] / 255;
    const a = finalColor[3] / 255;

    // WebGL2 instanced path: one instance per sprite (no per-vertex expansion)
    if (this._isInstancingEnabled()) {
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
      quadsRendered: this.MAX_QUADS,
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

}
