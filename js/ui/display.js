/**
 * @file Gerencia o display do sintetizador (canvas e mensagens).
 */
import { getAudioContext, getAnalyserNode } from '../audio/audio-core.js';
import { synthSettings, activeNotes, activeKnobParameter, lastDrumSound } from '../state/state.js';

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

export function setLiveDisplayText(text) { liveDisplayText = text; }

export function showTemporaryMessage(text) {
    if (messageTimer) clearTimeout(messageTimer);
    displayMessage.textContent = text;
    displayMessage.classList.add('visible');
    messageTimer = setTimeout(() => {
        displayMessage.classList.remove('visible');
        messageTimer = null;
    }, 1500);
}

export function updateScreenInfo() {
    const engine = synthSettings.engine;
    const params = synthSettings[engine];
    displayParams.p1.textContent = `ENGINE: ${engine.toUpperCase()}`;
    
    // O parâmetro 3 agora sempre mostra o Cutoff do filtro global
    displayParams.p3.textContent = `CUT: ${Math.round(synthSettings.filterCutoff)}`;
    
    switch(engine) {
        case 'drum':
            displayParams.p2.textContent = `KIT: ${params.kit.toUpperCase()}`;
            break;
        case 'fm':
            displayParams.p2.textContent = `ALGO: ${params.algorithm.toUpperCase()}`;
            break;
        case 'subtractive':
        default:
            displayParams.p2.textContent = `WAVE: ${params.waveform.toUpperCase()}`;
            break;
    }
}

export function setupDisplay() {
    const display = document.querySelector('.display');
    const dpr = window.devicePixelRatio || 1;
    const rect = display.getBoundingClientRect();
    displayCanvas.width = rect.width * dpr;
    displayCanvas.height = rect.height * dpr;
    displayCtx.scale(dpr, dpr);
    requestAnimationFrame(updateDisplayLoop);
}

function drawEnvelope(ctx, w, h, params) {
    const { attack, decay, sustain, release } = params;
    const drawingWidth = w * 0.82;
    const totalDuration = attack + decay + 1.0 + release;
    const attackX = (attack / totalDuration) * drawingWidth;
    const decayX = ((attack + decay) / totalDuration) * drawingWidth;
    const sustainX = ((attack + decay + 1.0) / totalDuration) * drawingWidth;
    const releaseX = drawingWidth;
    const sustainY = h * (1 - sustain);

    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.lineTo(attackX, 0);
    ctx.lineTo(decayX, sustainY);
    ctx.lineTo(sustainX, sustainY);
    ctx.lineTo(releaseX, h);
    ctx.stroke();
}

function drawDrumTransient(ctx, w, h, type) {
    const drawingWidth = w * 0.82;
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    
    for (let i = 0; i < drawingWidth; i++) {
        const p = i / drawingWidth; // 0 to 1
        let amp = 0;
        switch(type) {
            case 'kick': amp = Math.exp(-p * 25) * Math.sin(p * Math.PI * 2); break;
            case 'snare': amp = (Math.random() * 2 - 1) * Math.exp(-p * 30); break;
            case 'hat': amp = (Math.random() * 2 - 1) * Math.exp(-p * 60); break;
            case 'tom': amp = Math.exp(-p * 20) * Math.sin(p * Math.PI * 8); break;
            case 'clap': amp = Math.sin(p * Math.PI * 100) * Math.exp(-p * 40); break;
            case 'cymbal': amp = (Math.random() * 2 - 1) * Math.exp(-p * 10); break;
            case 'cowbell': amp = (Math.sin(p * Math.PI * 20) + Math.sin(p * Math.PI * 30)) * Math.exp(-p * 40); break;
        }
        ctx.lineTo(i, h/2 + amp * (h/2 * 0.9));
    }
    ctx.stroke();
}


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
    
    const strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--display-stroke');
    displayCtx.strokeStyle = strokeStyle;
    displayCtx.fillStyle = strokeStyle;
    displayCtx.lineWidth = 2;

    const envelopeParams = ['attack', 'decay', 'sustain', 'release'];

    if (activeKnobParameter && liveDisplayText) {
        if (envelopeParams.includes(activeKnobParameter)) {
            drawEnvelope(displayCtx, w, h, synthSettings[synthSettings.engine]);
        }
        displayCtx.font = "700 18px 'JetBrains Mono', monospace";
        displayCtx.textAlign = 'center';
        displayCtx.textBaseline = 'middle';
        displayCtx.fillText(liveDisplayText, drawingWidth / 2, h / 2);

    } else if (activeNotes.size > 0 && synthSettings.engine !== 'drum') {
        const bufferLength = analyserNode.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyserNode.getByteTimeDomainData(dataArray);
        displayCtx.beginPath();
        const sliceWidth = drawingWidth / bufferLength;
        let x = 0;
        for (let i = 0; i < bufferLength; i++) {
            const v = dataArray[i] / 128.0;
            const y = v * h / 2;
            if (i === 0) displayCtx.moveTo(x, y);
            else displayCtx.lineTo(x, y);
            x += sliceWidth;
        }
        displayCtx.stroke();
    } else {
        // Visualização do último som de bateria tocado
        if (synthSettings.engine === 'drum' && lastDrumSound.type && (performance.now() - lastDrumSound.time < 250)) {
            drawDrumTransient(displayCtx, w, h, lastDrumSound.type);
            return; // Evita desenhar a waveform padrão por cima
        }

        const halfH = h / 2;
        displayCtx.beginPath();
        displayCtx.moveTo(0, halfH);

        if (synthSettings.engine === 'subtractive') {
            const waveform = synthSettings.subtractive.waveform;
            for (let i = 0; i < drawingWidth; i++) {
                const percent = i / drawingWidth;
                let y = halfH;
                switch (waveform) {
                    case 'sine': y += Math.sin(percent * Math.PI * 4) * (halfH * 0.8); break;
                    case 'square': y += (Math.sin(percent * Math.PI * 4) > 0 ? 1 : -1) * (halfH * 0.8); break;
                    case 'sawtooth': y += (1 - (percent * 2 % 2)) * (halfH * 0.8); break;
                    case 'triangle': y += Math.asin(Math.sin(percent * Math.PI * 4)) / (Math.PI / 2) * (halfH * 0.8); break;
                }
                displayCtx.lineTo(i, y);
            }
        } else if (synthSettings.engine === 'fm') {
             for (let i = 0; i < drawingWidth; i++) {
                const percent = i / drawingWidth;
                let y = halfH + Math.sin(percent * Math.PI * 4 + (synthSettings.fm.modIndex/100) * Math.sin(percent * Math.PI * 4 * synthSettings.fm.ratio)) * (halfH * 0.8);
                displayCtx.lineTo(i, y);
            }
        } else if (synthSettings.engine === 'drum') {
            displayCtx.font = "700 14px 'JetBrains Mono', monospace";
            displayCtx.textAlign = 'center';
            displayCtx.textBaseline = 'middle';
            displayCtx.fillText(`KIT: ${synthSettings.drum.kit.toUpperCase()}`, drawingWidth / 2, h / 2);
        }
        displayCtx.stroke();
    }
}
