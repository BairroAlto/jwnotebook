// components/editor/modulos/shared/shared-ui.js
import { SIGLAS_PUBLICACOES } from '../../../lists/siglas-data.js';

export const SharedUI = {
    /**
     * RENDERIZAÇÃO DO CARD DE LINKS (URL EXTERNA)
     */
    renderLinkCard: (ref, onEdit) => {
        const isFav = ref.favorito === "sim";
        
        return `
            <div class="ref-card-v2" style="background: rgba(255,255,255,0.03); border: 1px solid ${isFav ? '#fbbf24' : 'var(--border-color)'}; padding: 12px; border-radius: 8px; margin-bottom: 8px; position: relative; transition: 0.2s;">
                
                <div style="position: absolute; top: 8px; right: 8px; display: flex; gap: 12px; align-items: center; z-index: 5;">
                    <i class="${isFav ? 'fa-solid' : 'fa-regular'} fa-star" 
                       onclick="event.stopPropagation(); window.toggleFavoritoFonte('links', '${ref.id}')" 
                       style="cursor:pointer; color: ${isFav ? '#fbbf24' : 'var(--text-muted)'}; font-size: 14px;"
                       title="Favoritar"></i>
                    
                    <i class="fa-solid fa-pen-to-square" onclick="event.stopPropagation(); ${onEdit}" 
                       style="cursor:pointer; color:var(--primary); font-size:12px;"
                       title="Editar"></i>
                </div>

                <a href="${ref.link}" target="_blank" style="text-decoration:none; color:inherit; display:block; padding-right: 45px;">
                    <p style="font-size:10px; color:var(--primary); font-weight:700; text-transform:uppercase; margin-bottom:4px;">
                        <i class="fa-solid fa-link"></i> ${ref.titulo || 'Link Direto'}
                    </p>
                    <p style="font-size:11px; color:var(--text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; opacity: 0.8;">
                        ${ref.link}
                    </p>
                </a>
            </div>
        `;
    },

    /**
     * RENDERIZAÇÃO DO CARD CODEX (ESTRUTURA PLANA - FLAT)
     * Cada item (oque + sequencia) gera um card independente na UI
     */
    renderCodexCard: (card, onEdit) => {
        const isFav = card.favorito === "sim";
        const siglaLimpa = (card.sigla || "").toLowerCase();
        const nomePublicacao = SIGLAS_PUBLICACOES[siglaLimpa] || "Referência Codex";

        // --- 1. DEFINIÇÃO DE ÍCONE POR TIPO (OQUE) ---
        let iconClass = "fa-paragraph"; // Padrão
        if (card.oque === 'pergunta') iconClass = "fa-question-circle";
        if (card.oque === 'discurso') iconClass = "fa-comment-dots";
        if (card.oque === 'subtema')  iconClass = "fa-heading";
        if (card.oque === 'video')    iconClass = "fa-play-circle";
        if (card.oque === 'musical')  iconClass = "fa-music";
        if (card.oque === 'resumo')   iconClass = "fa-list-check";
        if (card.oque === 'rodape')   iconClass = "fa-circle-info";

        // --- 2. GERAÇÃO DE PILLS (ETIQUETAS) ---
        let details = [];
        
        // Sequência do objeto semântico
        if (card.sequencia && card.sequencia.length > 0) {
            details.push(`<b style="text-transform:uppercase;">${card.oque.substring(0,3)}</b>: ${card.sequencia.join(', ')}`);
        }

        // Páginas
       if (card.paginas && card.paginas.length > 0) {
    // Se forem muitas páginas, abreviamos para não quebrar o layout
    const pDisplay = card.paginas.length > 5 
        ? `${card.paginas[0]}-${card.paginas[card.paginas.length-1]}` 
        : card.paginas.join(', ');
        
    details.push(`Pág: ${pDisplay}`);
}
        
        // Tempo (Multimédia)
        if (card.tempo) {
            details.push(`<i class="fa-solid fa-clock" style="font-size:8px;"></i> ${card.tempo}`);
        }

        // Data (Mês/Ano)
        if (card.ano || card.mes) {
            const dataStr = card.mes ? `${card.mes}/${card.ano}` : card.ano;
            details.push(dataStr);
        }

        const htmlPills = details.map(d => `
            <span style="font-size:9px; color:var(--text-muted); background:rgba(255,255,255,0.05); padding:2px 8px; border-radius:4px; border: 1px solid rgba(255,255,255,0.05); white-space: nowrap;">
                ${d}
            </span>
        `).join('');

        // --- 3. ÁREA DE TÍTULO (VÍDEO OU ARTIGO) ---
        const htmlTitulo = (card.titulo || card.artigo)
            ? `<div style="margin: 8px 0; padding: 10px; background: rgba(255,255,255,0.02); border-radius: 6px; border-left: 2px solid var(--primary); transition: 0.2s;">
                <p style="font-size: 12px; color: #f1f5f9; font-weight: 500; line-height: 1.4; margin:0;">${card.titulo || card.artigo}</p>
               </div>`
            : "";

        return `
            <div class="codex-card-v2" 
                onclick="window.saltarParaBiblioteca('${card.id}')"
                 style="background: rgba(255,255,255,0.03); border: 1px solid ${isFav ? '#fbbf24' : 'var(--border-color)'}; padding: 12px; border-radius: 8px; margin-bottom: 8px; position: relative; cursor: pointer; transition: all 0.2s ease;">
                
                <!-- BOTÕES DE ACÇÃO -->
                <div style="position: absolute; top: 12px; right: 12px; display: flex; gap: 12px; align-items: center; z-index: 10;">
                    <i class="${isFav ? 'fa-solid' : 'fa-regular'} fa-star" 
                       onclick="event.stopPropagation(); window.toggleFavoritoFonte('codex', '${card.id}')" 
                       style="color: ${isFav ? '#fbbf24' : 'var(--text-muted)'}; font-size: 14px; cursor: pointer;"
                       title="Favoritar"></i>
                    
                    <i class="fa-solid fa-pen-to-square" 
                       onclick="event.stopPropagation(); ${onEdit}" 
                       style="color:var(--primary); font-size:12px; cursor: pointer; display: ${onEdit ? 'block' : 'none'};"
                       title="Editar"></i>
                </div>
                
                <!-- CABEÇALHO: ÍCONE + TIPO + REFERÊNCIA -->
                <div style="display:flex; align-items:center; gap:12px; margin-bottom:4px; padding-right: 50px;">
                    <div style="width:32px; height:32px; background:rgba(99, 102, 241, 0.1); border-radius:6px; display:flex; align-items:center; justify-content:center; color:var(--primary); flex-shrink:0; border: 1px solid rgba(99, 102, 241, 0.1);">
                        <i class="fa-solid ${iconClass}"></i>
                    </div>
                    <div style="overflow:hidden; flex:1;">
                        <p style="font-size:12px; font-weight:700; color:white; margin:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                            ${nomePublicacao}
                        </p>
                        <p style="font-size:9px; color:var(--primary); text-transform:uppercase; margin:0; font-weight:800; letter-spacing:0.8px;">
                            ${card.referencia || 'Codex'}
                        </p>
                    </div>
                </div>

                <!-- TÍTULO DINÂMICO -->
                ${htmlTitulo}

                <!-- PILLS DE MAPEAMENTO (DADOS TÉCNICOS) -->
                <div style="display:flex; flex-wrap:wrap; gap:6px; border-top:1px solid rgba(255,255,255,0.06); padding-top:10px; margin-top:10px;">
                    ${htmlPills}
                    ${card.capitulo ? `<span style="font-size:9px; color:var(--text-muted); opacity:0.7;">Cap. ${card.capitulo}</span>` : ''}
                </div>
            </div>
        `;
    }
};