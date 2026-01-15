// @ts-check

import { Engine, SceneLoader } from 'fluxion';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('gameCanvas'));

// Minimal game bootstrap
const engine = new Engine(canvas);
const renderer = engine.renderer;

async function main() {
  // Load the project main scene
  const scene = await SceneLoader.load('./scene.xml', renderer);
  engine.setScene(scene);
  engine.start();
}

main().catch(console.error);
