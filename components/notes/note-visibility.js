export const CAMPO_NOTA_OCULTA = 'Oculto';

export function notaEstaOculta(nota) {
    return nota?.[CAMPO_NOTA_OCULTA] === true;
}

export function notaEstaVisivel(nota) {
    return !notaEstaOculta(nota);
}

