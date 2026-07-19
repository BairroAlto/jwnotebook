// components/editor/modulos/partilhar.js
import { 
    getFirestore, collection, getDocs, query, where, doc, getDoc, updateDoc, or, and 
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { dispararIndexacao } from './ai-search-indexer.js'; // 🚀 GATILHO GPS INTEGRADO

let caixaAtual = null;
let notaAtualId = null;
let callbackGravar = null;
let abaPartilhaAtiva = "Local"; 

/**
 * 1. FUNÇÕES GLOBAIS DE INTERFACE (WINDOW)
 */
window.trocarAbaPartilha = (elemento, origem) => {
    abaPartilhaAtiva = origem;
    document.querySelectorAll('.tab-partilha').forEach(btn => btn.classList.remove('active'));
    elemento.classList.add('active');
    carregarDadosParaAlvo();
};

window.fecharPopupPartilhar = () => {
    const overlay = document.getElementById('popup-partilhar-overlay');
    if (overlay) overlay.classList.remove('active');
};

window.togglePastaPartilha = (elemento) => {
    const content = elemento.nextElementSibling;
    const icon = elemento.querySelector('i:first-child');
    const isOpen = content.classList.toggle('open');
    if (isOpen) {
        icon.classList.replace('fa-chevron-right', 'fa-chevron-down');
    } else {
        icon.classList.replace('fa-chevron-down', 'fa-chevron-right');
    }
};

window.confirmarEnvioPartilha = (id, nome, aba) => {
    enviarCopiaParaNota(id, nome, aba);
};

/**
 * 2. INICIALIZAÇÃO DO MOTOR
 */
export function iniciarSistemaPartilha(db, auth, callbackUpdate) {
    const toggleInput = document.getElementById('toggle-protecao');
    if (toggleInput) {
        toggleInput.onchange = (e) => {
            if (!caixaAtual) return;
            const novoEstado = e.target.checked ? "aberto" : "fechado";
            caixaAtual.protecao = novoEstado;
            if (typeof callbackGravar === 'function') callbackGravar();
        };
    }
}

/**
 * 3. ABERTURA DO POPUP
 */
export async function abrirPopupPartilhar(caixa, notaId, callbackUpdate) {
    const idReal = notaId || window.notaAbertaId;
    
    if (!idReal || !caixa) {
        console.error("❌ Erro ao abrir partilha: ID da nota ou Caixa ausentes.");
        return;
    }

    caixaAtual = caixa;
    notaAtualId = idReal;
    callbackGravar = callbackUpdate;
    abaPartilhaAtiva = "Local"; 

    const overlay = document.getElementById('popup-partilhar-overlay');
    if (!overlay) return;

    const toggleInput = document.getElementById('toggle-protecao');
    if (toggleInput) toggleInput.checked = (caixa.protecao === "aberto");

    overlay.classList.add('active');
    carregarDadosParaAlvo();
}

/**
 * 4. CARREGAR LISTA DE DESTINOS (LOCAL E SHARE)
 */
async function carregarDadosParaAlvo() {
    const container = document.getElementById('arvore-partilha');
    if (!container) return;

    container.innerHTML = `<div style="text-align:center; padding:30px;"><i class="fa-solid fa-circle-notch fa-spin" style="color:var(--primary);"></i></div>`;

    const db = getFirestore();
    const auth = getAuth();
    const uid = auth.currentUser?.uid;

    if (!uid) return;

    try {
        let q;
        if (abaPartilhaAtiva === "Local") {
            q = query(collection(db, "Local"), where("userId", "==", uid), where("estado", "==", "on"));
        } else {
            q = query(collection(db, "Share"), and(
                where("estado", "==", "on"),
                or(where("userId", "==", uid), where("aprovado", "array-contains", uid))
            ));
        }

        const snapshot = await getDocs(q);
        const todosItens = [];

        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            let paiReal = (abaPartilhaAtiva === "Local") ? (data.pastapai || "root") : (data[uid]?.pastapai || "home");

            todosItens.push({
                docIdFirebase: docSnap.id,
                nome: data.nome,
                tipo: data.tipo,
                ordem: data.ordem || 0,
                paiCalculado: paiReal
            });
        });

        container.innerHTML = "";
        const idRaiz = (abaPartilhaAtiva === "Local") ? "root" : "home";
        renderizarNivelArvore(container, todosItens, idRaiz);

        if (container.innerHTML === "") {
            container.innerHTML = `<p style="text-align:center; color:gray; font-size:11px; padding:20px;">Vazio no ${abaPartilhaAtiva}.</p>`;
        }
    } catch (e) {
        console.error("Erro ao gerar árvore:", e);
        container.innerHTML = "Erro ao carregar.";
    }
}

/**
 * 5. RENDERIZADOR RECURSIVO DA ÁRVORE
 */
function renderizarNivelArvore(container, listaCompleta, paiId) {
    const itensNivel = listaCompleta.filter(i => i.paiCalculado === paiId).sort((a,b) => a.ordem - b.ordem);

    itensNivel.forEach(item => {
        if (item.docIdFirebase === notaAtualId) return;

        const wrapper = document.createElement('div');
        wrapper.style.marginBottom = "2px";

        if (item.tipo === "pasta") {
            wrapper.innerHTML = `
                <div class="tree-item tree-folder-header" onclick="window.togglePastaPartilha(this)">
                    <i class="fa-solid fa-chevron-right" style="width: 10px; font-size: 8px;"></i>
                    <i class="fa-solid fa-folder" style="color: #eab308; opacity: 0.7;"></i>
                    <span>${item.nome}</span>
                </div>
                <div class="tree-folder-content" id="cont-${item.docIdFirebase}"></div>
            `;
            container.appendChild(wrapper);
            const subContainer = wrapper.querySelector('.tree-folder-content');
            renderizarNivelArvore(subContainer, listaCompleta, item.docIdFirebase);
        } else {
            wrapper.innerHTML = `
                <div class="tree-item" onclick="window.confirmarEnvioPartilha('${item.docIdFirebase}', '${item.nome.replace(/'/g, "\\'")}', '${abaPartilhaAtiva}')">
                    <i class="fa-solid fa-file-lines" style="color: ${abaPartilhaAtiva === 'Local' ? 'var(--primary)' : '#ef4444'}; font-size: 13px;"></i>
                    <span style="font-size: 13px; color: white;">${item.nome}</span>
                </div>
            `;
            container.appendChild(wrapper);
        }
    });
}

/**
 * 6. MOTOR DE CLONAGEM (AÇÃO FINAL COM ATUALIZAÇÃO DE ÍNDICE)
 */
async function enviarCopiaParaNota(idDestino, nomeDestino, abaAlvo) {
    const db = getFirestore();
    const auth = getAuth();
    const colecaoDestino = (abaAlvo === "Share") ? "Share" : "Local";

    try {
        const docDestRef = doc(db, colecaoDestino, idDestino);
        const snapDest = await getDoc(docDestRef);

        if (snapDest.exists()) {
            const dataDest = snapDest.data();
            let caixasDest = dataDest.caixas || [];
            
            // 1. CRIAR CLONE DA CAIXA
            let novaCopia = JSON.parse(JSON.stringify(caixaAtual));
            novaCopia.id = crypto.randomUUID();
            novaCopia.estado = "on";
            novaCopia.origem = "copia";
            novaCopia.timestamp = new Date().toISOString();
            
            // ========================================================
            // 🚀 CORREÇÃO: SEMPRE USAR PUSH
            // Para ser a "mais recente", ela deve ir para o fim do array.
            // O renderizador (Modo Post) colocará o número maior no topo.
            // ========================================================
            caixasDest.push(novaCopia); 

            // 2. RE-INDEXAR ORDENS (Garante que a nova caixa tem o maior número)
            caixasDest.forEach((c, i) => { 
                c.ordem = i + 1; 
            });

            // 3. GRAVAR
            await updateDoc(docDestRef, { caixas: caixasDest });

            // 4. ATUALIZAR GPS
            dispararIndexacao(db, auth.currentUser.uid, idDestino, {
                nome: dataDest.nome,
                caixas: caixasDest,
                vincTopicos: dataDest.vincTopicos || []
            });

            console.log(`✅ [SISTEMA] Bloco enviado. Ordem da nova caixa: ${caixasDest.length}`);
            window.fecharPopupPartilhar();
        }
    } catch (e) {
        console.error("❌ Erro:", e);
        alert("Erro ao processar partilha.");
    }
}
