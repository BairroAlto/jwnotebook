// components/biblioteca-brain/biblio-brain-ui.js
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { iniciarPuzzle, iniciarFontes, iniciarDossie, limparEngine } from '../brain-core/brain-engine.js';
import { verificarNovidadesSociais } from './biblio-social.js';

let abaAtiva = 'anotacoes';
let estudoAtual = null;

/**
 * GERE OS BOTÕES DE ACÇÃO NO TOPO (PÁGINA DINÂMICA)
 */
export function atualizarBotoesHeader() {
    const actionContainer = document.getElementById('biblio-header-action-container');
    if (!actionContainer) return;
    
    actionContainer.innerHTML = "";
    const btnStyle = `width: 28px; height: 28px; border-radius: 4px; border: none; color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 12px; transition: 0.2s;`;

    if (abaAtiva === 'puzzle') {
        const btn = document.createElement('button');
        btn.style.cssText = btnStyle + "background: #818cf8;";
        btn.innerHTML = '<i class="fa-solid fa-plus"></i>';
        btn.onclick = () => window.dispatchEvent(new CustomEvent('brain:adicionarTexto'));
        actionContainer.appendChild(btn);
    } 
    else if (abaAtiva === 'links') {
        const btn = document.createElement('button');
        btn.style.cssText = btnStyle + "background: #34d399;";
        btn.innerHTML = '<i class="fa-solid fa-link"></i>';
        btn.onclick = () => window.dispatchEvent(new CustomEvent('brain:abrirPopupFontes'));
        actionContainer.appendChild(btn);
    }
    else if (abaAtiva === 'dossie') {
        const isDentro = !!window.micaAtivaId;
        const btn = document.createElement('button');
        btn.style.cssText = btnStyle + `background: ${isDentro ? '#10b981' : '#f59e0b'};`;
        btn.innerHTML = `<i class="fa-solid ${isDentro ? 'fa-plus' : 'fa-folder-plus'}"></i>`;
        btn.onclick = () => window.dispatchEvent(new CustomEvent(isDentro ? 'brain:abrirReferenciaMica' : 'brain:abrirMicaPopup'));
        actionContainer.appendChild(btn);
    }
}

window.atualizarBotoesHeader = atualizarBotoesHeader;

/**
 * ORQUESTRADOR DE INTERFACE DA BIBLIOTECA (ABERTURA DE ESTUDO)
 */
export async function abrirEstudoNoBrain(estudo) {
    const refUnicaAtual = estudoAtual ? `${estudoAtual.id}-${estudoAtual.sequencia}` : "";
    const refUnicaNova = `${estudo.id}-${estudo.sequencia}`;

    if (refUnicaAtual === refUnicaNova) {
        console.log("🧊 [BRAIN] Parágrafo já em foco.");
        return; 
    }
    
    estudoAtual = estudo;
    const db = getFirestore();
    const auth = getAuth();

    if (window.switchPanel) window.switchPanel('brain');

    const mainContainer = document.getElementById('brain-resultado-pesquisa');
    if (!mainContainer) return;
    
    mainContainer.innerHTML = "";
    mainContainer.className = "cosmos-brain-wrapper";
    mainContainer.style.display = "flex";
    mainContainer.style.flexDirection = "column";
    mainContainer.style.height = "100%";
    mainContainer.style.overflow = "hidden"; 

    // --- CONSTRUÇÃO DO CABEÇALHO ---
    const headerBlock = document.createElement('div');
    headerBlock.style.cssText = "flex-shrink: 0; background: #1e293b; z-index: 10; border-bottom: 1px solid rgba(255,255,255,0.05);";
    
    headerBlock.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px 20px; gap: 15px;">
            <div style="display:flex; align-items:center; gap:10px; overflow:hidden; flex: 1;">
                <i class="fa-solid fa-book-bookmark" style="color: #818cf8; font-size: 16px; flex-shrink: 0;"></i>
                <span style="font-size: 13px; font-weight: 800; color: white; letter-spacing: 0.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; text-transform: uppercase; direction: rtl; text-align: left;">
                    &#x202a;${estudo.referencia}, ${estudo.oque} ${estudo.sequencia}&#x202c;
                </span>
            </div>
            <div style="display:flex; align-items:center; gap:12px; flex-shrink: 0;">
                <!-- ÍCONE PARABÓLICA -->
                <i class="fa-solid fa-satellite-dish" id="btn-sat-biblioteca"
                   style="color: #64748b; cursor:pointer; font-size: 16px;" title="Pesquisar no X-SAT"></i>
                
                <!-- 🚀 NOVO: ÍCONE BOOKAI (PONTE IA) -->
                <i class="fa-brands fa-mailchimp" id="btn-ai-biblioteca"
                   style="color: #64748b; cursor:pointer; font-size: 19px;" title="Analisar com BookAI"></i>
                
                <!-- CONTENTOR DE BOTÕES DINÂMICOS (+ / LINK / FOLDER) -->
                <div id="biblio-header-action-container" style="display: flex; align-items: center;"></div>
            </div>
        </div>

        <div class="cosmos-nav-icons" id="biblio-nav-container" style="display: flex; justify-content: space-around; align-items: center; padding: 10px; background: rgba(0,0,0,0.2);">
            <i class="fa-solid fa-pen-nib active" data-aba="anotacoes" title="Anotações"></i>
            <i class="fa-solid fa-puzzle-piece" data-aba="puzzle" title="Puzzle"></i>
            <i class="fa-solid fa-link" data-aba="links" title="Links e Codex"></i>
            <i class="fa-regular fa-folder-open" data-aba="dossie" title="Dossiê"></i>
            <div id="social-tab-wrapper" style="display: flex; align-items: center; justify-content: center; width: 32px; height: 32px;"></div>
        </div>
    `;

    const scrollArea = document.createElement('div');
    scrollArea.id = 'biblio-dynamic-content'; 
    scrollArea.className = "brain-scroll-area";
    scrollArea.style.cssText = "flex: 1; overflow-y: auto; padding: 15px 15px 100px 15px; scroll-behavior: smooth;";
    
    mainContainer.appendChild(headerBlock);
    mainContainer.appendChild(scrollArea);

    // --- LÓGICA DO SATÉLITE ---
    const btnSat = headerBlock.querySelector('#btn-sat-biblioteca');
    if (btnSat) {
        btnSat.onclick = async () => {
            btnSat.classList.add('fa-spin');
            let textoParaPesquisa = estudo.textoOriginal || await recuperarTextoDoRepositorio(estudo);
            if (textoParaPesquisa && typeof window.dispararPesquisaParabolica === 'function') {
                window.dispararPesquisaParabolica(textoParaPesquisa, false);
            }
            btnSat.classList.remove('fa-spin');
        };
    }

    // --- 🚀 LÓGICA DA PONTE BOOKAI ---
  const btnAI = headerBlock.querySelector('#btn-ai-biblioteca');
if (btnAI) {
    btnAI.onclick = async () => {
        btnAI.classList.add('fa-bounce');
        
        // 1. Capturar texto do parágrafo
        let textoParaIA = estudo.textoOriginal || await recuperarTextoDoRepositorio(estudo);
        
        if (textoParaIA) {
            // 2. CHAMADA AO NOVO MÓDULO DE PONTE
            import('../direita/ai-bridge-external.js').then(m => {
                m.AIBridge.iniciarAnaliseFonteExterna(
                    textoParaIA, 
                    `${estudo.referencia} §${estudo.sequencia}`
                );
            });
        }
        
        setTimeout(() => btnAI.classList.remove('fa-bounce'), 1000);
    };
    }

    // --- NAVEGAÇÃO DE ABAS ---
    const navContainer = headerBlock.querySelector('#biblio-nav-container');
    navContainer.onclick = (e) => {
        const icon = e.target.closest('i[data-aba]');
        if (!icon) return;

        navContainer.querySelectorAll('i[data-aba]').forEach(i => i.classList.remove('active'));
        icon.classList.add('active');
        abaAtiva = icon.dataset.aba;
        
        atualizarBotoesHeader();
        renderizarConteudoAba(scrollArea);
    };

    // Inicializar Vista Padrão
    abaAtiva = 'anotacoes';
    renderizarConteudoAba(scrollArea);
    atualizarBotoesHeader();

    // Radar Social
    if (auth.currentUser) {
        (async () => {
            const socialWrapper = headerBlock.querySelector('#social-tab-wrapper');
            try {
                const userSnap = await getDoc(doc(db, "users", auth.currentUser.uid));
                if (userSnap.exists() && userSnap.data().shareAnswers === "on") {
                    socialWrapper.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin" style="font-size: 14px; color: var(--primary); opacity: 0.6;"></i>`;
                    const temConteudo = await verificarNovidadesSociais(estudo);
                    socialWrapper.innerHTML = `<i class="fa-regular fa-comment-dots" data-aba="comentarios" title="Comentários" style="cursor:pointer;"></i>`;
                    if (temConteudo) socialWrapper.querySelector('i').style.color = "#fbbf24";
                }
            } catch (err) {}
        })();
    }
}

/**
 * RECUPERA O TEXTO DO REPOSITÓRIO (EVITA 404 E MATCH SEMÂNTICO)
 */
async function recuperarTextoDoRepositorio(estudo) {
    try {
        const pasta = (estudo.sigla === 'mwb') ? 'mwb' : (estudo.contexto === 'livro' ? 'livros' : 'w');
        const ano = estudo.ano;
        const mesPadded = String(estudo.mes || "").padStart(2, '0');
        let candidatos = [];
        if (estudo.contexto === 'livro') candidatos.push(`data/livros/${estudo.sigla}.json`);
        else if (estudo.contexto === 'multimedia') candidatos.push(`data/multimedia/${ano}/${estudo.multimediapath || estudo.mes}.json`);
        else {
            candidatos.push(`data/publicacoes/${pasta}/${ano}/${mesPadded}.json`);
            candidatos.push(`data/publicacoes/${pasta}/${ano}/${mesPadded}_01.json`);
            candidatos.push(`data/publicacoes/${pasta}/${ano}/${mesPadded}_15.json`);
        }
        let json = null;
        for (const url of candidatos) {
            const res = await fetch(url);
            if (res.ok) { json = await res.json(); break; }
        }
        if (!json) return null;
        const blocosPai = json.artigos || json.capitulos || (json.video ? [json.video] : []);
        const clean = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        const tituloProcurado = clean(estudo.artigo || estudo.titulo);
        const alvo = blocosPai.find(a => {
            if (estudo.contexto === 'livro') return String(a.capitulo) === String(estudo.capitulo);
            return clean(a.titulo).includes(tituloProcurado) || tituloProcurado.includes(clean(a.titulo));
        });
        if (!alvo) return null;
        const par = alvo.conteudo.find(c => String(c.numero_ref) === String(estudo.sequencia));
        return par ? par.texto : null;
    } catch (e) { return null; }
}

function renderizarConteudoAba(container) {
    const db = getFirestore();
    const auth = getAuth();
    container.innerHTML = "";
    limparEngine();
    switch (abaAtiva) {
        case 'anotacoes': import('./biblio-tabs.js').then(m => m.renderAnotacoes(estudoAtual, container, db)); break;
        case 'puzzle': iniciarPuzzle("Biblioteca", estudoAtual, container, db, auth); break;
        case 'links': iniciarFontes("Biblioteca", estudoAtual, container, db, auth); break;
        case 'dossie': iniciarDossie("Biblioteca", estudoAtual, container, db, auth); break;
        case 'comentarios': import('./biblio-tabs.js').then(m => m.renderComentarios(estudoAtual, container, db)); break;
    }
}
