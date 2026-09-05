import { guardarPreferenciasUtilizador } from '../settings/preferences.js';
import { isMobileViewport } from '../ui/mobile-device.js';

export const BibleSettings = {
    state: {
        verseSize: 16,
        verseSizeDesktop: 16,
        verseSizeMobile: 16,
        gridBookSizeDesktop: 65,
        gridBookSizeMobile: 55,
        rightFontSizeDesktop: 14,
        rightFontSizeMobile: 14,
        titleSize: 65,
        viewMode: 'grid',
        aiFloating: false,
        showCodex: false
    },

    iniciar: () => {
        BibleSettings.carregarPreferencias();
        BibleSettings.vincularAbas();
        BibleSettings.vincularSliders();
        BibleSettings.vincularModoVisao();
        BibleSettings.vincularFloatingAI();
        BibleSettings.vincularExibicaoCodex();
        BibleSettings.aplicarTamanhoVersiculos();
        BibleSettings.aplicarTamanhoGrelha();
        BibleSettings.aplicarTamanhoColunaDireita();

        window.addEventListener('resize', () => {
            BibleSettings.aplicarTamanhoVersiculos();
            BibleSettings.aplicarTamanhoGrelha();
            BibleSettings.aplicarTamanhoColunaDireita();
        });
    },

    carregarPreferencias: () => {
        const prefs = window.NotaBookUserPrefs?.bibleSettings || {};
        BibleSettings.state = {
            ...BibleSettings.state,
            ...prefs,
            verseSizeDesktop: Number(prefs.verseSizeDesktop ?? BibleSettings.state.verseSizeDesktop),
            verseSizeMobile: Number(prefs.verseSizeMobile ?? BibleSettings.state.verseSizeMobile),
            gridBookSizeDesktop: Number(prefs.gridBookSizeDesktop ?? prefs.titleSize ?? BibleSettings.state.gridBookSizeDesktop),
            gridBookSizeMobile: Number(prefs.gridBookSizeMobile ?? prefs.titleSize ?? BibleSettings.state.gridBookSizeMobile),
            rightFontSizeDesktop: Number(prefs.rightFontSizeDesktop ?? BibleSettings.state.rightFontSizeDesktop),
            rightFontSizeMobile: Number(prefs.rightFontSizeMobile ?? BibleSettings.state.rightFontSizeMobile),
            aiFloating: Boolean(prefs.aiFloating),
            viewMode: prefs.viewMode || BibleSettings.state.viewMode,
            showCodex: Boolean(prefs.showCodex)
        };
    },

    persistir: async () => {
        const uid = window.auth?.currentUser?.uid;
        if (!window.NotaBookUserPrefs) window.NotaBookUserPrefs = {};
        window.NotaBookUserPrefs.bibleSettings = { ...BibleSettings.state };
        if (!uid || !window.db) {
            console.warn('[BIBLE-SETTINGS] Preferências não guardadas: utilizador ou Firebase indisponível.');
            return false;
        }

        try {
            await guardarPreferenciasUtilizador(window.db, uid, {
                bibleSettings: { ...BibleSettings.state }
            });
            return true;
        } catch (erro) {
            console.error('[BIBLE-SETTINGS] Falha ao guardar preferências do utilizador.', erro);
            return false;
        }
    },

    vincularAbas: () => {
        const tabs = document.querySelectorAll('.settings-tab');
        tabs.forEach(tab => {
            tab.onclick = () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                const targetId = tab.dataset.target;
                document.querySelectorAll('#popup-settings-bible .ai-content-view').forEach(view => {
                    view.classList.toggle('active', view.id === targetId);
                });
            };
        });
    },

    vincularSliders: () => {
        const rangeVDesktop = document.getElementById('range-bible-font-verses-desktop');
        const rangeVMobile = document.getElementById('range-bible-font-verses-mobile');
        const rangeGDesktop = document.getElementById('range-bible-grid-desktop');
        const rangeGMobile = document.getElementById('range-bible-grid-mobile');
        const rangeRDesktop = document.getElementById('range-bible-right-font-desktop');
        const rangeRMobile = document.getElementById('range-bible-right-font-mobile');

        if (rangeVDesktop) rangeVDesktop.value = String(BibleSettings.state.verseSizeDesktop);
        if (rangeVMobile) rangeVMobile.value = String(BibleSettings.state.verseSizeMobile);
        if (rangeGDesktop) rangeGDesktop.value = String(BibleSettings.state.gridBookSizeDesktop);
        if (rangeGMobile) rangeGMobile.value = String(BibleSettings.state.gridBookSizeMobile);
        if (rangeRDesktop) rangeRDesktop.value = String(BibleSettings.state.rightFontSizeDesktop);
        if (rangeRMobile) rangeRMobile.value = String(BibleSettings.state.rightFontSizeMobile);

        document.getElementById('val-font-verses-desktop')?.replaceChildren(document.createTextNode(`${BibleSettings.state.verseSizeDesktop}px`));
        document.getElementById('val-font-verses-mobile')?.replaceChildren(document.createTextNode(`${BibleSettings.state.verseSizeMobile}px`));
        document.getElementById('val-grid-desktop')?.replaceChildren(document.createTextNode(`${BibleSettings.state.gridBookSizeDesktop}px`));
        document.getElementById('val-grid-mobile')?.replaceChildren(document.createTextNode(`${BibleSettings.state.gridBookSizeMobile}px`));
        document.getElementById('val-right-font-desktop')?.replaceChildren(document.createTextNode(`${BibleSettings.state.rightFontSizeDesktop}px`));
        document.getElementById('val-right-font-mobile')?.replaceChildren(document.createTextNode(`${BibleSettings.state.rightFontSizeMobile}px`));

        BibleSettings.aplicarTamanhoVersiculos();
        BibleSettings.aplicarTamanhoGrelha();
        BibleSettings.aplicarTamanhoColunaDireita();

        const bindRange = (input, key, labelId, onApply) => {
            if (!input) return;
            input.oninput = e => {
                const val = Number(e.target.value);
                BibleSettings.state[key] = val;
                if (onApply) onApply();
                const label = document.getElementById(labelId);
                if (label) label.innerText = `${val}px`;
                void BibleSettings.persistir();
            };
        };

        bindRange(rangeVDesktop, 'verseSizeDesktop', 'val-font-verses-desktop', BibleSettings.aplicarTamanhoVersiculos);
        bindRange(rangeVMobile, 'verseSizeMobile', 'val-font-verses-mobile', BibleSettings.aplicarTamanhoVersiculos);
        bindRange(rangeGDesktop, 'gridBookSizeDesktop', 'val-grid-desktop', BibleSettings.aplicarTamanhoGrelha);
        bindRange(rangeGMobile, 'gridBookSizeMobile', 'val-grid-mobile', BibleSettings.aplicarTamanhoGrelha);
        bindRange(rangeRDesktop, 'rightFontSizeDesktop', 'val-right-font-desktop', BibleSettings.aplicarTamanhoColunaDireita);
        bindRange(rangeRMobile, 'rightFontSizeMobile', 'val-right-font-mobile', BibleSettings.aplicarTamanhoColunaDireita);
    },

    aplicarTamanhoVersiculos: () => {
        const desktop = Number(BibleSettings.state.verseSizeDesktop || BibleSettings.state.verseSize || 16);
        const mobile = Number(BibleSettings.state.verseSizeMobile || desktop);
        BibleSettings.state.verseSize = isMobileViewport() ? mobile : desktop;
        document.documentElement.style.setProperty('--bible-verse-size', `${BibleSettings.state.verseSize}px`);
    },

    aplicarTamanhoGrelha: () => {
        const desktop = Number(BibleSettings.state.gridBookSizeDesktop || 65);
        const mobile = Number(BibleSettings.state.gridBookSizeMobile || 55);
        const size = isMobileViewport() ? mobile : desktop;
        document.documentElement.style.setProperty('--bible-grid-book-size', `${size}px`);
        document.documentElement.style.setProperty('--bible-title-size', `${size}px`);
    },

    aplicarTamanhoColunaDireita: () => {
        const desktop = Number(BibleSettings.state.rightFontSizeDesktop || 14);
        const mobile = Number(BibleSettings.state.rightFontSizeMobile || desktop);
        const size = isMobileViewport() ? mobile : desktop;
        document.documentElement.style.setProperty('--bible-right-font-size', `${size}px`);
    },

    vincularModoVisao: () => {
        const btns = document.querySelectorAll('.view-opt');
        const feed = document.getElementById('bible-feed');
        const previews = document.querySelectorAll('[data-preview-mode]');

        const atualizarMiniatura = mode => {
            previews.forEach(preview => {
                preview.classList.toggle('active', preview.dataset.previewMode === mode);
            });
        };

        btns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === BibleSettings.state.viewMode);
        });
        atualizarMiniatura(BibleSettings.state.viewMode);

        const obterClasseModo = (mode) => {
            if (mode === 'sequence') return 'view-sequence';
            if (mode === 'grid-broken') return 'view-grid-broken';
            return 'view-grid';
        };

        if (feed && window.capAtivo) {
            feed.className = obterClasseModo(BibleSettings.state.viewMode);
        }

        btns.forEach(btn => {
            btn.onclick = () => {
                const mode = btn.dataset.mode;
                btns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                BibleSettings.state.viewMode = mode;
                atualizarMiniatura(mode);

                if (feed && window.capAtivo) {
                    feed.className = obterClasseModo(mode);
                }
                void BibleSettings.persistir();
            };
        });
    },

    vincularFloatingAI: () => {
        const check = document.getElementById('check-ai-floating');
        if (!check) return;

        check.checked = Boolean(BibleSettings.state.aiFloating);

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

        if (BibleSettings.state.aiFloating) {
            check.checked = true;
            check.dispatchEvent(new Event('change'));
        }

        document.getElementById('btn-bookai-float')?.addEventListener('click', () => {
            window.BibleAI?.toggleFloatingChat();
        });
        document.getElementById('btn-bookai-float-close')?.addEventListener('click', () => {
            document.getElementById('bookai-floating-chat')?.classList.add('hidden');
        });
    },

    vincularExibicaoCodex: () => {
        const check = document.getElementById('check-codex-visible');
        if (!check) return;

        check.checked = Boolean(BibleSettings.state.showCodex);
        check.onchange = async e => {
            BibleSettings.state.showCodex = Boolean(e.target.checked);
            window.dispatchEvent(new CustomEvent('bible:codex-visibility-change'));
            await BibleSettings.persistir();
        };
    }
};

window.addEventListener('resize', () => BibleSettings.aplicarTamanhoVersiculos());
window.BibleSettings = BibleSettings;
