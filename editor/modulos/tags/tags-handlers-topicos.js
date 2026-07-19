// components/editor/modulos/tags/tags-handlers-topicos.js
import { doc, updateDoc, arrayUnion, arrayRemove } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { renderizarHub, renderizarVinculosTopicos } from './tags-ui.js';
import { perguntarRemoverVinculo } from './tags-utils.js';

/**
 * VINCULAR SUBTÓPICO À CAIXA (BIDIRECIONAL)
 * @param {string} docIdFirebase - O ID do documento na coleção "Topico"
 * @param {string} uuid - O UUID interno do tópico/subtópico
 * @param {string} nomeSub - O nome do subtópico para exibição
 * @param {object} ctx - Contexto com dbRef, caixaAlvo e função persistir
 */
export async function vincularAoSubtopico(docIdFirebase, uuid, nomeSub, ctx) {
    const { dbRef, caixaAlvo, persistir } = ctx; 
    
    try {
        // 1. Gravar a referência da CAIXA no documento do TÓPICO (Firebase -> Topico -> caixas)
        // Isso permite que o Tópico saiba quais notas/blocos o citam
        const subRef = doc(dbRef, "Topico", docIdFirebase);
        await updateDoc(subRef, { caixas: arrayUnion(caixaAlvo.id) });

        // 2. Garantir que o array de vínculos existe na caixa local
        if (!caixaAlvo.vincTopicos) caixaAlvo.vincTopicos = [];

        // 3. Verificar se já está vinculado para evitar duplicados
        if (!caixaAlvo.vincTopicos.some(t => t.id === uuid)) {
            
            // Adicionamos o objeto completo conforme solicitado
            caixaAlvo.vincTopicos.push({
                id: uuid,           // firebase -> Topico -> id
                nome: nomeSub,      // firebase -> Topico -> nome
                firebaseId: docIdFirebase // ID do documento para facilitar a remoção posterior
            });
            
            // 4. Persistir a alteração no documento da NOTA (Firebase -> Local -> caixas -> vincTopicos)
            await persistir('vincTopicos', caixaAlvo.vincTopicos);
        }

        // 5. Atualizar a interface (Pills no topo da aba Tópicos)
        renderizarVinculosTopicos(caixaAlvo);
        renderizarHub(caixaAlvo);
        
    } catch (e) {
        console.error("Erro ao vincular subtópico:", e);
    }
}

/**
 * REMOVER VÍNCULO (BIDIRECIONAL)
 * @param {string} uuid - O UUID do tópico a remover
 * @param {object} ctx - Contexto com dbRef, caixaAlvo e função persistir
 */
export async function desvincularTopico(uuid, ctx, options = {}) {
    const { dbRef, caixaAlvo, persistir } = ctx;
    const { skipConfirm = false } = options;
    
    // Localizar os dados do tópico no array da caixa
    const topicoObj = (caixaAlvo.vincTopicos || []).find(t => t.id === uuid);
    if (!topicoObj) return;

    // CHAMADA AO POPUP PERSONALIZADO (Substitui o confirm nativo)
    const confirmou = skipConfirm ? true : await perguntarRemoverVinculo(topicoObj.nome);
    
    if (confirmou) {
        try {
            // 1. Remover o ID da CAIXA do documento do TÓPICO no Firebase
            if (topicoObj.firebaseId) {
                const subRef = doc(dbRef, "Topico", topicoObj.firebaseId);
                await updateDoc(subRef, { caixas: arrayRemove(caixaAlvo.id) });
            }

            // 2. Remover o objeto do array local da CAIXA
            caixaAlvo.vincTopicos = caixaAlvo.vincTopicos.filter(t => t.id !== uuid);

            // 3. Persistir a limpeza no documento da NOTA
            await persistir('vincTopicos', caixaAlvo.vincTopicos);

            // 4. Atualizar interface
            renderizarVinculosTopicos(caixaAlvo);
            renderizarHub(caixaAlvo);
            
        } catch (e) {
            console.error("Erro ao desvincular tópico:", e);
        }
    }
}

/**
 * VINCULAR A NOTA INTEIRA AO SUBTÓPICO (BIDIRECIONAL)
 */
export async function vincularNotaAoSubtopico(docIdFirebase, uuid, nomeSub, ctx) {
    const { dbRef, notaMaeId } = ctx; // Aqui usamos o ID da Nota
    
    try {
        // 1. Gravar ID da NOTA no documento do TÓPICO (Firebase -> Topico -> notas)
        const subRef = doc(dbRef, "Topico", docIdFirebase);
        await updateDoc(subRef, { notas: arrayUnion(notaMaeId) });

        // 2. Gravar os dados do Tópico na raiz do documento da NOTA (Firebase -> Local -> vincTopicos)
        const notaRef = doc(dbRef, "Local", notaMaeId);
        const novoVinculo = {
            firebaseId: docIdFirebase,
            id: uuid,
            nome: nomeSub
        };

        await updateDoc(notaRef, { vincTopicos: arrayUnion(novoVinculo) });
        
        console.log("✅ Nota vinculada ao tópico com sucesso.");
    } catch (e) {
        console.error("Erro ao vincular nota ao tópico:", e);
    }
}
