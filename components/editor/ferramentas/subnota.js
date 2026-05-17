// components/editor/ferramentas/subnota.js
import { FOCOS_SUBNOTA } from '../modulos/paleta-cores.js';

/**
 * Fábrica de SubNotas (Blocos Azuis com Título dinâmico)
 */
export function criarSubNotaAzul(caixa, onTextoAlterado, onApagar, onPaleta, onPartilhar, onMover, onTags, onAddAbaixo) {
    const caixaDiv = document.createElement("div");
    
    // Determinar estilo com base no FOCO
    const keyFoco = caixa.foco || "original";
    const focoInfo = FOCOS_SUBNOTA[keyFoco] || FOCOS_SUBNOTA["original"];

    // Estilo do Bloco
    caixaDiv.style.cssText = `
        background-color: ${focoInfo.corForte}15; 
        border: 1px solid ${focoInfo.corForte}; 
        border-radius: var(--radius-md); 
        overflow: hidden; 
        transition: all 0.2s ease;
        margin-bottom: 12px;
    `;

    // Glow no Hover
    caixaDiv.onmouseenter = () => {
        caixaDiv.style.boxShadow = `0 4px 20px ${focoInfo.corForte}4D`;
        caixaDiv.style.transform = "translateY(-1px)";
    };
    caixaDiv.onmouseleave = () => {
        caixaDiv.style.boxShadow = "none";
        caixaDiv.style.transform = "translateY(0)";
    };

    // --- CABEÇALHO (TOOLBAR) ---
    const header = document.createElement("div");
    header.style.cssText = `
        display: flex; justify-content: space-between; align-items: center; 
        padding: 6px 12px; background-color: ${focoInfo.corForte}4D; 
        color: #cbd5e1; 
    `;

    header.innerHTML = `
        <div style="display: flex; gap: 14px; font-size: 13px; align-items: center;">
            <i class="fa-solid fa-chevron-up btn-cima" title="Mover para cima" style="cursor:pointer; opacity: 0.7;"></i>
            <i class="fa-solid fa-chevron-down btn-baixo" title="Mover para baixo" style="cursor:pointer; opacity: 0.7;"></i>
            <div style="width: 1px; height: 14px; background: rgba(255,255,255,0.15); margin: 0 2px;"></div>
            <i class="fa-solid fa-plus btn-add-abaixo" title="Inserir ferramenta abaixo" style="cursor:pointer; color: #34d399; font-size: 15px;"></i>
            <i class="fa-solid fa-satellite-dish btn-parabolica" title="Pesquisa X-SAT" style="cursor:pointer; color: #818cf8; font-size: 14px; margin-left:5px;"></i>
            </div>
        <div style="display: flex; gap: 16px; font-size: 13px; align-items: center; opacity: 0.8;">
            <i class="fa-solid fa-tag btn-tag" title="Conexões" style="cursor:pointer;"></i>
            <i class="fa-solid fa-paper-plane btn-partilhar" title="Partilhar" style="cursor:pointer;"></i>
            <i class="fa-solid fa-palette btn-paleta" title="Mudar Cor" style="cursor:pointer;"></i>
            <i class="fa-solid fa-trash btn-lixeira" title="Ocultar" style="cursor:pointer;"></i>
        </div>
    `;

    // --- CAMPO DE TÍTULO ---
    const inputTitulo = document.createElement("textarea");
    inputTitulo.className = "tool-title-input";
    inputTitulo.value = caixa.titulo || "";
    inputTitulo.placeholder = "Título da SubNota...";
    inputTitulo.rows = 1;

    inputTitulo.style.cssText = `
        width: 100%; padding: 12px 18px; background: transparent; border: none; 
        border-bottom: 1px solid ${focoInfo.corForte}33; color: white; 
        font-weight: 700; font-size: var(--fs-editor-titulo-ferramentas); 
        outline: none; resize: none; overflow: hidden; font-family: inherit;
        display: block; line-height: 1.4;
    `;

    // 🚀 Ajuste Anti-Salto para o Título
    const ajustarAlturaTitulo = () => {
        caixaDiv.style.minHeight = caixaDiv.offsetHeight + 'px'; // Tranca o pai
        inputTitulo.style.height = 'auto';
        inputTitulo.style.height = (inputTitulo.scrollHeight + 2) + 'px';
        requestAnimationFrame(() => { caixaDiv.style.minHeight = ''; }); // Destranca
    };

    inputTitulo.addEventListener("input", (e) => {
        ajustarAlturaTitulo();
        caixa.titulo = e.target.value;
        onTextoAlterado(caixa);
    });

    // --- CORPO (ÁREA DE TEXTO) ---
    const corpo = document.createElement("textarea");
    corpo.value = caixa.conteudo || "";
    if (typeof window.aplicarEscudoBloqueio === 'function') {
        window.aplicarEscudoBloqueio(caixa, corpo, caixaDiv);
    }
    corpo.placeholder = "Escreve aqui as tuas notas...";
    
    let corTxt = caixa.destaques ? "#000" : "var(--text-main)";

    corpo.style.cssText = `
        width: 100%; min-height: 80px; padding: 15px 18px; 
        background-color: ${caixa.destaques || "transparent"}; 
        border: none; outline: none; resize: none; overflow: hidden; 
        color: ${corTxt}; font-size: var(--fs-editor-texto); 
        font-family: inherit; line-height: 1.6; transition: background-color 0.3s;
    `;

    // 🚀 Ajuste Anti-Salto para o Corpo
    const ajustarAlturaCorpo = () => {
        caixaDiv.style.minHeight = caixaDiv.offsetHeight + 'px'; // Tranca o pai
        corpo.style.height = 'auto'; 
        corpo.style.height = (corpo.scrollHeight + 2) + 'px';
        requestAnimationFrame(() => { caixaDiv.style.minHeight = ''; }); // Destranca
    };

    corpo.addEventListener("input", (e) => {
        ajustarAlturaCorpo(); 
        caixa.conteudo = e.target.value; 
        onTextoAlterado(caixa);
    });

    // Eventos da Toolbar
    header.querySelector('.btn-cima').onclick = () => onMover(caixa, "cima");
    header.querySelector('.btn-baixo').onclick = () => onMover(caixa, "baixo");
    header.querySelector('.btn-add-abaixo').onclick = () => onAddAbaixo(caixa.id);
    header.querySelector('.btn-tag').onclick = () => onTags(caixa);
    header.querySelector('.btn-partilhar').onclick = () => onPartilhar(caixa);
    header.querySelector('.btn-paleta').onclick = () => onPaleta(caixa);
    header.querySelector('.btn-lixeira').onclick = () => onApagar(caixa);
    header.querySelector('.btn-parabolica').onclick = () => window.dispararPesquisaParabolica(caixa.conteudo + " " + (caixa.titulo || ""));

    // Ajustes iniciais de altura após renderização
    setTimeout(() => {
        ajustarAlturaTitulo();
        ajustarAlturaCorpo();
    }, 150); 

    caixaDiv.appendChild(header);
    caixaDiv.appendChild(inputTitulo);
    caixaDiv.appendChild(corpo);
    
    return caixaDiv;
}