#version 300 es
precision highp float;

// Use the Mesh position layout (pos is first in interleaved buffer)
layout(location = 0) in vec3 a_position;

uniform mat4 u_view;
uniform mat4 u_proj;

out vec3 v_dir;

void main() {
  v_dir = a_position;
  gl_Position = u_proj * u_view * vec4(a_position, 1.0);
}


