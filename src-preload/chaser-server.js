const { contextBridge, ipcRenderer } = require('electron');

window.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.key === 'F12') ipcRenderer.send('debug:open-devtools');
});

contextBridge.exposeInMainWorld('ServerPreloads', {
  /**
   * @param {'C' | 'H'} player
   * @param {number} port
   */
  listen: (player, port) => ipcRenderer.invoke('chaser:listen', player, port),
  /**
   * @param {'C' | 'H'} player
   * @param {string} uid
   */
  unlisten: (player, uid) => ipcRenderer.invoke('chaser:unlisten', player, uid),
});
