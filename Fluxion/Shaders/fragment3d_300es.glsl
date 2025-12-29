#version 300 es
precision mediump float;

in vec4 v_color;

uniform vec4 u_albedoColor;
uniform sampler2D u_albedoTexture;
uniform int u_useAlbedoTexture;

out vec4 outColor;

void main() {
  vec4 base = v_color * (u_albedoColor);
  if (u_useAlbedoTexture == 1) {
    // Meshes may not provide UVs yet; sampling (0,0) is a safe fallback.
    vec2 uv = vec2(0.0, 0.0);
    vec4 t = texture(u_albedoTexture, uv);
    base *= t;
  }
  outColor = base;
}
