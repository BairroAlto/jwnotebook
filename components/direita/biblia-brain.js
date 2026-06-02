// components/direita/biblia-brain.js
import { query, collection, where, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { VERSOES_BIBLIA } from '../lists/repositorio-data.js';
import { renderizarPuzzleBiblia, limparPuzzleBiblia } from './biblia-puzzle.js';
import { renderizarFontesBiblia, limparFontesBiblia, abrirPopupFontesBiblia } from './biblia-fontes.js';
import { renderizarDossieBiblia, limparDossieBiblia, abrirPopupMica, abrirPopupRefApta } from './biblia-dossie.js';
import { abrirPopupMarcadores } from './biblia-marcador.js';

let versiculoAtivoMemoria = null;
let abaAtivaBiblia = 'puzzle'; 
let unsubStatusMarcador = null;

export function abrirVersiculoNoBrain(livro, cap, ver, texto, db, auth) {
    if (typeof window.switchPanel === 'function') window.switchPanel('brain');

    const container = document.getElementById('brain-resultado-pesquisa');
    if (!container) return;

    const globalTabs = document.getElementById('sub-tabs-brain');
    if (globalTabs) globalTabs.style.display = 'none';

   versiculoAtivoMemoria = { livro, cap, ver, texto };

    container.innerHTML = "";
    container.className = "cosmos-brain-wrapper"; 

    const stickyHeader = document.createElement('div');
    stickyHeader.className = "cosmos-sticky-header";
    stickyHeader.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 20px; background: #1e293b; border-bottom: 1px solid rgba(255,255,255,0.05); gap: 15px;">
            <div style="display:flex; align-items:center; gap:10px; overflow: hidden; flex: 1;">
                <i class="fa-solid fa-book-bible" style="color: #818cf8; font-size: 16px; flex-shrink: 0;"></i>
                <span style="font-size: 13px; font-weight: 800; color: white; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; letter-spacing: 0.5px;">
                    ${livro} ${cap}:${ver}
                </span>
            </div>

            <div style="display:flex; align-items:center; gap:15px; flex-shrink: 0;">
                <!-- 🚀 SUBSTITUÍDO: WOL pela PONTE BOOKAI -->
                <i class="fa-brands fa-mailchimp" id="btn-ai-biblia-brain"
                   style="color: #64748b; cursor:pointer; font-size: 18px;" title="Analisar com BookAI"></i>
                
                <i class="fa-regular fa-bookmark" id="icon-marcador-biblia" style="color: #64748b; cursor:pointer; font-size: 16px;" title="Marcadores"></i>
                
                <div id="header-action-biblia" style="display: flex; align-items: center;"></div>
            </div>
        </div>

 <div class="cosmos-nav-icons" style="display: flex; justify-content: space-around; align-items: center; padding: 10px 10px; border-bottom: 1px solid rgba(255,255,255,0.05); background: var(--bg-panel);">
             <i class="fa-solid fa-puzzle-piece" data-aba="puzzle" title="Anotações"></i>
            <i class="fa-solid fa-link" data-aba="links" title="Links"></i>
            <i class="fa-regular fa-folder-open" data-aba="dossie" title="Dossiê"></i>
            <i class="fa-solid fa-quote-left" data-aba="cita" title="Versões"></i>
        </div>
    `;

    const contentArea = document.createElement('div');
    contentArea.id = 'biblia-dynamic-content';
    contentArea.className = "brain-scroll-area";
    contentArea.style.padding = "15px";

    container.appendChild(stickyHeader);
    container.appendChild(contentArea);

     // --- 🚀 LÓGICA DE SALTO PARA IA ---
 const btnAI = stickyHeader.querySelector('#btn-ai-biblia-brain');
if (btnAI) {
    btnAI.onclick = () => {
        btnAI.classList.add('fa-bounce');
        
        // 1. Identificar o versículo e o texto que estão na memória do Brain
        const referencia = `${versiculoAtivoMemoria.livro} ${versiculoAtivoMemoria.cap}:${versiculoAtivoMemoria.ver}`;
        const textoVersiculo = versiculoAtivoMemoria.texto;

        // 2. Chamar a ponte externa (AI-BRIDGE)
        import('./ai-bridge-external.js').then(m => {
            m.AIBridge.iniciarAnaliseFonteExterna(textoVersiculo, referencia);
        });
        
        setTimeout(() => btnAI.classList.remove('fa-bounce'), 1000);
    };
}

    /**
     * ATUALIZAR BOTÃO DE AÇÃO (AGORA COM SÍMBOLOS)
     */
const atualizarBotaoAcao = (dentroDeMica = false) => {
    const btnCont = document.getElementById('header-action-biblia');
    if (!btnCont) return;

    const btnStyle = `width: 28px; height: 28px; border-radius: 4px; border: none; color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 12px; transition: 0.2s;`;
    
    if (abaAtivaBiblia === 'puzzle') {
        // Sem onclick. O index.html deteta o ícone fa-plus.
        btnCont.innerHTML = `<button style="${btnStyle} background:#818cf8;" title="Adicionar Texto"><i class="fa-solid fa-plus"></i></button>`;
    } 
    else if (abaAtivaBiblia === 'links') {
        btnCont.innerHTML = `<button style="${btnStyle} background:#34d399;" title="Adicionar Fontes"><i class="fa-solid fa-link"></i></button>`;
    } 
    else if (abaAtivaBiblia === 'dossie') {
        const cor = dentroDeMica ? "#10b981" : "#f59e0b";
        const icon = dentroDeMica ? "fa-plus" : "fa-folder-plus";
        btnCont.innerHTML = `<button style="${btnStyle} background:${cor};"><i class="fa-solid ${icon}"></i></button>`;
        
        // Mantemos os onclicks que abrem popups simples, pois não conflituam com o Puzzle
        btnCont.querySelector('button').onclick = () => {
            if (dentroDeMica) abrirPopupRefApta(currentDb);
            else abrirPopupMica(currentDb, currentAuth);
        };
    }
    else {
        btnCont.innerHTML = "";
    }
};



    /**
     * VIGIAR STATUS DO MARCADOR
     */
 const vigiarStatusMarcador = () => {
    if(unsubStatusMarcador) unsubStatusMarcador();
    
    const uid = auth.currentUser.uid;
    const nomeBusca = `${livro} ${cap}:${ver}`;
    
    const q = query(
        collection(db, "TextosBiblia"), 
        where("userId", "==", uid), 
        where("nome", "==", nomeBusca)
    );

    unsubStatusMarcador = onSnapshot(q, (snapshot) => {
        const icon = document.getElementById('icon-marcador-biblia');
        if (!icon) return;

        // Se o documento existe e o campo marcador é "sim"
        const isMarcado = !snapshot.empty && snapshot.docs[0].data().marcador === "sim";

        if (isMarcado) {
            console.log("📌 Versículo marcado!");
            icon.className = "fa-solid fa-bookmark"; // Ícone preenchido
            icon.style.color = "#ef4444";           // Cor vermelha
        } else {
            icon.className = "fa-regular fa-bookmark"; // Ícone contorno
            icon.style.color = "#64748b";             // Cor cinza original
        }
    });
};

    document.getElementById('icon-marcador-biblia').onclick = () => abrirPopupMarcadores(versiculoAtivoMemoria, db, auth);

    const icons = stickyHeader.querySelectorAll('.cosmos-nav-icons i');
    icons.forEach(icon => {
        icon.onclick = () => {
            icons.forEach(i => i.classList.remove('active'));
            icon.classList.add('active');
            abaAtivaBiblia = icon.dataset.aba;
            atualizarBotaoAcao();
            renderizarConteudoGeral(contentArea, db, auth, atualizarBotaoAcao);
        };
    });

    vigiarStatusMarcador();
    const iconPadrao = Array.from(icons).find(i => i.dataset.aba === abaAtivaBiblia) || icons[0];
    iconPadrao.click();
}

/**
 * RENDERIZADOR DE CONTEÚDO
 */
async function renderizarConteudoGeral(container, db, auth, callbackBotao) {
    container.innerHTML = "";
    limparPuzzleBiblia();
    limparFontesBiblia();
    limparDossieBiblia();

    if (abaAtivaBiblia === 'puzzle') {
        renderizarPuzzleBiblia(versiculoAtivoMemoria, container, db, auth);
    } 
    else if (abaAtivaBiblia === 'links') {
        renderizarFontesBiblia(versiculoAtivoMemoria, container, db, auth);
    }
    else if (abaAtivaBiblia === 'dossie') {
        renderizarDossieBiblia(versiculoAtivoMemoria, container, db, auth, (isMicaAberta) => {
            callbackBotao(isMicaAberta);
        });
    }
    else if (abaAtivaBiblia === 'cita') {
        container.innerHTML = `<div style="text-align:center; padding:20px; opacity:0.5;"><i class="fa-solid fa-circle-notch fa-spin"></i></div>`;
        await renderizarVersoesComparadas(container);
    }
}

/**
 * VERSÕES BÍBLICAS
 */
async function renderizarVersoesComparadas(container) {
    const { livro, cap, ver, texto } = versiculoAtivoMemoria;
    const slug = livro.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '_');
    let htmlFinal = "";

    for (const versao of VERSOES_BIBLIA) {
        let textoVersao = "";
        if (versao.id === 'nwtsty') textoVersao = texto;
        else {
            try {
                const response = await fetch(`data/biblias/${versao.id}/${slug}.json`);
                if (response.ok) {
                    const data = await response.json();
                    const chaveLivro = Object.keys(data)[0]; 
                    textoVersao = data[chaveLivro][cap][ver];
                } else continue;
            } catch (e) { continue; }
        }
        htmlFinal += `
            <div style="margin-bottom: 20px; animation: fadeIn 0.3s ease;">
                <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
                    <div style="width:3px; height:14px; background:${versao.cor}; border-radius:10px;"></div>
                    <span style="font-size:10px; font-weight:800; color:${versao.cor}; text-transform:uppercase; letter-spacing:0.5px;">${versao.nome}</span>
                </div>
                <div style="background: rgba(255,255,255,0.02); padding: 12px 15px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.03);">
                    <p style="font-size: 13.5px; color: #cbd5e1; line-height: 1.6; margin:0;">${textoVersao}</p>
                </div>
            </div>`;
    }
    container.innerHTML = htmlFinal || "<p style='text-align:center; color:gray; font-size:11px;'>Nenhuma versão adicional.</p>";
}

export function mostrarBrainIdle() {
    const container = document.getElementById('brain-resultado-pesquisa');
    const groupTabs = document.getElementById('sub-tabs-brain');

    if (groupTabs) groupTabs.style.display = 'none'; // Esconde os botões cinzentos
    
    container.innerHTML = `
        <div class="brain-idle-wrapper">
            <div class="brain-animation-container">
                <i class="fa-solid fa-brain brain-main-icon"></i>
                <div class="node n1"></div>
                <div class="node n2"></div>
                <div class="node n3"></div>
                <div class="node n4"></div>
                <div class="node n5"></div>
            </div>
            <p>O cérebro está pronto.<br>Selecione um tema ou versículo para conectar.</p>
        </div>
    `;
}
