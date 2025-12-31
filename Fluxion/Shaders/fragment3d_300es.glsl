#version 300 es
precision highp float;

in vec3 v_worldPos;
in vec3 v_worldNormal;
in vec2 v_uv;

uniform vec3 u_cameraPos;

// Real-time lights (accumulated)
// Light types:
// 0 = Directional (sun-like)
// 1 = Point (inverse-square attenuation)
// 2 = Spot (inverse-square + cone falloff)
#define MAX_LIGHTS 8
uniform int u_lightCount;
uniform vec4 u_lightPosType[MAX_LIGHTS];        // xyz = position (point/spot), w = type
uniform vec4 u_lightDirInner[MAX_LIGHTS];       // xyz = direction rays travel (dir/spot), w = innerCos (spot)
uniform vec4 u_lightColorIntensity[MAX_LIGHTS]; // rgb = linear color, w = intensity scalar
uniform vec4 u_lightParams[MAX_LIGHTS];         // x = range (0=infinite), y = outerCos (spot), z/w unused

uniform vec3 u_ambientColor;   // linear RGB (indirect only)

// Metallic–roughness material inputs
uniform vec4 u_baseColorFactor;    // linear RGBA
uniform float u_metallicFactor;    // 0..1
uniform float u_roughnessFactor;   // 0..1
uniform float u_normalScale;       // >=0
uniform float u_aoStrength;        // 0..1
uniform vec3 u_emissiveFactor;     // linear RGB
uniform float u_exposure;          // HDR exposure multiplier (linear)

// Environment (IBL)
uniform samplerCube u_irradianceMap;  // diffuse irradiance cubemap (linear)
uniform samplerCube u_prefilterMap;   // GGX prefiltered cubemap (linear, mipped)
uniform sampler2D u_brdfLut;          // split-sum BRDF LUT (RG)
uniform float u_envIntensity;         // linear scalar
uniform float u_prefilterMaxLod;      // max LOD available in prefilterMap

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

// Correct sRGB EOTF/OETF (piecewise)
vec3 srgbToLinear(vec3 c) {
  vec3 lo = c / 12.92;
  vec3 hi = pow((c + 0.055) / 1.055, vec3(2.4));
  return mix(lo, hi, step(vec3(0.04045), c));
}

vec3 linearToSrgb(vec3 c) {
  c = max(c, vec3(0.0));
  vec3 lo = c * 12.92;
  vec3 hi = 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055;
  return mix(lo, hi, step(vec3(0.0031308), c));
}

// ACES filmic tone mapping (Narkowicz 2015 fit)
vec3 toneMapACES(vec3 x) {
  const float a = 2.51;
  const float b = 0.03;
  const float c = 2.43;
  const float d = 0.59;
  const float e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}

// Fresnel with roughness adjustment (helps grazing reflections for rough surfaces)
vec3 F_SchlickRoughness(float cosTheta, vec3 F0, float roughness) {
  return F0 + (max(vec3(1.0 - roughness), F0) - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
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

  vec3 V = normalize(u_cameraPos - v_worldPos);
  float NdotV = max(dot(N, V), 0.0);

  // --- Cook–Torrance BRDF inputs ---
  vec3 F0 = mix(vec3(0.04), baseColor, metallic);

  vec3 Lo = vec3(0.0);

  for (int i = 0; i < MAX_LIGHTS; i++) {
    if (i >= u_lightCount) break;

    vec4 posType = u_lightPosType[i];
    int type = int(posType.w + 0.5);

    vec3 radiance = u_lightColorIntensity[i].rgb * u_lightColorIntensity[i].a;

    vec3 L = vec3(0.0);
    float attenuation = 1.0;

    if (type == 0) {
      // Directional: direction is direction rays travel; L is from surface to light
      vec3 dir = normalize(u_lightDirInner[i].xyz);
      L = normalize(-dir);
    } else {
      // Point/Spot: position is light position
      vec3 toLight = posType.xyz - v_worldPos;
      float distSq = max(dot(toLight, toLight), 1e-4);
      float dist = sqrt(distSq);
      L = toLight / dist;

      // Inverse-square attenuation (physically-inspired)
      attenuation = 1.0 / distSq;

      // Optional soft range cutoff
      float range = u_lightParams[i].x;
      if (range > 0.0) {
        float f = clamp(1.0 - (dist / range), 0.0, 1.0);
        attenuation *= f * f;
      }

      if (type == 2) {
        // Spot: cone falloff
        vec3 dir = normalize(u_lightDirInner[i].xyz); // rays travel direction
        float innerCos = u_lightDirInner[i].w;
        float outerCos = u_lightParams[i].y;
        vec3 lightToFrag = normalize(v_worldPos - posType.xyz);
        float cosTheta = dot(dir, lightToFrag);
        float spot = smoothstep(outerCos, innerCos, cosTheta);
        attenuation *= spot;
      }
    }

    float NdotL = max(dot(N, L), 0.0);
    if (NdotL <= 0.0) continue;

    vec3 H = normalize(V + L);
    float NdotH = max(dot(N, H), 0.0);
    float VdotH = max(dot(V, H), 0.0);

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

    Lo += (diffuse + specular) * radiance * NdotL * attenuation;
  }

  // Indirect lighting:
  // - Diffuse term uses irradiance convolution
  // - Specular term uses GGX prefilter + split-sum BRDF LUT
  vec3 ambient = u_ambientColor * baseColor * (1.0 - metallic) * ao;

  if (u_envIntensity > 0.0) {
    vec3 R = reflect(-V, N);
    float lod = clamp(roughness * u_prefilterMaxLod, 0.0, u_prefilterMaxLod);

    // Both IBL textures are generated in linear space already.
    vec3 irradiance = texture(u_irradianceMap, N).rgb * u_envIntensity;
    vec3 prefiltered = textureLod(u_prefilterMap, R, lod).rgb * u_envIntensity;

    vec2 brdf = texture(u_brdfLut, vec2(NdotV, roughness)).rg;
    vec3 Fenv = F_SchlickRoughness(NdotV, F0, roughness);

    vec3 kS = Fenv;
    vec3 kD = (vec3(1.0) - kS) * (1.0 - metallic);

    vec3 diffuseIBL = irradiance * baseColor * kD;
    vec3 specIBL = prefiltered * (Fenv * brdf.x + brdf.y);

    ambient += (diffuseIBL + specIBL) * ao;
  }

  vec3 color = ambient + Lo + emissive;

  // HDR tone map + sRGB encode for display
  color *= max(u_exposure, 0.0);
  color = toneMapACES(color);
  color = linearToSrgb(color);

  outColor = vec4(color, alpha);
}
