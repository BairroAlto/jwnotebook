export const DURACAO_CACHE_NOTICIAS_MS = 5 * 60 * 1000;
export const ATRASO_REPETICAO_NOTICIAS_MS = 60 * 1000;

function obterTimestamp(valor) {
    const timestamp = Date.parse(valor || '');
    return Number.isFinite(timestamp) ? timestamp : null;
}

export function cacheNoticiasEstaAtualizada(atualizadaEm, agora = Date.now()) {
    const timestamp = obterTimestamp(atualizadaEm);
    return timestamp !== null
        && agora >= timestamp
        && agora - timestamp < DURACAO_CACHE_NOTICIAS_MS;
}

export function tempoAteAtualizarNoticias(atualizadaEm, agora = Date.now()) {
    const timestamp = obterTimestamp(atualizadaEm);
    if (timestamp === null || agora < timestamp) return 0;
    return Math.max(0, DURACAO_CACHE_NOTICIAS_MS - (agora - timestamp));
}

export function ordenarNoticiasMaisRecentes(noticias) {
    return [...(Array.isArray(noticias) ? noticias : [])].sort((a, b) => {
        const dataA = obterTimestamp(a?.publicadoEm) ?? 0;
        const dataB = obterTimestamp(b?.publicadoEm) ?? 0;
        return dataB - dataA;
    });
}
