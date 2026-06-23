// components/bible-portal/bible-search.js
import { BIBLIA_METADATA } from '../lists/biblia.js';

let currentTestamento = "tudo";
let resultadosGlobais = [];
let searchRunId = 0;
let bibleIndexPromise = null;
let bibleIndex = null;

function slugLivro(nome) {
    return nome.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, '_');
}

function escapeRegex(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizar(texto) {
    return String(texto).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function criarRegexExato(termo) {
    const escaped = escapeRegex(normalizar(termo));
    return new RegExp(`(^|[^\\p{L}\\p{N}])(${escaped})(?=$|[^\\p{L}\\p{N}])`, 'iu');
}

function contemTermo(textoNormalizado, termoNormalizado) {
    if (!termoNormalizado) return false;
    if (termoNormalizado.includes(" ")) return textoNormalizado.includes(termoNormalizado);
    return textoNormalizado.split(/[^\p{L}\p{N}]+/u).includes(termoNormalizado);
}

async function carregarIndiceBiblia() {
    if (bibleIndex) return bibleIndex;
    if (bibleIndexPromise) return bibleIndexPromise;

    bibleIndexPromise = (async () => {
        const rows = [];
        for (const livro of BIBLIA_METADATA) {
            try {
                const res = await fetch(`data/biblia/${slugLivro(livro.nome)}.json`);
                if (!res.ok) continue;
                const data = await res.json();
                const livroData = data[livro.nome];
                Object.entries(livroData || {}).forEach(([capNum, versiculos]) => {
                    Object.entries(versiculos || {}).forEach(([verNum, texto]) => {
                        rows.push({
                            livro: livro.nome,
                            livroId: livro.id,
                            cap: capNum,
                            ver: verNum,
                            ref: `${livro.nome} ${capNum}:${verNum}`,
                            texto,
                            textoNorm: normalizar(texto)
                        });
                    });
                });
            } catch (error) {
                console.warn(`[BIBLE-SEARCH] Nao foi possivel indexar ${livro.nome}.`, error);
            }
        }
        bibleIndex = rows;
        return rows;
    })();

    return bibleIndexPromise;
}

export const BibleSearch = {
    setTestamento: (testamento) => {
        currentTestamento = testamento;
    },

    preload: () => carregarIndiceBiblia(),

    executar: async (rawQuery, options = {}) => {
        const runId = ++searchRunId;
        const query = rawQuery.trim();
        if (query.length < 2) {
            if (!options.silentShort) alert("Escreve pelo menos 2 caracteres.");
            return;
        }

        const resultsContainer = document.getElementById('bible-search-results');
        const bookFilterRow = document.getElementById('filter-books-found');

        resultsContainer.innerHTML = `
            <div class="bible-search-loading">
                <i class="fa-solid fa-circle-notch fa-spin"></i>
                <p>A varrer Escrituras...</p>
            </div>`;

        const isExact = query.startsWith('"') && query.endsWith('"');
        const searchTerm = isExact ? query.slice(1, -1).trim() : query;
        const searchTermNorm = normalizar(searchTerm);
        const termosLivres = searchTermNorm.split(/\s+/).filter(Boolean);
        const achados = [];
        const livrosComSucesso = new Set();
        const index = await carregarIndiceBiblia();

        index.forEach(item => {
            if (currentTestamento === 'antigo' && item.livroId > 39) return;
            if (currentTestamento === 'novo' && item.livroId <= 39) return;

            const match = isExact
                ? item.textoNorm.includes(searchTermNorm)
                : termosLivres.every(termo => contemTermo(item.textoNorm, termo));

            if (!match) return;
            achados.push({ ...item, termo: searchTerm, termoNorm: searchTermNorm, exact: isExact });
            livrosComSucesso.add(item.livro);
        });

        if (runId !== searchRunId) return;

        resultadosGlobais = achados;
        BibleSearch.renderBookFilters(Array.from(livrosComSucesso));
        BibleSearch.renderLista(achados);
    },

    renderBookFilters: (livros) => {
        const bookFilterRow = document.getElementById('filter-books-found');
        if (!bookFilterRow) return;

        if (!livros.length) {
            bookFilterRow.classList.add('hidden');
            bookFilterRow.innerHTML = "";
            return;
        }

        bookFilterRow.classList.remove('hidden');
        bookFilterRow.innerHTML = livros.map(livro => `
            <button class="piccard book-found-pill" data-book="${livro}">${livro}</button>
        `).join('');

        bookFilterRow.querySelectorAll('.book-found-pill').forEach(pill => {
            pill.onclick = () => {
                const wasActive = pill.classList.contains('active');
                bookFilterRow.querySelectorAll('.book-found-pill').forEach(item => item.classList.remove('active'));

                if (wasActive) {
                    BibleSearch.renderLista(resultadosGlobais);
                    return;
                }

                pill.classList.add('active');
                BibleSearch.renderLista(resultadosGlobais.filter(r => r.livro === pill.dataset.book));
            };
        });
    },

    renderLista: (lista) => {
        const container = document.getElementById('bible-search-results');
        if (!container) return;

        if (!lista.length) {
            container.innerHTML = `<p class="bible-empty-state">Nenhum resultado encontrado.</p>`;
            return;
        }

        container.innerHTML = lista.map(item => {
            const marcado = marcarTextoNormalizado(item.texto, item.termoNorm);

            return `
                <button class="search-result-item" onclick="window.viajarParaVersiculo('${item.livro}', '${item.cap}', '${item.ver}')">
                    <span class="search-result-ref">${item.ref}</span>
                    <span class="search-result-text">${marcado}</span>
                </button>
            `;
        }).join('');
    },

    limpar: () => {
        searchRunId++;
        document.getElementById('bible-search-results')?.replaceChildren();
        const bookFilterRow = document.getElementById('filter-books-found');
        if (bookFilterRow) {
            bookFilterRow.classList.add('hidden');
            bookFilterRow.innerHTML = "";
        }
    }
};

function marcarTextoNormalizado(texto, termoNorm) {
    if (!termoNorm) return texto;
    const chars = Array.from(texto);
    const mapa = [];
    let norm = "";

    chars.forEach((char, idx) => {
        const normalized = normalizar(char);
        for (const nChar of Array.from(normalized)) {
            norm += nChar;
            mapa.push(idx);
        }
    });

    const start = norm.indexOf(termoNorm);
    if (start < 0) return texto;
    const end = start + termoNorm.length - 1;
    const originalStart = mapa[start];
    const originalEnd = mapa[end] + 1;

    return `${texto.slice(0, originalStart)}<mark>${texto.slice(originalStart, originalEnd)}</mark>${texto.slice(originalEnd)}`;
}

window.viajarParaVersiculo = (livro, cap, ver) => {
    document.getElementById('popup-search-bible')?.classList.remove('active');
    if (typeof window.carregarCapituloNoPortal === 'function') {
        window.carregarCapituloNoPortal(livro, cap, ver);
    }
};
