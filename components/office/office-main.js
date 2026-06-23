import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { firebaseConfig } from '../../firebase-config.js';

import { iniciarAutenticacao } from '../auth/auth.js';
import { SIGLAS_LIVROS } from '../lists/siglas-data.js';
import { BIBLIA_METADATA } from '../lists/biblia.js';
import { BIBLE_ABBREVIATIONS } from '../lists/bilbe-abreviatura.js';
import { inicializarLists } from '../lists/ler-lists.js';
import { iniciarNavegacaoMarcadores } from '../lists/marcadores-list.js';
import { iniciarNavegacaoTextosBiblicos } from '../lists/textos-biblicos.js';
import { renderizarNavegacaoCosmos } from '../lists/cosmos.js';
import { renderizarPaginaLeitura } from '../lists/reader/reader-view.js';
import { iniciarXSat, dispararPesquisaParabolica } from '../direita/xsat-controller.js';
import { NexoEngine } from '../direita/ai-engine.js';
import {
    $,
    MESES_LABEL,
    carregarJsonSilencioso,
    escapeHtml,
    escapeRegExp,
    existe,
    normalizar,
    officeState as state,
    slugLivro
} from './office-core.js';
import { carregarMenuSuperior, finalizarLoading, mostrarLogin } from './office-ui.js';
import { extrairTextoConteudo, normalizarItensPublicacao } from './office-content.js';
import { filtrarIndice, filtrosAtivos } from './office-search.js';
import { carregarPreferenciasUtilizador } from '../settings/preferences.js';

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

window.db = db;
window.auth = auth;

iniciarAutenticacao(app, db);

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        setTimeout(() => {
            if (!auth.currentUser) mostrarLogin();
        }, 700);
        return;
    }

    window.NotaBookUserPrefs = await carregarPreferenciasUtilizador(db, user.uid);
    await carregarMenuSuperior();
    vincularEventos();
    iniciarSettings();
    await renderizarCardsSemana();
    renderizarAtrilRaiz();
    window.ensureOfficeRightPanel = () => abrirPainelDireito('brain');
    finalizarLoading();
});

function vincularEventos() {
    instalarMobileToggleEsquerda();

    document.querySelectorAll('.office-tab').forEach(btn => {
        btn.onclick = () => trocarTab(btn.dataset.tab);
    });

    $('office-btn-search').onclick = () => abrirPopup('office-popup-search');
    $('office-search-close').onclick = () => fecharPopup('office-popup-search');
    $('office-search-submit').onclick = executarPesquisa;
    $('office-search-input').addEventListener('keydown', (event) => {
        if (event.key === "Enter") executarPesquisa();
    });
    document.querySelectorAll('#office-search-filters .piccard').forEach(card => {
        card.onclick = () => {
            card.classList.toggle('active');
            if (($('office-search-input')?.value || "").trim().length >= 2) executarPesquisa();
        };
    });
    document.querySelectorAll('[data-office-ai-mode]').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('[data-office-ai-mode]').forEach(item => item.classList.remove('active'));
            btn.classList.add('active');
            state.aiMode = btn.dataset.officeAiMode;
        };
    });

    $('office-prev').onclick = () => navegarItem(-1);
    $('office-next').onclick = () => navegarItem(1);
    $('office-context-title').onclick = abrirPainelNav;
    $('office-nav-close').onclick = () => $('office-nav-panel').classList.add('hidden');

    $('office-btn-xsat').onclick = async () => {
        if (!state.currentData) return;
        await abrirPainelDireito('xsat');
        iniciarXSat();
        dispararPesquisaParabolica(extrairTextoConteudo(state.currentData));
    };

    $('office-btn-ai').onclick = () => abrirPopup('office-popup-ai');
    $('office-btn-bookai-float').onclick = () => abrirPopup('office-popup-ai');
    $('office-ai-close').onclick = () => fecharPopup('office-popup-ai');
    $('office-ai-send').onclick = responderBokkai;
    $('office-ai-input').addEventListener('keydown', (event) => {
        if (event.key === "Enter") responderBokkai();
    });

    $('office-btn-settings').onclick = () => abrirPopup('office-popup-settings');
    $('office-settings-close').onclick = () => fecharPopup('office-popup-settings');

    document.addEventListener('click', (event) => {
        if (event.target.closest('#office-scripture-close')) {
            event.preventDefault();
            event.stopPropagation();
            $('office-popup-scripture').classList.add('hidden');
            return;
        }

        const scriptureTab = event.target.closest('.office-scripture-tabs button');
        if (scriptureTab) {
            event.preventDefault();
            event.stopPropagation();
            state.scriptureView = scriptureTab.dataset.view;
            document.querySelectorAll('.office-scripture-tabs button').forEach(item => item.classList.remove('active'));
            scriptureTab.classList.add('active');
            if (state.scriptureRef) renderizarPopupTextoBiblico(state.scriptureRef);
        }
    });

    tornarPopupArrastavel();
}

function trocarTab(tab) {
    state.activeTab = tab;
    document.querySelectorAll('.office-tab').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tab));
    $('office-week-cards').style.display = tab === "atril" ? "grid" : "none";
    if (tab === "atril") renderizarAtrilRaiz();
    else renderizarListsSemLivros();
}

window.refreshOfficeLists = () => {
    if (state.activeTab === "lists") {
        renderizarListsSemLivros();
    }
};

function renderizarAtrilRaiz() {
    const list = $('office-left-list');
    list.innerHTML = `
        <button class="office-list-item" data-cat="livros"><i class="fa-solid fa-book"></i><span>Livros</span></button>
        <button class="office-list-item" data-cat="sentinelas"><i class="fa-solid fa-copy"></i><span>A Sentinela</span></button>
        <button class="office-list-item" data-cat="mwb"><i class="fa-solid fa-calendar-check"></i><span>Manual de Atividades</span></button>
        <button class="office-list-item" data-cat="multimedia"><i class="fa-solid fa-clapperboard"></i><span>Multimedia</span></button>
    `;

    list.querySelector('[data-cat="livros"]').onclick = () => listarLivros();
    list.querySelector('[data-cat="sentinelas"]').onclick = () => escolherAno('sentinelas');
    list.querySelector('[data-cat="mwb"]').onclick = () => escolherAno('mwb');
    list.querySelector('[data-cat="multimedia"]').onclick = () => escolherAno('multimedia');
}

async function renderizarListsSemLivros() {
    const list = $('office-left-list');
    list.innerHTML = `<div id="lista-lists"></div>`;
    await carregarComponente('office-popup-cosmos-area', 'components/popup/popup-cosmos.html');
    await inicializarLists(db, auth);
    if (typeof window.renderizarMenuPrincipalLists === 'function') {
        window.renderizarMenuPrincipalLists();
        limparLivrosDaListsOffice();
    }
    instalarDelegacaoListsOffice();
}

function limparLivrosDaListsOffice() {
    const list = $('office-left-list');
    list?.querySelector('#menu-list-livros')?.remove();
}

function instalarDelegacaoListsOffice() {
    const container = document.getElementById('lista-lists');
    if (!container || container.dataset.officeBound === "true") return;
    container.dataset.officeBound = "true";

    const renderOriginal = window.renderizarMenuPrincipalLists;
    if (typeof renderOriginal === 'function' && !window.renderizarMenuPrincipalListsOfficeWrapped) {
        window.renderizarMenuPrincipalLists = (...args) => {
            renderOriginal(...args);
            limparLivrosDaListsOffice();
        };
        window.renderizarMenuPrincipalListsOfficeWrapped = true;
    }

    container.addEventListener('click', (event) => {
        if (event.target.closest('#menu-list-livros')) {
            event.preventDefault();
            event.stopPropagation();
            limparLivrosDaListsOffice();
            return;
        }
        if (event.target.closest('#menu-list-marcadores')) {
            event.preventDefault();
            event.stopPropagation();
            iniciarNavegacaoMarcadores(db, auth);
            return;
        }
        if (event.target.closest('#menu-list-textos-biblicos')) {
            event.preventDefault();
            event.stopPropagation();
            iniciarNavegacaoTextosBiblicos(db, auth);
            return;
        }
        if (event.target.closest('#menu-list-cosmos')) {
            event.preventDefault();
            event.stopPropagation();
            renderizarNavegacaoCosmos();
            return;
        }
        if (event.target.closest('#menu-list-destaques')) {
            setTimeout(limparLivrosDaListsOffice, 0);
        }
    }, true);
}

async function renderizarCardsSemana() {
    const host = $('office-week-cards');
    const hoje = new Date();
    const ano = hoje.getFullYear();
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    const semana = Math.max(0, Math.min(4, Math.floor((hoje.getDate() - 1) / 7)));

    const wt = await carregarJsonSilencioso(`data/publicacoes/w/${ano}/${mes}.json`);
    const mwb = await carregarJsonSilencioso(`data/publicacoes/mwb/${ano}/${mes}.json`);

    const artigoWt = wt?.artigos?.[semana] || wt?.artigos?.[0] || null;
    const artigoMwb = encontrarMwbDaSemana(mwb?.artigos || [], hoje) || mwb?.artigos?.[0] || null;

    host.innerHTML = `
        <button class="office-week-card watchtower" id="office-card-wt">
            <div class="office-week-label">Sentinela da semana</div>
            <div class="office-week-title">${escapeHtml(artigoWt?.titulo || "Sem artigo local")}</div>
        </button>
        <button class="office-week-card mwb" id="office-card-mwb">
            <div class="office-week-label">Manual da semana</div>
            <div class="office-week-title">${escapeHtml(artigoMwb?.titulo || "Sem reuniao local")}</div>
        </button>
    `;

    $('office-card-wt').onclick = () => artigoWt && abrirConteudo(artigoWt, wt, wt.artigos, wt.artigos.indexOf(artigoWt), `data/publicacoes/w/${ano}/${mes}.json`, 'sentinelas');
    $('office-card-mwb').onclick = () => artigoMwb && abrirConteudo(artigoMwb, mwb, mwb.artigos, mwb.artigos.indexOf(artigoMwb), `data/publicacoes/mwb/${ano}/${mes}.json`, 'mwb');
}

function encontrarMwbDaSemana(artigos, data) {
    const dia = data.getDate();
    const mesNome = normalizar(MESES_LABEL[data.getMonth()]);
    return artigos.find(artigo => {
        const titulo = normalizar(artigo.titulo || "");
        const match = titulo.match(/(\d{1,2})\s+a\s+(\d{1,2})\s+de\s+([a-z]+)/i);
        if (!match) return false;
        const ini = Number(match[1]);
        const fim = Number(match[2]);
        const mes = normalizar(match[3]);
        return mesNome.startsWith(mes) && dia >= ini && dia <= fim;
    });
}

async function listarLivros() {
    const list = $('office-left-list');
    list.innerHTML = `<button class="office-list-header" id="office-back-root"><i class="fa-solid fa-chevron-left"></i> Livros</button>`;
    $('office-back-root').onclick = renderizarAtrilRaiz;

    for (const sigla of Object.keys(SIGLAS_LIVROS)) {
        const path = `data/livros/${sigla}.json`;
        if (!(await existe(path))) continue;
        const item = document.createElement('button');
        item.className = "office-list-item";
        item.innerHTML = `<small>${sigla.toUpperCase()}</small><span>${escapeHtml(SIGLAS_LIVROS[sigla])}</span>`;
        item.onclick = async () => carregarPublicacao(path, 'livros', "");
        list.appendChild(item);
    }
}

function escolherAno(kind) {
    const list = $('office-left-list');
    const titulo = { sentinelas: "A Sentinela", mwb: "Manual de Atividades", multimedia: "Multimedia" }[kind];
    list.innerHTML = `
        <button class="office-list-header" id="office-back-root"><i class="fa-solid fa-chevron-left"></i> ${titulo}</button>
        <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:6px; padding:6px;"></div>
    `;
    $('office-back-root').onclick = renderizarAtrilRaiz;
    const grid = list.querySelector('div');
    for (let ano = 2026; ano >= 1950; ano--) {
        const btn = document.createElement('button');
        btn.className = "office-list-item";
        btn.style.justifyContent = "center";
        btn.textContent = ano;
        btn.onclick = () => listarEdicoes(kind, ano);
        grid.appendChild(btn);
    }
}

async function listarEdicoes(kind, ano) {
    const list = $('office-left-list');
    list.innerHTML = `<button class="office-list-header" id="office-back-year"><i class="fa-solid fa-chevron-left"></i> ${ano}</button>`;
    $('office-back-year').onclick = () => escolherAno(kind);

    const possiveis = kind === 'multimedia'
        ? Array.from({ length: 80 }, (_, idx) => String(idx + 1).padStart(2, '0')).concat(["40","41","42","43","44"])
        : ["01","02","03","04","05","06","07","08","09","10","11","12","01_01","01_15","02_01","02_15","03_01","03_15","04_01","04_15","05_01","05_15","06_01","06_15","07_01","07_15","08_01","08_15","09_01","09_15","10_01","10_15","11_01","11_15","12_01","12_15"];
    let count = 0;

    for (const id of possiveis) {
        const pasta = kind === 'sentinelas' ? 'w' : kind;
        const path = (kind === 'multimedia') ? `data/multimedia/${ano}/${id}.json` : `data/publicacoes/${pasta}/${ano}/${id}.json`;
        if (!(await existe(path))) continue;
        const meta = kind === 'multimedia' ? await carregarJsonSilencioso(path) : null;
        count++;
        const btn = document.createElement('button');
        btn.className = "office-list-item";
        btn.innerHTML = kind === 'multimedia'
            ? `<small>${id}</small><span>${escapeHtml(meta?.video?.titulo || `Video ${id}`)}</span>`
            : `<i class="fa-solid fa-calendar-day"></i><span>${formatarEdicao(id)}</span>`;
        btn.onclick = () => carregarPublicacao(path, kind, ano);
        list.appendChild(btn);
    }

    if (!count) list.insertAdjacentHTML('beforeend', `<div class="office-empty" style="height:auto; padding:30px 10px;">Sem edicoes locais.</div>`);
}

async function carregarPublicacao(path, kind, ano) {
    const json = await carregarJsonSilencioso(path);
    if (!json) return;

    if (json.video) {
        state.currentItems = [json.video];
        abrirConteudo(json.video, json, state.currentItems, 0, path, kind, ano);
        return;
    }

    const itens = normalizarItensPublicacao(json);
    state.currentItems = itens;
    state.currentParent = json;
    state.currentPath = path;
    state.currentKind = kind;

    const list = $('office-left-list');
    list.innerHTML = `<button class="office-list-header" id="office-back-pub"><i class="fa-solid fa-chevron-left"></i> ${escapeHtml(json.titulo || "Conteudos")}</button>`;
    $('office-back-pub').onclick = () => {
        if (kind === "livros") listarLivros();
        else listarEdicoes(kind, ano);
    };

    itens.forEach((item, index) => {
        const btn = document.createElement('button');
        btn.className = "office-list-item";
        const label = json.capitulos ? `Capitulo ${item.capitulo || index + 1}` : (json.video ? "Video" : `Artigo ${index + 1}`);
        btn.innerHTML = `<small>${label}</small><span>${escapeHtml(item.titulo || "Sem titulo")}</span>`;
        btn.onclick = () => abrirConteudo(item, json, itens, index, path, kind, ano);
        list.appendChild(btn);
    });
}

function abrirConteudo(item, parent, siblings, index, path, kind, ano = "") {
    const reader = $('office-reader');
    state.currentData = item;
    state.currentParent = parent;
    state.currentItems = siblings || [item];
    state.currentIndex = index;
    state.currentPath = path;
    state.currentKind = kind;

    document.body.classList.add('office-content-open');
    renderizarPaginaLeitura(item, reader, parent, () => {});
    prepararConteudoCentral();
    if (officeIsTouchMobile()) fecharPainelEsquerdoMobile();
    atualizarOfficeBookAiFloating();
    atualizarTituloContexto(item);
    guardarRecente(item, path, kind, index);
    renderizarRecentes();
    $('office-nav-panel').classList.add('hidden');
}

function prepararConteudoCentral() {
    document.querySelectorAll('#office-reader [data-p]').forEach(bloco => {
        bloco.addEventListener('click', () => abrirPainelDireito('brain'));
    });

    document.querySelectorAll('#office-reader #corpo-texto-leitura span').forEach(span => {
        span.innerHTML = linkificarTextosBiblicos(span.textContent);
    });

    document.querySelectorAll('.office-scripture-ref').forEach(btn => {
        btn.onclick = (event) => {
            event.stopPropagation();
            abrirTextoBiblico(btn.dataset.ref);
        };
    });
}

async function abrirPainelDireito(panel = "brain") {
    const col = $('office-right-col');
    col.classList.remove('closed');
    col.classList.add('active');
    col.style.setProperty('display', 'flex', 'important');
    if (officeIsTouchMobile()) {
        col.style.removeProperty('width');
        col.style.removeProperty('min-width');
        col.style.setProperty('height', `${Number(col.dataset.sheetPct || 70)}vh`, 'important');
    } else {
        col.style.setProperty('width', '380px', 'important');
    }

    if (col.innerHTML.trim() === "" || !col.querySelector('#panel-brain')) {
        const res = await fetch('components/direita/menu.html');
        col.innerHTML = await res.text();
        instalarMobileSheet(col);
        col.querySelector('#btn-eye')?.remove();
        col.querySelector('#panel-eye')?.remove();
        const brainBtn = col.querySelector('#btn-brain');
        if (brainBtn) brainBtn.classList.add('active');
        iniciarXSat();
    }

    if (window.switchPanel) window.switchPanel(panel);
}

window.switchPanel = (panel) => {
    document.querySelectorAll('#office-right-col .tab-content').forEach(content => {
        content.classList.remove('active');
        content.style.display = 'none';
    });
    document.querySelectorAll('#office-right-col .segmented-control button').forEach(btn => btn.classList.remove('active'));
    const target = $(`panel-${panel}`);
    const btn = $(`btn-${panel}`);
    if (target) {
        target.classList.add('active');
        target.style.display = 'flex';
    }
    if (btn) btn.classList.add('active');
};

function atualizarTituloContexto(item) {
    const label = item?.capitulo ? `CAP. ${item.capitulo}` : item?.titulo || "CONTEUDO";
    $('office-context-title').textContent = label;
}

function navegarItem(delta) {
    if (!state.currentItems.length || state.currentIndex < 0) return;
    const next = state.currentIndex + delta;
    if (next < 0 || next >= state.currentItems.length) return;
    abrirConteudo(state.currentItems[next], state.currentParent, state.currentItems, next, state.currentPath, state.currentKind);
}

function abrirPainelNav() {
    if (!state.currentItems.length) return;
    const panel = $('office-nav-panel');
    const host = $('office-nav-items');
    host.innerHTML = "";
    state.currentItems.forEach((item, index) => {
        const btn = document.createElement('button');
        btn.className = `office-list-item ${index === state.currentIndex ? 'active' : ''}`;
        btn.innerHTML = `<small>${index + 1}</small><span>${escapeHtml(item.titulo || `Item ${index + 1}`)}</span>`;
        btn.onclick = () => abrirConteudo(item, state.currentParent, state.currentItems, index, state.currentPath, state.currentKind);
        host.appendChild(btn);
    });
    renderizarRecentes();
    panel.classList.remove('hidden');
}

function guardarRecente(item, path, kind, index) {
    const key = "notabook:office:recent";
    const recent = JSON.parse(localStorage.getItem(key) || "[]")
        .filter(entry => !(entry.path === path && Number(entry.index) === Number(index)));
    recent.unshift({ title: item.titulo || "Conteudo", path, kind, index, at: Date.now() });
    localStorage.setItem(key, JSON.stringify(recent.slice(0, 4)));
}

function renderizarRecentes() {
    const host = $('office-recent');
    if (!host) return;
    const recent = JSON.parse(localStorage.getItem("notabook:office:recent") || "[]").slice(0, 4);
    host.innerHTML = recent.map((item, idx) => `<button class="office-recent-card" data-r="${idx}">${escapeHtml(item.title)}</button>`).join('');
    host.querySelectorAll('[data-r]').forEach(btn => {
        btn.onclick = async () => {
            const entry = recent[Number(btn.dataset.r)];
            const json = await carregarJsonSilencioso(entry.path);
            const items = normalizarItensPublicacao(json);
            abrirConteudo(items[entry.index] || items[0], json, items, entry.index || 0, entry.path, entry.kind);
        };
    });
}

function linkificarTextosBiblicos(texto) {
    const refs = detetarTextosBiblicos(texto);
    if (!refs.length) return escapeHtml(texto);

    let html = "";
    let cursor = 0;
    refs.forEach(ref => {
        html += escapeHtml(texto.slice(cursor, ref.start));
        html += `<span class="office-scripture-ref" data-ref="${escapeHtml(ref.raw)}">${escapeHtml(ref.raw)}</span>`;
        cursor = ref.end;
    });
    html += escapeHtml(texto.slice(cursor));
    return html;
}

function detetarTextosBiblicos(texto) {
    const aliases = Object.entries(BIBLE_ABBREVIATIONS).map(([nome, livro]) => ({ nome, livro }));
    const pattern = aliases.map(alias => escapeRegExp(alias.nome)).sort((a, b) => b.length - a.length).join('|');
    const regex = new RegExp(`\\b(${pattern})\\.?\\s+(\\d{1,3}[:\\s]\\d{1,3}(?:\\s*-\\s*\\d+)?(?:\\s*[,;]\\s*\\d{1,3}(?::\\d{1,3})?(?:\\s*-\\s*\\d+)?)*)`, 'giu');
    const refs = [];
    let match;
    while ((match = regex.exec(texto)) !== null) {
        refs.push({ raw: match[0], start: match.index, end: match.index + match[0].length });
    }
    return refs;
}

function criarAliasesBiblicos() {
    const extra = {
        "Génesis": ["Gen", "Gên", "Gn"],
        "Êxodo": ["Ex", "Êx"],
        "Levítico": ["Lev", "Le"],
        "Números": ["Num", "Núm", "Nu"],
        "Deuteronómio": ["Deut", "Dt"],
        "Josué": ["Jos"],
        "Juízes": ["Jz"],
        "Salmos": ["Sal", "Sl"],
        "Provérbios": ["Pro", "Pr"],
        "Isaías": ["Isa", "Is"],
        "Jeremias": ["Jer"],
        "Mateus": ["Mat", "Mt"],
        "Marcos": ["Mar", "Mr"],
        "Lucas": ["Luc", "Lu"],
        "João": ["Joao", "Jo", "João"],
        "Romanos": ["Rom", "Ro"],
        "1 Coríntios": ["1 Cor", "1Co"],
        "2 Coríntios": ["2 Cor", "2Co"],
        "Apocalipse": ["Apo", "Ap"]
    };
    const list = [];
    BIBLIA_METADATA.forEach(book => {
        const nomes = [book.nome, book.abrev, normalizar(book.nome), ...(extra[book.nome] || [])];
        nomes.forEach(nome => list.push({ nome, livro: book.nome }));
    });
    return list.filter(item => item.nome && item.nome.length > 1);
}

async function abrirTextoBiblico(raw) {
    state.scriptureRef = raw;
    state.scriptureView = "text";
    document.querySelectorAll('.office-scripture-tabs button').forEach(btn => btn.classList.toggle('active', btn.dataset.view === "text"));
    const popup = $('office-popup-scripture');
    popup.classList.remove('hidden');
    await renderizarPopupTextoBiblico(raw);
}

async function renderizarPopupTextoBiblico(raw) {
    const parsed = parseReferenciaBiblica(raw);
    $('office-scripture-title').textContent = raw;
    const body = $('office-scripture-body');
    if (!parsed) {
        body.textContent = "Nao consegui interpretar esta referencia.";
        return;
    }

    if (state.scriptureView === "versions") {
        body.innerHTML = `<div class="office-scripture-verse"><b>Cita</b> Outras versoes aparecem aqui quando existirem ficheiros locais compativeis para ${escapeHtml(raw)}.</div>`;
        await carregarVersaoAlternativa(parsed, body);
        return;
    }

    try {
        const data = await fetch(`data/biblia/${slugLivro(parsed.livro)}.json`).then(res => res.json());
        const linhas = [];
        parsed.citacoes.forEach(cite => {
            const cap = data[parsed.livro]?.[cite.cap];
            cite.versiculos.forEach(ver => {
                if (cap?.[ver]) linhas.push(`<div class="office-scripture-verse"><b>${cite.cap}:${ver}</b>${escapeHtml(cap[ver])}</div>`);
            });
        });
        body.innerHTML = linhas.join('') || "Texto nao encontrado no JSON local.";
    } catch (error) {
        body.textContent = "Texto nao encontrado no JSON local.";
    }
}

async function carregarVersaoAlternativa(parsed, body) {
    const bases = ["BLH"];
    for (const base of bases) {
        try {
            const data = await fetch(`data/biblias/${base}/${slugLivro(parsed.livro)}.json`).then(res => res.ok ? res.json() : null);
            if (!data) continue;
            const linhas = [];
            parsed.citacoes.forEach(cite => {
                const cap = data[parsed.livro]?.[cite.cap] || data[cite.cap];
                cite.versiculos.forEach(ver => {
                    if (cap?.[ver]) linhas.push(`<div class="office-scripture-verse"><b>${base} ${cite.cap}:${ver}</b>${escapeHtml(cap[ver])}</div>`);
                });
            });
            if (linhas.length) body.insertAdjacentHTML('beforeend', linhas.join(''));
        } catch (e) {}
    }
}

function parseReferenciaBiblica(raw) {
    const aliases = Object.entries(BIBLE_ABBREVIATIONS)
        .map(([nome, livro]) => ({ nome, livro }))
        .sort((a, b) => b.nome.length - a.nome.length);
    const normRaw = normalizar(raw);
    const alias = aliases.find(item => normRaw.startsWith(normalizar(item.nome)));
    const nums = raw.match(/(\d{1,3})[:\s](.+)$/);
    if (!alias || !nums) return null;

    let cap = Number(nums[1]);
    const citacoes = [];
    String(nums[2]).split(/[;,]/).forEach(grupo => {
        const item = grupo.trim();
        if (!item) return;

        let capAtual = cap;
        let versStr = item;
        const capMatch = item.match(/^(\d{1,3}):(.+)$/);
        if (capMatch) {
            capAtual = Number(capMatch[1]);
            cap = capAtual;
            versStr = capMatch[2].trim();
        }

        const versiculos = [];
        if (versStr.includes('-')) {
            const [ini, fim] = versStr.split('-').map(n => Number(n.trim()));
            if (!Number.isNaN(ini) && !Number.isNaN(fim)) {
                for (let i = Math.min(ini, fim); i <= Math.max(ini, fim); i++) versiculos.push(i);
            }
        } else {
            const n = Number(versStr);
            if (!Number.isNaN(n)) versiculos.push(n);
        }
        if (versiculos.length) citacoes.push({ cap: capAtual, versiculos: [...new Set(versiculos)] });
    });

    return citacoes.length ? { livro: alias.livro, citacoes } : null;
}

function officeIsTouchMobile() {
    return window.matchMedia('(max-width: 680px)').matches;
}

function tornarPopupArrastavel() {
    const popup = $('office-popup-scripture');
    const drag = $('office-scripture-drag');
    let active = false;
    let sx = 0;
    let sy = 0;
    let ox = 0;
    let oy = 0;

    drag.addEventListener('pointerdown', (event) => {
        if (officeIsTouchMobile() || event.target.closest('button')) return;
        active = true;
        sx = event.clientX;
        sy = event.clientY;
        ox = popup.offsetLeft;
        oy = popup.offsetTop;
        drag.setPointerCapture(event.pointerId);
    });
    drag.addEventListener('pointermove', (event) => {
        if (!active) return;
        popup.style.left = `${Math.max(8, ox + event.clientX - sx)}px`;
        popup.style.top = `${Math.max(8, oy + event.clientY - sy)}px`;
    });
    drag.addEventListener('pointerup', () => active = false);
}

function iniciarSettings() {
    const mainDesktop = $('office-main-font-desktop');
    const mainMobile = $('office-main-font-mobile');
    const pop = $('office-popup-font');
    const net = $('office-response-net');
    const floating = $('office-ai-floating');
    const savedMainDesktop = localStorage.getItem("notabook:office:mainFontDesktop") || localStorage.getItem("notabook:office:mainFont") || "16";
    const savedMainMobile = localStorage.getItem("notabook:office:mainFontMobile") || localStorage.getItem("notabook:office:mainFont") || savedMainDesktop;
    const savedPop = localStorage.getItem("notabook:office:popupFont") || "15";

    mainDesktop.value = savedMainDesktop;
    mainMobile.value = savedMainMobile;
    pop.value = savedPop;
    aplicarFontes();

    mainDesktop.oninput = () => {
        localStorage.setItem("notabook:office:mainFontDesktop", mainDesktop.value);
        aplicarFontes();
    };
    mainMobile.oninput = () => {
        localStorage.setItem("notabook:office:mainFontMobile", mainMobile.value);
        aplicarFontes();
    };
    pop.oninput = () => {
        localStorage.setItem("notabook:office:popupFont", pop.value);
        aplicarFontes();
    };

    net.checked = localStorage.getItem("notabook:rede-respostas") === "true";
    net.onchange = () => {
        localStorage.setItem("notabook:rede-respostas", net.checked ? "true" : "false");
        localStorage.setItem("redeRespostasAtiva", net.checked ? "true" : "false");
        window.redeRespostasAtiva = net.checked;
    };

    floating.checked = localStorage.getItem("notabook:office:aiFloating") === "true";
    floating.onchange = () => {
        localStorage.setItem("notabook:office:aiFloating", floating.checked ? "true" : "false");
        atualizarOfficeBookAiFloating();
    };
    atualizarOfficeBookAiFloating();
    window.addEventListener('resize', aplicarFontes);
}

function aplicarFontes() {
    const mainDesktop = $('office-main-font-desktop').value;
    const mainMobile = $('office-main-font-mobile').value;
    const main = window.innerWidth <= 768 ? mainMobile : mainDesktop;
    const pop = $('office-popup-font').value;
    document.documentElement.style.setProperty('--office-main-font', `${main}px`);
    document.documentElement.style.setProperty('--office-popup-font', `${pop}px`);
    $('office-main-font-val-desktop').textContent = `${mainDesktop}px`;
    $('office-main-font-val-mobile').textContent = `${mainMobile}px`;
    $('office-popup-font-val').textContent = `${pop}px`;
}

function atualizarOfficeBookAiFloating() {
    const enabled = localStorage.getItem("notabook:office:aiFloating") === "true";
    const hasContent = Boolean(state.currentData);
    const iconBarra = $('office-btn-ai');
    const zone = $('office-bookai-floating-zone');

    if (iconBarra) {
        iconBarra.style.setProperty('display', enabled || !hasContent ? 'none' : 'inline-flex', 'important');
    }

    if (!zone) return;
    zone.classList.toggle('hidden', !enabled || !hasContent);
    zone.style.display = enabled && hasContent ? 'block' : 'none';
}

function fecharPainelEsquerdoMobile() {
    document.body.classList.add('office-left-collapsed');
    document.body.classList.add('office-content-open');
    atualizarOfficeBookAiFloating();
}

function abrirPainelEsquerdoMobile() {
    document.body.classList.remove('office-left-collapsed');
    document.body.classList.remove('office-content-open');
    atualizarOfficeBookAiFloating();
}

function instalarMobileToggleEsquerda() {
    if ($('office-btn-left-toggle')) return;
    const btn = document.createElement('button');
    btn.id = 'office-btn-left-toggle';
    btn.className = 'office-icon-btn office-left-toggle';
    btn.innerHTML = '<i class="fa-solid fa-bars"></i>';
    btn.title = 'Abrir Atril';
    btn.onclick = () => {
        if (document.body.classList.contains('office-left-collapsed')) {
            abrirPainelEsquerdoMobile();
            return;
        }
        document.body.classList.add('office-left-collapsed');
        setTimeout(abrirPainelEsquerdoMobile, 140);
    };
    document.querySelector('.office-left-actions')?.prepend(btn);
}

function instalarMobileSheet(col) {
    if (col.querySelector('.mobile-sheet-chrome')) return;

    const chrome = document.createElement('div');
    chrome.className = 'mobile-sheet-chrome';
    chrome.innerHTML = `
        <div class="mobile-sheet-handle"></div>
        <button class="mobile-sheet-close" title="Fechar"><i class="fa-solid fa-xmark"></i></button>
    `;
    col.prepend(chrome);

    chrome.querySelector('.mobile-sheet-close').onclick = () => {
        col.classList.remove('active');
        col.classList.add('closed');
        col.style.removeProperty('height');
        col.style.removeProperty('bottom');
        col.style.removeProperty('width');
        col.style.removeProperty('min-width');
        col.style.removeProperty('display');
    };

    const handle = chrome.querySelector('.mobile-sheet-handle');
    let startY = 0;
    let startHeight = 0;

    const setPct = (pct) => {
        const clamped = Math.max(70, Math.min(85, pct));
        col.style.setProperty('height', `${clamped}vh`, 'important');
        col.dataset.sheetPct = String(clamped);
    };
    if (officeIsTouchMobile()) setPct(Number(col.dataset.sheetPct || 70));

    const iniciarDragSheet = (event) => {
        if (event.target.closest('button')) return;
        if (!officeIsTouchMobile()) return;
        event.stopPropagation();
        startY = event.clientY;
        startHeight = Number(col.dataset.sheetPct || 70);
        col.classList.add('dragging');
        event.currentTarget.setPointerCapture(event.pointerId);
    };

    const moverDragSheet = (event) => {
        if (!col.classList.contains('dragging')) return;
        const delta = ((startY - event.clientY) / window.innerHeight) * 100;
        setPct(startHeight + delta);
    };

    const terminarDragSheet = () => col.classList.remove('dragging');

    handle.addEventListener('pointerdown', iniciarDragSheet);
    handle.addEventListener('pointermove', moverDragSheet);
    handle.addEventListener('pointerup', terminarDragSheet);
    chrome.addEventListener('pointerdown', iniciarDragSheet);
    chrome.addEventListener('pointermove', moverDragSheet);
    chrome.addEventListener('pointerup', terminarDragSheet);
}

async function carregarComponente(idElemento, caminhoFicheiro) {
    const el = $(idElemento);
    if (!el || el.dataset.loaded === caminhoFicheiro) return;
    const response = await fetch(caminhoFicheiro);
    if (!response.ok) return;
    el.innerHTML = await response.text();
    el.dataset.loaded = caminhoFicheiro;
}

async function executarPesquisa() {
    const query = normalizar($('office-search-input').value || "");
    if (query.length < 2) return;
    const filtros = filtrosAtivos('#office-search-filters');
    const host = $('office-search-results');
    host.innerHTML = `<div class="bible-search-loading"><i class="fa-solid fa-circle-notch fa-spin"></i> A procurar...</div>`;
    const index = await obterSearchIndex();
    const results = filtrarIndice(index, query, filtros);
    host.innerHTML = results.map((item, idx) => `
        <button class="search-result-item" data-result="${idx}">
            <span class="search-result-ref">${escapeHtml(item.label)}</span>
            <span class="search-result-text">${escapeHtml(item.title)}</span>
        </button>
    `).join('') || `<div class="office-empty" style="height:auto; padding:30px;">Sem resultados.</div>`;

    host.querySelectorAll('[data-result]').forEach(btn => {
        btn.onclick = async () => {
            const result = results[Number(btn.dataset.result)];
            const json = await carregarJsonSilencioso(result.path);
            const items = normalizarItensPublicacao(json);
            fecharPopup('office-popup-search');
            abrirConteudo(items[result.index] || items[0], json, items, result.index || 0, result.path, result.kind);
        };
    });
}

async function obterSearchIndex() {
    if (state.searchIndex) return state.searchIndex;
    const items = [];

    for (const sigla of Object.keys(SIGLAS_LIVROS)) {
        const path = `data/livros/${sigla}.json`;
        const json = await carregarJsonSilencioso(path);
        normalizarItensPublicacao(json || {}).forEach((item, index) => {
            items.push({ filter: "livros", kind: "livros", path, index, label: SIGLAS_LIVROS[sigla], title: item.titulo, text: `${item.titulo} ${extrairTextoConteudo(item)}` });
        });
    }

    const anos = [2026, 2025, 2024, 2023, 2022];
    for (const ano of anos) {
        for (const mes of ["01","02","03","04","05","06","07","08","09","10","11","12"]) {
            for (const cfg of [
                { path: `data/publicacoes/w/${ano}/${mes}.json`, filter: "sentinelas", kind: "sentinelas", label: `Sentinela ${mes}/${ano}` },
                { path: `data/publicacoes/mwb/${ano}/${mes}.json`, filter: "publicacoes", kind: "mwb", label: `Manual ${mes}/${ano}` },
                { path: `data/multimedia/${ano}/${mes}.json`, filter: "multimedia", kind: "multimedia", label: `Multimedia ${mes}/${ano}` }
            ]) {
                const json = await carregarJsonSilencioso(cfg.path);
                normalizarItensPublicacao(json || {}).forEach((item, index) => {
                    items.push({ ...cfg, index, title: item.titulo, text: `${item.titulo} ${extrairTextoConteudo(item)}` });
                });
            }
        }
    }

    state.searchIndex = items;
    return items;
}

async function responderBokkai() {
    const input = $('office-ai-input');
    const pergunta = input.value.trim();
    if (!pergunta) return;
    input.value = "";
    const texto = extrairTextoConteudo(state.currentData || {});
    const resumo = texto.slice(0, 900) || "Ainda nao ha pagina aberta.";
    const modo = state.aiMode || "net";

    $('office-ai-messages').insertAdjacentHTML('beforeend', `
        <div class="chat-bubble user">${escapeHtml(pergunta)}</div>
        <div class="chat-bubble ai" id="office-ai-thinking"><i class="fa-solid fa-circle-notch fa-spin"></i> O Bokkai esta a analisar...</div>
    `);

    const fonteRegra = modo === "local"
        ? "Responde apenas com base no texto da pagina selecionada. Se a informacao nao estiver no texto, diz isso claramente."
        : "Responde com base no texto da pagina selecionada e em informacao da internet, dando prioridade aos sites jw.org e wol.jw.org.";

    const contextPrompt = `ESTAS A ANALISAR ESTA PAGINA DO ESCRITORIO: ${state.currentData?.titulo || "sem titulo"}.
TEXTO DA PAGINA: "${texto}".

REGRAS:
1. ${fonteRegra}
2. Responde em Portugues de Portugal.
3. Se usares informacao externa, privilegia jw.org e wol.jw.org.`;

    try {
        const resposta = await NexoEngine.perguntar(pergunta, "normal", contextPrompt);
        $('office-ai-thinking')?.remove();
        $('office-ai-messages').insertAdjacentHTML('beforeend', `<div class="chat-bubble ai">${escapeHtml(resposta)}</div>`);
    } catch (e) {
        $('office-ai-thinking')?.remove();
        $('office-ai-messages').insertAdjacentHTML('beforeend', `<div class="chat-bubble ai">Nao consegui sintonizar o Bokkai agora. Base local desta pagina: ${escapeHtml(resumo)}</div>`);
    }
}

function formatarEdicao(id) {
    if (id.includes('_')) {
        const [mes, dia] = id.split('_');
        return `${Number(dia)} de ${MESES_LABEL[Number(mes) - 1] || mes}`;
    }
    const n = Number(id);
    return MESES_LABEL[n - 1] || id;
}

function abrirPopup(id) {
    $(id)?.classList.add('active');
}

function fecharPopup(id) {
    $(id)?.classList.remove('active');
}
