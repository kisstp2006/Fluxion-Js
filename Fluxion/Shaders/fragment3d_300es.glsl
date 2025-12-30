#version 300 es
precision highp float;

in vec3 v_worldPos;
in vec3 v_worldNormal;
in vec2 v_uv;

// Lighting (minimal default: one directional + ambient)
uniform vec3 u_cameraPos;
uniform vec3 u_lightDirection; // direction the light rays travel (world space)
uniform vec3 u_lightColor;     // linear RGB
uniform vec3 u_ambientColor;   // linear RGB (indirect only)

// Metallic–roughness material inputs
uniform vec4 u_baseColorFactor;    // linear RGBA
uniform float u_metallicFactor;    // 0..1
uniform float u_roughnessFactor;   // 0..1
uniform float u_normalScale;       // >=0
uniform float u_aoStrength;        // 0..1
uniform vec3 u_emissiveFactor;     // linear RGB

// Alpha
// 0 = OPAQUE, 1 = MASK (cutout), 2 = BLEND
uniform int u_alphaMode;
uniform float u_alphaCutoff;       // used when MASK

// Texture maps
// Note: baseColor + emissive are treated as sRGB and converted to linear in shader.
uniform sampler2D u_baseColorMap;
uniform sampler2D u_metallicMap;   // linear grayscale in R
uniform sampler2D u_roughnessMap;  // linear grayscale in R
uniform sampler2D u_normalMap;     // tangent-space normal, OpenGL +Y
uniform sampler2D u_aoMap;         // linear grayscale in R
uniform sampler2D u_emissiveMap;   // sRGB
uniform sampler2D u_alphaMap;      // linear grayscale in R

out vec4 outColor;

const float PI = 3.1415926535897932384626433832795;

vec3 srgbToLinear(vec3 c) {
  // Approximate sRGB->linear. Good enough for engine use.
  return pow(c, vec3(2.2));
}

vec3 linearToSrgb(vec3 c) {
  return pow(max(c, vec3(0.0)), vec3(1.0 / 2.2));
}

// GGX / Trowbridge-Reitz normal distribution function
float D_GGX(float NdotH, float roughness) {
  float a = roughness * roughness;
  float a2 = a * a;
  float d = (NdotH * NdotH) * (a2 - 1.0) + 1.0;
  return a2 / (PI * d * d + 1e-7);
}

// Schlick Fresnel approximation
vec3 F_Schlick(float cosTheta, vec3 F0) {
  float f = pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
  return F0 + (1.0 - F0) * f;
}

// Smith geometry using Schlick-GGX for each term (direct lighting k)
float G_SchlickGGX(float NdotX, float roughness) {
  float r = roughness + 1.0;
  float k = (r * r) / 8.0;
  float d = NdotX * (1.0 - k) + k;
  return NdotX / d;
}

float G_Smith(float NdotV, float NdotL, float roughness) {
  float ggxV = G_SchlickGGX(NdotV, roughness);
  float ggxL = G_SchlickGGX(NdotL, roughness);
  return ggxV * ggxL;
}

// Build a tangent basis from screen-space derivatives (no precomputed tangents needed).
// Based on "Normal Mapping Without Precomputed Tangents" (Mikkelsen).
mat3 computeTBN(vec3 N, vec3 pos, vec2 uv) {
  vec3 dp1 = dFdx(pos);
  vec3 dp2 = dFdy(pos);
  vec2 duv1 = dFdx(uv);
  vec2 duv2 = dFdy(uv);

  vec3 dp2perp = cross(dp2, N);
  vec3 dp1perp = cross(N, dp1);
  vec3 T = dp2perp * duv1.x + dp1perp * duv2.x;
  vec3 B = dp2perp * duv1.y + dp1perp * duv2.y;

  float invMax = inversesqrt(max(dot(T, T), dot(B, B)));
  return mat3(T * invMax, B * invMax, N);
}

void main() {
  // --- Material sampling ---
  vec4 baseTex = texture(u_baseColorMap, v_uv);
  vec3 baseColor = srgbToLinear(baseTex.rgb) * u_baseColorFactor.rgb;

  float alpha = baseTex.a * u_baseColorFactor.a;
  alpha *= texture(u_alphaMap, v_uv).r;
  alpha = clamp(alpha, 0.0, 1.0);

  // Alpha mode
  if (u_alphaMode == 0) {
    alpha = 1.0;
  } else if (u_alphaMode == 1) {
    if (alpha < u_alphaCutoff) discard;
    alpha = 1.0;
  }

  float metallic = clamp(texture(u_metallicMap, v_uv).r * u_metallicFactor, 0.0, 1.0);
  float roughness = clamp(texture(u_roughnessMap, v_uv).r * u_roughnessFactor, 0.04, 1.0);

  float aoTex = texture(u_aoMap, v_uv).r;
  float ao = mix(1.0, aoTex, clamp(u_aoStrength, 0.0, 1.0));

  vec3 emissive = srgbToLinear(texture(u_emissiveMap, v_uv).rgb) * u_emissiveFactor;

  // --- Normal mapping (tangent-space, OpenGL +Y) ---
  vec3 N = normalize(v_worldNormal);
  vec3 nTex = texture(u_normalMap, v_uv).xyz * 2.0 - 1.0;
  nTex.xy *= max(u_normalScale, 0.0);
  nTex = normalize(nTex);
  mat3 TBN = computeTBN(N, v_worldPos, v_uv);
  N = normalize(TBN * nTex);

  // --- Lighting vectors ---
  vec3 V = normalize(u_cameraPos - v_worldPos);
  vec3 L = normalize(-u_lightDirection);
  vec3 H = normalize(V + L);

  float NdotL = max(dot(N, L), 0.0);
  float NdotV = max(dot(N, V), 0.0);
  float NdotH = max(dot(N, H), 0.0);
  float VdotH = max(dot(V, H), 0.0);

  // --- Cook–Torrance BRDF (energy-conserving) ---
  vec3 F0 = mix(vec3(0.04), baseColor, metallic);
  vec3 F = F_Schlick(VdotH, F0);
  float D = D_GGX(NdotH, roughness);
  float G = G_Smith(NdotV, NdotL, roughness);

  vec3 numerator = D * G * F;
  float denom = max(4.0 * NdotV * NdotL, 1e-4);
  vec3 specular = numerator / denom;

  // kS = specular energy, kD = diffuse energy (metals have no diffuse)
  vec3 kS = F;
  vec3 kD = (vec3(1.0) - kS) * (1.0 - metallic);

  vec3 diffuse = (kD * baseColor) / PI;

  vec3 radiance = u_lightColor;
  vec3 Lo = (diffuse + specular) * radiance * NdotL;

  // Indirect lighting (simple ambient term; AO affects indirect only)
  vec3 ambient = u_ambientColor * baseColor * (1.0 - metallic) * ao;

  vec3 color = ambient + Lo + emissive;

  // Tone map + gamma encode for display
  color = color / (color + vec3(1.0));
  color = linearToSrgb(color);

  outColor = vec4(color, alpha);
}
