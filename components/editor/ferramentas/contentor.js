// components/editor/ferramentas/contentor.js
import { FOCOS_BASE } from '../modulos/paleta-cores.js';

/**
 * Fábrica de Contentores (Blocos Laranja com lógica de auto-ajuste)
 * Atualizado para Modo Sentinela: remove o botão "+" se for um estudo vinculado.
 */
export function criarContentorLaranja(caixa, onTextoAlterado, onApagar, onPaleta, onPartilhar, onMover, onTags, onAddAbaixo) {
    const caixaDiv = document.createElement("div");
    
    const keyFoco = caixa.foco || "original";
    const focoInfo = FOCOS_BASE[keyFoco] || FOCOS_BASE["original"];
    const isCamaleao = keyFoco === "camaleao";

    caixaDiv.style.cssText = `
        background-color: ${isCamaleao ? "transparent" : focoInfo.corForte + "15"}; 
        border: 1px solid ${isCamaleao ? "transparent" : focoInfo.corForte}; 
        border-radius: var(--radius-md); 
        overflow: hidden; 
        transition: 0.2s;
        margin-bottom: 12px;
        position: relative;
    `;

    // Glow no Hover
    caixaDiv.onmouseenter = () => {
        if (caixa.foco !== "camaleao") {
            caixaDiv.style.boxShadow = `0 4px 20px ${focoInfo.corForte}4D`;
            caixaDiv.style.transform = "translateY(-1px)";
        }
    };
    caixaDiv.onmouseleave = () => {
        caixaDiv.style.boxShadow = "none";
        caixaDiv.style.transform = "translateY(0)";
    };

    // ========================================================
    // 🛡️ LÓGICA MODO SENTINELA: REMOVER BOTÃO "+"
    // ========================================================
    const botaoPlusHtml = caixa.referenciacodex 
        ? "" // Se for caixa do estudo Sentinela, não gera o botão +
        : `<i class="fa-solid fa-plus btn-add-abaixo" title="Inserir ferramenta abaixo" style="cursor:pointer; color: #34d399; font-size: 15px;"></i>
           <div style="width: 1px; height: 14px; background: rgba(255,255,255,0.15); margin: 0 2px;"></div>`;

    // --- TOOLBAR ---
    const header = document.createElement("div");
    header.style.cssText = `display: flex; justify-content: space-between; align-items: center; padding: 6px 12px; background-color: ${isCamaleao ? "rgba(0,0,0,0.15)" : focoInfo.corForte + "4D"}; color: ${focoInfo.corIcone || '#cbd5e1'};`;
    header.innerHTML = `
        <div style="display: flex; gap: 14px; font-size: 13px; align-items: center;">
            <i class="fa-solid fa-chevron-up btn-cima" title="Mover para cima" style="cursor:pointer; opacity: 0.7;"></i>
            <i class="fa-solid fa-chevron-down btn-baixo" title="Mover para baixo" style="cursor:pointer; opacity: 0.7;"></i>
            <div style="width: 1px; height: 14px; background: rgba(255,255,255,0.15); margin: 0 2px;"></div>
            ${botaoPlusHtml}
            <i class="fa-solid fa-satellite-dish btn-parabolica" title="Pesquisa X-SAT" style="cursor:pointer; color: #818cf8; font-size: 14px; margin-left:5px;"></i>
        </div>
        <div style="display: flex; gap: 16px; font-size: 13px; align-items: center; opacity: 0.8;">
            <i class="fa-solid fa-tag btn-tag" title="Conexões" style="cursor:pointer;"></i>
            <i class="fa-solid fa-paper-plane btn-partilhar" title="Partilhar" style="cursor:pointer;"></i>
            <i class="fa-solid fa-palette btn-paleta" title="Mudar Cor" style="cursor:pointer;"></i>
            <i class="fa-solid fa-trash btn-lixeira" title="Ocultar" style="cursor:pointer;"></i>
        </div>
    `;

    // --- CORPO (TEXTAREA) ---
    const corpo = document.createElement("textarea");
    corpo.value = caixa.conteudo || "";
    
    if (typeof window.aplicarEscudoBloqueio === 'function') {
        window.aplicarEscudoBloqueio(caixa, corpo, caixaDiv);
    }
    
    corpo.placeholder = "Escreve aqui as tuas notas...";
    let corTxt = caixa.destaques ? "#000" : "var(--text-main)";

    corpo.style.cssText = `
        width: 100%; min-height: 100px; padding: 18px 20px; 
        background-color: ${caixa.destaques || "transparent"}; 
        border: none; outline: none; resize: none; overflow: hidden; 
        color: ${corTxt}; font-size: var(--fs-editor-texto); 
        font-family: inherit; line-height: 1.6; transition: background-color 0.3s;
    `;

    // 🚀 AJUSTE DE ALTURA ANTI-SALTO
    const ajustarAltura = () => {
        caixaDiv.style.minHeight = caixaDiv.offsetHeight + 'px'; // Tranca a altura do pai
        corpo.style.height = 'auto'; 
        const novaAltura = corpo.scrollHeight + 2;
        corpo.style.height = novaAltura + 'px';

        requestAnimationFrame(() => {
            caixaDiv.style.minHeight = ''; // Liberta a tranca
        });
    };

    corpo.addEventListener("input", (e) => {
        ajustarAltura();
        caixa.conteudo = e.target.value;
        onTextoAlterado(caixa);

        // 🚀 BRIDGE: EDITOR -> BRAIN (Conteúdo)
        const brainTxt = document.getElementById('txt-especial');
        if (brainTxt && caixa.referenciacodex) {
            const refCaixa = `${caixa.referenciacodex[0]}|${caixa.referenciacodex[1]}`;
            if (window._brainRefAtiva === refCaixa) brainTxt.value = e.target.value;
        }
    });

    // Eventos da Toolbar
    header.querySelector('.btn-cima').onclick = () => onMover(caixa, "cima");
    header.querySelector('.btn-baixo').onclick = () => onMover(caixa, "baixo");
    
    // Verificação de segurança para o botão +
    const btnAdd = header.querySelector('.btn-add-abaixo');
    if (btnAdd) btnAdd.onclick = () => onAddAbaixo(caixa.id);

    header.querySelector('.btn-tag').onclick = () => onTags(caixa);
    header.querySelector('.btn-partilhar').onclick = () => onPartilhar(caixa);
    header.querySelector('.btn-paleta').onclick = () => onPaleta(caixa);
    header.querySelector('.btn-lixeira').onclick = () => onApagar(caixa);
    header.querySelector('.btn-parabolica').onclick = () => window.dispararPesquisaParabolica(caixa.conteudo + " " + (caixa.titulo || ""));

    // Inicialização
    setTimeout(ajustarAltura, 150);

    caixaDiv.appendChild(header);
    caixaDiv.appendChild(corpo);
    return caixaDiv;
}