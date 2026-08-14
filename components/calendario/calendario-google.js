import {
    GOOGLE_CALENDAR_CLIENT_ID,
    GOOGLE_CALENDAR_SCOPE
} from './calendario-google-config.js';
import {
    GoogleAuthProvider,
    linkWithPopup,
    reauthenticateWithPopup
} from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js';

const GOOGLE_SCRIPT_URL = 'https://accounts.google.com/gsi/client';
const GOOGLE_EVENTS_URL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
const TOKEN_STORAGE_PREFIX = 'notebook:google-calendar-token:';

let scriptPromise = null;

export function criarIntegracaoGoogleCalendar({ auth, onEstado, onEventos } = {}) {
    let tokenClient = null;
    let accessToken = '';
    let tokenRequest = null;
    let connected = false;
    let authorizationMode = '';

    return {
        estaConfigurado: () => Boolean(GOOGLE_CALENDAR_CLIENT_ID || auth),
        estaLigado: () => connected,
        ligar,
        desligar,
        restaurarSessao,
        carregarEventos
    };

    async function ligar() {
        try {
            if (GOOGLE_CALENDAR_CLIENT_ID) {
                await ligarComGoogleIdentityServices();
            } else {
                await ligarComFirebaseGoogle();
            }
            connected = true;
            onEstado?.({ tipo: 'ligado', mensagem: 'Google Calendar ligado.' });
            return true;
        } catch (error) {
            connected = false;
            accessToken = '';
            onEstado?.({ tipo: 'erro', mensagem: mensagemErroGoogle(error) });
            return false;
        }
    }

    async function desligar() {
        if (accessToken && window.google?.accounts?.oauth2) {
            try {
                window.google.accounts.oauth2.revoke(accessToken, () => {});
            } catch (_) {
                // O token é descartado mesmo que a revogação remota falhe.
            }
        }
        accessToken = '';
        tokenClient = null;
        connected = false;
        authorizationMode = '';
        apagarTokenGuardado();
        onEventos?.([]);
        onEstado?.({ tipo: 'desligado', mensagem: 'Google Calendar desligado.' });
    }

    async function restaurarSessao() {
        const dados = lerTokenGuardado();
        if (!dados) return false;

        accessToken = dados.token;
        authorizationMode = dados.mode || 'firebase';
        connected = true;
        onEstado?.({ tipo: 'ligado', mensagem: 'Google Calendar ligado.' });
        return true;
    }

    async function carregarEventos(inicio, fim) {
        if (!connected || !accessToken) return [];

        const params = new URLSearchParams({
            singleEvents: 'true',
            orderBy: 'startTime',
            showDeleted: 'false',
            maxResults: '2500',
            timeMin: inicio.toISOString(),
            timeMax: fim.toISOString()
        });

        let resposta = await obterEventos(params);
        if (resposta.status === 401) {
            if (authorizationMode === 'firebase') await ligarComFirebaseGoogle();
            else await pedirToken(true);
            resposta = await obterEventos(params);
        }
        if (!resposta.ok) {
            const detalhe = await resposta.json().catch(() => ({}));
            throw new Error(detalhe?.error?.message || `Google Calendar respondeu com ${resposta.status}.`);
        }

        const dados = await resposta.json();
        const eventos = (dados.items || []).map(normalizarEventoGoogle).filter(Boolean);
        onEventos?.(eventos);
        return eventos;
    }

    async function ligarComGoogleIdentityServices() {
        await carregarGoogleIdentityServices();
        tokenClient = window.google.accounts.oauth2.initTokenClient({
            client_id: GOOGLE_CALENDAR_CLIENT_ID,
            scope: GOOGLE_CALENDAR_SCOPE,
            callback: () => {}
        });
        await pedirToken(Boolean(accessToken));
        authorizationMode = 'gis';
    }

    async function ligarComFirebaseGoogle() {
        const user = auth?.currentUser;
        if (!user) throw new Error('Inicia sessão no notABook antes de ligares o Google Calendar.');

        const provider = new GoogleAuthProvider();
        provider.addScope(GOOGLE_CALENDAR_SCOPE);
        // Permite escolher explicitamente a conta Google, mesmo quando o
        // utilizador entrou primeiro no notABook com e-mail e palavra-passe.
        provider.setCustomParameters({ prompt: 'select_account' });

        const jaLigado = user.providerData.some(({ providerId }) => providerId === 'google.com');
        const resultado = jaLigado
            ? await reauthenticateWithPopup(user, provider)
            : await linkWithPopup(user, provider);
        const credencial = GoogleAuthProvider.credentialFromResult(resultado);
        accessToken = credencial?.accessToken || '';
        if (!accessToken) throw new Error('O Google não devolveu um token de acesso ao calendário.');
        authorizationMode = 'firebase';
        guardarToken();
    }

    async function obterEventos(params) {
        return fetch(`${GOOGLE_EVENTS_URL}?${params}`, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
    }

    function pedirToken(silencioso) {
        if (!tokenClient) throw new Error('O serviço de autorização Google não ficou disponível.');
        if (tokenRequest) return tokenRequest;

        tokenRequest = new Promise((resolve, reject) => {
            tokenClient.callback = (resposta) => {
                tokenRequest = null;
                if (resposta?.error) {
                    reject(new Error(resposta.error_description || resposta.error));
                    return;
                }
                accessToken = resposta.access_token || '';
                if (!accessToken) {
                    reject(new Error('O Google não devolveu um token de acesso.'));
                    return;
                }
                guardarToken();
                resolve(accessToken);
            };
            tokenClient.requestAccessToken({ prompt: silencioso ? '' : 'consent' });
        });
        return tokenRequest;
    }

    function guardarToken() {
        const uid = auth?.currentUser?.uid;
        if (!uid || !accessToken) return;
        try {
            sessionStorage.setItem(`${TOKEN_STORAGE_PREFIX}${uid}`, JSON.stringify({
                token: accessToken,
                mode: authorizationMode,
                // Os tokens Google duram normalmente cerca de uma hora.
                expiresAt: Date.now() + (50 * 60 * 1000)
            }));
        } catch (_) {
            // A sessão continua a funcionar mesmo sem sessionStorage.
        }
    }

    function lerTokenGuardado() {
        const uid = auth?.currentUser?.uid;
        if (!uid) return null;
        try {
            const bruto = sessionStorage.getItem(`${TOKEN_STORAGE_PREFIX}${uid}`);
            if (!bruto) return null;
            const dados = JSON.parse(bruto);
            if (!dados?.token || Number(dados.expiresAt) <= Date.now()) {
                sessionStorage.removeItem(`${TOKEN_STORAGE_PREFIX}${uid}`);
                return null;
            }
            return dados;
        } catch (_) {
            return null;
        }
    }

    function apagarTokenGuardado() {
        const uid = auth?.currentUser?.uid;
        if (!uid) return;
        try { sessionStorage.removeItem(`${TOKEN_STORAGE_PREFIX}${uid}`); } catch (_) {}
    }
}

function carregarGoogleIdentityServices() {
    if (window.google?.accounts?.oauth2) return Promise.resolve();
    if (scriptPromise) return scriptPromise;

    scriptPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = GOOGLE_SCRIPT_URL;
        script.async = true;
        script.defer = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Não foi possível carregar a autorização Google.'));
        document.head.append(script);
    });
    return scriptPromise;
}

function normalizarEventoGoogle(evento) {
    const inicio = evento.start?.dateTime || evento.start?.date;
    if (!inicio) return null;

    const eDiaInteiro = Boolean(evento.start?.date);
    const data = eDiaInteiro ? evento.start.date : dateKey(new Date(inicio));
    const fim = evento.end?.dateTime || evento.end?.date || inicio;
    const hora = eDiaInteiro ? '' : formatTime(new Date(inicio));
    const duracao = eDiaInteiro ? 0 : Math.max(0, Math.round((new Date(fim) - new Date(inicio)) / 60000));

    return {
        id: `google-${evento.id}`,
        source: 'google',
        date: data,
        title: evento.summary || 'Evento Google Calendar',
        time: hora,
        noTime: eDiaInteiro,
        duration: duracao,
        calendarId: 'google',
        category: 'google',
        note: evento.location || '',
        htmlLink: evento.htmlLink || ''
    };
}

function formatTime(date) {
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function dateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function mensagemErroGoogle(error) {
    if (error?.message?.includes('popup')) return 'A janela Google foi bloqueada. Permite pop-ups para ligar o calendário.';
    return error?.message || 'Não foi possível ligar o Google Calendar.';
}
