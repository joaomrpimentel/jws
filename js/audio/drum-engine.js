/**
 * @file Motor de síntese de bateria.
 */
import { getAudioContext, getMasterGainNode } from './audio-core.js';
import { synthSettings } from '../state/state.js';

function createNoiseBuffer(duration = 2) {
    const audioContext = getAudioContext();
    const bufferSize = audioContext.sampleRate * duration;
    const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
    }
    return buffer;
}

// **CORREÇÃO DO BUG DO LO-FI**
// O ruído agora é um som curto, não um loop infinito.
function playVinylCrackles() {
    const audioContext = getAudioContext();
    const noise = audioContext.createBufferSource();
    noise.buffer = createNoiseBuffer(0.5); // Meio segundo de ruído é suficiente

    const filter = audioContext.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1000;
    filter.Q.value = 0.5;

    const gain = audioContext.createGain();
    gain.gain.value = 0.05; // Aumentado um pouco para ser audível

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(getMasterGainNode());
    noise.start();
    noise.stop(audioContext.currentTime + 0.5); // Garante que o nó pare
}


export function playKick() {
    const audioContext = getAudioContext();
    if (!audioContext) return;
    const now = audioContext.currentTime;
    const kit = synthSettings.drum.kit;
    const params = synthSettings.drum.kits[kit];

    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    
    const startPitch = 60 + (params.kickTune * 60);
    const decay = kit === 'electronic' ? 0.5 : (kit === 'lofi' ? 0.4 : 0.3);
    osc.type = (kit === 'electronic' || kit === 'ethnic') ? 'sine' : 'triangle';

    osc.frequency.setValueAtTime(startPitch, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.15);

    gain.gain.setValueAtTime(1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + decay);
    
    // Adiciona um "click" ao bumbo para mais ataque
    const click = audioContext.createOscillator();
    click.type = 'square';
    click.frequency.setValueAtTime(150, now);
    const clickGain = audioContext.createGain();
    clickGain.gain.setValueAtTime(0.3, now);
    clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);
    click.connect(clickGain);
    clickGain.connect(getMasterGainNode());
    click.start(now);
    click.stop(now + 0.02);

    if (kit === 'lofi') {
        const dist = audioContext.createWaveShaper();
        const curve = new Float32Array(256);
        for (let i = 0; i < 256; i++) {
            const x = i * 2 / 255 - 1;
            curve[i] = Math.tanh(x * (2 + params.kickTune * 3));
        }
        dist.curve = curve;
        osc.connect(dist);
        dist.connect(gain);
        playVinylCrackles(); // Toca o ruído junto com o som
    } else {
        osc.connect(gain);
    }
    
    gain.connect(getMasterGainNode());

    osc.start(now);
    osc.stop(now + decay);
}

export function playSnare() {
    const audioContext = getAudioContext();
    if (!audioContext) return;
    const now = audioContext.currentTime;
    const kit = synthSettings.drum.kit;
    const params = synthSettings.drum.kits[kit];

    const noise = audioContext.createBufferSource();
    noise.buffer = createNoiseBuffer();
    const noiseFilter = audioContext.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.value = 1000;
    const noiseEnv = audioContext.createGain();

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseEnv);
    noiseEnv.connect(getMasterGainNode());

    const noiseGain = params.snareSnap;
    noiseEnv.gain.setValueAtTime(noiseGain * 0.8, now); // Volume balanceado
    noiseEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    noise.start(now);
    noise.stop(now + 0.2);

    const bodyOsc1 = audioContext.createOscillator();
    const bodyOsc2 = audioContext.createOscillator();
    bodyOsc1.type = (kit === 'ethnic') ? 'sine' : 'triangle';
    bodyOsc2.type = (kit === 'ethnic') ? 'sine' : 'triangle';
    bodyOsc1.frequency.setValueAtTime(180, now);
    bodyOsc2.frequency.setValueAtTime(330, now);
    const bodyEnv = audioContext.createGain();
    
    bodyOsc1.connect(bodyEnv);
    bodyOsc2.connect(bodyEnv);
    bodyEnv.connect(getMasterGainNode());
    
    const bodyGain = (1 - noiseGain) * 0.7; // Volume balanceado
    bodyEnv.gain.setValueAtTime(bodyGain, now);
    bodyEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    bodyOsc1.start(now);
    bodyOsc1.stop(now + 0.1);
    bodyOsc2.start(now);
    bodyOsc2.stop(now + 0.1);

    if (kit === 'lofi') playVinylCrackles();
}

export function playHiHat(type = 'closed') {
    const audioContext = getAudioContext();
    if (!audioContext) return;
    const now = audioContext.currentTime;
    const kit = synthSettings.drum.kit;
    const params = synthSettings.drum.kits[kit];
    const decay = type === 'closed' ? params.hatDecay : params.hatDecay * 6;

    const noiseEnv = audioContext.createGain();
    noiseEnv.gain.setValueAtTime(0.4, now); // Volume balanceado
    noiseEnv.gain.exponentialRampToValueAtTime(0.001, now + decay);
    noiseEnv.connect(getMasterGainNode());

    if (kit === 'electronic' || kit === 'lofi') {
        const ratios = [2, 3, 4.16, 5.43, 6.79, 8.21];
        ratios.forEach(ratio => {
            const osc = audioContext.createOscillator();
            osc.type = 'square';
            osc.frequency.value = (kit === 'lofi' ? 80 : 100) * ratio;
            osc.connect(noiseEnv);
            osc.start(now);
            osc.stop(now + decay);
        });
    } else { // Acoustic and Ethnic
        const noise = audioContext.createBufferSource();
        noise.buffer = createNoiseBuffer();
        const highpass = audioContext.createBiquadFilter();
        highpass.type = 'highpass';
        highpass.frequency.value = 7000;
        noise.connect(highpass);
        highpass.connect(noiseEnv);
        noise.start(now);
        noise.stop(now + decay);
    }
    if (kit === 'lofi') playVinylCrackles();
}

export function playTom(pitch) {
    const audioContext = getAudioContext();
    if (!audioContext) return;
    const now = audioContext.currentTime;
    const kit = synthSettings.drum.kit;
    const params = synthSettings.drum.kits[kit];
    
    const osc = audioContext.createOscillator();
    osc.type = 'sine';
    const gain = audioContext.createGain();

    const startPitch = (kit === 'ethnic' ? 200 : 120) + (params.tomPitch * 150);
    osc.frequency.setValueAtTime(startPitch * pitch, now);
    osc.frequency.exponentialRampToValueAtTime(startPitch * pitch / 2, now + 0.3);

    gain.gain.setValueAtTime(0.7, now); // Volume balanceado
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);

    osc.connect(gain);
    gain.connect(getMasterGainNode());

    osc.start(now);
    osc.stop(now + 0.5);
    if (kit === 'lofi') playVinylCrackles();
}

export function playClap() {
    const audioContext = getAudioContext();
    if (!audioContext) return;
    const now = audioContext.currentTime;
    const kit = synthSettings.drum.kit;

    const noise = audioContext.createBufferSource();
    noise.buffer = createNoiseBuffer();
    const filter = audioContext.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1500;
    const env = audioContext.createGain();

    noise.connect(filter);
    filter.connect(env);
    env.connect(getMasterGainNode());

    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(0.6, now + 0.01);
    env.gain.exponentialRampToValueAtTime(0.2, now + 0.02);
    env.gain.linearRampToValueAtTime(0.6, now + 0.03);
    env.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    noise.start(now);
    noise.stop(now + 0.2);
    if (kit === 'lofi') playVinylCrackles();
}

export function playCymbal() {
    const audioContext = getAudioContext();
    if (!audioContext) return;
    const now = audioContext.currentTime;
    const kit = synthSettings.drum.kit;
    const params = synthSettings.drum.kits[kit];

    const gain = audioContext.createGain();
    const filter = audioContext.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 2500;

    gain.gain.setValueAtTime(0.3, now); // Volume balanceado
    gain.gain.exponentialRampToValueAtTime(0.001, now + params.cymbalDecay);

    gain.connect(filter);
    filter.connect(getMasterGainNode());

    const ratios = [1, 1.34, 1.65, 2.55, 2.89, 3.56, 4.5, 5.8];
    ratios.forEach(ratio => {
        const osc = audioContext.createOscillator();
        osc.type = 'square';
        osc.frequency.value = (kit === 'lofi' ? 200 : 300) * ratio;
        osc.detune.value = Math.random() * 20 - 10;
        osc.connect(gain);
        osc.start(now);
        osc.stop(now + params.cymbalDecay);
    });
    if (kit === 'lofi') playVinylCrackles();
}

export function playCowbell() {
    const audioContext = getAudioContext();
    if (!audioContext) return;
    const now = audioContext.currentTime;
    const kit = synthSettings.drum.kit;

    const osc1 = audioContext.createOscillator();
    const osc2 = audioContext.createOscillator();
    const gain = audioContext.createGain();
    
    osc1.type = kit === 'ethnic' ? 'sine' : 'square';
    osc1.frequency.value = kit === 'ethnic' ? 440 : 540;
    osc2.type = kit === 'ethnic' ? 'sine' : 'square';
    osc2.frequency.value = kit === 'ethnic' ? 660 : 810;

    gain.gain.setValueAtTime(0.3, now); // Volume balanceado
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(getMasterGainNode());

    osc1.start(now);
    osc1.stop(now + 0.2);
    osc2.start(now);
    osc2.stop(now + 0.2);
    if (kit === 'lofi') playVinylCrackles();
}
