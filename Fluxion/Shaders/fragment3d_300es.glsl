#version 300 es
precision highp float;
precision highp sampler2DArray;
precision highp sampler2D;

in vec3 v_worldPos;
in vec3 v_worldNormal;
in vec2 v_uv;

uniform vec3 u_cameraPos;
// Same matrix as the vertex stage uses; needed for contact-shadow raymarch reprojection.
uniform mat4 u_viewProj;

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
// NOTE: baseColorFactor is authored like an albedo color (typically picked in sRGB),
// so we convert its RGB to linear before lighting, matching the texture workflow.
uniform vec4 u_baseColorFactor;    // sRGB RGB + linear A
uniform float u_metallicFactor;    // 0..1
uniform float u_roughnessFactor;   // 0..1
uniform float u_normalScale;       // >=0
uniform float u_aoStrength;        // 0..1
uniform vec3 u_emissiveFactor;     // linear RGB
uniform float u_exposure;          // HDR exposure multiplier (linear)

// Material debug visualization:
// 0 = OFF (normal PBR)
// 1 = BaseColor
// 2 = Metallic
// 3 = Roughness
// 4 = Normal (final world-space normal, mapped to 0..1)
// 5 = Ambient Occlusion (after strength applied)
uniform int u_materialDebugView;

// Cascaded Shadow Maps (CSM) for the main directional light.
// We use a depth texture array so all cascades share one sampler binding.
#define MAX_CASCADES 4
uniform sampler2DArray u_csmShadowMap;
uniform mat4 u_csmLightViewProj[MAX_CASCADES];
// End distance for each cascade in VIEW space (linear units), length MAX_CASCADES.
uniform float u_csmSplits[MAX_CASCADES];
uniform int u_csmCount;      // 1..MAX_CASCADES
uniform float u_cameraNear;  // camera near plane
uniform float u_cameraFar;   // camera far plane
uniform float u_csmBlend;    // 0..1 fraction of cascade length used for blending near boundaries

uniform float u_shadowBias;
uniform int u_hasShadowMap;
// Shadow filtering
// - u_shadowPcfKernel: 1 = hard (PS2 style), 3 or 5 = PCF kernel size
// - u_shadowPcfRadius: sample radius in *texels* (kept uniform across scene)
// - u_shadowFadeStart/End: fade shadows out with camera distance (world units)
uniform int u_shadowPcfKernel;
uniform float u_shadowPcfRadius;
uniform float u_shadowFadeStart;
uniform float u_shadowFadeEnd;
// 0 = shadows affect direct lighting only
// 1 = shadows also affect INDIRECT diffuse (ambient + diffuse IBL), but NOT specular IBL and NOT emissive
uniform int u_shadowAffectsIndirect;
// 0..1 shadow strength (0 = disabled, 1 = full)
uniform float u_shadowStrength;

// Contact shadows (camera depth prepass)
uniform sampler2D u_sceneDepthTex;
uniform int u_hasSceneDepth;
uniform float u_contactShadowStrength;     // 0..1
uniform float u_contactShadowMaxDistance;  // world units
uniform int u_contactShadowSteps;          // e.g. 8..16
uniform float u_contactShadowThickness;    // depth thickness in 0..1 clip depth units

// Environment (IBL)
uniform samplerCube u_irradianceMap;  // diffuse irradiance cubemap (linear)
uniform samplerCube u_prefilterMap;   // GGX prefiltered cubemap (linear, mipped)
uniform sampler2D u_brdfLut;          // split-sum BRDF LUT (RG)
uniform float u_envIntensity;         // linear scalar
uniform float u_prefilterMaxLod;      // max LOD available in prefilterMap
// Fallback env sampling (before IBL generation finishes)
uniform samplerCube u_envMap;         // skybox cubemap (assumed sRGB-ish; we decode)
uniform float u_envMaxLod;            // max LOD available in envMap mip chain
uniform int u_hasIbl;                 // 1 if irradiance/prefilter/brdfLut are available

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

float _shadowTap(int layer, vec2 uv, float currentDepth, float bias) {
  float closest = texture(u_csmShadowMap, vec3(uv, float(layer))).r;
  return (currentDepth - bias > closest) ? 0.0 : 1.0;
}

float _linearizeDepth(float depth01, float near, float far) {
  // depth01 is gl_FragCoord.z in [0..1]
  float z = depth01 * 2.0 - 1.0; // NDC
  return (2.0 * near * far) / max((far + near) - z * (far - near), 1e-6);
}

float _shadowForCascade(int cascadeIdx, vec3 worldPos, float bias) {
  vec4 lightClip = u_csmLightViewProj[cascadeIdx] * vec4(worldPos, 1.0);
  float invW = 1.0 / max(lightClip.w, 1e-6);
  vec3 ndc = lightClip.xyz * invW;          // -1..1
  vec3 uvz = ndc * 0.5 + 0.5;               //  0..1

  // Outside the shadow frustum: treat as lit.
  if (uvz.x < 0.0 || uvz.x > 1.0 || uvz.y < 0.0 || uvz.y > 1.0 || uvz.z < 0.0 || uvz.z > 1.0) {
    return 1.0;
  }

  int k = u_shadowPcfKernel;
  // Clamp to supported kernel sizes: 1 (hard), 3, 5
  if (k != 1 && k != 3 && k != 5) k = 3;
  int halfK = (k - 1) / 2;

  // Convert radius from texels -> UV
  vec2 texDim = vec2(textureSize(u_csmShadowMap, 0).xy);
  vec2 texel = 1.0 / max(texDim, vec2(1.0));
  vec2 stepUv = texel * max(u_shadowPcfRadius, 0.0);

  // Hard shadow (PS2 style): single tap
  if (k == 1) {
    return _shadowTap(cascadeIdx, uvz.xy, uvz.z, bias);
  }

  // PCF: fixed loop bounds (5x5 max) with dynamic kernel selection
  float sum = 0.0;
  float count = 0.0;
  for (int y = -2; y <= 2; y++) {
    for (int x = -2; x <= 2; x++) {
      if (abs(x) > halfK || abs(y) > halfK) continue;
      vec2 uv = uvz.xy + vec2(float(x), float(y)) * stepUv;
      sum += _shadowTap(cascadeIdx, uv, uvz.z, bias);
      count += 1.0;
    }
  }
  return (count > 0.0) ? (sum / count) : 1.0;
}

float computeDirectionalShadow(vec3 worldPos, float bias) {
  if (u_hasShadowMap != 1) return 1.0;
  int c = clamp(u_csmCount, 1, MAX_CASCADES);

  // Use view-space depth to select cascade.
  float near = max(u_cameraNear, 1e-4);
  float far = max(u_cameraFar, near + 1e-3);
  float viewDepth = _linearizeDepth(gl_FragCoord.z, near, far);

  int idx = 0;
  for (int i = 0; i < MAX_CASCADES; i++) {
    if (i >= c) break;
    if (viewDepth <= u_csmSplits[i]) { idx = i; break; }
    idx = i;
  }

  // Blend between cascades to avoid hard seams.
  float start = (idx == 0) ? near : u_csmSplits[idx - 1];
  float end = u_csmSplits[idx];
  float len = max(end - start, 1e-3);
  float blendFrac = clamp(u_csmBlend, 0.0, 0.5);
  float blendDist = len * blendFrac;

  float s0 = _shadowForCascade(idx, worldPos, bias);
  if (idx < (c - 1) && blendDist > 0.0) {
    float blendStart = end - blendDist;
    if (viewDepth > blendStart) {
      float t = clamp((viewDepth - blendStart) / max(end - blendStart, 1e-6), 0.0, 1.0);
      float s1 = _shadowForCascade(idx + 1, worldPos, bias);
      return mix(s0, s1, t);
    }
  }
  return s0;
}

float computeContactShadow(vec3 worldPos, vec3 dirToLight) {
  if (u_hasSceneDepth != 1) return 1.0;
  int steps = max(u_contactShadowSteps, 0);
  if (steps <= 0) return 1.0;
  float maxDist = max(u_contactShadowMaxDistance, 0.0);
  if (maxDist <= 0.0) return 1.0;

  // Start slightly offset to avoid immediate self-hit.
  vec3 start = worldPos + dirToLight * 0.01;
  float hit = 0.0;

  for (int i = 1; i <= 24; i++) {
    if (i > steps) break;
    float t = (float(i) / float(steps)) * maxDist;
    vec3 p = start + dirToLight * t;
    vec4 clip = u_viewProj * vec4(p, 1.0);
    float invW = 1.0 / max(clip.w, 1e-6);
    vec3 ndc = clip.xyz * invW;
    vec3 uvz = ndc * 0.5 + 0.5;
    if (uvz.x < 0.0 || uvz.x > 1.0 || uvz.y < 0.0 || uvz.y > 1.0 || uvz.z < 0.0 || uvz.z > 1.0) {
      continue;
    }

    float sceneDepth = texture(u_sceneDepthTex, uvz.xy).r;
    // If our ray point is behind geometry that the camera sees, we found a nearby occluder.
    if (uvz.z - u_contactShadowThickness > sceneDepth) {
      // Stronger when hit is closer.
      hit = 1.0 - (t / maxDist);
      break;
    }
  }

  float strength = clamp(u_contactShadowStrength, 0.0, 1.0);
  return 1.0 - hit * strength;
}

void main() {
  // --- Material sampling ---
  vec4 baseTex = texture(u_baseColorMap, v_uv);
  vec3 baseFactorLin = srgbToLinear(u_baseColorFactor.rgb);
  vec3 baseColor = srgbToLinear(baseTex.rgb) * baseFactorLin;

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

  float aoValue = texture(u_aoMap, v_uv).r;
  float aoStrength = clamp(u_aoStrength, 0.0, 1.0);
  // AO affects INDIRECT lighting only (ambient / IBL diffuse). It must NOT darken direct light or specular.
  float ao = mix(1.0, aoValue, aoStrength);

  vec3 emissive = srgbToLinear(texture(u_emissiveMap, v_uv).rgb) * u_emissiveFactor;

  // --- Normal mapping (tangent-space, OpenGL +Y) ---
  vec3 N = normalize(v_worldNormal);
  vec3 nTex = texture(u_normalMap, v_uv).xyz * 2.0 - 1.0;
  nTex.xy *= max(u_normalScale, 0.0);
  nTex = normalize(nTex);
  mat3 TBN = computeTBN(N, v_worldPos, v_uv);
  N = normalize(TBN * nTex);

  // --- Material debug view (bypass ALL lighting) ---
  if (u_materialDebugView != 0) {
    vec3 dbg = vec3(0.0);
    if (u_materialDebugView == 1) {
      dbg = baseColor; // linear RGB used for lighting
    } else if (u_materialDebugView == 2) {
      dbg = vec3(metallic);
    } else if (u_materialDebugView == 3) {
      dbg = vec3(roughness);
    } else if (u_materialDebugView == 4) {
      dbg = normalize(N) * 0.5 + 0.5;
    } else if (u_materialDebugView == 5) {
      dbg = vec3(ao);
    }

    // Display encode only (no tone mapping / exposure / lighting).
    outColor = vec4(linearToSrgb(clamp(dbg, 0.0, 1.0)), alpha);
    return;
  }

  vec3 V = normalize(u_cameraPos - v_worldPos);
  float NdotV = max(dot(N, V), 0.0);

  // Soft/hard shadow visibility for the (first) directional light.
  // 1 = lit, 0 = shadowed
  float dirShadow = computeDirectionalShadow(v_worldPos, u_shadowBias);
  // Fade shadows out with camera distance (reduces distant shimmering + hard borders).
  float camDist = length(v_worldPos - u_cameraPos);
  float fadeT = smoothstep(u_shadowFadeStart, u_shadowFadeEnd, camDist);
  dirShadow = mix(dirShadow, 1.0, fadeT);
  float shadowStrength = clamp(u_shadowStrength, 0.0, 1.0);
  // Apply strength by blending between "no shadow" (1.0) and computed visibility.
  float dirVisibility = mix(1.0, dirShadow, shadowStrength);
  float indirectShadowMul = (u_shadowAffectsIndirect == 1) ? dirVisibility : 1.0;

  // Contact shadows: short-distance occlusion toward the main directional light.
  // These are subtle and only affect very near intersections (helps grounding).
  vec3 dirToLight = normalize(-u_lightDirInner[0].xyz);
  float contactMul = computeContactShadow(v_worldPos, dirToLight);
  dirVisibility *= contactMul;

  // --- Specular anti-aliasing (prevents "tight white dots" on rough dielectrics) ---
  // Increase effective roughness based on how quickly the normal changes across the pixel.
  // This is NOT a Phong/Blinn shininess exponent; it simply reduces specular aliasing/fireflies.
  vec3 dndx = dFdx(N);
  vec3 dndy = dFdy(N);
  float variance = max(dot(dndx, dndx), dot(dndy, dndy));
  float r2 = roughness * roughness;
  r2 = clamp(r2 + 0.25 * variance, 0.0, 1.0);
  roughness = clamp(sqrt(r2), 0.04, 1.0);

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

    float shadow = (type == 0) ? dirVisibility : 1.0;
    Lo += (diffuse + specular) * radiance * NdotL * attenuation * shadow;
  }

  // Indirect lighting:
  // - Diffuse term uses irradiance convolution
  // - Specular term uses GGX prefilter + split-sum BRDF LUT
  vec3 ambient = u_ambientColor * baseColor * (1.0 - metallic);
  ambient *= ao;
  // Optional: allow shadowing to affect INDIRECT diffuse only (not specular IBL).
  ambient *= indirectShadowMul;

  if (u_envIntensity > 0.0) {
    vec3 R = reflect(-V, N);

    vec3 Fenv = F_SchlickRoughness(NdotV, F0, roughness);
    vec3 kS = Fenv;
    vec3 kD = (vec3(1.0) - kS) * (1.0 - metallic);

    if (u_hasIbl == 1) {
      float lod = clamp(roughness * u_prefilterMaxLod, 0.0, u_prefilterMaxLod);

      // IBL textures are generated in linear space already.
      vec3 irradiance = texture(u_irradianceMap, N).rgb * u_envIntensity;
      vec3 prefiltered = textureLod(u_prefilterMap, R, lod).rgb * u_envIntensity;
      vec2 brdf = texture(u_brdfLut, vec2(NdotV, roughness)).rg;

      vec3 diffuseIBL = irradiance * baseColor * kD;
      vec3 specIBL = prefiltered * (Fenv * brdf.x + brdf.y);

      // AO affects indirect diffuse only; do NOT occlude specular reflections/highlights.
      ambient += diffuseIBL * ao * indirectShadowMul;
      ambient += specIBL;
    } else {
      // Fallback: sample the skybox cubemap directly (roughness-driven mip LOD).
      // Decode to linear for lighting calculations.
      vec3 envDiffuse = srgbToLinear(texture(u_envMap, N).rgb) * u_envIntensity;
      float envLod = clamp(roughness * u_envMaxLod, 0.0, u_envMaxLod);
      vec3 envSpec = srgbToLinear(textureLod(u_envMap, R, envLod).rgb) * u_envIntensity;

      vec3 diffuseIBL = envDiffuse * baseColor * kD;
      vec3 specIBL = envSpec * kS;

      ambient += diffuseIBL * ao * indirectShadowMul;
      ambient += specIBL;
    }
  }

  vec3 color = ambient + Lo + emissive;

  // HDR tone map + sRGB encode for display
  color *= max(u_exposure, 0.0);
  color = toneMapACES(color);
  color = linearToSrgb(color);

  outColor = vec4(color, alpha);
}
