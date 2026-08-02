import {
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    query,
    setDoc,
    updateDoc,
    where,
    writeBatch
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

export const COLECAO_CAIXAS = "LocalCaixas";

export function obterIdsCaixas(dadosNota = {}) {
    const ids = Array.isArray(dadosNota.CaixasOut)
        ? dadosNota.CaixasOut
        : (Array.isArray(dadosNota.caixaIds)
            ? dadosNota.caixaIds
            : (dadosNota.caixas || []).map(caixa => typeof caixa === "string" ? caixa : caixa?.id));
    return [...new Set(ids.filter(Boolean).map(String))];
}

function mapaCaixas(caixas = []) {
    return new Map(caixas.filter(caixa => caixa?.id).map(caixa => [String(caixa.id), caixa]));
}

export async function obterCaixasPorIds(db, userId, ids = [], { incluirOff = false } = {}) {
    if (!db || !userId || !ids.length) return new Map();

    const resultados = await Promise.all(ids.map(async id => {
        try {
            const snap = await getDoc(doc(db, COLECAO_CAIXAS, String(id)));
            if (!snap.exists()) return null;
            const dados = snap.data();
            if (dados.userId !== userId || (!incluirOff && dados.estado === "off")) return null;
            return [String(id), { ...dados, id: snap.id }];
        } catch (erro) {
            console.warn("[LOCALCAIXAS] Falha ao ler caixa", id, erro);
            return null;
        }
    }));

    return new Map(resultados.filter(Boolean));
}

export async function obterNotasPorCaixas(db, caixas = []) {
    const idsNotas = [...new Set(caixas.map(caixa => caixa?.localDocId).filter(Boolean))];
    const resultados = await Promise.all(idsNotas.map(async notaId => {
        try {
            const snap = await getDoc(doc(db, "Local", notaId));
            return snap.exists() ? [notaId, snap.data()] : null;
        } catch (_) {
            return null;
        }
    }));
    return new Map(resultados.filter(Boolean));
}

export async function obterCaixasLocais(db, userId, { incluirLegacy = true } = {}) {
    if (!db || !userId) return { caixas: [], notas: new Map() };

    const snapCaixas = await getDocs(query(
        collection(db, COLECAO_CAIXAS),
        where("userId", "==", userId)
    ));
    const caixas = snapCaixas.docs.map(docSnap => ({
        ...docSnap.data(),
        id: docSnap.id
    }));

    let snapNotas = null;
    if (incluirLegacy) {
        snapNotas = await getDocs(query(
            collection(db, "Local"),
            where("userId", "==", userId)
        ));
        snapNotas.forEach(docSnap => {
            const dados = docSnap.data();
            if (dados.caixasMigradas || Array.isArray(dados.caixaIds) || Array.isArray(dados.CaixasOut)) return;
            (dados.caixas || []).forEach(caixa => {
                if (!caixa?.id || caixas.some(item => String(item.id) === String(caixa.id))) return;
                caixas.push({ ...caixa, localDocId: docSnap.id });
            });
        });
    }

    const notas = await obterNotasPorCaixas(db, caixas);
    snapNotas?.forEach(docSnap => notas.set(docSnap.id, docSnap.data()));
    return { caixas, notas };
}

export async function hidratarNotaComCaixas(dadosNota = {}, db, auth, notaId = null) {
    if (!db || !auth?.currentUser || dadosNota.onde === "share" || dadosNota.tipo === "pasta") {
        return { ...dadosNota, caixas: dadosNota.caixas || [] };
    }

    const ids = obterIdsCaixas(dadosNota);
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

export async function guardarCaixasDaNota({ db, userId, notaId, caixas = [] }) {
    if (!db || !userId || !notaId) return [];

    const ids = [...new Set(caixas.map(caixa => caixa?.id).filter(Boolean).map(String))];
    const batch = writeBatch(db);
    caixas.filter(caixa => caixa?.id).forEach(caixa => {
        const dados = Object.fromEntries(Object.entries({
            ...caixa,
            id: undefined,
            userId,
            localDocId: notaId,
            estado: caixa.estado || "on"
        }).filter(([, valor]) => valor !== undefined));
        batch.set(doc(db, COLECAO_CAIXAS, String(caixa.id)), dados, { merge: true });
    });
    batch.update(doc(db, "Local", notaId), {
        caixas,
        CaixasOut: ids,
        caixaIds: ids,
        caixasMigradas: true
    });
    await batch.commit();
    return ids;
}

export async function guardarCaixaLocal(db, userId, notaId, caixa) {
    if (!db || !userId || !notaId || !caixa?.id) return;
    const notaSnap = await getDoc(doc(db, "Local", notaId));
    const caixas = notaSnap.exists() && Array.isArray(notaSnap.data().caixas) ? [...notaSnap.data().caixas] : [];
    const indice = caixas.findIndex(item => String(item?.id) === String(caixa.id));
    if (indice >= 0) caixas[indice] = { ...caixas[indice], ...caixa };
    else caixas.push(caixa);
    await guardarCaixasDaNota({ db, userId, notaId, caixas });
}

export async function actualizarCaixaLocal(db, userId, caixaId, alteracoes = {}) {
    if (!db || !userId || !caixaId) return;
    const referencia = doc(db, COLECAO_CAIXAS, String(caixaId));
    const snap = await getDoc(referencia);
    if (!snap.exists() || snap.data().userId !== userId) return;

    const notaId = snap.data().localDocId;
    const notaSnap = notaId ? await getDoc(doc(db, "Local", notaId)) : null;
    const caixas = notaSnap?.exists() && Array.isArray(notaSnap.data().caixas) ? [...notaSnap.data().caixas] : [];
    const caixaActualizada = { ...snap.data(), id: String(caixaId), ...alteracoes };
    const indice = caixas.findIndex(item => String(item?.id) === String(caixaId));
    if (indice >= 0) caixas[indice] = { ...caixas[indice], ...alteracoes };
    else caixas.push(caixaActualizada);
    const ids = [...new Set(caixas.map(caixa => caixa?.id).filter(Boolean).map(String))];

    const batch = writeBatch(db);
    batch.update(referencia, alteracoes);
    if (notaId && notaSnap?.exists()) {
        batch.update(doc(db, "Local", notaId), { caixas, CaixasOut: ids, caixaIds: ids, caixasMigradas: true });
    }
    await batch.commit();
}

export async function apagarCaixaLocal(db, userId, caixaId) {
    if (!db || !userId || !caixaId) return;
    const referencia = doc(db, COLECAO_CAIXAS, String(caixaId));
    const snap = await getDoc(referencia);
    if (!snap.exists() || snap.data().userId !== userId) return;

    const notaId = snap.data().localDocId;
    const notaSnap = notaId ? await getDoc(doc(db, "Local", notaId)) : null;
    const caixas = notaSnap?.exists() && Array.isArray(notaSnap.data().caixas)
        ? notaSnap.data().caixas.filter(item => String(item?.id) !== String(caixaId))
        : [];
    const ids = [...new Set(caixas.map(caixa => caixa?.id).filter(Boolean).map(String))];

    const batch = writeBatch(db);
    batch.delete(referencia);
    if (notaId && notaSnap?.exists()) {
        batch.update(doc(db, "Local", notaId), { caixas, CaixasOut: ids, caixaIds: ids, caixasMigradas: true });
    }
    await batch.commit();
}

export async function migrarNotaParaLocalCaixas(db, userId, docSnap) {
    const dados = docSnap.data() || {};
    const caixas = Array.isArray(dados.caixas) ? dados.caixas.filter(caixa => caixa?.id) : [];
    const ids = await guardarCaixasDaNota({ db, userId, notaId: docSnap.id, caixas });
    return { notaId: docSnap.id, caixas: caixas.length, ids };
}

export async function migrarLocalCompleto(db, userId, snapshot, opcoes = {}) {
    const resultados = [];
    for (const docSnap of snapshot.docs) {
        const dados = docSnap.data() || {};
        if (dados.tipo === "pasta" || !Array.isArray(dados.caixas)) continue;
        resultados.push(await migrarNotaParaLocalCaixas(db, userId, docSnap, opcoes));
    }
    return resultados;
}