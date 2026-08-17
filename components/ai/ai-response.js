const MOJIBAKE_MARKERS = /Ã|Â|â€|ðŸ|�/;

function corrigirMojibake(texto) {
    if (!MOJIBAKE_MARKERS.test(texto)) return texto;

    try {
        const bytes = Array.from(texto)
            .map(caracter => `%${caracter.charCodeAt(0).toString(16).padStart(2, '0')}`)
            .join('');
        return decodeURIComponent(bytes);
    } catch {
        return texto;
    }
}

/**
 * Remove ruído de respostas de modelos gratuitos sem alterar Markdown válido.
 * O BookAI trabalha em Português; outros alfabetos só são permitidos no modo
 * de léxico, onde podem ser necessários termos gregos ou hebraicos.
 */
export function normalizarRespostaIA(valor, modo = '') {
    let texto = corrigirMojibake(String(valor || ''))
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
        .replace(/[ \t]+$/gm, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

    if (modo !== 'lexico') {
        texto = texto
            .split(/(\s+)/)
            .filter(parte => !/[^\p{Script=Latin}\p{Number}\p{Punctuation}\s]/u.test(parte))
            .join('')
            .replace(/[ \t]{2,}/g, ' ')
            .replace(/\n[ \t]+/g, '\n')
            .trim();
    }

    return texto;
}
