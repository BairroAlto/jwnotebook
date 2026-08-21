// components/lists/bridge-main.js

export async function abrirReferenciaDireta(dadosCard) {
    const container = document.getElementById('lista-lists');
    
    // Agora lemos o contexto técnico definido pelo motor X-SAT
    const contexto = dadosCard.contexto || "publicacao";

    if (container && !window.htmlListaAntiga) {
        window.htmlListaAntiga = container.innerHTML;
    }

    console.group(`🚀 [BRIDGE-MAIN] Direcionando para: ${contexto}`);

    try {
        let modulo;
        // O router agora decide corretamente qual bridge carregar
        if (contexto === 'multimedia') modulo = await import('./multimedia-bridge.js');
        else if (contexto === 'livro') modulo = await import('./livros-bridge.js');
        else modulo = await import('./publicacoes-bridge.js');
        
        await modulo.executarSalto(dadosCard);
    } catch (e) {
        console.error("❌ Erro na Bridge Central:", e);
    }
    console.groupEnd();
}