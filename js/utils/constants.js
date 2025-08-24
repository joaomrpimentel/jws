/**
 * @file Constantes e mapeamentos usados em todo o sintetizador.
 */

// Frequências das notas na oitava base
export const noteFrequencies = {
    'C4': 261.63, 'Db4': 277.18, 'D4': 293.66, 'Eb4': 311.13, 'E4': 329.63, 'F4': 349.23,
    'Gb4': 369.99, 'G4': 392.00, 'Ab4': 415.30, 'A4': 440.00, 'Bb4': 466.16, 'B4': 493.88,
    'C5': 523.25
};

// Mapeamento de teclas do teclado do computador para notas
export const keyToNoteMap = {
    'a': 'C4', 'w': 'Db4', 's': 'D4', 'e': 'Eb4', 'd': 'E4', 'f': 'F4', 't': 'Gb4',
    'g': 'G4', 'y': 'Ab4', 'h': 'A4', 'u': 'Bb4', 'j': 'B4', 'k': 'C5'
};

// Ganhos específicos para cada forma de onda para normalizar o volume
export const waveformGains = {
    sine: 0.8,
    square: 0.4,
    sawtooth: 0.5,
    triangle: 0.7
};

// Constantes para o slider de frequência do filtro
export const MIN_FREQ = 40;
export const MAX_FREQ = 18000;
