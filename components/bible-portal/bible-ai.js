// components/bible-portal/bible-ai.js
import { NexoEngine } from '../direita/ai-engine.js';
import { PROTOCOLOS } from '../direita/ai-view.js'; 

export const BibleAI = {
    chatHistory: [],

    /**
     * MOTOR DE CHAT CONTEXTUAL
     */
    enviarPergunta: async (pergunta) => {
        const capituloTexto = window.textoCapituloAtual;
        const referencia = window.referenciaAtiva;

        if (!pergunta || !capituloTexto) return;

        // 1. UI: Adicionar pergunta do utilizador
        BibleAI.adicionarBolha(pergunta, 'user');
        
        // 2. Preparar Contexto de Análise
        const contextPrompt = `ESTÁS A ANALISAR O CAPÍTULO: ${referencia}.
        TEXTO COMPLETO DO CAPÍTULO: "${capituloTexto}".
        
        REGRAS DE RESPOSTA:
        1. Baseia-te na sabedoria contida em jw.org e wol.jw.org.
        2. Se mencionares um versículo do texto acima, usa SEMPRE o formato [[V-NUM]] (ex: [[V-5]] ou [[V-12]]).
        3. Se o utilizador perguntar "onde diz que...", responde com o versículo e o código [[V-X]].
        4. Responde de forma natural em Português de Portugal.`;

        try {
            BibleAI.mostrarPensando(true);
            
            // Usamos o motor original do BookAI passando o nosso prompt de contexto
            const resposta = await NexoEngine.perguntar(pergunta, "normal", contextPrompt);
            
            BibleAI.mostrarPensando(false);

            // 3. UI: Adicionar resposta da IA
            BibleAI.adicionarBolha(resposta, 'ai');

            // 4. Inteligência de Navegação: Se a IA citou um versículo, fazemos scroll
            BibleAI.processarComandosDeNavegacao(resposta);

        } catch (e) {
            console.error("Erro AI Bible:", e);
            BibleAI.mostrarPensando(false);
            BibleAI.adicionarBolha("Lamento, tive um problema ao sintonizar o satélite.", 'ai');
        }
    },

    /**
     * PROTOCOLOS DE ESTUDO (Aba 2)
     */
    executarProtocolo: async (protocoloId) => {
        const capituloTexto = window.textoCapituloAtual;
        if (!capituloTexto) return;

        // Troca para a aba Chat para mostrar o progresso
        document.querySelector('.ai-tab[data-target="ai-chat-section"]').click();
        
        const infoProt = PROTOCOLOS.flatMap(c => c.itens).find(i => i.id === protocoloId);
        BibleAI.adicionarBolha(`A executar protocolo: ${infoProt.nome}...`, 'user');

        try {
            BibleAI.mostrarPensando(true);
            const resposta = await NexoEngine.perguntar(capituloTexto, protocoloId);
            BibleAI.mostrarPensando(false);
            BibleAI.adicionarBolha(resposta, 'ai');
        } catch (e) {
            BibleAI.mostrarPensando(false);
        }
    },

    /**
     * HELPERS DE INTERFACE
     */
    adicionarBolha: (texto, tipo) => {
        const container = document.getElementById('chat-messages-container');
        const div = document.createElement('div');
        div.className = `chat-bubble ${tipo}`;
        
        // Limpar os códigos [[V-X]] para o utilizador ler "v. X"
        div.innerText = texto.replace(/\[\[V-(\d+)\]\]/g, 'v. $1');
        
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
    },

    mostrarPensando: (status) => {
        const container = document.getElementById('chat-messages-container');
        if (status) {
            const loader = document.createElement('div');
            loader.id = 'ai-typing';
            loader.className = 'chat-bubble ai';
            loader.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> O BookAI está a analisar...';
            container.appendChild(loader);
            container.scrollTop = container.scrollHeight;
        } else {
            document.getElementById('ai-typing')?.remove();
        }
    },

    processarComandosDeNavegacao: (texto) => {
        const regex = /\[\[V-(\d+)\]\]/g;
        const matches = [...texto.matchAll(regex)];
        
        if (matches.length > 0) {
            // Pega no último versículo mencionado para fazer scroll
            const verNum = matches[matches.length - 1][1];
            
            // Chamamos o controller de UI para fazer o scroll bonito
            import('./bible-ui-controller.js').then(m => {
                m.BibleUI.scrollParaVersiculo(verNum);
            });
        }
    },

    renderizarProtocolos: () => {
        const grid = document.getElementById('ai-protocols-grid');
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

// Tornar disponível para os botões gerados dinamicamente
window.BibleAI = BibleAI;