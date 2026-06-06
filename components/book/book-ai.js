import { NexoEngine } from '../direita/ai-engine.js';
import { PROTOCOLOS } from '../direita/ai-view.js';
import { BookState } from './book-state.js';
import { getVisibleBookBoxes } from './book-renderer.js';
import { textoDaNota, escapeHtml } from './book-utils.js';
import { MobileBottomSheet } from '../ui/mobile-bottom-sheet.js';

export function iniciarBookAI() {
    renderProtocolos();
    document.getElementById('book-ai-send')?.addEventListener('click', enviarPergunta);
    document.getElementById('book-ai-input')?.addEventListener('keydown', event => {
        if (event.key === "Enter") enviarPergunta();
    });
    document.querySelectorAll('[data-book-ai-tab]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('[data-book-ai-tab]').forEach(item => item.classList.remove('active'));
            document.querySelectorAll('#book-popup-ai .ai-content-view').forEach(view => view.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(btn.dataset.bookAiTab === "chat" ? "book-ai-chat" : "book-ai-protocols")?.classList.add('active');
        });
    });
}

export function abrirBookAI() {
    if (window.innerWidth <= 768) {
        MobileBottomSheet.fechar();
    }
    document.getElementById('book-popup-ai')?.classList.add('active');
}

async function enviarPergunta() {
    const input = document.getElementById('book-ai-input');
    const pergunta = input?.value.trim();
    if (!pergunta) return;
    input.value = "";
    addBubble(pergunta, "user");
    await perguntarNexo(pergunta, "normal");
}

async function executarProtocolo(id) {
    document.querySelector('[data-book-ai-tab="chat"]')?.click();
    addBubble(`Executar protocolo: ${id}`, "user");
    await perguntarNexo(textoDaNota(BookState.dadosNota, getVisibleBookBoxes()), id);
}

async function perguntarNexo(pergunta, modo) {
    const contexto = textoDaNota(BookState.dadosNota, getVisibleBookBoxes());
    const prompt = `ESTAS A ANALISAR EXCLUSIVAMENTE A NOTA ATUAL.
TITULO: ${BookState.dadosNota?.nome || "Sem titulo"}
CONTEUDO DA NOTA:
${contexto}

REGRAS:
1. Responde apenas com base na nota acima.
2. Se a nota nao tiver a informacao necessaria, diz claramente que a nota nao contem essa informacao.
3. Responde em Portugues de Portugal.`;
    try {
        thinking(true);
        const resposta = await NexoEngine.perguntar(pergunta, modo, prompt);
        thinking(false);
        addBubble(resposta, "ai");
    } catch (error) {
        thinking(false);
        addBubble("Não consegui analisar esta nota agora.", "ai");
    }
}

function addBubble(texto, tipo) {
    const container = document.getElementById('book-chat-messages');
    if (!container) return;
    const div = document.createElement('div');
    div.className = `chat-bubble ${tipo}`;
    div.innerHTML = escapeHtml(texto).replace(/\n/g, "<br>");
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function thinking(status) {
    const container = document.getElementById('book-chat-messages');
    if (!container) return;
    if (status) {
        const div = document.createElement('div');
        div.id = "book-ai-thinking";
        div.className = "chat-bubble ai";
        div.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> A analisar a nota...';
        container.appendChild(div);
    } else {
        document.getElementById('book-ai-thinking')?.remove();
    }
}

function renderProtocolos() {
    const grid = document.getElementById('book-ai-protocols-grid');
    if (!grid) return;
    grid.innerHTML = PROTOCOLOS.map(cat => `
        <div class="book-protocol-cat" style="color:${cat.cor}">${cat.categoria}</div>
        ${cat.itens.map(item => `
            <button class="btn-protocolo" data-book-protocol="${item.id}" style="border-color:${item.cor}44;">
                <i class="fa-solid ${item.icon}" style="color:${item.cor};"></i>
                <span>${item.nome}</span>
            </button>
        `).join('')}
    `).join('');
    grid.querySelectorAll('[data-book-protocol]').forEach(btn => {
        btn.addEventListener('click', () => executarProtocolo(btn.dataset.bookProtocol));
    });
}
