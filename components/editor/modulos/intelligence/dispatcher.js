// components/editor/modulos/intelligence/dispatcher.js

/**
 * DESPACHANTE DE INTELIGÊNCIA (EYE / X-SAT)
 * Centraliza as ordens de atualização para as colunas inteligentes.
 */

// DECLARAÇÃO GLOBAL DA VARIÁVEL (Resolve o erro do Uncaught ReferenceError)
let timerDebounce = null;

export function despacharInteligenciaEye(caixas, nota, db, auth) {
    if (!caixas || !nota) return;

    // 1. ESTRATÉGIA DE DEBOUNCE (100ms)
    // Evita sobrecarga ao digitar e agrupa as mudanças.
    clearTimeout(timerDebounce);

    timerDebounce = setTimeout(() => {
        const modos = Array.isArray(nota.modo) ? nota.modo : [nota.modo || 'normal'];
        const isModoPost = modos.includes('post');

        console.log("🛰️ [DISPATCHER] Sincronizando todos os sistemas de inteligência...");

        // A) Atualizar Índice (GPS)
        import('../../../direita/indice.js').then(m => {
            if (m.renderizarIndice) m.renderizarIndice(caixas, isModoPost);
        });

        // B) Atualizar Scanner de IA (Nexo)
        import('../../../direita/ai-controller.js').then(m => {
            if (m.AIController && m.AIController.renderizarLista) {
                m.AIController.renderizarLista(); 
            }
        });

        // C) Atualizar Fontes (Links e Codex)
        import('../../../direita/eye-fontes-nota.js').then(m => {
            if (m.carregarFontesGlobaisDaNota) m.carregarFontesGlobaisDaNota(caixas);
        });

        // D) Atualizar Detetor Bíblico (Aba de Textos)
        import('../../../direita/eye-textos-biblia.js').then(m => {
            if (m.detectarEExibirTextosBiblicos) m.detectarEExibirTextosBiblicos(caixas);
        });

        // E) Atualizar Caixas Associadas
        if (auth?.currentUser) {
            import('../../../direita/caixas-associadas.js').then(m => {
                if (m.carregarCaixasAssociadas) {
                    m.carregarCaixasAssociadas(caixas, db, auth.currentUser.uid);
                }
            });
        }

    }, 100); 
}