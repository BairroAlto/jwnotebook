// components/lists/reader/reader-view.js
import { ReaderBlockFactory } from './reader-block-factory.js';
import { ReaderInteraction } from './reader-interaction.js';

export function renderizarPaginaLeitura(obj, container, dataPai, onBack) {
    container.innerHTML = `
        <div id="btn-voltar-artigos" style="padding: 12px; cursor: pointer; color: var(--primary); font-size: 11px; font-weight: 800; border-bottom: 1px solid var(--border-color); background: var(--bg-panel); position: sticky; top:0; z-index:10; text-transform:uppercase;">
            <i class="fa-solid fa-chevron-left"></i> Voltar
        </div>
        <div id="livros-scroll" style="flex: 1; overflow-y: auto; padding: 25px 20px 100px 20px;">
            <h2 style="font-size: 22px; color: white; margin-bottom: 25px; font-weight: 700;">${obj.titulo}</h2>
            <div id="corpo-texto-leitura"></div>
        </div>
    `;

    const corpo = container.querySelector('#corpo-texto-leitura');
    const btnVoltar = container.querySelector('#btn-voltar-artigos');

    // Injetar blocos
    obj.conteudo.forEach(bloco => {
        const el = ReaderBlockFactory.create(bloco, () => {
            ReaderInteraction.handleLink(bloco, obj, dataPai);
        });
        corpo.appendChild(el);
    });

    btnVoltar.onclick = onBack;
}