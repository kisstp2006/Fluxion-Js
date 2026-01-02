// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  setTitle: (title) => ipcRenderer.send('set-title', title),
  setFullScreen: (flag) => ipcRenderer.send('window-fullscreen', flag),
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  resize: (width, height) => ipcRenderer.send('window-resize', width, height),
  saveDebugFile: (filename, content) => ipcRenderer.send('save-debug-file', filename, content),
  // Writes an absolute path within the project folder (dev mode). Returns {ok, path?, error?}.
  saveProjectFile: (absolutePath, content) => ipcRenderer.invoke('save-project-file', absolutePath, content),
  getGPUInfo: () => ipcRenderer.invoke('get-gpu-info')
}); 