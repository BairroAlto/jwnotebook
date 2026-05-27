import { renderizarConteudo } from './livros.js';

let activeFocusLoop = null; 

export async function executarSalto(dados) {
    const container = document.getElementById('lista-lists');
    if (!container) return;

    // 🕵️ LOG DE ENTRADA
    console.log("%cBridge: 🌉 Recebido:", "color: #fbbf24; font-weight: bold;", dados);

    const sigla = String(dados.sigla || "").toLowerCase();
    const caminho = `data/livros/${sigla}.json`;

    try {
        const res = await fetch(caminho);
        if (!res.ok) throw new Error("Livro não encontrado.");
        const json = await res.json();
        
        const numCapAlvo = String(dados.capitulo || "").replace(/\D/g, '');
        
        // Função para limpar strings para comparação (remove aspas, acentos e espaços)
        const limpar = (t) => String(t || "").toLowerCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .replace(/[“”"']/g, '') // Remove todos os tipos de aspas
            .trim();

        const tituloProcurado = limpar(dados.artigo);

        // 🔍 BUSCA MELHORADA
        const alvo = json.capitulos.flat().find(c => {
            const numCapJson = String(c.capitulo || "").replace(/\D/g, '');
            const tituloJson = limpar(c.titulo);
            
            return (numCapAlvo !== "" && numCapAlvo === numCapJson) || 
                   (tituloProcurado !== "" && tituloJson.includes(tituloProcurado));
        });

        if (alvo) {
            console.log(`%c✅ [MATCH] Alvo localizado: ${alvo.titulo}`, "color: #22c55e;");
            container.innerHTML = ""; 
            renderizarConteudo(alvo, container, json, caminho, "", "");
            
            setTimeout(() => focarElemento(dados), 400);
        } else {
            console.error("❌ [FAIL] Não foi possível encontrar o capítulo no JSON carregado.");
        }
    } catch (e) {
        console.error("❌ [ERROR]:", e.message);
    }
}

function focarElemento(dados) {
    if (activeFocusLoop) clearInterval(activeFocusLoop);

    // Prioridade para o parágrafo detetado
    let pNum = (dados.paragrafos && dados.paragrafos.length > 0) ? dados.paragrafos[0] : null;
    if (!pNum) return;

    console.log(`🎯 [SCROLL] Perseguindo §${pNum}...`);

    let tentativas = 0;
    activeFocusLoop = setInterval(() => {
        tentativas++;
        const el = document.querySelector(`[data-p="${pNum}"]`);

        if (el && el.getBoundingClientRect().height > 0) {
            clearInterval(activeFocusLoop);
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.style.backgroundColor = "rgba(99, 102, 241, 0.4)";
            setTimeout(() => { el.style.backgroundColor = "transparent"; }, 3000);
        }

        if (tentativas > 40) clearInterval(activeFocusLoop);
    }, 150);
}
