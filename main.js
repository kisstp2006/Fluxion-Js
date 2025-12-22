const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");

let mainWindow;
const iconPath = "./Fluxion/Icon/Fluxion_icon.ico";

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.commandLine.appendSwitch("enable-gpu-rasterization");
  app.commandLine.appendSwitch("ignore-gpu-blacklist");

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

    mainWindow.loadFile("./Examples/AnimationTest/index.html");
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
} 