precision mediump float;
varying vec2 v_texCoord;
uniform sampler2D u_image;
uniform float u_time;

void main() {
    vec2 uv = v_texCoord;
    
    // Vignette effect
    vec2 position = uv - vec2(0.5);
    float vignette = 1.0 - length(position) * 0.7;
    
    // Scanlines
    float scanline = sin(uv.y * 800.0) * 0.04;
    
    // CRT curvature
    vec2 curvedUV = uv;
    curvedUV = curvedUV * 2.0 - 1.0;
    vec2 offset = curvedUV.yx / 6.0;
    curvedUV = curvedUV + curvedUV * offset * offset;
    curvedUV = curvedUV * 0.5 + 0.5;
    
    vec4 color = texture2D(u_image, curvedUV);
    
    // Chromatic aberration
    color.r = texture2D(u_image, curvedUV + vec2(0.001, 0.0)).r;
    color.b = texture2D(u_image, curvedUV - vec2(0.001, 0.0)).b;
    
    // Apply effects
    color.rgb *= vignette;
    color.rgb += scanline;
    
    // Flicker
    color.rgb *= 0.95 + 0.05 * sin(u_time * 110.0);
    
    gl_FragColor = color;
}
