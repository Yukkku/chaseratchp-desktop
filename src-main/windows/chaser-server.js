const AbstractWindow = require('./abstract');

module.exports = class ChaserServerWindow extends AbstractWindow {
  /**
   * @param {string|null} search
   */
  constructor (search) {
    super();
    this.window.on('page-title-updated', event => {
      event.preventDefault();
    });
    this.loadURL(`tw-editor://./chaser/server.html`);
  }

  getDimensions () {
    return {
      width: 700,
      height: 650
    };
  }

  getPreload () {
    return 'addons';
  }

  isPopup () {
    return true;
  }

  getBackgroundColor () {
    return '#111111';
  }

  static show () {
    AbstractWindow.singleton(ChaserServerWindow).show();
  }
}
