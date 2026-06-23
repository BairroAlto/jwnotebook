import { NexoEngine } from '../direita/ai-engine.js';
import { PROTOCOLOS } from '../direita/ai-view.js';

export const BibleAI = {
    chatHistory: [],
    mode: 'net',
    thinking: false,

    setMode: mode => {
        BibleAI.mode = mode === 'local' ? 'local' : 'net';
        document.querySelectorAll('.bookai-mode-pill[data-ai-mode]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.aiMode === BibleAI.mode);
        });
    },

    enviarPergunta: async pergunta => {
        const capituloTexto = window.textoCapituloAtual;
        const referencia = window.referenciaAtiva;

        if (!pergunta || !capituloTexto) return;

        BibleAI.adicionarBolha(pergunta, 'user');

        const fonteRegra = BibleAI.mode === 'local'
            ? 'Responde apenas com base no texto completo do capitulo fornecido. Se a informacao nao estiver no capitulo, diz isso claramente.'
            : 'Responde com base no texto do capitulo e em informacao da internet, dando prioridade a jw.org e wol.jw.org.';

        const contextPrompt = `ESTAS A ANALISAR O CAPITULO: ${referencia}.
TEXTO COMPLETO DO CAPITULO: "${capituloTexto}".

REGRAS DE RESPOSTA:
1. ${fonteRegra}
2. Se mencionares um versiculo do texto acima, usa SEMPRE o formato [[V-NUM]] (ex: [[V-5]] ou [[V-12]]).
3. Se o utilizador perguntar "onde diz que...", responde com o versiculo e o codigo [[V-X]].
4. Responde de forma natural em Portugues de Portugal.`;

        try {
            BibleAI.mostrarPensando(true);
            const resposta = await NexoEngine.perguntar(pergunta, 'normal', contextPrompt);
            BibleAI.mostrarPensando(false);
            BibleAI.adicionarBolha(resposta, 'ai');
            BibleAI.processarComandosDeNavegacao(resposta);
        } catch (e) {
            console.error('Erro AI Bible:', e);
            BibleAI.mostrarPensando(false);
            BibleAI.adicionarBolha('Lamento, tive um problema ao sintonizar o BookAI.', 'ai');
        }
    },

    executarProtocolo: async protocoloId => {
        const capituloTexto = window.textoCapituloAtual;
        const referencia = window.referenciaAtiva;
        if (!capituloTexto) return;

        document.querySelector('.ai-tab[data-target="ai-chat-section"]')?.click();

        const infoProt = PROTOCOLOS.flatMap(c => c.itens).find(i => i.id === protocoloId);
        BibleAI.adicionarBolha(`A executar protocolo: ${infoProt?.nome || protocoloId}...`, 'user');

        try {
            BibleAI.mostrarPensando(true);
            const contextPrompt = `ESTAS A ANALISAR O CAPITULO SELECIONADO: ${referencia}.
TEXTO COMPLETO DO CAPITULO:
${capituloTexto}

REGRAS:
1. Baseia a resposta neste capitulo selecionado.
2. Se mencionares um versiculo do texto acima, usa o formato [[V-NUM]].
3. Responde em Portugues de Portugal.`;
            const resposta = await NexoEngine.perguntar(capituloTexto, protocoloId, contextPrompt);
            BibleAI.mostrarPensando(false);
            BibleAI.adicionarBolha(resposta, 'ai');
            BibleAI.processarComandosDeNavegacao(resposta);
        } catch (e) {
            BibleAI.mostrarPensando(false);
            BibleAI.adicionarBolha('Nao consegui executar esse protocolo agora.', 'ai');
        }
    },

    adicionarBolha: (texto, tipo) => {
        BibleAI.chatHistory.push({ texto, tipo });
        BibleAI.renderizarMensagens();
    },

    mostrarPensando: status => {
        BibleAI.thinking = Boolean(status);
        BibleAI.renderizarMensagens();
    },

    renderizarMensagens: () => {
        ['chat-messages-container', 'chat-messages-container-floating'].forEach(id => {
            const container = document.getElementById(id);
            if (!container) return;
            container.innerHTML = BibleAI.chatHistory.map(item => `
                <div class="chat-bubble ${item.tipo}">${escapeHtml(String(item.texto).replace(/\[\[V-(\d+)\]\]/g, 'v. $1')).replace(/\n/g, '<br>')}</div>
            `).join('') + (BibleAI.thinking ? '<div class="chat-bubble ai"><i class="fa-solid fa-circle-notch fa-spin"></i> O BookAI esta a analisar...</div>' : '');
            container.scrollTop = container.scrollHeight;
        });
    },

    toggleFloatingChat: forceOpen => {
        const panel = document.getElementById('bookai-floating-chat');
        if (!panel) return;
        const shouldOpen = typeof forceOpen === 'boolean' ? forceOpen : panel.classList.contains('hidden');
        panel.classList.toggle('hidden', !shouldOpen);
        if (shouldOpen) {
            BibleAI.renderizarMensagens();
            document.getElementById('input-chat-bible-floating')?.focus();
        }
    },

    processarComandosDeNavegacao: texto => {
        const matches = [...String(texto).matchAll(/\[\[V-(\d+)\]\]/g)];
        if (!matches.length) return;

        const verNum = matches[matches.length - 1][1];
        import('./bible-ui-controller.js').then(m => {
            m.BibleUI.scrollParaVersiculo(verNum);
        });
    },

    renderizarProtocolos: () => {
        const grid = document.getElementById('ai-protocols-grid');
        if (!grid) return;

        grid.innerHTML = PROTOCOLOS.map(cat => `
            <div style="grid-column: 1/-1; font-size: 9px; color: ${cat.cor}; font-weight: 800; margin-top: 10px; text-transform: uppercase;">${cat.categoria}</div>
            ${cat.itens.map(it => `
                <button class="btn-protocolo" onclick="window.BibleAI.executarProtocolo('${it.id}')" style="border-color: ${it.cor}44;">
                    <i class="fa-solid ${it.icon}" style="color: ${it.cor};"></i>
                    <span>${it.nome}</span>
                </button>
            `).join('')}
        `).join('');
    }
};

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

window.BibleAI = BibleAI;
