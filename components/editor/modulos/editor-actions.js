// components/editor/modulos/editor-actions.js

export function moverCaixa(caixasAtuais, caixaAlvo, direcao, callback) {
    const ativas = caixasAtuais.filter(c => c.estado === 'ativa').sort((a, b) => a.ordem - b.ordem);
    const indexAtual = ativas.findIndex(c => c.id === caixaAlvo.id);
    if (indexAtual === -1) return;

    if (direcao === "cima" && indexAtual > 0) {
        const troca = ativas[indexAtual - 1];
        [caixaAlvo.ordem, troca.ordem] = [troca.ordem, caixaAlvo.ordem];
    } else if (direcao === "baixo" && indexAtual < ativas.length - 1) {
        const troca = ativas[indexAtual + 1];
        [caixaAlvo.ordem, troca.ordem] = [troca.ordem, caixaAlvo.ordem];
    }
    callback();
}

export function prepararInsercao(idCaixa) {
    window.idReferenciaInsercao = idCaixa;
    const popup = document.getElementById('popup-ferramentas-inline');
    if (popup) popup.classList.add('active');
}