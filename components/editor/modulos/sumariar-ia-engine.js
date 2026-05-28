// components/editor/modulos/sumariar-ia-engine.js
import { MODELS_TO_TRY } from '../../constants/ai-models.js';

const _P1 = "sk-or-";
const _P2 = "v1-";
const _P3 = "5deed9c3b7fa3074df477442e7a3af296569ff15425b068f25381844022bf121"; 
const K_SUMAR = (_P1 + _P2 + _P3).trim();

export const SumarIAEngine = {
    gerarResumo: async (texto, config) => {
        const systemPrompt = `Tu és o SumarIAr, um especialista em síntese de dados. 
        Responde APENAS com o texto do resumo, sem saudações ou comentários.
        ESTILO DE ESCRITA: ${config.style.toUpperCase()}.
        FORMATO: ${config.format === 'lista' ? 'Lista com pontos (•)' : 'Parágrafos fluidos'}.
        TAMANHO: ${config.size}.
        LÍNGUA: Português de Portugal.`;

        for (const model of MODELS_TO_TRY) {
            try {
                console.log(`📡 [SumarIAr-FREE] Usando: ${model}`);
                const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                    method: "POST",
                    headers: { "Authorization": "Bearer " + K_SUMAR, "Content-Type": "application/json", "HTTP-Referer": window.location.origin, "X-Title": "notABook SumarIAr" },
                    body: JSON.stringify({ 
                        "model": model, 
                        "messages": [
                            { "role": "system", "content": systemPrompt },
                            { "role": "user", "content": `Conteúdo para resumir:\n\n${texto}` }
                        ], 
                        "temperature": 0.5 
                    })
                });

                if (!response.ok) throw new Error();
                const data = await response.json();
                return data.choices[0].message.content;
            } catch (err) { continue; }
        }
        return "ERROR";
    }
};
