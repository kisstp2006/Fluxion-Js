const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");

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

    mainWindow.loadFile("./Examples/Basic3DXaml/index.html");
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
} 