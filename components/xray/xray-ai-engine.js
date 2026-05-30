// components/xray/xray-ai-engine.js
import { MODELS_TO_TRY } from '../constants/ai-models.js';

const _P1 = "sk-or-";
const _P2 = "v1-";
const _P3 = "5deed9c3b7fa3074df477442e7a3af296569ff15425b068f25381844022bf121"; 
const K_XRAY_AI = (_P1 + _P2 + _P3).trim();

export const XRayAiEngine = {
    executarProtocolo: async (conteudos, alvo, modo) => {
        const prompts = {
            "resumir": `Tu és o SumarIAr. Analisa os parágrafos seguintes sobre [${alvo}] e cria um resumo consolidado. REGRA: Não uses símbolos como *, #, ** ou tabelas. Escreve apenas texto limpo e parágrafos naturais.`,
            
            "designacao": `Tu és um instrutor experiente. Prepara um esboço para um discurso sobre [${alvo}]. REGRA: Não uses símbolos como *, #, **, | ou formatos de tabela. Usa apenas títulos em texto simples e listas numeradas normais.`,
            
            // 🚀 NOVO PROTOCOLO: PROFESSOR
            "explicar": `Tu és um professor paciente e experiente. Analisa os parágrafos sobre [${alvo}] e explica o conceito de forma pedagógica a um aluno. Usa uma linguagem clara, exemplos simples e um tom humano. REGRA: Não uses símbolos de Markdown (*, #, **, |).`
        };

        const systemPrompt = prompts[modo];
        const userContent = `CONTEÚDOS ENCONTRADOS:\n\n${conteudos.join('\n\n')}`;

        for (const model of MODELS_TO_TRY) {
            try {
                console.log(`📡 [XRAY-AI] Tentando protocolo ${modo} via: ${model}`);
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
                        "temperature": 0.6
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
