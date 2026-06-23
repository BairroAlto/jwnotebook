// components/bible-portal/bible-main.js
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { firebaseConfig } from '../../firebase-config.js';

import { iniciarAutenticacao } from '../auth/auth.js';
import { BIBLIA_METADATA } from '../lists/biblia.js';
import { BibleUI } from './bible-ui-controller.js';
import { BibleSettings } from './bible-settings.js';
import { BibleSearch } from './bible-search.js';
import { BibleNav } from './bible-nav.js';
import { BibleMarkers } from './bible-markers.js';
import { BibleAnchors } from './bible-anchors.js';
import { BibleAI } from './bible-ai.js';
import { BibleSatellite } from './bible-satellite.js';
import { iniciarXSat } from '../direita/xsat-controller.js';

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

window.db = db;
window.auth = auth;
window.livroAtivo = null;
window.capAtivo = null;
window.referenciaAtiva = null;
window.textoCapituloAtual = "";

let bootDone = false;

iniciarAutenticacao(app, db);

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        setTimeout(() => {
            if (!auth.currentUser) BibleUI.mostrarLogin();
        }, 700);
        return;
    }

    if (bootDone) return;
    bootDone = true;

    await BibleUI.carregarMenuSuperior();
    const preloadBiblia = BibleSearch.preload().catch(error => console.warn("[BIBLE] Preload da pesquisa falhou.", error));
    await preloadBiblia;
    BibleUI.finalizarLoading();
    vincularEventos();
    BibleSettings.iniciar();
    BibleAI.renderizarProtocolos();
    BibleMarkers.iniciar(db, auth, (livro, cap, ver) => window.carregarCapituloNoPortal(livro, cap, ver));
    renderizarMosaicoInicial();
});

function slugLivro(nome) {
    return nome.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, '_');
}

function escaparAtributo(valor) {
    return String(valor)
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

function guardarTextoRecente(livro, cap) {
    const key = "notabook:bible:recent";
    const atual = { livro, cap: Number(cap), label: `${livro} ${cap}`, at: Date.now() };
    const lista = JSON.parse(localStorage.getItem(key) || "[]")
        .filter(item => !(item.livro === livro && Number(item.cap) === Number(cap)));
    lista.unshift(atual);
    localStorage.setItem(key, JSON.stringify(lista.slice(0, 8)));
}

window.getBibleRecentTexts = () => JSON.parse(localStorage.getItem("notabook:bible:recent") || "[]");

function renderizarMosaicoInicial() {
    window.livroAtivo = null;
    window.capAtivo = null;
    window.referenciaAtiva = null;
    window.textoCapituloAtual = "";

    const feed = document.getElementById('bible-feed');
    if (!feed) return;
    document.body.classList.remove('bible-book-select-active');

    const antigoT = BIBLIA_METADATA.filter(l => l.id <= 39);
    const novoT = BIBLIA_METADATA.filter(l => l.id > 39);

    const gerarGrid = (lista) => lista.map(livro => `
        <button class="mosaico-book-card" style="background:${livro.grupo.cor}"
                onclick="window.mostrarCapitulosDoLivro('${escaparAtributo(livro.nome)}')">
            ${livro.abrev}
        </button>
    `).join('');

    feed.className = "bible-mosaico-view";
    feed.innerHTML = `
        <section class="testamento-section">
            <h4 class="testamento-title">Antigo Testamento</h4>
            <div class="books-horizontal-grid">${gerarGrid(antigoT)}</div>
        </section>
        <section class="testamento-section">
            <h4 class="testamento-title">Novo Testamento</h4>
            <div class="books-horizontal-grid">${gerarGrid(novoT)}</div>
        </section>
    `;

    BibleUI.ativarModoLeitura(false, "ESCOLHER LIVRO");
    BibleUI.fecharPainelLateral();
}

function mostrarCapitulosDoLivro(livroNome) {
    const livro = BIBLIA_METADATA.find(item => item.nome === livroNome);
    const feed = document.getElementById('bible-feed');
    if (!livro || !feed) return;

    window.livroAtivo = livro.nome;
    window.capAtivo = null;
    document.body.classList.add('bible-book-select-active');

    feed.className = "bible-mosaico-view";
    feed.innerHTML = `
        <section class="testamento-section">
            <h4 class="testamento-title bible-book-heading">${livro.nome}</h4>
            <div class="bible-nav-grid-caps">
                ${Array.from({ length: livro.caps }, (_, idx) => {
                    const cap = idx + 1;
                    return `<button class="nav-cap-btn" onclick="window.carregarCapituloNoPortal('${escaparAtributo(livro.nome)}', ${cap})">${cap}</button>`;
                }).join('')}
            </div>
        </section>
    `;

    BibleUI.ativarModoLeitura(false, livro.nome.toUpperCase());
    const titleEl = document.getElementById('bible-context-title');
    if (titleEl) titleEl.innerHTML = `<i class="fa-solid fa-arrow-left"></i><span>Livros</span>`;
    BibleUI.fecharPainelLateral();
}

async function carregarCapituloNoPortal(livroNome, cap, verAlvo = null) {
    const livro = BIBLIA_METADATA.find(item => item.nome === livroNome);
    if (!livro) return;

    window.livroAtivo = livro.nome;
    window.capAtivo = Number(cap);
    window.referenciaAtiva = `${livro.nome} ${cap}`;
    document.body.classList.remove('bible-book-select-active');

    BibleUI.mostrarLoadingLeitura(true);

    try {
        const res = await fetch(`data/biblia/${slugLivro(livro.nome)}.json`);
        const data = await res.json();
        const versiculos = data[livro.nome][cap];
        const feed = document.getElementById('bible-feed');
        const modo = BibleSettings.state.viewMode || "grid";

        window.textoCapituloAtual = Object.entries(versiculos)
            .map(([num, texto]) => `${num}. ${texto}`)
            .join("\n");

        feed.className = modo === "sequence" ? "view-sequence" : "view-grid";
        feed.innerHTML = Object.entries(versiculos).map(([num, texto]) => `
            <div class="bible-verse-row" data-v="${num}">
                <button class="v-num" onclick="window.ativarBrainBiblia('${num}', '${escaparAtributo(texto)}')" aria-label="Abrir estudo de ${livro.nome} ${cap}:${num}">${num}</button>
                <span class="v-text">${texto}</span>
            </div>
        `).join('');

        guardarTextoRecente(livro.nome, cap);
        BibleUI.ativarModoLeitura(true, `${livro.nome.toUpperCase()} ${cap}`);
        atualizarBookAiFloating();

        if (verAlvo) {
            setTimeout(() => BibleUI.scrollParaVersiculo(verAlvo), 250);
        } else {
            document.getElementById('bible-reader-container')?.scrollTo({ top: 0, behavior: "auto" });
        }
    } catch (error) {
        console.error("[BIBLE] Falha ao carregar capitulo:", error);
        renderizarMosaicoInicial();
    } finally {
        BibleUI.mostrarLoadingLeitura(false);
    }
}

function navegarCapitulo(direcao) {
    if (!window.livroAtivo || !window.capAtivo) return;

    const idx = BIBLIA_METADATA.findIndex(l => l.nome === window.livroAtivo);
    const livro = BIBLIA_METADATA[idx];
    const novoCap = Number(window.capAtivo) + direcao;

    if (novoCap < 1 && idx > 0) {
        const anterior = BIBLIA_METADATA[idx - 1];
        carregarCapituloNoPortal(anterior.nome, anterior.caps);
    } else if (novoCap > livro.caps && idx < BIBLIA_METADATA.length - 1) {
        const proximo = BIBLIA_METADATA[idx + 1];
        carregarCapituloNoPortal(proximo.nome, 1);
    } else if (novoCap >= 1 && novoCap <= livro.caps) {
        carregarCapituloNoPortal(livro.nome, novoCap);
    }
}

function atualizarBookAiFloating() {
    const iconBarra = document.getElementById('btn-abrir-ai-biblia');
    const zonaFlutuante = document.getElementById('bookai-floating-zone');
    if (BibleSettings.state.aiFloating) {
        if (iconBarra) iconBarra.style.setProperty('display', 'none', 'important');
        if (zonaFlutuante) {
            zonaFlutuante.classList.remove('hidden');
            zonaFlutuante.style.display = 'flex';
        }
    } else if (zonaFlutuante) {
        zonaFlutuante.classList.add('hidden');
        zonaFlutuante.style.display = 'none';
        document.getElementById('bookai-floating-chat')?.classList.add('hidden');
    }
}

function vincularEventos() {
    const bind = (id, action) => {
        const el = document.getElementById(id);
        if (el) el.onclick = action;
    };

    bind('btn-prev-cap', () => navegarCapitulo(-1));
    bind('btn-next-cap', () => navegarCapitulo(1));
    bind('bible-context-title', () => {
        if (window.livroAtivo && window.capAtivo) BibleNav.abrirPainelTroca();
        else if (window.livroAtivo && !window.capAtivo) renderizarMosaicoInicial();
    });

    bind('btn-abrir-pesquisa-biblia', () => BibleUI.togglePopup('popup-search-bible', true));
    bind('btn-abrir-marcadores-biblia', () => BibleUI.togglePopup('popup-markers-bible', true));
    bind('btn-abrir-ancoras-biblia', async () => {
        BibleUI.togglePopup('popup-anchors-bible', true);
        await BibleAnchors.carregarAncoras(db, auth);
    });
    bind('btn-limpar-highlights', () => BibleAnchors.limparHighlighter());

    bind('btn-abrir-ai-biblia', () => BibleUI.togglePopup('popup-ai-bible', true));
    bind('btn-enviar-chat', () => {
        const input = document.getElementById('input-chat-bible');
        const pergunta = input?.value.trim();
        if (!pergunta) return;
        input.value = "";
        BibleAI.enviarPergunta(pergunta);
    });
    bind('btn-enviar-chat-floating', () => {
        const input = document.getElementById('input-chat-bible-floating');
        const pergunta = input?.value.trim();
        if (!pergunta) return;
        input.value = "";
        BibleAI.enviarPergunta(pergunta);
    });
    document.getElementById('input-chat-bible')?.addEventListener('keydown', (event) => {
        if (event.key === "Enter") document.getElementById('btn-enviar-chat')?.click();
    });
    document.getElementById('input-chat-bible-floating')?.addEventListener('keydown', (event) => {
        if (event.key === "Enter") document.getElementById('btn-enviar-chat-floating')?.click();
    });

    document.querySelectorAll('.ai-tab').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.ai-tab').forEach(tab => tab.classList.remove('active'));
            document.querySelectorAll('.ai-content-view').forEach(view => view.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(btn.dataset.target)?.classList.add('active');
        };
    });

    document.querySelectorAll('.bookai-mode-pill').forEach(btn => {
        btn.onclick = () => {
            BibleAI.setMode(btn.dataset.aiMode);
        };
    });

    bind('btn-xsat-bible', async () => {
        if (!window.livroAtivo || !window.capAtivo) return;
        await BibleUI.abrirPainelLateral();
        iniciarXSat();
        await BibleSatellite.scanCapituloInteiro(window.livroAtivo, window.capAtivo);
    });

    bind('btn-abrir-settings-bible', () => BibleUI.togglePopup('popup-settings-bible', true));
    bind('btn-fechar-settings-bible', () => BibleUI.togglePopup('popup-settings-bible', false));

    const inputPesquisa = document.getElementById('input-bible-query');
    const botaoPesquisa = document.getElementById('btn-executar-busca-biblia');
    if (botaoPesquisa) botaoPesquisa.style.display = 'none';

    let searchTimer = null;
    inputPesquisa?.addEventListener('input', () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
            const query = inputPesquisa.value || "";
            if (query.trim().length >= 2) BibleSearch.executar(query, { silentShort: true });
            else BibleSearch.limpar();
        }, 220);
    });

    document.querySelectorAll('#filter-testamentos .piccard').forEach(card => {
        card.onclick = () => {
            document.querySelectorAll('#filter-testamentos .piccard').forEach(item => item.classList.remove('active'));
            card.classList.add('active');
            BibleSearch.setTestamento(card.dataset.filter);
            const query = document.getElementById('input-bible-query')?.value || "";
            if (query.trim().length >= 2) BibleSearch.executar(query, { silentShort: true });
        };
    });
}

window.mostrarCapitulosDoLivro = mostrarCapitulosDoLivro;
window.renderizarMosaicoPrincipal = renderizarMosaicoInicial;
window.carregarCapituloNoPortal = carregarCapituloNoPortal;
window.fecharPopup = (id) => BibleUI.togglePopup(id, false);

window.ativarBrainBiblia = async (ver, texto) => {
    await BibleUI.abrirPainelLateral();
    iniciarXSat();
    const modulo = await import('../direita/biblia-brain.js');
    modulo.abrirVersiculoNoBrain(window.livroAtivo, window.capAtivo, ver, texto, db, auth);
    setTimeout(() => {
        document.getElementById('btn-eye')?.remove();
        if (window.switchPanel) window.switchPanel('brain');
    }, 120);
    BibleUI.scrollParaVersiculo(ver);
};

window.switchPanel = (panel) => {
    document.querySelectorAll('#bible-right-col .tab-content').forEach(content => {
        content.classList.remove('active');
        content.style.display = 'none';
    });
    document.querySelectorAll('#bible-right-col .segmented-control button').forEach(btn => btn.classList.remove('active'));

    const target = document.getElementById(`panel-${panel}`);
    const btn = document.getElementById(`btn-${panel}`);
    if (target) {
        target.classList.add('active');
        target.style.display = 'flex';
    }
    if (btn) btn.classList.add('active');
};
