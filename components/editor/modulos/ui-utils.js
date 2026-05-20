// components/editor/modulos/ui-utils.js

export const EditorUI = {
    capturarEstadoScroll: () => {
        const container = document.querySelector('.center-col');
        return {
            container,
            top: container ? container.scrollTop : 0
        };
    },

    restaurarScroll: (estado) => {
        if (!estado.container) return;
        estado.container.scrollTop = estado.top;
    },

    /**
     * 🚀 SUPER RESIZER: Ajusta a altura de todos os inputs e textareas do editor
     */
  forçarAjusteAlturas: () => {
    const elementos = document.querySelectorAll('.tool-title-input, #editor-feed textarea');
    elementos.forEach(el => {
        el.style.height = 'auto';
        el.style.height = (el.scrollHeight) + 'px';
    });
}
};