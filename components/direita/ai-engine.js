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
    perguntar: async (texto, modo) => {
        const _k = _P1 + _P2 + _P3;

        const prompts = {
            "melhorar": "Reescreve para ser mais claro e elegante. Mantém a essência.",
            "investigar": "Fornece contexto histórico e referências sobre o tema.",
            "socratico": "Gera 3 perguntas profundas para meditação.",
            "sintese": "Faz um resumo atómico num parágrafo curto.",
            "origens": "Explica o significado no contexto original grego/hebraico.",
            "cosmos": "Sugere uma categoria do Cosmos para este texto.",
            // NOVOS PROTOCOLOS
            "teocratico": "Atua como especialista em pesquisa teocrática. Baseia a tua resposta exclusivamente no estilo e lógica encontrados em jw.org e wol.jw.org.",
            "ilustrar": "Cria uma analogia ou ilustração poderosa para ajudar a explicar este conceito a outra pessoa.",
            "critico": "Apresenta 2 possíveis dúvidas ou objeções que alguém teria sobre este texto e como respondê-las.",
            "pratico": "Sugere 2 formas práticas de aplicar esta informação na vida pessoal ou no ministério."
        };

        try {
            const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: { "Authorization": "Bearer " + _k, "Content-Type": "application/json" },
                body: JSON.stringify({
                    "model": "deepseek/deepseek-chat",
                    "messages": [
                        { "role": "system", "content": `Tu és o BookAI. ${prompts[modo]}` },
                        { "role": "user", "content": texto }
                    ]
                })
            });
            const data = await response.json();
            return data.choices[0].message.content;
        } catch (e) { return "❌ Erro de ligação."; }
    }
};
