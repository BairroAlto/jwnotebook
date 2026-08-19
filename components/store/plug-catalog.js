export const PLUGS_LOJA = Object.freeze([
    {
        id: 'wikipedia',
        featureKey: 'plug_wikipedia',
        nome: 'Wikipédia',
        descricao: 'Pesquisa artigos e apresenta um resumo ou o artigo completo.',
        icon: 'fa-brands fa-wikipedia-w',
        corInterface: '#f8fafc',
        placeholder: 'Pesquisar na Wikipédia…'
    },
    {
        id: 'wikidata',
        featureKey: 'plug_wikidata',
        nome: 'Wikidata',
        descricao: 'Pesquisa entidades e organiza os dados estruturados numa tabela.',
        icon: 'fa-solid fa-barcode',
        corInterface: '#60a5fa',
        placeholder: 'Pesquisar no Wikidata…'
    },
    {
        id: 'wikimedia',
        featureKey: 'plug_wikimedia',
        nome: 'Wikimedia',
        descricao: 'Pesquisa imagens no Wikimedia Commons e apresenta os resultados disponíveis.',
        icon: 'fa-solid fa-photo-film',
        corInterface: '#34d399',
        placeholder: 'Pesquisar imagens no Wikimedia…'
    }
]);

export function normalizarPlugsInstalados(valores) {
    const idsValidos = new Set(PLUGS_LOJA.map(plug => plug.id));
    return [...new Set((Array.isArray(valores) ? valores : []).filter(id => idsValidos.has(id)))];
}

export function obterPlugPorId(id) {
    return PLUGS_LOJA.find(plug => plug.id === id) || null;
}

