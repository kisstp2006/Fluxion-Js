#version 300 es
precision highp float;

in vec3 v_dir;
out vec4 outColor;

uniform samplerCube u_envMap;   // assumed sRGB-ish; decode to linear
uniform float u_roughness;      // 0..1

// sRGB -> linear
vec3 srgbToLinear(vec3 c) {
  vec3 lo = c / 12.92;
  vec3 hi = pow((c + 0.055) / 1.055, vec3(2.4));
  return mix(lo, hi, step(vec3(0.04045), c));
}

// Hammersley sequence (radical inverse)
float radicalInverseVdC(uint bits) {
  bits = (bits << 16u) | (bits >> 16u);
  bits = ((bits & 0x55555555u) << 1u) | ((bits & 0xAAAAAAAAu) >> 1u);
  bits = ((bits & 0x33333333u) << 2u) | ((bits & 0xCCCCCCCCu) >> 2u);
  bits = ((bits & 0x0F0F0F0Fu) << 4u) | ((bits & 0xF0F0F0F0u) >> 4u);
  bits = ((bits & 0x00FF00FFu) << 8u) | ((bits & 0xFF00FF00u) >> 8u);
  return float(bits) * 2.3283064365386963e-10; // / 2^32
}

vec2 hammersley(uint i, uint N) {
  return vec2(float(i) / float(N), radicalInverseVdC(i));
}

mat3 basisFromN(vec3 N) {
  vec3 up = abs(N.y) < 0.999 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
  vec3 T = normalize(cross(up, N));
  vec3 B = cross(N, T);
  return mat3(T, B, N);
}

// GGX importance sampling of half-vector
vec3 importanceSampleGGX(vec2 Xi, vec3 N, float roughness) {
  float a = roughness * roughness;
  float phi = 6.28318530718 * Xi.x;
  float cosTheta = sqrt((1.0 - Xi.y) / (1.0 + (a * a - 1.0) * Xi.y));
  float sinTheta = sqrt(max(0.0, 1.0 - cosTheta * cosTheta));

  vec3 Ht = vec3(cos(phi) * sinTheta, sin(phi) * sinTheta, cosTheta);
  return normalize(basisFromN(N) * Ht);
}

float D_GGX(float NdotH, float roughness) {
  float a = roughness * roughness;
  float a2 = a * a;
  float d = (NdotH * NdotH) * (a2 - 1.0) + 1.0;
  return a2 / (3.14159265359 * d * d + 1e-7);
}

void main() {
  vec3 N = normalize(v_dir);
  vec3 V = N;

  const uint SAMPLE_COUNT = 1024u;
  vec3 prefiltered = vec3(0.0);
  float totalWeight = 0.0;

  for (uint i = 0u; i < SAMPLE_COUNT; i++) {
    vec2 Xi = hammersley(i, SAMPLE_COUNT);
    vec3 H = importanceSampleGGX(Xi, N, u_roughness);
    vec3 L = normalize(2.0 * dot(V, H) * H - V);

    float NdotL = max(dot(N, L), 0.0);
    if (NdotL > 0.0) {
      // Use mip 0 here; the prefilter itself is what we are generating.
      vec3 c = srgbToLinear(texture(u_envMap, L).rgb);
      prefiltered += c * NdotL;
      totalWeight += NdotL;
    }
  }

  prefiltered = prefiltered / max(totalWeight, 1e-4);
  outColor = vec4(prefiltered, 1.0);
}


