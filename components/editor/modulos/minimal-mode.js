// Estado visual do Modo Minimal. Mantém o eclipse separado da renderização das ferramentas.

export const ECLIPSES_MINIMAL = Object.freeze({
    total: 'total',
    parcial: 'parcial'
});

export function normalizarEclipseMinimal(valor) {
    return valor === ECLIPSES_MINIMAL.parcial
        ? ECLIPSES_MINIMAL.parcial
        : ECLIPSES_MINIMAL.total;
}

export function aplicarEclipseMinimal(valor, modoAtivo = document.body.classList.contains('modo-minimal')) {
    const eclipse = normalizarEclipseMinimal(valor);
    document.body.dataset.minimalEclipse = eclipse;
    document.body.classList.toggle('modo-minimal-parcial', Boolean(modoAtivo) && eclipse === ECLIPSES_MINIMAL.parcial);
    return eclipse;
}

export function aplicarModoMinimal(modos, eclipse = ECLIPSES_MINIMAL.total) {
    const lista = Array.isArray(modos) ? modos : [modos];
    const ativo = lista.includes('minimal');
    document.body.classList.toggle('modo-minimal', ativo);
    aplicarEclipseMinimal(eclipse, ativo);
    return ativo;
}
