import { criarFilhoBairro, moverItemBairro, TIPO_CHECK_BAIRRO } from '../../constants/bairro.js';
import { criarBotaoBairro, criarCampoBairro, criarGrupoBairro } from './bairro-controls.js';
import { temActas } from '../modulos/bairro-actas.js';

function alterar(caixa, onTextoAlterado, renderizar) {
    onTextoAlterado(caixa);
    renderizar();
}

function registarEstadoTarefa(filho, concluido) {
    const agora = Date.now();
    filho.concluido = concluido;
    filho.timestamp = agora;
    filho.timestampRealizacao = concluido ? agora : null;
}

function alterarEstadoFilho({ caixa, pai, filho, linha, onTextoAlterado, renderizar }) {
    if (filho.__ocultarTimer) {
        clearTimeout(filho.__ocultarTimer);
        delete filho.__ocultarTimer;
        registarEstadoTarefa(filho, false);
        filho.oculto = false;
        linha.classList.remove('bairro-filho--concluido', 'bairro-filho--a-ocultar');
        onTextoAlterado(caixa, { tipo: 'tarefa_reaberta' });
        renderizar();
        return;
    }

    registarEstadoTarefa(filho, !filho.concluido);

    if (filho.concluido && pai.ocultarJaChecados) {
        onTextoAlterado(caixa, { tipo: 'tarefa_concluida' });
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

    onTextoAlterado(caixa, { tipo: filho.concluido ? 'tarefa_concluida' : 'tarefa_reaberta' });
    renderizar();
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

function criarActasButton({ caixa, pai, filho, onTextoAlterado, renderizar }) {
    if (!temActas(filho)) return null;
    return criarBotaoBairro({
        icon: 'fa-solid fa-file-lines',
        label: 'Abrir Histórico de Actas',
        className: 'bairro-control--acta',
        onClick: () => abrirPostoBairro(caixa, pai, filho, onTextoAlterado, renderizar, 'historico-actas')
    });
}
function adicionarNovaLinhaNoPai({ caixa, pai, filhoAtual, onTextoAlterado, renderizar }) {
    if (!pai) return;
    const novoFilho = criarFilhoBairro();
    novoFilho.check = pai.check || TIPO_CHECK_BAIRRO.NENHUM;
    novoFilho.criadaEm = Date.now();

    const indexAtual = (pai.pastafilho || []).indexOf(filhoAtual);
    if (indexAtual !== -1) {
        pai.pastafilho.splice(indexAtual + 1, 0, novoFilho);
    } else {
        if (caixa?.direcaoCriacao === 'cima') {
            pai.pastafilho.unshift(novoFilho);
        } else {
            pai.pastafilho.push(novoFilho);
        }
    }
    onTextoAlterado(caixa, { tipo: 'linha_adicionada' });
    renderizar();
    setTimeout(() => {
        const novoEl = document.querySelector(`[data-bairro-casa-id="${novoFilho.id}"] input, [data-bairro-casa-id="${novoFilho.id}"] .bairro-filho-nome`);
        if (novoEl) {
            if (novoEl.matches('input')) {
                novoEl.focus();
            } else {
                novoEl.click();
            }
        }
    }, 60);
}

function confirmarERemoverFilho({ caixa, filho, onTextoAlterado, renderizar }) {
    import('../modulos/bairro-posto.js').then(modulo => {
        modulo.abrirPopupConfirmarRemoverTarefa(filho.nome, () => {
            filho.oculto = true;
            filho.timestamp = Date.now();
            onTextoAlterado(caixa);
            renderizar();
        });
    });
}

function editarTituloFilhoInline({ caixa, pai, filho, elemento, onTextoAlterado, renderizar }) {
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
        if (event.key === 'Enter') {
            event.preventDefault();
            input.blur();
            adicionarNovaLinhaNoPai({ caixa, pai, filhoAtual: filho, onTextoAlterado, renderizar });
        } else if ((event.key === 'Backspace' || event.key === 'Delete') && !event.target.value.trim()) {
            event.preventDefault();
            input.blur();
            confirmarERemoverFilho({ caixa, filho, onTextoAlterado, renderizar });
        }
    });
    input.addEventListener('blur', () => {
        setTimeout(() => { if (filho.nome.trim()) renderizar(); }, 150);
    });
    elemento.replaceWith(input);
    input.focus();
    input.select();
}
function formatarDataCurta(timestamp) {
    if (!timestamp) return '';
    const d = new Date(timestamp);
    const dia = String(d.getDate()).padStart(2, '0');
    const mes = d.toLocaleString('pt-PT', { month: 'short' }).replace('.', '');
    const ano = String(d.getFullYear()).slice(-2);
    return `${dia} ${mes} ${ano}`;
}

function obterChaveData(timestamp, modo = 'dia') {
    if (!timestamp) return 'Sem Data';
    const d = new Date(timestamp);
    if (modo === 'mes') {
        const mes = d.toLocaleString('pt-PT', { month: 'long' });
        return `${mes.charAt(0).toUpperCase() + mes.slice(1)} ${d.getFullYear()}`;
    }
    if (modo === 'semana') {
        const temp = new Date(d.valueOf());
        const dayNum = (d.getDay() + 6) % 7;
        temp.setDate(temp.getDate() - dayNum + 3);
        const firstThursday = temp.valueOf();
        temp.setMonth(0, 1);
        if (temp.getDay() !== 4) {
            temp.setMonth(0, 1 + ((4 - temp.getDay() + 7) % 7));
        }
        const numSemana = 1 + Math.round((firstThursday - temp.valueOf()) / 604800000);
        return `Semana ${numSemana} (${d.toLocaleString('pt-PT', { month: 'short' })} ${d.getFullYear()})`;
    }
    const dia = d.getDate();
    const mes = d.toLocaleString('pt-PT', { month: 'long' });
    const ano = String(d.getFullYear()).slice(-2);
    return `${dia} ${mes.charAt(0).toUpperCase() + mes.slice(1)} ${ano}`;
}

function renderizarFilho({ caixa, pai, filho, onTextoAlterado, renderizar }) {
    if (!filho.criadaEm) filho.criadaEm = filho.timestamp || Date.now();
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
            editarTituloFilhoInline({ caixa, pai, filho, elemento: nome, onTextoAlterado, renderizar });
        });
    } else {
        nome = criarCampoBairro({ value: filho.nome, placeholder: 'Nome da tarefa...', className: 'bairro-filho-nome' });
        nome.addEventListener('input', event => {
            filho.nome = event.target.value;
            onTextoAlterado(caixa);
        });
        nome.addEventListener('click', event => event.stopPropagation());
        nome.addEventListener('keydown', event => {
            if (event.key === 'Enter') {
                event.preventDefault();
                nome.blur();
                adicionarNovaLinhaNoPai({ caixa, pai, filhoAtual: filho, onTextoAlterado, renderizar });
            } else if ((event.key === 'Backspace' || event.key === 'Delete') && !event.target.value.trim()) {
                event.preventDefault();
                nome.blur();
                confirmarERemoverFilho({ caixa, filho, onTextoAlterado, renderizar });
            }
        });
        nome.addEventListener('blur', () => {
            setTimeout(() => { if (filho.nome.trim()) renderizar(); }, 150);
        });
    }

    const acoes = criarGrupoBairro();
    const actas = criarActasButton({ caixa, pai, filho, onTextoAlterado, renderizar });
    if (actas) acoes.appendChild(actas);

    if (caixa?.mostrarDataRealizacaoTarefa && filho.timestampRealizacao) {
        const spanDataRealizacao = document.createElement('span');
        spanDataRealizacao.className = 'bairro-filho-data bairro-filho-data--realizacao';
        const tsRealizacao = filho.timestampRealizacao;
        spanDataRealizacao.innerHTML = `<i class="fa-solid fa-check" aria-hidden="true"></i> ${formatarDataCurta(tsRealizacao)}`;
        spanDataRealizacao.title = `Realizada em: ${new Date(tsRealizacao).toLocaleString('pt-PT')}`;
        acoes.appendChild(spanDataRealizacao);
    }

    if (caixa?.mostrarDataTarefa) {
        const spanData = document.createElement('span');
        spanData.className = 'bairro-filho-data';
        const ts = filho.criadaEm || filho.timestamp;
        spanData.innerHTML = `<i class="fa-regular fa-calendar" aria-hidden="true"></i> ${formatarDataCurta(ts)}`;
        spanData.title = `Criado em: ${ts ? new Date(ts).toLocaleString('pt-PT') : 'Sem data'}`;
        acoes.appendChild(spanData);
    }

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
            filho.criadaEm = Date.now();
            if (caixa.direcaoCriacao === 'cima') {
                pai.pastafilho.unshift(filho);
            } else {
                pai.pastafilho.push(filho);
            }
            onTextoAlterado(caixa, { tipo: 'linha_adicionada' });
            renderizar();
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
    const validos = pai.pastafilho.filter(filho => !filho.oculto && !(pai.ocultarJaChecados && filho.concluido));
    validos.forEach(filho => {
        if (!filho.criadaEm) filho.criadaEm = filho.timestamp || Date.now();
    });

    if (caixa?.organizarPorData) {
        const modo = caixa.agruparDataModo || 'dia';
        const grupos = new Map();
        validos.forEach(filho => {
            const chave = obterChaveData(filho.criadaEm || filho.timestamp, modo);
            if (!grupos.has(chave)) grupos.set(chave, []);
            grupos.get(chave).push(filho);
        });

        grupos.forEach((listaFilhos, chave) => {
            const headerGrupo = document.createElement('div');
            headerGrupo.className = 'bairro-grupo-data-header';
            headerGrupo.innerHTML = `<i class="fa-regular fa-calendar-days" aria-hidden="true"></i> ${chave}`;
            filhos.appendChild(headerGrupo);

            listaFilhos.forEach(filho => {
                filhos.appendChild(renderizarFilho({ caixa, pai, filho, onTextoAlterado, renderizar }));
            });
        });
    } else {
        validos.forEach(filho => {
            filhos.appendChild(renderizarFilho({ caixa, pai, filho, onTextoAlterado, renderizar }));
        });
    }
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
