/**
 * @file Gerencia o estado global do sintetizador.
 */

// O objeto principal de configurações para o motor de som do sintetizador.
export const synthSettings = {
    waveform: 'sine',
    attack: 0.02,
    decay: 0.1,
    sustain: 0.8,
    release: 0.5,
    polyphony: 16,
    octaveShift: 0,
    filterCutoff: 1000,
    lfoRate: 5,
    lfoDepth: 0,
    faderMode: 'cutoff', // 'cutoff' ou 'lfo'
    sequencerTempo: 120,
    effects: {
        reverb: false,
        delay: false,
        distortion: false
    },
    performance: {
        hold: false,
        mono: false,
        arp: false,
        arpDirection: 'up' // 'up' ou 'down'
    }
};

// Um clone profundo das configurações padrão para carregar presets vazios.
export const defaultSynthSettings = JSON.parse(JSON.stringify(synthSettings));

// Estado do sequenciador
export let sequencerData = Array(16).fill(false);

export function setSequencerData(newData) {
    sequencerData = newData;
}

// Estado do Arpejador
export let arpNotes = [];
export let arpIndex = 0;
export let lastArpNoteId = null;

export function setArpNotes(notes) {
    arpNotes = notes;
}
export function setArpIndex(index) {
    arpIndex = index;
}
export function setLastArpNoteId(id) {
    lastArpNoteId = id;
}

// Estado das notas ativas
export const activeNotes = new Map();
export let heldNotes = new Set();
export let lastNotePlayed = 'C4';

export function setLastNotePlayed(note) {
    lastNotePlayed = note;
}
