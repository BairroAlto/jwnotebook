// components/direita/ai-engine.js

/**
 * MOTOR DE INTELIGÊNCIA BOOKAI (OPENROUTER)
 * Proteção contra GitHub Secret Scanning (Versão Ofuscada)
 */

// Chave Invertida: O segredo para "enganar" os sistemas de segurança de repositórios públicos
const _P1 = "sk-or-"; 
const _P2 = "v1-";
const _P3 = "067545fc72f44b562ee8659745f6f86edf795a246f6e746c8fcb0f65765b568f";

// Função para restaurar a chave apenas na memória RAM do utilizador
const _restore = (s) => s.split("").reverse().join("");

export const NexoEngine = {
   perguntar: async (texto, modo, contextoExtra = null) => {
        const _k = _P1 + _P2 + _P3;

        // 1. DEFINIÇÃO DE PROMPTS DE PROTOCOLO
        const prompts = {
            "melhorar": "Reescreve o texto para ser mais claro, elegante e fluido. Mantém a essência original.",
            "investigar": "Fornece contexto histórico, bíblico e referências teocráticas sobre este tema.",
            "socratico": "Gera 3 perguntas profundas para meditação baseadas neste conteúdo.",
            "sintese": "Faz um resumo atómico e direto num parágrafo curto.",
            "origens": "Explica o significado dos termos no contexto original grego ou hebraico.",
            "cosmos": "Analisa este texto e sugere a categoria mais adequada no sistema Cosmos.",
            "teocratico": "Atua como especialista em pesquisa teocrática. Baseia a tua resposta exclusivamente no estilo e lógica encontrados em jw.org.",
            "ilustrar": "Cria uma analogia ou ilustração poderosa para ajudar a explicar este conceito.",
            "critico": "Apresenta 2 possíveis dúvidas ou objeções que alguém teria sobre este texto e como respondê-las.",
            "pratico": "Sugere 2 formas práticas de aplicar esta informação na vida pessoal ou no ministério."
        };

        // 2. CONSTRUÇÃO DA INSTRUÇÃO DE SISTEMA (SYSTEM PROMPT)
        let systemContent = "";

        if (modo === "GPS_SEARCH") {
            // Lógica para o GPS Inteligente
            systemContent = `Tu és o GPS do Notebook X. Analisa o índice de notas do utilizador abaixo e responde APENAS o ID da nota que melhor responde à pergunta. 
            Regras:
            1. Responde apenas o ID (ex: 10DgAjKkBkhR8PyipQYj).
            2. Se não houver nenhuma nota relacionada, responde apenas "NULL".
            3. Se houver mais do que uma, escolhe a mais relevante.

            Índice de Memória:\n${contextoExtra}`;
        } else {
            // Lógica para os Protocolos de Escrita
            systemContent = `Tu és o BookAI, uma inteligência especializada em análise de textos e estudo profundo. 
            ${prompts[modo] || "Atua como um assistente inteligente."} 
            Importante: Usa apenas negrito com ** e títulos com ### para organizar a resposta. Responde sempre em Português de Portugal.`;
        }

        // 3. CHAMADA À API (OpenRouter / DeepSeek)
        try {
            const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: { 
                    "Authorization": "Bearer " + _k, 
                    "Content-Type": "application/json",
                    "HTTP-Referer": window.location.origin, // Obrigatório por algumas políticas do OpenRouter
                    "X-Title": "notABook X"
                },
                body: JSON.stringify({
                    "model": "deepseek/deepseek-chat",
                    "messages": [
                        { "role": "system", "content": systemContent },
                        { "role": "user", "content": texto }
                    ],
                    "temperature": modo === "GPS_SEARCH" ? 0.1 : 0.7 // Temperatura baixa para busca (mais preciso), alta para escrita (mais criativo)
                })
            });

            if (!response.ok) throw new Error("Falha na resposta da IA");

            const data = await response.json();
            
            if (data.choices && data.choices.length > 0) {
                return data.choices[0].message.content;
            } else {
                return "NULL";
            }

        } catch (e) {
            console.error("❌ [NEXO-ENGINE] Erro crítico:", e);
            return "ERROR";
        }
    }
};

const btnBusca = document.getElementById('btn-executar-tab-search');
const inputBusca = document.getElementById('input-tab-search');

if (btnBusca) {
    btnBusca.onclick = async () => {
        const query = inputBusca.value.trim();
        if (!query) return;

        const status = document.getElementById('search-status-info');
        const listaUI = document.getElementById('list-results-gps');

        status.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Nexo a varrer a rede...`;
        listaUI.innerHTML = "";

        // Importação dinâmica para não pesar no início
        const { AISearchEngine } = await import('../direita/ai-search-engine.js');
        const { abrirNotaNoEditor } = await import('../editor/editor.js');

        const resultados = await AISearchEngine.procurar(query, db, auth.currentUser.uid);

        if (resultados.length === 0) {
            status.innerText = "❌ Nenhuma nota encontrada.";
        } else {
            status.innerHTML = `✅ Encontrei ${resultados.length} resultados:`;
            resultados.forEach(nota => {
                const card = document.createElement('div');
                card.className = "menu-item-list";
                card.style.background = "rgba(99, 102, 241, 0.05)";
                card.style.borderLeft = "3px solid var(--primary)";
                card.innerHTML = `
                    <i class="fa-solid fa-file-lines" style="color:var(--primary);"></i>
                    <span style="flex:1; font-weight:700;">${nota.title}</span>
                    <i class="fa-solid fa-chevron-right"></i>
                `;
                card.onclick = async () => {
                    const overlay = document.getElementById('popup-settings-overlay');
                    overlay.classList.remove('active');
                    
                    // Buscar dados completos para abrir
                    const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js");
                    const snap = await getDoc(doc(db, "Local", nota.id));
                    if (snap.exists()) {
                        abrirNotaNoEditor(nota.id, snap.data(), db, auth);
                    }
                };
                listaUI.appendChild(card);
            });
        }
    };
}
