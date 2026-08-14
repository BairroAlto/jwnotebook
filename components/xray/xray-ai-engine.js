// components/xray/xray-ai-engine.js
import { chatWithQuota } from '../ai/ai-client.js';

export const XRayAiEngine = {
    executarProtocolo: async (conteudos, alvo, modo) => {
        const regrasFidelidade = `
REGRAS CRÍTICAS DE FONTE:
1. Usa APENAS as informações contidas nos "CONTEÚDOS ENCONTRADOS" abaixo.
2. É proibido usar conhecimentos externos ou informações da internet.
3. Se os dados não falarem de um detalhe, não o inventes.
4. Não uses símbolos de Markdown (*, #, **, |) nem tabelas.
5. Responde em Português de Portugal.`;

        const prompts = {
            resumir: `${regrasFidelidade}
Missão: cria um resumo consolidado dos factos apresentados sobre [${alvo}]. Agrupa ideias semelhantes e elimina repetições.`,
            designacao: `${regrasFidelidade}
Missão: com base nos factos fornecidos sobre [${alvo}], estrutura um esboço para um discurso. Usa apenas a lógica presente no texto.`,
            explicar: `${regrasFidelidade}
Missão: age como um professor. Explica o conceito de [${alvo}] usando apenas os argumentos e explicações presentes nos parágrafos fornecidos.`
        };

        const systemPrompt = prompts[modo] || prompts.explicar;
        const listaTextos = conteudos.length > 0
            ? conteudos.join('\n\n---\n\n')
            : 'NENHUM CONTEÚDO ENCONTRADO NO REPOSITÓRIO.';

        try {
            const data = await chatWithQuota({
                task: 'xray',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: `CONTEÚDOS ENCONTRADOS NO REPOSITÓRIO:\n\n${listaTextos}` }
                ],
                temperature: 0.3
            });
            return data.choices[0]?.message?.content || 'ERROR';
        } catch (erro) {
            console.warn(`⚠️ [XRAY] Falha na operação: ${erro.message}`);
            return 'ERROR';
        }
    }
};
