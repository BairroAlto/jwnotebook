// components/editor/ferramentas/contentor.js
import { FOCOS_BASE } from '../modulos/paleta-cores.js';


/**
 * Fábrica de Contentores (Blocos de Escrita Cor de Laranja/Castanho)
 */
export function criarContentorLaranja(caixa, onTextoAlterado, onApagar, onPaleta, onPartilhar, onMover, onTags, onAddAbaixo) {
    const caixaDiv = document.createElement("div");
    
    // Determinar estilo com base no FOCO
    const keyFoco = caixa.foco || "original";
    const focoInfo = FOCOS_BASE[keyFoco] || FOCOS_BASE["original"];
    const isCamaleao = keyFoco === "camaleao";

    // Estilo do Contentor Principal - Fundo com 8% de opacidade (sufixo 15)
    caixaDiv.style.cssText = `
        background-color: ${isCamaleao ? "transparent" : focoInfo.corForte + "15"}; 
        border: 1px solid ${isCamaleao ? "transparent" : focoInfo.corForte}; 
        border-radius: var(--radius-md); 
        overflow: hidden; 
        transition: 0.2s;
        margin-bottom: 12px;
    `;
    
    if(!isCamaleao) {
  caixaDiv.onmouseenter = () => {
        caixaDiv.style.boxShadow = `0 4px 20px ${focoInfo.corForte}4D`;
        caixaDiv.style.transform = "translateY(-1px)";
    };
    caixaDiv.onmouseleave = () => {
        caixaDiv.style.boxShadow = "none";
        caixaDiv.style.transform = "translateY(0)";
    };
    }

    // --- CABEÇALHO (TOOLBAR) - Fundo com 30% de opacidade (sufixo 4D) ---
    const header = document.createElement("div");
    header.style.cssText = `
        display: flex; justify-content: space-between; align-items: center; 
        padding: 6px 12px; background-color: ${isCamaleao ? "rgba(0,0,0,0.15)" : focoInfo.corForte + "4D"}; 
        color: ${focoInfo.corIcone}; 
    `;

    header.innerHTML = `
        <div style="display: flex; gap: 14px; font-size: 13px; align-items: center;">
            <i class="fa-solid fa-chevron-up btn-cima" title="Mover para cima" style="cursor:pointer; opacity: 0.7; transition: 0.2s;"></i>
            <i class="fa-solid fa-chevron-down btn-baixo" title="Mover para baixo" style="cursor:pointer; opacity: 0.7; transition: 0.2s;"></i>
            
            <!-- SEPARADOR VISUAL -->
            <div style="width: 1px; height: 14px; background: rgba(255,255,255,0.15); margin: 0 2px;"></div>

            <!-- BOTÃO "+" VERDE PARA INSERIR ABAIXO -->
            <i class="fa-solid fa-plus btn-add-abaixo" title="Inserir ferramenta abaixo" 
               style="cursor:pointer; color: #34d399; font-size: 15px; display: flex; align-items: center; justify-content: center; transition: 0.2s;"></i>
               <i class="fa-solid fa-satellite-dish btn-parabolica" title="Pesquisa X-SAT" style="cursor:pointer; color: #818cf8; font-size: 14px; margin-left:5px;"></i>

               </div>
        <div style="display: flex; gap: 16px; font-size: 13px; align-items: center; opacity: 0.8;">
            <i class="fa-solid fa-tag btn-tag" title="Conexões" style="cursor:pointer; transition: 0.2s;"></i>
            <i class="fa-solid fa-paper-plane btn-partilhar" title="Partilhar" style="cursor:pointer; transition: 0.2s;"></i>
            <i class="fa-solid fa-palette btn-paleta" title="Mudar Cor" style="cursor:pointer; transition: 0.2s;"></i>
            <i class="fa-solid fa-trash btn-lixeira" title="Ocultar" style="cursor:pointer; transition: 0.2s;"></i>
        </div>
    `;

    // Interação do botão "+"
    const btnPlus = header.querySelector('.btn-add-abaixo');
    btnPlus.onmouseenter = () => { btnPlus.style.transform = "scale(1.2)"; btnPlus.style.color = "#6ee7b7"; };
    btnPlus.onmouseleave = () => { btnPlus.style.transform = "scale(1)"; btnPlus.style.color = "#34d399"; };

    // Atribuição de Funções
    header.querySelector('.btn-cima').onclick = () => onMover(caixa, "cima");
    header.querySelector('.btn-baixo').onclick = () => onMover(caixa, "baixo");
    header.querySelector('.btn-add-abaixo').onclick = () => onAddAbaixo(caixa.id);
    header.querySelector('.btn-tag').onclick = () => onTags(caixa);
    header.querySelector('.btn-partilhar').onclick = () => onPartilhar(caixa);
    header.querySelector('.btn-paleta').onclick = () => onPaleta(caixa);
    header.querySelector('.btn-lixeira').onclick = () => onApagar(caixa);
header.querySelector('.btn-parabolica').onclick = () => {
    window.dispararPesquisaParabolica(caixa.conteudo + " " + (caixa.titulo || ""));
};

    // --- CORPO (ÁREA DE TEXTO) ---
    const corpo = document.createElement("textarea");
    corpo.value = caixa.conteudo || "";
    aplicarEscudoBloqueio(caixa, corpo, caixaDiv);
    corpo.placeholder = "Escreve aqui as tuas notas...";
    
    let corTxt = "var(--text-main)"; 
    if (caixa.destaques) corTxt = "#000";

    corpo.style.cssText = `
        width: 100%; 
        min-height: 100px; 
        padding: 18px 20px; 
        background-color: ${caixa.destaques || "transparent"}; 
        border: none; 
        outline: none; 
        resize: none; 
        overflow: hidden; 
        color: ${corTxt}; 
        font-size: var(--fs-editor-texto); 
        font-family: inherit; 
        line-height: 1.6;
        transition: background-color 0.3s;
    `;

    const ajustarAltura = () => {
        corpo.style.height = 'auto'; 
        corpo.style.height = (corpo.scrollHeight) + 'px'; 
    };

    corpo.addEventListener("input", (e) => {
        ajustarAltura(); 
        caixa.conteudo = e.target.value; 
        onTextoAlterado(caixa);
    });

    setTimeout(ajustarAltura, 20);

    caixaDiv.appendChild(header);
    caixaDiv.appendChild(corpo);
    return caixaDiv;
}