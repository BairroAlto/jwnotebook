const PROTOCOLOS_URL_PERMITIDOS = new Set(['http:', 'https:', 'mailto:']);

export function criarIdElevador() {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
    return `elevador-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function garantirEstruturaElevador(caixa) {
    if (!caixa || typeof caixa !== 'object') return caixa;

    caixa.pastapai = Array.isArray(caixa.pastapai) ? caixa.pastapai : [];
    caixa.pastapai = caixa.pastapai
        .filter(pai => pai && typeof pai === 'object')
        .map(pai => {
            pai.id ||= criarIdElevador();
            pai.nome = String(pai.nome ?? '');
            pai.oculto = Boolean(pai.oculto);
            pai.links = Array.isArray(pai.links) ? pai.links : [];
            pai.pastafilho = Array.isArray(pai.pastafilho) ? pai.pastafilho : [];

            pai.links = pai.links
                .filter(link => link && typeof link === 'object')
                .map(link => ({ ...link, id: link.id || criarIdElevador(), url: String(link.url ?? '') }));

            pai.pastafilho = pai.pastafilho
                .filter(filho => filho && typeof filho === 'object')
                .map(filho => {
                    const links = Array.isArray(filho.links) ? [...filho.links] : [];
                    if (!links.length && filho.url) {
                        links.push({ id: criarIdElevador(), url: filho.url });
                    }
                    const linksNormalizados = links
                        .filter(link => link && typeof link === 'object')
                        .map(link => ({
                            ...link,
                            id: link.id || criarIdElevador(),
                            url: String(link.url ?? '')
                        }));

                    return {
                        ...filho,
                        id: filho.id || criarIdElevador(),
                        nome: String(filho.nome ?? ''),
                        url: String(filho.url || linksNormalizados[0]?.url || ''),
                        links: linksNormalizados,
                        oculto: Boolean(filho.oculto)
                    };
                });

            return pai;
        });

    return caixa;
}

export function moverItem(array, index, deslocamento) {
    const novoIndice = index + deslocamento;
    if (!Array.isArray(array) || index < 0 || novoIndice < 0 || novoIndice >= array.length) return false;
    [array[index], array[novoIndice]] = [array[novoIndice], array[index]];
    return true;
}

export function urlElevadorSegura(valor) {
    const url = String(valor ?? '').trim();
    if (!url) return '';

    try {
        const base = globalThis.location?.origin || 'https://notabook.invalid';
        const resolvida = new URL(url, base);
        return PROTOCOLOS_URL_PERMITIDOS.has(resolvida.protocol) ? url : '';
    } catch {
        return '';
    }
}


