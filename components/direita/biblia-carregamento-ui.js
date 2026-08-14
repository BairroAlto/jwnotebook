export function mostrarCarregamentoCaixas(container, {
    area = "Brain",
    cor = "#818cf8",
    mensagem = "A carregar caixas associadas..."
} = {}) {
    if (!container) return;

    const loadingAtual = container.querySelector(`[data-biblia-loading="${area}"]`);
    if (loadingAtual) {
        const texto = loadingAtual.querySelector('[data-loading-message]');
        if (texto) texto.textContent = mensagem;
        return;
    }

    container.innerHTML = `
        <div class="brain-loading-skeleton" data-biblia-loading="${area}"
             style="padding:10px 0; display:flex; flex-direction:column; gap:14px; animation:fadeIn 0.2s ease;">
            <div style="display:flex; align-items:center; justify-content:space-between; padding:12px 14px; background:rgba(255,255,255,0.03); border-radius:8px; border:1px solid rgba(255,255,255,0.06);">
                <div style="display:flex; align-items:center; gap:10px;">
                    <i class="fa-solid fa-circle-notch fa-spin" style="color:${cor}; font-size:16px;"></i>
                    <span data-loading-message style="font-size:11px; font-weight:700; color:#cbd5e1; letter-spacing:0.3px;">
                        ${mensagem}
                    </span>
                </div>
                <span style="font-size:9px; color:#64748b; font-weight:800; text-transform:uppercase;">${area}</span>
            </div>
            <div style="background:rgba(255,255,255,0.02); border-left:4px solid ${cor}; border-radius:8px; padding:14px; border:1px solid rgba(255,255,255,0.04); display:flex; flex-direction:column; gap:10px;">
                <div class="skeleton-pulse" style="width:48%; height:11px; background:rgba(255,255,255,0.08); border-radius:4px;"></div>
                <div class="skeleton-pulse" style="width:90%; height:9px; background:rgba(255,255,255,0.05); border-radius:4px;"></div>
                <div class="skeleton-pulse" style="width:66%; height:9px; background:rgba(255,255,255,0.05); border-radius:4px;"></div>
            </div>
        </div>
    `;
}
export function mostrarErroCarregamentoCaixas(container, {
    area = "Brain",
    cor = "#fb7185",
    mensagem = "Não foi possível carregar as caixas associadas."
} = {}) {
    if (!container) return;
    container.innerHTML = `
        <div data-biblia-loading="${area}" style="padding:24px 12px; text-align:center; color:#cbd5e1;">
            <i class="fa-solid fa-triangle-exclamation" style="font-size:18px; color:${cor}; margin-bottom:10px;"></i>
            <div style="font-size:11px; font-weight:700;">${mensagem}</div>
            <div style="font-size:10px; color:#64748b; margin-top:6px;">Verifica a ligação e tenta abrir novamente.</div>
        </div>`;
}