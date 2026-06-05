// components/bible-portal/bible-nav.js
import { BIBLIA_METADATA } from '../lists/biblia.js';

function escapar(valor) {
    return String(valor)
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

export const BibleNav = {
    abrirPainelTroca: () => {
        const idx = BIBLIA_METADATA.findIndex(l => l.nome === window.livroAtivo);
        const livro = BIBLIA_METADATA[idx];
        const container = document.getElementById('bible-nav-content');
        const panel = document.getElementById('bible-nav-panel');

        if (!livro || !container || !panel) return;

        const anterior = BIBLIA_METADATA[idx - 1];
        const proximo = BIBLIA_METADATA[idx + 1];
        const recentes = typeof window.getBibleRecentTexts === "function" ? window.getBibleRecentTexts().slice(0, 4) : [];

        container.innerHTML = `
            <div class="bible-nav-grid-caps">
                ${Array.from({ length: livro.caps }, (_, i) => i + 1).map(n => `
                    <button class="nav-cap-btn ${n === Number(window.capAtivo) ? 'active' : ''}"
                            onclick="window.carregarCapituloNoPortal('${escapar(livro.nome)}', ${n}); window.fecharPainelNavBiblia();">
                        ${n}
                    </button>
                `).join('')}
            </div>

            <div class="nav-adjacentes">
                ${anterior ? `
                    <button class="adj-link" onclick="window.carregarCapituloNoPortal('${escapar(anterior.nome)}', ${anterior.caps}); window.fecharPainelNavBiblia();">
                        <i class="fa-solid fa-chevron-left"></i> ${anterior.nome}
                    </button>` : '<span></span>'}
                ${proximo ? `
                    <button class="adj-link" onclick="window.carregarCapituloNoPortal('${escapar(proximo.nome)}', 1); window.fecharPainelNavBiblia();">
                        ${proximo.nome} <i class="fa-solid fa-chevron-right"></i>
                    </button>` : '<span></span>'}
            </div>

            <div class="recent-bible-block">
                <div class="recent-bible-title">Ultimos textos acessados</div>
                <div class="recent-bible-piccards">
                    ${recentes.length ? recentes.map(item => `
                        <button class="recent-bible-item" onclick="window.carregarCapituloNoPortal('${escapar(item.livro)}', ${Number(item.cap)}); window.fecharPainelNavBiblia();">
                            ${item.label}
                        </button>
                    `).join('') : '<p class="recent-empty">Ainda sem historico nesta sessao.</p>'}
                </div>
            </div>

            <div class="nav-books-toggle-block">
                <button class="nav-books-toggle" onclick="const g=document.getElementById('nav-books-grid'); g.classList.toggle('hidden'); if(!g.classList.contains('hidden')) setTimeout(()=>g.scrollIntoView({behavior:'smooth', block:'nearest'}), 40);">
                    <span>Livros</span>
                    <i class="fa-solid fa-chevron-down"></i>
                </button>
                <div id="nav-books-grid" class="nav-books-grid hidden">
                    ${BIBLIA_METADATA.map(item => `
                        <button class="nav-book-mini" style="background:${item.grupo.cor}"
                                onclick="window.mostrarCapitulosDoLivro('${escapar(item.nome)}'); window.fecharPainelNavBiblia();">
                            ${item.abrev}
                        </button>
                    `).join('')}
                </div>
            </div>
        `;

        panel.classList.remove('hidden');
        panel.classList.add('active');
    }
};

window.BibleNav = BibleNav;
window.fecharPainelNavBiblia = () => {
    const panel = document.getElementById('bible-nav-panel');
    if (!panel) return;
    panel.classList.add('hidden');
    panel.classList.remove('active');
};
