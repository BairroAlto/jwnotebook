import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { renderizarAssociados, renderizarHub } from './tags-ui.js';
import { IDENTIDADE_FERRAMENTAS } from '../../../constants/ferramentas.js';
import { carregarExploradorAssociar } from './tags-associar-explorer.js';
import { perguntarRemocaoHub } from './tags-utils.js';

/**
 * Inicializa o explorador em escadinha: pastas, notas e caixas.
 */
export async function carregarArvore(ctx) {
    await carregarExploradorAssociar(
        ctx,
        (id, titulo, tipo) => vincular(id, titulo, tipo, ctx),
        IDENTIDADE_FERRAMENTAS
    );
}
export async function vincular(idAlvo, titulo, tipo, ctx) {
    const { caixaAlvo, persistir, dbRef, authRef } = ctx;
    
    if (!caixaAlvo.associados) caixaAlvo.associados = [];
    
    // Evita duplicados
    if (caixaAlvo.associados.some(a => a.id === idAlvo)) return;
    
    console.log("ðŸ”— Vinculando alvo:", titulo);
    
    caixaAlvo.associados.push({ id: idAlvo, titulo, tipo });
    await persistir('associados', caixaAlvo.associados);

    // Refresh na UI do Popup e da Coluna EYE
    import('./tags-ui.js').then(m => {
        m.renderizarAssociados(caixaAlvo);
        m.renderizarHub(caixaAlvo);
    });
    import('../../../direita/caixas-associadas.js').then(m => {
        m.carregarCaixasAssociadas(window.caixasAtuais, dbRef, authRef.currentUser.uid);
    });
}

export async function remover(idAlvo, ctx) {
    const { caixaAlvo, persistir, dbRef, authRef } = ctx;
    const alvo = (caixaAlvo.associados || []).find(a => a.id === idAlvo);
    const confirmou = await perguntarRemocaoHub({
        titulo: "Remover Associação?",
        mensagem: alvo?.titulo
            ? `Desejas remover "${alvo.titulo}" do Hub?`
            : "Desejas remover este item do Hub?"
    });
    if (!confirmou) return;

    caixaAlvo.associados = (caixaAlvo.associados || []).filter(a => a.id !== idAlvo);
    await persistir('associados', caixaAlvo.associados);
    
    import('./tags-ui.js').then(m => {
        m.renderizarAssociados(caixaAlvo);
        m.renderizarHub(caixaAlvo);
    });
    import('../../../direita/caixas-associadas.js').then(m => {
        m.carregarCaixasAssociadas(window.caixasAtuais, dbRef, authRef.currentUser.uid);
    });
}


