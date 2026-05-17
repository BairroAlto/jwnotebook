// components/editor/modulos/ai-search-indexer.js

import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const MAX_NOTES_PER_SHARD = 300; // Se o Firebase encolher o limite, baixamos este número

export async function dispararIndexacao(db, userId, notaId, dadosNota) {
    // 1. Limpeza de Texto (Código Fixo - Grátis)
    const titulos = dadosNota.caixas
        .filter(c => c.estado === 'ativa' && c.titulo)
        .map(c => c.titulo).join(', ');

    const texto = dadosNota.caixas
        .filter(c => c.estado === 'ativa' && !c.titulo && c.conteudo)
        .map(c => c.conteudo.substring(0, 120)) // Pequena amostra
        .join('... ');

    const topicos = (dadosNota.vincTopicos || []).map(t => t.nome).join(' ');
    
    // Resumo Atómico (Aprox 400 caracteres por nota)
    const superResumo = `${dadosNota.nome} | ${topicos} | ${titulos} | ${texto}`.substring(0, 500);

    // 2. Lógica de Escala Infinita (Sharding)
    // Usamos um cálculo simples baseado no timestamp para distribuir as notas por shards
    // Para um sistema ultra-escalável, poderíamos contar as notas, mas isto é mais rápido:
    const shardId = "shard_" + (Math.abs(notaId.hashCode()) % 5 + 1); 

    try {
        const indexRef = doc(db, "SearchIndex", userId, "shards", shardId);
        await setDoc(indexRef, {
            [`n_${notaId}`]: superResumo
        }, { merge: true });
    } catch (e) { console.error("Erro indexador:", e); }
}

// Auxiliar para distribuir IDs de forma equilibrada entre documentos
String.prototype.hashCode = function() {
    let hash = 0;
    for (let i = 0; i < this.length; i++) {
        hash = ((hash << 5) - hash) + this.charCodeAt(i);
        hash |= 0;
    }
    return hash;
};
