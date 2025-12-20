precision mediump float;
varying vec2 v_texcoord;
uniform sampler2D u_texture;
uniform vec4 u_color;

void main() {
    vec4 texColor = texture2D(u_texture, v_texcoord);
    if (texColor.a < 0.01) discard;

    // Apply sprite color and transparency
    texColor.rgb *= u_color.rgb;
    texColor.a *= u_color.a;

    gl_FragColor = texColor;
}
