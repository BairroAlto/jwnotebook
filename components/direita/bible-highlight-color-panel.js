import { BibleHighlights, HIGHLIGHT_COLORS } from '../bible-portal/bible-highlights.js';

const NOMES_CORES = {
    "#92400e": "Castanho",
    "#f97316": "Laranja",
    "#fb7185": "Rosa",
    "#facc15": "Amarelo",
    "#34d399": "Verde",
    "#38bdf8": "Azul",
    "#a78bfa": "Lilás",
    "#94a3b8": "Cinzento"
};

export function criarPainelCorSublinhado(referencia, onColorChange) {
    const painel = document.createElement("div");
    painel.className = "bible-highlight-color-panel";
    painel.hidden = true;
    painel.setAttribute("aria-label", "Cores do sublinhado");
    painel.innerHTML = `
        <span class="bible-highlight-color-panel-title">Cor do sublinhado</span>
        <div class="bible-highlight-color-options">
            ${HIGHLIGHT_COLORS.map(cor => `
                <button type="button" class="bible-highlight-color-option" data-color="${cor}" style="--highlight-color:${cor};" aria-label="${NOMES_CORES[cor] || "Cor"}" title="${NOMES_CORES[cor] || "Cor"}"></button>
            `).join("")}
        </div>
    `;

    painel.addEventListener("click", async event => {
        const botao = event.target.closest(".bible-highlight-color-option");
        if (!botao) return;

        event.stopPropagation();
        const cor = botao.dataset.color;
        const atualizada = await BibleHighlights.alterarCorSublinhado({
            groupIds: referencia?.groupIds || (referencia?.groupId ? [referencia.groupId] : []),
            color: cor
        });

        if (!atualizada) return;
        onColorChange?.(cor);
        painel.hidden = true;
    });

    return painel;
}
