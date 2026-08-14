let selecaoIniciada = false;

function selecionar(alvo) {
    document.querySelectorAll('.tool-interativa').forEach(ferramenta => {
        ferramenta.classList.toggle('tool-selecionada', ferramenta === alvo);
    });
}

export function iniciarSelecaoFerramentas() {
    if (selecaoIniciada) return;
    selecaoIniciada = true;

    document.addEventListener('pointerdown', evento => {
        selecionar(evento.target.closest?.('.tool-interativa') || null);
    });

    document.addEventListener('focusin', evento => {
        selecionar(evento.target.closest?.('.tool-interativa') || null);
    });
}
