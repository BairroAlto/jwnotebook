// components/editor/modulos/tags/tags-handlers-referencias.js

const atualizarEyeFontes = () => {
    import('../../../direita/eye-fontes-nota.js').then(m => {
        m.carregarFontesGlobaisDaNota(window.caixasAtuais);
    });
};

const atualizarHub = (caixaAlvo) => {
    import('./tags-ui.js').then(m => m.renderizarHub(caixaAlvo));
};

export function adicionarReferencia(ctx, tipo = "completa") {
    const { caixaAlvo, persistir } = ctx;
    
    if (!caixaAlvo.referencias) caixaAlvo.referencias = [];

    const novaRef = {
        id: crypto.randomUUID(),
        tipo: tipo,
        titulo: "",
        link: "",
        descricao: "",
        timestamp: new Date().toISOString()
    };

    caixaAlvo.referencias.push(novaRef);
    persistir('referencias', caixaAlvo.referencias);
    renderizarCards(ctx);
    atualizarHub(caixaAlvo);
    dispararUpdateEyeFontes();
}

export function updateRef(id, campo, valor, ctx) {
    const { caixaAlvo, persistir } = ctx;
    if (!caixaAlvo.referencias) return;

    const idx = caixaAlvo.referencias.findIndex(r => r.id === id);
    if (idx !== -1) {
        caixaAlvo.referencias[idx][campo] = valor;
        persistir('referencias', caixaAlvo.referencias);
        atualizarHub(caixaAlvo);
        dispararUpdateEyeFontes();
    }
}

export function removerRef(id, ctx) {
    const { caixaAlvo, persistir } = ctx;
    caixaAlvo.referencias = (caixaAlvo.referencias || []).filter(r => r.id !== id);
    persistir('referencias', caixaAlvo.referencias);
    renderizarCards(ctx);
    atualizarHub(caixaAlvo);
    dispararUpdateEyeFontes();
}

function dispararUpdateEyeFontes() {
    import('../../../direita/eye-fontes-nota.js').then(m => {
        m.carregarFontesGlobaisDaNota(window.caixasAtuais);
    });
}

export function renderizarCards(ctx) {
    const { caixaAlvo } = ctx;
    const container = document.getElementById('container-referencias-cards');
    if (!container) return;

    const refs = caixaAlvo.referencias || [];
    if (refs.length === 0) {
        container.innerHTML = `<p style="text-align:center; padding:30px; color:gray; font-size:11px; opacity:0.5;">Nenhuma referÃªncia vinculada.</p>`;
        return;
    }

    container.innerHTML = refs.map(ref => {
        const isCompleta = ref.tipo !== "link";
        return `
        <div class="ref-card" style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); padding: 12px; border-radius: 8px; margin-bottom: 10px; position: relative;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 10px;">
                ${isCompleta ? 
                    `<input type="text" value="${ref.titulo}" oninput="window.updateRefManual('${ref.id}', 'titulo', this.value)" placeholder="TÃ­tulo..." style="flex:1; font-weight:700; background:transparent; border:none; color:white; outline:none; font-size:13px;">` 
                    : `<span style="font-size:10px; color:var(--primary); font-weight:800; text-transform:uppercase;"><i class="fa-solid fa-link"></i> Link Direto</span>`
                }
                <button type="button" class="tags-remove-btn" data-tags-remove="referencia" data-remove-id="${encodeURIComponent(String(ref.id || ''))}" style="color:#f87171; font-size:11px; padding:5px;" aria-label="Remover referência">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </div>
            <input type="text" value="${ref.link}" oninput="window.updateRefManual('${ref.id}', 'link', this.value)" placeholder="https://..." style="width:100%; font-size:11px; background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.05); padding:8px; border-radius:6px; color:#60a5fa; outline:none;">
        </div>`;
    }).join('');
}
