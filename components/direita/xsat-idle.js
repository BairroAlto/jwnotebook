// components/direita/xsat-idle.js

function obterPainelXSat() {
    return document.getElementById('panel-xsat');
}

export function mostrarXSatIdle() {
    const painel = obterPainelXSat();
    if (!painel) return;

    document.getElementById('xsat-num-nav')?.style.setProperty('display', 'none');
    document.getElementById('xsat-sub-nav')?.style.setProperty('display', 'none');
    document.getElementById('xsat-display-content')?.style.setProperty('display', 'none');

    let vazio = document.getElementById('xsat-idle-container');
    if (!vazio) {
        vazio = document.createElement('div');
        vazio.id = 'xsat-idle-container';
        vazio.className = 'xsat-idle-wrapper';
        vazio.innerHTML = `
            <div class="xsat-idle-orbit" aria-hidden="true">
                <div class="xsat-idle-orbit-line"></div>
                <i class="fa-solid fa-satellite xsat-idle-satellite"></i>
                <i class="fa-solid fa-satellite-dish xsat-idle-core"></i>
            </div>
            <p>X-SAT em espera<br><span>Selecione uma nota para começar.</span></p>
        `;
        painel.appendChild(vazio);
    }

    vazio.style.display = 'flex';
}

export function ocultarXSatIdle() {
    const vazio = document.getElementById('xsat-idle-container');
    if (vazio) vazio.style.display = 'none';

    document.getElementById('xsat-num-nav')?.style.removeProperty('display');
    document.getElementById('xsat-display-content')?.style.removeProperty('display');
}

window.mostrarXSatIdle = mostrarXSatIdle;
window.ocultarXSatIdle = ocultarXSatIdle;

window.addEventListener('nota:aberta', ocultarXSatIdle);
window.addEventListener('nota:fechada', mostrarXSatIdle);
