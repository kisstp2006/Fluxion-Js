precision mediump float;

varying vec2 v_texcoord;
varying vec4 v_color;
uniform sampler2D u_texture;

void main() {
    vec4 texColor = texture2D(u_texture, v_texcoord);
    
    // Early discard for fully transparent pixels
    if (texColor.a < 0.01) discard;

    // Multiply tint and alpha in one operation
    gl_FragColor = texColor * v_color;
}
