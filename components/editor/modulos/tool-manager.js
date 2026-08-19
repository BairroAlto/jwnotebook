// components/editor/modulos/tool-manager.js

import { obterConfigNota } from '../../settings/preferences.js';
import { obterGrupoFundido, sincronizarGrupoFundido } from './fundir-manager.js';
import { obterAcessoFerramenta } from '../../settings/feature-admin.js';
import { verificarLimiteCaixas } from '../../billing/box-limits.js';
import { inserirAbaixoNaOrdemVisual } from './tool-insertion-order.js';
import { obterFerramenta } from '../../constants/ferramentas.js';

export const ToolManager = {
    /**
     * INSERIR FERRAMENTA
     * ctx: { caixasAtuais, aCriarCaixa, dadosNotaOriginal }
     * callbacks: { setACriarCaixa, atualizarFeedEGravar }
     */
    inserir: async (tipo, state, callbacks) => {
        const { caixasAtuais, aCriarCaixa, dadosNotaOriginal } = state;
        const { setACriarCaixa, atualizarFeedEGravar } = callbacks;
        const ferramenta = obterFerramenta(tipo);

        if (aCriarCaixa) return;

        if (!ferramenta) {
            console.warn(`[TOOL-MANAGER] Tipo de ferramenta desconhecido: ${tipo}`);
            window.alert('Esta ferramenta não está registada no NotaBook.');
            return;
        }

        if (!(await verificarLimiteCaixas(state.authRef, caixasAtuais, 1))) return;

        const featureKey = ferramenta.featureKey;
        if (featureKey && state.authRef?.currentUser) {
            try {
                const permitido = await obterAcessoFerramenta(state.authRef, featureKey);
                if (!permitido) {
                    window.alert(`A ferramenta ${ferramenta.nome} não está disponível no teu plano.`);
                    return;
                }
            } catch (erro) {
                console.error('[FEATURES] Não foi possível verificar o acesso:', erro);
                window.alert('Não foi possível verificar o acesso à ferramenta. Tenta novamente.');
                return;
            }
        }

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
        if (tipo === "noticias") {
            novaCaixa.noticiasPreferencias = { temas: [], excluir: [], mercado: "PT", limitePorTema: 4, vista: "grelha" };
            novaCaixa.noticiasCache = [];
            novaCaixa.noticiasAtualizadasEm = null;
        }
        if (tipo === "tempo") {
            novaCaixa.tempoLocalizacao = null;
            novaCaixa.tempoOpcoes = { temperatura: true, condicao: false, maxima: false, minima: false, vento: false, sensacao: false, humidade: false, chuva: false };
            novaCaixa.tempoDados = null;
            novaCaixa.today = null;
        }
        if (tipo === "inspirador") {
            novaCaixa.inspiradorPreferencias = {
                modo: 'aleatorio', autor: 'NotaBook', tema: 'esperanca', quantidade: 1,
                variedade: 'mesmo', frequencia: 'diaria', vista: 'lista'
            };
            novaCaixa.inspiradorCitacoes = [];
            novaCaixa.inspiradorCacheKey = null;
        }
        if (tipo === "gmail") {
            novaCaixa.gmailPreferencias = { limite: 25, filtro: "todos" };
        }
        if (tipo !== "firmamento" && noteConfig.defaultFocos?.[tipo]) novaCaixa.foco = noteConfig.defaultFocos[tipo];

        // 4. Lógica de Posicionamento Inteligente
        let grupoFundidoBase = [];
        let grupoFundidoAntigo = [];

        if (window.idReferenciaInsercao) {
            // Quando o "+" vem de uma caixa fundida, a nova ferramenta
            // entra na mesma fusão, imediatamente abaixo da referência.
            const idxAlvo = caixasAtuais.findIndex(c => c.id === window.idReferenciaInsercao);
            const caixaReferencia = idxAlvo >= 0 ? caixasAtuais[idxAlvo] : null;

            if (caixaReferencia) {
                const grupoDetectado = obterGrupoFundido(caixaReferencia, caixasAtuais);
                if (grupoDetectado.length >= 2) {
                    grupoFundidoAntigo = [...grupoDetectado];
                    grupoFundidoBase = [...grupoDetectado];
                    const posicaoNaFusao = grupoFundidoBase.findIndex(caixa => caixa.id === caixaReferencia.id);
                    inserirAbaixoNaOrdemVisual(grupoFundidoBase, posicaoNaFusao, novaCaixa, isModoPost);
                }
                inserirAbaixoNaOrdemVisual(caixasAtuais, idxAlvo, novaCaixa, isModoPost);
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
