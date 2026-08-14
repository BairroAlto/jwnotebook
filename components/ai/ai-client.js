import { cabecalhosComPrevisualizacao } from '../billing/plan-preview.js';

const AI_API_URL = 'https://storage.notabook.site';

function obterUtilizador() {
    const utilizador = window.auth?.currentUser;
    if (!utilizador) throw new Error('Inicia sessão para utilizar a IA.');
    return utilizador;
}

/**
 * Envia uma operação de IA para o Worker.
 * A seleção do plano, a contagem e a escolha do modelo são feitas no servidor.
 */
export async function chatWithQuota({ task, messages, temperature = 0.4, responseFormat = null }) {
    const token = await obterUtilizador().getIdToken();
    const response = await fetch(`${AI_API_URL}/ai/chat`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            ...cabecalhosComPrevisualizacao()
        },
        body: JSON.stringify({ task, messages, temperature, responseFormat })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(data.error || 'Não foi possível processar a operação de IA.');
    }

    return data;
}
