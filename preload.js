// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  setTitle: (title) => ipcRenderer.send('set-title', title),
  setFullScreen: (flag) => ipcRenderer.send('window-fullscreen', flag),
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  resize: (width, height) => ipcRenderer.send('window-resize', width, height),
  setContentSize: (width, height) => ipcRenderer.send('window-set-content-size', width, height),
  saveDebugFile: (filename, content) => ipcRenderer.send('save-debug-file', filename, content),
  // Writes an absolute path within the project folder (dev mode). Returns {ok, path?, error?}.
  saveProjectFile: (absolutePath, content) => ipcRenderer.invoke('save-project-file', absolutePath, content),
  getGPUInfo: () => ipcRenderer.invoke('get-gpu-info'),

  // Asset browser helpers (dev workflow). Returns {ok, path, entries, error?}.
  listProjectDir: (relativePath) => ipcRenderer.invoke('list-project-dir', relativePath),

  // Asset actions (editor workflow)
  openProjectPathExternal: (relativePath) => ipcRenderer.invoke('open-project-path-external', relativePath),
  revealProjectPathInExplorer: (relativePath, isDir) => ipcRenderer.invoke('reveal-project-path-in-explorer', { relativePath, isDir: !!isDir }),
  deleteProjectPath: (relativePath) => ipcRenderer.invoke('delete-project-path', relativePath),
  renameProjectPath: (relativePath, newName) => ipcRenderer.invoke('rename-project-path', { relativePath, newName }),
  copyProjectPathToDir: (srcRelativePath, destDirRelativePath) => ipcRenderer.invoke('copy-project-path-to-dir', { srcRelativePath, destDirRelativePath }),

  // Create a folder inside the workspace
  createProjectDir: (dirRelativePath) => ipcRenderer.invoke('create-project-dir', { dirRelativePath }),

  // Simple script editor helpers
  readProjectTextFile: (relativePath) => ipcRenderer.invoke('read-project-text-file', relativePath),
  readProjectBinaryFile: (relativePath) => ipcRenderer.invoke('read-project-binary-file', relativePath),
  writeProjectTextFile: (relativePath, content) => ipcRenderer.invoke('write-project-text-file', { relativePath, content }),

  // Import external OS files into the project workspace (editor workflow)
  // payload: { files: string[], destDirRelativePath: string }
  importExternalFiles: (files, destDirRelativePath) => ipcRenderer.invoke('import-external-files', { files, destDirRelativePath }),

  // Workspace root (lets the editor browse/load files outside this repo)
  setWorkspaceRoot: (absolutePath) => ipcRenderer.invoke('set-workspace-root', absolutePath),
  getWorkspaceRoot: () => ipcRenderer.invoke('get-workspace-root'),

  // Project creation helpers (editor workflow)
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  selectFile: (opts) => ipcRenderer.invoke('select-file', opts),
  createProject: (opts) => ipcRenderer.invoke('create-fluxion-project', opts),

  // Export game (first-step stub)
  exportGame: (payload) => ipcRenderer.invoke('export-game', payload),

  // Version helpers (About dialog)
  getVersions: () => ipcRenderer.invoke('get-versions'),

  // AnimatedSprite preview window (editor workflow)
  openAnimSpritePreview: (payload) => ipcRenderer.invoke('open-anim-sprite-preview', payload),
  onAnimSpritePreviewData: (cb) => {
    if (typeof cb !== 'function') return;
    ipcRenderer.removeAllListeners('anim-sprite-preview-data');
    ipcRenderer.on('anim-sprite-preview-data', (_event, payload) => {
      try { cb(payload); } catch {}
    });
  },

  // Play preview window (editor workflow)
  openPlayPreview: (payload) => ipcRenderer.invoke('open-play-preview', payload),
  onPlayPreviewData: (cb) => {
    if (typeof cb !== 'function') return;
    ipcRenderer.removeAllListeners('play-preview-data');
    ipcRenderer.on('play-preview-data', (_event, payload) => {
      try { cb(payload); } catch {}
    });
  },
}); 