import { collection, documentId, onSnapshot, query, where } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { COLECAO_CAIXAS } from "../local/caixas-repository.js";
import { COLECAO_CAIXAS_SHARE } from "../share/share-caixas-repository.js";

const LIMITE_IDS_POR_CONSULTA = 30;

function lerSnapshot(snapshot, onde) {
    return snapshot.docs.map(docSnap => ({
        ...docSnap.data(),
        id: docSnap.id,
        onde
    }));
}

function criarConsultasCaixas(db, colecao, userId, estado, restricoes = [], ids = null) {
    const base = [where("userId", "==", userId)];
    if (estado) base.push(where("estado", "==", estado));
    (restricoes || []).forEach(restricao => {
        if (!restricao?.campo || restricao.valor === undefined) return;
        base.push(where(restricao.campo, restricao.operador || "==", restricao.valor));
    });

    if (ids === null) return [query(collection(db, colecao), ...base)];
    if (!ids.length) return [];

    const consultas = [];
    for (let i = 0; i < ids.length; i += LIMITE_IDS_POR_CONSULTA) {
        const lote = ids.slice(i, i + LIMITE_IDS_POR_CONSULTA);
        consultas.push(query(collection(db, colecao), ...base, where(documentId(), "in", lote)));
    }
    return consultas;
}

export function escutarCaixasNormalizadas({ db, userId, estado = "on", incluirShare = true, restricoes = [], ids = null, onChange, onError }) {
    let locais = [];
    let partilhadas = [];
    let erroLocal = null;
    let erroShare = null;
    const idsNormalizados = Array.isArray(ids) ? [...new Set(ids.filter(Boolean).map(String))] : null;

    const emitir = () => {
        if (erroLocal || erroShare) onError?.(erroLocal || erroShare);
        onChange?.([...locais, ...partilhadas]);
    };

    const escutarColecao = (colecao, onde, atribuir, atribuirErro) => {
        const partes = [];
        const consultas = criarConsultasCaixas(db, colecao, userId, estado, restricoes, idsNormalizados);
        if (!consultas.length) {
            atribuir([]);
            return () => {};
        }

        const cancelamentos = consultas.map((consulta, indice) => onSnapshot(consulta, snap => {
            partes[indice] = lerSnapshot(snap, onde);
            const mapa = new Map(partes.flat().map(caixa => [String(caixa.id), caixa]));
            atribuir([...mapa.values()]);
            atribuirErro(null);
            emitir();
        }, erro => {
            atribuirErro(erro);
            emitir();
        }));

        return () => cancelamentos.forEach(cancelar => cancelar?.());
    };

    const cancelarLocal = escutarColecao(COLECAO_CAIXAS, "local", caixas => { locais = caixas; }, erro => { erroLocal = erro; });
    const cancelarShare = incluirShare
        ? escutarColecao(COLECAO_CAIXAS_SHARE, "share", caixas => { partilhadas = caixas; }, erro => { erroShare = erro; })
        : () => {};

    if (idsNormalizados?.length === 0) emitir();

    return () => {
        cancelarLocal?.();
        cancelarShare?.();
    };
}