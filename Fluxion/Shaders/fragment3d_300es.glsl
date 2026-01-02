#version 300 es
precision highp float;
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

// Shadow Atlas (single depth texture)
uniform sampler2D u_shadowAtlas;
uniform vec2 u_shadowAtlasSize; // in pixels

// Cascaded Shadow Maps (CSM) for the main directional light.
#define MAX_CASCADES 4
uniform mat4 u_csmLightViewProj[MAX_CASCADES];
// Atlas rect per cascade: offset.xy, scale.zw (UV)
uniform vec4 u_csmRects[MAX_CASCADES];
// End distance for each cascade in VIEW space (linear units), length MAX_CASCADES.
uniform float u_csmSplits[MAX_CASCADES];
uniform int u_csmCount;      // 1..MAX_CASCADES
uniform float u_cameraNear;  // camera near plane
uniform float u_cameraFar;   // camera far plane
uniform float u_csmBlend;    // 0..0.5 fraction of cascade length used for blending near boundaries

// Back-compat: old constant bias (still uploaded by some code paths)
uniform float u_shadowBias;
// New slope-scaled bias (linear 0..1 depth units)
uniform float u_shadowBiasMin;
uniform float u_shadowBiasSlope;
uniform float u_shadowBiasMax;
// Shadow terminator mitigation: receiver normal offset in WORLD units.
uniform float u_shadowNormalOffset;
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
// 0..1 strength for the MAIN directional light's cascaded shadow maps (CSM)
uniform float u_csmShadowStrength;

// Wrap lighting: softens the terminator transition on curved surfaces.
// 0 = standard Lambert (hard cutoff at NdotL=0)
// 0.5 = half-lambert style (light wraps to back)
// Typical values: 0.1..0.3 for subtle softening
uniform float u_lightingWrap;

// Contact shadows (camera depth prepass)
uniform sampler2D u_sceneDepthTex;
uniform int u_hasSceneDepth;
uniform float u_contactShadowStrength;     // 0..1
uniform float u_contactShadowMaxDistance;  // world units
uniform int u_contactShadowSteps;          // e.g. 8..16
uniform float u_contactShadowThickness;    // depth thickness in 0..1 clip depth units

// Atlas shadows for spot + point lights
uniform int u_spotHasShadow[MAX_LIGHTS];
uniform mat4 u_spotShadowMat[MAX_LIGHTS];
uniform vec4 u_spotShadowRect[MAX_LIGHTS];   // offset.xy, scale.zw
uniform vec2 u_spotShadowNearFar[MAX_LIGHTS]; // near, far (for linear depth compare)
uniform int u_pointShadowBase[MAX_LIGHTS];    // base index into face arrays, -1 if none
uniform mat4 u_pointShadowMat[MAX_LIGHTS * 6];
uniform vec4 u_pointShadowRect[MAX_LIGHTS * 6];
uniform vec2 u_pointShadowNearFar[MAX_LIGHTS * 6]; // near, far (for linear depth compare)

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

float unpackDepth01FromRGBA8(vec4 rgba) {
  const vec4 bitSh = vec4(
    1.0 / 16777216.0,
    1.0 / 65536.0,
    1.0 / 256.0,
    1.0
  );
  return dot(rgba, bitSh);
}

float _hash12(vec2 p) {
  // Cheap stable hash in [0..1)
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

mat2 _rot2(float a) {
  float s = sin(a), c = cos(a);
  return mat2(c, -s, s, c);
}

float shadowBias01FromNdotL(float NdotL) {
  float ndl = clamp(NdotL, 0.0, 1.0);
  // Slope-scaled bias (tan(theta)) where theta is angle between normal and light.
  // This increases bias at grazing angles, but stays low on front-facing surfaces.
  float sinTheta = sqrt(max(1.0 - ndl * ndl, 0.0));
  float tanTheta = sinTheta / max(ndl, 0.2); // clamp to avoid huge bias at ndl ~ 0

  float bMin = clamp(u_shadowBiasMin, 0.0, 0.05);
  float bSlope = clamp(u_shadowBiasSlope, 0.0, 0.05);
  float bMax = clamp(u_shadowBiasMax, bMin, 0.05);

  float b = bMin + bSlope * tanTheta;
  return clamp(b, bMin, bMax);
}

float shadowNormalOffsetFromNdotL(float NdotL) {
  float ndl = clamp(NdotL, 0.0, 1.0);
  // Use sin(theta) = sqrt(1 - NdotL^2) which is the geometrically-correct perpendicular
  // distance to escape the self-shadowing region near the terminator.
  // This fixes the harsh diagonal lighting breaks on smooth geometry like spheres.
  float sinTheta = sqrt(max(1.0 - ndl * ndl, 0.0));
  return max(u_shadowNormalOffset, 0.0) * sinTheta;
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

// Rotated Poisson disk for smoother PCF and fewer rings.
// (Values in roughly [-1..1] disk; radius is applied separately.)
const vec2 _poisson16[16] = vec2[](
  vec2(-0.94201624, -0.39906216),
  vec2( 0.94558609, -0.76890725),
  vec2(-0.09418410, -0.92938870),
  vec2( 0.34495938,  0.29387760),
  vec2(-0.91588581,  0.45771432),
  vec2(-0.81544232, -0.87912464),
  vec2(-0.38277543,  0.27676845),
  vec2( 0.97484398,  0.75648379),
  vec2( 0.44323325, -0.97511554),
  vec2( 0.53742981, -0.47373420),
  vec2(-0.26496911, -0.41893023),
  vec2( 0.79197514,  0.19090188),
  vec2(-0.24188840,  0.99706507),
  vec2(-0.81409955,  0.91437590),
  vec2( 0.19984126,  0.78641367),
  vec2( 0.14383161, -0.14100790)
);

float _shadowTapAtlas(vec2 uv, float receiverDepth01, float bias01, float dither01) {
  float closest01 = unpackDepth01FromRGBA8(texture(u_shadowAtlas, uv));
  float z = clamp(receiverDepth01 + dither01, 0.0, 1.0);
  return (z - bias01 > closest01) ? 0.0 : 1.0;
}

float _linearizeDepth(float depth01, float near, float far) {
  // depth01 is gl_FragCoord.z in [0..1]
  float z = depth01 * 2.0 - 1.0; // NDC
  return (2.0 * near * far) / max((far + near) - z * (far - near), 1e-6);
}

float _receiverLinear01Perspective(float depth01, vec2 nearFar) {
  float near = max(nearFar.x, 1e-4);
  float far = max(nearFar.y, near + 1e-3);
  float viewD = _linearizeDepth(depth01, near, far);
  return clamp((viewD - near) / max(far - near, 1e-6), 0.0, 1.0);
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

  // Remap into atlas
  vec4 rect = u_csmRects[cascadeIdx]; // offset.xy, scale.zw
  vec2 uvAtlas = rect.xy + uvz.xy * rect.zw;

  // Convert radius from texels -> UV (atlas texels)
  vec2 texel = 1.0 / max(u_shadowAtlasSize, vec2(1.0));
  vec2 stepUv = texel * max(u_shadowPcfRadius, 0.0);

  // Hard shadow (PS2 style): single tap
  if (k == 1) {
    // Stable pattern in light-space: seed from shadow texel coord.
    vec2 st = floor(uvAtlas * u_shadowAtlasSize);
    float n = _hash12(st);
    float dither = (n - 0.5) * (1.0 / 65536.0);
    return _shadowTapAtlas(uvAtlas, uvz.z, bias, dither);
  }

  // PCF: rotated Poisson taps (breaks up banding/rings vs regular grids)
  float sum = 0.0;
  float wsum = 0.0;
  int taps = (k == 5) ? 16 : 8;
  vec2 st = floor(uvAtlas * u_shadowAtlasSize);
  float n = _hash12(st);
  mat2 R = _rot2(n * 6.28318530718);
  float dither = (n - 0.5) * (1.0 / 65536.0);
  for (int i = 0; i < 16; i++) {
    if (i >= taps) break;
    vec2 off = R * _poisson16[i];
    // Tent weight reduces visible patterns while keeping soft edges.
    float w = clamp(1.0 - 0.5 * length(off), 0.0, 1.0);
    sum += _shadowTapAtlas(uvAtlas + off * stepUv, uvz.z, bias, dither) * w;
    wsum += w;
  }
  return (wsum > 0.0) ? (sum / wsum) : 1.0;
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

float sampleAtlasShadowPerspective(vec4 rect, vec4 clip, vec2 nearFar, float bias) {
  float invW = 1.0 / max(clip.w, 1e-6);
  vec3 ndc = clip.xyz * invW;
  vec3 uvz = ndc * 0.5 + 0.5;
  if (uvz.x < 0.0 || uvz.x > 1.0 || uvz.y < 0.0 || uvz.y > 1.0 || uvz.z < 0.0 || uvz.z > 1.0) return 1.0;

  vec2 uvAtlas = rect.xy + uvz.xy * rect.zw;
  float receiver01 = _receiverLinear01Perspective(uvz.z, nearFar);
  int k = u_shadowPcfKernel;
  if (k != 1 && k != 3 && k != 5) k = 3;
  vec2 texel = 1.0 / max(u_shadowAtlasSize, vec2(1.0));
  vec2 stepUv = texel * max(u_shadowPcfRadius, 0.0);

  if (k == 1) {
    vec2 st = floor(uvAtlas * u_shadowAtlasSize);
    float n = _hash12(st);
    float dither = (n - 0.5) * (1.0 / 65536.0);
    return _shadowTapAtlas(uvAtlas, receiver01, bias, dither);
  }
  float sum = 0.0;
  float wsum = 0.0;
  int taps = (k == 5) ? 16 : 8;
  vec2 st = floor(uvAtlas * u_shadowAtlasSize);
  float n = _hash12(st);
  mat2 R = _rot2(n * 6.28318530718);
  float dither = (n - 0.5) * (1.0 / 65536.0);
  for (int i = 0; i < 16; i++) {
    if (i >= taps) break;
    vec2 off = R * _poisson16[i];
    float w = clamp(1.0 - 0.5 * length(off), 0.0, 1.0);
    sum += _shadowTapAtlas(uvAtlas + off * stepUv, receiver01, bias, dither) * w;
    wsum += w;
  }
  return (wsum > 0.0) ? (sum / wsum) : 1.0;
}

float computeSpotShadow(int lightIndex, vec3 worldPos, float bias) {
  if (u_spotHasShadow[lightIndex] != 1) return 1.0;
  vec4 clip = u_spotShadowMat[lightIndex] * vec4(worldPos, 1.0);
  return sampleAtlasShadowPerspective(u_spotShadowRect[lightIndex], clip, u_spotShadowNearFar[lightIndex], bias);
}

int _cubeFaceIndex(vec3 v) {
  vec3 a = abs(v);
  if (a.x >= a.y && a.x >= a.z) return (v.x >= 0.0) ? 0 : 1;
  if (a.y >= a.x && a.y >= a.z) return (v.y >= 0.0) ? 2 : 3;
  return (v.z >= 0.0) ? 4 : 5;
}

float computePointShadow(int lightIndex, vec3 worldPos, vec3 lightPos, float bias) {
  int base = u_pointShadowBase[lightIndex];
  if (base < 0) return 1.0;
  vec3 toFrag = worldPos - lightPos;
  int face = _cubeFaceIndex(toFrag);
  int idx = base + face;
  vec4 clip = u_pointShadowMat[idx] * vec4(worldPos, 1.0);
  return sampleAtlasShadowPerspective(u_pointShadowRect[idx], clip, u_pointShadowNearFar[idx], bias);
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

    float sceneDepth = texture(u_sceneDepthTex, uvz.xy).r;
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

  vec4 mr = texture(u_metallicMap, v_uv);
  vec4 rr = texture(u_roughnessMap, v_uv);
  float metallic = (u_metallicRoughnessPacked == 1)
    ? clamp(mr.b * u_metallicFactor, 0.0, 1.0)
    : clamp(mr.r * u_metallicFactor, 0.0, 1.0);
  float roughness = (u_metallicRoughnessPacked == 1)
    ? clamp(mr.g * u_roughnessFactor, 0.04, 1.0)
    : clamp(rr.r * u_roughnessFactor, 0.04, 1.0);

  float aoValue = texture(u_aoMap, v_uv).r;
  float aoStrength = clamp(u_aoStrength, 0.0, 1.0);
  // AO affects INDIRECT lighting only (ambient / IBL diffuse). It must NOT darken direct light or specular.
  float ao = mix(1.0, aoValue, aoStrength);

  vec3 emissive = srgbToLinear(texture(u_emissiveMap, v_uv).rgb) * u_emissiveFactor;

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

  // Main directional light "to light" direction (used for contact shadows + slope bias).
  vec3 dirToLight = normalize(-u_lightDirInner[0].xyz);
  
  // SHADOW CALCULATIONS USE GEOMETRY NORMAL (Ng), NOT SHADING NORMAL (N)
  // This prevents mismatches where normal mapping would cause incorrect self-shadowing.
  float mainNdotLGeom = max(dot(Ng, dirToLight), 0.0);  // <-- Ng for shadow bias
  float mainBias01 = shadowBias01FromNdotL(mainNdotLGeom);
  vec3 mainShadowPos = v_worldPos + Ng * shadowNormalOffsetFromNdotL(mainNdotLGeom);  // <-- Ng for offset

  // --- Shadow blending system ---
  // Primary occlusion: shadow maps (CSM)
  // Detail layers: contact shadows + (optional) screen-space shadows in post
  //
  // We avoid double-darkening by applying detail layers mostly in regions that are already lit
  // by the primary occlusion (scaled by primary visibility).

  // Soft/hard CSM visibility for the (first) directional light.
  // 1 = lit, 0 = shadowed.
  float dirShadow = computeDirectionalShadow(mainShadowPos, mainBias01);
  // Fade shadows out with camera distance (reduces distant shimmering + hard borders).
  float camDist = length(v_worldPos - u_cameraPos);
  float fadeT = smoothstep(u_shadowFadeStart, u_shadowFadeEnd, camDist);
  dirShadow = mix(dirShadow, 1.0, fadeT);
  float csmStrength = clamp(u_csmShadowStrength, 0.0, 1.0);
  // Apply strength by blending between "no shadow" (1.0) and computed visibility.
  float csmVisibility = mix(1.0, dirShadow, csmStrength);
  // Indirect shadowing follows PRIMARY occlusion only (detail layers should not overly dim ambient).
  float indirectShadowMul = (u_shadowAffectsIndirect == 1) ? csmVisibility : 1.0;

  // Contact shadows: short-distance occlusion toward the main directional light.
  // These are subtle and only affect very near intersections (helps grounding).
  float contactStrength = clamp(u_contactShadowStrength, 0.0, 1.0);
  float contactOcc = computeContactOcclusion(v_worldPos, dirToLight) * contactStrength; // 0..1
  // Detail compositing (prevents double-darkening):
  // Apply contact occlusion scaled by how "lit" the surface already is according to CSM.
  // - Fully shadowed by CSM (csmVisibility ~ 0): contact adds ~0
  // - Fully lit (csmVisibility ~ 1): contact applies at full strength
  float dirVisibility = csmVisibility * (1.0 - csmVisibility * contactOcc);

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

    // Shadow lookup uses GEOMETRY NORMAL (Ng) for bias and offset to prevent
    // mismatches between normal-mapped lighting and shadow map sampling.
    float shadow = 1.0;
    if (type == 0) {
      shadow = dirVisibility;
    } else if (type == 2) {
      // Spot: use Ng for shadow calculations
      float ndlGeom = max(dot(Ng, L), 0.0);  // <-- Ng
      float b = shadowBias01FromNdotL(ndlGeom);
      vec3 p = v_worldPos + Ng * shadowNormalOffsetFromNdotL(ndlGeom);  // <-- Ng
      shadow = computeSpotShadow(i, p, b);
    } else if (type == 1) {
      // Point: use Ng for shadow calculations
      vec3 lightPos = u_lightPosType[i].xyz;
      float ndlGeom = max(dot(Ng, L), 0.0);  // <-- Ng
      float b = shadowBias01FromNdotL(ndlGeom);
      vec3 p = v_worldPos + Ng * shadowNormalOffsetFromNdotL(ndlGeom);  // <-- Ng
      shadow = computePointShadow(i, p, lightPos, b);
    }

    // Apply shadow-map strength to non-directional lights (directional uses u_csmShadowStrength + detail blend above).
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
