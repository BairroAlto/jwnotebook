const estado = {
    left: 'closed',
    right: 'closed',
    listaOriginal: null
};

function mobileActivo() {
    return window.innerWidth <= 768;
}

function obterPainel(tipo) {
    return document.getElementById(tipo === 'left' ? 'area-esquerda' : 'area-direita');
}

function actualizarOverlay() {
    const overlay = document.getElementById('mobile-overlay');
    const left = obterPainel('left');
    const right = obterPainel('right');
    const leftAberto = estado.left === 'open' && !left?.classList.contains('closed');
    const rightAberto = (estado.right === 'open' || estado.right === 'minimized') &&
        right?.classList.contains('active');
    if (overlay) overlay.classList.toggle('active', leftAberto || rightAberto);
    document.body.style.overflow = leftAberto || rightAberto ? 'hidden' : '';
}

function actualizarDock() {
    const dock = document.getElementById('mobile-panel-dock');
    if (!dock) return;

    // O painel direito minimizado permanece visível como bottom sheet a 10%.
    // O dock fica reservado para reabrir a navegação minimizada, sem texto.
    if (estado.left !== 'minimized') {
        dock.innerHTML = '';
        dock.style.display = 'none';
        return;
    }

    dock.innerHTML = '<button type="button" class="mobile-panel-tab" data-mobile-restore="left" title="Reabrir navegação" aria-label="Reabrir navegação">' +
        '<i class="fa-solid fa-bars"></i></button>';
    dock.style.display = 'flex';
    dock.querySelector('[data-mobile-restore]')?.addEventListener('click', () => abrir('left'));
}

function configurarControlos() {
    const left = document.getElementById('area-esquerda');
    const rightHandle = document.getElementById('mobile-drag-handle');

    if (left && !document.getElementById('mobile-left-panel-head')) {
        const head = document.createElement('div');
        head.id = 'mobile-left-panel-head';
        head.innerHTML = '<span><i class="fa-solid fa-bars"></i> Navegação</span>' +
            '<button type="button" id="btn-minimize-left-panel" title="Minimizar navegação" aria-label="Minimizar navegação">' +
            '<i class="fa-solid fa-window-minimize"></i></button>';
        left.insertBefore(head, left.firstChild);
        head.querySelector('button').onclick = () => minimizar('left');
    }

    if (rightHandle && !document.getElementById('btn-minimize-right-panel')) {
        const button = document.createElement('button');
        button.type = 'button';
        button.id = 'btn-minimize-right-panel';
        button.title = 'Minimizar painel';
        button.setAttribute('aria-label', 'Minimizar painel');
        button.innerHTML = '<i class="fa-solid fa-window-minimize"></i>';
        button.onclick = event => {
            event.stopPropagation();
            minimizar('right');
        };
        rightHandle.appendChild(button);
    }
}

function prepararPainelFonte() {
    const lista = document.getElementById('lista-lists');
    const destino = document.getElementById('mobile-source-content');
    if (!lista || !destino) return;

    if (!estado.listaOriginal) {
        estado.listaOriginal = {
            parent: lista.parentElement,
            next: lista.nextSibling
        };
    }

    destino.appendChild(lista);
    lista.style.display = 'flex';
    lista.style.flexDirection = 'column';
    lista.style.overflowY = 'auto';
}

function restaurarPainelFonte() {
    const lista = document.getElementById('lista-lists');
    const origem = estado.listaOriginal;
    if (!lista || !origem?.parent) return;

    if (origem.next && origem.next.parentElement === origem.parent) origem.parent.insertBefore(lista, origem.next);
    else origem.parent.appendChild(lista);
    lista.style.removeProperty('display');
    lista.style.removeProperty('flex-direction');
    lista.style.removeProperty('overflow-y');
    estado.listaOriginal = null;
}

function abrirFonteXSatMobile() {
    if (!mobileActivo()) return false;
    prepararPainelFonte();
    const btnSource = document.getElementById('btn-source');
    if (btnSource) btnSource.style.display = 'flex';
    abrir('right');
    if (typeof window.switchPanel === 'function') window.switchPanel('source');
    return true;
}

function fecharFonteXSatMobile(opcoes = {}) {
    restaurarPainelFonte();
    const btnSource = document.getElementById('btn-source');
    if (btnSource && !opcoes.manterBotao) btnSource.style.display = 'none';
    if (!opcoes.restoreOnly && typeof window.switchPanel === 'function') window.switchPanel('xsat');
}

function abrir(tipo) {
    if (!mobileActivo()) return;
    const painel = obterPainel(tipo);
    if (!painel) return;

    if (tipo === 'left') {
        const right = obterPainel('right');
        right?.classList.remove('active');
        if (estado.right !== 'minimized') {
            right?.classList.remove('mobile-panel-minimized');
            right?.style.removeProperty('height');
            if (right) delete right.dataset.mobileSheetPct;
        }
        estado.right = estado.right === 'minimized' ? 'minimized' : 'closed';
        painel.classList.remove('closed', 'mobile-panel-minimized');
        estado.left = 'open';
    } else {
        const left = obterPainel('left');
        left?.classList.add('closed');
        if (estado.left !== 'minimized') left?.classList.remove('mobile-panel-minimized');
        estado.left = estado.left === 'minimized' ? 'minimized' : 'closed';
        const folhaJaAberta = painel.classList.contains('active');
        painel.classList.remove('mobile-panel-minimized');
        painel.classList.add('active');
        if (!folhaJaAberta && !painel.style.height) {
            const pctGuardada = Number(painel.dataset.mobileSheetPct);
            painel.style.height = Number.isFinite(pctGuardada) ? pctGuardada + 'vh' : '68vh';
        }
        estado.right = 'open';
    }

    actualizarOverlay();
    actualizarDock();
}

function fechar(tipo) {
    const painel = obterPainel(tipo);
    if (!painel) return;

    painel.classList.remove('mobile-panel-minimized', 'active');
    if (tipo === 'left') painel.classList.add('closed');
    if (tipo === 'right') {
        painel.style.removeProperty('height');
        delete painel.dataset.mobileSheetPct;
    }
    estado[tipo] = 'closed';
    actualizarOverlay();
    actualizarDock();
}

function minimizar(tipo) {
    const painel = obterPainel(tipo);
    if (!painel) return;

    if (tipo === 'right') {
        // Minimizar equivale a arrastar a folha até ao limite inferior.
        painel.classList.remove('mobile-panel-minimized');
        painel.classList.add('active');
        painel.style.height = '10vh';
        painel.dataset.mobileSheetPct = '10';
    } else {
        painel.classList.add('mobile-panel-minimized');
        painel.classList.remove('active');
        painel.classList.add('closed');
    }

    estado[tipo] = 'minimized';
    actualizarOverlay();
    actualizarDock();
}

function definirEstadoFolha(novoEstado) {
    const painel = obterPainel('right');
    if (!painel) return;

    if (novoEstado === 'closed') {
        painel.classList.remove('active', 'mobile-panel-minimized');
        painel.style.removeProperty('height');
        delete painel.dataset.mobileSheetPct;
    } else if (novoEstado === 'minimized') {
        painel.classList.add('active');
        painel.classList.remove('mobile-panel-minimized');
        painel.style.height = '10vh';
        painel.dataset.mobileSheetPct = '10';
    } else {
        painel.classList.add('active');
        painel.classList.remove('mobile-panel-minimized');
        delete painel.dataset.mobileSheetPct;
    }

    estado.right = novoEstado;
    actualizarOverlay();
    actualizarDock();
}

export const MobilePanelManager = {
    iniciar: () => {
        if (!mobileActivo()) return;
        configurarControlos();
        actualizarDock();
        window.abrirFonteXSatMobile = abrirFonteXSatMobile;
        window.fecharFonteXSatMobile = fecharFonteXSatMobile;
        window.MobilePanelManager = MobilePanelManager;
    },
    abrir,
    fechar,
    minimizar,
    definirEstadoFolha,
    sincronizar: actualizarDock,
    restaurarFonte: () => restaurarPainelFonte()
};



