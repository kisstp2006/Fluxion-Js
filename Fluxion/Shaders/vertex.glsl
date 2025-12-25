precision highp float;

attribute vec2 a_position;
attribute vec2 a_texcoord;
attribute vec4 a_color;

uniform vec2 u_cameraPosition;
uniform float u_cameraZoom;
uniform float u_cameraRotation;
uniform vec2 u_resolution;

varying vec2 v_texcoord;
varying vec4 v_color;

void main() {
  v_color = a_color;
  v_texcoord = a_texcoord;
  
  // Optimized rotation - precompute sin/cos on CPU when possible
  float cosR = cos(u_cameraRotation);
  float sinR = sin(u_cameraRotation);

  // Camera transform in pixel space
  vec2 worldPos = a_position - u_cameraPosition;
  vec2 viewPos = vec2(
    worldPos.x * cosR - worldPos.y * sinR,
    worldPos.x * sinR + worldPos.y * cosR
  ) * u_cameraZoom;
  
  // Map to NDC - optimized division
  vec2 invResolution = vec2(2.0, -2.0) / u_resolution;
  vec2 ndc = viewPos * invResolution + vec2(-1.0, 1.0);

  gl_Position = vec4(ndc, 0.0, 1.0);
}
