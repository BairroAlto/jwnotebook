import { cabecalhosComPrevisualizacao } from '../billing/plan-preview.js';

const NEWS_API_URL = 'https://storage.notabook.site';
const MERCADOS = new Set(['PT', 'BR', 'US', 'GB', 'ES']);
const VISTAS = new Set(['lista', 'grelha']);
const LIMITE_NOTICIAS_POR_TEMA = { minimo: 1, maximo: 10, predefinido: 4 };

export function obterDiaAtual() {
    const partes = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/Lisbon',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).formatToParts(new Date());
    const valores = Object.fromEntries(partes.map(parte => [parte.type, parte.value]));
    return `${valores.year}-${valores.month}-${valores.day}`;
}

function normalizarLista(valor, limite = 8) {
    const itens = Array.isArray(valor)
        ? valor
        : String(valor || '').split(/[\n,;|]+/);
    return [...new Set(itens.map(item => String(item).trim()).filter(Boolean))]
        .slice(0, limite);
}

export function normalizarPreferenciasNoticias(valor = {}) {
    const limite = Number.parseInt(valor.limitePorTema, 10);
    return {
        temas: normalizarLista(valor.temas, 8),
        excluir: normalizarLista(valor.excluir, 6),
        mercado: MERCADOS.has(valor.mercado) ? valor.mercado : 'PT',
        limitePorTema: Number.isFinite(limite)
            ? Math.min(LIMITE_NOTICIAS_POR_TEMA.maximo, Math.max(LIMITE_NOTICIAS_POR_TEMA.minimo, limite))
            : LIMITE_NOTICIAS_POR_TEMA.predefinido,
        vista: VISTAS.has(valor.vista) ? valor.vista : 'grelha'
    };
}

export function abrirConfiguradorNoticias(caixa, aoAtualizar = null) {
    return new Promise(resolve => {
        const overlay = document.getElementById('popup-noticias-overlay');
        const temas = document.getElementById('noticias-temas');
        const excluir = document.getElementById('noticias-excluir');
        const mercado = document.getElementById('noticias-mercado');
        const limitePorTema = document.getElementById('noticias-limite-tema');
        const vista = document.getElementById('noticias-vista');
        const erro = document.getElementById('noticias-config-erro');
        const confirmar = document.getElementById('btn-confirmar-noticias');
        const cancelar = document.getElementById('btn-cancelar-noticias');
        const atualizarPopup = document.getElementById('btn-atualizar-noticias-popup');
        if (!overlay || !temas || !excluir || !mercado || !limitePorTema || !vista || !confirmar || !cancelar) {
            resolve(null);
            return;
        }

        const atuais = normalizarPreferenciasNoticias(caixa.noticiasPreferencias);
        temas.value = atuais.temas.join('\n');
        excluir.value = atuais.excluir.join(', ');
        mercado.value = atuais.mercado;
        limitePorTema.value = String(atuais.limitePorTema);
        vista.value = atuais.vista;
        erro.hidden = true;
        overlay.classList.add('active');

        const fechar = dados => {
            overlay.classList.remove('active');
            confirmar.onclick = null;
            cancelar.onclick = null;
            if (atualizarPopup) atualizarPopup.onclick = null;
            resolve(dados);
        };

        if (atualizarPopup) {
            atualizarPopup.onclick = async () => {
                if (!aoAtualizar) return;
                atualizarPopup.disabled = true;
                atualizarPopup.style.opacity = '0.55';
                try {
                    await aoAtualizar();
                } finally {
                    atualizarPopup.disabled = false;
                    atualizarPopup.style.opacity = '1';
                }
            };
        }

        confirmar.onclick = () => {
            const dados = normalizarPreferenciasNoticias({
                temas: temas.value,
                excluir: excluir.value,
                mercado: mercado.value,
                limitePorTema: limitePorTema.value,
                vista: vista.value
            });
            if (!dados.temas.length) {
                erro.textContent = 'Adiciona pelo menos um tema.';
                erro.hidden = false;
                temas.focus();
                return;
            }
            fechar(dados);
        };
        cancelar.onclick = () => fechar(null);
    });
}

function textoDo(elemento, selector) {
    return elemento.querySelector(selector)?.textContent?.trim() || '';
}

function primeiroElementoComNome(elemento, nomes) {
    const nomesNormalizados = new Set(nomes);
    return [...elemento.getElementsByTagName('*')].find(filho => {
        const nome = String(filho.localName || filho.tagName || '').toLowerCase().split(':').pop();
        return nomesNormalizados.has(nome);
    }) || null;
}

function normalizarUrlImagem(valor) {
    const url = String(valor || '').trim();
    if (url.startsWith('//')) return `https:${url}`;
    if (/^http:\/\//i.test(url)) return url.replace(/^http:\/\//i, 'https://');
    return /^https:\/\//i.test(url) ? url : '';
}

function imagemDoRss(item) {
    const elementosImagem = [...item.getElementsByTagName('*')].filter(elemento => {
        const nome = String(elemento.localName || elemento.tagName || '').toLowerCase().split(':').pop();
        return ['content', 'thumbnail', 'enclosure'].includes(nome);
    });
    for (const elemento of elementosImagem) {
        const url = normalizarUrlImagem(elemento.getAttribute('url') || elemento.getAttribute('href'));
        if (url) return url;
    }

    const imagemBing = primeiroElementoComNome(item, ['image']);
    const urlBing = normalizarUrlImagem(imagemBing?.textContent);
    if (urlBing) return urlBing;

    const descricao = primeiroElementoComNome(item, ['description', 'encoded'])?.textContent || '';
    if (descricao) {
        const documentoHtml = new DOMParser().parseFromString(descricao, 'text/html');
        const imagem = documentoHtml.querySelector('img');
        const url = normalizarUrlImagem(imagem?.getAttribute('src') || imagem?.getAttribute('data-src'));
        if (url) return url;
    }

    const elementoUrl = primeiroElementoComNome(item, ['url']);
    return normalizarUrlImagem(elementoUrl?.textContent);
}

function interpretarRss(xml, limite = 10) {
    const documento = new DOMParser().parseFromString(xml, 'application/xml');
    if (documento.querySelector('parsererror')) throw new Error('O feed de notícias recebido é inválido.');
    return [...documento.querySelectorAll('item')].slice(0, limite).map(item => ({
        titulo: textoDo(item, 'title'),
        link: textoDo(item, 'link'),
        fonte: textoDo(item, 'source'),
        publicadoEm: textoDo(item, 'pubDate'),
        imagem: imagemDoRss(item)
    })).filter(item => item.titulo && item.link);
}

async function carregarNoticiasDoTema(tema, config, token) {
    const parametros = new URLSearchParams({
        temas: tema,
        excluir: config.excluir.join('|'),
        mercado: config.mercado
    });
    const resposta = await fetch(`${NEWS_API_URL}/news/rss?${parametros}`, {
        headers: {
            Authorization: `Bearer ${token}`,
            ...cabecalhosComPrevisualizacao()
        }
    });
    if (!resposta.ok) {
        const dados = await resposta.json().catch(() => ({}));
        throw new Error(dados.error || 'Não foi possível carregar as notícias.');
    }
    return interpretarRss(await resposta.text(), config.limitePorTema)
        .map(noticia => ({ ...noticia, tema }));
}

export async function carregarNoticias(preferencias, auth) {
    const config = normalizarPreferenciasNoticias(preferencias);
    if (!config.temas.length) return [];
    const utilizador = auth?.currentUser;
    if (!utilizador) throw new Error('Sessão não autenticada.');

    const token = await utilizador.getIdToken();
    const feeds = await Promise.all(config.temas.map(tema => carregarNoticiasDoTema(tema, config, token)));
    const noticias = [];
    const linksVistos = new Set();
    feeds.flat().forEach(noticia => {
        const identificador = noticia.link || noticia.titulo;
        if (linksVistos.has(identificador)) return;
        linksVistos.add(identificador);
        noticias.push(noticia);
    });
    return noticias;
}
