/**
 * @file Lógica de interação para os knobs contextuais.
 */
import { synthSettings, setActiveKnobParameter } from '../state/state.js';
import { setLiveDisplayText, updateScreenInfo } from './display.js';

// Mapeamento de knobs para parâmetros de cada motor
const knobMapping = {
    'knob-1': {
        subtractive: { param: 'octaveShift', min: -2, max: 2, label: 'OCTAVE' },
        fm: { param: 'ratio', min: 0.1, max: 10, label: 'RATIO' },
        drum: { param: 'kickDecay', min: 0.1, max: 1.5, label: 'KICK DECAY' }
    },
    'knob-2': {
        subtractive: { param: 'attack', min: 0.01, max: 2, label: 'ATTACK' },
        fm: { param: 'attack', min: 0.01, max: 2, label: 'ATTACK' },
        drum: { param: 'snareTone', min: 0, max: 1, label: 'SNARE TONE' }
    },
    'knob-3': {
        subtractive: { param: 'sustain', min: 0, max: 1, label: 'SUSTAIN' },
        fm: { param: 'modIndex', min: 0, max: 1000, label: 'MOD INDEX' },
        drum: { param: 'hatDecay', min: 0.01, max: 0.5, label: 'HAT DECAY' }
    },
    'knob-4': {
        subtractive: { param: 'decay', min: 0.01, max: 2, label: 'DECAY' },
        fm: { param: 'decay', min: 0.01, max: 3, label: 'DECAY' },
        drum: { param: 'tomPitch', min: 0, max: 1, label: 'TOM PITCH' }
    },
    'knob-5': {
        subtractive: { param: 'release', min: 0.01, max: 4, label: 'RELEASE' },
        fm: { param: 'release', min: 0.01, max: 4, label: 'RELEASE' },
        drum: { param: 'release', min: 0.01, max: 4, label: 'GLB RELEASE' } // Exemplo, pode não ser usado
    }
};

const knobElements = {
    'knob-1': document.getElementById('knob-1'),
    'knob-2': document.getElementById('knob-2'),
    'knob-3': document.getElementById('knob-3'),
    'knob-4': document.getElementById('knob-4'),
    'knob-5': document.getElementById('knob-5'),
};

export function updateKnobLabels(engine) {
    document.getElementById('knob-label-1').textContent = {subtractive: 'OCT', fm: 'RAT', drum: 'KICK'}[engine];
    document.getElementById('knob-label-2').textContent = {subtractive: 'ATK', fm: 'ATK', drum: 'SNAR'}[engine];
    document.getElementById('knob-label-3').textContent = {subtractive: 'SUS', fm: 'MOD', drum: 'HAT'}[engine];
    document.getElementById('knob-label-4').textContent = {subtractive: 'DEC', fm: 'DEC', drum: 'TOM'}[engine];
    document.getElementById('knob-label-5').textContent = 'REL';
}

export function updateKnobValues() {
    const engine = synthSettings.engine;
    for (const knobId in knobElements) {
        const knobElement = knobElements[knobId];
        const config = knobMapping[knobId][engine];
        
        let valueSource = synthSettings[engine];
        // Caso especial para os knobs de bateria, que leem do kit ativo
        if (engine === 'drum' && config.param !== 'release') {
            valueSource = synthSettings.drum.kits[synthSettings.drum.kit];
        }

        if (config && valueSource[config.param] !== undefined) {
            const value = valueSource[config.param];
            const rotation = -135 + ((value - config.min) / (config.max - config.min)) * 270;
            knobElement.style.setProperty('--knob-rotation', `${rotation}deg`);
        }
    }
}

function setupKnobInteraction(knobId) {
    const knobElement = knobElements[knobId];
    let isDragging = false, startY, startValue, config;

    const handleDrag = (e) => {
        if (!isDragging) return;
        e.preventDefault();
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        let newValue = startValue + ((startY - clientY) * (config.max - config.min) / 200);
        newValue = Math.max(config.min, Math.min(config.max, newValue));
        
        const engine = synthSettings.engine;
        let valueTarget = synthSettings[engine];
        if (engine === 'drum' && config.param !== 'release') {
            valueTarget = synthSettings.drum.kits[synthSettings.drum.kit];
        }
        
        valueTarget[config.param] = newValue;
        
        if (config.param === 'octaveShift') {
            valueTarget.octaveShift = Math.round(newValue);
        }

        updateKnobValues(); // Atualiza o knob visualmente

        const displayValue = config.param === 'octaveShift' ? Math.round(newValue) : newValue.toFixed(2);
        setLiveDisplayText(`${config.label}: ${displayValue}`);
        updateScreenInfo();
    };

    const stopDrag = () => {
        isDragging = false;
        setActiveKnobParameter(null);
        setLiveDisplayText('');
        document.removeEventListener('mousemove', handleDrag);
        document.removeEventListener('touchmove', handleDrag);
        document.removeEventListener('mouseup', stopDrag);
        document.removeEventListener('touchend', stopDrag);
    };

    const startDrag = (e) => {
        const engine = synthSettings.engine;
        config = knobMapping[knobId][engine];
        if (!config) return;
        
        isDragging = true;
        setActiveKnobParameter(config.param);
        startY = e.touches ? e.touches[0].clientY : e.clientY;

        let valueSource = synthSettings[engine];
        if (engine === 'drum' && config.param !== 'release') {
            valueSource = synthSettings.drum.kits[synthSettings.drum.kit];
        }
        startValue = valueSource[config.param];
        
        document.addEventListener('mousemove', handleDrag);
        document.addEventListener('mouseup', stopDrag);
        document.addEventListener('touchmove', handleDrag, { passive: false });
        document.addEventListener('touchend', stopDrag);
        e.preventDefault();
    };

    knobElement.addEventListener('mousedown', startDrag);
    knobElement.addEventListener('touchstart', startDrag, { passive: false });
}

export function setupKnobs() {
    for (const knobId in knobElements) {
        setupKnobInteraction(knobId);
    }
}
