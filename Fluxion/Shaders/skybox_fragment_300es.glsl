#version 300 es
precision mediump float;

in vec3 v_worldPos;

uniform samplerCube u_skybox;

out vec4 outColor;

void main() {
  // Sample cubemap using world position as direction
  outColor = texture(u_skybox, v_worldPos);
}

