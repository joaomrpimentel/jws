/**
 * @file Event listeners para os botões de controle, fader e presets.
 */
import { synthSettings, sequencerData, setArpNotes } from '../state/state.js';
import { updateAllFilters, toggleEffect, getLfoGain } from '../audio/audio-core.js';
import { stopAllNotes } from '../audio/note-engine.js';
import { startArpeggiator, stopArpeggiator } from '../features/arpeggiator.js';
import { savePreset, loadPreset } from '../features/presets.js';
import { linearToLog, logToLinear } from '../utils/helpers.js';
import { showTemporaryMessage, updateScreenInfo } from './display.js';
import { updateKnobLabels, updateKnobValues } from './knobs.js';

const availableEngines = ['subtractive', 'fm', 'drum'];
const instrumentBtns = [
    document.getElementById('instrument-btn-1'),
    document.getElementById('instrument-btn-2'),
    document.getElementById('instrument-btn-3'),
    document.getElementById('instrument-btn-4'),
];

const engineSettings = {
    subtractive: {
        options: ['sine', 'square', 'sawtooth', 'triangle'],
        param: 'waveform',
        icons: ['ph-wave-sine', 'ph-wave-square', 'ph-wave-sawtooth', 'ph-wave-triangle']
    },
    fm: {
        options: ['bell', 'brass', 'bass', 'sine'],
        param: 'algorithm',
        icons: ['ph-bell', 'ph-speaker-hifi', 'ph-radio', 'ph-wave-sine']
    },
    drum: {
        options: ['acoustic', 'electronic'],
        param: 'kit',
        icons: ['ph-drum', 'ph-robot', 'ph-leaf', 'ph-alien'] // Apenas 2 kits por enquanto
    }
};

function setupInstrumentButtonListeners() {
    const engine = synthSettings.engine;
    const config = engineSettings[engine];

    instrumentBtns.forEach((btn, index) => {
        // Remove listener antigo para evitar acúmulo
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        instrumentBtns[index] = newBtn;

        if (config.options[index]) {
            newBtn.addEventListener('click', () => {
                synthSettings[engine][config.param] = config.options[index];
                updateUIFromState();
            });
        }
    });
}


/**
 * Atualiza a UI para refletir o motor de som atual.
 */
function updateUIForEngine() {
    const engine = synthSettings.engine;
    const config = engineSettings[engine];
    const synthContainer = document.getElementById('synth-container');
    
    synthContainer.className = 'synth-container';
    synthContainer.classList.add(`engine-${engine}`);

    document.getElementById('arp-btn').classList.toggle('disabled', engine === 'drum');

    instrumentBtns.forEach((btn, index) => {
        btn.innerHTML = `<i class="ph-fill ${config.icons[index]}"></i>`;
        btn.classList.toggle('disabled', !config.options[index]);
    });

    setupInstrumentButtonListeners();
    updateKnobLabels(engine);
    updateKnobValues();
    updateScreenInfo();
}

/**
 * Atualiza todos os elementos da UI para refletir os valores atuais em synthSettings.
 */
export function updateUIFromState() {
    updateKnobValues();

    const mainFader = document.getElementById('main-fader');
    const faderModeBtn = document.getElementById('fader-mode-btn');
    const engine = synthSettings.engine;
    const currentEngineParams = synthSettings[engine];

    if (synthSettings.faderMode === 'cutoff') {
        mainFader.value = logToLinear(currentEngineParams.filterCutoff);
        faderModeBtn.textContent = 'CUT';
        faderModeBtn.classList.remove('active');
    } else {
        mainFader.value = synthSettings.lfoDepth;
        faderModeBtn.textContent = 'MOD';
        faderModeBtn.classList.add('active');
    }
    
    const config = engineSettings[engine];
    instrumentBtns.forEach((btn, index) => {
        if(config.options[index]) {
            btn.classList.toggle('active', currentEngineParams[config.param] === config.options[index]);
        }
    });

    document.querySelectorAll('[data-perform]').forEach(button => {
        const performType = button.getAttribute('data-perform');
        button.classList.toggle('active', synthSettings.performance[performType]);
    });
    document.querySelectorAll('[data-effect]').forEach(button => {
        const effectType = button.getAttribute('data-effect');
        button.classList.toggle('active', synthSettings.effects[effectType]);
    });
    
    const arpUpBtn = document.getElementById('arp-up-btn');
    const arpDownBtn = document.getElementById('arp-down-btn');
    if (synthSettings.performance.arp) {
        arpUpBtn.classList.toggle('active', synthSettings.performance.arpDirection === 'up');
        arpDownBtn.classList.toggle('active', synthSettings.performance.arpDirection === 'down');
    } else {
        arpUpBtn.classList.remove('active');
        arpDownBtn.classList.remove('active');
    }

    const steps = document.getElementById('sequencer-steps').children;
    for (let i = 0; i < steps.length; i++) {
        steps[i].classList.toggle('active', sequencerData[i]);
    }

    updateScreenInfo();
}


export function setupControls() {
    const mainFader = document.getElementById('main-fader');
    mainFader.addEventListener('input', (e) => {
        const value = parseFloat(e.target.value);
        if (synthSettings.faderMode === 'cutoff') {
            synthSettings[synthSettings.engine].filterCutoff = linearToLog(value);
            updateAllFilters();
        } else {
            synthSettings.lfoDepth = value;
            const lfoGain = getLfoGain();
            if (lfoGain) lfoGain.gain.setTargetAtTime(value, lfoGain.context.currentTime, 0.01);
        }
        updateScreenInfo();
    });

    document.getElementById('fader-mode-btn').addEventListener('click', () => {
        synthSettings.faderMode = synthSettings.faderMode === 'cutoff' ? 'lfo' : 'cutoff';
        updateUIFromState();
    });

    document.querySelectorAll('[data-perform]').forEach(button => {
        const performType = button.getAttribute('data-perform');
        button.addEventListener('click', () => {
            if (button.classList.contains('disabled')) return;
            synthSettings.performance[performType] = !synthSettings.performance[performType];
            showTemporaryMessage(`${performType.toUpperCase()}: ${synthSettings.performance[performType] ? 'ON' : 'OFF'}`);
            if (performType === 'arp') {
                if (synthSettings.performance.arp) startArpeggiator();
                else stopArpeggiator();
            }
            if (performType === 'hold' && !synthSettings.performance.hold) {
                stopAllNotes(false);
                setArpNotes([]);
            }
            updateUIFromState();
        });
    });

    document.querySelectorAll('[data-effect]').forEach(button => {
        const effectType = button.getAttribute('data-effect');
        button.addEventListener('click', () => {
            synthSettings.effects[effectType] = !synthSettings.effects[effectType];
            toggleEffect(effectType);
            showTemporaryMessage(`${effectType.toUpperCase()}: ${synthSettings.effects[effectType] ? 'ON' : 'OFF'}`);
            updateUIFromState();
        });
    });

    [document.getElementById('arp-up-btn'), document.getElementById('arp-down-btn')].forEach(button => {
        button.addEventListener('click', () => {
            synthSettings.performance.arpDirection = button.dataset.direction;
            updateUIFromState();
        });
    });

    document.getElementById('engine-btn').addEventListener('click', () => {
        const currentIndex = availableEngines.indexOf(synthSettings.engine);
        const nextIndex = (currentIndex + 1) % availableEngines.length;
        synthSettings.engine = availableEngines[nextIndex];
        showTemporaryMessage(`ENGINE: ${synthSettings.engine.toUpperCase()}`);
        updateUIForEngine();
        updateUIFromState();
    });

    document.querySelectorAll('.num-btn').forEach(button => {
        const index = parseInt(button.dataset.preset, 10) - 1;
        let pressTimer, isHeld = false;
        const startPress = (e) => {
            e.preventDefault();
            isHeld = false;
            pressTimer = setTimeout(() => {
                isHeld = true;
                savePreset(index);
                button.classList.add('saving');
                setTimeout(() => button.classList.remove('saving'), 500);
            }, 800);
        };
        const cancelPress = () => clearTimeout(pressTimer);
        button.addEventListener('mousedown', startPress);
        button.addEventListener('touchstart', startPress, { passive: true });
        button.addEventListener('mouseup', cancelPress);
        button.addEventListener('mouseleave', cancelPress);
        button.addEventListener('touchend', cancelPress);
        button.addEventListener('click', () => {
            if (!isHeld) {
                loadPreset(index);
                updateUIForEngine();
                updateUIFromState();
            }
        });
    });
    
    // Configuração inicial
    updateUIForEngine();
    updateUIFromState();
}
