const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  // 文件对话框
  openFolderDialog: () => ipcRenderer.invoke('open-folder-dialog'),

  // 文件操作
  readFile: (path) => ipcRenderer.invoke('read-file', path),
  writeFile: (path, content) => ipcRenderer.invoke('write-file', path, content),
  readDir: (path) => ipcRenderer.invoke('read-dir', path),
  mkdir: (path) => ipcRenderer.invoke('mkdir', path),
  unlink: (path) => ipcRenderer.invoke('unlink', path),
  rename: (oldPath, newPath) => ipcRenderer.invoke('rename', oldPath, newPath),
  stat: (path) => ipcRenderer.invoke('stat', path),
  exists: (path) => ipcRenderer.invoke('exists', path),

  // 配置
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),

  // 事件监听
  onFolderOpened: (callback) => {
    ipcRenderer.on('folder-opened', (event, path) => callback(path))
  },

  removeFolderOpenedListener: () => {
    ipcRenderer.removeAllListeners('folder-opened')
  }
})