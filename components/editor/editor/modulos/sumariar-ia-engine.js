// components/editor/modulos/sumariar-ia-engine.js
import { MODELS_TO_TRY } from '../../constants/ai-models.js';

const _P1 = "sk-or-";
const _P2 = "v1-";
const _P3 = "5deed9c3b7fa3074df477442e7a3af296569ff15425b068f25381844022bf121"; 
const K_SUMAR = (_P1 + _P2 + _P3).trim();

// 🚀 DICIONÁRIO DE ESTILOS (O Cérebro do SumarIAr)
const INSTRUCOES_ESTILO = {
    "normal": "NEUTRO E DIRETO. Usa uma linguagem clara, equilibrada e objetiva. Evita opiniões ou termos rebuscados.",
    
    "historico": "HISTORIADOR. Foca-te no contexto temporal, na sucessão de eventos e na relação de causa e efeito. Usa um tom narrativo e documental.",
    
    "cientifico": "CIENTÍFICO. Usa terminologia precisa e rigorosa. Foca-te em factos, dados e lógica analítica. Mantém um tom formal e impessoal.",
    
    "teocratico": "TEOCRÁTICO (Testemunhas de Jeová). Usa uma linguagem familiar a este contexto religioso. Foca-te em lições espirituais, aplicações práticas e encorajamento. Mantém um tom bondoso e instrutivo.",
    
    "academico": "ACADÉMICO. Usa um vocabulário rico e formal. Estrutura o pensamento de forma analítica e erudita, focando na síntese intelectual dos conceitos.",
    
    "natural": "HUMANO E PEDAGÓGICO. Age como um professor gentil a explicar a um aluno ou como um amigo a contar a outro. Usa linguagem fluida, evita termos mecânicos e torna a leitura prazerosa."
};

export const SumarIAEngine = {
    /**
     * GERA O RESUMO COM BASE NA CONFIGURAÇÃO ESCOLHIDA
     */
    gerarResumo: async (texto, config) => {
        
        // Puxa a instrução detalhada do dicionário acima
        const instrucaoEstilo = INSTRUCOES_ESTILO[config.style] || INSTRUCOES_ESTILO["normal"];

        const systemPrompt = `Tu és o SumarIAr, um especialista em síntese de conhecimento e comunicação. 
        Responde APENAS com o texto do resumo, sem saudações ou comentários iniciais/finais.
        
        CONTEXTO DE ESCRITA: ${instrucaoEstilo}
        
        REGRAS DE FORMATO:
        - FORMATO: ${config.format === 'lista' ? 'Lista de tópicos usando o símbolo •' : 'Parágrafos fluidos'}.
        - TAMANHO: Resumo ${config.size.toUpperCase()}.
        - LÍNGUA: Português de Portugal.`;

        for (const model of MODELS_TO_TRY) {
            try {
                console.log(`📡 [SumarIAr-FREE] Tentando estilo [${config.style}] via: ${model}`);
                const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                    method: "POST",
                    headers: { 
                        "Authorization": "Bearer " + K_SUMAR, 
                        "Content-Type": "application/json", 
                        "HTTP-Referer": window.location.origin, 
                        "X-Title": "notABook SumarIAr" 
                    },
                    body: JSON.stringify({ 
                        "model": model, 
                        "messages": [
                            { "role": "system", "content": systemPrompt },
                            { "role": "user", "content": `Conteúdo para resumir:\n\n${texto}` }
                        ], 
                        "temperature": (config.style === 'natural' || config.style === 'teocratico') ? 0.7 : 0.4
                    })
                });

                if (!response.ok) throw new Error("Erro no modelo");
                const data = await response.json();
                return data.choices[0]?.message?.content || "Erro ao processar resposta.";

            } catch (err) {
                console.warn(`⚠️ [RETRY] Modelo ${model} falhou. Saltando...`);
                continue; 
            }
        }
        return "ERROR";
    }
};
