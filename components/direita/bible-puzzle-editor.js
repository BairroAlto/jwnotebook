const gravacoesPendentes = new Map();

export function agendarGravacaoPuzzle(id, gravar, atraso = 1000) {
    cancelarGravacaoPuzzle(id);

    const temporizador = setTimeout(() => executarGravacaoPuzzle(id), atraso);

    gravacoesPendentes.set(String(id), { temporizador, gravar });
}

export function cancelarGravacaoPuzzle(id) {
    const chave = String(id);
    const entrada = gravacoesPendentes.get(chave);
    if (entrada?.temporizador) clearTimeout(entrada.temporizador);
    gravacoesPendentes.delete(chave);
}

export function executarGravacaoPuzzle(id) {
    const chave = String(id);
    const entrada = gravacoesPendentes.get(chave);
    if (!entrada) return Promise.resolve();

    clearTimeout(entrada.temporizador);
    gravacoesPendentes.delete(chave);

    try {
        return Promise.resolve(entrada.gravar());
    } catch (erro) {
        return Promise.reject(erro);
    }
}

export function limparGravacoesPuzzle({ gravar = false } = {}) {
    const ids = [...gravacoesPendentes.keys()];
    if (gravar) return Promise.allSettled(ids.map(executarGravacaoPuzzle));
    ids.forEach(cancelarGravacaoPuzzle);
    return Promise.resolve([]);
}
