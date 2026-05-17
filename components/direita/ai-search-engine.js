// components/direita/ai-search-engine.js
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { NexoEngine } from "./ai-engine.js";

/**
 * MOTOR DE BUSCA SEMÂNTICA (GPS)
 * Lê os baldes de memória (shards) e interroga a IA para localizar notas.
 */
export const AISearchEngine = {
    /**
     * PROCURA NOTAS BASEADO NO SIGNIFICADO
     * @param {string} queryUtilizador - A pergunta ou termo de busca.
     * @param {object} db - Instância do Firestore.
     * @param {string} userId - UID do utilizador.
     */
    procurar: async (queryUtilizador, db, userId) => {
        console.log("🛰️ [AI-SEARCH] Iniciando Varredura Semântica...");
        
        try {
            // 1. LEITURA DOS SHARDS (BALDES DE MEMÓRIA)
            const shardsRef = collection(db, "SearchIndex", userId, "shards");
            const snap = await getDocs(shardsRef);
            
            if (snap.empty) {
                console.warn("⚠️ Índice vazio. Certifica-te que as notas foram sincronizadas.");
                return [];
            }

            // 2. MONTAGEM DO MAPA DE MEMÓRIA (CONTEXTO)
            let mapaMemoria = "";
            snap.forEach(docShard => {
                const data = docShard.data();
                Object.entries(data).forEach(([key, resumo]) => {
                    const notaIdReal = key.replace('n_', '');
                    mapaMemoria += `ID:${notaIdReal} | INFO:${resumo}\n`;
                });
            });

            // 3. INSTRUÇÃO PARA A IA (SISTEMA DE SNIPPETS)
            // Pedimos explicitamente o campo "snippet" com o trecho relevante.
            const promptSystem = `Analisa o índice de notas e responde APENAS com um array JSON de objetos: 
            {"id": "ID_DA_NOTA", "title": "TITULO", "snippet": "TRECHO_DO_CONTEUDO_RELEVANTE"}.
            
            REGRAS:
            1. O "snippet" deve ser a frase ou parte do texto que justifica por que esta nota foi escolhida.
            2. Máximo 60 caracteres no snippet.
            3. Se não houver nada, responde []. 
            4. Não dês explicações, responde apenas o JSON bruto.
            
            Índice de Memória:\n${mapaMemoria}`;

            // 4. CHAMADA AO NEXO (DEEPSEEK)
            const respostaIA = await NexoEngine.perguntar(queryUtilizador, "GPS_SEARCH", promptSystem);
            console.log("🛰️ Resposta Bruta do Radar:", respostaIA);

            // 5. EXTRAÇÃO E LIMPEZA DO JSON (BLINDAGEM REGEX)
            const regexJSON = /\[\s*{[\s\S]*}\s*\]/;
            const match = respostaIA.match(regexJSON);

            if (match) {
                try {
                    const lista = JSON.parse(match[0]);
                    // Garante que todos os itens têm o campo snippet, mesmo que vazio
                    return lista.map(item => ({
                        id: item.id,
                        title: item.title || "Nota Sem Título",
                        snippet: item.snippet || ""
                    }));
                } catch (e) {
                    console.error("❌ Falha no Parse do JSON extraído.");
                }
            }

            // --- PLANO B: SE A IA ENVIAR APENAS O ID (FORMATO ANTIGO) ---
            if (respostaIA.trim().length > 15 && !respostaIA.includes(" ") && !respostaIA.includes("[")) {
                return [{ id: respostaIA.trim(), title: "Nota Localizada", snippet: "Conteúdo correspondente detetado." }];
            }

            return [];

        } catch (error) {
            console.error("❌ Erro crítico no motor AISearchEngine:", error);
            return [];
        }
    }
};
