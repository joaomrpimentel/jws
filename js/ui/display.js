/**
 * @file Gerencia o display do sintetizador (canvas e mensagens).
 */
import { getAudioContext, getAnalyserNode } from '../audio/audio-core.js';
import { synthSettings, activeNotes, activeKnobParameter } from '../state/state.js';

const displayMessage = document.getElementById('display-message');
const displayCanvas = document.getElementById('display-canvas');
const displayCtx = displayCanvas.getContext('2d');
const displayParams = {
    p1: document.getElementById('display-param1'),
    p2: document.getElementById('display-param2'),
    p3: document.getElementById('display-param3'),
};

let messageTimer = null;
let liveDisplayText = '';

/**
 * Define o texto a ser exibido dinamicamente no canvas enquanto um knob é ajustado.
 * @param {string} text O texto para exibir.
 */
export function setLiveDisplayText(text) {
    liveDisplayText = text;
}

/**
 * Mostra uma mensagem temporária na sobreposição do display (para ações como salvar presets).
 * @param {string} text A mensagem a ser exibida.
 */
export function showTemporaryMessage(text) {
    if (messageTimer) {
        clearTimeout(messageTimer);
    }
    displayMessage.textContent = text;
    displayMessage.classList.add('visible');
    messageTimer = setTimeout(() => {
        displayMessage.classList.remove('visible');
        messageTimer = null;
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
 * Desenha a curva do envelope ADSR no canvas.
 * @param {CanvasRenderingContext2D} ctx O contexto do canvas.
 * @param {number} w A largura do canvas.
 * @param {number} h A altura do canvas.
 */
function drawEnvelope(ctx, w, h) {
    const { attack, decay, sustain, release } = synthSettings;
    const drawingWidth = w * 0.82;
    
    // Define um tempo total para visualização para normalizar as durações
    const totalDuration = attack + decay + 1.0 + release; // 1.0s fixo para a fase de sustain

    // Calcula as coordenadas X para cada fase
    const attackX = (attack / totalDuration) * drawingWidth;
    const decayX = ((attack + decay) / totalDuration) * drawingWidth;
    const sustainX = ((attack + decay + 1.0) / totalDuration) * drawingWidth;
    const releaseX = drawingWidth;

    // Calcula a coordenada Y para o nível de sustain
    const sustainY = h * (1 - sustain);

    ctx.beginPath();
    ctx.moveTo(0, h); // Início (volume 0)
    ctx.lineTo(attackX, 0); // Pico do Attack (volume máximo)
    ctx.lineTo(decayX, sustainY); // Fim do Decay (nível de sustain)
    ctx.lineTo(sustainX, sustainY); // Fim do Sustain (mesmo nível)
    ctx.lineTo(releaseX, h); // Fim do Release (volume 0)
    ctx.stroke();
}

/**
 * Loop principal de renderização do display.
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
    const strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--display-stroke');
    displayCtx.strokeStyle = strokeStyle;
    displayCtx.fillStyle = strokeStyle;

    const envelopeParams = ['attack', 'decay', 'sustain', 'release'];

    if (activeKnobParameter && liveDisplayText) {
        if (envelopeParams.includes(activeKnobParameter)) {
            drawEnvelope(displayCtx, w, h);
        }
        displayCtx.font = "700 18px 'JetBrains Mono', monospace";
        displayCtx.textAlign = 'center';
        displayCtx.textBaseline = 'middle';
        displayCtx.fillText(liveDisplayText, drawingWidth / 2, h / 2);

    } else if (activeNotes.size > 0) {
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
