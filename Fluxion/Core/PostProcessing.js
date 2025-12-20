export default class PostProcessing {
  constructor(gl) {
    this.gl = gl;
    this.effects = new Map();
    this.activeEffects = [];
    this.framebuffers = [];
    this.textures = [];
    this.quadBuffer = null;
    this.isReady = false;
    
    this.initFramebuffers();
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

  async loadEffect(name, fragmentShaderPath, uniforms = {}) {
    try {
      const vertexSource = await this.loadShader('../../Fluxion/Shaders/PostProcessing/vertex.glsl');
      const fragmentSource = await this.loadShader(fragmentShaderPath);
      
      const program = this.createShaderProgram(vertexSource, fragmentSource);
      
      if (!program) {
        console.error(`Failed to create program for effect: ${name}`);
        return;
      }

      this.effects.set(name, {
        program: program,
        uniforms: uniforms,
        locations: {
          position: this.gl.getAttribLocation(program, 'a_position'),
          texCoord: this.gl.getAttribLocation(program, 'a_texCoord'),
          image: this.gl.getUniformLocation(program, 'u_image')
        }
      });
      
      console.log(`Loaded effect: ${name}`);
    } catch (error) {
      console.error(`Error loading effect ${name}:`, error);
    }
  }

  async init() {
    // Load all available effects
    await Promise.all([
      this.loadEffect('passthrough', '../../Fluxion/Shaders/PostProcessing/passthrough.glsl'),
      this.loadEffect('blur', '../../Fluxion/Shaders/PostProcessing/blur.glsl', {
        resolution: { type: '2f', value: [1920, 1080] }
      }),
      this.loadEffect('grayscale', '../../Fluxion/Shaders/PostProcessing/grayscale.glsl'),
      this.loadEffect('crt', '../../Fluxion/Shaders/PostProcessing/crt.glsl', {
        time: { type: '1f', value: 0 }
      }),
      this.loadEffect('contrast', '../../Fluxion/Shaders/PostProcessing/contrast.glsl', {
        intensity: { type: '1f', value: 1.5 }
      })
    ]);
    
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

  initFramebuffers() {
    // Create 2 framebuffers for ping-pong rendering
    for (let i = 0; i < 2; i++) {
      const framebuffer = this.gl.createFramebuffer();
      const texture = this.gl.createTexture();
      
      this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
      this.gl.texImage2D(
        this.gl.TEXTURE_2D, 0, this.gl.RGBA,
        this.gl.canvas.width, this.gl.canvas.height, 0,
        this.gl.RGBA, this.gl.UNSIGNED_BYTE, null
      );
      
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
      
      this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, framebuffer);
      this.gl.framebufferTexture2D(
        this.gl.FRAMEBUFFER, this.gl.COLOR_ATTACHMENT0,
        this.gl.TEXTURE_2D, texture, 0
      );
      
      this.framebuffers.push(framebuffer);
      this.textures.push(texture);
    }
    
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
  }

  initQuad() {
    this.quadBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.quadBuffer);
    
    const vertices = new Float32Array([
      -1, -1,  0, 0,
       1, -1,  1, 0,
      -1,  1,  0, 1,
       1,  1,  1, 1
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

  setUniform(effectName, uniformName, value) {
    const effect = this.effects.get(effectName);
    if (effect && effect.uniforms[uniformName]) {
      effect.uniforms[uniformName].value = value;
    }
  }

  apply(sourceTexture) {
    if (!this.isReady || this.activeEffects.length === 0) {
      return sourceTexture;
    }

    let inputTexture = sourceTexture;
    let outputIndex = 0;

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.quadBuffer);

    for (let i = 0; i < this.activeEffects.length; i++) {
      const effectName = this.activeEffects[i];
      const effect = this.effects.get(effectName);
      
      if (!effect) continue;

      const isLastEffect = (i === this.activeEffects.length - 1);
      
      // Render to framebuffer or screen
      if (isLastEffect) {
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
      } else {
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.framebuffers[outputIndex]);
      }

      this.gl.useProgram(effect.program);
      
      // Set up attributes
      this.gl.enableVertexAttribArray(effect.locations.position);
      this.gl.vertexAttribPointer(effect.locations.position, 2, this.gl.FLOAT, false, 16, 0);
      
      this.gl.enableVertexAttribArray(effect.locations.texCoord);
      this.gl.vertexAttribPointer(effect.locations.texCoord, 2, this.gl.FLOAT, false, 16, 8);
      
      // Bind input texture
      this.gl.activeTexture(this.gl.TEXTURE0);
      this.gl.bindTexture(this.gl.TEXTURE_2D, inputTexture);
      this.gl.uniform1i(effect.locations.image, 0);
      
      // Set custom uniforms
      for (const [name, uniform] of Object.entries(effect.uniforms)) {
        const location = this.gl.getUniformLocation(effect.program, `u_${name}`);
        if (location) {
          if (uniform.type === '1f') {
            this.gl.uniform1f(location, uniform.value);
          } else if (uniform.type === '2f') {
            this.gl.uniform2f(location, uniform.value[0], uniform.value[1]);
          }
        }
      }
      
      // Draw quad
      this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
      
      // Swap textures for next pass
      if (!isLastEffect) {
        inputTexture = this.textures[outputIndex];
        outputIndex = 1 - outputIndex;
      }
    }

    return null; // Effects have been applied to screen
  }

  resize(width, height) {
    // Resize framebuffer textures
    for (const texture of this.textures) {
      this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
      this.gl.texImage2D(
        this.gl.TEXTURE_2D, 0, this.gl.RGBA,
        width, height, 0,
        this.gl.RGBA, this.gl.UNSIGNED_BYTE, null
      );
    }
    
    // Update resolution uniforms for effects that need it
    for (const effect of this.effects.values()) {
      if (effect.uniforms.resolution) {
        effect.uniforms.resolution.value = [width, height];
      }
    }
  }
}
