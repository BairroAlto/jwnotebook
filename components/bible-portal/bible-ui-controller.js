// components/bible-portal/bible-ui-controller.js

export const BibleUI = {
    carregarMenuSuperior: async () => {
        const menuArea = document.getElementById('area-menu-bible');
        if (!menuArea) return;

        try {
            const res = await fetch('components/topo/menu.html');
            menuArea.innerHTML = await res.text();

            menuArea.querySelectorAll('.nav-item').forEach(link => {
                const texto = link.textContent.trim().toLowerCase();
                link.classList.toggle('active', texto.includes('bíblia') || texto.includes('bÃ­blia'));
            });
        } catch (e) {
            console.error("Erro ao carregar menu superior:", e);
        }
    },

    finalizarLoading: () => {
        const loader = document.getElementById('loading-screen');
        if (loader) {
            loader.style.opacity = '0';
            setTimeout(() => loader.style.display = 'none', 500);
        }
    },

    mostrarLogin: () => {
        const loading = document.getElementById('loading-screen');
        const login = document.getElementById('login-screen');
        if (loading) loading.style.display = 'none';
        if (login) login.style.display = 'flex';
    },

    mostrarLoadingLeitura: (status) => {
        const feed = document.getElementById('bible-feed');
        if (feed) {
            feed.style.opacity = status ? '0.3' : '1';
            feed.style.pointerEvents = status ? 'none' : 'auto';
        }
    },

    ativarModoLeitura: (ativo, titulo) => {
        document.body.classList.toggle('bible-chapter-active', Boolean(ativo));

        if (!ativo && typeof window.fecharPainelNavBiblia === 'function') {
            window.fecharPainelNavBiblia();
        }

        const idsContextuais = [
            'btn-abrir-ancoras-biblia',
            'btn-xsat-bible',
            'btn-abrir-ai-biblia',
            'btn-prev-cap',
            'btn-next-cap'
        ];

        idsContextuais.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                const valorDisplay = ativo ? 'inline-flex' : 'none';
                el.style.setProperty('display', valorDisplay, 'important');
            }
        });

        const titleEl = document.getElementById('bible-context-title');
        if (titleEl) titleEl.innerText = ativo ? (titulo || "ESCOLHER LIVRO") : "ESCOLHER LIVRO";
    },

    abrirPainelLateral: async () => {
        const colDireita = document.getElementById('bible-right-col');
        if (!colDireita) return;

        colDireita.classList.add('active');
        colDireita.classList.remove('closed');
        colDireita.style.setProperty('width', '380px', 'important');
        colDireita.style.setProperty('display', 'flex', 'important');

        if (colDireita.innerHTML.trim() === "" || !document.getElementById('panel-brain')) {
            try {
                const res = await fetch('components/direita/menu.html');
                colDireita.innerHTML = await res.text();

                colDireita.querySelector('#btn-eye')?.remove();
                colDireita.querySelector('#sub-tabs-brain')?.remove();

                const btnBrain = colDireita.querySelector('#btn-brain');
                if (btnBrain) btnBrain.style.marginLeft = "0";
            } catch (e) {
                console.error("Erro no fetch do menu:", e);
            }
        }

        requestAnimationFrame(() => {
            if (window.switchPanel) window.switchPanel('brain');
        });
    },

    fecharPainelLateral: () => {
        const colDireita = document.getElementById('bible-right-col');
        if (colDireita) {
            colDireita.classList.remove('active');
            colDireita.classList.add('closed');
            colDireita.style.width = "0";
        }
    },

    togglePopup: (id, status) => {
        const el = document.getElementById(id);
        if (el) el.classList.toggle('active', status);
    },

    scrollParaVersiculo: (num) => {
        const el = document.querySelector(`[data-v="${num}"]`);
        if (!el) return;

        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.remove('ai-highlight-pulse');
        el.classList.add('bible-verse-focus');

        setTimeout(() => {
            el.classList.remove('bible-verse-focus');
        }, 1800);
    }
};
