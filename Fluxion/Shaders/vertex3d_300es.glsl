#version 300 es
precision highp float;

in vec3 a_position;
in vec4 a_color;

uniform mat4 u_viewProj;
uniform mat4 u_model;

out vec4 v_color;

void main() {
  v_color = a_color;
  gl_Position = u_viewProj * u_model * vec4(a_position, 1.0);
}
