import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { renderizarAssociados, renderizarHub } from './tags-ui.js';
import { IDENTIDADE_FERRAMENTAS } from '../../../constants/ferramentas.js';
import { carregarExploradorAssociar } from './tags-associar-explorer.js';
import { perguntarRemocaoHub } from './tags-utils.js';

function sincronizarCaixaAssociadaEmLive(caixaAlvo) {
    if (!Array.isArray(window.caixasAtuais) || !caixaAlvo?.id) return;

    const indice = window.caixasAtuais.findIndex(caixa =>
        String(caixa?.id) === String(caixaAlvo.id)
    );
    if (indice === -1) return;

    // Mantém a mesma lista global que o dispatcher do EYE consulta.
    // O merge evita perder alterações entretanto feitas noutros campos.
    window.caixasAtuais[indice] = {
        ...window.caixasAtuais[indice],
        associados: [...(caixaAlvo.associados || [])]
    };
}

async function atualizarPainelCaixasAssociadas(dbRef, authRef, caixaAlvo = null) {
    const userId = authRef?.currentUser?.uid;
    if (!userId || !Array.isArray(window.caixasAtuais)) return;

    const modulo = await import('../../../direita/caixas-associadas.js');
    // Passa um snapshot para esta renderização não ser afectada por uma
    // mutação posterior enquanto as leituras das caixas terminam.
    const caixasLive = [...window.caixasAtuais];
    const indiceAlvo = caixasLive.findIndex(caixa => String(caixa?.id) === String(caixaAlvo?.id));
    if (indiceAlvo === -1 && caixaAlvo?.id) caixasLive.push(caixaAlvo);
    await modulo.carregarCaixasAssociadas(caixasLive, dbRef, userId);
}

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
    sincronizarCaixaAssociadaEmLive(caixaAlvo);

    // Refresh na UI do Popup e da Coluna EYE
    import('./tags-ui.js').then(m => {
        m.renderizarAssociados(caixaAlvo);
        m.renderizarHub(caixaAlvo);
    });
    atualizarPainelCaixasAssociadas(dbRef, authRef, caixaAlvo).catch(error => {
        console.error('Erro ao actualizar Caixas do EYE:', error);
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
    sincronizarCaixaAssociadaEmLive(caixaAlvo);
    
    import('./tags-ui.js').then(m => {
        m.renderizarAssociados(caixaAlvo);
        m.renderizarHub(caixaAlvo);
    });
    atualizarPainelCaixasAssociadas(dbRef, authRef, caixaAlvo).catch(error => {
        console.error('Erro ao actualizar Caixas do EYE:', error);
    });
}


