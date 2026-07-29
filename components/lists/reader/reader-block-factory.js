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
            p.innerHTML = `<small style="display:block; opacity:0.6; margin-bottom:5px; font-weight:800; font-style:normal; text-transform:uppercase;">Pergunta ${bloco.numero_ref || ''}</small><span style="user-select:text; cursor:text;">${bloco.texto}</span>`;
            p.onclick = onClick;
        } else if (bloco.tipo === "subtema" || bloco.tipo === "discurso") {
            p.innerHTML = `<span style="user-select:text; cursor:text;">${bloco.texto}</span>`;
            p.onclick = onClick;
        } else {
            // Parágrafo: O número é um botão clicável para abrir a direita; o texto fica livre para selecionar e copiar
            const hasNum = bloco.numero_ref !== undefined && bloco.numero_ref !== null && bloco.numero_ref !== '';
            const numLabel = hasNum ? bloco.numero_ref : '§';
            
            p.innerHTML = `<b class="num-ref-trigger" style="color:var(--primary); font-size:0.85em; margin-right:12px; opacity:0.85; font-weight:900; cursor:pointer; padding:2px 7px; border-radius:5px; background:rgba(99,102,241,0.14); border:1px solid rgba(99,102,241,0.3); display:inline-block; user-select:none; transition:all 0.18s ease;" title="Abrir estudo no painel direito">${numLabel}</b><span style="user-select:text; cursor:text;">${bloco.texto}</span>`;

            const numBtn = p.querySelector('.num-ref-trigger');
            if (numBtn) {
                numBtn.onclick = (e) => {
                    e.stopPropagation();
                    onClick(e);
                };
                numBtn.onmouseenter = () => {
                    numBtn.style.opacity = '1';
                    numBtn.style.background = 'rgba(99,102,241,0.3)';
                    numBtn.style.borderColor = 'rgba(99,102,241,0.6)';
                    numBtn.style.transform = 'scale(1.06)';
                };
                numBtn.onmouseleave = () => {
                    numBtn.style.opacity = '0.85';
                    numBtn.style.background = 'rgba(99,102,241,0.14)';
                    numBtn.style.borderColor = 'rgba(99,102,241,0.3)';
                    numBtn.style.transform = 'scale(1)';
                };
            } else {
                p.onclick = onClick;
            }
        }

        p.onmouseenter = () => {
            if (bloco.tipo !== "paragrafo") {
                p.style.background = "rgba(255,255,255,0.05)";
            }
        };
        p.onmouseleave = () => p.style.background = "transparent";
        
        return p;
    }
};