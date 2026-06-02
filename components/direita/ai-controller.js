// components/direita/ai-controller.js
import { NexoEngine } from './ai-engine.js';
import { AIView } from './ai-view.js';
import { AIInteraction } from './ai-interaction.js';
import { IDENTIDADE_FERRAMENTAS } from '../constants/ferramentas.js';

let state = {
    notaId: "",
    modoId: "",      // "S" para Sentinela, "N" para Normal
    cacheCaixas: null,
    caixaAlvo: null,
    assinatura: "",
    incluirTitulo: false
};

export const AIController = {

    /**
     * 🚀 CONFIGURAÇÃO EXTERNA (Vindo do Brain)
     */
    configurarAlvoExterno: (caixaVirtual) => {
        console.log("%c🎯 [IA-CONTROLLER] Sintonizando alvo externo.", "color: #10b981; font-weight: bold;");
        state.caixaAlvo = caixaVirtual;
        state.assinatura = "EXTERNO"; 
    },

    /**
     * ♻️ RESET DE ESTADO (Vindo do clique no botão X-SAT)
     */
    resetarEstado: () => {
        console.log("♻️ [IA-CONTROLLER] Resetando para o contexto da nota.");
        state.assinatura = "";    
        state.caixaAlvo = null;   
        state.cacheCaixas = null; 
        
        // Chamamos a renderização passando os dados globais para evitar o erro de 'undefined'
        AIController.renderizarLista(null, window.dadosNotaOriginal);
    },

    /**
     * VISTA 1: LISTA DE BLOCOS (SCANNER)
     */
    renderizarLista: (listaManual = null, notaRecebida = null) => {
        const display = document.getElementById('xsat-display-content');
        if (!display) return;

        // 1. DETERMINAR CONTEXTO DE FORMA SEGURA
        // Prioridade: notaRecebida -> window.dadosNotaOriginal -> state interno
        let notaAtual = notaRecebida || window.dadosNotaOriginal;

        if (!notaAtual || !notaAtual.id) {
            if (state.notaId) {
                // Reconstrução mínima para evitar crash
                notaAtual = { 
                    id: state.notaId, 
                    modo: (state.modoId === 'S') ? ['sentinela'] : ['normal'] 
                };
            } else {
                return; // Aborta se não houver mesmo nenhuma nota
            }
        }

        // 2. ESCUDO DE MODO EXTERNO
        if (state.assinatura === "EXTERNO") {
            console.log("🛡️ [IA-CONTROLLER] Scanner da nota bloqueado (Modo Externo Ativo)");
            return; 
        }

        // 3. DETETAR MUDANÇA DE NOTA
        const modos = Array.isArray(notaAtual.modo) ? notaAtual.modo : [notaAtual.modo || 'normal'];
        const isSentinela = modos.includes('sentinela');
        const idContexto = `${notaAtual.id}-${isSentinela ? 'S' : 'N'}`;

        if (idContexto !== state.assinatura) {
            state.assinatura = idContexto;
            state.notaId = notaAtual.id;
            state.modoId = isSentinela ? 'S' : 'N';
            state.cacheCaixas = null;
            window._aiScrollInited = false;
        }

        // 4. LOGICA DE DADOS
        let caixas = listaManual || state.cacheCaixas;
        if (!caixas) {
            const origem = window.caixasAtuais || [];
            caixas = origem.filter(c => {
                if (c.estado !== 'on') return false;
                const temRef = !!c.referenciacodex;
                return isSentinela ? temRef : !temRef;
            });
            state.cacheCaixas = caixas;
        }

        // 5. CONSTRUIR UI
        AIView.renderContainer(display, isSentinela);
        const listCont = document.getElementById('ai-blocks-list');

        if (caixas.length === 0) {
            listCont.innerHTML = `<p style="text-align:center; color:gray; padding:40px; font-size:11px; opacity:0.5;">Vazio neste modo.</p>`;
            return;
        }

        caixas.forEach(c => {
            const card = AIView.criarCard(c, () => {
                state.caixaAlvo = c;
                AIInteraction.focarNoEditor(c.id, () => AIController.abrirProtocolos());
            });
            listCont.appendChild(card);
        });

        AIController.sincronizarTextosLive(caixas);
        AIInteraction.initScrollSpy(caixas, (id) => AIInteraction.aplicarDestaqueUI(id));
    },

    /**
     * VISTA 2: PAINEL DE PROTOCOLOS
     */
    abrirProtocolos: () => {
        if (!state.caixaAlvo) return AIController.renderizarLista();
        
        const display = document.getElementById('xsat-display-content');
        display.scrollTop = 0;

        window.removeEventListener('ai:toggleTitulo', window._handlerToggleTitulo);
        window._handlerToggleTitulo = (e) => {
            state.incluirTitulo = e.detail;
            AIController.abrirProtocolos(); 
        };
        window.addEventListener('ai:toggleTitulo', window._handlerToggleTitulo);

        AIView.renderProtocolos(
            display, 
            state.caixaAlvo, 
            () => {
                if (state.assinatura === "EXTERNO") state.assinatura = "";
                AIController.renderizarLista();
            }, 
            (modo) => AIController.executarAnalise(modo),
            state.incluirTitulo
        );
    },

    /**
     * EXECUÇÃO DA CONSULTA À IA
     */
    executarAnalise: async (modo) => {
        const display = document.getElementById('xsat-display-content');
        display.scrollTop = 0;
        display.innerHTML = `
            <div style="text-align:center; padding:60px 20px; color:#10b981;">
                <i class="fa-brands fa-mailchimp fa-bounce" style="font-size:40px; margin-bottom:20px;"></i>
                <p style="font-size:10px; font-weight:800; letter-spacing:2px; text-transform:uppercase;">O BOOKAI ESTÁ A ANALISAR...</p>
            </div>`;

        let textoParaIA = state.caixaAlvo.conteudo;
        if (state.incluirTitulo && state.caixaAlvo.id !== "externo" && state.caixaAlvo.tipo !== 'contentor' && state.caixaAlvo.titulo) {
            textoParaIA = `TÍTULO: ${state.caixaAlvo.titulo}\nCONTEÚDO: ${state.caixaAlvo.conteudo}`;
        }

        try {
            const respostaBruta = await NexoEngine.perguntar(textoParaIA, modo);
            const formatada = AIView.formatarTexto(respostaBruta);
            const respostaParaCopia = respostaBruta.replace(/`/g, '\\`').replace(/\$/g, '\\$');

            display.innerHTML = `
                <div class="ai-container">
                    <button class="btn-voltar-ai" onclick="window.AIController.abrirProtocolos()"><i class="fa-solid fa-arrow-left"></i> Voltar</button>
                    
                    <div class="ai-target-card" style="border-left: 4px solid #10b981; position: relative;">
                        <button onclick="window.AIController.copiarResposta(\`${respostaParaCopia}\`, this)" 
                                class="btn-copy-ai"
                                style="position: absolute; top: 12px; right: 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: var(--text-muted); width: 28px; height: 28px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: 0.2s;">
                            <i class="fa-regular fa-copy" style="font-size: 12px;"></i>
                        </button>

                        <p class="ai-target-label" style="color:#10b981;"><i class="fa-solid fa-robot"></i> Resultado</p>
                        <div style="color:#f1f5f9; white-space:pre-wrap; font-size:13.5px; line-height:1.7; padding-right: 20px;">${formatada}</div>
                    </div>
                </div>`;
        } catch (e) {
            display.innerHTML = `<p style="color:#ef4444; padding:20px; text-align:center;">Erro na ligação ao satélite.</p>`;
        }
    },

    /**
     * MOTOR DE CÓPIA
     */
    copiarResposta: (texto, btn) => {
        navigator.clipboard.writeText(texto).then(() => {
            const icon = btn.querySelector('i');
            icon.className = 'fa-solid fa-check';
            btn.style.color = '#22c55e';
            btn.style.borderColor = '#22c55e';
            setTimeout(() => {
                icon.className = 'fa-regular fa-copy';
                btn.style.color = '';
                btn.style.borderColor = '';
            }, 2000);
        });
    },
    
    /**
     * SINCRONIZAÇÃO DE TEXTOS
     */
    sincronizarTextosLive: (lista) => {
        lista.forEach(c => {
            const el = document.getElementById(`ai-txt-${c.id}`);
            if (el) {
                const resumo = c.titulo || (c.conteudo ? c.conteudo.substring(0, 80) : `Vazio`);
                if (el.innerText !== resumo) el.innerText = resumo;
            }
        });
    }
};

window.AIController = AIController;
