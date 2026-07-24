import { criarFilhoBairro, moverItemBairro, TIPO_CHECK_BAIRRO } from '../../constants/bairro.js';
import { criarBotaoBairro, criarCampoBairro, criarGrupoBairro } from './bairro-controls.js';

function alterar(caixa, onTextoAlterado, renderizar) {
    onTextoAlterado(caixa);
    renderizar();
}

function alterarEstadoFilho({ caixa, pai, filho, linha, onTextoAlterado, renderizar }) {
    if (filho.__ocultarTimer) {
        clearTimeout(filho.__ocultarTimer);
        delete filho.__ocultarTimer;
        filho.concluido = false;
        filho.oculto = false;
        filho.timestamp = Date.now();
        linha.classList.remove('bairro-filho--concluido', 'bairro-filho--a-ocultar');
        alterar(caixa, onTextoAlterado, renderizar);
        return;
    }

    filho.concluido = !filho.concluido;
    filho.timestamp = Date.now();

    if (filho.concluido && pai.ocultarJaChecados) {
        onTextoAlterado(caixa);
        linha.classList.add('bairro-filho--concluido');
        if (filho.__ocultarTimer) clearTimeout(filho.__ocultarTimer);
        const timer = setTimeout(() => {
            filho.oculto = true;
            delete filho.__ocultarTimer;
            onTextoAlterado(caixa);
            linha.classList.add('bairro-filho--a-ocultar');
            setTimeout(renderizar, 180);
        }, 1400);
        Object.defineProperty(filho, '__ocultarTimer', { value: timer, writable: true, configurable: true });
        return;
    }

    alterar(caixa, onTextoAlterado, renderizar);
}

function abrirPostoBairro(...argumentos) {
    import('../modulos/bairro-posto.js')
        .then(modulo => modulo.abrirBairroPosto(...argumentos))
        .catch(error => console.error('[BAIRRO] Não foi possível abrir o Posto de Ligação:', error));
}

function abrirLigacaoBairro(ligacao) {
    import('../modulos/bairro-ligacoes.js')
        .then(modulo => modulo.irParaLigacaoBairro(ligacao))
        .catch(error => console.error('[BAIRRO] Não foi possível abrir a ligação:', error));
}

function criarCheckVisual(tipo, concluido) {
    const check = document.createElement('span');
    check.className = `bairro-check bairro-check--${tipo || TIPO_CHECK_BAIRRO.NENHUM}${concluido ? ' is-done' : ''}`;
    check.setAttribute('aria-hidden', 'true');
    if (tipo === TIPO_CHECK_BAIRRO.BOLA) check.textContent = concluido ? String.fromCodePoint(0x2713) : '';
    if (tipo === TIPO_CHECK_BAIRRO.QUADRADO) check.textContent = concluido ? String.fromCodePoint(0x2713) : '';
    if (tipo === TIPO_CHECK_BAIRRO.SETA) check.textContent = concluido ? String.fromCodePoint(0x2713) : String.fromCodePoint(0x203A);
    return check;
}

function criarLigacaoButton(ligacao) {
    return criarBotaoBairro({
        icon: 'fa-solid fa-arrow-up-right-from-square',
        label: `Ir para ${ligacao.nome || 'ligação'}`,
        className: 'bairro-control--link',
        onClick: () => abrirLigacaoBairro(ligacao)
    });
}

function editarTituloFilhoInline({ caixa, filho, elemento, onTextoAlterado, renderizar }) {
    const input = criarCampoBairro({
        value: filho.nome,
        placeholder: 'Nome da tarefa...',
        className: 'bairro-filho-nome'
    });
    input.addEventListener('input', event => {
        filho.nome = event.target.value;
        onTextoAlterado(caixa);
    });
    input.addEventListener('click', event => event.stopPropagation());
    input.addEventListener('keydown', event => {
        if (event.key === 'Enter') input.blur();
    });
    input.addEventListener('blur', () => {
        setTimeout(() => { if (filho.nome.trim()) renderizar(); }, 150);
    });
    elemento.replaceWith(input);
    input.focus();
    input.select();
}
function renderizarFilho({ caixa, pai, filho, onTextoAlterado, renderizar }) {
    const linha = document.createElement('div');
    linha.className = `bairro-filho${filho.concluido ? ' bairro-filho--concluido' : ''}`;
    linha.dataset.bairroCasaId = filho.id;

    const check = criarCheckVisual(filho.check, filho.concluido);
    if (filho.check === TIPO_CHECK_BAIRRO.NENHUM) {
        linha.classList.add('bairro-filho--clicavel');
        linha.addEventListener('click', event => {
            if (event.target.closest('button, input, .bairro-controls')) return;
            alterarEstadoFilho({ caixa, pai, filho, linha, onTextoAlterado, renderizar });
        });
    }

    check.classList.add('bairro-check-button');
    check.removeAttribute('aria-hidden');
    check.setAttribute('role', 'button');
    check.setAttribute('aria-label', 'Marcar como concluído');
    check.setAttribute('aria-pressed', String(filho.concluido));
    check.tabIndex = 0;
    check.title = 'Marcar como concluído';
    check.addEventListener('click', event => {
        event.stopPropagation();
        if (filho.check === TIPO_CHECK_BAIRRO.NENHUM) return;
        alterarEstadoFilho({ caixa, pai, filho, linha, onTextoAlterado, renderizar });
    });

    let nome;
    if (filho.nome.trim()) {
        nome = document.createElement('button');
        nome.type = 'button';
        nome.className = 'bairro-filho-nome bairro-filho-titulo';
        nome.textContent = filho.nome;
        nome.title = 'Editar título no Posto de Ligação';
        nome.addEventListener('click', event => {
            event.stopPropagation();
            if (filho.check === TIPO_CHECK_BAIRRO.NENHUM) {
                alterarEstadoFilho({ caixa, pai, filho, linha, onTextoAlterado, renderizar });
                return;
            }
            editarTituloFilhoInline({ caixa, filho, elemento: nome, onTextoAlterado, renderizar });
        });
    } else {
        nome = criarCampoBairro({ value: filho.nome, placeholder: 'Nome da tarefa...', className: 'bairro-filho-nome' });
        nome.addEventListener('input', event => {
            filho.nome = event.target.value;
            onTextoAlterado(caixa);
        });
        nome.addEventListener('click', event => event.stopPropagation());
        nome.addEventListener('blur', () => {
            setTimeout(() => { if (filho.nome.trim()) renderizar(); }, 150);
        });
    }

    const acoes = criarGrupoBairro();
    const ligacao = filho['ligaçãoBairro']?.[0];
    if (ligacao) acoes.appendChild(criarLigacaoButton(ligacao));
    acoes.appendChild(criarBotaoBairro({
        icon: 'fa-solid fa-ellipsis-vertical',
        label: 'Abrir Posto de Ligação do filho',
        className: 'bairro-control--muted',
        onClick: () => abrirPostoBairro(caixa, pai, filho, onTextoAlterado, renderizar)
    }));

    linha.append(check, nome, acoes);
    return linha;
}

function renderizarPai({ caixa, pai, onTextoAlterado, renderizar }) {
    const secao = document.createElement('section');
    secao.className = 'bairro-pai';
    secao.dataset.bairroPaiId = pai.id;

    const cabecalho = document.createElement('header');
    cabecalho.className = 'bairro-pai-header';
    const titulo = criarCampoBairro({ value: pai.nome, placeholder: 'Escreva algo...', className: 'bairro-pai-nome' });
    titulo.addEventListener('input', event => {
        pai.nome = event.target.value;
        onTextoAlterado(caixa);
    });

    const acoes = criarGrupoBairro();
    acoes.appendChild(criarBotaoBairro({
        icon: 'fa-solid fa-plus',
        label: 'Adicionar Tarefa',
        className: 'bairro-control--add',
        onClick: () => {
            const filho = criarFilhoBairro();
            filho.check = pai.check || TIPO_CHECK_BAIRRO.NENHUM;
            if (caixa.direcaoCriacao === 'cima') {
                pai.pastafilho.unshift(filho);
            } else {
                pai.pastafilho.push(filho);
            }
            alterar(caixa, onTextoAlterado, renderizar);
            setTimeout(() => secao.querySelector(`[data-bairro-casa-id="${filho.id}"] input`)?.focus(), 0);
        }
    }));
    acoes.appendChild(criarBotaoBairro({
        icon: 'fa-solid fa-ellipsis-vertical',
        label: 'Abrir Posto de Ligação do bairro',
        className: 'bairro-control--muted',
        onClick: () => abrirPostoBairro(caixa, pai, null, onTextoAlterado, renderizar)
    }));

    cabecalho.append(titulo, acoes);
    const filhos = document.createElement('div');
    filhos.className = 'bairro-filhos';
    pai.pastafilho.filter(filho => !filho.oculto && !(pai.ocultarJaChecados && filho.concluido)).forEach(filho => {
        filhos.appendChild(renderizarFilho({ caixa, pai, filho, onTextoAlterado, renderizar }));
    });
    secao.append(cabecalho, filhos);
    return secao;
}

export function renderizarEstruturaBairro({ caixa, corpo, onTextoAlterado }) {
    let renderizar;
    renderizar = () => {
        corpo.replaceChildren();
        if (!caixa.pastapai.length) {
            const vazio = document.createElement('div');
            vazio.className = 'bairro-sem-pai';
            vazio.appendChild(criarBotaoBairro({
                icon: 'fa-solid fa-ellipsis',
                label: 'Abrir Posto de Ligação do Bairro',
                onClick: () => abrirPostoBairro(caixa, null, null, onTextoAlterado, renderizar)
            }));
            corpo.appendChild(vazio);
            return;
        }
        caixa.pastapai.filter(pai => !pai.oculto).forEach(pai => {
            corpo.appendChild(renderizarPai({ caixa, pai, onTextoAlterado, renderizar }));
        });
    };
    renderizar();
    return renderizar;
}
