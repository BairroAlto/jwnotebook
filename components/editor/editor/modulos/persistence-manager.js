// components/editor/modulos/persistence-manager.js
import { doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

export const PersistenceManager = {
    guardar: async (state) => {
        const { notaAbertaId, dbRef, authRef, caixasAtuais, dadosNotaOriginal, notaComAlteracoes, caixaEditadaId } = state;
        
        if (!notaAbertaId || !dbRef || !notaComAlteracoes) {
            console.debug('[SHARE-NOTIF][gravar][ignorado]', {
                notaId: notaAbertaId,
                motivo: 'sem-alteracoes-ou-contexto'
            });
            return;
        }

        const revisaoGuardada = state.revisaoAlteracoes || 0;
        const isShare = (dadosNotaOriginal.onde === "share");
        const notaRef = doc(dbRef, isShare ? "Share" : "Local", notaAbertaId);

        try {
            // 1. Gravação Normal da Nota
            const payload = { 
                nome: document.getElementById('editor-titulo').innerText.trim(), 
                caixas: caixasAtuais,
                vincTopicos: dadosNotaOriginal.vincTopicos || [],
                shareNovidades: dadosNotaOriginal.shareNovidades || {},
                reactions: dadosNotaOriginal.reactions || {}
            };
            if (isShare) payload.vistoPor = [authRef.currentUser.uid];

            const alteracoesPendentes = { ...(state.caixasEditadas || {}) };
            if (isShare && caixaEditadaId && !alteracoesPendentes[caixaEditadaId]) {
                alteracoesPendentes[caixaEditadaId] = { tipo: "editado" };
            }

            if (isShare && Object.keys(alteracoesPendentes).length) {
                const uid = authRef.currentUser.uid;
                const userName = authRef.currentUser.displayName || authRef.currentUser.email || "Utilizador";
                payload.shareNovidades = { ...(dadosNotaOriginal.shareNovidades || {}) };
                Object.entries(alteracoesPendentes).forEach(([caixaId, alteracao]) => {
                    const tipoAnterior = payload.shareNovidades?.[caixaId]?.tipo;
                    payload.shareNovidades[caixaId] = {
                        tipo: tipoAnterior === "criado" ? "criado" : (alteracao.tipo || "editado"),
                        by: uid,
                        byName: userName,
                        viewedBy: [uid],
                        timestamp: new Date().toISOString()
                    };
                });
                dadosNotaOriginal.shareNovidades = payload.shareNovidades;
            } else if (isShare) {
                const uid = authRef.currentUser.uid;
                payload.shareNotaNovidade = {
                    by: uid,
                    byName: authRef.currentUser.displayName || authRef.currentUser.email || "Utilizador",
                    viewedBy: [uid],
                    timestamp: new Date().toISOString()
                };
                dadosNotaOriginal.shareNotaNovidade = payload.shareNotaNovidade;
            }

            console.info('[SHARE-NOTIF][gravar][inicio]', {
                notaId: notaAbertaId,
                partilhada: isShare,
                caixas: Object.entries(alteracoesPendentes).map(([id, alteracao]) => ({
                    id,
                    tipo: alteracao.tipo || 'editado'
                })),
                geral: isShare && Object.keys(alteracoesPendentes).length === 0
            });
            await updateDoc(notaRef, payload);
            console.info('[SHARE-NOTIF][gravar][sucesso]', {
                notaId: notaAbertaId,
                partilhada: isShare
            });
            state.notaComAlteracoes = (state.revisaoAlteracoes || 0) !== revisaoGuardada;
            Object.entries(alteracoesPendentes).forEach(([caixaId, alteracao]) => {
                if (state.caixasEditadas?.[caixaId]?.timestamp === alteracao.timestamp) {
                    delete state.caixasEditadas[caixaId];
                }
            });
            state.caixaEditadaId = null;
            
            // ========================================================
            // 🚀 SINCRONIZAÇÃO PARA O BRAIN / BIBLIOTECA (CODEX & PUZZLE)
            // ========================================================
            if (caixaEditadaId) {
                const caixaAlvo = caixasAtuais.find(c => c.id === caixaEditadaId);
                if (caixaAlvo && caixaAlvo.referenciacodex && caixaAlvo.estado === "on") {
                    console.log("🎯 [EDITOR->BIBLIOTECA] Sincronizando caixa vinculada a Codex...");
                    const { SentinelaManager } = await import('./sentinela-manager.js');
                    await SentinelaManager.sincronizarParaBiblioteca(caixaAlvo, dbRef, authRef.currentUser.uid);
                }
            }

            const info = document.getElementById('editor-info-text');
            if (info) info.innerText = "Sincronizado";

        } catch (e) {
            console.error('[SHARE-NOTIF][gravar][erro]', {
                notaId: notaAbertaId,
                partilhada: isShare,
                erro: e
            });
            console.error("Erro ao guardar:", e);
        }
    }
};
