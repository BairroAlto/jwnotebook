// components/direita/ai-controller.js
import { NexoEngine } from './ai-engine.js';
import { AIView } from './ai-view.js';
import { AIInteraction } from './ai-interaction.js';

let state = {
    notaId: "",
    modoId: "", // 'S' ou 'N'
    cacheCaixas: null,
    caixaAlvo: null,
    assinatura: ""
};

export const AIController = {
    renderizarLista: (listaManual = null, notaRecebida = null) => {
        console.group("%c📡 [IA-CONTROLLER] renderizarLista", "color: #10b981; font-weight: bold;");
        
        const display = document.getElementById('xsat-display-content');
        display.scrollTop = 0;
        if (!display) { console.groupEnd(); return; }

        // 1. CAPTURAR CONTEXTO COM PROTEÇÃO CONTRA UNDEFINED
        // Se notaRecebida e window.dadosNotaOriginal falharem, tentamos recuperar do nosso próprio state
        let nota = notaRecebida || window.dadosNotaOriginal;
        
        if (!nota || !nota.id) {
            console.log("ℹ️ Dados externos ausentes. Tentando recuperar contexto do state interno...");
            if (state.notaId) {
                // Criamos um objeto "fake" baseado no que já sabíamos para não quebrar a filtragem
                nota = { 
                    id: state.notaId, 
                    modo: state.modoId === 'S' ? ['sentinela'] : ['normal'] 
                };
            } else {
                console.error("❌ Falha crítica: Nenhum contexto de nota encontrado.");
                console.groupEnd();
                return;
            }
        }

        const modos = Array.isArray(nota.modo) ? nota.modo : [nota.modo || 'normal'];
        const isSentinela = modos.includes('sentinela');
        const idContexto = `${nota.id}-${isSentinela ? 'S' : 'N'}`;

        console.log(`📝 Contexto: Nota(${nota.id}) | Modo(${isSentinela ? 'Sentinela' : 'Normal'})`);

        // 2. DETETAR MUDANÇA REAL DE ESTADO
        if (idContexto !== state.assinatura) {
            console.warn("♻️ Mudança detectada. Resetando cache...");
            state.assinatura = idContexto;
            state.notaId = nota.id;
            state.modoId = isSentinela ? 'S' : 'N';
            state.cacheCaixas = null;
            window._aiScrollInited = false;
        }

        // 3. LOGICA DE DADOS (Persistência de Cache)
        let caixas = null;
        if (listaManual) {
            caixas = listaManual;
            state.cacheCaixas = caixas; // Atualiza o cache com os novos dados do Dispatcher
        } else if (state.cacheCaixas) {
            console.log(`📦 Usando CACHE INTERNO (${state.cacheCaixas.length} itens).`);
            caixas = state.cacheCaixas;
        } else {
            const origem = window.caixasAtuais || [];
            caixas = origem.filter(c => {
                if (c.estado !== 'on') return false;
                const temRef = !!c.referenciacodex;
                return isSentinela ? temRef : !temRef;
            });
            state.cacheCaixas = caixas;
        }

        // 4. CONSTRUIR UI
        AIView.renderContainer(display, isSentinela);
        const listCont = document.getElementById('ai-blocks-list');

        if (caixas.length === 0) {
            listCont.innerHTML = `<p style="text-align:center; color:gray; padding:40px; font-size:11px; opacity:0.5;">Nenhum conteúdo neste modo.</p>`;
            console.groupEnd();
            return;
        }

        caixas.forEach(c => {
            const card = AIView.criarCard(c, () => {
                state.caixaAlvo = c;
                AIInteraction.focarBloco(c.id, () => AIController.abrirProtocolos());
            });
            listCont.appendChild(card);
        });

        AIController.sincronizarTextos(caixas);
        AIInteraction.initScrollSpy(caixas, (id) => AIInteraction.destacarCard(id));

        console.groupEnd();
    },

    abrirProtocolos: () => {
        if (!state.caixaAlvo) return AIController.renderizarLista();
        
        AIView.renderProtocolos(
            document.getElementById('xsat-display-content'), 
            state.caixaAlvo, 
            () => AIController.renderizarLista(), // Sem argumentos: vai usar o cache interno
            (modo) => AIController.executarAnalise(modo)
        );
    },

    executarAnalise: async (modo) => {
        const display = document.getElementById('xsat-display-content');
        display.innerHTML = `<div style="text-align:center; padding:60px 20px; color:#10b981;"><i class="fa-brands fa-mailchimp fa-bounce" style="font-size:40px; margin-bottom:20px;"></i><p style="font-size:10px; font-weight:800; letter-spacing:2px;">BOOKAI A PROCESSAR...</p></div>`;

        try {
            const resposta = await NexoEngine.perguntar(state.caixaAlvo.conteudo, modo);
            const formatada = AIView.formatarTexto(resposta);

            display.innerHTML = `
                <div class="ai-container">
                    <button class="btn-voltar-ai" onclick="window.AIController.abrirProtocolos()"><i class="fa-solid fa-arrow-left"></i> Voltar</button>
                    <div class="ai-target-card" style="border-left: 4px solid #10b981">
                        <p class="ai-target-label" style="color:#10b981;"><i class="fa-solid fa-robot"></i> Resultado</p>
                        <div style="color:#f1f5f9; white-space:pre-wrap; font-size:13px; line-height:1.6;">${formatada}</div>
                    </div>
                </div>`;
        } catch (e) {
            display.innerHTML = `<p style="color:#ef4444; padding:20px;">Erro de conexão.</p>`;
        }
    },

    sincronizarTextos: (lista) => {
        lista.forEach(c => {
            const el = document.getElementById(`ai-txt-${c.id}`);
            if (el) el.innerText = c.titulo || (c.conteudo ? c.conteudo.substring(0, 80) : '...');
        });
    }
};

window.AIController = AIController;