import { isMobileViewport } from './mobile-device.js';
/**
 * GESTOR DE BOTTOM SHEET MOBILE
 * Movimento fluido entre 10% e 98%, com fecho exclusivo via X.
 */
export const MobileBottomSheet = {

    iniciar: () => {
        const rightCol = document.getElementById('area-direita');
        if (!rightCol || !isMobileViewport()) return;

        if (!document.getElementById('mobile-drag-handle')) {
            const handle = document.createElement('div');
            handle.id = 'mobile-drag-handle';
            handle.innerHTML = '<div class="drag-bar"></div>' +
                '<button id="btn-close-bottom-sheet" title="Fechar totalmente" aria-label="Fechar totalmente">' +
                '<i class="fa-solid fa-xmark"></i></button>';
            rightCol.insertBefore(handle, rightCol.firstChild);

            document.getElementById('btn-close-bottom-sheet').onclick = (e) => {
                e.stopPropagation();
                MobileBottomSheet.fechar();
            };

            MobileBottomSheet.configurarArrasto(handle, rightCol);
        }
    },

    configurarArrasto: (handle, panel) => {
        let isDragging = false;
        let startY = 0;
        let startHeight = 0;

        handle.addEventListener('pointerdown', (e) => {
            isDragging = true;
            startY = e.clientY;
            startHeight = panel.getBoundingClientRect().height;
            panel.style.transition = 'none';
            handle.setPointerCapture(e.pointerId);
            document.body.style.overflow = 'hidden';
        });

        handle.addEventListener('pointermove', (e) => {
            if (!isDragging) return;

            const deltaY = startY - e.clientY;
            let newHeight = startHeight + deltaY;
            const minH = window.innerHeight * 0.10;
            const maxH = window.innerHeight * 0.98;

            if (newHeight < minH) newHeight = minH;
            if (newHeight > maxH) newHeight = maxH;

            panel.style.height = newHeight + 'px';
        });

        const pararArrasto = () => {
            if (!isDragging) return;
            isDragging = false;

            panel.style.transition = 'height 0.2s cubic-bezier(0.16, 1, 0.3, 1)';

            const finalHeight = panel.getBoundingClientRect().height;
            const screenH = window.innerHeight;

            if (finalHeight < screenH * 0.12) {
                panel.style.height = '10vh';
                window.MobilePanelManager?.definirEstadoFolha?.('minimized');
            } else if (finalHeight > screenH * 0.95) {
                panel.style.height = '98vh';
                window.MobilePanelManager?.definirEstadoFolha?.('open');
            } else {
                panel.style.height = finalHeight + 'px';
                window.MobilePanelManager?.definirEstadoFolha?.('open');
            }
        };

        handle.addEventListener('pointerup', pararArrasto);
        handle.addEventListener('pointercancel', pararArrasto);
    },

    abrir: () => {
        if (!isMobileViewport()) return;
        MobileBottomSheet.iniciar();

        const rightCol = document.getElementById('area-direita');
        if (rightCol) {
            if (!rightCol.style.height) {
                const pctGuardada = Number(rightCol.dataset.mobileSheetPct);
                rightCol.style.height = Number.isFinite(pctGuardada) ? pctGuardada + 'vh' : '68vh';
            }
            rightCol.classList.add('active');
            document.body.style.overflow = 'hidden';
            window.MobilePanelManager?.definirEstadoFolha?.('open');
        }
    },

    fechar: () => {
        window.fecharFonteXSatMobile?.({ restoreOnly: true });
        const rightCol = document.getElementById('area-direita');
        const overlay = document.getElementById('mobile-overlay');

        if (rightCol) {
            rightCol.classList.remove('active', 'mobile-panel-minimized');
            rightCol.style.removeProperty('height');
            delete rightCol.dataset.mobileSheetPct;
            document.body.style.overflow = '';
        }
        overlay?.classList.remove('active');
        window.MobilePanelManager?.definirEstadoFolha?.('closed');
    }
};

