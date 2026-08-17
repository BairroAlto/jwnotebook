// components/direita/ai-gps-engine.js
import { chatWithQuota } from '../ai/ai-client.js';

/**
 * Pesquisa semântica das notas através do gateway de IA do Worker.
 * A quota e o modelo são escolhidos no servidor.
 */
export const GpsEngine = {
    varrerMemoria: async (pergunta, mapaMemoria) => {
        const systemPrompt = `Tu és o Navegador GPS do NotaBook. Analisa o índice e localiza as notas relevantes.

REGRAS OBRIGATÓRIAS DE RESPOSTA:
1. Responde APENAS com um array JSON válido, sem texto explicativo antes ou depois.
2. Estrutura: [{"id":"ID_NOTA","blockId":"ID_BLOCO","source":"LOCAL_OU_SHARE","title":"TITULO","snippet":"RESUMO"}]
3. O "id" da nota vem após 'ID:'. Copia-o fielmente.
4. O "blockId" vem dentro de '{ID:...}'. Extrai o UUID corretamente. Se não houver, usa null.
5. O "source" é 'SHARE' se vires 'ORIGEM: SHARE', senão assume 'LOCAL'.
6. Baseia-te no significado. Se o utilizador perguntar por um tema, procura notas relacionadas mesmo que o título seja diferente.
7. Se nada for encontrado, responde apenas: []

Índice de memória:
${mapaMemoria}`;

        try {
            const data = await chatWithQuota({
                task: 'gps',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: pergunta }
                ],
                temperature: 0.3,
                responseFormat: { type: 'json_object' }
            });

            let conteudo = data.choices[0]?.message?.content;
            if (!conteudo) throw new Error('Resposta vazia.');

            conteudo = conteudo.replace(/```json/g, '').replace(/```/g, '').trim();
            if (conteudo.startsWith('[') || conteudo.startsWith('{')) return conteudo;
            throw new Error('Formato de resposta não reconhecido.');
        } catch (erro) {
            console.warn(`⚠️ [GPS] Falha na operação: ${erro.message}`);
            return 'ERROR';
        }
    }
};
