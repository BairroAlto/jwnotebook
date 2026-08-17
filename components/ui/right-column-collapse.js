import { isMobileViewport } from './mobile-device.js';

let initialized = false;

function isDesktopWidth() {
    return !isMobileViewport();
}

function obterColunaDireita() {
    return document.getElementById('area-direita')
        || document.querySelector('.main-container > .right-col');
}

function ensureButton() {
    const host = document.querySelector('.main-container');
    if (!host) return null;

    let btn = document.getElementById('right-column-collapse-toggle');
    if (btn) return btn;

    btn = document.createElement('button');
    btn.id = 'right-column-collapse-toggle';
    btn.className = 'right-column-collapse-toggle';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Colapsar coluna direita');
    btn.innerHTML = '<i class="fa-solid fa-chevron-right"></i>';
    btn.addEventListener('click', () => {
        if (!document.body.classList.contains('right-column-collapse-button-enabled')) return;

        if (isDesktopWidth()) {
            document.body.classList.toggle('right-column-collapsed');
            syncButton();
            return;
        }

        const coluna = obterColunaDireita();
        if (coluna?.classList.contains('active')) {
            window.MobilePanelManager?.fechar('right');
        } else {
            window.MobilePanelManager?.abrir('right');
        }
        syncButton();
    });
    host.appendChild(btn);
    return btn;
}

export function syncButton() {
    const btn = ensureButton();
    if (!btn) return;

    const enabled = document.body.classList.contains('right-column-collapse-button-enabled');
    const desktop = isDesktopWidth();
    const coluna = obterColunaDireita();
    const mobileOpen = coluna?.classList.contains('active') === true;
    const collapsed = desktop
        ? document.body.classList.contains('right-column-collapsed')
        : !mobileOpen;
    const visible = enabled && (desktop || mobileOpen);

    btn.hidden = !visible;
    btn.style.display = visible ? 'inline-flex' : 'none';
    btn.setAttribute('aria-hidden', visible ? 'false' : 'true');
    btn.setAttribute('aria-label', collapsed ? 'Expandir coluna direita' : 'Colapsar coluna direita');
    btn.title = collapsed ? 'Expandir coluna direita' : 'Colapsar coluna direita';
    btn.innerHTML = `<i class="fa-solid ${collapsed ? 'fa-chevron-left' : 'fa-chevron-right'}"></i>`;
}

export function aplicarPreferenciaBotaoColapsoColunaDireita(enabled) {
    document.body.classList.toggle('right-column-collapse-button-enabled', Boolean(enabled));
    if (!enabled) document.body.classList.remove('right-column-collapsed');
    syncButton();
}

export function iniciarControloColunaDireita() {
    ensureButton();
    syncButton();
    if (initialized) return;
    initialized = true;

    window.addEventListener('resize', () => {
        if (!isDesktopWidth()) document.body.classList.remove('right-column-collapsed');
        syncButton();
    });

    const coluna = obterColunaDireita();
    if (coluna) {
        new MutationObserver(syncButton).observe(coluna, {
            attributes: true,
            attributeFilter: ['class']
        });
    }
}
