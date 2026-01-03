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
  getGPUInfo: () => ipcRenderer.invoke('get-gpu-info'),

  // Asset browser helpers (dev workflow). Returns {ok, path, entries, error?}.
  listProjectDir: (relativePath) => ipcRenderer.invoke('list-project-dir', relativePath),

  // Workspace root (lets the editor browse/load files outside this repo)
  setWorkspaceRoot: (absolutePath) => ipcRenderer.invoke('set-workspace-root', absolutePath),
  getWorkspaceRoot: () => ipcRenderer.invoke('get-workspace-root'),

  // Project creation helpers (editor workflow)
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  createProject: (opts) => ipcRenderer.invoke('create-fluxion-project', opts),

  // Version helpers (About dialog)
  getVersions: () => ipcRenderer.invoke('get-versions')
}); 