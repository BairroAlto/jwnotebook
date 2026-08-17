import { criarAutorizacaoGmail, mensagemErroAutorizacaoGmail } from './gmail-auth.js';
import { GMAIL_LIMITE_DIARIO_MENSAGENS } from './gmail-config.js';
import { cabecalhosComPrevisualizacao } from '../billing/plan-preview.js';

const STORAGE_API_URL = 'https://storage.notabook.site';
const LEITURAS_STORAGE_PREFIX = 'notebook:gmail-leituras:';
const DURACAO_CACHE_MS = 2 * 60 * 1000;
const clientes = new Map();

export function obterClienteGmail(auth) {
    const uid = auth?.currentUser?.uid || 'sem-utilizador';
    if (!clientes.has(uid)) clientes.set(uid, criarCliente(auth));
    return clientes.get(uid);
}

function criarCliente(auth) {
    const autorizacao = criarAutorizacaoGmail();
    const subscritores = new Set();
    const cache = new Map();
    const conteudos = new Map();
    let perfil = null;
    let restaurado = false;

    const api = {
        estaLigado: () => autorizacao.estaLigado(),
        obterPerfil: () => perfil,
        obterLeiturasRestantes: () => Math.max(0, GMAIL_LIMITE_DIARIO_MENSAGENS - lerConsumoDiario(auth)),
        subscrever,
        restaurarSessao,
        ligar,
        desligar,
        carregarMensagens,
        carregarMensagem
    };
    return api;

    function subscrever(callback) {
        subscritores.add(callback);
        return () => subscritores.delete(callback);
    }

    function emitir(tipo, mensagem = '') {
        const estado = {
            tipo,
            mensagem,
            ligado: autorizacao.estaLigado(),
            perfil,
            leiturasRestantes: api.obterLeiturasRestantes()
        };
        subscritores.forEach(callback => callback(estado));
        window.dispatchEvent(new CustomEvent('notabook:gmail-estado', { detail: estado }));
    }

    async function restaurarSessao() {
        if (restaurado) return autorizacao.estaLigado();
        restaurado = true;
        try {
            const dados = await pedidoBackend('/gmail/connection', {}, auth);
            if (!dados.connected) return false;
            perfil = normalizarPerfil(dados.profile);
            autorizacao.marcarLigado();
            emitir('ligado', 'Gmail ligado.');
            return true;
        } catch (_) {
            autorizacao.invalidar();
            perfil = null;
            return false;
        }
    }

    async function ligar() {
        emitir('a-ligar', 'A ligar ao Gmail…');
        try {
            const code = await autorizacao.ligar();
            const dados = await pedidoBackend('/gmail/oauth/exchange', {
                method: 'POST',
                headers: { 'X-Requested-With': 'XMLHttpRequest' },
                body: JSON.stringify({ code })
            }, auth);
            perfil = normalizarPerfil(dados.profile);
            autorizacao.marcarLigado();
            cache.clear();
            conteudos.clear();
            emitir('ligado', 'Gmail ligado.');
            return true;
        } catch (erro) {
            autorizacao.invalidar();
            perfil = null;
            emitir('erro', mensagemErroAutorizacaoGmail(erro));
            throw erro;
        }
    }

    async function desligar() {
        try {
            await pedidoBackend('/gmail/connection', { method: 'DELETE' }, auth);
        } finally {
            autorizacao.desligar();
            perfil = null;
            cache.clear();
            conteudos.clear();
            emitir('desligado', 'Gmail desligado.');
        }
    }

    async function carregarMensagens(preferencias, { ignorarCache = false } = {}) {
        if (!autorizacao.estaLigado()) throw new Error('Liga primeiro a tua conta Gmail.');
        const config = normalizarPreferenciasGmail(preferencias);
        const chaveCache = JSON.stringify(config);
        const guardado = cache.get(chaveCache);
        if (!ignorarCache && guardado && Date.now() - guardado.criadoEm < DURACAO_CACHE_MS) {
            return guardado.mensagens;
        }

        if (api.obterLeiturasRestantes() <= 0) {
            throw new Error('Atingiste o limite diário de 100 emails nesta ferramenta.');
        }

        try {
            const parametros = new URLSearchParams({
                limite: String(config.limite),
                filtro: config.filtro
            });
            const dados = await pedidoBackend(`/gmail/messages?${parametros}`, {}, auth);
            const mensagens = Array.isArray(dados.messages) ? dados.messages : [];
            const lidas = Number(dados.readCount || mensagens.length);
            if (Number.isFinite(Number(dados.remaining))) {
                definirConsumoDiario(auth, GMAIL_LIMITE_DIARIO_MENSAGENS - Number(dados.remaining));
            } else {
                registarConsumoDiario(auth, lidas);
            }
            cache.set(chaveCache, { criadoEm: Date.now(), mensagens });
            emitir('atualizado', `${mensagens.length} emails atualizados.`);
            return mensagens;
        } catch (erro) {
            if (erro?.status === 401 || erro?.status === 404) {
                autorizacao.invalidar();
                perfil = null;
                emitir('desligado', 'A autorização Gmail expirou. Liga novamente a conta.');
                throw new Error('A autorização Gmail expirou. Liga novamente a conta.');
            }
            throw erro;
        }
    }

    async function carregarMensagem(id) {
        if (!autorizacao.estaLigado()) throw new Error('Liga primeiro a tua conta Gmail.');
        const identificador = String(id || '').trim();
        if (!identificador) throw new Error('Email inválido.');
        if (conteudos.has(identificador)) return conteudos.get(identificador);

        try {
            const dados = await pedidoBackend(`/gmail/messages/${encodeURIComponent(identificador)}`, {}, auth);
            const mensagem = dados.message || null;
            if (mensagem) {
                registarConsumoDiario(auth, 1);
                conteudos.set(identificador, mensagem);
            }
            return mensagem;
        } catch (erro) {
            if (erro?.status === 401 || erro?.status === 404) {
                autorizacao.invalidar();
                perfil = null;
                emitir('desligado', 'A autorização Gmail expirou. Liga novamente a conta.');
                throw new Error('A autorização Gmail expirou. Liga novamente a conta.');
            }
            throw erro;
        }
    }
}

export function normalizarPreferenciasGmail(valor = {}) {
    const limitesPermitidos = new Set([10, 25, 50]);
    const filtrosPermitidos = new Set(['todos', 'nao_lidos', 'anexos']);
    const limite = Number.parseInt(valor.limite, 10);
    return {
        limite: limitesPermitidos.has(limite) ? limite : 25,
        filtro: filtrosPermitidos.has(valor.filtro) ? valor.filtro : 'todos'
    };
}

function normalizarPerfil(perfil = {}) {
    return {
        email: String(perfil.email || ''),
        totalMensagens: Number(perfil.totalMensagens || 0),
        totalConversas: Number(perfil.totalConversas || 0)
    };
}

async function pedidoBackend(caminho, opcoes = {}, auth) {
    const utilizador = auth?.currentUser || window.auth?.currentUser;
    if (!utilizador) throw new Error('Inicia sessão para utilizar a ferramenta Gmail.');
    const token = await utilizador.getIdToken();
    const resposta = await fetch(`${STORAGE_API_URL}${caminho}`, {
        ...opcoes,
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            ...cabecalhosComPrevisualizacao(),
            ...(opcoes.headers || {})
        }
    });
    const dados = await resposta.json().catch(() => ({}));
    if (!resposta.ok) {
        const erro = new Error(dados.error || 'Não foi possível comunicar com o Gmail.');
        erro.status = resposta.status;
        throw erro;
    }
    return dados;
}

function hojeLisboa() {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/Lisbon',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(new Date());
}

function chaveConsumo(auth) {
    return `${LEITURAS_STORAGE_PREFIX}${auth?.currentUser?.uid || 'anonimo'}:${hojeLisboa()}`;
}

function lerConsumoDiario(auth) {
    try {
        return Math.max(0, Number.parseInt(localStorage.getItem(chaveConsumo(auth)) || '0', 10) || 0);
    } catch (_) {
        return 0;
    }
}

function registarConsumoDiario(auth, quantidade) {
    if (!quantidade) return;
    try {
        const total = Math.min(GMAIL_LIMITE_DIARIO_MENSAGENS, lerConsumoDiario(auth) + quantidade);
        localStorage.setItem(chaveConsumo(auth), String(total));
    } catch (_) {}
}

function definirConsumoDiario(auth, quantidade) {
    try {
        const total = Math.min(GMAIL_LIMITE_DIARIO_MENSAGENS, Math.max(0, Number(quantidade) || 0));
        localStorage.setItem(chaveConsumo(auth), String(total));
    } catch (_) {}
}
