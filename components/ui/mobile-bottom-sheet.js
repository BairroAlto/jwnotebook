/**
 * GESTOR DE BOTTOM SHEET MOBILE (COLUNA DA DIREITA)
 * Controla o surgimento, fecho e o arrasto (resize) do painel lateral em telemóveis.
 */
export const MobileBottomSheet = {
    
    /**
     * Inicializa os elementos e os ouvintes de eventos.
     * Deve ser chamado no index.html após o carregamento dos componentes.
     */
    iniciar: () => {
        const rightCol = document.getElementById('area-direita');
        const overlay = document.getElementById('mobile-overlay');
        
        if (!rightCol || !overlay) {
            console.warn("⚠️ [BOTTOM-SHEET] Elementos necessários não encontrados no DOM.");
            return;
        }

        // 1. Injetar o Cabeçalho de Arrasto (Handle) se ainda não existir
        if (!document.getElementById('mobile-drag-handle')) {
            const handle = document.createElement('div');
            handle.id = 'mobile-drag-handle';
            handle.innerHTML = `
                <div class="drag-bar"></div>
                <button id="btn-close-bottom-sheet" title="Fechar Painel">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            `;
            // Insere no topo da coluna da direita
            rightCol.insertBefore(handle, rightCol.firstChild);
        }

        const handle = document.getElementById('mobile-drag-handle');
        const btnFechar = document.getElementById('btn-close-bottom-sheet');

        // 2. Variáveis de Estado para o Arrasto
        let isDragging = false;
        let startY = 0;
        let startHeight = 0;

        // 3. LÓGICA DE ARRASTO (Pointer Events - Suporta Touch e Mouse)
        handle.addEventListener('pointerdown', (e) => {
            // Só ativa se estivermos em modo mobile
            if (window.innerWidth > 768) return;
            
            isDragging = true;
            startY = e.clientY;
            startHeight = rightCol.getBoundingClientRect().height;
            
            // Remove a transição CSS para que o movimento seja instantâneo sob o dedo
            rightCol.style.transition = 'none'; 
            
            // Prende o ponteiro ao elemento para não o perder no movimento rápido
            handle.setPointerCapture(e.pointerId);
            handle.style.cursor = 'grabbing';
        });

        handle.addEventListener('pointermove', (e) => {
            if (!isDragging) return;
            
            const currentY = e.clientY;
            const deltaY = startY - currentY; // Movimento para cima é positivo
            let newHeight = startHeight + deltaY;

            // Limites de Segurança (Min 15%, Max 95% da altura da tela)
            const minH = window.innerHeight * 0.15;
            const maxH = window.innerHeight * 0.95;

            if (newHeight < minH) newHeight = minH;
            if (newHeight > maxH) newHeight = maxH;

            rightCol.style.height = `${newHeight}px`;
        });

        const finalizarArrasto = (e) => {
            if (!isDragging) return;
            isDragging = false;
            
            // Devolve as transições suaves
            rightCol.style.transition = 'bottom 0.4s cubic-bezier(0.4, 0, 0.2, 1), height 0.3s ease';
            handle.releasePointerCapture(e.pointerId);
            handle.style.cursor = 'grab';

            // Se o utilizador arrastou muito para baixo (ex: menos de 25% da tela), fecha o painel
            if (rightCol.offsetHeight < window.innerHeight * 0.25) {
                MobileBottomSheet.fechar();
            }
        };

        handle.addEventListener('pointerup', finalizarArrasto);
        handle.addEventListener('pointercancel', finalizarArrasto);

        // 4. EVENTOS DE FECHO (Botão X e Overlay)
        btnFechar.onclick = (e) => {
            e.stopPropagation();
            MobileBottomSheet.fechar();
        };

        overlay.addEventListener('click', () => {
            MobileBottomSheet.fechar();
        });

        console.log("🚀 [BOTTOM-SHEET] Motor de arrasto e fecho pronto.");
    },

    /**
     * Abre a Bottom Sheet e ativa o fundo baço (Overlay).
     */
    abrir: () => {
        if (window.innerWidth > 768) return;

        const rightCol = document.getElementById('area-direita');
        const overlay = document.getElementById('mobile-overlay');

        if (rightCol && overlay) {
            // Força a altura padrão ao abrir (ex: 65% da tela)
            rightCol.style.height = '65vh';
            rightCol.classList.add('active');
            overlay.classList.add('active');
            
            // Impede o scroll do body enquanto o painel está aberto
            document.body.style.overflow = 'hidden';
        }
    },

    /**
     * Fecha a Bottom Sheet e remove o overlay.
     */
    fechar: () => {
        const rightCol = document.getElementById('area-direita');
        const overlay = document.getElementById('mobile-overlay');

        if (rightCol && overlay) {
            rightCol.classList.remove('active');
            overlay.classList.remove('active');
            
            // Liberta o scroll do body
            document.body.style.overflow = '';
            
            // Pequeno delay para a animação de descida terminar antes de resetar a altura
            setTimeout(() => {
                rightCol.style.height = '60vh';
            }, 400);
        }
    }
};