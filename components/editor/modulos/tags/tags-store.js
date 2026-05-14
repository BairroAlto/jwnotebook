// components/editor/modulos/tags/tags-store.js
import { doc, updateDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

export async function salvarCampoNaCaixa(db, notaId, caixaId, nomeCampo, listaDados, colecao = "Local") {
    if(!notaId || !db) return;
    
    // Normalizar nome da coleção para garantir a primeira letra maiúscula (Local/Share)
    const colecaoReal = colecao.charAt(0).toUpperCase() + colecao.slice(1).toLowerCase();

    try {
        const docRef = doc(db, colecaoReal, notaId);
        const snap = await getDoc(docRef);
        
        if(snap.exists()){
            const caixas = snap.data().caixas || [];
            const idx = caixas.findIndex(c => c.id === caixaId);
            
            if(idx !== -1) {
                caixas[idx][nomeCampo] = listaDados; 
                
                // Grava na coleção correta
                await updateDoc(docRef, { caixas: caixas });
                console.log(`✅ [STORE] ${nomeCampo} sincronizado em: ${colecaoReal}`);
            }
        }
    } catch (e) { 
        console.error(`❌ [STORE] Erro ao gravar na coleção ${colecaoReal}:`, e); 
    }
}