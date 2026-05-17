// components/editor/modulos/mutation-manager.js

const TIPOS_MUTAVEIS = [
    { id: 'contentor', nome: 'Contentor', icon: 'fa-box', cor: '#ea580c' },
    { id: 'subnota', nome: 'SubNota', icon: 'fa-box', cor: '#3b82f6' },
    { id: 'questao', nome: 'Questão', icon: 'fa-box', cor: '#10b981' },
    { id: 'raciocinio', nome: 'Raciocínio', icon: 'fa-box', cor: '#f59e0b' }
];

export const MutationManager = {
    /**
     * Verifica se a caixa atual pode sofrer mutação
     */
    podeMutar: (tipo) => TIPOS_MUTAVEIS.some(t => t.id === tipo),

    /**
     * Renderiza a lista de opções de transformação
     */
    render: (caixaAlvo, container, onComplete) => {
        if (!container) return;
        
        container.innerHTML = `
            <p style="font-size: 10px; color: var(--text-muted); text-transform: uppercase; font-weight: 800; margin-bottom: 15px; letter-spacing: 1px;">
                Converter ferramenta para:
            </p>
            <div id="grid-mutacao" style="display: flex; flex-direction: column; gap: 8px;"></div>
        `;

        const grid = container.querySelector('#grid-mutacao');

        // Filtrar para não mostrar o tipo que a caixa já é
        TIPOS_MUTAVEIS.filter(t => t.id !== caixaAlvo.tipo).forEach(t => {
            const item = document.createElement('div');
            item.className = "menu-item-list";
            item.style.cssText = "background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); padding: 12px; border-radius: 8px; cursor: pointer; transition: 0.2s; border-left: 3px solid transparent;";
            
            item.onmouseenter = () => item.style.borderLeftColor = t.cor;
            item.onmouseleave = () => item.style.borderLeftColor = "transparent";

            item.innerHTML = `
                <i class="fa-solid ${t.icon}" style="color:${t.cor}; font-size: 14px; width: 20px; text-align: center;"></i>
                <span style="font-size: 13px; font-weight: 600; color: white;">${t.nome}</span>
            `;

            item.onclick = async () => {
                console.log(`🧬 [MUTATION] Transformando ${caixaAlvo.tipo} em ${t.id}`);
                
                // 1. Alteração Atómica
                caixaAlvo.tipo = t.id; 
                caixaAlvo.foco = "original"; // Reset de segurança
                
                // 2. Feedback visual antes de fechar
                item.style.background = t.cor;
                item.style.color = "black";

                // 3. Executar callback de redesenho e fechar popup
                if (onComplete) await onComplete();
                document.getElementById('popup-cores-overlay').classList.remove('active');
            };

            grid.appendChild(item);
        });
    }
};