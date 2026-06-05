// components/direita/cosmos-brain.js
import { doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { renderizarPuzzle, limparPuzzle } from './cosmos-puzzle.js';
import { renderizarFontes, limparFontes } from './cosmos-fontes.js';
import { abrirPopupAncoras } from './cosmos-ancora.js';

// --- ESTADO PERSISTENTE DO MÓDULO ---
let temaIdAbertoAtualmente = null;
let abaAtivaMemoria = 'puzzle'; 
let micaAtivaId = null; 
let unsubStatusAncora = null;

/**
 * ORQUESTRADOR DO PAINEL BRAIN PARA O SISTEMA COSMOS
 */
// components/direita/cosmos-brain.js

export function abrirTemaNoBrain(tema, db, auth) {
    // 1. IDENTIFICAR SE O TEMA JÁ ESTÁ ABERTO (Prevenir saltos e resets)
    const jaEstouNesteTema = (temaIdAbertoAtualmente === tema.id);
    temaIdAbertoAtualmente = tema.id;

    if (typeof window.switchPanel === 'function') window.switchPanel('brain');

    const container = document.getElementById('brain-resultado-pesquisa');
    const globalBrainTabs = document.getElementById('sub-tabs-brain'); 

    if (!container) return;

    // 2. CONSTRUÇÃO DA ESTRUTURA FIXA (Apenas se trocarmos de Tema)
    if (!jaEstouNesteTema) {
        console.log("🏗️ [COSMOS-BRAIN] Construindo interface fixa para:", tema.nome);
        
        // Reset de estado visual e funcional
        abaAtivaMemoria = 'puzzle'; // Começar sempre no Puzzle ao mudar de tema
        if (globalBrainTabs) globalBrainTabs.style.display = 'none';
        if (unsubStatusAncora) unsubStatusAncora();

        limparPuzzle();
        limparFontes();
        
        container.innerHTML = "";
        container.className = "cosmos-brain-wrapper"; 

        // Injetar Header e Navegação de Ícones
        const stickyHeader = document.createElement('div');
        stickyHeader.className = "cosmos-sticky-header";
        stickyHeader.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 20px; background: #1e293b; border-bottom: 1px solid rgba(255,255,255,0.05); gap: 15px;">
                <div style="display:flex; align-items:center; gap:10px; overflow: hidden; flex: 1;">
                    <i class="fa-solid fa-${tema.simbolo || 'cat'}" style="color: #818cf8; font-size: 16px; flex-shrink: 0;"></i>
                    <span id="cosmos-titulo-txt" style="font-size: 13px; font-weight: 800; color: white; letter-spacing: 0.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; text-transform: uppercase;">
                        ${tema.nome}
                    </span>
                </div>
                <div style="display:flex; align-items:center; gap:15px; flex-shrink: 0;">
                    <i class="fa-solid fa-magnifying-glass btn-wol-search" style="color: #64748b; cursor:pointer; font-size: 16px;" title="Pesquisar na WOL"></i>
                    <i class="fa-solid fa-anchor btn-ancora-trigger" id="header-icon-ancora" style="color: #64748b; cursor:pointer; font-size: 16px;" title="Âncora"></i>
                    <div id="header-action-container" style="display: flex; align-items: center;"></div>
                </div>
            </div>
            <div class="cosmos-nav-icons" style="display: flex; justify-content: space-around; align-items: center; padding: 10px 10px; border-bottom: 1px solid rgba(255,255,255,0.05); background: var(--bg-panel);">
                <i class="fa-solid fa-puzzle-piece" data-aba="puzzle" title="Puzzle"></i>
                <i class="fa-solid fa-link" data-aba="links" title="Links e Codex"></i>
                <i class="fa-regular fa-folder-open" data-aba="dossie" title="Dossiê"></i>
            </div>
        `;

        const contentArea = document.createElement('div');
        contentArea.id = 'cosmos-dynamic-content';
        contentArea.className = "brain-scroll-area";

        container.appendChild(stickyHeader);
        container.appendChild(contentArea);

        // --- Configurar Eventos do Header ---
        stickyHeader.querySelector('.btn-ancora-trigger').onclick = () => abrirPopupAncoras(tema, db, auth);
        stickyHeader.querySelector('.btn-wol-search').onclick = () => window.open(`https://wol.jw.org/pt/wol/s/r5/lp-t?q=${encodeURIComponent(tema.nome)}`, '_blank');

        // --- Configurar Troca de Abas via Ícones ---
        const icons = stickyHeader.querySelectorAll('.cosmos-nav-icons i');
        icons.forEach(icon => {
            icon.onclick = () => {
                icons.forEach(i => i.classList.remove('active'));
                icon.classList.add('active');
                abaAtivaMemoria = icon.dataset.aba; 
                executarTrocaDeAba(tema, db, auth);
            };
        });

        // --- Escuta Live do Status da Âncora ---
        const temaRef = doc(db, "Cosmo", tema.docIdFirebase);
        unsubStatusAncora = onSnapshot(temaRef, (docSnap) => {
            if (!docSnap.exists()) return;
            const iconA = document.getElementById('header-icon-ancora');
            if (iconA) {
                const isAncorado = docSnap.data().ancora === "sim";
                iconA.style.color = isAncorado ? "#60a5fa" : "#64748b";
                iconA.style.filter = isAncorado ? "drop-shadow(0 0 5px rgba(96, 165, 250, 0.4))" : "none";
            }
        });

        // Clicar na aba inicial por defeito
        const iconeAlvo = Array.from(icons).find(i => i.dataset.aba === abaAtivaMemoria) || icons[0];
        iconeAlvo.click();

    } else {
        // SE JÁ ESTOU NO TEMA: Apenas atualizo o conteúdo dinâmico (Sincronização In Live)
        // Sem reconstruir o Header, os ícones mantêm a classe 'active' correta.
        executarTrocaDeAba(tema, db, auth);
    }
}

/**
 * EXECUTA A RENDERIZAÇÃO DO CONTEÚDO DA ABA SELECIONADA
 */
function executarTrocaDeAba(tema, db, auth) {
    const contentArea = document.getElementById('cosmos-dynamic-content');
    if (!contentArea) return;

    // --- 1. LIMPEZA OBRIGATÓRIA DO CONTEÚDO ANTERIOR ---
    contentArea.innerHTML = ""; 
    
    atualizarBotaoAcaoLateral();

    // --- 2. GESTÃO DE MEMÓRIA E LISTENERS ---
    // Limpamos os módulos que não estão ativos para evitar conflitos
    if (abaAtivaMemoria !== 'puzzle') limparPuzzle();
    if (abaAtivaMemoria !== 'links') limparFontes();
    if (abaAtivaMemoria !== 'dossie') {
        // Importante: Importar o dossie apenas para o limpar caso ele tenha listeners ativos
        import('./cosmos-dossie.js').then(m => m.limparDossie());
    }

    // --- 3. DISPARAR O RENDERIZADOR CORRETO ---
    if (abaAtivaMemoria === 'puzzle') {
        console.log("🧩 Renderizando Puzzle...");
        renderizarPuzzle(tema, contentArea, db, auth);
    } 
    else if (abaAtivaMemoria === 'links') {
        console.log("🔗 Renderizando Links...");
        renderizarFontes(tema, contentArea, db, auth);
    } 
    else if (abaAtivaMemoria === 'dossie') {
        console.log("📂 Renderizando Dossiê...");
        import('./cosmos-dossie.js').then(m => m.renderizarDossie(tema, contentArea, db, auth, (id) => { 
            micaAtivaId = id; 
            atualizarBotaoAcaoLateral(); 
        }));
    }
}

/**
 * GERE O BOTÃO DE AÇÃO (+, LINK, ETC) NO TOPO DIREITO
 */
function atualizarBotaoAcaoLateral() {
    const actionContainer = document.getElementById('header-action-container');
    if (!actionContainer) return;
    
    // Limpar o botão anterior
    actionContainer.innerHTML = "";

    // Estilo base CSS para consistência visual
    const btnStyle = `width: 28px; height: 28px; border-radius: 4px; border: none; color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 12px; transition: 0.2s;`;

    // --- ABA: PUZZLE ---
    if (abaAtivaMemoria === 'puzzle') {
        actionContainer.innerHTML = `<button style="${btnStyle} background:#818cf8;" title="Adicionar Texto"><i class="fa-solid fa-plus"></i></button>`;
        actionContainer.querySelector('button').onclick = (e) => {
            e.stopPropagation();
            // Dispara sinal para o cosmos-puzzle.js criar uma nova caixa de texto
            window.dispatchEvent(new CustomEvent('cosmos:adicionarTexto'));
        };
    } 
    // --- ABA: LINKS ---
    else if (abaAtivaMemoria === 'links') {
        actionContainer.innerHTML = `<button style="${btnStyle} background:#34d399;" title="Adicionar Fontes"><i class="fa-solid fa-link"></i></button>`;
        actionContainer.querySelector('button').onclick = (e) => {
            e.stopPropagation();
            // Importa e abre o popup de configuração de links
            import('./cosmos-fontes.js').then(m => m.abrirPopupFontes());
        };
    }
    // --- ABA: DOSSIÊ ---
    else if (abaAtivaMemoria === 'dossie') {
        // Se micaAtivaId é null, estamos na raiz (Nova Pasta). Se tem valor, estamos dentro de uma pasta (Adicionar Ref).
        const cor = micaAtivaId ? "#10b981" : "#f59e0b"; // Verde vs Laranja
        const icon = micaAtivaId ? "fa-plus" : "fa-folder-plus";
        const label = micaAtivaId ? "Adicionar Referência" : "Nova Mica";

        actionContainer.innerHTML = `<button style="${btnStyle} background:${cor};" title="${label}"><i class="fa-solid ${icon}"></i></button>`;
        
        actionContainer.querySelector('button').onclick = (e) => {
            e.stopPropagation();
            if (!micaAtivaId) {
                // Dispara sinal para o cosmos-dossie.js abrir o popup de nova pasta (Mica)
                window.dispatchEvent(new CustomEvent('cosmos:abrirMicaPopup'));
            } else {
                // Dispara sinal para o cosmos-dossie.js abrir o seletor de Caixas/Bíblia
                window.dispatchEvent(new CustomEvent('cosmos:abrirRefPopup'));
            }
        };
    }
}


export function fecharTemaCosmos() {
    temaIdAbertoAtualmente = null;
    abaAtivaMemoria = 'puzzle';
    micaAtivaId = null;
}