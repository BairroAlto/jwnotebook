// components/direita/ai-controller.js
import { NexoEngine } from './ai-engine.js';
import { IDENTIDADE_FERRAMENTAS } from '../constants/ferramentas.js';

let isManualScrolling = false;
let ultimaAssinaturaEstrutura = "";
let notaIdCache = ""; 
let caixaEmAnalise = null; 

export const AIController = {
    /**
     * VISTA 1: LISTA DE BLOCOS (SCANNER)
     */
    renderizarLista: () => {
        const display = document.getElementById('xsat-display-content');
        if (!display) return;

        // 1. DEFINIÇÃO DO ID DO CONTENTOR (Corrigindo o erro de ReferenceError)
        const listContId = 'ai-blocks-list';

        // 2. VERIFICAÇÃO DE CANAL (Proteção contra sequestro de aba)
        const canalAtivo = document.querySelector('.xsat-num.active')?.dataset.num;
        if (canalAtivo !== "6") return; 

        // 3. RECOLHA DE DADOS DA NOTA ATUAL
        const caixas = window.caixasAtuais || [];
        const notaIdAtual = window.notaAbertaId;
        const modos = window.dadosNotaOriginal?.modo || [];
        const isModoPost = Array.isArray(modos) ? modos.includes('post') : (modos === 'post');
        const ativas = caixas.filter(c => c.estado === 'ativa');

        // 4. RESET DE CACHE AO MUDAR DE NOTA
        if (notaIdAtual !== notaIdCache) {
            notaIdCache = notaIdAtual;
            ultimaAssinaturaEstrutura = "";
            const contExistente = document.getElementById(listContId);
            if (contExistente) contExistente.innerHTML = "";
        }

        // 5. VERIFICAÇÃO DE ASSINATURA (ANTI-FLICKER)
        const assinaturaAtual = ativas.map(c => c.id).join('|') + (isModoPost ? '_post' : '_normal');
        
        if (document.getElementById(listContId) && assinaturaAtual === ultimaAssinaturaEstrutura) {
            AIController.sincronizarTextosLive(ativas);
            return;
        }

        ultimaAssinaturaEstrutura = assinaturaAtual;

        // 6. DESENHAR ESTRUTURA BASE
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
                <div class="resumo-texto" id="ai-txt-${c.id}" style="opacity:0.8; color:white;">...</div>
            `;

            card.onclick = () => {
                caixaEmAnalise = c; 
                AIController.abrirProtocolos();
            };

            listCont.appendChild(card);
        });

        AIController.sincronizarTextosLive(ativas);
        AIController.configurarScrollSpy();
    },

    /**
     * VISTA 2: MENU DE PROTOCOLOS
     */
    abrirProtocolos: () => {
        if (!caixaEmAnalise) return AIController.renderizarLista();
        
        const display = document.getElementById('xsat-display-content');
        const config = IDENTIDADE_FERRAMENTAS[caixaEmAnalise.tipo] || IDENTIDADE_FERRAMENTAS.contentor;

        display.innerHTML = `
            <div class="ai-container">
                <button class="btn-voltar-ai" onclick="window.AIController.renderizarLista()">
                    <i class="fa-solid fa-arrow-left"></i> Voltar à Lista
                </button>

                <div class="ai-target-card" style="border-left: 4px solid ${config.cor}">
                    <span class="ai-target-label" style="color:${config.cor}">Alvo: ${config.nome}</span>
                    <p style="font-size:12.5px; color:white; opacity:0.9; line-height:1.4;">
                        ${caixaEmAnalise.conteudo.substring(0, 150)}${caixaEmAnalise.conteudo.length > 150 ? '...' : ''}
                    </p>
                </div>

                <div class="btn-protocolo-grid">
                    <button class="btn-protocolo" onclick="window.AIController.executar('melhorar')" style="border-color:#10b981;"><i class="fa-solid fa-wand-magic-sparkles" style="color:#10b981;"></i><span>Melhorar</span></button>
                    <button class="btn-protocolo" onclick="window.AIController.executar('investigar')" style="border-color:#6366f1;"><i class="fa-solid fa-microscope" style="color:#6366f1;"></i><span>Investigar</span></button>
                    <button class="btn-protocolo" onclick="window.AIController.executar('teocratico')" style="border-color:#3b82f6;"><i class="fa-solid fa-book" style="color:#3b82f6;"></i><span>JW Search</span></button>
                    <button class="btn-protocolo" onclick="window.AIController.executar('socratico')" style="border-color:#f59e0b;"><i class="fa-solid fa-lightbulb" style="color:#f59e0b;"></i><span>Desafiar</span></button>
                    <button class="btn-protocolo" onclick="window.AIController.executar('ilustrar')" style="border-color:#22d3ee;"><i class="fa-solid fa-image" style="color:#22d3ee;"></i><span>Ilustrar</span></button>
                    <button class="btn-protocolo" onclick="window.AIController.executar('sintese')" style="border-color:#fbbf24;"><i class="fa-solid fa-atom" style="color:#fbbf24;"></i><span>Resumir</span></button>
                    <button class="btn-protocolo" onclick="window.AIController.executar('origens')" style="border-color:#a855f7;"><i class="fa-solid fa-language" style="color:#a855f7;"></i><span>Léxico</span></button>
                    <button class="btn-protocolo" onclick="window.AIController.executar('critico')" style="border-color:#f87171;"><i class="fa-solid fa-scale-balanced" style="color:#f87171;"></i><span>Analisar</span></button>
                    <button class="btn-protocolo" onclick="window.AIController.executar('pratico')" style="border-color:#22c55e;"><i class="fa-solid fa-shoe-prints" style="color:#22c55e;"></i><span>Aplicar</span></button>
                    <button class="btn-protocolo" onclick="window.AIController.executar('cosmos')" style="border-color:#db2777;"><i class="fa-solid fa-meteor" style="color:#db2777;"></i><span>Cosmos</span></button>
                </div>
            </div>
        `;
    },

    executar: async (modo) => {
        const display = document.getElementById('xsat-display-content');
        const cores = { melhorar: '#10b981', investigar: '#6366f1', teocratico: '#3b82f6', socratico: '#f59e0b', sintese: '#fbbf24', origens: '#a855f7', critico: '#f87171', pratico: '#22c55e', cosmos: '#db2777' };

        display.innerHTML = `
            <div style="text-align:center; padding:60px 20px; color:${cores[modo]};">
                <i class="fa-brands fa-mailchimp fa-bounce" style="font-size:40px; margin-bottom:20px;"></i>
                <p style="font-family:monospace; font-size:10px; font-weight:800; letter-spacing:2px;">BOOKAI A PROCESSAR SINAPSE...</p>
            </div>`;

        const respostaBruta = await NexoEngine.perguntar(caixaEmAnalise.conteudo, modo);
        const respostaFormatada = AIController.formatarResposta(respostaBruta);

        display.innerHTML = `
            <div class="ai-container">
                <button class="btn-voltar-ai" onclick="window.AIController.abrirProtocolos()">
                    <i class="fa-solid fa-arrow-left"></i> Voltar aos Protocolos
                </button>
                <div class="ai-target-card" style="border-left: 4px solid ${cores[modo]}">
                    <p class="ai-target-label" style="color:${cores[modo]};">
                        <i class="fa-solid fa-robot"></i> Resultado BookAI
                    </p>
                    <div style="color:#f1f5f9; white-space:pre-wrap;">${respostaFormatada}</div>
                </div>
            </div>
        `;
    },

    formatarResposta: (texto) => {
        return texto
            .replace(/^### (.*$)/gim, '<h4 style="color:#10b981; margin:15px 0 5px 0; font-weight:800; text-transform:uppercase; font-size:11px;">$1</h4>')
            .replace(/^## (.*$)/gim, '<h3 style="color:#10b981; margin:15px 0 5px 0; font-weight:800;">$1</h3>')
            .replace(/\*\*(.*?)\*\*/g, '<b style="color:#ffffff; font-weight:700;">$1</b>')
            .replace(/\*(.*?)\*/g, '<i style="opacity:0.9;">$1</i>')
            .replace(/^\s*[\-\*]\s+(.*)$/gim, '<div style="margin-left:10px; margin-bottom:5px; display:flex; gap:8px;"><span style="color:#10b981;">•</span><span>$1</span></div>');
    },

    sincronizarTextosLive: (lista) => {
        lista.forEach(c => {
            const el = document.getElementById(`ai-txt-${c.id}`);
            if (el) {
                let txt = "";
                if (c.tipo === "elevador") txt = (c.pastapai && c.pastapai[0] && c.pastapai[0].nome) ? c.pastapai[0].nome : "Elevador";
                else txt = c.titulo || (c.conteudo ? c.conteudo.substring(0, 60) : `Nova ${c.tipo}`);
                if (el.innerText !== txt) el.innerText = txt;
            }
        });
    },

    configurarScrollSpy: () => {
        const editor = document.querySelector('.center-col');
        if (!editor || window._aiScrollInited) return;
        editor.addEventListener('scroll', () => {
            if (isManualScrolling) return;
            const aiList = document.getElementById('ai-blocks-list');
            if (!aiList || aiList.offsetParent === null) return;
            const blocos = document.querySelectorAll('[id^="bloco-"]');
            let maisProx = null; let menorDist = Infinity;
            blocos.forEach(b => {
                const dist = Math.abs(b.getBoundingClientRect().top - (window.innerHeight / 3));
                if (dist < menorDist) { menorDist = dist; maisProx = b.id.replace('bloco-', ''); }
            });
            if (maisProx) AIController.atualizarDestaqueAI(maisProx);
        });
        window._aiScrollInited = true;
    },

    atualizarDestaqueAI: (id) => {
        const cont = document.getElementById('ai-blocks-list');
        if (!cont) return;
        cont.querySelectorAll('.indice-card').forEach(c => c.classList.remove('active'));
        const active = document.getElementById(`ai-nav-${id}`);
        if (active) {
            active.classList.add('active');
            active.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }
};

window.AIController = AIController;
