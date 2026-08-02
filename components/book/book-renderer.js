import { isMobileViewport } from '../ui/mobile-device.js';
import { BookState } from './book-state.js';
import { escapeHtml, linkarReferencias } from './book-utils.js';

const TIPOS = {
    contentor: { nome: 'Contentor', icon: 'fa-box-archive', cor: '#f97316' },
    questao: { nome: 'Questao', icon: 'fa-circle-question', cor: '#10b981' },
    subnota: { nome: 'Subnota', icon: 'fa-file-pen', cor: '#3b82f6' },
    raciocinio: { nome: 'Raciocinio', icon: 'fa-brain', cor: '#f59e0b' },
    caixatexto: { nome: 'Anotacao', icon: 'fa-note-sticky', cor: '#818cf8' }
};

export function getVisibleBookBoxes() {
    return (Array.isArray(BookState.caixas) ? BookState.caixas : [])
        .filter(caixa => caixa && caixa.estado !== 'off');
}

export function renderBookFeed() {
    const nota = BookState.dadosNota;
    const title = document.getElementById('book-title');
    const info = document.getElementById('book-info');
    const feed = document.getElementById('book-feed');
    const container = document.getElementById('book-container');
    if (!title || !info || !feed || !container || !nota) return;

    const caixas = getVisibleBookBoxes();
    const settings = BookState.settings || {};
    const size = isMobileViewport() ? settings.fontSizeMobile : settings.fontSizeDesktop;
    if (size) document.documentElement.style.setProperty('--book-text-size', String(Number(size)) + 'px');

    title.textContent = nota.nome || 'Sem titulo';
    info.textContent = caixas.length + ' ' + (caixas.length === 1 ? 'caixa' : 'caixas') + ' · ' + (nota.onde === 'share' ? 'Share' : 'Local');
    container.classList.toggle('book-sequence-mode', settings.viewMode === 'sequence');
    container.classList.toggle('book-dotted-tools', settings.marginStyle === 'dotted');
    container.classList.toggle('book-solid-tools', settings.marginStyle !== 'dotted');

    if (!caixas.length) {
        feed.innerHTML = '<p class="book-inline-empty">Esta nota ainda nao tem caixas visiveis.</p>';
        return;
    }

    feed.innerHTML = caixas.map((caixa, index) => renderCaixa(caixa, index, settings)).join('');
}

function renderCaixa(caixa, index, settings) {
    const meta = TIPOS[caixa.tipo] || { nome: caixa.tipo || 'Caixa', icon: 'fa-box', cor: '#818cf8' };
    const id = String(caixa.id || 'caixa-' + index);
    const titulo = caixa.titulo || meta.nome;
    const texto = caixa.conteudo || caixa.texto || '';
    const destaque = caixa.destaques || caixa.destaque || '';
    const nomeDestaque = BookState.highlightNames?.[destaque] || destaque;
    const tags = [caixa.foco, nomeDestaque].filter(Boolean);
    const style = '--book-accent:' + (caixa.corFocus || meta.cor) + ';' + (destaque ? '--book-highlight:' + destaque + ';' : '');
    const tagHtml = tags.length
        ? '<div class="book-tags">' + tags.map(tag => '<span class="book-piccard" style="--tag-color:' + escapeHtml(meta.cor) + '">' + escapeHtml(tag) + '</span>').join('') + '</div>'
        : '';
    const content = texto ? linkarReferencias(texto) : '<span class="book-inline-empty">Caixa vazia.</span>';
    const topTags = settings.tagPosition === 'top' ? tagHtml : '';
    const bottomTags = settings.tagPosition === 'top' ? '' : tagHtml;

    return '<article id="bloco-' + escapeHtml(id) + '" class="book-box ' + (destaque ? 'book-box-highlighted' : '') + '" data-caixa-id="' + escapeHtml(id) + '" style="' + escapeHtml(style) + '">' +
        '<header class="book-box-title"><div><i class="fa-solid ' + meta.icon + '"></i><span>' + escapeHtml(titulo) + '</span></div><small>' + escapeHtml(meta.nome) + '</small></header>' +
        topTags +
        '<div class="book-box-content"><p>' + content + '</p></div>' +
        bottomTags +
        '</article>';
}
