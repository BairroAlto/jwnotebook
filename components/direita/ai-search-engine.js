// components/direita/ai-search-engine.js
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { NexoEngine } from "./ai-engine.js";

/**
 * MOTOR DE BUSCA SEMÂNTICA (GPS)
 */
const AISearchEngine = {
    procurar: async (queryUtilizador, db, userId) => {
        console.group("🛰️ [AI-SEARCH] Iniciando Varredura Semântica...");
        
        try {
            const shardsRef = collection(db, "SearchIndex", userId, "shards");
            const snap = await getDocs(shardsRef);
            
            if (snap.empty) return [];

            let mapaMemoria = "";
            snap.forEach(docShard => {
                const data = docShard.data();
                Object.entries(data).forEach(([key, resumo]) => {
                    const notaIdReal = key.replace('n_', '');
                    mapaMemoria += `ID:${notaIdReal} | INFO:${resumo}\n`;
                });
            });

            const promptSystem = `Tu és o GPS do Notebook X. Analisa o índice e responde APENAS com um array JSON de objetos contendo "id" e "title" (máx 5). Exemplo: [{"id": "abc", "title": "Nota A"}]`;

            const respostaIA = await NexoEngine.perguntar(queryUtilizador, "GPS_SEARCH", mapaMemoria + "\n\n" + promptSystem);

            try {
                // Tenta limpar o lixo que a IA às vezes manda (como ```json)
                const jsonLimpo = respostaIA.replace(/```json|```/g, "").trim();
                const lista = JSON.parse(jsonLimpo);
                return Array.isArray(lista) ? lista : [];
            } catch (e) {
                console.warn("IA não respondeu em JSON, tentando recuperar...");
                // Plano B: Se devolver só o ID
                if (respostaIA.trim().length > 15 && !respostaIA.includes(" ")) {
                    return [{ id: respostaIA.trim(), title: "Nota Localizada" }];
                }
                return [];
            }

        } catch (error) {
            console.error("Erro crítico no motor de busca:", error);
            return [];
        } finally {
            console.groupEnd();
        }
    }
};

// EXPORTAÇÃO NOMEADA (O que corrige o teu erro)
export { AISearchEngine };
