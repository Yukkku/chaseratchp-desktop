// @ts-check

const AbstractWindow = require('./abstract');
const { APP_NAME } = require('../brand');

const createGame = () => {
  /** @type {(0|2|3)[][]} */
  const map = [
    [0, 0, 0],
    [2, 3, 2],
    [0, 0, 0],
  ];
  /** @type {[number, number]} */
  const cool = [0, 0];
  /** @type {[number, number]} */
  const hot = [2, 2];
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
  return {
    /**
     * @returns {{
     *   map: readonly (readonly (0|2|3)[])[],
     *   cool: [number, number], 
     *   hot: [number, number],
     * }}
     */
    field: () => ({ map, cool, hot }),
    winner,
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
        return getAround(p, player);
      } else if (command[0] === 'p') {
        const [x, y] = [p[0] + dir[0], p[1] + dir[1]];
        if (0 <= x && x < map.length && 0 <= y && y < map[0].length) {
          map[x][y] = 2;
        }
        return getAround(p, player);
      } else if (command[0] === 'l') {
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
        return r;
      }
    },
  };
};

module.exports = class ChaserServerWindow extends AbstractWindow {
  #game;

  constructor () {
    super();
    this.#game = createGame();
    this.window.setTitle(`Battle Server - ${APP_NAME}`);
    this.loadURL(`tw-editor://./chaser/server.html`);
    this.ipc.handle('chaser:getfield', () => {
      return this.#game.field();
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
