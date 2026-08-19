import { obterProvider } from './index.js';

function normalizarTexto(valor) {
    return String(valor || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

function escolherResultado(resultados, titulo) {
    if (!resultados?.length) return null;
    const alvo = normalizarTexto(titulo);
    return resultados.find(resultado => normalizarTexto(resultado.titulo) === alvo)
        || resultados[0];
}

function escolherImagemMaisRecente(imagens) {
    return [...(imagens || [])].sort((a, b) => {
        const dataA = Date.parse(a.dataCriacao || '') || 0;
        const dataB = Date.parse(b.dataCriacao || '') || 0;
        return dataB - dataA;
    })[0] || null;
}

async function tentar(descricao, operacao) {
    try {
        return await operacao();
    } catch (erro) {
        console.info(`[PLUGS] ${descricao}:`, erro.message);
        return null;
    }
}

export async function obterResultadoComposto(resultado, modo, plugs) {
    const ids = new Set(plugs.map(plug => plug.id));
    const wikipedia = await obterProvider('wikipedia');
    const artigo = await wikipedia.obterResultado(resultado, modo);
    const composto = {
        tipo: 'composto',
        titulo: artigo.titulo,
        wikipedia: artigo
    };

    if (ids.has('wikimedia')) {
        const wikimedia = await obterProvider('wikimedia');
        const imagens = await tentar('Wikimedia não encontrou uma imagem relacionada', () =>
            wikimedia.pesquisar(artigo.titulo, 'resumo')
        );
        const imagemSelecionada = escolherImagemMaisRecente(imagens);
        if (imagemSelecionada) {
            composto.imagem = await tentar('Não foi possível abrir a imagem do Wikimedia', () =>
                wikimedia.obterResultado(imagemSelecionada, modo)
            );
        }
    }

    if (ids.has('wikidata')) {
        const wikidata = await obterProvider('wikidata');
        const entidades = await tentar('Wikidata não encontrou dados relacionados', () =>
            wikidata.pesquisar(artigo.titulo)
        );
        const entidade = escolherResultado(entidades, artigo.titulo);
        if (entidade) {
            composto.wikidata = await tentar('Não foi possível abrir os factos do Wikidata', () =>
                wikidata.obterResultado(entidade, modo)
            );
        }
    }

    return composto;
}
