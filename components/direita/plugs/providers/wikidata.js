import { pedirMediaWiki } from '../mediawiki-client.js';

const ENDPOINT = 'https://www.wikidata.org/w/api.php';

function textoIdioma(registo, chave) {
    return registo?.[chave]?.pt?.value || registo?.[chave]?.en?.value || '';
}

function idDeUnidade(unidade) {
    return String(unidade || '').match(/\/entity\/(Q\d+)$/)?.[1] || '';
}

function idsReferenciados(valor) {
    if (valor?.id) return [valor.id];
    const unidade = idDeUnidade(valor?.unit);
    return unidade ? [unidade] : [];
}

function formatarData(valor) {
    const correspondencia = String(valor || '').match(/^([+-]?\d+)-(\d{2})-(\d{2})T/);
    if (!correspondencia) return String(valor || '');
    const ano = correspondencia[1].replace(/^\+/, '');
    const mes = correspondencia[2] === '00' ? '' : correspondencia[2];
    const dia = correspondencia[3] === '00' ? '' : correspondencia[3];
    return [dia, mes, ano].filter(Boolean).join('-');
}

function formatarValor(valor, etiquetas) {
    if (valor === null || valor === undefined) return '—';
    if (typeof valor === 'string' || typeof valor === 'number') return String(valor);
    if (valor.id) return etiquetas.get(valor.id) || valor.id;
    if (valor.time) return formatarData(valor.time);
    if (valor.amount) {
        const unidade = idDeUnidade(valor.unit);
        return `${String(valor.amount).replace(/^\+/, '')}${unidade ? ` ${etiquetas.get(unidade) || unidade}` : ''}`;
    }
    if (valor.text) return valor.text;
    if (Number.isFinite(valor.latitude) && Number.isFinite(valor.longitude)) {
        return `${valor.latitude.toFixed(5)}, ${valor.longitude.toFixed(5)}`;
    }
    return JSON.stringify(valor);
}

async function obterEtiquetas(ids) {
    const unicos = [...new Set(ids)].filter(Boolean).slice(0, 50);
    if (!unicos.length) return new Map();
    const dados = await pedirMediaWiki(ENDPOINT, {
        action: 'wbgetentities',
        ids: unicos.join('|'),
        props: 'labels',
        languages: 'pt|en'
    }, 'Não foi possível traduzir os dados do Wikidata.');
    return new Map(Object.values(dados.entities || {}).map(entidade => [
        entidade.id,
        textoIdioma(entidade, 'labels') || entidade.id
    ]));
}

export async function pesquisar(termo) {
    const dados = await pedirMediaWiki(ENDPOINT, {
        action: 'wbsearchentities',
        search: termo,
        language: 'pt',
        uselang: 'pt',
        type: 'item',
        limit: 10
    }, 'Não foi possível pesquisar no Wikidata.');

    return (dados.search || []).map(item => ({
        id: item.id,
        titulo: item.label || item.id,
        descricao: item.description || 'Entidade do Wikidata',
        url: item.concepturi || `https://www.wikidata.org/wiki/${item.id}`
    }));
}

export async function obterResultado(resultado, modo) {
    const dados = await pedirMediaWiki(ENDPOINT, {
        action: 'wbgetentities',
        ids: resultado.id,
        props: 'labels|descriptions|claims|sitelinks',
        languages: 'pt|en'
    }, 'Não foi possível abrir a entidade do Wikidata.');
    const entidade = dados.entities?.[resultado.id];
    if (!entidade || entidade.missing) throw new Error('A entidade selecionada já não está disponível.');

    const limite = modo === 'resumo' ? 12 : 30;
    const entradas = Object.entries(entidade.claims || {})
        .flatMap(([propriedade, declaracoes]) => (declaracoes || []).slice(0, 3).map(declaracao => ({
            propriedade,
            valor: declaracao.mainsnak?.datavalue?.value
        })))
        .filter(item => item.valor !== undefined)
        .slice(0, limite);
    const ids = entradas.flatMap(item => [item.propriedade, ...idsReferenciados(item.valor)]);
    const etiquetas = await obterEtiquetas(ids);
    const linhas = entradas.map(item => ({
        campo: etiquetas.get(item.propriedade) || item.propriedade,
        valor: formatarValor(item.valor, etiquetas)
    }));

    return {
        tipo: 'tabela',
        titulo: textoIdioma(entidade, 'labels') || resultado.titulo,
        descricao: textoIdioma(entidade, 'descriptions') || resultado.descricao,
        linhas,
        url: resultado.url
    };
}

