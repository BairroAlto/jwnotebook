const TAGS_PERMITIDAS = new Set([
    'BR', 'P', 'DIV', 'STRONG', 'B', 'EM', 'I', 'U', 'MARK', 'SPAN',
    'UL', 'OL', 'LI', 'BLOCKQUOTE'
]);
const CLASSES_PERMITIDAS = new Set([
    'nb-rich-size-small', 'nb-rich-size-large',
    'nb-rich-size-a4', 'nb-rich-size-a3', 'nb-rich-size-a2',
    'nb-rich-size-a1', 'nb-rich-size-a0', 'nb-rich-size-aplus1'
]);

function escaparTexto(valor) {
    return String(valor ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export function ehHtmlRico(valor) {
    return /<\/?[a-z][^>]*>/i.test(String(valor || ''));
}

function textoParaHtml(valor) {
    return escaparTexto(valor).replace(/\r\n?/g, '\n').replace(/\n/g, '<br>');
}

function copiarEstiloSeguro(origem, destino) {
    const cor = String(origem.style?.color || '').trim();
    const tamanho = String(origem.style?.fontSize || '').trim();
    if (/^(#[0-9a-f]{3,8}|rgb\(|rgba\(|hsl\(|hsla\(|[a-z]+)$/i.test(cor)) {
        destino.style.color = cor;
    }
    if (/^\d+(\.\d+)?(px|em|rem|%)$/i.test(tamanho)) {
        destino.style.fontSize = tamanho;
    }
}

function limparNode(node, destino) {
    if (node.nodeType === Node.TEXT_NODE) {
        destino.appendChild(document.createTextNode(node.nodeValue || ''));
        return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const tag = node.tagName.toUpperCase();
    if (tag === 'FONT') {
        const span = document.createElement('span');
        const cor = node.getAttribute('color');
        if (cor && /^(#[0-9a-f]{3,8}|[a-z]+)$/i.test(cor)) span.style.color = cor;
        const tamanho = node.getAttribute('size');
        if (tamanho === '1' || tamanho === '2') span.classList.add('nb-rich-size-small');
        if (tamanho === '4' || tamanho === '5' || tamanho === '6' || tamanho === '7') span.classList.add('nb-rich-size-large');
        for (const filho of node.childNodes) limparNode(filho, span);
        destino.appendChild(span);
        return;
    }

    if (!TAGS_PERMITIDAS.has(tag)) {
        for (const filho of node.childNodes) limparNode(filho, destino);
        return;
    }

    const novo = document.createElement(tag.toLowerCase());
    if (tag === 'SPAN') {
        const classe = [...node.classList].find(item => CLASSES_PERMITIDAS.has(item));
        if (classe) novo.classList.add(classe);
        copiarEstiloSeguro(node, novo);
    }
    for (const filho of node.childNodes) limparNode(filho, novo);
    destino.appendChild(novo);
}

export function sanitizarHtmlRico(valor = '') {
    const bruto = String(valor ?? '');
    if (!bruto) return '';
    if (!ehHtmlRico(bruto)) return textoParaHtml(bruto);

    const doc = new DOMParser().parseFromString(`<div>${bruto}</div>`, 'text/html');
    const origem = doc.body.firstElementChild;
    const destino = document.createElement('div');
    for (const filho of origem?.childNodes || []) limparNode(filho, destino);
    return destino.innerHTML;
}

export function obterTextoSimplesRico(valor = '') {
    const bruto = String(valor ?? '');
    if (!ehHtmlRico(bruto)) return bruto;
    const contentor = document.createElement('div');
    contentor.innerHTML = sanitizarHtmlRico(bruto);
    return (contentor.innerText || contentor.textContent || '').replace(/\u00a0/g, ' ');
}
