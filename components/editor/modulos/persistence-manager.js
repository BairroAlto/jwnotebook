// components/editor/modulos/persistence-manager.js
import { doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

export const PersistenceManager = {
    guardar: async (state) => {
        const { notaAbertaId, dbRef, authRef, caixasAtuais, dadosNotaOriginal, notaComAlteracoes, caixaEditadaId } = state;
        
        if (!notaAbertaId || !dbRef || !notaComAlteracoes) return;

        const isShare = (dadosNotaOriginal.onde === "share");
        const notaRef = doc(dbRef, isShare ? "Share" : "Local", notaAbertaId);

        try {
            // 1. Gravação Normal da Nota
            const payload = { 
                nome: document.getElementById('editor-titulo').innerText.trim(), 
                caixas: caixasAtuais,
                vincTopicos: dadosNotaOriginal.vincTopicos || [] 
            };
            if (isShare) payload.vistoPor = [authRef.currentUser.uid];

            await updateDoc(notaRef, payload);
            state.notaComAlteracoes = false;
            
            // ========================================================
            // 🚀 SINCRONIZAÇÃO PARA O BRAIN (BIBLIOTECA)
            // ========================================================
            const modos = Array.isArray(dadosNotaOriginal.modo) ? dadosNotaOriginal.modo : [dadosNotaOriginal.modo || 'normal'];
            
            // Se mudámos algo numa caixa que tem vínculo com a Biblioteca
           if (modos.includes('sentinela') && caixaEditadaId) {
    const caixaAlvo = caixasAtuais.find(c => c.id === caixaEditadaId);
    if (caixaAlvo && caixaAlvo.referenciacodex && caixaAlvo.estado === "on") {
        console.log("🎯 [EDITOR->BIBLIOTECA] Sincronizando mudança...");
        const { SentinelaManager } = await import('./sentinela-manager.js');
        await SentinelaManager.sincronizarParaBiblioteca(caixaAlvo, dbRef, authRef.currentUser.uid);
    }
}

            const info = document.getElementById('editor-info-text');
            if (info) info.innerText = "Sincronizado";

        } catch (e) { console.error("Erro ao guardar:", e); }
    }
};