const SCROLL_DEBUG_PREFIX = '[BIBLE-SCROLL-DEBUG]';

function descreverElemento(elemento) {
    if (!(elemento instanceof Element)) return String(elemento || 'desconhecido');
    const identificador = elemento.id ? `#${elemento.id}` : '';
    const classes = typeof elemento.className === 'string'
        ? elemento.className.trim().split(/\s+/).filter(Boolean).slice(0, 3).map(nome => `.${nome}`).join('')
        : '';
    return `${elemento.tagName.toLowerCase()}${identificador}${classes}`;
}

function obterMetricas(elemento) {
    if (!(elemento instanceof HTMLElement)) return null;

    const estilo = getComputedStyle(elemento);
    return {
        elemento: descreverElemento(elemento),
        scrollTop: Math.round(elemento.scrollTop),
        scrollHeight: Math.round(elemento.scrollHeight),
        clientHeight: Math.round(elemento.clientHeight),
        podeRolar: elemento.scrollHeight > elemento.clientHeight + 1,
        overflowY: estilo.overflowY,
        altura: Math.round(elemento.getBoundingClientRect().height)
    };
}

function encontrarAreaRolavel(elemento, painel) {
    let atual = elemento instanceof Element ? elemento : null;

    while (atual && atual !== painel) {
        const metricas = obterMetricas(atual);
        if (metricas?.podeRolar && ['auto', 'scroll'].includes(metricas.overflowY)) {
            return metricas;
        }
        atual = atual.parentElement;
    }

    return obterMetricas(painel);
}

function resumirMetricas(metricas) {
    if (!metricas) return null;
    return {
        elemento: metricas.elemento,
        scrollTop: metricas.scrollTop,
        scrollHeight: metricas.scrollHeight,
        clientHeight: metricas.clientHeight,
        podeRolar: metricas.podeRolar,
        overflowY: metricas.overflowY,
        altura: metricas.altura
    };
}

function registar(tipo, dados) {
    console.log(`${SCROLL_DEBUG_PREFIX} ${tipo} ${JSON.stringify(dados)}`);
}

export function instalarDebugScrollPainel() {
    const painel = document.getElementById('bible-right-col');
    if (!painel || painel.dataset.scrollDebugInstalled === 'true') return;

    painel.dataset.scrollDebugInstalled = 'true';

    painel.addEventListener('wheel', event => {
        const areaRolavel = encontrarAreaRolavel(event.target, painel);
        registar('wheel', {
            deltaY: Math.round(event.deltaY),
            deltaMode: event.deltaMode,
            alvo: descreverElemento(event.target),
            modoFlutuante: painel.classList.contains('panel-floating'),
            areaRolavelEncontrada: resumirMetricas(areaRolavel),
            painel: resumirMetricas(obterMetricas(painel))
        });
    }, { capture: true, passive: true });

    document.addEventListener('scroll', event => {
        if (!painel.contains(event.target)) return;

        registar('scroll', {
            modoFlutuante: painel.classList.contains('panel-floating'),
            alvo: descreverElemento(event.target),
            painel: resumirMetricas(obterMetricas(painel)),
            alvoMetricas: resumirMetricas(obterMetricas(event.target))
        });
    }, { capture: true, passive: true });

    painel.addEventListener('touchmove', event => {
        const areaRolavel = encontrarAreaRolavel(event.target, painel);
        registar('touchmove', {
            alvo: descreverElemento(event.target),
            modoFlutuante: painel.classList.contains('panel-floating'),
            areaRolavelEncontrada: resumirMetricas(areaRolavel),
            painel: resumirMetricas(obterMetricas(painel))
        });
    }, { capture: true, passive: true });

    console.info(`${SCROLL_DEBUG_PREFIX} instrumentação ativa ${JSON.stringify({
        painel: resumirMetricas(obterMetricas(painel)),
        modoFlutuante: painel.classList.contains('panel-floating')
    })}`);
}
