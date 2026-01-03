const { app, BrowserWindow } = require('electron');
const path = require('path');

let win;

app.whenReady().then(() => {
  win = new BrowserWindow({
    width: 1280,
    height: 720,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  win.setMenuBarVisibility(false);
  win.setTitle('Generated Test Game');
  win.loadFile(path.join(__dirname, 'index.html'));
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
