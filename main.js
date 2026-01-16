const { app, BrowserWindow, ipcMain, dialog, protocol, shell, screen } = require("electron");
const path = require("path");
const fs = require("fs");

function getWindowStateFilePath() {
  try {
    return path.join(app.getPath('userData'), 'window-state.json');
  } catch {
    return path.join(__dirname, '.window-state.json');
  }
}

function readWindowState() {
  const fallback = {
    width: 1280,
    height: 720,
    x: undefined,
    y: undefined,
    isMaximized: false,
    isFullScreen: false,
  };

  try {
    const fp = getWindowStateFilePath();
    if (!fs.existsSync(fp)) return fallback;
    const raw = fs.readFileSync(fp, 'utf8');
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== 'object') return fallback;

    const width = Math.max(640, Number(parsed.width) || fallback.width);
    const height = Math.max(360, Number(parsed.height) || fallback.height);
    const x = Number.isFinite(Number(parsed.x)) ? Number(parsed.x) : undefined;
    const y = Number.isFinite(Number(parsed.y)) ? Number(parsed.y) : undefined;
    const isMaximized = !!parsed.isMaximized;
    const isFullScreen = !!parsed.isFullScreen;

    return { width, height, x, y, isMaximized, isFullScreen };
  } catch {
    return fallback;
  }
}

/**
 * Ensure restored window bounds are visible on at least one display.
 * @param {{x?: number, y?: number, width: number, height: number}} state
 */
function sanitizeWindowState(state) {
  try {
    // If we don't have a position, let Electron decide.
    if (!Number.isFinite(state.x) || !Number.isFinite(state.y)) return state;

    const bounds = {
      x: Number(state.x),
      y: Number(state.y),
      width: Number(state.width),
      height: Number(state.height),
    };

    const displays = screen.getAllDisplays();
    const visible = displays.some((d) => {
      const wa = d.workArea || d.bounds;
      // Require at least a small overlap so the window isn't entirely off-screen.
      const overlapW = Math.min(bounds.x + bounds.width, wa.x + wa.width) - Math.max(bounds.x, wa.x);
      const overlapH = Math.min(bounds.y + bounds.height, wa.y + wa.height) - Math.max(bounds.y, wa.y);
      return overlapW >= 64 && overlapH >= 64;
    });

    if (visible) return state;
    return { ...state, x: undefined, y: undefined };
  } catch {
    return state;
  }
}

/** @param {BrowserWindow} win */
function writeWindowState(win) {
  try {
    if (!win || win.isDestroyed()) return;

    const isMaximized = !!win.isMaximized();
    const isFullScreen = !!win.isFullScreen();
    // If maximized/fullscreen, normalBounds gives the last "restored" bounds.
    const b = (typeof win.getNormalBounds === 'function') ? win.getNormalBounds() : win.getBounds();
    const payload = {
      x: Number.isFinite(b.x) ? b.x : undefined,
      y: Number.isFinite(b.y) ? b.y : undefined,
      width: Math.max(640, Number(b.width) || 1280),
      height: Math.max(360, Number(b.height) || 720),
      isMaximized,
      isFullScreen,
    };

    const fp = getWindowStateFilePath();
    try { fs.mkdirSync(path.dirname(fp), { recursive: true }); } catch {}
    fs.writeFileSync(fp, JSON.stringify(payload, null, 2), 'utf8');
  } catch {
    // ignore
  }
}

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

function readFluxionEngineVersion(engineRootAbs = __dirname) {
  try {
    const root = path.resolve(String(engineRootAbs || __dirname));
    const candidates = [
      path.join(root, 'packages', 'engine', 'Fluxion', 'version.py'),
      path.join(root, 'Fluxion', 'version.py'),
    ];
    const p = candidates.find((fp) => {
      try {
        return fs.existsSync(fp);
      } catch {
        return false;
      }
    });
    if (!p) throw new Error('version.py not found');
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

function resolveFluxionInstall(enginePathAbs) {
  const p = path.resolve(String(enginePathAbs || __dirname));

  // Accept either (new or legacy layouts):
  // - engine root folder that contains packages/engine/Fluxion
  // - engine root folder that contains Fluxion (legacy)
  // - a direct path to the Fluxion folder itself
  const asMonorepoRoot = path.join(p, 'packages', 'engine', 'Fluxion');
  const asLegacyRoot = path.join(p, 'Fluxion');
  const rootHasFluxion = (() => {
    try {
      return fs.statSync(asMonorepoRoot).isDirectory() || fs.statSync(asLegacyRoot).isDirectory();
    } catch {
      return false;
    }
  })();

  const isFluxionFolder = (() => {
    try {
      if (!fs.statSync(p).isDirectory()) return false;
      const hasIndex = fs.existsSync(path.join(p, 'index.js'));
      const hasVer = fs.existsSync(path.join(p, 'version.py'));
      return hasIndex && hasVer;
    } catch {
      return false;
    }
  })();

  if (rootHasFluxion) {
    const fluxionDirAbs = (() => {
      try {
        if (fs.statSync(asMonorepoRoot).isDirectory()) return asMonorepoRoot;
      } catch { /* ignore */ }
      return asLegacyRoot;
    })();
    return { engineRootAbs: p, fluxionDirAbs };
  }
  if (isFluxionFolder) return { engineRootAbs: path.dirname(p), fluxionDirAbs: p };
  return { engineRootAbs: p, fluxionDirAbs: null };
}

function createFluxionDirLink(targetFluxionDirAbs, linkPathAbs) {
  const type = process.platform === 'win32' ? 'junction' : 'dir';
  fs.symlinkSync(String(targetFluxionDirAbs), String(linkPathAbs), type);
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

function pickUniqueDestPath(destDirAbs, filename) {
  const parsed = path.parse(String(filename || ''));
  const baseName = (parsed.name || 'file').replace(/\.+$/g, '');
  const ext = parsed.ext || '';
  let candidate = path.join(destDirAbs, `${baseName}${ext}`);
  if (!fs.existsSync(candidate)) return candidate;
  for (let i = 2; i < 10000; i++) {
    candidate = path.join(destDirAbs, `${baseName}_${i}${ext}`);
    if (!fs.existsSync(candidate)) return candidate;
  }
  return path.join(destDirAbs, `${baseName}_${Date.now()}${ext}`);
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
let animSpritePreviewWindow;
let playPreviewWindow;
const iconPath = "./packages/engine/Fluxion/Icon/Fluxion_icon.ico";

// Filesystem root used by the editor for browsing/loading assets.
// Defaults to this repo, but can be changed to any folder via IPC.
let workspaceRootAbs = path.resolve(__dirname);

function setWorkspaceRootAbs(p) {
  workspaceRootAbs = path.resolve(String(p || __dirname));
}

function getWorkspaceRootAbs() {
  return workspaceRootAbs;
}

/**
 * @param {any} payload
 */
async function openAnimSpritePreviewWindow(payload) {
  // Close existing preview window (simpler UX: one preview at a time).
  try {
    if (animSpritePreviewWindow && !animSpritePreviewWindow.isDestroyed()) {
      animSpritePreviewWindow.close();
    }
  } catch {}

  animSpritePreviewWindow = new BrowserWindow({
    width: 420,
    height: 420,
    useContentSize: true,
    resizable: false,
    minimizable: false,
    maximizable: false,
    alwaysOnTop: true,
    title: 'Animation Preview',
    backgroundColor: '#0b0f14',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      devTools: true,
      spellcheck: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  animSpritePreviewWindow.setMenuBarVisibility(false);

  animSpritePreviewWindow.on('closed', () => {
    animSpritePreviewWindow = null;
  });

  const htmlPath = path.join(__dirname, 'packages', 'editor', 'BasicEditor', 'animSpritePreview.html');
  await animSpritePreviewWindow.loadFile(htmlPath);

  // Send the payload once the renderer is ready.
  try {
    animSpritePreviewWindow.webContents.send('anim-sprite-preview-data', payload);
  } catch {}
}

/**
 * @param {{ title?: string, sceneUrl?: string, resolution?: { width?: number, height?: number } } | any} payload
 */
async function openPlayPreviewWindow(payload) {
  // Close existing play window (one at a time).
  try {
    if (playPreviewWindow && !playPreviewWindow.isDestroyed()) {
      playPreviewWindow.close();
    }
  } catch {}

  playPreviewWindow = new BrowserWindow({
    width: 1100,
    height: 700,
    useContentSize: true,
    resizable: true,
    minimizable: true,
    maximizable: true,
    title: String(payload?.title || 'Play'),
    backgroundColor: '#0b0f14',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      devTools: true,
      spellcheck: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  playPreviewWindow.setMenuBarVisibility(false);

  playPreviewWindow.on('closed', () => {
    playPreviewWindow = null;
  });

  const htmlPath = path.join(__dirname, 'packages', 'editor', 'BasicEditor', 'playPreview.html');
  await playPreviewWindow.loadFile(htmlPath);

  // Send the payload once the renderer is ready.
  try {
    playPreviewWindow.webContents.send('play-preview-data', payload);
  } catch {}
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

    const restored = sanitizeWindowState(readWindowState());

    mainWindow = new BrowserWindow({
      icon: iconPath,
      width: restored.width,
      height: restored.height,
      ...(Number.isFinite(restored.x) ? { x: restored.x } : {}),
      ...(Number.isFinite(restored.y) ? { y: restored.y } : {}),
      frame: false,
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

    // Persist window state on changes + shutdown.
    const persist = () => writeWindowState(mainWindow);
    mainWindow.on('close', persist);
    mainWindow.on('resize', persist);
    mainWindow.on('move', persist);
    mainWindow.on('maximize', persist);
    mainWindow.on('unmaximize', persist);
    mainWindow.on('enter-full-screen', persist);
    mainWindow.on('leave-full-screen', persist);

    // Restore maximized/fullscreen after window is ready.
    mainWindow.once('ready-to-show', () => {
      try {
        if (restored.isMaximized) mainWindow.maximize();
        if (restored.isFullScreen) mainWindow.setFullScreen(true);
      } catch {}
    });

    mainWindow.loadFile("./packages/editor/BasicEditor/index.html");
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

  ipcMain.on('window-set-content-size', (event, width, height) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) win.setContentSize(width, height);
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

  // AnimatedSprite preview window
  ipcMain.handle('open-anim-sprite-preview', async (event, payload) => {
    void event;
    try {
      await openAnimSpritePreviewWindow(payload);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err && err.message ? err.message : err) };
    }
  });

  // Play preview window
  ipcMain.handle('open-play-preview', async (event, payload) => {
    void event;
    try {
      await openPlayPreviewWindow(payload);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err && err.message ? err.message : err) };
    }
  });

  // Export game (first-step stub): create an export folder and write a placeholder manifest.
  // payload: { destDirAbs: string }
  ipcMain.handle('export-game', async (_event, payload) => {
    try {
      if (app.isPackaged) {
        return { ok: false, error: 'App is packaged; export stub is disabled for now.' };
      }

      const destDirAbs = path.resolve(String(payload?.destDirAbs || ''));
      if (!destDirAbs) return { ok: false, error: 'Missing destDirAbs.' };

      const st = await fs.promises.stat(destDirAbs);
      if (!st.isDirectory()) return { ok: false, error: 'Destination is not a directory.' };

      // Create a unique output folder under the destination.
      const outDirAbs = pickUniqueDestPath(destDirAbs, 'ExportedGame');
      await fs.promises.mkdir(outDirAbs, { recursive: true });

      const manifest = {
        kind: 'fluxion-export-stub',
        exportedAt: new Date().toISOString(),
        workspaceRootAbs: getWorkspaceRootAbs(),
        note: 'This is the first step of Export Game. Next steps: copy assets, write project index.html, bundle engine, etc.'
      };

      await fs.promises.writeFile(
        path.join(outDirAbs, 'export-manifest.json'),
        JSON.stringify(manifest, null, 2) + '\n',
        'utf8'
      );

      await fs.promises.writeFile(
        path.join(outDirAbs, 'README_EXPORT.txt'),
        'Export Game is not implemented yet. This folder proves the end-to-end export wiring works.\n',
        'utf8'
      );

      return { ok: true, outputDir: outDirAbs };
    } catch (err) {
      console.error('export-game failed', err);
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

  // Import external OS files into the workspace (copy into a project-relative folder).
  // payload: { files: string[], destDirRelativePath: string }
  ipcMain.handle('import-external-files', async (_event, payload) => {
    try {
      if (app.isPackaged) {
        return { ok: false, error: 'App is packaged; importing into project directory is disabled.' };
      }

      const filesIn = Array.isArray(payload?.files) ? payload.files : [];
      const destRel = String(payload?.destDirRelativePath || '');
      if (filesIn.length === 0) return { ok: false, error: 'No files provided.' };

      const destDirAbs = resolveWorkspaceRelPath(destRel);
      if (!destDirAbs) {
        return { ok: false, error: `Invalid destination folder: ${destRel}` };
      }
      ensureDir(destDirAbs);

      /** @type {{ src: string, destAbs: string, destRel: string }[]} */
      const imported = [];

      for (const srcRaw of filesIn) {
        const src = path.resolve(String(srcRaw || ''));
        if (!src) continue;
        if (!fs.existsSync(src)) continue;
        const st = fs.statSync(src);
        if (!st.isFile()) continue;

        const filename = path.basename(src);
        const destAbs = pickUniqueDestPath(destDirAbs, filename);
        await fs.promises.copyFile(src, destAbs);

        const rel = path.relative(getWorkspaceRootAbs(), destAbs);
        imported.push({ src, destAbs, destRel: normSlashes(rel) });
      }

      return { ok: true, imported };
    } catch (err) {
      console.error('import-external-files failed', err);
      return { ok: false, error: String(err && err.message ? err.message : err) };
    }
  });

  // Create a folder inside the workspace.
  // payload: { dirRelativePath: string }
  ipcMain.handle('create-project-dir', async (_event, payload) => {
    try {
      if (app.isPackaged) {
        return { ok: false, error: 'App is packaged; creating folders in project directory is disabled.' };
      }
      const dirRel = String(payload?.dirRelativePath || '').replace(/^\/+/, '');
      if (!dirRel) return { ok: false, error: 'No directory path provided.' };

      const abs = resolveWorkspaceRelPath(dirRel);
      if (!abs) return { ok: false, error: `Invalid path: ${dirRel}` };

      ensureDir(abs);
      return { ok: true, path: normSlashes(path.relative(getWorkspaceRootAbs(), abs)) };
    } catch (err) {
      console.error('create-project-dir failed', err);
      return { ok: false, error: String(err && err.message ? err.message : err) };
    }
  });

  // Read a UTF-8 text file under the workspace root.
  // relativePath: string
  ipcMain.handle('read-project-text-file', async (_event, relativePath) => {
    try {
      const rel = String(relativePath ?? '').replace(/^\/+/, '');
      if (!rel) return { ok: false, error: 'No file path provided.' };

      const abs = resolveWorkspaceRelPath(rel);
      if (!abs) return { ok: false, error: 'Refusing to read outside workspace root.' };
      const lower = rel.toLowerCase();
      const okText = lower.endsWith('.js') || lower.endsWith('.json') || lower.endsWith('.gltf') || lower.endsWith('.mat') || lower.endsWith('.xml') || lower.endsWith('.xaml') || lower.endsWith('.txt') || lower.endsWith('.md');
      if (!okText) return { ok: false, error: 'Unsupported text file type.' };

      const st = await fs.promises.stat(abs);
      if (!st.isFile()) return { ok: false, error: 'Target is not a file.' };

      const content = await fs.promises.readFile(abs, 'utf8');
      return { ok: true, content: String(content ?? '') };
    } catch (err) {
      return { ok: false, error: String(err && err.message ? err.message : err) };
    }
  });

  // Read a binary file under the workspace root (base64 encoded payload).
  // Intended for .glb inspection from the editor UI.
  // relativePath: string
  ipcMain.handle('read-project-binary-file', async (_event, relativePath) => {
    try {
      const rel = String(relativePath ?? '').replace(/^\/+/, '');
      if (!rel) return { ok: false, error: 'No file path provided.' };

      const abs = resolveWorkspaceRelPath(rel);
      if (!abs) return { ok: false, error: 'Refusing to read outside workspace root.' };
      if (!rel.toLowerCase().endsWith('.glb')) return { ok: false, error: 'Only .glb files are supported.' };

      const st = await fs.promises.stat(abs);
      if (!st.isFile()) return { ok: false, error: 'Target is not a file.' };

      const buf = await fs.promises.readFile(abs);
      return { ok: true, base64: buf.toString('base64') };
    } catch (err) {
      return { ok: false, error: String(err && err.message ? err.message : err) };
    }
  });

  // Write a UTF-8 text file under the workspace root (dev only).
  // payload: { relativePath: string, content: string }
  ipcMain.handle('write-project-text-file', async (_event, payload) => {
    try {
      if (app.isPackaged) {
        return { ok: false, error: 'App is packaged; writing to project directory is disabled.' };
      }

      const rel = String(payload?.relativePath ?? '').replace(/^\/+/, '');
      if (!rel) return { ok: false, error: 'No file path provided.' };

      const lower = rel.toLowerCase();
      const okText = lower.endsWith('.js') || lower.endsWith('.mjs');
      if (!okText) return { ok: false, error: 'Only .js/.mjs files are supported.' };

      const abs = resolveWorkspaceRelPath(rel);
      if (!abs) return { ok: false, error: 'Refusing to write outside workspace root.' };

      // Allow creating new files. If it exists, ensure it's a file.
      try {
        const st = await fs.promises.stat(abs);
        if (!st.isFile()) return { ok: false, error: 'Target is not a file.' };
      } catch (err) {
        const code = String(err && err.code ? err.code : '');
        if (code && code !== 'ENOENT') throw err;
      }

      // Ensure parent directories exist.
      try { await fs.promises.mkdir(path.dirname(abs), { recursive: true }); } catch {}

      await fs.promises.writeFile(abs, String(payload?.content ?? ''), 'utf8');
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

  // Pick a file on disk (OS-native dialog).
  // opts: { title?: string, filters?: Array<{ name: string, extensions: string[] }> }
  ipcMain.handle('select-file', async (event, opts) => {
    try {
      const win = BrowserWindow.fromWebContents(event.sender);
      const o = (opts && typeof opts === 'object') ? opts : {};
      const title = String(o.title || 'Select File');
      const filters = Array.isArray(o.filters) ? o.filters : undefined;

      const res = await dialog.showOpenDialog(win || undefined, {
        title,
        properties: ['openFile'],
        filters,
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
  // opts: { parentDir: string, name: string, template?: string, force?: boolean, engineRoot?: string }
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
      const engineRootIn = String(o.engineRoot || '').trim();
      if (!parentDir || !name) return { ok: false, error: 'Missing parentDir or name.' };

      const targetDir = path.join(parentDir, name);

      // Template is plumbed for future expansion.
      // Current supported templates: 'empty' (default)
      void template;

      if (fs.existsSync(targetDir) && !isEmptyDir(targetDir) && !force) {
        return { ok: false, error: 'Target folder is not empty. Choose another name or enable force.' };
      }

      ensureDir(targetDir);


      const install = resolveFluxionInstall(engineRootIn ? path.resolve(engineRootIn) : path.resolve(__dirname));
      if (!install.fluxionDirAbs) {
        return {
          ok: false,
          error: `Invalid Fluxion install path. Expected either a folder containing "packages/engine/Fluxion/" (new) or "Fluxion/" (legacy), or a direct path to the "Fluxion" folder itself.\n\nGot: ${engineRootIn || path.resolve(__dirname)}`,
        };
      }

      // Link the engine into the project so it is not copied per-project.
      try {
        createFluxionDirLink(install.fluxionDirAbs, path.join(targetDir, 'Fluxion'));
      } catch (err) {
        return {
          ok: false,
          error: `Failed to link Fluxion engine into project.\n\nOn Windows, enable Developer Mode or run with sufficient permissions.\n\nDetails: ${String(err && err.message ? err.message : err)}`,
        };
      }

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
          'gl-matrix': '^3.4.4'
        },
        devDependencies: {
          electron: '^35.0.1'
        }
      };

      writeFile(path.join(targetDir, 'package.json'), JSON.stringify(pkg, null, 2) + '\n');

      writeFile(path.join(targetDir, 'main.js'), `const { app, BrowserWindow } = require('electron');\nconst path = require('path');\n\nlet win;\n\napp.whenReady().then(() => {\n  win = new BrowserWindow({\n    width: 1280,\n    height: 720,\n    webPreferences: {\n      nodeIntegration: false,\n      contextIsolation: true,\n      preload: path.join(__dirname, 'preload.js'),\n    },\n  });\n\n  win.setMenuBarVisibility(false);\n  win.setTitle(${JSON.stringify(name)});\n  win.loadFile(path.join(__dirname, 'index.html'));\n});\n\napp.on('window-all-closed', () => {\n  if (process.platform !== 'darwin') app.quit();\n});\n`);

      writeFile(path.join(targetDir, 'preload.js'), `const { contextBridge } = require('electron');\n\ncontextBridge.exposeInMainWorld('fluxionProject', {\n  name: ${JSON.stringify(name)},\n});\n`);

      const engine = readFluxionEngineVersion(install.engineRootAbs);

      writeFile(path.join(targetDir, 'fluxion.project.json'), JSON.stringify({
        name,
        creator: '',
        resolution: { width: 1280, height: 720 },
        engineVersion: String(engine && engine.version ? engine.version : ''),
        startupScene: './scene.xml'
      }, null, 2) + '\n');

      // New project descriptor format (JSON content, .flux extension)
      const fluxName = safeProjectFilenameFromName(name) + '.flux';
      writeFile(path.join(targetDir, fluxName), JSON.stringify({
        name,
        creator: '',
        resolution: { width: 1280, height: 720 },
        engineVersion: String(engine && engine.version ? engine.version : ''),
        startupScene: './scene.xml'
      }, null, 2) + '\n');

      writeFile(path.join(targetDir, 'scene.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<Scene name="Main">\n  <Camera x="0" y="0" zoom="1" rotation="0" width="1280" height="720" />\n</Scene>\n`);

      writeFile(path.join(targetDir, 'index.html'), `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8" />\n  <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n  <title>${name.replace(/</g, '&lt;')}</title>\n  <style>\n    html, body { height: 100%; margin: 0; background: #111; overflow: hidden; }\n    canvas { width: 100%; height: 100%; display: block; }\n  </style>\n  <script type="importmap">\n  {\n    "imports": {\n      "gl-matrix": "./node_modules/gl-matrix/esm/index.js",\n      "fluxion": "./Fluxion/index.js"\n    }\n  }\n  </script>\n</head>\n<body>\n  <canvas id="gameCanvas"></canvas>\n  <script type="module" src="src/game.js"></script>\n</body>\n</html>\n`);



  writeFile(path.join(targetDir, 'src', 'game.js'), `// @ts-check\n// @fluxion-internal bootstrap\n\nimport { Engine } from 'fluxion';\n\n// New-project bootstrap:\n// - Reads ./fluxion.project.json\n// - Loads its startupScene automatically\n// - Starts the engine loop\nnew Engine('gameCanvas');\n`);

      writeFile(path.join(targetDir, '.gitignore'), `node_modules\n.DS_Store\ndist\n`);

      return { ok: true, path: targetDir };
    } catch (err) {
      return { ok: false, error: String(err && err.message ? err.message : err) };
    }
  });
} 