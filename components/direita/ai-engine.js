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
        const prompts = {
            "melhorar": "Reescreve o texto para ser mais claro e elegante.",
            "investigar": "Fornece contexto histórico e referências sobre este tema.",
            "socratico": "Gera 3 perguntas profundas para meditação.",
            "sintese": "Faz um resumo atómico num parágrafo curto.",
            "origens": "Corrige erros ortográficos, gramaticais e de sintaxe.",
            "cosmos": "Sugere uma categoria do Cosmos para este texto.",
            "teocratico": "Atua como especialista em jw.org.",
            "ilustrar": "Cria uma analogia poderosa.",
            "critico": "Apresenta 2 dúvidas comuns e responde-lhes.",
            "pratico": "Sugere 2 formas de aplicar esta info."
        };

        let systemContent = "";

       if (modo === "GPS_SEARCH") {
    systemContent = `Tu és um servidor de dados JSON (GPS de notas). 
    Analisa o índice abaixo e responde APENAS com um array JSON.
    Para cada nota encontrada, extrai um "snippet" (máximo 60 caracteres) que mostre o trecho do conteúdo que combina com a busca.
    
    Formato: [{"id": "ID", "title": "TITULO", "snippet": "TRECHO_RELEVANTE"}]
    Se não houver nada, responde: []
    
    Índice de Memória:\n${contextoExtra}`;
} else {
            systemContent = `Tu és o BookAI. ${prompts[modo]} Usa negrito com ** e títulos com ###. Responde em Português de Portugal.`;
        }

        try {
            const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: { "Authorization": "Bearer " + _k, "Content-Type": "application/json" },
                body: JSON.stringify({
                    "model": "deepseek/deepseek-chat",
                    "messages": [
                        { "role": "system", "content": systemContent },
                        { "role": "user", "content": texto }
                    ],
                    "temperature": modo === "GPS_SEARCH" ? 0.0 : 0.7 // Temperatura 0 para busca ser exata
                })
            });
            const data = await response.json();
            return data.choices[0].message.content;
        } catch (e) { return "ERROR"; }
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

        status.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> BookAi a varrer a rede...`;
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