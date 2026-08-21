import { cabecalhosComPrevisualizacao } from '../../../billing/plan-preview.js';

const AGENDA_API_URL = 'https://storage.notabook.site';

function obterUtilizador(auth = window.auth) {
    const utilizador = auth?.currentUser;
    if (!utilizador) throw new Error('Inicia sessão para gerir lembretes.');
    return utilizador;
}

async function cabecalhosComSessao(auth, extra = {}) {
    const token = await obterUtilizador(auth).getIdToken();
    return {
        Authorization: `Bearer ${token}`,
        ...cabecalhosComPrevisualizacao(),
        ...extra
    };
}

async function lerResposta(resposta) {
    const dados = await resposta.json().catch(() => ({}));
    if (!resposta.ok) {
        const erro = new Error(dados.error || 'Não foi possível comunicar com a Agenda.');
        erro.status = resposta.status;
        throw erro;
    }
    return dados;
}

function caminhoNota(notaId) {
    return `${AGENDA_API_URL}/reminders/notes/${encodeURIComponent(notaId)}`;
}

export async function obterLembreteDaNota(notaId, auth = window.auth) {
    const resposta = await fetch(caminhoNota(notaId), {
        headers: await cabecalhosComSessao(auth)
    });
    const dados = await lerResposta(resposta);
    return dados.reminder || null;
}

export async function guardarLembreteDaNota(notaId, lembrete, auth = window.auth) {
    const resposta = await fetch(caminhoNota(notaId), {
        method: 'PUT',
        headers: await cabecalhosComSessao(auth, { 'Content-Type': 'application/json' }),
        body: JSON.stringify(lembrete)
    });
    const dados = await lerResposta(resposta);
    return dados.reminder;
}

export async function cancelarLembreteDaNota(notaId, auth = window.auth) {
    const resposta = await fetch(caminhoNota(notaId), {
        method: 'DELETE',
        headers: await cabecalhosComSessao(auth)
    });
    return lerResposta(resposta);
}

export { AGENDA_API_URL, cabecalhosComSessao };
