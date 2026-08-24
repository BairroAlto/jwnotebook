// components/topico-brain/topico-fontes-links.js
import { SharedUI } from '../editor/modulos/shared/shared-ui.js';
import { abrirPopupLinkTopico } from '../editor/modulos/tags/tags-utils.js';

export const HandlerLinks = {
    /**
     * RENDERIZAÇÃO COM ORDENAÇÃO DE FAVORITOS
     */
    render: (subtopico, containerId, onUpdate) => {
        const listCont = document.getElementById(containerId);
        if (!listCont) return;

        // ORDENAÇÃO: Favoritos (sim) primeiro, depois os outros
        const links = (subtopico.referencias || []).sort((a, b) => {
            const favA = a.favorito === 'sim' ? 1 : 0;
            const favB = b.favorito === 'sim' ? 1 : 0;
            return favB - favA;
        });

        listCont.innerHTML = links.map((link, index) => 
            SharedUI.renderLinkCard(link, `window.editarLinkTopico(${index})`)
        ).join('') || `<div style="text-align:center; padding:40px; color:var(--text-muted); font-size:12px;">Sem links associados.</div>`;

        // Expor função de edição global
        window.editarLinkTopico = async (index) => {
            const ref = subtopico.referencias[index];
            const dados = await abrirPopupLinkTopico(ref);
            if (dados && dados.link) {
                subtopico.referencias[index].titulo = dados.titulo;
                subtopico.referencias[index].link = dados.link;
                onUpdate(); 
            }
        };
    },

    /**
     * ADICIONAR NOVO LINK
     */
    adicionar: async (subtopico, onUpdate) => {
        const dados = await abrirPopupLinkTopico();
        if (dados && dados.link) {
            const novaRef = { 
                id: crypto.randomUUID(), 
                tipo: dados.titulo ? "completa" : "link", 
                titulo: dados.titulo || "", 
                link: dados.link,
                favorito: "nao" // Valor inicial
            };
            if (!subtopico.referencias) subtopico.referencias = [];
            subtopico.referencias.push(novaRef);
            onUpdate();
        }
    }
};