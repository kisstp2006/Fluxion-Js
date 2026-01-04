const { app, BrowserWindow, ipcMain, dialog, protocol, shell } = require("electron");
const path = require("path");
const fs = require("fs");

// Must be called BEFORE app is ready.
// This enables Chromium features (like fetch()) for our custom scheme.
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'fluxion',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

function parseNpmVersionFromEnv() {
  try {
    const ua = String(process.env.npm_config_user_agent || '');
    const m = /npm\/(\d+(?:\.\d+){0,3})/i.exec(ua);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

function readFluxionEngineVersion() {
  try {
    const p = path.join(__dirname, 'Fluxion', 'version.py');
    const txt = fs.readFileSync(p, 'utf8');
    const get = (key) => {
      const re = new RegExp(`^\\s*${key}\\s*=\\s*\"([^\"]*)\"`, 'm');
      const m = re.exec(txt);
      return m ? m[1] : null;
    };
    return {
      name: get('ENGINE_NAME'),
      version: get('VERSION'),
      codename: get('CODENAME'),
      license: get('LICENSE'),
    };
  } catch {
    return { name: null, version: null, codename: null, license: null };
  }
}

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

function safeProjectFilenameFromName(name) {
  const base = String(name || '').trim() || 'MyGame';
  // Windows-safe filename characters; keep it simple.
  const cleaned = base
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, '')
    .replace(/\.+$/g, '');
  const out = cleaned || 'MyGame';
  return out.length > 64 ? out.slice(0, 64) : out;
}

let mainWindow;
const iconPath = "./Fluxion/Icon/Fluxion_icon.ico";

// Filesystem root used by the editor for browsing/loading assets.
// Defaults to this repo, but can be changed to any folder via IPC.
let workspaceRootAbs = path.resolve(__dirname);

function setWorkspaceRootAbs(p) {
  workspaceRootAbs = path.resolve(String(p || __dirname));
}

function getWorkspaceRootAbs() {
  return workspaceRootAbs;
}

function resolveUnderWorkspace(relPathFromUrl) {
  const rel = String(relPathFromUrl || '').replace(/^\/+/, '');
  // URL paths always use '/'
  const relFs = rel.split('/').join(path.sep);
  const abs = path.resolve(getWorkspaceRootAbs(), relFs);
  const relCheck = path.relative(getWorkspaceRootAbs(), abs);
  const inside = (relCheck === '' || (!relCheck.startsWith('..') && !path.isAbsolute(relCheck)));
  return inside ? abs : null;
}

function resolveWorkspaceRelPath(relativePath) {
  const projectRoot = getWorkspaceRootAbs();
  const relIn = String(relativePath ?? '.');
  const abs = path.resolve(projectRoot, relIn);
  const rel = path.relative(projectRoot, abs);
  const isInside = rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
  return isInside ? abs : null;
}

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
    // Allow loading arbitrary files from the selected workspace folder via fetch/Image.
    // Example: fluxion://workspace/Scenes/scene.xml
    protocol.registerFileProtocol('fluxion', (request, callback) => {
      try {
        const u = new URL(request.url);
        if (u.hostname !== 'workspace') return callback({ error: -6 });
        const decodedPath = decodeURIComponent(u.pathname || '');
        const abs = resolveUnderWorkspace(decodedPath);
        if (!abs) return callback({ error: -6 });
        return callback({ path: abs });
      } catch (err) {
        return callback({ error: -324 });
      }
    });

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

      const projectRoot = getWorkspaceRootAbs();
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

  // Runtime/app version info for About dialog.
  ipcMain.handle('get-versions', async () => {
    try {
      const pkgPath = path.join(__dirname, 'package.json');
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      const engine = readFluxionEngineVersion();
      return {
        ok: true,
        app: {
          name: pkg && pkg.name ? String(pkg.name) : null,
          version: pkg && pkg.version ? String(pkg.version) : null,
        },
        electron: process.versions.electron || null,
        chrome: process.versions.chrome || null,
        node: process.versions.node || null,
        v8: process.versions.v8 || null,
        npm: parseNpmVersionFromEnv(),
        engine,
      };
    } catch (err) {
      return { ok: false, error: String(err && err.message ? err.message : err) };
    }
  });

  // List a directory inside the project root (dev workflow).
  // Returns {ok, path, entries, error?} where path is normalized with forward slashes.
  ipcMain.handle('list-project-dir', async (event, relativePath) => {
    try {
      const projectRoot = getWorkspaceRootAbs();
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

  // Open a file/folder with the OS default application.
  ipcMain.handle('open-project-path-external', async (event, relativePath) => {
    try {
      const abs = resolveWorkspaceRelPath(relativePath);
      if (!abs) return { ok: false, error: 'Refusing to open outside workspace root.' };
      const st = await fs.promises.stat(abs);
      if (!st.isFile() && !st.isDirectory()) return { ok: false, error: 'Target is not a file or directory.' };
      const res = await shell.openPath(abs);
      if (res) return { ok: false, error: String(res) };
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err && err.message ? err.message : err) };
    }
  });

  // Reveal a file in explorer, or open a folder in explorer.
  ipcMain.handle('reveal-project-path-in-explorer', async (event, payload) => {
    try {
      const p = (payload && typeof payload === 'object') ? payload : {};
      const relPath = String(p.relativePath ?? '');
      const isDir = !!p.isDir;
      const abs = resolveWorkspaceRelPath(relPath);
      if (!abs) return { ok: false, error: 'Refusing to reveal outside workspace root.' };
      const st = await fs.promises.stat(abs);
      if (isDir || st.isDirectory()) {
        const res = await shell.openPath(abs);
        if (res) return { ok: false, error: String(res) };
        return { ok: true };
      }

      shell.showItemInFolder(abs);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err && err.message ? err.message : err) };
    }
  });

  // Delete a file or folder under the workspace root.
  ipcMain.handle('delete-project-path', async (event, relativePath) => {
    try {
      const abs = resolveWorkspaceRelPath(relativePath);
      if (!abs) return { ok: false, error: 'Refusing to delete outside workspace root.' };
      const rel = String(relativePath ?? '');
      if (rel === '' || rel === '.' || rel === '/') {
        return { ok: false, error: 'Refusing to delete workspace root.' };
      }

      // Ensure the target exists before attempting rm.
      await fs.promises.stat(abs);
      await fs.promises.rm(abs, { recursive: true, force: true });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err && err.message ? err.message : err) };
    }
  });

  // Rename a file or folder under the workspace root (same directory).
  // payload: { relativePath: string, newName: string }
  ipcMain.handle('rename-project-path', async (event, payload) => {
    try {
      const p = (payload && typeof payload === 'object') ? payload : {};
      const relPath = String(p.relativePath ?? '');
      const newNameIn = String(p.newName ?? '');
      const newName = newNameIn.trim();

      if (!relPath || relPath === '.' || relPath === '/') {
        return { ok: false, error: 'Missing or invalid source path.' };
      }

      if (!newName) {
        return { ok: false, error: 'Missing new name.' };
      }

      // Disallow path separators / traversal. Rename is only within the same directory.
      if (newName.includes('/') || newName.includes('\\') || newName.includes(path.sep)) {
        return { ok: false, error: 'New name must not contain path separators.' };
      }
      if (newName === '.' || newName === '..' || newName.includes('..')) {
        return { ok: false, error: 'Invalid new name.' };
      }

      // Basic Windows-invalid characters.
      if (/[\\/:*?"<>|]/.test(newName)) {
        return { ok: false, error: 'New name contains invalid characters.' };
      }

      const srcAbs = resolveWorkspaceRelPath(relPath);
      if (!srcAbs) return { ok: false, error: 'Refusing to rename outside workspace root.' };

      const projectRoot = getWorkspaceRootAbs();
      const srcSt = await fs.promises.stat(srcAbs);
      if (!srcSt.isFile() && !srcSt.isDirectory()) {
        return { ok: false, error: 'Source is not a file or directory.' };
      }

      const dstAbs = path.resolve(path.dirname(srcAbs), newName);
      const dstRelCheck = path.relative(projectRoot, dstAbs);
      const dstInside = dstRelCheck === '' || (!dstRelCheck.startsWith('..') && !path.isAbsolute(dstRelCheck));
      if (!dstInside) {
        return { ok: false, error: 'Refusing to rename outside workspace root.' };
      }

      if (fs.existsSync(dstAbs)) {
        return { ok: false, error: 'Destination already exists.' };
      }

      await fs.promises.rename(srcAbs, dstAbs);
      const outRel = path.relative(projectRoot, dstAbs).split(path.sep).join('/');
      return { ok: true, path: outRel };
    } catch (err) {
      return { ok: false, error: String(err && err.message ? err.message : err) };
    }
  });

  // Copy a file or folder under the workspace root into a destination directory under the workspace root.
  // payload: { srcRelativePath: string, destDirRelativePath: string }
  ipcMain.handle('copy-project-path-to-dir', async (event, payload) => {
    try {
      const p = (payload && typeof payload === 'object') ? payload : {};
      const srcRel = String(p.srcRelativePath ?? '');
      const dstDirRel = String(p.destDirRelativePath ?? '');
      if (!srcRel) return { ok: false, error: 'Missing source path.' };
      if (!dstDirRel) return { ok: false, error: 'Missing destination directory.' };

      const srcAbs = resolveWorkspaceRelPath(srcRel);
      const dstDirAbs = resolveWorkspaceRelPath(dstDirRel);
      if (!srcAbs || !dstDirAbs) return { ok: false, error: 'Refusing to copy outside workspace root.' };

      const srcSt = await fs.promises.stat(srcAbs);
      const dstDirSt = await fs.promises.stat(dstDirAbs);
      if (!dstDirSt.isDirectory()) return { ok: false, error: 'Destination is not a directory.' };
      if (!srcSt.isFile() && !srcSt.isDirectory()) return { ok: false, error: 'Source is not a file or directory.' };

      const dstAbs = path.join(dstDirAbs, path.basename(srcAbs));
      if (fs.existsSync(dstAbs)) {
        return { ok: false, error: 'Destination already contains an item with the same name.' };
      }

      // Node/Electron supports fs.promises.cp on modern versions.
      if (fs.promises.cp) {
        await fs.promises.cp(srcAbs, dstAbs, { recursive: true, errorOnExist: true });
      } else {
        return { ok: false, error: 'Copy is not supported by this runtime.' };
      }

      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err && err.message ? err.message : err) };
    }
  });

  // Switch the workspace root used by list-project-dir and fluxion://workspace/ loading.
  ipcMain.handle('set-workspace-root', async (event, absolutePath) => {
    try {
      const abs = path.resolve(String(absolutePath || ''));
      if (!abs) return { ok: false, error: 'Missing path.' };
      const st = await fs.promises.stat(abs);
      if (!st.isDirectory()) return { ok: false, error: 'Selected path is not a directory.' };
      setWorkspaceRootAbs(abs);
      return { ok: true, path: getWorkspaceRootAbs() };
    } catch (err) {
      return { ok: false, error: String(err && err.message ? err.message : err) };
    }
  });

  ipcMain.handle('get-workspace-root', async () => {
    try {
      return { ok: true, path: getWorkspaceRootAbs() };
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
  // opts: { parentDir: string, name: string, template?: string, force?: boolean }
  ipcMain.handle('create-fluxion-project', async (event, opts) => {
    try {
      if (app.isPackaged) {
        return { ok: false, error: 'App is packaged; project generation is disabled.' };
      }

      const o = (opts && typeof opts === 'object') ? opts : {};
      const parentDir = path.resolve(String(o.parentDir || ''));
      const name = String(o.name || '').trim();
      const template = String(o.template || 'empty').trim() || 'empty';
      const force = !!o.force;
      if (!parentDir || !name) return { ok: false, error: 'Missing parentDir or name.' };

      const targetDir = path.join(parentDir, name);

      // Template is plumbed for future expansion.
      // Current supported templates: 'empty' (default)
      void template;

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

      const engine = readFluxionEngineVersion();

      writeFile(path.join(targetDir, 'fluxion.project.json'), JSON.stringify({
        name,
        creator: '',
        resolution: { width: 1280, height: 720 },
        engineVersion: String(engine && engine.version ? engine.version : ''),
        mainScene: './scene.xml'
      }, null, 2) + '\n');

      // New project descriptor format (JSON content, .flux extension)
      const fluxName = safeProjectFilenameFromName(name) + '.flux';
      writeFile(path.join(targetDir, fluxName), JSON.stringify({
        name,
        creator: '',
        resolution: { width: 1280, height: 720 },
        engineVersion: String(engine && engine.version ? engine.version : ''),
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