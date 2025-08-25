/**
 * @file Gerenciamento de presets (salvar/carregar).
 */
import { synthSettings, defaultSynthSettings, sequencerData, setSequencerData } from '../state/state.js';
import { stopAllNotes } from '../audio/note-engine.js';
import { stopArpeggiator, startArpeggiator } from './arpeggiator.js';
import { toggleEffect } from '../audio/audio-core.js';
import { showTemporaryMessage } from '../ui/display.js';
import { updateUIFromState } from '../ui/controls.js';

const presets = [{}, {}, {}, {}];

/**
 * Salva as configurações atuais do sintetizador em um slot de preset.
 * @param {number} index O índice do slot de preset (0-3).
 */
export function savePreset(index) {
    presets[index] = JSON.parse(JSON.stringify(synthSettings));
    presets[index].sequencer = [...sequencerData];
    showTemporaryMessage(`PRESET ${index + 1} SAVED`);
}

/**
 * Carrega as configurações do sintetizador de um slot de preset.
 * @param {number} index O índice do slot de preset (0-3).
 */
export function loadPreset(index) {
    stopAllNotes(true);
    if (synthSettings.performance.arp) stopArpeggiator();
    // Adicionar lógica para parar o sequenciador se estiver tocando

    const presetToLoad = presets[index];

    if (Object.keys(presetToLoad).length === 0) {
        setSequencerData(Array(16).fill(false));
        showTemporaryMessage(`PRESET ${index + 1} IS EMPTY`);
    } else {
        Object.assign(synthSettings, JSON.parse(JSON.stringify(presetToLoad)));
        setSequencerData([...(presetToLoad.sequencer || Array(16).fill(false))]);
        showTemporaryMessage(`PRESET ${index + 1} LOADED`);
    }

    updateUIFromState();
    ['reverb', 'delay', 'distortion'].forEach(effect => toggleEffect(effect));
    
    if (synthSettings.performance.arp) {
        startArpeggiator();
    }
}
