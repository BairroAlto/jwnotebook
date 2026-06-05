// components/biblioteca-brain/biblio-persistence.js
import { doc, updateDoc, query, collection, where, getDocs } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

/**
 * 1. GRAVAR NA BIBLIOTECA (FICHA MESTRE)
 */
export async function salvarNaBiblioteca(docRef, dados) {
    // Atualiza o documento principal da Biblioteca
    await updateDoc(docRef, { 
        "anotacaoEspecial.conteudo": dados.conteudo || "", 
        "anotacaoEspecial.titulo": dados.titulo || "",
        "anotacaoEspecial.foco": dados.foco || "original",
        "anotacaoEspecial.tipo": dados.tipo || "questao",
        "anotacaoEspecial.destaques": dados.destaques || "",
        "anotacaoEspecial.timestamp": new Date().toISOString()
    });
}

/**
 * 2. REPLICAR PARA NOTAS SENTINELA (CASCATA)
 * Procura em todas as notas do utilizador que estejam em modo 'sentinela'
 * e que contenham este parágrafo específico.
 */
export async function replicarParaNotaSentinela(db, estudoMestre, novosCampos) {
    if (!window.notaAbertaId || !window.caixasAtuais) return;
    
    // Como a nota já está aberta no editor, não precisamos de procurá-la no Firebase
    // Podemos gravar diretamente usando o ID que já temos em memória
    const colecao = (window.dadosNotaOriginal.onde === "share") ? "Share" : "Local";
    const notaRef = doc(db, colecao, window.notaAbertaId);

    // O window.caixasAtuais já foi atualizado pelo transmitter (RAM)
    // Basta enviar a lista completa para o Firestore
    try {
        await updateDoc(notaRef, { caixas: window.caixasAtuais });
        console.log("✅ [REPLICA] Nota Sentinela sincronizada no Firebase.");
    } catch (e) {
        console.error("Erro na réplica:", e);
    }
}