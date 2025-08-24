/**
 * @file Gerencia o display do sintetizador (canvas e mensagens).
 */
import { getAudioContext, getAnalyserNode } from '../audio/audio-core.js';
import { synthSettings, activeNotes } from '../state/state.js';

const displayMessage = document.getElementById('display-message');
const displayCanvas = document.getElementById('display-canvas');
const displayCtx = displayCanvas.getContext('2d');
const displayParams = {
    p1: document.getElementById('display-param1'),
    p2: document.getElementById('display-param2'),
    p3: document.getElementById('display-param3'),
};

/**
 * Mostra uma mensagem temporária na sobreposição do display.
 * @param {string} text A mensagem a ser exibida.
 */
export function showTemporaryMessage(text) {
    displayMessage.textContent = text;
    displayMessage.classList.add('visible');
    setTimeout(() => {
        displayMessage.classList.remove('visible');
    }, 1500);
}

/**
 * Atualiza os parâmetros de texto (Wave, Octave, Cutoff) no display.
 */
export function updateScreenInfo() {
    displayParams.p1.textContent = `WAVE: ${synthSettings.waveform.toUpperCase()}`;
    displayParams.p2.textContent = `OCT: ${Math.round(synthSettings.octaveShift)}`;
    displayParams.p3.textContent = `CUT: ${Math.round(synthSettings.filterCutoff)}`;
}

/**
 * Configura as dimensões do canvas com base no tamanho do seu contêiner e na proporção de pixels do dispositivo.
 */
export function setupDisplay() {
    const display = document.querySelector('.display');
    const dpr = window.devicePixelRatio || 1;
    const rect = display.getBoundingClientRect();
    displayCanvas.width = rect.width * dpr;
    displayCanvas.height = rect.height * dpr;
    displayCtx.scale(dpr, dpr);
    requestAnimationFrame(updateDisplayLoop); // Inicia o loop de renderização
}

/**
 * Loop principal de renderização do display. Desenha o osciloscópio ao vivo ou uma representação estática da forma de onda.
 */
function updateDisplayLoop() {
    requestAnimationFrame(updateDisplayLoop);
    const audioContext = getAudioContext();
    if (!audioContext) return;

    const analyserNode = getAnalyserNode();
    const dpr = window.devicePixelRatio || 1;
    const w = displayCanvas.width / dpr;
    const h = displayCanvas.height / dpr;
    const drawingWidth = w * 0.82;
    displayCtx.clearRect(0, 0, w, h);
    displayCtx.lineWidth = 2;
    displayCtx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--display-stroke');

    if (activeNotes.size > 0) {
        const bufferLength = analyserNode.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyserNode.getByteTimeDomainData(dataArray);
        displayCtx.beginPath();
        const sliceWidth = drawingWidth / bufferLength;
        let x = 0;
        for (let i = 0; i < bufferLength; i++) {
            const v = dataArray[i] / 128.0;
            const y = v * h / 2;
            if (i === 0) {
                displayCtx.moveTo(x, y);
            } else {
                displayCtx.lineTo(x, y);
            }
            x += sliceWidth;
        }
        displayCtx.stroke();
    } else {
        const halfH = h / 2;
        displayCtx.beginPath();
        displayCtx.moveTo(0, halfH);
        for (let i = 0; i < drawingWidth; i++) {
            const percent = i / drawingWidth;
            let y = halfH;
            switch (synthSettings.waveform) {
                case 'sine': y += Math.sin(percent * Math.PI * 4) * (halfH * 0.8); break;
                case 'square': y += (Math.sin(percent * Math.PI * 4) > 0 ? 1 : -1) * (halfH * 0.8); break;
                case 'sawtooth': y += (1 - (percent * 2 % 2)) * (halfH * 0.8); break;
                case 'triangle': y += Math.asin(Math.sin(percent * Math.PI * 4)) / (Math.PI / 2) * (halfH * 0.8); break;
            }
            displayCtx.lineTo(i, y);
        }
        displayCtx.stroke();
    }
}
