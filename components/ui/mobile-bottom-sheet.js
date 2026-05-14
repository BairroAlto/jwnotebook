/**
 * GESTOR DE BOTTOM SHEET MOBILE
 */
export const MobileBottomSheet = {
    iniciar: () => {
        const rightCol = document.getElementById('area-direita');
        if (!rightCol || window.innerWidth > 768) return;

        // Injeta se não existir
        if (!document.getElementById('mobile-drag-handle')) {
            const handle = document.createElement('div');
            handle.id = 'mobile-drag-handle';
            handle.innerHTML = `
                <div class="drag-bar"></div>
                <button id="btn-close-bottom-sheet"><i class="fa-solid fa-xmark"></i></button>
            `;
            rightCol.insertBefore(handle, rightCol.firstChild);
            
            // O clique agora é gerido pelo index.html, não precisamos de atribuir aqui
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
            
            panel.style.transition = 'none'; // Fluidez total durante o arrasto
            handle.setPointerCapture(e.pointerId);
        });

        handle.addEventListener('pointermove', (e) => {
            if (!isDragging) return;
            
            const deltaY = startY - e.clientY;
            let newHeight = startHeight + deltaY;

            // Limites de altura fluidos
            const minH = window.innerHeight * 0.20;
            const maxH = window.innerHeight * 0.92;

            if (newHeight < minH) newHeight = minH;
            if (newHeight > maxH) newHeight = maxH;

            panel.style.height = `${newHeight}px`;
        });

        const pararArrasto = (e) => {
            if (!isDragging) return;
            isDragging = false;
            
            // Devolve a suavidade (Cubic Bezier para efeito Premium)
            panel.style.transition = 'bottom 0.5s cubic-bezier(0.16, 1, 0.3, 1), height 0.3s ease';
            
            const finalHeight = panel.getBoundingClientRect().height;
            const screenH = window.innerHeight;

            // Se soltar muito em baixo, fecha sozinho
            if (finalHeight < screenH * 0.25) {
                MobileBottomSheet.fechar();
            } 
            // Se soltar quase no topo, expande para 90%
            else if (finalHeight > screenH * 0.80) {
                panel.style.height = '90vh';
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
            overlay.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    },

 fechar: () => {
        document.getElementById('area-direita').classList.remove('active');
        document.getElementById('mobile-overlay').classList.remove('active');
        document.body.style.overflow = '';
    }
};
