import { IDENTIDADE_FERRAMENTAS } from '../constants/ferramentas.js';

function textoSeguro(valor) {
    return String(valor || '').replace(/\s+/g, ' ').trim();
}

function resumoNoticias(caixa) {
    const temas = Array.isArray(caixa.noticiasPreferencias?.temas)
        ? caixa.noticiasPreferencias.temas.map(textoSeguro).filter(Boolean)
        : [];
    if (temas.length) return `Temas: ${temas.join(', ')}`;

    const total = Array.isArray(caixa.noticiasCache) ? caixa.noticiasCache.length : 0;
    return total ? `${total} notícias guardadas na última atualização.` : 'Feed de notícias sem temas configurados.';
}

function resumoTempo(caixa) {
    const cidade = textoSeguro(caixa.tempoLocalizacao?.cidade);
    const pais = textoSeguro(caixa.tempoLocalizacao?.pais);
    if (cidade) return `Tempo em ${[cidade, pais].filter(Boolean).join(', ')}.`;
    return 'Ferramenta meteorológica sem cidade configurada.';
}

function resumoGmail(caixa) {
    const filtro = textoSeguro(caixa.gmailPreferencias?.filtro);
    const limite = Number(caixa.gmailPreferencias?.limite) || 25;
    return `Gmail em modo somente leitura${filtro ? ` · filtro ${filtro}` : ''} · ${limite} mensagens.`;
}

function resumoInspirador(caixa) {
    const preferencias = caixa.inspiradorPreferencias || {};
    const quantidade = Number(preferencias.quantidade) || 1;
    const origem = preferencias.modo === 'autor'
        ? preferencias.autor
        : preferencias.modo === 'tema' ? preferencias.tema : 'aleatória';
    return `${quantidade} ${quantidade === 1 ? 'citação' : 'citações'} da Wikiquote · ${origem}.`;
}

export function obterApresentacaoCaixaReciclada(caixa = {}) {
    const identidade = IDENTIDADE_FERRAMENTAS[caixa.tipo] || IDENTIDADE_FERRAMENTAS.contentor;
    let resumo = textoSeguro(caixa.titulo || caixa.conteudo);

    if (caixa.tipo === 'noticias') resumo = resumoNoticias(caixa);
    if (caixa.tipo === 'tempo') resumo = resumoTempo(caixa);
    if (caixa.tipo === 'gmail') resumo = resumoGmail(caixa);
    if (caixa.tipo === 'inspirador') resumo = resumoInspirador(caixa);

    return {
        identidade,
        nome: identidade.nome,
        resumo: resumo || 'Bloco sem conteúdo.'
    };
}
