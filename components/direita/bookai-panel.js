// components/direita/bookai-panel.js

import { BookState } from '../book/book-state.js';

/**
 * Activa o BookAI sem acoplar a navegaÃ§Ã£o ao motor de IA.
 * O controlador continua a ser carregado apenas quando o painel Ã© usado.
 */
export async function renderizarPainelBookAI({ lista = null, nota = null } = {}) {
    const modulo = await import('./ai-controller.js');
    const notaBase = nota || window.dadosNotaOriginal || window.bookNotaAtual || null;
    const notaAtual = notaBase
        ? { ...notaBase, id: notaBase.id || BookState.notaId }
        : null;
    const listaAtual = lista || window.caixasAtuais || window.bookCaixasAtuais || null;

    modulo.AIController.renderizarLista(listaAtual, notaAtual);
}
