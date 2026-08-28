// components/direita/brain-idle.js

export function mostrarBrainIdle() {
    const container = document.getElementById('brain-resultado-pesquisa');
    const groupTabs = document.getElementById('sub-tabs-brain');

    // 1. Esconder os botões cinzentos genéricos (Puzzle/Dossiê)
    if (groupTabs) groupTabs.style.display = 'none';
    
    // 2. Injetar Animação no contentor
    if (container) {
        container.innerHTML = `
            <div class="brain-idle-wrapper">
                <div class="brain-animation-container">
                    <i class="fa-solid fa-brain brain-main-icon"></i>
                    <div class="node-particle"></div>
                    <div class="node-particle"></div>
                    <div class="node-particle"></div>
                    <div class="node-particle"></div>
                    <div class="node-particle"></div>
                </div>
                <p>Cérebro em Espera<br><span style="font-weight:400; font-size:10px; text-transform:none; opacity:0.8;">Selecione um tema ou versículo</span></p>
            </div>
        `;
    }
}

// ESTA LINHA É A SOLUÇÃO: Torna a função visível globalmente
window.mostrarBrainIdle = mostrarBrainIdle;