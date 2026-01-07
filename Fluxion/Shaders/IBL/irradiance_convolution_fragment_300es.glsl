#version 300 es
precision highp float;

in vec3 v_dir;
out vec4 outColor;

uniform samplerCube u_envMap; // assumed sRGB-ish; we decode to linear

// sRGB -> linear
vec3 srgbToLinear(vec3 c) {
  vec3 lo = c / 12.92;
  vec3 hi = pow((c + 0.055) / 1.055, vec3(2.4));
  return mix(lo, hi, step(vec3(0.04045), c));
}

// cosine-weighted hemisphere sampling in tangent space
vec3 hemiSample(float u1, float u2) {
  float r = sqrt(u1);
  float phi = 6.28318530718 * u2;
  float x = r * cos(phi);
  float y = r * sin(phi);
  float z = sqrt(max(0.0, 1.0 - u1));
  return vec3(x, y, z);
}

// Orthonormal basis from N
mat3 basisFromN(vec3 N) {
  vec3 up = abs(N.y) < 0.999 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
  vec3 T = normalize(cross(up, N));
  vec3 B = cross(N, T);
  return mat3(T, B, N);
}

// Hash -> 0..1 (cheap, deterministic)
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

void main() {
  vec3 N = normalize(v_dir);
  mat3 TBN = basisFromN(N);

  // Low sample count (fast). This is for diffuse only, so it’s forgiving.
  const int SAMPLE_COUNT = 64;
  vec3 irradiance = vec3(0.0);

  for (int i = 0; i < SAMPLE_COUNT; i++) {
    // Hammersley-ish via hash (good enough for this engine)
    float u1 = float(i) / float(SAMPLE_COUNT);
    float u2 = hash12(vec2(float(i), 17.0));
    vec3 L = TBN * hemiSample(u1, u2);

    float NdotL = max(dot(N, L), 0.0);
    vec3 c = srgbToLinear(texture(u_envMap, L).rgb);
    irradiance += c * NdotL;
  }

  irradiance = irradiance * (3.14159265359 / float(SAMPLE_COUNT));
  outColor = vec4(irradiance, 1.0);
}


