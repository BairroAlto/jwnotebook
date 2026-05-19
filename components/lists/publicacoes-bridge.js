// components/lists/publicacoes-bridge.js
import { renderizarConteudo } from './livros.js';

const MESES_NOMES = { 
    "janeiro": "01", "fevereiro": "02", "março": "03", "marco": "03", "abril": "04", 
    "maio": "05", "junho": "06", "julho": "07", "agosto": "08", "setembro": "09", 
    "outubro": "10", "novembro": "11", "dezembro": "12" 
};

export async function executarSalto(dados) {
    const container = document.getElementById('lista-lists');
    if (!container) return;

    const pasta = (dados.sigla === 'mwb') ? 'mwb' : 'w';
    const ano = dados.ano;
    const ref = (dados.referencia || "").toLowerCase();
    
    // 1. RESOLUÇÃO DE MÊS
    let mes = String(dados.mes || "").padStart(2, '0');
    if (mes === ano || mes === "00" || mes.length > 2) {
        for (const [nome, num] of Object.entries(MESES_NOMES)) {
            if (ref.includes(nome)) { mes = num; break; }
        }
    }
    if (mes === ano || mes === "00") {
        const matchFracao = ref.match(/(\d{1,2})\/(\d{1,2})/);
        if (matchFracao) mes = matchFracao[2].padStart(2, '0');
    }

    // 2. CAMINHO DO FICHEIRO
    let sufixoProvavel = "";
    if (ref.includes("15/")) sufixoProvavel = "_15";
    else if (ref.includes("1/")) sufixoProvavel = "_01";

    const candidatos = [
        `data/publicacoes/${pasta}/${ano}/${mes}${sufixoProvavel}.json`,
        `data/publicacoes/${pasta}/${ano}/${mes}.json`,
        `data/publicacoes/${pasta}/${ano}/${mes}_01.json`,
        `data/publicacoes/${pasta}/${ano}/${mes}_15.json`
    ];

    try {
        let caminhoFinal = "";
        for (const path of candidatos) {
            const check = await fetch(path, { method: 'HEAD' });
            if (check.ok) { caminhoFinal = path; break; }
        }

        if (!caminhoFinal) throw new Error(`Edição ${mes}/${ano} não encontrada.`);

        const response = await fetch(caminhoFinal);
        const json = await response.json();

        // 3. LOCALIZAÇÃO DO ARTIGO
        const superLimpar = (t) => String(t || "").toLowerCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]/g, '').trim();

        const termoBusca = superLimpar(dados.artigo || dados.titulo);
        const alvo = json.artigos.find(a => {
            const titJson = superLimpar(a.titulo);
            return titJson.includes(termoBusca) || termoBusca.includes(titJson);
        });

        if (alvo) {
            renderizarConteudo(alvo, container, json, caminhoFinal, pasta, ano);
            
            // --- MOTOR DE SCROLL MULTI-ESTRUTURA ---
            setTimeout(() => {
                let pNum = null;
                let tipoAlvo = dados.oque || "paragrafo";

                // A) Tentar no formato direto (Bíblia/Estudo)
                if (dados.sequencia !== undefined && dados.sequencia !== null) {
                    pNum = Array.isArray(dados.sequencia) ? dados.sequencia[0] : dados.sequencia;
                } 
                // B) Tentar no formato do Explorador Codex (mapeamento: [])
                else if (dados.mapeamento && dados.mapeamento.length > 0) {
                    pNum = dados.mapeamento[0].sequencia[0];
                    tipoAlvo = dados.mapeamento[0].oque;
                }
                // C) Tentar no formato legado (paragrafos: [])
                else if (dados.paragrafos !== undefined) {
                    pNum = Array.isArray(dados.paragrafos) ? dados.paragrafos[0] : dados.paragrafos;
                }

                console.log(`📡 [SCROLL-DEBUG] Focando Parágrafo: ${pNum} | Tipo: ${tipoAlvo}`);

                if (pNum !== null && pNum !== undefined) {
                    const seletor = `[data-p="${pNum}"][data-tipo="${tipoAlvo}"]`;
                    const el = document.querySelector(seletor);
                    
                    if (el) {
                        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        el.style.backgroundColor = "rgba(99, 102, 241, 0.4)";
                        el.style.transition = "background-color 0.5s ease";
                        el.style.borderRadius = "4px";
                        setTimeout(() => el.style.backgroundColor = "transparent", 3500);
                    } else {
                        console.warn(`⚠️ [SCROLL FAIL] Elemento ${seletor} não encontrado.`);
                    }
                }
            }, 1200); 

        } else {
            throw new Error("Artigo não encontrado.");
        }
    } catch (e) {
        console.error("❌ [BRIDGE-ERROR]", e.message);
    }
}