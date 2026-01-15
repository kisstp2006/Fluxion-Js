#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');

function usage() {
  console.log(`\nFluxion project generator\n\nUsage:\n  node packages/tools/create-fluxion-project.js <targetFolder> [--name <ProjectName>] [--engine <engineRoot>] [--force]\n\nExamples:\n  node packages/tools/create-fluxion-project.js C:\\Games\\MyFluxionGame --name MyFluxionGame\n  node packages/tools/create-fluxion-project.js ./MyGame --engine "${path.resolve(__dirname, '..', '..')}"\n`);
}

/** @param {string} p */
function normSlashes(p) {
  return p.split(path.sep).join('/');
}

/** @param {string} dir */
function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

/** @param {string} filePath @param {string} content */
function writeFile(filePath, content) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, 'utf8');
}

function safeProjectFilenameFromName(name) {
  const base = String(name || '').trim() || 'MyGame';
  const cleaned = base
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, '')
    .replace(/\.+$/g, '');
  const out = cleaned || 'MyGame';
  return out.length > 64 ? out.slice(0, 64) : out;
}

function readEngineVersion(engineRoot) {
  try {
    const root = String(engineRoot || '');
    const candidates = [
      path.join(root, 'packages', 'engine', 'Fluxion', 'version.py'),
      path.join(root, 'Fluxion', 'version.py'),
    ];
    const p = candidates.find((fp) => {
      try { return fs.existsSync(fp); } catch { return false; }
    });
    if (!p) return '';
    const txt = fs.readFileSync(p, 'utf8');
    const m = /^\s*VERSION\s*=\s*"([^"]*)"/m.exec(txt);
    return m ? String(m[1] || '') : '';
  } catch {
    return '';
  }
}

/** @param {string} dir */
function isEmptyDir(dir) {
  if (!fs.existsSync(dir)) return true;
  const entries = fs.readdirSync(dir);
  return entries.length === 0;
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
    usage();
    process.exit(args.length === 0 ? 1 : 0);
  }

  const targetArg = args[0];
  let name = null;
  // Default to repo root (packages/tools -> repoRoot)
  let engineRoot = path.resolve(__dirname, '..', '..');
  let force = false;

  for (let i = 1; i < args.length; i++) {
    const a = args[i];
    if (a === '--name') {
      name = args[i + 1] ?? '';
      i++;
      continue;
    }
    if (a === '--engine') {
      engineRoot = path.resolve(String(args[i + 1] ?? ''));
      i++;
      continue;
    }
    if (a === '--force') {
      force = true;
      continue;
    }
  }

  const targetDir = path.resolve(process.cwd(), targetArg);
  const projectName = String(name || path.basename(targetDir));

  if (fs.existsSync(targetDir) && !isEmptyDir(targetDir) && !force) {
    console.error(`Target folder is not empty: ${targetDir}`);
    console.error('Use --force to write anyway.');
    process.exit(2);
  }

  // Compute a file: dependency from the new project to the engine root.
  const relEngine = path.relative(targetDir, engineRoot) || '.';
  const engineDep = `file:${normSlashes(relEngine)}`;

  const engineVersion = readEngineVersion(engineRoot);

  ensureDir(targetDir);

  // Files
  const pkg = {
    name: projectName.toLowerCase().replace(/\s+/g, '-'),
    version: '0.1.0',
    private: true,
    main: 'main.js',
    type: 'commonjs',
    scripts: {
      start: 'electron .',
    },
    dependencies: {
      "gl-matrix": '^3.4.4',
      "fluxionwebengine": engineDep,
    },
    devDependencies: {
      electron: '^35.0.1',
    },
  };

  writeFile(path.join(targetDir, 'package.json'), JSON.stringify(pkg, null, 2) + '\n');

  writeFile(path.join(targetDir, 'main.js'), `const { app, BrowserWindow } = require('electron');\nconst path = require('path');\n\nlet win;\n\napp.whenReady().then(() => {\n  win = new BrowserWindow({\n    width: 1280,\n    height: 720,\n    webPreferences: {\n      nodeIntegration: false,\n      contextIsolation: true,\n      preload: path.join(__dirname, 'preload.js'),\n    },\n  });\n\n  win.setMenuBarVisibility(false);\n  win.setTitle('${projectName.replace(/'/g, "\\'")}');\n  win.loadFile(path.join(__dirname, 'index.html'));\n});\n\napp.on('window-all-closed', () => {\n  if (process.platform !== 'darwin') app.quit();\n});\n`);

  writeFile(path.join(targetDir, 'preload.js'), `const { contextBridge } = require('electron');\n\n// Reserved for future editor APIs.\ncontextBridge.exposeInMainWorld('fluxionProject', {\n  name: '${projectName.replace(/'/g, "\\'")}',\n});\n`);

  writeFile(path.join(targetDir, 'fluxion.project.json'), JSON.stringify({
    name: projectName,
    creator: '',
    resolution: { width: 1280, height: 720 },
    engineVersion,
    mainScene: './scene.xml',
  }, null, 2) + '\n');

  const fluxName = safeProjectFilenameFromName(projectName) + '.flux';
  writeFile(path.join(targetDir, fluxName), JSON.stringify({
    name: projectName,
    creator: '',
    resolution: { width: 1280, height: 720 },
    engineVersion,
    mainScene: './scene.xml',
  }, null, 2) + '\n');

  writeFile(path.join(targetDir, 'scene.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<Scene name="Main">\n  <Camera x="0" y="0" zoom="1" rotation="0" width="1280" height="720" />\n</Scene>\n`);

  writeFile(path.join(targetDir, 'index.html'), `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8" />\n  <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n  <title>${projectName.replace(/</g, '&lt;')}</title>\n  <style>\n    html, body { height: 100%; margin: 0; background: #111; overflow: hidden; }\n    canvas { width: 100%; height: 100%; display: block; }\n  </style>\n  <script type="importmap">\n  {\n    "imports": {\n      "gl-matrix": "./node_modules/gl-matrix/esm/index.js",\n      "fluxion": "./node_modules/fluxionwebengine/packages/engine/Fluxion/index.js"\n    }\n  }\n  </script>\n</head>\n<body>\n  <canvas id="gameCanvas"></canvas>\n  <script type="module" src="src/game.js"></script>\n</body>\n</html>\n`);

  writeFile(path.join(targetDir, 'src', 'game.js'), `// @ts-check\n\nimport { Engine, SceneLoader } from 'fluxion';\n\nconst canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('gameCanvas'));\n\n// Minimal game bootstrap\nconst engine = new Engine(canvas);\nconst renderer = engine.renderer;\n\nasync function main() {\n  // Load the project main scene\n  const scene = await SceneLoader.load('./scene.xml', renderer);\n  engine.setScene(scene);\n  engine.start();\n}\n\nmain().catch(console.error);\n`);

  writeFile(path.join(targetDir, '.gitignore'), `node_modules\n.DS_Store\ndist\n`);

  console.log(`\nCreated Fluxion project in: ${targetDir}`);
  console.log(`Engine dependency: ${engineDep}`);
  console.log('\nNext:');
  console.log(`  cd "${targetDir}"`);
  console.log('  npm install');
  console.log('  npm start');
}

main();
