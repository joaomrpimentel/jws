/**
 * @file Motor de síntese de bateria.
 */
import { getAudioContext, getMasterGainNode } from './audio-core.js';
import { synthSettings } from '../state/state.js';

function createWhiteNoise() {
    const audioContext = getAudioContext();
    const bufferSize = audioContext.sampleRate * 2;
    const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
    }
    const noise = audioContext.createBufferSource();
    noise.buffer = buffer;
    return noise;
}

export function playKick() {
    const audioContext = getAudioContext();
    if (!audioContext) return;
    const now = audioContext.currentTime;
    const kit = synthSettings.drum.kit;
    const params = synthSettings.drum.kits[kit];

    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();

    const startPitch = kit === 'electronic' ? 100 : 150;
    osc.frequency.setValueAtTime(startPitch, now);
    osc.frequency.exponentialRampToValueAtTime(0.01, now + 0.15);

    gain.gain.setValueAtTime(1, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + params.kickDecay);

    osc.connect(gain);
    gain.connect(getMasterGainNode());

    osc.start(now);
    osc.stop(now + params.kickDecay + 0.1);
}

export function playSnare() {
    const audioContext = getAudioContext();
    if (!audioContext) return;
    const now = audioContext.currentTime;
    const kit = synthSettings.drum.kit;
    const params = synthSettings.drum.kits[kit];

    const noise = createWhiteNoise();
    const noiseFilter = audioContext.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.value = kit === 'electronic' ? 2500 : 1500;
    const noiseEnv = audioContext.createGain();

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseEnv);
    noiseEnv.connect(getMasterGainNode());

    noiseEnv.gain.setValueAtTime(1, now);
    noiseEnv.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
    noise.start(now);
    noise.stop(now + 0.2);

    const body = audioContext.createOscillator();
    body.type = 'triangle';
    body.frequency.setValueAtTime(180 + (params.snareTone * 150), now);
    const bodyEnv = audioContext.createGain();
    
    body.connect(bodyEnv);
    bodyEnv.connect(getMasterGainNode());
    
    bodyEnv.gain.setValueAtTime(0.8, now);
    bodyEnv.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
    body.start(now);
    body.stop(now + 0.1);
}

export function playHiHat(type = 'closed') {
    const audioContext = getAudioContext();
    if (!audioContext) return;
    const now = audioContext.currentTime;
    const kit = synthSettings.drum.kit;
    const params = synthSettings.drum.kits[kit];
    const decay = type === 'closed' ? params.hatDecay : params.hatDecay * 4;

    const noise = createWhiteNoise();
    const bandpass = audioContext.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.value = 10000;
    bandpass.Q.value = 1.5;
    const highpass = audioContext.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = kit === 'electronic' ? 8000 : 7000;

    const noiseEnv = audioContext.createGain();

    noise.connect(bandpass);
    bandpass.connect(highpass);
    highpass.connect(noiseEnv);
    noiseEnv.connect(getMasterGainNode());

    noiseEnv.gain.setValueAtTime(0.8, now);
    noiseEnv.gain.exponentialRampToValueAtTime(0.01, now + decay);
    noise.start(now);
    noise.stop(now + decay);
}

export function playTom() {
    const audioContext = getAudioContext();
    if (!audioContext) return;
    const now = audioContext.currentTime;
    const kit = synthSettings.drum.kit;
    const params = synthSettings.drum.kits[kit];
    
    const osc = audioContext.createOscillator();
    osc.type = 'sine';
    const gain = audioContext.createGain();

    const startPitch = 120 + (params.tomPitch * 200);
    osc.frequency.setValueAtTime(startPitch, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.3);

    gain.gain.setValueAtTime(0.9, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);

    osc.connect(gain);
    gain.connect(getMasterGainNode());

    osc.start(now);
    osc.stop(now + 0.5);
}
