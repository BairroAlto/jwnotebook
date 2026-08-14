import { doc, updateDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { actualizarCaixaLocal, guardarCaixasDaNota } from "../../../local/caixas-repository.js";
import { hidratarNotaShareComCaixas, guardarCaixasShareDaNota } from "../../../share/share-caixas-repository.js";

export async function salvarCampoNaCaixa(db, notaId, caixaId, nomeCampo, listaDados, colecao = "Local", userId = null) {
    if (!notaId || !db) return;

    const colecaoReal = colecao.charAt(0).toUpperCase() + colecao.slice(1).toLowerCase();

    try {
        const docRef = doc(db, colecaoReal, notaId);
        const snap = await getDoc(docRef);
        if (!snap.exists()) return;

        const dadosNota = snap.data();
        const caixas = dadosNota.caixas || [];
        const idx = caixas.findIndex(c => c.id === caixaId);

        if (colecaoReal === "Local" && userId) {
            if (dadosNota.caixasMigradas || Array.isArray(dadosNota.caixaIds)) {
                await actualizarCaixaLocal(db, userId, caixaId, { [nomeCampo]: listaDados });
            } else {
                if (idx === -1) return;
                caixas[idx][nomeCampo] = listaDados;
                await guardarCaixasDaNota({
                    db,
                    userId,
                    notaId,
                    caixas,
                    removerLegacy: true
                });
            }
            console.log("[STORE] Campo sincronizado em LocalCaixas:", nomeCampo);
            return;
        }

        if (colecaoReal === "Share") {
            const notaShare = await hidratarNotaShareComCaixas({ ...dadosNota, onde: "share" }, db, notaId);
            const caixasShare = notaShare.caixas || [];
            const idxShare = caixasShare.findIndex(c => c.id === caixaId);
            if (idxShare === -1) return;
            caixasShare[idxShare] = { ...caixasShare[idxShare], [nomeCampo]: listaDados };
            await guardarCaixasShareDaNota({
                db,
                ownerId: dadosNota.userId || userId,
                notaId,
                caixas: caixasShare,
                removerLegacy: true
            });
            console.log("[STORE] Campo sincronizado em ShareCaixas:", nomeCampo);
            return;
        }

        if (idx === -1) return;
        caixas[idx][nomeCampo] = listaDados;
        await updateDoc(docRef, { caixas });
        console.log("[STORE] Campo sincronizado em " + colecaoReal + ":", nomeCampo);
    } catch (erro) {
        console.error("[STORE] Erro ao gravar na colecção " + colecaoReal + ":", erro);
    }
}