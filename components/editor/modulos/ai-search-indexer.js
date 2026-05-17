// components/editor/modulos/ai-search-indexer.js
import { doc, setDoc, updateDoc, deleteField } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

/**
 * MOTOR DE INDEXAÇÃO ATÓMICA (NEXO GPS)
 * Este motor prepara os resumos das notas para a busca por IA sem gastar tokens.
 * Gere automaticamente a criação, atualização e remoção de índices.
 */
export async function dispararIndexacao(db, userId, notaId, dadosNota) {
    if (!db || !userId || !notaId) return;

    // 1. DETERMINAR O BALDE (SHARD) DE MEMÓRIA
    // Usamos o primeiro caractere do ID da nota para distribuir as notas por 5 ficheiros (baldes)
    // Isto evita ultrapassar o limite de 1MB do Firebase e garante escala infinita.
    const shardNum = (notaId.charCodeAt(0) % 5) + 1;
    const shardId = `shard_${shardNum}`;
    const indexRef = doc(db, "SearchIndex", userId, "shards", shardId);

    // ==========================================================
    // 🛡️ CENÁRIO A: NOTA OCULTADA OU APAGADA
    // ==========================================================
    // Se a nota foi movida para a lixeira (estado desativa), limpamos a entrada do GPS.
    if (dadosNota.estado === "desativa" || dadosNota.estado === "desativo") {
        console.log(`🗑️ [GPS-CLEAN] Removendo nota ${notaId} do radar de busca...`);
        try {
            await updateDoc(indexRef, {
                [`n_${notaId}`]: deleteField() // Remove permanentemente a linha da nota do balde
            });
            return; 
        } catch (e) {
            // Se o documento de shard ainda não existir, ignoramos o erro
            return;
        }
    }

    // ==========================================================
    // 📝 CENÁRIO B: ATUALIZAÇÃO DE CONTEÚDO (TURBO MODE)
    // ==========================================================
    if (!dadosNota.caixas) return;

    // 1. FILTRAR E PROCESSAR CAIXAS ATIVAS
    // Ignoramos caixas que o utilizador ocultou individualmente
    const blocosProcessados = dadosNota.caixas
        .filter(c => c.estado === 'ativa') 
        .map(c => {
            let info = "";
            
            // Suporte ao Elevador (Título nas pastas pai)
            if (c.tipo === "elevador" && c.pastapai && c.pastapai[0]) {
                info = `[Elevador: ${c.pastapai[0].nome}]`;
            } 
            // Suporte Geral (Título + Amostra de Conteúdo)
            else {
                const titulo = c.titulo ? `${c.titulo}: ` : "";
                const conteudo = c.conteudo ? c.conteudo.substring(0, 150) : "";
                info = titulo + conteudo;
            }
            return info;
        })
        .filter(texto => texto.length > 0)
        .join(' | ');

    // 2. RECOLHER TÓPICOS (TAGS)
    const tags = (dadosNota.vincTopicos || []).map(t => t.nome).join(', ');

    // 3. CONSTRUIR SUPER-RESUMO (Limite: 800 caracteres)
    // Este é o "Post-it" que a IA lerá para decidir se esta nota é o resultado certo.
    const superResumo = `NOTA: ${dadosNota.nome} | TAGS: ${tags} | CONTEÚDO: ${blocosProcessados}`
        .replace(/\s+/g, ' ') // Remove espaços duplos e quebras de linha para poupar espaço
        .substring(0, 800);

    // 4. GRAVAR NO FIREBASE
    try {
        await setDoc(indexRef, {
            [`n_${notaId}`]: superResumo
        }, { merge: true });
        
        console.log(`📡 [GPS-SYNC] Nota indexada no ${shardId} (${superResumo.length} bytes)`);
    } catch (e) {
        console.error("❌ [GPS-ERROR] Falha na sincronização do índice:", e);
    }
}