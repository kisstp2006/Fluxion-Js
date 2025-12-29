#version 300 es
precision mediump float;

in vec2 v_texCoord;
uniform sampler2D u_image;
uniform float u_intensity;

out vec4 outColor;

void main() {
  vec4 color = texture(u_image, v_texCoord);
  color.rgb = ((color.rgb - 0.5) * max(u_intensity, 0.0)) + 0.5;
  outColor = color;
}
