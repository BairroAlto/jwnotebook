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
    expiraEm: 0
};

function normalizarPlano(plano) {
    return Object.prototype.hasOwnProperty.call(CAIXAS_POR_PLANO, plano)
        ? plano
        : 'free';
}

async function obterPlanoComCache(uid) {
    const agora = Date.now();
    if (cachePlano.uid === uid && cachePlano.plano && cachePlano.expiraEm > agora) {
        return cachePlano.plano;
    }

    const dados = await obterPlanoAtual();
    const plano = normalizarPlano(dados?.plan);
    cachePlano = { uid, plano, expiraEm: agora + 30_000 };
    return plano;
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

    let plano;
    try {
        plano = await obterPlanoComCache(utilizador.uid);
    } catch (erro) {
        console.error('[BOX-LIMITS] Não foi possível verificar o plano:', erro);
        window.alert('Não foi possível verificar o limite de caixas. Tenta novamente.');
        return false;
    }

    const limite = CAIXAS_POR_PLANO[plano];
    if (totalAtual + quantidade <= limite) return true;

    const plural = quantidade === 1 ? 'caixa' : 'caixas';
    window.alert(
        `Esta nota já tem ${totalAtual} caixas. O plano ${NOMES_PLANOS[plano]} permite no máximo ${limite} caixas por nota. ` +
        `Não é possível adicionar ${quantidade} ${plural}.`
    );
    return false;
}

export function limparCacheLimiteCaixas() {
    cachePlano = { uid: null, plano: null, expiraEm: 0 };
}
