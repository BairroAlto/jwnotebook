// components/editor/modulos/tool-manager.js

import { obterConfigNota } from '../../settings/preferences.js';

export const ToolManager = {
    /**
     * INSERIR FERRAMENTA
     * ctx: { caixasAtuais, aCriarCaixa, dadosNotaOriginal }
     * callbacks: { setACriarCaixa, atualizarFeedEGravar }
     */
    inserir: (tipo, state, callbacks) => {
        const { caixasAtuais, aCriarCaixa, dadosNotaOriginal } = state;
        const { setACriarCaixa, atualizarFeedEGravar } = callbacks;

        if (aCriarCaixa) return;
        setACriarCaixa(true);

        console.log(`➕ [TOOL-MANAGER] Inserindo ferramenta: ${tipo}`);

        // 1. Identificar se o Modo Post está ativo
        const modos = Array.isArray(dadosNotaOriginal?.modo) ? dadosNotaOriginal.modo : [dadosNotaOriginal?.modo || 'normal'];
        const isModoPost = modos.includes('post');
        const noteConfig = obterConfigNota(dadosNotaOriginal, state.authRef?.currentUser?.uid);

        // 2. Normalizar o array para ordem crescente (1...N) antes de manipular
        caixasAtuais.sort((a, b) => (a.ordem || 0) - (b.ordem || 0));

        // 3. Criar o objeto base da nova caixa
        const novaCaixa = { 
            id: crypto.randomUUID(), 
            tipo: tipo, 
            conteudo: "", 
            estado: "on", 
            timestamp: new Date().toISOString(), 
            protecao: "fechado"
        };

        // Configurações iniciais por tipo
        if (["subnota", "questao", "raciocinio", "cartaovisita"].includes(tipo)) novaCaixa.titulo = "";
        if (tipo === "webcard") novaCaixa.links = [];
        if (tipo === "citacaobiblica") novaCaixa.textosanexados = [];
        if (tipo === "firmamento") {
            novaCaixa.foco = "original";
            novaCaixa.corFirmamento = "#050505";
            novaCaixa.textoFirmamento = "#ffffff";
        }
        if (tipo === "galeria") {  novaCaixa.links = []; novaCaixa.urldimensao = "medias";
}
        if (tipo !== "firmamento" && noteConfig.defaultFocos?.[tipo]) novaCaixa.foco = noteConfig.defaultFocos[tipo];

        // 4. Lógica de Posicionamento Inteligente
        if (window.idReferenciaInsercao) {
            // --- INSERÇÃO VIA BOTÃO "+" ENTRE BLOCOS ---
            const idxAlvo = caixasAtuais.findIndex(c => c.id === window.idReferenciaInsercao);
            
            /**
             * EXPLICAÇÃO DA LÓGICA:
             * No Modo Normal (1, 2, 3), o "+" abaixo de um bloco insere na posição seguinte (idx + 1).
             * No Modo Post (3, 2, 1), para um bloco aparecer ACIMA do clicado, 
             * ele também deve ser inserido na posição seguinte do array (idx + 1),
             * pois assim ganhará uma 'ordem' maior e subirá no topo do ecrã.
             */
            caixasAtuais.splice(idxAlvo + 1, 0, novaCaixa);
            
            window.idReferenciaInsercao = null; // Limpa a referência
        } else {
            // --- INSERÇÃO VIA BOTÃO GLOBAL (POPUP) ---
            // Adiciona sempre ao fim do array para ser o mais recente
            caixasAtuais.push(novaCaixa);
        }

        // 5. Re-indexar ordens (Garante sequência 1, 2, 3, 4...)
        caixasAtuais.forEach((c, i) => { 
            c.ordem = i + 1; 
        });

        // 6. Atualizar a Interface e Gravar
        atualizarFeedEGravar(true);

        if (dadosNotaOriginal?.onde === "share") {
            const uid = state.authRef?.currentUser?.uid;
            const userName = state.authRef?.currentUser?.displayName || state.authRef?.currentUser?.email || "Utilizador";
            dadosNotaOriginal.shareNovidades = {
                ...(dadosNotaOriginal.shareNovidades || {}),
                [novaCaixa.id]: {
                    tipo: "criado",
                    by: uid,
                    byName: userName,
                    viewedBy: uid ? [uid] : [],
                    timestamp: new Date().toISOString()
                }
            };
        }
        
        // Fechar o seletor de ferramentas
        document.getElementById('popup-ferramentas-inline')?.classList.remove('active');

        // 7. Finalização: Foco e Scroll
        setTimeout(() => {
            setACriarCaixa(false);
            const elNovo = document.getElementById(`bloco-${novaCaixa.id}`);
            if (elNovo) {
                // Scroll suave para o novo bloco
                elNovo.scrollIntoView({ behavior: 'smooth', block: 'center' });
                // Focar no campo de texto para escrita imediata
                elNovo.querySelector('textarea, input')?.focus();
            }
        }, 300);
    }
};
