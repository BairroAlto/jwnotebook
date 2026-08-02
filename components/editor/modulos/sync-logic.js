import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { COLECAO_CAIXAS, actualizarCaixaLocal, hidratarNotaComCaixas, guardarCaixasDaNota } from '../../local/caixas-repository.js';
import { hidratarNotaShareComCaixas, guardarCaixasShareDaNota } from '../../share/share-caixas-repository.js';

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

            const dadosNota = snap.data();
            if (colecao === "Local") {
                const notaLocal = await hidratarNotaComCaixas(
                    { ...dadosNota, onde: "local" },
                    db,
                    { currentUser: { uid: dadosNota.userId } },
                    refLink.idnota
                );
                const caixasLocais = notaLocal.caixas || [];
                const novasCaixasLocais = caixasLocais.map(caixa => {
                    if (caixa.id !== refLink.idcaixa) return caixa;
                    const listaLinks = caixa[campoAlvo] || [];
                    return {
                        ...caixa,
                        [campoAlvo]: listaLinks.map(link => (
                            link.idcaixa === idCaixaProcurada
                                ? { ...link, estado: novoEstado }
                                : link
                        ))
                    };
                });
                await guardarCaixasDaNota({
                    db,
                    userId: dadosNota.userId,
                    notaId: refLink.idnota,
                    caixas: novasCaixasLocais,
                    removerLegacy: true
                });
                console.log("Sincronização remota actualizada em LocalCaixas:", refLink.idnota);
                return;
            }

            if (colecao === "Share") {
                const notaShare = await hidratarNotaShareComCaixas({ ...dadosNota, onde: "share" }, db, refLink.idnota);
                const novasCaixasShare = (notaShare.caixas || []).map(caixa => {
                    if (caixa.id !== refLink.idcaixa) return caixa;
                    const listaLinks = caixa[campoAlvo] || [];
                    return {
                        ...caixa,
                        [campoAlvo]: listaLinks.map(link => link.idcaixa === idCaixaProcurada ? { ...link, estado: novoEstado } : link)
                    };
                });
                await guardarCaixasShareDaNota({
                    db,
                    ownerId: dadosNota.userId,
                    notaId: refLink.idnota,
                    caixas: novasCaixasShare,
                    removerLegacy: true
                });
                console.log("Sincronização remota actualizada em ShareCaixas:", refLink.idnota);
                return;
            }

            const caixas = dadosNota.caixas || [];
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