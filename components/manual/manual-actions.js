export const MANUAL_ACOES = Object.freeze({
    DUPLICAR: 'duplicate',
    LIGACAO: 'ligacao',
    PERSONALIZACAO: 'personalizacao'
});

export function criarAcaoManual(icon, label, extra = '', action = '') {
    return { icon, label, extra, action };
}

export function configurarAcoesManual({ frame, onAction }) {
    if (!frame || typeof onAction !== 'function') return () => {};

    const controlos = [...frame.querySelectorAll('[data-demo-action]')]
        .filter(controlo => controlo.dataset.demoAction !== MANUAL_ACOES.DUPLICAR);
    const listeners = controlos.map(controlo => {
        const listener = () => onAction(controlo.dataset.demoAction, controlo);
        controlo.addEventListener('click', listener);
        return { controlo, listener };
    });

    return () => listeners.forEach(({ controlo, listener }) => {
        controlo.removeEventListener('click', listener);
    });
}
