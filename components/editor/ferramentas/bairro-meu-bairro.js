export function criarSecaoMeuBairro({ caixa, pai, onTextoAlterado, renderizar }) {
    const estado = pai?.meuBairro;
    if (!estado?.categoria || !estado?.modelo) return null;

    const corpo = document.createElement('div');
    corpo.className = 'bairro-meu-bairro-exterior-body';

    import('../modulos/meu-bairro.js').then(({ renderizarPraticaExterior }) => {
        renderizarPraticaExterior({
            contentor: corpo,
            bairro: pai,
            caixaId: caixa.id,
            notaId: window.notaAtualContext?.notaId,
            db: window.notaAtualContext?.db,
            aoAlterar: () => onTextoAlterado(caixa)
        });
    }).catch(error => console.error('[MEU-BAIRRO] Não foi possível renderizar a área:', error));

    return corpo;
}
