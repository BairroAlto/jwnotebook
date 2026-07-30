const ACTA_PREFIXO_ID = 'acta';

function criarIdActa() {
    return `${ACTA_PREFIXO_ID}-${crypto.randomUUID()}`;
}

function obterTimestamp(acta) {
    return acta.atualizadaEm || acta.criadaEm || 0;
}

export function garantirActas(filho) {
    if (!filho) return [];
    if (!Array.isArray(filho.actas)) filho.actas = [];
    filho.actas = filho.actas.filter(acta => acta && typeof acta.texto === 'string');
    filho.actas.forEach(acta => {
        if (!acta.id) acta.id = criarIdActa();
        if (!acta.criadaEm) acta.criadaEm = Date.now();
        if (!acta.atualizadaEm) acta.atualizadaEm = acta.criadaEm;
    });
    return filho.actas;
}

export function temActas(filho) {
    return garantirActas(filho).some(acta => acta.texto.trim());
}

function formatarData(timestamp) {
    if (!timestamp) return 'Sem data';
    return new Intl.DateTimeFormat('pt-PT', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(timestamp));
}

function criarTextoVazio(mensagem) {
    const vazio = document.createElement('p');
    vazio.className = 'bairro-posto-actas-vazio';
    vazio.textContent = mensagem;
    return vazio;
}

function ajustarAlturaActa(textarea) {
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
}
function criarBotaoAcao(texto, classe = '') {
    const botao = document.createElement('button');
    botao.type = 'button';
    botao.className = `bairro-posto-acta-acao ${classe}`.trim();
    botao.textContent = texto;
    return botao;
}

function criarBotaoApagar() {
    const botao = document.createElement('button');
    botao.type = 'button';
    botao.className = 'bairro-posto-acta-apagar';
    botao.title = 'Apagar acta';
    botao.setAttribute('aria-label', 'Apagar acta');
    botao.innerHTML = '<i class="fa-solid fa-trash-can" aria-hidden="true"></i>';
    return botao;
}
function criarEditorActa({ acta, rascunho = false, guardar, aoTerminar, apagar }) {
    const item = document.createElement('article');
    item.className = `bairro-posto-acta${rascunho ? ' bairro-posto-acta--rascunho' : ''}`;
    const cabecalho = document.createElement('div');
    cabecalho.className = 'bairro-posto-acta-cabecalho-item';
    const data = document.createElement('small');
    data.textContent = rascunho ? 'Nova acta' : formatarData(obterTimestamp(acta));
    const acoes = document.createElement('div');
    acoes.className = 'bairro-posto-acta-acoes';
    if (!rascunho) {
        const botaoApagar = criarBotaoApagar();
        botaoApagar.addEventListener('click', () => apagar?.(acta));
        acoes.appendChild(botaoApagar);
    }
    cabecalho.append(data, acoes);

    const texto = document.createElement('textarea');
    texto.className = 'bairro-posto-acta-texto';
    texto.rows = 4;
    texto.placeholder = 'Escreve o texto da acta...';
    texto.value = acta.texto || '';

    texto.addEventListener('input', () => {
        if (acta._rascunho && texto.value.trim()) {
            acta.id = criarIdActa();
            acta.criadaEm = Date.now();
            acta.atualizadaEm = acta.criadaEm;
            acta._rascunho = false;
            guardar(acta, true);
            item.classList.remove('bairro-posto-acta--rascunho');
            data.textContent = formatarData(obterTimestamp(acta));
        }
        acta.texto = texto.value;
        if (!rascunho || texto.value.trim()) {
            acta.atualizadaEm = Date.now();
            guardar(acta, false);
        }
    });

    texto.addEventListener('blur', () => {
        if (acta._rascunho && !texto.value.trim()) aoTerminar?.(item);
    });

    item.append(cabecalho, texto);
    return { item, texto };
}

function criarItemHistorico({ acta, guardar, apagar }) {
    const item = document.createElement('article');
    item.className = 'bairro-posto-acta bairro-posto-acta--historico';
    const cabecalho = document.createElement('div');
    cabecalho.className = 'bairro-posto-acta-cabecalho-item';
    const data = document.createElement('small');
    data.textContent = formatarData(obterTimestamp(acta));
    const acoes = document.createElement('div');
    acoes.className = 'bairro-posto-acta-acoes';
    const editar = criarBotaoAcao('Editar');
    const botaoApagar = criarBotaoApagar();
    botaoApagar.addEventListener('click', () => apagar?.(acta));
    acoes.append(editar, botaoApagar);
    const leitura = document.createElement('div');
    leitura.className = 'bairro-posto-acta-leitura';
    leitura.textContent = acta.texto;

    const texto = document.createElement('textarea');
    texto.className = 'bairro-posto-acta-texto';
    texto.rows = 1;
    texto.value = acta.texto;
    texto.hidden = true;
    ajustarAlturaActa(texto);

    editar.addEventListener('click', () => {
        const vaiEditar = texto.hidden;
        texto.hidden = !vaiEditar;
        leitura.hidden = vaiEditar;
        editar.textContent = vaiEditar ? 'Guardar' : 'Editar';
        if (vaiEditar) {
            ajustarAlturaActa(texto);
            texto.focus();
        }
    });
    texto.addEventListener('input', () => {
        acta.texto = texto.value;
        leitura.textContent = texto.value;
        ajustarAlturaActa(texto);
        acta.atualizadaEm = Date.now();
        data.textContent = formatarData(obterTimestamp(acta));
        guardar(acta, false);
    });
    cabecalho.append(data, acoes);
    item.append(cabecalho, leitura, texto);
    return item;
}

function abrirConfirmacaoApagarActa(aoConfirmar) {
    const overlay = document.getElementById('popup-confirmar-acta-overlay');
    const cancelar = document.getElementById('btn-cancelar-apagar-acta');
    const confirmar = document.getElementById('btn-confirmar-apagar-acta');
    if (!overlay || !cancelar || !confirmar) {
        console.error('[ACTAS] Popup de confirmação não está disponível.');
        return;
    }
    const fechar = () => overlay.classList.remove('active');
    cancelar.onclick = fechar;
    confirmar.onclick = () => {
        fechar();
        aoConfirmar();
    };
    overlay.classList.add('active');
}
export function criarGestorActas({ filho, lista, listaHistorico, botaoAdicionar, guardar, aoAbrirHistorico }) {
    const actas = garantirActas(filho);
    let rascunho = null;

    function guardarActa(acta, foiCriada) {
        if (foiCriada && !actas.includes(acta)) actas.unshift(acta);
        acta._rascunho = false;
        if (rascunho === acta) rascunho = null;
        guardar();
    }

    function apagarActa(acta) {
        const indice = actas.indexOf(acta);
        if (indice < 0) return;
        abrirConfirmacaoApagarActa(() => {
            actas.splice(indice, 1);
            guardar();
            renderizarLista();
            renderizarHistorico();
        });
    }

    function renderizarLista() {
        lista?.replaceChildren();
        const validas = actas.filter(acta => acta.texto.trim()).sort((a, b) => obterTimestamp(b) - obterTimestamp(a));
        if (!validas.length && !rascunho) lista?.appendChild(criarTextoVazio('Ainda não existem actas. Clica em + para criar uma.'));
        validas.forEach(acta => lista?.appendChild(criarEditorActa({ acta, guardar: guardarActa, apagar: apagarActa }).item));
        if (rascunho && rascunho._rascunho) {
            const editor = criarEditorActa({ acta: rascunho, rascunho: true, guardar: guardarActa, aoTerminar: item => { rascunho = null; item.remove(); } });
            lista?.appendChild(editor.item);
            setTimeout(() => editor.texto.focus(), 0);
        }
    }

    function renderizarHistorico() {
        listaHistorico?.replaceChildren();
        const validas = actas.filter(acta => acta.texto.trim()).sort((a, b) => obterTimestamp(b) - obterTimestamp(a));
        if (!validas.length) {
            listaHistorico?.appendChild(criarTextoVazio('Ainda não existem actas.'));
            return;
        }
        validas.forEach(acta => listaHistorico?.appendChild(criarItemHistorico({ acta, guardar: guardarActa, apagar: apagarActa })));
    }

    if (botaoAdicionar) {
        botaoAdicionar.onclick = () => {
            if (rascunho) return;
            rascunho = { texto: '', criadaEm: Date.now(), atualizadaEm: Date.now(), _rascunho: true };
            renderizarLista();
        };
    }

    renderizarLista();
    renderizarHistorico();
    return { renderizarLista, renderizarHistorico, abrirHistorico: aoAbrirHistorico };
}
