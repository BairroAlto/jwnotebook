// components/direita/ai-controller.js
import { NexoEngine } from './ai-engine.js';
import { IDENTIDADE_FERRAMENTAS } from '../constants/ferramentas.js';

let ultimaAssinaturaAI = "";
let notaIdCacheAI = ""; 
let caixaEmAnalise = null; 

export const AIController = {
    renderizarLista: (listaFiltrada = null) => {
        const display = document.getElementById('xsat-display-content');
        if (!display) return;

        const listContId = 'ai-blocks-list';
        const canalAtivo = document.querySelector('.xsat-num.active');
        if (!canalAtivo || canalAtivo.dataset.num !== "6") return; 

        // 1. OBTER DADOS DA NOTA (FONTE DA VERDADE)
        const notaIdAtual = window.notaAbertaId || "temp";
        const dadosNota = window.dadosNotaOriginal || { modo: ['normal'] };
        const caixasOrigem = window.caixasAtuais || [];

        // 🚀 RESET CRUCIAL: Se o ID da nota mudou, limpamos a assinatura para forçar redesenho
        if (notaIdAtual !== notaIdCacheAI) {
            console.log("📂 [IA] Nova nota detetada. Resetando sensores...");
            notaIdCacheAI = notaIdAtual;
            ultimaAssinaturaAI = ""; 
        }

        // 2. DETERMINAR MODO
        const modos = Array.isArray(dadosNota.modo) ? dadosNota.modo : [dadosNota.modo || 'normal'];
        const isSentinela = modos.includes('sentinela');

        // 3. FILTRAGEM
        let caixasParaExibir = listaFiltrada;
        if (!caixasParaExibir) {
            caixasParaExibir = caixasOrigem.filter(c => {
                if (c.estado !== 'on') return false;
                return isSentinela ? !!c.referenciacodex : !c.referenciacodex;
            });
        }

        // 4. NOVA ASSINATURA BLINDADA
        const assinaturaAtual = `${isSentinela ? 'S' : 'N'}|${caixasParaExibir.map(c => c.id).join(',')}`;
        
        const containerExiste = document.getElementById(listContId);
        if (containerExiste && assinaturaAtual === ultimaAssinaturaAI) {
            AIController.sincronizarTextosLive(caixasParaExibir);
            return;
        }

        ultimaAssinaturaAI = assinaturaAtual;

        // 4. DESENHAR UI
        display.innerHTML = `
            <div class="ai-container" id="ai-container-main">
                <p style="font-size:9px; color:#10b981; font-weight:900; text-transform:uppercase; text-align:center; margin-bottom:15px; letter-spacing:1px;">
                    <i class="fa-solid fa-robot"></i> Scanner BookAI Ativo
                </p>
                <div id="${listContId}" style="display:flex; flex-direction:column; gap:8px;"></div>
            </div>`;

        const listCont = document.getElementById(listContId);
        if (caixasParaExibir.length === 0) {
            listCont.innerHTML = `<p style="text-align:center; color:gray; padding:40px; font-size:11px; opacity:0.5;">Nenhum conteúdo visível neste modo.</p>`;
            return;
        }

        caixasParaExibir.forEach(c => {
            const config = IDENTIDADE_FERRAMENTAS[c.tipo] || IDENTIDADE_FERRAMENTAS.contentor;
            const card = document.createElement('div');
            card.className = "indice-card";
            card.id = `ai-nav-${c.id}`;
            card.style.borderLeft = `4px solid ${config.cor}`;
            card.innerHTML = `
                <div class="label-tipo" style="color:${config.cor}">${config.nome}</div>
                <div class="resumo-texto" id="ai-txt-${c.id}" style="opacity:0.8; color:white;">...</div>`;
            card.onclick = () => { caixaEmAnalise = c; AIController.abrirProtocolos(); };
            listCont.appendChild(card);
        });

        AIController.sincronizarTextosLive(caixasParaExibir);
    },

    /**
     * VISTA 2: PROTOCOLOS
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
                    <button class="btn-protocolo" onclick="window.AIController.executar('socratico')" style="border-color:#f59e0b;"><i class="fa-solid fa-lightbulb" style="color:#f59e0b;"></i><span>Desafiar</span></button>
                    <button class="btn-protocolo" onclick="window.AIController.executar('sintese')" style="border-color:#fbbf24;"><i class="fa-solid fa-atom" style="color:#fbbf24;"></i><span>Resumir</span></button>
                    <button class="btn-protocolo" onclick="window.AIController.executar('critico')" style="border-color:#f87171;"><i class="fa-solid fa-scale-balanced" style="color:#f87171;"></i><span>Analisar</span></button>
                </div>
            </div>
        `;
    },

    executar: async (modo) => {
        const display = document.getElementById('xsat-display-content');
        const cores = { melhorar: '#10b981', investigar: '#6366f1', socratico: '#f59e0b', sintese: '#fbbf24', critico: '#f87171' };

        display.innerHTML = `
            <div style="text-align:center; padding:60px 20px; color:${cores[modo]};">
                <i class="fa-brands fa-mailchimp fa-bounce" style="font-size:40px; margin-bottom:20px;"></i>
                <p style="font-family:monospace; font-size:10px; font-weight:800; letter-spacing:2px;">BOOKAI A PROCESSAR...</p>
            </div>`;

        const respostaBruta = await NexoEngine.perguntar(caixaEmAnalise.conteudo, modo);
        const respostaFormatada = AIController.formatarResposta(respostaBruta);

        display.innerHTML = `
            <div class="ai-container">
                <button class="btn-voltar-ai" onclick="window.AIController.abrirProtocolos()">
                    <i class="fa-solid fa-arrow-left"></i> Voltar
                </button>
                <div class="ai-target-card" style="border-left: 4px solid ${cores[modo]}">
                    <p class="ai-target-label" style="color:${cores[modo]};"><i class="fa-solid fa-robot"></i> Resultado</p>
                    <div style="color:#f1f5f9; white-space:pre-wrap; font-size:13px; line-height:1.6;">${respostaFormatada}</div>
                </div>
            </div>
        `;
    },

    formatarResposta: (texto) => {
        return texto
            .replace(/^### (.*$)/gim, '<h4 style="color:#10b981; margin:15px 0 5px 0; font-weight:800; text-transform:uppercase; font-size:11px;">$1</h4>')
            .replace(/\*\*(.*?)\*\*/g, '<b style="color:#ffffff; font-weight:700;">$1</b>')
            .replace(/^\s*[\-\*]\s+(.*)$/gim, '<div style="margin-left:10px; margin-bottom:5px; display:flex; gap:8px;"><span style="color:#10b981;">•</span><span>$1</span></div>');
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