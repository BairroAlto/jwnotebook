// components/editor/modulos/tool-manager.js

import { obterConfigNota } from '../../settings/preferences.js';
import { obterGrupoFundido, sincronizarGrupoFundido } from './fundir-manager.js';

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
            protecao: "fechado",
        fundir: []
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
        if (tipo === "bairro") {
            novaCaixa.corBairro = "#c084fc";
            novaCaixa.pastapai = [];
            novaCaixa.ligaçãoBairro = [];
        }
        if (tipo === "galeria") {  novaCaixa.links = []; novaCaixa.urldimensao = "medias";
}
        if (tipo !== "firmamento" && noteConfig.defaultFocos?.[tipo]) novaCaixa.foco = noteConfig.defaultFocos[tipo];

        // 4. Lógica de Posicionamento Inteligente
        let grupoFundidoBase = [];
        let grupoFundidoAntigo = [];

        if (window.idReferenciaInsercao) {
            // Quando o "+" vem de uma caixa fundida, a nova ferramenta
            // entra automaticamente no fim da mesma fusão.
            const idxAlvo = caixasAtuais.findIndex(c => c.id === window.idReferenciaInsercao);
            const caixaReferencia = idxAlvo >= 0 ? caixasAtuais[idxAlvo] : null;

            if (caixaReferencia) {
                const grupoDetectado = obterGrupoFundido(caixaReferencia, caixasAtuais);
                if (grupoDetectado.length >= 2) {
                    grupoFundidoAntigo = [...grupoDetectado];
                    grupoFundidoBase = [...grupoDetectado];
                    const posicaoNaFusao = grupoFundidoBase.findIndex(caixa => caixa.id === caixaReferencia.id);
                    grupoFundidoBase.splice(Math.max(0, posicaoNaFusao + 1), 0, novaCaixa);
                }
                caixasAtuais.splice(idxAlvo + 1, 0, novaCaixa);
            } else {
                caixasAtuais.push(novaCaixa);
            }

            window.idReferenciaInsercao = null;
        } else {
            // --- INSERÇÃO VIA POPUP GLOBAL ---
            caixasAtuais.push(novaCaixa);
        }

        // 5. Re-indexar ordens (Garante sequência 1, 2, 3, 4...)
        caixasAtuais.forEach((c, i) => { 
            c.ordem = i + 1; 
        });
        if (grupoFundidoAntigo.length >= 2) {
            sincronizarGrupoFundido(
                grupoFundidoBase,
                grupoFundidoAntigo
            );
        }

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
