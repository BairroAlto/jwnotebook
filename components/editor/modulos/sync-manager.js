// components/editor/modulos/sync-manager.js
import { atualizarIconeLab } from './lab-status.js';

/**
 * MOTOR DE SINCRONIZAÇÃO E RENDERIZAÇÃO
 * Decide qual o motor de visualização a usar baseado nos modos ativos.
 */
export const SyncManager = {
    atualizar: async (state, acionarGravacao, dispararGravacao = true) => {
        // Segurança: Se não há nota aberta, abortar.
        if (!state.dadosNotaOriginal) return;

        // 1. SINCRONIZAR RAM GLOBAL
        // Mantém a lista de caixas atualizada para o sistema de Pins e Sidebar
        window.caixasAtuais = state.caixasAtuais;

        // 2. OBTER E NORMALIZAR MODOS
        const modosAtivos = Array.isArray(state.dadosNotaOriginal.modo) 
            ? state.dadosNotaOriginal.modo 
            : [state.dadosNotaOriginal.modo || 'normal'];
        
        // 3. ATUALIZAR ÍCONE DO LABORATÓRIO (Topo da Nota)
        atualizarIconeLab(modosAtivos);

        // 4. GESTÃO DE VISIBILIDADE DO MODO ARQUIVO
        const tabsArquivoUI = document.getElementById('arquivo-tabs-container');
        const isModoArquivo = modosAtivos.includes('arquivo');
        
        if (tabsArquivoUI) {
            tabsArquivoUI.style.display = isModoArquivo ? 'block' : 'none';
        }

        // 5. DECISÃO DE RENDERIZAÇÃO (Bifurcação de Motores)
        if (isModoArquivo) {
            // --- CENÁRIO A: MODO ARQUIVO ---
            console.log("📂 [SYNC] Renderizando em modo Arquivo.");
            const m = await import('./arquivo-controller.js');
            
            // Inicializa o arquivo (vincula db e auth)
            m.iniciarArquivo(state.dbRef, state.authRef, () => {
                // Callback para o arquivo disparar refresh no sistema
                SyncManager.atualizar(state, acionarGravacao, true);
            });
            
            // Desenha a estrutura de pastas/gavetas
            m.renderizarModoArquivo(state.notaAbertaId, state.dadosNotaOriginal);
        } else {
            // --- CENÁRIO B: MODO FEED (Normal, Post ou Sentinela) ---
            console.log("📝 [SYNC] Renderizando em modo Feed.");
            
            // Os modos Normal, Post e Sentinela partilham o mesmo motor de Feed
            // A filtragem das caixas (o que esconder/mostrar) é feita no editor-render.js
            const { FeedRenderer } = await import('./feed-renderer.js');
            
            await FeedRenderer.desenhar(state.caixasAtuais, document.getElementById('editor-feed'), {
                dadosNota: state.dadosNotaOriginal,
                acionarGravacao,
                notaAbertaId: state.notaAbertaId
            });
        }

        // 6. ATUALIZAR INTELIGÊNCIA LATERAL (EYE)
        // Dispara em background a atualização do Índice, Bíblia e Fontes
        import('./intelligence/dispatcher.js').then(m => {
            m.despacharInteligenciaEye(state.caixasAtuais, state.dadosNotaOriginal, state.dbRef, state.authRef);
        });

        // 7. AJUSTES FINAIS DE UI
        // Garante que todos os campos de texto têm a altura correta após o render
        requestAnimationFrame(() => {
            setTimeout(() => {
                import('./ui-utils.js').then(m => {
                    m.EditorUI.forçarAjusteAlturas();
                });
            }, 150);
        });

        // 8. PERSISTÊNCIA
        // Se dispararGravacao for true, aciona o timer de backup para o Firebase
        if (dispararGravacao) acionarGravacao();
    }
};