import { criarPaiBairro, TIPO_CHECK_BAIRRO } from '../../constants/bairro.js';
import { criarGestorActas, garantirActas } from './bairro-actas.js';
import { configurarMeuBairro, obterModelo } from './meu-bairro.js';
import { IDENTIDADE_FERRAMENTAS } from '../../constants/ferramentas.js';
import { carregarExploradorAssociar, pesquisarExploradorAssociar } from './tags/tags-associar-explorer.js';
import { montarPainelFicheiros } from '../../storage/storage-ui.js';
import { listarFicheiros, apagarFicheiro } from '../../storage/storage-client.js';
import { exigirAcessoFerramenta, obterAcessoFerramenta } from '../../settings/feature-admin.js';
import { deleteDoc, doc } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js';
import {
    anexarLigacaoBairro,
    removerLigacaoBairroDaCasa,
    irParaLigacaoBairro
} from './bairro-ligacoes.js';
import { criarGestorNotasBairro } from './bairro-notas-controller.js';

const OPCOES_CHECK = [
    { tipo: TIPO_CHECK_BAIRRO.NENHUM, nome: 'X', detalhe: 'Clicável por completo', icone: 'fa-solid fa-xmark' },
    { tipo: TIPO_CHECK_BAIRRO.BOLA, nome: 'Bola', detalhe: 'Check circular', icone: 'fa-regular fa-circle' },
    { tipo: TIPO_CHECK_BAIRRO.QUADRADO, nome: 'Quadrado', detalhe: 'Check quadrado', icone: 'fa-regular fa-square' },
    { tipo: TIPO_CHECK_BAIRRO.SETA, nome: 'Seta', detalhe: 'Triângulo para a direita', icone: 'fa-solid fa-caret-right' }
];

let estadoAtual = null;

const POSTO_TAB_FEATURES = {
    casa: 'posto_casa',
    bairro: 'posto_bairro',
    geral: 'posto_casa_geral',
    actas: 'posto_actas',
    ficheiros: 'posto_ficheiros',
    agenda: 'posto_agenda',
    'meu-bairro': 'posto_meu_bairro',
    'meu-bairro-pratica': 'posto_meu_bairro'
};

async function permitirAbaPosto(chave, nome) {
    const featureKey = POSTO_TAB_FEATURES[chave];
    if (!featureKey) return true;
    return exigirAcessoFerramenta(
        window.auth,
        featureKey,
        `${nome} requer o plano definido pelo administrador.`
    );
}

function obterContexto() {
    const contexto = window.notaAtualContext;
    if (!contexto?.db || !contexto?.notaId) return null;
    return contexto;
}

function selecionarAba(alvo) {
    const overlay = document.getElementById('popup-bairro-posto-overlay');
    if (!overlay) return;
    overlay.querySelectorAll('[data-bairro-posto-tab]').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.bairroPostoTab === alvo);
    });
    overlay.querySelectorAll('[data-bairro-posto-panel]').forEach(panel => {
        panel.hidden = panel.dataset.bairroPostoPanel !== alvo;
    });
}

function selecionarSubAbaCasa(alvo) {
    const overlay = document.getElementById('popup-bairro-posto-overlay');
    if (!overlay) return;
    const deveRolarParaHistorico = alvo === 'historico-actas';
    if (deveRolarParaHistorico) alvo = 'actas';
    const disponivel = overlay.querySelector(`[data-bairro-casa-tab="${alvo}"]`);
    if (!disponivel || disponivel.hidden) alvo = 'geral';
    const botaoAdicionarActa = overlay.querySelector('#btn-bairro-acta-add');
    if (botaoAdicionarActa) botaoAdicionarActa.hidden = alvo !== 'actas';
    overlay.querySelectorAll('[data-bairro-casa-tab]').forEach(tab => {
        const ativa = tab.dataset.bairroCasaTab === alvo;
        tab.classList.toggle('active', ativa);
        tab.setAttribute('aria-selected', String(ativa));
    });
    overlay.querySelectorAll('[data-bairro-casa-panel]').forEach(panel => {
        panel.hidden = panel.dataset.bairroCasaPanel !== alvo;
    });
    if (alvo === 'actas') estadoAtual?.gestorActas?.renderizarHistorico();
    if (alvo === 'notas') estadoAtual?.gestorNotas?.renderizar();
    if (deveRolarParaHistorico && alvo === 'actas') {
        requestAnimationFrame(() => {
            setTimeout(() => {
                document.getElementById('bairro-posto-historico-actas')?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }, 0);
        });
    }
}

function configurarActas(subAba = 'geral') {
    const overlay = document.getElementById('popup-bairro-posto-overlay');
    const filho = estadoAtual?.filho;
    if (!overlay || !filho) return;
    garantirActas(filho);
    overlay.querySelectorAll('[data-bairro-casa-tab]').forEach(tab => {
        tab.onclick = async () => {
            const alvo = tab.dataset.bairroCasaTab;
            if (await permitirAbaPosto(alvo, tab.textContent.trim() || 'Esta aba')) selecionarSubAbaCasa(alvo);
        };
    });
    estadoAtual.gestorActas = criarGestorActas({
        filho,
        lista: document.getElementById('bairro-posto-actas-lista'),
        listaHistorico: document.getElementById('bairro-posto-historico-actas-lista'),
        botaoAdicionar: document.getElementById('btn-bairro-acta-add'),
        guardar: () => {
            estadoAtual.onTextoAlterado(estadoAtual.bairro);
            estadoAtual.renderizar?.();
        },
        aoAbrirHistorico: () => selecionarSubAbaCasa('historico-actas')
    });
    estadoAtual.gestorNotas = criarGestorNotasBairro({
        bairro: estadoAtual.bairro,
        filho,
        painel: overlay.querySelector('[data-bairro-casa-panel="notas"]'),
        guardar: () => estadoAtual.onTextoAlterado(estadoAtual.bairro),
        renderizarBairro: () => estadoAtual.renderizar?.()
    });
    const contexto = obterContexto();
    const painelFicheiros = overlay.querySelector('#bairro-posto-ficheiros-panel');
    if (painelFicheiros && contexto?.notaId && filho.id) {
        montarPainelFicheiros(painelFicheiros, {
            noteId: contexto.notaId,
            contextType: 'tarefa',
            contextId: filho.id,
            titulo: 'Ficheiros anexados à tarefa'
        });
    }
    selecionarSubAbaCasa(subAba);
}
function criarOpcaoCheck(opcao, valor, aoSelecionar) {
    const botao = document.createElement('button');
    botao.type = 'button';
    botao.className = `bairro-posto-check-opcao${valor === opcao.tipo ? ' active' : ''}`;
    botao.setAttribute('aria-pressed', String(valor === opcao.tipo));
    botao.innerHTML = `<span class="bairro-posto-check-icone ${opcao.tipo}"><i class="${opcao.icone}" aria-hidden="true"></i></span><span><strong>${opcao.nome}</strong><small>${opcao.detalhe}</small></span>`;
    botao.addEventListener('click', () => aoSelecionar(opcao.tipo));
    return botao;
}

function renderizarOpcoesCheck(container, valor, aoSelecionar) {
    if (!container) return;
    container.replaceChildren();
    OPCOES_CHECK.forEach(opcao => container.appendChild(criarOpcaoCheck(opcao, valor, aoSelecionar)));
}

function renderizarLigacaoAtual() {
    const container = document.getElementById('bairro-posto-ligacao-atual');
    if (!container) return;
    container.replaceChildren();
    const ligacao = estadoAtual?.filho?.['ligaçãoBairro']?.[0];
if (!ligacao) {
        const card = document.createElement('div');
        card.className = 'bairro-posto-ligacao-card bairro-posto-ligacao-card--vazio';
        const estado = document.createElement('div');
        estado.className = 'bairro-posto-ligacao-estado';
        const icone = document.createElement('span');
        icone.className = 'bairro-posto-ligacao-icone';
        icone.innerHTML = '<i class="fa-solid fa-link" aria-hidden="true"></i>';
        const texto = document.createElement('span');
        texto.textContent = 'Nenhuma pasta, nota ou caixa ligada.';
        estado.append(icone, texto);
        const botao = document.createElement('button');
        botao.type = 'button';
        botao.id = 'btn-bairro-mostrar-explorador';
        botao.innerHTML = '<i class="fa-regular fa-folder-open" aria-hidden="true"></i><span>Mostrar Explorador</span>';
        card.append(estado, botao);
        container.appendChild(card);
        return;
    }
    const card = document.createElement('div');
    card.className = 'bairro-posto-ligacao-card';
    const texto = document.createElement('div');
    texto.innerHTML = `<strong>${ligacao.nome || 'Ligação'}</strong><small>${ligacao.tipo === 'caixa' ? 'Caixa' : ligacao.tipo === 'nota' ? 'Nota' : 'Pasta'}</small>`;
    const acoes = document.createElement('div');
    const ir = document.createElement('button');
    ir.type = 'button';
    ir.title = 'Ir para a ligação';
    ir.innerHTML = '<i class="fa-solid fa-arrow-up-right-from-square"></i>';
    ir.addEventListener('click', () => irParaLigacaoBairro(ligacao));
    const remover = document.createElement('button');
    remover.type = 'button';
    remover.title = 'Remover ligação';
    remover.className = 'bairro-posto-remover';
    remover.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
    remover.addEventListener('click', async () => {
        const contexto = obterContexto();
        if (!contexto) return;
        await removerLigacaoBairroDaCasa({
            db: contexto.db,
            notaId: contexto.notaId,
            bairro: estadoAtual.bairro,
            pai: estadoAtual.pai,
            filho: estadoAtual.filho,
            ligacao,
            onAtualizar: () => estadoAtual.onTextoAlterado(estadoAtual.bairro)
        });
        renderizarLigacaoAtual();
        configurarExplorador();
        estadoAtual.renderizar?.();
    });
    acoes.append(ir, remover);
    card.append(texto, acoes);
    container.appendChild(card);
}

function filtrarExploradorLigacao() {
    const pesquisa = document.getElementById('bairro-posto-pesquisa-ligacao');
    const area = document.getElementById('bairro-posto-explorador');
    if (!pesquisa || !area) return;

    const termo = pesquisa.value.trim().toLocaleLowerCase('pt-PT');
    area.querySelectorAll('.associar-box-row').forEach(item => {
        item.hidden = Boolean(termo) && !item.textContent.toLocaleLowerCase('pt-PT').includes(termo);
    });
    area.querySelectorAll('.associar-node').forEach(item => {
        item.hidden = Boolean(termo) && !item.textContent.toLocaleLowerCase('pt-PT').includes(termo);
    });
}

async function pesquisarLigacoesDoUtilizador(termo) {
    const pesquisa = document.getElementById('bairro-posto-pesquisa-ligacao');
    const area = document.getElementById('bairro-posto-explorador');
    if (!pesquisa || !area || !termo.trim()) return;

    const contexto = obterContexto();
    if (!contexto) return;
    area.hidden = false;

    const contentContainer = document.getElementById('bairro-arvore-associar-content');
    if (contentContainer) {
        contentContainer.replaceChildren();
        const mensagem = document.createElement('p');
        mensagem.className = 'bairro-posto-vazio';
        mensagem.textContent = 'A pesquisar...';
        contentContainer.appendChild(mensagem);
    }

    try {
        await pesquisarExploradorAssociar(
            { dbRef: contexto.db, authRef: contexto.auth },
            termo,
            async (id, titulo, tipo, meta = {}) => {
                const alvo = {
                    id,
                    tipo: meta.entidade || (tipo === 'pasta' || tipo === 'nota' ? tipo : 'caixa'),
                    notaId: meta.notaId || null
                };
                await anexarLigacaoBairro({
                    db: contexto.db,
                    notaId: contexto.notaId,
                    bairro: estadoAtual.bairro,
                    pai: estadoAtual.pai,
                    filho: estadoAtual.filho,
                    alvo,
                    titulo,
                    onAtualizar: () => estadoAtual.onTextoAlterado(estadoAtual.bairro)
                });
                area.hidden = true;
                const botao = document.getElementById('btn-bairro-mostrar-explorador');
                if (botao) botao.textContent = 'Mostrar Explorador';
                pesquisa.parentElement.style.display = 'none';
                renderizarLigacaoAtual();
        configurarExplorador();
        estadoAtual.renderizar?.();
            },
            IDENTIDADE_FERRAMENTAS,
            'bairro-arvore-associar-content'
        );
    } catch (error) {
        console.error('Erro ao pesquisar conteúdos do utilizador:', error);
        if (contentContainer) {
            contentContainer.replaceChildren();
            const erro = document.createElement('p');
            erro.className = 'bairro-posto-vazio';
            erro.textContent = 'Não foi possível pesquisar os conteúdos.';
            contentContainer.appendChild(erro);
        }
    }
}

function configurarPesquisaLigacao() {
    const pesquisa = document.getElementById('bairro-posto-pesquisa-ligacao');
    const area = document.getElementById('bairro-posto-explorador');
    if (!pesquisa || !area) return;
    let temporizador;
    pesquisa.parentElement.style.display = 'none';
    pesquisa.oninput = () => {
        clearTimeout(temporizador);
        const termo = pesquisa.value.trim();
        if (!termo) {
            // Se apagar a pesquisa, repõe a árvore completa do explorador
            area.dataset.carregado = '';
            configurarExploradorCarregamento(true);
            return;
        }
        temporizador = setTimeout(() => pesquisarLigacoesDoUtilizador(termo), 220);
    };
}

async function configurarExploradorCarregamento(forcar = false) {
    const area = document.getElementById('bairro-posto-explorador');
    const botao = document.getElementById('btn-bairro-mostrar-explorador');
    const pesquisa = document.getElementById('bairro-posto-pesquisa-ligacao');
    if (!area || !estadoAtual?.filho) return;

    if (forcar || !area.dataset.carregado) {
        const contexto = obterContexto();
        if (!contexto) return;
        area.dataset.carregado = 'true';
        await carregarExploradorAssociar(
            { dbRef: contexto.db, authRef: contexto.auth },
            async (id, titulo, tipo, meta = {}) => {
                const alvo = {
                    id,
                    tipo: meta.entidade || (tipo === 'pasta' || tipo === 'nota' ? tipo : 'caixa'),
                    notaId: meta.notaId || null
                };
                await anexarLigacaoBairro({
                    db: contexto.db,
                    notaId: contexto.notaId,
                    bairro: estadoAtual.bairro,
                    pai: estadoAtual.pai,
                    filho: estadoAtual.filho,
                    alvo,
                    titulo,
                    onAtualizar: () => estadoAtual.onTextoAlterado(estadoAtual.bairro)
                });
                area.hidden = true;
                if (botao) botao.textContent = 'Mostrar Explorador';
                if (pesquisa) {
                    pesquisa.parentElement.style.display = 'none';
                    pesquisa.value = '';
                }
                renderizarLigacaoAtual();
        configurarExplorador();
        estadoAtual.renderizar?.();
            },
            IDENTIDADE_FERRAMENTAS,
            'bairro-arvore-associar-content'
        );
    }
}

function configurarExplorador() {
    const botao = document.getElementById('btn-bairro-mostrar-explorador');
    const area = document.getElementById('bairro-posto-explorador');
    if (!botao || !area || !estadoAtual?.filho) return;
    
    // Reset inicial
    area.hidden = true;
    botao.textContent = 'Mostrar Explorador';
    const pesquisa = document.getElementById('bairro-posto-pesquisa-ligacao');
    if (pesquisa) {
        pesquisa.parentElement.style.display = 'none';
        pesquisa.value = '';
    }

    botao.onclick = async () => {
        const seraAberto = area.hidden; // Se está oculto (true), vai passar a aberto (true)
        area.hidden = !seraAberto;
        botao.textContent = seraAberto ? 'Ocultar Explorador' : 'Mostrar Explorador';
        
        if (pesquisa) {
            pesquisa.parentElement.style.display = !seraAberto ? 'none' : 'flex';
            if (!seraAberto) {
                pesquisa.value = '';
                area.dataset.carregado = '';
            }
        }
        
        if (seraAberto) {
            await configurarExploradorCarregamento();
        }
    };
}

function atualizarTituloFilhoNaFerramenta(filho) {
    const linha = document.querySelector('[data-bairro-casa-id="' + filho.id + '"]');
    if (!linha) return;
    const campo = linha.querySelector('.bairro-filho-nome');
    if (!campo) return;
    if (campo.matches('input')) campo.value = filho.nome;
    else campo.textContent = filho.nome;
}

function configurarTitulo() {
    const input = document.getElementById('bairro-posto-titulo');
    if (!input || !estadoAtual?.filho) return;
    input.value = estadoAtual.filho.nome || '';
    input.oninput = event => {
        estadoAtual.filho.nome = event.target.value;
        atualizarTituloFilhoNaFerramenta(estadoAtual.filho);
        estadoAtual.onTextoAlterado(estadoAtual.bairro);
    };
}

function formatarDataHistorico(timestamp) {
    if (!timestamp) return 'Sem data';
    return new Intl.DateTimeFormat('pt-PT', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(timestamp));
}

function renderizarHistorico() {
    const lista = document.getElementById('bairro-posto-historico-lista');
    if (!lista || !estadoAtual?.bairro) return;
    lista.replaceChildren();

    const historico = [];
    (estadoAtual.bairro.pastapai || []).forEach(pai => {
        (pai.pastafilho || []).filter(filho => filho.oculto).forEach(filho => {
            historico.push({ pai, filho });
        });
    });
    historico.sort((a, b) => (b.filho.timestamp || 0) - (a.filho.timestamp || 0));

    if (!historico.length) {
        const vazio = document.createElement('p');
        vazio.className = 'bairro-posto-historico-vazio';
        vazio.textContent = 'Ainda não existem filhos ocultos.';
        lista.appendChild(vazio);
        return;
    }

    historico.forEach(({ pai, filho }) => {
        const item = document.createElement('div');
        item.className = 'bairro-posto-historico-item';
        const nome = document.createElement('strong');
        nome.textContent = filho.nome || 'Filho sem título';
        const meta = document.createElement('small');
        meta.textContent = `${pai.nome || 'Pai'} · ${formatarDataHistorico(filho.timestamp)}`;
        item.append(nome, meta);
        lista.appendChild(item);
    });
}

export function abrirPopupConfirmarRemoverTarefa(nomeTarefa, aoConfirmar) {
    const overlay = document.getElementById('popup-confirmar-remover-overlay');
    const titulo = document.getElementById('titulo-confirmar-remover');
    const msg = document.getElementById('msg-confirmar-remover');
    const btnCancelar = document.getElementById('btn-cancelar-remover');
    const btnConfirmar = document.getElementById('btn-confirmar-remover-final');

    if (!overlay || !btnCancelar || !btnConfirmar) {
        if (confirm(`Pretende apagar a tarefa "${nomeTarefa || 'tarefa'}"?`)) {
            aoConfirmar();
        }
        return;
    }

    if (titulo) titulo.textContent = 'Remover Tarefa?';
    if (msg) msg.textContent = `Tem a certeza que pretende remover a tarefa "${nomeTarefa || 'esta tarefa'}"? Ela será ocultada da lista.`;

    const fechar = () => overlay.classList.remove('active');
    btnCancelar.onclick = fechar;
    btnConfirmar.onclick = () => {
        fechar();
        aoConfirmar();
    };
    overlay.classList.add('active');
}

function configurarRemoverCasa() {
    const botao = document.getElementById('bairro-posto-remover-casa');
    if (!botao || !estadoAtual?.filho) return;
    botao.onclick = () => {
        abrirPopupConfirmarRemoverTarefa(estadoAtual.filho.nome, () => {
            estadoAtual.filho.oculto = true;
            estadoAtual.filho.timestamp = Date.now();
            estadoAtual.onTextoAlterado(estadoAtual.bairro);
            document.getElementById('popup-bairro-posto-overlay')?.classList.remove('active');
            estadoAtual.renderizar?.();
        });
    };
}

function obterRegistosMeuBairro(pai) {
    return Object.values(pai?.meuBairro?.semanas || {})
        .flatMap(semana => Object.values(semana?.dias || {}))
        .filter(registo => registo?.id);
}

function descarregarMeuBairro(pai, ficheiros = []) {
    const estado = pai?.meuBairro;
    const registos = obterRegistosMeuBairro(pai);
    const exportacao = {
        versao: 1,
        exportadoEm: new Date().toISOString(),
        ferramenta: 'BairroTarefas',
        bairro: {
            id: pai?.id || null,
            nome: pai?.nome || '',
            meuBairro: estado || null
        },
        exercicios: registos,
        ficheiros: ficheiros.map(ficheiro => ({
            id: ficheiro.id,
            nome: ficheiro.name || ficheiro.nome || '',
            tamanho: ficheiro.size || 0,
            tipo: ficheiro.contentType || ficheiro.type || '',
            contexto: ficheiro.contextId || null
        }))
    };
    const nomeSeguro = String(pai?.nome || pai?.id || 'meu-bairro')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9_-]+/g, '-')
        .replace(/^-|-$/g, '')
        .toLowerCase() || 'meu-bairro';
    const ficheiro = new Blob([JSON.stringify(exportacao, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(ficheiro);
    const ligacao = document.createElement('a');
    ligacao.href = url;
    ligacao.download = `${nomeSeguro}.json`;
    document.body.appendChild(ligacao);
    ligacao.click();
    ligacao.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function apagarTarefasMeuBairro(pai) {
    const contexto = obterContexto();
    if (!contexto?.db) return;
    const ids = [...new Set(obterRegistosMeuBairro(pai).map(registo => registo.id))];
    await Promise.all(ids.map(id => deleteDoc(doc(contexto.db, 'tarefas', id))));
}

async function obterFicheirosMeuBairro(pai) {
    const contexto = obterContexto();
    if (!contexto?.notaId) return [];
    const ids = [...new Set(obterRegistosMeuBairro(pai).map(registo => registo.id))];
    const listas = await Promise.all(ids.map(contextId => listarFicheiros({
        noteId: contexto.notaId,
        contextType: 'bairro-pratica',
        contextId
    })));
    return listas.flat();
}

async function apagarFicheirosMeuBairro(ficheiros) {
    await Promise.all((ficheiros || []).filter(ficheiro => ficheiro?.id).map(ficheiro => apagarFicheiro(ficheiro.id)));
}

function pedirDecisaoApagarMeuBairro() {
    return new Promise(resolve => {
        const overlay = document.createElement('div');
        overlay.className = 'popup-overlay active bairro-posto-confirm-overlay';
        overlay.style.zIndex = '10600';
        overlay.innerHTML = `
            <div class="popup-content bairro-posto-confirm-content" role="dialog" aria-modal="true" aria-labelledby="bairro-posto-confirm-titulo">
                <div class="popup-header">
                    <h3 id="bairro-posto-confirm-titulo">Remover Bairro</h3>
                    <button type="button" data-bairro-posto-decisao="cancelar" aria-label="Cancelar"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
                </div>
                <div class="bairro-posto-confirm-corpo">
                    <p>Deseja apagar todos os dados de Meu Bairro?</p>
                    <div class="bairro-posto-confirm-acoes">
                        <button type="button" class="bairro-posto-confirm-sim" data-bairro-posto-decisao="sim">Sim</button>
                        <button type="button" class="bairro-posto-confirm-nao" data-bairro-posto-decisao="nao">Não, exportar JSON</button>
                        <button type="button" class="bairro-posto-confirm-cancelar" data-bairro-posto-decisao="cancelar">Cancelar</button>
                    </div>
                </div>
            </div>`;

        const terminar = decisao => {
            overlay.remove();
            resolve(decisao);
        };
        overlay.addEventListener('click', evento => {
            const botao = evento.target.closest('[data-bairro-posto-decisao]');
            if (botao) terminar(botao.dataset.bairroPostoDecisao);
            else if (evento.target === overlay) terminar('cancelar');
        });
        document.body.appendChild(overlay);
    });
}

async function removerBairroSelecionado() {
    const caixa = estadoAtual?.bairro;
    const pai = estadoAtual?.pai;
    if (!caixa || !pai || !Array.isArray(caixa.pastapai)) return;

    const temMeuBairro = Boolean(pai.meuBairro?.categoria && pai.meuBairro?.modelo);
    let decisao = 'sim';
    if (temMeuBairro) decisao = await pedirDecisaoApagarMeuBairro();
    if (decisao === 'cancelar') return;

    try {
        const ficheiros = await obterFicheirosMeuBairro(pai);
        if (decisao === 'nao') descarregarMeuBairro(pai, ficheiros);
        await apagarTarefasMeuBairro(pai);
        await apagarFicheirosMeuBairro(ficheiros);
    } catch (erro) {
        console.error('[BAIRRO-POSTO] Não foi possível apagar os dados de Meu Bairro:', erro);
        alert('Não foi possível apagar todos os dados de Meu Bairro. O Bairro não foi removido.');
        return;
    }

    const indice = caixa.pastapai.indexOf(pai);
    if (indice < 0) return;
    caixa.pastapai.splice(indice, 1);
    estadoAtual.onTextoAlterado(caixa);
    document.getElementById('popup-bairro-posto-overlay')?.classList.remove('active');
    estadoAtual.renderizar?.();
}

function configurarRemoverBairro() {
    const botao = document.getElementById('bairro-posto-remover-bairro');
    if (!botao || !estadoAtual?.bairro || !estadoAtual?.pai) return;
    botao.onclick = () => removerBairroSelecionado();
}
function configurarToggleHistorico() {
    const botao = document.getElementById('btn-bairro-posto-historico');
    const lista = document.getElementById('bairro-posto-historico-lista');
    if (!botao || !lista) return;
    botao.onclick = () => {
        const aberto = !lista.hidden;
        lista.hidden = aberto;
        botao.setAttribute('aria-expanded', String(!aberto));
        botao.querySelector('i')?.classList.toggle('is-open', !aberto);
    };
}
function configurarOcultarChecados() {
    const toggle = document.getElementById('bairro-posto-ocultar-checados');
    if (!toggle || !estadoAtual?.bairro) return;
    const pais = estadoAtual.pai ? [estadoAtual.pai] : (estadoAtual.bairro.pastapai || []);
    toggle.checked = Boolean(estadoAtual.pai?.ocultarJaChecados);
    toggle.onchange = () => {
        const ativo = toggle.checked;
        pais.forEach(pai => {
            pai.ocultarJaChecados = ativo;
            if (!ativo) return;
            pai.pastafilho.filter(filho => filho.concluido && !filho.oculto).forEach(filho => {
                filho.oculto = true;
                filho.timestamp = Date.now();
            });
        });
        estadoAtual.onTextoAlterado(estadoAtual.bairro);
        renderizarHistorico();
        if (ativo) {
            document.querySelectorAll('.bairro-filho--concluido').forEach(item => {
                setTimeout(() => {
                    item.classList.add('bairro-filho--a-ocultar');
                }, 500);
            });
            setTimeout(() => estadoAtual.renderizar?.(), 680);
        } else {
            estadoAtual.renderizar?.();
        }
    };
    renderizarHistorico();
}
function cancelarOcultacaoPendente(filho) {
    if (!filho) return;
    if (filho.__ocultarTimer) {
        clearTimeout(filho.__ocultarTimer);
        delete filho.__ocultarTimer;
    }
    filho.oculto = false;
}
function configurarChecks() {
    const checksCasa = document.getElementById('bairro-posto-checks');
    const checksPai = document.getElementById('bairro-posto-checks-pai');
    if (estadoAtual?.filho) {
        renderizarOpcoesCheck(checksCasa, estadoAtual.filho.check, tipo => {
            cancelarOcultacaoPendente(estadoAtual.filho);
            estadoAtual.filho.check = tipo;
            estadoAtual.filho.timestamp = Date.now();
            estadoAtual.onTextoAlterado(estadoAtual.bairro);
            configurarChecks();
            estadoAtual.renderizar?.();
        });
    }
    if (estadoAtual?.pai) {
        renderizarOpcoesCheck(checksPai, estadoAtual.pai.check, tipo => {
            estadoAtual.pai.check = tipo;
            estadoAtual.pai.timestamp = Date.now();
            estadoAtual.pai.pastafilho.forEach(filho => {
                filho.check = tipo;
                filho.timestamp = Date.now();
            });
            estadoAtual.onTextoAlterado(estadoAtual.bairro);
            configurarChecks();
            estadoAtual.renderizar?.();
        });
    }
}

function configurarDirecaoCriacao() {
    const container = document.getElementById('bairro-posto-direcao-options');
    if (!container || !estadoAtual?.bairro) return;
    const direcaoAtual = estadoAtual.bairro.direcaoCriacao || 'baixo';
    container.querySelectorAll('button[data-bairro-direcao]').forEach(btn => {
        const direcao = btn.dataset.bairroDirecao;
        const ativa = direcao === direcaoAtual;
        btn.classList.toggle('active', ativa);
        btn.setAttribute('aria-pressed', String(ativa));
        btn.onclick = () => {
            estadoAtual.bairro.direcaoCriacao = direcao;
            estadoAtual.onTextoAlterado(estadoAtual.bairro);
            configurarDirecaoCriacao();
        };
    });
}
function selecionarSubAbaBairro(alvo = 'geral') {
    const overlay = document.getElementById('popup-bairro-posto-overlay');
    if (!overlay) return;
    const tabDestino = overlay.querySelector(`[data-bairro-bairro-tab="${alvo}"]`);
    if (!tabDestino || tabDestino.hidden) alvo = 'geral';
    overlay.querySelectorAll('[data-bairro-bairro-tab]').forEach(tab => {
        const ativa = tab.dataset.bairroBairroTab === alvo;
        tab.classList.toggle('active', ativa);
        tab.setAttribute('aria-selected', String(ativa));
    });
    overlay.querySelectorAll('[data-bairro-bairro-panel]').forEach(panel => {
        panel.hidden = panel.dataset.bairroBairroPanel !== alvo;
    });
    estadoAtual?.gestorMeuBairro?.seleccionar?.(alvo);
}

async function aplicarVisibilidadeMeuBairro() {
    const overlay = document.getElementById('popup-bairro-posto-overlay');
    if (!overlay) return false;
    const bairroIdDaAbertura = overlay.dataset.bairroId || '';

    const tabConfig = overlay.querySelector('#bairro-posto-meu-bairro-tab');
    const tabPratica = overlay.querySelector('#bairro-posto-meu-bairro-pratica-tab');
    if (!tabConfig || !tabPratica) return false;

    let permitido = false;
    try {
        permitido = await obterAcessoFerramenta(window.auth, 'posto_meu_bairro');
    } catch (erro) {
        console.warn('[MEU-BAIRRO] Não foi possível confirmar o acesso:', erro);
    }

    // O popup pode ter sido reaberto para outro Bairro enquanto a validação decorria.
    if ((estadoAtual?.pai?.id || '') !== bairroIdDaAbertura) return false;

    const temBairroModulo = Boolean(estadoAtual?.pai);
    tabConfig.hidden = !permitido || !temBairroModulo;
    if (!permitido) {
        tabPratica.hidden = true;
        if (['meu-bairro', 'meu-bairro-pratica'].includes(
            overlay.querySelector('[data-bairro-bairro-tab].active')?.dataset.bairroBairroTab
        )) selecionarSubAbaBairro('geral');
    } else {
        estadoAtual?.gestorMeuBairro?.actualizarTab?.();
    }
    return permitido;
}

function configurarAgendaBairro() {
    const overlay = document.getElementById('popup-bairro-posto-overlay');
    const bairro = estadoAtual?.bairro;
    if (!overlay || !bairro) return;

    overlay.querySelectorAll('[data-bairro-bairro-tab]').forEach(tab => {
        tab.onclick = async () => {
            const alvo = tab.dataset.bairroBairroTab;
            if (await permitirAbaPosto(alvo, tab.textContent.trim() || 'Esta aba')) selecionarSubAbaBairro(alvo);
        };
    });

    const toggleData = document.getElementById('bairro-posto-mostrar-data');
    if (toggleData) {
        toggleData.checked = Boolean(bairro.mostrarDataTarefa);
        toggleData.onchange = () => {
            bairro.mostrarDataTarefa = toggleData.checked;
            estadoAtual.onTextoAlterado(bairro);
            estadoAtual.renderizar?.();
        };
    }

    const toggleDataRealizacao = document.getElementById('bairro-posto-mostrar-data-realizacao');
    if (toggleDataRealizacao) {
        toggleDataRealizacao.checked = Boolean(bairro.mostrarDataRealizacaoTarefa);
        toggleDataRealizacao.onchange = () => {
            bairro.mostrarDataRealizacaoTarefa = toggleDataRealizacao.checked;
            estadoAtual.onTextoAlterado(bairro);
            estadoAtual.renderizar?.();
        };
    }

    const toggleOrganizar = document.getElementById('bairro-posto-organizar-data');
    const containerAgrupar = document.getElementById('bairro-posto-agrupar-container');
    if (toggleOrganizar) {
        toggleOrganizar.checked = Boolean(bairro.organizarPorData);
        if (containerAgrupar) containerAgrupar.style.display = bairro.organizarPorData ? 'block' : 'none';

        toggleOrganizar.onchange = () => {
            bairro.organizarPorData = toggleOrganizar.checked;
            if (containerAgrupar) containerAgrupar.style.display = bairro.organizarPorData ? 'block' : 'none';
            estadoAtual.onTextoAlterado(bairro);
            estadoAtual.renderizar?.();
        };
    }

    const containerModo = document.getElementById('bairro-posto-agrupar-modo-options');
    if (containerModo) {
        const modoAtual = bairro.agruparDataModo || 'dia';
        containerModo.querySelectorAll('button[data-bairro-agrupar]').forEach(btn => {
            const modo = btn.dataset.bairroAgrupar;
            const ativo = modo === modoAtual;
            btn.classList.toggle('active', ativo);
            btn.setAttribute('aria-pressed', String(ativo));
            btn.onclick = () => {
                bairro.agruparDataModo = modo;
                estadoAtual.onTextoAlterado(bairro);
                configurarAgendaBairro();
                estadoAtual.renderizar?.();
            };
        });
    }
}

function criarNovoBairroMeuBairro(novoEstado) {
    const caixa = estadoAtual?.bairro;
    const bairroActual = estadoAtual?.pai;
    if (!caixa || !bairroActual || !Array.isArray(caixa.pastapai)) return null;

    const modelo = obterModelo(novoEstado.categoria, novoEstado.modelo);
    const novoBairro = criarPaiBairro(`${modelo.label} · Meu Bairro`);
    novoEstado.bairroId = novoBairro.id;
    novoBairro.meuBairro = novoEstado;

    const indice = caixa.pastapai.indexOf(bairroActual);
    caixa.pastapai.splice(indice < 0 ? caixa.pastapai.length : indice + 1, 0, novoBairro);
    return novoBairro;
}

export function abrirBairroPosto(bairro, pai, filho, onTextoAlterado, renderizar, subAba = 'geral') {
    const overlay = document.getElementById('popup-bairro-posto-overlay');
    if (!overlay) return;
    overlay.dataset.bairroId = pai?.id || '';

    const tabMeuBairro = overlay.querySelector('#bairro-posto-meu-bairro-tab');
    const tabMeuBairroPratica = overlay.querySelector('#bairro-posto-meu-bairro-pratica-tab');
    if (tabMeuBairro) tabMeuBairro.hidden = true;
    if (tabMeuBairroPratica) {
        tabMeuBairroPratica.hidden = true;
        tabMeuBairroPratica.textContent = 'Meu Bairro';
        tabMeuBairroPratica.title = '';
    }

    estadoAtual = { bairro, pai, filho, onTextoAlterado, renderizar };

    const tabCasa = overlay.querySelector('[data-bairro-posto-tab="casa"]');
    const tabBairro = overlay.querySelector('[data-bairro-posto-tab="bairro"]');
    const tabs = overlay.querySelector('.bairro-posto-tabs');
    const temCasa = Boolean(filho);
    tabs?.classList.toggle('is-only-bairro', !temCasa);
    tabCasa.style.display = temCasa ? 'inline-flex' : 'none';
    tabBairro.style.display = 'inline-flex';

    overlay.querySelectorAll('[data-bairro-posto-tab]').forEach(tab => {
        tab.onclick = async () => {
            const alvo = tab.dataset.bairroPostoTab;
            if (await permitirAbaPosto(alvo, tab.textContent.trim() || 'Esta aba')) selecionarAba(alvo);
        };
    });
    document.getElementById('btn-fechar-bairro-posto').onclick = () => overlay.classList.remove('active');

    configurarTitulo();
    configurarActas(subAba);
    configurarChecks();
    configurarDirecaoCriacao();
    configurarOcultarChecados();
    const contexto = obterContexto();
    const moduloMeuBairro = pai || null;
    if (moduloMeuBairro) {
        estadoAtual.gestorMeuBairro = configurarMeuBairro({
            bairro: moduloMeuBairro,
            notaId: contexto?.notaId,
            db: contexto?.db,
            config: overlay.querySelector('#bairro-posto-meu-bairro-config'),
            pratica: overlay.querySelector('#bairro-posto-meu-bairro-pratica'),
            tabConfig: overlay.querySelector('#bairro-posto-meu-bairro-tab'),
            tabPratica: overlay.querySelector('#bairro-posto-meu-bairro-pratica-tab'),
            aoAlterar: () => {
                estadoAtual.onTextoAlterado(bairro);
                estadoAtual.renderizar?.();
            },
            aoConstruir: novoEstado => criarNovoBairroMeuBairro(novoEstado),
            aoSelecionar: selecionarSubAbaBairro
        });
    } else {
        estadoAtual.gestorMeuBairro = null;
        overlay.querySelector('#bairro-posto-meu-bairro-config')?.replaceChildren();
        overlay.querySelector('#bairro-posto-meu-bairro-pratica')?.replaceChildren();
    }
    configurarAgendaBairro();
    selecionarSubAbaBairro('geral');
    configurarRemoverCasa();
    configurarRemoverBairro();
    configurarToggleHistorico();
    configurarPesquisaLigacao();
    renderizarLigacaoAtual();
    configurarExplorador();
    selecionarAba(temCasa ? 'casa' : 'bairro');
    overlay.classList.add('active');
    aplicarVisibilidadeMeuBairro();
}
