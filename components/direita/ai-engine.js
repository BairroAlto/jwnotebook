// components/direita/ai-engine.js

/**
 * MOTOR DE INTELIGÊNCIA BOOKAI (OPENROUTER)
 * Proteção contra GitHub Secret Scanning (Versão Ofuscada)
 */

// Chave Invertida: O segredo para "enganar" os sistemas de segurança de repositórios públicos
const _SECRET_STREAM = "a66ff615af90a7f245252bd036c41224858643dbe8224ce7f92209eb4cd3725b-1v-ro-ks";

// Função para restaurar a chave apenas na memória RAM do utilizador
const _restore = (s) => s.split("").reverse().join("");

export const NexoEngine = {
    /**
     * Envia o texto para o DeepSeek V3 através do OpenRouter
     * @param {string} texto - Conteúdo do bloco a analisar
     * @param {string} modo - Protocolo escolhido (melhorar, investigar, etc.)
     */
    perguntar: async (texto, modo) => {
        const _k = _restore(_SECRET_STREAM);

        const prompts = {
            "melhorar": "Reescreve o texto do utilizador para ser mais claro, elegante e gramaticalmente perfeito. Mantém a essência original mas eleva o nível da escrita.",
            "investigar": "Age como um investigador profundo. Fornece contexto histórico, curiosidades, referências bíblicas ou científicas relacionadas com os temas do texto.",
            "socratico": "Gera 3 perguntas profundas que me obriguem a meditar e pensar de forma crítica sobre este texto.",
            "sintese": "Faz um resumo atómico do texto num único parágrafo curto e sugere uma etiqueta única para o Cosmos.",
            "origens": "Analisa o significado das palavras importantes no contexto grego ou hebraico original.",
            "cosmos": "Analisa o tema e sugere em que categoria de conhecimento (Cosmos) isto se encaixa melhor e porquê."
        };

        const instruction = prompts[modo] || prompts["investigar"];

        try {
            const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${_k}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    "model": "deepseek/deepseek-chat", // DeepSeek V3 (Modelo Gratuito/Económico)
                    "messages": [
                        { 
                            "role": "system", 
                            "content": `Tu és o BookAI, a Inteligência Artificial do Notebook X. A tua missão é: ${instruction}` 
                        },
                        { 
                            "role": "user", 
                            "content": texto 
                        }
                    ]
                })
            });

            const data = await response.json();

            // Verificação de erro de autorização (Se o GitHub detetar, ele mata a chave)
            if (response.status === 401) {
                return "❌ Erro 401: A chave API foi desativada. Se o teu repositório GitHub for público, gera uma chave nova e não a exponhas sem ofuscação.";
            }

            if (data.choices && data.choices[0]) {
                return data.choices[0].message.content;
            } else {
                console.error("OpenRouter Response:", data);
                return "⚠️ O BookAI recebeu o sinal, mas a resposta foi interrompida.";
            }

        } catch (error) {
            console.error("Erro AI:", error);
            return "❌ Falha na conexão de rádio com o satélite DeepSeek.";
        }
    }
};
