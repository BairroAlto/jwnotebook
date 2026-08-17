// components/editor/ferramentas/citacaobiblica.js

export function criarCitacaoBiblica(caixa, onApagar, onMover, onAddAbaixo, onAbrirLupa) {
    const caixaDiv = document.createElement("div");
    const corPrata = "#94a3b8";

    caixaDiv.style.cssText = `
        background-color: rgba(148, 163, 184, 0.05); border: 1px solid ${corPrata}; 
        border-radius: var(--radius-md); overflow: hidden; margin-bottom: 15px; transition: 0.2s;
    `;


    caixaDiv.onmouseenter = () => {
    caixaDiv.style.boxShadow = `0 4px 20px rgba(148, 163, 184, 0.3)`;
    caixaDiv.style.transform = "translateY(-1px)";
};
caixaDiv.onmouseleave = () => {
    caixaDiv.style.boxShadow = "none";
    caixaDiv.style.transform = "translateY(0)";
};





    // TOOLBAR
   const header = document.createElement("div");
    header.style.cssText = `display: flex; justify-content: space-between; align-items: center; padding: 6px 12px; background-color: rgba(148, 163, 184, 0.2); color: white;`;
    header.innerHTML = `
        <div style="display: flex; gap: 8px; font-size: 13px; align-items: center;">
            <button type="button" class="btn-cima" title="Mover para cima" aria-label="Mover citação bíblica para cima" style="display:inline-flex; align-items:center; justify-content:center; min-width:32px; min-height:32px; padding:0; border:0; background:transparent; color:inherit; cursor:pointer; opacity:0.7; touch-action:manipulation; -webkit-tap-highlight-color:transparent;"><i class="fa-solid fa-chevron-up" aria-hidden="true"></i></button>
            <button type="button" class="btn-baixo" title="Mover para baixo" aria-label="Mover citação bíblica para baixo" style="display:inline-flex; align-items:center; justify-content:center; min-width:32px; min-height:32px; padding:0; border:0; background:transparent; color:inherit; cursor:pointer; opacity:0.7; touch-action:manipulation; -webkit-tap-highlight-color:transparent;"><i class="fa-solid fa-chevron-down" aria-hidden="true"></i></button>
            <div style="width: 1px; height: 14px; background: rgba(255,255,255,0.15); margin: 0 2px;"></div>
            <i class="fa-solid fa-plus btn-add-abaixo" title="Inserir ferramenta" style="cursor:pointer; color: #34d399;"></i>
            <i class="fa-solid fa-magnifying-glass btn-lupa" title="Escolher Versículos" style="cursor:pointer; color: white; margin-left: 5px;"></i>
        </div>
        <i class="fa-solid fa-trash btn-lixeira" style="cursor:pointer; opacity: 0.7; font-size: 12px;"></i>
    `;

    // --- NOVA LÓGICA DO CLIQUE ---
const btnLupa = header.querySelector('.btn-lupa');
btnLupa.onclick = (e) => {
    e.stopPropagation();
    if (typeof window.abrirSeletorBibliaGlobal === 'function') {
        window.abrirSeletorBibliaGlobal(caixa);
    } else {
        console.error("❌ Erro: Ponte 'abrirSeletorBibliaGlobal' não encontrada.");
    }
};


   // ... (o resto da função renderContent mantém-se igual) ...
    const ligarMover = (seletor, direcao) => {
        header.querySelector(seletor).addEventListener('click', (evento) => {
            evento.preventDefault();
            evento.stopPropagation();
            onMover(caixa, direcao);
        });
    };

    ligarMover('.btn-cima', 'cima');
    ligarMover('.btn-baixo', 'baixo');
    header.querySelector('.btn-add-abaixo').onclick = () => onAddAbaixo(caixa.id);
    header.querySelector('.btn-lixeira').onclick = () => onApagar(caixa);

    const corpo = document.createElement("div");
    corpo.style.padding = "15px";

    const renderContent = () => {
        if (!caixa.textosanexados || caixa.textosanexados.length === 0) {
            corpo.innerHTML = `<div style="text-align:center; color:${corPrata}; font-size:12px; font-style:italic; padding:10px;">Clica na lupa para anexar escrituras...</div>`;
            return;
        }
            corpo.innerHTML = caixa.textosanexados.map(item => `
            <div class="eye-bible-editor-row" data-eye-bible-versiculo="${encodeURIComponent(`${item.livro}|${item.cap}|${item.ver}`)}" style="margin-bottom: 10px; line-height: 1.5;">
                <b style="color:${corPrata}; font-size:10px; margin-right:8px; text-transform:uppercase;">${item.livro} ${item.cap}:${item.ver}</b>
                <span style="font-size: var(--fs-editor-texto); color: #f1f5f9;">${item.texto}</span>
            </div>
        `).join('');
    };

    renderContent();
    caixaDiv.appendChild(header);
    caixaDiv.appendChild(corpo);
    caixaDiv.refreshBiblia = renderContent;

    return caixaDiv;
}
