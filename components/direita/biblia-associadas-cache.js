import { collection, doc, getDoc, onSnapshot, query, where } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { COLECAO_CAIXAS, obterCaixasPorIds, obterNotasPorCaixas } from "../local/caixas-repository.js";
import { obterCaixasShareAcessiveisPorIds, obterNotasSharePorCaixas } from "../share/share-caixas-repository.js";

const entradas = new Map();
const TEMPO_RETENCAO_MS = 15000;
const TEMPO_LIMITE_MS = 15000;

function criarChave(uid, nomeVersiculo) {
    return String(uid) + "::" + String(nomeVersiculo);
}

function notificar(entrada, meta) {
    entrada.ouvintes.forEach(ouvinte => ouvinte(entrada.mapa, meta));
}

async function obterDadosNotas(db, caixas) {
    const idsNotas = [...new Set(caixas.map(caixa => caixa.localDocId).filter(Boolean))];
    const resultados = await Promise.all(idsNotas.map(async notaId => {
        try {
            const snap = await getDoc(doc(db, "Local", notaId));
            return snap.exists() ? [notaId, snap.data()] : null;
        } catch (erro) {
            console.warn("[BIBLE-BOX-PERF] Não foi possível ler a nota Local", notaId, erro);
            return null;
        }
    }));
    return new Map(resultados.filter(Boolean));
}

function obterEntrada(nomeVersiculo, db, uid) {
    const chave = criarChave(uid, nomeVersiculo);
    let entrada = entradas.get(chave);

    if (entrada) {
        entrada.expiraEm = Date.now() + TEMPO_RETENCAO_MS;
        return entrada;
    }

    entrada = {
        mapa: {},
        pronta: false,
        erro: null,
        inicio: performance.now(),
        ouvintes: new Set(),
        cancelar: null,
        expiraEm: Date.now() + TEMPO_RETENCAO_MS,
        temporizador: null,
        temporizadorTimeout: null
    };

    const qCaixas = query(
        collection(db, COLECAO_CAIXAS),
        where("userId", "==", uid),
        where("estado", "==", "on"),
        where("neuroniosBiba", "array-contains", nomeVersiculo)
    );

    entrada.cancelar = onSnapshot(
        qCaixas,
        { includeMetadataChanges: true },
        async (snap) => {
            clearTimeout(entrada.temporizadorTimeout);
            const caixas = snap.docs
                .map(docSnap => ({ ...docSnap.data(), id: docSnap.id }))
                // Cópias partilhadas pertencem à nota de destino e não à Bíblia.
                .filter(caixa => caixa.origem !== "copia");
            const notas = await obterDadosNotas(db, caixas);
            const mapa = {};

            caixas.forEach(caixa => {
                mapa[caixa.id] = {
                    ...caixa,
                    notaDocId: caixa.localDocId || caixa.shareId || null,
                    notaDadosCompletos: notas.get(caixa.localDocId || caixa.shareId) || null
                };
            });

            entrada.mapa = mapa;
            entrada.pronta = true;
            entrada.erro = null;
            console.log("[BIBLE-BOX-PERF] " + nomeVersiculo + " | LocalCaixas recebido em " + (performance.now() - entrada.inicio).toFixed(1) + "ms | caixas: " + Object.keys(mapa).length + " | cache: " + (snap.metadata.fromCache ? "sim" : "nao"));
            notificar(entrada, { snap, erro: null });
        },
        (erro) => {
            clearTimeout(entrada.temporizadorTimeout);
            entrada.pronta = true;
            entrada.erro = erro;
            console.error("[BIBLE-BOX-PERF] " + nomeVersiculo + " | erro apos " + (performance.now() - entrada.inicio).toFixed(1) + "ms", erro);
            notificar(entrada, { snap: null, erro });
        }
    );

    entrada.temporizadorTimeout = setTimeout(() => {
        if (entrada.pronta) return;
        const erro = new Error("Tempo limite ao carregar as caixas associadas");
        entrada.pronta = true;
        entrada.erro = erro;
        console.error("[BIBLE-BOX-PERF] " + nomeVersiculo + " | timeout apos " + TEMPO_LIMITE_MS + "ms");
        notificar(entrada, { snap: null, erro });
    }, TEMPO_LIMITE_MS);

    entradas.set(chave, entrada);
    return entrada;
}

function agendarLimpeza(chave, entrada) {
    clearTimeout(entrada.temporizador);
    entrada.temporizador = setTimeout(() => {
        if (entrada.ouvintes.size > 0 || Date.now() < entrada.expiraEm) {
            agendarLimpeza(chave, entrada);
            return;
        }
        entrada.cancelar?.();
        clearTimeout(entrada.temporizadorTimeout);
        entradas.delete(chave);
    }, TEMPO_RETENCAO_MS);
}

export function subscreverCaixasPorIds(ids = [], db, uid, ouvinte) {
let ativo = true;
    const inicio = performance.now();
    const temporizador = setTimeout(() => {
        if (!ativo) return;
        ativo = false;
        const erro = new Error("Tempo limite ao ler as caixas por ID");
        console.error("[BIBLE-BOX-PERF] IDs LocalCaixas | timeout apos 15000ms");
        ouvinte({}, { snap: null, erro });
    }, 15000);
    const idsNormalizados = [...new Set(ids.filter(Boolean).map(String))];

    Promise.resolve().then(async () => {
        const caixasLocaisMap = await obterCaixasPorIds(db, uid, idsNormalizados);
        const idsShare = idsNormalizados.filter(id => !caixasLocaisMap.has(id));
        const caixasShareMap = await obterCaixasShareAcessiveisPorIds(db, idsShare);
        const caixasLocais = [...caixasLocaisMap.values()];
        const caixasShare = [...caixasShareMap.values()];
        const caixas = [...caixasLocais, ...caixasShare];
        const [notasLocais, notasShare] = await Promise.all([
            obterNotasPorCaixas(db, caixasLocais),
            obterNotasSharePorCaixas(db, caixasShare)
        ]);
        const notas = new Map([...notasLocais, ...notasShare]);
        const mapa = {};
        caixas.forEach(caixa => {
            mapa[caixa.id] = {
                ...caixa,
                notaDocId: caixa.localDocId || caixa.shareId || null,
                notaDadosCompletos: notas.get(caixa.localDocId || caixa.shareId) || null
            };
        });
        if (!ativo) return;
        clearTimeout(temporizador);
        console.log("[BIBLE-BOX-PERF] IDs LocalCaixas/ShareCaixas recebidos em " + (performance.now() - inicio).toFixed(1) + "ms | pedidos: " + idsNormalizados.length + " | caixas: " + Object.keys(mapa).length);
        ouvinte(mapa, { snap: null, erro: null });
    }).catch(erro => {
        if (!ativo) return;
        clearTimeout(temporizador);
        console.error("[BIBLE-BOX-PERF] Falha ao ler IDs de LocalCaixas", erro);
        ouvinte({}, { snap: null, erro });
    });

    return () => { ativo = false; };
}
export function subscreverCaixasAssociadas(nomeVersiculo, db, uid, ouvinte) {
    const chave = criarChave(uid, nomeVersiculo);
    const entrada = obterEntrada(nomeVersiculo, db, uid);
    entrada.ouvintes.add(ouvinte);
    if (entrada.pronta) {
        queueMicrotask(() => ouvinte(entrada.mapa, { snap: null, erro: entrada.erro }));
    }
    return () => {
        entrada.ouvintes.delete(ouvinte);
        entrada.expiraEm = Date.now() + TEMPO_RETENCAO_MS;
        agendarLimpeza(chave, entrada);
    };
}

export function aquecerCaixasAssociadas(nomeVersiculo, db, uid) {
    const chave = criarChave(uid, nomeVersiculo);
    const entrada = obterEntrada(nomeVersiculo, db, uid);
    entrada.expiraEm = Date.now() + TEMPO_RETENCAO_MS;
    agendarLimpeza(chave, entrada);
}
