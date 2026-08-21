// components/lists/multimedia-bridge.js
import { renderizarConteudo } from './livros.js';

/**
 * MOTOR DE SALTO PARA MULTIMÉDIA (VÍDEOS)
 */
export async function executarSalto(dados) {
    const container = document.getElementById('lista-lists');
    if (!container) return;

    // A sigla do vídeo pode estar no multimediapath ou no campo mes
    const idVideo = dados.multimediapath || dados.mes; 
    const ano = dados.ano;
    const caminho = `data/multimedia/${ano}/${idVideo}.json`;

    console.log("🎬 [BRIDGE-MULTIMEDIA] A carregar ficheiro:", caminho);

    try {
        const res = await fetch(caminho);
        if (!res.ok) throw new Error("Ficheiro de vídeo não encontrado.");
        
        const json = await res.json();
        
        // No multimedia o conteúdo principal está sempre no objeto .video
        if (json.video) {
            renderizarConteudo(json.video, container, json, caminho, "multimedia", ano);

            // DISPARA O MOTOR DE FOCO DE ALTA PRECISÃO
            focarElemento(dados);
        } else {
            console.warn("⚠️ [BRIDGE-MULTIMEDIA] Objeto 'video' não encontrado no JSON.");
        }
    } catch (e) {
        console.error("❌ [BRIDGE-MULTIMEDIA] Erro:", e.message);
    }
}

/**
 * MOTOR DE FOCO (PULL) - COMPATÍVEL COM CODEX E BÍBLIA
 */
function focarElemento(dados) {
    // Delay de 1.2s para garantir que a transcrição do vídeo (geralmente longa) carregou
    setTimeout(() => {
        let pNum = null;
        let tipoAlvo = dados.oque || "paragrafo";

        // 1. EXTRAÇÃO INTELIGENTE DO ID (Tenta todos os formatos conhecidos)
        if (dados.sequencia !== undefined && dados.sequencia !== null) {
            pNum = Array.isArray(dados.sequencia) ? dados.sequencia[0] : dados.sequencia;
        } 
        else if (dados.mapeamento && dados.mapeamento.length > 0) {
            pNum = dados.mapeamento[0].sequencia[0];
            tipoAlvo = dados.mapeamento[0].oque;
        }
        else if (dados.paragrafos !== undefined) {
            pNum = Array.isArray(dados.paragrafos) ? dados.paragrafos[0] : dados.paragrafos;
        }

        console.log(`🎯 [SCROLL-MULTIMEDIA] Alvo: ${pNum} | Tipo: ${tipoAlvo}`);

        if (pNum !== null && pNum !== undefined) {
            const seletor = `[data-p="${pNum}"][data-tipo="${tipoAlvo}"]`;
            const el = document.querySelector(seletor);
            
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                
                // Realce visual Indigo
                el.style.backgroundColor = "rgba(99, 102, 241, 0.4)";
                el.style.transition = "background-color 0.5s ease";
                el.style.borderRadius = "4px";
                el.style.boxShadow = "0 0 20px rgba(99, 102, 241, 0.2)";
                
                setTimeout(() => {
                    el.style.backgroundColor = "transparent";
                    el.style.boxShadow = "none";
                }, 3500);
            } else {
                console.warn(`⚠️ [SCROLL-FAIL] Parágrafo ${seletor} não encontrado na transcrição.`);
            }
        }
    }, 1200);
}