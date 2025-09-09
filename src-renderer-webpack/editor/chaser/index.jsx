import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import styles from './server.css';

/**
 * @param {{ wi: 'C' | 'H' }} param0
 */
const Player = ({ wi }) => {
    const [status, setStatus] = useState(/** @type {[0 | 1, number] | [2, string]} */ [0, wi === 'C' ? 2009 : 2010]);
    return <div class={wi === 'C' ? styles.cool : styles.hot}>
        <div class={styles.playtag}>{wi === 'C' ? 'COOL' : 'HOT'}</div>
        {status[0] === 2
            ? (<div class={styles.name}>{status[1]}</div>)
            : (<div class={styles.port}>
                <input onChange={(e) => {
                    setStatus([0, Number(e.target.value)]);
                }} value={status[1]} disabled={status[0] === 1}/>
                <button onClick={() => {
                    setStatus([1 - status[0], status[1]]);
                }}>{status[0] === 0 ? "待機開始" : "待機終了"}</button>
            </div>)
        }
    </div>;
};

const Test = () => {
    const [field, setField] = useState(/** @type {(0|2|3)[][]} */ ([[0, 0, 0], [2, 3, 2], [2, 0, 0]]));
    const [coolPosition, setCoolPosition] = useState(/** @type {[Number, number]} */ ([0, 0]));
    const [hotPosition, setHotPosition] = useState(/** @type {[Number, number]} */ ([2, 2]));
    const width = field[0].length;
    const height = field.length;
    return <div class={styles.grid}>
        <svg class={styles.view} viewBox={`0 0 ${width * 21 + 1} ${height * 21 + 1}`}>
            {field.map((line, i) => line.map((c, j) => {
                const offsetX = j * 21 + 1;
                const offsetY = i * 21 + 1;
                if (c === 0) return;
                if (c === 2) return (<g transform={`translate(${offsetX} ${offsetY})`} stroke="#000">
                    <rect x={-0.5} y={-0.5} width={21} height={21} fill="#aaa" stroke="none"/>
                    <line x1={-0.5} y1={-0.5} x2={20.5} y2={20.5}/>
                    <line x1={20.5} y1={-0.5} x2={-0.5} y2={20.5}/>
                </g>);
                if (c === 3) return (<g transform={`translate(${offsetX} ${offsetY})`}>
                    <path fill="#0c0" d="M10,2L5.29772,16.47214L17.60845,7.52786L2.39155,7.52786L14.70228,16.47214Z"/>
                </g>);
            }))}
            <g transform={`translate(${coolPosition[0] * 21 + 1} ${coolPosition[1] * 21 + 1})`}>
                <path fill="#03f" d="M20.5,-0.5L10,0A10,10 0 0,0 10,20L20.5,20.5V16H10A6,6 0 0,1 10,4H20.5Z"/>
            </g>
            <g transform={`translate(${hotPosition[0] * 21 + 1} ${hotPosition[1] * 21 + 1})`}>
                <path fill="#f30" d="M-0.5,-0.5V20.5H4V12H16V20.5H20.5V-0.5H16V8H4V-0.5Z"/>
            </g>
            {Array.from({length: height + 1}, (_, i) => (
                <rect x={0} y={i * 21} width="100%" height={1}/>
            ))}
            {Array.from({length: width + 1}, (_, i) => (
                <rect x={i * 21} y={0} width={1} height="100%"/>
            ))}
        </svg>
        <Player wi="C"/>
        <Player wi="H"/>
    </div>;
};

ReactDOM.render((<Test />), document.getElementById('app'));
