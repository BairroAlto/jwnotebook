// components/topico-brain/topico-fontes.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { firebaseConfig } from '../../firebase-config.js';
import { HandlerLinks } from './topico-fontes-links.js';
import { HandlerCodex } from './topico-fontes-codex.js';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
let subtopicoAtual = null;
let abaAtiva = "links";

export async function abrirSubtopicoNasFontes(subtopico) {
    console.log("🟢 [PASSO 1] abrirSubtopicoNasFontes chamado para:", subtopico.nome);
    if (!subtopico.docIdFirebase && subtopico.docId) subtopico.docIdFirebase = subtopico.docId;
    subtopicoAtual = subtopico;
    if (window.switchEyeTab) window.switchEyeTab('fontes');
    const container = document.getElementById('textos-container'); 
    if (!container) return console.error("❌ Erro: textos-container não existe!");
    container.style.display = 'flex';
    renderizarLayoutBase(container);
}

function renderizarLayoutBase(container) {
    console.log("🟢 [PASSO 2] renderizarLayoutBase. Aba ativa:", abaAtiva);
    container.innerHTML = `
        <div style="padding: 15px 10px 10px 10px; background: var(--bg-panel); position: sticky; top: 0; z-index: 10;">
            <div style="display:flex; gap:8px; background: rgba(0,0,0,0.2); padding: 4px; border-radius: 8px; margin-bottom: 12px;">
                <button id="btn-f-links-eye" class="btn-amt ${abaAtiva === 'links' ? 'active' : ''}" style="flex:1; height: 32px;">Links</button>
                <button id="btn-f-codex-eye" class="btn-amt ${abaAtiva === 'codex' ? 'active' : ''}" style="flex:1; height: 32px;">Codex</button>
            </div>
            <button id="btn-add-fonte-eye" style="width: 100%; padding: 10px; background: rgba(99, 102, 241, 0.05); border: 1px dashed var(--primary); color: var(--primary); border-radius: 8px; cursor: pointer; font-weight: 700; font-size: 11px; display: flex; align-items: center; justify-content: center; gap: 8px;">
                <i class="fa-solid fa-plus"></i> ADICIONAR <span id="label-add-eye">${abaAtiva.toUpperCase()}</span>
            </button>
        </div>
        <div id="fontes-display-list-eye" style="flex: 1; overflow-y: auto; padding: 10px; display: flex; flex-direction: column; gap: 10px;"></div>
    `;

    // Teste de clique direto no botão
    const btnAdd = document.getElementById('btn-add-fonte-eye');
    console.log("🟢 [PASSO 3] Botão adicionar encontrado no DOM?", btnAdd ? "SIM" : "NÃO");

    btnAdd.onclick = () => {
        console.log("🚩 [CLIQUE] Botão ADICIONAR clicado com sucesso!");
        if (abaAtiva === "links") HandlerLinks.adicionar(subtopicoAtual, atualizarTudo);
        else {
            console.log("🚩 [ENCAMINHAR] Chamando HandlerCodex.adicionar...");
            HandlerCodex.adicionar(subtopicoAtual, atualizarTudo);
        }
    };

    document.getElementById('btn-f-links-eye').onclick = () => { abaAtiva = "links"; renderizarLayoutBase(container); };
    document.getElementById('btn-f-codex-eye').onclick = () => { abaAtiva = "codex"; renderizarLayoutBase(container); };

    if (abaAtiva === "links") HandlerLinks.render(subtopicoAtual, 'fontes-display-list-eye', atualizarTudo);
    else HandlerCodex.render(subtopicoAtual, 'fontes-display-list-eye', atualizarTudo);
}

async function atualizarTudo() {
    console.log("💾 [GRAVAR] A enviar para o Firebase...");
    await updateDoc(doc(db, "Topico", subtopicoAtual.docIdFirebase), {
        referencias: subtopicoAtual.referencias || [],
        codex: subtopicoAtual.codex || []
    });
    renderizarLayoutBase(document.getElementById('textos-container'));
}