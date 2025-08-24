/**
 * @file Ponto de entrada principal do sintetizador JWS-1.
 * Este script inicializa todos os módulos e coordena a configuração inicial.
 */

import { initAudioEngine } from './audio/audio-core.js';
import { setupDisplay } from './ui/display.js';
import { setupKeyboard } from './ui/keyboard.js';
import { setupKnobs } from './ui/knobs.js';
import { setupControls } from './ui/controls.js';
import { setupModal } from './ui/modal.js';
import { setupSequencerUI } from './features/sequencer.js';
import { updateUIFromState } from './ui/controls.js';

// Inicialização quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    // Configura a UI primeiro
    setupDisplay();
    setupModal();
    setupKeyboard();
    setupKnobs();
    setupControls();
    setupSequencerUI();

    // Atualiza a UI para refletir o estado inicial
    updateUIFromState();
    
    // Prepara o motor de áudio para ser iniciado na primeira interação do usuário
    const initAudioOnInteraction = () => {
        initAudioEngine();
        // Remove os listeners após a primeira ativação para não chamar a função novamente
        document.body.removeEventListener('click', initAudioOnInteraction);
        document.body.removeEventListener('keydown', initAudioOnInteraction);
    };

    document.body.addEventListener('click', initAudioOnInteraction);
    document.body.addEventListener('keydown', initAudioOnInteraction);

    // Listener para redimensionamento da janela, para o canvas do display
    window.addEventListener('resize', setupDisplay);
});
