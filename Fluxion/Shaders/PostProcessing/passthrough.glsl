precision mediump float;
varying vec2 v_texCoord;
uniform sampler2D u_image;

void main() {
    gl_FragColor = texture2D(u_image, v_texCoord);
}
