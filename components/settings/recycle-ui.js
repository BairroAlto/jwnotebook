import { COLECAO_CAIXAS, obterIdsCaixas, obterCaixasPorIds, apagarCaixaLocal } from '../local/caixas-repository.js';
import { COLECAO_CAIXAS_SHARE, obterIdsCaixasShare, obterCaixasSharePorIds, apagarCaixaShare } from '../share/share-caixas-repository.js';
// components/settings/recycle-ui.js
import { getFirestore, doc, updateDoc, deleteDoc, getDoc, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { RecycleViewer } from './recycle-viewer.js';
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js"; // Garante este import no topo
import { obterParCaixa, eliminarParCaixa, restaurarParCaixa } from './recycle-caixa-pair.js';

let cacheItensNaLixeira = [];


const db = getFirestore();

export function renderizarItensReciclagem(lista, isAutoOpen) {
    const container = document.getElementById('lista-reciclagem-expirada');
    const btnVazamento = document.getElementById('btn-vazamento-lixeira');
    
    if (!container) return;

    cacheItensNaLixeira = lista;

    // Mostrar ou esconder o botÃ£o no canto superior direito
    if (btnVazamento) {
        btnVazamento.style.display = (lista.length > 0) ? "flex" : "none";
        btnVazamento.style.alignItems = "center";
        btnVazamento.style.gap = "6px";
    }

    // ðŸš€ LIMPEZA: O container agora sÃ³ tem os cards, o tÃ­tulo jÃ¡ estÃ¡ fixo no HTML
    container.innerHTML = "";

    if (lista.length === 0) {
        container.innerHTML = `<p style="color:gray; text-align:center; padding:40px; opacity:0.5; font-size:12px;">A lixeira estÃ¡ vazia.</p>`;
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
    if (item.tipoItem === 'mica') { icone = "fa-folder-open"; nome += ` (DossiÃª: ${item.nomePai})`; }
    if (item.tipoItem === 'cosmos-tema') icone = "fa-meteor";
    if (item.tipoItem === 'topico') icone = "fa-hashtag";

    // CodificaÃ§Ã£o segura para evitar quebra de aspas no HTML
    const payload = btoa(unescape(encodeURIComponent(JSON.stringify(item))));
    const bordaColor = item.expirado ? "#ef4444" : "rgba(255,255,255,0.1)";

    return `
        <div class="menu-item-list" style="flex-direction: column; align-items: flex-start; gap: 10px; background: rgba(255,255,255,0.02); padding: 12px; border: 1px solid ${bordaColor}; border-radius: 10px; margin-bottom: 8px; position: relative;">
            
            <!-- ðŸ‘ï¸ BOTÃƒO VER (Usando Classe em vez de Onclick) -->
            <i class="fa-solid fa-eye btn-ver-reciclagem" 
               data-payload="${payload}"
               style="position: absolute; top: 12px; right: 12px; cursor: pointer; color: var(--text-muted); opacity: 0.6;"
               title="Ver ConteÃºdo"></i>

            <div style="width:100%; display:flex; justify-content:space-between; align-items:center; padding-right: 25px;">
                <div style="display:flex; align-items:center; gap:10px;">
                    <i class="fa-solid ${icone}" style="color:var(--primary); font-size:12px;"></i>
                    <span style="font-size:13px; font-weight:700; color:white;">${nome}</span>
                </div>
                <span style="font-size:8px; font-weight:900; opacity:0.3;">${item.tipoItem.toUpperCase()}</span>
            </div>
            
            <div style="display:flex; gap:5px; width:100%;">
                <button onclick="window.execRecuperar('${item.id}', '${item.idSub || ''}', '${item.tipoItem}', '${item.origem || ''}')" style="flex:1; background:#22c55e; color:black; border:none; padding:8px; border-radius:5px; font-size:10px; font-weight:800; cursor:pointer;">RECUPERAR</button>
                <button onclick="window.execEliminar('${item.id}', '${item.idSub || ''}', '${item.tipoItem}', '${item.origem || ''}')" style="flex:1; background:rgba(239, 68, 68, 0.1); color:#f87171; border:1px solid #ef4444; padding:8px; border-radius:5px; font-size:10px; font-weight:800; cursor:pointer;">ELIMINAR</button>
            </div>
        </div>
    `;
}

// ==========================================================
// ðŸš€ O SEGREDO: GESTOR DE CLIQUES CENTRALIZADO
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
 * ACÃ‡Ã•ES DE RECUPERAÃ‡ÃƒO E ELIMINAÃ‡ÃƒO
 */
async function actualizarReferenciaCaixaLocal(localDocId, caixaId, alteracoes = {}, caixaCompleta = null) {
    if (!localDocId || !caixaId) return;
    const notaRef = doc(db, "Local", localDocId);
    const snap = await getDoc(notaRef);
    if (!snap.exists()) return;
    const dados = snap.data();
    const caixas = Array.isArray(dados.caixas) ? [...dados.caixas] : [];
    const indice = caixas.findIndex(caixa => String(caixa?.id) === String(caixaId));
    const novaCaixa = { ...(caixaCompleta || {}), id: caixaId, ...alteracoes };
    if (indice >= 0) caixas[indice] = { ...caixas[indice], ...alteracoes };
    else caixas.push(novaCaixa);
    const ids = [...new Set(caixas.map(caixa => caixa?.id).filter(Boolean).map(String))];
    await updateDoc(notaRef, { caixas, CaixasOut: ids, caixaIds: ids, caixasMigradas: true });
}

async function actualizarReferenciaCaixaShare(shareId, caixaId, alteracoes = {}, caixaCompleta = null) {
    if (!shareId || !caixaId) return;
    const notaRef = doc(db, "Share", shareId);
    const snap = await getDoc(notaRef);
    if (!snap.exists()) return;
    const dados = snap.data();
    const caixas = Array.isArray(dados.caixas) ? [...dados.caixas] : [];
    const indice = caixas.findIndex(caixa => String(caixa?.id) === String(caixaId));
    const novaCaixa = { ...(caixaCompleta || {}), id: caixaId, ...alteracoes };
    if (indice >= 0) caixas[indice] = { ...caixas[indice], ...alteracoes };
    else caixas.push(novaCaixa);
    const ids = [...new Set(caixas.map(caixa => caixa?.id).filter(Boolean).map(String))];
    await updateDoc(notaRef, { caixas, CaixasOut: ids, caixaIds: ids, caixasMigradas: true });
}

async function removerReferenciaCaixaLocal(localDocId, caixaId) {
    if (!localDocId || !caixaId) return;
    const notaRef = doc(db, "Local", localDocId);
    const snap = await getDoc(notaRef);
    if (!snap.exists()) return;
    const dados = snap.data();
    const caixas = Array.isArray(dados.caixas) ? dados.caixas.filter(caixa => String(caixa?.id) !== String(caixaId)) : [];
    const ids = [...new Set(caixas.map(caixa => caixa?.id).filter(Boolean).map(String))];
    await updateDoc(notaRef, { caixas, CaixasOut: ids, caixaIds: ids, caixasMigradas: true });
}

async function removerReferenciaCaixaShare(shareId, caixaId) {
    if (!shareId || !caixaId) return;
    const notaRef = doc(db, "Share", shareId);
    const snap = await getDoc(notaRef);
    if (!snap.exists()) return;
    const dados = snap.data();
    const caixas = Array.isArray(dados.caixas) ? dados.caixas.filter(caixa => String(caixa?.id) !== String(caixaId)) : [];
    const ids = [...new Set(caixas.map(caixa => caixa?.id).filter(Boolean).map(String))];
    await updateDoc(notaRef, { caixas, CaixasOut: ids, caixaIds: ids, caixasMigradas: true });
}

window.execRecuperar = async (docId, subId, tipo, origem = "") => {
    const colecao = (tipo === 'cosmos-tema' || tipo === 'mica') ? "Cosmo" : (tipo === 'topico' ? "Topico" : ((tipo === 'share-nota' || origem === "Share" || origem === COLECAO_CAIXAS_SHARE) ? "Share" : "Local"));
    const docRef = doc(db, colecao, docId);
    try {
        if (tipo === "caixa" && obterParCaixa(origem)) {
            const restaurada = await restaurarParCaixa({
                db,
                origem,
                parentId: docId,
                caixaId: subId,
                userId: getAuth().currentUser?.uid
            });
            if (!restaurada) return;
            location.reload();
            return;
        }
        if (tipo === "caixa" && origem === COLECAO_CAIXAS_SHARE) {
            const caixaRef = doc(db, COLECAO_CAIXAS_SHARE, subId);
            const snapCaixa = await getDoc(caixaRef);
            if (!snapCaixa.exists() || snapCaixa.data().userId !== getAuth().currentUser?.uid) return;
            await updateDoc(caixaRef, { estado: "on", timedelete: null });
            await actualizarReferenciaCaixaShare(snapCaixa.data().shareId, subId, { estado: "on", timedelete: null }, { ...snapCaixa.data(), id: subId });
            location.reload();
            return;
        }
        if (tipo === "caixa" && origem === COLECAO_CAIXAS_SHARE) {
            const caixaRef = doc(db, COLECAO_CAIXAS_SHARE, subId);
            const snapCaixa = await getDoc(caixaRef);
            if (!snapCaixa.exists() || snapCaixa.data().userId !== getAuth().currentUser?.uid) return;
            const dadosCaixa = { ...snapCaixa.data(), id: snapCaixa.id };
            await addDoc(collection(db, "Blackbox"), { ...dadosCaixa, deletedAt: serverTimestamp(), originalId: snapCaixa.id, originalCollection: COLECAO_CAIXAS_SHARE, tipoItem: "caixa", userId: dadosCaixa.userId });
            await deleteDoc(caixaRef);
            await removerReferenciaCaixaShare(dadosCaixa.shareId, snapCaixa.id);
            location.reload();
            return;
        }
        if (tipo === "caixa" && origem === COLECAO_CAIXAS) {
            const caixaRef = doc(db, COLECAO_CAIXAS, subId);
            const snapCaixa = await getDoc(caixaRef);
            if (!snapCaixa.exists() || snapCaixa.data().userId !== getAuth().currentUser?.uid) return;

            await updateDoc(caixaRef, { estado: "on", timedelete: null });
            const dadosCaixa = snapCaixa.data();
            await actualizarReferenciaCaixaLocal(dadosCaixa.localDocId, subId, { estado: "on", timedelete: null }, { ...dadosCaixa, id: subId });
            location.reload();
            return;
        }
        if (subId) {
            const snap = await getDoc(docRef);
            if (tipo === 'mica') {
                await updateDoc(docRef, { [`Dossie.mica.${subId}.estado`]: "on", [`Dossie.mica.${subId}.timedelete`]: null });
            } else {
                const novas = snap.data().caixas.map(c => c.id === subId ? {...c, estado:"on", timedelete: null} : c);
                const idsOut = [...new Set(novas.map(caixa => caixa?.id).filter(Boolean).map(String))];
                await updateDoc(docRef, { caixas: novas, CaixasOut: idsOut, caixaIds: idsOut, caixasMigradas: true });
            }
        } else {
            await updateDoc(docRef, { estado: (colecao === "Local" ? "on" : "on"), timedelete: null });
        }
        location.reload(); 
    } catch (e) { console.error(e); }
};

window.execEliminar = async (docId, subId, tipo, origem = "") => {
    // 1. CONFIRMAÃ‡ÃƒO VISUAL (Podes usar o teu popup-blackbox aqui se quiseres)
    if (!confirm("Esta aÃ§Ã£o Ã© irreversÃ­vel. O item serÃ¡ eliminado. Continuar?")) return;

    const colecaoOriginal = (tipo === 'cosmos-tema' || tipo === 'mica') ? "Cosmo" : (tipo === 'topico' ? "Topico" : ((tipo === 'share-nota' || origem === "Share" || origem === COLECAO_CAIXAS_SHARE) ? "Share" : "Local"));
    const docRef = doc(db, colecaoOriginal, docId);

    try {
        if (tipo === "caixa" && obterParCaixa(origem)) {
            const eliminada = await eliminarParCaixa({
                db,
                origem,
                parentId: docId,
                caixaId: subId,
                userId: getAuth().currentUser?.uid
            });
            if (!eliminada) return;
            location.reload();
            return;
        }
        if (tipo === "caixa" && origem === COLECAO_CAIXAS) {
            const caixaRef = doc(db, COLECAO_CAIXAS, subId);
            const snapCaixa = await getDoc(caixaRef);
            if (!snapCaixa.exists() || snapCaixa.data().userId !== getAuth().currentUser?.uid) return;

            const dadosCaixa = { ...snapCaixa.data(), id: snapCaixa.id };

            await addDoc(collection(db, "Blackbox"), {
                ...dadosCaixa,
                deletedAt: serverTimestamp(),
                originalId: snapCaixa.id,
                originalCollection: COLECAO_CAIXAS,
                tipoItem: "caixa",
                userId: dadosCaixa.userId
            });

            await deleteDoc(caixaRef);
            await removerReferenciaCaixaLocal(dadosCaixa.localDocId, snapCaixa.id);
            location.reload();
            return;
        }
        const snap = await getDoc(docRef);
        if (!snap.exists()) return;

        const dadosCompletos = snap.data();
        let dadosParaOArquivo = null;
        let caixasLocaisDaNota = [];
        if (colecaoOriginal === "Share" && (dadosCompletos.caixasMigradas || Array.isArray(dadosCompletos.caixaIds))) {
            const caixasMap = await obterCaixasSharePorIds(db, docId, obterIdsCaixasShare(dadosCompletos));
            caixasLocaisDaNota = [...caixasMap.values()];
        }

        if (colecaoOriginal === "Local" &&
            (dadosCompletos.caixasMigradas || Array.isArray(dadosCompletos.caixaIds))) {
            const caixasMap = await obterCaixasPorIds(
                db,
                dadosCompletos.userId,
                obterIdsCaixas(dadosCompletos), { incluirOff: true });
            caixasLocaisDaNota = [...caixasMap.values()];
        }

        // 2. PREPARAR DADOS PARA A BLACKBOX
        if (subId) {
            // CenÃ¡rio: Eliminando uma Caixa ou uma Mica especÃ­fica
            if (tipo === 'mica') {
                dadosParaOArquivo = {
                    ...dadosCompletos.Dossie.mica[subId],
                    _meta_origem: "Mica de " + (dadosCompletos.nome || "Tema")
                };
            } else {
                const caixaAlvo = dadosCompletos.caixas.find(c => c.id === subId);
                dadosParaOArquivo = { 
                    ...caixaAlvo, 
                    _meta_origem: `Bloco da nota ${dadosCompletos.nome}` 
                };
            }
        } else {
            // CenÃ¡rio: Eliminando a Nota ou Tema inteiro
            dadosParaOArquivo = {
                ...dadosCompletos,
                ...(caixasLocaisDaNota.length ? { caixas: caixasLocaisDaNota } : {}),
                caixasPrincipais: Array.isArray(dadosCompletos.caixas) ? dadosCompletos.caixas : [],
                caixasExternas: caixasLocaisDaNota,
                _meta_origem: "Documento Integral (" + colecaoOriginal + ")"
            };
        }

        // 3. ENVIAR PARA A BLACKBOX (Backup de SeguranÃ§a)
        await addDoc(collection(db, "Blackbox"), {
            ...dadosParaOArquivo,
            deletedAt: serverTimestamp(),
            originalId: docId,
            originalCollection: colecaoOriginal,
            tipoItem: tipo,
            userId: dadosCompletos.userId
        });

        console.log("ðŸš€ [BLACKBOX] CÃ³pia de seguranÃ§a criada com sucesso.");

        // 4. ELIMINAÃ‡ÃƒO REAL (Limpando o sistema)
        if (subId) {
            if (tipo === 'mica') {
                const micas = { ...dadosCompletos.Dossie.mica };
                delete micas[subId];
                await updateDoc(docRef, { "Dossie.mica": micas });
            } else {
                const novasCaixas = dadosCompletos.caixas.filter(c => c.id !== subId);
                const idsOut = [...new Set(novasCaixas.map(caixa => caixa?.id).filter(Boolean).map(String))];
                await updateDoc(docRef, { caixas: novasCaixas, CaixasOut: idsOut, caixaIds: idsOut, caixasMigradas: true });
            }
        } else {
            await deleteDoc(docRef);
            if (colecaoOriginal === "Share" && caixasLocaisDaNota.length) {
                await Promise.all(caixasLocaisDaNota.map(caixa => apagarCaixaShare(db, docId, caixa.id)));
            } else if (caixasLocaisDaNota.length) {
                await Promise.all(caixasLocaisDaNota.map(caixa =>
                    apagarCaixaLocal(db, dadosCompletos.userId, caixa.id)
                ));
            }
        }

        console.log("ðŸ—‘ï¸ [SISTEMA] Item removido da coleÃ§Ã£o ativa.");
        location.reload(); 

    } catch (e) {
        console.error("âŒ Erro no processo de eliminaÃ§Ã£o:", e);
        alert("Erro ao processar eliminaÃ§Ã£o. Verifica a tua ligaÃ§Ã£o.");
    }
};

/**
 * ðŸš€ MOTOR DE ELIMINAÃ‡ÃƒO EM MASSA (LIMPEZA TOTAL)
 */
window.execApagarTudo = async () => {
    if (cacheItensNaLixeira.length === 0) return;

    const total = cacheItensNaLixeira.length;
    const confirmou = await confirmarAcaoGeral(
        "Vazar Lixeira?", 
        `Desejas mover todos os ${total} itens para o arquivo morto (Blackbox)? Esta aÃ§Ã£o nÃ£o pode ser desfeita.`
    );

    if (!confirmou) return;

    const btn = document.getElementById('btn-vazamento-lixeira');
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> A PROCESSAR...`;

    console.group(`ðŸ—‘ï¸ [MASS-DELETE] Iniciando limpeza de ${total} itens`);

    try {
        // Processamos todos os itens em paralelo para ser instantÃ¢neo
        const promessas = cacheItensNaLixeira.map(item => processarEliminacaoSilenciosa(item));
        await Promise.all(promessas);

        console.log("âœ… [MASS-DELETE] Lixeira limpa e Blackbox alimentada.");
        location.reload(); // Atualiza para limpar o ecrÃ£ e as listas

    } catch (e) {
        console.error("Erro na limpeza em massa:", e);
        alert("Ocorreu um erro ao limpar alguns itens.");
        btn.disabled = false;
        btn.innerHTML = `<i class="fa-solid fa-dumpster-fire"></i> APAGAR TUDO`;
    }
    console.groupEnd();
};

/**
 * AUXILIAR: Faz o backup e apaga sem dar refresh na pÃ¡gina (para loops)
 */
async function processarEliminacaoSilenciosa(item) {
    const auth = getAuth();
    const meuUid = auth.currentUser ? auth.currentUser.uid : null;

    if (!meuUid) {
        console.error("âŒ [RECYCLE] Utilizador nÃ£o autenticado para realizar limpeza.");
        return;
    }

    if (item.tipoItem === "caixa" && obterParCaixa(item.origem)) {
        await eliminarParCaixa({
            db,
            origem: item.origem,
            parentId: item.id,
            caixaId: item.idSub,
            userId: meuUid
        });
        return;
    }

    if (item.tipoItem === "caixa" && item.origem === COLECAO_CAIXAS_SHARE) {
        const caixaRef = doc(db, COLECAO_CAIXAS_SHARE, item.idSub);
        const snapCaixa = await getDoc(caixaRef);
        if (!snapCaixa.exists() || snapCaixa.data().userId !== meuUid) return;
        const dadosCaixa = { ...snapCaixa.data(), id: snapCaixa.id };
        await addDoc(collection(db, "Blackbox"), { ...dadosCaixa, deletedAt: serverTimestamp(), originalId: snapCaixa.id, originalCollection: COLECAO_CAIXAS_SHARE, tipoItem: "caixa", userId: meuUid });
        await deleteDoc(caixaRef);
        await removerReferenciaCaixaShare(dadosCaixa.shareId, snapCaixa.id);
        return;
    }
    if (item.tipoItem === "caixa" && item.origem === COLECAO_CAIXAS) {
        const caixaRef = doc(db, COLECAO_CAIXAS, item.idSub);
        const snapCaixa = await getDoc(caixaRef);
        if (!snapCaixa.exists() || snapCaixa.data().userId !== meuUid) return;

        const dadosCaixa = { ...snapCaixa.data(), id: snapCaixa.id };

        await addDoc(collection(db, "Blackbox"), {
            ...dadosCaixa,
            deletedAt: serverTimestamp(),
            originalId: snapCaixa.id,
            originalCollection: COLECAO_CAIXAS,
            tipoItem: "caixa",
            userId: meuUid
        });

        await deleteDoc(caixaRef);
        await removerReferenciaCaixaLocal(dadosCaixa.localDocId, snapCaixa.id);
        return;
    }
    const colecaoOriginal = (item.tipoItem === 'cosmos-tema' || item.tipoItem === 'mica') ? "Cosmo" : (item.tipoItem === 'topico' ? "Topico" : ((item.tipoItem === 'share-nota' || item.origem === "Share") ? "Share" : "Local"));
    const docRef = doc(db, colecaoOriginal, item.id);

    try {
        // 1. Obter dados atuais do servidor
        const snap = await getDoc(docRef);
        if (!snap.exists()) return;
        const dadosDoc = snap.data();
        let caixasLocaisDaNota = [];
        if (colecaoOriginal === "Share" && !item.idSub && (dadosDoc.caixasMigradas || Array.isArray(dadosDoc.caixaIds))) {
            const caixasMap = await obterCaixasSharePorIds(db, item.id, obterIdsCaixasShare(dadosDoc));
            caixasLocaisDaNota = [...caixasMap.values()];
        }
        if (colecaoOriginal === "Local" &&
            !item.idSub &&
            (dadosDoc.caixasMigradas || Array.isArray(dadosDoc.caixaIds))) {
            const caixasMap = await obterCaixasPorIds(
                db,
                dadosDoc.userId || meuUid,
                obterIdsCaixas(dadosDoc), { incluirOff: true });
            caixasLocaisDaNota = [...caixasMap.values()];
        }

        let payloadBlackbox = null;

        // 2. Extrair o conteÃºdo correto para o backup
        if (item.idSub) {
            // CenÃ¡rio: Caixa de Nota ou Mica de DossiÃª
            if (item.tipoItem === 'mica') {
                payloadBlackbox = { ...(dadosDoc.Dossie?.mica[item.idSub] || {}), _meta_origem: "Mica" };
                const micas = { ...dadosDoc.Dossie.mica }; 
                delete micas[item.idSub];
                await updateDoc(docRef, { "Dossie.mica": micas });
            } else {
                const caixaAlvo = (dadosDoc.caixas || []).find(c => c.id === item.idSub);
                payloadBlackbox = { ...(caixaAlvo || {}), _meta_origem: "Bloco" };
                const novas = dadosDoc.caixas.filter(c => c.id !== item.idSub);
                const idsOut = [...new Set(novas.map(caixa => caixa?.id).filter(Boolean).map(String))];
                await updateDoc(docRef, { caixas: novas, CaixasOut: idsOut, caixaIds: idsOut, caixasMigradas: true });
            }
        } else {
            // CenÃ¡rio: Nota, Tema ou TÃ³pico Integral
            payloadBlackbox = {
                ...dadosDoc,
                ...(caixasLocaisDaNota.length ? { caixas: caixasLocaisDaNota } : {}),
                caixasPrincipais: Array.isArray(dadosDoc.caixas) ? dadosDoc.caixas : [],
                caixasExternas: caixasLocaisDaNota,
                _meta_origem: "Documento"
            };
            await deleteDoc(docRef);
            if (colecaoOriginal === "Share" && caixasLocaisDaNota.length) {
                await Promise.all(caixasLocaisDaNota.map(caixa => apagarCaixaShare(db, item.id, caixa.id)));
            } else if (caixasLocaisDaNota.length) {
                await Promise.all(caixasLocaisDaNota.map(caixa =>
                    apagarCaixaLocal(db, dadosDoc.userId || meuUid, caixa.id)
                ));
            }
        }

        // 3. GRAVAR NA BLACKBOX (Com verificaÃ§Ã£o de userId)
        // ðŸš€ O SEGREDO: Se dadosDoc.userId for undefined, usa o meuUid. Nunca envia undefined.
        await addDoc(collection(db, "Blackbox"), {
            ...payloadBlackbox,
            deletedAt: serverTimestamp(),
            originalCollection: colecaoOriginal,
            tipoItem: item.tipoItem,
            userId: dadosDoc.userId || meuUid 
        });

    } catch (err) {
        console.error(`âŒ [RECYCLE] Erro ao processar item ${item.id}:`, err);
    }
}

/**
 * PROMISE: Popup de confirmaÃ§Ã£o reutilizÃ¡vel
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