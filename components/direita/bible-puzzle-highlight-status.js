function obterCorSublinhado(referencia = null) {
    return referencia?.fragmentos?.find(fragmento => fragmento?.cor)?.cor || "#818cf8";
}

function obterFundoTranslucido(cor) {
    if (/^#[\da-f]{6}$/i.test(cor)) return `${cor}38`;
    if (/^#[\da-f]{3}$/i.test(cor)) {
        const [, r, g, b] = cor;
        return `#${r}${r}${g}${g}${b}${b}38`;
    }
    return "rgba(129, 140, 248, 0.22)";
}

export function criarEstadoCaixasSublinhado(referencia, quantidade) {
    const faixa = document.createElement("div");
    const cor = obterCorSublinhado(referencia);
    const singular = Number(quantidade) === 1;

    faixa.className = "bible-highlight-attachment-status";
    faixa.style.setProperty("--bible-highlight-status-color", cor);
    faixa.style.backgroundColor = obterFundoTranslucido(cor);
    faixa.innerHTML = `
        <span><strong>${Number(quantidade) || 0}</strong> ${singular ? "caixa anexada" : "caixas anexadas"} ao sublinhado</span>
    `;

    return faixa;
}
