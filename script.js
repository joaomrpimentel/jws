/**
 * @file JWS-1 Synthesizer main script.
 * * This script handles all the logic for the JWS-1 web synthesizer, including
 * audio generation (oscillators, envelopes, filters), effects, sequencing,
 * arpeggiation, UI interactions, and preset management.
 */

//==============================================================================
// DOM ELEMENT REFERENCES
//==============================================================================

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
const helpModal = document.getElementById('help-modal');
const helpBtn = document.getElementById('help-btn');
const closeModalBtn = document.getElementById('close-modal-btn');
const arpUpBtn = document.getElementById('arp-up-btn');
const arpDownBtn = document.getElementById('arp-down-btn');


//==============================================================================
// GLOBAL STATE & SETTINGS
//==============================================================================

// --- AUDIO CONTEXT AND SETTINGS ---
let audioContext;
let masterGainNode;
let analyserNode;
let effectsChain = {};
let lfo, lfoGain;
const activeNotes = new Map();
let globalId = 0;
let heldNotes = new Set();
let arpeggiatorInterval = null;
let arpNotes = [];
let arpIndex = 0;
let lastArpNoteId = null;

// --- SEQUENCER STATE ---
let sequencerData = Array(16).fill(false);
let sequencerIsPlaying = false;
let sequencerInterval = null;
let currentStep = 0;
let lastNotePlayed = 'C4';

// --- SLIDER CONSTANTS ---
const MIN_FREQ = 40;
const MAX_FREQ = 18000;

/**
 * The main settings object for the synthesizer's sound engine.
 * @type {object}
 */
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
        arp: false,
        arpDirection: 'up' // 'up' or 'down'
    }
};

// --- PRESETS & MAPPINGS ---
const presets = [{}, {}, {}, {}];
const defaultSynthSettings = JSON.parse(JSON.stringify(synthSettings));
const waveformGains = { sine: 0.8, square: 0.4, sawtooth: 0.5, triangle: 0.7 };
const noteFrequencies = { 'C4': 261.63, 'Db4': 277.18, 'D4': 293.66, 'Eb4': 311.13, 'E4': 329.63, 'F4': 349.23, 'Gb4': 369.99, 'G4': 392.00, 'Ab4': 415.30, 'A4': 440.00, 'Bb4': 466.16, 'B4': 493.88, 'C5': 523.25 };
const keyToNoteMap = { 'a': 'C4', 'w': 'Db4', 's': 'D4', 'e': 'Eb4', 'd': 'E4', 'f': 'F4', 't': 'Gb4', 'g': 'G4', 'y': 'Ab4', 'h': 'A4', 'u': 'Bb4', 'j': 'B4', 'k': 'C5' };


//==============================================================================
// HELPER FUNCTIONS
//==============================================================================

/**
 * Converts a linear slider value (0-100) to a logarithmic frequency.
 * This provides more control over lower frequencies.
 * @param {number} value The linear value from the slider (0-100).
 * @returns {number} The corresponding logarithmic frequency.
 */
function linearToLog(value) {
    if (value <= 0) return MIN_FREQ;
    return MIN_FREQ * Math.pow(MAX_FREQ / MIN_FREQ, value / 100);
}

/**
 * Converts a logarithmic frequency back to a linear slider value (0-100).
 * @param {number} freq The frequency value.
 * @returns {number} The corresponding linear value for the slider.
 */
function logToLinear(freq) {
    if (freq <= MIN_FREQ) return 0;
    return 100 * Math.log(freq / MIN_FREQ) / Math.log(MAX_FREQ / MIN_FREQ);
}


//==============================================================================
// AUDIO ENGINE
//==============================================================================

/**
 * Initializes the Web Audio API AudioContext and main nodes.
 * This function is called once on the first user interaction.
 */
function initAudio() {
    if (!audioContext) {
        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            masterGainNode = audioContext.createGain();
            masterGainNode.gain.value = 0.7;
            analyserNode = audioContext.createAnalyser();
            analyserNode.fftSize = 2048;
            lfo = audioContext.createOscillator();
            lfo.frequency.value = synthSettings.lfoRate;
            lfoGain = audioContext.createGain();
            lfoGain.gain.value = synthSettings.lfoDepth;
            lfo.connect(lfoGain);
            lfo.start();
            initEffects();
            showTemporaryMessage('AUDIO ON');
            updateDisplay();
        } catch (e) {
            console.error("Web Audio API error:", e);
            showTemporaryMessage('ERROR');
        }
    }
}

/**
 * Sets up the audio graph for all effects (Reverb, Delay, Distortion).
 */
function initEffects() {
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
    distortionOutput.connect(compressor);
    compressor.connect(analyserNode);
    analyserNode.connect(audioContext.destination);

    effectsChain = {
        reverb: { wet: reverbWet, dry: reverbDry },
        delay: { wet: delayWet, dry: delayDry },
        distortion: { wet: distortionWet, dry: distortionDry }
    };
}

/**
 * Creates a simple impulse response for the convolver reverb effect.
 * @returns {AudioBuffer} The generated impulse response buffer.
 */
function createReverbImpulse() {
    const length = audioContext.sampleRate * 2;
    const impulse = audioContext.createBuffer(2, length, audioContext.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
        const channelData = impulse.getChannelData(channel);
        for (let i = 0; i < length; i++) {
            channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2);
        }
    }
    return impulse;
}

/**
 * Generates a waveshaper curve for the distortion effect.
 * @param {number} amount The intensity of the distortion.
 * @returns {Float32Array} The curve for the WaveShaperNode.
 */
function makeDistortionCurve(amount) {
    const k = typeof amount === 'number' ? amount : 50,
      n_samples = 44100,
      curve = new Float32Array(n_samples),
      deg = Math.PI / 180;
    let i = 0, x;
    for ( ; i < n_samples; ++i ) {
      x = i * 2 / n_samples - 1;
      curve[i] = ( 3 + k ) * x * 20 * deg / ( Math.PI + k * Math.abs(x) );
    }
    return curve;
}

/**
 * Creates and plays a single synthesizer note.
 * @param {string} note The note to play (e.g., 'C4', 'Db4').
 * @param {number|null} duration Optional duration in seconds for auto-release.
 * @returns {string} The unique ID of the created note.
 */
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

/**
 * Stops a playing note by triggering its release envelope.
 * @param {string} noteId The unique ID of the note to stop.
 * @param {boolean} [immediate=false] If true, bypasses the release phase.
 */
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

/**
 * Stops all currently playing or held notes.
 * @param {boolean} [immediate=false] If true, stops all notes instantly.
 */
function stopAllNotes(immediate = false) {
    const notesToStop = new Map(activeNotes);
    notesToStop.forEach((_, noteId) => stopNote(noteId, immediate));
    document.querySelectorAll('.key.active').forEach(k => k.classList.remove('active'));
}

/**
 * Updates the filter cutoff frequency for all currently active notes.
 */
function updateAllFilters() {
    if (!audioContext) return;
    activeNotes.forEach(({ filterNode }) => {
        filterNode.frequency.setTargetAtTime(synthSettings.filterCutoff, audioContext.currentTime, 0.01);
    });
}

/**
 * Toggles an effect on or off by adjusting its wet/dry mix.
 * @param {string} effectType The name of the effect ('reverb', 'delay', 'distortion').
 */
function toggleEffect(effectType) {
    if (!audioContext || !effectsChain[effectType]) return;
    const isActive = synthSettings.effects[effectType];
    const now = audioContext.currentTime;
    const wetGain = effectType === 'reverb' ? 0.3 : (effectType === 'delay' ? 0.25 : 0.6);
    effectsChain[effectType].wet.gain.setTargetAtTime(isActive ? wetGain : 0, now, 0.1);
}


//==============================================================================
// PERFORMANCE FEATURES (ARPEGGIATOR & SEQUENCER)
//==============================================================================

/**
 * Starts the arpeggiator interval, which plays notes from the arpNotes array.
 */
function startArpeggiator() {
    if (arpeggiatorInterval) return;
    arpIndex = 0;
    arpeggiatorInterval = setInterval(() => {
        if (lastArpNoteId) {
            stopNote(lastArpNoteId, true);
        }
        if (arpNotes.length > 0) {
            const sortedNotes = [...arpNotes].sort((a, b) => noteFrequencies[a] - noteFrequencies[b]);
            let noteToPlay;
            if (synthSettings.performance.arpDirection === 'down') {
                const descendingIndex = sortedNotes.length - 1 - arpIndex;
                noteToPlay = sortedNotes[descendingIndex];
            } else {
                noteToPlay = sortedNotes[arpIndex];
            }
            lastArpNoteId = playNote(noteToPlay);
            arpIndex = (arpIndex + 1) % arpNotes.length;
        }
    }, 200);
}

/**
 * Stops the arpeggiator, clears its notes, and stops all sound.
 */
function stopArpeggiator() {
    if (arpeggiatorInterval) {
        clearInterval(arpeggiatorInterval);
        arpeggiatorInterval = null;
        if (lastArpNoteId) {
            stopNote(lastArpNoteId, true);
            lastArpNoteId = null;
        }
        arpNotes = [];
        arpIndex = 0;
        stopAllNotes(true);
    }
}

/**
 * Adds a note to the list of notes for the arpeggiator to play.
 * @param {string} note The note name to add (e.g., 'C4').
 */
function addToArp(note) {
    if (!arpNotes.includes(note)) {
        arpNotes.push(note);
    }
}

/**
 * The main loop for the sequencer, called by setInterval.
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
 * Toggles the sequencer playback on and off.
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


//==============================================================================
// UI & DISPLAY
//==============================================================================

/**
 * Shows a temporary message on the display overlay.
 * @param {string} text The message to display.
 */
function showTemporaryMessage(text) {
    displayMessage.textContent = text;
    displayMessage.classList.add('visible');
    setTimeout(() => {
        displayMessage.classList.remove('visible');
    }, 1500);
}

/**
 * Updates the text parameters (Wave, Octave, Cutoff) on the display.
 */
function updateScreenInfo() {
    displayParams.p1.textContent = `WAVE: ${synthSettings.waveform.toUpperCase()}`;
    displayParams.p2.textContent = `OCT: ${Math.round(synthSettings.octaveShift)}`;
    displayParams.p3.textContent = `CUT: ${Math.round(synthSettings.filterCutoff)}`;
}

/**
 * Main display render loop. Draws either the live oscilloscope or a static
 * waveform representation based on whether notes are playing.
 */
function updateDisplay() {
    requestAnimationFrame(updateDisplay);
    if (!audioContext) return;
    const dpr = window.devicePixelRatio || 1;
    const w = displayCanvas.width / dpr;
    const h = displayCanvas.height / dpr;
    const drawingWidth = w * 0.82;
    displayCtx.clearRect(0, 0, w, h);
    displayCtx.lineWidth = 2;
    displayCtx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--display-stroke');
    if (activeNotes.size > 0) {
        const bufferLength = analyserNode.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyserNode.getByteTimeDomainData(dataArray);
        displayCtx.beginPath();
        const sliceWidth = drawingWidth / bufferLength;
        let x = 0;
        for (let i = 0; i < bufferLength; i++) {
            const v = dataArray[i] / 128.0;
            const y = v * h / 2;
            if (i === 0) {
                displayCtx.moveTo(x, y);
            } else {
                displayCtx.lineTo(x, y);
            }
            x += sliceWidth;
        }
        displayCtx.stroke();
    } else {
        const halfH = h / 2;
        displayCtx.beginPath();
        displayCtx.moveTo(0, halfH);
        for (let i = 0; i < drawingWidth; i++) {
            const percent = i / drawingWidth;
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
}


//==============================================================================
// PRESET MANAGEMENT
//==============================================================================

/**
 * Saves the current synth settings to a preset slot.
 * @param {number} index The preset slot index (0-3).
 */
function savePreset(index) {
    presets[index] = JSON.parse(JSON.stringify(synthSettings));
    presets[index].sequencer = [...sequencerData];
    showTemporaryMessage(`PRESET ${index + 1} SAVED`);
}

/**
 * Loads synth settings from a preset slot.
 * @param {number} index The preset slot index (0-3).
 */
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
        sequencerData = [...(presetToLoad.sequencer || Array(16).fill(false))];
        showTemporaryMessage(`PRESET ${index + 1} LOADED`);
    }
    updateUIFromSettings();
    ['reverb', 'delay', 'distortion'].forEach(effect => toggleEffect(effect));
    if (synthSettings.performance.arp) startArpeggiator();
}

/**
 * Updates all UI elements to reflect the current values in synthSettings.
 */
function updateUIFromSettings() {
    document.querySelectorAll('.knob').forEach(knob => {
        const parameter = knob.dataset.parameter;
        const min = parseFloat(knob.dataset.min);
        const max = parseFloat(knob.dataset.max);
        const value = synthSettings[parameter];
        if (parameter && !isNaN(min) && !isNaN(max) && value !== undefined) {
            const rotation = -135 + ((value - min) / (max - min)) * 270;
            knob.style.setProperty('--knob-rotation', `${rotation}deg`);
        }
    });
    
    const mainFader = document.getElementById('main-fader');
    const faderModeBtn = document.getElementById('fader-mode-btn');
    if (synthSettings.faderMode === 'cutoff') {
        mainFader.min = 0;
        mainFader.max = 100;
        mainFader.value = logToLinear(synthSettings.filterCutoff);
        faderModeBtn.textContent = 'CUT';
        faderModeBtn.classList.remove('active');
    } else {
        mainFader.min = 0;
        mainFader.max = 5000;
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

    if (synthSettings.performance.arp) {
        arpUpBtn.classList.toggle('active', synthSettings.performance.arpDirection === 'up');
        arpDownBtn.classList.toggle('active', synthSettings.performance.arpDirection === 'down');
    } else {
        arpUpBtn.classList.remove('active');
        arpDownBtn.classList.remove('active');
    }

    const steps = sequencerStepsContainer.children;
    for (let i = 0; i < steps.length; i++) {
        steps[i].classList.toggle('active', sequencerData[i]);
    }

    updateScreenInfo();
}

/**
 * Sets the canvas dimensions based on its container size and device pixel ratio.
 */
function setupDisplayCanvas() {
    const display = document.querySelector('.display');
    const dpr = window.devicePixelRatio || 1;
    const rect = display.getBoundingClientRect();
    displayCanvas.width = rect.width * dpr;
    displayCanvas.height = rect.height * dpr;
    displayCtx.scale(dpr, dpr);
}


//==============================================================================
// INITIALIZATION & EVENT LISTENERS
//==============================================================================

document.addEventListener('DOMContentLoaded', () => {
    setupDisplayCanvas();
    window.addEventListener('resize', setupDisplayCanvas);

    // --- Modal Logic ---
    const showModal = () => helpModal.classList.remove('hidden');
    const hideModal = () => helpModal.classList.add('hidden');
    helpBtn.addEventListener('click', showModal);
    closeModalBtn.addEventListener('click', hideModal);
    helpModal.addEventListener('click', (e) => {
        if (e.target === helpModal) hideModal();
    });
    if (!localStorage.getItem('jws_visited')) {
        showModal();
        localStorage.setItem('jws_visited', 'true');
    }

    // --- Keyboard (Mouse/Touch) Listeners ---
    Object.keys(noteFrequencies).forEach(note => {
        const keyElement = document.createElement('div');
        keyElement.className = 'key';
        keyElement.dataset.note = note;
        keyboardContainer.appendChild(keyElement);
        let currentNoteId = null;
        const startNoteHandler = (e) => {
            e.preventDefault();
            lastNotePlayed = note;
            if (e.type === 'mousedown' && e.button !== 0) return;
            if (!keyElement.classList.contains('active')) {
                if (synthSettings.performance.arp) {
                    addToArp(note);
                } else {
                    currentNoteId = playNote(note);
                }
                keyElement.classList.add('active');
            }
        };
        const stopNoteHandler = (e) => {
            e.preventDefault();
            if (synthSettings.performance.hold) return;
            keyElement.classList.remove('active');
            if (synthSettings.performance.arp) {
                arpNotes = arpNotes.filter(n => n !== note);
                if (arpNotes.length === 0 && arpeggiatorInterval) {
                    if (lastArpNoteId) {
                        stopNote(lastArpNoteId, true);
                        lastArpNoteId = null;
                    }
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

    // --- Keyboard (Computer) Listeners ---
    const keyboardNotes = {};
    window.addEventListener('keydown', e => {
        if (e.repeat) return;
        const note = keyToNoteMap[e.key.toLowerCase()];
        if (note && !keyboardNotes[note]) {
            lastNotePlayed = note;
            keyboardNotes[note] = true;
            if (synthSettings.performance.arp) {
                addToArp(note);
            } else {
                keyboardNotes[note] = playNote(note);
            }
            document.querySelector(`[data-note="${note}"]`)?.classList.add('active');
        }
    });
    
    window.addEventListener('keyup', e => {
        const note = keyToNoteMap[e.key.toLowerCase()];
        if (note) {
            if (synthSettings.performance.hold) {
                delete keyboardNotes[note];
                return;
            }
            document.querySelector(`[data-note="${note}"]`)?.classList.remove('active');
            if (synthSettings.performance.arp) {
                arpNotes = arpNotes.filter(n => n !== note);
                 if (arpNotes.length === 0 && arpeggiatorInterval) {
                    if (lastArpNoteId) {
                        stopNote(lastArpNoteId, true);
                        lastArpNoteId = null;
                    }
                }
            } else {
                if (keyboardNotes[note] && typeof keyboardNotes[note] === 'string') {
                    stopNote(keyboardNotes[note]);
                }
            }
            delete keyboardNotes[note];
        }
    });

    // --- Knob Interaction Logic ---
    function setupKnob(knobElement, parameter, min, max, displayLabel) {
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
        };
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
        knobElement.addEventListener('touchstart', startDrag, { passive: false });
    }

    // --- Control Listeners ---
    const mainFader = document.getElementById('main-fader');
    mainFader.addEventListener('input', (e) => {
        const value = parseFloat(e.target.value);
        if (synthSettings.faderMode === 'cutoff') {
            synthSettings.filterCutoff = linearToLog(value);
            updateAllFilters();
        } else {
            synthSettings.lfoDepth = value;
            if(audioContext) lfoGain.gain.setTargetAtTime(value, audioContext.currentTime, 0.01);
        }
        updateScreenInfo();
    });

    document.getElementById('fader-mode-btn').addEventListener('click', (e) => {
        if (synthSettings.faderMode === 'cutoff') {
            synthSettings.faderMode = 'lfo';
        } else {
            synthSettings.faderMode = 'cutoff';
        }
        updateUIFromSettings();
        updateScreenInfo();
    });

    document.querySelectorAll('.control-btn[data-wave]').forEach(button => {
        button.addEventListener('click', () => {
            synthSettings.waveform = button.dataset.wave;
            updateUIFromSettings();
            updateScreenInfo();
        });
    });

    document.querySelectorAll('[data-perform]').forEach(button => {
        const performType = button.getAttribute('data-perform');
        button.addEventListener('click', (e) => {
            synthSettings.performance[performType] = !synthSettings.performance[performType];
            showTemporaryMessage(`${performType.toUpperCase()}: ${synthSettings.performance[performType] ? 'ON' : 'OFF'}`);
            if (performType === 'arp') {
                if (synthSettings.performance.arp) {
                    startArpeggiator();
                } else {
                    stopArpeggiator();
                }
            }
            if (performType === 'hold' && !synthSettings.performance.hold) {
                stopAllNotes(false);
                arpNotes = [];
                if (arpeggiatorInterval && lastArpNoteId) {
                    stopNote(lastArpNoteId, true);
                    lastArpNoteId = null;
                }
            }
            updateUIFromSettings();
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

    [arpUpBtn, arpDownBtn].forEach(button => {
        button.addEventListener('click', () => {
            synthSettings.performance.arpDirection = button.dataset.direction;
            updateUIFromSettings();
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

    // --- Final Setup ---
    setupKnob(document.getElementById('knob-octave'), 'octaveShift', -2, 2, 'OCTAVE');
    setupKnob(document.getElementById('knob-attack'), 'attack', 0.01, 2, 'ATTACK');
    setupKnob(document.getElementById('knob-sustain'), 'sustain', 0, 1, 'SUSTAIN');
    setupKnob(document.getElementById('knob-decay'), 'decay', 0.01, 2, 'DECAY');
    setupKnob(document.getElementById('knob-release'), 'release', 0.01, 4, 'RELEASE');

    document.body.addEventListener('click', initAudio, { once: true });
    document.body.addEventListener('keydown', initAudio, { once: true });

    updateUIFromSettings();
});
