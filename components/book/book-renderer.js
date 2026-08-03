import { isMobileViewport } from '../ui/mobile-device.js';
import { BookState } from './book-state.js';
import { escapeHtml, linkarReferencias } from './book-utils.js';
import { construirGruposFundidos } from '../editor/modulos/fundir-manager.js';

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

    const segmentos = construirGruposFundidos(caixas);
    feed.innerHTML = segmentos.map((segmento, index) => {
        if (segmento.caixas.length > 1) return renderGrupoFundido(segmento.caixas, index, settings);
        return renderCaixa(segmento.caixas[0], index, settings);
    }).join('');
}

function obterDadosCaixa(caixa, index, settings) {
    const meta = TIPOS[caixa.tipo] || { nome: caixa.tipo || 'Caixa', icon: 'fa-box', cor: '#818cf8' };
    const id = String(caixa.id || 'caixa-' + index);
    const titulo = caixa.titulo || meta.nome;
    const texto = caixa.conteudo || caixa.texto || '';
    const imagens = obterImagensCaixa(caixa);
    const destaque = caixa.destaques || caixa.destaque || '';
    const nomeDestaque = BookState.highlightNames?.[destaque] || destaque;
    const tags = [caixa.foco, nomeDestaque]
        .filter(Boolean)
        .filter(tag => String(tag).trim().toLowerCase() !== 'original');
    const style = '--book-accent:' + (caixa.corFocus || meta.cor) + ';' + (destaque ? '--book-highlight:' + destaque + ';' : '');
    const tagHtml = tags.length
        ? '<div class="book-tags">' + tags.map(tag => '<span class="book-piccard" style="--tag-color:' + escapeHtml(meta.cor) + '">' + escapeHtml(tag) + '</span>').join('') + '</div>'
        : '';
    const content = texto ? linkarReferencias(texto) : '';
    const imagensHtml = imagens.length
        ? '<div class="book-gallery ' + obterClasseGaleria(caixa.urldimensao) + '">' + imagens.map(url =>
            '<div class="book-gallery-card"><img src="' + escapeHtml(url) + '" alt="" loading="lazy"></div>'
        ).join('') + '</div>'
        : '';
    const topTags = settings.tagPosition === 'top' ? tagHtml : '';
    const bottomTags = settings.tagPosition === 'top' ? '' : tagHtml;

    return { meta, id, style, destaque, topTags, bottomTags, content, imagensHtml, titulo, temTexto: Boolean(texto) };
}

function obterImagensCaixa(caixa) {
    const itens = Array.isArray(caixa.imagens)
        ? caixa.imagens
        : (['galeria', 'webcard'].includes(caixa.tipo) && Array.isArray(caixa.links) ? caixa.links : []);
    const imagemCartao = caixa.tipo === 'cartaovisita' && caixa.url ? [caixa.url] : [];

    return [...itens, ...imagemCartao].map(item => {
        if (typeof item === 'string') return item;
        if (caixa.tipo === 'webcard') return item?.imagem || item?.image || item?.src || item?.url || '';
        return item?.url || item?.src || item?.imagem || item?.image || '';
    }).map(normalizarUrlMedia).filter(Boolean);
}

function obterClasseGaleria(dimensao) {
    return {
        pequenas: 'book-gallery-small',
        medias: 'book-gallery-medium',
        grandes: 'book-gallery-large',
        gigantes: 'book-gallery-huge'
    }[dimensao] || 'book-gallery-medium';
}

function normalizarUrlMedia(valor) {
    const bruto = String(valor || '').trim();
    if (!bruto) return '';

    try {
        const base = typeof document !== 'undefined' ? document.baseURI : undefined;
        const url = new URL(bruto, base);
        if (url.protocol === 'data:') return /^data:image\//i.test(bruto) ? url.href : '';
        if (!['http:', 'https:', 'blob:'].includes(url.protocol)) return '';
        return url.href;
    } catch {
        return '';
    }
}

function renderConteudoCaixa(dados, mostrarTitulo = true, { incluirRodape = true, rodapeHtml = dados.bottomTags } = {}) {
    const titulo = mostrarTitulo
        ? '<header class="book-box-title"><div><i class="fa-solid ' + dados.meta.icon + '"></i><span>' + escapeHtml(dados.titulo) + '</span></div><small>' + escapeHtml(dados.meta.nome) + '</small></header>'
        : '';
    const corpo = dados.imagensHtml + (dados.temTexto
        ? '<div class="book-box-content"><p>' + dados.content + '</p></div>'
        : (dados.imagensHtml ? '' : '<div class="book-box-content"><p><span class="book-inline-empty">Caixa vazia.</span></p></div>'));

    return titulo + dados.topTags + corpo + (incluirRodape ? rodapeHtml : '');
}

function renderCaixa(caixa, index, settings) {
    const dados = obterDadosCaixa(caixa, index, settings);
    const mediaClass = dados.imagensHtml && !dados.temTexto ? ' book-box-media-only' : '';

    return '<article id="bloco-' + escapeHtml(dados.id) + '" class="book-box' + mediaClass + ' ' + (dados.destaque ? 'book-box-highlighted' : '') + '" data-caixa-id="' + escapeHtml(dados.id) + '" style="' + escapeHtml(dados.style) + '">' +
        renderConteudoCaixa(dados) +
        '</article>';
}

function renderGrupoFundido(caixas, index, settings) {
    const grupo = caixas.map((caixa, indice) => obterDadosCaixa(caixa, index + '-' + indice, settings));
    const primeiro = grupo[0];
    const ids = grupo.map(dados => dados.id).join('|');
    const rodapeGrupo = grupo.map(dados => dados.bottomTags).join('');

    return '<article class="book-box book-box-fundido" data-fundir-ids="' + escapeHtml(ids) + '" style="' + escapeHtml(primeiro.style) + '">' +
        grupo.map((dados, indice) =>
            '<section id="bloco-' + escapeHtml(dados.id) + '" class="book-box-fundido-membro' + (dados.imagensHtml && !dados.temTexto ? ' book-box-media-only' : '') + ' ' + (dados.destaque ? 'book-box-highlighted' : '') + '" data-caixa-id="' + escapeHtml(dados.id) + '" style="' + escapeHtml(dados.style) + '">' +
                renderConteudoCaixa(dados, indice === 0, {
                    incluirRodape: indice === grupo.length - 1,
                    rodapeHtml: indice === grupo.length - 1 ? rodapeGrupo : ''
                }) +
            '</section>'
        ).join('') +
        '</article>';
}
