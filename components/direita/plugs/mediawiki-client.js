export async function pedirMediaWiki(endpoint, parametros, mensagemErro) {
    const url = new URL(endpoint);
    Object.entries({
        format: 'json',
        formatversion: '2',
        origin: '*',
        ...parametros
    }).forEach(([chave, valor]) => {
        if (valor !== undefined && valor !== null && valor !== false) {
            url.searchParams.set(chave, String(valor));
        }
    });

    const controlador = new AbortController();
    const temporizador = window.setTimeout(() => controlador.abort(), 15000);
    try {
        const resposta = await fetch(url, {
            signal: controlador.signal,
            headers: { Accept: 'application/json' }
        });
        const dados = await resposta.json().catch(() => ({}));
        if (!resposta.ok || dados.error) {
            throw new Error(dados?.error?.info || mensagemErro || 'O serviço Wikimedia não respondeu.');
        }
        return dados;
    } catch (erro) {
        if (erro.name === 'AbortError') throw new Error('A pesquisa demorou demasiado tempo. Tenta novamente.');
        throw erro;
    } finally {
        window.clearTimeout(temporizador);
    }
}

export function limparFragmentoHtml(valor = '') {
    const documento = new DOMParser().parseFromString(String(valor), 'text/html');
    return documento.body.textContent?.replace(/\s+/g, ' ').trim() || '';
}

