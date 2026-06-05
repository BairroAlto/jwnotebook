/**
 * GESTOR DE BOTTOM SHEET MOBILE
 * Versão: Movimento Fluido (10% a 98%) e fecho exclusivo via "X"
 */
export const MobileBottomSheet = {
    
    iniciar: () => {
        const rightCol = document.getElementById('area-direita');
        if (!rightCol || window.innerWidth > 768) return;

        if (!document.getElementById('mobile-drag-handle')) {
            const handle = document.createElement('div');
            handle.id = 'mobile-drag-handle';
            handle.innerHTML = `
                <div class="drag-bar"></div>
                <button id="btn-close-bottom-sheet" title="Fechar Totalmente"><i class="fa-solid fa-xmark"></i></button>
            `;
            rightCol.insertBefore(handle, rightCol.firstChild);
            
            // O botão X é o ÚNICO que fecha o painel e o overlay
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
            panel.style.transition = 'none'; // Remove transição para seguir o dedo instantaneamente
            handle.setPointerCapture(e.pointerId);
            document.body.style.overflow = 'hidden';
        });

        handle.addEventListener('pointermove', (e) => {
            if (!isDragging) return;

            const deltaY = startY - e.clientY;
            let newHeight = startHeight + deltaY;

            // 🚀 LIMITES ATUALIZADOS: 10% (fundo) a 98% (topo)
            const minH = window.innerHeight * 0.10; 
            const maxH = window.innerHeight * 0.98;

            if (newHeight < minH) newHeight = minH;
            if (newHeight > maxH) newHeight = maxH;

            panel.style.height = `${newHeight}px`;
        });

        const pararArrasto = (e) => {
            if (!isDragging) return;
            isDragging = false;
            
            panel.style.transition = 'height 0.2s cubic-bezier(0.16, 1, 0.3, 1)';
            
            const finalHeight = panel.getBoundingClientRect().height;
            const screenH = window.innerHeight;

            // 🧲 LÓGICA DE SNAP (Atracção aos limites)
            if (finalHeight < screenH * 0.12) {
                panel.style.height = '10vh'; // Cola no fundo
            } 
            else if (finalHeight > screenH * 0.95) {
                panel.style.height = '98vh'; // Cola no topo
            }
            // 🚀 MOVIMENTO FLUIDO: Para exatamente onde o dedo saiu
            else {
                panel.style.height = `${finalHeight}px`;
            }
        };

        handle.addEventListener('pointerup', pararArrasto);
        handle.addEventListener('pointercancel', pararArrasto);
    },

    abrir: () => {
        if (window.innerWidth > 768) return;
        MobileBottomSheet.iniciar();

        const rightCol = document.getElementById('area-direita');
        const overlay = document.getElementById('mobile-overlay');

        if (rightCol && overlay) {
            rightCol.style.height = '60vh'; // Abre por defeito a 60%
            rightCol.classList.add('active');
            overlay.classList.add('active'); 
            document.body.style.overflow = 'hidden';
        }
    },

    fechar: () => {
        const rightCol = document.getElementById('area-direita');
        const overlay = document.getElementById('mobile-overlay');

        if (rightCol && overlay) {
            rightCol.classList.remove('active');
            overlay.classList.remove('active'); 
            document.body.style.overflow = '';
        }
    }
};
