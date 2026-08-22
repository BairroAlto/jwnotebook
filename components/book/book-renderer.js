import { isMobileViewport } from '../ui/mobile-device.js';
import { BookState } from './book-state.js';
import { escapeHtml, linkarReferencias } from './book-utils.js';
import { construirGruposFundidos } from '../editor/modulos/fundir-manager.js';
import { ehHtmlRico, sanitizarHtmlRico } from '../editor/modulos/rich-text-editor.js';
import { renderizarBairroBook } from './book-bairro.js';
import { renderizarSequenciaApenasTexto } from './book-text-sequence.js';

const TIPOS = {
    contentor: { nome: 'Contentor', icon: 'fa-box-archive', cor: '#f97316' },
    questao: { nome: 'Questao', icon: 'fa-circle-question', cor: '#10b981' },
    subnota: { nome: 'Subnota', icon: 'fa-file-pen', cor: '#3b82f6' },
    raciocinio: { nome: 'Raciocinio', icon: 'fa-brain', cor: '#f59e0b' },
    caixatexto: { nome: 'Anotacao', icon: 'fa-note-sticky', cor: '#818cf8' },
    citacaobiblica: { nome: 'Citação Bíblica', icon: 'fa-book-open', cor: '#94a3b8' },
    firmamento: { nome: 'Firmamento', icon: 'fa-aquarius', cor: '#d4af37' },
    bairro: { nome: 'Bairro Tarefas', icon: 'fa-city', cor: '#c084fc' }
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
    const modoApenasTexto = settings.viewMode === 'text-sequence';
    container.classList.toggle('book-sequence-mode', settings.viewMode === 'sequence' || modoApenasTexto);
    container.classList.toggle('book-text-sequence-mode', modoApenasTexto);
    container.classList.toggle('book-dotted-tools', settings.marginStyle === 'dotted');
    container.classList.toggle('book-solid-tools', settings.marginStyle !== 'dotted');

    if (!caixas.length) {
        feed.innerHTML = '<p class="book-inline-empty">Esta nota ainda nao tem caixas visiveis.</p>';
        return;
    }

    if (modoApenasTexto) {
        feed.innerHTML = renderizarSequenciaApenasTexto(caixas);
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
    const isFirmamento = caixa.tipo === 'firmamento';
    const isBairro = caixa.tipo === 'bairro';
    const textoBiblicoHtml = renderizarTextosBiblicos(caixa);
    const imagens = obterImagensCaixa(caixa);
    const destaque = caixa.destaques || caixa.destaque || '';
    const nomeDestaque = BookState.highlightNames?.[destaque] || destaque;
    const tags = [caixa.foco, nomeDestaque]
        .filter(Boolean)
        .filter(tag => String(tag).trim().toLowerCase() !== 'original');
    const corFirmamento = obterCorSegura(caixa.corFirmamento, '#050505');
    const textoFirmamento = obterCorSegura(caixa.textoFirmamento, '#ffffff');
    const corBairro = obterCorSegura(caixa.corBairro, '#c084fc');
    const style = isFirmamento
        ? `--book-accent:${corFirmamento};--book-firmamento-fundo:${corFirmamento};--book-firmamento-texto:${textoFirmamento};--book-firmamento-destaque:${obterCorSegura(destaque, 'transparent')};`
        : isBairro
            ? `--book-accent:${corBairro};--book-bairro-cor:${corBairro};${destaque ? '--book-highlight:' + destaque + ';' : ''}`
            : '--book-accent:' + (caixa.corFocus || meta.cor) + ';' + (destaque ? '--book-highlight:' + destaque + ';' : '');
    const tagHtml = tags.length
        ? '<div class="book-tags">' + tags.map(tag => '<span class="book-piccard" style="--tag-color:' + escapeHtml(meta.cor) + '">' + escapeHtml(tag) + '</span>').join('') + '</div>'
        : '';
    const content = isFirmamento
        ? (prepararConteudoLivro(texto) || '<p><span class="book-inline-empty">Caixa vazia.</span></p>')
        : isBairro
            ? renderizarBairroBook(caixa)
            : (textoBiblicoHtml || prepararConteudoLivro(texto));
    const imagensHtml = imagens.length
        ? '<div class="book-gallery ' + obterClasseGaleria(caixa.urldimensao) + '">' + imagens.map(url =>
            '<div class="book-gallery-card"><img src="' + escapeHtml(url) + '" alt="" loading="lazy"></div>'
        ).join('') + '</div>'
        : '';
    const topTags = settings.tagPosition === 'top' ? tagHtml : '';
    const bottomTags = settings.tagPosition === 'top' ? '' : tagHtml;

    return {
        meta,
        id,
        style,
        destaque,
        topTags,
        bottomTags,
        content,
        imagensHtml,
        titulo,
        contentClass: isFirmamento ? 'book-firmamento-content' : isBairro ? 'book-bairro-content' : 'book-box-content',
        boxClass: isFirmamento ? 'book-box-firmamento' : isBairro ? 'book-box-bairro' : '',
        temTexto: isFirmamento || isBairro || Boolean(texto || textoBiblicoHtml)
    };
}

function obterCorSegura(valor, fallback) {
    const cor = String(valor || '').trim();
    return /^#[0-9a-f]{3,8}$/i.test(cor) ? cor : fallback;
}

function prepararConteudoLivro(texto) {
    if (!texto) return '';
    if (!ehHtmlRico(texto)) return `<p>${linkarReferencias(texto)}</p>`;

    const html = sanitizarHtmlRico(texto);
    return /<(p|div|ul|ol|blockquote)\b/i.test(html) ? html : `<p>${html}</p>`;
}

function renderizarTextosBiblicos(caixa) {
    if (caixa.tipo !== 'citacaobiblica' || !Array.isArray(caixa.textosanexados)) return '';

    return caixa.textosanexados.map(item => {
        const livro = String(item?.livro || '').trim();
        const cap = String(item?.cap ?? '').trim();
        const ver = String(item?.ver ?? '').trim();
        const referencia = [livro, cap && ver ? `${cap}:${ver}` : cap].filter(Boolean).join(' ');
        const texto = String(item?.texto || '').trim();
        if (!referencia && !texto) return '';

        const referenciaHtml = referencia
            ? `<strong><button class="book-bible-ref" data-livro="${escapeHtml(livro)}" data-cap="${escapeHtml(cap)}" data-ver="${escapeHtml(ver)}">${escapeHtml(referencia)}</button></strong>`
            : '';
        return `<span class="book-bible-line">${referenciaHtml}${escapeHtml(texto)}</span>`;
    }).join('');
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
        ? '<div class="' + dados.contentClass + '">' + dados.content + '</div>'
        : (dados.imagensHtml ? '' : '<div class="book-box-content"><p><span class="book-inline-empty">Caixa vazia.</span></p></div>'));

    return titulo + dados.topTags + corpo + (incluirRodape ? rodapeHtml : '');
}

function renderCaixa(caixa, index, settings) {
    const dados = obterDadosCaixa(caixa, index, settings);
    const mediaClass = dados.imagensHtml && !dados.temTexto ? ' book-box-media-only' : '';

    return '<article id="bloco-' + escapeHtml(dados.id) + '" class="book-box' + (dados.boxClass ? ' ' + dados.boxClass : '') + mediaClass + ' ' + (dados.destaque ? 'book-box-highlighted' : '') + '" data-caixa-id="' + escapeHtml(dados.id) + '" style="' + escapeHtml(dados.style) + '">' +
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
            '<section id="bloco-' + escapeHtml(dados.id) + '" class="book-box-fundido-membro' + (dados.boxClass ? ' ' + dados.boxClass : '') + (dados.imagensHtml && !dados.temTexto ? ' book-box-media-only' : '') + ' ' + (dados.destaque ? 'book-box-highlighted' : '') + '" data-caixa-id="' + escapeHtml(dados.id) + '" style="' + escapeHtml(dados.style) + '">' +
                renderConteudoCaixa(dados, indice === 0, {
                    incluirRodape: indice === grupo.length - 1,
                    rodapeHtml: indice === grupo.length - 1 ? rodapeGrupo : ''
                }) +
            '</section>'
        ).join('') +
        '</article>';
}
