// components/direita/ai-search-engine.js
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { NexoEngine } from "./ai-engine.js";

export const AISearchEngine = {
    procurar: async (queryUtilizador, db, userId) => {
        console.log("🛰️ [AI-SEARCH] Iniciando Varredura...");
        
        try {
            const shardsRef = collection(db, "SearchIndex", userId, "shards");
            const snap = await getDocs(shardsRef);
            if (snap.empty) return [];

            let mapaMemoria = "";
            snap.forEach(docShard => {
                const data = docShard.data();
                Object.entries(data).forEach(([key, resumo]) => {
                    mapaMemoria += `ID:${key.replace('n_', '')} | INFO:${resumo}\n`;
                });
            });

            const respostaIA = await NexoEngine.perguntar(queryUtilizador, "GPS_SEARCH", mapaMemoria);
            console.log("🛰️ Resposta Bruta da IA:", respostaIA);

            // --- TÉCNICA DE EXTRAÇÃO COM REGEX (BLINDAGEM) ---
            // Procura o padrão [...] dentro da resposta, ignorando o resto do texto
            const regexJSON = /\[\s*{[\s\S]*}\s*\]/;
            const match = respostaIA.match(regexJSON);

            if (match) {
                try {
                    const lista = JSON.parse(match[0]);
                    return Array.isArray(lista) ? lista : [];
                } catch (e) {
                    console.error("Falha ao processar o trecho JSON extraído.");
                }
            }

            // --- PLANO B: Se a IA devolveu apenas o ID puro ---
            if (respostaIA.length > 15 && !respostaIA.includes(" ") && !respostaIA.includes("[")) {
                return [{ id: respostaIA.trim(), title: "Nota Localizada" }];
            }

            console.warn("⚠️ A IA não enviou um formato compatível.");
            return [];

        } catch (error) {
            console.error("❌ Erro no motor de busca:", error);
            return [];
        }
    }
};

// EXPORTAÇÃO NOMEADA (O que corrige o teu erro)
export { AISearchEngine };
