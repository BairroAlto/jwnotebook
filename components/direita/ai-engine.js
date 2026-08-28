// components/direita/ai-engine.js
import { chatWithQuota } from '../ai/ai-client.js';
import { normalizarRespostaIA } from '../ai/ai-response.js';

/**
 * MOTOR DE INTELIGÊNCIA BOOKAI (OPENROUTER)
 * Proteção contra GitHub Secret Scanning (Versão Ofuscada)
 */

// Chave Invertida: O segredo para "enganar" os sistemas de segurança de repositórios públicos

// Função para restaurar a chave apenas na memória RAM do utilizador

export const NexoEngine = {
    perguntar: async (texto, modo, contextoExtra = null) => {
        const prompts = {
            // ORIGINAIS
            "melhorar": "Reescreve o texto para ser mais claro, elegante e profissional.",
            "investigar": "Fornece contexto histórico, arqueológico e cultural sobre este tema.",
            "socratico": "Gera 3 perguntas profundas para meditação baseadas neste texto.",
            "sintese": "Resume o conteúdo num único parágrafo atómico e impactante.",
            "critico": "Apresenta 2 pontos que podem gerar dúvidas e responde com argumentos lógicos.",
            "origens": "Revê o texto e corrige erros de gramática, ortografia e sintaxe.",
           
             "cosmos": `Tu és um Arquiteto de Conhecimento. Analisa este texto e define: 
            1. Uma CATEGORIA MESTRE (ex: Teologia, História, Ética, Ciência, Biografias, etc.).
            2. Um SUB-TÓPICO ESTRUTURAL (ex: Arqueologia, Fruto do Espírito, Profecias Messiânicas, etc.).
            3. Explica brevemente por que razão esta classificação é a mais lógica para organizar este estudo no futuro.
            Responde de forma estruturada e direta.`,

            "ilustrar": "Cria uma analogia ou ilustração poderosa para explicar este conceito.",
            "pratico": "Sugere 2 formas diretas de aplicar esta informação na vida quotidiana.",

            // NOVOS: ESCRITA
            "oralidade": "Adapta o texto para ser lido em voz alta. Usa frases curtas e indica pausas de respiração.",
            "simplicidade": "Explica este conceito como se eu tivesse 5 anos de idade, de forma muito simples.",
            "titulos": "Sugere 5 títulos criativos e curtos para este parágrafo.",
            "tom": "Ajusta o tom do texto para ser mais empático, caloroso e encorajador.",

            // NOVOS: ESTUDO TÉCNICO
            "lexico": "Analisa as palavras-chave e explica as raízes originais no Grego ou Hebraico.",
            "cronologia": "Situa este conteúdo numa linha do tempo, indicando anos e governantes da época.",
            "geografia": "Explica a importância geográfica dos locais mencionados e curiosidades da região.",
            "profecia": "Analisa símbolos no texto e sugere correlações proféticas e cumprimentos.",

            // NOVOS: ENSINO
            "ministerio": "Transforma isto numa apresentação de 30 segundos para o testemunho informal.",
            "objecoes": "Antecipa uma objeção difícil a este texto e sugere uma resposta tática e bondosa.",
            "analogias": "Cria uma analogia moderna (tecnologia/dia-a-dia) para este conceito espiritual.",

            // NOVOS: LÓGICA
            "mnemonica": "Cria um acrónimo ou rima para ajudar a memorizar os pontos principais.",
            "exame": "Gera uma pergunta de escolha múltipla para testar o conhecimento sobre este bloco.",
            "contraste": "Compara este raciocínio com o ponto de vista comum do mundo hoje.",
            "estruturar": "Transforma o parágrafo num esboço organizado por tópicos (I, II, a, b)."
        };

        const systemContent = `Tu és o BookAI. ${prompts[modo] || "Responde de forma útil e contextual."}

REGRAS OBRIGATÓRIAS:
- Responde exclusivamente em Português de Portugal.
- Não uses palavras aleatórias de outros idiomas, caracteres de outros alfabetos ou símbolos decorativos.
- Não inventes pessoas, fontes, descobertas arqueológicas, datas ou acontecimentos. Se não houver dados suficientes, diz claramente que não é possível confirmar.
- Revê a resposta antes de a enviares e remove qualquer palavra corrompida, repetida ou sem sentido.
- Usa Markdown simples: títulos com ###, negrito com ** e listas com hífen.
${contextoExtra ? `\nCONTEXTO OBRIGATÓRIO:\n${contextoExtra}` : ""}`;

        try {
            const data = await chatWithQuota({
                task: 'nexo',
                messages: [
                    { role: 'system', content: systemContent },
                    { role: 'user', content: texto }
                ],
                temperature: modo === 'investigar' || modo === 'cronologia' ? 0.25 : 0.45
            });
            return normalizarRespostaIA(data.choices?.[0]?.message?.content, modo);
        } catch (e) { return "Erro ao processar sinal do satélite."; }
    }
};

const btnBusca = document.getElementById('btn-executar-tab-search');
const inputBusca = document.getElementById('input-tab-search');

if (btnBusca) {
    btnBusca.onclick = async () => {
        const query = inputBusca.value.trim();
        if (!query) return;

        const status = document.getElementById('search-status-info');
        const listaUI = document.getElementById('list-results-gps');

        status.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> BookAi a varrer a rede...`;
        listaUI.innerHTML = "";

        // Importação dinâmica para não pesar no início
        const { AISearchEngine } = await import('../direita/ai-search-engine.js');
        const { abrirNotaNoEditor } = await import('../editor/editor.js');

        const resultados = await AISearchEngine.procurar(query, db, auth.currentUser.uid);

        if (resultados.length === 0) {
            status.innerText = "❌ Nenhuma nota encontrada.";
        } else {
            status.innerHTML = `✅ Encontrei ${resultados.length} resultados:`;
            resultados.forEach(nota => {
                const card = document.createElement('div');
                card.className = "menu-item-list";
                card.style.background = "rgba(99, 102, 241, 0.05)";
                card.style.borderLeft = "3px solid var(--primary)";
                card.innerHTML = `
                    <i class="fa-solid fa-file-lines" style="color:var(--primary);"></i>
                    <span style="flex:1; font-weight:700;">${nota.title}</span>
                    <i class="fa-solid fa-chevron-right"></i>
                `;
                card.onclick = async () => {
                    const overlay = document.getElementById('popup-settings-overlay');
                    overlay.classList.remove('active');
                    
                    // Buscar dados completos para abrir
                    const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js");
                    const snap = await getDoc(doc(db, "Local", nota.id));
                    if (snap.exists()) {
                        abrirNotaNoEditor(nota.id, snap.data(), db, auth);
                    }
                };
                listaUI.appendChild(card);
            });
        }
    };
}
