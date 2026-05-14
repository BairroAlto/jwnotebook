// components/direita/dossie-actions.js
import { doc, updateDoc, query, collection, where, getDocs, deleteField } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

/**
 * MOVE UM ITEM (VERSÍCULO OU CAIXA) PARA CIMA/BAIXO
 */
export async function moverItemNaMica(index, direcao, mica, temaRef) {
    const novaPosicao = index + direcao;
    if (novaPosicao < 0 || novaPosicao >= mica.caixas.length) return;

    try {
        const novosIds = [...mica.caixas];
        [novosIds[index], novosIds[novaPosicao]] = [novosIds[novaPosicao], novosIds[index]];

        await updateDoc(temaRef, { 
            [`Dossie.mica.${mica.id}.caixas`]: novosIds 
        });
        console.log("↕️ [ORDEM] Posição alterada.");
    } catch (e) { console.error(e); }
}

/**
 * REMOVE UM ITEM E LIMPA VÍNCULO BÍBLICO SE NECESSÁRIO
 */
export async function removerItemDaMica(idAlvo, mica, temaRef, db, auth, docUuid) {
    try {
        // 1. AÇÃO PRINCIPAL: Remover o ID (ou nome do versículo) da Mica atual
        // firebase -> [Qualquer Coleção] -> Dossie -> mica -> [ID] -> caixas
        const novosIds = mica.caixas.filter(id => id !== idAlvo);
        
        await updateDoc(temaRef, { 
            [`Dossie.mica.${mica.id}.caixas`]: novosIds 
        });
        
        console.log(`🗑️ [DOSSIÊ] Item "${idAlvo}" removido da Mica.`);

        // 2. LÓGICA DE LIMPEZA BIDIRECIONAL (CONDICIONAL)
        if (typeof idAlvo === 'string' && idAlvo.includes(':')) {
            
            // Verificamos se estamos na coleção Biblioteca através do path da referência
            const isBiblioteca = temaRef.path.startsWith('Biblioteca/');

            if (isBiblioteca) {
                // REGRA SOLICITADA: Na Biblioteca, NÃO removemos o vínculo no TextosBiblia.
                // Isto permite que o versículo continue a saber que foi citado neste estudo.
                console.log("📌 [KEEP-LINK] Vínculo mantido no documento do Versículo (Histórico).");
                return; 
            }

            // --- CENÁRIO COSMOS (Mantém a limpeza profunda para Temas) ---
            const q = query(
                collection(db, "TextosBiblia"), 
                where("userId", "==", auth.currentUser.uid), 
                where("nome", "==", idAlvo)
            );
            const snap = await getDocs(q);
            if (!snap.empty) {
                // No Cosmos, se removeres o versículo da Mica, removemos também o rastro no versículo
                const { deleteField } = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js");
                await updateDoc(snap.docs[0].ref, {
                    [`Dossie.mica.biblia.${docUuid}`]: deleteField()
                });
                console.log("🧹 [DEEP-CLEAN] Vínculo removido do TextosBiblia (Modo Cosmos).");
            }
        }
    } catch (e) { 
        console.error("❌ Erro ao remover item da mica:", e); 
    }
}