import net from 'node:net';
import { ipcMain } from 'electron';

// 重複しないようにsessionidを生成する
const createSessionId = (()=>{
    let counter = 0n;
    return () => (++counter).toString(36);
})();

/** @type {Map<string, [0|1|2|3|4, net.Socket]>} */
const sessions = new Map();

ipcMain.handle('chaser:connect', (e, host, port, name) => new Promise(resolve => {
    const webcontent = e.sender;
    let onMissConnection = () => resolve(null);
    const socket = net.connect(port, host, () => {
        socket.off('close', onMissConnection);
        const sessionid = createSessionId();
        resolve(sessionid);
        socket.write(name);
        /** @type {[0|1|2|3|4, net.Socket]} */
        const info = [0, socket];
        sessions.set(sessionid, info);
        const close = () => {
            socket.end();
            info[0] = 4;
            webcontent.send('chaser:close', sessionid);
            sessions.delete(sessionid);
        };
        socket.on('close', () => {
            if (info[0] === 4) return;
            info[0] = 4;
            webcontent.send('chaser:close', sessionid);
            sessions.delete(sessionid);
        });
        socket.on('data', (e) => {
            if (info[0] === 4) return;
            const msg = e.toString().trim();
            if (info[0] === 0) {
                if (msg !== '@') return close();
                socket.write('gr\r\n');
                info[0] = 1;
            } else if (info[0] === 1) {
                if (!/^1[0123]{9}$/.test(msg)) return close();
                webcontent.send('chaser:myturn', sessionid, msg);
                info[0] = 2;
            } else if (info[0] === 2) {
                close();
            } else if (info[0] === 3) {
                if (!/^1[0123]{9}$/.test(msg)) return close();
                socket.write('#\r\n');
                info[0] = 0;
            }
        });
    });
    socket.on('error', () => {});
    socket.on('close', onMissConnection);
}));

ipcMain.on('chaser:send', (e, sessionid, command) => {
    const info = sessions.get(sessionid);
    if (!info) return;
    if (info[0] === 4) return;
    if (info[0] !== 2) {
        info[1].end();
        info[0] = 4;
        e.sender.send('chaser:close', sessionid);
        sessions.delete(sessionid);
    }
    info[1].write(`${command}\r\n`);
    info[0] = 3;
});

ipcMain.on('chaser:close', (_e, sessionid) => {
    const info = sessions.get(sessionid);
    if (!info) return;
    if (info[0] === 4) return;
    info[0] = 4;
    info[1].end();
    sessions.delete(sessionid);
});
