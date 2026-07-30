function limparEstado(elemento, alvo) {
    elemento.classList.remove('elevador-is-dragging');
    alvo?.classList.remove('elevador-is-drag-over');
}

function reordenar(array, item, alvo, abaixo) {
    const origem = array.indexOf(item);
    const destinoOriginal = array.indexOf(alvo);
    if (origem < 0 || destinoOriginal < 0 || origem === destinoOriginal) return false;

    array.splice(origem, 1);
    let destino = array.indexOf(alvo) + (abaixo ? 1 : 0);
    if (destino < 0) destino = array.length;
    array.splice(destino, 0, item);
    return true;
}

function obterAlvo(elemento, x, y) {
    const alvo = document.elementFromPoint(x, y)?.closest('[data-elevador-drag-item]');
    if (!alvo || alvo === elemento || alvo.parentElement !== elemento.parentElement) return null;
    return alvo;
}

function reordenarPorPonto({ elemento, array, item, x, y, onMoved }) {
    const alvo = obterAlvo(elemento, x, y);
    if (!alvo) return;
    const rect = alvo.getBoundingClientRect();
    const abaixo = y > rect.top + rect.height / 2;
    if (reordenar(array, item, alvo._elevadorDragItem, abaixo)) onMoved();
}

export function tornarElevadorArrastavel({ elemento, pega, array, item, onMoved }) {
    elemento.dataset.elevadorDragItem = 'true';
    elemento._elevadorDragItem = item;
    pega.className = 'elevador-drag-handle';
    pega.title = 'Arrastar para reordenar';
    pega.setAttribute('aria-label', 'Arrastar para reordenar');
    pega.innerHTML = '<i class="fa-solid fa-grip-vertical" aria-hidden="true"></i>';

    let timer = null;
    let pointerAtivo = false;
    let pointerId = null;
    let ultimoX = 0;
    let ultimoY = 0;

    const limpar = () => {
        if (timer) clearTimeout(timer);
        timer = null;
        pointerAtivo = false;
        pega.releasePointerCapture?.(pointerId);
        pointerId = null;
        document.querySelectorAll('.elevador-is-drag-over').forEach(el => el.classList.remove('elevador-is-drag-over'));
        elemento.classList.remove('elevador-is-dragging');
    };

    pega.draggable = true;
    pega.addEventListener('dragstart', event => {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', item.id || 'elevador-item');
        elemento.classList.add('elevador-is-dragging');
    });
    pega.addEventListener('dragend', limpar);
    elemento.addEventListener('dragover', event => {
        event.preventDefault();
        const alvo = obterAlvo(elemento, event.clientX, event.clientY);
        document.querySelectorAll('.elevador-is-drag-over').forEach(el => el.classList.remove('elevador-is-drag-over'));
        alvo?.classList.add('elevador-is-drag-over');
    });
    elemento.addEventListener('drop', event => {
        event.preventDefault();
        reordenarPorPonto({ elemento, array, item, x: event.clientX, y: event.clientY, onMoved });
        limpar();
    });

    pega.addEventListener('pointerdown', event => {
        if (event.button !== 0) return;
        pointerId = event.pointerId;
        ultimoX = event.clientX;
        ultimoY = event.clientY;
        timer = setTimeout(() => {
            pointerAtivo = true;
            pega.setPointerCapture?.(pointerId);
            elemento.classList.add('elevador-is-dragging');
        }, 220);
    });
    pega.addEventListener('pointermove', event => {
        ultimoX = event.clientX;
        ultimoY = event.clientY;
        if (!pointerAtivo) return;
        event.preventDefault();
        const alvo = obterAlvo(elemento, ultimoX, ultimoY);
        document.querySelectorAll('.elevador-is-drag-over').forEach(el => el.classList.remove('elevador-is-drag-over'));
        alvo?.classList.add('elevador-is-drag-over');
    });
    pega.addEventListener('pointerup', () => {
        if (pointerAtivo) reordenarPorPonto({ elemento, array, item, x: ultimoX, y: ultimoY, onMoved });
        limpar();
    });
    pega.addEventListener('pointercancel', limpar);
}
