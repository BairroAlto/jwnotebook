/**
 * GESTOR DE BOTTOM SHEET MOBILE
 * Versão: Minimizar ao arrastar, fechar apenas no "X"
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
            
            // O botão X é o único que chama o fecho total
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
        const overlay = document.getElementById('mobile-overlay');

        handle.addEventListener('pointerdown', (e) => {
            isDragging = true;
            startY = e.clientY;
            startHeight = panel.getBoundingClientRect().height;
            panel.style.transition = 'none'; 
            handle.setPointerCapture(e.pointerId);
        });

        handle.addEventListener('pointermove', (e) => {
            if (!isDragging) return;
            const deltaY = startY - e.clientY;
            let newHeight = startHeight + deltaY;

            // Limite mínimo de 50px (altura do handle) e máximo de 95%
            const minH = 50; 
            const maxH = window.innerHeight * 0.95;

            if (newHeight < minH) newHeight = minH;
            if (newHeight > maxH) newHeight = maxH;

            panel.style.height = `${newHeight}px`;
        });

        const pararArrasto = (e) => {
            if (!isDragging) return;
            isDragging = false;
            
            panel.style.transition = 'bottom 0.5s cubic-bezier(0.16, 1, 0.3, 1), height 0.3s ease';
            
            const finalHeight = panel.getBoundingClientRect().height;
            const screenH = window.innerHeight;

            // --- NOVA LÓGICA DE SNAP (POSICIONAMENTO) ---

            // 1. Se soltar muito em baixo (menos de 20% da tela) -> MINIMIZA
            if (finalHeight < screenH * 0.20) {
                panel.style.height = '50px'; // Fica apenas a bordinha com o Handle
                if (overlay) overlay.classList.remove('active'); // Remove o baço para poderes usar o editor
                console.log("⏬ Painel Minimizado");
            } 
            // 2. Se soltar quase no topo -> EXPANDE TOTAL
            else if (finalHeight > screenH * 0.80) {
                panel.style.height = '90vh';
                if (overlay) overlay.classList.add('active');
            }
            // 3. Caso contrário, mantém-se onde está ou volta aos 60%
            else {
                if (overlay) overlay.classList.add('active');
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
            rightCol.style.height = '60vh'; 
            rightCol.classList.add('active');
            overlay.classList.add('active'); // Ativa o baço ao abrir
            document.body.style.overflow = 'hidden';
        }
    },

    fechar: () => {
        const rightCol = document.getElementById('area-direita');
        const overlay = document.getElementById('mobile-overlay');

        if (rightCol && overlay) {
            // Esconde o painel totalmente para baixo
            rightCol.classList.remove('active');
            overlay.classList.remove('active');
            document.body.style.overflow = '';
            
            // Reset da altura para a próxima abertura
            setTimeout(() => {
                rightCol.style.height = '60vh';
            }, 400);
        }
    }
};