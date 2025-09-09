const { ipcRenderer } = require('electron');

window.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.key === 'F12') ipcRenderer.send('debug:open-devtools');
});
