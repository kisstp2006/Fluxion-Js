#version 300 es
precision highp float;

layout(location = 0) in vec3 a_position;
layout(location = 1) in vec3 a_normal;

uniform mat4 u_model;
uniform mat3 u_normalMatrix;
uniform mat4 u_viewProj;

out vec3 v_worldNormal;
out vec3 v_worldPos;

void main() {
  vec4 world = u_model * vec4(a_position, 1.0);
  v_worldNormal = normalize(u_normalMatrix * a_normal);
  v_worldPos = world.xyz;
  gl_Position = u_viewProj * world;
}


