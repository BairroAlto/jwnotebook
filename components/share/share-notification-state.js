import {
    arrayUnion,
    doc,
    FieldPath,
    updateDoc
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

export function obterNovidadesDeFerramentasNaoVistas(dadosNota, uid) {
    if (!uid) return [];
    return Object.entries(dadosNota?.shareNovidades || {}).filter(([, novidade]) => (
        novidade &&
        novidade.by !== uid &&
        !(novidade.viewedBy || []).includes(uid)
    ));
}

export function temNovidadeGeralShareNaoVista(dadosNota, uid) {
    const novidade = dadosNota?.shareNotaNovidade;
    return Boolean(
        novidade &&
        novidade.by !== uid &&
        !(novidade.viewedBy || []).includes(uid)
    );
}

export function temNovidadesShareNaoVistas(dadosNota, uid) {
    if (!dadosNota || !uid) return false;

    const novidadesFerramentas = dadosNota.shareNovidades || {};
    const ferramentasNaoVistas = obterNovidadesDeFerramentasNaoVistas(dadosNota, uid);
    const temEstadoModerno = Object.keys(novidadesFerramentas).length > 0 ||
        Boolean(dadosNota.shareNotaNovidade);
    const novidadeLegada = !temEstadoModerno &&
        Array.isArray(dadosNota.vistoPor) &&
        !dadosNota.vistoPor.includes(uid);
    const novidadeGeral = temNovidadeGeralShareNaoVista(dadosNota, uid);
    const resultado = novidadeLegada || novidadeGeral || ferramentasNaoVistas.length > 0;

    console.info('[SHARE-NOTIF][estado]', {
        uid,
        notaId: dadosNota.id || null,
        legado: novidadeLegada,
        geral: novidadeGeral,
        ferramentasNaoVistas: ferramentasNaoVistas.map(([id]) => id),
        ferramentas: Object.entries(novidadesFerramentas).map(([id, novidade]) => ({
            id,
            tipo: novidade?.tipo || null,
            by: novidade?.by || null,
            viewedBy: novidade?.viewedBy || [],
            naoVista: Boolean(
                novidade &&
                novidade.by !== uid &&
                !(novidade.viewedBy || []).includes(uid)
            )
        })),
        resultado
    });
    return resultado;
}

export async function marcarNovidadesShareDaNotaComoVistas({ db, notaId, dadosNota, uid }) {
    if (!db || !notaId || !dadosNota || !uid) {
        console.debug('[SHARE-NOTIF][nota-vista][ignorado]', { notaId, uid, motivo: 'contexto-incompleto' });
        return;
    }

    const campos = [
        'vistoPor',
        arrayUnion(uid),
        uid + '.ultimaLeitura',
        new Date().toISOString()
    ];
    const novidades = Object.entries(dadosNota.shareNovidades || {});
    const pendentes = novidades.filter(([, novidade]) => (
        novidade &&
        novidade.by !== uid &&
        !(novidade.viewedBy || []).includes(uid)
    ));

    pendentes.forEach(([caixaId]) => {
        campos.push(
            new FieldPath('shareNovidades', caixaId, 'viewedBy'),
            arrayUnion(uid)
        );
    });

    if (dadosNota.shareNotaNovidade &&
        dadosNota.shareNotaNovidade.by !== uid &&
        !(dadosNota.shareNotaNovidade.viewedBy || []).includes(uid)) {
        campos.push('shareNotaNovidade.viewedBy', arrayUnion(uid));
    }

    console.info('[SHARE-NOTIF][nota-vista][inicio]', {
        notaId,
        uid,
        ferramentas: pendentes.map(([caixaId]) => caixaId),
        geral: Boolean(dadosNota.shareNotaNovidade)
    });

    try {
        await updateDoc(doc(db, 'Share', notaId), ...campos);
        pendentes.forEach(([, novidade]) => {
            novidade.viewedBy = [...new Set([...(novidade.viewedBy || []), uid])];
        });
        dadosNota.vistoPor = [...new Set([...(dadosNota.vistoPor || []), uid])];
        if (dadosNota.shareNotaNovidade) {
            dadosNota.shareNotaNovidade.viewedBy = [
                ...new Set([...(dadosNota.shareNotaNovidade.viewedBy || []), uid])
            ];
        }
        console.info('[SHARE-NOTIF][nota-vista][sucesso]', {
            notaId,
            uid,
            ferramentas: pendentes.length
        });
    } catch (erro) {
        console.error('[SHARE-NOTIF][nota-vista][erro]', { notaId, uid, erro });
        throw erro;
    }
}

export async function marcarFerramentaShareComoVista({ db, notaId, caixaId, dadosNota, uid }) {
    if (!db || !notaId || !caixaId || !uid) {
        console.debug('[SHARE-NOTIF][vista][ignorado]', { notaId, caixaId, uid, motivo: 'contexto-incompleto' });
        return;
    }

    const novidade = dadosNota?.shareNovidades?.[caixaId];
    if (!novidade) {
        console.debug('[SHARE-NOTIF][vista][ignorado]', { notaId, caixaId, uid, motivo: 'novidade-inexistente' });
        return;
    }
    if (novidade.by === uid) {
        console.debug('[SHARE-NOTIF][vista][ignorado]', { notaId, caixaId, uid, motivo: 'propria-alteracao' });
        return;
    }
    if ((novidade.viewedBy || []).includes(uid)) {
        console.debug('[SHARE-NOTIF][vista][ignorado]', { notaId, caixaId, uid, motivo: 'ja-vista' });
        return;
    }

    console.info('[SHARE-NOTIF][vista][inicio]', { notaId, caixaId, uid });
    try {
        await updateDoc(
            doc(db, "Share", notaId),
            new FieldPath("shareNovidades", caixaId, "viewedBy"),
            arrayUnion(uid),
            "vistoPor",
            arrayUnion(uid)
        );
    } catch (erro) {
        console.error('[SHARE-NOTIF][vista][erro]', { notaId, caixaId, uid, erro });
        throw erro;
    }

    novidade.viewedBy = [...new Set([...(novidade.viewedBy || []), uid])];
    dadosNota.vistoPor = [...new Set([...(dadosNota.vistoPor || []), uid])];
    console.info('[SHARE-NOTIF][vista][sucesso]', { notaId, caixaId, uid });
}