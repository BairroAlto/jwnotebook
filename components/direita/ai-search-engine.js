// components/direita/ai-search-engine.js
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { GpsEngine } from "./ai-gps-engine.js"; 

export const AISearchEngine = {
    procurar: async (queryUtilizador, db, userId) => {
        console.log("%c📡 [GPS-RADAR] Iniciando Varredura...", "color: #6366f1; font-weight: bold;");
        
        try {
            const shardsRef = collection(db, "SearchIndex", userId, "shards");
            const snap = await getDocs(shardsRef);
            
            if (snap.empty) return [];

            let mapaMemoria = "";
            snap.forEach(docShard => {
                const data = docShard.data();
                Object.entries(data).forEach(([key, resumo]) => {
                    const notaIdReal = key.replace('n_', '');
                    mapaMemoria += `ID:${notaIdReal} | ${resumo}\n`;
                });
            });

            console.log("%c📦 [GPS-DATA] Memória enviada para IA:", "color: #fbbf24;", mapaMemoria);

            const respostaIA = await GpsEngine.varrerMemoria(queryUtilizador, mapaMemoria);

            if (respostaIA === "ERROR") throw new Error("Falha na frota.");

            const regexJSON = /\[\s*{[\s\S]*}\s*\]/;
            const match = respostaIA.match(regexJSON);

            if (match) {
                try {
                    const lista = JSON.parse(match[0]);
                    
                    // 🚀 CORREÇÃO: Mapeamento robusto que não perde dados
                    return lista.map(item => ({
                        // Tenta ler 'id' ou 'ID', etc.
                        id: item.id || item.ID || item.Id,
                        blockId: item.blockId || item.blockid || item.BlockId || null,
                        source: (item.source || item.SOURCE || "LOCAL").toUpperCase(),
                        title: item.title || item.TITLE || "Nota Localizada",
                        snippet: item.snippet || item.SNIPPET || ""
                    }));
                } catch (e) {
                    console.error("❌ Erro no Parse JSON:", e);
                }
            }
            return [];
        } catch (error) {
            console.error("❌ Erro GPS:", error);
            return "ERROR";
        }
    }
};
