// components/editor/ferramentas/imagens.js

export function criarGaleriaRosa(caixa, onApagar, onMover, onAddAbaixo, onTextoAlterado) {
    const caixaDiv = document.createElement("div");
    const corRosa = "#ec4899";

    caixaDiv.style.cssText = `
        background-color: rgba(236, 72, 153, 0.03); border: 1px solid ${corRosa}44; 
        border-radius: 14px; overflow: hidden; margin-bottom: 15px; transition: 0.3s;
        position: relative;
    `;

    // --- EFEITO GLOW ---
    caixaDiv.onmouseenter = () => {
        caixaDiv.style.boxShadow = `0 4px 20px rgba(236, 72, 153, 0.3)`;
        caixaDiv.style.transform = "translateY(-1px)";
        caixaDiv.style.borderColor = corRosa;
    };
    caixaDiv.onmouseleave = () => {
        caixaDiv.style.boxShadow = "none";
        caixaDiv.style.transform = "translateY(0)";
        caixaDiv.style.borderColor = `${corRosa}44`;
    };

    const header = document.createElement("div");
    header.style.cssText = `display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background-color: rgba(236, 72, 153, 0.2); color: white;`;
    header.innerHTML = `
        <div style="display: flex; gap: 14px; font-size: 13px; align-items: center;">
            <i class="fa-solid fa-chevron-up btn-cima" style="cursor:pointer; opacity:0.7;"></i>
            <i class="fa-solid fa-chevron-down btn-baixo" style="cursor:pointer; opacity:0.7;"></i>
            <div style="width: 1px; height: 14px; background: rgba(255,255,255,0.15); margin: 0 2px;"></div>
            <i class="fa-solid fa-plus btn-add-abaixo" title="Inserir ferramenta abaixo" style="cursor:pointer; color: #34d399; font-size: 15px;"></i>
            <i class="fa-solid fa-magnifying-glass btn-lupa" title="Configurar Imagens" style="cursor:pointer; color: white; font-size: 13px; margin-left: 5px;"></i>
        </div>
        <i class="fa-solid fa-trash btn-lixeira" style="cursor:pointer; opacity: 0.8; font-size: 12px; color: #ef4444;"></i>
    `;

    const corpo = document.createElement("div");
    
    const renderGaleria = () => {
        const dim = caixa.urldimensao || "medias";
        const tamanhos = { pequenas: "80px", medias: "120px", grandes: "200px", gigantes: "100%" };
        const colunas = { pequenas: "repeat(auto-fill, minmax(80px, 1fr))", medias: "repeat(auto-fill, minmax(120px, 1fr))", grandes: "repeat(auto-fill, minmax(200px, 1fr))", gigantes: "1fr" };

        corpo.style.cssText = `padding: 15px; display: grid; grid-template-columns: ${colunas[dim]}; gap: 10px; justify-items: center;`;

        if (!caixa.links || caixa.links.length === 0) {
            corpo.innerHTML = `<div style="grid-column: 1/-1; text-align:center; color:${corRosa}; font-size:11px; font-style:italic; padding:10px; opacity:0.6;">Clica na lupa para anexar imagens da Web...</div>`;
            return;
        }

        corpo.innerHTML = caixa.links.map(url => `
            <div style="width: 100%; height: ${tamanhos[dim]}; background: rgba(0,0,0,0.2); border-radius: 10px; overflow: hidden; border: 1px solid rgba(255,255,255,0.05);">
                <img src="${url}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.parentElement.innerHTML='<small style=font-size:8px;padding:5px;display:block;text-align:center>Erro ao carregar imagem</small>'">
            </div>
        `).join('');
    };

    header.querySelector('.btn-lupa').onclick = () => {
        if (typeof window.abrirImagensConfigGlobal === 'function') window.abrirImagensConfigGlobal(caixa);
    };

    header.querySelector('.btn-cima').onclick = () => onMover(caixa, "cima");
    header.querySelector('.btn-baixo').onclick = () => onMover(caixa, "baixo");
    header.querySelector('.btn-add-abaixo').onclick = () => onAddAbaixo(caixa.id);
    header.querySelector('.btn-lixeira').onclick = () => onApagar(caixa);

    renderGaleria();
    caixaDiv.appendChild(header);
    caixaDiv.appendChild(corpo);
    caixaDiv.refreshGaleria = renderGaleria;

    return caixaDiv;
}