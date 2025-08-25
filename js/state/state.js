/**
 * @file Gerencia o estado global do sintetizador.
 */

export const synthSettings = {
    engine: 'subtractive', // 'subtractive', 'fm', 'drum'
    
    subtractive: {
        waveform: 'sine',
        attack: 0.02, decay: 0.1, sustain: 0.8, release: 0.5,
        octaveShift: 0,
    },
    fm: {
        algorithm: 'series', // 'simple', 'parallel', 'series', 'feedback'
        ratio: 1.4, modIndex: 250,
        attack: 0.01, decay: 1.0, sustain: 0.5, release: 0.8,
        octaveShift: 0,
    },
    drum: {
        kit: 'acoustic', // 'acoustic', 'electronic', 'lofi', 'ethnic'
        kits: {
            acoustic: {
                kickTune: 0.3, snareSnap: 0.5, hatDecay: 0.06, tomPitch: 0.5, cymbalDecay: 0.8
            },
            electronic: {
                kickTune: 0.1, snareSnap: 0.8, hatDecay: 0.1, tomPitch: 0.2, cymbalDecay: 1.2
            },
            lofi: {
                kickTune: 0.6, snareSnap: 0.3, hatDecay: 0.08, tomPitch: 0.6, cymbalDecay: 0.6
            },
            ethnic: {
                kickTune: 0.8, snareSnap: 0.6, hatDecay: 0.04, tomPitch: 0.8, cymbalDecay: 0.7
            }
        },
        octaveShift: 0, // Parâmetro "dummy"
    },

    // Parâmetros globais, aplicáveis a todos os motores
    polyphony: 16,
    filterCutoff: 18000,
    lfoRate: 5, lfoDepth: 0,
    faderMode: 'cutoff', // 'cutoff' ou 'lfo'
    sequencerTempo: 120,
    effects: {
        reverb: false, delay: false, distortion: false
    },
    performance: {
        hold: false, arp: false, arpDirection: 'up'
    }
};

export const defaultSynthSettings = JSON.parse(JSON.stringify(synthSettings));

export let sequencerData = Array(16).fill(false);
export function setSequencerData(newData) { sequencerData = newData; }

export let arpNotes = [];
export let arpIndex = 0;
export let lastArpNoteId = null;
export function setArpNotes(notes) { arpNotes = notes; }
export function setArpIndex(index) { arpIndex = index; }
export function setLastArpNoteId(id) { lastArpNoteId = id; }

export const activeNotes = new Map();
export let heldNotes = new Set();
export let lastNotePlayed = 'C4';
export function setLastNotePlayed(note) { lastNotePlayed = note; }

export let activeKnobParameter = null;
export function setActiveKnobParameter(param) { activeKnobParameter = param; }

// Novo estado para a visualização do display
export let lastDrumSound = { type: null, time: 0 };
export function setLastDrumSound(type) {
    lastDrumSound = { type, time: performance.now() };
}
