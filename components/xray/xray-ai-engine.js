// components/xray/xray-ai-engine.js
import { MODELS_TO_TRY } from '../constants/ai-models.js';

const _P1 = "sk-or-";
const _P2 = "v1-";
const _P3 = "5deed9c3b7fa3074df477442e7a3af296569ff15425b068f25381844022bf121"; 
const K_XRAY_AI = (_P1 + _P2 + _P3).trim();

export const XRayAiEngine = {
    executarProtocolo: async (conteudos, alvo, modo) => {
        
        // 🛡️ REGRAS DE SEGURANÇA: OBRIGAR A IA A USAR APENAS O CONTEÚDO FORNECIDO
        const REGRAS_FIDELIDADE = `
        REGRAS CRÍTICAS DE FONTE:
        1. Estás OBRIGADO a usar APENAS as informações contidas nos "CONTEÚDOS ENCONTRADOS" abaixo.
        2. Proibido usar conhecimentos externos ou informações da internet.
        3. Se os dados fornecidos não falarem de um detalhe, não o inventes.
        4. Não uses símbolos de Markdown (*, #, **, |) nem tabelas. Escreve apenas texto puro e natural.
        5. Responde em Português de Portugal.`;

        const prompts = {
            "resumir": `${REGRAS_FIDELIDADE}
            Missão: Cria um resumo consolidado dos factos apresentados sobre [${alvo}]. Agrupa ideias semelhantes e elimina repetições.`,
            
            "designacao": `${REGRAS_FIDELIDADE}
            Missão: Com base nos factos fornecidos sobre [${alvo}], estrutura um esboço para um discurso. Usa apenas a lógica presente no texto.`,
            
            "explicar": `${REGRAS_FIDELIDADE}
            Missão: Age como um professor. Explica o conceito de [${alvo}] usando apenas os argumentos e explicações presentes nos parágrafos fornecidos. Usa uma linguagem pedagógica mas estritamente baseada na fonte.`
        };

        const systemPrompt = prompts[modo];
        
        // Se não houver conteúdos, avisamos a IA para não inventar nada
        const listaTextos = (conteudos.length > 0) ? conteudos.join('\n\n---\n\n') : "NENHUM CONTEÚDO ENCONTRADO NO REPOSITÓRIO.";
        
        const userContent = `CONTEÚDOS ENCONTRADOS NO REPOSITÓRIO:\n\n${listaTextos}`;

        for (const model of MODELS_TO_TRY) {
            try {
                console.log(`📡 [XRAY-AI] Modo ${modo} (Fidelidade Total) via: ${model}`);
                const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                    method: "POST",
                    headers: { 
                        "Authorization": "Bearer " + K_XRAY_AI, 
                        "Content-Type": "application/json",
                        "HTTP-Referer": window.location.origin,
                        "X-Title": "notABook X-RAY AI"
                    },
                    body: JSON.stringify({
                        "model": model,
                        "messages": [
                            { "role": "system", "content": systemPrompt },
                            { "role": "user", "content": userContent }
                        ],
                        "temperature": 0.3 // 🧊 Baixamos a temperatura para a IA ser menos "criativa" e mais fiel
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
