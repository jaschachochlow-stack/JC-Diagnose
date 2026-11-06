const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('JCDesktop', {
  tcpOpen: (host, port) => ipcRenderer.invoke('jc-tcp-open', host, port),
  write: (id, text) => ipcRenderer.invoke('jc-tcp-write', id, text),
  close: (id) => ipcRenderer.invoke('jc-tcp-close', id),
  onData: (cb) => ipcRenderer.on('jc-tcp-data', (e, id, text) => cb(id, text)),
  onClosed: (cb) => ipcRenderer.on('jc-tcp-closed', (e, id) => cb(id)),
  onPick: (cb) => ipcRenderer.on('jc-pick', (e, m) => cb(m)),
  pick: (kind, id) => ipcRenderer.send('jc-pick-result', kind, id),
});
