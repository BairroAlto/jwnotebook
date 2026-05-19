// components/editor/modulos/editor-render.js
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

/**
 * RENDERIZADOR DO FEED CENTRAL
 * Converte os dados das caixas em elementos HTML vivos e destaca novidades no Share.
 */
export async function renderizarFeed(params) {
    const { caixasAtuais, feed, acionarGravacao, onApagar, abrirPaleta, abrirPopupPartilhar, moverCaixa, abrirPopupTags, prepararInsercao, notaAbertaId, dadosNota } = params;

    if (!feed) return;

    feed.style.minHeight = feed.offsetHeight + "px";
    feed.innerHTML = ""; 

    const auth = window.auth;
    const user = auth.currentUser;

    const modos = Array.isArray(dadosNota?.modo) ? dadosNota.modo : [dadosNota?.modo || 'normal'];
    const isModoPost = modos.includes('post');
    const isModoSentinela = modos.includes('sentinela');

    // ========================================================
    // 🚀 LÓGICA DE FILTRAGEM DE EXCLUSIVIDADE
    // ========================================================
    const caixasParaMostrar = caixasAtuais.filter(c => {
        if (c.estado !== "on") return false; // Ignorar ocultas/apagadas

        if (isModoSentinela) {
            // No modo Sentinela, mostramos apenas o que pertence ao estudo
            return !!c.referenciacodex;
        } else {
            // Nos outros modos (Normal, Post, Arquivo), escondemos o estudo
            return !c.referenciacodex;
        }
    });

    // Ordenação
    if (isModoPost) caixasParaMostrar.sort((a, b) => (b.ordem || 0) - (a.ordem || 0));
    else caixasParaMostrar.sort((a, b) => (a.ordem || 0) - (b.ordem || 0));

    let minhaUltimaLeitura = 0;
    if (user && dadosNota && dadosNota.onde === "share") {
        minhaUltimaLeitura = dadosNota[user.uid]?.ultimaLeitura || 0;
    }
    
    const raciociniosVivos = caixasParaMostrar.filter(c => c.tipo === "raciocinio");

    const promessasDeRender = caixasParaMostrar.map(async (caixa) => {
        let modulo;
        let elementoResultante;
        
     switch (caixa.tipo) {
    case "subnota": 
        modulo = await import('../ferramentas/subnota.js');
        elementoResultante = await modulo.criarSubNotaAzul(caixa, acionarGravacao, onApagar, abrirPaleta, abrirPopupPartilhar, moverCaixa, abrirPopupTags, prepararInsercao);
        break;
    case "questao": 
        modulo = await import('../ferramentas/questao.js');
        elementoResultante = await modulo.criarQuestaoVerde(caixa, acionarGravacao, onApagar, abrirPaleta, abrirPopupPartilhar, moverCaixa, abrirPopupTags, prepararInsercao);
        break;
    case "raciocinio": 
        const numR = raciociniosVivos.findIndex(r => r.id === caixa.id) + 1;
        modulo = await import('../ferramentas/raciocinio.js');
        elementoResultante = await modulo.criarRaciocinioAmarelo(caixa, numR, acionarGravacao, onApagar, abrirPaleta, abrirPopupPartilhar, moverCaixa, abrirPopupTags, prepararInsercao);
        break;
    case "elevador":
        modulo = await import('../ferramentas/elevador.js');
        elementoResultante = await modulo.criarElevadorVermelho(caixa, acionarGravacao, onApagar, abrirPaleta, abrirPopupPartilhar, moverCaixa, abrirPopupTags, prepararInsercao);
        break;
    case "cartaovisita":
        modulo = await import('../ferramentas/cartaovisita.js');
        elementoResultante = await modulo.criarCartaoVisita(caixa, acionarGravacao, onApagar, moverCaixa, prepararInsercao);
        break;
    case "citacaobiblica":
        modulo = await import('../ferramentas/citacaobiblica.js');
        elementoResultante = await modulo.criarCitacaoBiblica(caixa, onApagar, moverCaixa, prepararInsercao);
        break;
    case "webcard":
        modulo = await import('../ferramentas/webcard.js');
        elementoResultante = await modulo.criarWebCardRoxo(caixa, onApagar, moverCaixa, prepararInsercao, acionarGravacao);
        break;
    case "galeria": // Corresponde à ferramenta "Imagens"
        modulo = await import('../ferramentas/imagens.js');
        elementoResultante = await modulo.criarGaleriaRosa(caixa, onApagar, moverCaixa, prepararInsercao, acionarGravacao);
        break;
    default: 
        modulo = await import('../ferramentas/contentor.js');
        elementoResultante = await modulo.criarContentorLaranja(caixa, acionarGravacao, onApagar, abrirPaleta, abrirPopupPartilhar, moverCaixa, abrirPopupTags, prepararInsercao);
}

        // Lógica de Novidade e IDs...
        if (elementoResultante) {
            elementoResultante.id = `bloco-${caixa.id}`;
            // Aplicar Badge de novo se necessário...
        }
        return elementoResultante;
    });

    const resultados = await Promise.all(promessasDeRender);
    resultados.forEach(el => { if (el) feed.appendChild(el); });

    setTimeout(() => { feed.style.minHeight = ""; }, 200);
}

  



function aplicarEstiloNovidade(el) {
    el.style.boxShadow = "0 0 15px rgba(239, 68, 68, 0.25)";
    el.style.borderLeftWidth = "6px";
    el.style.transition = "all 0.5s ease";
    const badge = document.createElement('div');
    badge.style.cssText = `position: absolute; top: -8px; right: 15px; background: #ef4444; color: white; font-size: 9px; font-weight: 900; padding: 2px 8px; border-radius: 4px; box-shadow: 0 2px 5px rgba(0,0,0,0.3); z-index: 10; pointer-events: none; letter-spacing: 0.5px;`;
    badge.innerText = "NOVO";
    if (el.style.position !== "relative") el.style.position = "relative";
    el.appendChild(badge);
}