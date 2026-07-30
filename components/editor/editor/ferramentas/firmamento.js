import { obterTextoFirmamento } from '../modulos/firmamento-paleta.js';

let gestorSelecaoIniciado = false;

function selecionarFirmamento(alvo) {
    document.querySelectorAll('.firmamento-caixa').forEach(bloco => {
        bloco.classList.toggle('firmamento-selecionado', bloco === alvo);
    });
}

function iniciarGestorSelecao() {
    if (gestorSelecaoIniciado) return;
    gestorSelecaoIniciado = true;

    document.addEventListener('pointerdown', evento => {
        selecionarFirmamento(evento.target.closest?.('.firmamento-caixa') || null);
    });

    document.addEventListener('focusin', evento => {
        selecionarFirmamento(evento.target.closest?.('.firmamento-caixa') || null);
    });
}

export function criarFirmamento(caixa, onTextoAlterado, onApagar, onMover, onAddAbaixo, onPaleta) {
    iniciarGestorSelecao();
    const fundo = caixa.corFirmamento || '#050505';
    const corTexto = caixa.textoFirmamento || obterTextoFirmamento(fundo);
    const bloco = document.createElement('div');
    bloco.className = 'notebook-lines firmamento-caixa';
    bloco.style.setProperty('--firmamento-fundo', fundo);
    bloco.style.setProperty('--firmamento-texto', corTexto);
    bloco.style.setProperty('--firmamento-destaque', caixa.destaques || 'transparent');

    const barra = document.createElement('div');
    barra.className = 'firmamento-barra';
    barra.innerHTML = `
        <div class="firmamento-acoes">
            <button type="button" class="btn-cima" title="Mover para cima"><i class="fa-solid fa-chevron-up"></i></button>
            <button type="button" class="btn-baixo" title="Mover para baixo"><i class="fa-solid fa-chevron-down"></i></button>
            <span class="firmamento-separador"></span>
            <button type="button" class="btn-add-abaixo" title="Inserir ferramenta abaixo"><i class="fa-solid fa-plus"></i></button>
            <button type="button" class="btn-parabolica" title="Pesquisa X-SAT"><i class="fa-solid fa-satellite-dish"></i></button>
        </div>
        <div class="firmamento-acoes">
            <button type="button" class="btn-paleta" title="Centro de Personalização"><i class="fa-solid fa-palette"></i></button>
            <button type="button" class="btn-lixeira" title="Ocultar"><i class="fa-solid fa-trash"></i></button>
        </div>
    `;

    const conteudo = document.createElement('textarea');
    conteudo.className = 'firmamento-conteudo';
    conteudo.value = caixa.conteudo || '';
    conteudo.placeholder = 'Escreve o subtópico...';

    if (typeof window.aplicarEscudoBloqueio === 'function') {
        window.aplicarEscudoBloqueio(caixa, conteudo, bloco);
    }

    const ajustarAltura = () => {
        conteudo.style.height = 'auto';
        conteudo.style.height = `${conteudo.scrollHeight + 2}px`;
    };

    conteudo.addEventListener('input', () => {
        caixa.conteudo = conteudo.value;
        ajustarAltura();
        onTextoAlterado(caixa);
    });

    barra.querySelector('.btn-cima').onclick = () => onMover(caixa, 'cima');
    barra.querySelector('.btn-baixo').onclick = () => onMover(caixa, 'baixo');
    barra.querySelector('.btn-add-abaixo').onclick = () => onAddAbaixo(caixa.id);
    barra.querySelector('.btn-parabolica').onclick = () => window.dispararPesquisaParabolica?.(caixa.conteudo || '');
    barra.querySelector('.btn-paleta').onclick = () => onPaleta(caixa);
    barra.querySelector('.btn-lixeira').onclick = () => onApagar(caixa);

    bloco.append(barra, conteudo);
    setTimeout(ajustarAltura, 80);
    return bloco;
}
