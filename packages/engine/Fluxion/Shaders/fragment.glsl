precision mediump float;

varying vec2 v_texcoord;
varying vec4 v_color;
uniform sampler2D u_texture;

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

void main() {
    vec4 texColor = texture2D(u_texture, v_texcoord);
    
    // Early discard for fully transparent pixels
    if (texColor.a < 0.01) discard;

    // Treat sprite textures as sRGB, do math in linear, then encode back to sRGB.
    vec3 linear = srgbToLinear(texColor.rgb) * v_color.rgb;
    gl_FragColor = vec4(linearToSrgb(linear), texColor.a * v_color.a);
}
