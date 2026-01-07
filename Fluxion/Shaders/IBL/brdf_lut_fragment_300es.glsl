#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 outColor;

// Hammersley sequence (radical inverse)
float radicalInverseVdC(uint bits) {
  bits = (bits << 16u) | (bits >> 16u);
  bits = ((bits & 0x55555555u) << 1u) | ((bits & 0xAAAAAAAAu) >> 1u);
  bits = ((bits & 0x33333333u) << 2u) | ((bits & 0xCCCCCCCCu) >> 2u);
  bits = ((bits & 0x0F0F0F0Fu) << 4u) | ((bits & 0xF0F0F0F0u) >> 4u);
  bits = ((bits & 0x00FF00FFu) << 8u) | ((bits & 0xFF00FF00u) >> 8u);
  return float(bits) * 2.3283064365386963e-10;
}

vec2 hammersley(uint i, uint N) {
  return vec2(float(i) / float(N), radicalInverseVdC(i));
}

// GGX importance sampling of half-vector around N=(0,0,1)
vec3 importanceSampleGGX(vec2 Xi, float roughness) {
  float a = roughness * roughness;
  float phi = 6.28318530718 * Xi.x;
  float cosTheta = sqrt((1.0 - Xi.y) / (1.0 + (a * a - 1.0) * Xi.y));
  float sinTheta = sqrt(max(0.0, 1.0 - cosTheta * cosTheta));
  return vec3(cos(phi) * sinTheta, sin(phi) * sinTheta, cosTheta);
}

float G_SchlickGGX(float NdotV, float roughness) {
  float r = roughness + 1.0;
  float k = (r * r) / 8.0;
  return NdotV / (NdotV * (1.0 - k) + k);
}

float G_Smith(float NdotV, float NdotL, float roughness) {
  return G_SchlickGGX(NdotV, roughness) * G_SchlickGGX(NdotL, roughness);
}

vec2 integrateBRDF(float NdotV, float roughness) {
  vec3 V = vec3(sqrt(max(0.0, 1.0 - NdotV * NdotV)), 0.0, NdotV);
  float A = 0.0;
  float B = 0.0;

  const uint SAMPLE_COUNT = 1024u;
  for (uint i = 0u; i < SAMPLE_COUNT; i++) {
    vec2 Xi = hammersley(i, SAMPLE_COUNT);
    vec3 H = importanceSampleGGX(Xi, roughness);
    vec3 L = normalize(2.0 * dot(V, H) * H - V);

    float NdotL = max(L.z, 0.0);
    float NdotH = max(H.z, 0.0);
    float VdotH = max(dot(V, H), 0.0);
    if (NdotL > 0.0) {
      float G = G_Smith(NdotV, NdotL, roughness);
      float G_Vis = (G * VdotH) / max(NdotH * NdotV, 1e-5);
      float Fc = pow(1.0 - VdotH, 5.0);
      A += (1.0 - Fc) * G_Vis;
      B += Fc * G_Vis;
    }
  }

  A /= float(SAMPLE_COUNT);
  B /= float(SAMPLE_COUNT);
  return vec2(A, B);
}

void main() {
  float NdotV = clamp(v_uv.x, 0.0, 1.0);
  float roughness = clamp(v_uv.y, 0.0, 1.0);
  vec2 brdf = integrateBRDF(NdotV, roughness);
  outColor = vec4(brdf, 0.0, 1.0);
}


