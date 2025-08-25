/**
* @file Lógica para tocar e parar notas, com suporte a múltiplos motores de som (subtrativo, FM e bateria).
* @description Este módulo gerencia o roteamento de notas para diferentes motores de som,
* controla polifonia, sustain/hold e aplica ADSR. Também inclui integração com o motor de bateria.
*/
import { getAudioContext, getMasterGainNode, getLfoGain } from './audio-core.js';
import { synthSettings, activeNotes, heldNotes, setLastDrumSound } from '../state/state.js';
import { noteFrequencies, waveformGains } from '../utils/constants.js';
import { playDrumSound } from './drum-engine.js';

let globalId = 0;

/**
* @constant {Object} drumMap
* @description Mapeamento de notas MIDI para sons de bateria.
*/
const drumMap = {
    'C4': { soundName: 'kick', name: 'kick' },
    'Db4': { soundName: 'hatClosed', name: 'hat' },
    'D4': { soundName: 'snare', name: 'snare' },
    'Eb4': { soundName: 'hatOpen', name: 'hat' },
    'E4': { soundName: 'clap', name: 'clap' },
    'F4': { soundName: 'tom1', name: 'tom' },
    'Gb4': { soundName: 'tom2', name: 'tom' },
    'G4': { soundName: 'tom2', name: 'tom' },
    'Ab4': { soundName: 'clap', name: 'clap' },
    'A4': { soundName: 'cymbal', name: 'cymbal' },
    'Bb4': { soundName: 'clap', name: 'clap' },
    'B4': { soundName: 'cymbal', name: 'cymbal' },
    'C5': { soundName: 'cymbal', name: 'cymbal' },
};

/**
* Toca uma nota de acordo com o motor de som selecionado.
* - Para bateria: dispara o sample correspondente.
* - Para sintetizadores: cria osciladores e aplica ADSR.
* @param {string} note - Nota a ser tocada (ex: 'C4').
* @param {number|null} duration - Duração opcional em segundos.
* @returns {string|null} ID único da nota criada, ou null se não aplicável.
*/
export function playNote(note, duration = null) {
    const audioContext = getAudioContext();
    if (!audioContext || !noteFrequencies[note]) return null;

    // Roteamento para o motor de bateria
    if (synthSettings.engine === 'drum') {
        const drumSound = drumMap[note];
        if (drumSound) {
            playDrumSound(drumSound.soundName);
            setLastDrumSound(drumSound.name);
        }
        return null; // Sons de bateria não são rastreados como notas
    }

    // Limpeza de notas para polifonia
    if (activeNotes.size >= synthSettings.polyphony) {
        const oldestNote = activeNotes.keys().next().value;
        stopNote(oldestNote, true);
    }

    const noteId = `${note}-${++globalId}`;
    let noteData;

    // Chama o motor de som correto
    switch (synthSettings.engine) {
        case 'fm':
            noteData = playFmNote(note, noteId);
            break;
        case 'subtractive':
        default:
            noteData = playSubtractiveNote(note, noteId);
            break;
    }

    if (!noteData) return null;

    activeNotes.set(noteId, noteData);
    if (synthSettings.performance.hold) {
        heldNotes.add(noteId);
    }
    if (duration) {
        setTimeout(() => stopNote(noteId), duration * 1000);
    }
    return noteId;
}

/**
* Motor de síntese subtrativa.
* Cria oscilador, filtro e envelope de amplitude.
* @param {string} note - Nota a ser tocada.
* @param {string} noteId - Identificador único da nota.
* @returns {Object} Estrutura com nós de áudio e metadados da nota.
*/
function playSubtractiveNote(note, noteId) {
    const audioContext = getAudioContext();
    const now = audioContext.currentTime;
    const params = synthSettings.subtractive;
    const frequency = noteFrequencies[note] * Math.pow(2, params.octaveShift);

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    const filterNode = audioContext.createBiquadFilter();
    
    oscillator.type = params.waveform;
    oscillator.frequency.setValueAtTime(frequency, now);

    filterNode.type = 'lowpass';
    filterNode.frequency.setValueAtTime(synthSettings.filterCutoff, now); // Usa filtro global
    filterNode.Q.setValueAtTime(1, now);
    
    getLfoGain().connect(filterNode.frequency);
    oscillator.connect(filterNode);
    filterNode.connect(gainNode);
    gainNode.connect(getMasterGainNode());

    const maxGain = (waveformGains[params.waveform] || 0.8);
    const sustainLevel = maxGain * params.sustain;

    gainNode.gain.cancelScheduledValues(now);
    gainNode.gain.setValueAtTime(0.001, now);
    gainNode.gain.exponentialRampToValueAtTime(maxGain, now + params.attack);
    gainNode.gain.exponentialRampToValueAtTime(Math.max(sustainLevel, 0.001), now + params.attack + params.decay);

    oscillator.start(now);
    return { nodes: [oscillator], gainNode, filterNode, note, startTime: now };
}

/**
* Motor de síntese FM (Frequency Modulation).
* Cria portadora, moduladores e aplica algoritmos de modulação.
* @param {string} note - Nota a ser tocada.
* @param {string} noteId - Identificador único da nota.
* @returns {Object} Estrutura com nós de áudio e metadados da nota.
*/
function playFmNote(note, noteId) {
    const audioContext = getAudioContext();
    const now = audioContext.currentTime;
    const params = synthSettings.fm;
    const frequency = noteFrequencies[note] * Math.pow(2, params.octaveShift);

    const carrier = audioContext.createOscillator();
    const modulator1 = audioContext.createOscillator();
    const modulator2 = audioContext.createOscillator();
    const mod1Gain = audioContext.createGain();
    const mod2Gain = audioContext.createGain();
    const gainNode = audioContext.createGain();
    const filterNode = audioContext.createBiquadFilter();

    carrier.type = 'sine';
    carrier.frequency.setValueAtTime(frequency, now);

    modulator1.type = 'sine';
    modulator2.type = 'sine';

    filterNode.type = 'lowpass';
    filterNode.frequency.setValueAtTime(synthSettings.filterCutoff, now); // Usa filtro global

    // Conexões baseadas no algoritmo
    switch(params.algorithm) {
        case 'parallel': // (M1 + M2) -> C
            modulator1.frequency.setValueAtTime(frequency * params.ratio, now);
            mod1Gain.gain.setValueAtTime(params.modIndex, now);
            modulator2.frequency.setValueAtTime(frequency * (params.ratio * 0.5), now);
            mod2Gain.gain.setValueAtTime(params.modIndex * 0.8, now);
            
            modulator1.connect(mod1Gain);
            modulator2.connect(mod2Gain);
            mod1Gain.connect(carrier.frequency);
            mod2Gain.connect(carrier.frequency);
            break;
        case 'series': // M2 -> M1 -> C
            modulator1.frequency.setValueAtTime(frequency * params.ratio, now);
            mod1Gain.gain.setValueAtTime(params.modIndex * 2, now); // Mais intenso
            modulator2.frequency.setValueAtTime(frequency * (params.ratio * 2.5), now);
            mod2Gain.gain.setValueAtTime(params.modIndex * 4, now);

            modulator2.connect(mod2Gain);
            mod2Gain.connect(modulator1.frequency);
            modulator1.connect(mod1Gain);
            mod1Gain.connect(carrier.frequency);
            break;
        case 'feedback': // C -> C, M1 -> C
            modulator1.frequency.setValueAtTime(frequency * params.ratio, now);
            mod1Gain.gain.setValueAtTime(params.modIndex, now);
            
            const feedbackGain = audioContext.createGain();
            feedbackGain.gain.setValueAtTime(params.modIndex / 2, now); // Feedback sutil

            carrier.connect(feedbackGain);
            feedbackGain.connect(carrier.frequency);
            modulator1.connect(mod1Gain);
            mod1Gain.connect(carrier.frequency);
            break;
        case 'simple': // M1 -> C
        default:
            modulator1.frequency.setValueAtTime(frequency * params.ratio, now);
            mod1Gain.gain.setValueAtTime(params.modIndex, now);
            modulator1.connect(mod1Gain);
            mod1Gain.connect(carrier.frequency);
            break;
    }

    carrier.connect(filterNode);
    filterNode.connect(gainNode);
    gainNode.connect(getMasterGainNode());

    const maxGain = 0.7;
    const sustainLevel = maxGain * params.sustain;

    gainNode.gain.cancelScheduledValues(now);
    gainNode.gain.setValueAtTime(0.001, now);
    gainNode.gain.exponentialRampToValueAtTime(maxGain, now + params.attack);
    gainNode.gain.exponentialRampToValueAtTime(Math.max(sustainLevel, 0.001), now + params.attack + params.decay);

    modulator1.start(now);
    modulator2.start(now);
    carrier.start(now);
    return { nodes: [carrier, modulator1, modulator2], gainNode, filterNode, note, startTime: now };
}

/**
* Para uma nota específica, aplicando o tempo de release definido.
* Remove a nota do estado global.
* @param {string} noteId - Identificador da nota.
* @param {boolean} [immediate=false] - Se true, aplica release imediato.
*/
export function stopNote(noteId, immediate = false) {
    const audioContext = getAudioContext();
    if (!activeNotes.has(noteId)) return;

    if (synthSettings.performance.hold && heldNotes.has(noteId) && !immediate) return;

    const { nodes, gainNode } = activeNotes.get(noteId);
    const now = audioContext.currentTime;
    const params = synthSettings[synthSettings.engine];
    const releaseTime = immediate ? 0.01 : params.release;

    gainNode.gain.cancelScheduledValues(now);
    gainNode.gain.setValueAtTime(gainNode.gain.value, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + releaseTime);

    nodes.forEach(osc => osc.stop(now + releaseTime + 0.1));

    activeNotes.delete(noteId);
    heldNotes.delete(noteId);
}

/**
* Para todas as notas ativas.
* @param {boolean} [immediate=false] - Se true, aplica release imediato em todas.
*/
export function stopAllNotes(immediate = false) {
    const notesToStop = new Map(activeNotes);
    notesToStop.forEach((_, noteId) => stopNote(noteId, immediate));
    document.querySelectorAll('.key.active').forEach(k => k.classList.remove('active'));
}
