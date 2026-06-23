import { NexoEngine } from '../direita/ai-engine.js';
import { PROTOCOLOS } from '../direita/ai-view.js';
import { BookState } from './book-state.js';
import { getVisibleBookBoxes } from './book-renderer.js';
import { textoDaNota, escapeHtml } from './book-utils.js';
import { MobileBottomSheet } from '../ui/mobile-bottom-sheet.js';

const history = [];
let thinkingActive = false;

export function resetBookAIConversation() {
    history.length = 0;
    thinkingActive = false;
    renderMessages();
}

export function iniciarBookAI() {
    renderProtocolos();
    bindChatInput('book-ai-send', 'book-ai-input');
    bindChatInput('book-ai-send-floating', 'book-ai-input-floating');

    document.querySelectorAll('[data-book-ai-tab]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('[data-book-ai-tab]').forEach(item => item.classList.remove('active'));
            document.querySelectorAll('#book-popup-ai .ai-content-view').forEach(view => view.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(btn.dataset.bookAiTab === 'chat' ? 'book-ai-chat' : 'book-ai-protocols')?.classList.add('active');
        });
    });

    document.getElementById('btn-bookai-float')?.addEventListener('click', toggleBookAIFloatingChat);
    document.getElementById('bookai-floating-close')?.addEventListener('click', () => {
        document.getElementById('bookai-floating-chat')?.classList.add('hidden');
    });

    atualizarBookAIFloatingUI();
    renderMessages();
}

function bindChatInput(buttonId, inputId) {
    document.getElementById(buttonId)?.addEventListener('click', () => enviarPergunta(inputId));
    document.getElementById(inputId)?.addEventListener('keydown', event => {
        if (event.key === 'Enter') enviarPergunta(inputId);
    });
}

export function abrirBookAI() {
    if (BookState.settings.aiFloating) {
        toggleBookAIFloatingChat(true);
        return;
    }
    if (window.innerWidth <= 768) {
        MobileBottomSheet.fechar();
    }
    document.getElementById('book-popup-ai')?.classList.add('active');
}

export function atualizarBookAIFloatingUI() {
    const notaAberta = Boolean(BookState.dadosNota);
    const aiToolbar = document.getElementById('book-ai');
    const zone = document.getElementById('bookai-floating-zone');
    const chat = document.getElementById('bookai-floating-chat');
    const floating = Boolean(BookState.settings.aiFloating && notaAberta);

    if (aiToolbar) aiToolbar.style.display = floating ? 'none' : 'inline-flex';
    if (zone) {
        zone.classList.toggle('hidden', !floating);
        zone.style.display = floating ? 'flex' : 'none';
    }
    if (!floating) {
        chat?.classList.add('hidden');
    }
}

function toggleBookAIFloatingChat(forceOpen = false) {
    const chat = document.getElementById('bookai-floating-chat');
    if (!chat || !BookState.settings.aiFloating) return;
    const shouldOpen = forceOpen ? true : chat.classList.contains('hidden');
    chat.classList.toggle('hidden', !shouldOpen);
    if (shouldOpen) {
        renderMessages();
        document.getElementById('book-ai-input-floating')?.focus();
    }
}

async function enviarPergunta(inputId) {
    const input = document.getElementById(inputId);
    const pergunta = input?.value.trim();
    if (!pergunta) return;
    input.value = '';
    addBubble(pergunta, 'user');
    await perguntarNexo(pergunta, 'normal');
}

async function executarProtocolo(id) {
    document.querySelector('[data-book-ai-tab="chat"]')?.click();
    addBubble(`Executar protocolo: ${id}`, 'user');
    await perguntarNexo(textoDaNota(BookState.dadosNota, getVisibleBookBoxes()), id);
}

async function perguntarNexo(pergunta, modo) {
    const contexto = textoDaNota(BookState.dadosNota, getVisibleBookBoxes());
    const prompt = `ESTAS A ANALISAR EXCLUSIVAMENTE A NOTA ATUAL.
TITULO: ${BookState.dadosNota?.nome || 'Sem titulo'}
CONTEUDO DA NOTA:
${contexto}

REGRAS:
1. Responde apenas com base na nota acima.
2. Se a nota nao tiver a informacao necessaria, diz claramente que a nota nao contem essa informacao.
3. Responde em Portugues de Portugal.`;
    try {
        setThinking(true);
        const resposta = await NexoEngine.perguntar(pergunta, modo, prompt);
        setThinking(false);
        addBubble(resposta, 'ai');
    } catch (_) {
        setThinking(false);
        addBubble('Nao consegui analisar esta nota agora.', 'ai');
    }
}

function addBubble(texto, tipo) {
    history.push({ texto, tipo });
    renderMessages();
}

function setThinking(status) {
    thinkingActive = status;
    renderMessages();
}

function renderMessages() {
    renderMessagesIn('book-chat-messages');
    renderMessagesIn('book-chat-messages-floating');
}

function renderMessagesIn(id) {
    const container = document.getElementById(id);
    if (!container) return;
    container.innerHTML = history.map(item => `
        <div class="chat-bubble ${item.tipo}">${escapeHtml(item.texto).replace(/\n/g, '<br>')}</div>
    `).join('') + (thinkingActive ? '<div class="chat-bubble ai"><i class="fa-solid fa-circle-notch fa-spin"></i> A analisar a nota...</div>' : '');
    container.scrollTop = container.scrollHeight;
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
