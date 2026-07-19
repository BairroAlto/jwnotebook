// components/settings/recycle-ui.js
import { getFirestore, doc, updateDoc, deleteDoc, getDoc, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { RecycleViewer } from './recycle-viewer.js';
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js"; // Garante este import no topo

let cacheItensNaLixeira = [];


const db = getFirestore();

export function renderizarItensReciclagem(lista, isAutoOpen) {
    const container = document.getElementById('lista-reciclagem-expirada');
    const btnVazamento = document.getElementById('btn-vazamento-lixeira');
    
    if (!container) return;

    cacheItensNaLixeira = lista;

    // Mostrar ou esconder o botão no canto superior direito
    if (btnVazamento) {
        btnVazamento.style.display = (lista.length > 0) ? "flex" : "none";
        btnVazamento.style.alignItems = "center";
        btnVazamento.style.gap = "6px";
    }

    // 🚀 LIMPEZA: O container agora só tem os cards, o título já está fixo no HTML
    container.innerHTML = "";

    if (lista.length === 0) {
        container.innerHTML = `<p style="color:gray; text-align:center; padding:40px; opacity:0.5; font-size:12px;">A lixeira está vazia.</p>`;
        return;
    }


     const listaUrgente = lista.filter(i => i.expirado);
    const listaNormal = lista.filter(i => !i.expirado);

    // Renderizar apenas os grupos de cards
    if (listaUrgente.length > 0) {
        container.innerHTML += `
            <p style="font-size: 9px; color: #ef4444; font-weight: 800; text-transform: uppercase; margin-bottom: 10px;">Lixo Expirado (+90 dias)</p>
            ${listaUrgente.map(item => criarCardHTML(item)).join('')}
            <div style="height: 20px;"></div>
        `;
    }

    if (listaNormal.length > 0) {
        container.innerHTML += listaNormal.map(item => criarCardHTML(item)).join('');
    }
}



function criarCardHTML(item) {
    let nome = item.dados.nome || item.dados.titulo || "Sem Nome";
    let icone = "fa-file-lines";
    if (item.tipoItem === 'caixa') { icone = "fa-box"; nome += ` (em ${item.nomePai})`; }
    if (item.tipoItem === 'mica') { icone = "fa-folder-open"; nome += ` (Dossiê: ${item.nomePai})`; }
    if (item.tipoItem === 'cosmos-tema') icone = "fa-meteor";
    if (item.tipoItem === 'topico') icone = "fa-hashtag";

    // Codificação segura para evitar quebra de aspas no HTML
    const payload = btoa(unescape(encodeURIComponent(JSON.stringify(item))));
    const bordaColor = item.expirado ? "#ef4444" : "rgba(255,255,255,0.1)";

    return `
        <div class="menu-item-list" style="flex-direction: column; align-items: flex-start; gap: 10px; background: rgba(255,255,255,0.02); padding: 12px; border: 1px solid ${bordaColor}; border-radius: 10px; margin-bottom: 8px; position: relative;">
            
            <!-- 👁️ BOTÃO VER (Usando Classe em vez de Onclick) -->
            <i class="fa-solid fa-eye btn-ver-reciclagem" 
               data-payload="${payload}"
               style="position: absolute; top: 12px; right: 12px; cursor: pointer; color: var(--text-muted); opacity: 0.6;"
               title="Ver Conteúdo"></i>

            <div style="width:100%; display:flex; justify-content:space-between; align-items:center; padding-right: 25px;">
                <div style="display:flex; align-items:center; gap:10px;">
                    <i class="fa-solid ${icone}" style="color:var(--primary); font-size:12px;"></i>
                    <span style="font-size:13px; font-weight:700; color:white;">${nome}</span>
                </div>
                <span style="font-size:8px; font-weight:900; opacity:0.3;">${item.tipoItem.toUpperCase()}</span>
            </div>
            
            <div style="display:flex; gap:5px; width:100%;">
                <button onclick="window.execRecuperar('${item.id}', '${item.idSub || ''}', '${item.tipoItem}')" style="flex:1; background:#22c55e; color:black; border:none; padding:8px; border-radius:5px; font-size:10px; font-weight:800; cursor:pointer;">RECUPERAR</button>
                <button onclick="window.execEliminar('${item.id}', '${item.idSub || ''}', '${item.tipoItem}')" style="flex:1; background:rgba(239, 68, 68, 0.1); color:#f87171; border:1px solid #ef4444; padding:8px; border-radius:5px; font-size:10px; font-weight:800; cursor:pointer;">ELIMINAR</button>
            </div>
        </div>
    `;
}

// ==========================================================
// 🚀 O SEGREDO: GESTOR DE CLIQUES CENTRALIZADO
// ==========================================================
document.addEventListener('click', (e) => {
    const btnVer = e.target.closest('.btn-ver-reciclagem');
    if (btnVer) {
        e.stopPropagation();
        try {
            const base64 = btnVer.dataset.payload;
            const item = JSON.parse(decodeURIComponent(escape(atob(base64))));
            RecycleViewer.abrir(item);
        } catch (err) {
            console.error("Erro ao decodificar item da lixeira:", err);
        }
    }
});

/**
 * ACÇÕES DE RECUPERAÇÃO E ELIMINAÇÃO
 */
window.execRecuperar = async (docId, subId, tipo) => {
    const colecao = (tipo === 'cosmos-tema' || tipo === 'mica') ? "Cosmo" : (tipo === 'topico' ? "Topico" : "Local");
    const docRef = doc(db, colecao, docId);
    try {
        if (subId) {
            const snap = await getDoc(docRef);
            if (tipo === 'mica') {
                await updateDoc(docRef, { [`Dossie.mica.${subId}.estado`]: "on", [`Dossie.mica.${subId}.timedelete`]: null });
            } else {
                const novas = snap.data().caixas.map(c => c.id === subId ? {...c, estado:"on", timedelete: null} : c);
                await updateDoc(docRef, { caixas: novas });
            }
        } else {
            await updateDoc(docRef, { estado: (colecao === "Local" ? "on" : "on"), timedelete: null });
        }
        location.reload(); 
    } catch (e) { console.error(e); }
};

window.execEliminar = async (docId, subId, tipo) => {
    // 1. CONFIRMAÇÃO VISUAL (Podes usar o teu popup-blackbox aqui se quiseres)
    if (!confirm("Esta ação é irreversível. O item será eliminado. Continuar?")) return;

    const colecaoOriginal = (tipo === 'cosmos-tema' || tipo === 'mica') ? "Cosmo" : (tipo === 'topico' ? "Topico" : "Local");
    const docRef = doc(db, colecaoOriginal, docId);

    try {
        const snap = await getDoc(docRef);
        if (!snap.exists()) return;

        const dadosCompletos = snap.data();
        let dadosParaOArquivo = null;

        // 2. PREPARAR DADOS PARA A BLACKBOX
        if (subId) {
            // Cenário: Eliminando uma Caixa ou uma Mica específica
            if (tipo === 'mica') {
                dadosParaOArquivo = { 
                    ...dadosCompletos.Dossie.mica[subId], 
                    _meta_origem: `Mica de ${dadosCompletos.nome || 'Tema'}` 
                };
            } else {
                const caixaAlvo = dadosCompletos.caixas.find(c => c.id === subId);
                dadosParaOArquivo = { 
                    ...caixaAlvo, 
                    _meta_origem: `Bloco da nota ${dadosCompletos.nome}` 
                };
            }
        } else {
            // Cenário: Eliminando a Nota ou Tema inteiro
            dadosParaOArquivo = { 
                ...dadosCompletos, 
                _meta_origem: `Documento Integral (${colecaoOriginal})` 
            };
        }

        // 3. ENVIAR PARA A BLACKBOX (Backup de Segurança)
        await addDoc(collection(db, "Blackbox"), {
            ...dadosParaOArquivo,
            deletedAt: serverTimestamp(),
            originalId: docId,
            originalCollection: colecaoOriginal,
            tipoItem: tipo,
            userId: dadosCompletos.userId
        });

        console.log("🚀 [BLACKBOX] Cópia de segurança criada com sucesso.");

        // 4. ELIMINAÇÃO REAL (Limpando o sistema)
        if (subId) {
            if (tipo === 'mica') {
                const micas = { ...dadosCompletos.Dossie.mica };
                delete micas[subId];
                await updateDoc(docRef, { "Dossie.mica": micas });
            } else {
                const novasCaixas = dadosCompletos.caixas.filter(c => c.id !== subId);
                await updateDoc(docRef, { caixas: novasCaixas });
            }
        } else {
            await deleteDoc(docRef);
        }

        console.log("🗑️ [SISTEMA] Item removido da coleção ativa.");
        location.reload(); 

    } catch (e) {
        console.error("❌ Erro no processo de eliminação:", e);
        alert("Erro ao processar eliminação. Verifica a tua ligação.");
    }
};

/**
 * 🚀 MOTOR DE ELIMINAÇÃO EM MASSA (LIMPEZA TOTAL)
 */
window.execApagarTudo = async () => {
    if (cacheItensNaLixeira.length === 0) return;

    const total = cacheItensNaLixeira.length;
    const confirmou = await confirmarAcaoGeral(
        "Vazar Lixeira?", 
        `Desejas mover todos os ${total} itens para o arquivo morto (Blackbox)? Esta ação não pode ser desfeita.`
    );

    if (!confirmou) return;

    const btn = document.getElementById('btn-vazamento-lixeira');
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> A PROCESSAR...`;

    console.group(`🗑️ [MASS-DELETE] Iniciando limpeza de ${total} itens`);

    try {
        // Processamos todos os itens em paralelo para ser instantâneo
        const promessas = cacheItensNaLixeira.map(item => processarEliminacaoSilenciosa(item));
        await Promise.all(promessas);

        console.log("✅ [MASS-DELETE] Lixeira limpa e Blackbox alimentada.");
        location.reload(); // Atualiza para limpar o ecrã e as listas

    } catch (e) {
        console.error("Erro na limpeza em massa:", e);
        alert("Ocorreu um erro ao limpar alguns itens.");
        btn.disabled = false;
        btn.innerHTML = `<i class="fa-solid fa-dumpster-fire"></i> APAGAR TUDO`;
    }
    console.groupEnd();
};

/**
 * AUXILIAR: Faz o backup e apaga sem dar refresh na página (para loops)
 */
async function processarEliminacaoSilenciosa(item) {
    const auth = getAuth();
    const meuUid = auth.currentUser ? auth.currentUser.uid : null;

    if (!meuUid) {
        console.error("❌ [RECYCLE] Utilizador não autenticado para realizar limpeza.");
        return;
    }

    const colecaoOriginal = (item.tipoItem === 'cosmos-tema' || item.tipoItem === 'mica') ? "Cosmo" : (item.tipoItem === 'topico' ? "Topico" : "Local");
    const docRef = doc(db, colecaoOriginal, item.id);

    try {
        // 1. Obter dados atuais do servidor
        const snap = await getDoc(docRef);
        if (!snap.exists()) return;
        const dadosDoc = snap.data();

        let payloadBlackbox = null;

        // 2. Extrair o conteúdo correto para o backup
        if (item.idSub) {
            // Cenário: Caixa de Nota ou Mica de Dossiê
            if (item.tipoItem === 'mica') {
                payloadBlackbox = { ...(dadosDoc.Dossie?.mica[item.idSub] || {}), _meta_origem: "Mica" };
                const micas = { ...dadosDoc.Dossie.mica }; 
                delete micas[item.idSub];
                await updateDoc(docRef, { "Dossie.mica": micas });
            } else {
                const caixaAlvo = (dadosDoc.caixas || []).find(c => c.id === item.idSub);
                payloadBlackbox = { ...(caixaAlvo || {}), _meta_origem: "Bloco" };
                const novas = dadosDoc.caixas.filter(c => c.id !== item.idSub);
                await updateDoc(docRef, { caixas: novas });
            }
        } else {
            // Cenário: Nota, Tema ou Tópico Integral
            payloadBlackbox = { ...dadosDoc, _meta_origem: "Documento" };
            await deleteDoc(docRef);
        }

        // 3. GRAVAR NA BLACKBOX (Com verificação de userId)
        // 🚀 O SEGREDO: Se dadosDoc.userId for undefined, usa o meuUid. Nunca envia undefined.
        await addDoc(collection(db, "Blackbox"), {
            ...payloadBlackbox,
            deletedAt: serverTimestamp(),
            originalCollection: colecaoOriginal,
            tipoItem: item.tipoItem,
            userId: dadosDoc.userId || meuUid 
        });

    } catch (err) {
        console.error(`❌ [RECYCLE] Erro ao processar item ${item.id}:`, err);
    }
}

/**
 * PROMISE: Popup de confirmação reutilizável
 */
function confirmarAcaoGeral(titulo, mensagem) {
    return new Promise((resolve) => {
        const overlay = document.getElementById('popup-confirmar-remover-overlay');
        const btnSim = document.getElementById('btn-confirmar-remover-final');
        const btnNao = document.getElementById('btn-cancelar-remover');

        if (!overlay) return resolve(confirm(mensagem));

        overlay.querySelector('h3').innerText = titulo;
        overlay.querySelector('p').innerText = mensagem;
        btnSim.innerText = "SIM, APAGAR TUDO";
        
        overlay.classList.add('active');

        const fechar = (r) => {
            overlay.classList.remove('active');
            btnSim.onclick = null;
            resolve(r);
        };

        btnSim.onclick = () => fechar(true);
        btnNao.onclick = () => fechar(false);
    });
}
