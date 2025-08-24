/**
 * @file Configuração e gerenciamento dos efeitos de áudio.
 */

let effectsChain = {};

/**
 * Cria uma curva de waveshaper para o efeito de distorção.
 * @param {number} amount A intensidade da distorção.
 * @returns {Float32Array} A curva para o WaveShaperNode.
 */
function makeDistortionCurve(amount) {
    const k = typeof amount === 'number' ? amount : 50,
        n_samples = 44100,
        curve = new Float32Array(n_samples),
        deg = Math.PI / 180;
    let i = 0, x;
    for (; i < n_samples; ++i) {
        x = i * 2 / n_samples - 1;
        curve[i] = (3 + k) * x * 20 * deg / (Math.PI + k * Math.abs(x));
    }
    return curve;
}

/**
 * Cria uma resposta de impulso simples para o reverb de convolução.
 * @param {AudioContext} audioContext O contexto de áudio.
 * @returns {AudioBuffer} O buffer de resposta de impulso gerado.
 */
function createReverbImpulse(audioContext) {
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
 * Configura o gráfico de áudio para todos os efeitos.
 * @param {AudioContext} audioContext O contexto de áudio.
 * @param {AudioNode} sourceNode O nó de onde o som vem (masterGainNode).
 * @param {AudioNode} destinationNode O nó para onde o som vai (analyserNode).
 */
export function initEffects(audioContext, sourceNode, destinationNode) {
    const compressor = audioContext.createDynamicsCompressor();

    // --- Reverb ---
    const reverbInput = audioContext.createGain();
    const reverbOutput = audioContext.createGain();
    const reverbWet = audioContext.createGain();
    const reverbDry = audioContext.createGain();
    const convolver = audioContext.createConvolver();
    convolver.buffer = createReverbImpulse(audioContext);
    reverbWet.gain.value = 0;
    reverbDry.gain.value = 1.0;
    reverbInput.connect(reverbDry).connect(reverbOutput);
    reverbInput.connect(convolver).connect(reverbWet).connect(reverbOutput);

    // --- Delay ---
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
    delayInput.connect(delayDry).connect(delayOutput);
    delayInput.connect(delayNode);
    delayNode.connect(delayFeedback).connect(delayNode);
    delayNode.connect(delayWet).connect(delayOutput);

    // --- Distortion ---
    const distortionInput = audioContext.createGain();
    const distortionOutput = audioContext.createGain();
    const waveshaper = audioContext.createWaveShaper();
    const distortionWet = audioContext.createGain();
    const distortionDry = audioContext.createGain();
    waveshaper.curve = makeDistortionCurve(50);
    waveshaper.oversample = '4x';
    distortionWet.gain.value = 0;
    distortionDry.gain.value = 1.0;
    distortionInput.connect(distortionDry).connect(distortionOutput);
    distortionInput.connect(waveshaper).connect(distortionWet).connect(distortionOutput);

    // Conecta a cadeia de efeitos
    sourceNode.connect(reverbInput);
    reverbOutput.connect(delayInput);
    delayOutput.connect(distortionInput);
    distortionOutput.connect(compressor);
    compressor.connect(destinationNode);

    effectsChain = {
        reverb: { wet: reverbWet, dry: reverbDry },
        delay: { wet: delayWet, dry: delayDry },
        distortion: { wet: distortionWet, dry: distortionDry }
    };
}

export const getEffectsChain = () => effectsChain;
