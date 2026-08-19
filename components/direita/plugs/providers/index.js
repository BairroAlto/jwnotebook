const PROVIDERS = {
    wikipedia: () => import('./wikipedia.js'),
    wikidata: () => import('./wikidata.js'),
    wikimedia: () => import('./wikimedia.js')
};

export async function obterProvider(id) {
    const carregar = PROVIDERS[id];
    if (!carregar) throw new Error('Este Plug ainda não tem um fornecedor configurado.');
    return carregar();
}

export async function pesquisarTodos(termo, modo, plugs) {
    const ordenados = [...plugs].sort((a, b) => {
        if (a.id === 'wikipedia') return -1;
        if (b.id === 'wikipedia') return 1;
        return 0;
    });

    const pesquisas = await Promise.all(ordenados.map(async plug => {
        try {
            const provider = await obterProvider(plug.id);
            const resultados = await provider.pesquisar(termo, modo);
            return resultados.map(resultado => ({
                ...resultado,
                plugId: plug.id,
                fonte: plug.nome
            }));
        } catch (erro) {
            console.info(`[PLUGS] ${plug.nome} não respondeu à pesquisa:`, erro.message);
            return [];
        }
    }));

    return pesquisas.flat();
}
