import {
    deleteDoc,
    doc,
    getDoc,
    setDoc,
    updateDoc
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { COLECAO_CAIXAS } from "../local/caixas-repository.js";
import { COLECAO_CAIXAS_SHARE } from "../share/share-caixas-repository.js";
import { guardarNoArquivoReciclagem } from "./recycle-blackbox-archive.js";

const PARES = {
    Local: { pai: "Local", caixas: COLECAO_CAIXAS, campoPai: "localDocId" },
    [COLECAO_CAIXAS]: { pai: "Local", caixas: COLECAO_CAIXAS, campoPai: "localDocId" },
    Share: { pai: "Share", caixas: COLECAO_CAIXAS_SHARE, campoPai: "shareId" },
    [COLECAO_CAIXAS_SHARE]: { pai: "Share", caixas: COLECAO_CAIXAS_SHARE, campoPai: "shareId" }
};

export function obterParCaixa(origem = "") {
    return PARES[origem] || null;
}

async function lerParCaixa({ db, origem, parentId, caixaId }) {
    const par = obterParCaixa(origem);
    if (!db || !par || !parentId || !caixaId) return null;

    const [resultadoPai, resultadoCaixa] = await Promise.allSettled([
        getDoc(doc(db, par.pai, String(parentId))),
        getDoc(doc(db, par.caixas, String(caixaId)))
    ]);
    if (resultadoPai.status === "rejected" && resultadoCaixa.status === "rejected") {
        throw resultadoCaixa.reason || resultadoPai.reason;
    }

    const paiSnap = resultadoPai.status === "fulfilled" ? resultadoPai.value : null;
    const caixaSnap = resultadoCaixa.status === "fulfilled" ? resultadoCaixa.value : null;
    const pai = paiSnap?.exists() ? { id: paiSnap.id, ...paiSnap.data() } : null;
    const caixaExterna = caixaSnap?.exists() ? { id: caixaSnap.id, ...caixaSnap.data() } : null;
    const caixaPrincipal = pai?.caixas?.find(item => String(item?.id) === String(caixaId)) || null;
    const userId = caixaExterna?.userId || pai?.userId || null;

    return { par, parentId: String(parentId), caixaId: String(caixaId), pai, caixaExterna, caixaPrincipal, userId };
}

function idsDasCaixas(caixas = []) {
    return [...new Set(caixas.map(caixa => caixa?.id).filter(Boolean).map(String))];
}

function caixaComEstado(caixa, caixaId) {
    return {
        ...(caixa || {}),
        id: String(caixaId),
        estado: "on",
        timedelete: null
    };
}

/**
 * Guarda no Blackbox as duas representações da mesma caixa.
 * Uma entrada Blackbox representa o par completo e evita duplicados difíceis de restaurar.
 */
async function guardarParNaBlackbox(parCaixa) {
    const { par, parentId, caixaId, pai, caixaExterna, caixaPrincipal, userId } = parCaixa;
    const caixaBase = caixaExterna || caixaPrincipal || {};
    const idArquivo = ["reciclagem", userId || pai?.userId, par.caixas, parentId, caixaId]
        .map(valor => encodeURIComponent(String(valor)))
        .join("__");
    await guardarNoArquivoReciclagem({
        db: par.db,
        arquivoId: idArquivo,
        userId: userId || pai?.userId,
        dados: {
            ...caixaBase,
            caixaPrincipal: caixaPrincipal ? { ...caixaPrincipal } : null,
            caixaExterna: caixaExterna ? { ...caixaExterna } : null,
        },
        camposIndice: {
            originalId: caixaId,
            originalCollection: par.caixas,
            originalParentId: parentId,
            originalParentCollection: par.pai,
            tipoItem: "caixa"
        }
    });
}

export async function eliminarParCaixa({ db, origem, parentId, caixaId, userId }) {
    const parCaixa = await lerParCaixa({ db, origem, parentId, caixaId });
    if (!parCaixa || !parCaixa.caixaExterna && !parCaixa.caixaPrincipal) return false;
    if (userId && parCaixa.userId !== userId) {
        throw new Error("A caixa não pertence ao utilizador autenticado.");
    }

    await guardarParNaBlackbox({ ...parCaixa, par: { ...parCaixa.par, db } });

    if (parCaixa.caixaExterna) {
        await deleteDoc(doc(db, parCaixa.par.caixas, parCaixa.caixaId));
    }
    if (parCaixa.pai && (!userId || parCaixa.pai.userId === userId)) {
        const caixas = Array.isArray(parCaixa.pai.caixas)
            ? parCaixa.pai.caixas.filter(item => String(item?.id) !== parCaixa.caixaId)
            : [];
        await updateDoc(doc(db, parCaixa.par.pai, parCaixa.parentId), {
            caixas,
            CaixasOut: idsDasCaixas(caixas),
            caixaIds: idsDasCaixas(caixas),
            caixasMigradas: true
        });
    }
    return true;
}

export async function restaurarParCaixa({ db, origem, parentId, caixaId, userId }) {
    const parCaixa = await lerParCaixa({ db, origem, parentId, caixaId });
    if (!parCaixa || !parCaixa.caixaExterna && !parCaixa.caixaPrincipal) return false;
    if (userId && parCaixa.userId !== userId) return false;

    const caixaRestaurada = caixaComEstado(parCaixa.caixaExterna || parCaixa.caixaPrincipal, parCaixa.caixaId);
    caixaRestaurada.userId = parCaixa.userId || userId;
    caixaRestaurada[parCaixa.par.campoPai] = parCaixa.parentId;
    const { id: _id, ...dadosCaixaRestaurada } = caixaRestaurada;
    await setDoc(doc(db, parCaixa.par.caixas, parCaixa.caixaId), {
        ...dadosCaixaRestaurada
    }, { merge: true });

    if (parCaixa.pai) {
        const caixas = Array.isArray(parCaixa.pai.caixas) ? [...parCaixa.pai.caixas] : [];
        const indice = caixas.findIndex(item => String(item?.id) === parCaixa.caixaId);
        const caixaPrincipal = caixaComEstado(parCaixa.caixaPrincipal || caixaRestaurada, parCaixa.caixaId);
        if (indice >= 0) caixas[indice] = { ...caixas[indice], ...caixaPrincipal };
        else caixas.push(caixaPrincipal);
        await updateDoc(doc(db, parCaixa.par.pai, parCaixa.parentId), {
            caixas,
            CaixasOut: idsDasCaixas(caixas),
            caixaIds: idsDasCaixas(caixas),
            caixasMigradas: true
        });
    }
    return true;
}
