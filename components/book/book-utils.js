import { BIBLIA_METADATA } from '../lists/biblia.js';

const BOOK_ALIASES = new Map();
BIBLIA_METADATA.forEach(livro => {
    [livro.nome, livro.abrev].forEach(label => {
        const key = normalizar(label).replace(/\./g, "");
        BOOK_ALIASES.set(key, livro.nome);
    });
});

export function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

export function normalizar(value) {
    return String(value || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
}

export function textoDaCaixa(caixa) {
    if (!caixa) return "";
    const partes = [];
    if (caixa.titulo) partes.push(caixa.titulo);
    if (caixa.conteudo) partes.push(caixa.conteudo);
    if (Array.isArray(caixa.textosanexados)) {
        caixa.textosanexados.forEach(item => partes.push(`${item.livro} ${item.cap}:${item.ver} ${item.texto || ""}`));
    }
    if (caixa.url) partes.push(caixa.url);
    return partes.filter(Boolean).join("\n");
}

export function textoDaNota(dadosNota, caixas) {
    const linhas = [dadosNota?.nome || "Sem titulo"];
    (caixas || []).forEach((caixa, index) => {
        const texto = textoDaCaixa(caixa).trim();
        if (texto) linhas.push(`\n${index + 1}. ${texto}`);
    });
    return linhas.join("\n");
}

export function detectarReferenciasBiblicas(texto) {
    const refs = [];
    const nomes = BIBLIA_METADATA
        .flatMap(l => [l.nome, l.abrev])
        .filter(Boolean)
        .sort((a, b) => b.length - a.length)
        .map(escapeRegExp)
        .join("|");
    const re = new RegExp(`\\b(${nomes})\\.?\\s+(\\d{1,3}):(\\d{1,3})(?:\\s*-\\s*(\\d{1,3}))?`, "gi");
    let match;
    while ((match = re.exec(String(texto || "")))) {
        const livro = BOOK_ALIASES.get(normalizar(match[1]).replace(/\./g, "")) || match[1];
        refs.push({
            raw: match[0],
            livro,
            cap: Number(match[2]),
            ver: Number(match[3]),
            verFim: match[4] ? Number(match[4]) : null,
            index: match.index
        });
    }
    return refs;
}

export function linkarReferencias(texto) {
    const source = escapeHtml(texto);
    const refs = detectarReferenciasBiblicas(texto);
    if (!refs.length) return source.replace(/\n/g, "<br>");

    let html = "";
    let cursor = 0;
    refs.forEach(ref => {
        const rawEsc = escapeHtml(ref.raw);
        const safeBefore = escapeHtml(String(texto).slice(cursor, ref.index));
        html += safeBefore.replace(/\n/g, "<br>");
        html += `<button class="book-bible-ref" data-livro="${escapeHtml(ref.livro)}" data-cap="${ref.cap}" data-ver="${ref.ver}">${rawEsc}</button>`;
        cursor = ref.index + ref.raw.length;
    });
    html += escapeHtml(String(texto).slice(cursor)).replace(/\n/g, "<br>");
    return html;
}

export function textoParaFala(texto) {
    let resultado = String(texto || "");
    detectarReferenciasBiblicas(resultado).reverse().forEach(ref => {
        const frase = ref.verFim
            ? `${ref.livro} capítulo ${ref.cap} versículos ${ref.ver} a ${ref.verFim}`
            : `${ref.livro} capítulo ${ref.cap} versículo ${ref.ver}`;
        resultado = resultado.slice(0, ref.index) + frase + resultado.slice(ref.index + ref.raw.length);
    });
    return resultado;
}

export function slugLivro(nome) {
    return normalizar(nome).replace(/\s+/g, "_");
}

function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
