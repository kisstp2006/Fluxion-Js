// postProcessing.js
class BlurEffect {
  constructor(gl) {
      this.gl = gl;
      this.shader = this.createShader();
  }

  createShader() {
      const fragmentShaderSource = `
          precision mediump float;
          varying vec2 v_texcoord;
          uniform sampler2D u_texture;

          void main() {
              vec2 offset = vec2(1.0 / 300.0, 1.0 / 300.0); // Adjust for blur
              vec4 color = texture2D(u_texture, v_texcoord);
              vec4 colorLeft = texture2D(u_texture, v_texcoord - offset);
              vec4 colorRight = texture2D(u_texture, v_texcoord + offset);
              gl_FragColor = (color + colorLeft + colorRight) / 3.0;
          }
      `;
      return this.createShaderProgram(fragmentShaderSource);
  }

  createShaderProgram(fragmentShaderSource) {
      const vertexShaderSource = `
          attribute vec2 a_position;
          varying vec2 v_texcoord;
          void main() {
              gl_Position = vec4(a_position, 0.0, 1.0);
              v_texcoord = a_position * 0.5 + 0.5;  // Convert to texture coordinates
          }
      `;
      
      const vertexShader = this.gl.createShader(this.gl.VERTEX_SHADER);
      this.gl.shaderSource(vertexShader, vertexShaderSource);
      this.gl.compileShader(vertexShader);
      
      const fragmentShader = this.gl.createShader(this.gl.FRAGMENT_SHADER);
      this.gl.shaderSource(fragmentShader, fragmentShaderSource);
      this.gl.compileShader(fragmentShader);
      
      const program = this.gl.createProgram();
      this.gl.attachShader(program, vertexShader);
      this.gl.attachShader(program, fragmentShader);
      this.gl.linkProgram(program);
      
      return program;
  }

  apply(framebuffer, texture) {
      this.gl.useProgram(this.shader);
      this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, framebuffer);
      this.gl.clear(this.gl.COLOR_BUFFER_BIT);
      this.gl.bindTexture(this.gl.TEXTURE_2D, texture);

      this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
  }
}
