// components/share/gestao-itens-share.js
import { 
    getFirestore, doc, updateDoc, getDoc, collection, query, 
    where, getDocs, addDoc, deleteDoc, serverTimestamp, or, and 
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

let itemAlvo = null; 
let listaParaReordenar = [];

/**
 * 1. MENU PRINCIPAL: GERIR NOTA/PASTA SHARE
 */
window.abrirGestaoItemShare = async (id, tipo, nome) => {
    const db = getFirestore();
    const auth = getAuth();
    const uid = auth.currentUser.uid;
    const overlay = document.getElementById('popup-gestao-item-overlay');

    try {
        const snap = await getDoc(doc(db, "Share", id));
        if (!snap.exists()) return;

        const dadosFirestore = snap.data();
        itemAlvo = { id, tipo, ...dadosFirestore };

        // 1. CONFIGURAÇÃO VISUAL BÁSICA
        document.getElementById('gestao-item-titulo').innerText = `Gerir ${tipo === 'pasta' ? 'Pasta' : 'Nota'} Share`;
        const inputNome = document.getElementById('input-gestao-nome');
        inputNome.value = itemAlvo.nome;

        // ========================================================
        // 🚀 REGRA DE SEGURANÇA: VERIFICAR SE É O DONO
        // ========================================================
        const btnOcultar = document.getElementById('btn-gestao-ocultar');
        const souDono = (itemAlvo.userId === uid);

        if (btnOcultar) {
            // Se eu for o dono, o botão aparece (flex). Se não for, fica invisível (none).
            btnOcultar.style.display = souDono ? 'flex' : 'none';
        }

        // --- Resto da configuração dos botões ---
        const btnTop = document.getElementById('btn-gestao-top');
        const btnPin = document.getElementById('btn-gestao-pin');
        btnTop.style.display = 'flex';

        // Sincronizar estados visuais
        const dadosPrivados = itemAlvo[uid] || {};
        const isTopAtivo = dadosPrivados.Top?.estado === "on";
        btnTop.classList.toggle('pin-ativo', isTopAtivo);
        btnPin.classList.toggle('pin-ativo', itemAlvo.pin === "sim");

        // ========================================================
        // 2. ATRIBUIR LÓGICAS AOS BOTÕES (Isolamento Share)
        // ========================================================

        // --- BOTÃO TOP (PRIVADO DO UTILIZADOR) ---
        btnTop.onclick = async (e) => {
            e.stopPropagation();
            btnTop.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';
            const novoEstado = isTopAtivo ? "off" : "on";

            try {
                await updateDoc(doc(db, "Share", id), {
                    [`${uid}.Top`]: { estado: novoEstado, ordem: 1 }
                });
                overlay.classList.remove('active');
                console.log("✅ Top Privado gravado no Share.");
            } catch (err) { console.error(err); btnTop.innerHTML = 'TOP'; }
        };

        // --- BOTÃO PIN (ATALHO SINCRONIZADO) ---
btnPin.onclick = async (e) => {
    e.stopPropagation();
    
    // 1. Determinar estado baseado na memória ATUAL
    const isPinAtivo = (itemAlvo.pin === "sim");
    const novoEstadoPin = isPinAtivo ? "nao" : "sim";

    console.log(`🚀 [SHARE-PIN] Botão clicado. Transição: ${itemAlvo.pin} -> ${novoEstadoPin}`);

    // 2. ATUALIZAR MEMÓRIA LOCAL IMEDIATAMENTE (O segredo para o próximo clique funcionar)
    itemAlvo.pin = novoEstadoPin; 
    
    // 3. ATUALIZAR INTERFACE (Feedback visual)
    btnPin.classList.toggle('pin-ativo', novoEstadoPin === "sim");

    try {
        // 4. Gravar no Firestore (Documento da Nota)
        await updateDoc(doc(db, "Share", id), { pin: novoEstadoPin });
        console.log("✅ [SHARE-PIN] Campo 'pin' atualizado no documento Share.");

        // 5. Sincronizar com a coleção 'Atalho' (Aba Pins)
        const acao = novoEstadoPin === "sim" ? "adicionar" : "remover";
        console.log(`📤 [SHARE-PIN] A disparar gerirAtalhoFirebase: ${acao}`);
        
        await gerirAtalhoFirebase(db, uid, {id: id, nome: itemAlvo.nome, tipo: itemAlvo.tipo}, "Share", acao);

    } catch (err) { 
        console.error("❌ [SHARE-PIN] Erro crítico:", err); 
        // Reverter em caso de erro
        itemAlvo.pin = isPinAtivo ? "sim" : "nao";
        btnPin.classList.toggle('pin-ativo', isPinAtivo);
    }
};

        // --- BOTÃO MOVER (ÁRVORE SHARE) ---
        document.getElementById('btn-gestao-mover').onclick = (e) => {
            e.stopPropagation();
            overlay.classList.remove('active');
            window.abrirMotorMoverShare(); 
        };

        // --- BOTÃO ORDEM (SETAS SHARE) ---
        document.getElementById('btn-gestao-ordenar').onclick = (e) => {
            e.stopPropagation();
            overlay.classList.remove('active');
            window.abrirPopupOrdenacaoShare();
        };

        // --- BOTÃO OCULTAR (LIXEIRA SHARE) ---
        document.getElementById('btn-gestao-ocultar').onclick = (e) => {
    e.stopPropagation();
    if (itemAlvo.userId !== uid) return alert("Apenas o dono pode ocultar esta nota.");
    
    overlay.classList.remove('active');
    document.getElementById('popup-confirmar-ocultar-item').classList.add('active');

   const btnFinal = document.getElementById('btn-confirmar-ocultar-final');
if (btnFinal) {
    btnFinal.onclick = async () => {
        const db = getFirestore();
        const uid = getAuth().currentUser.uid;
        const timestamp = new Date().toISOString();

        try {
            await updateDoc(doc(db, "Share", itemAlvo.id), { 
                estado: "off", 
                timedelete: timestamp 
            });

            if (itemAlvo.tipo === "pasta") {
                await ocultarConteudoRecursivoShare(db, itemAlvo.id, uid, timestamp);
            }

            location.reload();
        } catch (err) {
            console.error(err);
        }
    };
}
};

        // --- BOTÃO GRAVAR (SALVAR NOME) ---
        document.getElementById('btn-salvar-gestao-item').onclick = async (e) => {
            e.stopPropagation();
            const novoNome = inputNome.value.trim();
            if (!novoNome) return;
            await updateDoc(doc(db, "Share", id), { nome: novoNome });
            overlay.classList.remove('active');
        };

        overlay.classList.add('active');

    } catch (e) { console.error("Erro ao abrir gestão share:", e); }
};

/**
 * 2. MOTOR DE MOVIMENTAÇÃO (CORREÇÃO DO ERRO FIREBASE)
 */
window.abrirMotorMoverShare = async () => {
    const overlay = document.getElementById('popup-mover-item-overlay');
    const container = document.getElementById('arvore-mover-local');
    const btnConfirmar = document.getElementById('btn-confirmar-movimentacao');
    
    overlay.classList.add('active');
    container.innerHTML = `<div style="padding:20px; text-align:center;"><i class="fa-solid fa-circle-notch fa-spin" style="color:#ef4444;"></i></div>`;

    const db = getFirestore();
    const uid = getAuth().currentUser.uid;

    try {
        // CORREÇÃO: Envolver os filtros num and(...) para evitar o erro InvalidQuery
        const q = query(
            collection(db, "Share"), 
            and(
                where("estado", "==", "on"),
                where("tipo", "==", "pasta"),
                or(where("userId", "==", uid), where("aprovado", "array-contains", uid))
            )
        );

        const snap = await getDocs(q);
        const pastasParaArvore = [];
        snap.forEach(d => pastasParaArvore.push({ id: d.id, ...d.data() }));

        container.innerHTML = "";
        container.appendChild(criarItemPastaShare("home", "SHARE (RAIZ)", 0));
        renderizarNivelPastasShare(container, pastasParaArvore, "home", 1, uid);

        btnConfirmar.onclick = () => executarMudancaPastaShare(db, uid);
    } catch (e) { console.error("Erro na Árvore:", e); }
};

// ... Funções auxiliares da árvore (renderizarNivelPastasShare, criarItemPastaShare, executarMudancaPastaShare) ...
function renderizarNivelPastasShare(container, lista, paiId, level, uid) {
    const filhas = lista.filter(p => p[uid]?.pastapai === paiId && p.id !== itemAlvo.id);
    filhas.forEach(p => {
        container.appendChild(criarItemPastaShare(p.id, p.nome, level));
        renderizarNivelPastasShare(container, lista, p.id, level + 1, uid);
    });
}

function criarItemPastaShare(id, nome, level) {
    const div = document.createElement('div');
    div.className = "tree-item-pasta-select";
    div.style.cssText = `padding: 10px 10px 10px ${level * 15 + 10}px; cursor: pointer; border-radius: 6px; display: flex; align-items: center; gap: 10px; color:white;`;
    div.innerHTML = `<i class="fa-solid fa-folder" style="color: #fca5a5; opacity: 0.7;"></i> <span style="font-size:13px;">${nome}</span>`;
    div.onclick = () => {
        document.querySelectorAll('.tree-item-pasta-select').forEach(el => el.style.background = "transparent");
        div.style.background = "rgba(239, 68, 68, 0.2)";
        window.pastaDestinoShareId = id;
        document.getElementById('nome-pasta-selecionada').innerText = nome;
        document.getElementById('btn-confirmar-movimentacao').disabled = false;
        document.getElementById('btn-confirmar-movimentacao').style.opacity = "1";
    };
    return div;
}

async function executarMudancaPastaShare(db, uid) {
    if (!window.pastaDestinoShareId || !itemAlvo) return;
    await updateDoc(doc(db, "Share", itemAlvo.id), { [`${uid}.pastapai`]: window.pastaDestinoShareId });
    document.getElementById('popup-mover-item-overlay').classList.remove('active');
}

/**
 * 3. MOTOR DE ORDENAÇÃO (COM DESTAQUE VISUAL)
 */
window.abrirPopupOrdenacaoShare = async () => {
    const overlay = document.getElementById('popup-ordenar-itens-overlay');
    const container = document.getElementById('lista-reordenar-container');
    const db = getFirestore();
    const uid = getAuth().currentUser.uid;
    const pastaPaiAtual = itemAlvo[uid]?.pastapai || "home";

    overlay.classList.add('active');
    container.innerHTML = `<div style="text-align:center; padding:20px;"><i class="fa-solid fa-circle-notch fa-spin" style="color:#ef4444;"></i></div>`;

    try {
        const q = query(
            collection(db, "Share"),
            and(
                where("estado", "==", "on"),
                or(where("userId", "==", uid), where("aprovado", "array-contains", uid))
            )
        );

        const snap = await getDocs(q);
        listaParaReordenar = [];
        snap.forEach(d => {
            const data = d.data();
            if (data[uid]?.pastapai === pastaPaiAtual) {
                listaParaReordenar.push({ docId: d.id, ...data });
            }
        });

        listaParaReordenar.sort((a, b) => (a[uid]?.ordem || 99) - (b[uid]?.ordem || 99));
        renderizarListaOrdemShare(uid);
    } catch (e) { console.error("Erro na Ordem:", e); }
};

function renderizarListaOrdemShare(uid) {
    const container = document.getElementById('lista-reordenar-container');
    container.innerHTML = "";

    listaParaReordenar.forEach((item, index) => {
        // --- DESTAQUE VISUAL AQUI ---
        const estaSendoGerido = (item.docId === itemAlvo.id);
        
        const div = document.createElement('div');
        div.style.cssText = `
            display: flex; 
            justify-content: space-between; 
            align-items: center; 
            padding: 12px 15px; 
            background: ${estaSendoGerido ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255,255,255,0.03)'}; 
            border: 1px solid ${estaSendoGerido ? '#ef4444' : 'rgba(255,255,255,0.05)'}; 
            border-radius: 10px; 
            margin-bottom: 6px;
            transition: 0.2s;
        `;

        div.innerHTML = `
            <div style="display:flex; align-items:center; gap:10px; overflow:hidden;">
                ${estaSendoGerido ? '<i class="fa-solid fa-star" style="color:#ef4444; font-size:10px;"></i>' : ''}
                <span style="font-size:13px; color:${estaSendoGerido ? 'white' : '#94a3b8'}; font-weight:${estaSendoGerido ? '700' : '400'}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                    ${item.nome}
                </span>
            </div>
            <div style="display:flex; gap:15px; color:#ef4444; font-size:16px;">
                <i class="fa-solid fa-circle-chevron-up" onclick="window.moverOrdemShare(${index}, -1)" style="cursor:pointer; opacity: 0.8;"></i>
                <i class="fa-solid fa-circle-chevron-down" onclick="window.moverOrdemShare(${index}, 1)" style="cursor:pointer; opacity: 0.8;"></i>
            </div>`;
        container.appendChild(div);
    });
}

window.moverOrdemShare = async (index, dir) => {
    const target = index + dir;
    if (target < 0 || target >= listaParaReordenar.length) return;
    
    [listaParaReordenar[index], listaParaReordenar[target]] = [listaParaReordenar[target], listaParaReordenar[index]];
    
    const db = getFirestore();
    const uid = getAuth().currentUser.uid;
    
    // Atualizar UI imediatamente
    renderizarListaOrdemShare(uid);

    // Gravar no Firebase
    for (let i = 0; i < listaParaReordenar.length; i++) {
        await updateDoc(doc(db, "Share", listaParaReordenar[i].docId), { 
            [`${uid}.ordem`]: i + 1 
        });
    }
};

/**
 * HELPER: GESTÃO DA COLECÇÃO ATALHO (ADICIONADA PARA NOTAS SHARE)
 */
async function gerirAtalhoFirebase(db, uid, item, ondeAlvo, acao) {
    const atalhosRef = collection(db, "Atalho");
    console.log(`📡 [ATALHO-SHARE] Iniciando operação: ${acao.toUpperCase()}`);

    if (acao === "adicionar") {
        try {
            const qOrdem = query(atalhosRef, where("userId", "==", uid));
            const snapOrdem = await getDocs(qOrdem);
            
            const dadosFinal = {
                userId: uid, 
                itemId: item.id, 
                nome: item.nome, 
                tipo: item.tipo, 
                onde: ondeAlvo, // Aqui será "Share"
                timestamp: serverTimestamp(), 
                ordem: snapOrdem.size + 1
            };

            console.log("📤 [ATALHO-SHARE] Gravando na coleção 'Atalho'...");
            const docRef = await addDoc(atalhosRef, dadosFinal);
            console.log("✅ [ATALHO-SHARE] PIN Gravado com ID:", docRef.id);

        } catch (error) {
            console.error("❌ [ATALHO-SHARE] Erro ao gravar PIN:", error);
        }
    } else {
        // REMOVER
        console.log(`🗑️ [ATALHO-SHARE] Removendo item ${item.id} da coleção 'Atalho'...`);
        try {
            const qRem = query(atalhosRef, where("userId", "==", uid), where("itemId", "==", item.id));
            const snapRem = await getDocs(qRem);
            
            snapRem.forEach(async (d) => {
                await deleteDoc(doc(db, "Atalho", d.id));
                console.log("✅ [ATALHO-SHARE] PIN removido com sucesso.");
            });
        } catch (error) {
            console.error("❌ [ATALHO-SHARE] Erro ao remover PIN:", error);
        }
    }
}

/**
 * Função Auxiliar: Procura e desativa todos os filhos no Share
 */
async function ocultarConteudoRecursivoShare(db, pastaId, uid, timestamp) {
    // No Share, procuramos pelo campo dinâmico: [uid].pastapai
    const q = query(collection(db, "Share"), where(`${uid}.pastapai`, "==", pastaId));
    const snap = await getDocs(q);

    for (const docSnap of snap.docs) {
        // No Share, ocultar para um oculta para todos (regra de Dono)
        await updateDoc(docSnap.ref, { 
            estado: "off", 
            timedelete: timestamp 
        });

        if (docSnap.data().tipo === "pasta") {
            await ocultarConteudoRecursivoShare(db, docSnap.id, uid, timestamp);
        }
    }
}
