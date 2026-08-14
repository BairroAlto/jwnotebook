import { obterAcessoFerramenta } from '../settings/feature-admin.js';

let acessoConteudoHistorico = null;

/**
 * Conteúdo que pode continuar visível como referência, mas cujo original
 * só deve ser aberto a partir do Premium.
 */
export function eConteudoHistorico(dados = {}) {
    const contexto = String(dados.contexto || '').toLowerCase();
    if (contexto === 'livro') return true;

    const sigla = String(dados.sigla || '').toLowerCase();
    const ano = Number.parseInt(dados.ano, 10);
    return contexto === 'publicacao'
        && ['w', 'g'].includes(sigla)
        && Number.isFinite(ano)
        && ano < 2000;
}

export async function podeAbrirConteudoHistorico() {
    if (acessoConteudoHistorico !== null) return acessoConteudoHistorico;

    try {
        acessoConteudoHistorico = await obterAcessoFerramenta(
            window.auth,
            'publicacoes_historicas'
        );
    } catch (erro) {
        console.error('[CONTENT-ACCESS] Não foi possível verificar o plano:', erro);
        acessoConteudoHistorico = false;
    }

    return acessoConteudoHistorico;
}

export function mostrarBloqueioConteudoHistorico(container) {
    if (!container) return;

    container.innerHTML = `
        <div style="margin:20px auto; max-width:520px; padding:24px; text-align:center; border:1px solid rgba(244,114,182,.5); border-radius:14px; background:rgba(244,114,182,.08); color:#fbcfe8;">
            <i class="fa-solid fa-lock" style="font-size:24px; margin-bottom:12px;"></i>
            <h3 style="margin:0 0 8px; color:#fff; font-size:15px;">Conteúdo disponível nos planos Premium</h3>
            <p style="margin:0; line-height:1.6; font-size:12px; opacity:.9;">A referência pode continuar ligada à nota, mas o conteúdo original desta publicação ou livro só pode ser aberto com Premium ou Premium Plus.</p>
        </div>
    `;
}

/**
 * Devolve true quando a abertura deve ser interrompida.
 */
export async function bloquearConteudoHistorico(dados, container) {
    if (!eConteudoHistorico(dados)) return false;
    if (await podeAbrirConteudoHistorico()) return false;

    mostrarBloqueioConteudoHistorico(container);
    return true;
}
