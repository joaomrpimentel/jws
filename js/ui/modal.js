/**
 * @file Lógica para o modal de ajuda.
 */

const helpModal = document.getElementById('help-modal');
const helpBtn = document.getElementById('help-btn');
const closeModalBtn = document.getElementById('close-modal-btn');

export function setupModal() {
    const showModal = () => helpModal.classList.remove('hidden');
    const hideModal = () => helpModal.classList.add('hidden');

    helpBtn.addEventListener('click', showModal);
    closeModalBtn.addEventListener('click', hideModal);
    helpModal.addEventListener('click', (e) => {
        if (e.target === helpModal) hideModal();
    });

    // Mostra o modal na primeira visita
    if (!localStorage.getItem('jws_visited')) {
        showModal();
        localStorage.setItem('jws_visited', 'true');
    }
}
