/**
 * @file Lógica de interação para os knobs.
 */
import { synthSettings } from '../state/state.js';
import { showTemporaryMessage, updateScreenInfo } from './display.js';

function setupKnobInteraction(knobElement, parameter, min, max, displayLabel) {
    knobElement.dataset.parameter = parameter;
    knobElement.dataset.min = min;
    knobElement.dataset.max = max;
    let isDragging = false, startY, startValue;

    const handleDrag = (e) => {
        if (!isDragging) return;
        e.preventDefault();
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        let newValue = startValue + ((startY - clientY) * (max - min) / 200);
        newValue = Math.max(min, Math.min(max, newValue));
        
        synthSettings[parameter] = newValue;
        if (parameter === 'octaveShift') {
            synthSettings.octaveShift = Math.round(newValue);
        }

        const rotation = -135 + ((newValue - min) / (max - min)) * 270;
        knobElement.style.setProperty('--knob-rotation', `${rotation}deg`);

        const displayValue = parameter === 'octaveShift' ? Math.round(newValue) : newValue.toFixed(2);
        showTemporaryMessage(`${displayLabel}: ${displayValue}`);
        updateScreenInfo();
    };

    const stopDrag = () => {
        isDragging = false;
        document.removeEventListener('mousemove', handleDrag);
        document.removeEventListener('touchmove', handleDrag);
        document.removeEventListener('mouseup', stopDrag);
        document.removeEventListener('touchend', stopDrag);
    };

    const startDrag = (e) => {
        isDragging = true;
        startY = e.touches ? e.touches[0].clientY : e.clientY;
        startValue = synthSettings[parameter];
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
    setupKnobInteraction(document.getElementById('knob-octave'), 'octaveShift', -2, 2, 'OCTAVE');
    setupKnobInteraction(document.getElementById('knob-attack'), 'attack', 0.01, 2, 'ATTACK');
    setupKnobInteraction(document.getElementById('knob-sustain'), 'sustain', 0, 1, 'SUSTAIN');
    setupKnobInteraction(document.getElementById('knob-decay'), 'decay', 0.01, 2, 'DECAY');
    setupKnobInteraction(document.getElementById('knob-release'), 'release', 0.01, 4, 'RELEASE');
}
