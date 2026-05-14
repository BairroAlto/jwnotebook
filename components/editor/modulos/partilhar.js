// components/editor/modulos/partilhar.js
import { 
    getFirestore, collection, getDocs, query, where, doc, getDoc, updateDoc, or, and 
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

let caixaAtual = null;
let notaAtualId = null;
let callbackGravar = null;
let abaPartilhaAtiva = "Local"; 

/**
 * 1. FUNÇÕES GLOBAIS DE INTERFACE
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

/**
 * 2. INICIALIZAÇÃO
 */
export function iniciarSistemaPartilha(db, auth) {
    // Configuração do Toggle de Proteção
    const toggleInput = document.getElementById('toggle-protecao');
    if (toggleInput) {
        toggleInput.onchange = (e) => {
            if (!caixaAtual) return;
            const novoEstado = e.target.checked ? "aberto" : "fechado";
            caixaAtual.protecao = novoEstado;
            console.log(`🔒 [SISTEMA] Proteção alterada para: ${novoEstado}`);
            if (typeof callbackGravar === 'function') callbackGravar();
        };
    }
}

/**
 * 3. ABRIR O POPUP (Lógica de Visibilidade aqui)
 */
export async function abrirPopupPartilhar(caixa, notaId, callbackUpdate) {
    // Captura o ID da nota (prioridade para o ID enviado, senão usa o global do sistema)
    const idReal = notaId || window.notaAbertaId;
    
    console.log("🔍 [DEBUG] A abrir Partilha:", { idReal, caixaId: caixa?.id });

    if (!idReal || !caixa) {
        console.error("❌ Erro ao abrir partilha: ID da nota ou Caixa ausentes.");
        return;
    }

    // ATRIBUIÇÃO CRUCIAL (O que estava a falhar)
    caixaAtual = caixa;
    notaAtualId = idReal;
    callbackGravar = callbackUpdate;
    abaPartilhaAtiva = "Local"; 

    const overlay = document.getElementById('popup-partilhar-overlay');
    if (!overlay) return;

    // Sincronizar o Toggle de Proteção com o estado real da caixa
    const toggleInput = document.getElementById('toggle-protecao');
    if (toggleInput) toggleInput.checked = (caixa.protecao === "aberto");

    // Reset Visual das Abas
    document.querySelectorAll('.tab-partilha').forEach(b => {
        const target = b.getAttribute('data-target') || b.dataset.origem;
        b.classList.toggle('active', target === 'Local');
    });

    overlay.classList.add('active');
    carregarDadosParaAlvo();
}


/**
 * 4. CARREGAR LISTA DE DESTINOS
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
            q = query(collection(db, "Local"), where("userId", "==", uid), where("estado", "==", "ativa"));
        } else {
            q = query(collection(db, "Share"), and(
                where("estado", "==", "ativo"),
                or(where("userId", "==", uid), where("aprovado", "array-contains", uid))
            ));
        }

        const snapshot = await getDocs(q);
        const todosItensStandard = [];

        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            
            // --- NORMALIZAÇÃO DA LOCALIZAÇÃO ---
            // Se for Local, o pai está em .pastapai. 
            // Se for Share, o pai está em .[meuUid].pastapai
            let paiReal = "";
            if (abaPartilhaAtiva === "Local") {
                paiReal = data.pastapai || "root";
            } else {
                paiReal = (data[uid] && data[uid].pastapai) ? data[uid].pastapai : "home";
            }

            todosItensStandard.push({
                docIdFirebase: docSnap.id,
                nome: data.nome,
                tipo: data.tipo,
                ordem: data.ordem || 0,
                paiCalculado: paiReal // Campo único para a árvore usar
            });
        });

        container.innerHTML = "";
        
        // Identificar a pasta pai da nota atual para saber o que expandir
        const notaAtualNoSnapshot = todosItensStandard.find(i => i.docIdFirebase === notaAtualId);
        const pastaParaAbrir = notaAtualNoSnapshot ? notaAtualNoSnapshot.paiCalculado : null;

        // Definir o ID da raiz conforme a aba
        const idRaiz = (abaPartilhaAtiva === "Local") ? "root" : "home";
        
        // Chamar a construção da árvore usando o campo normalizado
        renderizarNivelArvore(container, todosItensStandard, idRaiz, pastaParaAbrir);

        if (container.innerHTML === "") {
            container.innerHTML = `<p style="text-align:center; color:gray; font-size:11px; padding:20px;">Vazio no ${abaPartilhaAtiva}.</p>`;
        }

    } catch (e) {
        console.error("Erro ao gerar árvore:", e);
        container.innerHTML = "Erro ao carregar.";
    }
}

/**
 * FUNÇÃO RECURSIVA PARA DESENHAR A ÁRVORE
 */
function renderizarNivelArvore(container, listaCompleta, paiId, abrirPastaId) {
    // Filtramos usando o paiCalculado que criámos na normalização
    const itensNivel = listaCompleta.filter(i => i.paiCalculado === paiId).sort((a,b) => a.ordem - b.ordem);

    itensNivel.forEach(item => {
        if (item.docIdFirebase === notaAtualId) return;

        const wrapper = document.createElement('div');
        wrapper.style.marginBottom = "2px";

        if (item.tipo === "pasta") {
            const isAberta = (item.docIdFirebase === abrirPastaId);
            
            wrapper.innerHTML = `
                <div class="tree-item tree-folder-header" onclick="window.togglePastaPartilha(this)">
                    <i class="fa-solid ${isAberta ? 'fa-chevron-down' : 'fa-chevron-right'}" style="width: 10px; font-size: 8px;"></i>
                    <i class="fa-solid fa-folder" style="color: #eab308; opacity: 0.7;"></i>
                    <span>${item.nome}</span>
                </div>
                <div class="tree-folder-content ${isAberta ? 'open' : ''}" id="cont-${item.docIdFirebase}">
                </div>
            `;
            container.appendChild(wrapper);
            
            const subContainer = wrapper.querySelector('.tree-folder-content');
            // Recursividade passa o ID real do documento como pai para a próxima volta
            renderizarNivelArvore(subContainer, listaCompleta, item.docIdFirebase, abrirPastaId);
            
            if (subContainer.innerHTML === "") {
                const icon = wrapper.querySelector('.fa-chevron-right, .fa-chevron-down');
                if (icon) icon.style.visibility = 'hidden';
            }
        } else {
            const corNota = (abaPartilhaAtiva === "Local") ? "var(--primary)" : "#ef4444";
            wrapper.innerHTML = `
                <div class="tree-item" onclick="window.confirmarEnvioPartilha('${item.docIdFirebase}', '${item.nome.replace(/'/g, "\\'")}', '${abaPartilhaAtiva}')">
                    <i class="fa-solid fa-file-lines" style="color: ${corNota}; font-size: 13px;"></i>
                    <span style="font-size: 13px; color: white;">${item.nome}</span>
                </div>
            `;
            container.appendChild(wrapper);
        }
    });
}


/**
 * 5. ENVIAR CÓPIA
 */
async function enviarCopiaParaNota(idDestino, nomeDestino, abaAlvo) {
    const db = getFirestore();
    const colecaoDestino = (abaAlvo === "Share") ? "Share" : "Local";

    try {
        const docDestRef = doc(db, colecaoDestino, idDestino);
        const snapDest = await getDoc(docDestRef);

        if (snapDest.exists()) {
            const dataDest = snapDest.data();
            let caixasDest = dataDest.caixas || [];
            
            // --- REPARAÇÃO DO OBJETO PARA O ÍNDICE ---
            // Criamos uma cópia limpa e injetamos os campos obrigatórios do Editor
            let novaCopia = JSON.parse(JSON.stringify(caixaAtual));
            
            novaCopia.id = crypto.randomUUID(); // Novo ID para não colidir
            novaCopia.estado = "ativa";        // <--- OBRIGATÓRIO PARA O ÍNDICE VER
            novaCopia.origem = "copia";
            novaCopia.timestamp = new Date().toISOString();
            
            // Garantir que campos de texto não vêm nulos
            if (!novaCopia.titulo) novaCopia.titulo = "";
            if (!novaCopia.conteudo) novaCopia.conteudo = "";

            // Determinar ordem (colocar no topo ou fim)
            const modosDest = Array.isArray(dataDest.modo) ? dataDest.modo : [dataDest.modo || 'normal'];
            if (modosDest.includes('post')) {
                caixasDest.unshift(novaCopia);
            } else {
                caixasDest.push(novaCopia);
            }

            // Re-indexar para o Firebase não se perder
            caixasDest.forEach((c, i) => { c.ordem = i + 1; });

            // Gravar no destino
            await updateDoc(docDestRef, { caixas: caixasDest });
            
            console.log("✅ Caixa enviada com sucesso e ativada para o Índice.");
            
            if (window.fecharPopupPartilhar) window.fecharPopupPartilhar();
        }
    } catch (e) {
        console.error("Erro ao clonar para nota:", e);
    }
}


/**
 * 6. POPUP DE CONFIRMAÇÃO
 */
function perguntarConfirmacaoEnvio(nomeNota) {
    return new Promise((resolve) => {
        const overlay = document.getElementById('popup-confirmar-envio-overlay');
        const btnSim = document.getElementById('btn-confirmar-envio');
        const btnNao = document.getElementById('btn-cancelar-envio');
        const texto = document.getElementById('texto-confirmar-envio');

        texto.innerHTML = `Desejas enviar uma cópia desta secção para <br><b>"${nomeNota}"</b>?`;
        overlay.classList.add('active');

        const fechar = (resposta) => {
            overlay.classList.remove('active');
            btnSim.onclick = null;
            btnNao.onclick = null;
            resolve(resposta);
        };
        btnSim.onclick = () => fechar(true);
        btnNao.onclick = () => fechar(false);
    });
}

/**
 * FUNÇÕES GLOBAIS DE INTERFACE
 */
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
    // Aqui enviamos 'aba' que será recebido como 'abaAlvo' na função acima
    enviarCopiaParaNota(id, nome, aba);
};