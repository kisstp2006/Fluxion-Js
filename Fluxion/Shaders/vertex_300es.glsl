#version 300 es
precision highp float;

in vec2 a_position;
in vec2 a_texcoord;
in vec4 a_color;

uniform vec2 u_cameraPosition;
uniform float u_cameraZoom;
uniform float u_cameraRotation;
uniform vec2 u_resolution;

out vec2 v_texcoord;
out vec4 v_color;

void main() {
  v_color = a_color;
  v_texcoord = a_texcoord;

  float cosR = cos(u_cameraRotation);
  float sinR = sin(u_cameraRotation);

  vec2 worldPos = a_position - u_cameraPosition;
  vec2 viewPos = vec2(
    worldPos.x * cosR - worldPos.y * sinR,
    worldPos.x * sinR + worldPos.y * cosR
  ) * u_cameraZoom;

  vec2 invResolution = vec2(2.0, -2.0) / u_resolution;
  vec2 ndc = viewPos * invResolution + vec2(-1.0, 1.0);

  gl_Position = vec4(ndc, 0.0, 1.0);
}
