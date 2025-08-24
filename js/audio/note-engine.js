/**
 * @file Lógica para tocar e parar notas individuais.
 */
import { getAudioContext, getMasterGainNode, getLfoGain } from './audio-core.js';
import { synthSettings, activeNotes, heldNotes } from '../state/state.js';
import { noteFrequencies, waveformGains } from '../utils/constants.js';

let globalId = 0;

/**
 * Cria e toca uma única nota de sintetizador.
 * @param {string} note A nota a ser tocada (ex: 'C4', 'Db4').
 * @param {number|null} duration Duração opcional em segundos para auto-release.
 * @returns {string} O ID único da nota criada.
 */
export function playNote(note, duration = null) {
    const audioContext = getAudioContext();
    if (!audioContext || !noteFrequencies[note]) return;

    if (synthSettings.performance.mono && activeNotes.size > 0) {
        activeNotes.forEach((_, noteId) => stopNote(noteId, true));
    }

    const maxNotes = synthSettings.performance.hold ? synthSettings.polyphony : synthSettings.polyphony - 2;
    if (activeNotes.size >= maxNotes) {
        const oldestNote = activeNotes.keys().next().value;
        stopNote(oldestNote, true);
    }

    const frequency = noteFrequencies[note] * Math.pow(2, synthSettings.octaveShift);
    const now = audioContext.currentTime;
    const noteId = `${note}-${++globalId}`;

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    const filterNode = audioContext.createBiquadFilter();
    const masterGainNode = getMasterGainNode();
    const lfoGain = getLfoGain();

    oscillator.type = synthSettings.waveform;
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.detune.setValueAtTime((Math.random() - 0.5) * 8, now);

    filterNode.type = 'lowpass';
    filterNode.frequency.setValueAtTime(synthSettings.filterCutoff, now);
    filterNode.Q.setValueAtTime(1, now);

    lfoGain.connect(filterNode.frequency);
    oscillator.connect(filterNode);
    filterNode.connect(gainNode);
    gainNode.connect(masterGainNode);

    const maxGain = (waveformGains[synthSettings.waveform] || 0.8) * 0.8;
    const sustainLevel = maxGain * synthSettings.sustain;

    gainNode.gain.cancelScheduledValues(now);
    gainNode.gain.setValueAtTime(0.001, now);
    gainNode.gain.exponentialRampToValueAtTime(maxGain, now + synthSettings.attack);
    gainNode.gain.exponentialRampToValueAtTime(Math.max(sustainLevel, 0.001), now + synthSettings.attack + synthSettings.decay);

    oscillator.start(now);
    activeNotes.set(noteId, { oscillator, gainNode, filterNode, note, startTime: now });

    if (synthSettings.performance.hold) {
        heldNotes.add(noteId);
    }

    if (duration) {
        setTimeout(() => stopNote(noteId), duration * 1000);
    }

    return noteId;
}

/**
 * Para uma nota em execução, acionando seu envelope de release.
 * @param {string} noteId O ID único da nota a ser parada.
 * @param {boolean} [immediate=false] Se verdadeiro, ignora a fase de release.
 */
export function stopNote(noteId, immediate = false) {
    const audioContext = getAudioContext();
    if (!audioContext || !activeNotes.has(noteId)) return;

    if (synthSettings.performance.hold && heldNotes.has(noteId) && !immediate) return;

    const { oscillator, gainNode } = activeNotes.get(noteId);
    const now = audioContext.currentTime;

    gainNode.gain.cancelScheduledValues(now);
    gainNode.gain.setValueAtTime(gainNode.gain.value, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + synthSettings.release);

    oscillator.stop(now + synthSettings.release + 0.1);

    activeNotes.delete(noteId);
    heldNotes.delete(noteId);
}

/**
 * Para todas as notas atualmente tocando ou seguras.
 * @param {boolean} [immediate=false] Se verdadeiro, para todas as notas instantaneamente.
 */
export function stopAllNotes(immediate = false) {
    const notesToStop = new Map(activeNotes);
    notesToStop.forEach((_, noteId) => stopNote(noteId, immediate));
    document.querySelectorAll('.key.active').forEach(k => k.classList.remove('active'));
}
