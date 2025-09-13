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
    ipcRenderer.send('chaser:listen', player, port, id);
    return id;
  },
  /**
   * @param {'C' | 'H'} player
   * @param {string} uid
   */
  unlisten: (player, uid) => ipcRenderer.send('chaser:unlisten', player, uid),
  start: () => ipcRenderer.send('chaser:start'),
  readfile: () => ipcRenderer.send('chaser:readfile'),
  /** @param {(id: string, name: string) => void} listener */
  onConnect: listener => { connectListeners.add(listener); },
  /** @param {(id: string) => void} listener */
  onClose: listener => { closeListeners.add(listener); },
  /** @param {(field: any) => void} listener */
  onUpdate: listener => { updateListeners.add(listener); },
  /** @param {(progress: any) => void} listener */
  onProgress: listener => { progressListeners.add(listener); },

  remotekey: data => ipcRenderer.send('chaser:remotekey', data),
});

/** @type {Set<(id: string) => void>} */
const connectListeners = new Set();

/** @type {Set<(id: string) => void>} */
const closeListeners = new Set();

/** @type {Set<(field: any) => void>} */
const updateListeners = new Set();

/** @type {Set<(progress: any) => void>} */
const progressListeners = new Set();

ipcRenderer.on('chaser:connected', (_, id, name) => {
  for (const listener of connectListeners) listener(id, name);
});

ipcRenderer.on('chaser:closed', (_, id) => {
  for (const listener of closeListeners) listener(id);
});

ipcRenderer.on('chaser:update', (_, field) => {
  for (const listener of updateListeners) listener(field);
});

ipcRenderer.on('chaser:progress', (_, progress) => {
  for (const listener of progressListeners) listener(progress);
});