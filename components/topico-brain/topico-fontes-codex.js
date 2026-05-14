// components/topico-brain/topico-fontes-codex.js
import { SharedUI } from '../editor/modulos/shared/shared-ui.js';

export const HandlerCodex = {
    /**
     * RENDERIZAÇÃO COM ORDENAÇÃO DE FAVORITOS
     */
    render: (subtopico, containerId, onUpdate) => {
        console.log("🎨 [EYE-CODEX] Renderizando lista...");
        const listCont = document.getElementById(containerId);
        if (!listCont) return;

        // FILTRAR ATIVOS E ORDENAR POR FAVORITOS
        const codices = (subtopico.codex || [])
            .filter(c => c.estado !== "desativo")
            .sort((a, b) => {
                const favA = a.favorito === 'sim' ? 1 : 0;
                const favB = b.favorito === 'sim' ? 1 : 0;
                return favB - favA;
            });

        listCont.innerHTML = codices.map((card, index) => 
            SharedUI.renderCodexCard(card, `window.editarCodexTopico(${index})`)
        ).join('') || `<div style="text-align:center; padding:40px; color:var(--text-muted); font-size:12px;">Sem mapeamentos Codex.</div>`;

        /**
         * EDIÇÃO DO CARD
         */
        window.editarCodexTopico = (index) => {
            const cardExistente = subtopico.codex[index];
            if (!cardExistente) return;

            import('../editor/modulos/codex-browser.js').then(m => {
                m.abrirPesquisaCodex(async (novosDados) => {
                    // Mantemos o estado de favorito ao editar
                    subtopico.codex[index] = { ...cardExistente, ...novosDados };
                    onUpdate();
                }, cardExistente);
            });
        };
    },

    /**
     * ADICIONAR NOVO CODEX
     */
    adicionar: (subtopico, onUpdate) => {
        console.log("➕ [HANDLER-CODEX] Abrindo explorador...");
        
        import('../editor/modulos/codex-browser.js').then(m => {
            m.abrirPesquisaCodex(async (dados) => {
                if (!dados) return;

                const novoCodex = { 
                    ...dados, 
                    id: crypto.randomUUID(), 
                    timestamp: new Date().toISOString(), 
                    estado: "ativo",
                    favorito: "nao" // Valor inicial
                };

                if (!subtopico.codex) subtopico.codex = [];
                subtopico.codex.push(novoCodex);
                onUpdate(); 
            });
        });
    }
};