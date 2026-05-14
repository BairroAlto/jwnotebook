// components/editor/modulos/editor-render.js
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

/**
 * RENDERIZADOR DO FEED CENTRAL
 * Converte os dados das caixas em elementos HTML vivos e destaca novidades no Share.
 */
export async function renderizarFeed(params) {
    const { caixasAtuais, feed, acionarGravacao, onApagar, abrirPaleta, abrirPopupPartilhar, moverCaixa, abrirPopupTags, prepararInsercao, notaAbertaId, dadosNota } = params;

    if (!feed) return;

    // --- BLOQUEIO DE ENCOLHIMENTO ---
    // Em vez de medir o feed, medimos a área total de scroll (scrollHeight) 
    // do pai para garantir que o scroll tenha onde "ficar encostado".
    const scrollContainer = document.querySelector('.center-col');
    if (scrollContainer) {
        feed.style.minHeight = scrollContainer.scrollHeight + "px";
    }

    feed.innerHTML = ""; 

    const auth = getAuth();
    const user = auth.currentUser;

    // ... (lógica de ordenação e metadados igual ao anterior) ...
    const modos = Array.isArray(dadosNota?.modo) ? dadosNota.modo : [dadosNota?.modo || 'normal'];
    const isModoPost = modos.includes('post');
    if (isModoPost) caixasAtuais.sort((a, b) => (b.ordem || 0) - (a.ordem || 0));
    else caixasAtuais.sort((a, b) => (a.ordem || 0) - (b.ordem || 0));

    let minhaUltimaLeitura = 0;
    if (user && dadosNota && dadosNota.onde === "share") {
        minhaUltimaLeitura = dadosNota[user.uid]?.ultimaLeitura || 0;
    }
    const raciociniosVivos = caixasAtuais.filter(c => c.estado === "ativa" && c.tipo === "raciocinio");

    // Processar caixas (Aguardar renderização de todas)
    const promessasDeRender = caixasAtuais.map(async (caixa) => {
        if (caixa.estado === "desativa") return null;

        // Fábrica de Ferramentas (Switch Case...)
        // ... (Mantém o teu switch case aqui como estava) ...
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
            default: 
                modulo = await import('../ferramentas/contentor.js');
                elementoResultante = await modulo.criarContentorLaranja(caixa, acionarGravacao, onApagar, abrirPaleta, abrirPopupPartilhar, moverCaixa, abrirPopupTags, prepararInsercao);
        }

        if (elementoResultante && minhaUltimaLeitura) {
            const dataCaixa = new Date(caixa.timestamp).getTime();
            const dataLeitura = new Date(minhaUltimaLeitura).getTime();
            if (dataCaixa > (dataLeitura + 2000)) aplicarEstiloNovidade(elementoResultante);
        }

        return { el: elementoResultante, id: caixa.id };
    });

    const resultados = await Promise.all(promessasDeRender);
    resultados.forEach(res => {
        if (res && res.el) {
            res.el.id = `bloco-${res.id}`;
            feed.appendChild(res.el);
        }
    });

    // --- LIBERTAÇÃO DO BLOQUEIO ---
    // Só removemos a altura forçada depois de todos os elementos estarem no DOM
    requestAnimationFrame(() => {
        feed.style.minHeight = "";
    });
}

/**
 * Aplica o efeito visual de "Caixa Atualizada"
 */
function aplicarEstiloNovidade(el) {
    el.style.boxShadow = "0 0 15px rgba(239, 68, 68, 0.25)";
    el.style.borderLeftWidth = "6px";
    el.style.transition = "all 0.5s ease";

    const badge = document.createElement('div');
    badge.style.cssText = `
        position: absolute;
        top: -8px;
        right: 15px;
        background: #ef4444;
        color: white;
        font-size: 9px;
        font-weight: 900;
        padding: 2px 8px;
        border-radius: 4px;
        box-shadow: 0 2px 5px rgba(0,0,0,0.3);
        z-index: 10;
        pointer-events: none;
        letter-spacing: 0.5px;
    `;
    badge.innerText = "NOVO";

    if (el.style.position !== "relative") {
        el.style.position = "relative";
    }
    
    el.appendChild(badge);
}