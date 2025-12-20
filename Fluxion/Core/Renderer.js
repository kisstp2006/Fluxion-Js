import PostProcessing from './PostProcessing.js';

export default class Renderer {
  constructor(canvasId, targetWidth = 1920, targetHeight = 1080, maintainAspectRatio = true, enablePostProcessing = false) {
    this.canvas = document.getElementById(canvasId);
    this.gl = this.canvas.getContext("webgl");

    if (!this.gl) {
      alert("WebGL not supported!");
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

    this.sceneFramebuffer = null;
    this.sceneTexture = null;
    this.sceneWidth = 1;
    this.sceneHeight = 1;
    
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

        // Keep post-processing buffers in sync with the letterboxed viewport size
        if (this.enablePostProcessing) {
          this.ensureSceneTargets();
          if (this.postProcessing) {
            this.postProcessing.resize(this.sceneWidth, this.sceneHeight);
          }
        }
      });
    });

    this.canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    alert('WebGL context lost! Please wait...');
    });

  this.canvas.addEventListener('webglcontextrestored', () => {
    this.initGL();
    alert('WebGL context restored!');
  });

    // Initialize shaders asynchronously and store the promise
    this.readyPromise = this.initGL().then(() => {
      this.isReady = true;
    });
  } 

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
      this.viewport.y = Math.round(viewportY);
      this.viewport.width = Math.round(viewportWidth);
      this.viewport.height = Math.round(viewportHeight);
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
  }

  ensureSceneTargets() {
    if (!this.enablePostProcessing) return;

    const desiredWidth = Math.max(1, this.viewport.width | 0);
    const desiredHeight = Math.max(1, this.viewport.height | 0);

    if (!this.sceneFramebuffer) {
      this.sceneFramebuffer = this.gl.createFramebuffer();
    }
    if (!this.sceneTexture) {
      this.sceneTexture = this.gl.createTexture();
      this.gl.bindTexture(this.gl.TEXTURE_2D, this.sceneTexture);
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
    }

    if (desiredWidth !== this.sceneWidth || desiredHeight !== this.sceneHeight) {
      this.sceneWidth = desiredWidth;
      this.sceneHeight = desiredHeight;

      this.gl.bindTexture(this.gl.TEXTURE_2D, this.sceneTexture);
      this.gl.texImage2D(
        this.gl.TEXTURE_2D,
        0,
        this.gl.RGBA,
        this.sceneWidth,
        this.sceneHeight,
        0,
        this.gl.RGBA,
        this.gl.UNSIGNED_BYTE,
        null
      );

      this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.sceneFramebuffer);
      this.gl.framebufferTexture2D(
        this.gl.FRAMEBUFFER,
        this.gl.COLOR_ATTACHMENT0,
        this.gl.TEXTURE_2D,
        this.sceneTexture,
        0
      );
      this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
    }
  }

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
  

  async initGL() {
    this.gl.clearColor(0, 0, 0, 1);
    this.gl.enable(this.gl.BLEND);
    this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);

    // Load shaders from files - use absolute path from root
    const vertexShaderSource = await this.loadShaderFile('../../Fluxion/Shaders/vertex.glsl');
    const fragmentShaderSource = await this.loadShaderFile('../../Fluxion/Shaders/fragment.glsl');

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
    

    this.program = this.createProgram(this.vertexShader, this.fragmentShader);
    this.gl.useProgram(this.program);

    // Get attribute and uniform locations
    this.positionLocation = this.gl.getAttribLocation(this.program, "a_position");
    this.texcoordLocation = this.gl.getAttribLocation(this.program, "a_texcoord");
    this.textureLocation = this.gl.getUniformLocation(this.program, "u_texture");
    this.cameraPositionLocation = this.gl.getUniformLocation(this.program, "u_cameraPosition");
    this.cameraZoomLocation = this.gl.getUniformLocation(this.program, "u_cameraZoom");
    this.cameraRotationLocation = this.gl.getUniformLocation(this.program, "u_cameraRotation");
    this.aspectRatioLocation = this.gl.getUniformLocation(this.program, "u_aspectRatio");
    this.colorLocation = this.gl.getUniformLocation(this.program, "u_color");


    // Create and bind buffers
    this.buffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffer);

    // Enable attributes
    this.gl.enableVertexAttribArray(this.positionLocation);
    this.gl.vertexAttribPointer(this.positionLocation, 2, this.gl.FLOAT, false, 16, 0);
    this.gl.enableVertexAttribArray(this.texcoordLocation);
    this.gl.vertexAttribPointer(this.texcoordLocation, 2, this.gl.FLOAT, false, 16, 8);
    
    // Initialize post-processing if enabled
    if (this.enablePostProcessing) {
      this.postProcessing = new PostProcessing(this.gl);

      // Allocate scene targets to letterboxed viewport size, and init post-processing at that size
      this.ensureSceneTargets();
      await this.postProcessing.init(this.sceneWidth, this.sceneHeight);
      console.log('Post-processing initialized');
    }
  }

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

  createTexture(image) {
    const texture = this.gl.createTexture();
    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
    this.gl.pixelStorei(this.gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);

    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);

    this.gl.texImage2D(
      this.gl.TEXTURE_2D,
      0,
      this.gl.RGBA,
      this.gl.RGBA,
      this.gl.UNSIGNED_BYTE,
      image
    );

    this.gl.bindTexture(this.gl.TEXTURE_2D, null);
    return texture;
  }

  clear() {
    if (!this.isReady) return;
    
    // If post-processing is enabled, render to framebuffer
    if (this.enablePostProcessing && this.sceneFramebuffer) {
      this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.sceneFramebuffer);
      // Render scene into the offscreen texture at its native size
      this.gl.viewport(0, 0, this.sceneWidth, this.sceneHeight);
    } else {
      this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
      this.gl.viewport(this.viewport.x, this.viewport.y, this.viewport.width, this.viewport.height);
    }
    
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
  }
  
  finishFrame() {
    if (!this.isReady) return;
    
    // If post-processing is enabled, apply effects and render to screen
    if (this.enablePostProcessing && this.postProcessing && this.sceneTexture) {
      // Unbind framebuffer to render to screen
      this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
      
      // Clear full screen (keeps black bars clean)
      this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      this.gl.clear(this.gl.COLOR_BUFFER_BIT);

      // Draw post-processed scene into the letterboxed viewport
      this.gl.viewport(this.viewport.x, this.viewport.y, this.viewport.width, this.viewport.height);

      // Apply post-processing effects
      this.postProcessing.apply(this.sceneTexture);
    }
  }

  applyTransform(camera) {
    if (!this.isReady) return;
    this.gl.useProgram(this.program);

    // Set individual uniforms for position, zoom, and rotation
    this.gl.uniform2f(this.cameraPositionLocation, camera.x, camera.y);
    this.gl.uniform1f(this.cameraZoomLocation, camera.zoom);
    this.gl.uniform1f(this.cameraRotationLocation, camera.rotation);

    // Keep pixel aspect consistent: use the current viewport aspect ratio.
    this.gl.uniform1f(this.aspectRatioLocation, this.currentAspectRatio);
  }

drawQuad(texture, x, y, width, height, color = [255, 255, 255, 255]) {
    if (!this.isReady) return;
    if (!Array.isArray(color)) {
        color = [255, 255, 255, 255];
    }

    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);

    // Világkoordinátákban dolgozunk!
    const quad = new Float32Array([
        x, y, 0, 1, // Top-left
        x + width, y, 1, 1, // Top-right
        x, y + height, 0, 0, // Bottom-left
        x + width, y + height, 1, 0, // Bottom-right
    ]);

    this.gl.bufferData(this.gl.ARRAY_BUFFER, quad, this.gl.STATIC_DRAW);

    const normalizedColor = color.map(c => c / 255);
    this.gl.uniform4fv(this.colorLocation, normalizedColor);

    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
}

}
