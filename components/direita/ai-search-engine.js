// components/direita/ai-search-engine.js
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { GpsEngine } from "./ai-gps-engine.js"; 

/**
 * MOTOR DE BUSCA SEMÂNTICA (NEXO GPS) - VERSÃO 2.0
 * Este motor lê os Shards de memória e interroga a frota de modelos gratuitos 
 * para localizar correlações profundas em até 3500 caracteres por nota.
 */
export const AISearchEngine = {
    /**
     * PROCURA NOTAS BASEADO NO SIGNIFICADO E CONTEXTO
     * @param {string} queryUtilizador - A intenção de busca do utilizador.
     * @param {object} db - Instância do Firestore.
     * @param {string} userId - UID do utilizador logado.
     */
    procurar: async (queryUtilizador, db, userId) => {
        console.log("%c📡 [GPS-RADAR] Iniciando Varredura Semântica Profunda...", "color: #6366f1; font-weight: bold;");
        
        try {
            // 1. LEITURA DOS SHARDS (OS BALDES DE MEMÓRIA)
            // Lemos todos os documentos dentro da sub-coleção 'shards' do utilizador.
            const shardsRef = collection(db, "SearchIndex", userId, "shards");
            const snap = await getDocs(shardsRef);
            
            if (snap.empty) {
                console.warn("⚠️ [GPS] Índice de busca vazio. A aguardar indexação de notas...");
                return [];
            }

            // 2. MONTAGEM DO MAPA DE MEMÓRIA
            // Concatenamos os resumos expandidos de todas as notas para enviar à frota IA.
            let mapaMemoria = "";
            snap.forEach(docShard => {
                const data = docShard.data();
                Object.entries(data).forEach(([key, resumo]) => {
                    const notaIdReal = key.replace('n_', '');
                    mapaMemoria += `ID:${notaIdReal} | INFO:${resumo}\n`;
                });
            });

            // 3. CHAMADA À FROTA DE SATÉLITES (AI-GPS-ENGINE)
            // O GpsEngine tratará da lógica de fallback entre modelos gratuitos (Gemini, Llama, Qwen, etc.)
            const respostaIA = await GpsEngine.varrerMemoria(queryUtilizador, mapaMemoria);

            if (respostaIA === "ERROR") {
                throw new Error("Falha na comunicação com a frota de modelos.");
            }

            // 4. EXTRAÇÃO E LIMPEZA DO JSON (BLINDAGEM REGEX)
            // A IA às vezes envia texto extra (Markdown). Usamos Regex para isolar apenas o Array [ ... ].
            const regexJSON = /\[\s*{[\s\S]*}\s*\]/;
            const match = respostaIA.match(regexJSON);

            if (match) {
                try {
                    const lista = JSON.parse(match[0]);
                    
                    // 5. NORMALIZAÇÃO DE RESULTADOS
                    // Garante que o controlador recebe os campos necessários para renderizar os cards.
                    return lista.map(item => ({
                        id: item.id,
                        title: item.title || "Nota Localizada",
                        snippet: item.snippet || "Conteúdo correspondente detetado nos parágrafos internos."
                    }));
                } catch (e) {
                    console.error("❌ [GPS-PARSE] Erro ao processar JSON da IA:", e);
                }
            }

            // --- PLANO B: RECONHECIMENTO DE ID PURO ---
            // Se a IA falhar o formato JSON mas enviar apenas um ID válido (caso de modelos mais simples).
            if (respostaIA.trim().length > 15 && !respostaIA.includes(" ") && !respostaIA.includes("[")) {
                return [{ 
                    id: respostaIA.trim(), 
                    title: "Nota Localizada", 
                    snippet: "O Nexo encontrou uma correspondência direta." 
                }];
            }

            console.log("ℹ️ [GPS] Nenhuma nota relevante encontrada para esta consulta.");
            return [];

        } catch (error) {
            console.error("❌ [GPS-CRITICAL] Erro no motor AISearchEngine:", error);
            return "ERROR";
        }
    }
};
