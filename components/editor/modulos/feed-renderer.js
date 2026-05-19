// components/editor/modulos/feed-renderer.js
import { renderizarFeed } from './editor-render.js';

export const FeedRenderer = {
    desenhar: async (lista, target, ctx) => {
        const { dadosNota, acionarGravacao, notaAbertaId } = ctx;

        await renderizarFeed({
            caixasAtuais: lista,
            feed: target,
            dadosNota: dadosNota,
            acionarGravacao: acionarGravacao,
            onApagar: (c) => window.prepararOcultarGlobal(c),
            abrirPaleta: (c) => window.abrirPaletaGlobal(c),
            abrirPopupPartilhar: (c) => window.abrirPopupPartilharGlobal(c),
            moverCaixa: (c, dir) => window.moverCaixaGlobal(c, dir),
            abrirPopupTags: (c) => window.abrirPopupTagsGlobal(c),
            prepararInsercao: (id) => window.prepararInsercaoGlobal(id),
            abrirLupaBiblia: (c) => window.abrirSeletorBibliaGlobal(c),
            notaAbertaId: notaAbertaId
        });
    }
};