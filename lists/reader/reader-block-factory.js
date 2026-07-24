// components/lists/reader/reader-block-factory.js
import { ReaderStyles } from './reader-styles.js';

export const ReaderBlockFactory = {
    create: (bloco, onClick) => {
        const p = document.createElement('div');
        p.style.cssText = ReaderStyles.base;
        
        if (bloco.numero_ref) p.setAttribute('data-p', bloco.numero_ref);
        p.setAttribute('data-tipo', bloco.tipo || 'paragrafo');

        // Aplicar estilo específico por tipo
        if (ReaderStyles.tipos[bloco.tipo]) {
            p.style.cssText += ReaderStyles.tipos[bloco.tipo];
        }

        // Construir Conteúdo Interno
        if (bloco.tipo === "pergunta") {
            p.innerHTML = `<small style="display:block; opacity:0.6; margin-bottom:5px; font-weight:800; font-style:normal; text-transform:uppercase;">Pergunta ${bloco.numero_ref || ''}</small>${bloco.texto}`;
        } else if (bloco.tipo === "subtema" || bloco.tipo === "discurso") {
            p.innerText = bloco.texto;
        } else {
            p.innerHTML = `<b style="color:var(--primary); font-size:0.75em; margin-right:15px; opacity:0.4; font-weight:900;">${bloco.numero_ref || ''}</b><span>${bloco.texto}</span>`;
        }

        p.onclick = onClick;
        p.onmouseenter = () => p.style.background = "rgba(255,255,255,0.05)";
        p.onmouseleave = () => p.style.background = "transparent";
        
        return p;
    }
};