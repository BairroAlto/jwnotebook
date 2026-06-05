// components/editor/ferramentas/sumariar.js

export function criarSumariarIA(caixa, onTextoAlterado, onApagar, onPaleta, onPartilhar, onMover, onTags, onAddAbaixo) {
    const caixaDiv = document.createElement("div");
    const corVerde = "#10b981";
    const corLilas = "#d8b4fe"; // Lilás Fluorescente
    const corLilasForte = "#a855f7";

    caixaDiv.style.cssText = `
        background: rgba(168, 85, 247, 0.02); 
        border: 2px solid ${corLilasForte};
        border-radius: var(--radius-md); 
        overflow: hidden; margin-bottom: 12px; transition: 0.3s;
        position: relative;
    `;

    // --- EFEITO DE BRILHO NO HOVER ---
    caixaDiv.onmouseenter = () => {
        caixaDiv.style.boxShadow = `0 0 20px rgba(168, 85, 247, 0.4)`;
        caixaDiv.style.transform = "translateY(-1px)";
    };
    caixaDiv.onmouseleave = () => {
        caixaDiv.style.boxShadow = "none";
        caixaDiv.style.transform = "translateY(0)";
    };

    const header = document.createElement("div");
    header.style.cssText = `display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: linear-gradient(90deg, ${corVerde}44, ${corLilasForte}44); color: white;`;
    
    header.innerHTML = `
        <div style="display: flex; gap: 14px; font-size: 13px; align-items: center;">
            <div style="display:flex; gap:10px;">
                <i class="fa-solid fa-chevron-up btn-cima-s" title="Mover para cima" style="cursor:pointer; opacity:0.7;"></i>
                <i class="fa-solid fa-chevron-down btn-baixo-s" title="Mover para baixo" style="cursor:pointer; opacity:0.7;"></i>
            </div>
            <div style="width: 1px; height: 14px; background: rgba(255,255,255,0.15); margin: 0 2px;"></div>
            <i class="fa-solid fa-plus btn-add-s" title="Inserir ferramenta abaixo" style="cursor:pointer; color: #34d399; font-size: 15px;"></i>
            <div style="width: 1px; height: 14px; background: rgba(255,255,255,0.15); margin: 0 2px;"></div>
            <i class="fa-solid fa-magnifying-glass btn-lupa-s" title="Configurar Sumário" style="cursor:pointer; color: white; font-size: 14px;"></i>
        </div>
        <div style="display:flex; align-items:center; gap:12px;">
            <i class="fa-brands fa-mailchimp" style="color:white; font-size:16px; filter: drop-shadow(0 0 5px ${corVerde});"></i>
            <i class="fa-solid fa-trash btn-lixeira-s" style="cursor:pointer; color: #ef4444; font-size: 13px;"></i>
        </div>
    `;

    const corpo = document.createElement("div");
    corpo.style.cssText = "padding: 22px; color: #f1f5f9; font-size: var(--fs-editor-texto); line-height: 1.7;";

    const renderConteudo = () => {
        if (caixa.loading) {
            corpo.innerHTML = `
                <div style="display:flex; flex-direction:column; align-items:center; gap:12px; padding:20px; color:white;">
                    <i class="fa-brands fa-mailchimp fa-bounce" style="font-size:35px; color:${corVerde}"></i>
                    <span style="font-size:9px; font-weight:800; letter-spacing:2px; color:${corLilas}">SINTONIZANDO SUMÁRIO...</span>
                </div>`;
        } else if (!caixa.conteudo) {
            corpo.innerHTML = `<p style="text-align:center; opacity:0.4; font-style:italic; font-size:12px; color:white;">Abre a lupa para configurar a análise da nota.</p>`;
        } else {
            corpo.innerHTML = `<div style="white-space: pre-wrap;">${caixa.conteudo}</div>`;
        }
    };

    header.querySelector('.btn-cima-s').onclick = (e) => { e.stopPropagation(); onMover(caixa, "cima"); };
    header.querySelector('.btn-baixo-s').onclick = (e) => { e.stopPropagation(); onMover(caixa, "baixo"); };
    header.querySelector('.btn-add-s').onclick = (e) => { e.stopPropagation(); onAddAbaixo(caixa.id); };
    header.querySelector('.btn-lixeira-s').onclick = (e) => { e.stopPropagation(); onApagar(caixa); };
    header.querySelector('.btn-lupa-s').onclick = (e) => {
        e.stopPropagation();
        import('../modulos/sumariar-service.js').then(m => m.SumariarService.abrirConfigurador(caixa, () => {
            renderConteudo();
            onTextoAlterado(caixa);
        }));
    };

    renderConteudo();
    caixaDiv.appendChild(header);
    caixaDiv.appendChild(corpo);
    return caixaDiv;
}
