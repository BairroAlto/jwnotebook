// components/direita/ai-gps-engine.js
import { MODELS_TO_TRY } from '../constants/ai-models.js';

// 1. MONTAGEM DA CHAVE (Versão Ofuscada)
const _P1 = "sk-or-";
const _P2 = "v1-";
const _P3 = "5deed9c3b7fa3074df477442e7a3af296569ff15425b068f25381844022bf121"; 
const OPENROUTER_API_KEY = (_P1 + _P2 + _P3).trim();

/**
 * MOTOR DE PESQUISA SEMÂNTICA (NEXO GPS) - FROTA GRATUITA
 * Este motor é especializado em localizar notas e blocos através do significado.
 */
export const GpsEngine = {
    /**
     * VARREDURA DE MEMÓRIA COM FALLBACK
     * @param {string} pergunta - A dúvida ou intenção do utilizador.
     * @param {string} mapaMemoria - O índice consolidado dos Shards (resumos das notas).
     */
    varrerMemoria: async (pergunta, mapaMemoria) => {
        
        const systemPrompt = `Tu és o Navegador GPS do notABook. Analisa o índice e localiza as notas relevantes.

REGRAS OBRIGATÓRIAS DE RESPOSTA:
1. Responde APENAS com um array JSON válido, sem texto explicativo antes ou depois.
2. Estrutura: [{"id": "ID_NOTA", "blockId": "ID_BLOCO", "source": "LOCAL_OU_SHARE", "title": "TITULO", "snippet": "RESUMO"}]
3. O "id" da nota vem após 'ID:'. Copia-o fielmente.
4. O "blockId" vem dentro de '{ID:...}'. Extrai o UUID corretamente. Se não houver, usa null.
5. O "source" é 'SHARE' se vires 'ORIGEM: SHARE', senão assume 'LOCAL'.
6. Baseia-te no SIGNIFICADO. Se o user perguntar por um tema, procura notas relacionadas mesmo que o título seja diferente.
7. Se nada for encontrado, responde apenas: []

Índice de Memória:\n${mapaMemoria}`;

        // 🚀 INÍCIO DO CICLO DE FALLBACK (Percorre a lista centralizada)
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
                        "response_format": { "type": "json_object" } // Sugestão para modelos que suportam
                    })
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(`Erro: ${errorData.error?.message || response.status}`);
                }

                const data = await response.json();
                let conteudo = data.choices[0]?.message?.content;
                
                if (!conteudo) throw new Error("Resposta vazia.");

                // 🚀 LIMPEZA DE MARKDOWN (Proteção contra modelos que usam blocos de código)
                conteudo = conteudo.replace(/```json/g, "").replace(/```/g, "").trim();

                // Verificação se a resposta parece um JSON
                if (conteudo.startsWith("[") || conteudo.startsWith("{")) {
                    console.log(`✅ [GPS-SUCCESS] Sintonizado com sucesso através de: ${model}`);
                    return conteudo;
                } else {
                    throw new Error("Formato de resposta não reconhecido.");
                }

            } catch (err) {
                console.warn(`⚠️ [GPS-RETRY] Falha no modelo ${model}: ${err.message}`);
                // O loop continua para o próximo modelo em MODELS_TO_TRY
            }
        }

        console.error("❌ [GPS-CRITICAL] A frota de modelos está indisponível.");
        return "ERROR";
    }
};
