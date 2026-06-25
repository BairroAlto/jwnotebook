import { guardarPreferenciasUtilizador } from '../settings/preferences.js';

export const BibleSettings = {
    state: {
        verseSize: 16,
        verseSizeDesktop: 16,
        verseSizeMobile: 16,
        titleSize: 22,
        viewMode: 'grid',
        aiFloating: false
    },

    iniciar: () => {
        BibleSettings.carregarPreferencias();
        BibleSettings.vincularSliders();
        BibleSettings.vincularModoVisao();
        BibleSettings.vincularFloatingAI();
        BibleSettings.aplicarTamanhoVersiculos();
    },

    carregarPreferencias: () => {
        const prefs = window.NotaBookUserPrefs?.bibleSettings || {};
        BibleSettings.state = {
            ...BibleSettings.state,
            ...prefs,
            verseSizeDesktop: Number(prefs.verseSizeDesktop ?? BibleSettings.state.verseSizeDesktop),
            verseSizeMobile: Number(prefs.verseSizeMobile ?? BibleSettings.state.verseSizeMobile),
            titleSize: Number(prefs.titleSize ?? BibleSettings.state.titleSize),
            aiFloating: Boolean(prefs.aiFloating),
            viewMode: prefs.viewMode || BibleSettings.state.viewMode
        };
    },

    persistir: async () => {
        const uid = window.auth?.currentUser?.uid;
        if (!window.NotaBookUserPrefs) window.NotaBookUserPrefs = {};
        window.NotaBookUserPrefs.bibleSettings = { ...BibleSettings.state };
        if (!uid || !window.db) return;
        await guardarPreferenciasUtilizador(window.db, uid, {
            bibleSettings: { ...BibleSettings.state }
        });
    },

    vincularSliders: () => {
        const rangeVDesktop = document.getElementById('range-bible-font-verses-desktop');
        const rangeVMobile = document.getElementById('range-bible-font-verses-mobile');
        const rangeT = document.getElementById('range-bible-font-books');

        if (rangeVDesktop) rangeVDesktop.value = String(BibleSettings.state.verseSizeDesktop);
        if (rangeVMobile) rangeVMobile.value = String(BibleSettings.state.verseSizeMobile);
        if (rangeT) rangeT.value = String(BibleSettings.state.titleSize);
        document.getElementById('val-font-verses-desktop')?.replaceChildren(document.createTextNode(`${BibleSettings.state.verseSizeDesktop}px`));
        document.getElementById('val-font-verses-mobile')?.replaceChildren(document.createTextNode(`${BibleSettings.state.verseSizeMobile}px`));
        document.getElementById('val-font-books')?.replaceChildren(document.createTextNode(`${BibleSettings.state.titleSize}px`));
        document.documentElement.style.setProperty('--bible-title-size', `${BibleSettings.state.titleSize}px`);

        const bindVerseRange = (input, key, labelId) => {
            if (!input) return;
            input.oninput = e => {
                const val = Number(e.target.value);
                BibleSettings.state[key] = val;
                BibleSettings.aplicarTamanhoVersiculos();
                const label = document.getElementById(labelId);
                if (label) label.innerText = `${val}px`;
                void BibleSettings.persistir();
            };
        };
        bindVerseRange(rangeVDesktop, 'verseSizeDesktop', 'val-font-verses-desktop');
        bindVerseRange(rangeVMobile, 'verseSizeMobile', 'val-font-verses-mobile');

        if (rangeT) {
            rangeT.oninput = e => {
                const val = e.target.value;
                document.documentElement.style.setProperty('--bible-title-size', `${val}px`);
                const label = document.getElementById('val-font-books');
                if (label) label.innerText = `${val}px`;
                BibleSettings.state.titleSize = Number(val);
                void BibleSettings.persistir();
            };
        }
    },

    aplicarTamanhoVersiculos: () => {
        const desktop = Number(BibleSettings.state.verseSizeDesktop || BibleSettings.state.verseSize || 16);
        const mobile = Number(BibleSettings.state.verseSizeMobile || desktop);
        BibleSettings.state.verseSize = window.innerWidth <= 768 ? mobile : desktop;
        document.documentElement.style.setProperty('--bible-verse-size', `${BibleSettings.state.verseSize}px`);
    },

    vincularModoVisao: () => {
        const btns = document.querySelectorAll('.view-opt');
        const feed = document.getElementById('bible-feed');

        btns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === BibleSettings.state.viewMode);
        });
        if (feed && !feed.classList.contains('bible-mosaico-view')) {
            feed.className = BibleSettings.state.viewMode === 'sequence' ? 'view-sequence' : 'view-grid';
        }

        btns.forEach(btn => {
            btn.onclick = () => {
                const mode = btn.dataset.mode;
                btns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                if (feed) feed.className = mode === 'sequence' ? 'view-sequence' : 'view-grid';
                BibleSettings.state.viewMode = mode;
                void BibleSettings.persistir();
            };
        });
    },

    vincularFloatingAI: () => {
        const check = document.getElementById('check-ai-floating');
        if (!check) return;

        check.onchange = e => {
            const isFloating = e.target.checked;
            BibleSettings.state.aiFloating = isFloating;

            const iconBarra = document.getElementById('btn-abrir-ai-biblia');
            const zonaFlutuante = document.getElementById('bookai-floating-zone');
            const chatFlutuante = document.getElementById('bookai-floating-chat');

            if (isFloating) {
                if (iconBarra) iconBarra.style.setProperty('display', 'none', 'important');
                if (zonaFlutuante) {
                    zonaFlutuante.classList.remove('hidden');
                    zonaFlutuante.style.display = 'flex';
                }
            } else {
                if (iconBarra && window.livroAtivo) {
                    iconBarra.style.setProperty('display', 'inline-flex', 'important');
                }
                if (zonaFlutuante) {
                    zonaFlutuante.classList.add('hidden');
                    zonaFlutuante.style.display = 'none';
                }
                chatFlutuante?.classList.add('hidden');
            }
            void BibleSettings.persistir();
        };

        check.checked = Boolean(BibleSettings.state.aiFloating);

        document.getElementById('btn-bookai-float')?.addEventListener('click', () => {
            window.BibleAI?.toggleFloatingChat();
        });
        document.getElementById('btn-bookai-float-close')?.addEventListener('click', () => {
            document.getElementById('bookai-floating-chat')?.classList.add('hidden');
        });
    }
};

window.addEventListener('resize', () => BibleSettings.aplicarTamanhoVersiculos());
window.BibleSettings = BibleSettings;
