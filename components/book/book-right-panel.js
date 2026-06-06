import { BookState } from './book-state.js';

export async function ensureBookRightPanel(options = {}) {
    const { reveal = true } = options;
    const col = document.getElementById('area-direita');
    if (!col) return;
    if (!document.getElementById('panel-brain')) {
        const res = await fetch('components/direita/menu.html');
        col.innerHTML = await res.text();
    }
    col.classList.add('book-readonly-panel');
    if (reveal) col.classList.add('active');
    if (window.innerWidth <= 768 && reveal) {
        document.getElementById('mobile-overlay')?.classList.add('active');
    }
}

export async function refreshBookIntelligence(options = {}) {
    const { revealPanel = false } = options;
    if (!BookState.db || !BookState.auth) return;
    await ensureBookRightPanel({ reveal: revealPanel });
    import('../editor/modulos/intelligence/dispatcher.js').then(m => {
        m.despacharInteligenciaEye(BookState.caixas || [], BookState.dadosNota || {}, BookState.db, BookState.auth);
        if (typeof window.switchEyeTab === 'function' && revealPanel) {
            setTimeout(() => window.switchEyeTab('indice'), 220);
        }
    }).catch(() => {});
}
