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

    this.mainScreenFramebuffer = null;
    this.mainScreenTexture = null;
    
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
    
    this.ensureMainScreenTargets();
  }

  ensureMainScreenTargets() {
    const desiredWidth = this.canvas.width;
    const desiredHeight = this.canvas.height;

    if (!this.mainScreenFramebuffer) {
      this.mainScreenFramebuffer = this.gl.createFramebuffer();
    }
    if (!this.mainScreenTexture) {
      this.mainScreenTexture = this.gl.createTexture();
      this.gl.bindTexture(this.gl.TEXTURE_2D, this.mainScreenTexture);
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
    }

    // Check if we need to resize the texture
    // We can store the current size on the texture object or in the class
    if (this.mainScreenTexture.width !== desiredWidth || this.mainScreenTexture.height !== desiredHeight) {
      this.mainScreenTexture.width = desiredWidth;
      this.mainScreenTexture.height = desiredHeight;

      this.gl.bindTexture(this.gl.TEXTURE_2D, this.mainScreenTexture);
      this.gl.texImage2D(
        this.gl.TEXTURE_2D,
        0,
        this.gl.RGBA,
        desiredWidth,
        desiredHeight,
        0,
        this.gl.RGBA,
        this.gl.UNSIGNED_BYTE,
        null
      );

      this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.mainScreenFramebuffer);
      this.gl.framebufferTexture2D(
        this.gl.FRAMEBUFFER,
        this.gl.COLOR_ATTACHMENT0,
        this.gl.TEXTURE_2D,
        this.mainScreenTexture,
        0
      );
      
      // Check framebuffer status
      const status = this.gl.checkFramebufferStatus(this.gl.FRAMEBUFFER);
      if (status !== this.gl.FRAMEBUFFER_COMPLETE) {
          console.error('Framebuffer is not complete: ' + status);
      }

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

      // Allocate scene targets to full canvas size, and init post-processing at that size
      this.ensureMainScreenTargets();
      await this.postProcessing.init(this.canvas.width, this.canvas.height);
      console.log('Post-processing initialized');
    } else {
        // Even if PP is disabled, we need the main screen targets
        this.ensureMainScreenTargets();
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
    texture.width = image.width;
    texture.height = image.height;

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

  beginFrame() {
    if (!this.isReady) return;
    
    // Always render to the main screen framebuffer first
    if (this.mainScreenFramebuffer) {
      this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.mainScreenFramebuffer);
      
      // Clear the entire framebuffer (including black bars area)
      this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      this.gl.clear(this.gl.COLOR_BUFFER_BIT);
      
      // Set viewport to the letterboxed area for the game to draw into
      this.gl.viewport(this.viewport.x, this.viewport.y, this.viewport.width, this.viewport.height);
    }
  }
  
  endFrame() {
    if (!this.isReady) return;
    
    if (this.enablePostProcessing && this.postProcessing && this.mainScreenTexture) {
      // Pass the main screen texture to the post-processing system
      // The output goes to the default framebuffer (null)
      this.postProcessing.render(this.mainScreenTexture, null);
    } else if (this.mainScreenTexture) {
      // If post-processing is disabled, just draw the main screen texture to the canvas
      this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
      this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      this.gl.clear(this.gl.COLOR_BUFFER_BIT);
      
      // Use a simple pass-through draw
      // We can use the post-processing system's quad or a simple internal draw
      // Since we might not have PostProcessing initialized, we should have a fallback or use a simple shader
      // But wait, if enablePostProcessing is false, this.postProcessing is null.
      // We need a way to draw a full screen quad here.
      
      // We can reuse drawQuad but we need to set up the shader for it.
      // drawQuad uses the default shader which expects a camera transform.
      // We need a simple screen-space draw.
      
      // Let's use a simple blit method.
      this.blitTexture(this.mainScreenTexture);
    }
  }

  blitTexture(texture) {
      // Simple full-screen quad draw using the current program (which is likely the sprite shader)
      // We need to reset uniforms to identity/screen space
      this.gl.useProgram(this.program);
      
      // Reset camera uniforms to identity
      this.gl.uniform2f(this.cameraPositionLocation, 0, 0);
      this.gl.uniform1f(this.cameraZoomLocation, 1.0);
      this.gl.uniform1f(this.cameraRotationLocation, 0.0);
      this.gl.uniform1f(this.aspectRatioLocation, 1.0); // 1.0 because we are drawing in NDC -1 to 1
      
      // Draw a quad from -1 to 1
      // But wait, drawQuad takes x, y, width, height.
      // If we pass x=-1, y=-1, width=2, height=2, it should work if the vertex shader handles it.
      // Let's check the vertex shader.
      
      // Actually, let's just implement a simple blit here using the existing buffers
      // The existing buffer is for sprites.
      
      // Let's assume drawQuad works in world coordinates.
      // If we want to draw to screen space, we need to bypass the camera transform or set it to identity.
      // I set it to identity above.
      
      // Ensure texture unit 0 is used
      this.gl.uniform1i(this.textureLocation, 0);
      this.gl.activeTexture(this.gl.TEXTURE0);

      // We need to flip Y because drawQuad assumes a coordinate system where Y is down (for sprites),
      // but in NDC Y is up.
      // Also drawQuad maps the first pair of vertices to Tex(0,1) which is Top-Left in UV space (if 0,0 is BL).
      // By passing y=1 and height=-2:
      // TL becomes (-1, 1) -> Top-Left on screen.
      // BL becomes (-1, -1) -> Bottom-Left on screen.
      this.drawQuad(texture, -1, 1, 2, -2);
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

  drawQuad(texture, x, y, width, height, srcX, srcY, srcWidth, srcHeight) {
    if (!this.isReady) return;
    
    let color = [255, 255, 255, 255];
    let u0 = 0, v0 = 0, u1 = 1, v1 = 1;

    // Handle overloaded arguments
    // Case 1: drawQuad(tex, x, y, w, h, colorArray)
    if (Array.isArray(srcX)) {
        color = srcX;
    } 
    // Case 2: drawQuad(tex, x, y, w, h, srcX, srcY, srcW, srcH)
    else if (typeof srcX === 'number') {
        const texW = texture.width || 1;
        const texH = texture.height || 1;
        
        // If srcWidth/Height are 0 (or missing), use full texture dimensions
        const sX = srcX || 0;
        const sY = srcY || 0;
        const sW = srcWidth || texW;
        const sH = srcHeight || texH;

        // Calculate UVs (assuming standard top-left origin for image data)
        // WebGL texture coordinates: (0,0) is bottom-left
        u0 = sX / texW;
        u1 = (sX + sW) / texW;
        
        // Flip Y for UVs because image data is top-down but texture space is bottom-up
        v1 = 1.0 - (sY / texH);          // Top
        v0 = 1.0 - ((sY + sH) / texH);   // Bottom
    }

    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);

    // Ensure vertex attributes are pointing to the correct buffer
    // This is necessary because PostProcessing might have changed the bindings
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffer);
    this.gl.enableVertexAttribArray(this.positionLocation);
    this.gl.vertexAttribPointer(this.positionLocation, 2, this.gl.FLOAT, false, 16, 0);
    this.gl.enableVertexAttribArray(this.texcoordLocation);
    this.gl.vertexAttribPointer(this.texcoordLocation, 2, this.gl.FLOAT, false, 16, 8);

    // Világkoordinátákban dolgozunk!
    // Vertex structure: x, y, u, v
    const quad = new Float32Array([
        x, y, u0, v1,           // Top-left
        x + width, y, u1, v1,   // Top-right
        x, y + height, u0, v0,  // Bottom-left
        x + width, y + height, u1, v0, // Bottom-right
    ]);

    this.gl.bufferData(this.gl.ARRAY_BUFFER, quad, this.gl.STATIC_DRAW);

    const normalizedColor = color.map(c => c / 255);
    this.gl.uniform4fv(this.colorLocation, normalizedColor);

    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
}

}
