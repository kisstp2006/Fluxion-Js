precision mediump float;
varying vec2 v_texCoord;
uniform sampler2D u_image;
uniform vec2 u_resolution;

void main() {
    vec2 offset = 1.0 / u_resolution;
    vec4 color = vec4(0.0);
    
    // 5x5 Gaussian blur kernel
    color += texture2D(u_image, v_texCoord + vec2(-2.0, -2.0) * offset) * 0.003;
    color += texture2D(u_image, v_texCoord + vec2(-1.0, -2.0) * offset) * 0.013;
    color += texture2D(u_image, v_texCoord + vec2(0.0, -2.0) * offset) * 0.022;
    color += texture2D(u_image, v_texCoord + vec2(1.0, -2.0) * offset) * 0.013;
    color += texture2D(u_image, v_texCoord + vec2(2.0, -2.0) * offset) * 0.003;
    
    color += texture2D(u_image, v_texCoord + vec2(-2.0, -1.0) * offset) * 0.013;
    color += texture2D(u_image, v_texCoord + vec2(-1.0, -1.0) * offset) * 0.059;
    color += texture2D(u_image, v_texCoord + vec2(0.0, -1.0) * offset) * 0.097;
    color += texture2D(u_image, v_texCoord + vec2(1.0, -1.0) * offset) * 0.059;
    color += texture2D(u_image, v_texCoord + vec2(2.0, -1.0) * offset) * 0.013;
    
    color += texture2D(u_image, v_texCoord + vec2(-2.0, 0.0) * offset) * 0.022;
    color += texture2D(u_image, v_texCoord + vec2(-1.0, 0.0) * offset) * 0.097;
    color += texture2D(u_image, v_texCoord + vec2(0.0, 0.0) * offset) * 0.159;
    color += texture2D(u_image, v_texCoord + vec2(1.0, 0.0) * offset) * 0.097;
    color += texture2D(u_image, v_texCoord + vec2(2.0, 0.0) * offset) * 0.022;
    
    color += texture2D(u_image, v_texCoord + vec2(-2.0, 1.0) * offset) * 0.013;
    color += texture2D(u_image, v_texCoord + vec2(-1.0, 1.0) * offset) * 0.059;
    color += texture2D(u_image, v_texCoord + vec2(0.0, 1.0) * offset) * 0.097;
    color += texture2D(u_image, v_texCoord + vec2(1.0, 1.0) * offset) * 0.059;
    color += texture2D(u_image, v_texCoord + vec2(2.0, 1.0) * offset) * 0.013;
    
    color += texture2D(u_image, v_texCoord + vec2(-2.0, 2.0) * offset) * 0.003;
    color += texture2D(u_image, v_texCoord + vec2(-1.0, 2.0) * offset) * 0.013;
    color += texture2D(u_image, v_texCoord + vec2(0.0, 2.0) * offset) * 0.022;
    color += texture2D(u_image, v_texCoord + vec2(1.0, 2.0) * offset) * 0.013;
    color += texture2D(u_image, v_texCoord + vec2(2.0, 2.0) * offset) * 0.003;
    
    gl_FragColor = color;
}
