/**
 * @file Motor de bateria baseado em samples com efeitos.
 */
import { getAudioContext, getMasterGainNode } from './audio-core.js';
import { synthSettings } from '../state/state.js';
import { showTemporaryMessage } from '../ui/display.js';

let audioBuffers = {};
let isLoading = false;
let audioContextRef = null;

// Nós de áudio para a cadeia de efeitos da bateria
let drumGain, drumReverb, drumReverbGain, drumDelay, drumDelayFeedback, bitcrusherNode;
let drumFilter;

// Mapeamento com os novos nomes e caminhos
const samplePaths = {
    studio: {
        kick: 'samples/acoustic-kit/kick.mp3',
        snare: 'samples/acoustic-kit/snare.mp3',
        hatClosed: 'samples/acoustic-kit/hihat.mp3',
        hatOpen: 'samples/acoustic-kit/hihat.mp3',
        tom1: 'samples/acoustic-kit/tom1.mp3',
        tom2: 'samples/acoustic-kit/tom2.mp3',
        cymbal: 'samples/acoustic-kit/tom3.mp3',
        clap: 'samples/acoustic-kit/snare.mp3',
    },
    '808': {
        kick: 'samples/LINN/kick.mp3',
        snare: 'samples/LINN/snare.mp3',
        hatClosed: 'samples/LINN/hihat.mp3',
        hatOpen: 'samples/LINN/hihat.mp3',
        tom1: 'samples/LINN/tom1.mp3',
        tom2: 'samples/LINN/tom2.mp3',
        cymbal: 'samples/LINN/tom3.mp3',
        clap: 'samples/LINN/snare.mp3',
    },
    tape: {
        kick: 'samples/breakbeat9/kick.mp3',
        snare: 'samples/breakbeat9/snare.mp3',
        hatClosed: 'samples/breakbeat9/hihat.mp3',
        hatOpen: 'samples/breakbeat9/hihat.mp3',
        tom1: 'samples/breakbeat9/tom1.mp3',
        tom2: 'samples/breakbeat9/tom2.mp3',
        cymbal: 'samples/breakbeat9/tom3.mp3',
        clap: 'samples/breakbeat9/snare.mp3',
    },
    perc: {
        kick: 'samples/Bongos/kick.mp3',
        snare: 'samples/Bongos/snare.mp3',
        hatClosed: 'samples/Bongos/hihat.mp3',
        hatOpen: 'samples/Bongos/hihat.mp3',
        tom1: 'samples/Bongos/tom1.mp3',
        tom2: 'samples/Bongos/tom2.mp3',
        cymbal: 'samples/Bongos/tom3.mp3',
        clap: 'samples/Bongos/snare.mp3',
    }
};

async function loadSample(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status} for url: ${url}`);
        const arrayBuffer = await response.arrayBuffer();
        return await audioContextRef.decodeAudioData(arrayBuffer);
    } catch (error) {
        console.error(`Falha ao carregar o sample: ${url}`, error);
        return null;
    }
}

async function loadAllSamples() {
    if (isLoading || Object.keys(audioBuffers).length > 0) return;
    isLoading = true;
    showTemporaryMessage('LOADING DRUMS...');

    const allPromises = [];
    for (const kit in samplePaths) {
        audioBuffers[kit] = {};
        for (const sound in samplePaths[kit]) {
            const promise = loadSample(samplePaths[kit][sound])
                .then(buffer => {
                    if (buffer) audioBuffers[kit][sound] = buffer;
                });
            allPromises.push(promise);
        }
    }

    await Promise.all(allPromises);
    isLoading = false;
    showTemporaryMessage('DRUMS READY');
}

/**
 * Cria um nó de bitcrusher usando a API moderna WaveShaper.
 * É mais performático e estável que o ScriptProcessorNode.
 */
function createBitcrusher() {
    const node = audioContextRef.createWaveShaper();
    node.updateCurve = (bits) => {
        const k = Math.pow(2, bits);
        const finalCurve = new Float32Array(65536);
        for (let i = 0; i < 65536; i++) {
            const x = (i / 32768) - 1; // Normaliza para -1 a 1
            if (bits < 8) { // Aplica o efeito de "crush"
                 finalCurve[i] = Math.round(x * (k - 1)) / (k - 1);
            } else { // Se os bits forem 8 (máximo), o som passa inalterado
                finalCurve[i] = x;
            }
        }
        node.curve = finalCurve;
    };
    node.updateCurve(8); // Valor inicial (sem efeito)
    return node;
}


function setupDrumEffects() {
    drumGain = audioContextRef.createGain();
    drumReverb = audioContextRef.createConvolver();
    drumReverbGain = audioContextRef.createGain();
    drumDelay = audioContextRef.createDelay(1.0);
    drumDelayFeedback = audioContextRef.createGain();
    bitcrusherNode = createBitcrusher();
    drumFilter = audioContextRef.createBiquadFilter();
    drumFilter.type = 'lowpass';

    const impulseLength = audioContextRef.sampleRate * 2;
    const impulse = audioContextRef.createBuffer(2, impulseLength, audioContextRef.sampleRate);
    for (let i = 0; i < impulse.getChannelData(0).length; i++) {
        impulse.getChannelData(0)[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / impulseLength, 2);
        impulse.getChannelData(1)[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / impulseLength, 2);
    }
    drumReverb.buffer = impulse;

    // CORREÇÃO: Cadeia de efeitos reorganizada para eliminar ruído
    // O som principal passa pelo ganho, filtro e delay primeiro.
    drumGain.connect(drumFilter)
        .connect(drumDelay)
        .connect(bitcrusherNode) // O bitcrusher agora é o último na cadeia principal
        .connect(getMasterGainNode());

    // Rota de feedback do delay (inalterada)
    drumDelay.connect(drumDelayFeedback).connect(drumDelay);

    // Rota paralela para o reverb (send) vem depois do filtro, para um som mais limpo
    drumFilter.connect(drumReverbGain).connect(drumReverb).connect(getMasterGainNode());

    const params = synthSettings.drum.params;
    updateDrumEffect('gain', params.gain);
    updateDrumEffect('reverb', params.reverb);
    updateDrumEffect('delay', params.delay);
    updateDrumEffect('bitcrush', params.bitcrush);
}

export function initDrumEngine() {
    audioContextRef = getAudioContext();
    if (audioContextRef) {
        setupDrumEffects();
        loadAllSamples();
    }
}

export function updateDrumEffect(param, value) {
    if (!audioContextRef) return;
    const now = audioContextRef.currentTime;
    switch (param) {
        case 'gain':
            drumGain.gain.setTargetAtTime(value, now, 0.01);
            break;
        case 'reverb':
            drumReverbGain.gain.setTargetAtTime(value, now, 0.01);
            break;
        case 'delay':
            drumDelayFeedback.gain.setTargetAtTime(value, now, 0.01);
            break;
        case 'bitcrush':
            const bits = 8 - value * 7; // Mapeia 0-1 para 8-1 bits
            bitcrusherNode.updateCurve(bits);
            break;
    }
}

function getDrumOutput() {
    if (!audioContextRef) return getMasterGainNode();
    drumFilter.frequency.setTargetAtTime(synthSettings.filterCutoff, audioContextRef.currentTime, 0.01);
    return drumGain;
}

export function playDrumSound(soundName) {
    if (isLoading || !audioContextRef) return;

    const kit = synthSettings.drum.kit;
    const buffer = audioBuffers[kit]?.[soundName];

    if (buffer) {
        const source = audioContextRef.createBufferSource();
        source.buffer = buffer;
        
        const tune = synthSettings.drum.params.tune;
        source.playbackRate.value = 0.5 + tune; 

        const output = getDrumOutput();
        
        const splitter = audioContextRef.createChannelSplitter(2);
        const merger = audioContextRef.createChannelMerger(2);

        source.connect(splitter);
        splitter.connect(merger, 0, 0);
        splitter.connect(merger, 0, 1);
        
        merger.connect(output);
        
        source.start();
    }
}
