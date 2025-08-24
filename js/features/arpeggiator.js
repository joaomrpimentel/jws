/**
 * @file Lógica do arpejador.
 */
import { playNote, stopNote, stopAllNotes } from '../audio/note-engine.js';
import { synthSettings, arpNotes, arpIndex, lastArpNoteId, setArpIndex, setLastArpNoteId, setArpNotes } from '../state/state.js';
import { noteFrequencies } from '../utils/constants.js';

let arpeggiatorInterval = null;

/**
 * Inicia o intervalo do arpejador.
 */
export function startArpeggiator() {
    if (arpeggiatorInterval) return;
    setArpIndex(0);
    arpeggiatorInterval = setInterval(() => {
        if (lastArpNoteId) {
            stopNote(lastArpNoteId, true);
        }
        if (arpNotes.length > 0) {
            const sortedNotes = [...arpNotes].sort((a, b) => noteFrequencies[a] - noteFrequencies[b]);
            let noteToPlay;
            if (synthSettings.performance.arpDirection === 'down') {
                const descendingIndex = sortedNotes.length - 1 - arpIndex;
                noteToPlay = sortedNotes[descendingIndex];
            } else {
                noteToPlay = sortedNotes[arpIndex];
            }
            const newNoteId = playNote(noteToPlay);
            setLastArpNoteId(newNoteId);
            setArpIndex((arpIndex + 1) % arpNotes.length);
        }
    }, 200);
}

/**
 * Para o arpejador.
 */
export function stopArpeggiator() {
    if (arpeggiatorInterval) {
        clearInterval(arpeggiatorInterval);
        arpeggiatorInterval = null;
        if (lastArpNoteId) {
            stopNote(lastArpNoteId, true);
            setLastArpNoteId(null);
        }
        setArpNotes([]);
        setArpIndex(0);
        stopAllNotes(true);
    }
}

/**
 * Adiciona uma nota à lista do arpejador.
 * @param {string} note A nota a ser adicionada.
 */
export function addToArp(note) {
    if (!arpNotes.includes(note)) {
        const newArpNotes = [...arpNotes, note];
        setArpNotes(newArpNotes);
    }
}
