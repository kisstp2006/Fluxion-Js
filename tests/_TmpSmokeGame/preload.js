const { contextBridge } = require('electron');

// Reserved for future editor APIs.
contextBridge.exposeInMainWorld('fluxionProject', {
  name: 'SmokeGame',
});
