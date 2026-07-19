import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

export const SyncLogic = {
    /**
     * Atualiza o estado de um vínculo (pai ou filho) noutra nota
     * @param {string} db - Instância do DB
     * @param {object} refLink - Objeto com idnota, idcaixa e onde (Local/Share)
     * @param {string} campoAlvo - "copias" ou "pais"
     * @param {string} idCaixaProcurada - ID da caixa que disparou a ação
     * @param {string} novoEstado - "on" ou "off"
     */
    atualizarEstadoRemoto: async (db, refLink, campoAlvo, idCaixaProcurada, novoEstado) => {
        const colecao = refLink.onde === "Share" ? "Share" : "Local";
        const docRef = doc(db, colecao, refLink.idnota);
        
        try {
            const snap = await getDoc(docRef);
            if (!snap.exists()) return;

            const caixas = snap.data().caixas || [];
            const novasCaixas = caixas.map(c => {
                if (c.id === refLink.idcaixa) {
                    const listaLinks = c[campoAlvo] || [];
                    c[campoAlvo] = listaLinks.map(link => {
                        if (link.idcaixa === idCaixaProcurada) {
                            return { ...link, estado: novoEstado };
                        }
                        return link;
                    });
                }
                return c;
            });

            await updateDoc(docRef, { caixas: novasCaixas });
            console.log(`🔄 Sincronização Remota: ${refLink.idnota} atualizada.`);
        } catch (e) { console.error("Erro na Sincronização Remota:", e); }
    }
};