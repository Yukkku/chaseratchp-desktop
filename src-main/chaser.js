import net from 'node:net';

/** @type {0 | 1 | 2} */
let status = 0;

const socket = net.connect(2009, '127.0.0.1', () => {
    socket.write('test bot');
});

socket.on('error', () => {});

socket.on('data', e => {
    const msg = e.toString().trim();
    switch (status) {
        case 0:
            if (msg !== '@') {
                socket.end();
                return;
            }
            socket.write('gr\r\n');
            status = 1;
            break;
        case 1:
            if (!/^[01][0123]{9}$/.test(msg) || msg[0] === '0') {
                socket.end();
                return;
            }
            socket.write('wr\r\n');
            status = 2;
            break;
        case 2:
            if (!/^[01][0123]{9}$/.test(msg) || msg[0] === '0') {
                socket.end();
                return;
            }
            socket.write('#\r\n');
            status = 0;
            break;
    }
});
