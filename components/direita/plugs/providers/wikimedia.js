import { limparFragmentoHtml, pedirMediaWiki } from '../mediawiki-client.js';

const ENDPOINT = 'https://commons.wikimedia.org/w/api.php';

function metadado(info, chave) {
    return limparFragmentoHtml(info?.extmetadata?.[chave]?.value || '');
}

function normalizarPagina(pagina) {
    const info = pagina.imageinfo?.[0] || {};
    return {
        id: String(pagina.pageid),
        titulo: String(pagina.title || '').replace(/^(File|Ficheiro):/i, ''),
        descricao: metadado(info, 'ImageDescription') || metadado(info, 'ObjectName') || 'Imagem do Wikimedia Commons',
        autor: metadado(info, 'Artist'),
        licenca: metadado(info, 'LicenseShortName'),
        dataCriacao: info.timestamp || '',
        thumbUrl: info.thumburl || info.url,
        imageUrl: info.url,
        url: info.descriptionurl || `https://commons.wikimedia.org/?curid=${pagina.pageid}`
    };
}

export async function pesquisar(termo, modo = 'resumo') {
    const dados = await pedirMediaWiki(ENDPOINT, {
        action: 'query',
        generator: 'search',
        gsrsearch: termo,
        gsrnamespace: 6,
        gsrlimit: modo === 'resumo' ? 10 : 20,
        prop: 'imageinfo',
            iiprop: 'url|extmetadata|timestamp',
        iiurlwidth: 480
    }, 'Não foi possível pesquisar imagens no Wikimedia Commons.');

    return (dados.query?.pages || [])
        .map(normalizarPagina)
        .filter(item => item.thumbUrl && item.imageUrl);
}

export async function obterResultado(resultado) {
    return {
        tipo: 'imagem',
        titulo: resultado.titulo,
        descricao: resultado.descricao,
        autor: resultado.autor,
        licenca: resultado.licenca,
        imageUrl: resultado.imageUrl,
        url: resultado.url
    };
}
