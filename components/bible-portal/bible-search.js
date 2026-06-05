// components/bible-portal/bible-search.js
import { BIBLIA_METADATA } from '../lists/biblia.js';

let currentTestamento = "tudo";
let resultadosGlobais = [];

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

export const BibleSearch = {
    setTestamento: (testamento) => {
        currentTestamento = testamento;
    },

    executar: async (rawQuery, options = {}) => {
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

        let livrosParaVarrer = BIBLIA_METADATA;
        if (currentTestamento === 'antigo') livrosParaVarrer = BIBLIA_METADATA.filter(b => b.id <= 39);
        if (currentTestamento === 'novo') livrosParaVarrer = BIBLIA_METADATA.filter(b => b.id > 39);

        const isExact = query.startsWith('"') && query.endsWith('"');
        const searchTerm = isExact ? query.slice(1, -1).trim() : query;
        const searchTermNorm = normalizar(searchTerm);
        const termosLivres = searchTermNorm.split(/\s+/).filter(Boolean);
        const exactRegex = isExact ? criarRegexExato(searchTerm) : null;
        const achados = [];
        const livrosComSucesso = new Set();

        for (const livro of livrosParaVarrer) {
            try {
                const res = await fetch(`data/biblia/${slugLivro(livro.nome)}.json`);
                if (!res.ok) continue;

                const data = await res.json();
                const livroData = data[livro.nome];

                Object.entries(livroData).forEach(([capNum, versiculos]) => {
                    Object.entries(versiculos).forEach(([verNum, texto]) => {
                        const textoLower = normalizar(texto);
                        const match = isExact
                            ? exactRegex.test(textoLower)
                            : termosLivres.every(termo => textoLower.includes(termo));

                        if (!match) return;

                        achados.push({
                            ref: `${livro.nome} ${capNum}:${verNum}`,
                            texto,
                            livro: livro.nome,
                            cap: capNum,
                            ver: verNum,
                            termo: searchTerm,
                            exact: isExact
                        });
                        livrosComSucesso.add(livro.nome);
                    });
                });
            } catch (error) {
                console.warn(`[BIBLE-SEARCH] Nao foi possivel ler ${livro.nome}.`, error);
            }
        }

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
            const termoRegex = new RegExp(escapeRegex(item.termo), 'giu');
            const marcado = item.texto.replace(termoRegex, (match, offset, texto) => {
                if (!item.exact) return `<mark>${match}</mark>`;
                const before = offset === 0 ? "" : texto[offset - 1];
                const after = texto[offset + match.length] || "";
                const okBefore = !/[\p{L}\p{N}]/u.test(before);
                const okAfter = !/[\p{L}\p{N}]/u.test(after);
                return okBefore && okAfter ? `<mark>${match}</mark>` : match;
            });

            return `
                <button class="search-result-item" onclick="window.viajarParaVersiculo('${item.livro}', '${item.cap}', '${item.ver}')">
                    <span class="search-result-ref">${item.ref}</span>
                    <span class="search-result-text">${marcado}</span>
                </button>
            `;
        }).join('');
    },

    limpar: () => {
        document.getElementById('bible-search-results')?.replaceChildren();
        const bookFilterRow = document.getElementById('filter-books-found');
        if (bookFilterRow) {
            bookFilterRow.classList.add('hidden');
            bookFilterRow.innerHTML = "";
        }
    }
};

window.viajarParaVersiculo = (livro, cap, ver) => {
    document.getElementById('popup-search-bible')?.classList.remove('active');
    if (typeof window.carregarCapituloNoPortal === 'function') {
        window.carregarCapituloNoPortal(livro, cap, ver);
    }
};
