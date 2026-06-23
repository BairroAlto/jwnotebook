import { IDENTIDADE_FERRAMENTAS } from '../constants/ferramentas.js';
import { FOCOS_BASE, FOCOS_SUBNOTA, FOCOS_QUESTAO, FOCOS_RACIOCINIO } from '../editor/modulos/paleta-cores.js';
import { BookState } from './book-state.js';
import { escapeHtml, linkarReferencias, textoDaCaixa } from './book-utils.js';

const FOCOS_POR_TIPO = {
    contentor: FOCOS_BASE,
    subnota: FOCOS_SUBNOTA,
    questao: FOCOS_QUESTAO,
    raciocinio: FOCOS_RACIOCINIO
};

export function renderBookFeed() {
    const feed = document.getElementById('book-feed');
    const title = document.getElementById('book-title');
    const info = document.getElementById('book-info');
    const tabs = document.getElementById('book-view-tabs');
    if (!feed) return;

    const dados = BookState.dadosNota || {};
    const caixas = caixasVisiveis(BookState.caixas, dados);
    const modos = getModosNota(dados);
    const hasArquivo = modos.includes('arquivo');
    const modeMeta = getBookModeMeta(modos);
    if (!hasArquivo && BookState.activeTab !== 'feed') {
        BookState.activeTab = 'feed';
    }

    const desktopSize = Number(BookState.settings.fontSizeDesktop || BookState.settings.fontSize || 17);
    const mobileSize = Number(BookState.settings.fontSizeMobile || desktopSize);
    const currentSize = window.innerWidth <= 768 ? mobileSize : desktopSize;
    BookState.settings.fontSize = currentSize;
    document.documentElement.style.setProperty('--book-text-size', `${currentSize}px`);
    document.body.classList.toggle('book-sequence-mode', BookState.settings.viewMode === 'sequence' && BookState.activeTab === 'feed');
    document.body.classList.toggle('book-dotted-tools', BookState.settings.marginStyle === 'dotted');
    document.body.classList.toggle('book-solid-tools', BookState.settings.marginStyle !== 'dotted');
    document.body.classList.toggle('book-archive-open', BookState.activeTab === 'arquivo');

    if (title) {
        title.innerHTML = `
            <span class="book-note-mode-badge" style="--mode-color:${escapeHtml(modeMeta.color)}">
                <i class="fa-solid ${escapeHtml(modeMeta.icon)}"></i>
            </span>
            <span>${escapeHtml(dados.nome || 'Sem titulo')}</span>
        `;
    }
    if (info) info.textContent = `${caixas.length} caixas | ${modeMeta.label} | modo visualizacao`;

    setupBookTabs(tabs, hasArquivo);
    feed.innerHTML = '';

    if (BookState.activeTab === 'arquivo' && hasArquivo) {
        renderArchiveTab(feed, dados);
        return;
    }

    if (!caixas.length) {
        feed.innerHTML = `<div class="book-empty">Esta nota nao tem caixas visiveis.</div>`;
        return;
    }

    let raciocinioCount = 0;
    caixas.forEach((caixa, index) => {
        const raciocinioNumero = caixa.tipo === 'raciocinio' ? ++raciocinioCount : null;
        feed.appendChild(renderBookBox(caixa, index, raciocinioNumero));
    });
}

function setupBookTabs(tabs, enabled) {
    if (!tabs) return;
    tabs.style.display = enabled ? 'inline-flex' : 'none';
    tabs.querySelectorAll('[data-book-tab]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.bookTab === BookState.activeTab);
        if (btn.dataset.bound === 'true') return;
        btn.dataset.bound = 'true';
        btn.addEventListener('click', () => {
            BookState.activeTab = btn.dataset.bookTab === 'arquivo' ? 'arquivo' : 'feed';
            renderBookFeed();
        });
    });
}

function caixasVisiveis(caixas, dadosNota) {
    const modos = getModosNota(dadosNota);
    const isSentinela = modos.includes('sentinela');
    const isPost = modos.includes('post');
    const filtradas = (caixas || []).filter(caixa => {
        if (caixa.estado !== 'on') return false;
        const temRef = caixa.referenciacodex !== undefined && caixa.referenciacodex !== null;
        return isSentinela ? temRef : !temRef;
    });
    return filtradas.sort((a, b) => isPost ? (b.ordem || 0) - (a.ordem || 0) : (a.ordem || 0) - (b.ordem || 0));
}

function renderBookBox(caixa, index, raciocinioNumero = null) {
    const config = IDENTIDADE_FERRAMENTAS[caixa.tipo] || IDENTIDADE_FERRAMENTAS.contentor;
    const focoInfo = getFocoInfo(caixa);
    const accent = getAccentColor(caixa, config, focoInfo);
    const card = document.createElement('article');
    card.id = `bloco-${caixa.id}`;
    card.className = `book-box book-box-${caixa.tipo || 'contentor'} ${caixa.respondi ? 'book-answered' : ''}`;
    card.dataset.caixaId = caixa.id;
    card.dataset.tipo = caixa.tipo || 'contentor';
    if (isHeadlessPrintTool(caixa)) card.classList.add('book-box-media-only');
    card.style.setProperty('--book-accent', accent);
    if (caixa.destaques) {
        card.classList.add('book-box-highlighted');
        card.style.setProperty('--book-highlight', caixa.destaques);
    }

    const tags = renderTags(caixa);
    const tagsTop = BookState.settings.tagPosition === 'top' ? tags : '';
    const tagsBottom = BookState.settings.tagPosition === 'bottom' ? tags : '';
    const titulo = resolveBoxTitle(caixa, config, index, raciocinioNumero);
    const conteudo = renderConteudo(caixa);

    card.innerHTML = `
        ${tagsTop}
        <div class="book-box-title">
            <div>
                <i class="${config.icon || 'fa-solid fa-box'}"></i>
                <span>${escapeHtml(titulo)}</span>
            </div>
            ${caixa.respondi ? '<i class="fa-solid fa-hand book-hand-static" title="Respondido"></i>' : ''}
        </div>
        <div class="book-box-content" style="${caixa.destaques ? `background:${escapeHtml(caixa.destaques)}; color:#050505;` : ''}">
            ${conteudo}
        </div>
        ${tagsBottom}
    `;

    return card;
}

function renderArchiveTab(feed, dados) {
    const arquivo = dados?.Arquivo || { gavetas: {} };
    const gavetas = Object.values(arquivo.gavetas || {}).filter(g => g?.estado !== 'off');
    const nav = BookState.archiveNav || { view: 'raiz', gavetaId: null, prateleiraId: null };

    if (nav.view === 'gaveta') {
        const gaveta = arquivo.gavetas?.[nav.gavetaId];
        if (!gaveta || gaveta.estado === 'off') {
            BookState.archiveNav = { view: 'raiz', gavetaId: null, prateleiraId: null };
            renderArchiveTab(feed, dados);
            return;
        }
        feed.innerHTML = `
            <div class="book-archive-panel">
                <div class="book-archive-header">
                    <button type="button" class="book-archive-back" data-book-archive-back="root"><i class="fa-solid fa-arrow-left"></i></button>
                    <div>
                        <h3>${escapeHtml(gaveta.nome || 'Gaveta')}</h3>
                        <p>${Object.values(gaveta.prateleiras || {}).filter(p => p?.estado !== 'off').length} prateleiras</p>
                    </div>
                </div>
                <div class="book-archive-grid book-archive-grid-shelves">
                    ${Object.values(gaveta.prateleiras || {}).filter(p => p?.estado !== 'off').map(prateleira => `
                        <button type="button" class="book-archive-card book-archive-shelf" data-book-prateleira="${escapeHtml(prateleira.id)}">
                            <i class="fa-solid fa-books"></i>
                            <strong>${escapeHtml(prateleira.nome || 'Prateleira')}</strong>
                            <span>${(prateleira.caixas || []).length} caixas</span>
                        </button>
                    `).join('')}
                </div>
                <div class="book-archive-linked">
                    <h4>Caixas nesta gaveta</h4>
                    <div class="book-archive-boxes"></div>
                </div>
            </div>
        `;
        bindArchiveNavigation(feed);
        renderArchiveBoxes(feed.querySelector('.book-archive-boxes'), gaveta.caixas || []);
        return;
    }

    if (nav.view === 'prateleira') {
        const gaveta = arquivo.gavetas?.[nav.gavetaId];
        const prateleira = gaveta?.prateleiras?.[nav.prateleiraId];
        if (!gaveta || gaveta.estado === 'off' || !prateleira || prateleira.estado === 'off') {
            BookState.archiveNav = { view: 'raiz', gavetaId: null, prateleiraId: null };
            renderArchiveTab(feed, dados);
            return;
        }
        feed.innerHTML = `
            <div class="book-archive-panel">
                <div class="book-archive-header">
                    <button type="button" class="book-archive-back" data-book-archive-back="gaveta"><i class="fa-solid fa-arrow-left"></i></button>
                    <div>
                        <h3>${escapeHtml(prateleira.nome || 'Prateleira')}</h3>
                        <p>${escapeHtml(gaveta.nome || 'Gaveta')}</p>
                    </div>
                </div>
                <div class="book-archive-boxes"></div>
            </div>
        `;
        bindArchiveNavigation(feed);
        renderArchiveBoxes(feed.querySelector('.book-archive-boxes'), prateleira.caixas || []);
        return;
    }

    feed.innerHTML = `
        <div class="book-archive-panel">
            <div class="book-archive-grid">
                ${gavetas.map(gaveta => `
                    <button type="button" class="book-archive-card" data-book-gaveta="${escapeHtml(gaveta.id)}" style="--archive-color:${escapeHtml(gaveta.cor || '#6366f1')}">
                        <span class="book-archive-accent"></span>
                        <strong>${escapeHtml(gaveta.nome || 'Gaveta')}</strong>
                        <div>
                            <span><i class="fa-solid fa-layer-group"></i> ${Object.values(gaveta.prateleiras || {}).filter(p => p?.estado !== 'off').length}</span>
                            <span><i class="fa-solid fa-box"></i> ${(gaveta.caixas || []).length}</span>
                        </div>
                    </button>
                `).join('') || '<div class="book-empty">Sem gavetas visiveis neste modo arquivo.</div>'}
            </div>
        </div>
    `;
    bindArchiveNavigation(feed);
}

function bindArchiveNavigation(feed) {
    feed.querySelectorAll('[data-book-gaveta]').forEach(btn => {
        btn.addEventListener('click', () => {
            BookState.archiveNav = { view: 'gaveta', gavetaId: btn.dataset.bookGaveta, prateleiraId: null };
            renderBookFeed();
        });
    });
    feed.querySelectorAll('[data-book-prateleira]').forEach(btn => {
        btn.addEventListener('click', () => {
            BookState.archiveNav = { ...BookState.archiveNav, view: 'prateleira', prateleiraId: btn.dataset.bookPrateleira };
            renderBookFeed();
        });
    });
    feed.querySelectorAll('[data-book-archive-back]').forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.dataset.bookArchiveBack === 'gaveta') {
                BookState.archiveNav = { ...BookState.archiveNav, view: 'gaveta', prateleiraId: null };
            } else {
                BookState.archiveNav = { view: 'raiz', gavetaId: null, prateleiraId: null };
            }
            renderBookFeed();
        });
    });
}

function renderArchiveBoxes(target, ids) {
    if (!target) return;
    const caixaMap = new Map((BookState.caixas || []).filter(caixa => caixa.estado === 'on').map(caixa => [caixa.id, caixa]));
    const caixas = ids.map(id => caixaMap.get(id)).filter(Boolean);
    if (!caixas.length) {
        target.innerHTML = `<div class="book-empty">Nenhuma caixa arquivada aqui.</div>`;
        return;
    }
    let raciocinioCount = 0;
    caixas.forEach((caixa, index) => {
        const raciocinioNumero = caixa.tipo === 'raciocinio' ? ++raciocinioCount : null;
        target.appendChild(renderBookBox(caixa, index, raciocinioNumero));
    });
}

function renderConteudo(caixa) {
    if (Array.isArray(caixa.textosanexados) && caixa.textosanexados.length) {
        return caixa.textosanexados.map(item => `
            <p class="book-bible-line">
                <strong>${escapeHtml(item.livro)} ${escapeHtml(item.cap)}:${escapeHtml(item.ver)}</strong>
                ${linkarReferencias(item.texto || '')}
            </p>
        `).join('');
    }

    if (caixa.tipo === 'webcard') {
        return renderWebcards(caixa);
    }

    if (caixa.tipo === 'galeria' || Array.isArray(caixa.imagens)) {
        return renderGallery(caixa);
    }

    if (caixa.tipo === 'elevador') {
        return renderElevator(caixa);
    }

    if (caixa.tipo === 'cartaovisita') {
        return renderBusinessCard(caixa);
    }

    return `<p>${linkarReferencias(caixa.conteudo || textoDaCaixa(caixa) || '')}</p>`;
}

function resolveBoxTitle(caixa, config, index, raciocinioNumero) {
    const baseTitle = caixa.titulo || config.nome || `Caixa ${index + 1}`;
    if (caixa.tipo !== 'raciocinio' || !raciocinioNumero) return baseTitle;
    return caixa.titulo ? `#${raciocinioNumero} ${caixa.titulo}` : `#${raciocinioNumero} ${config.nome || 'Raciocinio'}`;
}

function renderWebcards(caixa) {
    if (Array.isArray(caixa.links) && caixa.links.length) {
        return `<div class="book-webcards">
            ${caixa.links.map(link => {
                if (link?.loading) {
                    return `<div class="book-webcard book-webcard-loading"><i class="fa-solid fa-circle-notch fa-spin"></i></div>`;
                }
                const href = escapeHtml(link?.url || '#');
                const title = escapeHtml(link?.titulo || link?.site || link?.url || 'WebCard');
                const site = escapeHtml(link?.site || 'Ver Site');
                const image = link?.imagem
                    ? `<div class="book-webcard-image"><img src="${escapeHtml(link.imagem)}" alt="${title}" loading="lazy"></div>`
                    : `<div class="book-webcard-image book-webcard-image-empty"><i class="fa-solid fa-globe"></i></div>`;
                return `<a class="book-webcard" href="${href}" target="_blank" rel="noopener">
                    ${image}
                    <div class="book-webcard-copy">
                        <strong>${title}</strong>
                        <span>${site}</span>
                    </div>
                </a>`;
            }).join('')}
        </div>`;
    }

    if (caixa.url) {
        return `<a href="${escapeHtml(caixa.url)}" target="_blank" rel="noopener">${escapeHtml(caixa.url)}</a>
            <p>${linkarReferencias(caixa.conteudo || '')}</p>`;
    }

    return `<p class="book-inline-empty">Nenhum WebCard anexado.</p>`;
}

function renderGallery(caixa) {
    const imagens = Array.isArray(caixa.links) && caixa.links.length
        ? caixa.links
        : Array.isArray(caixa.imagens)
            ? caixa.imagens.map(img => img?.url || img?.src || img).filter(Boolean)
            : [];
    if (!imagens.length) {
        return `<p class="book-inline-empty">Nenhuma imagem anexada.</p>`;
    }
    const sizeClass = {
        pequenas: 'book-gallery-small',
        medias: 'book-gallery-medium',
        grandes: 'book-gallery-large',
        gigantes: 'book-gallery-huge'
    }[caixa.urldimensao || 'medias'] || 'book-gallery-medium';
    return `<div class="book-gallery ${sizeClass}">
        ${imagens.map(url => `<div class="book-gallery-card"><img src="${escapeHtml(url)}" alt="" loading="lazy"></div>`).join('')}
    </div>`;
}

function renderElevator(caixa) {
    if (!Array.isArray(caixa.pastapai) || !caixa.pastapai.length) {
        return `<p class="book-inline-empty">Nenhuma estrutura adicionada no elevador.</p>`;
    }
    return `<div class="book-elevator">
        ${caixa.pastapai.map((pai, index) => `
            <section class="book-elevator-parent">
                <div class="book-elevator-head">
                    <strong>${escapeHtml(pai?.nome || `Barra ${index + 1}`)}</strong>
                </div>
                ${pai?.oculto ? '' : `
                    ${(pai.links || []).length ? `<div class="book-elevator-links">
                        ${(pai.links || []).map(link => `
                            <a href="${escapeHtml(link?.url || '#')}" target="_blank" rel="noopener">
                                <i class="fa-solid fa-link"></i>
                                <span>${escapeHtml(link?.url || 'Link')}</span>
                            </a>
                        `).join('')}
                    </div>` : ''}
                    ${(pai.pastafilho || []).filter(filho => !filho?.oculto).length ? `<div class="book-elevator-children">
                        ${(pai.pastafilho || []).filter(filho => !filho?.oculto).map((filho, childIndex) => `
                            <article class="book-elevator-child">
                                <strong>${escapeHtml(filho?.nome || `Filho ${childIndex + 1}`)}</strong>
                                ${filho?.url ? `<a href="${escapeHtml(filho.url)}" target="_blank" rel="noopener">${escapeHtml(filho.url)}</a>` : ''}
                            </article>
                        `).join('')}
                    </div>` : ''}
                `}
            </section>
        `).join('')}
    </div>`;
}

function renderBusinessCard(caixa) {
    const sizeClass = {
        pequena: 'book-business-card-small',
        media: 'book-business-card-medium',
        grande: 'book-business-card-large'
    }[caixa.urldimensao || 'pequena'] || 'book-business-card-small';

    return `<div class="book-business-card ${sizeClass}">
        <div class="book-business-media ${caixa.url ? '' : 'book-business-media-empty'}">
            ${caixa.url
                ? `<img src="${escapeHtml(caixa.url)}" alt="${escapeHtml(caixa.titulo || 'Cartao')}" loading="lazy">`
                : `<i class="fa-solid fa-image"></i>`}
        </div>
        <div class="book-business-copy">
            ${caixa.titulo ? `<strong>${escapeHtml(caixa.titulo)}</strong>` : ''}
            ${caixa.conteudo ? `<p>${linkarReferencias(caixa.conteudo)}</p>` : `<p class="book-inline-empty">Sem descricao.</p>`}
        </div>
    </div>`;
}

function getFocoInfo(caixa) {
    const mapa = FOCOS_POR_TIPO[caixa.tipo] || FOCOS_BASE;
    return mapa[caixa.foco || 'original'] || mapa.original || { corForte: '#6366f1' };
}

function getAccentColor(caixa, config, focoInfo) {
    if (caixa.tipo === 'contentor' || caixa.tipo === 'subnota' || caixa.tipo === 'questao' || caixa.tipo === 'raciocinio') {
        return focoInfo.corForte || config.cor;
    }
    return config.cor || focoInfo.corForte || '#6366f1';
}

function renderTags(caixa) {
    const tags = [];
    if (caixa.destaques) tags.push({ label: nomeDestaque(caixa.destaques, caixa.nomeDestaque), color: caixa.destaques, highlight: true });
    (caixa.vincTopicos || []).forEach(t => tags.push({ label: t.nome || t.label || 'Topico', color: t.cor || '#818cf8' }));
    (caixa.neuroniosCosmos || []).forEach(t => tags.push({ label: t.nome || t.label || 'Cosmos', color: t.cor || '#d49d06' }));
    (caixa.tags || []).forEach(t => tags.push({ label: typeof t === 'string' ? t : (t.nome || 'Etiqueta'), color: t.cor || '#64748b' }));
    if (!tags.length) return '';
    return `<div class="book-tags">${tags.map(tag => `
        <span class="book-piccard ${tag.highlight ? 'book-piccard-highlight' : ''}" style="--tag-color:${escapeHtml(tag.color)}">${escapeHtml(tag.label)}</span>
    `).join('')}</div>`;
}

function nomeDestaque(cor, fallback) {
    return BookState.highlightNames?.[cor] || BookState.highlightNames?.[String(cor || '').toUpperCase()] || fallback || 'Destaque';
}

function getModosNota(dadosNota) {
    return Array.isArray(dadosNota?.modo) ? dadosNota.modo : [dadosNota?.modo || 'normal'];
}

function getBookModeMeta(modos) {
    const lista = Array.isArray(modos) ? modos : [modos || 'normal'];
    const personalizados = lista.filter(modo => modo !== 'normal');
    if (lista.includes('sentinela')) return { icon: 'fa-tower-observation', color: '#d4a373', label: 'sentinela' };
    if (personalizados.length >= 2) return { icon: 'fa-boxes-stacked', color: '#f59e0b', label: 'conjunto' };
    if (lista.includes('post')) return { icon: 'fa-newspaper', color: '#ef4444', label: 'post' };
    if (lista.includes('arquivo')) return { icon: 'fa-box-archive', color: '#22c55e', label: 'arquivo' };
    return { icon: 'fa-book-open-reader', color: '#60a5fa', label: 'normal' };
}

function isHeadlessPrintTool(caixa) {
    return caixa?.tipo === 'webcard' || caixa?.tipo === 'galeria' || Array.isArray(caixa?.imagens);
}

export function getVisibleBookBoxes() {
    return caixasVisiveis(BookState.caixas, BookState.dadosNota);
}
