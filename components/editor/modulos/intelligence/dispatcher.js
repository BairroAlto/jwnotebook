// components/editor/modulos/intelligence/dispatcher.js

/**
 * Orquestra a atualização de todos os módulos da coluna EYE (Direita).
 * @param {Array} caixas - O array de caixas atual.
 * @param {Object} nota - Os dados originais da nota (para ver modos).
 * @param {Object} db - Instância do Firestore.
 * @param {Object} auth - Instância do Auth.
 */
export function despacharInteligenciaEye(caixas, nota, db, auth) {
    if (!caixas || !nota) return;

    const modos = Array.isArray(nota.modo) ? nota.modo : [nota.modo || 'normal'];
    const isModoPost = modos.includes('post');

    console.log("🛰️ [EYE-DISPATCHER] Sincronizando abas inteligentes...");

    // 1. Atualizar Índice (GPS)
    import('../../../direita/indice.js').then(m => 
        m.renderizarIndice(caixas, isModoPost)
    );

    // 2. Atualizar Resumo de Fontes (Links e Codex)
    import('../../../direita/eye-fontes-nota.js').then(m => 
        m.carregarFontesGlobaisDaNota(caixas)
    );

    // 3. Atualizar Detetor Bíblico
    import('../../../direita/eye-textos-biblia.js').then(m => 
        m.detectarEExibirTextosBiblicos(caixas)
    );

    // 4. Atualizar Caixas Associadas
    if (auth?.currentUser) {
        import('../../../direita/caixas-associadas.js').then(m => 
            m.carregarCaixasAssociadas(caixas, db, auth.currentUser.uid)
        );
    }
}