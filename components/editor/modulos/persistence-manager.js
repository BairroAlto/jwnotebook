import { COLECAO_CAIXAS, obterIdsCaixas } from '../../local/caixas-repository.js';
import { COLECAO_CAIXAS_SHARE, obterIdsCaixasShare } from '../../share/share-caixas-repository.js';
import { persistirAutosaveCaixas } from '../../caixas/caixas-autosave-repository.js';
import { mostrarAvisoServidorIndisponivel } from '../../ui/server-status-banner.js';

function prepararPayloadNota(state, isShare, alteracoesPendentes) {
    const { authRef, dadosNotaOriginal } = state;
    const titulo = document.getElementById('editor-titulo')?.innerText?.trim();
    const payload = {
        nome: titulo || dadosNotaOriginal.nome || "Sem título",
        vincTopicos: dadosNotaOriginal.vincTopicos || [],
        shareNovidades: dadosNotaOriginal.shareNovidades || {},
        reactions: dadosNotaOriginal.reactions || {}
    };

    if (!isShare) return payload;

    const uid = authRef.currentUser.uid;
    const userName = authRef.currentUser.displayName || authRef.currentUser.email || "Utilizador";
    payload.vistoPor = [uid];

    if (Object.keys(alteracoesPendentes).length) {
        payload.shareNovidades = { ...(dadosNotaOriginal.shareNovidades || {}) };
        Object.entries(alteracoesPendentes).forEach(([caixaId, alteracao]) => {
            const tipoAnterior = payload.shareNovidades?.[caixaId]?.tipo;
            payload.shareNovidades[caixaId] = {
                tipo: tipoAnterior === "criado" ? "criado" : (alteracao.tipo || "editado"),
                by: uid,
                byName: userName,
                viewedBy: [uid],
                timestamp: new Date().toISOString()
            };
        });
        dadosNotaOriginal.shareNovidades = payload.shareNovidades;
    } else {
        payload.shareNotaNovidade = {
            by: uid,
            byName: userName,
            viewedBy: [uid],
            timestamp: new Date().toISOString()
        };
        dadosNotaOriginal.shareNotaNovidade = payload.shareNotaNovidade;
    }

    return payload;
}

function limparAlteracoesPersistidas(state, alteracoesPendentes, revisao, revisaoEstrutural) {
    Object.entries(alteracoesPendentes).forEach(([caixaId, alteracao]) => {
        if (state.caixasEditadas?.[caixaId]?.timestamp === alteracao.timestamp) {
            delete state.caixasEditadas[caixaId];
        }
    });

    if (state.revisaoEstrutural === revisaoEstrutural) {
        state.sincronizacaoCompletaPendente = false;
    }

    state.notaComAlteracoes = (state.revisaoAlteracoes || 0) !== revisao;
    const idsAindaPendentes = Object.keys(state.caixasEditadas || {});
    state.caixaEditadaId = idsAindaPendentes[idsAindaPendentes.length - 1] || null;
}

async function sincronizarCaixasCodex(state, idsAlterados) {
    const caixasCodex = state.caixasAtuais.filter(caixa =>
        idsAlterados.includes(String(caixa.id)) &&
        caixa.referenciacodex &&
        caixa.estado === "on"
    );
    if (!caixasCodex.length) return;

    try {
        const { SentinelaManager } = await import('./sentinela-manager.js');
        for (const caixa of caixasCodex) {
            await SentinelaManager.sincronizarParaBiblioteca(
                caixa,
                state.dbRef,
                state.authRef.currentUser.uid
            );
        }
    } catch (erro) {
        // A nota já ficou guardada. Uma falha secundária não deve repetir todas
        // as escritas do autosave; a próxima edição voltará a tentar a ponte.
        console.warn('[PERSISTÊNCIA] Não foi possível sincronizar uma caixa Codex:', erro);
    }
}

export const PersistenceManager = {
    guardar: async (state) => {
        const {
            notaAbertaId,
            dbRef,
            authRef,
            caixasAtuais,
            dadosNotaOriginal,
            notaComAlteracoes
        } = state;

        if (!notaAbertaId || !dbRef || !authRef?.currentUser || !notaComAlteracoes) {
            return null;
        }

        const revisaoGuardada = state.revisaoAlteracoes || 0;
        const revisaoEstruturalGuardada = state.revisaoEstrutural || 0;
        const alteracoesPendentes = { ...(state.caixasEditadas || {}) };
        const idsAlterados = Object.keys(alteracoesPendentes).map(String);
        const sincronizacaoCompleta = Boolean(state.sincronizacaoCompletaPendente);
        const sincronizarListaCaixas = sincronizacaoCompleta || idsAlterados.length > 0;
        const isShare = dadosNotaOriginal.onde === "share";
        const payload = prepararPayloadNota(state, isShare, alteracoesPendentes);
        const idsAnteriores = isShare
            ? obterIdsCaixasShare(dadosNotaOriginal)
            : obterIdsCaixas(dadosNotaOriginal);

        try {
            const resultado = await persistirAutosaveCaixas({
                db: dbRef,
                colecaoNota: isShare ? "Share" : "Local",
                colecaoCaixas: isShare ? COLECAO_CAIXAS_SHARE : COLECAO_CAIXAS,
                notaId: notaAbertaId,
                userId: isShare
                    ? (dadosNotaOriginal.userId || authRef.currentUser.uid)
                    : authRef.currentUser.uid,
                campoNotaId: isShare ? "shareId" : "localDocId",
                caixas: caixasAtuais,
                idsAlterados,
                idsAnteriores,
                sincronizacaoCompleta,
                sincronizarListaCaixas,
                apagarRemovidas: isShare,
                camposNota: payload
            });

            Object.assign(dadosNotaOriginal, payload);
            if (sincronizarListaCaixas) {
                dadosNotaOriginal.CaixasOut = resultado.ids;
                dadosNotaOriginal.caixaIds = resultado.ids;
                dadosNotaOriginal.caixasMigradas = true;
            }

            limparAlteracoesPersistidas(
                state,
                alteracoesPendentes,
                revisaoGuardada,
                revisaoEstruturalGuardada
            );

            console.info('[PERSISTÊNCIA] Autosave concluído', {
                notaId: notaAbertaId,
                partilhada: isShare,
                sincronizacaoCompleta,
                caixasEscritas: resultado.caixasEscritas,
                caixasRemovidas: resultado.caixasRemovidas,
                escritasEstimadas: resultado.escritasEstimadas
            });

            const info = document.getElementById('editor-info-text');
            if (info) info.innerText = state.notaComAlteracoes ? "A guardar..." : "Sincronizado";

            await sincronizarCaixasCodex(state, idsAlterados);
            return resultado;
        } catch (erro) {
            mostrarAvisoServidorIndisponivel(erro);
            const info = document.getElementById('editor-info-text');
            if (info) info.innerText = "Erro ao sincronizar";
            console.error('[PERSISTÊNCIA] Erro ao guardar a nota:', erro);
            throw erro;
        }
    }
};
