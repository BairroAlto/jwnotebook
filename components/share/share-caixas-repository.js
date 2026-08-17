import {
    collection,
    writeBatch,
    deleteDoc,
    doc,
    getDoc,
    setDoc,
    updateDoc
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

export const COLECAO_CAIXAS_SHARE = "ShareCaixas";

export function obterIdsCaixasShare(dadosNota = {}) {
    const ids = Array.isArray(dadosNota.CaixasOut)
        ? dadosNota.CaixasOut
        : (Array.isArray(dadosNota.caixaIds)
            ? dadosNota.caixaIds
            : (dadosNota.caixas || []).map(caixa => typeof caixa === "string" ? caixa : caixa?.id));
    return [...new Set(ids.filter(Boolean).map(String))];
}

export async function obterCaixasSharePorIds(db, shareId, ids = []) {
    if (!db || !shareId || !ids.length) return new Map();

    const resultados = await Promise.all(ids.map(async id => {
        try {
            const snap = await getDoc(doc(db, COLECAO_CAIXAS_SHARE, String(id)));
            if (!snap.exists()) return null;
            const dados = snap.data();
            if (dados.shareId !== shareId) return null;
            return [String(id), { ...dados, id: snap.id }];
        } catch (erro) {
            console.warn("[SHARECAIXAS] Falha ao ler caixa", id, erro);
            return null;
        }
    }));

    return new Map(resultados.filter(Boolean));
}

/**
 * Lê caixas Share por ID quando a nota de origem ainda não é conhecida.
 * As regras do Firestore continuam a validar o acesso à própria caixa.
 */
export async function obterCaixasShareAcessiveisPorIds(db, ids = [], { incluirOff = false } = {}) {
    if (!db || !ids.length) return new Map();

    const resultados = await Promise.all([...new Set(ids.filter(Boolean).map(String))].map(async id => {
        try {
            const snap = await getDoc(doc(db, COLECAO_CAIXAS_SHARE, id));
            if (!snap.exists()) return null;
            const dados = snap.data();
            if (!incluirOff && dados.estado === "off") return null;
            return [id, { ...dados, id: snap.id, onde: "share" }];
        } catch (erro) {
            // Um ID local/antigo pode não existir em ShareCaixas ou não ser
            // acessível pelo utilizador. Não é uma falha do servidor nem deve
            // activar o aviso global de indisponibilidade.
            if (erro?.code !== 'permission-denied') {
                console.warn("[SHARECAIXAS] Falha ao ler caixa acessível", id, erro);
            }
            return null;
        }
    }));

    return new Map(resultados.filter(Boolean));
}

export async function obterNotasSharePorCaixas(db, caixas = []) {
    const idsNotas = [...new Set([...caixas].map(caixa => caixa?.shareId).filter(Boolean).map(String))];
    const resultados = await Promise.all(idsNotas.map(async notaId => {
        try {
            const snap = await getDoc(doc(db, "Share", notaId));
            return snap.exists() ? [notaId, snap.data()] : null;
        } catch (erro) {
            console.warn("[SHARECAIXAS] Não foi possível ler a nota Share", notaId, erro);
            return null;
        }
    }));
    return new Map(resultados.filter(Boolean));
}
export async function hidratarNotaShareComCaixas(dadosNota = {}, db, notaId = null) {
    if (!db || !notaId || dadosNota.tipo === "pasta") {
        return { ...dadosNota, caixas: dadosNota.caixas || [] };
    }

    const ids = obterIdsCaixasShare(dadosNota);
    if (!ids.length) return { ...dadosNota, caixas: [], CaixasOut: [], caixaIds: [] };

    return {
        ...dadosNota,
        idFirestore: notaId || dadosNota.idFirestore,
        caixas: Array.isArray(dadosNota.caixas) ? dadosNota.caixas : [],
        CaixasOut: ids,
        caixaIds: ids,
        caixasMigradas: Boolean(dadosNota.caixasMigradas)
    };
}
export async function guardarCaixasShareDaNota({
    db,
    ownerId,
    notaId,
    caixas = []
}) {
    if (!db || !ownerId || !notaId) return [];

    const ids = [...new Set(caixas.map(caixa => caixa?.id).filter(Boolean).map(String))];
    const notaSnap = await getDoc(doc(db, "Share", notaId));
    const idsAntigos = notaSnap.exists() ? obterIdsCaixasShare(notaSnap.data()) : [];
    const idsRemovidos = idsAntigos.filter(id => !ids.includes(id));


    const batch = writeBatch(db);
    idsRemovidos.forEach(id => batch.delete(doc(db, COLECAO_CAIXAS_SHARE, String(id))));
    caixas.filter(caixa => caixa?.id).forEach(caixa => {
        const dados = Object.fromEntries(Object.entries({
            ...caixa,
            id: undefined,
            userId: ownerId,
            shareId: notaId,
            estado: caixa.estado || "on"
        }).filter(([, valor]) => valor !== undefined));
        batch.set(doc(db, COLECAO_CAIXAS_SHARE, String(caixa.id)), dados, { merge: true });
    });
    batch.update(doc(db, "Share", notaId), {
        caixas,
        CaixasOut: ids,
        caixaIds: ids,
        caixasMigradas: true
    });
    await batch.commit();
    return ids;
}

export async function actualizarCaixaShare(db, shareId, caixaId, alteracoes = {}) {
    if (!db || !shareId || !caixaId) return;
    const referencia = doc(db, COLECAO_CAIXAS_SHARE, String(caixaId));
    const snap = await getDoc(referencia);
    if (!snap.exists() || snap.data().shareId !== shareId) return;

    const notaSnap = await getDoc(doc(db, "Share", shareId));
    const caixas = notaSnap.exists() && Array.isArray(notaSnap.data().caixas) ? [...notaSnap.data().caixas] : [];
    const caixaActualizada = { ...snap.data(), id: String(caixaId), ...alteracoes };
    const indice = caixas.findIndex(item => String(item?.id) === String(caixaId));
    if (indice >= 0) caixas[indice] = { ...caixas[indice], ...alteracoes };
    else caixas.push(caixaActualizada);
    const ids = [...new Set(caixas.map(caixa => caixa?.id).filter(Boolean).map(String))];

    const batch = writeBatch(db);
    batch.update(referencia, alteracoes);
    if (notaSnap.exists()) {
        batch.update(doc(db, "Share", shareId), { caixas, CaixasOut: ids, caixaIds: ids, caixasMigradas: true });
    }
    await batch.commit();
}

export async function apagarCaixaShare(db, shareId, caixaId) {
    if (!db || !shareId || !caixaId) return;
    const referencia = doc(db, COLECAO_CAIXAS_SHARE, String(caixaId));
    const snap = await getDoc(referencia);
    if (!snap.exists() || snap.data().shareId !== shareId) return;

    const notaSnap = await getDoc(doc(db, "Share", shareId));
    const caixas = notaSnap.exists() && Array.isArray(notaSnap.data().caixas)
        ? notaSnap.data().caixas.filter(item => String(item?.id) !== String(caixaId))
        : [];
    const ids = [...new Set(caixas.map(caixa => caixa?.id).filter(Boolean).map(String))];

    const batch = writeBatch(db);
    batch.delete(referencia);
    if (notaSnap.exists()) {
        batch.update(doc(db, "Share", shareId), { caixas, CaixasOut: ids, caixaIds: ids, caixasMigradas: true });
    }
    await batch.commit();
}

export async function migrarNotaParaShareCaixas(db, docSnap) {
    const dados = docSnap.data() || {};
    if (dados.tipo === "pasta") return { notaId: docSnap.id, caixas: 0, ids: [] };
    const caixas = Array.isArray(dados.caixas) ? dados.caixas.filter(caixa => caixa?.id) : [];
    const ownerId = dados.userId;
    if (!ownerId) return { notaId: docSnap.id, caixas: 0, ids: [] };
    const ids = await guardarCaixasShareDaNota({ db, ownerId, notaId: docSnap.id, caixas });
    return { notaId: docSnap.id, caixas: caixas.length, ids };
}
