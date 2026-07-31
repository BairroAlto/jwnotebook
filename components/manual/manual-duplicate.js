import { FERRAMENTAS_MANUAL } from './manual-data.js';

function criarElemento(tag, className, text = '') {
    const elemento = document.createElement(tag);
    if (className) elemento.className = className;
    if (text) elemento.textContent = text;
    return elemento;
}

function criarOpcaoFerramenta(item, selecionada) {
    const opcao = criarElemento('button', 'demo-tool-picker-item' + (selecionada ? ' is-selected' : ''));
    opcao.type = 'button';
    opcao.tabIndex = -1;
    opcao.setAttribute('aria-selected', String(selecionada));
    opcao.setAttribute('aria-disabled', 'true');
    opcao.style.setProperty('--tool-color', item.cor);

    const icone = criarElemento('i');
    icone.className = item.icone;
    icone.setAttribute('aria-hidden', 'true');
    const nome = criarElemento('span', '', item.nome);
    const marca = criarElemento('b', 'demo-tool-picker-check', '✓');

    opcao.append(icone, nome, marca);
    return opcao;
}

function criarPopupFerramentas(ferramenta) {
    const popup = criarElemento('div', 'demo-tool-picker');
    popup.setAttribute('role', 'dialog');
    popup.setAttribute('aria-label', 'Inserir Ferramenta');

    const cabecalho = criarElemento('header', 'demo-tool-picker-header');
    const titulo = criarElemento('strong', '', 'Inserir Ferramenta');
    const fechar = criarElemento('span', 'demo-tool-picker-close');
    const fecharIcone = criarElemento('i');
    fecharIcone.className = 'fa-solid fa-xmark';
    fecharIcone.setAttribute('aria-hidden', 'true');
    fechar.appendChild(fecharIcone);
    cabecalho.append(titulo, fechar);

    const grelha = criarElemento('div', 'demo-tool-picker-grid');
    const opcoes = FERRAMENTAS_MANUAL.map(item => {
        const selecionada = item.id === ferramenta.id;
        const opcao = criarOpcaoFerramenta(item, selecionada);
        if (selecionada) popup.selectedOption = opcao;
        return opcao;
    });
    grelha.append(...opcoes);
    popup.append(cabecalho, grelha);
    return popup;
}

function prepararCopia(copia, ferramenta) {
    copia.classList.remove('is-playing', 'is-duplicate-source');
    copia.classList.add('demo-duplicate-copy');
    copia.setAttribute('aria-label', `Cópia animada de ${ferramenta.nome}`);

    if (ferramenta.id === 'raciocinio') {
        copia.querySelector('.demo-reason-number')?.replaceChildren(document.createTextNode('#2'));
    }

    copia.querySelectorAll('[data-demo-action]').forEach(botao => {
        botao.setAttribute('aria-disabled', 'true');
        botao.tabIndex = -1;
    });
}

export function configurarDuplicacaoManual({ stage, frame, ferramenta, controls }) {
    const botaoAdicionar = frame.querySelector('[data-demo-action="duplicate"]');
    if (!botaoAdicionar || !ferramenta) return () => {};

    let popup = null;
    let duplicada = false;

    const duplicar = () => {
        if (duplicada) return;
        duplicada = true;
        botaoAdicionar.classList.add('is-pressed');
        frame.classList.add('is-duplicate-source');

        popup = criarPopupFerramentas(ferramenta);
        stage.appendChild(popup);
        requestAnimationFrame(() => popup?.classList.add('is-visible'));

        controls.later(() => {
            popup?.selectedOption?.classList.add('is-selecting');
        }, 300);

        controls.later(() => {
            popup?.classList.add('is-closing');
        }, 820);

        controls.later(() => {
            popup?.remove();
            popup = null;
            const copia = frame.cloneNode(true);
            prepararCopia(copia, ferramenta);
            stage.appendChild(copia);
        }, 1080);
    };

    botaoAdicionar.addEventListener('click', duplicar);

    return () => {
        botaoAdicionar.removeEventListener('click', duplicar);
        popup?.remove();
    };
}