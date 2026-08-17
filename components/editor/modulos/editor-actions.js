// components/editor/modulos/editor-actions.js

import { construirGruposFundidos } from './fundir-manager.js';

function obterOrdemNumerica(caixa) {
    const ordem = Number(caixa?.ordem);
    return Number.isFinite(ordem) ? ordem : 0;
}

function ordenarCaixasDeFormaEstavel(caixas) {
    return caixas
        .map((caixa, indice) => ({ caixa, indice }))
        .sort((a, b) => obterOrdemNumerica(a.caixa) - obterOrdemNumerica(b.caixa) || a.indice - b.indice)
        .map(item => item.caixa);
}

function pertenceAoMesmoFeed(caixa, caixaAlvo) {
    const alvoSentinela = caixaAlvo?.referenciacodex !== undefined && caixaAlvo?.referenciacodex !== null;
    const caixaSentinela = caixa?.referenciacodex !== undefined && caixa?.referenciacodex !== null;
    return alvoSentinela === caixaSentinela;
}

/**
 * Corrige ordens antigas, em falta ou repetidas antes de qualquer movimento.
 * A posição actual no array serve de desempate para não haver saltos aleatórios.
 */
export function normalizarOrdemDasCaixas(caixasAtuais) {
    const ordenadas = ordenarCaixasDeFormaEstavel(caixasAtuais || []);
    ordenadas.forEach((caixa, indice) => {
        caixa.ordem = indice + 1;
    });
    return ordenadas;
}

/**
 * MOVE UMA CAIXA PARA CIMA OU PARA BAIXO
 * @param {Array} caixasAtuais - Array original do estado
 * @param {Object} caixaAlvo - A caixa que queremos mover
 * @param {String} direcao - "cima" ou "baixo"
 * @param {Boolean} isModoPost - Se a visualização está invertida
 * @param {Function} callback - Função para redesenhar o feed
 */
export function moverCaixa(caixasAtuais, caixaAlvo, direcao, isModoPost, callback) {
    if (!Array.isArray(caixasAtuais) || !caixaAlvo?.id || !['cima', 'baixo'].includes(direcao)) return false;

    // O elemento renderizado pode pertencer a uma renderização anterior.
    // Usa a versão viva da lista para determinar o feed e manter a ordem actual.
    const caixaAlvoViva = caixasAtuais.find(caixa => caixa?.id === caixaAlvo.id) || caixaAlvo;

    // Só entram no movimento as caixas realmente apresentadas no mesmo feed.
    // Isto evita trocar com itens Sentinela invisíveis e o aparente "clique sem efeito".
    const caixasDoFeed = ordenarCaixasDeFormaEstavel(caixasAtuais.filter(caixa =>
        caixa?.estado === 'on' && pertenceAoMesmoFeed(caixa, caixaAlvoViva)
    ));
    const grupos = construirGruposFundidos(caixasDoFeed);
    const indiceAtual = grupos.findIndex(grupo => grupo.caixas.some(caixa => caixa.id === caixaAlvoViva.id));
    if (indiceAtual === -1) return false;

    const deslocamentoVisual = direcao === 'baixo' ? 1 : -1;
    const deslocamentoLogico = isModoPost ? -deslocamentoVisual : deslocamentoVisual;
    const indiceDestino = indiceAtual + deslocamentoLogico;
    if (indiceDestino < 0 || indiceDestino >= grupos.length) return false;

    normalizarOrdemDasCaixas(caixasAtuais);
    [grupos[indiceAtual], grupos[indiceDestino]] = [grupos[indiceDestino], grupos[indiceAtual]];

    // Mantém os intervalos ocupados por caixas de outros feeds, mas reordena
    // todo o grupo fundido como uma só unidade visual.
    const ordensDisponiveis = caixasDoFeed.map(caixa => caixa.ordem).sort((a, b) => a - b);
    grupos.flatMap(grupo => grupo.caixas).forEach((caixa, indice) => {
        caixa.ordem = ordensDisponiveis[indice];
    });

    callback?.();
    return true;
}

/**
 * PREPARA O ID PARA INSERÇÃO INLINE
 */
export function prepararInsercao(idCaixa) {
    window.idReferenciaInsercao = idCaixa;
    const popup = document.getElementById('popup-ferramentas-inline');
    if (popup) popup.classList.add('active');
}
