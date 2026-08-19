const PLAN_LABELS = {
    free: 'Plano Free',
    premium: 'Plano Premium',
    premium_plus: 'Plano Premium Plus'
};

export function acessoDoItem(item, acessos) {
    return acessos.get(item.featureKey) || {
        min_plan: 'free',
        active: 0,
        allowed: false
    };
}

export function criarCartaoLoja(item, instalados, acesso, aoAlternar) {
    const instalado = instalados.includes(item.id);
    const permitido = acesso.allowed !== false && Number(acesso.active) !== 0;
    const cartao = document.createElement('article');
    cartao.className = 'tool-store-card';
    cartao.innerHTML = `
        <div class="tool-store-card__icon" style="color:${item.corInterface};"><i class="${item.icon}"></i></div>
        <div class="tool-store-card__body">
            <h4>${item.nome}</h4>
            <p>${item.descricao}</p>
            <span class="tool-store-card__plan">${PLAN_LABELS[acesso.min_plan] || PLAN_LABELS.free}</span>
        </div>
        <button type="button" class="tool-store-card__action${instalado ? ' tool-store-card__action--remove' : ''}">${permitido ? (instalado ? 'Desinstalar' : 'Adicionar') : 'Sem acesso'}</button>
    `;

    const botao = cartao.querySelector('.tool-store-card__action');
    botao.disabled = !permitido;
    botao.onclick = () => aoAlternar(item.id);
    return cartao;
}

