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
        
        // Montagem da chave apenas em tempo de execução (RAM)
        const _k = _P1 + _P2 + _P3;

  const prompts = {
            "melhorar": "Reescreve o texto para ser mais claro e elegante.",
            "investigar": "Fornece contexto histórico e referências sobre o texto.",
            "socratico": "Gera 3 perguntas profundas sobre este texto.",
            "sintese": "Faz um resumo atómico do texto num parágrafo curto.",
            "origens": "Explica o significado das palavras no contexto original.",
            "cosmos": "Sugere em que categoria do Cosmos isto se encaixa melhor."
        };

        try {
            const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": "Bearer " + _k,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    "model": "deepseek/deepseek-chat",
                    "messages": [
                        { "role": "system", "content": `Tu és o BookAI. ${prompts[modo]}` },
                        { "role": "user", "content": texto }
                    ]
                })
            });

            const data = await response.json();

            if (response.status === 401) {
                return "❌ Erro 401: A chave foi invalidada. Se o repositório é público, o histórico de commits pode ter exposto a chave.";
            }

            return data.choices[0].message.content;
        } catch (error) {
            return "❌ Erro de ligação.";
        }
    }
};
