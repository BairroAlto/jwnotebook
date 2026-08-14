// Mantém um conjunto de separadores com a altura do painel mais alto.

export function criarAjustadorAlturaAbas({
    area,
    paineis = [],
    obterEstado = painel => painel.classList.contains('is-active'),
    definirVisivel = (painel, visivel) => painel.classList.toggle('is-active', visivel),
    alturaExtra = 40,
    limiteAltura = () => Math.floor(window.innerHeight * 0.75),
    observarAlteracoes = false
} = {}) {
    const lista = Array.from(paineis).filter(Boolean);
    if (!area || !lista.length) {
        return { atualizar: () => {}, destruir: () => {} };
    }

    let frame = null;
    const atualizar = () => {
        if (frame) cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
            frame = null;
            medir();
        });
    };

    const medir = () => {
        const estadosAtuais = lista.map(obterEstado);
        const estiloArea = window.getComputedStyle(area);
        const paddingHorizontal = parseFloat(estiloArea.paddingLeft || 0) + parseFloat(estiloArea.paddingRight || 0);
        const larguraPainel = Math.max(0, area.clientWidth - paddingHorizontal);
        const estilosOriginais = lista.map(painel => ({
            visibility: painel.style.visibility,
            position: painel.style.position,
            width: painel.style.width
        }));

        lista.forEach(painel => {
            definirVisivel(painel, true);
            painel.style.visibility = 'hidden';
            painel.style.position = 'absolute';
            painel.style.width = `${larguraPainel}px`;
        });

        const maiorAltura = Math.max(...lista.map(painel => painel.scrollHeight), 0);

        lista.forEach((painel, indice) => {
            definirVisivel(painel, estadosAtuais[indice]);
            painel.style.visibility = estilosOriginais[indice].visibility;
            painel.style.position = estilosOriginais[indice].position;
            painel.style.width = estilosOriginais[indice].width;
        });

        const limite = Math.max(0, Number(limiteAltura()) || 0);
        const altura = limite ? Math.min(maiorAltura + alturaExtra, limite) : maiorAltura + alturaExtra;
        area.style.height = `${Math.max(0, altura)}px`;
    };

    const aoRedimensionar = () => atualizar();
    window.addEventListener('resize', aoRedimensionar);

    let observadores = [];
    if (observarAlteracoes && typeof MutationObserver !== 'undefined') {
        observadores = lista.map(painel => {
            const observador = new MutationObserver(atualizar);
            observador.observe(painel, { childList: true, subtree: true });
            return observador;
        });
    }

    atualizar();

    return {
        atualizar,
        destruir: () => {
            window.removeEventListener('resize', aoRedimensionar);
            if (frame) cancelAnimationFrame(frame);
            observadores.forEach(observador => observador.disconnect());
        }
    };
}
