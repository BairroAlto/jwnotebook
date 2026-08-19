import { FERRAMENTAS_MANUAL } from './manual-data.js';
import { renderManualDemo } from './manual-demos.js';
import { MANUAL_ACOES } from './manual-actions.js';
import { inicializarTutorialLigacao } from './manual-connection-tutorial.js';

let manualInicializado = false;
let fecharAnterior = null;
let limparDemoAtual = () => {};

function obterElementos() {
    return {
        overlay: document.getElementById('popup-manual-overlay'),
        btnAbrir: document.getElementById('btn-abrir-manual'),
        btnFechar: document.getElementById('btn-fechar-manual'),
        btnRepetir: document.getElementById('btn-repetir-manual'),
        lista: document.getElementById('manual-tool-list'),
        demo: document.getElementById('manual-demo'),
        titulo: document.getElementById('manual-tool-title'),
        kicker: document.getElementById('manual-tool-kicker'),
        descricao: document.getElementById('manual-tool-description'),
        nota: document.getElementById('manual-tool-note')
    };
}

function selecionarCategoria(categoria) {
    document.querySelectorAll('[data-manual-category]').forEach(botao => {
        const ativo = botao.dataset.manualCategory === categoria;
        botao.classList.toggle('is-active', ativo);
        botao.setAttribute('aria-selected', String(ativo));
    });

    document.querySelectorAll('[data-manual-panel]').forEach(painel => {
        const ativo = painel.dataset.manualPanel === categoria;
        painel.hidden = !ativo;
        painel.classList.toggle('is-active', ativo);
    });
}

function atualizarFerramenta(tipo) {
    const ferramenta = FERRAMENTAS_MANUAL.find(item => item.id === tipo) || FERRAMENTAS_MANUAL[0];
    const elementos = obterElementos();
    if (!ferramenta || !elementos.demo) return;

    document.querySelectorAll('[data-manual-tool]').forEach(botao => {
        const ativo = botao.dataset.manualTool === ferramenta.id;
        botao.classList.toggle('is-active', ativo);
        botao.setAttribute('aria-selected', String(ativo));
    });

    if (elementos.kicker) elementos.kicker.textContent = ferramenta.grupo;
    if (elementos.titulo) elementos.titulo.textContent = ferramenta.nome;
    if (elementos.descricao) elementos.descricao.textContent = ferramenta.descricao;
    if (elementos.nota) elementos.nota.textContent = ferramenta.nota;

    limparDemoAtual();
    limparDemoAtual = renderManualDemo(elementos.demo, ferramenta.id, {
        onAction: executarAcaoDemo
    });
}

function executarAcaoDemo(acao) {
    if (acao === MANUAL_ACOES.LIGACAO || acao === MANUAL_ACOES.PERSONALIZACAO) {
        selecionarCategoria(acao);
        if (acao === MANUAL_ACOES.LIGACAO) window.selecionarAbaManualLigacao?.('hub');
        document.querySelector(`[data-manual-category="${acao}"]`)?.focus();
    }
}

function criarBotaoFerramenta(ferramenta) {
    const botao = document.createElement('button');
    botao.type = 'button';
    botao.className = 'manual-tool-button';
    botao.dataset.manualTool = ferramenta.id;
    botao.setAttribute('role', 'tab');
    botao.setAttribute('aria-selected', 'false');
    botao.style.setProperty('--tool-color', ferramenta.cor);
    botao.innerHTML = `<i class="${ferramenta.icone}" aria-hidden="true"></i><span>${ferramenta.nome}<small>${ferramenta.grupo}</small></span>`;
    botao.addEventListener('click', () => atualizarFerramenta(ferramenta.id));
    return botao;
}

function renderizarListaFerramentas(lista) {
    if (!lista) return;
    lista.replaceChildren(...FERRAMENTAS_MANUAL.map(criarBotaoFerramenta));
}

function abrirManual() {
    const { overlay } = obterElementos();
    if (!overlay) return;
    fecharAnterior = document.activeElement;
    overlay.hidden = false;
    overlay.classList.add('active');
    overlay.setAttribute('aria-hidden', 'false');
    selecionarCategoria('caixas');
    atualizarFerramenta(FERRAMENTAS_MANUAL[0].id);
    requestAnimationFrame(() => obterElementos().btnFechar?.focus());
}

function fecharManual() {
    const { overlay } = obterElementos();
    if (!overlay) return;
    overlay.classList.remove('active');
    overlay.setAttribute('aria-hidden', 'true');
    overlay.hidden = true;
    limparDemoAtual();
    fecharAnterior?.focus?.();
    fecharAnterior = null;
}

export function inicializarManual() {
    if (manualInicializado) return;
    const elementos = obterElementos();
    if (!elementos.overlay || !elementos.btnAbrir) return;

    manualInicializado = true;
    inicializarTutorialLigacao({ onNavigate: selecionarCategoria });
    renderizarListaFerramentas(elementos.lista);
    elementos.btnAbrir.addEventListener('click', abrirManual);
    elementos.btnFechar?.addEventListener('click', fecharManual);
    elementos.btnRepetir?.addEventListener('click', () => {
        const ativo = document.querySelector('[data-manual-tool].is-active')?.dataset.manualTool || FERRAMENTAS_MANUAL[0].id;
        atualizarFerramenta(ativo);
    });

    document.querySelectorAll('[data-manual-category]').forEach(botao => {
        botao.addEventListener('click', () => {
            const categoria = botao.dataset.manualCategory;
            selecionarCategoria(categoria);
            if (categoria === 'ligacao') window.selecionarAbaManualLigacao?.('hub');
        });
    });

    elementos.overlay.addEventListener('click', evento => {
        if (evento.target === elementos.overlay) fecharManual();
    });

    document.addEventListener('keydown', evento => {
        if (evento.key === 'Escape' && elementos.overlay.classList.contains('active')) fecharManual();
    });

    window.abrirManual = abrirManual;
    window.fecharManual = fecharManual;
    window.abrirManualParaCategoria = categoria => {
        abrirManual();
        if (categoria === 'ligacao' || categoria === 'personalizacao') {
            selecionarCategoria(categoria);
            if (categoria === 'ligacao') window.selecionarAbaManualLigacao?.('hub');
        }
    };
}
