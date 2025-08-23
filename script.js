// DOM ELEMENT REFERENCES
const keyboardContainer = document.getElementById('keyboard');
const displayMessage = document.getElementById('display-message');
const displayCanvas = document.getElementById('display-canvas');
const displayCtx = displayCanvas.getContext('2d');
const displayParams = {
    p1: document.getElementById('display-param1'),
    p2: document.getElementById('display-param2'),
    p3: document.getElementById('display-param3'),
};
const sequencerStepsContainer = document.getElementById('sequencer-steps');

// AUDIO CONTEXT AND SETTINGS
let audioContext;
let masterGainNode;
let effectsChain = {};
let lfo, lfoGain;
const activeNotes = new Map();
let globalId = 0;
let heldNotes = new Set();
let arpeggiatorInterval = null;
let arpNotes = [];
let arpIndex = 0;
let currentScreenView = 'adsr';

// --- SEQUENCER STATE ---
let sequencerData = Array(16).fill(false);
let sequencerIsPlaying = false;
let sequencerInterval = null;
let currentStep = 0;
let lastNotePlayed = 'C4'; // Default note for sequencer

const synthSettings = {
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
    faderMode: 'cutoff',
    sequencerTempo: 120,
    effects: {
        reverb: false,
        delay: false,
        distortion: false
    },
    performance: {
        hold: false,
        mono: false,
        arp: false
    }
};

const presets = [{}, {}, {}, {}];
const defaultSynthSettings = JSON.parse(JSON.stringify(synthSettings));

const waveformGains = { sine: 0.8, square: 0.4, sawtooth: 0.5, triangle: 0.7 };
const noteFrequencies = { 'C4': 261.63, 'Db4': 277.18, 'D4': 293.66, 'Eb4': 311.13, 'E4': 329.63, 'F4': 349.23, 'Gb4': 369.99, 'G4': 392.00, 'Ab4': 415.30, 'A4': 440.00, 'Bb4': 466.16, 'B4': 493.88, 'C5': 523.25 };
const keyToNoteMap = { 'a': 'C4', 'w': 'Db4', 's': 'D4', 'e': 'Eb4', 'd': 'E4', 'f': 'F4', 't': 'Gb4', 'g': 'G4', 'y': 'Ab4', 'h': 'A4', 'u': 'Bb4', 'j': 'B4', 'k': 'C5' };

// AUDIO FUNCTIONS
function initAudio() {
    if (!audioContext) {
        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            masterGainNode = audioContext.createGain();
            masterGainNode.gain.value = 0.7;
            lfo = audioContext.createOscillator();
            lfo.frequency.value = synthSettings.lfoRate;
            lfoGain = audioContext.createGain();
            lfoGain.gain.value = synthSettings.lfoDepth;
            lfo.connect(lfoGain);
            lfo.start();
            initEffects();
            showTemporaryMessage('AUDIO ON');
        } catch (e) {
            console.error("Web Audio API error:", e);
            showTemporaryMessage('ERROR');
        }
    }
}

function initEffects() {
    const finalOutput = audioContext.createGain();
    finalOutput.gain.value = 1.0;
    const compressor = audioContext.createDynamicsCompressor();
    const reverbInput = audioContext.createGain();
    const reverbOutput = audioContext.createGain();
    const reverbWet = audioContext.createGain();
    const reverbDry = audioContext.createGain();
    const convolver = audioContext.createConvolver();
    convolver.buffer = createReverbImpulse();
    reverbWet.gain.value = 0;
    reverbDry.gain.value = 1.0;
    reverbInput.connect(reverbDry);
    reverbInput.connect(convolver);
    convolver.connect(reverbWet);
    reverbDry.connect(reverbOutput);
    reverbWet.connect(reverbOutput);
    const delayInput = audioContext.createGain();
    const delayOutput = audioContext.createGain();
    const delayNode = audioContext.createDelay(1.0);
    const delayFeedback = audioContext.createGain();
    const delayWet = audioContext.createGain();
    const delayDry = audioContext.createGain();
    delayNode.delayTime.value = 0.25;
    delayFeedback.gain.value = 0.3;
    delayWet.gain.value = 0;
    delayDry.gain.value = 1.0;
    delayInput.connect(delayDry);
    delayInput.connect(delayNode);
    delayNode.connect(delayFeedback);
    delayFeedback.connect(delayNode);
    delayNode.connect(delayWet);
    delayDry.connect(delayOutput);
    delayWet.connect(delayOutput);
    const distortionInput = audioContext.createGain();
    const distortionOutput = audioContext.createGain();
    const waveshaper = audioContext.createWaveShaper();
    const distortionWet = audioContext.createGain();
    const distortionDry = audioContext.createGain();
    waveshaper.curve = makeDistortionCurve(50);
    waveshaper.oversample = '4x';
    distortionWet.gain.value = 0;
    distortionDry.gain.value = 1.0;
    distortionInput.connect(distortionDry);
    distortionInput.connect(waveshaper);
    waveshaper.connect(distortionWet);
    distortionDry.connect(distortionOutput);
    distortionWet.connect(distortionOutput);
    masterGainNode.connect(reverbInput);
    reverbOutput.connect(delayInput);
    delayOutput.connect(distortionInput);
    distortionOutput.connect(finalOutput);
    finalOutput.connect(compressor);
    compressor.connect(audioContext.destination);
    effectsChain = {
        reverb: { wet: reverbWet, dry: reverbDry },
        delay: { wet: delayWet, dry: delayDry },
        distortion: { wet: distortionWet, dry: distortionDry }
    };
}

function createReverbImpulse() {
    const length = audioContext.sampleRate * 3;
    const impulse = audioContext.createBuffer(2, length, audioContext.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
        const channelData = impulse.getChannelData(channel);
        for (let i = 0; i < length; i++) {
            const decay = Math.pow(1 - i / length, 2);
            channelData[i] = (Math.random() * 2 - 1) * decay * 0.5;
        }
    }
    return impulse;
}

function makeDistortionCurve(amount) {
    const samples = 44100;
    const curve = new Float32Array(samples);
    for (let i = 0; i < samples; i++) {
        const x = (i * 2) / samples - 1;
        curve[i] = ((3 + amount) * x * 20 * Math.PI / 180) / (Math.PI + amount * Math.abs(x));
    }
    return curve;
}

function playNote(note, duration = null) {
    if (!audioContext) initAudio();
    if (!noteFrequencies[note]) return;
    if (synthSettings.performance.mono && activeNotes.size > 0) {
        activeNotes.forEach((_, noteId) => stopNote(noteId, true));
    }
    const maxNotes = synthSettings.performance.hold ? synthSettings.polyphony : synthSettings.polyphony - 2;
    if (activeNotes.size >= maxNotes) {
        const oldestNote = activeNotes.keys().next().value;
        stopNote(oldestNote, true);
    }
    let frequency = noteFrequencies[note] * Math.pow(2, synthSettings.octaveShift);
    const now = audioContext.currentTime;
    const noteId = `${note}-${++globalId}`;
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    const filterNode = audioContext.createBiquadFilter();
    oscillator.type = synthSettings.waveform;
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.detune.setValueAtTime((Math.random() - 0.5) * 8, now);
    filterNode.type = 'lowpass';
    filterNode.frequency.setValueAtTime(synthSettings.filterCutoff, now);
    filterNode.Q.setValueAtTime(1, now);
    lfoGain.connect(filterNode.frequency);
    oscillator.connect(filterNode);
    filterNode.connect(gainNode);
    gainNode.connect(masterGainNode);
    const maxGain = (waveformGains[synthSettings.waveform] || 0.8) * 0.8;
    const sustainLevel = maxGain * synthSettings.sustain;
    gainNode.gain.cancelScheduledValues(now);
    gainNode.gain.setValueAtTime(0.001, now);
    gainNode.gain.exponentialRampToValueAtTime(maxGain, now + synthSettings.attack);
    gainNode.gain.exponentialRampToValueAtTime(Math.max(sustainLevel, 0.001), now + synthSettings.attack + synthSettings.decay);
    oscillator.start(now);
    activeNotes.set(noteId, { oscillator, gainNode, filterNode, note, startTime: now });
    if (synthSettings.performance.hold) heldNotes.add(noteId);
    if (duration) setTimeout(() => stopNote(noteId), duration * 1000);
    return noteId;
}

function stopNote(noteId, immediate = false) {
    if (!audioContext || !activeNotes.has(noteId)) return;
    if (synthSettings.performance.hold && heldNotes.has(noteId) && !immediate) return;
    const { oscillator, gainNode } = activeNotes.get(noteId);
    const now = audioContext.currentTime;
    gainNode.gain.cancelScheduledValues(now);
    gainNode.gain.setValueAtTime(gainNode.gain.value, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + synthSettings.release);
    oscillator.stop(now + synthSettings.release + 0.1);
    activeNotes.delete(noteId);
    heldNotes.delete(noteId);
}

function stopAllNotes(immediate = false) {
    const notesToStop = new Map(activeNotes);
    notesToStop.forEach((_, noteId) => stopNote(noteId, immediate));
    document.querySelectorAll('.key.active').forEach(k => k.classList.remove('active'));
}

function updateAllFilters() {
    if (!audioContext) return;
    activeNotes.forEach(({ filterNode }) => {
        filterNode.frequency.setTargetAtTime(synthSettings.filterCutoff, audioContext.currentTime, 0.01);
    });
}

function toggleEffect(effectType) {
    if (!audioContext || !effectsChain[effectType]) return;
    const isActive = synthSettings.effects[effectType];
    const now = audioContext.currentTime;
    const wetGain = effectType === 'reverb' ? 0.4 : (effectType === 'delay' ? 0.3 : 0.7);
    const dryGain = 1.0 - wetGain;
    effectsChain[effectType].wet.gain.setTargetAtTime(isActive ? wetGain : 0, now, 0.1);
    effectsChain[effectType].dry.gain.setTargetAtTime(isActive ? dryGain : 1.0, now, 0.1);
}

function startArpeggiator() {
    if (arpeggiatorInterval) return;
    arpNotes = [];
    arpIndex = 0;
    arpeggiatorInterval = setInterval(() => {
        if (arpNotes.length === 0) return;
        activeNotes.forEach((noteData, noteId) => {
            if (noteData.note === arpNotes[arpIndex]) stopNote(noteId, true);
        });
        const note = arpNotes[arpIndex];
        playNote(note);
        arpIndex = (arpIndex + 1) % arpNotes.length;
    }, 200);
}

function stopArpeggiator() {
    if (arpeggiatorInterval) {
        clearInterval(arpeggiatorInterval);
        arpeggiatorInterval = null;
        arpNotes = [];
        arpIndex = 0;
    }
}

function addToArp(note) {
    if (!arpNotes.includes(note)) {
        arpNotes.push(note);
        arpNotes.sort((a, b) => noteFrequencies[a] - noteFrequencies[b]);
    }
}

// --- SEQUENCER FUNCTIONS ---
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

function toggleSequencer() {
    sequencerIsPlaying = !sequencerIsPlaying;
    document.getElementById('sequencer-play-btn').classList.toggle('active', sequencerIsPlaying);
    if (sequencerIsPlaying) {
        currentStep = 0;
        const interval = (60 / synthSettings.sequencerTempo) * 1000 / 4; // 16th notes
        sequencerInterval = setInterval(sequencerLoop, interval);
    } else {
        clearInterval(sequencerInterval);
        const steps = sequencerStepsContainer.children;
        for (let i = 0; i < steps.length; i++) {
            steps[i].classList.remove('playing');
        }
    }
}


// --- DISPLAY FUNCTIONS ---
function showTemporaryMessage(text) {
    displayMessage.textContent = text;
    displayMessage.classList.add('visible');
    setTimeout(() => {
        displayMessage.classList.remove('visible');
    }, 1500);
}

function updateScreen() {
    displayParams.p1.textContent = `WAVE: ${synthSettings.waveform.toUpperCase()}`;
    displayParams.p2.textContent = `OCT: ${Math.round(synthSettings.octaveShift)}`;
    displayParams.p3.textContent = `CUT: ${Math.round(synthSettings.filterCutoff)}`;
    displayCtx.clearRect(0, 0, displayCanvas.width, displayCanvas.height);
    displayCtx.strokeStyle = '#34D399';
    displayCtx.lineWidth = 2;
    switch(currentScreenView) {
        case 'adsr': drawADSR(); break;
        case 'wave': drawWaveform(); break;
        case 'filter': drawFilterCurve(); break;
        case 'lfo': drawLFO(); break;
    }
}

function drawADSR() {
    const w = displayCanvas.width, h = displayCanvas.height;
    const peak = h * 0.1, sustainH = h - (h * synthSettings.sustain * 0.8);
    const attackTime = Math.min(synthSettings.attack * 50, w * 0.25);
    const decayTime = Math.min(synthSettings.decay * 50, w * 0.25);
    const releaseTime = Math.min(synthSettings.release * 50, w * 0.4);
    const sustainWidth = w - (attackTime + decayTime + releaseTime);
    displayCtx.beginPath();
    displayCtx.moveTo(0, h);
    displayCtx.lineTo(attackTime, peak);
    displayCtx.lineTo(attackTime + decayTime, sustainH);
    displayCtx.lineTo(attackTime + decayTime + sustainWidth, sustainH);
    displayCtx.lineTo(w, h);
    displayCtx.stroke();
}

function drawWaveform() {
    const w = displayCanvas.width, h = displayCanvas.height, halfH = h / 2;
    displayCtx.beginPath();
    displayCtx.moveTo(0, halfH);
    for (let i = 0; i < w; i++) {
        const percent = i / w;
        let y = halfH;
        switch(synthSettings.waveform) {
            case 'sine': y += Math.sin(percent * Math.PI * 4) * (halfH * 0.8); break;
            case 'square': y += (Math.sin(percent * Math.PI * 4) > 0 ? 1 : -1) * (halfH * 0.8); break;
            case 'sawtooth': y += (1 - (percent * 2 % 2)) * (halfH * 0.8); break;
            case 'triangle': y += Math.asin(Math.sin(percent * Math.PI * 4)) / (Math.PI / 2) * (halfH * 0.8); break;
        }
        displayCtx.lineTo(i, y);
    }
    displayCtx.stroke();
}

function drawFilterCurve() {
    const w = displayCanvas.width, h = displayCanvas.height;
    displayCtx.beginPath();
    displayCtx.moveTo(0, h * 0.1);
    const cutoffX = (synthSettings.filterCutoff / 15000) * w;
    displayCtx.lineTo(cutoffX, h * 0.1);
    displayCtx.bezierCurveTo(cutoffX, h * 0.1, cutoffX, h, w, h);
    displayCtx.stroke();
}

function drawLFO() {
    const w = displayCanvas.width, h = displayCanvas.height, halfH = h / 2;
    displayCtx.beginPath();
    displayCtx.moveTo(0, halfH);
    for (let i = 0; i < w; i++) {
        const percent = i / w;
        let y = halfH;
        y += Math.sin(percent * Math.PI * (synthSettings.lfoRate / 2)) * (synthSettings.lfoDepth / 5000 * halfH);
        displayCtx.lineTo(i, y);
    }
    displayCtx.stroke();
}

// --- PRESET FUNCTIONS ---
function savePreset(index) {
    presets[index] = JSON.parse(JSON.stringify(synthSettings));
    presets[index].sequencer = [...sequencerData]; // Save sequencer data
    showTemporaryMessage(`PRESET ${index + 1} SAVED`);
}

function loadPreset(index) {
    stopAllNotes(true);
    if (arpeggiatorInterval) stopArpeggiator();
    if (sequencerIsPlaying) toggleSequencer();

    const presetToLoad = presets[index];
    if (Object.keys(presetToLoad).length === 0) {
        Object.assign(synthSettings, JSON.parse(JSON.stringify(defaultSynthSettings)));
        sequencerData = Array(16).fill(false);
        showTemporaryMessage(`PRESET ${index + 1} EMPTY`);
    } else {
        Object.assign(synthSettings, JSON.parse(JSON.stringify(presetToLoad)));
        sequencerData = [...presetToLoad.sequencer];
        showTemporaryMessage(`PRESET ${index + 1} LOADED`);
    }
    updateUIFromSettings();
    toggleEffect('reverb');
    toggleEffect('delay');
    toggleEffect('distortion');
    if (synthSettings.performance.arp) startArpeggiator();
}

function updateUIFromSettings() {
    document.querySelectorAll('.knob').forEach(knob => {
        const parameter = knob.dataset.parameter;
        const min = parseFloat(knob.dataset.min);
        const max = parseFloat(knob.dataset.max);
        const value = synthSettings[parameter];
        if (parameter && !isNaN(min) && !isNaN(max) && value !== undefined) {
            const rotation = -135 + ((value - min) / (max - min)) * 270;
            knob.style.setProperty('--knob-rotation', `rotate(${rotation}deg)`);
        }
    });
    
    const mainFader = document.getElementById('main-fader');
    const faderModeBtn = document.getElementById('fader-mode-btn');
    if (synthSettings.faderMode === 'cutoff') {
        mainFader.value = synthSettings.filterCutoff;
        faderModeBtn.textContent = 'CUT';
        faderModeBtn.classList.remove('active');
    } else {
        mainFader.value = synthSettings.lfoDepth;
        faderModeBtn.textContent = 'MOD';
        faderModeBtn.classList.add('active');
    }

    document.querySelectorAll('.control-btn').forEach(btn => {
        const wave = btn.dataset.wave, perform = btn.dataset.perform, effect = btn.dataset.effect;
        if (wave) btn.classList.toggle('active', synthSettings.waveform === wave);
        if (perform) btn.classList.toggle('active', synthSettings.performance[perform]);
        if (effect) btn.classList.toggle('active', synthSettings.effects[effect]);
    });

    // Update sequencer steps UI
    const steps = sequencerStepsContainer.children;
    for (let i = 0; i < steps.length; i++) {
        steps[i].classList.toggle('active', sequencerData[i]);
    }

    updateScreen();
}

document.addEventListener('DOMContentLoaded', () => {
    Object.keys(noteFrequencies).forEach(note => {
        const keyElement = document.createElement('div');
        keyElement.className = 'key';
        keyElement.dataset.note = note;
        keyboardContainer.appendChild(keyElement);
        let currentNoteId = null;
        const startNoteHandler = (e) => {
            e.preventDefault();
            lastNotePlayed = note; // Update last note for sequencer
            if (!currentNoteId) {
                if (synthSettings.performance.arp) addToArp(note);
                else currentNoteId = playNote(note);
                keyElement.classList.add('active');
            }
        };
        const stopNoteHandler = (e) => {
            e.preventDefault();
            if (synthSettings.performance.arp) return;
            if (currentNoteId && !synthSettings.performance.hold) {
                stopNote(currentNoteId);
                keyElement.classList.remove('active');
                currentNoteId = null;
            }
        };
        keyElement.addEventListener('mousedown', startNoteHandler);
        keyElement.addEventListener('mouseup', stopNoteHandler);
        keyElement.addEventListener('mouseleave', stopNoteHandler);
        keyElement.addEventListener('touchstart', startNoteHandler, { passive: false });
        keyElement.addEventListener('touchend', stopNoteHandler);
    });

    const keyboardNotes = {};
    window.addEventListener('keydown', e => {
        if (e.repeat) return;
        const note = keyToNoteMap[e.key.toLowerCase()];
        if (note && !keyboardNotes[note]) {
            lastNotePlayed = note; // Update last note for sequencer
            if (synthSettings.performance.arp) addToArp(note);
            else keyboardNotes[note] = playNote(note);
            document.querySelector(`[data-note="${note}"]`)?.classList.add('active');
        }
    });
    
    window.addEventListener('keyup', e => {
        const note = keyToNoteMap[e.key.toLowerCase()];
        if (note) {
            if (synthSettings.performance.arp) return;
            if (!synthSettings.performance.hold) {
                if (keyboardNotes[note]) {
                    stopNote(keyboardNotes[note]);
                    document.querySelector(`[data-note="${note}"]`)?.classList.remove('active');
                }
            }
            delete keyboardNotes[note];
        }
    });

    function setupKnob(knobElement, parameter, min, max, displayLabel) {
        knobElement.dataset.parameter = parameter;
        knobElement.dataset.min = min;
        knobElement.dataset.max = max;
        knobElement.style.setProperty('--knob-color', knobElement.dataset.color);
        let isDragging = false, startY, startValue;
        const handleDrag = (e) => {
            if (!isDragging) return;
            e.preventDefault();
            if (['attack', 'decay', 'sustain', 'release'].includes(parameter)) currentScreenView = 'adsr';
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            let newValue = startValue + ((startY - clientY) * (max - min) / 200);
            newValue = Math.max(min, Math.min(max, newValue));
            synthSettings[parameter] = newValue;
            const rotation = -135 + ((newValue - min) / (max - min)) * 270;
            knobElement.style.setProperty('--knob-rotation', `rotate(${rotation}deg)`);
            const displayValue = parameter === 'octaveShift' ? Math.round(newValue) : newValue.toFixed(2);
            showTemporaryMessage(`${displayLabel}: ${displayValue}`);
            updateScreen();
        };
        const stopDrag = () => isDragging = false;
        const startDrag = (e) => {
            isDragging = true;
            startY = e.touches ? e.touches[0].clientY : e.clientY;
            startValue = synthSettings[parameter];
            document.addEventListener('mousemove', handleDrag);
            document.addEventListener('mouseup', stopDrag, { once: true });
            document.addEventListener('touchmove', handleDrag, { passive: false });
            document.addEventListener('touchend', stopDrag, { once: true });
            e.preventDefault();
        };
        knobElement.addEventListener('mousedown', startDrag);
        knobElement.addEventListener('touchstart', startDrag);
    }

    const mainFader = document.getElementById('main-fader');
    mainFader.addEventListener('input', (e) => {
        const value = parseFloat(e.target.value);
        if (synthSettings.faderMode === 'cutoff') {
            synthSettings.filterCutoff = value;
            currentScreenView = 'filter';
            updateAllFilters();
        } else {
            synthSettings.lfoDepth = value;
            lfoGain.gain.setTargetAtTime(value, audioContext.currentTime, 0.01);
            currentScreenView = 'lfo';
        }
        updateScreen();
    });

    document.getElementById('fader-mode-btn').addEventListener('click', (e) => {
        if (synthSettings.faderMode === 'cutoff') {
            synthSettings.faderMode = 'lfo';
            mainFader.min = 0;
            mainFader.max = 5000;
            mainFader.value = synthSettings.lfoDepth;
            e.target.textContent = 'MOD';
            e.target.classList.add('active');
            currentScreenView = 'lfo';
        } else {
            synthSettings.faderMode = 'cutoff';
            mainFader.min = 100;
            mainFader.max = 15000;
            mainFader.value = synthSettings.filterCutoff;
            e.target.textContent = 'CUT';
            e.target.classList.remove('active');
            currentScreenView = 'filter';
        }
        updateScreen();
    });

    document.querySelectorAll('.control-btn[data-wave]').forEach(button => {
        button.addEventListener('click', () => {
            document.querySelectorAll('.control-btn[data-wave]').forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            synthSettings.waveform = button.dataset.wave;
            currentScreenView = 'wave';
            updateScreen();
        });
    });
    document.querySelector('.control-btn[data-wave="sine"]').classList.add('active');

    document.querySelectorAll('[data-perform]').forEach(button => {
        const performType = button.getAttribute('data-perform');
        button.addEventListener('click', (e) => {
            synthSettings.performance[performType] = !synthSettings.performance[performType];
            e.currentTarget.classList.toggle('active', synthSettings.performance[performType]);
            showTemporaryMessage(`${performType.toUpperCase()}: ${synthSettings.performance[performType] ? 'ON' : 'OFF'}`);
            if (performType === 'arp') synthSettings.performance.arp ? startArpeggiator() : stopArpeggiator();
            if (performType === 'hold' && !synthSettings.performance.hold) {
                heldNotes.forEach(noteId => stopNote(noteId, false));
                heldNotes.clear();
                document.querySelectorAll('.key.active').forEach(k => k.classList.remove('active'));
            }
        });
    });

    document.querySelectorAll('[data-effect]').forEach(button => {
        const effectType = button.getAttribute('data-effect');
        button.addEventListener('click', (e) => {
            synthSettings.effects[effectType] = !synthSettings.effects[effectType];
            e.currentTarget.classList.toggle('active', synthSettings.effects[effectType]);
            toggleEffect(effectType);
            showTemporaryMessage(`${effectType.toUpperCase()}: ${synthSettings.effects[effectType] ? 'ON' : 'OFF'}`);
        });
    });

    document.querySelectorAll('.num-btn').forEach((button, index) => {
        button.dataset.preset = index + 1;
        let pressTimer, isHeld = false;
        const startPress = (e) => {
            e.preventDefault();
            isHeld = false;
            pressTimer = setTimeout(() => {
                isHeld = true;
                savePreset(index);
            }, 1000);
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

    // Sequencer setup
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

    setupKnob(document.getElementById('knob-octave'), 'octaveShift', -2, 2, 'OCTAVE');
    setupKnob(document.getElementById('knob-attack'), 'attack', 0.01, 2, 'ATTACK');
    setupKnob(document.getElementById('knob-sustain'), 'sustain', 0, 1, 'SUSTAIN');
    setupKnob(document.getElementById('knob-decay'), 'decay', 0.01, 2, 'DECAY');
    setupKnob(document.getElementById('knob-release'), 'release', 0.01, 4, 'RELEASE');

    document.addEventListener('click', initAudio, { once: true });
    document.addEventListener('keydown', initAudio, { once: true });

    updateUIFromSettings();
});
