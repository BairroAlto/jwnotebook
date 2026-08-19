export function iniciarAbasLoja(root = document.getElementById('set-loja')) {
    if (!root || root.dataset.storeTabsReady === 'true') return;
    root.dataset.storeTabsReady = 'true';

    const tabs = [...root.querySelectorAll('[data-store-tab]')];
    const paineis = [...root.querySelectorAll('[data-store-panel]')];
    const activar = alvo => {
        tabs.forEach(tab => {
            const activo = tab.dataset.storeTab === alvo;
            tab.classList.toggle('is-active', activo);
            tab.setAttribute('aria-selected', String(activo));
        });
        paineis.forEach(painel => {
            painel.hidden = painel.dataset.storePanel !== alvo;
        });
    };

    tabs.forEach(tab => tab.addEventListener('click', () => activar(tab.dataset.storeTab)));
    activar(tabs.find(tab => tab.classList.contains('is-active'))?.dataset.storeTab || 'ferramentas');
}

