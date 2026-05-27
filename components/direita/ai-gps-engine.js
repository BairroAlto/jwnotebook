// components/direita/ai-gps-engine.js

// 1. MONTAGEM DA CHAVE (Versão Ofuscada)
const _P1 = "sk-or-";
const _P2 = "v1-";
const _P3 = "5deed9c3b7fa3074df477442e7a3af296569ff15425b068f25381844022bf121"; 
const K_GPS = (_P1 + _P2 + _P3).trim();

// 2. LISTA DE MODELOS GRATUITOS PARA FALLBACK
const MODELS_TO_TRY = [
        // --- TOP DE LINHA (Modelos Grandes) ---
    "meta-llama/llama-3.3-70b-instruct:free",
    "nousresearch/hermes-3-405b:free",
    "openai/gpt-oss-120b:free",
    "qwen/qwen3-next-80b-a3b-instruct:free",
    
    // --- MODELOS NOVOS / EXPERIMENTAIS DA TUA LISTA ---
    "poolside/laguna-m1:free",
    "poolside/laguna-xs2:free",
    "deepseek/deepseek-v4-flash:free",
    "z-ai/glm-4.5-air:free",
    "baidu/cobuddy:free",
    "google/gemma-4-31b:free",
    "google/gemma-4-26b-a4b:free",
    "minimax/minimax-m2.5:free",
    "qwen/qwen3-coder-480b-a35b:free",

    // --- MODELOS NVIDIA / NEMOTRON ---
    "nvidia/nemotron-3-nano-omni:free",
    "nvidia/nemotron-3-nano-30b-a3b:free",
    "nvidia/nemotron-nano-12b-2-vl:free",
    "nvidia/nemotron-nano-9b-v2:free",

    // --- MODELOS RÁPIDOS E LEVES ---
    "google/gemini-2.0-flash-lite-preview-02-05:free",
    "meta-llama/llama-3.2-3b-instruct:free",
    "liquid/lfm2.5-1.2b-thinking:free",
    "liquid/lfm2.5-1.2b-instruct:free",
    "venice/uncensored:free",
    "openai/gpt-oss-20b:free"
];

export const GpsEngine = {
    /**
     * Tenta localizar as notas usando modelos gratuitos com sistema de retentativa
     */
    varrerMemoria: async (pergunta, mapaMemoria) => {
        const systemPrompt = `... responde APENAS com um array JSON de objetos: 
{"id": "ID_DA_NOTA", "blockId": "ID_DO_BLOCO", "title": "TITULO", "snippet": "TRECHO"}.

REGRAS:
        1. Baseia-te no SIGNIFICADO da pergunta, não apenas em palavras iguais.
        2. O snippet deve ter no máximo 80 caracteres.
        3. Se não houver nada relevante, responde []. 
        4. Responde apenas o JSON bruto, sem explicações.
        
        Índice de Memória:\n${mapaMemoria}`;

        // 🚀 LOOP DE FALLBACK
        for (const model of MODELS_TO_TRY) {
            try {
                console.log(`📡 [GPS-RADAR] Tentando sintonizar via: ${model}`);
                
                const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                    method: "POST",
                    headers: { 
                        "Authorization": "Bearer " + K_GPS, 
                        "Content-Type": "application/json",
                        "HTTP-Referer": window.location.origin, // Requisito OpenRouter
                        "X-Title": "notABook X"
                    },
                    body: JSON.stringify({
                        "model": model,
                        "messages": [
                            { "role": "system", "content": systemPrompt },
                            { "role": "user", "content": pergunta }
                        ],
                        "temperature": 0.3 // Baixa temperatura para resultados mais exatos
                    })
                });

                if (!response.ok) throw new Error(`Status: ${response.status}`);

                const data = await response.json();
                const conteudo = data.choices[0].message.content;
                
                if (conteudo && conteudo.includes("[")) {
                    console.log(`✅ [GPS-SUCCESS] Resposta obtida através de: ${model}`);
                    return conteudo;
                }

            } catch (err) {
                console.warn(`⚠️ [GPS-RETRY] Modelo ${model} falhou. Saltando para o próximo...`);
                continue; // Tenta o próximo modelo da lista
            }
        }

        console.error("❌ [GPS-CRITICAL] Todos os modelos da frota falharam ou excederam o limite.");
        return "ERROR";
    }
};
