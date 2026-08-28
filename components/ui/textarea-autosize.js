export function ajustarAlturaTextarea(textarea) {
    if (!textarea) return;

    // Usar zero como ponto de partida evita conservar o scroll interno que o
    // browser cria ao inserir uma nova linha no fim de um textarea expandido.
    textarea.style.height = "0px";
    textarea.style.height = `${textarea.scrollHeight}px`;
    textarea.scrollTop = 0;
}
