attribute vec2 a_position;
attribute vec2 a_texcoord;
uniform vec2 u_cameraPosition;
uniform float u_cameraZoom;
uniform float u_cameraRotation;
uniform float u_aspectRatio;
varying vec2 v_texcoord;

void main() {
  float cosR = cos(u_cameraRotation);
  float sinR = sin(u_cameraRotation);

  // Rotation matrix
  mat2 rotationMatrix = mat2(
    cosR, -sinR,
    sinR, cosR
  );

  // Apply transformations: translate -> rotate -> scale
  vec2 transformedPosition = (rotationMatrix * (a_position - u_cameraPosition)) * u_cameraZoom;
  
  // Apply aspect ratio correction to x-coordinate
  transformedPosition.x /= u_aspectRatio;

  gl_Position = vec4(transformedPosition, 0, 1);
  v_texcoord = a_texcoord;
}
