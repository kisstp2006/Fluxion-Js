#version 300 es
precision highp float;

uniform vec2 u_shadowNearFar; // x = near, y = far
uniform int u_shadowIsOrtho;  // 1 = ortho, 0 = perspective

out vec4 outColor;

float _linearizeDepthPerspective(float depth01, float near, float far) {
  // depth01 is gl_FragCoord.z in [0..1] for a perspective projection
  float z = depth01 * 2.0 - 1.0; // NDC
  return (2.0 * near * far) / max((far + near) - z * (far - near), 1e-6);
}

vec4 packDepth01ToRGBA8(float v) {
  v = clamp(v, 0.0, 1.0);
  // 32-bit packing into RGBA8
  const vec4 bitSh = vec4(16777216.0, 65536.0, 256.0, 1.0);
  const vec4 bitMsk = vec4(0.0, 1.0 / 256.0, 1.0 / 256.0, 1.0 / 256.0);
  vec4 res = fract(v * bitSh);
  res -= res.xxyz * bitMsk;
  return res;
}

void main() {
  float near = max(u_shadowNearFar.x, 1e-4);
  float far = max(u_shadowNearFar.y, near + 1e-3);

  float d01 = gl_FragCoord.z;
  float lin01 = d01;
  if (u_shadowIsOrtho != 1) {
    float viewD = _linearizeDepthPerspective(d01, near, far);
    lin01 = (viewD - near) / max(far - near, 1e-6);
  }

  outColor = packDepth01ToRGBA8(lin01);
}


