function capturarPosicoesScroll(textarea) {
    const posicoes = [];
    let elemento = textarea?.parentElement;

    while (elemento) {
        const estilo = getComputedStyle(elemento);
        if (['auto', 'scroll', 'overlay'].includes(estilo.overflowY)) {
            posicoes.push({
                elemento,
                top: elemento.scrollTop,
                left: elemento.scrollLeft
            });
        }
        elemento = elemento.parentElement;
    }

    return posicoes;
}

function restaurarPosicoesScroll(posicoes) {
    posicoes.forEach(({ elemento, top, left }) => {
        elemento.scrollTop = top;
        elemento.scrollLeft = left;
    });
}

export function ajustarAlturaTextarea(textarea, { preservarScroll = false } = {}) {
    if (!textarea) return;

    const posicoesScroll = preservarScroll ? capturarPosicoesScroll(textarea) : [];

    // Repor em auto permite ao browser recalcular a altura real do conteúdo,
    // incluindo texto colado e linhas que quebram automaticamente.
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
    textarea.scrollTop = 0;

    if (preservarScroll) {
        restaurarPosicoesScroll(posicoesScroll);
        requestAnimationFrame(() => restaurarPosicoesScroll(posicoesScroll));
    }
}
