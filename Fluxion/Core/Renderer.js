export default class Renderer {
  constructor(canvasId, stretchImage = true) {
    this.canvas = document.getElementById(canvasId);
    this.gl = this.canvas.getContext("webgl");

    if (!this.gl) {
      alert("WebGL not supported!");
      return;
    }

    this.stretchImage = stretchImage; // Store the stretchImage flag
    this.resizeCanvas();
    window.addEventListener("resize", () => this.resizeCanvas());

    this.initGL();
  } 

  resizeCanvas() {
    const dpi = window.devicePixelRatio || 1;
  
    this.canvas.width = window.innerWidth * dpi;
    this.canvas.height = window.innerHeight * dpi;
  
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }
  

  initGL() {
    this.gl.clearColor(0, 0, 0, 1);
    this.gl.enable(this.gl.BLEND);
    this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);

    // Create shaders
    this.vertexShader = this.createShader(this.gl.VERTEX_SHADER, `
      attribute vec2 a_position;
      attribute vec2 a_texcoord;
      uniform vec2 u_cameraPosition;
      uniform float u_cameraZoom;
      uniform float u_cameraRotation;
      varying vec2 v_texcoord;

      void main() {
        float cosR = cos(u_cameraRotation);
        float sinR = sin(u_cameraRotation);

        // Rotation matrix
        mat2 rotationMatrix = mat2(
          cosR, -sinR,
          sinR, cosR
        );

        // Apply transformations: translate -> rotate -> scale
        vec2 transformedPosition = (rotationMatrix * (a_position - u_cameraPosition)) * u_cameraZoom;

        gl_Position = vec4(transformedPosition, 0, 1);
        v_texcoord = a_texcoord;
      }
    `);

    this.fragmentShader = this.createShader(this.gl.FRAGMENT_SHADER, `
      precision mediump float;
      varying vec2 v_texcoord;
      uniform sampler2D u_texture;
      uniform vec4 u_color;
  
      void main() {
          vec4 texColor = texture2D(u_texture, v_texcoord);
          if (texColor.a < 0.01) discard;
  
          // Apply sprite color and transparency
          texColor.rgb *= u_color.rgb;
          texColor.a *= u_color.a;
  
          gl_FragColor = texColor;
      }
  `);
  
    

    this.program = this.createProgram(this.vertexShader, this.fragmentShader);
    this.gl.useProgram(this.program);

    // Get attribute and uniform locations
    this.positionLocation = this.gl.getAttribLocation(this.program, "a_position");
    this.texcoordLocation = this.gl.getAttribLocation(this.program, "a_texcoord");
    this.textureLocation = this.gl.getUniformLocation(this.program, "u_texture");
    this.cameraPositionLocation = this.gl.getUniformLocation(this.program, "u_cameraPosition");
    this.cameraZoomLocation = this.gl.getUniformLocation(this.program, "u_cameraZoom");
    this.cameraRotationLocation = this.gl.getUniformLocation(this.program, "u_cameraRotation");
    this.colorLocation = this.gl.getUniformLocation(this.program, "u_color");


    // Create and bind buffers
    this.buffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffer);

    // Enable attributes
    this.gl.enableVertexAttribArray(this.positionLocation);
    this.gl.vertexAttribPointer(this.positionLocation, 2, this.gl.FLOAT, false, 16, 0);
    this.gl.enableVertexAttribArray(this.texcoordLocation);
    this.gl.vertexAttribPointer(this.texcoordLocation, 2, this.gl.FLOAT, false, 16, 8);
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
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
  }

  applyTransform(camera) {
    this.gl.useProgram(this.program);

    // Set individual uniforms for position, zoom, and rotation
    this.gl.uniform2f(this.cameraPositionLocation, camera.x, camera.y);
    this.gl.uniform1f(this.cameraZoomLocation, camera.zoom);
    this.gl.uniform1f(this.cameraRotationLocation, camera.rotation);
  }

  drawQuad(texture, x, y, width, height, color = [255, 255, 255, 255]) {
    //console.log("drawQuad received color:", color);

    // Ensure color is an array before calling .map()
    if (!Array.isArray(color)) {
        //console.warn("drawQuad received invalid color:", color, "Defaulting to white.");
        color = [255, 255, 255, 255];
    }

    const imageAspect = width / height;
    const canvasAspect = this.canvas.width / this.canvas.height;

    // If stretching is disabled, adjust the quad dimensions to preserve the aspect ratio
    if (!this.stretchImage) {
        if (canvasAspect > imageAspect) {
            height = width / imageAspect;
        } else {
            width = height * imageAspect;
        }
    }

    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);

    // Define the quad vertices (position + texture coordinates)
    const quad = new Float32Array([
        x, y, 0, 1, // Top-left
        x + width, y, 1, 1, // Top-right
        x, y + height, 0, 0, // Bottom-left
        x + width, y + height, 1, 0, // Bottom-right
    ]);

    this.gl.bufferData(this.gl.ARRAY_BUFFER, quad, this.gl.STATIC_DRAW);

    // Normalize color values (255 -> 1)
    const normalizedColor = color.map(c => c / 255);
    this.gl.uniform4fv(this.colorLocation, normalizedColor);

    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
}


}
