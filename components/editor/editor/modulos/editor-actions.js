// components/editor/modulos/editor-actions.js

/**
 * MOVE UMA CAIXA PARA CIMA OU PARA BAIXO
 * @param {Array} caixasAtuais - Array original do estado
 * @param {Object} caixaAlvo - A caixa que queremos mover
 * @param {String} direcao - "cima" ou "baixo"
 * @param {Boolean} isModoPost - Se a visualização está invertida
 * @param {Function} callback - Função para redesenhar o feed
 */
export function moverCaixa(caixasAtuais, caixaAlvo, direcao, isModoPost, callback) {
    // 1. Filtrar apenas as caixas ativas e ordenar por ordem real (1...N)
    const ativas = caixasAtuais
        .filter(c => c.estado === 'on')
        .sort((a, b) => (a.ordem || 0) - (b.ordem || 0));

    const indexAtual = ativas.findIndex(c => c.id === caixaAlvo.id);
    if (indexAtual === -1) return;

    // 2. DETERMINAR O ALVO DA TROCA
    // No Modo Post, a Seta "Cima" quer na verdade AUMENTAR a ordem (ir para o fim do array lógico)
    // No Modo Normal, a Seta "Cima" quer DIMINUIR a ordem (ir para o início do array lógico)
    
    let swapIndex = -1;

    if (isModoPost) {
        // LÓGICA INVERTIDA
        if (direcao === "cima") swapIndex = indexAtual + 1; // Sobe no ecrã = sobe no número
        if (direcao === "baixo") swapIndex = indexAtual - 1; // Desce no ecrã = desce no número
    } else {
        // LÓGICA NORMAL
        if (direcao === "cima") swapIndex = indexAtual - 1;
        if (direcao === "baixo") swapIndex = indexAtual + 1;
    }

    // 3. EXECUTAR A TROCA (Se o alvo for válido)
    if (swapIndex >= 0 && swapIndex < ativas.length) {
        const itemTroca = ativas[swapIndex];
        const tempOrdem = caixaAlvo.ordem;
        caixaAlvo.ordem = itemTroca.ordem;
        itemTroca.ordem = tempOrdem;

        console.log(`↕️ [MOVE] Swapping ${caixaAlvo.ordem} with ${itemTroca.ordem}`);
        callback(); // Redesenha e Grava
    }
}

/**
 * PREPARA O ID PARA INSERÇÃO INLINE
 */
export function prepararInsercao(idCaixa) {
    window.idReferenciaInsercao = idCaixa;
    const popup = document.getElementById('popup-ferramentas-inline');
    if (popup) popup.classList.add('active');
}