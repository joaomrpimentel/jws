/**
 * @file Lógica do sequenciador.
 */
import { playNote } from '../audio/note-engine.js';
import { synthSettings, sequencerData, lastNotePlayed } from '../state/state.js';

const sequencerStepsContainer = document.getElementById('sequencer-steps');
let sequencerIsPlaying = false;
let sequencerInterval = null;
let currentStep = 0;

/**
 * O loop principal do sequenciador, chamado por setInterval.
 */
function sequencerLoop() {
    const steps = sequencerStepsContainer.children;
    const prevStep = currentStep === 0 ? 15 : currentStep - 1;
    steps[prevStep].classList.remove('playing');
    steps[currentStep].classList.add('playing');

    if (sequencerData[currentStep]) {
        playNote(lastNotePlayed, 60 / synthSettings.sequencerTempo / 2);
    }
    currentStep = (currentStep + 1) % 16;
}

/**
 * Alterna a reprodução do sequenciador.
 */
function toggleSequencer() {
    sequencerIsPlaying = !sequencerIsPlaying;
    document.getElementById('sequencer-play-btn').classList.toggle('active', sequencerIsPlaying);

    if (sequencerIsPlaying) {
        currentStep = 0;
        const interval = (60 / synthSettings.sequencerTempo) * 1000 / 4;
        sequencerInterval = setInterval(sequencerLoop, interval);
    } else {
        clearInterval(sequencerInterval);
        sequencerInterval = null;
        const steps = sequencerStepsContainer.children;
        for (let i = 0; i < steps.length; i++) {
            steps[i].classList.remove('playing');
        }
    }
}

/**
 * Cria os elementos de passo do sequenciador e adiciona os listeners.
 */
export function setupSequencerUI() {
    for (let i = 0; i < 16; i++) {
        const step = document.createElement('div');
        step.className = 'seq-step';
        step.dataset.index = i;
        step.addEventListener('click', () => {
            sequencerData[i] = !sequencerData[i];
            step.classList.toggle('active', sequencerData[i]);
        });
        sequencerStepsContainer.appendChild(step);
    }
    document.getElementById('sequencer-play-btn').addEventListener('click', toggleSequencer);
}
