// components/editor/modulos/sumariar-ia-engine.js
import { chatWithQuota } from '../../ai/ai-client.js';

const INSTRUCOES_ESTILO = {
    normal: 'NEUTRO E DIRETO. Usa uma linguagem clara, equilibrada e objetiva.',
    historico: 'HISTORIADOR. Foca-te no contexto temporal, na sucessão de eventos e na relação de causa e efeito.',
    cientifico: 'CIENTÍFICO. Usa terminologia precisa e rigorosa. Foca-te em factos, dados e lógica analítica.',
    teocratico: 'TEOCRÁTICO. Usa uma linguagem familiar a este contexto religioso, com lições práticas e encorajamento.',
    academico: 'ACADÉMICO. Usa um vocabulário rico e formal e estrutura o pensamento de forma analítica.',
    natural: 'HUMANO E PEDAGÓGICO. Age como um professor gentil ou como um amigo a explicar um tema.'
};

export const SumarIAEngine = {
    gerarResumo: async (texto, config) => {
        const instrucaoEstilo = INSTRUCOES_ESTILO[config.style] || INSTRUCOES_ESTILO.normal;
        const formato = config.format === 'lista'
            ? 'Lista de tópicos usando o símbolo •'
            : 'Parágrafos fluidos';
        const systemPrompt = `Tu és o SumarIAr, um especialista em síntese de conhecimento.
Responde apenas com o texto do resumo, sem saudações ou comentários iniciais/finais.
CONTEXTO DE ESCRITA: ${instrucaoEstilo}
FORMATO: ${formato}.
TAMANHO: Resumo ${String(config.size || 'médio').toUpperCase()}.
LÍNGUA: Português de Portugal.`;

        try {
            const data = await chatWithQuota({
                task: 'sumarizar',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: `Conteúdo para resumir:\n\n${texto}` }
                ],
                temperature: (config.style === 'natural' || config.style === 'teocratico') ? 0.7 : 0.4
            });
            return data.choices[0]?.message?.content || 'Erro ao processar resposta.';
        } catch (erro) {
            console.warn(`⚠️ [SumarIAr] Falha na operação: ${erro.message}`);
            return 'ERROR';
        }
    }
};
