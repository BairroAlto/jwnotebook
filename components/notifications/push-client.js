import { getApps } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js';
import {
    getMessaging,
    getToken,
    deleteToken,
    isSupported
} from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-messaging.js';
import { cabecalhosComPrevisualizacao } from '../billing/plan-preview.js';

const PUSH_API_URL = 'https://storage.notabook.site';

async function cabecalhosComSessao(auth, extra = {}) {
    const utilizador = auth?.currentUser;
    if (!utilizador) throw new Error('Inicia sessão para ativares notificações.');
    return {
        Authorization: `Bearer ${await utilizador.getIdToken()}`,
        ...cabecalhosComPrevisualizacao(),
        ...extra
    };
}

async function lerResposta(resposta) {
    const dados = await resposta.json().catch(() => ({}));
    if (!resposta.ok) throw new Error(dados.error || 'Não foi possível configurar as notificações.');
    return dados;
}

function obterNomeDispositivo() {
    const plataforma = navigator.userAgentData?.platform || navigator.platform || 'Dispositivo';
    const modo = window.matchMedia?.('(display-mode: standalone)').matches ? 'App' : 'Browser';
    return `${plataforma} · ${modo}`.slice(0, 80);
}

export async function obterEstadoNotificacoes() {
    if (!window.isSecureContext) return { suportado: false, permissao: 'insecure' };
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
        return { suportado: false, permissao: 'unsupported' };
    }

    try {
        const suportado = await isSupported();
        return {
            suportado,
            permissao: suportado ? Notification.permission : 'unsupported'
        };
    } catch (_) {
        return { suportado: false, permissao: 'unsupported' };
    }
}

async function obterConfiguracaoPush(auth) {
    const resposta = await fetch(`${PUSH_API_URL}/push/config`, {
        headers: await cabecalhosComSessao(auth)
    });
    return lerResposta(resposta);
}

async function registarTokenNoServidor(auth, token) {
    const resposta = await fetch(`${PUSH_API_URL}/push/subscriptions`, {
        method: 'POST',
        headers: await cabecalhosComSessao(auth, { 'Content-Type': 'application/json' }),
        body: JSON.stringify({
            token,
            deviceLabel: obterNomeDispositivo()
        })
    });
    const dados = await lerResposta(resposta);
    const uid = auth?.currentUser?.uid;
    if (uid && dados.subscription?.id) {
        try {
            localStorage.setItem(`notabook:push-subscription:${uid}`, dados.subscription.id);
        } catch (_) {
            // A subscrição continua válida mesmo sem armazenamento local.
        }
    }
    return dados;
}

export async function ativarNotificacoes(auth = window.auth) {
    if (!window.isSecureContext || !('Notification' in window) || !('serviceWorker' in navigator)) {
        throw new Error('Este dispositivo ou navegador não suporta notificações da aplicação.');
    }

    // O pedido é feito imediatamente dentro do clique em “Guardar” para
    // preservar o gesto do utilizador exigido por alguns navegadores.
    let permissao = Notification.permission;
    if (permissao !== 'granted') permissao = await Notification.requestPermission();
    if (permissao !== 'granted') {
        throw new Error('A autorização de notificações não foi concedida.');
    }
    if (!await isSupported()) {
        throw new Error('Este dispositivo ou navegador não suporta notificações da aplicação.');
    }

    const apps = getApps();
    if (!apps.length) throw new Error('O Firebase ainda não está disponível. Tenta novamente.');

    const [{ vapidKey }, serviceWorkerRegistration] = await Promise.all([
        obterConfiguracaoPush(auth),
        navigator.serviceWorker.ready
    ]);
    if (!vapidKey) throw new Error('As notificações ainda não estão configuradas no servidor.');

    const messaging = getMessaging(apps[0]);
    const token = await getToken(messaging, {
        vapidKey,
        serviceWorkerRegistration
    });
    if (!token) throw new Error('Não foi possível identificar este dispositivo para notificações.');

    await registarTokenNoServidor(auth, token);
    return { permissao, tokenRegistado: true };
}

export async function sincronizarNotificacoesAutorizadas(auth = window.auth) {
    const estado = await obterEstadoNotificacoes();
    if (!estado.suportado || estado.permissao !== 'granted') return false;

    const apps = getApps();
    if (!apps.length) return false;
    const [{ vapidKey }, serviceWorkerRegistration] = await Promise.all([
        obterConfiguracaoPush(auth),
        navigator.serviceWorker.ready
    ]);
    if (!vapidKey) return false;

    const token = await getToken(getMessaging(apps[0]), {
        vapidKey,
        serviceWorkerRegistration
    });
    if (!token) return false;
    await registarTokenNoServidor(auth, token);
    return true;
}

export async function desativarNotificacoesNesteDispositivo(auth = window.auth) {
    const uid = auth?.currentUser?.uid;
    if (!uid) return false;
    let subscriptionId = '';
    try {
        subscriptionId = localStorage.getItem(`notabook:push-subscription:${uid}`) || '';
    } catch (_) {}

    try {
        if (subscriptionId) {
            const resposta = await fetch(
                `${PUSH_API_URL}/push/subscriptions/${encodeURIComponent(subscriptionId)}`,
                { method: 'DELETE', headers: await cabecalhosComSessao(auth) }
            );
            await lerResposta(resposta);
        }
    } finally {
        try {
            const apps = getApps();
            if (apps.length && await isSupported()) await deleteToken(getMessaging(apps[0]));
        } catch (_) {
            // O servidor desativa o token inválido quando o FCM o rejeitar.
        }
        try {
            localStorage.removeItem(`notabook:push-subscription:${uid}`);
        } catch (_) {}
    }
    return true;
}
