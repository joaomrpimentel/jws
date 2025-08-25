/**
 * @file Lida com as interações do teclado (virtual e físico).
 */
import { playNote, stopNote } from '../audio/note-engine.js';
import { addToArp } from '../features/arpeggiator.js';
import { synthSettings, setLastNotePlayed, setArpNotes, arpNotes, lastArpNoteId } from '../state/state.js';
import { noteFrequencies, keyToNoteMap } from '../utils/constants.js';

const keyboardContainer = document.getElementById('keyboard');

export function setupKeyboard() {
    // --- Listeners do Teclado (Mouse/Toque) ---
    Object.keys(noteFrequencies).forEach(note => {
        const keyElement = document.createElement('div');
        keyElement.className = 'key';
        keyElement.dataset.note = note;
        keyboardContainer.appendChild(keyElement);

        let currentNoteId = null;

        const startNoteHandler = (e) => {
            if (synthSettings.engine === 'drum') return;
            e.preventDefault();
            setLastNotePlayed(note);
            if (e.type === 'mousedown' && e.button !== 0) return;

            if (!keyElement.classList.contains('active')) {
                if (synthSettings.performance.arp) {
                    addToArp(note);
                } else {
                    currentNoteId = playNote(note);
                }
                keyElement.classList.add('active');
            }
        };

        const stopNoteHandler = (e) => {
            if (synthSettings.engine === 'drum') return;
            e.preventDefault();
            if (synthSettings.performance.hold) return;
            keyElement.classList.remove('active');

            if (synthSettings.performance.arp) {
                const newArpNotes = arpNotes.filter(n => n !== note);
                setArpNotes(newArpNotes);
                if (newArpNotes.length === 0) {
                    if (lastArpNoteId) {
                        stopNote(lastArpNoteId, true);
                    }
                }
            } else {
                if (currentNoteId) stopNote(currentNoteId);
                currentNoteId = null;
            }
        };

        keyElement.addEventListener('mousedown', startNoteHandler);
        keyElement.addEventListener('mouseup', stopNoteHandler);
        keyElement.addEventListener('mouseleave', stopNoteHandler);
        keyElement.addEventListener('touchstart', startNoteHandler, { passive: false });
        keyElement.addEventListener('touchend', stopNoteHandler);
    });

    // --- Listeners do Teclado (Computador) ---
    const keyboardNotes = {};
    window.addEventListener('keydown', e => {
        if (e.repeat || synthSettings.engine === 'drum') return;
        const note = keyToNoteMap[e.key.toLowerCase()];
        if (note && !keyboardNotes[note]) {
            setLastNotePlayed(note);
            keyboardNotes[note] = true;
            if (synthSettings.performance.arp) {
                addToArp(note);
            } else {
                keyboardNotes[note] = playNote(note);
            }
            document.querySelector(`[data-note="${note}"]`)?.classList.add('active');
        }
    });

    window.addEventListener('keyup', e => {
        if (synthSettings.engine === 'drum') return;
        const note = keyToNoteMap[e.key.toLowerCase()];
        if (note) {
            if (synthSettings.performance.hold) {
                delete keyboardNotes[note];
                return;
            }
            document.querySelector(`[data-note="${note}"]`)?.classList.remove('active');

            if (synthSettings.performance.arp) {
                const newArpNotes = arpNotes.filter(n => n !== note);
                setArpNotes(newArpNotes);
                if (newArpNotes.length === 0) {
                     if (lastArpNoteId) {
                        stopNote(lastArpNoteId, true);
                    }
                }
            } else {
                if (keyboardNotes[note] && typeof keyboardNotes[note] === 'string') {
                    stopNote(keyboardNotes[note]);
                }
            }
            delete keyboardNotes[note];
        }
    });
}
