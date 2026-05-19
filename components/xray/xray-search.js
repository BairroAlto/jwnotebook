// components/xray/xray-search.js
import { processarPesquisaSat } from '../direita/xsat-engine.js';
import { state } from './xray-state.js';
import { STOPWORDS } from './xray-stopwords.js';
import { DISPONIVEL_LIVROS, ANOS_DISPONIVEIS, DISPONIVEL_PUBLICACOES } from '../lists/repositorio-data.js';

export async function executarAnaliseProfunda(texto) {
    console.log("🔍 [SEARCH] Iniciando Varredura...");

    // 1. PESQUISA BÍBLICA (Satélite)
    // O satélite já identifica as referências reais (ex: Mateus 4:3-5)
    const resSat = await processarPesquisaSat(texto, "XRAY");
    state.resultadosCache = resSat || { referencias: [], resultados: { publicacoes: [], livros: [], multimedia: [] } };

    // 🚀 2. LIMPEZA INTELIGENTE PARA PALAVRAS-CHAVE
    // Regex que identifica padrões bíblicos (Livro Numero:Numero ou Livro Numero.Numero)
    // Isso evita que "Mateus" ou "Jó" entrem na busca semântica se fizerem parte de uma citação.
    const padraoBiblico = /([1-3]?\s?[a-zA-Zá-üÀ-ú]+\s\d+[:.]\d+([-]\d+)?)/gi;
    const textoParaPalavras = texto.replace(padraoBiblico, ' ');

    // 3. EXTRAÇÃO DE PALAVRAS-CHAVE (No texto limpo de citações)
    const palavras = textoParaPalavras.split(/\W+/)
        .map(p => p.toLowerCase())
        .filter(p => p.length > 3 && !STOPWORDS.includes(p));
    
    state.palavrasDetetadas = [...new Set(palavras)];

    // 4. PESQUISA SEMÂNTICA (Varredura de Repositório)
    state.resultadosPalavrasCache = {};
    if (state.palavrasDetetadas.length > 0) {
        await realizarVarreduraFullRepository();
    }

    // 5. BÍBLIA CACHE (Versículos puros para a aba Bíblia)
    state.textosBiblicosCache = {};
    if (state.resultadosCache.referencias) {
        const promessas = state.resultadosCache.referencias.map(async (ref) => {
            const nomeRef = `${ref.livro} ${ref.cap}:${ref.ver}`;
            state.textosBiblicosCache[nomeRef] = await buscarTextoBiblico(ref.livro, ref.cap, ref.ver);
        });
        await Promise.all(promessas);
    }
}

/**
 * VARRE OS FICHEIROS JSON À PROCURA DAS PALAVRAS-CHAVE
 */
async function realizarVarreduraFullRepository() {
    const palavras = state.palavrasDetetadas;
    const anoAtual = new Date().getFullYear();
    const mesAtual = new Date().getMonth() + 1;

    const anosValidos = ANOS_DISPONIVEIS.filter(a => a <= anoAtual).slice(0, 3); 
    const categorias = ['w', 'mwb'];

    let urls = DISPONIVEL_LIVROS.map(s => `data/livros/${s}.json`);
    
    anosValidos.forEach(ano => {
        categorias.forEach(cat => {
            DISPONIVEL_PUBLICACOES.forEach(mes => {
                const numMes = parseInt(mes.split('_')[0]);
                if (ano === anoAtual && numMes > (mesAtual + 1)) return; 
                urls.push(`data/publicacoes/${cat}/${ano}/${mes}.json`);
            });
        });
    });

    const promessasScan = urls.map(async (url) => {
        try {
            const check = await fetch(url, { method: 'HEAD' });
            if (!check.ok) return;

            const res = await fetch(url);
            const json = await res.json();
            const blocosPai = json.artigos || json.capitulos || (json.video ? [json.video] : []);
            
            blocosPai.forEach(artigo => {
                palavras.forEach(palavra => {
                    const titulo = (artigo.titulo || "").toLowerCase();
                    const conteudoFull = (artigo.conteudo || []).map(c => c.texto).join(" ").toLowerCase();
                    
                    const noTitulo = titulo.includes(palavra);
                    const contagem = (conteudoFull.split(palavra).length - 1);
                    const densidadeAlta = contagem >= 9;

                    if (noTitulo || densidadeAlta) {
                        if (!state.resultadosPalavrasCache[palavra]) state.resultadosPalavrasCache[palavra] = [];
                        
                        state.resultadosPalavrasCache[palavra].push({
                            titulo: artigo.titulo || json.titulo || "Sem Título",
                            contexto: noTitulo ? "Foco no Título" : "Alta Densidade",
                            resumo: densidadeAlta ? `A palavra aparece ${contagem} vezes neste artigo.` : `Detetado no título.`,
                            referencia: palavra.toUpperCase(),
                            bridge: {
                                contexto: url.includes('livros') ? 'livro' : 'publicacao',
                                sigla: json.id || url.split('/').pop().replace('.json', ''),
                                ano: url.includes('livros') ? "" : url.split('/')[2] === 'publicacoes' ? url.split('/')[4] : url.split('/')[3],
                                mes: url.split('/').pop().replace('.json', ''),
                                artigo: artigo.titulo,
                                capitulo: String(artigo.capitulo || "1"),
                                paragrafos: artigo.conteudo && artigo.conteudo[0] ? [artigo.conteudo[0].numero_ref] : ["1"]
                            }
                        });
                    }
                });
            });
        } catch (e) {}
    });

    await Promise.all(promessasScan);
}

async function buscarTextoBiblico(livro, cap, ver) {
    try {
        const slug = livro.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '_');
        const res = await fetch(`data/biblia/${slug}.json`);
        if (!res.ok) return null;
        const data = await res.json();
        return data[livro][cap][ver];
    } catch (e) { return null; }
}