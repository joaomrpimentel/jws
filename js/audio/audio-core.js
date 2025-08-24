/**
 * @file Inicialização do AudioContext e nós de áudio principais.
 */
import { synthSettings, activeNotes } from '../state/state.js';
import { showTemporaryMessage, updateScreenInfo } from '../ui/display.js';
import { initEffects, getEffectsChain } from './effects.js';

let audioContext;
let masterGainNode;
let analyserNode;
let lfo, lfoGain;

/**
 * Inicializa o Web Audio API AudioContext e os nós principais.
 * Chamado uma vez na primeira interação do usuário.
 */
export function initAudioEngine() {
    if (audioContext) return; // Já inicializado

    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        masterGainNode = audioContext.createGain();
        masterGainNode.gain.value = 0.7;

        analyserNode = audioContext.createAnalyser();
        analyserNode.fftSize = 2048;

        lfo = audioContext.createOscillator();
        lfo.frequency.value = synthSettings.lfoRate;
        lfoGain = audioContext.createGain();
        lfoGain.gain.value = synthSettings.lfoDepth;
        lfo.connect(lfoGain);
        lfo.start();

        initEffects(audioContext, masterGainNode, analyserNode);

        // **CORREÇÃO: Conecta o analisador à saída de áudio final.**
        analyserNode.connect(audioContext.destination);

        showTemporaryMessage('AUDIO ON');
        updateScreenInfo();
    } catch (e) {
        console.error("Erro na Web Audio API:", e);
        showTemporaryMessage('ERRO DE ÁUDIO');
    }
}

/**
 * Atualiza a frequência de corte de todos os filtros ativos.
 */
export function updateAllFilters() {
    if (!audioContext) return;
    activeNotes.forEach(({ filterNode }) => {
        filterNode.frequency.setTargetAtTime(synthSettings.filterCutoff, audioContext.currentTime, 0.01);
    });
}

/**
 * Alterna um efeito ligando/desligando seu mix wet/dry.
 * @param {string} effectType O nome do efeito ('reverb', 'delay', 'distortion').
 */
export function toggleEffect(effectType) {
    if (!audioContext) return;
    const effectsChain = getEffectsChain();
    if (!effectsChain[effectType]) return;

    const isActive = synthSettings.effects[effectType];
    const now = audioContext.currentTime;
    const wetGain = effectType === 'reverb' ? 0.3 : (effectType === 'delay' ? 0.25 : 0.6);

    effectsChain[effectType].wet.gain.setTargetAtTime(isActive ? wetGain : 0, now, 0.1);
}


// Getters para os nós de áudio que outros módulos precisam acessar
export const getAudioContext = () => audioContext;
export const getMasterGainNode = () => masterGainNode;
export const getAnalyserNode = () => analyserNode;
export const getLfoGain = () => lfoGain;
