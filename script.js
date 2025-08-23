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
const helpModal = document.getElementById('help-modal');
const helpBtn = document.getElementById('help-btn');
const closeModalBtn = document.getElementById('close-modal-btn');


// AUDIO CONTEXT AND SETTINGS
let audioContext;
let masterGainNode;
let analyserNode; // <-- Adicionado para o osciloscópio
let effectsChain = {};
let lfo, lfoGain;
const activeNotes = new Map();
let globalId = 0;
let heldNotes = new Set();
let arpeggiatorInterval = null;
let arpNotes = [];
let arpIndex = 0;
let lastArpNoteId = null; // <-- Variável para controlar a nota do ARP

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

            // Configuração do Analyser para o osciloscópio
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
            
            // Inicia o loop de desenho do display
            updateDisplay();
        } catch (e) {
            console.error("Web Audio API error:", e);
            showTemporaryMessage('ERROR');
        }
    }
}

function initEffects() {
    // A cadeia de efeitos agora termina conectando ao analyser
    const compressor = audioContext.createDynamicsCompressor();
    // ... (resto do código de initEffects é o mesmo)
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
    compressor.connect(analyserNode); // Conecta ao analyser
    analyserNode.connect(audioContext.destination); // E o analyser ao destino final

    effectsChain = {
        reverb: { wet: reverbWet, dry: reverbDry },
        delay: { wet: delayWet, dry: delayDry },
        distortion: { wet: distortionWet, dry: distortionDry }
    };
}

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

// --- Funções restantes (stopAllNotes, updateAllFilters, etc.) permanecem as mesmas ---
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
    const wetGain = effectType === 'reverb' ? 0.3 : (effectType === 'delay' ? 0.25 : 0.6);
    const dryGain = 1.0; // Mantém o sinal seco sempre em 100%
    effectsChain[effectType].wet.gain.setTargetAtTime(isActive ? wetGain : 0, now, 0.1);
}

function startArpeggiator() {
    if (arpeggiatorInterval) return;
    arpIndex = 0;
    arpeggiatorInterval = setInterval(() => {
        if (lastArpNoteId) {
            stopNote(lastArpNoteId, true);
        }
        if (arpNotes.length > 0) {
            const note = arpNotes[arpIndex];
            lastArpNoteId = playNote(note);
            arpIndex = (arpIndex + 1) % arpNotes.length;
        }
    }, 200);
}

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
        sequencerInterval = null;
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

function updateScreenInfo() {
    displayParams.p1.textContent = `WAVE: ${synthSettings.waveform.toUpperCase()}`;
    displayParams.p2.textContent = `OCT: ${Math.round(synthSettings.octaveShift)}`;
    displayParams.p3.textContent = `CUT: ${Math.round(synthSettings.filterCutoff)}`;
}

// Loop de Desenho do Display (Osciloscópio ou Forma de Onda Estática)
function updateDisplay() {
    requestAnimationFrame(updateDisplay);

    if (!audioContext) return;

    const dpr = window.devicePixelRatio || 1;
    const w = displayCanvas.width / dpr;
    const h = displayCanvas.height / dpr;
    const drawingWidth = w * 0.7; // <-- A onda ocupará 70% da largura

    displayCtx.clearRect(0, 0, w, h);
    displayCtx.lineWidth = 2;
    displayCtx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--display-stroke');

    // Se houver notas ativas, mostra o osciloscópio
    if (activeNotes.size > 0) {
        const bufferLength = analyserNode.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyserNode.getByteTimeDomainData(dataArray);

        displayCtx.beginPath();
        const sliceWidth = drawingWidth / bufferLength; // <-- Usa a nova largura
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
        // Caso contrário, mostra a forma de onda estática
        const halfH = h / 2;
        displayCtx.beginPath();
        displayCtx.moveTo(0, halfH);

        for (let i = 0; i < drawingWidth; i++) { // <-- Loop até a nova largura
            const percent = i / drawingWidth; // <-- Percentual baseado na nova largura
            let y = halfH;
            switch(synthSettings.waveform) {
                case 'sine': 
                    y += Math.sin(percent * Math.PI * 4) * (halfH * 0.8); 
                    break;
                case 'square': 
                    y += (Math.sin(percent * Math.PI * 4) > 0 ? 1 : -1) * (halfH * 0.8); 
                    break;
                case 'sawtooth': 
                    y += (1 - (percent * 2 % 2)) * (halfH * 0.8);
                    break;
                case 'triangle': 
                    y += Math.asin(Math.sin(percent * Math.PI * 4)) / (Math.PI / 2) * (halfH * 0.8); 
                    break;
            }
            displayCtx.lineTo(i, y);
        }
        displayCtx.stroke();
    }
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
        sequencerData = [...(presetToLoad.sequencer || Array(16).fill(false))];
        showTemporaryMessage(`PRESET ${index + 1} LOADED`);
    }
    updateUIFromSettings();
    ['reverb', 'delay', 'distortion'].forEach(effect => toggleEffect(effect));
    if (synthSettings.performance.arp) startArpeggiator();
}

function updateUIFromSettings() {
    // Atualiza os knobs
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
    
    // Atualiza o fader principal
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

    // Atualiza os botões de controle
    document.querySelectorAll('.control-btn').forEach(btn => {
        const wave = btn.dataset.wave, perform = btn.dataset.perform, effect = btn.dataset.effect;
        if (wave) btn.classList.toggle('active', synthSettings.waveform === wave);
        if (perform) btn.classList.toggle('active', synthSettings.performance[perform]);
        if (effect) btn.classList.toggle('active', synthSettings.effects[effect]);
    });

    // Atualiza os steps do sequenciador
    const steps = sequencerStepsContainer.children;
    for (let i = 0; i < steps.length; i++) {
        steps[i].classList.toggle('active', sequencerData[i]);
    }

    updateScreenInfo();
}

function setupDisplayCanvas() {
    const display = document.querySelector('.display');
    const dpr = window.devicePixelRatio || 1;
    const rect = display.getBoundingClientRect();
    displayCanvas.width = rect.width * dpr;
    displayCanvas.height = rect.height * dpr;
    displayCtx.scale(dpr, dpr);
}

document.addEventListener('DOMContentLoaded', () => {
    setupDisplayCanvas();
    window.addEventListener('resize', setupDisplayCanvas);

    // Lógica do Modal de Ajuda
    const showModal = () => helpModal.classList.remove('hidden');
    const hideModal = () => helpModal.classList.add('hidden');

    helpBtn.addEventListener('click', showModal);
    closeModalBtn.addEventListener('click', hideModal);
    helpModal.addEventListener('click', (e) => {
        if (e.target === helpModal) {
            hideModal();
        }
    });

    // Mostrar modal na primeira visita
    if (!localStorage.getItem('jws_visited')) {
        showModal();
        localStorage.setItem('jws_visited', 'true');
    }


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
                if (synthSettings.performance.arp) addToArp(note);
                else currentNoteId = playNote(note);
                keyElement.classList.add('active');
            }
        };
        const stopNoteHandler = (e) => {
            e.preventDefault();
            if (synthSettings.performance.arp) return;
            if (keyElement.classList.contains('active') && !synthSettings.performance.hold) {
                if (currentNoteId) stopNote(currentNoteId);
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
            lastNotePlayed = note;
            if (synthSettings.performance.arp) addToArp(note);
            else keyboardNotes[note] = playNote(note);
            document.querySelector(`[data-note="${note}"]`)?.classList.add('active');
        }
    });
    
    window.addEventListener('keyup', e => {
        const note = keyToNoteMap[e.key.toLowerCase()];
        if (note) {
            if (synthSettings.performance.arp) {
                arpNotes = arpNotes.filter(n => n !== note);
                // Não para mais o arpejador ao soltar a última tecla
                return;
            }
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

    const mainFader = document.getElementById('main-fader');
    mainFader.addEventListener('input', (e) => {
        const value = parseFloat(e.target.value);
        if (synthSettings.faderMode === 'cutoff') {
            synthSettings.filterCutoff = value;
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
            mainFader.min = 0;
            mainFader.max = 5000;
            mainFader.value = synthSettings.lfoDepth;
            e.target.textContent = 'MOD';
            e.target.classList.add('active');
        } else {
            synthSettings.faderMode = 'cutoff';
            mainFader.min = 100;
            mainFader.max = 15000;
            mainFader.value = synthSettings.filterCutoff;
            e.target.textContent = 'CUT';
            e.target.classList.remove('active');
        }
        updateScreenInfo();
    });

    document.querySelectorAll('.control-btn[data-wave]').forEach(button => {
        button.addEventListener('click', () => {
            document.querySelectorAll('.control-btn[data-wave]').forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            synthSettings.waveform = button.dataset.wave;
            updateScreenInfo();
        });
    });
    document.querySelector('.control-btn[data-wave="sine"]').classList.add('active');

    document.querySelectorAll('[data-perform]').forEach(button => {
        const performType = button.getAttribute('data-perform');
        button.addEventListener('click', (e) => {
            synthSettings.performance[performType] = !synthSettings.performance[performType];
            e.currentTarget.classList.toggle('active', synthSettings.performance[performType]);
            showTemporaryMessage(`${performType.toUpperCase()}: ${synthSettings.performance[performType] ? 'ON' : 'OFF'}`);
            if (performType === 'arp') {
                synthSettings.performance.arp ? startArpeggiator() : stopArpeggiator();
            }
            if (performType === 'hold' && !synthSettings.performance.hold) {
                stopAllNotes(false);
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

    document.body.addEventListener('click', initAudio, { once: true });
    document.body.addEventListener('keydown', initAudio, { once: true });

    updateUIFromSettings();
});
