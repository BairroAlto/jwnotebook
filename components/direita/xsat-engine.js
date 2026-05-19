// components/direita/xsat-engine.js

import { BIBLE_ABBREVIATIONS } from '../lists/bilbe-abreviatura.js';
import { SIGLAS_PUBS, SIGLAS_LIVROS } from '../lists/siglas-data.js';
import { ANOS_DISPONIVEIS, DISPONIVEL_LIVROS, DISPONIVEL_PUBLICACOES, DISPONIVEL_VIDEOS } from '../lists/repositorio-data.js';

// Dicionário para conversão literária (1 a 15)
const NUMS = { 
    1:"um", 2:"dois", 3:"três", 4:"quatro", 5:"cinco", 6:"seis", 7:"sete", 8:"oito", 9:"nove", 10:"dez",
    11:"onze", 12:"doze", 13:"treze", 14:"catorze", 15:"quinze" 
};

// Mapa reverso para extração (Palavra -> Número)
const WORDS_TO_NUMS = {};
Object.entries(NUMS).forEach(([n, w]) => { 
    WORDS_TO_NUMS[w] = parseInt(n); 
    const semAcento = w.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if(semAcento !== w) WORDS_TO_NUMS[semAcento] = parseInt(n);
});

const _SATELLITE_DATA_CACHE = new Map();

/**
 * MOTOR 1: EXTRAÇÃO (O TRADUTOR)
 * Transforma o texto bruto em objetos estruturados {livro, cap, ver}
 */
function extrairReferencias(texto) {
    const achados = [];
    const textoLimpo = texto.toLowerCase();
    
    // Preparar dicionário para busca rápida
    const dictLower = {};
    Object.keys(BIBLE_ABBREVIATIONS).forEach(k => { dictLower[k.toLowerCase()] = BIBLE_ABBREVIATIONS[k]; });
    
    const nomesOrdenados = Object.keys(BIBLE_ABBREVIATIONS).sort((a, b) => b.length - a.length);
    const patternLivros = nomesOrdenados.map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');

    // Regex atualizada para capturar intervalos (ex: 1:1-10 ou 1:1,2,5)
    const regexFull = new RegExp(`(${patternLivros})\\.?\\s*(\\d+)[:\\s](\\d+(?:[\\d\\s\\-,]*)?)`, 'gi');

    let m;
    while ((m = regexFull.exec(textoLimpo)) !== null) {
        const livroOficial = dictLower[m[1].toLowerCase()];
        const cap = parseInt(m[2]);
        const versiculosBrutos = m[3];

        // --- MOTOR DE EXPANSÃO DE INTERVALO ---
        // Ex: "1-3, 5" -> [1, 2, 3, 5]
        const listaVersiculos = expandirVersiculos(versiculosBrutos);

        listaVersiculos.forEach(vNum => {
            achados.push({ 
                livro: livroOficial, 
                abrev: m[1], 
                cap: cap, 
                ver: vNum 
            });
        });
    }
    return achados;
}

/**
 * AUXILIAR: Transforma strings de intervalo em arrays de números
 * "1-3" -> [1, 2, 3]
 */
function expandirVersiculos(str) {
    const resultados = new Set();
    const partes = str.split(/[,;]/);

    partes.forEach(p => {
        const trecho = p.trim();
        if (trecho.includes('-')) {
            const range = trecho.split('-');
            const inicio = parseInt(range[0]);
            const fim = parseInt(range[1]);
            if (!isNaN(inicio) && !isNaN(fim)) {
                for (let i = Math.min(inicio, fim); i <= Math.max(inicio, fim); i++) {
                    resultados.add(i);
                }
            }
        } else {
            const n = parseInt(trecho);
            if (!isNaN(n)) resultados.add(n);
        }
    });

    return Array.from(resultados).sort((a, b) => a - b);
}

/**
 * MOTOR 2: EXPANSÃO (GERADOR DE PADRÕES)
 * Cria todas as variações possíveis para garantir que o scanner encontra a citação
 */
function gerarSuperPadroes(ref) {
    const { livro, abrev, cap, ver } = ref;
    const tCap = NUMS[cap] || cap;
    const tVer = NUMS[ver] || ver;
    const p = [];
    const nomes = [livro, abrev, `${abrev}.`].filter(n => n);

    nomes.forEach(n => {
        // Formatos Técnicos
        p.push(`${n} ${cap}:${ver}`);
        p.push(`${n} ${cap}.${ver}`);
        // Formatos Narrativos
        p.push(`${n} capítulo ${cap} versículo ${ver}`);
        p.push(`${n} capítulo ${tCap} versículo ${tVer}`);
        p.push(`${n} capítulo ${cap}, versículo ${ver}`);
        p.push(`${n} capítulo ${cap} e o versículo ${ver}`);
        p.push(`${n} ${cap} e o versículo ${ver}`);
    });

    // Ordem Inversa
    p.push(`versículo ${ver} do capítulo ${cap} de ${livro}`);
    p.push(`versículo ${tVer} do capítulo ${tCap} de ${livro}`);
    p.push(`o versículo ${ver} do capítulo ${cap}`);

    return [...new Set(p)];
}

/**
 * MOTOR 3: VARREDURA (O SCANNER)
 * Procura nos conteúdos do JSON as referências e trata intervalos/listas
 */
function procurarNoJson(json, referencias, listaDestino, labelExibicao, caminho, contextId) {
    const partes = caminho.split('/');
    const metaFicheiro = { 
        sigla: json.id || (partes.includes('publicacoes') ? partes[2] : partes[partes.length-1].replace('.json', '')), 
        ano: partes.find(p => p.match(/^\d{4}$/)) || "", 
        mes: partes[partes.length - 1].replace('.json', '') 
    };

    const blocosPai = json.artigos || json.capitulos || (json.video ? [json.video] : []);

    blocosPai.forEach(itemPai => {
        if (!itemPai.conteudo) return;

        referencias.forEach(ref => {
            const padroes = gerarSuperPadroes(ref);
            let snippetEncontrado = "";
            let paragrafoAlvo = null;

            const blocoMatch = itemPai.conteudo.find(bloco => {
                if (!bloco.texto) return false;
                const textoLower = bloco.texto.toLowerCase();
                
                // 1. Match exato com os padrões gerados
                const patternMatch = padroes.find(p => {
                    const escaped = p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    return new RegExp(escaped + "(?!\\d)", "i").test(textoLower);
                });

                if (patternMatch) {
                    snippetEncontrado = criarSnippet(bloco.texto, patternMatch);
                    paragrafoAlvo = bloco.numero_ref;
                    return true;
                }

                // 2. Lógica de Intervalo (Ex: 3:1-10 contém o 3:5)
                const regexIntervalo = new RegExp(`(?:${ref.livro}|${ref.abrev}\\.?)\\s+${ref.cap}:(\\d+)-(\\d+)`, 'gi');
                let matchR;
                while ((matchR = regexIntervalo.exec(textoLower)) !== null) {
                    if (ref.ver >= parseInt(matchR[1]) && ref.ver <= parseInt(matchR[2])) {
                        snippetEncontrado = criarSnippet(bloco.texto, matchR[0]);
                        paragrafoAlvo = bloco.numero_ref;
                        return true;
                    }
                }
                return false;
            });

            if (blocoMatch) {
                const idUnico = (itemPai.titulo || labelExibicao) + ref.livro + ref.cap + ref.ver;
                if (!listaDestino.some(ex => ex._idKey === idUnico)) {
                    listaDestino.push({
                        _idKey: idUnico,
                        titulo: itemPai.titulo || json.titulo || labelExibicao,
                        referencia: `${ref.livro} ${ref.cap}:${ref.ver}`,
                        contexto: labelExibicao,
                        resumo: snippetEncontrado,
                        bridge: {
                            contexto: contextId,
                            sigla: metaFicheiro.sigla,
                            ano: metaFicheiro.ano,
                            mes: metaFicheiro.mes,
                            artigo: itemPai.titulo,
                            capitulo: String(itemPai.capitulo || "").replace(/\D/g, '') || "1",
                            oque: blocoMatch.tipo || "paragrafo",
                            paragrafos: [paragrafoAlvo]
                        }
                    });
                }
            }
        });
    });
}

/**
 * EXPORTAÇÃO PRINCIPAL
 */
export async function processarPesquisaSat(textoBruto, canalId) {
    console.log("🛰️ [X-SAT] Iniciando varredura inteligente...");
    const referencias = extrairReferencias(textoBruto);
    if (referencias.length === 0) return null;

    const resultados = { publicacoes: [], livros: [], multimedia: [] };
    
    // 1. SCAN LIVROS (Lógica Direta)
    for (const sigla of DISPONIVEL_LIVROS) {
        const url = `data/livros/${sigla}.json`;
        const dados = await carregarJson(url);
        if (dados) procurarNoJson(dados, referencias, resultados.livros, `Livro: ${SIGLAS_LIVROS[sigla]}`, url, 'livro');
    }

    // 2. SCAN PUBLICAÇÕES (W, MWB) - APENAS ANOS EXISTENTES
    for (const sigla in SIGLAS_PUBS) {
        if (!['w', 'mwb'].includes(sigla)) continue;

        // FILTRO: Só pesquisa nos anos que realmente temos no repositorio-data.js
        for (const ano of ANOS_DISPONIVEIS) {
            
            // LIMITADOR: Se estiveres a pesquisar algo muito antigo, 
            // podemos saltar para poupar processamento (ex: < 2020)
            if (ano < 2020) continue; 

            for (const m of DISPONIVEL_PUBLICACOES) {
                const url = `data/publicacoes/${sigla}/${ano}/${m}.json`;
                
                // VERIFICAÇÃO "HEAD" ANTES DE CARREGAR (Evita 404 na consola)
                const existe = await fetch(url, { method: 'HEAD' }).then(r => r.ok).catch(() => false);
                
                if (existe) {
                    const dados = await carregarJson(url);
                    if (dados) procurarNoJson(dados, referencias, resultados.publicacoes, `${SIGLAS_PUBS[sigla]} ${m}/${ano}`, url, 'publicacao');
                }
            }
        }
    }

    // 3. SCAN VÍDEOS - APENAS ANOS RECENTES
    for (const ano of ANOS_DISPONIVEIS) {
        if (ano < 2023) continue; // Vídeos só de 2023 para cima
        for (const m of DISPONIVEL_VIDEOS) {
            const url = `data/multimedia/${ano}/${m}.json`;
            const existe = await fetch(url, { method: 'HEAD' }).then(r => r.ok).catch(() => false);
            if (existe) {
                const dados = await carregarJson(url);
                if (dados) procurarNoJson(dados, referencias, resultados.multimedia, `Vídeo ${m}/${ano}`, url, 'multimedia');
            }
        }
    }

    return { resultados, referencias };
}

function criarSnippet(texto, termo) {
    const idx = texto.toLowerCase().indexOf(termo.toLowerCase());
    if (idx === -1) return texto.substring(0, 140) + "...";
    const margem = 80; 
    const inicio = Math.max(0, idx - margem);
    const fim = Math.min(texto.length, idx + termo.length + margem);
    return (inicio > 0 ? "..." : "") + texto.substring(inicio, fim).trim() + (fim < texto.length ? "..." : "");
}

async function carregarJson(url) {
    if (_SATELLITE_DATA_CACHE.has(url)) return _SATELLITE_DATA_CACHE.get(url);
    try {
        const r = await fetch(url);
        const d = r.ok ? await r.json() : null;
        _SATELLITE_DATA_CACHE.set(url, d);
        return d;
    } catch (e) { return null; }
}

