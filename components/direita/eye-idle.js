// components/direita/eye-idle.js

const EYE_CONTENT_IDS = [
    'indice-nota-container',
    'textos-container',
    'ancora-nota-container',
    'fontes-nota-container',
    'glosas-nota-container',
    'caixas-associadas-container',
    'ficheiros-nota-container',
    'plugs-eye-container'
];

function obterAreaEye() {
    return document.querySelector('#panel-eye .eye-scroll-area');
}

export function mostrarEyeIdle() {
    const area = obterAreaEye();
    if (!area) return;

    document.getElementById('sub-tabs-eye')?.style.setProperty('display', 'none');
    EYE_CONTENT_IDS.forEach(id => {
        const elemento = document.getElementById(id);
        if (elemento) elemento.style.display = 'none';
    });

    let vazio = document.getElementById('eye-idle-container');
    if (!vazio) {
        vazio = document.createElement('div');
        vazio.id = 'eye-idle-container';
        vazio.className = 'eye-idle-wrapper';
        vazio.innerHTML = `
            <div class="eye-idle-animation-container" aria-hidden="true">
                <i class="fa-solid fa-eye eye-idle-icon"></i>
            </div>
            <p>EYE em espera<br><span>Selecione uma nota para começar.</span></p>
        `;
        area.appendChild(vazio);
    }

    vazio.style.display = 'flex';
}

export function ocultarEyeIdle() {
    const vazio = document.getElementById('eye-idle-container');
    if (vazio) vazio.style.display = 'none';

    const nav = document.getElementById('sub-tabs-eye');
    if (nav) nav.style.display = 'flex';
}

window.mostrarEyeIdle = mostrarEyeIdle;
window.ocultarEyeIdle = ocultarEyeIdle;

window.addEventListener('nota:aberta', ocultarEyeIdle);
window.addEventListener('nota:fechada', mostrarEyeIdle);
