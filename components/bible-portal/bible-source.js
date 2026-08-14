// components/bible-portal/bible-source.js

/**
 * Prepara o leitor reutilizado pelas bridges de publicações, livros e vídeos
 * dentro do painel lateral da Bíblia.
 */
export function prepararFonteXSatBiblia() {
    const coluna = document.getElementById('bible-right-col');
    const destino = coluna?.querySelector('#mobile-source-content');
    if (!coluna || !destino) return false;

    let lista = destino.querySelector('#lista-lists');
    if (!lista) {
        lista = document.createElement('div');
        lista.id = 'lista-lists';
        destino.appendChild(lista);
    }

    coluna.classList.add('source-open');

    if (typeof window.abrirFonteXSatMobile === 'function') {
        window.abrirFonteXSatMobile();
    } else if (typeof window.switchPanel === 'function') {
        window.switchPanel('source');
    }

    return true;
}

export function fecharFonteXSatBiblia() {
    const coluna = document.getElementById('bible-right-col');
    if (!coluna) return;

    coluna.classList.remove('source-open');
    if (typeof window.switchPanel === 'function') window.switchPanel('xsat');
}

window.fecharFonteXSatBiblia = fecharFonteXSatBiblia;
