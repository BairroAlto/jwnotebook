import {
    doc,
    getDoc,
    writeBatch
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

export const COLECAO_CAIXAS_PALCO = "PalcoCaixas";

export function obterIdsCaixasPalco(dadosPalco = {}) {
    const ids = Array.isArray(dadosPalco.CaixasOut)
        ? dadosPalco.CaixasOut
        : (Array.isArray(dadosPalco.caixaIds)
            ? dadosPalco.caixaIds
            : (dadosPalco.caixas || []).map(caixa => typeof caixa === "string" ? caixa : caixa?.id));
    return [...new Set(ids.filter(Boolean).map(String))];
}

function prepararCaixa(caixa, userId, palcoId) {
    return Object.fromEntries(Object.entries({
        ...caixa,
        id: undefined,
        userId,
        palcoId,
        estado: caixa.estado || "on"
    }).filter(([, valor]) => valor !== undefined));
}

export async function guardarCaixasPalcoDaNota({
    db,
    userId,
    palcoId,
    caixas = [],
    camposPalco = {}
}) {
    if (!db || !userId || !palcoId) return [];

    const palcoRef = doc(db, "Palco", String(palcoId));
    const palcoSnap = await getDoc(palcoRef);
    if (!palcoSnap.exists() || palcoSnap.data().userId !== userId) return [];

    const ids = [...new Set(caixas.map(caixa => caixa?.id).filter(Boolean).map(String))];
    const idsAntigos = obterIdsCaixasPalco(palcoSnap.data());
    const batch = writeBatch(db);

    idsAntigos
        .filter(id => !ids.includes(id))
        .forEach(id => batch.delete(doc(db, COLECAO_CAIXAS_PALCO, id)));

    caixas
        .filter(caixa => caixa?.id)
        .forEach(caixa => batch.set(
            doc(db, COLECAO_CAIXAS_PALCO, String(caixa.id)),
            prepararCaixa(caixa, userId, String(palcoId)),
            { merge: true }
        ));

    batch.update(palcoRef, {
        ...camposPalco,
        caixas,
        CaixasOut: ids,
        caixaIds: ids,
        caixasMigradas: true
    });

    await batch.commit();
    return ids;
}

export async function migrarPalcoParaPalcoCaixas(db, userId, docSnap) {
    const dados = docSnap.data() || {};
    const caixas = Array.isArray(dados.caixas) ? dados.caixas.filter(caixa => caixa?.id) : [];
    const ids = await guardarCaixasPalcoDaNota({
        db,
        userId,
        palcoId: docSnap.id,
        caixas
    });
    return { palcoId: docSnap.id, caixas: caixas.length, ids };
}
