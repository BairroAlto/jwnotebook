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
                link.classList.toggle('active', texto.includes('bíblia') || texto.includes('bã­blia') || texto.includes('bÃ­blia') || texto.includes('biblia'));
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
                const esconderAi = id === 'btn-abrir-ai-biblia' && ativo && window.BibleSettings?.state?.aiFloating;
                const valorDisplay = ativo && !esconderAi ? 'inline-flex' : 'none';
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
        colDireita.style.setProperty('display', 'flex', 'important');
        if (isBibleTouchMobile()) {
            colDireita.style.removeProperty('width');
            colDireita.style.removeProperty('min-width');
            colDireita.style.setProperty('height', `${Number(colDireita.dataset.sheetPct || 55)}vh`, 'important');
        } else {
            colDireita.style.setProperty('width', '380px', 'important');
        }

        if (colDireita.innerHTML.trim() === "" || !document.getElementById('panel-brain')) {
            try {
                const res = await fetch('components/direita/menu.html');
                colDireita.innerHTML = await res.text();

                instalarBibleMobileSheet(colDireita);
                colDireita.querySelector('#btn-eye')?.remove();
                colDireita.querySelector('#sub-tabs-brain')?.remove();

                const btnBrain = colDireita.querySelector('#btn-brain');
                if (btnBrain) btnBrain.style.marginLeft = "0";
            } catch (e) {
                console.error("Erro no fetch do menu:", e);
            }
        } else {
            instalarBibleMobileSheet(colDireita);
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

function instalarBibleMobileSheet(col) {
    if (!col || col.querySelector('.mobile-sheet-chrome')) return;

    const chrome = document.createElement('div');
    chrome.className = 'mobile-sheet-chrome';
    chrome.innerHTML = `
        <div class="mobile-sheet-handle"></div>
        <button class="mobile-sheet-close" title="Fechar"><i class="fa-solid fa-xmark"></i></button>
    `;
    col.prepend(chrome);

    chrome.querySelector('.mobile-sheet-close').onclick = () => {
        col.classList.remove('active');
        col.classList.add('closed');
        col.style.removeProperty('width');
        col.style.removeProperty('min-width');
        col.style.removeProperty('height');
        col.style.removeProperty('bottom');
    };

    const handle = chrome.querySelector('.mobile-sheet-handle');
    const dragTargets = [handle, chrome].filter(Boolean);
    let startY = 0;
    let startHeight = 0;

    const setPct = (pct) => {
        const clamped = Math.max(10, Math.min(85, pct));
        col.style.setProperty('height', `${clamped}vh`, 'important');
        col.dataset.sheetPct = String(clamped);
    };
    if (isBibleTouchMobile()) setPct(Number(col.dataset.sheetPct || 55));

    const iniciarDrag = (event) => {
        if (event.target.closest('button')) return;
        if (!isBibleTouchMobile()) return;
        event.preventDefault();
        event.stopPropagation();
        startY = event.clientY;
        startHeight = Number(col.dataset.sheetPct || 55);
        col.classList.add('dragging');
        event.currentTarget.setPointerCapture?.(event.pointerId);
        document.body.style.overflow = 'hidden';
    };

    const moverDrag = (event) => {
        if (!col.classList.contains('dragging')) return;
        event.preventDefault();
        const delta = ((startY - event.clientY) / window.innerHeight) * 100;
        setPct(startHeight + delta);
    };

    const terminarDrag = () => {
        if (!col.classList.contains('dragging')) return;
        col.classList.remove('dragging');
        document.body.style.overflow = '';
    };

    dragTargets.forEach(target => {
        target.addEventListener('pointerdown', iniciarDrag);
        target.addEventListener('pointermove', moverDrag);
        target.addEventListener('pointerup', terminarDrag);
        target.addEventListener('pointercancel', terminarDrag);
    });
}

function isBibleTouchMobile() {
    return window.matchMedia('(max-width: 760px)').matches;
}
