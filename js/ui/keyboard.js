/**
 * @file Lida com as interações do teclado (virtual e físico).
 * @description Este módulo conecta o teclado virtual exibido na UI e o teclado físico do computador
 * ao mecanismo de áudio, permitindo tocar, parar notas e interagir com os modos de performance (arp, hold, drum).
 */
import { playNote, stopNote } from '../audio/note-engine.js';
import { addToArp } from '../features/arpeggiator.js';
import { synthSettings, setLastNotePlayed, setArpNotes, arpNotes, lastArpNoteId } from '../state/state.js';
import { noteFrequencies, keyToNoteMap } from '../utils/constants.js';

const keyboardContainer = document.getElementById('keyboard');

/**
 * Inicializa o teclado virtual e listeners do teclado físico.
 * 
 * - Cria dinamicamente as teclas do teclado virtual.
 * - Configura eventos de mouse/toque para interação no navegador.
 * - Configura eventos de teclado físico (keydown/keyup) para mapear teclas a notas.
 * - Integra com modos de performance (arp, hold).
 * - Diferencia comportamento entre sons sustentados e percussivos (drum).
 */
export function setupKeyboard() {
    // --- Listeners do Teclado (Mouse/Toque) ---
    Object.keys(noteFrequencies).forEach(note => {
        const keyElement = document.createElement('div');
        keyElement.className = 'key';
        keyElement.dataset.note = note;
        keyboardContainer.appendChild(keyElement);

        let currentNoteId = null;

        /**
         * Inicia a reprodução da nota ao pressionar (mousedown/touchstart).
         * @param {MouseEvent|TouchEvent} e - Evento de interação.
         */
        const startNoteHandler = (e) => {
            e.preventDefault();
            setLastNotePlayed(note);
            if (e.type === 'mousedown' && e.button !== 0) return;

            if (!keyElement.classList.contains('active')) {
                if (synthSettings.performance.arp && synthSettings.engine !== 'drum') {
                    addToArp(note);
                } else {
                    currentNoteId = playNote(note);
                }
                keyElement.classList.add('active');
            }
        };

        /**
         * Para a nota ao soltar (mouseup/touchend).
         * - Respeita o modo hold (não solta notas se ativo).
         * - Para bateria (drum), apenas remove classe ativa (sem release).
         * @param {MouseEvent|TouchEvent} e - Evento de interação.
         */
        const stopNoteHandler = (e) => {
            e.preventDefault();
            if (synthSettings.performance.hold) return;
            
            if (synthSettings.engine === 'drum') {
                keyElement.classList.remove('active');
                return;
            }

            keyElement.classList.remove('active');

            if (synthSettings.performance.arp) {
                const newArpNotes = arpNotes.filter(n => n !== note);
                setArpNotes(newArpNotes);
                if (newArpNotes.length === 0 && lastArpNoteId) {
                    stopNote(lastArpNoteId, true);
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

    /**
     * Inicia nota via teclado físico.
     * @param {KeyboardEvent} e - Evento de pressionamento de tecla.
     */
    window.addEventListener('keydown', e => {
        if (e.repeat) return;
        const note = keyToNoteMap[e.key.toLowerCase()];
        if (note && !keyboardNotes[note]) {
            setLastNotePlayed(note);
            keyboardNotes[note] = true; // Marca a tecla como pressionada

            if (synthSettings.performance.arp && synthSettings.engine !== 'drum') {
                addToArp(note);
            } else {
                const noteId = playNote(note);
                if (noteId) {
                    keyboardNotes[note] = noteId;
                }
            }
            document.querySelector(`[data-note="${note}"]`)?.classList.add('active');
        }
    });

    /**
     * Para nota via teclado físico.
     * - Respeita hold (não solta notas).
     * - Para drum, apenas remove classe ativa (sem release).
     * @param {KeyboardEvent} e - Evento de liberação de tecla.
     */
    window.addEventListener('keyup', e => {
        const note = keyToNoteMap[e.key.toLowerCase()];
        if (note) {
            if (synthSettings.performance.hold) {
                delete keyboardNotes[note];
                return;
            }
            
            document.querySelector(`[data-note="${note}"]`)?.classList.remove('active');

            if (synthSettings.engine === 'drum') {
                // Não faz nada no keyup para bateria
            } else if (synthSettings.performance.arp) {
                const newArpNotes = arpNotes.filter(n => n !== note);
                setArpNotes(newArpNotes);
                if (newArpNotes.length === 0 && lastArpNoteId) {
                    stopNote(lastArpNoteId, true);
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
