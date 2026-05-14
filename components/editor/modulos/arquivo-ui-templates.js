// components/editor/modulos/arquivo-ui-templates.js

const estilos = `
<style>
    .arquivo-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        gap: 15px;
        margin-top: 10px;
    }

    .gaveta-card {
        height: 120px;
        background: linear-gradient(145deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.01) 100%);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 12px;
        padding: 20px;
        display: flex;
        flex-direction: column;
        justify-content: flex-end;
        cursor: pointer;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        position: relative;
        overflow: hidden;
    }

    .gaveta-card:hover {
        background: rgba(255, 255, 255, 0.08);
        transform: translateY(-4px);
        border-color: var(--primary);
        box-shadow: 0 10px 20px rgba(0, 0, 0, 0.3);
    }

    .gaveta-titulo { font-weight: 700; color: #f8fafc; font-size: 16px; margin-bottom: 4px; }
    .gaveta-info { font-size: 10px; color: var(--text-muted); text-transform: uppercase; font-weight: 600; display: flex; gap: 10px; }

    .modo-edicao-ativo {
        border: 1px dashed var(--primary) !important;
        background: rgba(99, 102, 241, 0.05) !important;
        animation: labVibration 0.3s infinite;
    }

    /* Badge flutuante de edição nos cards */
    .btn-edit-card {
        position: absolute;
        top: 10px;
        right: 10px;
        background: var(--primary);
        color: white !important;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        display: flex !important;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 10px rgba(0,0,0,0.3);
        font-size: 10px;
        z-index: 5;
    }

    .prateleira-card {
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 8px;
        padding: 14px;
        text-align: center;
        font-weight: 800;
        font-size: 11px;
        color: #94a3b8;
        text-transform: uppercase;
        cursor: pointer;
        transition: 0.2s;
        position: relative;
    }

    .prateleira-card:hover { background: white; color: #0f172a; border-color: white; }

    .arquivo-nav-header { display: flex; align-items: center; gap: 15px; margin-bottom: 25px; }

    @keyframes labVibration {
        0% { transform: rotate(0deg); }
        25% { transform: rotate(0.4deg); }
        75% { transform: rotate(-0.4deg); }
        100% { transform: rotate(0deg); }
    }

    /* Estilos para botões de formulário (Popups do Arquivo) */
    .lab-btn {
        padding: 12px 20px;
        border-radius: 10px;
        font-size: 13px;
        font-weight: 700;
        cursor: pointer;
        transition: 0.2s;
        border: 1px solid transparent;
    }
    .btn-lab-save { background: var(--primary); color: white; }
    .btn-lab-cancel { background: rgba(255, 255, 255, 0.05); color: var(--text-muted); border-color: rgba(255, 255, 255, 0.1); }
    .btn-lab-remove { background: rgba(239, 68, 68, 0.1); color: #f87171; margin-right: auto; }
</style>
`;

export const ArquivoTemplates = {
    /**
     * VISTA RAIZ: Lista de Gavetas
     */
    raiz: (gavetas, modoEdicao) => {
        const htmlGavetas = gavetas.map(g => `
            <div class="gaveta-card ${modoEdicao ? 'modo-edicao-ativo' : ''}" data-id="${g.id}" style="border-left: 6px solid ${g.cor || '#6366f1'}">
                ${modoEdicao ? `<div class="btn-edit-card"><i class="fa-solid fa-pen"></i></div>` : ''}
                <div class="gaveta-titulo">${g.nome}</div>
                <div class="gaveta-info">
                    <span><i class="fa-solid fa-layer-group"></i> ${Object.keys(g.prateleiras || {}).length}</span>
                    <span><i class="fa-solid fa-box"></i> ${g.caixas?.length || 0}</span>
                </div>
            </div>
        `).join('');

        return estilos + `<div class="arquivo-grid">${htmlGavetas}</div>`;
    },

    /**
     * VISTA GAVETA: Lista de Prateleiras + Blocos soltos na gaveta
     */
    gaveta: (gaveta, modoEdicao) => {
        const htmlPrateleiras = Object.values(gaveta.prateleiras || {}).filter(p => p.estado !== 'desativo').map(p => `
            <div class="prateleira-card ${modoEdicao ? 'modo-edicao-ativo' : ''}" data-id="${p.id}">
                ${modoEdicao ? `<div class="btn-edit-card" style="width:20px; height:20px; top:-5px; right:-5px;"><i class="fa-solid fa-pen"></i></div>` : ''}
                ${p.nome}
            </div>
        `).join('');

        return estilos + `
            <div class="arquivo-nav-header">
                <button class="btn-amt" id="btn-voltar-raiz" style="width:36px; height:36px; border-radius:50%; background: rgba(255,255,255,0.05); cursor:pointer;">
                    <i class="fa-solid fa-arrow-left"></i>
                </button>
                <h3 style="color:white; margin:0; font-size:20px; font-weight:800;">${gaveta.nome}</h3>
            </div>
            
            <div class="arquivo-grid" style="grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));">
                ${htmlPrateleiras}
            </div>

            <div id="caixas-foco" style="margin-top:40px; border-top:1px solid rgba(255,255,255,0.05); padding-top:30px;">
                <!-- Blocos vinculados à gaveta aparecem aqui -->
            </div>
        `;
    },

    /**
     * VISTA PRATELEIRA: Lista de blocos arquivados na prateleira
     */
    prateleira: (prateleira) => estilos + `
        <div class="arquivo-nav-header">
            <button class="btn-amt" id="btn-voltar-gaveta" style="width:32px; height:32px; border-radius:50%; background: rgba(255,255,255,0.05); cursor:pointer;">
                <i class="fa-solid fa-arrow-left"></i>
            </button>
            <h3 style="color:white; margin:0; font-size:16px; opacity:0.8;">${prateleira.nome}</h3>
        </div>

        <div id="caixas-foco">
            <!-- Blocos vinculados à prateleira aparecem aqui -->
        </div>
    `
};