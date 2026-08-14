// components/xray/xray-ai-controller.js
import { state } from './xray-state.js';
import { XRayAiEngine } from './xray-ai-engine.js';

export const XRayAiController = {
    
    /**
     * RENDERIZADOR INTELIGENTE (VERIFICA ESTADO ANTES DE DESENHAR)
     */
    renderizarMenuInicial: (container) => {
        // 1. Se estiver a carregar, mostra a tela de loading
        if (state.aiStatus.loading) {
            XRayAiController.exibirLoading(container);
            return;
        }

        // 2. Se já tiver uma resposta, mostra o resultado
        if (state.aiStatus.resposta) {
            XRayAiController.exibirResultado(container, state.aiStatus.resposta, state.aiStatus.alvo, state.aiStatus.tipo);
            return;
        }

        // 3. Caso contrário, mostra o menu de escolha (Piccards)
        XRayAiController.desenharSelecaoPiccards(container);
    },

    desenharSelecaoPiccards: (container) => {
        const refs = state.resultadosCache?.referencias || [];
        const termos = state.palavrasDetetadas || [];

        container.innerHTML = `
            <div style="padding:10px;">
                <p style="font-size:10px; color:#10b981; font-weight:900; text-transform:uppercase; margin-bottom:20px; text-align:center; letter-spacing:2px;">
                    <i class="fa-brands fa-mailchimp"></i> Protocolos de Inteligência
                </p>
                <div class="xray-pill-grid" id="ai-pill-selector"></div>
            </div>`;

        const grid = container.querySelector('#ai-pill-selector');

        refs.forEach(ref => {
            const nome = `${ref.livro} ${ref.cap}:${ref.ver}`;
            const btn = document.createElement('div');
            btn.className = "neuronio-pill active";
            btn.innerHTML = `<i class="fa-solid fa-book-bible"></i> ${nome}`;
            btn.onclick = () => XRayAiController.abrirProtocolos(container, nome, 'biblia');
            grid.appendChild(btn);
        });

        termos.forEach(termo => {
            const btn = document.createElement('div');
            btn.className = "neuronio-pill active";
            btn.style.borderColor = "#818cf8";
            btn.innerHTML = `<i class="fa-solid fa-ear-listen"></i> ${termo.toUpperCase()}`;
            btn.onclick = () => XRayAiController.abrirProtocolos(container, termo, 'keyword');
            grid.appendChild(btn);
        });

        if (grid.innerHTML === "") {
            container.innerHTML = `<p style="text-align:center; opacity:0.3; padding:40px;">Escreve no Manifesto para ativar a IA.</p>`;
        }
    },

   abrirProtocolos: (container, alvo, tipo) => {
        container.innerHTML = `
            <div style="padding:10px; animation: fadeIn 0.3s ease;">
                <button class="btn-voltar-ai" id="btn-back-to-pills" style="margin-bottom:20px; background:none; border:none; color:gray; cursor:pointer; font-weight:800; font-size:10px;">
                    <i class="fa-solid fa-arrow-left"></i> VOLTAR
                </button>

                <div class="ai-target-card" style="border-left-color:#10b981; margin-bottom:20px;">
                    <span style="font-size:9px; font-weight:900; color:#10b981; text-transform:uppercase;">Alvo de Análise</span>
                    <h3 style="color:white; margin:5px 0 0 0;">${alvo.toUpperCase()}</h3>
                </div>

                <div style="display:grid; grid-template-columns: 1fr; gap:10px;">
                    <button class="btn-protocolo-xray" data-modo="resumir">
                        <i class="fa-solid fa-layer-group" style="color:#10b981"></i>
                        <div style="text-align:left">
                            <b>RESUMIR FONTES</b>
                            <span>Sintetiza todas as publicações encontradas.</span>
                        </div>
                    </button>

                    <button class="btn-protocolo-xray" data-modo="designacao">
                        <i class="fa-solid fa-microphone-lines" style="color:#818cf8"></i>
                        <div style="text-align:left">
                            <b>GERAR DESIGNAÇÃO</b>
                            <span>Prepara um esboço para discurso ou escola.</span>
                        </div>
                    </button>

                    <!-- 🚀 NOVO PROTOCOLO: PROFESSOR -->
                    <button class="btn-protocolo-xray" data-modo="explicar">
                        <i class="fa-solid fa-chalkboard-user" style="color:#fbbf24"></i>
                        <div style="text-align:left">
                            <b>EXPLICAR CONCEITO</b>
                            <span>Explicação pedagógica estilo Professor-Aluno.</span>
                        </div>
                    </button>
                </div>
            </div>`;

        container.querySelector('#btn-back-to-pills').onclick = () => {
            state.aiStatus.resposta = null; 
            XRayAiController.renderizarMenuInicial(container);
        };
        
        container.querySelectorAll('.btn-protocolo-xray').forEach(btn => {
            btn.onclick = () => XRayAiController.processarIA(container, alvo, tipo, btn.dataset.modo);
        });
    },

    exibirLoading: (container) => {
        container.innerHTML = `
            <div style="text-align:center; padding:60px 20px; color:#10b981;">
                <i class="fa-brands fa-mailchimp fa-bounce" style="font-size:40px; margin-bottom:20px;"></i>
                <p style="font-size:10px; font-weight:800; letter-spacing:2px; text-transform:uppercase;">O BookAI está a ler o repositório...</p>
            </div>`;
    },

      /**
     * 🧼 LIMPEZA DE TEXTO (REMOVER MARKDOWN)
     */
    limparTextoParaExibicao: (texto) => {
        return texto
            .replace(/[#*|_]/g, "") // Remove #, *, |, _
            .replace(/-{3,}/g, "")   // Remove linhas de separação ---
            .replace(/\n\s*\n/g, "\n\n") // Normaliza quebras de linha duplas
            .trim();
    },

    exibirResultado: (container, resposta, alvo, tipo) => {
        // Aplicamos a limpeza antes de mostrar
        const textoLimpo = XRayAiController.limparTextoParaExibicao(resposta);

        container.innerHTML = `
            <div style="padding:10px; animation: fadeIn 0.4s ease;">
                <button class="btn-voltar-ai" id="btn-back-to-prot" style="margin-bottom:15px; background:none; border:none; color:gray; cursor:pointer; font-weight:800; font-size:10px;">
                    <i class="fa-solid fa-arrow-left"></i> VOLTAR AOS PROTOCOLOS
                </button>
                <div class="xray-result-card" style="border-left-color:#10b981; cursor:default; background:rgba(255,255,255,0.02);">
                    <div style="font-size:13.5px; color:#f1f5f9; line-height:1.8; white-space:pre-wrap;">${textoLimpo}</div>
                </div>
            </div>`;
            
        container.querySelector('#btn-back-to-prot').onclick = () => {
            state.aiStatus.resposta = null;
            XRayAiController.abrirProtocolos(container, alvo, tipo);
        };
    },


    processarIA: async (container, alvo, tipo, modo) => {
        // 1. Atualizar Estado de Loading
        state.aiStatus.loading = true;
        state.aiStatus.alvo = alvo;
        state.aiStatus.tipo = tipo;
        state.aiStatus.modo = modo;
        state.aiStatus.resposta = null;

        XRayAiController.exibirLoading(container);

        // 2. Recolher conteúdos do cache
        let conteudos = [];
        if (tipo === 'biblia') {
            const res = state.resultadosCache.resultados;
            conteudos = [...res.publicacoes, ...res.livros, ...res.multimedia]
                .filter(it => it.referencia === alvo)
                .map(it => it.resumo);
        } else {
            conteudos = (state.resultadosPalavrasCache[alvo] || []).map(it => it.resumo);
        }

        // 3. Chamada Assíncrona
        const resposta = await XRayAiEngine.executarProtocolo(conteudos, alvo, modo);

        // 4. Finalizar e salvar no estado
        state.aiStatus.loading = false;
        state.aiStatus.resposta = (resposta === "ERROR") ? "Falha na sintonização satélite." : resposta;

        // 5. Se o utilizador ainda estiver na aba AI, redesenha com o resultado
        const abaAtiva = document.querySelector('.tab-btn-right.active')?.dataset.tab;
        if (abaAtiva === 'ai') {
            XRayAiController.renderizarMenuInicial(container);
        }
    }
};
