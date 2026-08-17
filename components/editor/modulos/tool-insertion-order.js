/**
 * Insere um elemento imediatamente abaixo da referência na ordem apresentada.
 * No Modo Post, a apresentação é o inverso da ordem persistida.
 */
export function inserirAbaixoNaOrdemVisual(lista, indiceReferencia, elemento, ordemInvertida = false) {
    if (!Array.isArray(lista) || indiceReferencia < 0 || indiceReferencia >= lista.length) return false;

    const indiceInsercao = ordemInvertida ? indiceReferencia : indiceReferencia + 1;
    lista.splice(indiceInsercao, 0, elemento);
    return true;
}
