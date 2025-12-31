#version 300 es
precision highp float;

in vec3 v_worldNormal;
in vec3 v_worldPos;
out vec4 outColor;

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

uniform float u_shadowBias;
uniform float u_shadowBiasMin;
uniform float u_shadowBiasSlope;
uniform float u_shadowBiasMax;
// Shadow terminator mitigation: receiver normal offset in WORLD units.
uniform float u_shadowNormalOffset;
uniform int u_hasShadowMap;
// Shadow filtering
uniform int u_shadowPcfKernel;
uniform float u_shadowPcfRadius;
uniform float u_shadowFadeStart;
uniform float u_shadowFadeEnd;
// 0..1 strength for CSM
uniform float u_csmShadowStrength;
// Main directional light direction from surface TO light (world space), for slope-scaled bias.
uniform vec3 u_mainLightDir;

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
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

mat2 _rot2(float a) {
  float s = sin(a), c = cos(a);
  return mat2(c, -s, s, c);
}

float shadowBias01FromNdotL(float NdotL) {
  float ndl = clamp(NdotL, 0.0, 1.0);
  float sinTheta = sqrt(max(1.0 - ndl * ndl, 0.0));
  float tanTheta = sinTheta / max(ndl, 0.2);

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
  float sinTheta = sqrt(max(1.0 - ndl * ndl, 0.0));
  return max(u_shadowNormalOffset, 0.0) * sinTheta;
}

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

  // Remap into atlas
  vec4 rect = u_csmRects[cascadeIdx]; // offset.xy, scale.zw
  vec2 uvAtlas = rect.xy + uvz.xy * rect.zw;

  // Convert radius from texels -> UV (atlas texels)
  vec2 texel = 1.0 / max(u_shadowAtlasSize, vec2(1.0));
  vec2 stepUv = texel * max(u_shadowPcfRadius, 0.0);

  // Hard shadow: single tap
  if (k == 1) {
    vec2 st = floor(uvAtlas * u_shadowAtlasSize);
    float n = _hash12(st);
    float dither = (n - 0.5) * (1.0 / 65536.0);
    return _shadowTapAtlas(uvAtlas, uvz.z, bias, dither);
  }

  // PCF: rotated Poisson taps
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

void main() {
  // GEOMETRY NORMAL ONLY - no normal mapping in this pass.
  // Shadow calculations intentionally use the geometric normal (not shading normal)
  // to prevent mismatches between lighting and shadowing on normal-mapped surfaces.
  vec3 n = normalize(v_worldNormal);

  // Primary (CSM) visibility stored in alpha so SS shadows can behave as a detail layer (no double-darkening).
  float primaryVis = 1.0;
  if (u_hasShadowMap == 1) {
    // Use geometric normal for shadow bias and offset (same as main fragment shader)
    float ndl = max(dot(n, normalize(u_mainLightDir)), 0.0);
    float bias01 = shadowBias01FromNdotL(ndl);
    vec3 p = v_worldPos + n * shadowNormalOffsetFromNdotL(ndl);
    float s = computeDirectionalShadow(p, bias01);
    // Fade out with distance (use linearized depth as a stable proxy for camera distance).
    float near = max(u_cameraNear, 1e-4);
    float far = max(u_cameraFar, near + 1e-3);
    float viewDepth = _linearizeDepth(gl_FragCoord.z, near, far);
    float fadeT = smoothstep(u_shadowFadeStart, u_shadowFadeEnd, viewDepth);
    s = mix(s, 1.0, fadeT);

    float strength = clamp(u_csmShadowStrength, 0.0, 1.0);
    primaryVis = mix(1.0, s, strength);
  }

  outColor = vec4(n * 0.5 + 0.5, clamp(primaryVis, 0.0, 1.0));
}


