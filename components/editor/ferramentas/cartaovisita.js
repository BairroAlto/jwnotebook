// components/editor/ferramentas/cartaovisita.js
import { abrirPopupImagemCartao } from '../modulos/tags/tags-utils.js';

/**
 * Fábrica de Cartões de Visita (Dourado/Cinza com Imagem e Título dinâmico)
 */
export function criarCartaoVisita(caixa, onTextoAlterado, onApagar, onMover, onAddAbaixo) {
    console.log("📇 [FACTORY] Gerando UI para Cartão de Visita:", caixa.id);
    const caixaDiv = document.createElement("div");
    const corOuro = "#d4af37";

    caixaDiv.style.cssText = `
        background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
        border: 1px solid ${corOuro}66;
        border-radius: 12px; margin-bottom: 20px; transition: 0.3s;
        overflow: hidden;
    `;

    // Glow no Hover
    caixaDiv.onmouseenter = () => {
        caixaDiv.style.boxShadow = `0 8px 25px ${corOuro}33`;
        caixaDiv.style.borderColor = corOuro;
    };
    caixaDiv.onmouseleave = () => {
        caixaDiv.style.boxShadow = "none";
        caixaDiv.style.borderColor = `${corOuro}66`;
    };

    // --- TOOLBAR (Simplificada) ---
    const header = document.createElement("div");
    header.style.cssText = `display: flex; justify-content: space-between; align-items: center; padding: 6px 12px; background: rgba(255,255,255,0.03); border-bottom: 1px solid rgba(212,175,55,0.1);`;
    header.innerHTML = `
        <div style="display: flex; gap: 12px; align-items: center;">
            <i class="fa-solid fa-chevron-up btn-cima" style="cursor:pointer; color:${corOuro}; opacity:0.7; font-size:12px;"></i>
            <i class="fa-solid fa-chevron-down btn-baixo" style="cursor:pointer; color:${corOuro}; opacity:0.7; font-size:12px;"></i>
            <i class="fa-solid fa-plus btn-add-abaixo" style="cursor:pointer; color: #34d399; font-size: 14px; margin-left: 5px;"></i>
        </div>
        <i class="fa-solid fa-trash btn-lixeira" style="cursor:pointer; color: #ef4444; opacity:0.7; font-size:12px;"></i>
    `;

    header.querySelector('.btn-cima').onclick = () => onMover(caixa, "cima");
    header.querySelector('.btn-baixo').onclick = () => onMover(caixa, "baixo");
    header.querySelector('.btn-add-abaixo').onclick = () => onAddAbaixo(caixa.id);
    header.querySelector('.btn-lixeira').onclick = () => onApagar(caixa);

    const corpo = document.createElement("div");
    corpo.style.cssText = "display: flex; padding: 15px; gap: 20px; align-items: flex-start;";

    // --- COLUNA ESQUERDA (IMAGEM) ---
    const colEsq = document.createElement("div");
    
    const renderImagem = () => {
        let size = "100px";
        if(caixa.urldimensao === "media") size = "150px";
        if(caixa.urldimensao === "grande") size = "200px";

        colEsq.style.cssText = `position: relative; width: ${size}; height: ${size}; flex-shrink: 0; background: rgba(255,255,255,0.05); border-radius: 8px; border: ${caixa.url ? '1px solid' : '1px dashed'} rgba(212,175,55,0.3); cursor: pointer; overflow: hidden; transition: 0.3s;`;
        
        if (caixa.url) {
            colEsq.innerHTML = `
                <img src="${caixa.url}" style="width: 100%; height: 100%; object-fit: cover;">
                <div style="position:absolute; top:5px; right:5px; background:rgba(0,0,0,0.6); color:${corOuro}; width:20px; height:20px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:10px;"><i class="fa-solid fa-pen"></i></div>
            `;
        } else {
            colEsq.innerHTML = `<div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; color:${corOuro}; opacity:0.5;"><i class="fa-solid fa-image" style="font-size:24px;"></i></div>`;
        }
    };

    colEsq.onclick = async () => {
         console.log("🖼️ [ACTION] Abrindo configurador de imagem para o cartão...");
        const dados = await abrirPopupImagemCartao(caixa.url, caixa.urldimensao);
        console.log("✅ [SAVE] Nova imagem definida:", dados.url);
        if (dados) {
            caixa.url = dados.url;
            caixa.urldimensao = dados.dimensao;
            renderImagem();
            onTextoAlterado(caixa);
        }
    };

    // --- COLUNA DIREITA (TEXTO) ---
    const colDir = document.createElement("div");
    colDir.style.cssText = "flex: 1; display: flex; flex-direction: column; gap: 10px;";

    // TÍTULO (MUDADO PARA TEXTAREA)
    const inputTit = document.createElement("textarea");
    inputTit.className = "tool-title-input"; // Necessário para o colapso via CSS
    inputTit.value = caixa.titulo || "";
    inputTit.placeholder = "Título do Cartão...";
    inputTit.rows = 1;
    inputTit.style.cssText = `
        background: transparent; border: none; border-bottom: 1px solid ${corOuro}33; 
        color: ${corOuro}; font-size: var(--fs-editor-titulo-ferramentas); 
        font-weight: 700; outline: none; padding-bottom: 5px; resize: none; 
        overflow: hidden; font-family: inherit; line-height: 1.3;
    `;

 const ajustarAlturaTit = () => {
    inputTit.style.height = 'auto';
    inputTit.style.height = (inputTit.scrollHeight + 2) + 'px';
};

    inputTit.oninput = () => {
        ajustarAlturaTit();
        caixa.titulo = inputTit.value; 
        onTextoAlterado(caixa); 
    };

    // CONTEÚDO / DESCRIÇÃO
    const areaTexto = document.createElement("textarea");
    areaTexto.value = caixa.conteudo || "";
    aplicarEscudoBloqueio(caixa, corpo, caixaDiv);
    areaTexto.placeholder = "Descrição...";
    areaTexto.style.cssText = `
    background: transparent; border: none; 
    color: var(--text-main); /* Mudado para a cor principal */
    font-size: var(--fs-editor-texto); line-height: 1.5; outline: none; 
    resize: none; min-height: 60px; font-family: inherit; overflow: hidden;
`;
    
const ajustarAlturaCorpo = () => { 
    areaTexto.style.height = 'auto'; 
    areaTexto.style.height = (areaTexto.scrollHeight + 2) + 'px'; 
};
    
    areaTexto.oninput = () => { 
        ajustarAlturaCorpo();
        caixa.conteudo = areaTexto.value; 
        onTextoAlterado(caixa);
    };

    colDir.appendChild(inputTit);
    colDir.appendChild(areaTexto);
    
    renderImagem();
    corpo.appendChild(colEsq);
    corpo.appendChild(colDir);
    
    caixaDiv.appendChild(header);
    caixaDiv.appendChild(corpo);
    
    // Ajustes iniciais de altura
setTimeout(() => {
    ajustarAlturaTit();
    ajustarAlturaCorpo();
}, 150);

    return caixaDiv;
}
