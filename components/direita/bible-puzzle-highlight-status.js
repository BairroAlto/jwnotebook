import { criarPainelCorSublinhado } from './bible-highlight-color-panel.js';

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
    const texto = document.createElement("span");
    const botaoCor = document.createElement("button");
    const painelCor = criarPainelCorSublinhado(referencia, novaCor => {
        referencia?.fragmentos?.forEach(fragmento => {
            fragmento.cor = novaCor;
        });
        faixa.style.setProperty("--bible-highlight-status-color", novaCor);
        faixa.style.backgroundColor = obterFundoTranslucido(novaCor);
        botaoCor.style.color = novaCor;
    });

    faixa.className = "bible-highlight-attachment-status";
    faixa.style.setProperty("--bible-highlight-status-color", cor);
    faixa.style.backgroundColor = obterFundoTranslucido(cor);

    texto.innerHTML = `<strong>${Number(quantidade) || 0}</strong> ${singular ? "caixa anexada" : "caixas anexadas"} ao sublinhado`;
    botaoCor.type = "button";
    botaoCor.className = "bible-highlight-color-trigger";
    botaoCor.style.color = cor;
    botaoCor.setAttribute("aria-label", "Alterar cor do sublinhado");
    botaoCor.title = "Alterar cor do sublinhado";
    botaoCor.innerHTML = '<i class="fa-solid fa-paintbrush" aria-hidden="true"></i>';
    botaoCor.addEventListener("click", event => {
        event.stopPropagation();
        painelCor.hidden = !painelCor.hidden;
    });

    faixa.append(texto, botaoCor, painelCor);

    return faixa;
}
