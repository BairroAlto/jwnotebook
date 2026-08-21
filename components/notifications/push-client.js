import { getApps } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js';
import {
    getMessaging,
    getToken,
    deleteToken,
    isSupported
} from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-messaging.js';
import { cabecalhosComPrevisualizacao } from '../billing/plan-preview.js';

const PUSH_API_URL = 'https://storage.notabook.site';
const CHAVE_CLIENTE = 'notabook:push-device-client-id';
const PREFIXO_ID_SERVIDOR = 'notabook:push-device-server-id:';

async function cabecalhosComSessao(auth, extra = {}) {
    const utilizador = auth?.currentUser;
    if (!utilizador) throw new Error('Inicia sessão para gerires notificações.');
    return {
        Authorization: `Bearer ${await utilizador.getIdToken()}`,
        ...cabecalhosComPrevisualizacao(),
        ...extra
    };
}

async function lerResposta(resposta) {
    const dados = await resposta.json().catch(() => ({}));
    if (!resposta.ok) {
        const erro = new Error(dados.error || 'Não foi possível configurar as notificações.');
        erro.status = resposta.status;
        throw erro;
    }
    return dados;
}

function lerArmazenamento(chave) {
    try {
        return localStorage.getItem(chave) || '';
    } catch (_) {
        return '';
    }
}

function guardarArmazenamento(chave, valor) {
    try {
        if (valor) localStorage.setItem(chave, valor);
        else localStorage.removeItem(chave);
    } catch (_) {
        // O dispositivo continua funcional mesmo sem armazenamento persistente.
    }
}

function criarIdCliente() {
    if (crypto.randomUUID) return crypto.randomUUID();
    const aleatorio = crypto.getRandomValues(new Uint32Array(4));
    return `device-${Array.from(aleatorio, valor => valor.toString(16).padStart(8, '0')).join('')}`;
}

export function obterIdDispositivoAtual() {
    let id = lerArmazenamento(CHAVE_CLIENTE);
    if (!/^[A-Za-z0-9_-]{8,128}$/.test(id)) {
        id = criarIdCliente();
        guardarArmazenamento(CHAVE_CLIENTE, id);
    }
    return id;
}

function detetarBrowser() {
    const agente = navigator.userAgent || '';
    if (/Edg\//i.test(agente)) return 'Edge';
    if (/Firefox\//i.test(agente)) return 'Firefox';
    if (/OPR\//i.test(agente)) return 'Opera';
    if (/FxiOS\//i.test(agente)) return 'Firefox';
    if (/CriOS\//i.test(agente)) return 'Chrome';
    if (/Chrome\//i.test(agente)) return 'Chrome';
    if (/Safari\//i.test(agente)) return 'Safari';
    const marcas = navigator.userAgentData?.brands || [];
    const marca = marcas.find(item => !/Not.A.Brand/i.test(item.brand))?.brand;
    if (marca) return marca.replace('Google Chrome', 'Chrome').replace('Microsoft Edge', 'Edge');
    return 'Navegador';
}

function normalizarPlataforma(valor) {
    const plataforma = String(valor || 'Dispositivo');
    if (/win/i.test(plataforma)) return 'Windows';
    if (/mac/i.test(plataforma)) return navigator.maxTouchPoints > 1 ? 'iPad' : 'macOS';
    if (/iphone/i.test(plataforma)) return 'iPhone';
    if (/ipad/i.test(plataforma)) return 'iPad';
    if (/android/i.test(plataforma)) return 'Android';
    if (/linux/i.test(plataforma)) return 'Linux';
    return plataforma;
}

function obterMetadadosDispositivo() {
    const platform = normalizarPlataforma(navigator.userAgentData?.platform || navigator.platform).slice(0, 60);
    const browser = detetarBrowser().slice(0, 60);
    const modoApp = window.matchMedia?.('(display-mode: standalone)').matches;
    return {
        clientId: obterIdDispositivoAtual(),
        deviceLabel: `${platform} · ${browser}${modoApp ? ' · App' : ''}`.slice(0, 80),
        platform,
        browser
    };
}

async function pedidoPush(caminho, auth, opcoes = {}) {
    const resposta = await fetch(`${PUSH_API_URL}${caminho}`, {
        ...opcoes,
        headers: await cabecalhosComSessao(auth, opcoes.headers || {})
    });
    return lerResposta(resposta);
}

function chaveIdServidor(auth) {
    return `${PREFIXO_ID_SERVIDOR}${auth?.currentUser?.uid || ''}`;
}

export async function sincronizarDispositivoAtual(auth = window.auth, { token } = {}) {
    const corpo = obterMetadadosDispositivo();
    if (token) corpo.token = token;
    const dados = await pedidoPush('/push/devices', auth, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo)
    });
    if (dados.device?.id) guardarArmazenamento(chaveIdServidor(auth), dados.device.id);
    return dados.device;
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
    return pedidoPush('/push/config', auth);
}

async function obterTokenDesteDispositivo(auth, { pedirPermissao = true } = {}) {
    const estado = await obterEstadoNotificacoes();
    if (!estado.suportado) {
        throw new Error('Este dispositivo ou navegador não suporta notificações da aplicação.');
    }

    let permissao = estado.permissao;
    if (pedirPermissao && permissao !== 'granted') permissao = await Notification.requestPermission();
    if (permissao !== 'granted') throw new Error('A autorização de notificações não foi concedida.');

    const apps = getApps();
    if (!apps.length) throw new Error('O Firebase ainda não está disponível. Tenta novamente.');
    const [{ vapidKey }, serviceWorkerRegistration] = await Promise.all([
        obterConfiguracaoPush(auth),
        navigator.serviceWorker.ready
    ]);
    if (!vapidKey) throw new Error('As notificações ainda não estão configuradas no servidor.');

    const token = await getToken(getMessaging(apps[0]), { vapidKey, serviceWorkerRegistration });
    if (!token) throw new Error('Não foi possível identificar este dispositivo para notificações.');
    return token;
}

export async function listarDispositivosNotificacao(auth = window.auth) {
    await sincronizarDispositivoAtual(auth);
    const dados = await pedidoPush('/push/devices', auth);
    const clientIdAtual = obterIdDispositivoAtual();
    return (dados.devices || []).map(dispositivo => ({
        ...dispositivo,
        atual: dispositivo.clientId === clientIdAtual
    }));
}

export async function alterarNotificacoesDispositivo(dispositivo, enabled, auth = window.auth) {
    if (!dispositivo?.id) throw new Error('Dispositivo inválido.');
    let alvo = dispositivo;

    if (enabled && dispositivo.atual) {
        const token = await obterTokenDesteDispositivo(auth);
        alvo = await sincronizarDispositivoAtual(auth, { token });
    } else if (enabled && !dispositivo.canEnable) {
        throw new Error('Abre o NotaBook nesse dispositivo e autoriza primeiro as notificações.');
    }

    const dados = await pedidoPush(`/push/devices/${encodeURIComponent(alvo.id)}`, auth, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: Boolean(enabled) })
    });
    return { ...dados.device, atual: alvo.clientId === obterIdDispositivoAtual() };
}

export async function ativarNotificacoes(auth = window.auth) {
    const dispositivos = await listarDispositivosNotificacao(auth);
    const atual = dispositivos.find(dispositivo => dispositivo.atual);
    if (!atual) throw new Error('Não foi possível identificar este dispositivo.');
    const device = await alterarNotificacoesDispositivo(atual, true, auth);
    return { permissao: 'granted', tokenRegistado: device.canEnable, device };
}

export async function sincronizarNotificacoesAutorizadas(auth = window.auth) {
    const device = await sincronizarDispositivoAtual(auth);
    if (!device?.enabled) return true;

    const estado = await obterEstadoNotificacoes();
    if (!estado.suportado || estado.permissao !== 'granted') {
        await alterarNotificacoesDispositivo({ ...device, atual: true }, false, auth);
        return false;
    }

    const token = await obterTokenDesteDispositivo(auth, { pedirPermissao: false });
    await sincronizarDispositivoAtual(auth, { token });
    return true;
}

export async function desativarNotificacoesNesteDispositivo(auth = window.auth) {
    const uid = auth?.currentUser?.uid;
    if (!uid) return false;
    let deviceId = lerArmazenamento(chaveIdServidor(auth));

    try {
        if (!deviceId) deviceId = (await sincronizarDispositivoAtual(auth))?.id || '';
        if (deviceId) {
            await pedidoPush(`/push/devices/${encodeURIComponent(deviceId)}`, auth, { method: 'DELETE' });
        }
    } finally {
        try {
            const apps = getApps();
            if (apps.length && await isSupported()) await deleteToken(getMessaging(apps[0]));
        } catch (_) {
            // O servidor nunca envia para um dispositivo removido da conta.
        }
        guardarArmazenamento(chaveIdServidor(auth), '');
    }
    return true;
}

export { PUSH_API_URL };
