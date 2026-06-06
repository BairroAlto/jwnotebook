import { BookState } from './book-state.js';
import { renderBookFeed } from './book-renderer.js';

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

    const range = document.getElementById('book-font-range');
    range?.addEventListener('input', () => {
        BookState.settings.fontSize = Number(range.value);
        guardarSettings();
        aplicarUI();
        renderBookFeed();
    });

    bindSegment('book-view-mode', 'viewMode', 'mode');
    bindSegment('book-tag-position', 'tagPosition', 'pos');
    bindSegment('book-margin-style', 'marginStyle', 'margin');
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
}

function guardarSettings() {
    localStorage.setItem(KEY, JSON.stringify(BookState.settings));
}

function aplicarUI() {
    const range = document.getElementById('book-font-range');
    const label = document.getElementById('book-font-value');
    if (range) range.value = BookState.settings.fontSize;
    if (label) label.textContent = `${BookState.settings.fontSize}px`;
    setActive('book-view-mode', BookState.settings.viewMode, 'mode');
    setActive('book-tag-position', BookState.settings.tagPosition, 'pos');
    setActive('book-margin-style', BookState.settings.marginStyle || 'solid', 'margin');
}

function setActive(id, value, dataKey) {
    document.getElementById(id)?.querySelectorAll('button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset[dataKey] === value);
    });
}
