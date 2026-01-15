#version 300 es
precision highp float;

in vec3 a_position;

uniform mat4 u_viewProj;

out vec3 v_worldPos;

void main() {
  v_worldPos = a_position;
  // Remove translation from view matrix for skybox (always centered at origin)
  vec4 pos = u_viewProj * vec4(a_position, 1.0);
  gl_Position = pos.xyww; // Set z to w so depth is always 1.0 (furthest)
}

