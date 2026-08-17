/**
 * Elimina primeiro os elementos internos (caixas e micas) e só depois
 * os respetivos documentos. Assim, o documento-pai não desaparece enquanto
 * ainda está a ser atualizado por outra eliminação.
 */
export function ordenarItensParaEliminacao(itens = []) {
    return itens
        .map((item, indice) => ({ item, indice }))
        .sort((a, b) => Number(!a.item?.idSub) - Number(!b.item?.idSub) || a.indice - b.indice)
        .map(({ item }) => item);
}

/**
 * A fila é deliberadamente sequencial. Vários itens podem pertencer à
 * mesma nota e uma execução paralela faria atualizações concorrentes.
 */
export async function executarEliminacaoSequencial(itens, eliminarItem, aoProgresso = () => {}) {
    const sucessos = [];
    const falhas = [];
    const total = itens.length;

    for (let indice = 0; indice < total; indice += 1) {
        const item = itens[indice];
        try {
            await eliminarItem(item);
            sucessos.push(item);
        } catch (erro) {
            falhas.push({ item, erro });
        }

        aoProgresso({
            processados: indice + 1,
            total,
            sucessos: sucessos.length,
            falhas: falhas.length
        });
    }

    return { sucessos, falhas };
}
