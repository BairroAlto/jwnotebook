import { abrirPopupPartilhar, iniciarSistemaPartilha } from '../editor/modulos/partilhar.js';
import { carregarFeedAmigosPalco, carregarAtividadeAmigosNoItem } from './palco-social.js';
import { fetchLyricsOvh } from './palco-api-client.js';
import { loadPalcoDoc, savePalcoNote, savePalcoRating, updatePalcoFlags, watchPalcoByUser, sincronizarNotificacoesWishlist } from './palco-store.js';
import { listMovieItems, getMovieDetails } from './palco-adapters/movies-adapter.js';
import { listMusicItems, getMusicDetails } from './palco-adapters/music-adapter.js';
import { listEventItems, getEventDetails } from './palco-adapters/events-adapter.js';
import { listBookItems, getBookDetails } from './palco-adapters/books-adapter.js';

const ICON_ACTIONS = [
    { id: "favoritos", label: "Favoritos", icon: "fa-star", iconOnly: true },
    { id: "estatisticas", label: "Estatisticas", icon: "fa-chart-column", iconOnly: true },
    { id: "notas", label: "Notas", icon: "fa-note-sticky", iconOnly: true },
    { id: "pesquisa", label: "Pesquisa", icon: "fa-magnifying-glass", iconOnly: true }
];

const TOOLSETS = {
    movies: {
        title: "Filmes e TV",
        tag: "filmes-tv",
        icon: "fa-clapperboard",
        tools: [
            { id: "filmes", label: "Filmes" },
            { id: "series", label: "Series" },
            { id: "atores", label: "Atores" },
            { id: "vistos", label: "Vistos" },
            { id: "querover", label: "Quero Ver" },
            ...ICON_ACTIONS
        ],
        adapterList: listMovieItems,
        adapterGet: getMovieDetails,
        derivedTools: {
            watched: "vistos",
            wishlist: "querover",
            favorites: "favoritos",
            notes: "notas",
            stats: "estatisticas",
            search: "pesquisa"
        }
    },
    music: {
        title: "Musica",
        tag: "musicas",
        icon: "fa-music",
        tools: [
            { id: "albuns", label: "Albuns" },
            { id: "musicas", label: "Musicas" },
            { id: "artistas", label: "Artistas" },
            { id: "ouvidos", label: "Ouvidos" },
            { id: "queroouvir", label: "Quero Ouvir" },
            ...ICON_ACTIONS
        ],
        adapterList: listMusicItems,
        adapterGet: getMusicDetails,
        derivedTools: {
            watched: "ouvidos",
            wishlist: "queroouvir",
            favorites: "favoritos",
            notes: "notas",
            stats: "estatisticas",
            search: "pesquisa"
        }
    },
    events: {
        title: "Eventos",
        tag: "eventos",
        icon: "fa-masks-theater",
        tools: [
            { id: "novidades", label: "Novidades" },
            { id: "brevemente", label: "Brevemente" },
            { id: "teatro", label: "Teatro" },
            { id: "arte", label: "Arte" },
            { id: "musica", label: "Musica" },
            { id: "danca", label: "Danca" },
            { id: "outros", label: "Outros" },
            { id: "assistidos", label: "Assistidos" },
            { id: "queroassistir", label: "Quero Assistir" },
            ...ICON_ACTIONS
        ],
        adapterList: listEventItems,
        adapterGet: getEventDetails,
        derivedTools: {
            watched: "assistidos",
            wishlist: "queroassistir",
            favorites: "favoritos",
            notes: "notas",
            stats: "estatisticas",
            search: "pesquisa"
        }
    },
    books: {
        title: "Livros",
        tag: "livros",
        icon: "fa-book-open",
        tools: [
            { id: "livros", label: "Livros" },
            { id: "autores", label: "Autores" },
            { id: "lidos", label: "Lidos" },
            { id: "queroler", label: "Quero Ler" },
            ...ICON_ACTIONS
        ],
        adapterList: listBookItems,
        adapterGet: getBookDetails,
        derivedTools: {
            watched: "lidos",
            wishlist: "queroler",
            favorites: "favoritos",
            notes: "notas",
            stats: "estatisticas",
            search: "pesquisa"
        }
    }
};

const FILTER_MODES = {
    recent: { id: "recent", label: "Ordenar" },
    year: { id: "year", label: "Ano" },
    category: { id: "category", label: "Categoria" }
};

const CURRENT_YEAR = String(new Date().getFullYear());
const RATING_SCALE = [
    [10, "Excelente", "#14532d", "#f8fafc"],
    [9, "Muito Bom", "#166534", "#f8fafc"],
    [8, "Bom", "#15803d", "#f8fafc"],
    [7, "Notavel", "#1f8a3d", "#f8fafc"],
    [6, "Interessante", "#b45309", "#f8fafc"],
    [5, "Aceitavel", "#c2410c", "#f8fafc"],
    [4, "Mediocre", "#ea580c", "#f8fafc"],
    [3, "Fraco", "#b91c1c", "#f8fafc"],
    [2, "Mau", "#991b1b", "#f8fafc"],
    [1, "Pessimo", "#7f1d1d", "#f8fafc"]
];

const state = {
    leftTab: "palco",
    rightTab: "lists",
    rightTag: null,
    category: null,
    tool: null,
    filterMode: "year",
    filterValue: CURRENT_YEAR,
    searchTerm: "",
    items: [],
    persisted: [],
    friendFeed: [],
    noteDraft: null,
    stats: null
};

function getToolConfig() {
    return TOOLSETS[state.category] || null;
}

function iconFor(kind) {
    const map = {
        actor: "fa-user",
        album: "fa-compact-disc",
        artist: "fa-microphone-lines",
        author: "fa-feather-pointed",
        book: "fa-book",
        event: "fa-ticket",
        movie: "fa-film",
        series: "fa-tv",
        track: "fa-wave-square"
    };
    return map[kind] || "fa-star";
}

function escapeHtml(value = "") {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

function normalizeText(value = "") {
    return String(value)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
}

function getPersistedByTag(tag) {
    return state.persisted.filter(item => item.tag === tag);
}

function getDefaultFilterValue(toolId = state.tool) {
    return toolId === "novidades" ? "Recentes" : "Relevantes";
}

function getInitialYearFilter() {
    return CURRENT_YEAR;
}

function shouldUseAllYears(toolId = state.tool) {
    const cfg = getToolConfig();
    return Boolean(cfg && toolId === cfg.derivedTools.search);
}

function getLatestYearFilter(items = state.items) {
    const years = Array.from(new Set((items || []).map(item => item.year).filter(Boolean))).sort((a, b) => b - a);
    return years.length ? String(years[0]) : CURRENT_YEAR;
}

function setDefaultCenterYearFilter(items = state.items, toolId = state.tool) {
    state.filterMode = "year";
    state.filterValue = shouldUseAllYears(toolId) ? "Todos" : getLatestYearFilter(items);
}

function getRatingMeta(value) {
    const numericValue = Number(value);
    return RATING_SCALE.find(([rating]) => rating === numericValue) || null;
}

function buildRatingOption([value, label, background, foreground], selectedRating) {
    const selected = String(selectedRating || "") === String(value) ? "selected" : "";
    return `<option value="${value}" ${selected} style="background:${background}; color:${foreground};">${value} - ${label}</option>`;
}

function applyRatingSelectTheme(select) {
    if (!select) return;
    const meta = getRatingMeta(select.value);
    if (!meta) {
        select.style.background = "rgba(255,255,255,0.03)";
        select.style.color = "#f8fafc";
        select.style.borderColor = "rgba(255,255,255,0.07)";
        return;
    }
    select.style.background = meta[2];
    select.style.color = meta[3];
    select.style.borderColor = meta[2];
}

function toDisplayItemFromPersisted(docItem) {
    const note = Array.isArray(docItem.caixas) && docItem.caixas[0] ? docItem.caixas[0] : null;
    return {
        source: docItem.source || "persisted-palco",
        sourceId: docItem.sourceId || docItem.id,
        kind: docItem.oque || "item",
        title: docItem.nome || "Sem titulo",
        subtitle: note?.titulo || docItem.oque || "Registo PALCO",
        description: note?.conteudo || `${docItem.oque || "Conteudo"} guardado no teu PALCO.`,
        imageUrl: docItem.imageurl || "",
        year: docItem.ano || null,
        month: docItem.mes || null,
        releaseDate: docItem.releaseDate || docItem.vistoem || "",
        genres: [docItem.oque || "Item"].filter(Boolean),
        people: [],
        externalIds: {
            imdb: docItem.imdb || "",
            codice: docItem.codice || ""
        },
        previewUrl: docItem.previewUrl || "",
        trailerUrl: docItem.trailerUrl || "",
        related: [],
        persistedId: docItem.id
    };
}

function getDerivedModeType(cfg, toolId) {
    if (toolId === cfg.derivedTools.stats) return "stats";
    if (toolId === cfg.derivedTools.search) return "search";
    if (toolId === cfg.derivedTools.notes) return "notes";
    if (toolId === cfg.derivedTools.favorites) return "favorites";
    if (toolId === cfg.derivedTools.watched) return "watched";
    if (toolId === cfg.derivedTools.wishlist) return "wishlist";
    return "remote";
}

function filterPersistedForMode(cfg, modeType) {
    const bucket = getPersistedByTag(cfg.tag);
    if (modeType === "watched") return bucket.filter(item => item.watched === "on");
    if (modeType === "wishlist") return bucket.filter(item => item.wishlist === "on");
    if (modeType === "favorites") return bucket.filter(item => item.favorito === "on");
    if (modeType === "notes") return bucket.filter(item => Array.isArray(item.caixas) && item.caixas.length);
    return bucket;
}

function computeStats(cfg) {
    const bucket = getPersistedByTag(cfg.tag);
    const ratings = bucket.map(item => Number(item.rating)).filter(Boolean);
    const categories = bucket.reduce((acc, item) => {
        const key = item.oque || "Item";
        acc[key] = (acc[key] || 0) + 1;
        return acc;
    }, {});
    const years = bucket.reduce((acc, item) => {
        const key = item.ano || "Sem ano";
        acc[key] = (acc[key] || 0) + 1;
        return acc;
    }, {});

    return {
        total: bucket.length,
        watched: bucket.filter(item => item.watched === "on").length,
        wishlist: bucket.filter(item => item.wishlist === "on").length,
        favorites: bucket.filter(item => item.favorito === "on").length,
        notes: bucket.filter(item => Array.isArray(item.caixas) && item.caixas.length).length,
        avgRating: ratings.length ? (ratings.reduce((sum, value) => sum + value, 0) / ratings.length).toFixed(1) : "--",
        categories,
        years
    };
}

function getItemCategory(item) {
    return item.subtitle || item.genres?.[0] || item.kind || "Sem categoria";
}

function getFilterOptions(items) {
    const years = Array.from(new Set(items.map(item => item.year).filter(Boolean))).sort((a, b) => b - a);
    const categories = Array.from(new Set(items.map(getItemCategory).filter(Boolean))).sort((a, b) => a.localeCompare(b));
    const yearOptions = ["Todos", ...years.map(String)];
    if (!yearOptions.includes(CURRENT_YEAR)) yearOptions.splice(1, 0, CURRENT_YEAR);
    return {
        recent: ["Relevantes", "Recentes"],
        year: yearOptions,
        category: ["Todas", ...categories]
    };
}

function syncFilterState() {
    const options = getFilterOptions(state.items);
    const valid = options[state.filterMode] || [];
    if (!valid.includes(state.filterValue)) {
        if (state.filterMode === "recent") state.filterValue = getDefaultFilterValue();
        if (state.filterMode === "year") state.filterValue = shouldUseAllYears() ? "Todos" : getLatestYearFilter(state.items);
        if (state.filterMode === "category") state.filterValue = "Todas";
    }
}

function sortByRecent(items) {
    return [...items].sort((a, b) => {
        const aDate = a.releaseDate || `${a.year || 0}-01-01`;
        const bDate = b.releaseDate || `${b.year || 0}-01-01`;
        return bDate.localeCompare(aDate);
    });
}

function applyFilters(items) {
    let output = [...items];
    if (state.filterMode === "year" && state.filterValue !== "Todos") {
        output = output.filter(item => String(item.year || "") === state.filterValue);
    }
    if (state.filterMode === "category" && state.filterValue !== "Todas") {
        output = output.filter(item => getItemCategory(item) === state.filterValue);
    }
    if (state.filterMode === "recent" && state.filterValue === "Recentes") {
        output = sortByRecent(output);
    }
    return output;
}

async function loadCategoryItems() {
    const cfg = getToolConfig();
    if (!cfg || !state.tool) return;

    state.stats = null;
    const modeType = getDerivedModeType(cfg, state.tool);

    if (modeType === "stats") {
        state.items = [];
        state.stats = computeStats(cfg);
        return;
    }

    if (["watched", "wishlist", "favorites", "notes"].includes(modeType)) {
        state.items = filterPersistedForMode(cfg, modeType).map(toDisplayItemFromPersisted);
        syncFilterState();
        return;
    }

    state.items = await cfg.adapterList(state.tool, { searchTerm: state.searchTerm });
    syncFilterState();
}

function buildStatsMarkup() {
    const stats = state.stats;
    if (!stats) return `<div class="palco-inline-alert">Sem estatisticas disponiveis ainda para esta categoria.</div>`;

    const cards = [
        ["Registos", stats.total],
        ["Concluidos", stats.watched],
        ["Desejos", stats.wishlist],
        ["Favoritos", stats.favorites],
        ["Notas", stats.notes],
        ["Media", stats.avgRating]
    ];

    return `
        <div class="palco-grid">
            ${cards.map(([label, value]) => `
                <article class="palco-content-card" style="cursor:default;">
                    <div class="palco-content-body">
                        <p class="palco-section-label" style="margin-bottom:8px;">${label}</p>
                        <h3 style="font-size:24px;">${value}</h3>
                    </div>
                </article>
            `).join('')}
        </div>
        <div class="palco-grid" style="padding-top:0;">
            <article class="palco-content-card" style="cursor:default;">
                <div class="palco-content-body">
                    <p class="palco-section-label">Por tipo</p>
                    ${Object.keys(stats.categories).length
                        ? Object.entries(stats.categories).map(([label, value]) => `<p>${escapeHtml(label)} · ${value}</p>`).join("")
                        : `<p>Sem dados ainda.</p>`}
                </div>
            </article>
            <article class="palco-content-card" style="cursor:default;">
                <div class="palco-content-body">
                    <p class="palco-section-label">Por ano</p>
                    ${Object.keys(stats.years).length
                        ? Object.entries(stats.years).sort((a, b) => String(b[0]).localeCompare(String(a[0]))).map(([label, value]) => `<p>${escapeHtml(label)} · ${value}</p>`).join("")
                        : `<p>Sem dados ainda.</p>`}
                </div>
            </article>
        </div>
    `;
}

function renderSearchBox() {
    const cfg = getToolConfig();
    if (!cfg || state.tool !== cfg.derivedTools.search) return "";
    return `
        <div class="palco-filter-search">
            <i class="fa-solid fa-magnifying-glass palco-search-icon" aria-hidden="true"></i>
            <input id="palco-search-input" type="text" placeholder="Pesquisar em ${cfg.title}..." value="${escapeHtml(state.searchTerm)}">
            <button id="palco-search-submit" type="button" class="palco-search-submit" aria-label="Pesquisar">
                Pesquisar
            </button>
        </div>
    `;
}

function renderRightFilterControls() {
    const options = getFilterOptions(state.items)[state.filterMode] || [];
    return `
        <div class="palco-filter-line">
            ${Object.values(FILTER_MODES).map(mode => `
                <button class="palco-filter-pill ${state.filterMode === mode.id ? 'active' : ''}" data-filter-mode="${mode.id}">${mode.label}</button>
            `).join('')}
        </div>
        <div class="palco-filter-line">
            ${options.map(option => `
                <button class="palco-filter-pill ${state.filterValue === option ? 'active' : ''}" data-filter-value="${escapeHtml(option)}">${escapeHtml(option)}</button>
            `).join('')}
        </div>
    `;
}

function renderGridMarkup(items, emptyMessage) {
    if (!items.length) {
        return `<div class="palco-inline-alert">${emptyMessage}</div>`;
    }
    return `
        <div class="palco-grid">
            ${items.map(item => `
                <article class="palco-content-card" data-palco-item="${item.sourceId}">
                    <div class="palco-content-art">
                        ${item.imageUrl ? `<img src="${item.imageUrl}" alt="${escapeHtml(item.title)}">` : `<i class="fa-solid ${iconFor(item.kind)}"></i>`}
                    </div>
                    <div class="palco-content-body">
                        <h3>${escapeHtml(item.title)}</h3>
                        <p>${escapeHtml(item.subtitle || item.description || "Sem descricao.")}</p>
                        <div class="palco-content-meta">
                            <span>${escapeHtml(getItemCategory(item))}</span>
                            <span>${item.year || "--"}</span>
                        </div>
                    </div>
                </article>
            `).join('')}
        </div>
    `;
}

function renderCategoryLoading(message = "A carregar os itens do Palco...") {
    const center = document.getElementById('palco-center');
    const cfg = getToolConfig();
    if (!center || !cfg) return;

    center.innerHTML = `
        <div class="palco-toolbar">
            <div class="palco-toolbar-meta">
                <div>
                    <h2>${cfg.title}</h2>
                    <p>${escapeHtml(message)}</p>
                </div>
            </div>
        </div>
        <div class="palco-loading-state">
            <div class="spinner palco-spinner"></div>
            <div class="palco-loading-copy">A carregar ${escapeHtml(cfg.title.toLowerCase())}.</div>
        </div>
    `;
}

async function renderCategoryCenter() {
    const center = document.getElementById('palco-center');
    const cfg = getToolConfig();
    if (!center || !cfg) return;

    const filteredItems = applyFilters(state.items);
    const isStats = getDerivedModeType(cfg, state.tool) === "stats";
    const searchTool = cfg.tools.find(tool => tool.id === cfg.derivedTools.search);
    center.innerHTML = `
        <div class="palco-toolbar">
            <div class="palco-toolbar-meta">
                <div>
                    <h2>${cfg.title}</h2>
                    <p>Conteudo, filtros reais, persistencia e integracoes de API centralizadas.</p>
                </div>
            </div>
            <div class="palco-toolbar-line">
                ${cfg.tools.filter(tool => tool.id !== cfg.derivedTools.search).map(tool => `
                    <button
                        class="palco-tool-pill ${tool.iconOnly ? 'icon-only' : ''} ${state.tool === tool.id ? 'active' : ''}"
                        data-palco-tool="${tool.id}"
                        title="${escapeHtml(tool.label)}"
                        aria-label="${escapeHtml(tool.label)}">
                        ${tool.icon ? `<i class="fa-solid ${tool.icon}"></i>` : ''}${tool.iconOnly ? '' : tool.label}
                    </button>
                `).join('')}
                ${searchTool ? `
                    <button
                        class="palco-tool-pill icon-only ${state.tool === searchTool.id ? 'active' : ''}"
                        data-palco-tool="${searchTool.id}"
                        title="${escapeHtml(searchTool.label)}"
                        aria-label="${escapeHtml(searchTool.label)}">
                        <i class="fa-solid ${searchTool.icon}"></i>
                    </button>
                ` : ""}
            </div>
            ${!isStats ? renderSearchBox() : ""}
        </div>
        <div id="palco-grid-area">${isStats ? buildStatsMarkup() : renderGridMarkup(filteredItems, emptyMessageForCurrentMode(cfg))}</div>
    `;

    center.querySelectorAll('[data-palco-tool]').forEach(btn => {
        btn.addEventListener('click', async () => {
            state.tool = btn.dataset.palcoTool;
            if (state.tool !== cfg.derivedTools.search) state.searchTerm = "";
            renderCategoryLoading(`A carregar ${cfg.title.toLowerCase()}...`);
            await loadCategoryItems();
            setDefaultCenterYearFilter(state.items, state.tool);
            syncFilterState();
            await renderCategoryCenter();
            renderRight();
        });
    });

    const searchInput = center.querySelector('#palco-search-input');
    const searchSubmit = center.querySelector('#palco-search-submit');
    if (searchInput && searchSubmit) {
        const submitSearch = async () => {
            state.searchTerm = searchInput.value.trim();
            renderCategoryLoading(`A pesquisar em ${cfg.title.toLowerCase()}...`);
            await loadCategoryItems();
            setDefaultCenterYearFilter(state.items, state.tool);
            syncFilterState();
            await renderCategoryCenter();
        };

        searchSubmit.addEventListener('click', submitSearch);
        searchInput.addEventListener('keydown', async event => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            await submitSearch();
        });
    }

    center.querySelectorAll('[data-palco-item]').forEach(card => {
        card.addEventListener('click', async () => {
            const item = filteredItems.find(entry => entry.sourceId === card.dataset.palcoItem);
            if (item) await abrirItemPopup(item);
        });
    });
}

function emptyMessageForCurrentMode(cfg) {
    const modeType = getDerivedModeType(cfg, state.tool);
    if (modeType === "search") return state.searchTerm.trim().length < 2 ? "Escreve pelo menos 2 letras para pesquisar." : "Sem resultados para esta pesquisa.";
    if (modeType === "notes") return "Ainda nao guardaste notas PALCO nesta categoria.";
    if (modeType === "favorites") return "Ainda nao tens favoritos nesta categoria.";
    if (modeType === "watched") return "Ainda nao tens itens concluidos nesta categoria.";
    if (modeType === "wishlist") return "Ainda nao tens desejos nesta categoria.";
    return "Sem resultados disponiveis para esta combinacao.";
}

function renderCenterHome() {
    const center = document.getElementById('palco-center');
    if (!center) return;
    center.innerHTML = `
        <section class="palco-hero">
            <h1>PALCO</h1>
            <p>Um portal modular para filmes, series, musica, eventos e livros, agora com a camada de APIs separada da UI e dos adapters.</p>
        </section>
        <div class="palco-grid">
            ${Object.entries(TOOLSETS).map(([key, cfg]) => `
                <div class="palco-content-card" data-center-category="${key}">
                    <div class="palco-content-art"><i class="fa-solid ${cfg.icon}"></i></div>
                    <div class="palco-content-body">
                        <h3>${cfg.title}</h3>
                        <p>Capas, filtros, popup rico, listas e integracao com index.</p>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
    center.querySelectorAll('[data-center-category]').forEach(card => {
        card.addEventListener('click', () => abrirCategoria(card.dataset.centerCategory));
    });
}

function renderLeft() {
    const left = document.getElementById('palco-left');
    if (!left) return;
    left.innerHTML = `
        <div class="palco-sidebar-head">
            <div>
                <h3>Centro PALCO</h3>
                <p>Portais, listas e amigos</p>
            </div>
            <i class="fa-solid fa-masks-theater" style="color: var(--palco-accent);"></i>
        </div>
        <div class="palco-left-nav">
            <button class="${state.leftTab === 'palco' ? 'active' : ''}" data-palco-left="palco">Palco</button>
            <button class="${state.leftTab === 'lists' ? 'active' : ''}" data-palco-left="lists">Lists</button>
            <button class="${state.leftTab === 'friends' ? 'active' : ''}" data-palco-left="friends">Amigos</button>
        </div>
        <div class="palco-left-scroll" id="palco-left-scroll"></div>
    `;

    left.querySelectorAll('[data-palco-left]').forEach(btn => {
        btn.addEventListener('click', async () => {
            state.leftTab = btn.dataset.palcoLeft;
            renderLeft();
            if (state.leftTab === "palco") {
                renderCenterHome();
            } else if (state.leftTab === "lists") {
                renderRight();
            } else {
                state.friendFeed = await carregarFeedAmigosPalco();
                renderFriendsCenter();
            }
        });
    });

    if (state.leftTab === "palco") renderLeftCategories();
    if (state.leftTab === "lists") renderLeftLists();
    if (state.leftTab === "friends") renderLeftFriends();
}

function renderLeftCategories() {
    const area = document.getElementById('palco-left-scroll');
    if (!area) return;
    area.innerHTML = `
        <div class="palco-card-grid">
            ${[
                ["movies", "Filmes e TV", "Cinema, series e atores"],
                ["music", "Musica", "Albuns, artistas e faixas"],
                ["events", "Eventos", "Agenda LX, teatro, arte e musica"],
                ["books", "Livros", "Livros, sagas e autores"]
            ].map(([id, label, copy]) => `
                <div class="palco-entry-card" data-palco-category="${id}">
                    <strong>${label}</strong>
                    <span>${copy}</span>
                </div>
            `).join('')}
            <div class="palco-status-card">
                <strong>Arquitetura modular</strong>
                <span>As conexoes de API vivem agora num modulo proprio e os adapters so tratam de normalizacao.</span>
            </div>
        </div>
    `;
    area.querySelectorAll('[data-palco-category]').forEach(card => {
        card.addEventListener('click', () => abrirCategoria(card.dataset.palcoCategory));
    });
}

function renderLeftLists() {
    const area = document.getElementById('palco-left-scroll');
    if (!area) return;
    const tags = [
        ["filmes-tv", "Filmes e TV"],
        ["musicas", "Musica"],
        ["eventos", "Eventos"],
        ["livros", "Livros"]
    ];
    area.innerHTML = `
        <div class="palco-card-grid">
            ${tags.map(([tag, label]) => {
                const total = state.persisted.filter(item => item.tag === tag).length;
                return `
                    <div class="palco-entry-card" data-open-persisted="${tag}">
                        <strong>${label}</strong>
                        <span>${total} registos guardados no teu PALCO.</span>
                    </div>
                `;
            }).join('')}
        </div>
    `;
    area.querySelectorAll('[data-open-persisted]').forEach(card => {
        card.addEventListener('click', () => {
            state.rightTag = card.dataset.openPersisted;
            state.rightTab = "lists";
            renderRight();
        });
    });
}

function renderLeftFriends() {
    const area = document.getElementById('palco-left-scroll');
    if (!area) return;
    area.innerHTML = `
        <div class="palco-card-grid">
            <div class="palco-entry-card">
                <strong>Atividade dos amigos</strong>
                <span>Mostra apenas atividade de amizades aceites com partilha PALCO ativa.</span>
            </div>
        </div>
    `;
}

function renderFriendsCenter() {
    const center = document.getElementById('palco-center');
    if (!center) return;
    center.innerHTML = `
        <section class="palco-hero">
            <h1>Amigos</h1>
            <p>Atividade cruzada do PALCO, respeitando a preferencia individual de partilha.</p>
        </section>
        <div style="padding:22px;">
            ${state.friendFeed.length ? state.friendFeed.map(item => `
                <div class="palco-friend-row">
                    <h4>${escapeHtml(item.friend)} · ${escapeHtml(item.title)}</h4>
                    <p>${[
                        item.watched === "on" ? "assinalou como concluido" : "",
                        item.wishlist === "on" ? "marcou como desejo" : "",
                        item.favorito === "on" ? "favoritou" : "",
                        item.rating ? `classificou com ${item.rating}` : ""
                    ].filter(Boolean).join(" · ") || "sem atividade textual"}</p>
                </div>
            `).join('') : `<div class="palco-inline-alert">Ainda nao ha atividade de amigos disponivel.</div>`}
        </div>
    `;
}

function renderRight() {
    const right = document.getElementById('palco-right');
    if (!right) return;
    const currentTag = state.rightTag || (state.category ? getToolConfig()?.tag : null);
    const hasCategory = Boolean(state.category);
    if (!hasCategory && state.rightTab === "filters") {
        state.rightTab = "lists";
    }
    if (hasCategory && !["filters", "lists", "notes"].includes(state.rightTab)) {
        state.rightTab = "filters";
    }
    right.innerHTML = `
        <div class="palco-sidebar-head">
            <div>
                <h3>Coluna Direita</h3>
                <p>Lists e anotacoes PALCO</p>
            </div>
            <i class="fa-solid fa-box-archive" style="color:#38bdf8;"></i>
        </div>
        <div class="palco-right-toolbar">
            ${hasCategory ? `<button class="${state.rightTab === 'filters' ? 'active' : ''}" data-palco-right="filters">Filtros</button>` : ""}
            <button class="${state.rightTab === 'lists' ? 'active' : ''}" data-palco-right="lists">Lists</button>
            <button class="${state.rightTab === 'notes' ? 'active' : ''}" data-palco-right="notes">Anotacoes</button>
        </div>
        <div class="palco-right-scroll" id="palco-right-scroll"></div>
    `;

    right.querySelectorAll('[data-palco-right]').forEach(btn => {
        btn.addEventListener('click', () => {
            state.rightTab = btn.dataset.palcoRight;
            renderRight();
        });
    });

    const area = document.getElementById('palco-right-scroll');
    if (!area) return;

    if (state.rightTab === "filters") {
        const cfg = getToolConfig();
        if (!cfg) {
            area.innerHTML = `<div class="palco-empty-state">Abre uma categoria para veres os filtros aqui.</div>`;
            return;
        }
        area.innerHTML = `
            <div class="palco-right-card">
                <strong>Filtros de ${escapeHtml(cfg.title)}</strong>
                <span>Ordena e filtra os conteudos sem ocupar a coluna central.</span>
            </div>
            <div class="palco-right-filters">
                ${renderRightFilterControls()}
            </div>
        `;
        area.querySelectorAll('[data-filter-mode]').forEach(btn => {
            btn.addEventListener('click', async () => {
                state.filterMode = btn.dataset.filterMode;
                syncFilterState();
                await renderCategoryCenter();
                renderRight();
            });
        });
        area.querySelectorAll('[data-filter-value]').forEach(btn => {
            btn.addEventListener('click', async () => {
                state.filterValue = btn.dataset.filterValue;
                await renderCategoryCenter();
                renderRight();
            });
        });
        return;
    }

    if (state.rightTab === "lists") {
        const grouped = currentTag ? state.persisted.filter(item => item.tag === currentTag) : state.persisted;
        if (!grouped.length) {
            area.innerHTML = `<div class="palco-empty-state">Sem registos guardados ainda. Interage com um item do PALCO para comecar.</div>`;
            return;
        }
        area.innerHTML = grouped.map(item => `
            <div class="palco-right-card" data-right-open="${item.id}">
                <strong>${escapeHtml(item.nome)}</strong>
                <span>${escapeHtml(item.oque)} · wishlist ${item.wishlist} · watched ${item.watched} · rating ${item.rating || "--"}</span>
            </div>
        `).join('');
        area.querySelectorAll('[data-right-open]').forEach(card => {
            card.addEventListener('click', async () => {
                const docItem = state.persisted.find(item => item.id === card.dataset.rightOpen);
                if (!docItem) return;
                if (state.category !== inferCategoryFromTag(docItem.tag)) {
                    await abrirCategoria(inferCategoryFromTag(docItem.tag), docItem.sourceId);
                    return;
                }
                await abrirItemPopup(toDisplayItemFromPersisted(docItem), docItem);
            });
        });
        return;
    }

    if (!state.noteDraft) {
        area.innerHTML = `<div class="palco-empty-state">Abre um item e cria uma caixa para ela aparecer aqui.</div>`;
        return;
    }

    area.innerHTML = `
        <div class="palco-right-card">
            <strong>${escapeHtml(state.noteDraft.title)}</strong>
            <span>${escapeHtml(state.noteDraft.typeLabel)} preparada para envio ao index.</span>
        </div>
        <div class="palco-note-card">
            <div class="palco-note-card-head">
                <strong>${escapeHtml(state.noteDraft.box.titulo || state.noteDraft.typeLabel)}</strong>
                <button class="palco-share-button" id="palco-share-box">Enviar</button>
            </div>
            <textarea readonly>${state.noteDraft.box.conteudo || ""}</textarea>
        </div>
    `;
    document.getElementById('palco-share-box')?.addEventListener('click', () => {
        abrirPopupPartilhar(state.noteDraft.box, "__PALCO__", () => {});
    });
}

function inferCategoryFromTag(tag) {
    if (tag === "filmes-tv") return "movies";
    if (tag === "musicas") return "music";
    if (tag === "eventos") return "events";
    return "books";
}

function ensureDetailsShape(baseItem, details) {
    const seed = details || baseItem || {};
    return {
        ...seed,
        source: seed.source || baseItem?.source || "palco",
        sourceId: seed.sourceId || baseItem?.sourceId || "",
        kind: seed.kind || baseItem?.kind || "item",
        title: seed.title || baseItem?.title || "Sem titulo",
        subtitle: seed.subtitle || baseItem?.subtitle || "",
        description: seed.description || baseItem?.description || "",
        imageUrl: seed.imageUrl || baseItem?.imageUrl || "",
        year: seed.year || baseItem?.year || null,
        month: seed.month || baseItem?.month || null,
        releaseDate: seed.releaseDate || baseItem?.releaseDate || "",
        selectedTrackSourceId: seed.selectedTrackSourceId || baseItem?.selectedTrackSourceId || "",
        autoOpenTracks: Boolean(seed.autoOpenTracks || baseItem?.autoOpenTracks),
        genres: Array.isArray(seed.genres) ? seed.genres : (Array.isArray(baseItem?.genres) ? baseItem.genres : []),
        people: Array.isArray(seed.people) ? seed.people : (Array.isArray(baseItem?.people) ? baseItem.people : []),
        related: Array.isArray(seed.related) ? seed.related : [],
        awards: Array.isArray(seed.awards) ? seed.awards : (Array.isArray(baseItem?.awards) ? baseItem.awards : []),
        externalIds: seed.externalIds || baseItem?.externalIds || {},
        externalLinks: Array.isArray(seed.externalLinks) ? seed.externalLinks : (Array.isArray(baseItem?.externalLinks) ? baseItem.externalLinks : []),
        liveMoments: Array.isArray(seed.liveMoments) ? seed.liveMoments : (Array.isArray(baseItem?.liveMoments) ? baseItem.liveMoments : []),
        tracks: Array.isArray(seed.tracks) ? seed.tracks : (Array.isArray(baseItem?.tracks) ? baseItem.tracks : []),
        lyricsUrl: seed.lyricsUrl || baseItem?.lyricsUrl || "",
        lyricsText: seed.lyricsText || baseItem?.lyricsText || "",
        albumTitle: seed.albumTitle || baseItem?.albumTitle || "",
        albumSourceId: seed.albumSourceId || baseItem?.albumSourceId || "",
        albumPreviewUrl: seed.albumPreviewUrl || baseItem?.albumPreviewUrl || "",
        previewUrl: seed.previewUrl || baseItem?.previewUrl || "",
        trailerUrl: seed.trailerUrl || baseItem?.trailerUrl || ""
    };
}

function buildAlbumItemFromTrack(details) {
    if (details.kind !== "track" || !details.albumTitle) return null;
    if (details.source?.startsWith("deezer-track") && details.externalIds?.deezerAlbumId) {
        return {
            source: "deezer-album",
            sourceId: details.albumSourceId || `deezer-album-${details.externalIds.deezerAlbumId}`,
            kind: "album",
            title: details.albumTitle,
            subtitle: "Album",
            description: `${details.people?.[0] || "Artista"} · Album`,
            imageUrl: details.imageUrl || "",
            releaseDate: details.releaseDate || "",
            year: details.year || null,
            month: details.month || null,
            selectedTrackSourceId: details.sourceId,
            autoOpenTracks: true,
            genres: Array.isArray(details.genres) ? details.genres : [],
            people: Array.isArray(details.people) ? details.people : [],
            previewUrl: details.albumPreviewUrl || "",
            trailerUrl: "",
            lyricsUrl: "",
            related: [],
            awards: [],
            liveMoments: [],
            externalIds: {
                deezerAlbumId: details.externalIds.deezerAlbumId,
                deezerArtistId: details.externalIds.deezerArtistId || ""
            },
            externalLinks: details.albumPreviewUrl ? [{ label: "Deezer", url: details.albumPreviewUrl }] : []
        };
    }
    if (details.source?.startsWith("itunes-track") && details.externalIds?.itunesCollectionId) {
        return {
            source: "itunes-album",
            sourceId: details.albumSourceId || `itunes-album-${details.externalIds.itunesCollectionId}`,
            kind: "album",
            title: details.albumTitle,
            subtitle: "Album",
            description: `${details.people?.[0] || "Artista"} · Album`,
            imageUrl: details.imageUrl || "",
            releaseDate: details.releaseDate || "",
            year: details.year || null,
            month: details.month || null,
            selectedTrackSourceId: details.sourceId,
            autoOpenTracks: true,
            genres: Array.isArray(details.genres) ? details.genres : [],
            people: Array.isArray(details.people) ? details.people : [],
            previewUrl: details.albumPreviewUrl || "",
            trailerUrl: "",
            lyricsUrl: "",
            related: [],
            awards: [],
            liveMoments: [],
            externalIds: {
                artistId: details.externalIds.artistId || "",
                itunes: details.externalIds.itunesCollectionId
            },
            externalLinks: details.albumPreviewUrl ? [{ label: "Apple Music", url: details.albumPreviewUrl }] : []
        };
    }
    return null;
}

async function abrirItemPopup(item, persistedOverride = null) {
    const cfg = getToolConfig() || TOOLSETS[inferCategoryFromTag(persistedOverride?.tag || "")];
    if (!cfg) return;

    const detailsPromise = cfg.adapterGet(item.sourceId, item).catch(error => {
        console.warn("PALCO popup fallback:", error);
        return null;
    });
    const palcoDocPromise = persistedOverride ? Promise.resolve(persistedOverride) : loadPalcoDoc(item, cfg.tag);
    const socialPromise = carregarAtividadeAmigosNoItem(item.source, item.sourceId);

    const [fetchedDetails, palcoDoc, social] = await Promise.all([
        detailsPromise,
        palcoDocPromise,
        socialPromise
    ]);
    const details = ensureDetailsShape(item, fetchedDetails);
    const existingBox = Array.isArray(palcoDoc?.caixas) && palcoDoc.caixas[0] ? palcoDoc.caixas[0] : null;

    const overlay = document.createElement('div');
    overlay.className = 'popup-overlay active palco-popup-overlay';
    overlay.style.alignItems = 'flex-start';
    overlay.style.overflowY = 'auto';
    overlay.style.padding = '24px 0';
    overlay.innerHTML = `
        <div class="popup-content palco-popup-shell">
            <div class="popup-header">
                <h3>${escapeHtml(details.title)}</h3>
                <button id="palco-popup-close"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div class="palco-popup-body">
                <div class="palco-popup-main">
                    <div class="palco-popup-head">
                        <div class="palco-popup-poster">
                            ${details.imageUrl ? `<img src="${details.imageUrl}" alt="${escapeHtml(details.title)}">` : `<div class="palco-content-art"><i class="fa-solid ${iconFor(details.kind)}"></i></div>`}
                        </div>
                        <div class="palco-popup-copy">
                            <h2>${escapeHtml(details.title)}</h2>
                            <p>${escapeHtml(details.description || details.subtitle || "")}</p>
                            <div class="palco-popup-tags">
                                ${(details.genres || []).map(tag => `<span>${escapeHtml(tag)}</span>`).join('')}
                                ${details.year ? `<span>${details.year}</span>` : ""}
                            </div>
                        </div>
                    </div>
                    <div class="palco-popup-main-actions">
                        <div>
                            <p class="palco-section-label">Interacao</p>
                            <div class="palco-popup-actions palco-popup-actions-combined">
                                ${details.trailerUrl ? `<button class="palco-action-button" id="palco-open-trailer">${details.kind === 'track' ? 'Preview' : 'Trailer'}</button>` : ""}
                                ${details.previewUrl ? `<button class="palco-action-button" id="palco-open-preview">${details.kind === 'track' ? 'Ouvir' : 'Abrir'}</button>` : ""}
                                ${details.kind === 'album' ? `<button class="palco-action-button" id="palco-open-tracks">Faixas</button>` : ""}
                                ${details.kind === 'track' && details.albumTitle ? `<button class="palco-action-button" id="palco-open-album">Album</button>` : ""}
                                ${details.kind === 'track' ? `<button class="palco-action-button" id="palco-open-lyrics">Letra</button>` : ""}
                                <button class="palco-action-button" id="palco-open-search">Pesquisa</button>
                                ${(details.externalLinks || []).map((link, index) => `
                                    <button class="palco-action-button" data-palco-link="${index}">${escapeHtml(link.label || "Abrir")}</button>
                                `).join('')}
                            </div>
                            ${details.kind === 'album' ? `
                                <div id="palco-tracks-panel" class="palco-tracks-panel" style="display:${details.autoOpenTracks || details.selectedTrackSourceId ? 'block' : 'none'};">
                                    <p class="palco-section-label" style="margin-bottom:10px;">Faixas</p>
                                    <div class="palco-tracks-list" id="palco-tracks-list"></div>
                                </div>
                            ` : ""}
                            ${details.kind === 'track' ? `
                                <div id="palco-lyrics-panel" class="palco-lyrics-panel" style="display:none;">
                                    <p class="palco-section-label" style="margin-bottom:10px;">Letra</p>
                                    <div class="palco-lyrics-copy" id="palco-lyrics-copy">${details.lyricsText ? escapeHtml(details.lyricsText).replace(/\n/g, '<br>') : "Carrega em Letra para mostrar."}</div>
                                    ${details.lyricsUrl ? `
                                        <div class="palco-popup-actions" style="margin-top:12px;">
                                            <button class="palco-action-button" id="palco-open-lyrics-source">Abrir Genius</button>
                                        </div>
                                    ` : ""}
                                </div>
                            ` : ""}
                        </div>
                        <div>
                            <label class="palco-section-label">Avaliar</label>
                            <div class="palco-rating-wrap">
                                <select class="palco-dropdown" id="palco-rating-select">
                                    <option value="">Escolher nota</option>
                                    ${RATING_SCALE.map(entry => buildRatingOption(entry, palcoDoc?.rating)).join('')}
                                </select>
                            </div>
                        </div>
                        <div>
                            <label class="palco-section-label">Estado</label>
                            <div class="palco-toggle-grid palco-toggle-grid-compact">
                                <button class="palco-action-button" id="palco-action-watched">${watchLabel(details.kind)}</button>
                                <button class="palco-action-button" id="palco-action-wishlist">${wishlistLabel(details.kind)}</button>
                                <button class="palco-action-button" id="palco-action-favorite">Favorito</button>
                                <button class="palco-action-button" id="palco-action-stats">Estatisticas</button>
                            </div>
                        </div>
                    </div>
                    <p class="palco-section-label">Relacoes e contexto</p>
                    <div class="palco-related-grid">
                        ${(details.related || []).map(rel => `
                            <article class="palco-related-card" style="cursor:default;">
                                <div class="palco-related-art">
                                    ${rel.imageUrl ? `<img src="${rel.imageUrl}" alt="${escapeHtml(rel.title)}">` : `<div class="palco-content-art"><i class="fa-solid fa-image"></i></div>`}
                                </div>
                                <div class="palco-related-body">
                                    <h4>${escapeHtml(rel.title)}</h4>
                                    <p>${escapeHtml(rel.subtitle || "")}${rel.year ? ` · ${rel.year}` : ""}</p>
                                </div>
                            </article>
                        `).join('') || `<div class="palco-inline-alert" style="margin:0;">Sem relacoes adicionais para este item.</div>`}
                    </div>
                    ${details.awards?.length ? `
                        <p class="palco-section-label" style="margin-top:18px;">Premios por ano</p>
                        ${(details.awards || []).map(award => `
                            <div class="palco-friend-row">
                                <h4>${escapeHtml(String(award.year || "Ano"))}</h4>
                                <p>${escapeHtml(award.label || "")}</p>
                            </div>
                        `).join('')}
                    ` : ""}
                    ${details.liveMoments?.length ? `
                        <p class="palco-section-label" style="margin-top:18px;">Ao vivo / setlists</p>
                        ${(details.liveMoments || []).map(moment => `
                            <div class="palco-friend-row">
                                <h4>${escapeHtml(moment.title || "Momento ao vivo")}</h4>
                                <p>${escapeHtml(moment.subtitle || "")}</p>
                            </div>
                        `).join('')}
                    ` : ""}
                    ${social.length ? `
                        <p class="palco-section-label" style="margin-top:18px;">Amigos neste conteudo</p>
                        ${social.map(friend => `
                            <div class="palco-friend-row">
                                <h4>${escapeHtml(friend.friend)}</h4>
                                <p>${[
                                    friend.watched === "on" ? "ja interagiu" : "",
                                    friend.wishlist === "on" ? "quer acompanhar" : "",
                                    friend.favorito === "on" ? "favoritou" : "",
                                    friend.rating ? `deu ${friend.rating}` : ""
                                ].filter(Boolean).join(" · ")}</p>
                            </div>
                        `).join('')}
                    ` : ""}
                </div>
                <div class="palco-popup-side">
                    <div>
                        <label class="palco-section-label">Anotacao</label>
                        <div id="palco-note-panel"></div>
                    </div>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    let selectedType = existingBox?.tipo || null;
    let noteHighlight = existingBox?.destaques || "";

    const close = () => overlay.remove();
    overlay.querySelector('#palco-popup-close')?.addEventListener('click', close);
    overlay.addEventListener('click', event => {
        if (event.target === overlay) close();
    });

    function mergePersistedDocs(...docs) {
        docs.flat().filter(Boolean).forEach(docItem => {
            const index = state.persisted.findIndex(item => item.id === docItem.id);
            if (index >= 0) {
                state.persisted[index] = { ...state.persisted[index], ...docItem };
            } else {
                state.persisted.push(docItem);
            }
        });
    }

    async function refreshAlbumTracksPanel() {
        if (details.kind !== "album") return;
        const panel = overlay.querySelector('#palco-tracks-panel');
        const list = overlay.querySelector('#palco-tracks-list');
        if (!panel || !list) return;

        const tracks = Array.isArray(details.tracks) ? details.tracks : [];
        if (!tracks.length) {
            list.innerHTML = `<p class="palco-inline-alert" style="margin:0;">Nao encontrei faixas para este album.</p>`;
            return;
        }

        const currentSelection = details.selectedTrackSourceId || (details.autoOpenTracks ? tracks[0]?.sourceId || "" : "");
        list.innerHTML = tracks.map((track, index) => {
            const persistedTrack = state.persisted.find(item => item.tag === cfg.tag && item.source === track.source && item.sourceId === track.sourceId);
            const isSelected = Boolean(currentSelection && track.sourceId === currentSelection);
            const isFavorite = persistedTrack?.favorito === "on";
            const isWatched = persistedTrack?.watched === "on";
            return `
                <div class="palco-track-row ${isSelected ? 'selected' : ''}" data-palco-track-row="${escapeHtml(track.sourceId)}">
                    <button type="button" class="palco-track-row-main" data-palco-track-open="${escapeHtml(track.sourceId)}">
                        <span class="palco-track-index">${index + 1}</span>
                        <strong>${escapeHtml(track.title)}</strong>
                        ${isWatched ? `<small>Ouvida</small>` : ""}
                    </button>
                    <button type="button" class="palco-track-favorite ${isFavorite ? 'active' : ''}" data-palco-track-favorite="${escapeHtml(track.sourceId)}" aria-pressed="${isFavorite ? 'true' : 'false'}" aria-label="${isFavorite ? 'Desfavoritar' : 'Favoritar'} faixa">
                        <i class="${isFavorite ? 'fa-solid' : 'fa-regular'} fa-star"></i>
                    </button>
                </div>
            `;
        }).join('');

        list.querySelectorAll('[data-palco-track-open]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const track = tracks.find(entry => entry.sourceId === btn.dataset.palcoTrackOpen);
                if (!track) return;
                close();
                await abrirItemPopup(track, null, { selectedTrackSourceId: track.sourceId });
            });
        });

        list.querySelectorAll('[data-palco-track-favorite]').forEach(btn => {
            btn.addEventListener('click', async event => {
                event.stopPropagation();
                const track = tracks.find(entry => entry.sourceId === btn.dataset.palcoTrackFavorite);
                if (!track) return;
                const currentDoc = state.persisted.find(item => item.tag === cfg.tag && item.source === track.source && item.sourceId === track.sourceId);
                const next = currentDoc?.favorito === "on" ? "off" : "on";
                const updatedDoc = await updatePalcoFlags(track, cfg.tag, { favorito: next });
                mergePersistedDocs(updatedDoc);
                await reloadCurrentViewAfterMutation();
                await refreshAlbumTracksPanel();
            });
        });
    }

    function renderNotePanel() {
        const panel = overlay.querySelector('#palco-note-panel');
        if (!panel) return;
        const currentTitle = overlay.querySelector('#palco-note-title')?.value?.trim() || existingBox?.titulo || details.title;
        const currentContent = overlay.querySelector('#palco-note-content')?.value?.trim() || existingBox?.conteudo || details.description || "";

        if (!selectedType) {
            panel.dataset.noteHighlight = "";
            panel.innerHTML = `
                <div class="palco-note-empty">
                    <p class="palco-note-empty-label">Nova Anotacao de Estudo</p>
                    <div class="palco-note-chooser">
                        ${[
                            ["contentor", "CONTENTOR", "fa-box", "accent-contentor"],
                            ["subnota", "SUBNOTA", "fa-box", "accent-subnota"],
                            ["questao", "QUESTAO", "fa-box", "accent-questao"]
                        ].map(([id, label, icon, accent]) => `
                            <button class="palco-note-option ${accent}" data-note-type="${id}">
                                <span class="palco-note-option-icon"><i class="fa-solid ${icon}"></i></span>
                                <span class="palco-note-option-label">${label}</span>
                            </button>
                        `).join('')}
                    </div>
                </div>
            `;
        } else {
            const meta = getNoteTypeMeta(selectedType);
            panel.dataset.noteHighlight = noteHighlight;
            panel.innerHTML = `
                <div class="palco-brain-card" style="border-color:${meta.color}4D;">
                    <div class="palco-brain-card-head" style="background:${meta.color}33; border-bottom-color:${meta.color}22;">
                        <div class="palco-brain-card-label" style="color:${meta.color};">${meta.focusLabel}</div>
                        <div class="palco-brain-card-tools">
                            <i class="fa-solid fa-paper-plane" id="palco-share-note-inline" title="Partilhar"></i>
                            <i class="fa-solid fa-palette" id="palco-note-color" title="Destaque"></i>
                            <i class="fa-solid fa-trash-can" id="palco-note-clear" title="Ocultar"></i>
                        </div>
                    </div>
                    <div class="palco-brain-card-body" id="palco-note-editor-body" style="${noteHighlight ? `background:${noteHighlight}; color:#000;` : ''}">
                        ${selectedType !== 'contentor' ? `<input type="text" id="palco-note-title" value="${escapeHtml(currentTitle)}" placeholder="Titulo..." class="palco-brain-title" style="${noteHighlight ? 'color:#000;' : ''}">` : ''}
                        <textarea id="palco-note-content" class="palco-brain-textarea" placeholder="Escreve aqui as tuas anotacoes..." style="${noteHighlight ? 'color:#000;' : ''}">${escapeHtml(currentContent)}</textarea>
                    </div>
                </div>
                <div class="palco-popup-actions" style="margin-top:12px;">
                    <button class="palco-action-button primary" id="palco-save-note">Guardar nota</button>
                    <button class="palco-action-button" id="palco-share-note">Enviar</button>
                </div>
            `;
        }

        panel.querySelectorAll('[data-note-type]').forEach(btn => {
            btn.addEventListener('click', () => {
                selectedType = btn.dataset.noteType;
                noteHighlight = "";
                renderNotePanel();
            });
        });

        panel.querySelector('#palco-note-clear')?.addEventListener('click', () => {
            selectedType = null;
            noteHighlight = "";
            renderNotePanel();
        });

        panel.querySelector('#palco-note-color')?.addEventListener('click', () => {
            const palette = ["#fef3c7", "#dbeafe", "#dcfce7", "#fce7f3", "#ede9fe", ""];
            const next = palette[(palette.indexOf(noteHighlight) + 1 + palette.length) % palette.length];
            noteHighlight = next;
            renderNotePanel();
        });

        panel.querySelector('#palco-share-note-inline')?.addEventListener('click', async () => {
            const box = buildPalcoBox(details, palcoDoc?.id, cfg.tag, selectedType || "contentor", overlay);
            const palcoId = await savePalcoNote(details, cfg.tag, box);
            box.palco = palcoId || box.palco;
            state.noteDraft = { title: details.title, typeLabel: labelForType(selectedType || "contentor"), box };
            await reloadCurrentViewAfterMutation();
            renderRight();
            abrirPopupPartilhar(box, "__PALCO__", () => {});
        });

        panel.querySelector('#palco-save-note')?.addEventListener('click', async () => {
            const box = buildPalcoBox(details, palcoDoc?.id, cfg.tag, selectedType || "contentor", overlay);
            const palcoId = await savePalcoNote(details, cfg.tag, box);
            box.palco = palcoId || box.palco;
            state.noteDraft = { title: details.title, typeLabel: labelForType(selectedType || "contentor"), box };
            await reloadCurrentViewAfterMutation();
            renderRight();
        });

        panel.querySelector('#palco-share-note')?.addEventListener('click', async () => {
            const box = buildPalcoBox(details, palcoDoc?.id, cfg.tag, selectedType || "contentor", overlay);
            const palcoId = await savePalcoNote(details, cfg.tag, box);
            box.palco = palcoId || box.palco;
            state.noteDraft = { title: details.title, typeLabel: labelForType(selectedType || "contentor"), box };
            await reloadCurrentViewAfterMutation();
            renderRight();
            abrirPopupPartilhar(box, "__PALCO__", () => {});
        });
    }

    renderNotePanel();
    applyRatingSelectTheme(overlay.querySelector('#palco-rating-select'));
    if (details.kind === "album") {
        await refreshAlbumTracksPanel();
    }

    overlay.querySelector('#palco-open-trailer')?.addEventListener('click', () => window.open(details.trailerUrl, '_blank'));
    overlay.querySelector('#palco-open-preview')?.addEventListener('click', () => {
        if (details.kind === 'track') {
            openFloatingAudioPlayer(details);
            return;
        }
        window.open(details.previewUrl, '_blank');
    });
    overlay.querySelector('#palco-open-tracks')?.addEventListener('click', () => {
        const panel = overlay.querySelector('#palco-tracks-panel');
        if (!panel) return;
        panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    });
    overlay.querySelector('#palco-open-lyrics')?.addEventListener('click', async () => {
        await loadLyricsIntoPanel(details, overlay);
    });
    overlay.querySelector('#palco-open-lyrics-source')?.addEventListener('click', () => {
        if (details.lyricsUrl) window.open(details.lyricsUrl, '_blank');
    });
    overlay.querySelector('#palco-open-album')?.addEventListener('click', async () => {
        const albumItem = buildAlbumItemFromTrack(details);
        if (!albumItem) return;
        close();
        await abrirItemPopup(albumItem, null, { openTracks: true, selectedTrackSourceId: details.sourceId });
    });
    overlay.querySelector('#palco-open-search')?.addEventListener('click', () => {
        window.open(`https://www.google.com/search?q=${encodeURIComponent(details.title)}`, '_blank');
    });
    overlay.querySelectorAll('[data-palco-link]').forEach(btn => {
        btn.addEventListener('click', () => {
            const link = details.externalLinks?.[Number(btn.dataset.palcoLink)];
            if (link?.url) window.open(link.url, '_blank');
        });
    });
    overlay.querySelector('#palco-rating-select')?.addEventListener('change', async event => {
        applyRatingSelectTheme(event.target);
        if (!event.target.value) return;
        spawnRatingFx(event.target);
        const updatedDoc = await savePalcoRating(details, cfg.tag, Number(event.target.value));
        if (updatedDoc && palcoDoc) {
            palcoDoc.rating = updatedDoc.rating;
            palcoDoc.watched = updatedDoc.watched;
            palcoDoc.vistoem = updatedDoc.vistoem;
        }
        await reloadCurrentViewAfterMutation();
    });

    overlay.querySelector('#palco-action-watched')?.addEventListener('click', async () => {
        const next = palcoDoc?.watched === "on" ? "off" : "on";
        const updates = [updatePalcoFlags(details, cfg.tag, { watched: next })];
        if (details.kind === "album" && Array.isArray(details.tracks) && details.tracks.length) {
            updates.push(...details.tracks.map(track => updatePalcoFlags(track, cfg.tag, { watched: next })));
        }
        const updatedDocs = await Promise.all(updates);
        const [updatedDoc] = updatedDocs;
        mergePersistedDocs(updatedDocs);
        if (updatedDoc && palcoDoc) {
            palcoDoc.watched = updatedDoc.watched;
            palcoDoc.vistoem = updatedDoc.vistoem;
        }
        await reloadCurrentViewAfterMutation();
        await refreshAlbumTracksPanel();
    });

    overlay.querySelector('#palco-action-wishlist')?.addEventListener('click', async () => {
        const next = palcoDoc?.wishlist === "on" ? "off" : "on";
        const updatedDoc = await updatePalcoFlags(details, cfg.tag, { wishlist: next });
        mergePersistedDocs(updatedDoc);
        if (updatedDoc && palcoDoc) {
            palcoDoc.wishlist = updatedDoc.wishlist;
        }
        await reloadCurrentViewAfterMutation();
    });

    overlay.querySelector('#palco-action-favorite')?.addEventListener('click', async () => {
        const next = palcoDoc?.favorito === "on" ? "off" : "on";
        const updatedDoc = await updatePalcoFlags(details, cfg.tag, { favorito: next });
        mergePersistedDocs(updatedDoc);
        if (updatedDoc && palcoDoc) {
            palcoDoc.favorito = updatedDoc.favorito;
        }
        await reloadCurrentViewAfterMutation();
    });

    overlay.querySelector('#palco-action-stats')?.addEventListener('click', () => {
        alert(`Resumo rapido\nRating: ${palcoDoc?.rating || "--"}\nWishlist: ${palcoDoc?.wishlist || "off"}\nWatched: ${palcoDoc?.watched || "off"}\nFavorito: ${palcoDoc?.favorito || "off"}`);
    });

}

async function reloadCurrentViewAfterMutation() {
    if (!state.category) return;
    await loadCategoryItems();
    await renderCategoryCenter();
    renderRight();
}

function syncPopupStateButtons() {}

function buildPalcoBox(details, palcoDocId, tag, type, overlay) {
    const title = overlay.querySelector('#palco-note-title')?.value?.trim() || details.title;
    const content = overlay.querySelector('#palco-note-content')?.value?.trim() || details.description || "";
    return {
        id: crypto.randomUUID(),
        tipo: type,
        titulo: title,
        conteudo: content,
        foco: type === "contentor" ? "comentario" : "original",
        destaques: overlay.querySelector('#palco-note-panel')?.dataset.noteHighlight || "",
        estado: "on",
        ordem: 1,
        timestamp: new Date().toISOString(),
        protecao: "aberto",
        palco: palcoDocId || "",
        palcoMeta: {
            title: details.title,
            subtitle: details.subtitle || "",
            imageUrl: details.imageUrl || "",
            tag,
            source: details.source,
            sourceId: details.sourceId,
            route: {
                category: state.category,
                sourceId: details.sourceId
            }
        }
    };
}

function spawnRatingFx(anchor) {
    const host = anchor?.closest('.palco-rating-wrap') || anchor?.parentElement;
    if (!host) return;
    const fx = document.createElement('div');
    fx.className = 'palco-rating-fx';
    fx.innerHTML = `
        <i class="fa-solid fa-music"></i>
        <i class="fa-solid fa-guitar"></i>
        <i class="fa-solid fa-drum"></i>
    `;
    host.appendChild(fx);
    setTimeout(() => fx.remove(), 1200);
}

function ensureFloatingAudioPlayer() {
    let player = document.getElementById('palco-floating-player');
    if (player) return player;

    player = document.createElement('div');
    player.id = 'palco-floating-player';
    player.className = 'palco-floating-player hidden';
    player.innerHTML = `
        <div class="palco-floating-player-copy">
            <div class="palco-floating-player-kicker">A tocar</div>
            <strong id="palco-floating-player-title">Preview</strong>
        </div>
        <audio id="palco-floating-player-audio" controls preload="none" playsinline></audio>
        <button type="button" class="palco-floating-player-close" id="palco-floating-player-close" aria-label="Fechar player">
            <i class="fa-solid fa-xmark"></i>
        </button>
    `;
    document.body.appendChild(player);

    player.querySelector('#palco-floating-player-close')?.addEventListener('click', () => {
        const audio = player.querySelector('#palco-floating-player-audio');
        if (audio) {
            audio.pause();
            audio.removeAttribute('src');
            audio.load();
        }
        player.classList.add('hidden');
    });

    return player;
}

function openFloatingAudioPlayer(details) {
    if (!details?.previewUrl) return;
    const player = ensureFloatingAudioPlayer();
    const audio = player.querySelector('#palco-floating-player-audio');
    const title = player.querySelector('#palco-floating-player-title');
    if (!audio || !title) return;

    title.textContent = details.title || "Preview";
    player.classList.remove('hidden');

    if (audio.src !== details.previewUrl) {
        audio.src = details.previewUrl;
        audio.load();
    }

    const playAttempt = audio.play();
    if (playAttempt && typeof playAttempt.catch === "function") {
        playAttempt.catch(() => {});
    }
}

async function loadLyricsIntoPanel(details, overlay) {
    const panel = overlay.querySelector('#palco-lyrics-panel');
    const copy = overlay.querySelector('#palco-lyrics-copy');
    if (!panel || !copy) return;

    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    if (panel.style.display === 'none') return;
    if (panel.dataset.loaded === 'true') return;

    copy.innerHTML = 'A carregar letra...';

    const artist = details.people?.[0] || "";
    const title = details.title || "";
    if (!artist || !title) {
        copy.innerHTML = 'Letra indisponivel de momento.';
        panel.dataset.loaded = 'true';
        return;
    }

    const response = await fetchLyricsOvh(artist, title).catch(() => null);
    const lyrics = typeof response?.lyrics === "string" ? response.lyrics.trim() : "";
    copy.innerHTML = lyrics ? escapeHtml(lyrics).replace(/\n/g, '<br>') : 'Letra indisponivel de momento.';
    panel.dataset.loaded = 'true';
}

function labelForType(type) {
    if (type === "subnota") return "SUBNOTA";
    if (type === "questao") return "QUESTAO";
    return "CONTENTOR";
}

function getNoteTypeMeta(type) {
    const map = {
        contentor: { label: "CONTENTOR", icon: "fa-box", color: "#ea580c", focusLabel: "Comentario" },
        subnota: { label: "SUBNOTA", icon: "fa-box", color: "#3b82f6", focusLabel: "Original" },
        questao: { label: "QUESTAO", icon: "fa-box", color: "#10b981", focusLabel: "Original" }
    };
    return map[type] || map.contentor;
}

function watchLabel(kind) {
    if (kind === "track" || kind === "album") return "Ja ouvi";
    if (kind === "book" || kind === "author") return "Lido";
    if (kind === "event") return "Assistido";
    return "Visto";
}

function wishlistLabel(kind) {
    if (kind === "track" || kind === "album") return "Quero ouvir";
    if (kind === "book" || kind === "author") return "Quero ler";
    if (kind === "event") return "Quero assistir";
    return "Quero ver";
}

function bindShellButtons() {
    document.getElementById('btn-mobile-esquerda')?.addEventListener('click', () => {
        document.getElementById('palco-left')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    document.getElementById('btn-mobile-direita')?.addEventListener('click', () => {
        document.getElementById('palco-right')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
}

export async function abrirCategoria(category, preferredId = null, preferredTool = null) {
    const cfg = TOOLSETS[category];
    if (!cfg) return;
    state.category = category;
    state.tool = preferredTool && cfg.tools.some(tool => tool.id === preferredTool)
        ? preferredTool
        : cfg.tools[0].id;
    state.searchTerm = "";
    state.rightTag = cfg.tag;
    state.rightTab = "filters";
    renderLeft();
    renderRight();
    renderCategoryLoading(`A carregar ${cfg.title.toLowerCase()}...`);
    try {
        await loadCategoryItems();
        setDefaultCenterYearFilter(state.items, state.tool);
        syncFilterState();
    } catch (error) {
        console.warn("PALCO category load fallback:", error);
        state.items = [];
        state.stats = null;
    }
    await renderCategoryCenter();
    if (preferredId) {
        const item = state.items.find(entry => entry.sourceId === preferredId);
        if (item) await abrirItemPopup(item);
    }
}

export async function iniciarPalcoUI({ db, auth }) {
    iniciarSistemaPartilha(db, auth, () => {});
    bindShellButtons();
    renderLeft();
    renderCenterHome();
    renderRight();

    watchPalcoByUser(async items => {
        state.persisted = items;
        if (state.leftTab === "lists") renderLeft();
        renderRight();
        if (state.category && ["stats", "watched", "wishlist", "favorites", "notes"].includes(getDerivedModeType(getToolConfig(), state.tool))) {
            await loadCategoryItems();
            await renderCategoryCenter();
        }
    });

    if (!window.__palcoWishlistNotifier) {
        window.__palcoWishlistNotifier = setInterval(() => {
            sincronizarNotificacoesWishlist(state.persisted).catch(() => {});
        }, 30 * 60 * 1000);
    }

    const pendingRoute = localStorage.getItem('palco-route');
    if (pendingRoute) {
        try {
            const route = JSON.parse(pendingRoute);
            localStorage.removeItem('palco-route');
            if (route.category) {
                await abrirCategoria(route.category, route.sourceId || null, route.tool || null);
            }
        } catch (_) {
            localStorage.removeItem('palco-route');
        }
    }
}
