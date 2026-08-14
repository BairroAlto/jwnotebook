import { criarFilhoBairro, moverItemBairro, TIPO_CHECK_BAIRRO } from '../../constants/bairro.js';
import { criarBotaoBairro, criarCampoBairro, criarGrupoBairro } from './bairro-controls.js';
import { temActas } from '../modulos/bairro-actas.js';
import { listarFicheiros } from '../../storage/storage-client.js';
import { criarSecaoMeuBairro } from './bairro-meu-bairro.js';

function executarQuandoElementoDisponivel(contentor, localizar, aoEncontrar) {
    if (!contentor) {
        setTimeout(() => {
            const elemento = localizar();
            if (elemento) aoEncontrar(elemento);
        }, 60);
        return;
    }

    const tentar = () => {
        const elemento = localizar();
        if (!elemento) return false;
        aoEncontrar(elemento);
        return true;
    };

    if (tentar()) return;
    if (typeof MutationObserver === 'undefined') {
        setTimeout(tentar, 100);
        return;
    }

    const observador = new MutationObserver(() => {
        if (tentar()) observador.disconnect();
    });
    observador.observe(contentor, { childList: true, subtree: true });
    setTimeout(() => observador.disconnect(), 5000);
}

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

function adicionarIndicadorFicheiros({ acoes, referenciaActas, ficheirosPorTarefa, caixa, pai, filho, onTextoAlterado, renderizar }) {
    if (!ficheirosPorTarefa?.get(filho?.id)) return;

    const botao = criarBotaoBairro({
        icon: 'fa-solid fa-file-arrow-up',
        label: 'Abrir Ficheiros da tarefa',
        className: 'bairro-control--ficheiros-link',
        onClick: () => abrirPostoBairro(caixa, pai, filho, onTextoAlterado, renderizar, 'ficheiros')
    });
    if (referenciaActas?.parentElement === acoes) {
        referenciaActas.insertAdjacentElement('afterend', botao);
    } else {
        acoes.insertBefore(botao, acoes.firstElementChild || null);
    }
}

function adicionarNovaLinhaNoPai({ caixa, pai, filhoAtual, elemento, onTextoAlterado, renderizar }) {
    if (!pai) return;
    const corpo = elemento?.closest('.bairro-body');
    const scrollTop = corpo?.scrollTop ?? 0;
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
    executarQuandoElementoDisponivel(
        corpo,
        () => corpo?.querySelector(`[data-bairro-casa-id="${novoFilho.id}"] input, [data-bairro-casa-id="${novoFilho.id}"] .bairro-filho-nome`),
        novoEl => {
            if (corpo) corpo.scrollTop = scrollTop;
            if (novoEl.matches('input')) {
                novoEl.focus({ preventScroll: true });
                novoEl.setSelectionRange(novoEl.value.length, novoEl.value.length);
            } else {
                novoEl.click();
            }
            if (corpo) corpo.scrollTop = scrollTop;
        }
    );
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
    let criouNovaLinha = false;
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
            criouNovaLinha = true;
            input.blur();
            adicionarNovaLinhaNoPai({ caixa, pai, filhoAtual: filho, elemento: input, onTextoAlterado, renderizar });
        } else if ((event.key === 'Backspace' || event.key === 'Delete') && !event.target.value.trim()) {
            event.preventDefault();
            input.blur();
            confirmarERemoverFilho({ caixa, filho, onTextoAlterado, renderizar });
        }
    });
    input.addEventListener('blur', () => {
        if (criouNovaLinha) return;
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

function renderizarFilho({ caixa, pai, filho, onTextoAlterado, renderizar, ficheirosPorTarefa }) {
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
        let criouNovaLinha = false;
        nome.addEventListener('input', event => {
            filho.nome = event.target.value;
            onTextoAlterado(caixa);
        });
        nome.addEventListener('click', event => event.stopPropagation());
        nome.addEventListener('keydown', event => {
            if (event.key === 'Enter') {
                event.preventDefault();
                criouNovaLinha = true;
                nome.blur();
                adicionarNovaLinhaNoPai({ caixa, pai, filhoAtual: filho, elemento: nome, onTextoAlterado, renderizar });
            } else if ((event.key === 'Backspace' || event.key === 'Delete') && !event.target.value.trim()) {
                event.preventDefault();
                nome.blur();
                confirmarERemoverFilho({ caixa, filho, onTextoAlterado, renderizar });
            }
        });
        nome.addEventListener('blur', () => {
            if (criouNovaLinha) return;
            setTimeout(() => { if (filho.nome.trim()) renderizar(); }, 150);
        });
    }

    const acoes = criarGrupoBairro();
    const actas = criarActasButton({ caixa, pai, filho, onTextoAlterado, renderizar });
    if (actas) acoes.appendChild(actas);
    adicionarIndicadorFicheiros({
        acoes,
        referenciaActas: actas,
        ficheirosPorTarefa,
        caixa,
        pai,
        filho,
        onTextoAlterado,
        renderizar
    });

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

function renderizarPai({ caixa, pai, onTextoAlterado, renderizar, ficheirosPorTarefa }) {
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
            const corpo = secao.closest('.bairro-body');
            const scrollTop = corpo?.scrollTop ?? 0;
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
            executarQuandoElementoDisponivel(
                corpo,
                () => corpo?.querySelector(`[data-bairro-casa-id="${filho.id}"] input`),
                novoEl => {
                    if (corpo) corpo.scrollTop = scrollTop;
                    novoEl.focus({ preventScroll: true });
                    novoEl.setSelectionRange(novoEl.value.length, novoEl.value.length);
                    if (corpo) corpo.scrollTop = scrollTop;
                }
            );
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
                filhos.appendChild(renderizarFilho({ caixa, pai, filho, onTextoAlterado, renderizar, ficheirosPorTarefa }));
            });
        });
    } else {
        validos.forEach(filho => {
            filhos.appendChild(renderizarFilho({ caixa, pai, filho, onTextoAlterado, renderizar, ficheirosPorTarefa }));
        });
    }
    const meuBairro = criarSecaoMeuBairro({ caixa, pai, onTextoAlterado, renderizar });
    secao.append(cabecalho);
    if (meuBairro) secao.appendChild(meuBairro);
    secao.appendChild(filhos);
    return secao;
}

export function renderizarEstruturaBairro({ caixa, corpo, onTextoAlterado, aoRenderizar = () => {} }) {
    let renderizar;
    const ficheirosPorTarefa = new Map();
    let carregamentoAtual = null;
    let versaoRenderizacao = 0;

    async function prepararFicheiros() {
        const notaId = window.notaAtualContext?.notaId;
        const ids = caixa.pastapai
            .filter(pai => !pai.oculto)
            .flatMap(pai => (pai.pastafilho || [])
                .filter(filho => !filho.oculto)
                .map(filho => filho.id))
            .filter(Boolean);

        const idsEmFalta = ids.filter(id => !ficheirosPorTarefa.has(id));
        if (!notaId || !idsEmFalta.length) return;
        if (carregamentoAtual) return carregamentoAtual;

        carregamentoAtual = Promise.all(idsEmFalta.map(async id => {
            try {
                const ficheiros = await listarFicheiros({
                    noteId: notaId,
                    contextType: 'tarefa',
                    contextId: id
                });
                ficheirosPorTarefa.set(id, ficheiros.length > 0);
            } catch (erro) {
                ficheirosPorTarefa.set(id, false);
                console.warn('[BAIRRO] Não foi possível verificar os ficheiros da tarefa:', erro);
            }
        })).finally(() => {
            carregamentoAtual = null;
        });

        return carregamentoAtual;
    }

    renderizar = () => {
        const versao = ++versaoRenderizacao;
        aoRenderizar();
        corpo.replaceChildren();

        const estado = document.createElement('div');
        estado.className = 'bairro-ficheiros-a-carregar';
        estado.textContent = 'A preparar as tarefas...';
        corpo.appendChild(estado);

        prepararFicheiros().then(() => {
            if (versao !== versaoRenderizacao) return;
            corpo.replaceChildren();
            renderizarConteudo();
        });
    };

    function renderizarConteudo() {
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
            corpo.appendChild(renderizarPai({ caixa, pai, onTextoAlterado, renderizar, ficheirosPorTarefa }));
        });
    }

    const invalidarFicheiros = () => {
        ficheirosPorTarefa.clear();
        renderizar();
    };
    window.addEventListener('ficheiros:alterados', invalidarFicheiros);
    renderizar();
    return renderizar;
}
