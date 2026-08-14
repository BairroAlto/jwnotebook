import {
    collection,
    getDocs,
    query,
    where
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { mostrarAvisoServidorIndisponivel } from '../ui/server-status-banner.js';

// Dez referências por consulta mantém compatibilidade com os operadores
// compostos usados pelo projecto e evita rajadas grandes contra o Firestore.
const MAX_REFERENCIAS_POR_CONSULTA = 10;
const DURACAO_CACHE_COM_CONTEUDO_MS = 2 * 60 * 1000;
const DURACAO_CACHE_SEM_CONTEUDO_MS = 30 * 1000;
const DURACAO_CACHE_APOS_ERRO_MS = 15 * 1000;

let utilizadorCache = null;
const cacheConteudo = new Map();

function dividirEmLotes(valores, tamanho = MAX_REFERENCIAS_POR_CONSULTA) {
    const lotes = [];
    for (let indice = 0; indice < valores.length; indice += tamanho) {
        lotes.push(valores.slice(indice, indice + tamanho));
    }
    return lotes;
}

function filtroLista(campo, valores, operadorUnico, operadorMultiplo) {
    return valores.length === 1
        ? where(campo, operadorUnico, valores[0])
        : where(campo, operadorMultiplo, valores);
}

function temConteudoNoTextoBiblico(dados = {}) {
    const temPuzzle = Boolean(
        (dados.Puzzle && (
            (Array.isArray(dados.Puzzle.quadros) && dados.Puzzle.quadros.length > 0) ||
            (Array.isArray(dados.Puzzle.blocos) && dados.Puzzle.blocos.length > 0)
        )) ||
        (Array.isArray(dados.Blocos) && dados.Blocos.length > 0) ||
        (Array.isArray(dados.textos) && dados.textos.length > 0)
    );

    const temFontes = Boolean(
        dados.Fontes && (
            (Array.isArray(dados.Fontes.Links) && dados.Fontes.Links.length > 0) ||
            (Array.isArray(dados.Fontes.codex) && dados.Fontes.codex.length > 0) ||
            (Array.isArray(dados.Fontes) && dados.Fontes.length > 0)
        )
    );

    const temDossie = Boolean(
        (Array.isArray(dados.Micas) && dados.Micas.length > 0) ||
        (Array.isArray(dados.Dossies) && dados.Dossies.length > 0)
    );

    return temPuzzle || temFontes || temDossie || dados.marcador === "sim";
}

function registarCaixasComConteudo(snapshot, referenciasAlvo, resultado) {
    snapshot.docs.forEach(docSnap => {
        const dados = docSnap.data() || {};
        if (dados.origem === "copia") return;

        (dados.neuroniosBiba || []).forEach(referencia => {
            const nome = String(referencia);
            if (referenciasAlvo.has(nome)) resultado.add(nome);
        });
    });
}

function registarTextosComConteudo(snapshot, referenciasAlvo, resultado) {
    snapshot.docs.forEach(docSnap => {
        const dados = docSnap.data() || {};
        const nome = String(dados.nome || "");
        if (referenciasAlvo.has(nome) && temConteudoNoTextoBiblico(dados)) {
            resultado.add(nome);
        }
    });
}

async function consultarLote(db, uid, referencias) {
    const referenciasAlvo = new Set(referencias);
    const filtroNome = filtroLista("nome", referencias, "==", "in");
    const filtroNeuronios = filtroLista(
        "neuroniosBiba",
        referencias,
        "array-contains",
        "array-contains-any"
    );

    const consultas = [
        {
            origem: "TextosBiblia",
            consulta: query(
                collection(db, "TextosBiblia"),
                where("userId", "==", uid),
                filtroNome
            ),
            registar: registarTextosComConteudo
        },
        {
            origem: "LocalCaixas",
            consulta: query(
                collection(db, "LocalCaixas"),
                where("userId", "==", uid),
                filtroNeuronios
            ),
            registar: registarCaixasComConteudo
        },
        {
            origem: "ShareCaixas",
            consulta: query(
                collection(db, "ShareCaixas"),
                where("userId", "==", uid),
                filtroNeuronios
            ),
            registar: registarCaixasComConteudo
        }
    ];

    const respostas = await Promise.allSettled(
        consultas.map(item => getDocs(item.consulta))
    );
    const comConteudo = new Set();
    let consultaCompleta = true;

    respostas.forEach((resposta, indice) => {
        const configuracao = consultas[indice];
        if (resposta.status === "fulfilled") {
            configuracao.registar(resposta.value, referenciasAlvo, comConteudo);
            return;
        }

        consultaCompleta = false;
        mostrarAvisoServidorIndisponivel(resposta.reason);
        console.warn(
            `[EYE-BIBLE][${configuracao.origem}] Não foi possível consultar as referências:`,
            resposta.reason
        );
    });

    return { comConteudo, consultaCompleta };
}

/**
 * Resolve apenas as referências visíveis no EYE. Os resultados são partilhados
 * entre notas durante alguns minutos para impedir leituras repetidas.
 */
export async function obterEstadoConteudoBiblico(referencias = [], db, auth) {
    const uid = auth?.currentUser?.uid;
    const nomes = [...new Set(referencias.filter(Boolean).map(String))];
    const resultado = new Map(nomes.map(nome => [nome, false]));
    if (!db || !uid || !nomes.length) return resultado;

    if (utilizadorCache !== uid) {
        cacheConteudo.clear();
        utilizadorCache = uid;
    }

    const agora = Date.now();
    const porConsultar = [];

    nomes.forEach(nome => {
        const entrada = cacheConteudo.get(nome);
        if (entrada && entrada.expiraEm > agora) {
            resultado.set(nome, entrada.temConteudo);
        } else {
            cacheConteudo.delete(nome);
            porConsultar.push(nome);
        }
    });

    for (const lote of dividirEmLotes(porConsultar)) {
        const { comConteudo, consultaCompleta } = await consultarLote(db, uid, lote);
        lote.forEach(nome => {
            const temConteudo = comConteudo.has(nome);
            const duracao = consultaCompleta
                ? (temConteudo
                    ? DURACAO_CACHE_COM_CONTEUDO_MS
                    : DURACAO_CACHE_SEM_CONTEUDO_MS)
                : DURACAO_CACHE_APOS_ERRO_MS;
            resultado.set(nome, temConteudo);
            cacheConteudo.set(nome, {
                temConteudo,
                expiraEm: Date.now() + duracao
            });
        });
    }

    return resultado;
}

export function invalidarCacheConteudoBiblico(referencias = null) {
    if (!Array.isArray(referencias)) {
        cacheConteudo.clear();
        return;
    }

    referencias.filter(Boolean).forEach(nome => cacheConteudo.delete(String(nome)));
}
