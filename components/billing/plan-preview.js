const PLANOS_PREVISAO = new Set(['free', 'premium', 'premium_plus']);
const CHAVE_PREVISAO = 'notabook.admin.plan-preview';

export function obterPlanoPrevisualizacao() {
    try {
        const plano = window.localStorage.getItem(CHAVE_PREVISAO);
        return PLANOS_PREVISAO.has(plano) ? plano : null;
    } catch (_) {
        return null;
    }
}

export function definirPlanoPrevisualizacao(plano) {
    if (!PLANOS_PREVISAO.has(plano)) return limparPlanoPrevisualizacao();
    window.localStorage.setItem(CHAVE_PREVISAO, plano);
    window.dispatchEvent(new CustomEvent('notabook:plan-preview-changed', { detail: { plan: plano } }));
    return plano;
}

export function limparPlanoPrevisualizacao() {
    try {
        window.localStorage.removeItem(CHAVE_PREVISAO);
    } catch (_) {
        // O modo de pré-visualização continua desligado nesta sessão.
    }
    window.dispatchEvent(new CustomEvent('notabook:plan-preview-changed', { detail: { plan: null } }));
    return null;
}

export function cabecalhosComPrevisualizacao(extra = {}) {
    const plano = obterPlanoPrevisualizacao();
    return plano ? { ...extra, 'X-Admin-Plan-Preview': plano } : extra;
}

