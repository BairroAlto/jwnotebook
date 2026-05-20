// components/editor/modulos/intelligence/dispatcher.js

let timerDebounce = null;

/**
 * MAESTRO DE INTELIGÊNCIA "EYE"
 * Filtra os blocos baseando-se no modo da nota (Sentinela vs Normal)
 * e distribui os dados para o Índice, IA, Fontes e Bíblia.
 */
export function despacharInteligenciaEye(caixas, nota, db, auth) {
    if (!caixas || !nota) return;

    // Cancela atualizações pendentes para não sobrecarregar o sistema
    clearTimeout(timerDebounce);

    timerDebounce = setTimeout(() => {
        
        // 1. DETERMINAR OS MODOS ATUAIS DA NOTA
        const modoRaw = nota.modo || 'normal';
        const modos = Array.isArray(modoRaw) ? modoRaw : [modoRaw];
        
        const isModoSentinela = modos.includes('sentinela');
        const isModoPost = modos.includes('post');

        // 2. FILTRAGEM RIGOROSA DE BLOCOS (REGRAS DE EXCLUSIVIDADE)
        const caixasFiltradas = caixas.filter(c => {
            // Apenas blocos que não foram movidos para a lixeira
            if (c.estado !== 'on') return false;

            // Verifica se o bloco pertence ao estudo (tem referência bíblica/codex associada)
            const temRefEstudo = (c.referenciacodex !== undefined && c.referenciacodex !== null);

            if (isModoSentinela) {
                // No MODO SENTINELA: SÓ passam blocos de estudo
                return temRefEstudo;
            } else {
                // No MODO NORMAL/OUTROS: SÓ passam blocos manuais (sem referência de estudo)
                return !temRefEstudo;
            }
        });

        console.log(`🛰️ [DISPATCHER] Sincronizando EYE (${isModoSentinela ? 'Sentinela' : 'Normal'}) com ${caixasFiltradas.length} blocos.`);

        // ========================================================
        // 3. DISTRIBUIÇÃO PARA OS MOTORES DA DIREITA
        // ========================================================

        // A) Índice (GPS) - Navegação rápida pelos blocos
        import('../../../direita/indice.js').then(m => {
            m.renderizarIndice(caixasFiltradas, isModoPost);
        });

        // B) Scanner de IA (BookAI) - Canal 6 do X-SAT
        import('../../../direita/ai-controller.js').then(m => {
            if (m.AIController && m.AIController.renderizarLista) {
                // PASSAMOS A NOTA AQUI PARA EVITAR O ID "temp"
                m.AIController.renderizarLista(caixasFiltradas, nota); 
            }
        });

        // C) Resumo de Fontes - Links e Mapeamentos Codex
        import('../../../direita/eye-fontes-nota.js').then(m => {
            m.carregarFontesGlobaisDaNota(caixasFiltradas);
        });

        // D) Detetor Bíblico - Leituras automáticas
        import('../../../direita/eye-textos-biblia.js').then(m => {
            m.detectarEExibirTextosBiblicos(caixasFiltradas);
        });

        // E) Caixas Associadas - Vínculos com outras notas
        if (auth?.currentUser) {
            import('../../../direita/caixas-associadas.js').then(m => {
                m.carregarCaixasAssociadas(caixasFiltradas, db, auth.currentUser.uid);
            });
        }

    }, 150); // Delay de 150ms para suavizar a escrita (debounce)
}