// components/direita/eye-fontes-nota.js
import { SharedUI } from '../editor/modulos/shared/shared-ui.js';
import { IDENTIDADE_FERRAMENTAS } from '../constants/ferramentas.js';

/**
 * CARREGA O RESUMO DE FONTES DA NOTA ATUAL
 * @param {Array} caixasFiltradas - Lista de caixas enviada pelo Dispatcher
 * @param {Boolean} append - Se true, adiciona à lista sem apagar o anterior
 */
export function carregarFontesGlobaisDaNota(caixasFiltradas, append = false) {
    const container = document.getElementById('fontes-nota-container');
    if (!container) return;

    // 1. Limpeza Inicial do Registo Global (Usado para o "Salto" para a Biblioteca)
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

    // 2. Processar caixas permitidas
    caixasFiltradas.forEach(caixa => {
        const links = caixa.referencias || [];
        const codices = (caixa.codex || []).filter(cx => cx.estado === 'on');

        if (links.length > 0 || codices.length > 0) {
            encontrouQualquerCoisa = true;
            const config = IDENTIDADE_FERRAMENTAS[caixa.tipo] || IDENTIDADE_FERRAMENTAS.contentor;
            
            // Criar cabeçalho do bloco para organizar as fontes
            const labelBloco = document.createElement('div');
            labelBloco.style.cssText = "font-size: 9px; color: var(--text-muted); text-transform: uppercase; margin-top: 15px; opacity: 0.7; display: flex; align-items: center; gap: 8px; border-bottom: 1px solid rgba(255,255,255,0.03); margin-bottom: 8px;";
            
            const tituloParaMostrar = caixa.titulo || config.nome;
            labelBloco.innerHTML = `<i class="${config.icon}" style="font-size: 8px; color:${config.cor};"></i> Fontes de: ${tituloParaMostrar}`;
            listaAlvo.appendChild(labelBloco);

            // Injetar Links Externos
            links.forEach(link => {
                listaAlvo.insertAdjacentHTML('beforeend', renderizarCardSimplificado('link', link));
            });

            // Injetar Mapeamentos Codex (Livros/Revistas)
            codices.forEach(itemCodex => {
                // Registo na RAM para que o clique no card saiba para onde saltar na Biblioteca
                window.__codexGlobalRegistry[itemCodex.id] = itemCodex;
                listaAlvo.insertAdjacentHTML('beforeend', renderizarCardSimplificado('codex', itemCodex));
            });
        }
    });

    // 3. Estado Vazio (Apenas se não for um append de notas associadas)
    if (!append && !encontrouQualquerCoisa) {
        listaAlvo.innerHTML = `
            <div style="text-align:center; padding:60px 20px; color:var(--text-muted); opacity:0.3;">
                <p style="font-size:12px;">Nenhuma fonte vinculada neste modo.</p>
            </div>`;
    }
}

/**
 * AUXILIAR: Remove botões de edição/favorito para mostrar um card limpo no resumo
 */
function renderizarCardSimplificado(tipo, dados) {
    let html = (tipo === 'link') 
        ? SharedUI.renderLinkCard(dados, "") 
        : SharedUI.renderCodexCard(dados, "");
        
    const temp = document.createElement('div');
    temp.innerHTML = html;
    
    // Remove ícones interativos que não pertencem ao resumo global
    temp.querySelectorAll('.fa-star, .fa-pen-to-square, .fa-regular.fa-star, .fa-trash-can').forEach(b => b.remove());
    
    return temp.innerHTML;
}