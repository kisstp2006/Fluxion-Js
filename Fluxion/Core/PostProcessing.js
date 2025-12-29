export default class PostProcessing {
  constructor(gl) {
    this.gl = gl;
    this.isWebGL2 = (typeof WebGL2RenderingContext !== 'undefined') && (gl instanceof WebGL2RenderingContext);
    this.effects = new Map();
    this.activeEffects = [];
    this.framebuffers = [];
    this.textures = [];
    this.quadBuffer = null;
    this.isReady = false;
    this.width = 1;
    this.height = 1;

    // Global post-processing context (auto uniforms)
    this._frame = 0;
    this._lastTimeSec = 0;
    
    this.initQuad();
  }

  async loadShader(url) {
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

  async loadEffect(name, fragmentShaderPath, uniforms = {}, options = {}) {
    try {
      const vertexPath = this.isWebGL2
        ? '../../Fluxion/Shaders/PostProcessing/vertex_300es.glsl'
        : '../../Fluxion/Shaders/PostProcessing/vertex.glsl';
      const vertexSource = await this.loadShader(vertexPath);
      const fragmentSource = await this.loadShader(fragmentShaderPath);
      
      const program = this.createShaderProgram(vertexSource, fragmentSource);
      
      if (!program) {
        console.error(`Failed to create program for effect: ${name}`);
        return;
      }

      const uniformLocations = {};
      for (const uniformName of Object.keys(uniforms)) {
        uniformLocations[uniformName] = this.gl.getUniformLocation(program, `u_${uniformName}`);
      }

      // Common auto-injected uniforms (optional in shader)
      const contextLocations = {
        time: this.gl.getUniformLocation(program, 'u_time'),
        delta: this.gl.getUniformLocation(program, 'u_delta'),
        resolution: this.gl.getUniformLocation(program, 'u_resolution'),
        aspect: this.gl.getUniformLocation(program, 'u_aspect'),
        frame: this.gl.getUniformLocation(program, 'u_frame'),
        intensity: this.gl.getUniformLocation(program, 'u_intensity'),
      };

      const priority = Number.isFinite(options?.priority) ? options.priority : 0;

      this.effects.set(name, {
        program: program,
        uniforms: uniforms,
        priority,
        locations: {
          position: this.gl.getAttribLocation(program, 'a_position'),
          texCoord: this.gl.getAttribLocation(program, 'a_texCoord'),
          image: this.gl.getUniformLocation(program, 'u_image'),
        },
        uniformLocations,
        contextLocations,
      });
      
      console.log(`Loaded effect: ${name}`);
    } catch (error) {
      console.error(`Error loading effect ${name}:`, error);
    }
  }

  async init(width = 1, height = 1) {
    // Load all available effects
    const effect = (name) => this.isWebGL2
      ? `../../Fluxion/Shaders/PostProcessing/${name}_300es.glsl`
      : `../../Fluxion/Shaders/PostProcessing/${name}.glsl`;

    await Promise.all([
      this.loadEffect('passthrough', effect('passthrough'), {}, { priority: 0 }),
      this.loadEffect('blur', effect('blur'), {
        resolution: { type: '2f', value: [width, height] }
      }, { priority: 10 }),
      this.loadEffect('grayscale', effect('grayscale'), {}, { priority: 20 }),
      this.loadEffect('crt', effect('crt'), {
        time: { type: '1f', value: 0 }
      }, { priority: 90 }),
      this.loadEffect('contrast', effect('contrast'), {
        intensity: { type: '1f', value: 1.5 }
      }, { priority: 100 })
    ]);

    this.resize(width, height);
    this.isReady = true;
  }

  createShaderProgram(vertexSource, fragmentSource) {
    const vertexShader = this.gl.createShader(this.gl.VERTEX_SHADER);
    this.gl.shaderSource(vertexShader, vertexSource);
    this.gl.compileShader(vertexShader);
    
    if (!this.gl.getShaderParameter(vertexShader, this.gl.COMPILE_STATUS)) {
      console.error('Vertex shader compilation error:', this.gl.getShaderInfoLog(vertexShader));
      return null;
    }

    const fragmentShader = this.gl.createShader(this.gl.FRAGMENT_SHADER);
    this.gl.shaderSource(fragmentShader, fragmentSource);
    this.gl.compileShader(fragmentShader);
    
    if (!this.gl.getShaderParameter(fragmentShader, this.gl.COMPILE_STATUS)) {
      console.error('Fragment shader compilation error:', this.gl.getShaderInfoLog(fragmentShader));
      return null;
    }

    const program = this.gl.createProgram();
    this.gl.attachShader(program, vertexShader);
    this.gl.attachShader(program, fragmentShader);
    this.gl.linkProgram(program);

    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      console.error('Program linking error:', this.gl.getProgramInfoLog(program));
      return null;
    }

    return program;
  }

  initFramebuffers(width, height) {
    // Create 2 framebuffers for ping-pong rendering
    this.width = Math.max(1, width | 0);
    this.height = Math.max(1, height | 0);

    // Dispose existing
    for (const fb of this.framebuffers) this.gl.deleteFramebuffer(fb);
    for (const tex of this.textures) this.gl.deleteTexture(tex);
    this.framebuffers = [];
    this.textures = [];

    for (let i = 0; i < 2; i++) {
      const framebuffer = this.gl.createFramebuffer();
      const texture = this.gl.createTexture();

      this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
      this.gl.texImage2D(
        this.gl.TEXTURE_2D,
        0,
        this.gl.RGBA,
        this.width,
        this.height,
        0,
        this.gl.RGBA,
        this.gl.UNSIGNED_BYTE,
        null
      );

      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);

      this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, framebuffer);
      this.gl.framebufferTexture2D(
        this.gl.FRAMEBUFFER,
        this.gl.COLOR_ATTACHMENT0,
        this.gl.TEXTURE_2D,
        texture,
        0
      );

      this.framebuffers.push(framebuffer);
      this.textures.push(texture);
    }

    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
    this.gl.bindTexture(this.gl.TEXTURE_2D, null);
  }

  initQuad() {
    this.quadBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.quadBuffer);
    
    // Full-screen quad with flipped V coordinate to counteract the vertex shader's flip
    // The vertex shader (Fluxion/Shaders/PostProcessing/vertex.glsl) does: v_texCoord = vec2(a_texCoord.x, 1.0 - a_texCoord.y);
    // So we pass inverted Y here to get correct orientation.
    const vertices = new Float32Array([
      // Pos(x,y)   Tex(u,v)
      -1, -1,       0, 1,  // Bottom-left
       1, -1,       1, 1,  // Bottom-right
      -1,  1,       0, 0,  // Top-left
       1,  1,       1, 0   // Top-right
    ]);
    
    this.gl.bufferData(this.gl.ARRAY_BUFFER, vertices, this.gl.STATIC_DRAW);
  }

  enableEffect(effectName) {
    if (this.effects.has(effectName) && !this.activeEffects.includes(effectName)) {
      this.activeEffects.push(effectName);
    }
  }

  disableEffect(effectName) {
    const index = this.activeEffects.indexOf(effectName);
    if (index > -1) {
      this.activeEffects.splice(index, 1);
    }
  }

  clearEffects() {
    this.activeEffects = [];
  }

  setEffectPriority(effectName, priority) {
    const effect = this.effects.get(effectName);
    if (!effect) return;
    effect.priority = Number.isFinite(priority) ? priority : effect.priority;
  }

  getContext() {
    const nowSec = performance.now() / 1000;
    const delta = this._lastTimeSec > 0 ? (nowSec - this._lastTimeSec) : 0;
    return {
      time: nowSec,
      delta,
      resolution: [this.width, this.height],
      aspect: this.width / this.height,
      frame: this._frame,
    };
  }

  setUniform(effectName, uniformName, value) {
    const effect = this.effects.get(effectName);
    if (effect && effect.uniforms[uniformName]) {
      effect.uniforms[uniformName].value = value;
    }
  }

  render(inputTexture, outputFramebuffer) {
    if (!this.isReady) {
      return;
    }

    // Disable blending/depth/scissor for post-processing
    const wasBlendEnabled = this.gl.isEnabled(this.gl.BLEND);
    const wasDepthTestEnabled = this.gl.isEnabled(this.gl.DEPTH_TEST);
    const wasScissorEnabled = this.gl.isEnabled(this.gl.SCISSOR_TEST);
    if (wasBlendEnabled) this.gl.disable(this.gl.BLEND);
    if (wasDepthTestEnabled) this.gl.disable(this.gl.DEPTH_TEST);
    if (wasScissorEnabled) this.gl.disable(this.gl.SCISSOR_TEST);

    // Always use full canvas viewport for post-processing
    this.gl.viewport(0, 0, this.width, this.height);

    // Update context
    const nowSec = performance.now() / 1000;
    const deltaSec = this._lastTimeSec > 0 ? (nowSec - this._lastTimeSec) : 0;
    this._lastTimeSec = nowSec;
    this._frame += 1;

    // Filter and sort active effects
    const orderedEffectNames = this.activeEffects
      .filter((name) => this.effects.has(name))
      .slice()
      .sort((a, b) => {
        const ea = this.effects.get(a);
        const eb = this.effects.get(b);
        return (ea?.priority ?? 0) - (eb?.priority ?? 0);
      });

    let currentInput = inputTexture;
    let pingPongIndex = 0;

    // If no effects, just blit input to output
    if (orderedEffectNames.length === 0) {
        this.applyEffect(this.effects.get('passthrough'), currentInput, outputFramebuffer);
    } else {
        for (let i = 0; i < orderedEffectNames.length; i++) {
            const effectName = orderedEffectNames[i];
            const effect = this.effects.get(effectName);
            const isLast = i === orderedEffectNames.length - 1;
            
            const targetFramebuffer = isLast ? outputFramebuffer : this.framebuffers[pingPongIndex];
            
            this.applyEffect(effect, currentInput, targetFramebuffer);
            
            if (!isLast) {
                currentInput = this.textures[pingPongIndex];
                pingPongIndex = 1 - pingPongIndex;
            }
        }
    }

    // Restore state
    if (wasBlendEnabled) this.gl.enable(this.gl.BLEND);
    if (wasDepthTestEnabled) this.gl.enable(this.gl.DEPTH_TEST);
    if (wasScissorEnabled) this.gl.enable(this.gl.SCISSOR_TEST);
  }

  applyEffect(effect, inputTexture, outputFramebuffer) {
      if (!effect) return;

      this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, outputFramebuffer);
      this.gl.useProgram(effect.program);

      // Bind Quad Buffer
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.quadBuffer);
      
      // Attributes
      this.gl.enableVertexAttribArray(effect.locations.position);
      this.gl.vertexAttribPointer(effect.locations.position, 2, this.gl.FLOAT, false, 16, 0);
      
      this.gl.enableVertexAttribArray(effect.locations.texCoord);
      this.gl.vertexAttribPointer(effect.locations.texCoord, 2, this.gl.FLOAT, false, 16, 8);

      // Uniforms
      this.gl.activeTexture(this.gl.TEXTURE0);
      this.gl.bindTexture(this.gl.TEXTURE_2D, inputTexture);
      this.gl.uniform1i(effect.locations.image, 0);

      // Context Uniforms
      const ctxLoc = effect.contextLocations;
      if (ctxLoc) {
        if (ctxLoc.time) this.gl.uniform1f(ctxLoc.time, this._lastTimeSec);
        if (ctxLoc.delta) this.gl.uniform1f(ctxLoc.delta, 0); // Delta is tricky if we don't track it well, but we do
        if (ctxLoc.resolution) this.gl.uniform2f(ctxLoc.resolution, this.width, this.height);
        if (ctxLoc.aspect) this.gl.uniform1f(ctxLoc.aspect, this.width / this.height);
        if (ctxLoc.frame) this.gl.uniform1f(ctxLoc.frame, this._frame);
        if (ctxLoc.intensity) this.gl.uniform1f(ctxLoc.intensity, 1.0); // Default intensity
      }

      // Custom Uniforms
      for (const [name, uniform] of Object.entries(effect.uniforms)) {
        const location = effect.uniformLocations?.[name];
        if (location) {
          if (uniform.type === '1f') {
            this.gl.uniform1f(location, uniform.value);
          } else if (uniform.type === '2f') {
            this.gl.uniform2f(location, uniform.value[0], uniform.value[1]);
          }
        }
      }

      this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
  }

  resize(width, height) {
    const newWidth = Math.max(1, width | 0);
    const newHeight = Math.max(1, height | 0);

    this.width = newWidth;
    this.height = newHeight;

    this.initFramebuffers(newWidth, newHeight);
    
    // Update resolution uniforms for effects that need it
    for (const effect of this.effects.values()) {
      if (effect.uniforms.resolution) {
        effect.uniforms.resolution.value = [newWidth, newHeight];
      }
    }
  }
}
