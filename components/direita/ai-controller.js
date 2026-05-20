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
     * VISTA 1: LISTA DE BLOCOS
     */
    renderizarLista: (listaManual = null, notaRecebida = null) => {
        console.group("%c📡 [IA-CONTROLLER] renderizarLista", "color: #10b981; font-weight: bold;");
        
        const display = document.getElementById('xsat-display-content');
        if (!display) { console.groupEnd(); return; }

        // 1. CAPTURAR CONTEXTO REATIVO COM BLINDAGEM
        let nota = notaRecebida || window.dadosNotaOriginal;
        
        if (!nota || !nota.id) {
            console.log("ℹ️ Dados externos ausentes. Recuperando contexto do state interno...");
            if (state.notaId) {
                // 🚀 SOLUÇÃO: Reconstruímos o objeto nota a partir do que temos no state
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

        // Agora é seguro ler nota.modo
        const modos = Array.isArray(nota.modo) ? nota.modo : [nota.modo || 'normal'];
        const isSentinela = modos.includes('sentinela');
        const idContexto = `${nota.id}-${isSentinela ? 'S' : 'N'}`;

        // 2. DETETAR MUDANÇA DE ESTADO
        if (idContexto !== state.assinatura) {
            console.warn("♻️ Mudança detectada. Resetando cache da IA...");
            state.assinatura = idContexto;
            state.notaId = nota.id;
            state.modoId = isSentinela ? 'S' : 'N';
            state.cacheCaixas = null;
            window._aiScrollInited = false;
        }

        // 3. LOGICA DE DADOS (Persistência)
        let caixas = listaManual || state.cacheCaixas;

        if (!caixas) {
            console.log("🔍 Filtrando window.caixasAtuais...");
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
            listCont.innerHTML = `<p style="text-align:center; color:gray; padding:40px; font-size:11px; opacity:0.5;">Vazio neste modo.</p>`;
            console.groupEnd();
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

        console.groupEnd();
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
            () => AIController.renderizarLista(), 
            (modo) => AIController.executarAnalise(modo),
            state.incluirTitulo
        );
    },

    /**
     * EXECUÇÃO
     */
   executarAnalise: async (modo) => {
        const display = document.getElementById('xsat-display-content');
        display.scrollTop = 0;
        display.innerHTML = `<div style="text-align:center; padding:60px 20px; color:#10b981;"><i class="fa-brands fa-mailchimp fa-bounce" style="font-size:40px; margin-bottom:20px;"></i><p style="font-size:10px; font-weight:800; letter-spacing:2px;">BOOKAI A PROCESSAR...</p></div>`;

        let textoParaIA = state.caixaAlvo.conteudo;
        if (state.incluirTitulo && state.caixaAlvo.tipo !== 'contentor' && state.caixaAlvo.titulo) {
            textoParaIA = `TÍTULO: ${state.caixaAlvo.titulo}\nCONTEÚDO: ${state.caixaAlvo.conteudo}`;
        }


        try {
            const respostaBruta = await NexoEngine.perguntar(textoParaIA, modo);
            const formatada = AIView.formatarTexto(respostaBruta);

            // 🚀 PREPARAR RESPOSTA PARA O ONCLICK (Escapar aspas e quebras de linha)
            const respostaParaCopia = respostaBruta.replace(/`/g, '\\`').replace(/\$/g, '\\$');

            display.innerHTML = `
                <div class="ai-container">
                    <button class="btn-voltar-ai" onclick="window.AIController.abrirProtocolos()"><i class="fa-solid fa-arrow-left"></i> Voltar</button>
                    
                    <div class="ai-target-card" style="border-left: 4px solid #10b981; position: relative;">
                        
                        <!-- 📋 BOTÃO DE CÓPIA -->
                        <button onclick="window.AIController.copiarResposta(\`${respostaParaCopia}\`, this)" 
                                style="position: absolute; top: 12px; right: 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: var(--text-muted); width: 28px; height: 28px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: 0.2s;" 
                                title="Copiar para a Área de Transferência">
                            <i class="fa-regular fa-copy" style="font-size: 12px;"></i>
                        </button>

                        <p class="ai-target-label" style="color:#10b981;"><i class="fa-solid fa-robot"></i> Resultado</p>
                        <div style="color:#f1f5f9; white-space:pre-wrap; font-size:13px; line-height:1.6; padding-right: 20px;">${formatada}</div>
                    </div>
                </div>`;
        } catch (e) {
            display.innerHTML = `<p style="color:#ef4444; padding:20px; text-align:center;">Erro na ligação.</p>`;
        }
    },

      /**
     * 📋 MOTOR DE CÓPIA COM FEEDBACK VISUAL
     */
    copiarResposta: (texto, btn) => {
        navigator.clipboard.writeText(texto).then(() => {
            const icon = btn.querySelector('i');
            
            // Feedback visual: Muda ícone e cor
            icon.className = 'fa-solid fa-check';
            btn.style.color = '#22c55e';
            btn.style.borderColor = '#22c55e';

            // Restaura após 2 segundos
            setTimeout(() => {
                icon.className = 'fa-regular fa-copy';
                btn.style.color = '';
                btn.style.borderColor = '';
            }, 2000);
        });
    },
    
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
