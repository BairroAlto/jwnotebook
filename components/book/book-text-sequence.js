import { obterTextoSimplesRico } from '../editor/modulos/rich-text-editor.js';
import { textoConteudoBairroBook } from './book-bairro.js';
import { escapeHtml, linkarReferencias } from './book-utils.js';

export function renderizarSequenciaApenasTexto(caixas) {
    const blocos = (Array.isArray(caixas) ? caixas : [])
        .map((caixa, index) => renderizarBlocoTexto(caixa, index))
        .filter(Boolean);

    return blocos.length
        ? blocos.join('')
        : '<p class="book-inline-empty">Esta nota não tem conteúdo textual visível.</p>';
}

function renderizarBlocoTexto(caixa, index) {
    const texto = obterConteudoTextual(caixa).trim();
    if (!texto) return '';

    const id = String(caixa?.id || `caixa-${index}`);
    return `<article id="bloco-${escapeHtml(id)}" class="book-text-sequence-item" data-caixa-id="${escapeHtml(id)}"><p>${linkarReferencias(texto)}</p></article>`;
}

function obterConteudoTextual(caixa) {
    if (!caixa) return '';
    if (caixa.tipo === 'bairro') return textoConteudoBairroBook(caixa);

    const textosBiblicos = obterTextosBiblicos(caixa);
    if (textosBiblicos) return textosBiblicos;

    return obterTextoSimplesRico(caixa.conteudo || caixa.texto || '');
}

function obterTextosBiblicos(caixa) {
    if (caixa.tipo !== 'citacaobiblica' || !Array.isArray(caixa.textosanexados)) return '';

    return caixa.textosanexados.map(item => {
        const livro = String(item?.livro || '').trim();
        const capitulo = String(item?.cap ?? '').trim();
        const versiculo = String(item?.ver ?? '').trim();
        const referencia = [livro, capitulo && versiculo ? `${capitulo}:${versiculo}` : capitulo]
            .filter(Boolean)
            .join(' ');
        return [referencia, String(item?.texto || '').trim()].filter(Boolean).join(' ');
    }).filter(Boolean).join('\n');
}
