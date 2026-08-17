import {
    GOOGLE_GMAIL_CLIENT_ID,
    GOOGLE_GMAIL_SCOPE
} from './gmail-config.js';

const GOOGLE_SCRIPT_URL = 'https://accounts.google.com/gsi/client';

let scriptPromise = null;

export function criarAutorizacaoGmail() {
    let codeClient = null;
    let codeRequest = null;
    let ligado = false;

    return {
        estaLigado: () => ligado,
        ligar,
        desligar,
        restaurarSessao,
        marcarLigado: () => { ligado = true; },
        invalidar: () => { ligado = false; }
    };

    async function ligar() {
        if (!GOOGLE_GMAIL_CLIENT_ID) {
            throw new Error('A ferramenta Gmail ainda precisa do Client ID OAuth da aplicação.');
        }

        await carregarGoogleIdentityServices();
        const code = await pedirCodigo();
        ligado = true;
        return code;
    }

    async function desligar() {
        ligado = false;
    }

    function restaurarSessao() {
        return ligado;
    }

    function pedirCodigo() {
        if (!codeClient) {
            codeClient = window.google.accounts.oauth2.initCodeClient({
                client_id: GOOGLE_GMAIL_CLIENT_ID,
                scope: GOOGLE_GMAIL_SCOPE,
                ux_mode: 'popup',
                callback: () => {},
                error_callback: erro => {
                    if (codeRequest) {
                        codeRequest.reject(new Error(erro?.type || 'A autorização Google foi interrompida.'));
                        codeRequest = null;
                    }
                }
            });
        }

        if (codeRequest) return codeRequest.promise;

        let resolveCode;
        let rejectCode;
        const promise = new Promise((resolve, reject) => {
            resolveCode = resolve;
            rejectCode = reject;
        });
        codeRequest = { promise, resolve: resolveCode, reject: rejectCode };

        codeClient.callback = resposta => {
            const pedido = codeRequest;
            codeRequest = null;
            if (!pedido) return;
            if (resposta?.error) {
                pedido.reject(new Error(resposta.error_description || resposta.error));
                return;
            }
            if (!resposta?.code) {
                pedido.reject(new Error('A Google não devolveu um código de autorização.'));
                return;
            }
            pedido.resolve(resposta.code);
        };

        try {
            // Sem login_hint: cada utilizador pode escolher qualquer conta Google.
            codeClient.requestCode();
        } catch (erro) {
            codeRequest = null;
            rejectCode(erro);
        }

        return promise;
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
        script.onload = resolve;
        script.onerror = () => reject(new Error('Não foi possível carregar a autorização Google.'));
        document.head.append(script);
    });
    return scriptPromise;
}

export function mensagemErroAutorizacaoGmail(erro) {
    const mensagem = String(erro?.message || '');
    if (mensagem.includes('Client ID OAuth')) return mensagem;
    if (mensagem.includes('popup') || mensagem.includes('popup_')) {
        return 'A janela Google foi bloqueada. Permite pop-ups para ligares o Gmail.';
    }
    return mensagem || 'Não foi possível ligar o Gmail.';
}
