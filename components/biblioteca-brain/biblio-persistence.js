// components/biblioteca-brain/biblio-persistence.js
import { doc, updateDoc, query, collection, where, getDocs } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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
            const notaRef = doc(db, colecao, window.notaAbertaId);
            window.caixasAtuais = window.caixasAtuais.map(caixa => (
                caixa.referenciacodex &&
                limparRef(caixa.referenciacodex[0]) === ref &&
                String(caixa.referenciacodex[1]) === seq
            ) ? aplicarNaCaixa(caixa) : caixa);
            await updateDoc(notaRef, { caixas: window.caixasAtuais });
        }

        const q = query(collection(db, "Local"), where("userId", "==", uid), where("estado", "==", "on"));
        const snap = await getDocs(q);
        const updates = [];

        snap.forEach(docSnap => {
            if (docSnap.id === window.notaAbertaId) return;

            const caixas = docSnap.data().caixas || [];
            let mudou = false;
            const novasCaixas = caixas.map(caixa => {
                const match = caixa.referenciacodex &&
                    limparRef(caixa.referenciacodex[0]) === ref &&
                    String(caixa.referenciacodex[1]) === seq;
                if (!match) return caixa;

                mudou = true;
                return aplicarNaCaixa(caixa);
            });

            if (mudou) updates.push(updateDoc(doc(db, "Local", docSnap.id), { caixas: novasCaixas }));
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
