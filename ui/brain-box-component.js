// components/ui/brain-box-component.js

/**
 * FÁBRICA PADRONIZADA DE CAIXAS DE TEXTO (BRAIN STYLE)
 * Design extraído do módulo Cosmos para uso universal no Painel BRAIN.
 */
export const BrainBoxFactory = {
    /**
     * CRIA UM ELEMENTO DOM DE CAIXA DE TEXTO
     * @param {Object} data - { id, conteudo }
     * @param {number} index - Posição na lista (para ordenação)
     * @param {Object} actions - { onUpdate, onMove, onDelete, onFocus, onBlur }
     */
    criar: (data, index, actions) => {
        const { id, conteudo } = data;
        const { onUpdate, onMove, onDelete, onFocus, onBlur } = actions;

        // 1. CONTENTOR PRINCIPAL
        const container = document.createElement('div');
        container.className = "brain-box-item";
        container.style.cssText = `
            background: rgba(255,255,255,0.03); 
            border: 1px solid rgba(255,255,255,0.1); 
            border-radius: 8px; 
            margin-bottom: 12px; 
            overflow: hidden;
            transition: all 0.3s ease;
            position: relative;
        `;

        // 2. TOOLBAR SUPERIOR (Controlos de Movimento e Lixeira)
        const toolbar = document.createElement('div');
        toolbar.style.cssText = `
            display: flex; 
            justify-content: space-between; 
            padding: 8px 12px; 
            background: rgba(255,255,255,0.03);
            border-bottom: 1px solid rgba(255,255,255,0.02);
            align-items: center;
        `;
        
        toolbar.innerHTML = `
            <div style="display:flex; gap:14px; color:rgba(255,255,255,0.25); font-size:11px;">
                <i class="fa-solid fa-chevron-up btn-up" title="Mover para cima" style="cursor:pointer; transition: 0.2s;"></i>
                <i class="fa-solid fa-chevron-down btn-down" title="Mover para baixo" style="cursor:pointer; transition: 0.2s;"></i>
            </div>
            <i class="fa-solid fa-trash-can btn-del" title="Eliminar" style="color:#f87171; font-size:11px; cursor:pointer; opacity:0.6; transition: 0.2s;"></i>
        `;

        // 3. ÁREA DE ESCRITA (Body + Textarea)
        const body = document.createElement('div');
        body.style.padding = "10px 12px";

        const textarea = document.createElement('textarea');
        textarea.dataset.id = id;
        textarea.value = conteudo || "";
        textarea.placeholder = "Escreve aqui as tuas anotações...";
        textarea.spellcheck = false;
        textarea.style.cssText = `
            width: 100%; 
            background: transparent; 
            border: none; 
            color: #f1f5f9; 
            outline: none; 
            resize: none; 
            font-family: inherit; 
            font-size: 13.5px; 
            line-height: 1.6; 
            white-space: pre-wrap;
            overflow: hidden;
            display: block;
            padding: 0;
        `;

        // --- LÓGICA DE AUTO-RESIZE ---
        const ajustarAltura = () => {
            textarea.style.height = 'auto';
            textarea.style.height = textarea.scrollHeight + 'px';
        };

        // --- EVENTOS DE INTERAÇÃO ---
        textarea.oninput = (e) => {
            ajustarAltura();
            if (onUpdate) onUpdate(e.target.value);
        };
        
        textarea.onfocus = () => {
            container.style.borderColor = "var(--primary)";
            container.style.background = "rgba(255,255,255,0.05)";
            if (onFocus) onFocus();
        };
        
        textarea.onblur = () => {
            container.style.borderColor = "rgba(255,255,255,0.1)";
            container.style.background = "rgba(255,255,255,0.03)";
            if (onBlur) onBlur();
        };

        // --- ACÇÕES DOS BOTÕES ---
        const btnUp = toolbar.querySelector('.btn-up');
        const btnDown = toolbar.querySelector('.btn-down');
        const btnDel = toolbar.querySelector('.btn-del');

        // Hover Effects nos ícones
        btnUp.onmouseenter = () => btnUp.style.color = "white";
        btnUp.onmouseleave = () => btnUp.style.color = "";
        btnDown.onmouseenter = () => btnDown.style.color = "white";
        btnDown.onmouseleave = () => btnDown.style.color = "";
        btnDel.onmouseenter = () => btnDel.style.opacity = "1";
        btnDel.onmouseleave = () => btnDel.style.opacity = "0.6";

        // Clique
        btnUp.onclick = (e) => { e.stopPropagation(); if (onMove) onMove(index, -1); };
        btnDown.onclick = (e) => { e.stopPropagation(); if (onMove) onMove(index, 1); };
        btnDel.onclick = (e) => { e.stopPropagation(); if (onDelete) onDelete(id); };

        // Montagem do elemento
        body.appendChild(textarea);
        container.appendChild(toolbar);
        container.appendChild(body);

        // Pequeno delay para calcular a altura inicial corretamente após o render
        setTimeout(ajustarAltura, 20);

        return container;
    }
};