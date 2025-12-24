precision mediump float;
varying vec2 v_texcoord;
varying vec4 v_color;
uniform sampler2D u_texture;

void main() {
    vec4 texColor = texture2D(u_texture, v_texcoord);
    if (texColor.a < 0.01) discard;

    // Apply sprite color and transparency
    texColor.rgb *= v_color.rgb;
    texColor.a *= v_color.a;

    gl_FragColor = texColor;
}
