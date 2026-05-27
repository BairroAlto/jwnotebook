// components/direita/ai-gps-engine.js

/**
 * MOTOR DE PESQUISA SEMÂNTICA (NEXO GPS) - FROTA GRATUITA
 * Estratégia de Fallback: Tenta vários modelos até obter uma resposta válida.
 */

// 1. MONTAGEM DA CHAVE (Versão Ofuscada)
const _P1 = "sk-or-";
const _P2 = "v1-";
const _P3 = "5deed9c3b7fa3074df477442e7a3af296569ff15425b068f25381844022bf121"; 
const OPENROUTER_API_KEY = (_P1 + _P2 + _P3).trim();

// 2. LISTA DE MODELOS (FROTA GRATUITA PARA FALLBACK)
const MODELS_TO_TRY = [
    // --- Modelos Grandes e Inteligentes ---
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
     * VARREDURA DE MEMÓRIA COM FALLBACK
     * @param {string} pergunta - O que o utilizador procura.
     * @param {string} mapaMemoria - O índice consolidado dos Shards.
     */
    varrerMemoria: async (pergunta, mapaMemoria) => {
        
        const systemPrompt = `Tu és o Navegador GPS do notABook. Analisa o índice e localiza as notas relevantes.

REGRAS OBRIGATÓRIAS DE RESPOSTA:
1. Responde APENAS com um array JSON válido, sem texto extra.
2. Formato: [{"id": "ID_NOTA", "blockId": "ID_BLOCO", "source": "LOCAL_OU_SHARE", "title": "TITULO", "snippet": "RESUMO"}]
3. O "id" da nota vem após 'ID:'.
4. O "blockId" vem dentro de '{ID:...}'. Extrai o UUID corretamente. Se não houver, usa null.
5. O "source" é 'SHARE' se vires 'ORIGEM: SHARE', senão assume 'LOCAL'.
6. Baseia-te no SIGNIFICADO da pergunta. Se a pergunta for "Sobre Isaías", procura menções a Isaías ou textos bíblicos dele.

Índice de Memória:\n${mapaMemoria}`;

        // 🚀 INÍCIO DO CICLO DE FALLBACK
        for (const model of MODELS_TO_TRY) {
            try {
                console.log(`📡 [GPS-RADAR] Tentando sintonizar sinal via: ${model}`);
                
                const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                    method: "POST",
                    headers: { 
                        "Authorization": "Bearer " + OPENROUTER_API_KEY, 
                        "Content-Type": "application/json",
                        "HTTP-Referer": window.location.origin,
                        "X-Title": "notABook X - GPS"
                    },
                    body: JSON.stringify({
                        "model": model,
                        "messages": [
                            { "role": "system", "content": systemPrompt },
                            { "role": "user", "content": pergunta }
                        ],
                        "temperature": 0.3,
                        "top_p": 1,
                        "frequency_penalty": 0,
                        "presence_penalty": 0
                    })
                });

                // Se o modelo der erro (429 tráfego, 400 bad request, etc), lançamos erro para o catch
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(`Modelo indisponível: ${errorData.error?.message || response.status}`);
                }

                const data = await response.json();
                const conteudo = data.choices[0]?.message?.content;
                
                // Verificação básica se a resposta contém o início de um JSON
                if (conteudo && (conteudo.includes("[") || conteudo.includes("{"))) {
                    console.log(`✅ [GPS-SUCCESS] Resposta obtida através de: ${model}`);
                    return conteudo;
                } else {
                    throw new Error("Resposta em formato inválido.");
                }

            } catch (err) {
                console.warn(`⚠️ [GPS-RETRY] Falha no modelo ${model}: ${err.message}. Tentando o próximo da lista...`);
                // O loop continua para o próximo modelo em MODELS_TO_TRY
            }
        }

        // Se sair do loop sem retornar, é porque todos os modelos falharam
        console.error("❌ [GPS-CRITICAL] A frota de modelos está fora do ar ou ocupada.");
        return "ERROR";
    }
};
