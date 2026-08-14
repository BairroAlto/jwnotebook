export function criarBotaoElevador({ icon, label, onClick, className = '', disabled = false }) {
    const botao = document.createElement('button');
    botao.type = 'button';
    botao.className = `elevador-control ${className}`.trim();
    botao.title = label;
    botao.setAttribute('aria-label', label);
    botao.disabled = disabled;

    const icone = document.createElement('i');
    icone.className = icon;
    icone.setAttribute('aria-hidden', 'true');
    botao.appendChild(icone);

    botao.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        onClick?.(event);
    });

    return botao;
}

export function criarCampoElevador({ value = '', placeholder = '', className = '', multiline = false }) {
    const campo = document.createElement(multiline ? 'textarea' : 'input');
    campo.className = className;
    campo.value = String(value ?? '');
    campo.placeholder = placeholder;
    if (!multiline) campo.type = 'text';
    if (multiline) {
        campo.rows = 1;
        campo.addEventListener('input', () => {
            campo.style.height = 'auto';
            campo.style.height = `${campo.scrollHeight + 2}px`;
        });
    }
    return campo;
}

export function criarGrupoControlosElevador() {
    const grupo = document.createElement('div');
    grupo.className = 'elevador-controls';
    return grupo;
}
