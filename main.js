const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");

function normSlashes(p) {
  return String(p || '').split(path.sep).join('/');
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function isEmptyDir(dir) {
  if (!fs.existsSync(dir)) return true;
  const entries = fs.readdirSync(dir);
  return entries.length === 0;
}

function writeFile(filePath, content) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, String(content ?? ''), 'utf8');
}

let mainWindow;
const iconPath = "./Fluxion/Icon/Fluxion_icon.ico";

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  // Enable GPU acceleration
  app.commandLine.appendSwitch("enable-gpu-rasterization");
  app.commandLine.appendSwitch("ignore-gpu-blacklist");
  app.commandLine.appendSwitch("enable-webgl");
  app.commandLine.appendSwitch("enable-webgl2-compute-context");
  app.commandLine.appendSwitch("disable-gpu-driver-bug-workarounds");
  app.commandLine.appendSwitch("enable-accelerated-2d-canvas");
  app.commandLine.appendSwitch("enable-zero-copy");

  app.whenReady().then(() => {
    mainWindow = new BrowserWindow({
      icon: iconPath,
      width: 1280,
      height: 720,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        enableRemoteModule: false,
        devTools: true, // Enable dev tools for debugging
        spellcheck: false,
        accessibleTitle: false,
        preload: path.join(__dirname, "preload.js"),
      },
    });

    mainWindow.setMenuBarVisibility(false); // Hide the menu bar
    mainWindow.setTitle("Fluxion"); // Title for the game window

    mainWindow.on("closed", () => {
      mainWindow = null;
    });

    mainWindow.loadFile("./Examples/BasicEditor/index.html");
  });

  // Window Management IPC Handlers
  ipcMain.on("set-title", (event, title) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) win.setTitle(title);
  });

  ipcMain.on("window-fullscreen", (event, flag) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) win.setFullScreen(flag);
  });

  ipcMain.on("window-minimize", (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) win.minimize();
  });

  ipcMain.on("window-maximize", (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
        if (win.isMaximized()) {
            win.unmaximize();
        } else {
            win.maximize();
        }
    }
  });

  ipcMain.on("window-close", (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) win.close();
  });

  ipcMain.on("window-resize", (event, width, height) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) win.setSize(width, height);
  });

  ipcMain.on("save-debug-file", (event, filename, content) => {
    const filePath = path.join(app.getPath("userData"), "Debug", filename);
    const dir = path.dirname(filePath);
    
    if (!fs.existsSync(dir)){
        fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFile(filePath, content, (err) => {
        if (err) {
            console.error("Failed to save debug file:", err);
        } else {
            console.log("Debug file saved to:", filePath);
            // Optionally notify renderer
        }
    });
  });

  // Save a file inside the project directory (dev workflow).
  // This is used by importers (e.g., GLTF) to emit metadata next to assets.
  ipcMain.handle('save-project-file', async (event, absolutePath, content) => {
    try {
      if (app.isPackaged) {
        return { ok: false, error: 'App is packaged; project directory is not writable. Use Debug output instead.' };
      }

      const projectRoot = path.resolve(__dirname);
      const targetPath = path.resolve(String(absolutePath || ''));

      // Basic path traversal protection: only allow writes under the project root.
      const rel = path.relative(projectRoot, targetPath);
      const isInside = rel && !rel.startsWith('..') && !path.isAbsolute(rel);
      if (!isInside) {
        return { ok: false, error: `Refusing to write outside project root: ${projectRoot}` };
      }

      const dir = path.dirname(targetPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      await fs.promises.writeFile(targetPath, String(content ?? ''), 'utf8');
      console.log('Project file saved to:', targetPath);
      return { ok: true, path: targetPath };
    } catch (err) {
      console.error('Failed to save project file:', err);
      return { ok: false, error: String(err && err.message ? err.message : err) };
    }
  });

  // GPU Acceleration Info
  ipcMain.handle("get-gpu-info", async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      const gpuInfo = await app.getGPUFeatureStatus();
      return gpuInfo;
    }
    return null;
  });

  // List a directory inside the project root (dev workflow).
  // Returns {ok, path, entries, error?} where path is normalized with forward slashes.
  ipcMain.handle('list-project-dir', async (event, relativePath) => {
    try {
      const projectRoot = path.resolve(__dirname);
      const relIn = String(relativePath ?? '.');
      const abs = path.resolve(projectRoot, relIn);

      // Path traversal protection: only allow reads under the project root.
      const rel = path.relative(projectRoot, abs);
      const isInside = rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
      if (!isInside) {
        return { ok: false, error: `Refusing to read outside project root: ${projectRoot}` };
      }

      const st = await fs.promises.stat(abs);
      if (!st.isDirectory()) {
        return { ok: false, error: 'Target is not a directory.' };
      }

      const dirents = await fs.promises.readdir(abs, { withFileTypes: true });
      const entries = [];

      for (const d of dirents) {
        const name = d.name;
        // Skip noisy folders by default.
        if (name === 'node_modules' || name === '.git') continue;

        const childAbs = path.join(abs, name);
        const childRel = path.relative(projectRoot, childAbs).split(path.sep).join('/');

        let size = 0;
        if (!d.isDirectory()) {
          try {
            const s = await fs.promises.stat(childAbs);
            size = Number(s.size) || 0;
          } catch {}
        }

        entries.push({
          name,
          path: childRel,
          isDir: d.isDirectory(),
          size
        });
      }

      entries.sort((a, b) => {
        if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

      const outPath = (rel === '' ? '.' : rel).split(path.sep).join('/');
      return { ok: true, path: outPath, entries };
    } catch (err) {
      return { ok: false, error: String(err && err.message ? err.message : err) };
    }
  });

  // Pick a folder on disk (OS-native dialog).
  ipcMain.handle('select-folder', async (event) => {
    try {
      const win = BrowserWindow.fromWebContents(event.sender);
      const res = await dialog.showOpenDialog(win || undefined, {
        title: 'Select Folder',
        properties: ['openDirectory', 'createDirectory'],
      });
      if (res.canceled || !res.filePaths || res.filePaths.length === 0) {
        return { ok: true, canceled: true };
      }

      const projectRoot = path.resolve(__dirname);
      const pickedAbs = path.resolve(String(res.filePaths[0]));

      // Provide renderer a safe relative path when the selection is within the project root.
      const rel = path.relative(projectRoot, pickedAbs);
      const insideProjectRoot = (rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel)));
      const projectRel = insideProjectRoot ? normSlashes(rel || '.') : null;

      return {
        ok: true,
        canceled: false,
        path: pickedAbs,
        insideProjectRoot,
        projectRel,
      };
    } catch (err) {
      return { ok: false, error: String(err && err.message ? err.message : err) };
    }
  });

  // Create a new Fluxion project in a chosen folder.
  // opts: { parentDir: string, name: string, force?: boolean }
  ipcMain.handle('create-fluxion-project', async (event, opts) => {
    try {
      if (app.isPackaged) {
        return { ok: false, error: 'App is packaged; project generation is disabled.' };
      }

      const o = (opts && typeof opts === 'object') ? opts : {};
      const parentDir = path.resolve(String(o.parentDir || ''));
      const name = String(o.name || '').trim();
      const force = !!o.force;
      if (!parentDir || !name) return { ok: false, error: 'Missing parentDir or name.' };

      const targetDir = path.join(parentDir, name);

      if (fs.existsSync(targetDir) && !isEmptyDir(targetDir) && !force) {
        return { ok: false, error: 'Target folder is not empty. Choose another name or enable force.' };
      }

      ensureDir(targetDir);

      const engineRoot = path.resolve(__dirname);
      const relEngine = path.relative(targetDir, engineRoot) || '.';
      const engineDep = `file:${normSlashes(relEngine)}`;
      const safePkgName = name.toLowerCase().replace(/\s+/g, '-');

      const pkg = {
        name: safePkgName,
        version: '0.1.0',
        private: true,
        main: 'main.js',
        type: 'commonjs',
        scripts: {
          start: 'electron .'
        },
        dependencies: {
          "gl-matrix": '^3.4.4',
          "fluxionwebengine": engineDep
        },
        devDependencies: {
          electron: '^35.0.1'
        }
      };

      writeFile(path.join(targetDir, 'package.json'), JSON.stringify(pkg, null, 2) + '\n');

      writeFile(path.join(targetDir, 'main.js'), `const { app, BrowserWindow } = require('electron');\nconst path = require('path');\n\nlet win;\n\napp.whenReady().then(() => {\n  win = new BrowserWindow({\n    width: 1280,\n    height: 720,\n    webPreferences: {\n      nodeIntegration: false,\n      contextIsolation: true,\n      preload: path.join(__dirname, 'preload.js'),\n    },\n  });\n\n  win.setMenuBarVisibility(false);\n  win.setTitle(${JSON.stringify(name)});\n  win.loadFile(path.join(__dirname, 'index.html'));\n});\n\napp.on('window-all-closed', () => {\n  if (process.platform !== 'darwin') app.quit();\n});\n`);

      writeFile(path.join(targetDir, 'preload.js'), `const { contextBridge } = require('electron');\n\ncontextBridge.exposeInMainWorld('fluxionProject', {\n  name: ${JSON.stringify(name)},\n});\n`);

      writeFile(path.join(targetDir, 'fluxion.project.json'), JSON.stringify({
        name,
        mainScene: './scene.xml'
      }, null, 2) + '\n');

      writeFile(path.join(targetDir, 'scene.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<Scene name="Main">\n  <Camera x="0" y="0" zoom="1" rotation="0" width="1280" height="720" />\n</Scene>\n`);

      writeFile(path.join(targetDir, 'index.html'), `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8" />\n  <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n  <title>${name.replace(/</g, '&lt;')}</title>\n  <style>\n    html, body { height: 100%; margin: 0; background: #111; overflow: hidden; }\n    canvas { width: 100%; height: 100%; display: block; }\n  </style>\n  <script type="importmap">\n  {\n    "imports": {\n      "gl-matrix": "./node_modules/gl-matrix/esm/index.js",\n      "fluxion": "./node_modules/fluxionwebengine/Fluxion/index.js"\n    }\n  }\n  </script>\n</head>\n<body>\n  <canvas id="gameCanvas"></canvas>\n  <script type="module" src="src/game.js"></script>\n</body>\n</html>\n`);

      writeFile(path.join(targetDir, 'src', 'game.js'), `// @ts-check\n\nimport { Engine, SceneLoader } from 'fluxion';\n\nconst canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('gameCanvas'));\nconst engine = new Engine(canvas);\nconst renderer = engine.renderer;\n\nasync function main() {\n  const scene = await SceneLoader.load('./scene.xml', renderer);\n  engine.setScene(scene);\n  engine.start();\n}\n\nmain().catch(console.error);\n`);

      writeFile(path.join(targetDir, '.gitignore'), `node_modules\n.DS_Store\ndist\n`);

      return { ok: true, path: targetDir };
    } catch (err) {
      return { ok: false, error: String(err && err.message ? err.message : err) };
    }
  });
} 