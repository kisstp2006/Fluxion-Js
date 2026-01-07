#version 300 es
precision highp float;
precision highp sampler2D;
precision highp sampler2DShadow;
precision highp samplerCubeShadow;

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
uniform vec2 u_uvScale;            // UV tiling multiplier
uniform float u_metallicFactor;    // 0..1
uniform float u_roughnessFactor;   // 0..1
uniform float u_normalScale;       // >=0
uniform float u_normalFlipY;       // 1.0 = flip Y (DirectX), -1.0 = don't flip (OpenGL/GLTF)
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

// --- Shadow maps (depth textures + projected depth compare) ---
// Directional shadow map
uniform sampler2DShadow u_shadowMap;
uniform mat4 u_shadowTexMatrix; // bias * lightViewProj
uniform int u_hasShadowMap;      // 1 if u_shadowMap is valid

// Spot shadow map (only 1 spot light gets shadows for now)
uniform sampler2DShadow u_spotShadowMap;
uniform mat4 u_spotShadowTexMatrix;
uniform int u_spotShadowLightIndex; // packed light index, -1 if none

// Point shadow map (depth cubemap; only 1 point light gets shadows for now)
uniform samplerCubeShadow u_pointShadowMap;
uniform mat4 u_pointShadowTexMatrix[6];
uniform vec3 u_pointShadowLightPos;
uniform int u_pointShadowLightIndex; // packed light index, -1 if none

// Bias added to the receiver depth in shadow space (depth01 units)
uniform float u_shadowBias;
// 0 = shadows affect direct lighting only
// 1 = shadows also affect INDIRECT diffuse (ambient + diffuse IBL), but NOT specular IBL and NOT emissive
uniform int u_shadowAffectsIndirect;
// 0..1 shadow strength (0 = disabled, 1 = full)
uniform float u_shadowStrength;

// Wrap lighting: softens the terminator transition on curved surfaces.
// 0 = standard Lambert (hard cutoff at NdotL=0)
// 0.5 = half-lambert style (light wraps to back)
// Typical values: 0.1..0.3 for subtle softening
uniform float u_lightingWrap;

// Contact shadows (camera depth prepass)
uniform sampler2D u_sceneDepthTex;
uniform int u_hasSceneDepth;
// Viewport remap for sampling the depth prepass.
// xy = offset in UV space, zw = scale in UV space.
// Needed because the depth prepass renders into the engine's letterboxed viewport region.
uniform vec4 u_sceneViewportUv;
uniform float u_contactShadowStrength;     // 0..1
uniform float u_contactShadowMaxDistance;  // world units
uniform int u_contactShadowSteps;          // e.g. 8..16
uniform float u_contactShadowThickness;    // depth thickness in 0..1 clip depth units

// (Restarted shadows: removed atlas-based spot/point arrays.)

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

// glTF commonly packs roughness (G) + metallic (B) into one texture.
// 0: use R channel from u_metallicMap / u_roughnessMap (legacy)
// 1: use u_metallicMap.G for roughness and u_metallicMap.B for metallic
uniform int u_metallicRoughnessPacked;

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
  cosTheta = clamp(cosTheta, 0.0, 1.0);
  return F0 + (max(vec3(1.0 - roughness), F0) - F0) * pow(1.0 - cosTheta, 5.0);
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
  cosTheta = clamp(cosTheta, 0.0, 1.0);
  float f = pow(1.0 - cosTheta, 5.0);
  return F0 + (1.0 - F0) * f;
}

float saturate(float x) { return clamp(x, 0.0, 1.0); }

vec3 safeNormalize(vec3 v) {
  return v * inversesqrt(max(dot(v, v), 1e-8));
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

float computeDirectionalShadow(vec3 worldPos) {
  if (u_hasShadowMap != 1) return 1.0;
  vec4 proj = u_shadowTexMatrix * vec4(worldPos, 1.0);
  vec3 uvz = proj.xyz / max(proj.w, 1e-6);
  if (uvz.x < 0.0 || uvz.x > 1.0 || uvz.y < 0.0 || uvz.y > 1.0 || uvz.z < 0.0 || uvz.z > 1.0) return 1.0;
  float refZ = clamp(uvz.z - u_shadowBias, 0.0, 1.0);
  return texture(u_shadowMap, vec3(uvz.xy, refZ));
}

float computeSpotShadow(vec3 worldPos) {
  vec4 proj = u_spotShadowTexMatrix * vec4(worldPos, 1.0);
  vec3 uvz = proj.xyz / max(proj.w, 1e-6);
  if (uvz.x < 0.0 || uvz.x > 1.0 || uvz.y < 0.0 || uvz.y > 1.0 || uvz.z < 0.0 || uvz.z > 1.0) return 1.0;
  float refZ = clamp(uvz.z - u_shadowBias, 0.0, 1.0);
  return texture(u_spotShadowMap, vec3(uvz.xy, refZ));
}

// Wrap lighting: softens the terminator by allowing light to "wrap" around the surface.
// Returns a modified NdotL that transitions smoothly instead of hard-clamping to 0.
float wrapNdotL(float NdotL, float wrap) {
  // wrap = 0: standard Lambert (NdotL clamped to 0)
  // wrap = 0.5: half-lambert (light reaches 180 degrees around)
  // wrap = 1.0: fully wrapped (uniform lighting)
  float w = clamp(wrap, 0.0, 1.0);
  // Shift and rescale: (NdotL + w) / (1 + w), then clamp to [0,1]
  return clamp((NdotL + w) / (1.0 + w), 0.0, 1.0);
}

int _cubeFaceIndex(vec3 v) {
  vec3 a = abs(v);
  if (a.x >= a.y && a.x >= a.z) return (v.x >= 0.0) ? 0 : 1;
  if (a.y >= a.x && a.y >= a.z) return (v.y >= 0.0) ? 2 : 3;
  return (v.z >= 0.0) ? 4 : 5;
}

float computePointShadow(vec3 worldPos) {
  vec3 toFrag = worldPos - u_pointShadowLightPos;
  int face = _cubeFaceIndex(toFrag);
  vec4 proj = u_pointShadowTexMatrix[face] * vec4(worldPos, 1.0);
  vec3 uvz = proj.xyz / max(proj.w, 1e-6);
  if (uvz.z < 0.0 || uvz.z > 1.0) return 1.0;
  float refZ = clamp(uvz.z - u_shadowBias, 0.0, 1.0);
  vec3 dir = normalize(toFrag);
  return texture(u_pointShadowMap, vec4(dir, refZ));
}

// Returns contact occlusion amount in [0..1] (1 = fully occluded).
float computeContactOcclusion(vec3 worldPos, vec3 dirToLight) {
  if (u_hasSceneDepth != 1) return 0.0;
  int steps = max(u_contactShadowSteps, 0);
  if (steps <= 0) return 0.0;
  float maxDist = max(u_contactShadowMaxDistance, 0.0);
  if (maxDist <= 0.0) return 0.0;

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

    // Depth was rendered only inside the engine viewport region (letterboxed).
    // Remap clip-space UVs into that sub-rect so we sample the correct pixel.
    vec2 depthUv = u_sceneViewportUv.xy + uvz.xy * u_sceneViewportUv.zw;
    float sceneDepth = texture(u_sceneDepthTex, depthUv).r;
    // If our ray point is behind geometry that the camera sees, we found a nearby occluder.
    if (uvz.z - u_contactShadowThickness > sceneDepth) {
      // Stronger when hit is closer.
      hit = 1.0 - (t / maxDist);
      break;
    }
  }

  return clamp(hit, 0.0, 1.0);
}

void main() {
  // --- Material sampling ---
  vec2 uv = v_uv * u_uvScale;
  vec4 baseTex = texture(u_baseColorMap, uv);
  vec3 baseFactorLin = srgbToLinear(u_baseColorFactor.rgb);
  vec3 baseColor = srgbToLinear(baseTex.rgb) * baseFactorLin;

  float alpha = baseTex.a * u_baseColorFactor.a;
  alpha *= texture(u_alphaMap, uv).r;
  alpha = clamp(alpha, 0.0, 1.0);

  // Alpha mode
  if (u_alphaMode == 0) {
    alpha = 1.0;
  } else if (u_alphaMode == 1) {
    if (alpha < u_alphaCutoff) discard;
    alpha = 1.0;
  }

  vec4 mr = texture(u_metallicMap, uv);
  vec4 rr = texture(u_roughnessMap, uv);
  float metallic = (u_metallicRoughnessPacked == 1)
    ? clamp(mr.b * u_metallicFactor, 0.0, 1.0)
    : clamp(mr.r * u_metallicFactor, 0.0, 1.0);
  float roughness = (u_metallicRoughnessPacked == 1)
    ? clamp(mr.g * u_roughnessFactor, 0.04, 1.0)
    : clamp(rr.r * u_roughnessFactor, 0.04, 1.0);

  float aoValue = texture(u_aoMap, uv).r;
  float aoStrength = clamp(u_aoStrength, 0.0, 1.0);
  // AO affects INDIRECT lighting only (ambient / IBL diffuse). It must NOT darken direct light or specular.
  float ao = mix(1.0, aoValue, aoStrength);

  vec3 emissive = srgbToLinear(texture(u_emissiveMap, uv).rgb) * u_emissiveFactor;

  // ============================================================================
  // GEOMETRY NORMAL (Ng) vs SHADING NORMAL (N) SEPARATION
  // ============================================================================
  // Ng = Geometric/face normal from vertex interpolation (no normal mapping)
  //      Used for: shadow bias, shadow lookup offset, shadow terminator mitigation
  //      Reason: Prevents mismatches between lighting and shadowing on normal-mapped surfaces
  //
  // N  = Shading normal with normal mapping applied
  //      Used for: all lighting calculations (diffuse, specular, IBL, Fresnel)
  //      Reason: Provides surface detail for realistic lighting response
  // ============================================================================
  
  // Geometric normal: straight from vertex interpolation, normalized
  vec3 Ng = normalize(v_worldNormal);
  
  // Shading normal: starts as geometric, then modified by normal map
  vec3 N = Ng;
  vec3 nTex = texture(u_normalMap, uv).xyz * 2.0 - 1.0;
  nTex.y *= u_normalFlipY;  // Flip Y if DirectX-style normal map (some authoring tools)
  nTex.xy *= max(u_normalScale, 0.0);
  nTex = normalize(nTex);
  mat3 TBN = computeTBN(N, v_worldPos, uv);
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
      // Final shading normal (world space)
      dbg = normalize(N) * 0.5 + 0.5;
    } else if (u_materialDebugView == 5) {
      dbg = vec3(ao);
    } else if (u_materialDebugView == 6) {
      // Geometric normal (world space) - useful for diagnosing shadow terminator artifacts
      dbg = normalize(Ng) * 0.5 + 0.5;
    } else if (u_materialDebugView == 7) {
      // Difference between shading normal and geometric normal (diagnostic)
      dbg = clamp(abs(normalize(N) - normalize(Ng)), 0.0, 1.0);
    }

    // Display encode only (no tone mapping / exposure / lighting).
    outColor = vec4(linearToSrgb(clamp(dbg, 0.0, 1.0)), alpha);
    return;
  }

  vec3 V = safeNormalize(u_cameraPos - v_worldPos);
  float NdotV = saturate(dot(N, V));
  // Use an epsilon only for specular math to avoid division instability at silhouettes.
  float NdotV_eps = max(NdotV, 1e-4);

  // Main directional light "to light" direction (used for contact shadows).
  vec3 dirToLight = normalize(-u_lightDirInner[0].xyz);
  vec3 mainShadowPos = v_worldPos;

  // --- Shadow blending system ---
  // Primary occlusion: shadow maps (CSM)
  // Detail layers: contact shadows + (optional) screen-space shadows in post
  //
  // We avoid double-darkening by applying detail layers mostly in regions that are already lit
  // by the primary occlusion (scaled by primary visibility).

  // Soft/hard CSM visibility for the (first) directional light.
  // 1 = lit, 0 = shadowed.
  float dirShadow = computeDirectionalShadow(mainShadowPos);
  float dirStrength = clamp(u_shadowStrength, 0.0, 1.0);
  float dirPrimaryVisibility = mix(1.0, dirShadow, dirStrength);
  // Indirect shadowing follows PRIMARY occlusion only (detail layers should not overly dim ambient).
  float indirectShadowMul = (u_shadowAffectsIndirect == 1) ? dirPrimaryVisibility : 1.0;

  // Contact shadows: short-distance occlusion toward the main directional light.
  // These are subtle and only affect very near intersections (helps grounding).
  float contactStrength = clamp(u_contactShadowStrength, 0.0, 1.0);
  float contactOcc = computeContactOcclusion(v_worldPos, dirToLight) * contactStrength; // 0..1
  // Detail compositing (prevents double-darkening):
  // Apply contact occlusion scaled by how "lit" the surface already is according to CSM.
  // - Fully shadowed by CSM (csmVisibility ~ 0): contact adds ~0
  // - Fully lit (csmVisibility ~ 1): contact applies at full strength
  float dirVisibility = dirPrimaryVisibility * (1.0 - dirPrimaryVisibility * contactOcc);

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
      vec3 dir = safeNormalize(u_lightDirInner[i].xyz);
      L = safeNormalize(-dir);
    } else {
      // Point/Spot: position is light position
      vec3 toLight = posType.xyz - v_worldPos;
      float distSq = max(dot(toLight, toLight), 1e-4);
      float dist = sqrt(distSq);
      L = toLight / dist; // already normalized

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

    float NdotL_raw = dot(N, L);
    float NdotL = saturate(NdotL_raw);
    
    // Wrap lighting: soften the terminator by allowing a small light contribution
    // even when NdotL is slightly negative. This prevents harsh dark wedges on curved surfaces.
    float wrap = clamp(u_lightingWrap, 0.0, 1.0);
    float NdotL_wrapped = wrapNdotL(NdotL_raw, wrap);
    
    // Skip only if the wrapped value is zero (completely back-facing even with wrap)
    if (NdotL_wrapped <= 0.0) continue;
    
    // Use wrapped value for diffuse, raw (clamped) for specular BRDF stability
    float NdotL_eps = max(NdotL, 1e-4);

    vec3 H = safeNormalize(V + L);
    float NdotH = saturate(dot(N, H));
    float VdotH = saturate(dot(V, H));

    vec3 F = F_Schlick(VdotH, F0);
    float D = D_GGX(NdotH, roughness);
    float G = G_Smith(NdotV_eps, NdotL_eps, roughness);

    vec3 numerator = D * G * F;
    float denom = max(4.0 * NdotV_eps * NdotL_eps, 1e-4);
    vec3 specular = numerator / denom;

    // kS = specular energy, kD = diffuse energy (metals have no diffuse)
    vec3 kS = F;
    vec3 kD = (vec3(1.0) - kS) * (1.0 - metallic);
    // Use wrapped NdotL for diffuse to get smooth terminator transition
    vec3 diffuse = (kD * baseColor) / PI;

    // Shadows: classic projected depth compare.
    float shadow = 1.0;
    if (type == 0) {
      shadow = dirVisibility;
    } else if (type == 2) {
      if (u_spotShadowLightIndex >= 0 && i == u_spotShadowLightIndex) {
        shadow = computeSpotShadow(v_worldPos);
      }
    } else if (type == 1) {
      if (u_pointShadowLightIndex >= 0 && i == u_pointShadowLightIndex) {
        shadow = computePointShadow(v_worldPos);
      }
    }

    // Apply shadow strength to non-directional lights (directional already applied above).
    if (type != 0) {
      shadow = mix(1.0, shadow, clamp(u_shadowStrength, 0.0, 1.0));
    }

    // Diffuse uses wrapped NdotL for smooth terminator, specular uses raw NdotL
    Lo += (diffuse * NdotL_wrapped + specular * NdotL) * radiance * attenuation * shadow;
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
      vec2 brdf = texture(u_brdfLut, vec2(clamp(NdotV, 0.0, 1.0), roughness)).rg;

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
