// @ts-check

const AbstractWindow = require('./abstract');
const { APP_NAME } = require('../brand');
const net = require('node:net');

/**
 * @typedef {{
 *   map: (0|2|3)[][],
 *   cool: [number, number], 
 *   hot: [number, number],
 * }} Field
 */

const createGame = () => {
  /** @type {(0|2|3)[][]} */
  let map = [
    [0, 0, 0],
    [2, 3, 2],
    [0, 0, 0],
  ];
  /** @type {[number, number]} */
  let cool = [0, 0];
  /** @type {[number, number]} */
  let hot = [2, 2];
  /** @type {'C' | 'H'} */
  let lastMove = 'H';
  /**
   * @param {number} i
   * @param {number} j
   */
  const getMapCell = (i, j) =>  {
    return map[i]?.[j] ?? 2;
  };
  /** @returns {'C'|'H'|null} */
  const winner =  () => {
    let coolL = getMapCell(...cool) === 2;
    let hotL = getMapCell(...hot) === 2;
    /** @type {[number, number][]} */
    const dirs = [[-1, 0], [1, 0], [0, 1], [0, -1]];
    coolL ||= dirs.every(([x, y]) => getMapCell(cool[0] + x, cool[1] + y) === 2);
    hotL ||= dirs.every(([x, y]) => getMapCell(hot[0] + x, hot[1] + y) === 2);
    if (lastMove = 'C') {
      if (hotL) return 'C';
      if (coolL) return 'H';
    } else {
      if (coolL) return 'H';
      if (hotL) return 'C';
    }
    return null;
  };  
  /**
   * @param {[number, number]} position
   * @param {'C' | 'H'} player
   */
  const getAround = (position, player) => {
    const [x, y] = position;
    const rival = player === 'C' ? hot : cool;
    let r = winner() ? '0' : '1';
    for (let i = x - 1; i <= x + 1; ++i) {
      for (let j = y - 1; j <= y + 1; ++j) {
        if (i === rival[0] && j === rival[1]) {
          r += '1';
        } else {
          r += String(getMapCell(i, j));
        }
      }
    }
    return r;
  };

  /** @type {Set<(field: Field) => void>} */
  const updateListeners = new Set();
  const emitUpdate = () => {
    const field = { map, cool, hot };
    for (const listener of updateListeners) listener(field);
  };

  return {
    /** @returns {Field} */
    field: () => ({ map, cool, hot }),
    /** @param {Field} field */
    setField: field => {
      map = field.map;
      cool = field.cool;
      hot = field.hot;
      emitUpdate();
    },
    winner,
    /**
     * @param {'C' | 'H'} player
     * @returns {[number, number]}
     */
    getPosition: player => player === 'C' ? cool : hot,
    getAround,
    /**
     * @param {string} command
     * @param {'C' | 'H'} player
     */
    command: (command, player) => {
      const p = player === 'C' ? cool : hot;
      /** @type {[number, number]} */
      let dir;
      if (command[1] === 'u') {
        dir = [-1, 0];
      } else if (command[1] === 'd') {
        dir = [1, 0];
      } else if (command[1] === 'l') {
        dir = [-1, 0];
      } else if (command[1] === 'r') {
        dir = [1, 0];
      } else throw new Error();
      lastMove = player;
      if (command[0] === 'w') {
        p[0] += dir[0];
        p[1] += dir[1];
        emitUpdate();
        return getAround(p, player);
      } else if (command[0] === 'p') {
        const [x, y] = [p[0] + dir[0], p[1] + dir[1]];
        if (0 <= x && x < map.length && 0 <= y && y < map[0].length) {
          map[x][y] = 2;
        }
        emitUpdate();
        return getAround(p, player);
      } else if (command[0] === 'l') {
        emitUpdate();
        return getAround([p[0] + dir[0] * 2, p[0] + dir[0] * 2], player);
      } else if (command[0] === 's') {
        /** @type {[number, number]} */
        const q = [...p];
        const rival = player === 'C' ? hot : cool;
        let r = winner() ? '0' : '1';
        for (let i = 0; i < 9; ++i) {
          q[0] += dir[0];
          q[1] += dir[1];
          if (q[0] === rival[0] && q[1] === rival[1]) {
            r += '1';
          } else {
            r += String(getMapCell(...q));
          }
        }
        emitUpdate();
        return r;
      }
    },
    /** @param {(field: Field) => void} listener */
    onUpdate: listener => { updateListeners.add(listener); },
    /** @param {(field: Field) => void} listener */
    offUpdate: listener => { updateListeners.delete(listener); },
  };
};

/** @param {number} port */
const createClient = port => {
  /**
   * @type {(
   *   | [0, Set<[net.Socket, 0|1|2|3|4|9]>]
   *   | [1, string, [net.Socket, 0|1|2|3|4|9]]
   *   | [9]
   * )}
   */
  let status = [0, new Set()];
  /** @type {[ReturnType<typeof createGame>, 'C' | 'H']} */
  let qgame;
  const server = net.createServer(socket => {
    if (status[0] !== 0) {
      socket.end();
      return;
    }
    /** @type {[net.Socket, 0|1|2|3|4|9]} */
    const info = [socket, 0];
    status[1].add(info);
    socket.on('data', e => {
      if (status[0] === 9) return;
      if (info[1] === 9) return;
      const msg = e.toString().trim();
      if (status[0] === 0) {
        for (const bi of status[1]) {
          if (bi === info) continue;
          bi[0].end();
          bi[1] = 9;
        }
        server.close();
        status = [1, msg, info];
        info[1] = 1;
        emitOpen(msg);
      } else if (status[2] !== info) {
        socket.end();
        info[1] = 9;
      } else if (info[1] === 1) {
        socket.end();
        info[1] = 9;
        status = [9];
        emitClose();
      } else if (info[1] === 2) {
        if (msg !== 'gr') {
          socket.end();
          info[1] = 9;
          status = [9];
          emitClose();
          return;
        }
        socket.write(qgame[0].getAround(qgame[0].getPosition(qgame[1]), qgame[1]) + '\r\n');
        info[1] = 3;
      } else if (info[1] === 3) {
        if (!/^[wpls][udlr]$/.test(msg)) {
          socket.end();
          info[1] = 9;
          status = [9];
          emitClose();
          return;
        }
        socket.write(qgame[0].command(msg, qgame[1]) + '\r\n');
        info[1] = 4;
      } else if (info[1] === 4) {
        if (msg !== '#') {
          socket.end();
          info[1] = 9;
          status = [9];
          emitClose();
          return;
        }
        info[1] = 1;
      }
    });
    socket.on('error', () => {});
    socket.on('close', () => {
      if (status[0] === 9) return;
      if (info[1] === 9) return;
      info[1] = 9;
      if (status[0] === 0) {
        status[1].delete(info);
      } else if (status[0] === 1) {
        status = [9];
      }
      emitClose();
    });
  }).listen(port);
  server.on('error', () => {
    if (status[0] === 0) { 
      server.close();
      status = [9];
      emitClose();
    }
  });
  server.on('close', () => {
    if (status[0] === 0) {
      status = [9];
      emitClose();
    }
  });

  /** @type {Set<() => unknown>} */
  const closeListeners = new Set();
  const emitClose = () => {
    for (const listener of closeListeners) listener();
  };

  /** @type {Set<(name: string) => unknown>} */
  const openListeners = new Set();
  /** @param {string} name */
  const emitOpen = (name) => {
    for (const listener of openListeners) listener(name);
  };

  const close = () => {
    if (status[0] === 0) {
      for (const bi of status[1]) {
        bi[0].end();
        bi[1] = 9;
      }
      server.close();
    } else if (status[0] === 1) {
      status[2][0].end();
      status[2][1] = 9;
    }
    status = [9];
  };

  return {
    close,
    /**
     * @param {ReturnType<typeof createGame>} game
     * @param {'C' | 'H'} player
     */
    turnStart: (game, player) => {
      if (status[0] !== 1 || status[2][1] !== 1) {
        close();
        return;
      }
      qgame = [game, player];
      status[2][0].write('@\r\n');
      status[2][1] = 2;
    },

    get isConnecting() {
      return status[0] === 1;
    },
    get isClosed() {
      return status[0] === 9;
    },

    /** @param {(name: string) => unknown} listener */
    onOpen: listener => {
      openListeners.add(listener);
    },
    /** @param {(name: string) => unknown} listener */
    offOpen: listener => {
      openListeners.delete(listener);
    },

    /** @param {() => unknown} listener */
    onClose: listener => {
      closeListeners.add(listener);
    },
    /** @param {() => unknown} listener */
    offClose: listener => {
      closeListeners.delete(listener);
    },
  };
};

module.exports = class ChaserServerWindow extends AbstractWindow {
  #game;
  /** @type {[ReturnType<typeof createClient>, string] | null} */
  #cool;
  /** @type {[ReturnType<typeof createClient>, string] | null} */
  #hot;

  constructor () {
    super();
    this.#game = createGame();
    this.#cool = null;
    this.#hot = null;
    this.window.setTitle(`Battle Server - ${APP_NAME}`);
    this.loadURL(`tw-editor://./chaser/server.html`);
    this.ipc.handle('chaser:getfield', () => {
      return this.#game.field();
    });
    this.ipc.handle('chaser:listen', (_, player, port, id) => {
      const client = createClient(port);
      if (player === 'C') {
        if (this.#cool) this.#cool[0].close();
        this.#cool = [client, id];
        client.onClose(() => {
          if (this.#cool?.[0] === client) this.#cool = null;
        });
      } else {
        if (this.#hot) this.#hot[0].close();
        this.#hot = [client, id];
        client.onClose(() => {
          if (this.#hot?.[0] === client) this.#hot = null;
        });
      }
      client.onOpen(name => {
        this.window.webContents.send('chaser:connected', id, name);
      });
      client.onClose(() => {
        this.window.webContents.send('chaser:closed', id);
      });
      return;
    });
    this.ipc.handle('chaser:unlisten', (_, player, id) => {
      if (player === 'C') {
        if (this.#cool && this.#cool?.[1] === id) this.#cool[0].close();
        this.#cool = null;
      } else {
        if (this.#hot && this.#hot?.[1] === id) this.#hot[0].close();
        this.#hot = null;
      }
    });
    this.ipc.handle('chaser:start', () => {
      this.#game.command('wr', 'C');
    });
    this.#game.onUpdate(field => {
      this.window.webContents.send('chaser:update', field);
    });
  }

  getDimensions () {
    return {
      width: 700,
      height: 650
    };
  }

  getPreload () {
    return 'chaser-server';
  }

  isPopup () {
    return true;
  }

  getBackgroundColor () {
    return '#ffffff';
  }

  static show () {
    AbstractWindow.singleton(ChaserServerWindow).show();
  }
}
