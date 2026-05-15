// components/direita/ai-controller.js
import { NexoEngine } from './ai-engine.js';
import { IDENTIDADE_FERRAMENTAS } from '../constants/ferramentas.js';

let isManualScrolling = false;
let ultimaAssinaturaEstrutura = "";
let notaIdCache = ""; 

export const AIController = {
    renderizarLista: () => {
        const display = document.getElementById('xsat-display-content');
        const listContId = 'ai-blocks-list';
        

        const caixas = window.caixasAtuais || [];
        const notaIdAtual = window.notaAbertaId; // ID da nota que o editor abriu
        const modos = window.dadosNotaOriginal?.modo || [];
        const isModoPost = Array.isArray(modos) ? modos.includes('post') : modos === 'post';
        const ativas = caixas.filter(c => c.estado === 'ativa');

        // --- 🚀 NOVO: DETETOR DE TROCA DE NOTA ---
        // Se mudámos de nota, limpamos tudo para não mostrar "fantasmas" da nota antiga
        if (notaIdAtual !== notaIdCache) {
            console.log("♻️ [AI-CONTROLLER] Nova nota detetada. Limpando scanner.");
            notaIdCache = notaIdAtual;
            ultimaAssinaturaEstrutura = ""; // Reseta a assinatura
            const containerExistente = document.getElementById(listContId);
            if (containerExistente) containerExistente.innerHTML = ""; // Limpa o DOM antigo
        }

        // 2. DETETAR MUDANÇA NA ESTRUTURA (IDs e Ordem)
        const assinaturaAtual = ativas.map(c => c.id).join('|') + (isModoPost ? '_post' : '_normal');

        // Se a estrutura é igual, apenas atualiza os textos
        if (document.getElementById(listContId) && assinaturaAtual === ultimaAssinaturaEstrutura) {
            AIController.sincronizarTextosLive(ativas);
            return;
        }

        // 3. RECONSTRUÇÃO DA LISTA (Apenas se a estrutura mudar)
        console.log("🎨 [AI-CONTROLLER] Reconstruindo lista por mudança de estrutura.");
        ultimaAssinaturaEstrutura = assinaturaAtual;

        display.innerHTML = `
            <div class="ai-container" id="ai-container-main">
                <p style="font-size:9px; color:#10b981; font-weight:900; text-transform:uppercase; text-align:center; margin-bottom:15px; letter-spacing:1px;">
                    Scanner BookAI Ativo ${isModoPost ? '(Modo Post)' : ''}
                </p>
                <div id="${listContId}" style="display:flex; flex-direction:column; gap:8px;"></div>
            </div>
        `;

        const listCont = document.getElementById(listContId);

        // Ordenação Dinâmica
        if (isModoPost) ativas.sort((a, b) => (b.ordem || 0) - (a.ordem || 0));
        else ativas.sort((a, b) => (a.ordem || 0) - (b.ordem || 0));

        ativas.forEach(c => {
            const config = IDENTIDADE_FERRAMENTAS[c.tipo] || IDENTIDADE_FERRAMENTAS.contentor;
            const card = document.createElement('div');
            card.className = "indice-card";
            card.id = `ai-nav-${c.id}`;
            card.style.borderLeft = `4px solid ${config.cor}`;

            card.innerHTML = `
                <div class="label-tipo" style="color:${config.cor}">${config.nome}</div>
                <div class="resumo-texto" id="ai-txt-${c.id}" style="font-size:12px; opacity:0.8; color:white;">...</div>
            `;

            card.onclick = () => {
                isManualScrolling = true;
                const el = document.getElementById(`bloco-${c.id}`);
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                AIController.atualizarDestaqueAI(c.id);
                setTimeout(() => { isManualScrolling = false; AIController.abrirProtocolos(c); }, 400);
            };

            listCont.appendChild(card);
        });

        // Primeiro preenchimento de texto
        AIController.sincronizarTextosLive(ativas);
        AIController.configurarScrollSpy();
    },

    /**
     * ATUALIZAÇÃO CIRÚRGICA DE TEXTO
     * Altera apenas o innerText dos cards sem apagar o DOM.
     */
    sincronizarTextosLive: (listaAtivas) => {
        listaAtivas.forEach(c => {
            const elTexto = document.getElementById(`ai-txt-${c.id}`);
            if (elTexto) {
                let resumo = "";
                if (c.tipo === "elevador") {
                    resumo = (c.pastapai && c.pastapai[0] && c.pastapai[0].nome) ? c.pastapai[0].nome : "Elevador de Links";
                } else {
                    // FALLBACK: Título ou Primeiros caracteres do conteúdo
                    resumo = c.titulo || (c.conteudo ? c.conteudo.substring(0, 60) : `Nova ${c.tipo}`);
                }
                
                // Só mexe no DOM se o texto for realmente diferente
                if (elTexto.innerText !== resumo) {
                    elTexto.innerText = resumo;
                }
            }
        });
    },

    /**
     * MOTOR DE SEGUIMENTO (SCROLL-SPY)
     */
    configurarScrollSpy: () => {
        const editor = document.querySelector('.center-col');
        if (!editor || window._aiScrollInited) return;

        editor.addEventListener('scroll', () => {
            if (isManualScrolling) return;

            const aiList = document.getElementById('ai-blocks-list');
            if (!aiList || aiList.offsetParent === null) return;

            const blocos = document.querySelectorAll('[id^="bloco-"]');
            let blocoMaisProximo = null;
            let menorDistancia = Infinity;

            blocos.forEach(bloco => {
                const rect = bloco.getBoundingClientRect();
                const distancia = Math.abs(rect.top - (window.innerHeight / 3));
                if (distancia < menorDistancia) {
                    menorDistancia = distancia;
                    blocoMaisProximo = bloco.id.replace('bloco-', '');
                }
            });

            if (blocoMaisProximo) {
                AIController.atualizarDestaqueAI(blocoMaisProximo);
            }
        });
        window._aiScrollInited = true;
    },

    atualizarDestaqueAI: (caixaId) => {
        const container = document.getElementById('ai-blocks-list');
        if (!container) return;
        container.querySelectorAll('.indice-card').forEach(c => c.classList.remove('active'));
        const activeCard = document.getElementById(`ai-nav-${caixaId}`);
        if (activeCard) {
            activeCard.classList.add('active');
            activeCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    },

    abrirProtocolos: (caixa) => {
        const display = document.getElementById('xsat-display-content');
        const config = IDENTIDADE_FERRAMENTAS[caixa.tipo] || IDENTIDADE_FERRAMENTAS.contentor;

        display.innerHTML = `
            <div class="ai-container">
                <button class="btn-voltar-ai" onclick="window.AIController.renderizarLista()">
                    <i class="fa-solid fa-arrow-left"></i> Voltar à Lista
                </button>

                <div class="ai-target-card" style="border-left: 4px solid ${config.cor}">
                    <span class="ai-target-label" style="color:${config.cor}">Alvo: ${config.nome}</span>
                    <p style="font-size:12.5px; color:white; opacity:0.9; line-height:1.4;">
                        ${caixa.conteudo.substring(0, 150)}${caixa.conteudo.length > 150 ? '...' : ''}
                    </p>
                </div>

                <div class="btn-protocolo-grid">
                    <button class="btn-protocolo" onclick="window.AIController.executar('${caixa.id}', 'melhorar')" style="border-color:#10b981;"><i class="fa-solid fa-wand-magic-sparkles" style="color:#10b981;"></i><span>Melhorar</span></button>
                    <button class="btn-protocolo" onclick="window.AIController.executar('${caixa.id}', 'investigar')" style="border-color:#6366f1;"><i class="fa-solid fa-microscope" style="color:#6366f1;"></i><span>Investigar</span></button>
                    <button class="btn-protocolo" onclick="window.AIController.executar('${caixa.id}', 'socratico')" style="border-color:#f59e0b;"><i class="fa-solid fa-lightbulb" style="color:#f59e0b;"></i><span>Desafiar</span></button>
                    <button class="btn-protocolo" onclick="window.AIController.executar('${caixa.id}', 'sintese')" style="border-color:#fbbf24;"><i class="fa-solid fa-atom" style="color:#fbbf24;"></i><span>Resumir</span></button>
                    <button class="btn-protocolo" onclick="window.AIController.executar('${caixa.id}', 'origens')" style="border-color:#a855f7;"><i class="fa-solid fa-language" style="color:#a855f7;"></i><span>Léxico</span></button>
                    <button class="btn-protocolo" onclick="window.AIController.executar('${caixa.id}', 'cosmos')" style="border-color:#db2777;"><i class="fa-solid fa-meteor" style="color:#db2777;"></i><span>Cosmos</span></button>
                </div>
            </div>
        `;
    },

    executar: async (caixaId, modo) => {
        const caixa = window.caixasAtuais.find(c => c.id === caixaId);
        const display = document.getElementById('xsat-display-content');
        const cores = { melhorar: '#10b981', investigar: '#6366f1', socratico: '#f59e0b', sintese: '#fbbf24', origens: '#a855f7', cosmos: '#db2777' };

      display.innerHTML = `
            <div style="text-align:center; padding:60px 20px; color:${cores[modo]};">
                <i class="fa-brands fa-mailchimp fa-bounce" style="font-size:40px; margin-bottom:20px;"></i>
                <p style="font-family:monospace; font-size:10px; font-weight:800; letter-spacing:2px;">BOOKAI A PROCESSAR SINAPSE...</p>
            </div>`;

        const resposta = await NexoEngine.perguntar(caixa.conteudo, modo);

        display.innerHTML = `
            <div class="ai-container">
                <button class="btn-voltar-ai" onclick="window.AIController.abrirProtocolos(...)">
                    <i class="fa-solid fa-arrow-left"></i> Voltar aos Protocolos
                </button>
                <div class="ai-target-card" style="border-left: 4px solid ${cores[modo]}">
                    <p style="font-size:10px; color:${cores[modo]}; font-weight:900; text-transform:uppercase; margin-bottom:12px;">
                        <i class="fa-brands fa-mailchimp"></i> BookAI: Resultado
                    </p>
                    <div style="font-size:13.5px; color:white; line-height:1.7; white-space:pre-wrap;">${resposta}</div>
                </div>
            </div>
        `;
    }
};

window.AIController = AIController;
