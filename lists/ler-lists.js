// components/lists/ler-lists.js
import { collection, doc, getDoc, query, where, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { iniciarNavegacaoBiblia } from './biblia.js';
import { iniciarNavegacaoLivros } from './livros.js';
import { iniciarCosmos, renderizarNavegacaoCosmos } from './cosmos.js'; 
import { abrirNotaNoEditor } from '../editor/editor.js';
import { iniciarTopicos, renderizarNavegacaoTopicos } from './topicos.js'; 
import { abrirPopupMarcadores } from '../direita/biblia-marcador.js';
import { iniciarNavegacaoTextosBiblicos } from './textos-biblicos.js';
import { iniciarNavegacaoMarcadores } from './marcadores-list.js';
import { iniciarNavegacaoPalco } from './palco.js';

let dbRef, authRef;
let nomesCoresCustom = {};
let listenersAtivos = false;
let escutaPesquisaAtual = null;
let corAtivaPesquisa = null;
let unsubPalcoNotifications = null;

/**
 * INICIALIZADOR PRINCIPAL DA ABA LISTS
 */
export async function inicializarLists(db, auth) {
    dbRef = db;
    authRef = auth;

    // Iniciar subsistemas modulares
    iniciarCosmos(db, auth);
    iniciarTopicos(db, auth); 
 
    // 1. Carregar nomes das cores personalizados para a aba Destaques
    try {
        const snap = await getDoc(doc(db, "users", auth.currentUser.uid));
        if (snap.exists() && snap.data().caixadestaques) {
            nomesCoresCustom = snap.data().caixadestaques;
        }
    } catch (e) { console.error("Erro ao carregar cores custom:", e); }

    // 2. GESTOR DE CLIQUES (DELEGAÇÃO)
    if (!listenersAtivos) {
        document.body.addEventListener('click', (e) => {
            
            // --- TÓPICOS ---
            if (e.target.closest('#menu-list-topicos')) renderizarNavegacaoTopicos();

            // --- DESTAQUES (CORES) ---
            if (e.target.closest('#menu-list-destaques')) renderizarMenuCores();
            
            // --- BÍBLIA ---
            // Passamos db e auth para o versículo conseguir abrir o Brain depois
            if (e.target.closest('#menu-list-biblia')) iniciarNavegacaoBiblia(dbRef, authRef);
            
            // --- MARCADORES (NOVO) ---
           if (e.target.closest('#menu-list-marcadores')) {
    iniciarNavegacaoMarcadores(dbRef, authRef);
}

            if (e.target.closest('#menu-list-textos-biblicos')) {
    iniciarNavegacaoTextosBiblicos(dbRef, authRef);
}

            // --- LIVROS E PUBLICAÇÕES ---
            if (e.target.closest('#menu-list-livros')) iniciarNavegacaoLivros();

            // --- COSMOS ---
            if (e.target.closest('#menu-list-cosmos')) renderizarNavegacaoCosmos();

            // --- PALCO ---
            if (e.target.closest('#menu-list-palco')) iniciarNavegacaoPalco(window.__palcoPersistedItems || []);

        });
        listenersAtivos = true;
    }

    vigiarPalcoPersistido();
    vigiarNotificacoesPalco();
}

/**
 * MENU DE DESTAQUES (CORES)
 */
function renderizarMenuCores() {
    const listaLists = document.getElementById('lista-lists');
    if (!listaLists) return;
    
    if (!window.htmlListaAntiga) window.htmlListaAntiga = listaLists.innerHTML;
    
    const CORES_BASE = [
        { code: "#B12823", name: "Vermelho Tijolo" }, { code: "#AC4A0B", name: "Laranja Outono" },
        { code: "#D8B200", name: "Amarelo Dourado" }, { code: "#436C21", name: "Verde Oliva" },
        { code: "#006042", name: "Verde Esmeralda" }, { code: "#1F7AC4", name: "Azul Oceano" },
        { code: "#B53E69", name: "Rosa Suave" }, { code: "#8438D7", name: "Roxo Ametista" }, 
        { code: "#A08F8E", name: "Cinza Quente" }  
    ];

    listaLists.innerHTML = `
        <div id="btn-lists-voltar" style="display: flex; align-items: center; gap: 10px; padding: 12px; cursor: pointer; color: var(--text-muted); font-size: 11px; font-weight: 800; border-bottom: 1px solid var(--border-color); margin-bottom: 10px; text-transform: uppercase;">
            <i class="fa-solid fa-arrow-left"></i> Voltar a Lists
        </div>
        <div id="lists-cores-grid" style="display: flex; flex-direction: column; gap: 2px;"></div>
    `;

    document.getElementById('btn-lists-voltar').onclick = () => {
        corAtivaPesquisa = null; // Limpa a seleção ao voltar
        listaLists.innerHTML = window.htmlListaAntiga;
        window.htmlListaAntiga = null;
    };

    const grid = document.getElementById('lists-cores-grid');
    CORES_BASE.forEach(cor => {
        const nomeReal = nomesCoresCustom[cor.code] || cor.name;
        
        // 1. Verificar se esta cor é a selecionada
        const isAtiva = cor.code === corAtivaPesquisa;

        const div = document.createElement('div');
        div.className = `menu-item-list ${isAtiva ? 'active' : ''}`;
        
        // 2. Aplicar estilo visual de item selecionado
        if (isAtiva) {
            div.style.background = "rgba(255, 255, 255, 0.05)";
            div.style.borderLeft = `4px solid ${cor.code}`;
        }

        div.innerHTML = `
            <div style="width: 14px; height: 14px; border-radius: 50%; background-color: ${cor.code}; box-shadow: ${isAtiva ? '0 0 8px ' + cor.code : 'none'}"></div>
            <span style="color: ${isAtiva ? 'white' : 'inherit'}; font-weight: ${isAtiva ? '700' : '400'}">${nomeReal}</span>
        `;

        div.onclick = () => {
            corAtivaPesquisa = cor.code; // Atualiza o estado
            renderizarMenuCores(); // Re-renderiza a lista para mostrar o active
            pesquisarDestaquesNoBrain(cor.code, nomeReal);
        };
        grid.appendChild(div);
    });
}

/**
 * PESQUISA DE BLOCOS COLORIDOS (BRAIN)
 */
async function pesquisarDestaquesNoBrain(corHex, corNome) {
    if (typeof window.ensureOfficeRightPanel === 'function') await window.ensureOfficeRightPanel();
    if (typeof window.switchPanel === 'function') window.switchPanel('brain');
    
    const divResultados = document.getElementById('brain-resultado-pesquisa');
    const subTabs = document.getElementById('sub-tabs-brain');

    if (!divResultados || !subTabs) return;

    // Esconde as abas padrão do Brain para dar lugar ao resultado da pesquisa
    subTabs.querySelectorAll('button').forEach(b => b.style.display = 'none');
    
    let abaPesquisa = document.getElementById('aba-pesquisa-brain');
    if (!abaPesquisa) {
        abaPesquisa = document.createElement('button');
        abaPesquisa.id = "aba-pesquisa-brain";
        abaPesquisa.className = "active";
        abaPesquisa.innerHTML = `<i class="fa-brands fa-searchengin" style="color:${corHex}"></i> ${corNome}`;
        subTabs.prepend(abaPesquisa);
    }

    // --- CORREÇÃO VISUAL AQUI ---
    divResultados.style.display = 'flex';
    divResultados.style.flexDirection = 'column'; // Força os itens a ficarem um por baixo do outro
    divResultados.style.padding = '15px';         // Adiciona um respiro nas laterais
    divResultados.style.gap = '10px';            // Espaçamento consistente entre cards
    
    divResultados.innerHTML = `<div style="text-align:center; padding:30px; color:var(--text-muted);"><i class="fa-solid fa-circle-notch fa-spin"></i></div>`;

    if (escutaPesquisaAtual) escutaPesquisaAtual();

    const q = query(collection(dbRef, "Local"), where("userId", "==", authRef.currentUser.uid));
    
    escutaPesquisaAtual = onSnapshot(q, (snapshot) => {
        divResultados.innerHTML = "";
        let encontrados = 0;

        snapshot.forEach(docSnap => {
            const nota = docSnap.data();
            if (nota.estado !== "on") return;

            if (nota.caixas) {
                const caixasAlvo = nota.caixas.filter(c => 
                    c.estado === "on" && 
                    c.destaques === corHex
                );
                
                caixasAlvo.forEach(caixa => {
                    encontrados++;
                    const card = document.createElement('div');
                    
                    // Ajuste de largura do card para ocupar 100%
                    card.style.cssText = `
                        width: 100%;
                        background: rgba(255,255,255,0.03); 
                        border-left: 4px solid ${corHex};
                        padding: 15px; 
                        border-radius: 8px; 
                        cursor: pointer;
                        transition: 0.2s;
                        border: 1px solid rgba(255,255,255,0.05);
                        border-left: 4px solid ${corHex};
                    `;
                    
                    // Efeito Hover
                    card.onmouseenter = () => card.style.background = "rgba(255,255,255,0.06)";
                    card.onmouseleave = () => card.style.background = "rgba(255,255,255,0.03)";

                    let resumo = (caixa.titulo || caixa.conteudo || "").substring(0, 120);
                    if (resumo.length >= 120) resumo += "...";

                    card.innerHTML = `
                        <div style="font-size:9px; color:var(--primary); margin-bottom:8px; text-transform:uppercase; font-weight:800; display:flex; align-items:center; gap:6px;">
                            <i class="fa-solid fa-file-lines"></i> ${nota.nome}
                        </div>
                        <div style="font-size:13px; color:#f1f5f9; line-height:1.5; font-weight:500;">${resumo}</div>
                    `;

                    card.onclick = () => {
                        if (window.NotaBookMode === "book" && typeof window.abrirNotaNoBook === "function") {
                            window.abrirNotaNoBook(docSnap.id, { ...nota, onde: "local" }, dbRef, authRef, caixa.id);
                        } else {
                            abrirNotaNoEditor(docSnap.id, nota, dbRef, authRef, caixa.id);
                        }
                    };
                    divResultados.appendChild(card);
                });
            }
        });

        if (encontrados === 0) {
            divResultados.innerHTML = `
                <div style="text-align:center; padding:60px 20px; color:var(--text-muted); opacity:0.5;">
                    <i class="fa-solid fa-ghost" style="font-size:30px; margin-bottom:15px;"></i>
                    <p style="font-size:12px;">Nenhum destaque visível com a cor ${corNome}.</p>
                </div>`;
        }
    });
}

window.renderizarMenuPrincipalLists = () => {
    const container = document.getElementById('lista-lists');
    if (!container) return;

    // Reset de estados de navegação
    window.htmlListaAntiga = null; 

    container.innerHTML = `
        <div class="menu-item-list" id="menu-list-topicos">
            <i class="fa-solid fa-layer-group" style="color: #818cf8;"></i> Tópicos
        </div>
        <div class="menu-item-list" id="menu-list-destaques">
            <i class="fa-solid fa-palette" style="color: #fbbf24;"></i> Destaques
        </div>
        <div class="menu-separador-list"></div>
        <div class="menu-item-list" id="menu-list-biblia">
            <i class="fa-solid fa-book-open" style="color: #e879f9;"></i> Bíblia
        </div>
        <div class="menu-item-list" id="menu-list-textos-biblicos">
            <i class="fa-solid fa-scroll" style="color: #8b5cf6;"></i> Textos Bíblicos
        </div>
        <div class="menu-item-list" id="menu-list-marcadores">
            <i class="fa-solid fa-bookmark" style="color: #ef4444;"></i> Marcadores
        </div>
        <div class="menu-separador-list"></div>
        <div class="menu-item-list" id="menu-list-livros">
            <i class="fa-solid fa-book" style="color: #60a5fa;"></i> Livros
        </div>
        <div class="menu-separador-list"></div>
        <div class="menu-item-list" id="menu-list-cosmos">
            <i class="fa-solid fa-meteor" style="color: #d49d06;"></i> Cosmos
        </div>
    `;
};

const FUSEIS_LISTS_DEFAULT = {
    topicos: true,
    destaques: true,
    biblia: true,
    textosBiblicos: true,
    marcadores: true,
    livros: true,
    cosmos: true,
    palco: true
};

function canShowListItem(key, contexto = "default") {
    const fuseis = { ...FUSEIS_LISTS_DEFAULT, ...(window.NotaBookUserPrefs?.listsFuseis || {}) };
    if (contexto === "office" && key === "livros") return false;
    return Boolean(fuseis[key]);
}

window.renderizarMenuPrincipalLists = () => {
    const container = document.getElementById('lista-lists');
    if (!container) return;
    window.htmlListaAntiga = null;

    const blocos = [];
    if (canShowListItem('topicos')) {
        blocos.push(`<div class="menu-item-list" id="menu-list-topicos"><i class="fa-solid fa-layer-group" style="color: #818cf8;"></i> Tópicos</div>`);
    }
    if (canShowListItem('destaques')) {
        blocos.push(`<div class="menu-item-list" id="menu-list-destaques"><i class="fa-solid fa-palette" style="color: #fbbf24;"></i> Destaques</div>`);
    }
    if (blocos.length) blocos.push(`<div class="menu-separador-list"></div>`);
    if (canShowListItem('biblia')) {
        blocos.push(`<div class="menu-item-list" id="menu-list-biblia"><i class="fa-solid fa-book-open" style="color: #e879f9;"></i> Bíblia</div>`);
    }
    if (canShowListItem('textosBiblicos')) {
        blocos.push(`<div class="menu-item-list" id="menu-list-textos-biblicos"><i class="fa-solid fa-scroll" style="color: #8b5cf6;"></i> Textos Bíblicos</div>`);
    }
    if (canShowListItem('marcadores')) {
        blocos.push(`<div class="menu-item-list" id="menu-list-marcadores"><i class="fa-solid fa-bookmark" style="color: #ef4444;"></i> Marcadores</div>`);
    }
    if (blocos[blocos.length - 1] !== `<div class="menu-separador-list"></div>` && (canShowListItem('livros') || canShowListItem('cosmos'))) {
        blocos.push(`<div class="menu-separador-list"></div>`);
    }
    if (canShowListItem('livros')) {
        blocos.push(`<div class="menu-item-list" id="menu-list-livros"><i class="fa-solid fa-book" style="color: #60a5fa;"></i> Livros</div>`);
    }
    if (canShowListItem('cosmos')) {
        if (blocos[blocos.length - 1] !== `<div class="menu-separador-list"></div>` && canShowListItem('livros')) {
            blocos.push(`<div class="menu-separador-list"></div>`);
        }
        blocos.push(`<div class="menu-item-list" id="menu-list-cosmos"><i class="fa-solid fa-meteor" style="color: #d49d06;"></i> Cosmos</div>`);
    }
    if (canShowListItem('palco')) {
        if (blocos[blocos.length - 1] !== `<div class="menu-separador-list"></div>`) {
            blocos.push(`<div class="menu-separador-list"></div>`);
        }
        blocos.push(`<div class="menu-item-list" id="menu-list-palco" style="${window.__palcoNotificationHasItems ? 'color:#ef4444; font-weight:900;' : ''}"><i class="fa-solid fa-masks-theater" style="color: ${window.__palcoNotificationHasItems ? '#ef4444' : '#f97316'};"></i> Palco <span id="badge-list-palco" style="display:${window.__palcoNotificationHasItems ? 'inline-block' : 'none'}; margin-left:auto; width:8px; height:8px; border-radius:999px; background:#ef4444;"></span></div>`);
    }

    container.innerHTML = blocos.join('');
};

function vigiarPalcoPersistido() {
    if (!dbRef || !authRef?.currentUser) return;
    const q = query(collection(dbRef, "Palco"), where("userId", "==", authRef.currentUser.uid));
    onSnapshot(q, snap => {
        window.__palcoPersistedItems = snap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
    });
}

function vigiarNotificacoesPalco() {
    if (!dbRef || !authRef?.currentUser) return;
    if (unsubPalcoNotifications) unsubPalcoNotifications();
    const btnLists = Array.from(document.querySelectorAll('#left-buttons button'))
        .find(btn => btn.innerText.trim().toUpperCase() === 'LISTS');
    const q = query(
        collection(dbRef, "PalcoNotificacoes"),
        where("userId", "==", authRef.currentUser.uid),
        where("estado", "==", "on"),
        where("tipo", "==", "wishlist-oficial")
    );
    unsubPalcoNotifications = onSnapshot(q, snap => {
        const hasItems = !snap.empty;
        window.__palcoNotificationItems = snap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
        window.__palcoNotificationHasItems = hasItems;
        if (btnLists) {
            btnLists.style.color = hasItems ? "#ef4444" : "";
            btnLists.style.fontWeight = hasItems ? "900" : "";
        }
        const palcoMenuItem = document.getElementById('menu-list-palco');
        if (palcoMenuItem) {
            palcoMenuItem.style.color = hasItems ? "#ef4444" : "";
            palcoMenuItem.style.fontWeight = hasItems ? "900" : "";
            const icon = palcoMenuItem.querySelector('i');
            if (icon) icon.style.color = hasItems ? "#ef4444" : "#f97316";
        }
        const badge = document.getElementById('badge-list-palco');
        if (badge) badge.style.display = hasItems ? 'inline-block' : 'none';
    });
}
