precision mediump float;
varying vec2 v_texCoord;
uniform sampler2D u_image;
uniform float u_intensity;

void main() {
    vec4 color = texture2D(u_image, v_texCoord);
    
    // Increase contrast
    color.rgb = ((color.rgb - 0.5) * max(u_intensity, 0.0)) + 0.5;
    
    gl_FragColor = color;
}
