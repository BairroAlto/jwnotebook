import {
    ehHtmlRico,
    sanitizarHtmlRico,
    obterTextoSimplesRico
} from './rich-text-sanitizer.js';

export { ehHtmlRico, sanitizarHtmlRico, obterTextoSimplesRico } from './rich-text-sanitizer.js';

const CORES_TEXTO = ['#f8fafc', '#fbbf24', '#60a5fa', '#34d399', '#f87171'];
const NIVEIS_TAMANHO_TEXTO = [1, 1.08, 1.16, 1.24, 1.32, 1.40]; // A4, A3, A2, A1, A0, A+1
const CLASSES_NIVEIS_TAMANHO = ['nb-rich-size-a4', 'nb-rich-size-a3', 'nb-rich-size-a2', 'nb-rich-size-a1', 'nb-rich-size-a0', 'nb-rich-size-aplus1'];

let barra = null;
let editorActivo = null;
let selecaoGuardada = null;
let viewportMobileLigado = false;
let selecaoActualizacaoAgendada = false;

function garantirBarra() {
    if (barra) return barra;
    barra = document.createElement('div');
    barra.className = 'nb-rich-toolbar';
    barra.setAttribute('role', 'toolbar');
    barra.setAttribute('aria-label', 'Formatação do texto');
    barra.innerHTML = `
        <button type="button" data-rich-command="bold" aria-label="Negrito" title="Negrito"><strong>B</strong></button>
        <button type="button" data-rich-command="italic" aria-label="Itálico" title="Itálico"><em>I</em></button>
        <button type="button" data-rich-command="underline" aria-label="Sublinhado" title="Sublinhado"><u>U</u></button>
        <span class="nb-rich-toolbar-separator" aria-hidden="true"></span>
        <button type="button" data-rich-command="smaller" aria-label="Diminuir tamanho" title="Diminuir tamanho">A−</button>
        <button type="button" data-rich-command="larger" aria-label="Aumentar tamanho" title="Aumentar tamanho">A+</button>
        <button type="button" class="nb-rich-color-trigger" aria-label="Mudar cor do texto" title="Mudar cor do texto">A</button>
        <div class="nb-rich-colors" hidden>${CORES_TEXTO.map(cor => `<button type="button" data-rich-color="${cor}" aria-label="Cor ${cor}" style="--rich-color:${cor}"></button>`).join('')}</div>
    `;
    document.body.appendChild(barra);

    barra.addEventListener('pointerdown', evento => {
        evento.preventDefault();
    });
    barra.addEventListener('click', evento => {
        const botao = evento.target.closest('button');
        if (!botao || !editorActivo) return;
        if (botao.classList.contains('nb-rich-color-trigger')) {
            const cores = barra.querySelector('.nb-rich-colors');
            cores.hidden = !cores.hidden;
            return;
        }
        if (botao.dataset.richColor) {
            executarComando('foreColor', botao.dataset.richColor);
            barra.querySelector('.nb-rich-colors').hidden = true;
            return;
        }
        const comando = botao.dataset.richCommand;
        if (comando === 'smaller') ajustarTamanhoSelecao(-1);
        else if (comando === 'larger') ajustarTamanhoSelecao(1);
        else if (comando) executarComando(comando);
    });
    return barra;
}

function editorDaSelecao(selecao) {
    const range = selecao?.rangeCount ? selecao.getRangeAt(0) : null;
    const nos = [range?.commonAncestorContainer, selecao?.anchorNode, selecao?.focusNode];
    for (const node of nos) {
        const elemento = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
        const editor = elemento?.closest?.('.nb-rich-editor');
        if (editor) return editor;
    }
    return null;
}

function posicionarBarra(mostrar = false) {
    // Eventos do browser e timestamps do requestAnimationFrame não podem
    // activar a barra; apenas uma nova seleção pode pedir a sua abertura.
    mostrar = mostrar === true;
    if (!barra || !editorActivo || !selecaoGuardada) {
        return;
    }
    const rect = obterRectSelecao(selecaoGuardada, editorActivo);
    if (!rect) return;
    if (mostrar) barra.classList.add('is-visible');
    if (!barra.classList.contains('is-visible')) return;
    actualizarCompensacaoMobile();
    if (window.matchMedia('(max-width: 768px), (pointer: coarse) and (hover: none)').matches) return;
    const largura = barra.offsetWidth || 280;
    const esquerda = Math.max(8, Math.min(window.innerWidth - largura - 8, rect.left + (rect.width - largura) / 2));
    const topo = Math.max(8, rect.top - (barra.offsetHeight || 42) - 8);
    barra.style.left = `${esquerda}px`;
    barra.style.top = `${topo}px`;
}

function obterRectSelecao(range, editor) {
    const recto = range.getBoundingClientRect();
    if (recto.width || recto.height) return recto;

    const primeiroRecto = range.getClientRects?.()[0];
    if (primeiroRecto && (primeiroRecto.width || primeiroRecto.height)) return primeiroRecto;

    const rectoEditor = editor?.getBoundingClientRect?.();
    return rectoEditor && (rectoEditor.width || rectoEditor.height) ? rectoEditor : null;
}

function actualizarCompensacaoMobile() {
    if (!barra) return;
    const mobile = window.matchMedia('(max-width: 768px), (pointer: coarse) and (hover: none)').matches;
    if (!mobile) {
        barra.style.removeProperty('--nb-rich-keyboard-offset');
        return;
    }
    const viewport = window.visualViewport;
    const teclado = viewport
        ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
        : 0;
    barra.style.setProperty('--nb-rich-keyboard-offset', `${Math.round(teclado)}px`);
}

function ligarViewportMobile() {
    if (viewportMobileLigado) return;
    viewportMobileLigado = true;
    const actualizar = () => {
        actualizarCompensacaoMobile();
        if (barra?.classList.contains('is-visible')) {
            requestAnimationFrame(() => posicionarBarra(false));
        }
    };
    window.addEventListener('resize', actualizar, { passive: true });
    window.visualViewport?.addEventListener('resize', actualizar, { passive: true });
    window.visualViewport?.addEventListener('scroll', actualizar, { passive: true });
    document.body.addEventListener('mobile-bible-helper-layout', actualizar, { passive: true });
    actualizar();
}

function actualizarSelecao() {
    const selecao = window.getSelection?.();
    const editor = selecao && !selecao.isCollapsed ? editorDaSelecao(selecao) : null;
    if (!editor || !selecao.rangeCount) {
        if (!barra?.matches(':hover')) barra?.classList.remove('is-visible');
        return;
    }
    editorActivo = editor;
    selecaoGuardada = selecao.getRangeAt(0).cloneRange();
    garantirBarra();
    ligarViewportMobile();
    requestAnimationFrame(() => posicionarBarra(true));
}

function agendarActualizacaoSelecao() {
    if (selecaoActualizacaoAgendada) return;
    selecaoActualizacaoAgendada = true;
    requestAnimationFrame(() => {
        selecaoActualizacaoAgendada = false;
        actualizarSelecao();
        // Alguns WebKit só finalizam a seleção depois do primeiro frame.
        setTimeout(actualizarSelecao, 0);
    });
}

function restaurarSelecao() {
    if (!editorActivo || !selecaoGuardada) return false;
    const selecao = window.getSelection();
    selecao.removeAllRanges();
    selecao.addRange(selecaoGuardada);
    editorActivo.focus({ preventScroll: true });
    return true;
}

function dispararAlteracao(editor) {
    editor.dispatchEvent(new Event('input', { bubbles: true }));
}

function executarComando(comando, valor = null) {
    if (!restaurarSelecao()) return;
    document.execCommand(comando, false, valor);
    if (editorActivo) {
        dispararAlteracao(editorActivo);
        const selecao = window.getSelection();
        if (selecao?.rangeCount) selecaoGuardada = selecao.getRangeAt(0).cloneRange();
    }
    requestAnimationFrame(() => posicionarBarra(false));
}

function ajustarTamanhoSelecao(delta) {
    if (!restaurarSelecao()) return;
    const selecao = window.getSelection();
    if (!selecao?.rangeCount || selecao.isCollapsed || !editorActivo) return;

    const range = selecao.getRangeAt(0);
    const elementoBase = range.startContainer.nodeType === Node.ELEMENT_NODE
        ? range.startContainer
        : range.startContainer.parentElement;
    const basePx = parseFloat(window.getComputedStyle(editorActivo).fontSize) || 16;
    const nivelMarcado = CLASSES_NIVEIS_TAMANHO.findIndex(classe => elementoBase?.closest?.(`.${classe}`));
    const tamanhoActual = parseFloat(window.getComputedStyle(elementoBase || editorActivo).fontSize) || basePx;
    const nivelCalculado = NIVEIS_TAMANHO_TEXTO.reduce((melhor, multiplicador, indice) => {
        const distancia = Math.abs((tamanhoActual / basePx) - multiplicador);
        return distancia < melhor.distancia ? { indice, distancia } : melhor;
    }, { indice: 0, distancia: Infinity }).indice;
    const nivelActual = nivelMarcado >= 0
        ? nivelMarcado
        : (Math.abs(tamanhoActual - basePx) < 0.5 ? 0 : nivelCalculado);
    const nivelNovo = Math.min(NIVEIS_TAMANHO_TEXTO.length - 1, Math.max(0, nivelActual + delta));
    const tamanhoNovo = Math.round(basePx * NIVEIS_TAMANHO_TEXTO[nivelNovo]);
    const elementoNivelActual = elementoBase?.closest?.(`.${CLASSES_NIVEIS_TAMANHO.join(',.')}`);

    const substituirElementoActual = elementoNivelActual && rangeCobreElemento(range, elementoNivelActual);
    const fragmento = substituirElementoActual
        ? (() => {
            const conteudo = document.createDocumentFragment();
            while (elementoNivelActual.firstChild) conteudo.appendChild(elementoNivelActual.firstChild);
            return conteudo;
        })()
        : range.extractContents();

    fragmento.querySelectorAll?.('*').forEach(elemento => {
        elemento.style.removeProperty('font-size');
        elemento.classList.remove('nb-rich-size-small', 'nb-rich-size-large');
        CLASSES_NIVEIS_TAMANHO.forEach(classe => elemento.classList.remove(classe));
    });

    const contentor = document.createElement('span');
    contentor.classList.add(CLASSES_NIVEIS_TAMANHO[nivelNovo]);
    if (nivelNovo > 0) contentor.style.fontSize = `${tamanhoNovo}px`;
    contentor.appendChild(fragmento);
    if (substituirElementoActual) elementoNivelActual.replaceWith(contentor);
    else range.insertNode(contentor);

    range.selectNodeContents(contentor);
    selecao.removeAllRanges();
    selecao.addRange(range);
    selecaoGuardada = range.cloneRange();
    dispararAlteracao(editorActivo);
    requestAnimationFrame(() => posicionarBarra(false));
}

function rangeCobreElemento(range, elemento) {
    const completo = document.createRange();
    completo.selectNodeContents(elemento);
    return range.compareBoundaryPoints(Range.START_TO_START, completo) <= 0 &&
        range.compareBoundaryPoints(Range.END_TO_END, completo) >= 0;
}

function esconderBarraAoClicarFora(evento) {
    if (barra?.contains(evento.target) || evento.target.closest?.('.nb-rich-editor')) return;
    barra?.classList.remove('is-visible');
}

export function criarEditorRico({ valor = '', placeholder = 'Escreve aqui...', className = '', onInput = () => {} } = {}) {
    garantirBarra();
    const editor = document.createElement('div');
    editor.className = `nb-rich-editor ${className}`.trim();
    editor.contentEditable = 'true';
    editor.spellcheck = true;
    editor.setAttribute('role', 'textbox');
    editor.setAttribute('aria-multiline', 'true');
    editor.dataset.placeholder = placeholder;
    editor.innerHTML = sanitizarHtmlRico(valor);

    editor.addEventListener('paste', evento => {
        evento.preventDefault();
        const texto = evento.clipboardData?.getData('text/plain') || '';
        document.execCommand('insertText', false, texto.replace(/\r\n?/g, '\n'));
    });
    editor.addEventListener('drop', evento => {
        evento.preventDefault();
        const texto = evento.dataTransfer?.getData('text/plain') || '';
        if (!texto) return;
        const selecao = window.getSelection();
        if (!selecao?.rangeCount || !editor.contains(selecao.anchorNode)) return;
        const range = selecao.getRangeAt(0);
        range.deleteContents();
        const no = document.createTextNode(texto.replace(/\r\n?/g, '\n'));
        range.insertNode(no);
        range.setStartAfter(no);
        range.collapse(true);
        selecao.removeAllRanges();
        selecao.addRange(range);
        dispararAlteracao(editor);
    });
    editor.addEventListener('input', () => {
        onInput({
            html: sanitizarHtmlRico(editor.innerHTML),
            texto: obterTextoSimplesRico(editor.innerHTML),
            editor
        });
    });
    editor.addEventListener('mouseup', agendarActualizacaoSelecao);
    editor.addEventListener('pointerup', agendarActualizacaoSelecao);
    editor.addEventListener('touchend', agendarActualizacaoSelecao, { passive: true });
    editor.addEventListener('select', agendarActualizacaoSelecao);
    editor.addEventListener('keyup', agendarActualizacaoSelecao);
    return editor;
}

document.addEventListener('selectionchange', agendarActualizacaoSelecao);
document.addEventListener('pointerdown', esconderBarraAoClicarFora);
window.addEventListener('resize', () => posicionarBarra(false));
window.addEventListener('scroll', () => posicionarBarra(false), true);
