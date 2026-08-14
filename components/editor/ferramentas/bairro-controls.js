export function criarBotaoBairro({ icon, label, onClick, className = '', disabled = false }) {
    const botao = document.createElement('button');
    botao.type = 'button';
    botao.className = `bairro-control ${className}`.trim();
    botao.title = label;
    botao.setAttribute('aria-label', label);
    botao.disabled = disabled;
    const icone = document.createElement('i');
    icone.className = icon;
    icone.setAttribute('aria-hidden', 'true');
    botao.appendChild(icone);
    if (onClick) {
        botao.addEventListener('mousedown', event => event.preventDefault());
        botao.addEventListener('click', event => { event.stopPropagation(); onClick(event); });
    }
    return botao;
}

export function criarGrupoBairro() {
    const grupo = document.createElement('div');
    grupo.className = 'bairro-controls';
    return grupo;
}

export function criarCampoBairro({ value = '', placeholder = '', className = '' } = {}) {
    const campo = document.createElement('input');
    campo.type = 'text';
    campo.value = value || '';
    campo.placeholder = placeholder;
    campo.className = `bairro-input ${className}`.trim();
    return campo;
}