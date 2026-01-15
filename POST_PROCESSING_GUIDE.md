# Fluxion-Js 2D Post-Processing Guide

## Overview

The Fluxion-Js engine includes a **comprehensive post-processing system** that allows you to apply visual effects to the entire rendered scene. The system supports multiple effects chained together with priority-based ordering, and includes built-in effects like blur, grayscale, CRT, contrast, and screen-space shadows.

---

## Quick Start

### 1. Enable Post-Processing

Enable post-processing when creating the Engine:

```javascript
import { Engine } from "./packages/engine/Fluxion/index.js";

const game = {
    // ... your game code
};

// Enable post-processing (4th parameter = true)
const engine = new Engine("gameCanvas", game, 1920, 1080, true, true, {
    renderer: {
        webglVersion: 2,
        allowFallback: true,
        renderTargets: {
            msaaSamples: 4,  // Optional: MSAA for smoother edges
        },
    },
});
```

**Note**: The 4th parameter (`enablePostProcessing`) must be `true` to use post-processing.

### 2. Access Post-Processing

Access the post-processing system through the renderer:

```javascript
const game = {
    engine: null,
    
    init(renderer) {
        this.engine = renderer.engine; // Store engine reference
    },
    
    update(dt) {
        const pp = this.engine?.renderer?.postProcessing;
        if (pp && pp.isReady) {
            // Use post-processing here
        }
    }
};
```

---

## Built-in Effects

The system comes with several pre-built effects:

### Available Effects

| Effect Name | Description | Priority | Uniforms |
|------------|-------------|----------|----------|
| `passthrough` | No effect (passes through unchanged) | 0 | None |
| `blur` | Gaussian blur (5x5 kernel) | 10 | `resolution` (vec2) |
| `grayscale` | Converts to grayscale | 20 | None |
| `crt` | CRT monitor effect (scanlines, vignette, curvature) | 90 | `time` (float) |
| `contrast` | Adjusts contrast | 100 | `intensity` (float, default: 1.5) |
| `ss_shadows` | Screen-space shadows (WebGL2 only) | 15 | Multiple (see below) |

---

## Basic Usage

### Enable/Disable Effects

```javascript
const pp = engine.renderer.postProcessing;

// Enable an effect
pp.enableEffect("blur");
pp.enableEffect("grayscale");

// Disable an effect
pp.disableEffect("blur");

// Clear all effects
pp.clearEffects();
```

### Set Effect Uniforms

```javascript
// Set blur resolution (automatically set, but you can override)
pp.setUniform("blur", "resolution", [1920, 1080]);

// Set contrast intensity (1.0 = no change, >1.0 = more contrast)
pp.setUniform("contrast", "intensity", 2.0);

// Set CRT time for animation
pp.setUniform("crt", "time", performance.now() / 1000);
```

### Check Active Effects

```javascript
const pp = engine.renderer.postProcessing;

// Get list of active effects
console.log(pp.activeEffects); // ["blur", "grayscale"]

// Check if an effect is active
if (pp.activeEffects.includes("blur")) {
    console.log("Blur is active");
}
```

---

## Complete Example

Here's a complete example with keyboard controls:

```javascript
import { Engine, Sprite, Input } from "./packages/engine/Fluxion/index.js";

const input = new Input();

const game = {
    engine: null,
    sprites: [],

    init(renderer) {
        // Create some sprites to see the effects
        this.sprites.push(new Sprite(renderer, "logo.png", 0, 0, 1920, 1080));
    },

    update(dt) {
        const pp = this.engine?.renderer?.postProcessing;
        if (!pp || !pp.isReady) return;

        // Toggle effects with number keys
        if (input.getKeyDown("1")) {
            if (pp.activeEffects.includes("grayscale")) {
                pp.disableEffect("grayscale");
            } else {
                pp.enableEffect("grayscale");
            }
        }

        if (input.getKeyDown("2")) {
            if (pp.activeEffects.includes("blur")) {
                pp.disableEffect("blur");
            } else {
                pp.enableEffect("blur");
            }
        }

        if (input.getKeyDown("3")) {
            if (pp.activeEffects.includes("crt")) {
                pp.disableEffect("crt");
            } else {
                pp.enableEffect("crt");
            }
        }

        if (input.getKeyDown("4")) {
            if (pp.activeEffects.includes("contrast")) {
                pp.disableEffect("contrast");
            } else {
                pp.enableEffect("contrast");
            }
        }

        // Clear all effects
        if (input.getKeyDown("0")) {
            pp.clearEffects();
        }

        // Update CRT time uniform (needed for animation)
        if (pp.activeEffects.includes("crt")) {
            pp.setUniform("crt", "time", performance.now() / 1000);
        }

        // Adjust contrast dynamically
        if (pp.activeEffects.includes("contrast")) {
            const intensity = 1.0 + Math.sin(performance.now() / 1000) * 0.5;
            pp.setUniform("contrast", "intensity", intensity);
        }
    },

    draw(renderer) {
        for (const sprite of this.sprites) {
            sprite.draw();
        }
    },
};

// Create engine with post-processing enabled
window.addEventListener("load", () => {
    game.engine = new Engine("gameCanvas", game, 1920, 1080, true, true, {
        renderer: {
            webglVersion: 2,
            allowFallback: true,
            renderTargets: {
                msaaSamples: 4,
            },
        },
    });
});
```

---

## Effect Priority System

Effects are applied in **priority order** (lower numbers first). This allows you to control the order of effect application.

### Default Priorities

- `passthrough`: 0
- `blur`: 10
- `ss_shadows`: 15
- `grayscale`: 20
- `crt`: 90
- `contrast`: 100

### Change Effect Priority

```javascript
const pp = engine.renderer.postProcessing;

// Set custom priority (lower = applied first)
pp.setEffectPriority("blur", 5);   // Blur will apply before other effects
pp.setEffectPriority("contrast", 200); // Contrast will apply last
```

**Example Chain**: If you enable `blur` (priority 10) and `contrast` (priority 100), the order is:
1. Original scene → 
2. Blur → 
3. Contrast → 
4. Final output

---

## Screen-Space Shadows (WebGL2 Only)

The `ss_shadows` effect provides additional shadow detail using screen-space raymarching. It requires WebGL2 and 3D depth/normal buffers.

### Enable Screen-Space Shadows

```javascript
const renderer = engine.renderer;

// Enable screen-space shadows (automatically enables the effect)
renderer.setScreenSpaceShadowsEnabled(true);

// Configure parameters
renderer.setScreenSpaceShadowStrength(0.25);      // 0..1
renderer.setScreenSpaceShadowMaxDistance(0.8);   // world units
renderer.setScreenSpaceShadowSteps(16);          // raymarch steps
renderer.setScreenSpaceShadowThickness(0.002);   // depth thickness
renderer.setScreenSpaceShadowEdgeFade(0.06);     // edge fade distance
```

### Manual Control

```javascript
const pp = engine.renderer.postProcessing;

// Manually enable/disable (if auto-enable is disabled)
pp.enableEffect("ss_shadows");
pp.disableEffect("ss_shadows");

// The renderer automatically sets all uniforms when enabled
```

**Note**: Screen-space shadows work best when combined with 3D rendering and cascaded shadow maps (CSM).

---

## Creating Custom Effects

You can create custom post-processing effects by loading your own shaders.

### 1. Create Fragment Shader

Create a fragment shader file (e.g., `my_effect_300es.glsl`):

```glsl
#version 300 es
precision mediump float;

in vec2 v_texCoord;
uniform sampler2D u_image;
uniform float u_intensity;  // Your custom uniform

out vec4 outColor;

void main() {
    vec4 color = texture(u_image, v_texCoord);
    
    // Your effect code here
    color.rgb *= u_intensity;
    
    outColor = color;
}
```

### 2. Load Custom Effect

```javascript
const pp = engine.renderer.postProcessing;

await pp.loadEffect(
    "my_effect",  // Effect name
    "../../path/to/my_effect_300es.glsl",  // Fragment shader path
    {
        intensity: { type: '1f', value: 1.0 }  // Uniform definition
    },
    {
        priority: 50  // Optional priority
    }
);

// Use it like built-in effects
pp.enableEffect("my_effect");
pp.setUniform("my_effect", "intensity", 2.0);
```

### Uniform Types

When defining uniforms, use these types:

- `'1f'` - Float
- `'2f'` - Vec2 (array of 2 floats)
- `'3f'` - Vec3 (array of 3 floats)
- `'1i'` - Integer
- `'mat4'` - Matrix4 (Float32Array)
- `'tex2D'` - Texture2D (WebGLTexture)

### Auto-Injected Uniforms

These uniforms are automatically available in your shader (if you declare them):

- `u_time` (float) - Current time in seconds
- `u_delta` (float) - Frame delta time
- `u_resolution` (vec2) - Screen resolution [width, height]
- `u_aspect` (float) - Aspect ratio (width/height)
- `u_frame` (float) - Frame number
- `u_intensity` (float) - Effect intensity (default: 1.0)

**Example shader using auto-uniforms**:

```glsl
#version 300 es
precision mediump float;

in vec2 v_texCoord;
uniform sampler2D u_image;
uniform float u_time;        // Auto-injected
uniform vec2 u_resolution;   // Auto-injected

out vec4 outColor;

void main() {
    vec4 color = texture(u_image, v_texCoord);
    
    // Pulsing effect using time
    float pulse = sin(u_time * 2.0) * 0.5 + 0.5;
    color.rgb *= (0.8 + pulse * 0.2);
    
    outColor = color;
}
```

---

## Advanced Usage

### Effect Chaining

Effects are automatically chained using ping-pong framebuffers. The system handles intermediate buffers for you:

```javascript
// Enable multiple effects - they'll chain automatically
pp.enableEffect("blur");        // Applied first (priority 10)
pp.enableEffect("grayscale");   // Applied second (priority 20)
pp.enableEffect("contrast");    // Applied last (priority 100)

// Pipeline: Scene → Blur → Grayscale → Contrast → Screen
```

### Conditional Effects

```javascript
const pp = engine.renderer.postProcessing;

// Enable effects based on game state
if (player.isInjured()) {
    pp.enableEffect("grayscale");
} else {
    pp.disableEffect("grayscale");
}

if (player.isInSlowMotion()) {
    pp.enableEffect("blur");
} else {
    pp.disableEffect("blur");
}
```

### Dynamic Uniform Updates

```javascript
const pp = engine.renderer.postProcessing;

// Update uniforms every frame for animated effects
update(dt) {
    if (pp.activeEffects.includes("crt")) {
        pp.setUniform("crt", "time", performance.now() / 1000);
    }
    
    // Animate blur intensity
    if (pp.activeEffects.includes("blur")) {
        const blurAmount = Math.sin(performance.now() / 1000) * 0.5 + 0.5;
        // Note: Blur doesn't have an intensity uniform by default,
        // but you could modify the shader to add one
    }
}
```

---

## Performance Considerations

### MSAA

Post-processing works with MSAA render targets. Enable MSAA for smoother edges:

```javascript
new Engine("gameCanvas", game, 1920, 1080, true, true, {
    renderer: {
        webglVersion: 2,
        renderTargets: {
            msaaSamples: 4,  // 4x MSAA
        },
    },
});
```

### Effect Count

- Each active effect adds one full-screen pass
- Multiple effects = multiple passes
- Consider disabling effects when not needed
- Use priority to optimize (expensive effects last)

### Resolution

Post-processing operates at the renderer's target resolution. Lower resolutions = better performance:

```javascript
// Lower resolution for better performance
new Engine("gameCanvas", game, 1280, 720, true, true, {
    // ...
});
```

---

## Troubleshooting

### Post-Processing Not Working

1. **Check if enabled**: Ensure 4th parameter is `true` in Engine constructor
2. **Check readiness**: Verify `pp.isReady === true` before using
3. **Check WebGL version**: Some effects require WebGL2

```javascript
const pp = engine.renderer.postProcessing;
if (!pp) {
    console.error("Post-processing not initialized");
}
if (!pp.isReady) {
    console.warn("Post-processing not ready yet");
}
```

### Effects Not Visible

1. **Check active effects**: `console.log(pp.activeEffects)`
2. **Check priority**: Effects might be overwriting each other
3. **Check uniforms**: Some effects need uniforms set (e.g., `crt` needs `time`)

### Custom Effect Not Loading

1. **Check shader path**: Use relative paths from your HTML file
2. **Check shader syntax**: Ensure WebGL2 shaders use `#version 300 es`
3. **Check uniform types**: Match uniform types exactly
4. **Check console**: Look for shader compilation errors

---

## API Reference

### PostProcessing Class

#### Methods

- `enableEffect(name: string)` - Enable an effect
- `disableEffect(name: string)` - Disable an effect
- `clearEffects()` - Disable all effects
- `setUniform(effectName: string, uniformName: string, value: any)` - Set effect uniform
- `setEffectPriority(effectName: string, priority: number)` - Set effect priority
- `loadEffect(name, fragmentShaderPath, uniforms, options)` - Load custom effect
- `resize(width, height)` - Resize post-processing buffers (auto-called)

#### Properties

- `isReady: boolean` - Whether post-processing is initialized
- `activeEffects: string[]` - List of currently active effects
- `effects: Map<string, Effect>` - Map of all loaded effects
- `width: number` - Current buffer width
- `height: number` - Current buffer height

---

## Summary

The Fluxion-Js post-processing system provides:

✅ **Easy-to-use API** for enabling/disabling effects  
✅ **Built-in effects** (blur, grayscale, CRT, contrast, screen-space shadows)  
✅ **Priority-based chaining** for effect ordering  
✅ **Custom effect support** via shader loading  
✅ **Auto-injected uniforms** (time, resolution, aspect, etc.)  
✅ **Ping-pong framebuffers** for efficient multi-pass rendering  
✅ **WebGL1 and WebGL2 support** (with some WebGL2-only features)  

The system is production-ready and can be used to create cinematic effects, visual filters, and screen-space enhancements for your games!

