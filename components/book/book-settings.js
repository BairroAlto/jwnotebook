import { BookState } from './book-state.js';
import { renderBookFeed } from './book-renderer.js';
import { atualizarBookAIFloatingUI } from './book-ai.js';
import { guardarPreferenciasUtilizador } from '../settings/preferences.js';
import { aplicarPreferenciaBotaoColapsoColunaEsquerda } from '../ui/left-column-collapse.js';

const KEY = "notabook:book:settings";

export function iniciarBookSettings() {
    carregarSettings();
    aplicarUI();
    document.getElementById('book-btn-settings')?.addEventListener('click', () => {
        document.getElementById('book-popup-settings')?.classList.add('active');
    });
    document.getElementById('book-settings-close')?.addEventListener('click', () => {
        document.getElementById('book-popup-settings')?.classList.remove('active');
    });

    bindFontRange('book-font-range-desktop', 'fontSizeDesktop');
    bindFontRange('book-font-range-mobile', 'fontSizeMobile');
    bindSegment('book-view-mode', 'viewMode', 'mode');
    bindSegment('book-tag-position', 'tagPosition', 'pos');
    bindSegment('book-margin-style', 'marginStyle', 'margin');

    const floatingToggle = document.getElementById('book-ai-floating-toggle');
    floatingToggle?.addEventListener('change', () => {
        BookState.settings.aiFloating = floatingToggle.checked;
        guardarSettings();
        aplicarUI();
        atualizarBookAIFloatingUI();
    });

    const leftCollapseToggle = document.getElementById('book-left-collapse-toggle');
    leftCollapseToggle?.addEventListener('change', async () => {
        const checked = leftCollapseToggle.checked;
        if (!window.NotaBookUserPrefs) window.NotaBookUserPrefs = {};
        window.NotaBookUserPrefs.leftColumnCollapseButton = checked;
        aplicarPreferenciaBotaoColapsoColunaEsquerda(checked);
        const uid = window.auth?.currentUser?.uid;
        if (uid) {
            await guardarPreferenciasUtilizador(window.db, uid, { leftColumnCollapseButton: checked });
        }
    });

    window.addEventListener('resize', aplicarTamanhoResponsivoBook);
}

function bindFontRange(id, key) {
    const range = document.getElementById(id);
    range?.addEventListener('input', () => {
        BookState.settings[key] = Number(range.value);
        guardarSettings();
        aplicarUI();
        renderBookFeed();
    });
}

function bindSegment(id, key, dataKey) {
    document.getElementById(id)?.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', () => {
            BookState.settings[key] = btn.dataset[dataKey];
            guardarSettings();
            aplicarUI();
            renderBookFeed();
        });
    });
}

function carregarSettings() {
    try {
        const saved = JSON.parse(localStorage.getItem(KEY) || "{}");
        Object.assign(BookState.settings, saved);
    } catch (_) {}
    if (!BookState.settings.fontSizeDesktop) BookState.settings.fontSizeDesktop = BookState.settings.fontSize || 17;
    if (!BookState.settings.fontSizeMobile) BookState.settings.fontSizeMobile = BookState.settings.fontSize || BookState.settings.fontSizeDesktop || 17;
}

function guardarSettings() {
    localStorage.setItem(KEY, JSON.stringify(BookState.settings));
}

function aplicarUI() {
    const desktopSize = Number(BookState.settings.fontSizeDesktop || BookState.settings.fontSize || 17);
    const mobileSize = Number(BookState.settings.fontSizeMobile || desktopSize);
    const desktopRange = document.getElementById('book-font-range-desktop');
    const mobileRange = document.getElementById('book-font-range-mobile');
    const desktopLabel = document.getElementById('book-font-value-desktop');
    const mobileLabel = document.getElementById('book-font-value-mobile');
    if (desktopRange) desktopRange.value = desktopSize;
    if (mobileRange) mobileRange.value = mobileSize;
    if (desktopLabel) desktopLabel.textContent = `${desktopSize}px`;
    if (mobileLabel) mobileLabel.textContent = `${mobileSize}px`;
    aplicarTamanhoResponsivoBook();
    setActive('book-view-mode', BookState.settings.viewMode, 'mode');
    setActive('book-tag-position', BookState.settings.tagPosition, 'pos');
    setActive('book-margin-style', BookState.settings.marginStyle || 'solid', 'margin');
    const floatingToggle = document.getElementById('book-ai-floating-toggle');
    if (floatingToggle) floatingToggle.checked = Boolean(BookState.settings.aiFloating);
    const leftCollapseToggle = document.getElementById('book-left-collapse-toggle');
    if (leftCollapseToggle) leftCollapseToggle.checked = Boolean(window.NotaBookUserPrefs?.leftColumnCollapseButton);
}

function aplicarTamanhoResponsivoBook() {
    const desktopSize = Number(BookState.settings.fontSizeDesktop || BookState.settings.fontSize || 17);
    const mobileSize = Number(BookState.settings.fontSizeMobile || desktopSize);
    const current = window.innerWidth <= 768 ? mobileSize : desktopSize;
    BookState.settings.fontSize = current;
    document.documentElement.style.setProperty('--book-text-size', `${current}px`);
}

function setActive(id, value, dataKey) {
    document.getElementById(id)?.querySelectorAll('button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset[dataKey] === value);
    });
}
