// components/editor/modulos/intelligence/dispatcher.js

let timerDebounce = null;

export function despacharInteligenciaEye(caixas, nota, db, auth) {
    if (!caixas || !nota) return;

    clearTimeout(timerDebounce);

    timerDebounce = setTimeout(() => {
        const modos = (nota && nota.modo) ? (Array.isArray(nota.modo) ? nota.modo : [nota.modo]) : ['normal'];
        const isModoPost = modos.includes('post');
        const isModoSentinela = modos.includes('sentinela');

        // 🚀 DEFINIÇÃO DA VARIÁVEL CORRIGIDA
        const caixasFiltradas = caixas.filter(c => {
            if (c.estado !== 'on') return false;
            return isModoSentinela ? !!c.referenciacodex : !c.referenciacodex;
        });

        console.log(`🛰️ [DISPATCHER] Sincronizando EYE com ${caixasFiltradas.length} blocos.`);

        // A) Índice (GPS)
        import('../../../direita/indice.js').then(m => {
            m.renderizarIndice(caixasFiltradas, isModoPost);
        });

        // B) Scanner de IA (Nexo)
        import('../../../direita/ai-controller.js').then(m => {
            if (m.AIController && m.AIController.renderizarLista) {
                m.AIController.renderizarLista(caixasFiltradas); 
            }
        });

        // C) Resumo de Fontes
        import('../../../direita/eye-fontes-nota.js').then(m => {
            m.carregarFontesGlobaisDaNota(caixasFiltradas);
        });

        // D) Detetor Bíblico
        import('../../../direita/eye-textos-biblia.js').then(m => {
            m.detectarEExibirTextosBiblicos(caixasFiltradas);
        });

        // E) Caixas Associadas
        if (auth?.currentUser) {
            import('../../../direita/caixas-associadas.js').then(m => {
                m.carregarCaixasAssociadas(caixasFiltradas, db, auth.currentUser.uid);
            });
        }

    }, 150); 
}