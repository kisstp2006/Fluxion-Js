# WebGL Context (WebGL2 / WebGL1 / Fallback)

Fluxion’s renderer prefers **WebGL2** by default and falls back to **WebGL1** if WebGL2 isn’t available.

## Default behavior

```js
const engine = new Engine("gameCanvas", game);
console.log(engine.renderer.webglContextName, engine.renderer.isWebGL2);
```

## Choosing WebGL version

Pass `options.renderer` to the `Engine` constructor:

```js
const engine = new Engine("gameCanvas", game, 1920, 1080, true, false, {
  renderer: {
    webglVersion: 2, // 2 | 1 | 'webgl2' | 'webgl1' | 'auto'
    allowFallback: true,
  },
});
```

## Better render targets (WebGL2)

When running on WebGL2, Fluxion can use more capable offscreen render targets for post-processing (sized formats, depth-stencil attachment, and optional MSAA + resolve).

Enable MSAA for the post-processing input target:

```js
const engine = new Engine("gameCanvas", game, 1920, 1080, true, true, {
  renderer: {
    webglVersion: 2,
    allowFallback: true,
    renderTargets: {
      msaaSamples: 4, // 0 disables MSAA
    },
  },
});
```

## Useful runtime flags

- `engine.renderer.isWebGL2` (boolean)
- `engine.renderer.webglContextName` (`webgl2`, `webgl`, `experimental-webgl`, or null)
