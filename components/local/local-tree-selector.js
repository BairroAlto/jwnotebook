// Dentro da tua função que cria o item da árvore (criarItemPasta)
div.onclick = () => {
    document.querySelectorAll('.tree-item-pasta-select').forEach(el => el.style.background = "transparent");
    div.style.background = "rgba(99, 102, 241, 0.2)";
    
    // ATENÇÃO: Define isto para ser lido pela Promessa do Passo 1
    window.pastaDestinoIdGlobal = id; 
    
    document.getElementById('nome-pasta-selecionada').innerText = nome;
    document.getElementById('btn-confirmar-movimentacao').disabled = false;
    document.getElementById('btn-confirmar-movimentacao').style.opacity = "1";
};