// components/biblioteca-brain/biblio-persistence.js
import { doc, updateDoc, query, collection, where, getDocs, or } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { COLECAO_CAIXAS, guardarCaixasDaNota, actualizarCaixaLocal } from '../local/caixas-repository.js';
import { hidratarNotaShareComCaixas, guardarCaixasShareDaNota } from '../share/share-caixas-repository.js';

/**
 * 1. Gravar na Biblioteca (ficha mestre)
 */
export async function salvarNaBiblioteca(docRef, dados) {
    const payload = {
        "anotacaoEspecial.conteudo": dados.conteudo || "",
        "anotacaoEspecial.titulo": dados.titulo || "",
        "anotacaoEspecial.timestamp": new Date().toISOString()
    };

    if (dados.foco !== undefined) payload["anotacaoEspecial.foco"] = dados.foco || "original";
    if (dados.tipo !== undefined) payload["anotacaoEspecial.tipo"] = dados.tipo || "questao";
    if (dados.destaques !== undefined) payload["anotacaoEspecial.destaques"] = dados.destaques || "";

    await updateDoc(docRef, payload);
}

/**
 * 2. Replicar para notas Sentinela
 *
 * Atualiza a nota aberta em RAM e qualquer nota Local ativa que contenha
 * a mesma caixa referenciacodex [referencia, sequencia].
 */
export async function replicarParaNotaSentinela(db, estudoMestre, novosCampos) {
    const ref = limparRef(estudoMestre?.referencia);
    const seq = String(estudoMestre?.sequencia || "");
    const uid = estudoMestre?.userId || window.auth?.currentUser?.uid;
    if (!db || !ref || !seq || !uid) return;

    const aplicarNaCaixa = (caixa) => ({
        ...caixa,
        conteudo: novosCampos.conteudo || "",
        titulo: novosCampos.titulo || caixa.titulo || "",
        timestamp: new Date().toISOString()
    });

    try {
        if (window.notaAbertaId && window.caixasAtuais) {
            const colecao = (window.dadosNotaOriginal?.onde === "share") ? "Share" : "Local";
            window.caixasAtuais = window.caixasAtuais.map(caixa => (
                caixa.referenciacodex &&
                limparRef(caixa.referenciacodex[0]) === ref &&
                String(caixa.referenciacodex[1]) === seq
            ) ? aplicarNaCaixa(caixa) : caixa);
            if (colecao === "Local") {
                await guardarCaixasDaNota({
                    db,
                    userId: uid,
                    notaId: window.notaAbertaId,
                    caixas: window.caixasAtuais,
                    removerLegacy: true
                });
            } else {
                await guardarCaixasShareDaNota({
                    db,
                    ownerId: window.dadosNotaOriginal?.userId || uid,
                    notaId: window.notaAbertaId,
                    caixas: window.caixasAtuais,
                    removerLegacy: true
                });
            }
        }

        const q = query(collection(db, "Local"), where("userId", "==", uid), where("estado", "==", "on"));
        const snap = await getDocs(q);
        const qShare = query(collection(db, "Share"), where("estado", "==", "on"), or(
            where("userId", "==", uid),
            where("aprovado", "array-contains", uid),
            where("convidado", "array-contains", uid)
        ));
        const snapShare = await getDocs(qShare);
        const qCaixas = query(collection(db, COLECAO_CAIXAS), where("userId", "==", uid), where("estado", "==", "on"));
        const snapCaixas = await getDocs(qCaixas);
        const updates = [];

        snapCaixas.forEach(docSnap => {
            const caixa = docSnap.data();
            if (caixa.localDocId === window.notaAbertaId) return;
            const match = caixa.referenciacodex &&
                limparRef(caixa.referenciacodex[0]) === ref &&
                String(caixa.referenciacodex[1]) === seq;
            if (match) {
                updates.push(actualizarCaixaLocal(db, uid, docSnap.id, aplicarNaCaixa(caixa)));
            }
        });

        snap.forEach(docSnap => {
            if (docSnap.id === window.notaAbertaId) return;

            const dadosNota = docSnap.data();
            if (dadosNota.caixasMigradas || Array.isArray(dadosNota.caixaIds)) return;
            const caixas = dadosNota.caixas || [];
            let mudou = false;
            const novasCaixas = caixas.map(caixa => {
                const match = caixa.referenciacodex &&
                    limparRef(caixa.referenciacodex[0]) === ref &&
                    String(caixa.referenciacodex[1]) === seq;
                if (!match) return caixa;

                mudou = true;
                return aplicarNaCaixa(caixa);
            });

            if (mudou) {
                updates.push(guardarCaixasDaNota({
                    db,
                    userId: uid,
                    notaId: docSnap.id,
                    caixas: novasCaixas,
                    removerLegacy: true
                }));
            }
        });

        snapShare.forEach(docSnap => {
            if (docSnap.id === window.notaAbertaId) return;
            updates.push((async () => {
                const dadosNota = docSnap.data();
                const notaShare = await hidratarNotaShareComCaixas({ ...dadosNota, onde: "share" }, db, docSnap.id);
                let mudou = false;
                const novasCaixas = (notaShare.caixas || []).map(caixa => {
                    const match = caixa.referenciacodex && limparRef(caixa.referenciacodex[0]) === ref && String(caixa.referenciacodex[1]) === seq;
                    if (!match) return caixa;
                    mudou = true;
                    return aplicarNaCaixa(caixa);
                });
                if (mudou) await guardarCaixasShareDaNota({ db, ownerId: dadosNota.userId, notaId: docSnap.id, caixas: novasCaixas, removerLegacy: true });
            })());
        });

        await Promise.all(updates);
        console.log("[REPLICA] Biblioteca sincronizada com notas Sentinela.");
    } catch (e) {
        console.error("Erro na replica:", e);
    }
}

function limparRef(valor) {
    return String(valor || "").trim().replace(/\s+/g, " ");
}
