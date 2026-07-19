import { BIBLE_ABBREVIATIONS } from '../../lists/bilbe-abreviatura.js';

const BAR_ID = 'mobile-bible-helper-bar';
const DEFAULT_ENABLED = true;

let state = {
    enabled: DEFAULT_ENABLED,
    expanded: false,
    refs: [],
    activeInput: null,
    visualViewportBound: false
};

export const MobileBibleBar = {
    iniciar() {
        if (document.getElementById(BAR_ID)) return;

        const bar = document.createElement('section');
        bar.id = BAR_ID;
        bar.className = 'mobile-bible-helper-bar';
        bar.setAttribute('aria-label', 'Textos bíblicos rápidos');
        bar.innerHTML = `
            <button type="button" class="mobile-bible-helper-toggle" aria-label="Mostrar textos bíblicos">
                <i class="fa-solid fa-book-open"></i>
            </button>
            <div class="mobile-bible-helper-content" hidden></div>
            <button type="button" class="mobile-bible-helper-back" aria-label="Voltar aos textos bíblicos" hidden>
                <i class="fa-solid fa-arrow-left"></i>
            </button>
        `;
        document.body.appendChild(bar);

        bar.querySelector('.mobile-bible-helper-toggle').addEventListener('click', () => this.mostrarReferencias());
        bar.querySelector('.mobile-bible-helper-back').addEventListener('click', () => this.mostrarReferencias());

        document.addEventListener('focusin', (event) => {
            const input = event.target.closest?.('#editor-feed textarea, #editor-feed input, #editor-titulo');
            if (!input) return;
            state.activeInput = input;
            this.atualizarReferencias();
            this.actualizarVisibilidade();
        });

        document.addEventListener('input', (event) => {
            if (event.target === state.activeInput) this.atualizarReferencias();
        });

        document.addEventListener('focusout', (event) => {
            if (event.target === state.activeInput) {
                setTimeout(() => {
                    if (!document.activeElement?.matches('#editor-feed textarea, #editor-feed input, #editor-titulo')) {
                        state.activeInput = null;
                        this.actualizarVisibilidade();
                    }
                }, 120);
            }
        });

        this.ligarVisualViewport();
        document.body.addEventListener('mobile-bible-helper-preference', (event) => {
            this.aplicarPreferencia(event.detail?.enabled);
        });
        this.aplicarPreferencia(window.NotaBookUserPrefs?.mobileBibleHelperBar !== false);
    },

    aplicarPreferencia(enabled) {
        state.enabled = Boolean(enabled);
        const bar = document.getElementById(BAR_ID);
        if (!bar) return;
        bar.classList.toggle('is-enabled', state.enabled);
        if (!state.enabled) {
            state.expanded = false;
            state.activeInput = null;
        }
        this.actualizarVisibilidade();
    },

    atualizarVisibilidade() {
        const bar = document.getElementById(BAR_ID);
        if (!bar) return;
        const mobile = window.matchMedia('(pointer: coarse)').matches || window.innerWidth <= 768;
        const visible = state.enabled && mobile && Boolean(state.activeInput);
        bar.classList.toggle('is-visible', visible);
        bar.classList.toggle('is-expanded', visible && state.expanded);
    },

    mostrarReferencias() {
        if (!state.refs.length) {
            state.expanded = false;
            this.renderizarMensagem('Não foram detetados textos bíblicos.');
            return;
        }
        state.expanded = true;
        this.renderizarReferencias();
        this.atualizarVisibilidade();
    },

    atualizarReferencias() {
        if (!state.activeInput) return;
        const inputs = [...document.querySelectorAll('#editor-feed textarea, #editor-feed input, #editor-titulo')];
        const index = inputs.indexOf(state.activeInput);
        const fontes = (index < 0 ? [state.activeInput] : inputs.slice(0, index + 1))
            .map(input => input.value || input.textContent || '')
            .join(' ');
        state.refs = detetarReferencias(fontes);
        if (state.expanded) this.renderizarReferencias();
    },

    renderizarMensagem(texto) {
        const content = document.querySelector(`#${BAR_ID} .mobile-bible-helper-content`);
        if (content) {
            content.hidden = false;
            content.innerHTML = `<span class="mobile-bible-helper-message">${texto}</span>`;
        }
    },

    renderizarReferencias() {
        const content = document.querySelector(`#${BAR_ID} .mobile-bible-helper-content`);
        const back = document.querySelector(`#${BAR_ID} .mobile-bible-helper-back`);
        if (!content || !back) return;
        content.hidden = false;
        back.hidden = false;
        content.innerHTML = '';
        state.refs.forEach(ref => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'mobile-bible-helper-ref';
            button.textContent = ref.label;
            button.addEventListener('click', () => this.carregarTexto(ref));
            content.appendChild(button);
        });
    },

    async carregarTexto(ref) {
        const content = document.querySelector(`#${BAR_ID} .mobile-bible-helper-content`);
        if (!content) return;
        content.innerHTML = '<span class="mobile-bible-helper-message">A carregar...</span>';
        try {
            const slug = ref.book.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '_');
            const response = await fetch(`data/biblia/${slug}.json`);
            const data = await response.json();
            const verses = ref.verses.flatMap(verse => data[ref.book]?.[ref.chapter]?.[verse] ? [{ verse, text: data[ref.book][ref.chapter][verse] }] : []);
            content.innerHTML = `<span class="mobile-bible-helper-transcription"><strong>${ref.label}</strong> ${verses.map(item => `<span><b>${item.verse}</b> ${escapeHtml(item.text)}</span>`).join('')}</span>`;
        } catch (_) {
            content.innerHTML = '<span class="mobile-bible-helper-message">Texto bíblico não encontrado.</span>';
        }
    },

    ligarVisualViewport() {
        if (state.visualViewportBound || !window.visualViewport) return;
        state.visualViewportBound = true;
        const actualizar = () => {
            const offset = Math.max(0, window.innerHeight - window.visualViewport.height - window.visualViewport.offsetTop);
            document.documentElement.style.setProperty('--mobile-keyboard-offset', `${offset}px`);
        };
        window.visualViewport.addEventListener('resize', actualizar);
        window.visualViewport.addEventListener('scroll', actualizar);
        actualizar();
    }
};

function detetarReferencias(texto) {
    const nomes = Object.keys(BIBLE_ABBREVIATIONS).sort((a, b) => b.length - a.length);
    const regex = new RegExp(`(?:^|[^a-zA-ZÀ-ÿ])(${nomes.map(escaparRegex).join('|')})\\s+(\\d+)[:\\s](\\d+(?:[\\s,;:-]*\\d+)*)`, 'gi');
    const refs = [];
    let match;
    while ((match = regex.exec(texto)) !== null) {
        const key = nomes.find(nome => nome.toLowerCase() === match[1].toLowerCase());
        const verses = match[3].split(/[\s,;:-]+/).map(Number).filter(Number.isFinite);
        if (!key || !verses.length) continue;
        refs.push({ book: BIBLE_ABBREVIATIONS[key], chapter: Number(match[2]), verses: [...new Set(verses)], label: `${BIBLE_ABBREVIATIONS[key]} ${match[2]}:${verses.join(',')}` });
    }
    return refs;
}

function escaparRegex(texto) {
    return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeHtml(texto) {
    return String(texto).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}
