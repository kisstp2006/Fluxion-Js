#version 300 es
precision highp float;

in vec3 v_worldNormal;
out vec4 outColor;

void main() {
  vec3 n = normalize(v_worldNormal);
  outColor = vec4(n * 0.5 + 0.5, 1.0);
}


