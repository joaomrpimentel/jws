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

/**
 * Atualiza todos os elementos da UI para refletir os valores atuais em synthSettings.
 */
export function updateUIFromState() {
    // Knobs
    document.querySelectorAll('.knob').forEach(knob => {
        const parameter = knob.dataset.parameter;
        if (synthSettings[parameter] !== undefined) {
            const min = parseFloat(knob.dataset.min);
            const max = parseFloat(knob.dataset.max);
            const value = synthSettings[parameter];
            const rotation = -135 + ((value - min) / (max - min)) * 270;
            knob.style.setProperty('--knob-rotation', `${rotation}deg`);
        }
    });

    // Fader
    const mainFader = document.getElementById('main-fader');
    const faderModeBtn = document.getElementById('fader-mode-btn');
    if (synthSettings.faderMode === 'cutoff') {
        mainFader.value = logToLinear(synthSettings.filterCutoff);
        faderModeBtn.textContent = 'CUT';
        faderModeBtn.classList.remove('active');
    } else {
        mainFader.value = synthSettings.lfoDepth;
        faderModeBtn.textContent = 'MOD';
        faderModeBtn.classList.add('active');
    }

    // Botões de Controle (Wave, Perform, Effect)
    document.querySelectorAll('.control-btn').forEach(btn => {
        const wave = btn.dataset.wave;
        const perform = btn.dataset.perform;
        const effect = btn.dataset.effect;
        if (wave) btn.classList.toggle('active', synthSettings.waveform === wave);
        if (perform) btn.classList.toggle('active', synthSettings.performance[perform]);
        if (effect) btn.classList.toggle('active', synthSettings.effects[effect]);
    });
    
    // Botões de direção do Arp
    const arpUpBtn = document.getElementById('arp-up-btn');
    const arpDownBtn = document.getElementById('arp-down-btn');
    if (synthSettings.performance.arp) {
        arpUpBtn.classList.toggle('active', synthSettings.performance.arpDirection === 'up');
        arpDownBtn.classList.toggle('active', synthSettings.performance.arpDirection === 'down');
    } else {
        arpUpBtn.classList.remove('active');
        arpDownBtn.classList.remove('active');
    }

    // Sequenciador
    const steps = document.getElementById('sequencer-steps').children;
    for (let i = 0; i < steps.length; i++) {
        steps[i].classList.toggle('active', sequencerData[i]);
    }

    updateScreenInfo();
}


export function setupControls() {
    // --- Fader ---
    const mainFader = document.getElementById('main-fader');
    mainFader.addEventListener('input', (e) => {
        const value = parseFloat(e.target.value);
        if (synthSettings.faderMode === 'cutoff') {
            synthSettings.filterCutoff = linearToLog(value);
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

    // --- Botões de Waveform ---
    document.querySelectorAll('.control-btn[data-wave]').forEach(button => {
        button.addEventListener('click', () => {
            synthSettings.waveform = button.dataset.wave;
            updateUIFromState();
        });
    });

    // --- Botões de Performance ---
    document.querySelectorAll('[data-perform]').forEach(button => {
        const performType = button.getAttribute('data-perform');
        button.addEventListener('click', () => {
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

    // --- Botões de Efeitos ---
    document.querySelectorAll('[data-effect]').forEach(button => {
        const effectType = button.getAttribute('data-effect');
        button.addEventListener('click', () => {
            synthSettings.effects[effectType] = !synthSettings.effects[effectType];
            toggleEffect(effectType);
            showTemporaryMessage(`${effectType.toUpperCase()}: ${synthSettings.effects[effectType] ? 'ON' : 'OFF'}`);
            updateUIFromState();
        });
    });

    // --- Botões de Direção do Arp ---
    [document.getElementById('arp-up-btn'), document.getElementById('arp-down-btn')].forEach(button => {
        button.addEventListener('click', () => {
            synthSettings.performance.arpDirection = button.dataset.direction;
            updateUIFromState();
        });
    });

    // --- Botões de Preset ---
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
            if (!isHeld) loadPreset(index);
        });
    });
}
