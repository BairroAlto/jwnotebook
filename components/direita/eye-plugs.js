import { obterFeaturesDisponiveis } from '../settings/feature-admin.js';
import { PLUGS_LOJA, normalizarPlugsInstalados, obterPlugPorId } from '../store/plug-catalog.js';
import { obterProvider, pesquisarTodos } from './plugs/providers/index.js';
import { obterResultadoComposto } from './plugs/providers/all-composite.js';

const PLUG_TODOS = {
    id: 'all',
    nome: 'All',
    icon: 'fa-solid fa-layer-group',
    descricao: 'Pesquisa em todos os Plugs activos, com prioridade para a Wikipédia.',
    placeholder: 'Pesquisar em todos os Plugs…'
};

const estado = {
    plugAtivo: null,
    resultadoSelecionado: null,
    termoDaSelecao: '',
    selecoesPorPlug: new Map(),
    consultasPorPlug: new Map(),
    ocupado: false
};

function definirVisibilidadeIcone(idsPermitidos) {
    const botao = document.getElementById('btn-tab-plugs');
    if (!botao) return;
    const visivel = idsPermitidos.length > 0;
    botao.hidden = !visivel;
    botao.style.display = visivel ? '' : 'none';
    if (!visivel && botao.classList.contains('active')) window.switchEyeTab?.('indice');
}

async function obterPlugsPermitidos(auth, forcar = false) {
    const instalados = normalizarPlugsInstalados(window.NotaBookPlugsInstalados);
    if (!instalados.length) return [];

    if (!forcar && Array.isArray(window.NotaBookPlugsPermitidos)) {
        return PLUGS_LOJA.filter(plug => instalados.includes(plug.id) && window.NotaBookPlugsPermitidos.includes(plug.id));
    }

    try {
        const features = await obterFeaturesDisponiveis(auth || window.auth);
        const porChave = new Map(features.map(feature => [feature.feature_key, feature]));
        const permitidos = PLUGS_LOJA.filter(plug => {
            const acesso = porChave.get(plug.featureKey);
            return instalados.includes(plug.id)
                && Boolean(acesso)
                && acesso.allowed !== false
                && Number(acesso.active) !== 0;
        });
        window.NotaBookPlugsPermitidos = permitidos.map(plug => plug.id);
        return permitidos;
    } catch (erro) {
        console.info('[PLUGS] Não foi possível validar o plano:', erro.message);
        return [];
    }
}

export async function sincronizarIconePlugsEye(auth, { forcar = false } = {}) {
    const permitidos = await obterPlugsPermitidos(auth, forcar);
    definirVisibilidadeIcone(permitidos.map(plug => plug.id));
    return permitidos;
}

function criarMensagem(tipo, conteudo) {
    const mensagem = document.createElement('article');
    mensagem.className = `eye-plugs-message eye-plugs-message--${tipo}`;
    if (typeof conteudo === 'string') mensagem.textContent = conteudo;
    else mensagem.appendChild(conteudo);
    return mensagem;
}

function adicionarMensagem(conversa, tipo, conteudo) {
    const mensagem = criarMensagem(tipo, conteudo);
    conversa.appendChild(mensagem);
    return mensagem;
}

function irParaInicioDaLista(root) {
    const area = root.closest('.eye-content');
    if (!area) return;
    area.scrollTo({ top: 0, behavior: 'smooth' });
}

function garantirPainelPlugsAberto() {
    const painel = document.getElementById('area-direita');
    if (!painel || !window.matchMedia?.('(max-width: 768px)').matches) return;
    if (!painel.classList.contains('active')) return;
    if (painel.getBoundingClientRect().height >= 180) return;

    painel.style.height = '68vh';
    painel.dataset.mobileSheetPct = '68';
    window.MobilePanelManager?.definirEstadoFolha?.('open');
}

function criarLigacaoFonte(url, texto = 'Abrir fonte') {
    const ligacao = document.createElement('a');
    ligacao.className = 'eye-plugs-source';
    ligacao.href = url;
    ligacao.target = '_blank';
    ligacao.rel = 'noopener noreferrer';
    ligacao.innerHTML = `<i class="fa-solid fa-arrow-up-right-from-square"></i> ${texto}`;
    return ligacao;
}

async function copiarTexto(texto) {
    if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(texto);
        return;
    }

    const area = document.createElement('textarea');
    area.value = texto;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const copiado = document.execCommand('copy');
    area.remove();
    if (!copiado) throw new Error('Não foi possível copiar o texto.');
}

function criarBotaoCopiar(detalhe) {
    const botao = document.createElement('button');
    botao.type = 'button';
    botao.className = 'eye-plugs-copy';
    botao.title = 'Copiar texto';
    botao.setAttribute('aria-label', 'Copiar texto');
    botao.innerHTML = '<i class="fa-solid fa-copy"></i>';
    botao.addEventListener('click', async () => {
        const original = botao.innerHTML;
        try {
            const texto = [detalhe.titulo, detalhe.descricao, limparMarcadoresTopicos(detalhe.texto)]
                .filter(Boolean)
                .join('\n\n');
            await copiarTexto(texto);
            botao.innerHTML = '<i class="fa-solid fa-check"></i>';
            botao.title = 'Copiado';
            botao.setAttribute('aria-label', 'Copiado');
        } catch (erro) {
            botao.innerHTML = '<i class="fa-solid fa-xmark"></i>';
            botao.title = erro.message || 'Não foi possível copiar';
        }
        window.setTimeout(() => {
            botao.innerHTML = original;
            botao.title = 'Copiar texto';
            botao.setAttribute('aria-label', 'Copiar texto');
        }, 1600);
    });
    return botao;
}

function obterTopico(linha) {
    const correspondencia = String(linha || '').match(/^\s*(={2,6})\s*(.*?)\s*(={2,6})\s*$/);
    if (!correspondencia || correspondencia[1].length !== correspondencia[3].length) return null;
    return {
        nivel: correspondencia[1].length,
        texto: correspondencia[2].trim()
    };
}

function limparMarcadoresTopicos(texto = '') {
    return String(texto)
        .split(/\r?\n/)
        .map(linha => obterTopico(linha)?.texto || linha)
        .join('\n');
}

function renderizarTextoFormatado(texto) {
    const fragmento = document.createDocumentFragment();
    let linhasParagrafo = [];

    const descarregarParagrafo = () => {
        if (!linhasParagrafo.length) return;
        const paragrafo = document.createElement('p');
        paragrafo.textContent = linhasParagrafo.join('\n');
        fragmento.appendChild(paragrafo);
        linhasParagrafo = [];
    };

    String(texto || '').split(/\r?\n/).forEach(linha => {
        const topico = obterTopico(linha);
        if (topico) {
            descarregarParagrafo();
            const titulo = document.createElement('h5');
            titulo.className = 'eye-plugs-answer__heading';
            titulo.dataset.nivel = String(topico.nivel);
            titulo.textContent = topico.texto;
            fragmento.appendChild(titulo);
            return;
        }
        if (!linha.trim()) {
            descarregarParagrafo();
            return;
        }
        linhasParagrafo.push(linha);
    });

    descarregarParagrafo();
    return fragmento;
}

function renderizarDetalhe(detalhe) {
    if (detalhe.tipo === 'composto') return renderizarDetalheComposto(detalhe);

    const bloco = document.createElement('div');
    bloco.className = 'eye-plugs-answer';

    if (detalhe.tipo === 'texto') bloco.appendChild(criarBotaoCopiar(detalhe));

    const titulo = document.createElement('h4');
    titulo.textContent = detalhe.titulo;
    bloco.appendChild(titulo);

    if (detalhe.descricao) {
        const descricao = document.createElement('p');
        descricao.className = 'eye-plugs-answer__description';
        descricao.textContent = detalhe.descricao;
        bloco.appendChild(descricao);
    }

    if (detalhe.tipo === 'texto') {
        const texto = document.createElement('div');
        texto.className = 'eye-plugs-answer__text';
        texto.appendChild(renderizarTextoFormatado(detalhe.texto));
        bloco.appendChild(texto);
    }

    if (detalhe.tipo === 'tabela') {
        if (detalhe.linhas?.length) {
            const contentor = document.createElement('div');
            contentor.className = 'eye-plugs-table-wrap';
            const tabela = document.createElement('table');
            const corpo = document.createElement('tbody');
            detalhe.linhas.forEach(linha => {
                const tr = document.createElement('tr');
                const campo = document.createElement('th');
                const valor = document.createElement('td');
                campo.scope = 'row';
                campo.textContent = linha.campo;
                valor.textContent = linha.valor;
                tr.append(campo, valor);
                corpo.appendChild(tr);
            });
            tabela.appendChild(corpo);
            contentor.appendChild(tabela);
            bloco.appendChild(contentor);
        } else {
            const vazio = document.createElement('p');
            vazio.textContent = 'Não foram encontrados dados estruturados para esta entidade.';
            bloco.appendChild(vazio);
        }
    }

    if (detalhe.tipo === 'imagem') {
        const imagem = document.createElement('img');
        imagem.className = 'eye-plugs-answer__image';
        imagem.src = detalhe.imageUrl;
        imagem.alt = detalhe.titulo;
        imagem.loading = 'lazy';
        bloco.appendChild(imagem);
        const creditos = [detalhe.autor, detalhe.licenca].filter(Boolean).join(' · ');
        if (creditos) {
            const legenda = document.createElement('small');
            legenda.textContent = creditos;
            bloco.appendChild(legenda);
        }
    }

    if (detalhe.nota) {
        const nota = document.createElement('small');
        nota.className = 'eye-plugs-answer__note';
        nota.textContent = detalhe.nota;
        bloco.appendChild(nota);
    }
    if (detalhe.url) bloco.appendChild(criarLigacaoFonte(detalhe.url));
    return bloco;
}

function renderizarDetalheComposto(detalhe) {
    const bloco = document.createElement('div');
    bloco.className = 'eye-plugs-composite';

    if (detalhe.imagem) {
        const imagem = document.createElement('img');
        imagem.className = 'eye-plugs-composite__image';
        imagem.src = detalhe.imagem.imageUrl;
        imagem.alt = detalhe.imagem.titulo || detalhe.titulo;
        imagem.loading = 'lazy';
        bloco.appendChild(imagem);
        if (detalhe.imagem.url) bloco.appendChild(criarLigacaoFonte(detalhe.imagem.url, 'Abrir imagem'));
    }

    if (detalhe.wikidata) {
        const titulo = document.createElement('h5');
        titulo.textContent = 'Factos estruturados · Wikidata';
        bloco.appendChild(titulo);
        bloco.appendChild(renderizarDetalhe(detalhe.wikidata));
    }

    if (detalhe.wikipedia) {
        const titulo = document.createElement('h5');
        titulo.textContent = 'Artigo · Wikipédia';
        bloco.appendChild(titulo);
        bloco.appendChild(renderizarDetalhe(detalhe.wikipedia));
    }

    return bloco;
}

function renderizarResultados(resultados, conversa, plug, aoSelecionar) {
    const bloco = document.createElement('div');
    bloco.className = `eye-plugs-results${plug.id === 'wikimedia' ? ' eye-plugs-results--images' : ''}`;

    resultados.forEach((resultado, indice) => {
        const cartao = document.createElement('button');
        cartao.type = 'button';
        cartao.className = 'eye-plugs-result';
        cartao.dataset.resultadoId = resultado.id;

        if (resultado.thumbUrl) {
            const imagem = document.createElement('img');
            imagem.src = resultado.thumbUrl;
            imagem.alt = '';
            imagem.loading = 'lazy';
            cartao.appendChild(imagem);
        }

        const corpo = document.createElement('span');
        corpo.className = 'eye-plugs-result__body';
        const titulo = document.createElement('strong');
        titulo.textContent = `${indice + 1}. ${resultado.titulo}`;
        const descricao = document.createElement('small');
        descricao.textContent = [resultado.fonte, resultado.descricao || 'Resultado disponível']
            .filter(Boolean)
            .join(' · ');
        corpo.append(titulo, descricao);
        cartao.appendChild(corpo);

        cartao.addEventListener('click', () => {
            bloco.querySelectorAll('.eye-plugs-result').forEach(item => item.classList.remove('is-selected'));
            cartao.classList.add('is-selected');
            aoSelecionar(resultado);
        });
        bloco.appendChild(cartao);
    });

    adicionarMensagem(conversa, 'assistant', bloco);
}

function actualizarPlaceholder(root, plug) {
    const input = root.querySelector('[data-plug-query]');
    if (input) input.placeholder = plug.placeholder;
}

async function activarPlug(root, plug) {
    if (estado.plugAtivo) {
        estado.selecoesPorPlug.set(estado.plugAtivo, {
            resultadoSelecionado: estado.resultadoSelecionado,
            termoDaSelecao: estado.termoDaSelecao
        });
    }
    estado.plugAtivo = plug.id;
    const selecao = estado.selecoesPorPlug.get(plug.id) || {};
    estado.resultadoSelecionado = selecao.resultadoSelecionado || null;
    estado.termoDaSelecao = selecao.termoDaSelecao || '';
    root.querySelectorAll('[data-eye-plug]').forEach(botao => {
        const activo = botao.dataset.eyePlug === plug.id;
        botao.classList.toggle('is-active', activo);
        botao.setAttribute('aria-selected', String(activo));
    });
    actualizarPlaceholder(root, plug);
    const input = root.querySelector('[data-plug-query]');
    if (input) input.value = estado.consultasPorPlug.get(plug.id) || '';
    const conversa = root.querySelector(`[data-plug-conversation="${plug.id}"]`);
    root.querySelectorAll('[data-plug-conversation]').forEach(area => {
        area.classList.toggle('is-active', area === conversa);
    });
    if (conversa && !conversa.childElementCount) {
        adicionarMensagem(conversa, 'assistant', `Olá! Pesquisa no ${plug.nome}. Serão mostrados pelo menos 10 resultados sempre que existirem.`);
    }
    irParaInicioDaLista(root);
}

function construirPainel(permitidos) {
    const root = document.createElement('div');
    root.className = 'eye-plugs';
    root.innerHTML = `
        <div class="eye-plugs-switcher" role="tablist" aria-label="Plugs instalados"></div>
        <div class="eye-plugs-conversations" data-plug-conversations></div>
        <form class="eye-plugs-composer" data-plug-form>
            <input type="search" data-plug-query autocomplete="off" aria-label="Termo de pesquisa">
            <select data-plug-mode aria-label="Extensão do resultado">
                <option value="resumo">Resumo</option>
                <option value="completo">Artigo Completo</option>
            </select>
            <button type="submit" data-plug-send><span>Enviar</span><i class="fa-solid fa-paper-plane"></i></button>
        </form>
        <p class="eye-plugs-status" data-plug-status aria-live="polite"></p>
    `;

    const switcher = root.querySelector('.eye-plugs-switcher');
    const botaoTodos = document.createElement('button');
    botaoTodos.type = 'button';
    botaoTodos.dataset.eyePlug = PLUG_TODOS.id;
    botaoTodos.setAttribute('role', 'tab');
    botaoTodos.innerHTML = `<i class="${PLUG_TODOS.icon}"></i><span>${PLUG_TODOS.nome}</span>`;
    botaoTodos.addEventListener('click', () => activarPlug(root, PLUG_TODOS));
    switcher.appendChild(botaoTodos);

    permitidos.forEach(plug => {
        const botao = document.createElement('button');
        botao.type = 'button';
        botao.dataset.eyePlug = plug.id;
        botao.setAttribute('role', 'tab');
        botao.innerHTML = `<i class="${plug.icon}"></i><span>${plug.nome}</span>`;
        botao.addEventListener('click', () => activarPlug(root, plug));
        switcher.appendChild(botao);
    });

    const conversas = root.querySelector('[data-plug-conversations]');
    [PLUG_TODOS, ...permitidos].forEach(plug => {
        const conversa = document.createElement('div');
        conversa.className = 'eye-plugs-conversation';
        conversa.dataset.plugConversation = plug.id;
        conversa.setAttribute('aria-live', 'polite');
        conversas.appendChild(conversa);
    });

    const form = root.querySelector('[data-plug-form]');
    const input = root.querySelector('[data-plug-query]');
    const modo = root.querySelector('[data-plug-mode]');
    const estadoTexto = root.querySelector('[data-plug-status]');
    const enviar = root.querySelector('[data-plug-send]');
    input.addEventListener('input', () => {
        estado.consultasPorPlug.set(estado.plugAtivo, input.value);
        if (input.value.trim() !== estado.termoDaSelecao) {
            estado.resultadoSelecionado = null;
            estado.selecoesPorPlug.set(estado.plugAtivo, {
                resultadoSelecionado: null,
                termoDaSelecao: ''
            });
            root.querySelectorAll('.eye-plugs-result').forEach(item => item.classList.remove('is-selected'));
            estadoTexto.textContent = '';
        }
    });
    input.addEventListener('keydown', evento => {
        if (evento.key !== 'Enter' || evento.isComposing) return;
        evento.preventDefault();
        form.requestSubmit();
    });

    form.addEventListener('submit', async evento => {
        evento.preventDefault();
        if (estado.ocupado) return;
        const termo = input.value.trim();
        const plug = obterPlugPorId(estado.plugAtivo)
            || (estado.plugAtivo === PLUG_TODOS.id ? PLUG_TODOS : null);
        if (!termo || !plug) return;
        garantirPainelPlugsAberto();
        estado.consultasPorPlug.set(estado.plugAtivo, input.value);

        estado.ocupado = true;
        enviar.disabled = true;
        enviar.querySelector('span').textContent = 'A procurar…';
        estadoTexto.textContent = '';
        const conversa = root.querySelector(`[data-plug-conversation="${plug.id}"]`);
        root.querySelectorAll('[data-plug-conversation]').forEach(area => {
            area.classList.toggle('is-active', area === conversa);
        });

        try {
            if (estado.resultadoSelecionado && estado.termoDaSelecao === termo) {
                const plugDoResultado = obterPlugPorId(estado.resultadoSelecionado.plugId || plug.id) || plug;
                estadoTexto.textContent = 'A abrir o resultado selecionado…';
                const detalhe = plug.id === PLUG_TODOS.id && plugDoResultado.id === 'wikipedia'
                    ? await (async () => {
                        estadoTexto.textContent = 'A reunir imagem, factos e artigo…';
                        return obterResultadoComposto(estado.resultadoSelecionado, modo.value, permitidos);
                    })()
                    : await (async () => {
                        const provider = await obterProvider(plugDoResultado.id);
                        return provider.obterResultado(estado.resultadoSelecionado, modo.value);
                    })();
                adicionarMensagem(conversa, 'assistant', renderizarDetalhe(detalhe));
                estado.resultadoSelecionado = null;
                estado.termoDaSelecao = '';
                estado.selecoesPorPlug.set(estado.plugAtivo, {
                    resultadoSelecionado: null,
                    termoDaSelecao: ''
                });
                input.value = '';
                estadoTexto.textContent = '';
            } else {
                irParaInicioDaLista(root);
                adicionarMensagem(conversa, 'user', termo);
                estadoTexto.textContent = 'A procurar resultados…';
                const resultados = plug.id === PLUG_TODOS.id
                    ? await pesquisarTodos(termo, modo.value, permitidos)
                    : await (await obterProvider(plug.id)).pesquisar(termo, modo.value);
                if (!resultados.length) {
                    adicionarMensagem(conversa, 'assistant', 'Não foram encontrados resultados para esta pesquisa.');
                    estadoTexto.textContent = '';
                } else {
                    renderizarResultados(resultados, conversa, plug, resultado => {
                        estado.resultadoSelecionado = {
                            ...resultado,
                            plugId: resultado.plugId || plug.id
                        };
                        estado.termoDaSelecao = termo;
                        estado.selecoesPorPlug.set(estado.plugAtivo, {
                            resultadoSelecionado: estado.resultadoSelecionado,
                            termoDaSelecao: termo
                        });
                        estadoTexto.textContent = `Selecionado: ${resultado.titulo}. Prime Enter ou clica em Enviar.`;
                        input.focus();
                    });
                    estadoTexto.textContent = 'Seleciona um resultado e prime Enter ou clica em Enviar.';
                }
            }
        } catch (erro) {
            adicionarMensagem(conversa, 'error', erro.message || 'O Plug não conseguiu concluir o pedido.');
            estadoTexto.textContent = '';
        } finally {
            garantirPainelPlugsAberto();
            estado.ocupado = false;
            enviar.disabled = false;
            enviar.querySelector('span').textContent = 'Enviar';
        }
    });

    const plugInicial = permitidos.some(plug => plug.id === 'wikipedia')
        ? PLUG_TODOS
        : permitidos[0];
    activarPlug(root, plugInicial);
    return root;
}

export async function renderizarPainelPlugs({ auth = window.auth } = {}) {
    const container = document.getElementById('plugs-eye-container');
    if (!container) return;
    const permitidos = await obterPlugsPermitidos(auth);
    definirVisibilidadeIcone(permitidos.map(plug => plug.id));

    if (!permitidos.length) {
        container.innerHTML = '<div class="eye-plugs-empty"><i class="fa-solid fa-plug-circle-xmark"></i><p>Instala um Plug na Loja para o usares no EYE.</p></div>';
        return;
    }
    const chavePainel = permitidos.map(plug => plug.id).join('|');
    const painelExistente = container.querySelector('.eye-plugs');
    if (painelExistente?.dataset.plugsKey === chavePainel) return;
    container.replaceChildren(construirPainel(permitidos));
    container.querySelector('.eye-plugs').dataset.plugsKey = chavePainel;
}

window.addEventListener('notabook:plugs-alterados', () => {
    sincronizarIconePlugsEye(window.auth).then(() => {
        const container = document.getElementById('plugs-eye-container');
        if (container?.style.display !== 'none') renderizarPainelPlugs();
    });
});

window.addEventListener('notabook:plan-preview-changed', () => {
    sincronizarIconePlugsEye(window.auth, { forcar: true });
});
