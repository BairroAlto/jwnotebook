import { cabecalhosComPrevisualizacao } from '../billing/plan-preview.js';

const STORAGE_API_URL = 'https://storage.notabook.site';

function obterUtilizador() {
    const utilizador = window.auth?.currentUser;
    if (!utilizador) throw new Error('Inicia sessão para gerir ficheiros.');
    return utilizador;
}

async function cabecalhosComSessao(extra = {}) {
    const utilizador = obterUtilizador();
    const token = await utilizador.getIdToken();
    return {
        Authorization: `Bearer ${token}`,
        ...cabecalhosComPrevisualizacao(),
        ...extra
    };
}

function criarQuery(parametros = {}) {
    const query = new URLSearchParams();
    Object.entries(parametros).forEach(([chave, valor]) => {
        if (valor !== undefined && valor !== null && valor !== '') {
            query.set(chave, String(valor));
        }
    });
    const texto = query.toString();
    return texto ? `?${texto}` : '';
}

async function lerResposta(resposta) {
    const dados = await resposta.json().catch(() => ({}));
    if (!resposta.ok) throw new Error(dados.error || 'Não foi possível comunicar com o armazenamento.');
    return dados;
}

export async function listarFicheiros({ noteId, contextType, contextId } = {}) {
    const query = criarQuery({ noteId, contextType, contextId });
    const resposta = await fetch(`${STORAGE_API_URL}/files${query}`, {
        headers: await cabecalhosComSessao()
    });
    const dados = await lerResposta(resposta);
    return dados.files || [];
}

export async function obterUsoArmazenamento() {
    const headers = await cabecalhosComSessao();
    const resposta = await fetch(`${STORAGE_API_URL}/usage`, {
        headers
    });
    const uso = await lerResposta(resposta);

    try {
        const respostaPlano = await fetch(`${STORAGE_API_URL}/billing/plan`, { headers });
        const plano = await lerResposta(respostaPlano);
        if (Number(plano.quotaBytes) > Number(uso.quotaBytes || 0)) {
            uso.quotaBytes = Number(plano.quotaBytes);
        }
        uso.plan = plano.plan;
    } catch (_) {
        // O uso continua disponível mesmo que a consulta do plano falhe.
    }

    return uso;
}

export async function enviarFicheiro(ficheiro, contexto) {
    const query = criarQuery({
        ...contexto,
        name: ficheiro.name
    });
    const resposta = await fetch(`${STORAGE_API_URL}/files${query}`, {
        method: 'PUT',
        headers: await cabecalhosComSessao({
            'Content-Type': ficheiro.type || 'application/octet-stream'
        }),
        body: ficheiro
    });
    return lerResposta(resposta);
}

export async function apagarFicheiro(id) {
    const resposta = await fetch(`${STORAGE_API_URL}/files/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: await cabecalhosComSessao()
    });
    return lerResposta(resposta);
}

export async function obterUrlFicheiro(id) {
    const resposta = await fetch(`${STORAGE_API_URL}/files/${encodeURIComponent(id)}`, {
        headers: await cabecalhosComSessao()
    });
    if (!resposta.ok) {
        const dados = await resposta.json().catch(() => ({}));
        throw new Error(dados.error || 'Não foi possível abrir o ficheiro.');
    }
    const blob = await resposta.blob();
    return URL.createObjectURL(blob);
}

export async function abrirSeparadorFicheiro(id, separadorExistente = null) {
    const separador = separadorExistente || window.open('', '_blank');
    if (!separador) throw new Error('O navegador bloqueou a abertura do documento.');

    try {
        const url = await obterUrlFicheiro(id);
        separador.opener = null;
        separador.location.href = url;
        setTimeout(() => URL.revokeObjectURL(url), 120000);
        return url;
    } catch (erro) {
        if (!separadorExistente) separador.close();
        throw erro;
    }
}

export { STORAGE_API_URL };
