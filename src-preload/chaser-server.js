const { contextBridge, ipcRenderer } = require('electron');

window.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.key === 'F12') ipcRenderer.send('debug:open-devtools');
});

const uid = (() => {
  let counter = 0n;
  return () => (++counter).toString(36);
})();

contextBridge.exposeInMainWorld('ServerPreloads', {
  /**
   * @param {'C' | 'H'} player
   * @param {number} port
   * @returns {[string, Promise<void>]}
   */
  listen: (player, port) => {
    const id = uid();
    return [id, ipcRenderer.invoke('chaser:listen', player, port, id)];
  },
  /**
   * @param {'C' | 'H'} player
   * @param {string} uid
   */
  unlisten: (player, uid) => ipcRenderer.invoke('chaser:unlisten', player, uid),
  /** @param {(id: string, name: string) => void} listener */
  onConnect: listener => { connectListeners.add(listener); },
  /** @param {(id: string) => void} listener */
  onClose: listener => { closeListeners.add(listener); },
});

/** @type {Set<(id: string) => void>} */
const connectListeners = new Set();

/** @type {Set<(id: string) => void>} */
const closeListeners = new Set();

ipcRenderer.on('chaser:connected', (_, id, name) => {
  for (const listener of connectListeners) listener(id, name);
});

ipcRenderer.on('chaser:closed', (_, id) => {
  for (const listener of closeListeners) listener(id);
});
