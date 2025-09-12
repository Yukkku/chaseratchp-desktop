import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import styles from './server.css';
{
    let theme = '';
    let accent = 'hsla(95, 100%, 35%, 1.00)';
    let themeSetting = null;

    try {
        themeSetting = localStorage.getItem('tw:theme');
    } catch (_) {}
    if (themeSetting === 'light') {
        theme = 'light';
    } else if (themeSetting === 'dark') {
        theme = 'dark';
    } else if (themeSetting) {
        try {
            const parsed = JSON.parse(themeSetting);
            if (parsed.accent === 'red') {
                accent = '#ff4c4c';
            } else if (parsed.accent === 'purple') {
                accent = '#855cd6';
            } else if (parsed.accent === 'blue') {
                accent = '#4c97ff';
            }
            if (parsed.gui === 'dark' || parsed.gui === 'light') {
                theme = parsed.gui;
            }
        } catch (_) {}
    }

    if (!theme) {
        theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    const root = document.documentElement;
    root.style.setProperty('--theme-color', accent);
    if (theme === 'dark') root.classList.add(styles.dark);
}

/**
 * @typedef {{
 *      map: readonly (readonly (0 | 2 | 3)[])[];
 *      cool: [number, number];
 *      hot: [number, number];
 *      score: { cool: number, hot: number };
 *      turns: number;
 *  }} Field
 */

/** @type {Map<string, () => void>} */
const closeListeners = new Map();
/** @type {Map<string, (name: string) => void>} */
const openListeners = new Map();
/** @type {Set<(field: Field) => void>} */
const updateListeners = new Set();
/** @type {Set<(progress: null | 'C' | 'H' | number) => void>} */
const progressListeners = new Set();

ServerPreloads.onClose(id => {
    closeListeners.get(id)?.();
});
ServerPreloads.onConnect((id, name) => {
    openListeners.get(id)?.(name);
});
ServerPreloads.onUpdate(field => {
    for (const listener of updateListeners) listener(field);
});
ServerPreloads.onProgress(progress => {
    for (const listener of progressListeners) listener(progress);
});

/**
 * @param {{
 *     wi: 'C' | 'H',
 *     onConnect?: () => unknown,
 *     onDisConnect?: () => unknown,
 *     started: boolean,
 * }} param0
 */
const Player = ({ wi, onConnect, onDisConnect, started, score }) => {
    const [status, setStatus] = useState(/**
        @type {(
            | [0, string] // 未接続 [0, ポート番号]
            | [1, string, string] // 接続待機中 [1, ポート番号, クライアントID]
            | [2, string, string] // 接続済 [2, 名前, クライアントID]
            | [3, string] // 試合中切断 [3, 名前]
        )} */ ([0, wi === 'C' ? "2009" : "2010"]));
    const port = (() => {
        if (status[0] === 2 || status[0] === 3) return null;
        const port = Number(status[1]);
        if (Number.isInteger(port) && 0 <= port && port < 65536) return port;
        return null;
    })();
    useEffect(() => {
        if (status[0] === 0 || status[0] === 3) return;
        const id = status[2];
        closeListeners.set(id, () => {
            if (status[0] === 2) {
                if (started) {
                    setStatus([3, status[1]]);
                } else {
                    setStatus([0, wi === 'C' ? "2009" : "2010"]);
                }
                onDisConnect?.();
            } else {
                setStatus([0, status[1]]);
            }
        });
        openListeners.set(id, name => {
            setStatus([2, name, status[2]]);
            onConnect?.();
        });
        return () => {
            closeListeners.delete(id);
            openListeners.delete(id);
        };
    }, [status, onConnect, onDisConnect, started]);
    return <div className={wi === 'C' ? styles.cool : styles.hot}>
        {(status[0] === 2 || status[0] === 3)
            && (<div className={styles.name}>{status[1]}</div>)}
        <div className={styles.port}>
            <input onChange={(e) => {
                setStatus([0, e.target.value]);
            }} value={status[0] === 0 || status[0] === 1 ? status[1] : "0"} disabled={status[0] !== 0}/>
            <button onClick={() => {
                if (status[0] === 0) {
                    /** @type {string} */
                    const id = ServerPreloads.listen(wi, port);
                    /** @type {[1, string, string]} */
                    const ks = [1, status[1], id];
                    setStatus(ks);
                } else if (status[0] === 1) {
                    setStatus([0, status[1]]);
                    ServerPreloads.unlisten(wi, status[2]);
                }
            }} disabled={port == null}>{status[0] === 0 ? "待機開始" : "待機終了"}</button>
        </div>
    </div>;
};

const Main = () => {
    const [field, setField] = useState(/** @type {Field} */ ({
        map: [
            [0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 2, 0, 2, 0, 0],
            [0, 0, 0, 0, 0, 2, 0, 2, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0],
            [2, 3, 3, 0, 0, 3, 3, 2, 3],
            [3, 2, 3, 3, 0, 0, 3, 3, 2],
            [0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 2, 0, 2, 0, 0, 0, 0, 0],
            [0, 0, 2, 0, 2, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0],
        ],
        cool: [1, 1],
        hot: [8, 7],
        score: { cool: 0, hot: 0 },
        turns: 50,
    }));
    const [connecting, setConnecting] = useState(/** @type {[boolean, boolean]} */ ([false, false]));
    const [progress, setProgress] = useState(/** @type {null | number | 'C' | 'H'} */ (null));
    useEffect(() => {
        /** @param {Field} field */
        const onupdate = field => {
            setField(field);
        };
        updateListeners.add(onupdate);
        return () => {
            updateListeners.delete(onupdate);
        };
    });
    useEffect(() => {
        /** @param {null | 'C' | 'H' | number} np */
        const onprogress = np => {
            if (np === 'C' || np === 'H') {
                setProgress(np);
            }
            if (progress === 'C' || progress === 'H') return;
            if (typeof np === 'number') setProgress(np);
        };
        progressListeners.add(onprogress);
        return () => {
            progressListeners.delete(onprogress);
        };
    });
    const width = field.map[0].length;
    const height = field.map.length;
    return <div className={styles.grid}>
        <svg className={styles.view} viewBox={`0 0 ${width * 21 + 1} ${height * 21 + 1}`}>
            <rect x={0.5} y={0.5} width={width * 21} height={height * 21} fill="var(--view-back)"/>
            {field.map.map((line, i) => line.map((c, j) => {
                const offsetX = j * 21 + 1;
                const offsetY = i * 21 + 1;
                if (c === 0) return;
                if (c === 2) return (<g transform={`translate(${offsetX} ${offsetY})`} stroke="var(--view-wallline)">
                    <rect x={-0.5} y={-0.5} width={21} height={21} fill="var(--view-wall)" stroke="none"/>
                    <line x1={-0.5} y1={-0.5} x2={20.5} y2={20.5}/>
                    <line x1={20.5} y1={-0.5} x2={-0.5} y2={20.5}/>
                </g>);
                if (c === 3) return (<g transform={`translate(${offsetX} ${offsetY})`}>
                    <path fill="#0c0" d="M10,2L5.29772,16.47214L17.60845,7.52786L2.39155,7.52786L14.70228,16.47214Z"/>
                </g>);
            }))}
            {0 <= field.cool[0] && field.cool[0] < height && 0 <= field.cool[1] && field.cool[1] < width
                && (<g transform={`translate(${field.cool[1] * 21 + 1} ${field.cool[0] * 21 + 1})`}>
                    <path fill="#03f" d="M20.5,-0.5L10,0A10,10 0 0,0 10,20L20.5,20.5V16H10A6,6 0 0,1 10,4H20.5Z"/>
                </g>)
            }
            {0 <= field.hot[0] && field.hot[0] < height && 0 <= field.hot[1] && field.hot[1] < width
                && (<g transform={`translate(${field.hot[1] * 21 + 1} ${field.hot[0] * 21 + 1})`}>
                    <path fill="#f30" d="M-0.5,-0.5V20.5H4V12H16V20.5H20.5V-0.5H16V8H4V-0.5Z"/>
                </g>)
            }
            {Array.from({length: height + 1}, (_, i) => (
                <rect x={0} y={i * 21} width="100%" height={1} fill="var(--view-border)"/>
            ))}
            {Array.from({length: width + 1}, (_, i) => (
                <rect x={i * 21} y={0} width={1} height="100%" fill="var(--view-border)"/>
            ))}
        </svg>
        <div className={styles.cooltag}>
            <svg viewBox="0 0 8 8">
                <path fill="#03f" d="M8,0H4A4,4 0 0,0 4,8H8V6H4A2,2 0 0,1 4,2H8Z"/>
            </svg>
            COOL
            {progress != null && (<><span className={styles.score}>{String(field.score.cool)}</span> P</>)}
        </div>
        <div className={styles.hottag}>
            <svg viewBox="0 0 8 8">
                <path fill="#f30" d="M0,0V8H2V5H6V8H8V0H6V3H2V0Z"/>
            </svg>
            HOT
            {progress != null && (<><span className={styles.score}>{String(field.score.hot)}</span> P</>)}
        </div>
        <Player wi="C" onConnect={() => setConnecting([true, connecting[1]])} onDisConnect={() => setConnecting([false, connecting[1]])} started={progress != null}/>
        <Player wi="H" onConnect={() => setConnecting([connecting[0], true])} onDisConnect={() => setConnecting([connecting[0], false])} started={progress != null}/>
        <div className={styles.control}>
            <button className={progress != null ? styles.hidden : void 0} onClick={() => ServerPreloads.readfile()}>マップを読み込む</button>
            <button className={`${styles.start} ${progress != null ? styles.hidden : ""}`}  onClick={() => {
                ServerPreloads.start();
                setProgress(field.turns * 2);
            }} disabled={!connecting.every(r => r)}>ゲーム開始</button>
            {progress === null ?
                (undefined)
             : progress === 'C' ?
                ("Coolの勝ち!")
             : progress === 'H' ?
                ("Hotの勝ち!")
             : progress === 0 ?
                ("引き分け!")
             :
                (`残り${Math.ceil(progress / 2)}ターン`)
            }
        </div>
    </div>;
};

ReactDOM.render((<Main />), document.getElementById('app'));
