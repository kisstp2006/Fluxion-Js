#version 300 es
precision highp float;

// We render into a depth texture attached as DEPTH_ATTACHMENT.
// Some drivers are happier if there is also a color attachment.
// This output is intentionally unused.
out vec4 outColor;

void main() {
  outColor = vec4(1.0);
}
