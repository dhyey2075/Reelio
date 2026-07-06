const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('reelioWindow', {
  expand: () => ipcRenderer.invoke('window:expand'),
  minimize: () => ipcRenderer.invoke('window:minimize'),
  focus: () => ipcRenderer.invoke('window:focus'),
});
