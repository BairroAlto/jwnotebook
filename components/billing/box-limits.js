import { obterPlanoAtual } from './billing-client.js';

export const CAIXAS_POR_PLANO = Object.freeze({
    free: 55,
    premium: 110,
    premium_plus: 190
});

const NOMES_PLANOS = Object.freeze({
    free: 'Free',
    premium: 'Premium',
    premium_plus: 'Premium Plus'
});

let cachePlano = {
    uid: null,
    plano: null,
    limite: null,
    expiraEm: 0
};

function normalizarPlano(plano) {
    return Object.prototype.hasOwnProperty.call(CAIXAS_POR_PLANO, plano)
        ? plano
        : 'free';
}

function normalizarLimite(limite, plano) {
    const valor = Number(limite);
    if (Number.isInteger(valor) && valor > 0) return valor;
    return CAIXAS_POR_PLANO[plano] || CAIXAS_POR_PLANO.free;
}

async function obterPlanoComCache(uid) {
    const agora = Date.now();
    if (
        cachePlano.uid === uid &&
        cachePlano.plano &&
        Number.isInteger(cachePlano.limite) &&
        cachePlano.expiraEm > agora
    ) {
        return cachePlano;
    }

    const dados = await obterPlanoAtual();
    const plano = normalizarPlano(dados?.plan);
    const limite = normalizarLimite(dados?.maxCaixasPorNota, plano);
    cachePlano = { uid, plano, limite, expiraEm: agora + 30_000 };
    return cachePlano;
}

export async function verificarLimiteCaixas(authRef, caixasAtuais, quantidadeAdicionar = 1) {
    const utilizador = authRef?.currentUser || window.auth?.currentUser;
    if (!utilizador) {
        window.alert('Inicia sessão para adicionares caixas a esta nota.');
        return false;
    }

    const totalAtual = Array.isArray(caixasAtuais) ? caixasAtuais.length : 0;
    const quantidade = Math.max(0, Number(quantidadeAdicionar) || 0);
    if (quantidade === 0) return true;

    let estadoPlano;
    try {
        estadoPlano = await obterPlanoComCache(utilizador.uid);
    } catch (erro) {
        console.error('[BOX-LIMITS] Não foi possível verificar o plano:', erro);
        window.alert('Não foi possível verificar o limite de caixas. Tenta novamente.');
        return false;
    }

    const plano = estadoPlano.plano;
    const limite = estadoPlano.limite;
    if (totalAtual + quantidade <= limite) return true;

    const plural = quantidade === 1 ? 'caixa' : 'caixas';
    window.alert(
        `Esta nota já tem ${totalAtual} caixas. O plano ${NOMES_PLANOS[plano]} permite no máximo ${limite} caixas por nota. ` +
        `Não é possível adicionar ${quantidade} ${plural}.`
    );
    return false;
}

export function limparCacheLimiteCaixas() {
    cachePlano = { uid: null, plano: null, limite: null, expiraEm: 0 };
}
