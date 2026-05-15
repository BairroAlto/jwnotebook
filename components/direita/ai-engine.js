// components/direita/ai-engine.js

// COLA AQUI A TUA CHAVE DO OPENROUTER (sk-or-v1-...)
const OPENROUTER_KEY = "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"; 

export const NexoEngine = {
    perguntar: async (texto, modo) => {
        const prompts = {
            "melhorar": "Reescreve este texto para ser mais claro, profissional e elegante. Mantém a essência.",
            "investigar": "Age como um investigador. Dá contexto histórico e referências bíblicas sobre este texto.",
            "socratico": "Gera 3 perguntas desafiantes para meditação baseadas neste texto.",
            "sintese": "Faz um resumo atómico deste texto e sugere uma palavra-chave.",
            "origens": "Analisa as palavras deste texto no contexto original grego ou hebraico.",
            "cosmos": "Diz-me em que categoria do Cosmos este pensamento melhor se encaixa."
        };

        try {
            const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${OPENROUTER_KEY}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    "model": "deepseek/deepseek-chat",
                    "messages": [
    { 
        "role": "system", 
        "content": `Tu és o BookAI, a Inteligência Artificial do Notebook X. ${prompts[modo]}` 
    },
    { "role": "user", "content": texto }
]
                })
            });
            const data = await response.json();
            return data.choices[0].message.content;
        } catch (e) {
            return "❌ Erro: O sinal de rádio falhou.";
        }
    }
};
