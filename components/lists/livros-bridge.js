import { renderizarConteudo } from './livros.js';

let currentScrollInterval = null;
let activeFocusLoop = null; 

export async function executarSalto(dados) {
    const container = document.getElementById('lista-lists');
    if (!container) return;

    const sigla = String(dados.sigla || "").toLowerCase();
    const caminho = `data/livros/${sigla}.json`;

    try {
        const res = await fetch(caminho);
        if (!res.ok) throw new Error("Livro não encontrado.");
        const json = await res.json();
        
        // Normalização do Capítulo: procuramos apenas o número
        const numCapAlvo = String(dados.capitulo || "").replace(/\D/g, '');
        
        // Busca flexível no array de capítulos
        const alvo = json.capitulos.flat().find(c => String(c.capitulo) === numCapAlvo);

        if (alvo) {
            // 1. Limpar o container antes de renderizar para evitar IDs duplicados no DOM
            container.innerHTML = ""; 
            
            // 2. Renderizar o novo conteúdo
            renderizarConteudo(alvo, container, json, caminho, "", "");
            
            // 3. Disparar o motor de foco persistente
            focarElemento(dados);
        }
    } catch (e) {
        console.error("❌ [BRIDGE-LIVROS] Erro:", e.message);
    }
}

function focarElemento(dados) {
    // 1. MATAR QUALQUER LOOP ANTERIOR (Evita conflitos de Isaías §13 vs §17)
    if (activeFocusLoop) {
        clearInterval(activeFocusLoop);
        activeFocusLoop = null;
    }

    let pNum = null;
    if (dados.paragrafos && dados.paragrafos.length > 0) pNum = dados.paragrafos[0];
    else if (dados.sequencia) pNum = Array.isArray(dados.sequencia) ? dados.sequencia[0] : dados.sequencia;

    if (!pNum) return;

    console.log(`📡 [SCROLL] Iniciando perseguição de §${pNum}...`);

    let tentativas = 0;
    const maxTentativas = 50; // Aumentado para 7.5 segundos (50 x 150ms)

    activeFocusLoop = setInterval(() => {
        tentativas++;
        
        // Pegar sempre o elemento mais recente injetado
        const elementos = document.querySelectorAll(`[data-p="${pNum}"]`);
        const el = elementos[elementos.length - 1];

        if (el) {
            const rect = el.getBoundingClientRect();
            // Só executa se o elemento tiver altura (ou seja, se já foi desenhado)
            if (rect.height > 0) {
                clearInterval(activeFocusLoop);
                activeFocusLoop = null;

                // Forçar o scroll usando requestAnimationFrame para suavidade máxima
                requestAnimationFrame(() => {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    
                    el.style.backgroundColor = "rgba(99, 102, 241, 0.4)";
                    el.style.transition = "background-color 0.8s ease";
                    el.style.borderRadius = "4px";
                    
                    setTimeout(() => { el.style.backgroundColor = "transparent"; }, 3000);
                });
                
                console.log(`✅ [SCROLL] §${pNum} localizado na tentativa ${tentativas}.`);
            }
        }

        if (tentativas >= maxTentativas) {
            clearInterval(activeFocusLoop);
            activeFocusLoop = null;
            console.warn(`⚠️ [SCROLL] Isaías é demasiado grande. §${pNum} não processado a tempo.`);
        }
    }, 150);
}