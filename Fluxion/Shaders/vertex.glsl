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
  float cosR = cos(u_cameraRotation);
  float sinR = sin(u_cameraRotation);

  // Rotation matrix
  mat2 rotationMatrix = mat2(
    cosR, -sinR,
    sinR, cosR
  );

  // Godot-like 2D coordinates:
  // - a_position is in pixels
  // - (0,0) is top-left of the viewport when the camera is at (0,0)
  // - +X right, +Y down
  // Camera transform is applied in pixel space, then we map to NDC.
  vec2 viewPos = (rotationMatrix * (a_position - u_cameraPosition)) * u_cameraZoom;
  vec2 ndc = vec2(
    (viewPos.x / u_resolution.x) * 2.0 - 1.0,
    1.0 - (viewPos.y / u_resolution.y) * 2.0
  );

  gl_Position = vec4(ndc, 0.0, 1.0);
  v_texcoord = a_texcoord;
}
