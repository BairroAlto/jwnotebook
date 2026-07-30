import { TIPO_CHECK_BAIRRO } from '../../constants/bairro.js';
import { IDENTIDADE_FERRAMENTAS } from '../../constants/ferramentas.js';
import { carregarExploradorAssociar, pesquisarExploradorAssociar } from './tags/tags-associar-explorer.js';
import {
    anexarLigacaoBairro,
    removerLigacaoBairroDaCasa,
    irParaLigacaoBairro
} from './bairro-ligacoes.js';

const OPCOES_CHECK = [
    { tipo: TIPO_CHECK_BAIRRO.NENHUM, nome: 'X', detalhe: 'Clicável por completo', icone: 'fa-solid fa-xmark' },
    { tipo: TIPO_CHECK_BAIRRO.BOLA, nome: 'Bola', detalhe: 'Check circular', icone: 'fa-regular fa-circle' },
    { tipo: TIPO_CHECK_BAIRRO.QUADRADO, nome: 'Quadrado', detalhe: 'Check quadrado', icone: 'fa-regular fa-square' },
    { tipo: TIPO_CHECK_BAIRRO.SETA, nome: 'Seta', detalhe: 'Triângulo para a direita', icone: 'fa-solid fa-caret-right' }
];

let estadoAtual = null;

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
        const vazio = document.createElement('p');
        vazio.className = 'bairro-posto-vazio';
        vazio.textContent = 'Nenhuma pasta, nota ou caixa ligada.';
        container.appendChild(vazio);
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

function configurarRemoverBairro() {
    const botao = document.getElementById('bairro-posto-remover-bairro');
    if (!botao || !estadoAtual?.bairro) return;
    botao.onclick = () => {
        estadoAtual.bairro.oculto = true;
        estadoAtual.onTextoAlterado(estadoAtual.bairro);
        document.getElementById('popup-bairro-posto-overlay')?.classList.remove('active');
        estadoAtual.renderizar?.();
    };
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

export function abrirBairroPosto(bairro, pai, filho, onTextoAlterado, renderizar) {
    const overlay = document.getElementById('popup-bairro-posto-overlay');
    if (!overlay) return;
    estadoAtual = { bairro, pai, filho, onTextoAlterado, renderizar };

    const tabCasa = overlay.querySelector('[data-bairro-posto-tab="casa"]');
    const tabBairro = overlay.querySelector('[data-bairro-posto-tab="bairro"]');
    const tabs = overlay.querySelector('.bairro-posto-tabs');
    const temCasa = Boolean(filho);
    tabs?.classList.toggle('is-only-bairro', !temCasa);
    tabCasa.style.display = temCasa ? 'inline-flex' : 'none';
    tabBairro.style.display = 'inline-flex';

    overlay.querySelectorAll('[data-bairro-posto-tab]').forEach(tab => {
        tab.onclick = () => selecionarAba(tab.dataset.bairroPostoTab);
    });
    document.getElementById('btn-fechar-bairro-posto').onclick = () => overlay.classList.remove('active');

    configurarTitulo();
    configurarChecks();
    configurarDirecaoCriacao();
    configurarOcultarChecados();
    configurarRemoverBairro();
    configurarToggleHistorico();
    configurarExplorador();
    configurarPesquisaLigacao();
    renderizarLigacaoAtual();
    selecionarAba(temCasa ? 'casa' : 'bairro');
    overlay.classList.add('active');
}
