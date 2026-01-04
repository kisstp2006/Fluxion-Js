#version 300 es
precision highp float;

// Base quad geometry (normalized 0..1)
in vec2 a_position;
in vec2 a_texcoord;

// Per-instance sprite data
in vec2 a_i_pos;
in vec2 a_i_size;
in vec4 a_i_uv;      // (u0, v0, u1, v1)
in vec4 a_i_color;
in float a_i_rot;

uniform vec2 u_cameraPosition;
uniform float u_cameraZoom;
uniform float u_cameraRotation;
uniform vec2 u_resolution;

out vec2 v_texcoord;
out vec4 v_color;

void main() {
  v_color = a_i_color;
  v_texcoord = mix(a_i_uv.xy, a_i_uv.zw, a_texcoord);

  // Object rotation around sprite center, then camera transform.
  vec2 center = a_i_pos + (a_i_size * 0.5);
  vec2 local = (a_position - vec2(0.5)) * a_i_size;
  float cosO = cos(a_i_rot);
  float sinO = sin(a_i_rot);
  vec2 rotatedLocal = vec2(
    local.x * cosO - local.y * sinO,
    local.x * sinO + local.y * cosO
  );
  vec2 spritePos = center + rotatedLocal;

  float cosR = cos(u_cameraRotation);
  float sinR = sin(u_cameraRotation);

  vec2 worldPos = spritePos - u_cameraPosition;
  vec2 viewPos = vec2(
    worldPos.x * cosR - worldPos.y * sinR,
    worldPos.x * sinR + worldPos.y * cosR
  ) * u_cameraZoom;

  vec2 invResolution = vec2(2.0, -2.0) / u_resolution;
  vec2 ndc = viewPos * invResolution + vec2(-1.0, 1.0);

  gl_Position = vec4(ndc, 0.0, 1.0);
}
