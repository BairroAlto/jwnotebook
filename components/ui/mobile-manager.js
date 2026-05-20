// components/ui/mobile-manager.js

export const MobileUI = {
    /**
     * Fecha a coluna da esquerda e remove o efeito baço (overlay)
     */
    fecharColunaEsquerda: () => {
        if (window.innerWidth <= 768) {
            const colunaEsquerda = document.getElementById('area-esquerda');
            const overlay = document.getElementById('mobile-overlay');
            
            // 1. Esconde a coluna
            if (colunaEsquerda) {
                colunaEsquerda.classList.add('closed');
            }
            
            // 2. REMOVE O EFEITO BAÇO (O que estava a faltar!)
            if (overlay) {
                overlay.classList.remove('active');
            }
            
            console.log("📱 [MOBILE] Menu e Overlay fechados.");
        }
    }
};