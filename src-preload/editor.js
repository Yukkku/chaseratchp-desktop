const {contextBridge, ipcRenderer} = require('electron');

contextBridge.exposeInMainWorld('EditorPreload', {
  isInitiallyFullscreen: () => ipcRenderer.sendSync('is-initially-fullscreen'),
  getInitialFile: () => ipcRenderer.invoke('get-initial-file'),
  getFile: (id) => ipcRenderer.invoke('get-file', id),
  openedFile: (id) => ipcRenderer.invoke('opened-file', id),
  closedFile: () => ipcRenderer.invoke('closed-file'),
  showSaveFilePicker: (suggestedName) => ipcRenderer.invoke('show-save-file-picker', suggestedName),
  showOpenFilePicker: () => ipcRenderer.invoke('show-open-file-picker'),
  setLocale: (locale) => ipcRenderer.sendSync('set-locale', locale),
  setChanged: (changed) => ipcRenderer.invoke('set-changed', changed),
  openNewWindow: () => ipcRenderer.invoke('open-new-window'),
  openAddonSettings: (search) => ipcRenderer.invoke('open-addon-settings', search),
  openPackager: () => ipcRenderer.invoke('open-packager'),
  openDesktopSettings: () => ipcRenderer.invoke('open-desktop-settings'),
  openPrivacy: () => ipcRenderer.invoke('open-privacy'),
  openAbout: () => ipcRenderer.invoke('open-about'),
  getPreferredMediaDevices: () => ipcRenderer.invoke('get-preferred-media-devices'),
  getAdvancedCustomizations: () => ipcRenderer.invoke('get-advanced-customizations'),
  setExportForPackager: (callback) => {
    exportForPackager = callback;
  },
  setIsFullScreen: (isFullScreen) => ipcRenderer.invoke('set-is-full-screen', isFullScreen),
});

let exportForPackager = () => Promise.reject(new Error('exportForPackager missing'));

ipcRenderer.on('export-project-to-port', (e) => {
  const port = e.ports[0];
  exportForPackager()
    .then(({data, name}) => {
      port.postMessage({ data, name });
    })
    .catch((error) => {
      console.error(error);
      port.postMessage({ error: true });
    });
});

window.addEventListener('message', (e) => {
  if (e.source === window) {
    const data = e.data;
    if (data && typeof data.ipcStartWriteStream === 'string') {
      ipcRenderer.postMessage('start-write-stream', data.ipcStartWriteStream, e.ports);
    }
  }
});

ipcRenderer.on('enumerate-media-devices', (e) => {
  navigator.mediaDevices.enumerateDevices()
    .then((devices) => {
      e.sender.send('enumerated-media-devices', {
        devices: devices.map((device) => ({
          deviceId: device.deviceId,
          kind: device.kind,
          label: device.label
        }))
      });
    })
    .catch((error) => {
      console.error(error);
      e.sender.send('enumerated-media-devices', {
        error: `${error}`
      });
    });
});

contextBridge.exposeInMainWorld('PromptsPreload', {
  alert: (message) => ipcRenderer.sendSync('alert', message),
  confirm: (message) => ipcRenderer.sendSync('confirm', message),
});

// In some Linux environments, people may try to drag & drop files that we don't have access to.
// Remove when https://github.com/electron/electron/issues/30650 is fixed.
if (navigator.userAgent.includes('Linux')) {
  document.addEventListener('drop', (e) => {
    if (e.isTrusted) {
      for (const file of e.dataTransfer.files) {
        // Using webUtils is safe as we don't have a legacy build for Linux
        const {webUtils} = require('electron');
        const path = webUtils.getPathForFile(file);
        ipcRenderer.invoke('check-drag-and-drop-path', path);
      }
    }
  }, {
    capture: true
  });
}

window.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.key === 'F12') ipcRenderer.send('debug:open-devtools');
});

/** @type {Map<string, [() => void, (info: string) => void, (info: string) => void]>} */
const sessions = new Map();

contextBridge.exposeInMainWorld('createCHaserSession', async (host, port, name) => {
  /** @type {string | null} */
  const id = await ipcRenderer.invoke('chaser:connect', host, port, name);
  if (id == null) return null;
  /** @type {Set<() => unknown>} */
  const closeListeners = new Set();
  /** @type {Set<(info: string) => unknown>} */
  const turnListeners = new Set();
  /** @type {0|1|2|3} */
  let status = 0;
  /** @type {string | null} */
  let skinfo = null;
  /** @type {((info: string | null) => void) | null} */
  let presolver = null;
  sessions.set(id, [() => {
    sessions.delete(id);
    status = 3;
    presolver?.(null);
    for (const listener of closeListeners) try {
      listener();
    } catch(e) {
      console.error(e);
    }
  }, (info) => {
    if (status === 3) return;
    if (status === 2) {
      skinfo = info;
      return;
    }
    if (status === 1) throw new Error();
    status = 1;
    for (const listener of turnListeners) try {
      listener(info);
    } catch(e) {
      console.error(e);
    }
  }, (info) => {
    status = 0;
    presolver?.(info);
    if (skinfo) {
      skinfo = null;
      status = 1;
      for (const listener of turnListeners) try {
        listener(info);
      } catch(e) {
        console.error(e);
      }
    }
  }]);
  return {
    close: () => {
      if (status === 3) return;
      sessions.delete(id);
      status = 3;
      presolver?.(null);
      ipcRenderer.send('chaser:close', id);
    },
    /**
     * @param {string} command
     * @returns {Promise<string | null>}
     */
    send: (command) => {
      if (status !== 1) return;
      status = 2;
      ipcRenderer.send('chaser:send', id, command);
      return new Promise(resolve => {
        presolver = resolve;
      });
    },
    get isMyturn() { return status === 1; },
    get isClosed() { return status === 3; },
    /** @param {() => unknown} listener */
    onClose: (listener) => { closeListeners.add(listener); },
    /** @param {() => unknown} listener */
    offClose: (listener) => { closeListeners.delete(listener); },
    /** @param {(info: string) => unknown} listener */
    onMyturn: (listener) => { turnListeners.add(listener); },
    /** @param {(info: string) => unknown} listener */
    offMyturn: (listener) => { turnListeners.delete(listener); },
  };
});

ipcRenderer.on('chaser:close', (_e, sessionid) => {
  sessions.get(sessionid)?.[0]();
});

ipcRenderer.on('chaser:myturn', (_e, sessionid, info) => {
  sessions.get(sessionid)?.[1](info);
});

ipcRenderer.on('chaser:turnend', (_e, sessionid, info) => {
  sessions.get(sessionid)?.[2](info);
});
