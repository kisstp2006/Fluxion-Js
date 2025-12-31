#version 300 es
precision highp float;
precision highp sampler2D;

in vec2 v_texCoord;
uniform sampler2D u_image;
uniform sampler2D u_depth;
uniform sampler2D u_normals;

uniform mat4 u_proj;
uniform mat4 u_invProj;
uniform vec3 u_lightDir;     // view-space direction from surface TO light (normalized)

uniform float u_strength;    // 0..1
uniform float u_maxDistance; // view units
uniform int u_steps;         // 0..32
uniform float u_thickness;   // depth thickness in 0..1 depth units
uniform float u_edgeFade;    // 0..0.5 (fade near screen edges)

out vec4 outColor;

vec3 decodeNormal(vec3 enc) {
  return normalize(enc * 2.0 - 1.0);
}

vec3 reconstructViewPos(vec2 uv, float depth01) {
  vec4 clip = vec4(uv * 2.0 - 1.0, depth01 * 2.0 - 1.0, 1.0);
  vec4 view = u_invProj * clip;
  return view.xyz / max(view.w, 1e-6);
}

vec3 projectToUvDepth(vec3 viewPos) {
  vec4 clip = u_proj * vec4(viewPos, 1.0);
  vec3 ndc = clip.xyz / max(clip.w, 1e-6);
  return ndc * 0.5 + 0.5; // uv.xy + depth01 in z
}

float edgeMask(vec2 uv) {
  float m = min(min(uv.x, uv.y), min(1.0 - uv.x, 1.0 - uv.y));
  return smoothstep(0.0, max(u_edgeFade, 1e-4), m);
}

void main() {
  vec4 base = texture(u_image, v_texCoord);

  float depth0 = texture(u_depth, v_texCoord).r;
  if (depth0 >= 0.99999) {
    outColor = base;
    return;
  }

  vec3 N = decodeNormal(texture(u_normals, v_texCoord).rgb);
  vec3 V0 = reconstructViewPos(v_texCoord, depth0);

  float strength = clamp(u_strength, 0.0, 1.0) * edgeMask(v_texCoord);
  if (strength <= 0.0) {
    outColor = base;
    return;
  }

  vec3 dir = normalize(u_lightDir);
  float ndl = max(dot(N, dir), 0.0);
  strength *= ndl;

  int steps = clamp(u_steps, 0, 32);
  float maxD = max(u_maxDistance, 0.0);
  if (steps <= 0 || maxD <= 0.0) {
    outColor = base;
    return;
  }

  float hit = 0.0;
  float stepLen = maxD / float(steps);
  vec3 start = V0 + dir * stepLen; // avoid self

  for (int i = 1; i <= 32; i++) {
    if (i > steps) break;
    vec3 p = start + dir * (float(i) * stepLen);
    vec3 uvz = projectToUvDepth(p);
    if (uvz.x < 0.0 || uvz.x > 1.0 || uvz.y < 0.0 || uvz.y > 1.0) break;

    float sd = texture(u_depth, uvz.xy).r;
    // If our ray sample is behind camera-visible geometry, that's a nearby occluder.
    if (uvz.z - u_thickness > sd) {
      hit = 1.0 - (float(i) / float(steps));
      break;
    }
  }

  float shadow = clamp(hit * strength, 0.0, 1.0);
  // Blend: enhance missing detail, don't replace shadow maps.
  base.rgb *= (1.0 - shadow);
  outColor = base;
}


