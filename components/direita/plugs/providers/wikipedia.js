import { limparFragmentoHtml, pedirMediaWiki } from '../mediawiki-client.js';

const ENDPOINT = 'https://pt.wikipedia.org/w/api.php';

export async function pesquisar(termo) {
    const dados = await pedirMediaWiki(ENDPOINT, {
        action: 'query',
        list: 'search',
        srsearch: termo,
        srnamespace: 0,
        srlimit: 10,
        utf8: 1
    }, 'Não foi possível pesquisar na Wikipédia.');

    return (dados.query?.search || []).map(item => ({
        id: String(item.pageid),
        titulo: item.title,
        descricao: limparFragmentoHtml(item.snippet) || 'Artigo da Wikipédia',
        url: `https://pt.wikipedia.org/?curid=${item.pageid}`
    }));
}

export async function obterResultado(resultado, modo) {
    const dados = await pedirMediaWiki(ENDPOINT, {
        action: 'query',
        prop: 'extracts',
        pageids: resultado.id,
        explaintext: 1,
        exintro: modo === 'resumo' ? 1 : undefined,
        redirects: 1
    }, 'Não foi possível abrir o artigo da Wikipédia.');
    const pagina = dados.query?.pages?.[0];
    const textoOriginal = String(pagina?.extract || '').trim();
    const limite = modo === 'resumo' ? 6000 : 60000;
    const truncado = textoOriginal.length > limite;

    return {
        tipo: 'texto',
        titulo: pagina?.title || resultado.titulo,
        texto: textoOriginal.slice(0, limite) || 'Este artigo não disponibilizou texto.',
        nota: truncado ? 'O artigo foi abreviado para manter o painel rápido.' : '',
        url: resultado.url
    };
}

