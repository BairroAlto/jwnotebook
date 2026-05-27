// components/editor/modulos/ai-search-indexer.js
import { doc, setDoc, updateDoc, deleteField } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

export async function dispararIndexacao(db, userId, notaId, dadosNota) {
    if (!db || !userId || !notaId) return;

    const shardNum = (notaId.charCodeAt(0) % 5) + 1;
    const shardId = `shard_${shardNum}`;
    const indexRef = doc(db, "SearchIndex", userId, "shards", shardId);

    // Remoção se a nota estiver off
    if (dadosNota.estado === "off") {
        try { await updateDoc(indexRef, { [`n_${notaId}`]: deleteField() }); return; } catch (e) { return; }
    }

    if (!dadosNota.caixas) return;

    // 🚀 INDEXAÇÃO PROFUNDA (Aumentada para Modelos Gratuitos)
   const blocosProcessados = dadosNota.caixas
    .filter(c => c.estado === 'on') 
    .map(c => {
        let info = "";
        const titulo = c.titulo ? `[${c.titulo}] ` : "";
        const conteudo = c.conteudo ? c.conteudo.substring(0, 800) : "";
        // 🚀 ADICIONAMOS O ID NO INÍCIO DE CADA BLOCO
        return `{ID:${c.id}}${titulo}${conteudo}`;
    })
    .join(' | ')
    .substring(0, 3500);

    const tags = (dadosNota.vincTopicos || []).map(t => t.nome).join(', ');

    // SUPER-RESUMO EXPANDIDO: 3500 caracteres (conhecimento profundo para a IA)
    const superResumo = `NOTA: ${dadosNota.nome} | TAGS: ${tags} | CONTEÚDO: ${blocosProcessados}`
        .replace(/\s+/g, ' ') 
        .substring(0, 3500); 

    try {
        await setDoc(indexRef, { [`n_${notaId}`]: superResumo }, { merge: true });
        console.log(`📡 [GPS-SYNC] Indexação Profunda: ${shardId} (${superResumo.length} chars)`);
    } catch (e) { console.error("❌ [GPS-ERROR]", e); }
}
