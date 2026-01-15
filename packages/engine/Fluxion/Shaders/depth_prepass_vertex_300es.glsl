#version 300 es
precision highp float;

// Match Mesh.js interleaved layout (only position required).
layout(location = 0) in vec3 a_position;

uniform mat4 u_model;
uniform mat4 u_viewProj;

void main() {
  vec4 world = u_model * vec4(a_position, 1.0);
  gl_Position = u_viewProj * world;
}


