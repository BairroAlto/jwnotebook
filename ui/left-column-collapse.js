let initialized = false;

function isDesktopWidth() {
    return window.innerWidth > 768;
}

function ensureButton() {
    const host = document.querySelector('.main-container');
    if (!host) return null;

    let btn = document.getElementById('left-column-collapse-toggle');
    if (btn) return btn;

    btn = document.createElement('button');
    btn.id = 'left-column-collapse-toggle';
    btn.className = 'left-column-collapse-toggle';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Colapsar coluna esquerda');
    btn.innerHTML = '<i class="fa-solid fa-chevron-left"></i>';
    btn.addEventListener('click', () => {
        if (!document.body.classList.contains('left-column-collapse-button-enabled') || !isDesktopWidth()) return;
        document.body.classList.toggle('left-column-collapsed');
        syncButton();
    });
    host.appendChild(btn);
    return btn;
}

export function syncButton() {
    const btn = ensureButton();
    if (!btn) return;

    const enabled = document.body.classList.contains('left-column-collapse-button-enabled');
    const visible = enabled && isDesktopWidth();
    const collapsed = document.body.classList.contains('left-column-collapsed');

    btn.hidden = !visible;
    btn.setAttribute('aria-hidden', visible ? 'false' : 'true');
    btn.setAttribute('aria-label', collapsed ? 'Expandir coluna esquerda' : 'Colapsar coluna esquerda');
    btn.title = collapsed ? 'Expandir coluna esquerda' : 'Colapsar coluna esquerda';
    btn.innerHTML = `<i class="fa-solid ${collapsed ? 'fa-chevron-right' : 'fa-chevron-left'}"></i>`;
}

export function aplicarPreferenciaBotaoColapsoColunaEsquerda(enabled) {
    document.body.classList.toggle('left-column-collapse-button-enabled', Boolean(enabled));
    if (!enabled) document.body.classList.remove('left-column-collapsed');
    syncButton();
}

export function iniciarControloColunaEsquerda() {
    ensureButton();
    syncButton();
    if (initialized) return;
    initialized = true;

    window.addEventListener('resize', () => {
        if (!isDesktopWidth()) document.body.classList.remove('left-column-collapsed');
        syncButton();
    });
}
