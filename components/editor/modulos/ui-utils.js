// components/editor/modulos/ui-utils.js

export const EditorUI = {
    // Captura a posição e a altura total atual
    capturarEstadoScroll: () => {
        const container = document.querySelector('.center-col');
        return {
            container,
            top: container ? container.scrollTop : 0,
            height: container ? container.scrollHeight : 0
        };
    },

    // Restaura o scroll de forma agressiva (3 fases)
    restaurarScroll: (estado) => {
        if (!estado.container || estado.top <= 0) return;

        // Fase 1: Imediato
        estado.container.scrollTop = estado.top;

        // Fase 2: Ciclo de renderização
        requestAnimationFrame(() => {
            estado.container.scrollTop = estado.top;
            
            // Fase 3: Compensação de micro-atrasos (imagens/fontes)
            setTimeout(() => {
                estado.container.scrollTop = estado.top;
            }, 50);
        });
    },

    // Ajusta alturas de títulos para evitar scrolls internos
    ajustarTitulos: () => {
        const campos = document.querySelectorAll('.tool-title-input');
        campos.forEach(el => {
            el.style.height = 'auto';
            el.style.height = el.scrollHeight + 'px';
        });
    }
};