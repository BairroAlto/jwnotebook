export function iniciarNavegacaoPalco(registos = []) {
    const listaLists = document.getElementById('lista-lists');
    if (!listaLists) return;
    if (!window.htmlListaAntiga) window.htmlListaAntiga = listaLists.innerHTML;

    const grupos = [
        { tag: "filmes-tv", nome: "Filmes e TV", icon: "fa-clapperboard", category: "movies" },
        { tag: "musicas", nome: "Música", icon: "fa-music", category: "music" },
        { tag: "eventos", nome: "Eventos", icon: "fa-masks-theater", category: "events" },
        { tag: "livros", nome: "Livros", icon: "fa-book-open", category: "books" }
    ];

    const views = [
        { id: "vistos", label: "Vistos" },
        { id: "querover", label: "Quero Ver" },
        { id: "favorito", label: "Favorito" }
    ];

    let activeView = "vistos";

    listaLists.innerHTML = `
        <div id="btn-lists-voltar" class="palco-lists-back">
            <i class="fa-solid fa-arrow-left"></i> Voltar a Lists
        </div>
        <div class="palco-lists-shell">
            <div class="palco-lists-kicker">Palco</div>
            <div id="palco-view-switcher" class="palco-view-switcher"></div>
        </div>
        <div id="palco-notification-section" class="palco-lists-notifications" style="display:none;"></div>
        <div id="lista-palco-grupos" class="palco-lists-grid"></div>
    `;

    document.getElementById('btn-lists-voltar').onclick = () => {
        listaLists.innerHTML = window.htmlListaAntiga;
        window.htmlListaAntiga = null;
    };

    const switcher = document.getElementById('palco-view-switcher');
    const container = document.getElementById('lista-palco-grupos');

    function renderNotifications() {
        const section = document.getElementById('palco-notification-section');
        if (!section) return;

        const notificacoes = Array.isArray(window.__palcoNotificationItems) ? window.__palcoNotificationItems : [];
        if (activeView !== "querover") {
            section.style.display = "none";
            section.innerHTML = "";
            return;
        }

        section.style.display = "flex";
        if (!notificacoes.length) {
            section.innerHTML = `
                <div class="palco-lists-notif-title">Notificações</div>
                <div class="palco-lists-notif-empty">Ainda não tens novidades oficiais para os teus itens em Quero Ver.</div>
            `;
            return;
        }

        section.innerHTML = `
            <div class="palco-lists-notif-title"><i class="fa-solid fa-bell"></i> Notificações</div>
            ${notificacoes.map(item => `
                <button
                    type="button"
                    class="palco-notification-item"
                    data-palco-notif-tag="${item.tag || ""}"
                    data-palco-notif-source="${item.sourceId || ""}">
                    <div class="palco-notification-copy">
                        <span class="palco-notification-name">${escapeHtml(item.titulo || item.nome || "Novidade PALCO")}</span>
                        <small class="palco-notification-meta">${escapeHtml(item.dataOficial || item.data || item.texto || "Disponível oficialmente")}</small>
                    </div>
                    <i class="fa-solid fa-arrow-up-right-from-square"></i>
                </button>
            `).join("")}
        `;
    }

    function renderCategoryItems(category, view) {
        const grupo = grupos.find(item => item.category === category);
        if (!grupo) return;

        const itens = registos
            .filter(item => item.tag === grupo.tag && matchesView(item, view))
            .sort((a, b) => String(b.releaseDate || b.vistoem || b.timestamp || "").localeCompare(String(a.releaseDate || a.vistoem || a.timestamp || "")));

        container.innerHTML = `
            <div class="palco-lists-section-head">
                <button type="button" id="palco-back-categories" class="palco-lists-section-back">
                    <i class="fa-solid fa-chevron-left"></i>
                </button>
                <div class="palco-lists-section-copy">
                    <span class="palco-lists-section-title">${grupo.nome}</span>
                    <small class="palco-lists-section-meta">${labelForView(view)} · ${itens.length} registo${itens.length === 1 ? "" : "s"}</small>
                </div>
            </div>
            <div class="palco-lists-content-stack">
                ${itens.length ? itens.map(item => `
                    <button
                        type="button"
                        class="palco-content-list-item"
                        data-palco-open-tag="${item.tag || ""}"
                        data-palco-open-source="${item.sourceId || ""}"
                        data-palco-open-view="${view}">
                        <div class="palco-content-list-art">
                            ${item.imageurl ? `<img src="${item.imageurl}" alt="${escapeHtml(item.nome || 'Conteúdo PALCO')}">` : `<i class="fa-solid ${grupo.icon}"></i>`}
                        </div>
                        <div class="palco-content-list-copy">
                            <span class="palco-content-list-name">${escapeHtml(item.nome || "Sem título")}</span>
                            <small class="palco-content-list-year">${escapeHtml(item.ano || item.releaseDate || "Sem data")}</small>
                            <small class="palco-content-list-type">${escapeHtml(item.oque || grupo.nome)}</small>
                        </div>
                        <i class="fa-solid fa-chevron-right palco-content-list-arrow"></i>
                    </button>
                `).join("") : `<div class="palco-lists-empty">Sem conteúdos nesta categoria.</div>`}
            </div>
        `;

        document.getElementById('palco-back-categories')?.addEventListener('click', () => renderAll());
        container.querySelectorAll('.palco-content-list-item').forEach(item => {
            item.addEventListener('click', () => {
                const categoryFromTag = inferCategory(item.dataset.palcoOpenTag);
                localStorage.setItem("palco-route", JSON.stringify({
                    category: categoryFromTag,
                    sourceId: item.dataset.palcoOpenSource || null,
                    tool: inferTool(categoryFromTag, item.dataset.palcoOpenView)
                }));
                window.location.href = "palco.html";
            });
        });
    }

    function renderCards() {
        container.innerHTML = grupos.map(grupo => {
            const total = registos.filter(item => item.tag === grupo.tag && matchesView(item, activeView)).length;
            return `
                <button
                    type="button"
                    class="palco-category-card"
                    data-palco-category="${grupo.category}"
                    data-palco-view="${activeView}">
                    <div class="palco-category-card-main">
                        <div class="palco-category-card-icon">
                            <i class="fa-solid ${grupo.icon}"></i>
                        </div>
                        <div class="palco-category-card-copy">
                            <span class="palco-category-card-title">${grupo.nome}</span>
                            <small class="palco-category-card-meta">${labelForView(activeView)} · ${total} registo${total === 1 ? "" : "s"}</small>
                        </div>
                    </div>
                    <i class="fa-solid fa-chevron-right palco-category-card-arrow"></i>
                </button>
            `;
        }).join("");
    }

    function bindInteractions() {
        switcher?.querySelectorAll("[data-palco-view]").forEach(btn => {
            btn.onclick = () => {
                activeView = btn.dataset.palcoView || "vistos";
                renderAll();
            };
        });

        document.querySelectorAll(".palco-category-card").forEach(item => {
            item.addEventListener("click", () => {
                renderCategoryItems(item.dataset.palcoCategory, item.dataset.palcoView);
            });
        });

        document.querySelectorAll(".palco-notification-item").forEach(item => {
            item.addEventListener("click", () => {
                const category = inferCategory(item.dataset.palcoNotifTag);
                localStorage.setItem("palco-route", JSON.stringify({
                    category,
                    sourceId: item.dataset.palcoNotifSource || null,
                    tool: inferTool(category, "querover")
                }));
                window.location.href = "palco.html";
            });
        });
    }

    function renderAll() {
        if (switcher) {
            switcher.innerHTML = views.map(view => `
                <button
                    type="button"
                    data-palco-view="${view.id}"
                    class="palco-view-button ${view.id === activeView ? "active" : ""}">
                    ${view.label}
                </button>
            `).join("");
        }

        renderNotifications();
        renderCards();
        bindInteractions();
    }

    renderAll();
}

function labelForView(view) {
    if (view === "querover") return "Quero Ver";
    if (view === "favorito") return "Favorito";
    return "Vistos";
}

function matchesView(item, view) {
    if (view === "querover") return item?.wishlist === "on";
    if (view === "favorito") return item?.favorito === "on";
    return item?.watched === "on";
}

function inferTool(category, view) {
    const map = {
        movies: { vistos: "vistos", querover: "querover", favorito: "favoritos" },
        music: { vistos: "ouvidos", querover: "queroouvir", favorito: "favoritos" },
        events: { vistos: "assistidos", querover: "queroassistir", favorito: "favoritos" },
        books: { vistos: "lidos", querover: "queroler", favorito: "favoritos" }
    };
    return map[category]?.[view] || null;
}

function inferCategory(tag) {
    if (tag === "filmes-tv") return "movies";
    if (tag === "musicas") return "music";
    if (tag === "eventos") return "events";
    return "books";
}

function escapeHtml(value = "") {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}
