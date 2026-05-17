// components/editor/ferramentas/citacaobiblica.js

export function criarCitacaoBiblica(caixa, onApagar, onMover, onAddAbaixo, onAbrirLupa) {
    const caixaDiv = document.createElement("div");
    const corPrata = "#94a3b8";

    caixaDiv.style.cssText = `
        background-color: rgba(148, 163, 184, 0.05); border: 1px solid ${corPrata}; 
        border-radius: var(--radius-md); overflow: hidden; margin-bottom: 15px; transition: 0.2s;
    `;

    // TOOLBAR
   const header = document.createElement("div");
    header.style.cssText = `display: flex; justify-content: space-between; align-items: center; padding: 6px 12px; background-color: rgba(148, 163, 184, 0.2); color: white;`;
    header.innerHTML = `
        <div style="display: flex; gap: 14px; font-size: 13px; align-items: center;">
            <i class="fa-solid fa-chevron-up btn-cima" style="cursor:pointer; opacity:0.7;"></i>
            <i class="fa-solid fa-chevron-down btn-baixo" style="cursor:pointer; opacity:0.7;"></i>
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
    // Verifica se a ponte existe antes de chamar para não dar erro fatal
    if (typeof window.abrirSeletorBibliaGlobal === 'function') {
        window.abrirSeletorBibliaGlobal(caixa);
    } else {
        console.error("❌ Erro: A ponte global 'abrirSeletorBibliaGlobal' não foi inicializada no editor.js.");
    }
};


   // ... (o resto da função renderContent mantém-se igual) ...
    header.querySelector('.btn-cima').onclick = () => onMover(caixa, "cima");
    header.querySelector('.btn-baixo').onclick = () => onMover(caixa, "baixo");
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
            <div style="margin-bottom: 10px; line-height: 1.5;">
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