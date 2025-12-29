#version 300 es
precision mediump float;

in vec2 v_texCoord;
uniform sampler2D u_image;

out vec4 outColor;

void main() {
  vec4 color = texture(u_image, v_texCoord);
  float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
  outColor = vec4(vec3(gray), color.a);
}
