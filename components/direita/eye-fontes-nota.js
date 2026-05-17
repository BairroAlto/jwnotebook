// components/direita/eye-fontes-nota.js
import { SharedUI } from '../editor/modulos/shared/shared-ui.js';
import { IDENTIDADE_FERRAMENTAS } from '../constants/ferramentas.js';

/**
 * @param {Array} caixas - Lista de caixas (locais ou associadas)
 * @param {Boolean} append - Se true, não limpa a lista existente (para caixas associadas)
 */
export function carregarFontesGlobaisDaNota(caixas, append = false) {
    const container = document.getElementById('fontes-nota-container');
    if (!container) return;
    if (!append) window.__codexGlobalRegistry = {}; 

    if (!window.__codexGlobalRegistry) window.__codexGlobalRegistry = {};
    
    // 1. Limpeza inicial (Só se não for um append)
    if (!append) {
        window.__codexGlobalRegistry = {};
        container.innerHTML = `
            <div style="padding: 10px; margin-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.05);">
                <p style="font-size: 10px; color: var(--primary); font-weight: 800; text-transform: uppercase; letter-spacing: 1px; margin: 0;">
                    <i class="fa-solid fa-book-bookmark"></i> Resumo de Fontes
                </p>
            </div>
            <div id="lista-fontes-nota" style="display: flex; flex-direction: column; gap: 12px; padding: 0 10px 20px 10px;"></div>
        `;
    }

    const listaAlvo = document.getElementById('lista-fontes-nota');
    let encontrouQualquerCoisa = false;

    // 2. Processar caixas
    caixas.filter(c => c.estado === 'ativa' || c.estado === 'ativo').forEach(caixa => {
        const refs = caixa.referencias || [];
        const codices = (caixa.codex || []).filter(cx => cx.estado === 'ativo' || cx.estado === 'ativa');

        if (refs.length > 0 || codices.length > 0) {
            encontrouQualquerCoisa = true;
            const config = IDENTIDADE_FERRAMENTAS[caixa.tipo] || IDENTIDADE_FERRAMENTAS.contentor;
            
            const labelBloco = document.createElement('div');
            labelBloco.style.cssText = "font-size: 9px; color: var(--text-muted); text-transform: uppercase; margin-top: 15px; opacity: 0.7; display: flex; align-items: center; gap: 8px; border-bottom: 1px solid rgba(255,255,255,0.03); margin-bottom: 8px;";
            // Se a caixa tem notaOrigem (é associada), mostramos no título
            const origemStr = caixa.notaOrigem ? ` (da nota ${caixa.notaOrigem})` : "";
            labelBloco.innerHTML = `<i class="${config.icon}" style="font-size: 8px; color:${config.cor};"></i> Fontes de: ${caixa.titulo || config.nome}${origemStr}`;
            listaAlvo.appendChild(labelBloco);

            refs.forEach(link => {
                listaAlvo.insertAdjacentHTML('beforeend', renderizarCardSimplificado('link', link));
            });

            codices.forEach(itemCodex => {
                // REGISTO NA RAM (Agora funciona para associadas também)
                window.__codexGlobalRegistry[itemCodex.id] = itemCodex;
        listaAlvo.insertAdjacentHTML('beforeend', renderizarCardSimplificado('codex', itemCodex));
            });
        }
    });

    if (!append && !encontrouQualquerCoisa) {
        listaAlvo.innerHTML = `<div style="text-align:center; padding:60px 20px; color:var(--text-muted); opacity:0.3;"><p>Nenhuma fonte vinculada.</p></div>`;
    }
}

function renderizarCardSimplificado(tipo, dados) {
    let html = (tipo === 'link') ? SharedUI.renderLinkCard(dados, "") : SharedUI.renderCodexCard(dados, "");
    const temp = document.createElement('div');
    temp.innerHTML = html;
    temp.querySelectorAll('.fa-star, .fa-pen-to-square, .fa-regular.fa-star').forEach(b => b.remove());
    return temp.innerHTML;
}